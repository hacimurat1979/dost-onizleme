(function () {
  "use strict";

  // ============================================================================
  // Sorular — "keşfedilen bir mana evreni"
  //
  // Klasik bir network graph değil; anlam katmanları arasında yolculuk hissi
  // veren, sakin ve derinlikli bir bilgi haritası. Işıyan küre düğümler, düşük
  // opaklıkta organik bezier bağlantılar, çok hafif bir atmosfer katmanı
  // (radyal ışık + yavaş süzülen parçacıklar), üstüne gelince açılan mini bilgi
  // kartı, derinlik katmanı süzgeci (Yüzey/Derin/Çok Derin), odak modu ve sağ
  // altta bir minimap. Salt vanilla D3 (yeni bağımlılık yok — bkz. CLAUDE.md).
  // ============================================================================

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = d3.select("#sorular-graph");
  const svgNode = svg.node();
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const tooltip = document.getElementById("sorular-tooltip");
  const wrapEl = document.getElementById("sorular-wrap");
  const backBtn = document.getElementById("sorular-back");

  function tt(dict) { return I18n.pick3(dict || {}); }
  function getVar(n) { return GU.getVar(n); }
  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

  const CATEGORY_COLOR_VAR = {
    "en-temel": "--series-sorular-en-temel",
    "varlik": "--series-sorular-varlik",
    "bilgi": "--series-sorular-bilgi",
    "insan": "--series-sorular-insan",
    "allah": "--series-sorular-allah",
    "kozmos": "--series-sorular-kozmos",
    "kuran": "--series-sorular-kuran",
    "metot": "--series-sorular-metot",
    "deneyim": "--series-sorular-deneyim",
  };

  // --- Sakin palet (#4/#9): kategori renklerini daha düşük doygunluğa çek. ---
  function hexToRgb(hex) {
    const m = hex.replace("#", "");
    const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s, l];
  }
  const muteCache = new Map();
  function muteColor(hex) {
    const key = (GU.isDark() ? "d:" : "l:") + hex;
    if (muteCache.has(key)) return muteCache.get(key);
    let out = hex;
    if (/^#/.test(hex)) {
      const [h, , l0] = rgbToHsl.apply(null, hexToRgb(hex));
      const s = 0.55;
      const l = GU.isDark() ? Math.min(0.7, Math.max(0.56, l0)) : Math.min(0.6, Math.max(0.46, l0));
      // d3.color() (v7) only parses the legacy comma-separated hsl() syntax,
      // not CSS Color 4's space-separated form -- the latter silently fails
      // to parse and falls back to gray, which is why every sphere/particle
      // rendered achromatic despite this function's saturation math.
      out = `hsl(${h.toFixed(0)}, ${(s * 100).toFixed(0)}%, ${(l * 100).toFixed(0)}%)`;
    }
    muteCache.set(key, out);
    return out;
  }
  function catColor(d) { return muteColor(getVar(CATEGORY_COLOR_VAR[d.category.id] || "--series-theme")); }

  // ---------------------------------------------------------------------------
  let sorularData = null, dataPromise = null;
  let categoryById = new Map(), questionIndex = new Map();
  let nodes = [], nodeById = new Map(), links = [];
  let zoomLayer, bgLayer, linkLayer, particleLayer, nodeLayer, centerLayer, defs;
  let zoomBehavior = null, simulation = null, currentK = 1;
  let currentDetailQuestion = null, hoveredId = null, focusId = null;
  let width = 900, height = 640;
  let rafId = null, lastTs = 0, dragging = false;
  let bgParticles = [], edgeParticles = [];
  let depthMax = 3; // 1 Yüzey, 2 Derin, 3 Çok Derin (hepsi)
  let flashId = null, flashStart = 0;
  let controlEl = null, miniEl = null, miniSvg = null, miniViewport = null;

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("sorular-wrap");
    dataPromise = GU.fetchJson("data/ibn-arabi/sorular.json")
      .then((data) => {
        sorularData = data;
        categoryById = new Map(data.categories.map((c) => [c.id, c]));
        questionIndex = new Map();
        data.categories.forEach((c) => { c.questions.forEach((q) => questionIndex.set(q.id, { question: q, category: c })); });
        if (window.DostViewStatus) window.DostViewStatus.hide("sorular-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Sorular verisi yüklenemedi / Failed to load Questions data", err);
        dataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("sorular-wrap", () => window.__sorularApp.activate());
      });
    return dataPromise;
  }

  function labelFor(q) {
    const label = I18n.pick3(q.question);
    return label.length > 30 ? label.slice(0, 29) + "…" : label;
  }

  function buildGraphData(data) {
    const cats = data.categories;
    const sectorSpan = (2 * Math.PI) / cats.length;
    const items = [];
    cats.forEach((cat, ci) => {
      const sectorCenter = -Math.PI / 2 + ci * sectorSpan;
      cat.questions.forEach((q, qi) => {
        items.push({
          id: q.id, question: q, category: cat,
          sectorAngle: sectorCenter + (qi % 2 === 0 ? 1 : -1) * (qi * 0.35 * sectorSpan / Math.max(1, cat.questions.length)),
          sectorIndex: qi, phase: Math.random() * 6.28,
        });
      });
    });
    const relLinks = (data.relations || [])
      .filter((r) => items.some((n) => n.id === r.from) && items.some((n) => n.id === r.to))
      .map((r) => Object.assign({}, r));
    const degree = new Map();
    relLinks.forEach((r) => { degree.set(r.from, (degree.get(r.from) || 0) + 1); degree.set(r.to, (degree.get(r.to) || 0) + 1); });
    items.forEach((n) => { n.degree = degree.get(n.id) || 0; });
    // Derinlik katmanı (#6): merkezîlik (degree) yüksek + cevabı kısa olan
    // sorular "yüzey" (giriş kapıları); az bağlantılı + uzun cevaplı olanlar
    // "çok derin". Skoru üç dilime bölüp seviye atıyoruz.
    items.forEach((n) => {
      const words = (I18n.pick3(n.question.answer) || "").split(/\s+/).length;
      n.words = words;
      n.surfaceScore = n.degree - words / 130 + (n.category.id === "en-temel" ? 5 : 0);
    });
    const sorted = items.slice().sort((a, b) => b.surfaceScore - a.surfaceScore);
    const third = Math.ceil(sorted.length / 3);
    sorted.forEach((n, i) => { n.depth = i < third ? 1 : i < 2 * third ? 2 : 3; });
    return { nodes: items, links: relLinks };
  }

  function radiusFor(d) { return 8.5 + Math.min(6, d.degree) * 1.5; }

  function relationsOf(id) { return (sorularData.relations || []).filter((r) => r.from === id || r.to === id); }
  function conceptCount(q) { return q.link ? 1 : 0; }
  function readingMinutes(q) { return Math.max(1, Math.round(((I18n.pick3(q.answer) || "").split(/\s+/).length) / 190)); }

  // ---------------------------------------------------------------------------
  function buildDom() {
    svg.selectAll("*").remove();
    width = svgNode.clientWidth || 900; height = svgNode.clientHeight || 640;
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");

    defs = svg.append("defs");
    // yumuşak parıltı filtresi
    const glow = defs.append("filter").attr("id", "sorular-glow").attr("x", "-70%").attr("y", "-70%").attr("width", "240%").attr("height", "240%");
    glow.append("feGaussianBlur").attr("stdDeviation", "3.2");
    // kategori başına ışıyan küre gradyanı (#2)
    Object.keys(CATEGORY_COLOR_VAR).forEach((catId) => {
      const c = d3.color(muteColor(getVar(CATEGORY_COLOR_VAR[catId]))) || d3.color("#888");
      const rg = defs.append("radialGradient").attr("id", "sorular-sphere-" + catId).attr("cx", "38%").attr("cy", "32%").attr("r", "72%");
      rg.append("stop").attr("offset", "0%").attr("stop-color", c.brighter(1.1).formatHex());
      rg.append("stop").attr("offset", "46%").attr("stop-color", c.formatHex());
      rg.append("stop").attr("offset", "100%").attr("stop-color", c.darker(0.85).formatHex());
    });

    zoomLayer = svg.append("g").attr("class", "sorular-canvas");
    bgLayer = zoomLayer.append("g").attr("class", "sorular-bg");
    linkLayer = zoomLayer.append("g").attr("class", "sorular-links");
    particleLayer = zoomLayer.append("g").attr("class", "sorular-particles");
    centerLayer = zoomLayer.append("g").attr("class", "sorular-center").attr("aria-hidden", "true");
    nodeLayer = zoomLayer.append("g").attr("class", "sorular-nodes");

    // merkezde nefes alan sessiz işaret (daire/merkez ilkesi)
    centerLayer.append("circle").attr("class", "node-halo").attr("r", 34);
    centerLayer.append("circle").attr("class", "sorular-center__core").attr("r", 5);

    zoomBehavior = GU.createZoomBehavior(svg, zoomLayer, [0.4, 3], (event) => !event.target.closest(".node"));
    svgNode.addEventListener("wheel", () => { setTimeout(() => { currentK = d3.zoomTransform(svgNode).k; }, 0); }, { passive: true });

    const rc = document.getElementById("sorular-recenter");
    if (rc) rc.onclick = () => { clearFocus(); fitView(true); };
    if (backBtn) { backBtn.hidden = !currentDetailQuestion; backBtn.onclick = () => showAllQuestionsList(); }
    svg.on("click", () => { if (focusId) { clearFocus(); } });

    buildControls();
    buildMinimap();
  }

  // Derinlik katmanı süzgeci (#6): Yüzey / Derin / Çok Derin.
  function buildControls() {
    if (controlEl) controlEl.remove();
    controlEl = document.createElement("div");
    controlEl.className = "sorular-depth";
    const opts = [
      { v: 1, tr: "Yüzey", en: "Surface", pt: "Superfície" },
      { v: 2, tr: "Derin", en: "Deep", pt: "Profundo" },
      { v: 3, tr: "Tam", en: "Full", pt: "Completo" },
    ];
    controlEl.innerHTML = `<span class="sorular-depth__label">${tt({ tr: "Derinlik", en: "Depth", pt: "Profundidade" })}</span>` +
      opts.map((o) => `<button type="button" class="sorular-depth__btn${o.v === depthMax ? " is-active" : ""}" data-v="${o.v}">${tt(o)}</button>`).join("");
    controlEl.querySelectorAll(".sorular-depth__btn").forEach((b) => {
      b.addEventListener("click", () => {
        depthMax = parseInt(b.dataset.v, 10);
        controlEl.querySelectorAll(".sorular-depth__btn").forEach((x) => x.classList.toggle("is-active", parseInt(x.dataset.v, 10) === depthMax));
        ensureFrame();
      });
    });
    wrapEl.appendChild(controlEl);
  }

  function buildMinimap() {
    let mm = wrapEl.querySelector(".sorular-minimap");
    if (mm) mm.remove();
    mm = document.createElement("div");
    mm.className = "sorular-minimap";
    mm.innerHTML = `<svg viewBox="0 0 150 110" preserveAspectRatio="xMidYMid meet"><g class="sorular-minimap__dots"></g><rect class="sorular-minimap__vp" x="0" y="0" width="0" height="0"></rect></svg>`;
    wrapEl.appendChild(mm);
    miniEl = mm;
    miniSvg = d3.select(mm).select("svg");
    miniViewport = miniSvg.select(".sorular-minimap__vp");
    miniSvg.on("click", (event) => {
      const box = mmBounds();
      if (!box) return;
      const pt = d3.pointer(event, miniSvg.node());
      // minimap koordinatını dünya koordinatına çevir
      const wx = box.x0 + (pt[0] / 150) * box.w, wy = box.y0 + (pt[1] / 110) * box.h;
      const k = Math.max(currentK, 1);
      svg.transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity.translate(width / 2 - k * wx, height / 2 - k * wy).scale(k));
      currentK = k;
    });
  }

  function mmBounds() {
    if (!nodes.length) return null;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    nodes.forEach((d) => { x0 = Math.min(x0, d.x); x1 = Math.max(x1, d.x); y0 = Math.min(y0, d.y); y1 = Math.max(y1, d.y); });
    const pad = 40; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    return { x0, y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  function updateMinimap() {
    if (!miniSvg) return;
    // Detay paneli (kitap) açıkken sağ tarafı kapladığından minimap gizlenir;
    // kullanıcı paneli kapatıp grafiği keşfetmeye başlayınca görünür.
    if (miniEl) miniEl.style.display = (detailPanel && !detailPanel.hidden) ? "none" : "";
    if (detailPanel && !detailPanel.hidden) return;
    const box = mmBounds(); if (!box) return;
    const sx = (x) => ((x - box.x0) / box.w) * 150;
    const sy = (y) => ((y - box.y0) / box.h) * 110;
    const dots = miniSvg.select(".sorular-minimap__dots").selectAll("circle").data(nodes, (d) => d.id);
    dots.enter().append("circle").attr("r", 1.5).merge(dots)
      .attr("cx", (d) => sx(d.x)).attr("cy", (d) => sy(d.y))
      .style("fill", (d) => catColor(d))
      .style("opacity", (d) => (d.depth <= depthMax ? 0.8 : 0.2));
    dots.exit().remove();
    // viewport dikdörtgeni
    const t = d3.zoomTransform(svgNode);
    const vx0 = (-t.x) / t.k, vy0 = (-t.y) / t.k, vx1 = (width - t.x) / t.k, vy1 = (height - t.y) / t.k;
    miniViewport.attr("x", sx(vx0)).attr("y", sy(vy0))
      .attr("width", Math.max(2, sx(vx1) - sx(vx0))).attr("height", Math.max(2, sy(vy1) - sy(vy0)));
  }

  // ---------------------------------------------------------------------------
  function layoutSeed() {
    const cx = width / 2, cy = height / 2;
    const layoutRadius = Math.max(150, Math.min(width, height) / 2 - 60);
    nodes.forEach((n) => {
      const r = layoutRadius * (0.35 + 0.65 * ((n.sectorIndex + 1) / (categoryById.get(n.category.id).questions.length + 1)));
      n.x = cx + r * Math.cos(n.sectorAngle);
      n.y = cy + r * Math.sin(n.sectorAngle);
      n.tx = cx + layoutRadius * 0.6 * Math.cos(n.sectorAngle);
      n.ty = cy + layoutRadius * 0.6 * Math.sin(n.sectorAngle);
    });
    centerLayer.attr("transform", `translate(${cx},${cy})`);
  }

  function buildSim() {
    if (simulation) simulation.stop();
    // #1 — daha fazla nefes: çarpışma mesafesi ve itim mobilde/masaüstünde farklı.
    const isMobile = Math.min(width, height) < 620;
    simulation = d3.forceSimulation(nodes)
      .alphaDecay(0.045)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(isMobile ? 82 : 108).strength(0.32))
      .force("charge", d3.forceManyBody().strength(isMobile ? -95 : -140))
      .force("x", d3.forceX((d) => d.tx).strength(0.05))
      .force("y", d3.forceY((d) => d.ty).strength(0.05))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + (isMobile ? 20 : 26)).strength(0.92));
    if (reduceMotion) { simulation.alphaDecay(0.2); for (let i = 0; i < 220; i++) simulation.tick(); simulation.stop(); }
    let settledOnce = false;
    simulation.on("end", () => { if (settledOnce) return; settledOnce = true; if (!focusId && !currentDetailQuestion) fitView(true); });
  }

  function initAtmosphere() {
    bgParticles = [];
    if (reduceMotion) return;
    const cx = width / 2, cy = height / 2;
    const rmax = Math.min(width, height) * 0.62;
    for (let i = 0; i < 30; i++) bgParticles.push({ a: Math.random() * 6.28, r: 30 + Math.random() * rmax, sp: (Math.random() - 0.5) * 0.00006, rad: 0.6 + Math.random() * 1.5, cx, cy });
    edgeParticles = [];
    links.forEach((l) => { edgeParticles.push({ l, t: Math.random(), sp: 0.05 + Math.random() * 0.05 }); });
  }

  // Organik bezier bağlantı (#3): düğüm KENARINDAN çıkıp kenara giren,
  // hafifçe kavisli bir eğri.
  function linkPath(l) {
    const s = l.source, t = l.target;
    const dx = t.x - s.x, dy = t.y - s.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const sr = radiusFor(s) + 2, tr = radiusFor(t) + 2;
    const sx = s.x + ux * sr, sy = s.y + uy * sr;
    const ex = t.x - ux * tr, ey = t.y - uy * tr;
    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    const nx = -uy, ny = ux;
    const bow = Math.min(30, len * 0.14);
    return `M${sx.toFixed(1)},${sy.toFixed(1)} Q${(mx + nx * bow).toFixed(1)},${(my + ny * bow).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
  }
  function pointOnLink(l, u) {
    const s = l.source, t = l.target;
    const dx = t.x - s.x, dy = t.y - s.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const sr = radiusFor(s) + 2, tr = radiusFor(t) + 2;
    const sx = s.x + ux * sr, sy = s.y + uy * sr, ex = t.x - ux * tr, ey = t.y - uy * tr;
    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    const nx = -uy, ny = ux, bow = Math.min(30, len * 0.14);
    const cxp = mx + nx * bow, cyp = my + ny * bow, mu = 1 - u;
    return [mu * mu * sx + 2 * mu * u * cxp + u * u * ex, mu * mu * sy + 2 * mu * u * cyp + u * u * ey];
  }

  // ---------------------------------------------------------------------------
  function ensureFrame() { if (rafId == null) { lastTs = performance.now(); rafId = requestAnimationFrame(frame); } }
  function frame(ts) {
    rafId = null;
    const dt = Math.min(64, ts - lastTs); lastTs = ts;
    if (!reduceMotion) {
      bgParticles.forEach((p) => { p.a += p.sp * dt; });
      edgeParticles.forEach((p) => { p.t += p.sp * (dt / 1000); if (p.t > 1) p.t -= 1; });
    }
    render(ts);
    updateMinimap();
    const simActive = simulation && simulation.alpha() > 0.006;
    if (!reduceMotion || simActive || dragging) ensureFrame(); else rafId = null;
  }

  function activeSet() {
    const anchor = hoveredId || focusId;
    if (!anchor) return null;
    const set = new Set([anchor]);
    links.forEach((l) => {
      if (l.source.id === anchor) set.add(l.target.id);
      if (l.target.id === anchor) set.add(l.source.id);
    });
    return { anchor, set };
  }

  function depthVisible(d) { return d.depth <= depthMax; }

  function render(ts) {
    if (!nodeLayer) return;
    const act = activeSet();

    // --- atmosfer parçacıkları (#10) ---
    if (!reduceMotion && bgParticles.length) {
      const bg = bgLayer.selectAll("circle.sorular-bgdot").data(bgParticles);
      bg.enter().append("circle").attr("class", "sorular-bgdot").merge(bg)
        .attr("cx", (p) => (p.cx + p.r * Math.cos(p.a)).toFixed(1))
        .attr("cy", (p) => (p.cy + p.r * Math.sin(p.a)).toFixed(1))
        .attr("r", (p) => p.rad).style("opacity", 0.016);
      bg.exit().remove();
    }

    // --- bağlantılar (bezier, düşük opaklık) (#3) ---
    const lk = linkLayer.selectAll("path.sorular-link").data(links, (l) => l.from + ">" + l.to);
    lk.enter().append("path").attr("class", "sorular-link").attr("fill", "none").merge(lk)
      .each(function (l) {
        const p = d3.select(this);
        const dv = depthVisible(l.source) && depthVisible(l.target);
        let op = 0.16;
        if (act) op = (act.set.has(l.source.id) && act.set.has(l.target.id)) ? 0.8 : 0.05;
        p.attr("d", linkPath(l))
          .classed("sorular-link--active", act && act.set.has(l.source.id) && act.set.has(l.target.id))
          .style("stroke", act && act.set.has(l.source.id) && act.set.has(l.target.id) ? catColor(l.source) : null)
          .style("opacity", op * (dv ? 1 : 0.25));
      });
    lk.exit().remove();

    // --- aktif bağlantılarda ışık akışı (#3 "ışık akışı") ---
    if (!reduceMotion && act) {
      const vis = edgeParticles.filter((p) => act.set.has(p.l.source.id) && act.set.has(p.l.target.id));
      const ps = particleLayer.selectAll("circle.sorular-flow").data(vis, (d) => d.l.from + ">" + d.l.to);
      ps.enter().append("circle").attr("class", "sorular-flow").attr("r", 1.6).merge(ps)
        .each(function (p) { const [x, y] = pointOnLink(p.l, p.t); d3.select(this).attr("cx", x).attr("cy", y).style("fill", catColor(p.l.source)); });
      ps.exit().remove();
    } else { particleLayer.selectAll("circle.sorular-flow").remove(); }

    // --- düğümler ---
    const gsel = nodeLayer.selectAll("g.sorular-node").data(nodes, (d) => d.id);
    const enter = gsel.enter().append("g")
      .attr("class", "node sorular-node")
      .attr("tabindex", 0).attr("role", "button").attr("aria-label", (d) => I18n.pick3(d.question.question))
      .call(GU.createDragBehavior(simulation))
      .on("click", (e, d) => { e.stopPropagation(); openQuestion(d); })
      .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openQuestion(d); } })
      .on("pointerenter", (e, d) => { setHover(d.id); showTooltip(d, e); })
      .on("pointermove", (e) => moveTooltip(e))
      .on("pointerleave", () => { setHover(null); hideTooltip(); })
      .on("focus", (e, d) => { setHover(d.id); showTooltip(d, e); })
      .on("blur", () => { setHover(null); hideTooltip(); });
    enter.append("circle").attr("class", "sorular-glow");
    enter.append("circle").attr("class", "sorular-halo");
    enter.append("circle").attr("class", "sorular-sphere").attr("fill", (d) => `url(#sorular-sphere-${d.category.id})`);
    enter.append("circle").attr("class", "sorular-sheen");
    enter.append("text").attr("class", "sorular-label node-label").attr("text-anchor", "middle");
    const merged = enter.merge(gsel);
    gsel.exit().remove();

    merged.each(function (d) {
      const g = d3.select(this);
      const isHover = act && d.id === act.anchor;
      const breath = reduceMotion ? 1 : (1 + 0.02 * Math.sin(ts / 2800 + d.phase));
      let scale = breath;
      if (isHover) scale *= 1.08;               // hover 1.08x (#2/#15)
      const r = radiusFor(d) * scale;
      const dx = reduceMotion ? 0 : 1.2 * Math.sin(ts / 3300 + d.phase);
      const dy = reduceMotion ? 0 : 1.2 * Math.cos(ts / 3800 + d.phase);
      let op = depthVisible(d) ? 1 : 0.12;       // derinlik süzgeci (#6)
      if (act) { if (!act.set.has(d.id)) op *= 0.28; }  // focus/hover (#19)
      g.style("opacity", op).style("display", op < 0.02 ? "none" : null)
        .attr("transform", `translate(${(d.x + dx).toFixed(1)},${(d.y + dy).toFixed(1)})`);
      g.classed("sorular-node--active", currentDetailQuestion && d.id === currentDetailQuestion.id);
      const col = catColor(d);
      // flash (aramadan gelince kısa parlama) (#9)
      let flash = 0;
      if (flashId === d.id) { const p = (ts - flashStart) / 900; if (p >= 1) flashId = null; else flash = Math.sin(p * Math.PI); }
      g.select(".sorular-glow").attr("r", r * 1.8).style("fill", col)
        .style("opacity", (0.12 + 0.5 * flash) * (isHover ? 1.6 : 1) * (d.degree >= 3 ? 1.3 : 1));
      const halo = g.select(".sorular-halo");
      const isActive = currentDetailQuestion && d.id === currentDetailQuestion.id;
      if (isActive) {
        const puls = reduceMotion ? 1 : (1 + 0.1 * Math.sin(ts / 900));
        halo.attr("r", (r + 6) * puls).style("stroke", col).style("opacity", 0.5);
      } else halo.style("opacity", 0);
      g.select(".sorular-sphere").attr("r", r);
      g.select(".sorular-sheen").attr("r", r);
      const lbl = g.select(".sorular-label");
      const showLabel = isHover || isActive || currentK >= 1.15 || (act && act.set.has(d.id));
      lbl.attr("y", r + 13).style("display", showLabel ? null : "none")
        .classed("sorular-label--strong", isHover || isActive)
        .text(labelFor(d.question));
    });
  }

  // ---------------------------------------------------------------------------
  function setHover(id) { if (hoveredId === id) return; hoveredId = id; ensureFrame(); }
  function clearFocus() { focusId = null; ensureFrame(); }

  function fitView(animate) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    nodes.forEach((d) => { if (!depthVisible(d)) return; x0 = Math.min(x0, d.x); x1 = Math.max(x1, d.x); y0 = Math.min(y0, d.y); y1 = Math.max(y1, d.y); });
    if (x0 === 1e9) nodes.forEach((d) => { x0 = Math.min(x0, d.x); x1 = Math.max(x1, d.x); y0 = Math.min(y0, d.y); y1 = Math.max(y1, d.y); });
    x0 -= 60; x1 += 60; y0 -= 52; y1 += 52;
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
    const [mn, mx] = zoomBehavior.scaleExtent();
    const k = Math.max(mn, Math.min(mx, Math.min(width / bw, height / bh)));
    const t = d3.zoomIdentity.translate(width / 2 - k * (x0 + bw / 2), height / 2 - k * (y0 + bh / 2)).scale(k);
    const sel = (animate && !reduceMotion) ? svg.transition().duration(500).ease(d3.easeCubicInOut) : svg;
    sel.call(zoomBehavior.transform, t);
    currentK = k;
  }

  function panTo(d) {
    const k = Math.max(currentK, 1.1);
    const t = d3.zoomIdentity.translate(width / 2 - k * d.x, height / 2 - k * d.y).scale(k);
    const sel = reduceMotion ? svg : svg.transition().duration(450).ease(d3.easeCubicInOut);
    sel.call(zoomBehavior.transform, t);
    currentK = k;
  }

  // --- Hover mini bilgi kartı (#7): kısa açıklama + ilişki/kavram sayısı +
  //     okuma süresi. ---
  function showTooltip(d, event) {
    if (!tooltip) return;
    const q = d.question;
    const answer = I18n.pick3(q.answer) || "";
    const shortDesc = answer.replace(/<[^>]+>/g, "").split(/(?<=[.!?])\s/)[0].slice(0, 120);
    const relCount = relationsOf(d.id).length;
    const cCount = conceptCount(q);
    const mins = readingMinutes(q);
    const meta = [
      relCount ? `${relCount} ${tt({ tr: "ilişki", en: "links", pt: "ligações" })}` : "",
      cCount ? `${cCount} ${tt({ tr: "kavram", en: "concept", pt: "conceito" })}` : "",
      `~${mins} ${tt({ tr: "dk", en: "min", pt: "min" })}`,
    ].filter(Boolean).join(" · ");
    tooltip.innerHTML =
      `<div class="node-hover-tip__title">${I18n.pick3(q.question)}</div>` +
      (shortDesc ? `<div class="node-hover-tip__short">${shortDesc}…</div>` : "") +
      `<div class="node-hover-tip__meta">${meta}</div>`;
    tooltip.hidden = false; moveTooltip(event);
  }
  function moveTooltip(event) { GU.moveTooltip(tooltip, wrapEl, event); }
  function hideTooltip() { GU.hideTooltip(tooltip); }

  // --- Editorial detay paneli (kitap hissi) ---
  function analogyHtml(analogy) {
    if (!analogy) return "";
    return `<div class="detail-analogy"><p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p><p>${I18n.pick3(analogy)}</p></div>`;
  }
  function crossLinkHtml(q) {
    if (!q.link) return "";
    const view = q.link.view, id = q.link.id;
    const base = window.__dostRouteBase || "";
    const href = id ? `${base}/${view}/${id}` : `${base}/${view}`;
    const label = q.linkLabel ? I18n.pick3(q.linkLabel) : tt({ tr: "Devamını oku", en: "Read more", pt: "Ler mais" });
    return `<a class="cross-link sorular-readmore" href="${href}">${label} →</a>`;
  }
  function sourceHtml(q) { return q.source ? `<cite class="sorular-source">${q.source}</cite>` : ""; }
  function relationNote(r) { return r && r.note ? I18n.pick3(r.note) : ""; }
  function relatedQuestionsHtml(q) {
    const rel = relationsOf(q.id);
    if (!rel.length) return "";
    const rows = rel.map((r) => {
      const otherId = r.from === q.id ? r.to : r.from;
      const entry = questionIndex.get(otherId); if (!entry) return "";
      return `<button class="sorular-question-row sorular-question-row--related" type="button" data-id="${otherId}">
        <span><span class="sorular-related__q">${I18n.pick3(entry.question.question)}</span>
        <span class="sorular-related__note">${relationNote(r)}</span></span>
        <span class="sorular-question-row__arrow" aria-hidden="true">→</span></button>`;
    }).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlişkili Sorular", en: "Related Questions", pt: "Perguntas Relacionadas" })}</p><div class="sorular-question-list">${rows}</div>`;
  }

  function showAllQuestionsList() {
    currentDetailQuestion = null; focusId = null;
    if (backBtn) backBtn.hidden = true;
    if (nodes.length) fitView(true);
    const introBlock = `<div class="detail-block detail-block--ibnarabi"><p>${I18n.pick3(sorularData.intro)}</p></div>`;
    const sections = sorularData.categories.map((cat) => {
      const rows = cat.questions.map((q) => `
        <button class="sorular-question-row" type="button" data-id="${q.id}"><span>${I18n.pick3(q.question)}</span><span class="sorular-question-row__arrow" aria-hidden="true">→</span></button>`).join("");
      return `<p class="detail-eyebrow detail-eyebrow--section">${I18n.pick3(cat.name)}</p><div class="sorular-question-list">${rows}</div>`;
    }).join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Sorular", en: "Questions", pt: "Perguntas" })}</p>
      <h2 class="detail-title">${tt({ tr: "Bütün Sorular", en: "All Questions", pt: "Todas as Perguntas" })}</h2>
      ${introBlock}${sections}`;
    wireQuestionRows();
    detailPanel.hidden = false;
    ensureFrame();
  }

  function wireQuestionRows() {
    detailContent.querySelectorAll(".sorular-question-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const entry = questionIndex.get(btn.dataset.id);
        if (entry) { const node = nodeById.get(btn.dataset.id); if (node) openQuestion(node); else showQuestionDetail(entry.question); }
      });
    });
  }

  function openQuestion(d) {
    focusId = d.id;
    flashId = d.id; flashStart = performance.now();
    panTo(d);
    showQuestionDetail(d.question);
    ensureFrame();
  }

  function showQuestionDetail(q) {
    currentDetailQuestion = q;
    focusId = q.id;
    if (backBtn) backBtn.hidden = false;
    const cat = questionIndex.get(q.id) ? questionIndex.get(q.id).category : null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow"><button class="sorular-back-link" type="button">← ${tt({ tr: "Bütün Sorular", en: "All Questions", pt: "Todas as Perguntas" })}</button></p>
      <h2 class="detail-title">${I18n.pick3(q.question)}</h2>
      <p class="sorular-category-tag">${cat ? I18n.pick3(cat.name) : ""}</p>
      <div class="detail-block detail-block--ibnarabi"><p>${linkify(I18n.pick3(q.answer), "sorular", q.id)}</p>${sourceHtml(q)}</div>
      ${analogyHtml(q.analogy)}${crossLinkHtml(q)}${relatedQuestionsHtml(q)}`;
    detailContent.querySelector(".sorular-back-link").addEventListener("click", () => showAllQuestionsList());
    wireQuestionRows();
    detailPanel.hidden = false;
    window.__dostNav && window.__dostNav.setHash("sorular", q.id);
    ensureFrame();
  }

  // ---------------------------------------------------------------------------
  function buildGraph(data) {
    const built = buildGraphData(data);
    nodes = built.nodes; links = built.links;
    nodeById = new Map(nodes.map((n) => [n.id, n]));
    links.forEach((l) => { l.source = l.from; l.target = l.to; });
    buildDom();
    layoutSeed();
    buildSim();
    // link kaynak/hedefleri forceLink tarafından obje referanslarına çevrildi
    initAtmosphere();
    render(performance.now());
    fitView(false);
    ensureFrame();
    window.addEventListener("resize", onResize);
  }

  function onResize() {
    if (!nodes.length || wrapEl.hidden) return;
    width = svgNode.clientWidth || 900; height = svgNode.clientHeight || 640;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    render(performance.now());
    fitView(false);
  }

  function relabel() {
    if (!nodes.length) return;
    muteCache.clear();
    render(performance.now());
    if (currentDetailQuestion) showQuestionDetail(currentDetailQuestion);
    else if (detailPanel && !detailPanel.hidden) showAllQuestionsList();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (wrapEl.hidden) return;
    if (!currentDetailQuestion) return;
    showAllQuestionsList();
  });

  // sürükleme sırasında rAF sürsün
  svgNode.addEventListener("pointerdown", () => { dragging = true; ensureFrame(); });
  window.addEventListener("pointerup", () => { dragging = false; });

  window.__sorularApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        if (!nodes.length) { buildGraph(data); showAllQuestionsList(); }
        else ensureFrame();
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        if (!nodes.length) buildGraph(data);
        if (questionIndex.has(id)) { const node = nodeById.get(id); if (node) openQuestion(node); else showQuestionDetail(questionIndex.get(id).question); }
        else showAllQuestionsList();
      });
    },
    onLangChange() { relabel(); },
  };
})();
