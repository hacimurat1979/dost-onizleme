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
  // Merkez düğüm 2026-07-27'ye kadar yalnız bölümün adını ("Sırlar")
  // taşıyordu, yani içi boş bir başlıktı. Kullanıcı isteğiyle yerini,
  // okumalarımızın bizi getirdiği "sırların sırrı" önerisi aldı; metni
  // veriden (`sirlar.json` -> `merkez`) geliyor. Veri gelmeden önceki tek
  // karelik render için burada bir yedek etiket duruyor.
  const ROOT_LABEL = { tr: "Sırlar", en: "Mysteries", pt: "Mistérios" };
  function rootLabel() {
    return (sirlarData && sirlarData.merkez && sirlarData.merkez.label) ? sirlarData.merkez.label : ROOT_LABEL;
  }

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
  // Kök ("Örten de O, görünen de O") artık Ontoloji/Esmâ'daki Zât ile aynı
  // gövde rengini taşıyor (GU.ZAT_FILL, beyaz) -- kullanıcı isteği
  // 2026-07-28. Önceki --text-secondary gri, düğümü çevresindeki temalardan
  // ayırmıyordu; merkez olduğu belli olmuyordu.
  function rootColor() { return GU.ZAT_FILL; }

  // --- Düğüm yarıçapları (#1): güçlü hiyerarşi. (root 70 / kategori 48 /
  //     leaf 10 px çap → yarıçap). Veride ara-kategori yok, üç kademe.
  // R_ENTRY 7.5 → 10.5: en dipteki sır kayıtları ekranda iğne başı kadar
  // kalıyordu (kullanıcı notu 2026-07-28, "en dipteki sırlar düğümleri çok
  // küçükler"). Çarpışma yarıçapı baseRadius()'ten türediği için düzen
  // kendiliğinde de biraz açılıyor; halkanın taşmadığını Playwright ile
  // ölçtük.
  const R_ROOT = 34, R_THEME = 23, R_ENTRY = 10.5;
  function baseRadius(d) { return d.kind === "root" ? R_ROOT : d.kind === "theme" ? R_THEME : R_ENTRY; }
  function nodeColor(d) { return d.kind === "root" ? rootColor() : themeColor(d.theme); }

  function labelFor(d) {
    if (d.kind === "root") return tt(rootLabel());
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
  let zoomLayer, spinLayer, bgLayer, linkLayer, particleLayer, nodeLayer;
  // Sakin, huzurlu dönüş: tam tur ~110 saniye.
  let spin = 0;
  const SPIN_RATE = 0.000057;
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
    // Sakin dönüş için tek bir ara grup: bütün sahne kökün (0,0) etrafında
    // yavaşça dönerken etiketler ayrıca ters döndürülüp dik tutuluyor.
    spinLayer = zoomLayer.append("g").attr("class", "sir-spin");
    bgLayer = spinLayer.append("g").attr("class", "sir-bg");
    linkLayer = spinLayer.append("g").attr("class", "sir-links");
    particleLayer = spinLayer.append("g").attr("class", "sir-particles");
    nodeLayer = spinLayer.append("g").attr("class", "sir-nodes");

    zoomBehavior = GU.createZoomBehavior(svg, zoomLayer, [0.35, 3.2]);
    // başlangıç dönüşümü: sahneyi merkeze al (zoom handler zoomLayer'ı buna göre kurar)
    svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(1));
    // zoom sırasında currentK'yı izleyip LOD güncelle
    svgNode.addEventListener("wheel", () => { setTimeout(readZoom, 0); }, { passive: true });
    svg.on("click", () => { if (focusedTheme) exitReading(); });

    // exitReading burada da bir KAMERA geri alma: focusOnTheme sahneyi
    // temaya yaklaştırıyor (bkz. ETKILESIM_DILI.md, ikinci fiil).
    GU.wireRecenter("sirlar-recenter", () => { exitReading(); fitAll(); });

    // "Bir adım geri": açık panel varsa sıra ortak katmanın (false dönüyoruz,
    // o kapatıyor); panel kapalıyken odaklı bir tema varsa odağı bırakıyoruz.
    // Bu dal 2026-08-03'e kadar ontology.js'in içinde duruyordu.
    GU.registerStepBack("sirlar-wrap", () => {
      const panel = document.getElementById("detail-panel");
      if (panel && !panel.hidden) return false;
      if (!focusedTheme) return false;
      exitReading();
      return true;
    });
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
  // ---------------------------------------------------------------------------
  // Perdelenme derinliği (3B) — bkz. research/GRAFIK-FELSEFESI.md
  //
  // Bu görünümde Hâller'deki gibi bir MERTEBE sırası yok; sırların
  // birbirinden yüksek ya da alçak olduğunu söyleyen bir veri elimizde
  // değil ve öyleymiş gibi bir eksen uydurmak istemedik (CLAUDE.md:
  // "zorlama yapma"). Ama verinin kendi taşıdığı üç katmanlı bir yapı
  // var ve o yapı tam da bu bölümün konusuna denk düşüyor: kök (işaret
  // eden), temalar (işaretin yönü), girdiler (işaret edilen sır). Eğim
  // açılınca bu üç katman derinliğe yayılıyor: işaret öne, sır arkaya
  // ve atmosferle sönerek. Yani derinlik burada bir rütbe değil, bir
  // PERDE ölçüsü -- sır uzaklaştıkça soluklaşıyor.
  const TIER_DEPTH = { root: 0, theme: 1, entry: 2 };
  let tilt3d = null, dropH = 0;
  function tierVert(d) {
    const t = TIER_DEPTH[d.kind] == null ? 1 : TIER_DEPTH[d.kind];
    return -dropH / 2 + (dropH / 2) * t;
  }
  // Her karede ekran konumlarını tazeler. tilt=0'da px/py, x/y'nin ta
  // kendisidir -- 2B görünüm birebir korunur.
  function positionNodes() {
    if (!tilt3d) return;
    nodes.forEach((d) => {
      const p = tilt3d.project(d.x, d.y, tierVert(d));
      d.px = p.x; d.py = p.y; d.__depth = p.depth; d.__z = p.z;
    });
  }
  function nx_(d) { return d.px == null ? d.x : d.px; }
  function ny_(d) { return d.py == null ? d.y : d.py; }

  function linkPath(l) {
    const s = l.source, t = l.target;
    const sx = nx_(s), sy = ny_(s), tx = nx_(t), ty = ny_(t);
    const mx = (sx + tx) / 2, my = (sy + ty) / 2;
    // kontrol noktasını, kök→düğüm doğrusuna dik yönde hafifçe kaydır (dallanma hissi)
    const dx = tx - sx, dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const bow = Math.min(46, len * 0.18) * (t._bowSign || 1);
    const cx = mx + nx * bow, cy = my + ny * bow;
    return `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`;
  }
  function pointOnLink(l, u) {
    const s = l.source, t = l.target;
    const sx = nx_(s), sy = ny_(s), tx = nx_(t), ty = ny_(t);
    const mx = (sx + tx) / 2, my = (sy + ty) / 2;
    const dx = tx - sx, dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const bow = Math.min(46, len * 0.18) * (t._bowSign || 1);
    const cx = mx + nx * bow, cy = my + ny * bow;
    const mu = 1 - u;
    return [mu * mu * sx + 2 * mu * u * cx + u * u * tx, mu * mu * sy + 2 * mu * u * cy + u * u * ty];
  }

  // ---------------------------------------------------------------------------
  // Render döngüsü
  function ensureFrame() { if (rafId == null) { lastTs = performance.now(); rafId = requestAnimationFrame(frame); } }

  function frame(ts) {
    rafId = null;
    // Görünüm ekranda değilse döngüyü tamamen durdur -- aşağıdaki `anim`
    // koşulu (|| true) normal kullanıcıda hep doğru olduğu için, bu kapı
    // olmadan döngü başka bölüme geçildikten sonra da sonsuza kadar
    // sürüyordu (bkz. GU.isViewActive).
    if (!GU.isViewActive(wrapEl)) { lastTs = 0; return; }
    if (!startTs) startTs = ts;
    const dt = lastTs ? Math.min(64, ts - lastTs) : 16; lastTs = ts;
    // 3B'de düzlemsel dönüş yerini yaw'a bırakıyor: sahne dikey eksen
    // etrafında dönerken katman sırası (işaret önde, sır arkada) bozulmasın.
    if (tilt3d) tilt3d.step(ts, dt, !focusedTheme);
    if (tilt3d && tilt3d.on) {
      if (spinLayer) spinLayer.attr("transform", null);
    } else if (!reduceMotion && !dragging && !focusedTheme) {
      spin += dt * SPIN_RATE;
      if (spinLayer) spinLayer.attr("transform", `rotate(${(spin * 180 / Math.PI).toFixed(2)})`);
    }

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
    positionNodes();
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

    // Kategori baloncukları (temanın sırlarını saran soluk büyük daireler)
    // 2026-07-27'de kullanıcı isteğiyle kaldırıldı: 3B'de arkada duran
    // gölgemsi lekeler gibi görünüyor, sahneyi okunaksızlaştırıyordu.
    // Tema aidiyeti zaten renkle ve kenarlarla belli.

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
    // Dış parıltı (#5). Kök düğüm ayrıca `node-halo` sınıfını da alıyor:
    // böylece Ontoloji'deki Zât (.node--root .node-halo) ve Esmâ'daki Zât
    // ile BİREBİR aynı ışımayı CSS'ten devralıyor (6sn node-halo-breathe,
    // dark modda --accent-glow-dark + blur). Kullanıcı isteği 2026-07-28:
    // "örten de o görünen de o düğümünü ontoloji ve esma grafiğindeki zat
    // düğümü formatında gösterelim." Aşağıdaki render döngüsü kök için
    // fill/opacity'ye DOKUNMUYOR -- yoksa CSS animasyonunu inline stil
    // ezip nefesi öldürürdü.
    enter.append("circle").attr("class", (d) => "sir-glow" + (d.kind === "root" ? " node-halo" : ""));
    enter.append("circle").attr("class", "sir-halo");                       // hover halosu (#10)
    enter.append("circle").attr("class", "sir-dot");                        // renk gövde
    enter.append("circle").attr("class", "sir-depth").attr("fill", "url(#sir-depth)"); // derinlik gradyanı (#5)
    enter.append("text").attr("class", "sir-label").attr("text-anchor", "middle");
    if (GU.createDragBehavior) enter.call(GU.createDragBehavior(sim, (d) => d.kind === "root"));
    const merged = enter.merge(nodeSel);
    nodeSel.exit().remove();
    // Derinlik sırası: uzaktakiler önce çizilsin ki örtüşme doğru olsun.
    if (tilt3d && tilt3d.value > 0.02) merged.sort((a, b) => (b.__z || 0) - (a.__z || 0));

    const t3 = tilt3d ? tilt3d.value : 0;
    merged.each(function (d) {
      const g = d3.select(this);
      const br = breath(d, ts);
      // 3B perspektif ölçeği: uzaktaki düğüm küçülür.
      const dsc = 1 + ((d.__depth == null ? 1 : d.__depth) - 1) * t3;
      let r = baseRadius(d) * br * Math.max(0.55, dsc);
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
      // Atmosfer: 3B'de uzaktaki düğüm soluklaşır -- perdelenmenin kendisi.
      if (t3 > 0.02) op *= Math.max(0.55, Math.min(1, (d.__depth == null ? 1 : d.__depth) * 1.02));
      const col = nodeColor(d);
      g.style("opacity", op).style("display", op < 0.02 ? "none" : null)
        .attr("transform", `translate(${nx_(d).toFixed(1)},${ny_(d).toFixed(1)})`);
      g.classed("is-anchor", act && d.id === act.anchor);
      // Görünmez tıklama alanı. Sabit 14 birim yetmiyordu: sahne uzaklaşınca
      // (currentK < 1) SVG birimi ekranda küçülüyor, en dipteki yapraklar
      // tıklanamaz hâle geliyordu (kullanıcı notu 2026-07-27). Hedefi
      // EKRAN ölçüsünde tutuyoruz -- yarıçap ~22 ekran pikselinin altına
      // düşmüyor.
      g.select(".sir-hit").attr("r", Math.max(14, r + 8, 22 / Math.max(0.3, currentK)));
      // dış parıltı (rengiyle uyumlu, glossy değil)
      const isRoot = d.kind === "root";
      const glowStrength = isRoot ? 1 : d.kind === "theme" ? 0.7 : 0.4;
      const glowSel = g.select(".sir-glow");
      if (isRoot) {
        // Zât formatı: yarıçapı burada veriyoruz, geri kalan her şeyi
        // (renk, opaklık, nefes) .node--root .node-halo CSS'i yürütüyor.
        // 2.0 katsayısı Ontoloji'deki Zât halosunun düğüme oranıyla aynı
        // hissi veriyor; CSS'teki scale(1.4) tepe noktasını zaten ekliyor.
        glowSel.attr("r", r * 2.0).style("fill", null).style("opacity", null);
      } else {
        glowSel
          .attr("r", r * 1.7)
          .style("fill", col)
          .style("opacity", 0.13 * glowStrength * (act && d.id === act.anchor ? 1.6 : 1));
      }
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
        const ly = r + (d.kind === "root" ? 20 : d.kind === "theme" ? 16 : 12);
        lbl.style("display", null)
          .attr("y", ly)
          // Sahne döndüğü için etiketi kendi noktası etrafında ters çevirip
          // hem dik hem yerinde tut.
          // 3B'de spinLayer hiç döndürülmüyor (yaw devrede), bu yüzden
          // ters çevirme de yapılmamalı -- yoksa etiketler eğrilir.
          .attr("transform", tilt3d && tilt3d.on ? null : `rotate(${(-spin * 180 / Math.PI).toFixed(2)},0,${ly.toFixed(1)})`)
          .classed("sir-label--root", d.kind === "root")
          .classed("sir-label--theme", d.kind === "theme")
          .classed("sir-label--strong", act && (d.id === act.anchor))
          .style("font-size", (d.kind === "root" ? 16 : d.kind === "theme" ? 13 : 11) + "px")
          .text(long ? longLabelFor(d) : labelFor(d));
      }
    });

    spreadThemeLabels(merged);
  }

  // Tema etiketleri uzun ("Dilde ve Kelimede Gizlenen Sırlar" gibi) ve 3B'de
  // halka dikeyde sıkıştığı için yan yana gelen ikisi birbirinin üstüne
  // biniyordu (kullanıcı notu 2026-07-27). Beş tema var; her karede ekran
  // konumlarına bakıp yatayda örtüşenleri dikeyde ayırıyoruz. Genişlik
  // ölçümü (getComputedTextLength) metin başına bir kez yapılıp
  // önbelleğe alınıyor -- her karede layout zorlamamak için.
  const labelWidthCache = new Map();
  function measureLabel(textEl) {
    const key = textEl.textContent + "|" + textEl.style.fontSize;
    if (labelWidthCache.has(key)) return labelWidthCache.get(key);
    let w = 0;
    try { w = textEl.getComputedTextLength(); } catch (e) { w = key.length * 6; }
    labelWidthCache.set(key, w);
    return w;
  }

  function spreadThemeLabels(merged) {
    const items = [];
    const discs = [];
    merged.each(function (d) {
      if (d.kind !== "theme") return;
      const g = this;
      if (g.style.display === "none") return;
      const dot = g.querySelector(".sir-dot");
      discs.push({ id: d.id, x: nx_(d), y: ny_(d), r: parseFloat(dot && dot.getAttribute("r")) || R_THEME });
      const lbl = g.querySelector(".sir-label");
      if (!lbl || lbl.style.display === "none") return;
      const baseY = parseFloat(lbl.getAttribute("y")) || 0;
      lbl.__baseY = lbl.__baseY == null ? baseY : lbl.__baseY;
      items.push({ id: d.id, el: lbl, x: nx_(d), y: ny_(d) + lbl.__baseY, w: measureLabel(lbl), baseY: lbl.__baseY });
    });
    if (items.length < 2) return;
    items.sort((a, b) => a.y - b.y);
    // Boşluk EKRAN ölçüsünde tutulmalı: satır yüksekliği ~15 ekran pikseli,
    // ama burada SVG birimindeyiz ve sahne uzaklaşınca (currentK < 1) sabit
    // bir SVG boşluğu ekranda yetersiz kalıyor.
    const MIN_GAP = 17 / Math.max(0.35, currentK);
    for (let i = 0; i < items.length; i++) {
      const cur = items[i];
      let shift = 0;
      for (let j = 0; j < i; j++) {
        const prev = items[j];
        const overlapX = Math.abs(cur.x - prev.x) < (cur.w + prev.w) / 2 + 6;
        if (!overlapX) continue;
        const need = prev.y + shiftOf(prev) + MIN_GAP - cur.y;
        if (need > shift) shift = need;
      }
      // Etiket, BAŞKA bir temanın dairesinin üstüne de binmemeli -- yoksa
      // ilk harfleri düğümün arkasında kalıyor (kullanıcı notu 2026-07-27).
      shift = Math.max(shift, clearOfDiscs(cur, shift));
      cur.__shift = shift;
      cur.el.setAttribute("y", (cur.baseY + shift).toFixed(1));
    }

    function clearOfDiscs(it, shift) {
      let need = shift;
      const half = it.w / 2;
      discs.forEach((dc) => {
        if (dc.id === it.id) return;
        const y = it.y + shift;
        const overlapX = dc.x + dc.r > it.x - half - 4 && dc.x - dc.r < it.x + half + 4;
        if (!overlapX) return;
        if (Math.abs(y - dc.y) > dc.r + 9) return;
        need = Math.max(need, dc.y + dc.r + 11 - it.y);
      });
      return need;
    }
    function shiftOf(it) { return it.__shift || 0; }
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
      // Merkez artık bir başlık değil, kendi içeriği olan bir öneri:
      // "sırların sırrı". Odak açıksa önce onu kapatıyoruz (eski davranış),
      // değilse merkezin kendi panelini açıyoruz.
      if (focusedTheme) exitReading();
      else if (sirlarData && sirlarData.merkez && window.__sirlarShowMerkez) window.__sirlarShowMerkez();
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
    // 3B'de sahne düz halkadan daha uzun; sığdırma ekran konumuna bakmalı.
    list.forEach((d) => { const r = baseRadius(d) + 40; const x = nx_(d), y = ny_(d); minx = Math.min(minx, x - r); maxx = Math.max(maxx, x + r); miny = Math.min(miny, y - r); maxy = Math.max(maxy, y + r); });
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
    // Perdelenme derinliği. dropH, dış halkanın yarıçapına bağlı: katmanlar
    // birbirinden ayrışsın ama sahne dikeyde taşmasın.
    dropH = ringRadius().entry * 1.5;
    // pitch 0.3 -> 0.44: 3B'de halka dikeyde çok sıkışıyordu, tema
    // etiketleri birbirine giriyordu (kullanıcı notu 2026-07-27). Daha açık
    // bir eğim elipsi genişletiyor ve etiketlere dikeyde yer açıyor.
    tilt3d = GU.createTilt({ focal: 2400, pitch: 0.44, spinRate: 0.00005 });
    tilt3d.wireToggle("sirlar-3d-toggle", () => { ensureFrame(); setTimeout(fitAll, reduceMotion ? 30 : 1120); });
    // Görünüm 3B açılıyor (kullanıcı notu 2026-07-27): sahnenin derinliği
    // olduğu ilk bakışta anlaşılsın diye. "instant" -- açılıştaki öbür
    // işlerle yarışıp takılmasın (bkz. graph-utils createTilt.set).
    tilt3d.set(1, true);
    tilt3d.markOn("sirlar-3d-toggle");
    tilt3d.wireDrag(svgNode, () => { render(performance.now()); ensureFrame(); }, ".sir-node");
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

  GU.onViewWake(() => { if (!wrapEl.hidden) ensureFrame(); });

  window.__sirlarGraphApp = {
    activate() { fetchData().then((data) => { if (!data) return; if (!built) buildGraph(data); else ensureFrame(); }); },
    onLangChange() { if (built) { muteCache.clear(); render(performance.now()); } },
    isFocused() { return !!focusedTheme; },
    unfocusTheme() { if (focusedTheme) exitReading(); },
  };
})();
