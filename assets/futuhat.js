(function () {
  "use strict";

  const I18n = window.DostI18n;
  const wrapEl = document.getElementById("futuhat-wrap");
  const partsEl = document.getElementById("futuhat-parts");
  const articleEl = document.getElementById("futuhat-article");
  const statsEl = document.getElementById("futuhat-stats");
  const tooltip = document.getElementById("futuhat-tooltip");
  const popupEl = document.getElementById("futuhat-popup");
  const popupBackdrop = document.getElementById("futuhat-popup-backdrop");
  const popupClose = document.getElementById("futuhat-popup-close");
  const popupTitleEl = document.getElementById("futuhat-popup-title");
  const popupListEl = document.getElementById("futuhat-popup-list");

  function tt(dict) {
    return I18n.pick3(dict);
  }

  // --- Popup (used by the "in this part" stats panel) ---
  function openPopup(title, items, renderRow, onItemClick) {
    if (!popupEl) return;
    popupTitleEl.textContent = title;
    popupListEl.innerHTML = items.map((it, i) => renderRow(it, i)).join("");
    popupListEl.querySelectorAll("[data-popup-idx]").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.popupIdx);
        onItemClick(items[idx], idx);
        closePopup();
      });
    });
    popupEl.hidden = false;
  }

  function closePopup() {
    if (popupEl) popupEl.hidden = true;
  }

  if (popupBackdrop) popupBackdrop.addEventListener("click", closePopup);
  if (popupClose) popupClose.addEventListener("click", closePopup);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && popupEl && !popupEl.hidden) closePopup();
  });

  function navigateToDiagram(diagramId, nodeId) {
    closePopup();
    const diagramEl = wrapEl && wrapEl.querySelector(`[data-diagram-id="${CSS.escape(diagramId)}"]`);
    if (!diagramEl) return;
    diagramEl.scrollIntoView({ behavior: "smooth", block: "center" });
    const target = nodeId ? diagramEl.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`) : diagramEl;
    if (target) {
      setTimeout(() => {
        target.classList.add("futuhat-pulse");
        setTimeout(() => target.classList.remove("futuhat-pulse"), 1700);
      }, 350);
    }
  }

  function navigateToSource(index) {
    closePopup();
    const li = wrapEl && wrapEl.querySelector(`.futuhat-sources li[data-source-index="${index}"]`);
    if (!li) return;
    li.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      li.classList.add("futuhat-pulse");
      setTimeout(() => li.classList.remove("futuhat-pulse"), 1700);
    }, 350);
  }

  let futuhatData = null;
  let dataPromise = null;
  let activePartId = null;

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("futuhat-wrap");
    dataPromise = fetch("data/ibn-arabi/futuhat-atlas.json")
      .then((r) => r.json())
      .then((data) => {
        futuhatData = data;
        activePartId = data.activePartId;
        if (window.DostViewStatus) window.DostViewStatus.hide("futuhat-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Fütûhât atlası yüklenemedi / Failed to load Futuhat atlas", err);
        dataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("futuhat-wrap", () => window.__futuhatApp.activate());
      });
    return dataPromise;
  }

  function partById(id) {
    return futuhatData.parts.find((p) => p.id === id);
  }

  // --- Stats: walk the part's diagrams and count concepts / relations ---
  function collectTreeStats(node, acc) {
    acc.concepts += 1;
    (node.children || []).forEach((c) => {
      acc.relations += 1;
      collectTreeStats(c, acc);
    });
  }

  function computeStats(part) {
    const acc = { concepts: 0, relations: 0, diagrams: 0 };
    collectTreeStats(part.mainDiagram.tree, acc);
    acc.diagrams += 1;
    (part.sections || []).forEach((s) => {
      (s.blocks || []).forEach((b) => {
        if (b.type !== "diagram") return;
        if (b.triad) {
          acc.diagrams += 1;
          acc.concepts += 3;
          acc.relations += 2;
        } else if (b.pair) {
          acc.diagrams += 1;
          acc.concepts += 2;
          acc.relations += 1;
        } else if (b.tree) {
          acc.diagrams += 1;
          collectTreeStats(b.tree, acc);
        } else if (!b.useMainDiagram) {
          acc.diagrams += 1;
        }
      });
    });
    return { concepts: acc.concepts, diagrams: acc.diagrams, relations: acc.relations, sources: (part.sources || []).length };
  }

  // --- Flat lists for the "in this part" popups ---
  function walkConcepts(node, diagramId, out) {
    out.push({ diagramId, nodeId: node.id, label: node.label, note: node.note });
    (node.children || []).forEach((c) => walkConcepts(c, diagramId, out));
  }

  function walkRelations(node, diagramId, out) {
    (node.children || []).forEach((c) => {
      out.push({ diagramId, nodeId: c.id, parentLabel: node.label, childLabel: c.label, note: c.note });
      walkRelations(c, diagramId, out);
    });
  }

  function forEachDiagramBlock(part, fn) {
    fn({ diagramId: "main", tree: part.mainDiagram.tree, sectionHeading: part.title });
    (part.sections || []).forEach((s, si) => {
      (s.blocks || []).forEach((b, bi) => {
        if (b.type !== "diagram" || b.useMainDiagram) return;
        fn({ diagramId: `s${si}-b${bi}`, tree: b.tree, triad: b.triad, pair: b.pair, sectionHeading: s.heading, caption: b.caption || b.source });
      });
    });
  }

  function collectConcepts(part) {
    const out = [];
    forEachDiagramBlock(part, (d) => {
      if (d.tree) walkConcepts(d.tree, d.diagramId, out);
      else if (d.triad) {
        out.push({ diagramId: d.diagramId, nodeId: "left", label: d.triad.left.label, note: d.triad.left.note });
        out.push({ diagramId: d.diagramId, nodeId: "middle", label: d.triad.middle.label, note: d.triad.middle.note });
        out.push({ diagramId: d.diagramId, nodeId: "right", label: d.triad.right.label, note: d.triad.right.note });
      } else if (d.pair) {
        out.push({ diagramId: d.diagramId, nodeId: "left", label: d.pair.left.label, note: d.pair.left.note });
        out.push({ diagramId: d.diagramId, nodeId: "right", label: d.pair.right.label, note: d.pair.right.note });
      }
    });
    return out;
  }

  function collectDiagramsList(part) {
    const out = [];
    forEachDiagramBlock(part, (d) => {
      out.push({ diagramId: d.diagramId, label: d.sectionHeading, caption: d.caption || part.mainDiagram.caption });
    });
    return out;
  }

  function collectRelations(part) {
    const out = [];
    forEachDiagramBlock(part, (d) => {
      if (d.tree) walkRelations(d.tree, d.diagramId, out);
      else if (d.triad) {
        out.push({ diagramId: d.diagramId, nodeId: "left", parentLabel: d.triad.middle.label, childLabel: d.triad.left.label, note: d.triad.left.note });
        out.push({ diagramId: d.diagramId, nodeId: "right", parentLabel: d.triad.middle.label, childLabel: d.triad.right.label, note: d.triad.right.note });
      } else if (d.pair) {
        out.push({ diagramId: d.diagramId, nodeId: "right", parentLabel: d.pair.left.label, childLabel: d.pair.right.label, note: d.pair.right.note });
      }
    });
    return out;
  }

  // --- Radial tree diagram (Bölüm Haritası) ---
  function renderRadialTree(mount, treeData, opts) {
    const radius = opts.radius || 190;

    const root = d3.hierarchy(treeData, (d) => d.children);
    const sweep = Math.PI * 2 * 0.94;
    const layout = d3
      .tree()
      .size([sweep, radius])
      .separation((a, b) => (a.parent === b.parent ? 1.4 : 2) / Math.max(1, Math.sqrt(a.depth)));
    layout(root);

    // d3's radial convention: angle 0 = north (up), increasing clockwise.
    // Node position and linkRadial() below both use this same convention,
    // so the connecting lines land exactly on the node centers.
    root.each((d) => {
      d.px = d.y * Math.sin(d.x);
      d.py = -d.y * Math.cos(d.x);
    });

    // Auto-fit the viewBox to the actual node bounds (plus room for labels)
    // instead of a fixed canvas, so the tree is centered whatever its shape.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    root.each((d) => {
      x0 = Math.min(x0, d.px); x1 = Math.max(x1, d.px);
      y0 = Math.min(y0, d.py); y1 = Math.max(y1, d.py);
    });
    x0 -= 150; x1 += 150; y0 -= 36; y1 += 36;

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-tree__svg")
      .attr("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`)
      .attr("role", "img")
      .attr("aria-label", tt(opts.ariaLabel || { tr: "Kavram haritası", en: "Concept map", pt: "Mapa de conceitos" }));

    const linkGen = d3.linkRadial().angle((d) => d.x).radius((d) => d.y);

    svg
      .append("g")
      .attr("class", "futuhat-tree__links")
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("class", "futuhat-tree__link")
      .attr("d", linkGen);

    const nodeSel = svg
      .append("g")
      .attr("class", "futuhat-tree__nodes")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("class", (d) => "futuhat-tree__node futuhat-tree__node--depth-" + d.depth)
      .attr("transform", (d) => `translate(${d.px},${d.py})`)
      .attr("data-node-id", (d) => d.data.id)
      .attr("tabindex", "0")
      .attr("role", "img")
      .attr("aria-label", (d) => tt(d.data.label))
      .on("mouseenter", (event, d) => showTip(d, event))
      .on("mousemove", (event) => moveTip(event))
      .on("mouseleave", hideTip)
      .on("focus", (event, d) => showTip(d, event))
      .on("blur", hideTip);

    nodeSel
      .append("circle")
      .attr("r", (d) => (d.depth === 0 ? 15 : d.depth === 1 ? 11 : 8));

    nodeSel
      .append("circle")
      .attr("class", "node-sheen")
      .attr("r", (d) => (d.depth === 0 ? 15 : d.depth === 1 ? 11 : 8));

    nodeSel
      .append("text")
      .attr("class", "futuhat-tree__label")
      .attr("text-anchor", (d) => {
        if (d.depth === 0) return "middle";
        const a = ((d.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        return a > Math.PI ? "end" : "start";
      })
      .attr("dx", (d) => {
        if (d.depth === 0) return 0;
        const a = ((d.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const r = d.depth === 1 ? 11 : 8;
        return a > Math.PI ? -(r + 6) : r + 6;
      })
      .attr("dy", (d) => (d.depth === 0 ? -22 : "0.32em"))
      .text((d) => tt(d.data.label));
  }

  function showTip(d, event) {
    if (!tooltip || !d.data.note) return;
    tooltip.innerHTML = `<div class="node-hover-tip__title">${tt(d.data.label)}</div><p>${tt(d.data.note)}</p>`;
    tooltip.hidden = false;
    moveTip(event);
  }

  function moveTip(event) {
    if (!tooltip || tooltip.hidden || !wrapEl) return;
    const rect = wrapEl.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    x = Math.max(90, Math.min(rect.width - 90, x));
    y = Math.max(40, y);
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function hideTip() {
    if (tooltip) tooltip.hidden = true;
  }

  // --- Triad diagram (three-point comparison, e.g. Teorik / Hâl / Sır) ---
  function renderTriad(mount, triad) {
    const width = 460, height = 130, cy = 55;
    const positions = [70, 230, 390];
    const items = [triad.left, triad.middle, triad.right];
    const nodeIds = ["left", "middle", "right"];

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-triad__svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", tt(triad.middle.label));

    svg
      .append("line")
      .attr("class", "futuhat-triad__axis")
      .attr("x1", positions[0]).attr("y1", cy)
      .attr("x2", positions[2]).attr("y2", cy);

    const g = svg
      .selectAll("g.futuhat-triad__node")
      .data(items)
      .join("g")
      .attr("class", (d, i) => "futuhat-triad__node" + (i === 1 ? " futuhat-triad__node--accent" : ""))
      .attr("data-node-id", (d, i) => nodeIds[i])
      .attr("transform", (d, i) => `translate(${positions[i]},${cy})`);

    g.append("circle").attr("r", (d, i) => (i === 1 ? 15 : 12));
    g.append("circle").attr("class", "node-sheen").attr("r", (d, i) => (i === 1 ? 15 : 12));
    g.append("text")
      .attr("class", "futuhat-triad__label")
      .attr("text-anchor", "middle")
      .attr("y", -26)
      .text((d) => tt(d.label));
    g.append("text")
      .attr("class", "futuhat-triad__note")
      .attr("text-anchor", "middle")
      .attr("y", 32)
      .text((d) => tt(d.note));
  }

  // --- Pair diagram (two-way comparison, e.g. Makam / Hâl) ---
  function renderPair(mount, pair) {
    const width = 320, height = 130, cy = 55;
    const positions = [80, 240];
    const items = [pair.left, pair.right];
    const nodeIds = ["left", "right"];

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-triad__svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", tt(pair.left.label) + " / " + tt(pair.right.label));

    svg
      .append("line")
      .attr("class", "futuhat-triad__axis")
      .attr("x1", positions[0]).attr("y1", cy)
      .attr("x2", positions[1]).attr("y2", cy);

    const g = svg
      .selectAll("g.futuhat-triad__node")
      .data(items)
      .join("g")
      .attr("class", "futuhat-triad__node")
      .attr("data-node-id", (d, i) => nodeIds[i])
      .attr("transform", (d, i) => `translate(${positions[i]},${cy})`);

    g.append("circle").attr("r", 14);
    g.append("circle").attr("class", "node-sheen").attr("r", 14);
    g.append("text")
      .attr("class", "futuhat-triad__label")
      .attr("text-anchor", "middle")
      .attr("y", -25)
      .text((d) => tt(d.label));
    g.append("text")
      .attr("class", "futuhat-triad__note")
      .attr("text-anchor", "middle")
      .attr("y", 31)
      .text((d) => tt(d.note));
  }

  // --- Article rendering ---
  function renderParts() {
    if (!partsEl) return;
    const kisimlar = Array.from({ length: futuhatData.book.totalKisim }, (_, i) => i + 1);
    partsEl.innerHTML = `
      <span class="futuhat-parts__cilt">${tt({ tr: "Cilt I", en: "Volume I", pt: "Volume I" })}</span>
      ${kisimlar
        .map((no) => {
          const part = futuhatData.parts.find((p) => p.cilt === 1 && p.kisim === no);
          if (part) {
            return `<button class="futuhat-part-chip futuhat-part-chip--active" type="button" data-id="${part.id}">${tt({ tr: "Kısım " + roman(no), en: "Part " + roman(no), pt: "Parte " + roman(no) })}</button>`;
          }
          return `<span class="futuhat-part-chip futuhat-part-chip--soon" title="${tt({ tr: "Yakında", en: "Coming soon", pt: "Em breve" })}">${roman(no)}</span>`;
        })
        .join("")}
      <span class="futuhat-parts__more">${tt({ tr: "Cilt II–XVIII yakında", en: "Volumes II–XVIII coming soon", pt: "Volumes II–XVIII em breve" })}</span>
    `;
  }

  function roman(n) {
    const map = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    return map[n - 1] || String(n);
  }

  function renderStats(part) {
    if (!statsEl) return;
    const stats = computeStats(part);
    const row = (key, labelDict, value) => `
      <button class="futuhat-stats__item" type="button" data-stat="${key}">
        <span>${tt(labelDict)}</span>
        <strong>${value}</strong>
      </button>
    `;
    statsEl.innerHTML = `
      <p class="futuhat-stats__heading">${tt({ tr: "Bu kısımda", en: "In this part", pt: "Nesta parte" })}</p>
      ${row("concepts", { tr: "Kavram", en: "Concepts", pt: "Conceitos" }, stats.concepts)}
      ${row("diagrams", { tr: "Çizim", en: "Diagrams", pt: "Diagramas" }, stats.diagrams)}
      ${row("relations", { tr: "İlişki", en: "Relations", pt: "Relações" }, stats.relations)}
      ${row("sources", { tr: "Kaynak", en: "Sources", pt: "Fontes" }, stats.sources)}
    `;

    const bind = (key, handler) => {
      const btn = statsEl.querySelector(`[data-stat="${key}"]`);
      if (btn) btn.addEventListener("click", handler);
    };

    bind("concepts", () => {
      const items = collectConcepts(part);
      openPopup(
        tt({ tr: "Kavramlar", en: "Concepts", pt: "Conceitos" }),
        items,
        (it, i) => `
          <button class="futuhat-popup__row" type="button" data-popup-idx="${i}">
            <span class="futuhat-popup__row-title">${tt(it.label)}</span>
            ${it.note ? `<span class="futuhat-popup__row-note">${tt(it.note)}</span>` : ""}
          </button>
        `,
        (it) => navigateToDiagram(it.diagramId, it.nodeId)
      );
    });

    bind("diagrams", () => {
      const items = collectDiagramsList(part);
      openPopup(
        tt({ tr: "Çizimler", en: "Diagrams", pt: "Diagramas" }),
        items,
        (it, i) => `
          <button class="futuhat-popup__row" type="button" data-popup-idx="${i}">
            <span class="futuhat-popup__row-title">${tt(it.label)}</span>
            ${it.caption ? `<span class="futuhat-popup__row-note">${tt(it.caption)}</span>` : ""}
          </button>
        `,
        (it) => navigateToDiagram(it.diagramId, null)
      );
    });

    bind("relations", () => {
      const items = collectRelations(part);
      openPopup(
        tt({ tr: "İlişkiler", en: "Relations", pt: "Relações" }),
        items,
        (it, i) => `
          <button class="futuhat-popup__row" type="button" data-popup-idx="${i}">
            <span class="futuhat-popup__row-title">${tt(it.parentLabel)} → ${tt(it.childLabel)}</span>
            ${it.note ? `<span class="futuhat-popup__row-note">${tt(it.note)}</span>` : ""}
          </button>
        `,
        (it) => navigateToDiagram(it.diagramId, it.nodeId)
      );
    });

    bind("sources", () => {
      openPopup(
        tt({ tr: "Kaynaklar", en: "Sources", pt: "Fontes" }),
        part.sources,
        (s, i) => `
          <button class="futuhat-popup__row" type="button" data-popup-idx="${i}">
            <span class="futuhat-popup__row-title">${tt(s)}</span>
          </button>
        `,
        (s, i) => navigateToSource(i)
      );
    });
  }

  function renderPart(part) {
    articleEl.innerHTML = `
      <header class="futuhat-hero">
        <p class="futuhat-hero__eyebrow">${tt({ tr: "Fütûhât-ı Mekkiyye", en: "al-Futuhat al-Makkiyya", pt: "al-Futuhat al-Makkiyya" })} · ${tt({ tr: "Cilt I", en: "Volume I", pt: "Volume I" })} · ${tt({ tr: "Kısım " + roman(part.kisim), en: "Part " + roman(part.kisim), pt: "Parte " + roman(part.kisim) })}</p>
        <h1 class="futuhat-hero__title">${tt(part.title)}</h1>
        <p class="futuhat-hero__summary">${tt(part.hero.summary)}</p>
      </header>

      <section class="futuhat-maindiagram" data-diagram-id="main">
        <div class="futuhat-tree" id="futuhat-main-tree"></div>
        <p class="futuhat-diagram-source">${tt(part.mainDiagram.caption)}</p>
      </section>

      <div class="futuhat-sections" id="futuhat-sections"></div>

      <section class="futuhat-sources">
        <p class="detail-eyebrow">${tt({ tr: "Kaynaklar", en: "Sources", pt: "Fontes" })}</p>
        <ul>
          ${part.sources.map((s, i) => `<li data-source-index="${i}">${tt(s)}</li>`).join("")}
        </ul>
      </section>
    `;

    renderRadialTree(document.getElementById("futuhat-main-tree"), part.mainDiagram.tree, {
      ariaLabel: part.title,
    });

    const sectionsEl = document.getElementById("futuhat-sections");
    part.sections.forEach((section, si) => {
      const secEl = document.createElement("section");
      secEl.className = "futuhat-section";
      secEl.innerHTML = `<h2 class="futuhat-section__heading">${tt(section.heading)}</h2>`;
      section.blocks.forEach((block, bi) => {
        if (block.type === "p") {
          const p = document.createElement("p");
          p.className = "futuhat-section__p";
          p.innerHTML = tt(block.text);
          secEl.appendChild(p);
        } else if (block.type === "diagram") {
          const dCard = document.createElement("div");
          dCard.className = "futuhat-inline-diagram";
          if (!block.useMainDiagram) dCard.dataset.diagramId = `s${si}-b${bi}`;
          const mount = document.createElement("div");
          mount.className = "futuhat-tree futuhat-tree--inline";
          dCard.appendChild(mount);
          if (block.caption) {
            const capP = document.createElement("p");
            capP.className = "futuhat-inline-diagram__caption";
            capP.textContent = tt(block.caption);
            dCard.appendChild(capP);
          }
          const srcP = document.createElement("p");
          srcP.className = "futuhat-diagram-source";
          srcP.textContent = tt(block.source);
          dCard.appendChild(srcP);
          secEl.appendChild(dCard);

          if (block.triad) {
            renderTriad(mount, block.triad);
          } else if (block.pair) {
            renderPair(mount, block.pair);
          } else if (block.useMainDiagram) {
            renderRadialTree(mount, part.mainDiagram.tree, { radius: 160, ariaLabel: part.title });
          } else if (block.tree) {
            renderRadialTree(mount, block.tree, { radius: 160, ariaLabel: section.heading });
          }
        }
      });
      sectionsEl.appendChild(secEl);
    });

    renderStats(part);
  }

  function activatePart(id) {
    const part = partById(id);
    if (!part) return;
    activePartId = id;
    if (partsEl) {
      partsEl.querySelectorAll(".futuhat-part-chip").forEach((chip) => {
        chip.classList.toggle("futuhat-part-chip--current", chip.dataset.id === id);
      });
    }
    renderPart(part);
  }

  function render() {
    if (!futuhatData) return;
    renderParts();
    if (partsEl) {
      partsEl.querySelectorAll(".futuhat-part-chip[data-id]").forEach((chip) => {
        chip.addEventListener("click", () => activatePart(chip.dataset.id));
      });
    }
    activatePart(activePartId);
  }

  window.__futuhatApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        render();
      });
    },
    onLangChange() {
      render();
    },
  };
})();
