(function () {
  "use strict";

  const I18n = window.DostI18n;
  const wrapEl = document.getElementById("futuhat-wrap");
  const partsEl = document.getElementById("futuhat-parts");
  const articleEl = document.getElementById("futuhat-article");
  const statsEl = document.getElementById("futuhat-stats");
  const tooltip = document.getElementById("futuhat-tooltip");

  function tt(dict) {
    return I18n.pick3(dict);
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
        } else if (!b.useMainDiagram) {
          acc.diagrams += 1;
        }
      });
    });
    return { concepts: acc.concepts, diagrams: acc.diagrams, relations: acc.relations, sources: (part.sources || []).length };
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
    statsEl.innerHTML = `
      <p class="futuhat-stats__heading">${tt({ tr: "Bu kısımda", en: "In this part", pt: "Nesta parte" })}</p>
      <div class="futuhat-stats__item"><span>${tt({ tr: "Kavram", en: "Concepts", pt: "Conceitos" })}</span><strong>${stats.concepts}</strong></div>
      <div class="futuhat-stats__item"><span>${tt({ tr: "Çizim", en: "Diagrams", pt: "Diagramas" })}</span><strong>${stats.diagrams}</strong></div>
      <div class="futuhat-stats__item"><span>${tt({ tr: "İlişki", en: "Relations", pt: "Relações" })}</span><strong>${stats.relations}</strong></div>
      <div class="futuhat-stats__item"><span>${tt({ tr: "Kaynak", en: "Sources", pt: "Fontes" })}</span><strong>${stats.sources}</strong></div>
    `;
  }

  function renderPart(part) {
    articleEl.innerHTML = `
      <header class="futuhat-hero">
        <p class="futuhat-hero__eyebrow">${tt({ tr: "Fütûhât-ı Mekkiyye", en: "al-Futuhat al-Makkiyya", pt: "al-Futuhat al-Makkiyya" })} · ${tt({ tr: "Cilt I", en: "Volume I", pt: "Volume I" })} · ${tt({ tr: "Kısım " + roman(part.kisim), en: "Part " + roman(part.kisim), pt: "Parte " + roman(part.kisim) })}</p>
        <h1 class="futuhat-hero__title">${tt(part.title)}</h1>
        <p class="futuhat-hero__summary">${tt(part.hero.summary)}</p>
      </header>

      <section class="futuhat-maindiagram">
        <div class="futuhat-tree" id="futuhat-main-tree"></div>
        <p class="futuhat-diagram-source">${tt(part.mainDiagram.caption)}</p>
      </section>

      <div class="futuhat-sections" id="futuhat-sections"></div>

      <section class="futuhat-sources">
        <p class="detail-eyebrow">${tt({ tr: "Kaynaklar", en: "Sources", pt: "Fontes" })}</p>
        <ul>
          ${part.sources.map((s) => `<li>${tt(s)}</li>`).join("")}
        </ul>
      </section>
    `;

    renderRadialTree(document.getElementById("futuhat-main-tree"), part.mainDiagram.tree, {
      ariaLabel: part.title,
    });

    const sectionsEl = document.getElementById("futuhat-sections");
    part.sections.forEach((section) => {
      const secEl = document.createElement("section");
      secEl.className = "futuhat-section";
      secEl.innerHTML = `<h2 class="futuhat-section__heading">${tt(section.heading)}</h2>`;
      section.blocks.forEach((block) => {
        if (block.type === "p") {
          const p = document.createElement("p");
          p.className = "futuhat-section__p";
          p.innerHTML = tt(block.text);
          secEl.appendChild(p);
        } else if (block.type === "diagram") {
          const dCard = document.createElement("div");
          dCard.className = "futuhat-inline-diagram";
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
