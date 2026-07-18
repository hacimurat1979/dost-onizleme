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

  function linkify(text) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text) : text;
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

  // Ağaç düğümüne tıklanınca gösterilen bilgi kutusu; aynı düğüme tekrar
  // tıklanınca veya başka bir yere tıklanınca kapanır.
  let activeTipNodeId = null;
  document.addEventListener("click", () => {
    if (activeTipNodeId) hideTip();
  });

  // --- Diagram lightbox (click a diagram to see it enlarged) ---
  function openDiagramLightbox(mount, captionText) {
    window.DostLightbox.open({
      closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
      svgHtml: mount.innerHTML,
      caption: captionText || "",
    });
    wireLightboxNodeTooltips();
  }

  // mount.innerHTML sadece bir metin dizesi olarak kopyalanıp lightbox'ın
  // içine yeniden ayrıştırıldığı için, orijinal düğümlere D3 ile bağlanmış
  // olay dinleyicileri (hover/tıklama) ve bağlı veri (d.data) kopyada
  // kaybolur. Bu yüzden lightbox açılınca, düğümlerin üzerine önceden
  // gömdüğümüz data-label-*/data-note-* özniteliklerinden okuyan, ayrı ve
  // sabit-konumlu (position:fixed) bir bilgi kutusunu yeniden bağlıyoruz.
  let lightboxTipEl = null;
  let lightboxActiveTipId = null;

  function ensureLightboxTip() {
    if (lightboxTipEl) return lightboxTipEl;
    lightboxTipEl = document.createElement("div");
    lightboxTipEl.className = "node-hover-tip node-hover-tip--lightbox";
    lightboxTipEl.hidden = true;
    document.body.appendChild(lightboxTipEl);
    return lightboxTipEl;
  }

  function dataI18n(el, base) {
    const lang = I18n.getLang();
    return el.getAttribute(`data-${base}-${lang}`) || el.getAttribute(`data-${base}-en`) || el.getAttribute(`data-${base}-tr`) || "";
  }

  function moveLightboxTip(event) {
    if (!lightboxTipEl || lightboxTipEl.hidden) return;
    let x = event.clientX;
    let y = event.clientY;
    x = Math.max(90, Math.min(window.innerWidth - 90, x));
    y = Math.max(40, y);
    lightboxTipEl.style.left = x + "px";
    lightboxTipEl.style.top = y + "px";
  }

  function wireLightboxNodeTooltips() {
    const wrap = document.querySelector(".cizim-lightbox__svg-wrap");
    if (!wrap) return;
    const tip = ensureLightboxTip();
    tip.hidden = true;
    lightboxActiveTipId = null;
    wrap.querySelectorAll(".futuhat-tree__node").forEach((el) => {
      const note = dataI18n(el, "note");
      if (!note) return;
      const label = dataI18n(el, "label");
      const show = (event) => {
        tip.innerHTML = `<div class="node-hover-tip__title">${label}</div><p>${note}</p>`;
        tip.hidden = false;
        moveLightboxTip(event);
      };
      const hide = () => {
        tip.hidden = true;
        lightboxActiveTipId = null;
      };
      el.addEventListener("mouseenter", show);
      el.addEventListener("mousemove", moveLightboxTip);
      el.addEventListener("mouseleave", hide);
      el.addEventListener("focus", show);
      el.addEventListener("blur", hide);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = el.getAttribute("data-node-id");
        if (lightboxActiveTipId === id) {
          hide();
        } else {
          show(event);
          lightboxActiveTipId = id;
        }
      });
    });
  }

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
    x0 -= 220; x1 += 220; y0 -= 36; y1 += 36;

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
      .attr("data-label-tr", (d) => (d.data.label ? d.data.label.tr : ""))
      .attr("data-label-en", (d) => (d.data.label ? d.data.label.en : ""))
      .attr("data-label-pt", (d) => (d.data.label ? d.data.label.pt : ""))
      .attr("data-note-tr", (d) => (d.data.note ? d.data.note.tr : ""))
      .attr("data-note-en", (d) => (d.data.note ? d.data.note.en : ""))
      .attr("data-note-pt", (d) => (d.data.note ? d.data.note.pt : ""))
      .attr("tabindex", "0")
      .attr("aria-label", (d) => tt(d.data.label))
      .on("mouseenter", (event, d) => showTip(d, event))
      .on("mousemove", (event) => moveTip(event))
      .on("mouseleave", hideTip)
      .on("focus", (event, d) => showTip(d, event))
      .on("blur", hideTip)
      .on("click", (event, d) => {
        // Fare ile üzerine gelmenin (hover) açığa çıkardığı bilgiyi, dokunmatik
        // ekranlarda hover diye bir şey olmadığı için tıklamayla da göster --
        // ikinci kez aynı düğüme dokununca kapansın, yayılımı (propagation)
        // durdurup mount'un "büyüt" tıklamasını tetiklemesin.
        event.stopPropagation();
        if (activeTipNodeId === d.data.id) {
          hideTip();
        } else {
          showTip(d, event);
          activeTipNodeId = d.data.id;
        }
      });

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
    showTipHTML(`<div class="node-hover-tip__title">${tt(d.data.label)}</div><p>${tt(d.data.note)}</p>`);
    moveTip(event);
  }

  function showTipHTML(html) {
    if (!tooltip) return;
    tooltip.innerHTML = html;
    tooltip.hidden = false;
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

  function positionTipAtElement(el) {
    if (!tooltip || !wrapEl) return;
    const wrapRect = wrapEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    let x = elRect.left + elRect.width / 2 - wrapRect.left;
    let y = elRect.top - wrapRect.top;
    x = Math.max(90, Math.min(wrapRect.width - 90, x));
    y = Math.max(40, y);
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function hideTip() {
    if (tooltip) tooltip.hidden = true;
    activeTipNodeId = null;
  }

  // --- Wikipedia-style hover preview for cross-links inside article prose ---
  function showCrossLinkPreview(anchorEl, event) {
    const view = anchorEl.dataset.view;
    const id = anchorEl.dataset.id;
    const summary = window.__dostCrossLink && window.__dostCrossLink.getSummary
      ? window.__dostCrossLink.getSummary(view, id)
      : null;
    if (!summary) return;
    showTipHTML(`<div class="node-hover-tip__title">${anchorEl.textContent}</div><p>${summary}</p>`);
    if (event && typeof event.clientX === "number") moveTip(event);
    else positionTipAtElement(anchorEl);
  }

  function setupCrossLinkPreviews() {
    if (!articleEl) return;
    articleEl.addEventListener("mouseover", (event) => {
      const a = event.target.closest(".cross-link");
      if (a) showCrossLinkPreview(a, event);
    });
    articleEl.addEventListener("mousemove", (event) => {
      const a = event.target.closest(".cross-link");
      if (a && tooltip && !tooltip.hidden) moveTip(event);
    });
    articleEl.addEventListener("mouseout", (event) => {
      if (event.target.closest(".cross-link")) hideTip();
    });
    articleEl.addEventListener("focusin", (event) => {
      const a = event.target.closest(".cross-link");
      if (a) showCrossLinkPreview(a, event);
    });
    articleEl.addEventListener("focusout", (event) => {
      if (event.target.closest(".cross-link")) hideTip();
    });
    articleEl.addEventListener("mousedown", (event) => {
      if (event.target.closest(".cross-link")) hideTip();
    });
  }

  // Uzun notlar tek satırda merkezden taşıp SVG viewBox kenarından kırpılmasın
  // diye (özellikle uçtaki sol/sağ düğümlerde), metni birden çok tspan'a bölüyoruz.
  // Karakter sayısına göre bölüyoruz (piksel genişliği değil) çünkü
  // getComputedTextLength() ilk render anında özel yazı tipi (Source Sans
  // Dost) henüz yüklenmemişse yedek fontla ölçüp yanlışlıkla dar sonuç
  // verebiliyor -- bu da satır bölünmesinin hiç tetiklenmemesine yol açıyordu.
  function wrapSvgText(textSelection, maxChars) {
    textSelection.each(function () {
      const el = d3.select(this);
      const words = el.text().split(/\s+/).filter(Boolean);
      const x = el.attr("x") || 0;
      const y = el.attr("y");
      el.text(null);
      let line = [];
      let lineNumber = 0;
      const lineHeight = 1.15;
      let tspan = el.append("tspan").attr("x", x).attr("y", y);
      words.forEach((word) => {
        const candidate = line.concat(word).join(" ");
        if (line.length && candidate.length > maxChars) {
          tspan.text(line.join(" "));
          line = [word];
          lineNumber += 1;
          tspan = el.append("tspan").attr("x", x).attr("y", y).attr("dy", `${lineNumber * lineHeight}em`);
        } else {
          line.push(word);
        }
        tspan.text(line.join(" "));
      });
    });
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
      .text((d) => tt(d.note))
      .call(wrapSvgText, 24);
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
      .text((d) => tt(d.note))
      .call(wrapSvgText, 24);
  }

  // --- Article rendering ---
  const CILT_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII"];

  function renderParts() {
    if (!partsEl) return;
    const cilts = futuhatData.book.cilts || [];
    partsEl.innerHTML = cilts
      .map((c) => {
        const kisimlar = Array.from({ length: c.kisimEnd - c.kisimStart + 1 }, (_, i) => c.kisimStart + i);
        const chips = kisimlar
          .map((no) => {
            const part = futuhatData.parts.find((p) => p.cilt === c.cilt && p.kisim === no);
            if (part) {
              return `<button class="futuhat-part-chip futuhat-part-chip--active" type="button" data-id="${part.id}">${tt({ tr: "Kısım " + roman(no), en: "Part " + roman(no), pt: "Parte " + roman(no) })}</button>`;
            }
            return `<span class="futuhat-part-chip futuhat-part-chip--soon" title="${tt({ tr: "Yakında", en: "Coming soon", pt: "Em breve" })}">${roman(no)}</span>`;
          })
          .join("");
        return `<span class="futuhat-parts__cilt">${tt({ tr: "Cilt " + CILT_ROMAN[c.cilt], en: "Volume " + CILT_ROMAN[c.cilt], pt: "Volume " + CILT_ROMAN[c.cilt] })}</span>${chips}`;
      })
      .join("");
    partsEl.innerHTML += `<span class="futuhat-parts__more">${tt({ tr: "Cilt III–XVIII yakında", en: "Volumes III–XVIII coming soon", pt: "Volumes III–XVIII em breve" })}</span>`;
  }

  function roman(n) {
    const table = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let out = "";
    let rem = n;
    for (const [value, symbol] of table) {
      while (rem >= value) {
        out += symbol;
        rem -= value;
      }
    }
    return out || String(n);
  }

  function renderStats(part) {
    if (!statsEl) return;
    const stats = computeStats(part);
    const row = (key, labelDict, value) => `
      <button class="futuhat-stats__item" type="button" data-stat="${key}">
        <span class="futuhat-stats__label">${tt(labelDict)}</span>
        <span class="futuhat-stats__badge">${value}</span>
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

  function updatePartMeta(part) {
    document.title = "Dost Arabî — " + tt(part.title);
    const canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonicalEl) canonicalEl.setAttribute("href", "https://dostarabi.com/futuhat/" + part.id);
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute("content", tt(part.hero.summary));
  }

  function renderPart(part) {
    articleEl.innerHTML = `
      <header class="futuhat-hero">
        <div class="futuhat-toolbar">
          <button class="futuhat-toolbar__btn" id="futuhat-font-decrease" type="button" title="Yazı boyutunu küçült / Decrease font size / Diminuir tamanho da fonte" aria-label="A-">A−</button>
          <button class="futuhat-toolbar__btn" id="futuhat-font-increase" type="button" title="Yazı boyutunu büyült / Increase font size / Aumentar tamanho da fonte" aria-label="A+">A+</button>
          <button class="futuhat-toolbar__btn futuhat-toolbar__btn--icon" id="futuhat-print" type="button" title="Yazdır / Print / Imprimir" aria-label="Yazdır / Print / Imprimir">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="6" y="3" width="12" height="6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="9" width="16" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="7" y="14" width="10" height="7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
          </button>
          <button class="futuhat-toolbar__btn futuhat-toolbar__btn--icon" id="futuhat-share" type="button" title="Paylaş / Share / Compartilhar" aria-label="Paylaş / Share / Compartilhar">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="5.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="18.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="8.3" y1="10.8" x2="15.7" y2="6.7" stroke="currentColor" stroke-width="1.6"/><line x1="8.3" y1="13.2" x2="15.7" y2="17.3" stroke="currentColor" stroke-width="1.6"/></svg>
          </button>
        </div>
        <p class="futuhat-hero__eyebrow">${tt({ tr: "Fütûhât-ı Mekkiyye", en: "al-Futuhat al-Makkiyya", pt: "al-Futuhat al-Makkiyya" })} · ${tt({ tr: "Cilt I", en: "Volume I", pt: "Volume I" })} · ${tt({ tr: "Kısım " + roman(part.kisim), en: "Part " + roman(part.kisim), pt: "Parte " + roman(part.kisim) })}</p>
        <h1 class="futuhat-hero__title">${tt(part.title)}</h1>
        <p class="futuhat-hero__summary">${linkify(tt(part.hero.summary))}</p>
      </header>

      <section class="futuhat-maindiagram" data-diagram-id="main">
        <div class="futuhat-tree" id="futuhat-main-tree"></div>
        <p class="futuhat-diagram-source">${linkify(tt(part.mainDiagram.caption))}</p>
      </section>

      <div class="futuhat-sections" id="futuhat-sections"></div>

      <section class="futuhat-sources">
        <p class="detail-eyebrow">${tt({ tr: "Kaynaklar", en: "Sources", pt: "Fontes" })}</p>
        <ul>
          ${part.sources.map((s, i) => `<li data-source-index="${i}">${tt(s)}</li>`).join("")}
        </ul>
      </section>
    `;

    const mainTreeEl = document.getElementById("futuhat-main-tree");
    renderRadialTree(mainTreeEl, part.mainDiagram.tree, {
      ariaLabel: part.title,
    });
    mainTreeEl.classList.add("futuhat-tree--clickable");
    mainTreeEl.tabIndex = 0;
    mainTreeEl.setAttribute("role", "button");
    mainTreeEl.setAttribute("aria-label", tt({ tr: "Çizimi büyüt", en: "Enlarge diagram", pt: "Ampliar diagrama" }));
    const mainCaption = tt(part.mainDiagram.caption);
    mainTreeEl.addEventListener("click", () => openDiagramLightbox(mainTreeEl, mainCaption));
    mainTreeEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDiagramLightbox(mainTreeEl, mainCaption);
      }
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
          p.innerHTML = linkify(tt(block.text));
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
            capP.innerHTML = linkify(tt(block.caption));
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

          mount.classList.add("futuhat-tree--clickable");
          mount.tabIndex = 0;
          mount.setAttribute("role", "button");
          mount.setAttribute("aria-label", tt({ tr: "Çizimi büyüt", en: "Enlarge diagram", pt: "Ampliar diagrama" }));
          const lightboxCaption = block.caption ? tt(block.caption) : tt(block.source);
          mount.addEventListener("click", () => openDiagramLightbox(mount, lightboxCaption));
          mount.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openDiagramLightbox(mount, lightboxCaption);
            }
          });
        }
      });
      sectionsEl.appendChild(secEl);
    });

    renderStats(part);
    setupToolbar(part);
  }

  // --- Toolbar: font size, print, share ---
  function applyFontScale(scale) {
    document.documentElement.style.setProperty("--detail-font-scale", scale);
  }

  function setupToolbar(part) {
    const dec = document.getElementById("futuhat-font-decrease");
    const inc = document.getElementById("futuhat-font-increase");
    const printBtn = document.getElementById("futuhat-print");
    const shareBtn = document.getElementById("futuhat-share");

    let fontScale = parseFloat(localStorage.getItem("dost-font-scale")) || 1;
    applyFontScale(fontScale);

    if (dec) {
      dec.addEventListener("click", () => {
        fontScale = Math.max(0.8, Math.round((fontScale - 0.2) * 100) / 100);
        applyFontScale(fontScale);
        try { localStorage.setItem("dost-font-scale", fontScale); } catch (e) {}
      });
    }
    if (inc) {
      inc.addEventListener("click", () => {
        fontScale = Math.min(1.8, Math.round((fontScale + 0.2) * 100) / 100);
        applyFontScale(fontScale);
        try { localStorage.setItem("dost-font-scale", fontScale); } catch (e) {}
      });
    }
    if (printBtn) {
      printBtn.addEventListener("click", () => window.print());
    }
    if (shareBtn) {
      shareBtn.addEventListener("click", () => sharePart(part));
    }
  }

  function sharePart(part) {
    const url = location.origin + (window.__dostRouteBase || "") + "/futuhat/" + part.id;
    const title = tt({ tr: "Dost Arabî", en: "Dost Arabi", pt: "Dost Arabi" }) + " — " + tt(part.title);
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast(
        tt({ tr: "Bağlantı kopyalandı", en: "Link copied", pt: "Link copiado" })
      ));
    }
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "futuhat-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("futuhat-toast--visible"));
    setTimeout(() => {
      toast.classList.remove("futuhat-toast--visible");
      setTimeout(() => toast.remove(), 300);
    }, 1800);
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
    if (window.__dostNav) window.__dostNav.setHash("futuhat", id);
    // setHash az önce genel "futuhat" başlık/canonical/description'ını yazdı
    // (bkz. ontology.js updateMeta) -- bu kısma özel olanlarla en son biz
    // üzerine yazıyoruz ki kazanan bu olsun.
    updatePartMeta(part);
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

  setupCrossLinkPreviews();

  let subscribedToCrossLinkReady = false;

  window.__futuhatApp = {
    activate(id) {
      if (!subscribedToCrossLinkReady && window.__dostCrossLink && window.__dostCrossLink.onReady) {
        subscribedToCrossLinkReady = true;
        // Ontoloji/Esmâ/Hâl/Terimler each register their cross-linkable
        // terms as their own data arrives, which can be after our first
        // render; re-render once more terms are available so links appear
        // without the reader needing to do anything.
        window.__dostCrossLink.onReady(() => { if (futuhatData) render(); });
      }
      fetchData().then((data) => {
        if (!data) return;
        if (id && data.parts.some((p) => p.id === id)) activePartId = id;
        render();
      });
    },
    onLangChange() {
      render();
    },
  };
})();
