(function () {
  "use strict";

  // ============================================================================
  // Sorular — "keşfedilen bir mana evreni"
  //
  // Klasik bir network graph değil; anlam katmanları arasında yolculuk hissi
  // veren, sakin ve derinlikli bir bilgi haritası. Işıyan küre düğümler, düşük
  // opaklıkta organik bezier bağlantılar, çok hafif bir atmosfer katmanı
  // (radyal ışık + yavaş süzülen parçacıklar), üstüne gelince açılan mini bilgi
  // kartı, odak modu ve sağ altta bir minimap. Salt vanilla D3 (yeni
  // bağımlılık yok — bkz. CLAUDE.md).
  //
  // Düzen (2026-07-27'de değişti): dokuz kategori tek bir SARMALIN durakları.
  // Önceden sekizi bir halka üzerinde, "En Temel Soru" ise halkanın
  // merkezinde duruyordu; kullanıcı bu görünümün sayfanın geri kalanından
  // ayrı düştüğünü söyleyince düzen Hâller/Menziller'deki sarmal yöntemine
  // çevrildi (bkz. CLAUDE.md, "Dairenin üçüncü boyutu: sarmal"). Artık en
  // temel soru merkez değil, sarmalın BAŞLANGICI: oradan başlayıp dönerek
  // yükseliyor ve son durak başlangıcın üstüne geliyor -- dönüş var, tekrar
  // yok. 2B'de kendi dışına açılan bir sarmal, 3B'ye eğilince yükselen bir
  // helis; ikisi de aynı parametrik tanımdan (spiralPoint) çıkıyor.
  //
  // Kademeli açılım: soruların hepsi aynı anda ekrana dökülmüyor. Bir
  // kategoriye dokununca o kategorinin soruları sarmalın DIŞINA doğru
  // açılıyor -- düğümler kayboldu değil, sırasını bekliyor. (Üstteki
  // Yüzey/Derin/Tam süzgeci aynı tarihte kaldırıldı; gerekçesi aşağıda.)
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

  // Sarmalın BAŞLANGICINDAKİ kategori: tek sorusu olan "En Temel Soru".
  // (2026-07-27'ye kadar halkanın merkezindeydi.)
  const CENTER_CAT = "en-temel";

  // ---------------------------------------------------------------------------
  let sorularData = null, dataPromise = null;
  let categoryById = new Map(), questionIndex = new Map();
  let catNodes = [], qNodes = [], relLinks = [];
  let expandedCatId = null;
  let ringR = 200, cx = 450, cy = 320;
  let nodes = [], nodeById = new Map(), links = [];
  let zoomLayer, bgLayer, ringLayer, linkLayer, particleLayer, nodeLayer, centerLayer, defs;
  let zoomBehavior = null, simulation = null, currentK = 1;
  let currentDetailQuestion = null, hoveredId = null, focusId = null;
  let width = 900, height = 640;
  let rafId = null, lastTs = 0, dragging = false;
  let bgParticles = [], edgeParticles = [];
  let flashId = null, flashStart = 0;
  let miniEl = null, miniSvg = null, miniViewport = null;

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

  function labelFor(q, max) {
    const label = I18n.pick3(q.question);
    const lim = max || 30;
    return label.length > lim ? label.slice(0, lim - 1) + "…" : label;
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

    // Kategori düğümleri sarmalın durakları. 2026-07-27'ye kadar "En Temel
    // Soru" merkezde duruyor, kalan sekizi bir halka üzerinde diziliyordu.
    // Kullanıcı isteğiyle düzen Hâller/Menziller'deki sarmal yöntemine
    // çevrildi (bkz. CLAUDE.md, "Dairenin üçüncü boyutu: sarmal"): artık
    // dokuz kategori de aynı sarmalın üzerinde ve en temel soru merkez
    // değil, sarmalın BAŞLANGICI. Anlamı da bu: en temel sorudan başlanıp
    // dönerek yükseliyor, ve son durak başlangıcın üstüne geliyor -- dönüş
    // var ama tekrar yok.
    const spiralOrder = cats.slice().sort((a, b) => {
      if (a.id === CENTER_CAT) return -1;
      if (b.id === CENTER_CAT) return 1;
      return 0;
    });
    const catItems = cats.map((cat) => {
      const si = spiralOrder.indexOf(cat);
      return {
        id: "cat:" + cat.id, isCat: true, category: cat,
        isCenterCat: cat.id === CENTER_CAT,
        spiralIndex: si,
        spiralT: si / cats.length,
        ringAngle: -Math.PI / 2 + (si / cats.length) * Math.PI * 2,
        phase: Math.random() * 6.28,
        degree: cat.questions.length,
      };
    });
    return { catNodes: catItems, qNodes: items, links: relLinks };
  }

  // 2026-07-28: düğümler sitenin geri kalanına göre iri kalıyordu (kullanıcı
  // notu: "sorular grafiği düğümleri çok büyük, diğer sayfalardaki
  // grafiklerle uyumlu hale getirelim"). Referans ölçüler: Ontoloji'de
  // Zât 34, insan-ı kâmil 18, sıradan düğüm 13; Sırlar'da tema 23.
  // Buradaki tavanlar 23/17.5 idi → 18/13.5'e çekildi; en-temel (spiralin
  // başı) yine bir tık büyük kalıyor ki nereden başlandığı belli olsun.
  function radiusFor(d) {
    if (d.isCat) return (d.isCenterCat ? 11.5 : 10) + Math.min(7, d.category.questions.length) * 0.95;
    return 6.5 + Math.min(6, d.degree) * 1.15;
  }

  // --- Kademeli açılım: hangi düğümler şu an sahnede? -------------------------
  function visibleQuestions() {
    if (!expandedCatId) return [];
    return qNodes.filter((n) => n.category.id === expandedCatId);
  }
  function activeNodes() { return catNodes.concat(visibleQuestions()); }
  function activeLinks() {
    const vis = new Set(visibleQuestions().map((n) => n.id));
    // sap: kategori -> kendi sorusu
    const stems = visibleQuestions().map((n) => ({
      id: "stem:" + n.id, kind: "stem", from: "cat:" + n.category.id, to: n.id,
      source: "cat:" + n.category.id, target: n.id,
    }));
    // ilişki: iki ucu da sahnede olanlar doğrudan çiziliyor.
    const rels = relLinks.filter((r) => vis.has(r.from) && vis.has(r.to))
      .map((r) => Object.assign({}, r, { id: "rel:" + r.from + ">" + r.to, kind: "rel", source: r.from, target: r.to }));
    // 2026-07-28 (kullanıcı isteği: "sorular arası ilişkiler açık olarak
    // gelsin"): bir kol açıkken ötekiler kapalı olduğu için KATEGORİLER
    // ARASI ilişkiler hiç görünmüyordu -- soru A açık koldayken, ilişkili
    // olduğu soru B başka bir kategoride olduğu için kenar da hiç
    // çizilmiyordu. Artık böyle bir ilişki, sorudan karşı KATEGORİYE giden
    // bir kenar olarak çiziliyor: "bu sorunun cevabı şu tarafta da devam
    // ediyor" işareti. Hiçbir kol açık değilken de kategoriler arası
    // ilişkiler kategori-kategori kenarı olarak duruyor, böylece harita
    // ilk açılışta da bir ağ gibi görünüyor, dağınık halkalar gibi değil.
    const seenBridge = new Set();
    const bridges = [];
    const qById = new Map(qNodes.map((n) => [n.id, n]));
    relLinks.forEach((r) => {
      const a = qById.get(r.from), b = qById.get(r.to);
      if (!a || !b) return;
      if (a.category.id === b.category.id) return;      // aynı kol: yukarıda ele alındı
      const aVis = vis.has(r.from), bVis = vis.has(r.to);
      if (aVis && bVis) return;                          // ikisi de sahnede: yukarıda çizildi
      const src = aVis ? r.from : "cat:" + a.category.id;
      const tgt = bVis ? r.to : "cat:" + b.category.id;
      if (src === tgt) return;
      const key = [src, tgt].sort().join(">");
      if (seenBridge.has(key)) return;                   // aynı iki uç arasında tek kenar yeter
      seenBridge.add(key);
      bridges.push({ id: "bridge:" + key, kind: "bridge", from: src, to: tgt, source: src, target: tgt });
    });
    return stems.concat(rels, bridges);
  }

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
    // Halka kendi katmanında: .sorular-bg circle kuralı (dolgu = text-muted)
    // atmosfer noktaları için; halkanın içi dolu görünmesin.
    ringLayer = zoomLayer.append("g").attr("class", "sorular-ringlayer");
    linkLayer = zoomLayer.append("g").attr("class", "sorular-links");
    particleLayer = zoomLayer.append("g").attr("class", "sorular-particles");
    centerLayer = zoomLayer.append("g").attr("class", "sorular-center").attr("aria-hidden", "true");
    nodeLayer = zoomLayer.append("g").attr("class", "sorular-nodes");

    // kategorilerin üzerinde durduğu sessiz halka
    ringLayer.append("path").attr("class", "sorular-ring-path").attr("fill", "none");

    // merkezde nefes alan sessiz işaret (daire/merkez ilkesi)
    centerLayer.append("circle").attr("class", "node-halo").attr("r", 34);

    zoomBehavior = GU.createZoomBehavior(svg, zoomLayer, [0.4, 3], (event) => !event.target.closest(".node"));
    svgNode.addEventListener("wheel", () => { setTimeout(() => { currentK = d3.zoomTransform(svgNode).k; }, 0); }, { passive: true });

    const rc = document.getElementById("sorular-recenter");
    if (rc) rc.onclick = () => { showAllQuestionsList(); };
    if (backBtn) { backBtn.hidden = !currentDetailQuestion && !expandedCatId; backBtn.onclick = () => showAllQuestionsList(); }
    // Boşluğa tıklamak: önce odağı bırakır, sonra açık kategoriyi kapatır.
    svg.on("click", () => {
      if (focusId) { clearFocus(); return; }
      if (expandedCatId) collapseCategory(true);
    });

    buildMinimap();
  }

  // 2026-07-27: Yüzey/Derin/Tam süzgeci kullanıcı isteğiyle kaldırıldı.
  // Gerekçe: sorular zaten kategori açılınca geliyordu; üstteki üç düğme
  // hem sayfanın geri kalanında karşılığı olmayan bir kontroldü hem de
  // "hangi soru daha yüzeysel" gibi, bizim veremeyeceğimiz bir hükmü
  // arayüze yazıyordu. Skor hesabı (`surfaceScore`/`depth`) veride kaldı
  // ama artık hiçbir şeyi gizlemiyor; yalnız mini haritadaki soluklukta
  // kullanılıyordu, o da sabitlendi.

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
      .style("opacity", 0.8);
    dots.exit().remove();
    // viewport dikdörtgeni
    const t = d3.zoomTransform(svgNode);
    const vx0 = (-t.x) / t.k, vy0 = (-t.y) / t.k, vx1 = (width - t.x) / t.k, vy1 = (height - t.y) / t.k;
    miniViewport.attr("x", sx(vx0)).attr("y", sy(vy0))
      .attr("width", Math.max(2, sx(vx1) - sx(vx0))).attr("height", Math.max(2, sy(vy1) - sy(vy0)));
  }

  // ---------------------------------------------------------------------------
  function layoutSeed() {
    cx = width / 2; cy = height / 2;
    // Halka: açılan sorulara dışarıda yer kalsın diye ekranın yarısı kadar.
    ringR = Math.max(96, Math.min(width, height) / 2 - (Math.min(width, height) < 620 ? 118 : 150));
    // Dokuz kategori de sarmalın üzerinde; yarıçap ilerledikçe hafifçe
    // açılıyor, böylece 2B'de bile "kendi dışına doğru dönen" bir sarmal
    // okunuyor, 3B'ye eğilince de yükselen bir helis oluyor.
    catNodes.forEach((n) => {
      const rr = ringR * (0.72 + 0.34 * n.spiralT);
      n.x = cx + rr * Math.cos(n.ringAngle);
      n.y = cy + rr * Math.sin(n.ringAngle);
      n.fx = n.x; n.fy = n.y;   // sarmal sabit dursun (soru düğümleri serbest)
    });
    centerLayer.attr("transform", `translate(${cx},${cy})`);
  }

  // Açılan kategorinin soruları, kategorinin bulunduğu yönde bir yelpaze
  // hâlinde halkanın DIŞINA yerleşir. (Merkezdeki kategori için "dışarısı"
  // halkanın içi olur; orası boş.)
  function assignBloomTargets() {
    const vis = visibleQuestions();
    if (!vis.length) return;
    const cat = nodeById.get("cat:" + expandedCatId);
    if (!cat) return;
    const isMobile = Math.min(width, height) < 620;
    const outward = isMobile ? 86 : 124;
    // Sarmalda merkez yok: her kategori kendi durağının bulunduğu yarıçaptan
    // dışa doğru açılıyor (eski "merkezdeki kategori içeri açılsın" istisnası
    // 2026-07-27'de kalktı).
    const catR = ringR * (0.72 + 0.34 * cat.spiralT);
    const R = catR + outward;
    const baseA = cat.ringAngle;
    // Dörtten fazla soru varsa tek bir geniş yay komşu kategorilerin üstüne
    // taşıyor; onun yerine iki sıraya (yakın/uzak) diziyoruz -- yelpaze dar
    // kalıyor, kendi kolunun içinde duruyor.
    vis.forEach((n) => { n.__parentT = cat.spiralT; });
    const rows = vis.length > 4 ? 2 : 1;
    const rowGap = isMobile ? 56 : 76;
    const perRow = [[], []];
    vis.forEach((n, i) => perRow[rows === 2 ? i % 2 : 0].push(n));
    perRow.forEach((row, ri) => {
      const rowR = R + ri * rowGap;
      const spread = Math.min(1.25, 0.36 * Math.max(1, row.length - 1) + 0.3);
      row.forEach((n, i) => {
        const t = row.length === 1 ? 0 : (i / (row.length - 1)) - 0.5;
        n.bloomAngle = baseA + t * spread;
        n.targetR = rowR;
      });
    });
    vis.forEach((n) => {
      const a = n.bloomAngle, R2 = n.targetR;
      n.tx = cx + R2 * Math.cos(a);
      n.ty = cy + R2 * Math.sin(a);
      // Açılış: soru, kategorinin üstünden doğup dışarı doğru açılsın.
      if (!n.bloomed) {
        n.bloomed = true;
        n.x = cat.x + (Math.random() - 0.5) * 8;
        n.y = cat.y + (Math.random() - 0.5) * 8;
        n.vx = 0; n.vy = 0;
      }
    });
  }

  function buildSim() {
    if (simulation) simulation.stop();
    nodes = activeNodes();
    links = activeLinks();
    assignBloomTargets();
    // #1 — daha fazla nefes: çarpışma mesafesi ve itim mobilde/masaüstünde farklı.
    const isMobile = Math.min(width, height) < 620;
    simulation = d3.forceSimulation(nodes)
      .alphaDecay(0.045)
      .force("link", d3.forceLink(links).id((d) => d.id)
        .distance((l) => (l.kind === "stem" ? (isMobile ? 78 : 104) : (isMobile ? 70 : 92)))
        .strength((l) => (l.kind === "stem" ? 0.45 : 0.12)))
      .force("charge", d3.forceManyBody().strength((d) => (d.isCat ? 0 : (isMobile ? -95 : -150))))
      // soruları halkanın dışındaki kendi yayına oturt
      .force("radial", d3.forceRadial((d) => d.targetR || ringR, cx, cy).strength((d) => (d.isCat ? 0 : 0.32)))
      .force("x", d3.forceX((d) => d.tx).strength((d) => (d.isCat ? 0 : 0.1)))
      .force("y", d3.forceY((d) => d.ty).strength((d) => (d.isCat ? 0 : 0.1)))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + (d.isCat ? 22 : (isMobile ? 24 : 34))).strength(0.92));
    if (reduceMotion) { simulation.alphaDecay(0.2); for (let i = 0; i < 220; i++) simulation.tick(); simulation.stop(); }
    simulation.on("end", () => {
      const focused = focusId ? nodeById.get(focusId) : null;
      if (focused && nodes.indexOf(focused) >= 0) panTo(focused);
      else if (!currentDetailQuestion) fitView(true);
    });
    initEdgeParticles();
  }

  function initAtmosphere() {
    bgParticles = [];
    if (reduceMotion) return;
    const rmax = Math.min(width, height) * 0.62;
    for (let i = 0; i < 30; i++) bgParticles.push({ a: Math.random() * 6.28, r: 30 + Math.random() * rmax, sp: (Math.random() - 0.5) * 0.00006, rad: 0.6 + Math.random() * 1.5, cx, cy });
  }

  // Işık akışı parçacıkları sahnedeki bağlantılara bağlı; kategori açılıp
  // kapandıkça bağlantı kümesi değiştiği için yeniden kuruluyor.
  function initEdgeParticles() {
    edgeParticles = [];
    if (reduceMotion) return;
    links.forEach((l) => { edgeParticles.push({ l, t: Math.random(), sp: 0.05 + Math.random() * 0.05 }); });
  }

  // Organik bezier bağlantı (#3): düğüm KENARINDAN çıkıp kenara giren,
  // hafifçe kavisli bir eğri.
  // ---------------------------------------------------------------------------
  // Derinlik (3B) — bkz. research/GRAFIK-FELSEFESI.md
  //
  // Sorular arasında bir mertebe sırası yok ve uydurmuyoruz. Ama verinin
  // kendi üç katmanı var ve bu görünümün kademeli açılımı zaten onu
  // izliyor: merkezdeki en temel soru, çevresindeki kategori halkası, ve
  // bir kategori açılınca dışarı yelpazelenen sorular. Eğim açılınca bu
  // üç katman derinliğe yayılıyor -- en temel soru öne, tek tek sorular
  // arkaya. Derinlik bir rütbe değil, "hangi soru hangisinin içinden
  // çıkıyor" ilişkisinin görünür hâli.
  let tilt3d = null, dropH3d = 0;
  // Sarmalın dikey ekseni: kategori sırası boyunca YÜKSELİYOR (Hâller'deki
  // gibi; Menziller'de tersine iniyordu). Sorular kendi kategorisinin
  // yüksekliğinden bir tık yukarıda duruyor -- açıldıklarında sarmalın
  // gövdesinden dışa doğru savruluyor gibi görünsünler diye.
  function catVertOf(d) {
    const t = d.isCat ? d.spiralT : (d.__parentT != null ? d.__parentT : 0.5);
    return -dropH3d / 2 + dropH3d * t;
  }
  function tierVert(d) {
    return catVertOf(d) + (d.isCat ? 0 : dropH3d * 0.045);
  }
  // Sarmalın sürekli yolu: kategorilerin durduğu noktalardan geçen tek bir
  // eğri. 2B'de kendi dışına doğru açılan bir sarmal, 3B'de yükselen bir
  // helis olarak okunuyor -- iki durum da aynı parametrik tanımdan çıkıyor
  // (Menziller'deki samplePath ile aynı yaklaşım).
  function spiralPoint(t) {
    const n = Math.max(1, catNodes.length);
    const a = -Math.PI / 2 + t * Math.PI * 2;
    const rr = ringR * (0.72 + 0.34 * t);
    const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
    const vert = -dropH3d / 2 + dropH3d * t;
    if (!tilt3d) return { x: x, y: y };
    const p = tilt3d.project(x - cx, y - cy, vert);
    return { x: p.x + cx, y: p.y + cy };
  }
  function spiralPath() {
    if (!catNodes.length) return "";
    // Son kategoriden bir adım ötesine kadar uzatıyoruz ki sarmal, başladığı
    // noktanın bir üstüne gelerek kapansın (dönüş var, tekrar yok).
    const tEnd = catNodes.length / Math.max(1, catNodes.length);
    let d = "";
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const p = spiralPoint((i / steps) * tEnd);
      d += (i ? " L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1);
    }
    return d;
  }

  function positionNodes() {
    if (!tilt3d) return;
    nodes.forEach((d) => {
      const p = tilt3d.project(d.x - cx, d.y - cy, tierVert(d));
      d.px = p.x + cx; d.py = p.y + cy; d.__depth = p.depth; d.__z = p.z;
    });
  }
  function nx_(d) { return d.px == null ? d.x : d.px; }
  function ny_(d) { return d.py == null ? d.y : d.py; }

  function linkPath(l) {
    const s = l.source, t = l.target;
    const dx = nx_(t) - nx_(s), dy = ny_(t) - ny_(s);
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const sr = radiusFor(s) + 2, tr = radiusFor(t) + 2;
    const sx = nx_(s) + ux * sr, sy = ny_(s) + uy * sr;
    const ex = nx_(t) - ux * tr, ey = ny_(t) - uy * tr;
    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    const nx = -uy, ny = ux;
    const bow = Math.min(30, len * 0.14);
    return `M${sx.toFixed(1)},${sy.toFixed(1)} Q${(mx + nx * bow).toFixed(1)},${(my + ny * bow).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
  }
  function pointOnLink(l, u) {
    const s = l.source, t = l.target;
    const dx = nx_(t) - nx_(s), dy = ny_(t) - ny_(s);
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const sr = radiusFor(s) + 2, tr = radiusFor(t) + 2;
    const sx = nx_(s) + ux * sr, sy = ny_(s) + uy * sr, ex = nx_(t) - ux * tr, ey = ny_(t) - uy * tr;
    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    const nx = -uy, ny = ux, bow = Math.min(30, len * 0.14);
    const cxp = mx + nx * bow, cyp = my + ny * bow, mu = 1 - u;
    return [mu * mu * sx + 2 * mu * u * cxp + u * u * ex, mu * mu * sy + 2 * mu * u * cyp + u * u * ey];
  }

  // ---------------------------------------------------------------------------
  function ensureFrame() { if (rafId == null) { lastTs = performance.now(); rafId = requestAnimationFrame(frame); } }
  function frame(ts) {
    rafId = null;
    // Görünüm ekranda değilse (başka bölüme geçilmiş ya da sekme arkada)
    // döngüyü tamamen durdur. Aksi hâlde bu tam-render döngüsü sonsuza kadar
    // 60fps sürüyor ve sayfanın geri kalanını -- metin kutusuna yazmayı bile --
    // yavaşlatıyordu (bkz. GU.isViewActive).
    if (!GU.isViewActive(wrapEl)) { lastTs = 0; return; }
    const dt = lastTs ? Math.min(64, ts - lastTs) : 16; lastTs = ts;
    if (tilt3d) tilt3d.step(ts, dt, !expandedCatId);
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

  function render(ts) {
    if (!nodeLayer) return;
    positionNodes();
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

    // --- kategori halkası ---
    ringLayer.select("path.sorular-ring-path").attr("d", spiralPath());

    // --- bağlantılar (bezier, düşük opaklık) (#3) ---
    const lk = linkLayer.selectAll("path.sorular-link").data(links, (l) => l.id);
    lk.enter().append("path").attr("class", "sorular-link").attr("fill", "none").merge(lk)
      .each(function (l) {
        const p = d3.select(this);
        const dv = true;
        let op = 0.16;
        if (act) op = (act.set.has(l.source.id) && act.set.has(l.target.id)) ? 0.8 : 0.05;
        // Kategoriler arası "köprü" kenarı kesikli çiziliyor: doğrudan bir
        // soru-soru ilişkisi değil, "bu ilişkinin öteki ucu şu kolda"
        // işareti (bkz. activeLinks()'teki bridges).
        if (l.kind === "bridge") op = act ? op : 0.13;
        p.attr("d", linkPath(l))
          .classed("sorular-link--bridge", l.kind === "bridge")
          .classed("sorular-link--active", act && act.set.has(l.source.id) && act.set.has(l.target.id))
          .style("stroke", act && act.set.has(l.source.id) && act.set.has(l.target.id) ? catColor(l.source) : null)
          .style("opacity", op * (dv ? 1 : 0.25));
      });
    lk.exit().remove();

    // --- aktif bağlantılarda ışık akışı (#3 "ışık akışı") ---
    if (!reduceMotion && act) {
      const vis = edgeParticles.filter((p) => act.set.has(p.l.source.id) && act.set.has(p.l.target.id));
      const ps = particleLayer.selectAll("circle.sorular-flow").data(vis, (d) => d.l.id);
      ps.enter().append("circle").attr("class", "sorular-flow").attr("r", 1.6).merge(ps)
        .each(function (p) { const [x, y] = pointOnLink(p.l, p.t); d3.select(this).attr("cx", x).attr("cy", y).style("fill", catColor(p.l.source)); });
      ps.exit().remove();
    } else { particleLayer.selectAll("circle.sorular-flow").remove(); }

    // --- düğümler ---
    const gsel = nodeLayer.selectAll("g.sorular-node").data(nodes, (d) => d.id);
    const enter = gsel.enter().append("g")
      .attr("class", (d) => "node sorular-node" + (d.isCat ? " sorular-node--cat" : ""))
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (d) => (d.isCat ? I18n.pick3(d.category.name) : I18n.pick3(d.question.question)))
      .call(GU.createDragBehavior(simulation, (d) => d.isCat))
      .on("click", (e, d) => { e.stopPropagation(); if (d.isCat) toggleCategory(d.category.id); else openQuestion(d); })
      .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (d.isCat) toggleCategory(d.category.id); else openQuestion(d); } })
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
      if (d.isCat && expandedCatId === d.category.id) scale *= 1.18;
      // Bir kategori açıkken ötekiler arka plana çekiliyor (kullanıcı notu
      // 2026-07-27): küçülüyor, soluyor ve bulanıklaşıyor -- odak açılan
      // kolda kalsın.
      else if (d.isCat && expandedCatId) scale *= 0.68;
      // 3B perspektif ölçeği: uzaktaki düğüm küçülür.
      if (tilt3d && tilt3d.value > 0.02) scale *= Math.max(0.55, 1 + ((d.__depth == null ? 1 : d.__depth) - 1) * tilt3d.value);
      const r = radiusFor(d) * scale;
      const dx = reduceMotion ? 0 : 1.2 * Math.sin(ts / 3300 + d.phase);
      const dy = reduceMotion ? 0 : 1.2 * Math.cos(ts / 3800 + d.phase);
      let op = 1;
      // Bir kategori açıkken diğerleri geri çekilir; halka görünür kalır ama
      // dikkat açılan kolda toplanır.
      if (d.isCat && expandedCatId && expandedCatId !== d.category.id) op *= 0.42;
      if (act) { if (!act.set.has(d.id)) op *= 0.28; }  // focus/hover (#19)
      // Atmosfer: 3B'de uzaktaki düğüm soluklaşır (Hâller'deki aynı ölçü).
      const t3 = tilt3d ? tilt3d.value : 0;
      if (t3 > 0.02) op *= Math.max(0.58, Math.min(1, (d.__depth == null ? 1 : d.__depth) * 1.02));
      const backgrounded = expandedCatId && d.category.id !== expandedCatId;
      g.style("opacity", op).style("display", op < 0.02 ? "none" : null)
        .style("filter", backgrounded ? "blur(2.2px)" : null)
        .attr("transform", `translate(${(nx_(d) + dx).toFixed(1)},${(ny_(d) + dy).toFixed(1)})`);
      g.classed("sorular-node--active", currentDetailQuestion && d.id === currentDetailQuestion.id);
      const col = catColor(d);
      // flash (aramadan gelince kısa parlama) (#9)
      let flash = 0;
      if (flashId === d.id) { const p = (ts - flashStart) / 900; if (p >= 1) flashId = null; else flash = Math.sin(p * Math.PI); }
      // Kategori kürelerinin arkasındaki büyük soluk daire 2026-07-27'de
      // kullanıcı isteğiyle kaldırıldı ("arka taraftaki daha büyük daire
      // gölgeleri"): sahneyi lekeliyordu. Etkileşim geri bildirimi kalsın
      // diye üzerine gelince ve arama parlamasında hâlâ beliriyor.
      const ambientGlow = d.isCat ? 0 : 0.12;
      g.select(".sorular-glow").attr("r", r * 1.8).style("fill", col)
        .style("opacity", (ambientGlow + 0.5 * flash + (isHover ? 0.16 : 0)) * (d.degree >= 3 ? 1.3 : 1));
      const halo = g.select(".sorular-halo");
      const isActive = currentDetailQuestion && d.id === currentDetailQuestion.id;
      if (isActive) {
        const puls = reduceMotion ? 1 : (1 + 0.1 * Math.sin(ts / 900));
        halo.attr("r", (r + 6) * puls).style("stroke", col).style("opacity", 0.5);
      } else halo.style("opacity", 0);
      g.select(".sorular-sphere").attr("r", r);
      g.select(".sorular-sheen").attr("r", r);
      const lbl = g.select(".sorular-label");
      // Kategori etiketi hep açık (haritanın okunur kalması için); soru
      // etiketi eskisi gibi üstüne gelince / yakınlaşınca / seçiliyken.
      const inOpenArm = !d.isCat && expandedCatId === d.category.id;
      const showLabel = d.isCat || inOpenArm || isHover || isActive || currentK >= 1.15 || (act && act.set.has(d.id));
      // Açılan koldaki soruların etiketi merkezden DIŞARI bakan tarafa yazılır;
      // yoksa iki sıralı yelpazede dış sıranın etiketi iç sıranın üstüne düşüyor.
      const labelY = inOpenArm && (d.y - cy) < 0 ? -(r + 7) : r + 13;
      lbl.attr("y", labelY).style("display", showLabel ? null : "none")
        .classed("sorular-label--strong", isHover || isActive)
        .classed("sorular-label--cat", !!d.isCat)
        .text(d.isCat ? I18n.pick3(d.category.name) : labelFor(d.question, inOpenArm ? 20 : 30));
    });
  }

  // ---------------------------------------------------------------------------
  function setHover(id) { if (hoveredId === id) return; hoveredId = id; ensureFrame(); }
  function clearFocus() { focusId = null; ensureFrame(); }

  // Detay paneli grafiğin SAĞINI örter (sabit ~420px); sığdırma bunu hesaba
  // katmazsa haritanın sağ yarısı panelin arkasında kalıyor. Mobilde panel bir
  // yan sütun değil, alttan gelen tam genişlikte bir sayfa: orada daraltmıyoruz.
  function visibleWidth() {
    if (!detailPanel || detailPanel.hidden) return width;
    const sr = svgNode.getBoundingClientRect();
    if (!sr.width) return width;
    const pr = detailPanel.getBoundingClientRect();
    if (!pr.width || pr.left >= sr.right) return width;
    const visiblePx = pr.left - sr.left;
    if (visiblePx < sr.width * 0.45) return width;
    return width * (visiblePx / sr.width);
  }

  function fitView(animate) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    // Hem şimdiki hem HEDEF konumu hesaba katıyoruz: bir kategori yeni
    // açıldığında sorular henüz kategorinin üstünde duruyor; sadece o ana
    // bakarsak açılan yelpaze çerçevenin dışına taşıyor.
    const bound = (d) => {
      const xs = [nx_(d)], ys = [ny_(d)];
      // Hedef konum HAM (2B) koordinatta tutuluyor; sahne 3B'yken onu da
      // izdüşürmek gerekiyor, yoksa iki ayrı koordinat sistemi karışıp
      // çerçeve olduğundan çok daha geniş hesaplanıyor (açılan kol
      // küçücük kalıyordu).
      if (!d.isCat && d.tx != null) {
        if (tilt3d && tilt3d.value > 0.02) {
          const tp = tilt3d.project(d.tx - cx, d.ty - cy, tierVert(d));
          xs.push(tp.x + cx); ys.push(tp.y + cy);
        } else { xs.push(d.tx); ys.push(d.ty); }
      }
      xs.forEach((v) => { x0 = Math.min(x0, v); x1 = Math.max(x1, v); });
      ys.forEach((v) => { y0 = Math.min(y0, v); y1 = Math.max(y1, v); });
    };
    // Bir kategori açıkken çerçeve YALNIZ o kola göre kuruluyor: açılan
    // soru yelpazesi ekrana ortalanıp büyüyor, öteki kategoriler kenarda
    // (flu ve küçük) kalıyor. Öncesinde bütün sahneye sığdırıldığı için
    // açılan kol küçücük görünüyordu (kullanıcı notu 2026-07-27).
    const focusSet = expandedCatId
      ? nodes.filter((d) => d.category.id === expandedCatId || d.isCat)
      : nodes.slice();
    focusSet.forEach(bound);
    if (x0 === 1e9) nodes.forEach(bound);
    // Kategori etiketleri kürenin altına yazılıyor; kenardakiler için pay bırak.
    x0 -= 78; x1 += 78; y0 -= 56; y1 += 62;
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
    const vw = visibleWidth();
    const [mn, mx] = zoomBehavior.scaleExtent();
    const k = Math.max(mn, Math.min(mx, Math.min(vw / bw, height / bh)));
    const t = d3.zoomIdentity.translate(vw / 2 - k * (x0 + bw / 2), height / 2 - k * (y0 + bh / 2)).scale(k);
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
    if (d.isCat) {
      const n = d.category.questions.length;
      const open = expandedCatId === d.category.id;
      tooltip.innerHTML =
        `<div class="node-hover-tip__title">${I18n.pick3(d.category.name)}</div>` +
        `<div class="node-hover-tip__meta">${n} ${tt({ tr: "soru", en: "questions", pt: "perguntas" })} · ` +
        (open ? tt({ tr: "kapatmak için tıkla", en: "click to close", pt: "clique para fechar" })
              : tt({ tr: "açmak için tıkla", en: "click to open", pt: "clique para abrir" })) + `</div>`;
      tooltip.hidden = false; moveTooltip(event);
      return;
    }
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
    // Benzetmeler sitenin görünen yüzünden kaldırıldı; gizli anahtar
    // kelimeyle geri açılıyor (bkz. assets/analogy-toggle.js).
    if (!analogy || !(window.DostAnalogy && window.DostAnalogy.visible())) return "";
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

  // --- Kademeli açılım: kategori aç / kapat ----------------------------------
  function rebuildScene(animate) {
    buildSim();
    render(performance.now());
    fitView(animate !== false);
    ensureFrame();
  }

  function expandCategory(catId, animate) {
    if (expandedCatId === catId) return;
    // Önceki kategorinin soruları kapanınca bir dahaki açılışta yeniden
    // "doğsunlar" diye bloom bayrağını sıfırlıyoruz.
    qNodes.forEach((n) => { if (n.category.id !== catId) n.bloomed = false; });
    expandedCatId = catId;
    rebuildScene(animate);
  }

  function collapseCategory(animate) {
    if (!expandedCatId) return;
    qNodes.forEach((n) => { n.bloomed = false; });
    expandedCatId = null;
    focusId = null;
    rebuildScene(animate);
  }

  function toggleCategory(catId) {
    if (expandedCatId === catId) { collapseCategory(true); showAllQuestionsList(true); return; }
    expandCategory(catId, true);
    showCategoryList(catId);
  }

  function showCategoryList(catId) {
    const cat = categoryById.get(catId);
    if (!cat) return;
    currentDetailQuestion = null;
    if (backBtn) backBtn.hidden = false;
    const rows = cat.questions.map((q) => `
      <button class="sorular-question-row" type="button" data-id="${q.id}"><span>${I18n.pick3(q.question)}</span><span class="sorular-question-row__arrow" aria-hidden="true">→</span></button>`).join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow"><button class="sorular-back-link" type="button">← ${tt({ tr: "Bütün Sorular", en: "All Questions", pt: "Todas as Perguntas" })}</button></p>
      <h2 class="detail-title">${I18n.pick3(cat.name)}</h2>
      <p class="sorular-category-tag">${cat.questions.length} ${tt({ tr: "soru", en: "questions", pt: "perguntas" })}</p>
      <div class="sorular-question-list">${rows}</div>`;
    detailContent.querySelector(".sorular-back-link").addEventListener("click", () => showAllQuestionsList());
    wireQuestionRows();
    detailPanel.hidden = false;
    ensureFrame();
  }

  function showAllQuestionsList(keepScene) {
    currentDetailQuestion = null; focusId = null;
    if (backBtn) backBtn.hidden = true;
    if (expandedCatId && !keepScene) collapseCategory(true);
    else if (nodes.length) fitView(true);
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
    const entry = questionIndex.get(d.id);
    // Soru başka bir kategorideyse (ör. "İlişkili Sorular"dan gelindiyse) önce
    // o kol açılır; düğüm sahneye çıkınca simülasyon yerleşince ona pan edilir.
    if (entry && expandedCatId !== entry.category.id) {
      expandCategory(entry.category.id, true);
      focusId = d.id;
      flashId = d.id; flashStart = performance.now();
      showQuestionDetail(d.question);
      return;
    }
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
    catNodes = built.catNodes; qNodes = built.qNodes; relLinks = built.links;
    nodeById = new Map(catNodes.concat(qNodes).map((n) => [n.id, n]));
    buildDom();
    layoutSeed();
    buildSim();
    initAtmosphere();
    dropH3d = ringR * 1.6;
    // pitch 0.3 -> 0.42: sahnenin 3B olduğu ilk bakışta anlaşılmıyordu
    // (kullanıcı notu 2026-07-27); daha açık bir eğim derinliği görünür
    // kılıyor. spinRate zaten çok yavaş -- "huzurlu dönüş" istenen bu.
    tilt3d = GU.createTilt({ focal: 2600, pitch: 0.42, spinRate: 0.00005 });
    tilt3d.wireToggle("sorular-3d-toggle", () => {
      ensureFrame();
      setTimeout(() => { if (!wrapEl.hidden) fitView(true); }, reduceMotion ? 30 : 1120);
    });
    tilt3d.wireDrag(svgNode, () => { render(performance.now()); ensureFrame(); }, ".sorular-node");
    // Görünüm 3B açılıyor (kullanıcı notu 2026-07-27).
    tilt3d.set(1, true);
    tilt3d.markOn("sorular-3d-toggle");
    render(performance.now());
    fitView(false);
    ensureFrame();
    window.addEventListener("resize", onResize);
  }

  function onResize() {
    if (!catNodes.length || wrapEl.hidden) return;
    width = svgNode.clientWidth || 900; height = svgNode.clientHeight || 640;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    layoutSeed();
    assignBloomTargets();
    if (simulation) simulation.alpha(0.35).restart();
    render(performance.now());
    fitView(false);
    ensureFrame();
  }

  function relabel() {
    if (!nodes.length) return;
    muteCache.clear();
    render(performance.now());
    if (currentDetailQuestion) showQuestionDetail(currentDetailQuestion);
    else if (expandedCatId) showCategoryList(expandedCatId);
    else if (detailPanel && !detailPanel.hidden) showAllQuestionsList(true);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (wrapEl.hidden) return;
    if (!currentDetailQuestion && !expandedCatId) return;
    showAllQuestionsList();
  });

  // sürükleme sırasında rAF sürsün
  svgNode.addEventListener("pointerdown", () => { dragging = true; ensureFrame(); });
  window.addEventListener("pointerup", () => { dragging = false; });

  // Sekme arkaya alınıp geri gelindiğinde döngü yeniden uyansın.
  GU.onViewWake(() => { if (!wrapEl.hidden) ensureFrame(); });

  window.__sorularApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        if (!catNodes.length) { buildGraph(data); showAllQuestionsList(true); }
        else ensureFrame();
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        if (!catNodes.length) buildGraph(data);
        if (questionIndex.has(id)) { const node = nodeById.get(id); if (node) openQuestion(node); else showQuestionDetail(questionIndex.get(id).question); }
        else showAllQuestionsList();
      });
    },
    onLangChange() { relabel(); },
  };
})();
