(function () {
  "use strict";

  // ============================================================================
  // Sırlar — "canlı organizma" grafiği
  //
  // Klasik bir mind-map yerine, kuvvet-tabanlı (force-directed) yaşayan bir
  // ağaç: kök merkezde ("kutsal"), beş tema onun dallanması, her sır bir
  // yaprak. Düğümler çok hafif nefes alır, bağlantılar boyunca ince ışık
  // akar, kullanıcı yaklaştıkça (zoom) katmanlar açılır. Obsidian graph +
  // Encyclopaedia of Life dinginliği; mat, tefekküre açık bir palet.
  // Salt vanilla D3 (yeni bağımlılık yok — bkz. CLAUDE.md).
  // ============================================================================

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = d3.select("#sirlar-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("sirlar-wrap");
  const tooltip = document.getElementById("sirlar-tooltip");
  if (!svgNode || !wrapEl) return;

  function tt(dict) { return I18n.pick3(dict || {}); }
  function getVar(n) { return GU.getVar(n); }

  const THEME_LABELS = {
    "suskunluk": { tr: "Suskunluk ve Perdeleme", en: "Silence and Veiling", pt: "Silêncio e Velamento" },
    "peygamber-kissalari": { tr: "Peygamber Kıssalarındaki Sırlar", en: "Secrets in the Prophets' Stories", pt: "Segredos nas Histórias dos Profetas" },
    "kader-tevhid": { tr: "Kader, Tevhid, Tenzih-Teşbih", en: "Destiny, Divine Unity, Tanzih-Tashbih", pt: "Destino, Unidade Divina, Tanzih-Tashbih" },
    "dil-ve-kelime": { tr: "Dilde ve Kelimede Gizlenen Sırlar", en: "Secrets Hidden in Language and Words", pt: "Segredos Ocultos na Língua e nas Palavras" },
    "insan-i-kamil": { tr: "İnsan-ı Kâmil ve Velâyet", en: "The Perfect Human and Sainthood", pt: "O Ser Humano Perfeito e a Santidade" },
  };
  const THEME_ORDER = Object.keys(THEME_LABELS);
  const THEME_COLOR_VAR = {
    "suskunluk": "--series-sir-suskunluk",
    "peygamber-kissalari": "--series-sir-peygamber",
    "kader-tevhid": "--series-sir-kader",
    "dil-ve-kelime": "--series-sir-dil",
    "insan-i-kamil": "--series-sir-insan",
  };
  const ROOT_LABEL = { tr: "Sırlar", en: "Mysteries", pt: "Mistérios" };

  // --- Mat palet (#9): tema renklerini aynı görsel aileye çekmek için
  //     doygunluğu ~%38, parlaklığı temaya göre yumuşatılmış bir tona indir.
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
  function mute(hexOrVar) {
    const hex = hexOrVar.startsWith("--") ? getVar(hexOrVar) : hexOrVar;
    const key = (GU.isDark() ? "d:" : "l:") + hex;
    if (muteCache.has(key)) return muteCache.get(key);
    let out = hex;
    if (/^#/.test(hex)) {
      const [h, , l0] = rgbToHsl.apply(null, hexToRgb(hex));
      const s = 0.38;
      const l = GU.isDark() ? Math.min(0.68, Math.max(0.55, l0)) : Math.min(0.6, Math.max(0.45, l0));
      out = `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`;
    }
    muteCache.set(key, out);
    return out;
  }
  function themeColor(theme) { return mute(THEME_COLOR_VAR[theme] || "--series-theme"); }
  function rootColor() { return GU.isDark() ? getVar("--text-secondary") : getVar("--text-secondary"); }

  // --- Düğüm yarıçapları (#1): güçlü hiyerarşi. (root 70 / kategori 48 /
  //     leaf 10 px çap → yarıçap). Veride ara-kategori yok, üç kademe.
  const R_ROOT = 34, R_THEME = 23, R_ENTRY = 6;
  function baseRadius(d) { return d.kind === "root" ? R_ROOT : d.kind === "theme" ? R_THEME : R_ENTRY; }
  function nodeColor(d) { return d.kind === "root" ? rootColor() : themeColor(d.theme); }

  function labelFor(d) {
    if (d.kind === "root") return tt(ROOT_LABEL);
    if (d.kind === "theme") return tt(THEME_LABELS[d.theme]);
    return tt(d.label);
  }
  function longLabelFor(d) {
    if (d.kind === "entry") return tt(d.topic);
    return labelFor(d);
  }

  // ---------------------------------------------------------------------------
  let sirlarData = null, sirlarDataPromise = null, built = false;
  let nodes = [], links = [], byId = new Map(), childrenOf = new Map();
  let sim = null, zoomBehavior = null, currentK = 1;
  let zoomLayer, bgLayer, bubbleLayer, linkLayer, particleLayer, nodeLayer;
  let hoveredId = null, focusedTheme = null;
  let particles = [];
  let rafId = null, startTs = 0, lastTs = 0;
  let growth = 1; // 0..1 ilk açılış ilerlemesi

  function fetchData() {
    if (sirlarDataPromise) return sirlarDataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("sirlar-wrap");
    sirlarDataPromise = GU.fetchJson("data/ibn-arabi/sirlar.json")
      .then((data) => { sirlarData = data; if (window.DostViewStatus) window.DostViewStatus.hide("sirlar-wrap"); return data; })
      .catch((err) => {
        console.error("Sırlar verisi yüklenemedi / Failed to load Mysteries data", err);
        sirlarDataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("sirlar-wrap", () => window.__sirlarGraphApp.activate());
      });
    return sirlarDataPromise;
  }

  function buildModel(data) {
    nodes = []; links = []; byId = new Map(); childrenOf = new Map();
    const root = { id: "sirlar-root", kind: "root", parentId: null, theme: null, phase: Math.random() * 6.28 };
    nodes.push(root);
    THEME_ORDER.forEach((theme, i) => {
      const ang = (i / THEME_ORDER.length) * 2 * Math.PI - Math.PI / 2;
      nodes.push({ id: "theme-" + theme, kind: "theme", parentId: "sirlar-root", theme, angle: ang, phase: Math.random() * 6.28 });
    });
    data.entries.forEach((e) => {
      const parentTheme = "theme-" + e.theme;
      nodes.push(Object.assign({}, e, { kind: "entry", parentId: parentTheme, theme: e.theme, phase: Math.random() * 6.28 }));
    });
    nodes.forEach((n) => { byId.set(n.id, n); });
    nodes.forEach((n) => {
      if (n.parentId) {
        links.push({ source: n.parentId, target: n.id });
        if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
        childrenOf.get(n.parentId).push(n.id);
      }
    });
    // ata (soy) zinciri
    nodes.forEach((n) => {
      const chain = []; let cur = n;
      while (cur) { chain.push(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : null; }
      n.ancestors = chain; // node ... root
    });
  }

  function ringRadius() {
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 620;
    const m = Math.min(w, h);
    return { theme: m * 0.24, entry: m * 0.46 };
  }

  function seedPositions() {
    const rr = ringRadius();
    nodes.forEach((n) => {
      if (n.kind === "root") { n.x = 0; n.y = 0; n.fx = 0; n.fy = 0; }
      else if (n.kind === "theme") { n.x = rr.theme * Math.cos(n.angle); n.y = rr.theme * Math.sin(n.angle); }
      else {
        const par = byId.get(n.parentId);
        const a = (par ? par.angle : 0) + (Math.random() - 0.5) * 1.1;
        n.x = rr.entry * Math.cos(a) + (Math.random() - 0.5) * 40;
        n.y = rr.entry * Math.sin(a) + (Math.random() - 0.5) * 40;
      }
    });
  }

  function buildSim() {
    const rr = ringRadius();
    sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance((l) => (l.target.kind === "theme" ? rr.theme : rr.entry - rr.theme)).strength(0.5))
      .force("charge", d3.forceManyBody().strength((d) => (d.kind === "entry" ? -70 : d.kind === "theme" ? -260 : -500)))
      .force("collide", d3.forceCollide().radius((d) => baseRadius(d) + (d.kind === "entry" ? 9 : 16)).strength(0.9))
      .force("rtheme", d3.forceRadial((d) => (d.kind === "theme" ? rr.theme : d.kind === "entry" ? rr.entry : 0), 0, 0).strength((d) => (d.kind === "theme" ? 0.9 : d.kind === "entry" ? 0.28 : 0)))
      .alpha(1).alphaDecay(0.028);
    if (reduceMotion) { sim.alphaDecay(0.2); for (let i = 0; i < 220; i++) sim.tick(); sim.stop(); }
  }

  // ---------------------------------------------------------------------------
  // DOM / katmanlar
  function buildDom() {
    svg.selectAll("*").remove();
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 620;
    svg.attr("viewBox", `0 0 ${w} ${h}`).attr("preserveAspectRatio", "xMidYMid meet");

    const defs = svg.append("defs");
    // yumuşak dış parıltı (glow) filtresi -- glossy değil, ambient
    const glow = defs.append("filter").attr("id", "sir-glow").attr("x", "-70%").attr("y", "-70%").attr("width", "240%").attr("height", "240%");
    glow.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "b");
    const gm = glow.append("feMerge"); gm.append("feMergeNode").attr("in", "b"); gm.append("feMergeNode").attr("in", "SourceGraphic");
    // düğüm derinliği: hafif iç ışıma için radyal gradyan (renk fill üstüne)
    const rg = defs.append("radialGradient").attr("id", "sir-depth").attr("cx", "36%").attr("cy", "30%").attr("r", "72%");
    rg.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff").attr("stop-opacity", "0.45");
    rg.append("stop").attr("offset", "42%").attr("stop-color", "#ffffff").attr("stop-opacity", "0.10");
    rg.append("stop").attr("offset", "100%").attr("stop-color", "#000000").attr("stop-opacity", "0.14");

    zoomLayer = svg.append("g").attr("class", "sir-canvas");
    zoomLayer.attr("transform", `translate(${w / 2},${h / 2})`);
    bgLayer = zoomLayer.append("g").attr("class", "sir-bg");
    bubbleLayer = zoomLayer.append("g").attr("class", "sir-bubbles");
    linkLayer = zoomLayer.append("g").attr("class", "sir-links");
    particleLayer = zoomLayer.append("g").attr("class", "sir-particles");
    nodeLayer = zoomLayer.append("g").attr("class", "sir-nodes");

    zoomBehavior = GU.createZoomBehavior(svg, zoomLayer, [0.35, 3.2]);
    // başlangıç dönüşümü: sahneyi merkeze al (zoom handler zoomLayer'ı buna göre kurar)
    svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(1));
    // zoom sırasında currentK'yı izleyip LOD güncelle
    svgNode.addEventListener("wheel", () => { setTimeout(readZoom, 0); }, { passive: true });
    svg.on("click", () => { if (focusedTheme) exitReading(); });

    const rc = document.getElementById("sirlar-recenter");
    if (rc && !rc.dataset.wiredSir) { rc.dataset.wiredSir = "1"; rc.addEventListener("click", () => { exitReading(); fitAll(); }); }
  }

  function readZoom() {
    const t = d3.zoomTransform(svgNode);
    currentK = t.k;
  }

  // ambient arka plan parçacıkları (#14) — <%2, çok yavaş
  function initBgParticles() {
    const rr = ringRadius();
    const bg = [];
    if (!reduceMotion) for (let i = 0; i < 26; i++) bg.push({ a: Math.random() * 6.28, r: 40 + Math.random() * rr.entry * 1.3, sp: (Math.random() - 0.5) * 0.00006, rad: 0.6 + Math.random() * 1.4 });
    bgParticles = bg;
  }
  let bgParticles = [];

  // bağlantı parçacıkları (#7 "flowing") — her kenarda seyrek, düşük opaklık
  function initParticles() {
    particles = [];
    if (reduceMotion) return;
    links.forEach((l) => { particles.push({ l, t: Math.random(), sp: 0.05 + Math.random() * 0.05 }); });
  }

  // ---------------------------------------------------------------------------
  // Bezier kenar (#2): ebeveynden çocuğa dışa doğru nazikçe akan eğri.
  function linkPath(l) {
    const s = l.source, t = l.target;
    const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
    // kontrol noktasını, kök→düğüm doğrusuna dik yönde hafifçe kaydır (dallanma hissi)
    const dx = t.x - s.x, dy = t.y - s.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const bow = Math.min(46, len * 0.18) * (t._bowSign || 1);
    const cx = mx + nx * bow, cy = my + ny * bow;
    return `M${s.x.toFixed(1)},${s.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${t.x.toFixed(1)},${t.y.toFixed(1)}`;
  }
  function pointOnLink(l, u) {
    const s = l.source, t = l.target;
    const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
    const dx = t.x - s.x, dy = t.y - s.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const bow = Math.min(46, len * 0.18) * (t._bowSign || 1);
    const cx = mx + nx * bow, cy = my + ny * bow;
    const mu = 1 - u;
    return [mu * mu * s.x + 2 * mu * u * cx + u * u * t.x, mu * mu * s.y + 2 * mu * u * cy + u * u * t.y];
  }

  // ---------------------------------------------------------------------------
  // Render döngüsü
  function ensureFrame() { if (rafId == null) { lastTs = performance.now(); rafId = requestAnimationFrame(frame); } }

  function frame(ts) {
    rafId = null;
    if (!startTs) startTs = ts;
    const dt = Math.min(64, ts - lastTs); lastTs = ts;

    // ilk açılış büyüme ilerlemesi (#7,#18)
    if (growth < 1 && !reduceMotion) { growth = Math.min(1, (ts - startTs) / 2000); }
    else if (reduceMotion) growth = 1;

    // bağlantı parçacıklarını ilerlet
    if (!reduceMotion) { const s = dt / 1000; particles.forEach((p) => { p.t += p.sp * s; if (p.t > 1) p.t -= 1; }); bgParticles.forEach((p) => { p.a += p.sp * dt; }); }

    render(ts);

    const simActive = sim && sim.alpha() > 0.006;
    const anim = !reduceMotion && (growth < 1 || true); // nefes + parçacıklar sürekli
    if (simActive || anim || dragging) ensureFrame();
    else rafId = null;
  }

  const HALO_DUR = 300;
  let haloStart = 0, haloNodeId = null;

  function activeSets() {
    // hover ya da odak varsa ilgili küme (soy + alt) belirlenir (#3,#11)
    let anchor = hoveredId || (focusedTheme ? focusedTheme.id : null);
    if (!anchor) return null;
    const n = byId.get(anchor);
    const set = new Set(n.ancestors); // düğüm..kök
    // alt düğümler (tema ise sırları; kök ise her şey)
    (childrenOf.get(anchor) || []).forEach((c) => set.add(c));
    if (n.kind === "root") nodes.forEach((x) => set.add(x.id));
    const connected = new Set(); // 1. derece komşular (boyut +8%)
    if (n.parentId) connected.add(n.parentId);
    (childrenOf.get(anchor) || []).forEach((c) => connected.add(c));
    return { anchor, set, connected };
  }

  function breath(d, ts) {
    if (reduceMotion) return 1;
    if (d.kind === "root") return 1 + 0.03 * Math.sin((ts / 6000) * 2 * Math.PI); // #16 6sn
    return 1 + 0.02 * Math.sin(ts / 2600 + d.phase);
  }

  function render(ts) {
    if (!nodeLayer) return;
    const act = activeSets();
    const rr = ringRadius();

    // --- ambient arka plan (#14): çok soluk, çok yavaş dönen noktalar (<%2)
    if (!reduceMotion && bgParticles.length) {
      const bgSel = bgLayer.selectAll("circle.sir-bgdot").data(bgParticles);
      bgSel.enter().append("circle").attr("class", "sir-bgdot").merge(bgSel)
        .attr("cx", (p) => (p.r * Math.cos(p.a)).toFixed(1))
        .attr("cy", (p) => (p.r * Math.sin(p.a)).toFixed(1))
        .attr("r", (p) => p.rad)
        .style("opacity", 0.018 * growth);
      bgSel.exit().remove();
    }

    // --- kategori baloncukları (#6): temanın sırlarını saran soluk daire
    const bubbleData = THEME_ORDER.map((theme) => {
      const kids = (childrenOf.get("theme-" + theme) || []).map((id) => byId.get(id));
      const th = byId.get("theme-" + theme);
      const pts = kids.concat([th]);
      if (!pts.length) return null;
      let cx = 0, cy = 0; pts.forEach((p) => { cx += p.x; cy += p.y; }); cx /= pts.length; cy /= pts.length;
      let rad = 0; pts.forEach((p) => { rad = Math.max(rad, Math.hypot(p.x - cx, p.y - cy)); });
      return { theme, cx, cy, r: rad + 26 };
    }).filter(Boolean);
    const bub = bubbleLayer.selectAll("circle.sir-bubble").data(bubbleData, (d) => d.theme);
    bub.enter().append("circle").attr("class", "sir-bubble").merge(bub)
      .attr("cx", (d) => d.cx).attr("cy", (d) => d.cy).attr("r", (d) => d.r * growth)
      .style("fill", (d) => themeColor(d.theme))
      .style("opacity", (d) => {
        let o = 0.05;
        if (act) o = act.set.has("theme-" + d.theme) ? 0.09 : 0.02;
        return o * growth;
      });
    bub.exit().remove();

    // --- kenarlar (bezier, #2) + büyüme (#7) ---
    const lk = linkLayer.selectAll("path.sir-link").data(links, (d) => d.target.id || d.target);
    const lkEnter = lk.enter().append("path").attr("class", "sir-link").attr("fill", "none");
    lkEnter.merge(lk).each(function (l) {
      const path = d3.select(this);
      const dep = l.target.kind === "theme" ? 1 : 2;
      const baseW = dep === 1 ? 1.7 : 0.8;         // köke yakın kalın, uzakta ince (#1)
      let op = dep === 1 ? 0.42 : 0.26;
      if (act) {
        const inBranch = act.set.has(l.source.id) && act.set.has(l.target.id);
        op = inBranch ? 0.85 : 0.05;               // ilgisiz linkler %5 (#3)
      }
      // büyüme: kenarları ilerlemeli çiz
      const grown = Math.min(1, growth * 1.15 - (dep === 2 ? 0.15 : 0));
      path.attr("d", linkPath(l))
        .style("stroke", themeColor(l.target.theme || l.source.theme || "suskunluk"))
        .style("stroke-width", baseW)
        .style("opacity", op * Math.max(0, grown));
    });
    lk.exit().remove();

    // --- bağlantı parçacıkları (akış) ---
    if (!reduceMotion && growth > 0.6) {
      const vis = particles.filter((p) => !act || (act.set.has(p.l.source.id) && act.set.has(p.l.target.id)) || Math.random() < 1);
      const ps = particleLayer.selectAll("circle.sir-particle").data(particles, (d) => (d.l.target.id || d.l.target) + ":" + d.t.toFixed(0));
      const psE = ps.enter().append("circle").attr("class", "sir-particle").attr("r", 1.3);
      psE.merge(ps).each(function (p) {
        const [x, y] = pointOnLink(p.l, p.t);
        let op = 0.28;
        if (act) op = (act.set.has(p.l.source.id) && act.set.has(p.l.target.id)) ? 0.5 : 0.02;
        d3.select(this).attr("cx", x).attr("cy", y).style("fill", themeColor(p.l.target.theme || "suskunluk")).style("opacity", op * growth);
      });
      ps.exit().remove();
    }

    // --- düğümler ---
    const nodeSel = nodeLayer.selectAll("g.sir-node").data(nodes, (d) => d.id);
    const enter = nodeSel.enter().append("g")
      .attr("class", (d) => "sir-node sir-node--" + d.kind + (d.kind === "root" ? " node--root" : ""))
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (d) => labelFor(d))
      .on("click", (e, d) => { e.stopPropagation(); onActivate(d); })
      .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onActivate(d); } })
      .on("pointerenter", (e, d) => { setHover(d.id); showTooltip(d, e); })
      .on("pointermove", (e) => moveTooltip(e))
      .on("pointerleave", () => { setHover(null); hideTooltip(); })
      .on("focus", (e, d) => { setHover(d.id); showTooltip(d, e); })
      .on("blur", () => { setHover(null); hideTooltip(); });
    enter.append("circle").attr("class", "sir-hit");                        // görünmez, büyütülmüş tıklama alanı
    enter.append("circle").attr("class", "sir-glow");                       // dış parıltı (#5)
    enter.append("circle").attr("class", "sir-halo");                       // hover halosu (#10)
    enter.append("circle").attr("class", "sir-dot");                        // renk gövde
    enter.append("circle").attr("class", "sir-depth").attr("fill", "url(#sir-depth)"); // derinlik gradyanı (#5)
    enter.append("text").attr("class", "sir-label").attr("text-anchor", "middle");
    if (GU.createDragBehavior) enter.call(GU.createDragBehavior(sim, (d) => d.kind === "root"));
    const merged = enter.merge(nodeSel);
    nodeSel.exit().remove();

    merged.each(function (d) {
      const g = d3.select(this);
      const br = breath(d, ts);
      let r = baseRadius(d) * br;
      // hover boyut artışları (#3,#15)
      let scale = 1;
      if (act) {
        if (d.id === act.anchor) scale = 1.15;
        else if (act.connected.has(d.id)) scale = 1.08;
      }
      r *= scale;
      // görünürlük: büyüme sırası (kök→tema→yaprak) + LOD + hover
      let appear = 1;
      if (growth < 1 && !reduceMotion) {
        const thr = d.kind === "root" ? 0.0 : d.kind === "theme" ? 0.18 : 0.45;
        appear = Math.max(0, Math.min(1, (growth - thr) / 0.35));
      }
      let op = appear;
      if (act) {
        if (act.set.has(d.id)) op *= 1; else op *= 0.10;    // ilgisiz düğümler %10 (#3)
      } else {
        // LOD: uzakta yalnız kök+tema; yaprakları yaklaşınca göster (#8)
        if (d.kind === "entry" && currentK < 0.72) op *= 0.25;
      }
      const col = nodeColor(d);
      g.style("opacity", op).style("display", op < 0.02 ? "none" : null)
        .attr("transform", `translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`);
      g.classed("is-anchor", act && d.id === act.anchor);
      // görünmez tıklama alanı: küçük yaprak düğümlerde (r=6) gerçek dokunma hedefi sağlar
      g.select(".sir-hit").attr("r", Math.max(14, r + 8));
      // dış parıltı (rengiyle uyumlu, glossy değil)
      const glowStrength = d.kind === "root" ? 1 : d.kind === "theme" ? 0.7 : 0.4;
      g.select(".sir-glow").attr("r", r * 1.7).style("fill", col).style("opacity", (d.kind === "root" ? 0.22 : 0.13) * glowStrength * (act && d.id === act.anchor ? 1.6 : 1));
      // hover halosu (#10): genişleyen, sönümlenen
      const halo = g.select(".sir-halo");
      if (haloNodeId === d.id) {
        const p = Math.min(1, (ts - haloStart) / HALO_DUR);
        halo.attr("r", r + 8 + 32 * p).style("stroke", col).style("opacity", 0.15 * (1 - p) + 0.02);
        if (p >= 1) { /* kalıcı hafif */ halo.style("opacity", 0.04); }
      } else halo.style("opacity", 0);
      g.select(".sir-dot").attr("r", r).style("fill", col);
      g.select(".sir-depth").attr("r", r);
      // etiket (#4 yatay + gölge; #8 LOD)
      const lbl = g.select(".sir-label");
      const showLabel = labelVisible(d, act);
      if (!showLabel) lbl.style("display", "none");
      else {
        const long = (d.kind === "entry" && currentK > 1.9);
        lbl.style("display", null)
          .attr("y", r + (d.kind === "root" ? 20 : d.kind === "theme" ? 16 : 12))
          .classed("sir-label--root", d.kind === "root")
          .classed("sir-label--theme", d.kind === "theme")
          .classed("sir-label--strong", act && (d.id === act.anchor))
          .style("font-size", (d.kind === "root" ? 16 : d.kind === "theme" ? 13 : 11) + "px")
          .text(long ? longLabelFor(d) : labelFor(d));
      }
    });
  }

  function labelVisible(d, act) {
    if (d.kind === "root") return true;
    if (d.kind === "theme") return currentK >= 0.5 || (act && act.set.has(d.id));
    // Yaprak (entry): bir dala hover yapmak 36 etiketi birden dökmemeli
    // (#4 çakışma önleme). Yalnız (a) doğrudan üzerine gelinen tek yaprağı,
    // (b) yeterince yakınlaşınca (#8 LOD) etiketle -- yakınlaşınca ekranda
    // aynı anda daha az yaprak kalır, üst üste binme çözülür.
    if (act && act.anchor === d.id) return true;
    return currentK >= 1.7;
  }

  // ---------------------------------------------------------------------------
  function setHover(id) {
    if (hoveredId === id) return;
    hoveredId = id;
    if (id) { haloNodeId = id; haloStart = performance.now(); }
    ensureFrame();
  }

  function onActivate(d) {
    if (d.kind === "entry") {
      window.__dostNav && window.__dostNav.goTo("sirlar", d.id);
    } else if (d.kind === "theme") {
      if (focusedTheme && focusedTheme.id === d.id) exitReading();
      else enterReading(d);
    } else {
      if (focusedTheme) exitReading();
      else if (window.__sirlarShowOverview) window.__sirlarShowOverview();
    }
  }

  // Okuma modu (#17): temayı merkeze al, diğer dalları sönümle, yakınlaştır.
  // Bütün kümeyi ekrana sığdırmak yerine daha güçlü bir yakınlaştırma
  // ("larger font/spacing"): yaprak etiketleri LOD ile açılır ama aynı anda
  // yalnız birkaçı ekrana sığar -> okunur kalır, 36 etiket üst üste binmez;
  // gerisini kullanıcı sürükleyerek gezer.
  function enterReading(themeNode) {
    focusedTheme = themeNode;
    wrapEl.classList.add("sir-reading");
    const kids = (childrenOf.get(themeNode.id) || []).map((id) => byId.get(id));
    let cx = themeNode.x, cy = themeNode.y;
    if (kids.length) {
      cx = 0; cy = 0;
      kids.concat([themeNode]).forEach((p) => { cx += p.x; cy += p.y; });
      cx /= kids.length + 1; cy /= kids.length + 1;
    }
    // Küçük temada (az yaprak) daha çok yakınlaş -> yaprak etiketleri LOD ile
    // açılır ve okunur. Büyük temada (çok yaprak) yalnız merkezle+sönümle+orta
    // yakınlaştır; 36 etiketi birden dökmek yerine kullanıcı bir yaprağın
    // üzerine gelince o yaprağın metni (ipucu + detay paneli) açılır.
    const k = kids.length <= 12 ? 1.95 : 1.5;
    zoomToPoint(cx, cy, k);
    ensureFrame();
  }
  function exitReading() {
    focusedTheme = null;
    wrapEl.classList.remove("sir-reading");
    fitAll();
    ensureFrame();
  }

  function zoomToPoint(cx, cy, k) {
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 620;
    const t = d3.zoomIdentity.translate(w / 2 - k * cx, h / 2 - k * cy).scale(k);
    const sel = reduceMotion ? svg : svg.transition().duration(650).ease(d3.easeCubicInOut);
    sel.call(zoomBehavior.transform, t);
    currentK = k;
  }

  function fitAll() { fitTo(nodes); }
  function fitTo(list) {
    if (!list.length) return;
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 620;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    list.forEach((d) => { const r = baseRadius(d) + 40; minx = Math.min(minx, d.x - r); maxx = Math.max(maxx, d.x + r); miny = Math.min(miny, d.y - r); maxy = Math.max(maxy, d.y + r); });
    const bw = Math.max(1, maxx - minx), bh = Math.max(1, maxy - miny);
    const k = Math.max(0.35, Math.min(2.4, Math.min(w / bw, h / bh) * 0.9));
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const t = d3.zoomIdentity.translate(w / 2 - k * cx, h / 2 - k * cy).scale(k);
    const sel = reduceMotion ? svg : svg.transition().duration(650).ease(d3.easeCubicInOut);
    sel.call(zoomBehavior.transform, t);
    currentK = k;
  }

  function showTooltip(d, event) {
    if (!tooltip) return;
    let short = "";
    if (d.kind === "theme") { const c = (childrenOf.get(d.id) || []).length; short = tt({ tr: `${c} sır`, en: `${c} entries`, pt: `${c} entradas` }); }
    else if (d.kind === "entry") short = tt(d.quote);
    tooltip.innerHTML = `<div class="node-hover-tip__title">${labelFor(d)}</div>${short ? `<div class="node-hover-tip__short">${short}</div>` : ""}`;
    tooltip.hidden = false; moveTooltip(event);
  }
  function moveTooltip(event) { GU.moveTooltip(tooltip, wrapEl, event); }
  function hideTooltip() { GU.hideTooltip(tooltip); }

  let dragging = false;
  function wireDragState() {
    // createDragBehavior sim'i ısıtır; sürükleme sırasında rAF sürsün
    svgNode.addEventListener("pointerdown", () => { dragging = true; ensureFrame(); });
    window.addEventListener("pointerup", () => { dragging = false; });
    window.addEventListener("resize", () => { if (built && !wrapEl.hidden) onResize(); });
  }

  function onResize() {
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 620;
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    const rr = ringRadius();
    if (sim) {
      sim.force("rtheme", d3.forceRadial((d) => (d.kind === "theme" ? rr.theme : d.kind === "entry" ? rr.entry : 0), 0, 0).strength((d) => (d.kind === "theme" ? 0.9 : d.kind === "entry" ? 0.28 : 0)));
      sim.alpha(0.4).restart();
    }
    fitAll();
    ensureFrame();
  }

  // ---------------------------------------------------------------------------
  function buildGraph(data) {
    buildModel(data);
    seedPositions();
    buildSim();
    buildDom();
    initBgParticles();
    initParticles();
    // sim tick sadece pozisyonu günceller; render'ı rAF yürütür
    sim.on("tick", () => {});
    built = true;
    growth = reduceMotion ? 1 : 0;
    startTs = 0;
    readZoom();
    render(performance.now());
    // sim biraz oturduktan sonra çerçevele
    setTimeout(() => { if (!focusedTheme) fitAll(); }, reduceMotion ? 0 : 700);
    ensureFrame();
    wireDragState();
  }

  window.__sirlarGraphApp = {
    activate() { fetchData().then((data) => { if (!data) return; if (!built) buildGraph(data); else ensureFrame(); }); },
    onLangChange() { if (built) { muteCache.clear(); render(performance.now()); } },
    isFocused() { return !!focusedTheme; },
    unfocusTheme() { if (focusedTheme) exitReading(); },
  };
})();
