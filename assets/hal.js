(function () {
  "use strict";

  // ============================================================================
  // Hâller Haritası — "yolun gerçek tabiatı"
  //
  // Bu görünüm önce basit bir halka olarak yazılmıştı: her hâl yalnızca bir
  // öncekine ve bir sonrakine bağlı, düz bir zincir. 2026-07-25'te kullanıcının
  // sorduğu soru ("okuduklarımız gerçekten böyle bir grafiği mi dikte ediyor?")
  // bizi kendi metinlerimizi taramaya götürdü ve cevap hayır çıktı. Üç şeyi
  // artık açıkça gösteriyoruz:
  //
  //  1) YÜKSELEN SARMAL. "Aynı hâl, bir üst turda" cümlesi sitede zaten
  //     yazılıydı ama düz bir daire çiziliyordu. Artık halka 3B'ye eğilebiliyor
  //     ve Hayret'ten sonraki dönüşün Nefs'in TAM ÜSTÜNE düştüğü görülüyor --
  //     aynı açı, bir tur yukarısı. (bkz. CLAUDE.md daire/merkez ilkesi)
  //  2) KİRİŞLER. hal.json'daki `relations`: ardışık OLMAYAN hâller arasında
  //     kendi kaynaklı metinlerimizde bulduğumuz bağlar; dairenin içinden
  //     geçen ince çizgiler. Biri (tevekkül→yakîn) sıralamayla açıkça çelişiyor
  //     ve o yüzden ayrı bir türle (gerilim) çiziliyor.
  //  3) TERK HALKASI. Fütûhât'ta dört makamın ("Zühd Makamı ve Terki" gibi)
  //     ayrıca bir terk bölümü var: kazanılıp sonra bırakılan basamaklar.
  //     Bunlar ikinci, kesik bir halkayla işaretleniyor.
  //
  // 3B motoru esma.js'teki elle yazılmış yaw/pitch/perspektif projeksiyonunun
  // aynısı: Three.js/WebGL YOK, `tilt` 0→1 arasında yumuşatılıyor (0 = eski
  // düz halka, 1 = sarmal). Salt vanilla D3.
  // ============================================================================

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  // Etiket çakışması ölçümle çözülüyor; ortak motor graph-utils.js'te.
  const deconflictLabels = GU.createLabelDeconflictor();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = d3.select("#hal-graph");
  const svgNode = svg.node();
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const tooltip = document.getElementById("hal-tooltip");
  const wrapEl = document.getElementById("hal-wrap");

  function tt(dict) { return I18n.pick3(dict || {}); }
  function getVar(n) { return GU.getVar(n); }
  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

  const LANDMARK = new Set(["nefs", "cemfark", "fenabeka", "tevhit", "hayret"]);
  function baseRadius(n) {
    if (n.stage === "hayret") return 26;
    if (LANDMARK.has(n.stage)) return 19;
    return 12;
  }

  const STAGE_VAR = {
    nefs: "--series-hal-nefs",
    muameleler: "--series-hal-muameleler",
    cemfark: "--series-hal-cemfark",
    fenabeka: "--series-hal-fenabeka",
    tevhit: "--series-hal-tevhit",
    hayret: "--series-hal-hayret",
  };
  let journeyColor = null;
  function buildColorScale(n) {
    journeyColor = d3.scaleLinear()
      .domain([0, 1, n - 4, n - 3, n - 2, n - 1])
      .range([
        getVar("--series-hal-nefs"),
        getVar("--series-hal-muameleler"),
        getVar("--series-hal-cemfark"),
        getVar("--series-hal-fenabeka"),
        getVar("--series-hal-tevhit"),
        getVar("--series-hal-hayret"),
      ])
      .interpolate(d3.interpolateRgb)
      .clamp(true);
  }
  function nodeColor(d) { return journeyColor ? journeyColor(d.__i) : getVar(STAGE_VAR[d.stage]); }
  function labelFor(n) { return I18n.pick3(n.name); }

  // Kiriş türleri: renk + insan-okunur etiket.
  const KIND_VAR = {
    gerilim: "--series-hal-nefs",
    dogurur: "--series-hal-hayret",
    yanki: "--series-hal-cemfark",
  };
  const KIND_LABEL = {
    gerilim: { tr: "Sırayla çelişen bağ", en: "Bond contradicting the sequence", pt: "Vínculo que contradiz a sequência" },
    dogurur: { tr: "Biri ötekini doğuruyor", en: "One gives rise to the other", pt: "Um dá origem ao outro" },
    yanki: { tr: "Aynı hamlenin yankısı", en: "Echo of the same move", pt: "Eco do mesmo gesto" },
  };
  const TERK_NOTE = {
    tr: "Bu makamın Fütûhât'ta ayrıca bir \"terki\" bölümü var — kazanılıp sonra bırakılan bir basamak.",
    en: "In the Futuhat this station also has a chapter on its \"abandonment\" — a step attained and then let go.",
    pt: "No Futuhat esta estação também tem um capítulo sobre seu \"abandono\" — um degrau alcançado e depois solto.",
  };

  // ---------------------------------------------------------------------------
  let halData = null, halDataPromise = null, built = false;
  let orderedNodes = [], nodeById = new Map();
  let relations = [];
  let zoomLayer, bgLayer, ghostLayer, linkLayer, chordLayer, glowLayer, nodeLayer, walkLayer, defs;
  let zoomBehavior = null;
  let currentDetailNode = null, currentRelation = null, hoveredId = null, hoveredRel = null;
  let rafId = null, startTs = 0, lastTs = 0, reveal = 1;
  let shimmer = [];
  let cx = 0, cy = 0, baseR = 200, riseH = 240;

  // --- 3B durumu (esma.js ile aynı model) ---
  // FOCAL esma'dakinden (900) belirgin biçimde uzun: 18 düğüm tek bir tura
  // yayıldığı için güçlü perspektif, sarmalın UZAK yarısını ezip etiketleri
  // üst üste bindiriyordu. Uzun odak = daha az bükülme, okunur etiketler.
  const FOCAL = 1900;
  const TILT_DUR = 1050;
  let tilt = 0, tiltTarget = 0, tiltAnimStart = 0, tiltFrom = 0;
  let yaw = 0, pitch = 0.62;
  let dragging = false;

  // ---- C3: "yolu yürü" -- Nefs'ten Hayret'e, sonra dönüş yayının ucuna
  // (aynı açı, bir üst tur) ilerleyen tek bir nokta. walkT null iken devre
  // dışı; 0..n arası ilerlerken n = orderedNodes.length, yani tam olarak
  // dönüş yayının bittiği yer (Nefs'in TAM ÜSTÜ, tilt>0 iken görünür).
  const WALK_DUR = 6000;
  const WALK_HOLD = 2600;
  const WALK_FADE = 900;
  let walkT = null, walkStart = 0, walkDone = false;

  function fetchData() {
    if (halDataPromise) return halDataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("hal-wrap");
    halDataPromise = GU.fetchJson("data/ibn-arabi/hal.json")
      .then((data) => { halData = data; if (window.DostViewStatus) window.DostViewStatus.hide("hal-wrap"); return data; })
      .catch((err) => {
        console.error("Hâller verisi yüklenemedi / Failed to load States data", err);
        halDataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("hal-wrap", () => window.__halApp.activate());
      });
    return halDataPromise;
  }

  function buildOrderedChain(nodes) {
    const childOf = new Map();
    nodes.forEach((n) => { if (n.parent) childOf.set(n.parent, n); });
    const root = nodes.find((n) => !n.parent);
    const chain = []; let cur = root;
    while (cur) { chain.push(cur); cur = childOf.get(cur.id); }
    return chain;
  }

  // ---------------------------------------------------------------------------
  // Sarmalın SÜREKLİ parametrik tanımı. t bir tam sayı olduğunda o sıradaki
  // düğümün yerini verir; aradaki kesirli değerler yolu pürüzsüz çizmemizi ve
  // t > n-1 ile "bir üst tur"u (hayalet iz) göstermemizi sağlar.
  //
  // tilt=0: halka düz (z=0, yükseklik yok) -- eskisinin birebir aynısı.
  // tilt=1: halka yatay düzleme yatar (XZ), yükseklik Y ekseninde birikir.
  // İkisi arasında doğrusal harman: tek formül iki görünümü de veriyor.
  function helixPoint(t) {
    const n = orderedNodes.length;
    const a = -Math.PI / 2 + (t / n) * Math.PI * 2;
    const r = baseR * (0.80 + 0.24 * (t / Math.max(1, n - 1)));
    const flatY = r * Math.sin(a);
    const hStep = riseH / Math.max(1, n - 1);
    const riseY = -hStep * t + riseH / 2;
    return {
      x: r * Math.cos(a),
      y: flatY * (1 - tilt) + riseY * tilt,
      z: flatY * tilt,
    };
  }

  // esma.js'teki projeksiyonun aynısı: yaw (Y ekseni) → pitch (X ekseni) →
  // perspektif bölme. yaw/pitch yalnız tilt ile devreye girer, böylece 2B
  // görünüm hiç bozulmaz.
  function project(p) {
    const yy = yaw * tilt, pp = pitch * tilt;
    const cyw = Math.cos(yy), syw = Math.sin(yy);
    const x1 = p.x * cyw + p.z * syw;
    const z1 = -p.x * syw + p.z * cyw;
    const cpt = Math.cos(pp), spt = Math.sin(pp);
    const y2 = p.y * cpt - z1 * spt;
    const z2 = p.y * spt + z1 * cpt;
    const zc = Math.max(z2, -FOCAL * 0.85);
    const depth = FOCAL / (FOCAL + zc);
    return { x: cx + x1 * depth, y: cy + y2 * depth, depth: depth, z: z2 };
  }

  function projectT(t) { return project(helixPoint(t)); }

  // ---- Ortak oryantasyon-halkası pilotu (VISUALIZATION_IDEAS.md) ----
  // Düğme değil, yalnız bir gösterge: işaretin AÇISI yaw'ı (hangi yöne
  // dönmüşüz), merkeze UZAKLIĞI pitch'i (ne kadar yukarıdan/yandan
  // bakıyoruz) taşıyor. tilt=0'da (düz halka) yaw/pitch'in görsel bir
  // karşılığı yok, o yüzden halka tamamen soluk; sarmala eğilince belirir.
  let orientRingEl = null, orientMarkerEl = null;
  function updateOrientRing() {
    if (orientRingEl === null) {
      orientRingEl = document.getElementById("hal-orient-ring");
      orientMarkerEl = orientRingEl ? orientRingEl.querySelector(".graph-orient-ring__marker") : null;
    }
    if (!orientRingEl || !orientMarkerEl) return;
    orientRingEl.style.opacity = String(0.85 * tilt);
    const a = yaw % (Math.PI * 2);
    const pClamped = Math.max(-1.3, Math.min(1.3, pitch));
    const radiusFrac = Math.max(0.18, Math.cos(pClamped));
    const R = 7.5;
    orientMarkerEl.setAttribute("cx", String(Math.sin(a) * R * radiusFrac));
    orientMarkerEl.setAttribute("cy", String(-Math.cos(a) * R * radiusFrac));
  }

  function layout() {
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 640;
    cx = w / 2; cy = h / 2;
    baseR = Math.max(130, Math.min(w, h) / 2 - 120);
    // Toplam yükseliş, elipsin dikey salınımını (≈2·baseR·sin(pitch)) AŞMALI;
    // aksi hâlde halkanın kendi inip çıkışı yükselişi yutuyor ve yolun son
    // düğümü (Hayret) bir öncekinden aşağıda kalıyordu -- sarmal görünmüyordu.
    riseH = baseR * 2.0;
  }

  // Her karede düğümlerin ekran konumlarını tazeler (x/y/scale/depth).
  function positionNodes() {
    orderedNodes.forEach((node, i) => {
      const p = projectT(i);
      node.x = p.x; node.y = p.y; node.__depth = p.depth; node.__z = p.z;
    });
  }

  // Sürekli sarmal üzerinde t0..t1 arasını örnekleyip ekran yolu üretir.
  function samplePath(t0, t1, steps) {
    let d = "";
    for (let s = 0; s <= steps; s++) {
      const p = projectT(t0 + (t1 - t0) * (s / steps));
      d += (s === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1);
    }
    return d;
  }

  // Kiriş: iki düğümü dairenin İÇİNDEN geçen bir yayla birleştirir. Kontrol
  // noktası, iki ucun 3B orta noktasının eksene doğru çekilmiş hâli -- yani
  // yay gerçekten gövdenin içinden geçiyor, etrafından dolanmıyor.
  function chordPath(rel) {
    const a = helixPoint(rel.__si), b = helixPoint(rel.__ti);
    const p1 = project(a), p2 = project(b);
    const mid = { x: (a.x + b.x) / 2 * 0.34, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 * 0.34 };
    const pm = project(mid);
    return `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${pm.x.toFixed(1)},${pm.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  // ---------------------------------------------------------------------------
  function buildDom() {
    svg.selectAll("*").remove();
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 640;
    svg.attr("viewBox", `0 0 ${w} ${h}`).attr("preserveAspectRatio", "xMidYMid meet");

    defs = svg.append("defs");
    defs.append("marker").attr("id", "hal-arrow-return").attr("viewBox", "0 -5 10 10")
      .attr("refX", 8).attr("refY", 0).attr("markerWidth", 6.5).attr("markerHeight", 6.5)
      .attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5")
      .attr("fill", getVar("--series-hal-hayret"));
    const glow = defs.append("filter").attr("id", "hal-glow").attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
    glow.append("feGaussianBlur").attr("stdDeviation", "3.4");

    zoomLayer = svg.append("g").attr("class", "hal-canvas");
    bgLayer = zoomLayer.append("g").attr("class", "hal-bg");
    ghostLayer = zoomLayer.append("g").attr("class", "hal-ghosts");
    chordLayer = zoomLayer.append("g").attr("class", "hal-chords");
    linkLayer = zoomLayer.append("g").attr("class", "hal-links");
    glowLayer = zoomLayer.append("g").attr("class", "hal-glows");
    nodeLayer = zoomLayer.append("g").attr("class", "hal-nodes");
    walkLayer = zoomLayer.append("g").attr("class", "hal-walk-layer");

    orderedNodes.forEach((d) => {
      const c = d3.color(nodeColor(d)) || d3.color("#888");
      const rg = defs.append("radialGradient").attr("id", "hal-sphere-" + d.id).attr("cx", "38%").attr("cy", "32%").attr("r", "72%");
      rg.append("stop").attr("offset", "0%").attr("stop-color", c.brighter(1.15).formatHex());
      rg.append("stop").attr("offset", "45%").attr("stop-color", c.formatHex());
      rg.append("stop").attr("offset", "100%").attr("stop-color", c.darker(0.9).formatHex());
    });

    // 3B'de düz sürükleme sahneyi DÖNDÜRÜR (pan etmez); 2B'de eski davranış
    // aynen sürer. Ctrl/⌘+tekerlek yakınlaştırma her iki durumda da çalışır.
    zoomBehavior = GU.createZoomBehavior(svg, zoomLayer, [0.4, 3], () => tiltTarget < 0.5);
    wireRotateDrag();
    wireTiltToggle();
    wireWalkButton();

    // Odak burada kamerayı taşıyor (fitView bir odağa göre çerçeveliyor), o
    // yüzden geri çekilirken odak da bırakılıyor -- bkz. ETKILESIM_DILI.md:
    // "kaydıysa geri alınır, seçtiysen korunur".
    GU.wireRecenter("hal-recenter", () => {
      clearFocus();
      // ETKILESIM_DILI.md'nin kendi tanımı: Recenter "serbest döndürme"yi
      // de sıfırlamalı. yaw/pitch'e hiç dokunulmuyordu -- sürükleyerek
      // döndürülmüş bir sahnede Recenter yalnız kadrajı düzeltiyor, açı
      // aynı kalıyordu (UI denetimi bulgusu; menziller.js'te aynı eksiklik).
      yaw = 0; pitch = 0.62;
      fitView(true);
    });
    svg.on("click", () => { if (currentDetailNode || currentRelation) clearFocus(); });
    // Hâller'de odak ile açık panel TEK durumdur (clearFocus ikisini birden
    // bırakıyor), o yüzden bir adım geri = odağı bırak.
    if (!document.body.dataset.wiredHalEsc) {
      document.body.dataset.wiredHalEsc = "1";
      GU.registerStepBack("hal-wrap", () => {
        if (!currentDetailNode && !currentRelation) return false;
        clearFocus();
        return true;
      });
    }
  }

  // ---- 2B ↔ 3B sinematik geçiş ----
  function setTilt(target) {
    tiltFrom = tilt; tiltTarget = target; tiltAnimStart = performance.now();
    // Kendiliğinden dönme YOK: sahne sürekli dönerse hem sığdırma (fitView)
    // bayatlıyor hem etiketler okunmaz hâle geliyor. Döndürmek isteyen
    // sürükleyerek döndürür.
    if (target < 0.5) { yaw = 0; }
    ensureFrame();
    // Eğim bittikten sonra çerçeveyi yeniden sığdır (sarmal düz halkadan
    // belirgin biçimde daha uzun; aksi hâlde üst/alt uçlar dışarı taşıyor).
    setTimeout(() => { if (!wrapEl.hidden) fitView(true); }, reduceMotion ? 30 : TILT_DUR + 60);
  }
  // Açılışta doğrudan sarmala eğ: düğmenin durumunu da eşitler ki kullanıcı
  // bir sonraki tıklamada 2B'ye dönsün.
  // Animasyonsuz: 3B varsayılan olduğu için eğim morfunu kimse bilerek
  // izlemiyor, ama açılıştaki diğer işlerle (reveal, ilk sığdırma) yarışıp
  // ilk saniyeyi takıyordu. Doğrudan orada başlıyoruz.
  function openIn3D() {
    tilt = 1; tiltFrom = 1; tiltTarget = 1;
    ensureFrame();
    setTimeout(() => { if (!wrapEl.hidden) fitView(false); }, 60);
    const btn = document.getElementById("hal-3d-toggle");
    if (btn) { btn.classList.add("is-on"); btn.setAttribute("aria-pressed", "true"); }
  }

  function wireTiltToggle() {
    const btn = document.getElementById("hal-3d-toggle");
    if (!btn || btn.dataset.wiredHal3d) return;
    btn.dataset.wiredHal3d = "1";
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const to = tiltTarget > 0.5 ? 0 : 1;
      setTilt(to);
      btn.classList.toggle("is-on", to > 0.5);
      btn.setAttribute("aria-pressed", to > 0.5 ? "true" : "false");
    });
  }

  // 3B'de sürükleyerek döndürme.
  function wireRotateDrag() {
    let lastX = 0, lastY = 0;
    svgNode.addEventListener("pointerdown", (e) => {
      if (tiltTarget < 0.5) return;
      // .hal-node zaten hariç tutuluyordu; .hal-chord-g'nin (kiriş + isabet
      // şeridi) hariç tutulmaması gerçek hatanın asıl kaynağıydı -- burada
      // yakalanan HER pointerdown sahneyi döndürmeye başlıyor ve pointer'ı
      // svg'ye "capture" ediyordu (setPointerCapture), bu da bir kirişe
      // tıklamanın click olayını hiçbir zaman kirişe ulaştırmamasına yol
      // açıyordu -- CSS pointer-events sırası doğru olsa bile.
      if (e.target.closest(".hal-node") || e.target.closest(".hal-chord-g")) return;
      // menziller.js'teki aynı bulgu: preventDefault yoktu, sürükleyerek
      // döndürmek ekrandaki etiketleri tarayıcı metin-seçimi olarak
      // boyuyordu (UI denetimi). .hal-label'e user-select:none eklendi,
      // burada da menziller'deki gibi önlem alınıyor.
      e.preventDefault();
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      svgNode.setPointerCapture(e.pointerId);
    });
    svgNode.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.006;
      pitch = Math.max(-0.2, Math.min(1.25, pitch + (e.clientY - lastY) * 0.004));
      lastX = e.clientX; lastY = e.clientY;
      ensureFrame();
    });
    const stop = (e) => {
      if (!dragging) return;
      dragging = false;
      try { svgNode.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    svgNode.addEventListener("pointerup", stop);
    svgNode.addEventListener("pointercancel", stop);
  }

  // "Yolu yürü": Nefs'ten başlayıp dönüş yayının ucuna (bir üst turdaki
  // Nefs'in yerine) tek bir noktayla ilerler. Tekrar tıklamak baştan başlatır.
  function wireWalkButton() {
    const btn = document.getElementById("hal-walk-btn");
    if (!btn || btn.dataset.wiredHalWalk) return;
    btn.dataset.wiredHalWalk = "1";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      walkT = 0; walkStart = performance.now(); walkDone = false;
      btn.classList.add("is-walking");
      ensureFrame();
    });
  }

  function initShimmer() {
    shimmer = [];
    if (reduceMotion) return;
    for (let i = 0; i < 10; i++) shimmer.push({ a: Math.random() * 6.28, sp: 0.0004 + Math.random() * 0.0006, rr: 20 + Math.random() * 16, ph: Math.random() * 6.28 });
  }

  // ---------------------------------------------------------------------------
  // Not: lastTs'i BURADA sıfırlamıyoruz. ensureFrame her karenin sonunda
  // yeniden çağrıldığı için, burada sıfırlamak dt'yi kalıcı olarak 0 yapıp
  // zamana bağlı her şeyi (sakin dönüş) dondurur. Sıfırlama, döngünün
  // gerçekten durduğu tek yerde -- frame()'deki görünürlük çıkışında -- yapılır.
  function ensureFrame() { if (rafId == null) rafId = requestAnimationFrame(frame); }
  function frame(ts) {
    rafId = null;
    // Görünüm ekranda değilse döngüyü tamamen durdur (bkz. GU.isViewActive).
    if (!GU.isViewActive(wrapEl)) { lastTs = 0; return; }
    if (!startTs) startTs = ts;
    const dt = lastTs ? Math.min(64, ts - lastTs) : 16; lastTs = ts;
    if (reveal < 1 && !reduceMotion) reveal = Math.min(1, (ts - startTs) / 2000);
    else if (reduceMotion) reveal = 1;

    let active = false;
    if (tilt !== tiltTarget) {
      if (reduceMotion) tilt = tiltTarget;
      else {
        const p = Math.min(1, (ts - tiltAnimStart) / TILT_DUR);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        tilt = tiltFrom + (tiltTarget - tiltFrom) * e;
        if (p >= 1) tilt = tiltTarget; else active = true;
      }
    }
    // Sakin, huzurlu dönüş: 3B'deyken sahne kendiliğinden çok yavaş dönüyor
    // (bir tam tur ~2 dakika). Sürüklerken ve hareket kısıtlaması açıkken
    // durur. Yükseklik ekseni etrafında döndüğü için sarmal ortada kalır,
    // sığdırma bozulmaz.
    if (tilt > 0.5 && !dragging && !reduceMotion) { yaw += dt * 0.00007; active = true; }

    if (walkT !== null) {
      const n = orderedNodes.length;
      const elapsed = ts - walkStart;
      const total = WALK_DUR + WALK_HOLD + WALK_FADE;
      if (elapsed >= total) {
        walkT = null; walkDone = true;
        const btn = document.getElementById("hal-walk-btn");
        if (btn) btn.classList.remove("is-walking");
      } else {
        walkT = Math.min(n, (elapsed / WALK_DUR) * n);
      }
      active = true;
    }

    render(ts);
    if (!reduceMotion || active) ensureFrame();
  }

  function focusSet() {
    const anchor = hoveredId || (currentDetailNode ? currentDetailNode.id : null);
    if (!anchor) return null;
    const node = nodeById.get(anchor);
    if (!node) return null;
    const i = node.__i;
    const set = new Set([anchor]);
    if (i > 0) set.add(orderedNodes[i - 1].id);
    if (i < orderedNodes.length - 1) set.add(orderedNodes[i + 1].id);
    if (orderedNodes[i].stage === "hayret") set.add(orderedNodes[0].id);
    if (orderedNodes[i].stage === "nefs") set.add(orderedNodes[orderedNodes.length - 1].id);
    // Odaklanınca o hâlin kirişleri de aydınlansın -- asıl mesele bu.
    relations.forEach((r) => {
      if (r.source === anchor) set.add(r.target);
      if (r.target === anchor) set.add(r.source);
    });
    return { anchor, set };
  }

  function breath(d, ts) {
    if (reduceMotion) return { s: 1, dx: 0, dy: 0 };
    const isHay = d.stage === "hayret";
    const s = 1 + (isHay ? 0.035 : 0.02) * Math.sin(ts / (isHay ? 5200 : 3000) + d.__phase);
    const dx = 1.4 * Math.sin(ts / 3400 + d.__phase);
    const dy = 1.4 * Math.cos(ts / 3900 + d.__phase * 1.3);
    return { s, dx, dy };
  }

  function render(ts) {
    if (!nodeLayer) return;
    updateOrientRing();
    positionNodes();
    const n = orderedNodes.length;
    const foc = focusSet();

    // --- hayalet iz: sarmalın önünde ve arkasında devam ettiğini gösterir.
    //     Yalnız 3B'de görünür (2B'de halkanın üstüne binerdi). ---
    const ghosts = [
      { id: "after", d: samplePath(n - 1, n + 9, 48) },
      { id: "before", d: samplePath(-7, 0, 40) },
    ];
    const gh = ghostLayer.selectAll("path.hal-ghost").data(ghosts, (g) => g.id);
    gh.enter().append("path").attr("class", "hal-ghost").merge(gh)
      .attr("d", (g) => g.d)
      .style("stroke", getVar("--series-hal-hayret"))
      .style("stroke-width", 1.1)
      .style("opacity", 0.22 * tilt * reveal);
    gh.exit().remove();

    // --- yol segmentleri: sarmal boyunca örneklenmiş pürüzsüz eğri ---
    const segData = d3.range(n - 1);
    const segSel = linkLayer.selectAll("path.hal-seg").data(segData, (i) => i);
    segSel.enter().append("path").attr("class", "hal-seg").attr("fill", "none").merge(segSel)
      .each(function (i) {
        const s = orderedNodes[i], t = orderedNodes[i + 1];
        const major = LANDMARK.has(t.stage) && t.stage !== "nefs";
        const prog = (i + 1) / (n - 1);
        let op = 0.32 + 0.5 * prog;
        if (foc) op = (foc.set.has(s.id) && foc.set.has(t.id)) ? 0.95 : 0.08;
        const appear = Math.max(0, Math.min(1, (reveal * (n + 1) - (i + 1))));
        d3.select(this)
          .attr("d", samplePath(i, i + 1, 10))
          .style("stroke", journeyColor(i + 1))
          .style("stroke-width", major ? 3.0 : 1.6)
          .classed("hal-seg--major", major)
          .style("opacity", op * appear);
      });
    segSel.exit().remove();

    // --- dönüş yayı: Hayret'ten, Nefs'in AÇISINA ama bir tur yukarısına.
    //     tilt=0'da helixPoint(n) tam olarak Nefs'in yerine düştüğü için bu
    //     eğri 2B'de halkayı kapatır, 3B'de ise yükselir. Tek formül. ---
    const wrapSel = linkLayer.selectAll("path.hal-return").data([0]);
    wrapSel.enter().append("path").attr("class", "hal-return").attr("fill", "none")
      .attr("marker-end", "url(#hal-arrow-return)").merge(wrapSel)
      .attr("d", samplePath(n - 1, n, 14))
      .style("opacity", (foc ? 0.12 : 0.85) * (reveal >= 0.99 ? 1 : Math.max(0, reveal * 3 - 2)));

    const wrapMid = projectT(n - 0.5);
    const lblSel = linkLayer.selectAll("text.hal-return-label").data([0]);
    lblSel.enter().append("text").attr("class", "hal-return-label").attr("text-anchor", "middle").merge(lblSel)
      .attr("x", wrapMid.x).attr("y", wrapMid.y - 10)
      .style("opacity", foc ? 0.25 : 0.85 * (reveal >= 0.99 ? 1 : 0))
      .text(tt({ tr: "→ aynı hâl, bir üst turda", en: "→ same state, a turn higher", pt: "→ mesmo estado, um giro acima" }));

    // --- C3: "yolu yürü" -- Nefs'ten dönüş yayının ucuna ilerleyen nokta ---
    if (walkT !== null) {
      const elapsed = ts - walkStart;
      let op = 1;
      if (elapsed > WALK_DUR + WALK_HOLD) op = Math.max(0, 1 - (elapsed - WALK_DUR - WALK_HOLD) / WALK_FADE);
      const p = projectT(walkT);
      const trailSel = walkLayer.selectAll("path.hal-walk-trail").data([0]);
      trailSel.enter().append("path").attr("class", "hal-walk-trail").attr("fill", "none").merge(trailSel)
        .attr("d", samplePath(0, walkT, Math.max(2, Math.round(walkT * 6))))
        .style("opacity", op * 0.6);
      const dotSel = walkLayer.selectAll("circle.hal-walk-dot").data([0]);
      dotSel.enter().append("circle").attr("class", "hal-walk-dot").attr("r", 7).merge(dotSel)
        .attr("cx", p.x).attr("cy", p.y)
        .style("opacity", op);
      const n = orderedNodes.length;
      const nefsEchoOp = walkT >= n - 0.02 ? op * 0.9 : 0;
      const nefsP = projectT(n);
      const echoSel = walkLayer.selectAll("circle.hal-walk-nefs-echo").data([0]);
      echoSel.enter().append("circle").attr("class", "hal-walk-nefs-echo").attr("fill", "none").attr("r", 16).merge(echoSel)
        .attr("cx", nefsP.x).attr("cy", nefsP.y)
        .style("opacity", nefsEchoOp);
    } else {
      walkLayer.selectAll("path.hal-walk-trail, circle.hal-walk-dot, circle.hal-walk-nefs-echo").remove();
    }

    // --- kirişler: ardışık olmayan hâller arasındaki bağlar ---
    const chSel = chordLayer.selectAll("g.hal-chord-g").data(relations, (r) => r.source + ">" + r.target);
    const chEnter = chSel.enter().append("g").attr("class", "hal-chord-g");
    chEnter.append("path").attr("class", "hal-chord-hit")
      .on("pointerenter", (e, r) => { hoveredRel = r; showRelTooltip(r, e); ensureFrame(); })
      .on("pointermove", (e) => moveTooltip(e))
      .on("pointerleave", () => { hoveredRel = null; hideTooltip(); ensureFrame(); })
      .on("click", (e, r) => { e.stopPropagation(); showRelationDetail(r); });
    chEnter.append("path").attr("class", (r) => "hal-chord hal-chord--" + r.kind);
    const chMerged = chEnter.merge(chSel);
    chSel.exit().remove();
    chMerged.each(function (r) {
      const g = d3.select(this);
      const dpath = chordPath(r);
      const lit = foc && (foc.anchor === r.source || foc.anchor === r.target);
      const dim = foc && !lit;
      let op = lit ? 0.95 : (dim ? 0.05 : 0.34);
      if (hoveredRel === r) op = 1;
      if (currentRelation === r) op = 1;
      op *= reveal >= 0.99 ? 1 : Math.max(0, reveal * 2 - 1);
      g.select(".hal-chord-hit").attr("d", dpath);
      g.select(".hal-chord")
        .attr("d", dpath)
        .style("stroke", getVar(KIND_VAR[r.kind] || "--series-hal-cemfark"))
        .style("stroke-width", lit || hoveredRel === r || currentRelation === r ? 2.4 : 1.15)
        .style("opacity", op);
    });

    // --- düğümler ---
    const gsel = nodeLayer.selectAll("g.hal-node").data(orderedNodes, (d) => d.id);
    const enter = gsel.enter().append("g")
      .attr("class", (d) => "node hal-node hal-node--" + d.stage)
      .attr("tabindex", 0).attr("role", "button").attr("aria-label", (d) => labelFor(d))
      .on("click", (e, d) => { e.stopPropagation(); selectNode(d); })
      .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); selectNode(d); } })
      .on("pointerenter", (e, d) => { setHover(d.id); showTooltip(d, e); })
      .on("pointermove", (e) => moveTooltip(e))
      .on("pointerleave", () => { setHover(null); hideTooltip(); })
      .on("focus", (e, d) => { setHover(d.id); showTooltip(d, e); })
      .on("blur", () => { setHover(null); hideTooltip(); });
    enter.append("circle").attr("class", "hal-glow");
    enter.append("circle").attr("class", "hal-halo");
    enter.append("circle").attr("class", "hal-terk-ring");
    enter.append("circle").attr("class", "hal-sphere").attr("fill", (d) => `url(#hal-sphere-${d.id})`);
    enter.append("circle").attr("class", "hal-sheen");
    enter.append("text").attr("class", "hal-label").attr("text-anchor", "middle");
    const merged = enter.merge(gsel);
    gsel.exit().remove();

    // Derinlik sırası: uzaktakiler önce çizilsin (3B'de doğru örtüşme).
    if (tilt > 0.02) merged.sort((a, b) => b.__z - a.__z);

    const pendingLabels = [];
    merged.each(function (d) {
      const g = d3.select(this);
      const b = breath(d, ts);
      // 3B'de perspektif ölçeği: uzaktaki düğüm küçülür.
      const dscale = 1 + (d.__depth - 1) * tilt;
      const r = baseRadius(d) * b.s * Math.max(0.55, dscale);
      let appear = 1;
      if (reveal < 1 && !reduceMotion) {
        const thr = d.__i / (orderedNodes.length + 1);
        appear = Math.max(0, Math.min(1, (reveal - thr) / 0.12));
      }
      let op = appear;
      const isAnchor = foc && d.id === foc.anchor;
      if (foc && !foc.set.has(d.id)) op *= 0.22;
      if (tilt > 0.02) op *= Math.max(0.62, Math.min(1, d.__depth * 1.02)); // atmosfer
      g.style("opacity", op).style("display", op < 0.02 ? "none" : null)
        .attr("transform", `translate(${(d.x + b.dx).toFixed(1)},${(d.y + b.dy).toFixed(1)})`);
      g.classed("hal-node--active", currentDetailNode && d.id === currentDetailNode.id);
      const col = nodeColor(d);
      const gstr = d.stage === "hayret" ? 1 : LANDMARK.has(d.stage) ? 0.62 : 0.4;
      const flick = reduceMotion ? 1 : (0.85 + 0.15 * Math.sin(ts / 2200 + d.__phase));
      g.select(".hal-glow").attr("r", r * 1.85).style("fill", col)
        .style("opacity", (d.stage === "hayret" ? 0.32 : 0.16) * gstr * flick * (isAnchor ? 1.5 : 1));
      const halo = g.select(".hal-halo");
      if (isAnchor) {
        const puls = reduceMotion ? 1 : (1 + 0.12 * Math.sin(ts / 900));
        halo.attr("r", (r + 7) * puls).style("stroke", col).style("opacity", 0.5);
      } else halo.style("opacity", 0);
      // "Makamı ve Terki" olan düğümlerin ikinci, kesik halkası.
      const tr = g.select(".hal-terk-ring");
      if (d.terk) tr.attr("r", r + 5.5).style("stroke", col).style("stroke-width", 1.1).style("opacity", 0.75);
      else tr.style("opacity", 0);
      g.select(".hal-sphere").attr("r", r);
      g.select(".hal-sheen").attr("r", r);
      const lbl = g.select(".hal-label");
      const baseY = r + (d.stage === "hayret" ? 20 : LANDMARK.has(d.stage) ? 16 : 13);
      const txt = labelFor(d);
      lbl.attr("y", baseY)
        .classed("hal-label--landmark", LANDMARK.has(d.stage))
        .classed("hal-label--peak", d.stage === "hayret")
        .classed("hal-label--strong", isAnchor)
        .text(txt);
      // Yolun dönüm noktaları önce yerleşsin: haritanın okunur kalmasını
      // onlar sağlıyor (Hayret en önce).
      if (op >= 0.35) {
        pendingLabels.push({
          lbl, txt,
          x: d.x + b.dx, y: d.y + b.dy + baseY, baseY,
          priority: d.stage === "hayret" ? 2 : LANDMARK.has(d.stage) ? 1 : 0,
        });
      }
    });
    deconflictLabels(pendingLabels);

    // --- Hayret shimmer ---
    if (!reduceMotion && shimmer.length) {
      const hay = orderedNodes.find((x) => x.stage === "hayret");
      const b = breath(hay, ts);
      const hx = hay.x + b.dx, hy = hay.y + b.dy, hr = baseRadius(hay) * b.s;
      shimmer.forEach((p) => { p.a += p.sp * 16; });
      const sh = glowLayer.selectAll("circle.hal-shimmer").data(shimmer);
      sh.enter().append("circle").attr("class", "hal-shimmer").attr("r", 1.1).merge(sh)
        .attr("cx", (p) => (hx + (hr + p.rr) * Math.cos(p.a)).toFixed(1))
        .attr("cy", (p) => (hy + (hr + p.rr) * Math.sin(p.a)).toFixed(1))
        .style("opacity", (p) => (0.15 + 0.35 * Math.abs(Math.sin(ts / 1400 + p.ph))) * reveal);
      sh.exit().remove();
    }
  }

  // ---------------------------------------------------------------------------
  function setHover(id) { if (hoveredId === id) return; hoveredId = id; ensureFrame(); }
  function clearFocus() {
    currentDetailNode = null; currentRelation = null; hoveredId = null;
    detailPanel.hidden = true; ensureFrame();
  }

  function fitView(animate) {
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 640;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const n = orderedNodes.length;
    // Düğümlerin yanı sıra dönüş yayının tepe noktasını da kapsa.
    const pts = orderedNodes.map((d) => ({ x: d.x, y: d.y })).concat([projectT(n - 0.5), projectT(n)]);
    pts.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    // Lejant paneli grafiğin ÜSTÜNDE (sol altta) duruyor; sığdırma onu hesaba
    // katmazsa soldaki düğümler panelin arkasında kalıyor. Panel açıkken sol
    // kenara onun genişliği kadar pay bırakıyoruz.
    let leftPad = 74;
    const legendEl = document.getElementById("hal-legend");
    if (legendEl && !legendEl.classList.contains("legend--collapsed")) {
      const lr = legendEl.getBoundingClientRect();
      const sr = svgNode.getBoundingClientRect();
      if (lr.width && sr.width) leftPad = Math.max(leftPad, lr.width + 28);
    }
    x0 -= leftPad; x1 += 74; y0 -= 64; y1 += 74;
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
    const [mn, mx] = zoomBehavior.scaleExtent();
    const k = Math.max(mn, Math.min(mx, Math.min(w / bw, h / bh)));
    const t = d3.zoomIdentity.translate(w / 2 - k * (x0 + bw / 2), h / 2 - k * (y0 + bh / 2)).scale(k);
    const sel = (animate && !reduceMotion) ? svg.transition().duration(500).ease(d3.easeCubicInOut) : svg;
    sel.call(zoomBehavior.transform, t);
  }

  function showTooltip(d, event) {
    if (!tooltip) return;
    const short = I18n.pick3(d.short);
    tooltip.innerHTML = `<div class="node-hover-tip__title">${I18n.pick3(d.name)}</div>${short ? `<div class="node-hover-tip__short">${short}</div>` : ""}`;
    tooltip.hidden = false; moveTooltip(event);
  }
  function showRelTooltip(r, event) {
    if (!tooltip) return;
    const s = nodeById.get(r.source), t = nodeById.get(r.target);
    if (!s || !t) return;
    // 2026-08-03'e kadar burada yalnız ilişkinin TÜRÜ yazıyordu ("yankı",
    // "karşıtlık"…) -- yani ne olduğu, neden öyle okuduğumuz değil (#10).
    tooltip.innerHTML = GU.edgeReasonHtml({
      title: `${I18n.pick3(s.name)} ↔ ${I18n.pick3(t.name)}`,
      kindLabel: tt(KIND_LABEL[r.kind] || {}),
      reason: I18n.pick3(r.note),
    });
    tooltip.hidden = false; moveTooltip(event);
  }
  function moveTooltip(event) { GU.moveTooltip(tooltip, wrapEl, event); }
  function hideTooltip() { GU.hideTooltip(tooltip); }

  // --- Detay paneli ---
  function insightsHtml(insights, excludeId) {
    if (!insights || !insights.length) return "";
    return `<div class="insight-group">${insights.map((ins, i) => `
      <details class="insight" ${i === 0 ? "open" : ""}>
        <summary>${I18n.pick3(ins.label)}</summary>
        <p>${linkify(I18n.pick3(ins.text), "hal", excludeId)}</p>
        <cite>${ins.cite}</cite>
      </details>`).join("")}</div>`;
  }
  function relatedStepsHtml(d) {
    const idx = d.__i, rows = [];
    if (idx > 0) rows.push({ other: orderedNodes[idx - 1], arrow: "←" });
    if (idx < orderedNodes.length - 1) rows.push({ other: orderedNodes[idx + 1], arrow: "→" });
    if (!rows.length) return "";
    const items = rows.map(({ other, arrow }) => `
      <div class="detail-block detail-block--edge">
        <h3>${arrow} ${I18n.pick3(other.name)}</h3>
        <p>${I18n.pick3(other.short)}</p>
      </div>`).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Basamak Sırası", en: "Sequence", pt: "Sequência" })}</p>${items}`;
  }
  // Bir hâlin, sırayla komşu OLMAYAN hâllerle bağları -- bu görünümün asıl
  // yeni bilgisi. Her biri kaynağıyla birlikte gösteriliyor.
  function chordsHtml(d) {
    const mine = relations.filter((r) => r.source === d.id || r.target === d.id);
    if (!mine.length) return "";
    const items = mine.map((r) => {
      const otherId = r.source === d.id ? r.target : r.source;
      const other = nodeById.get(otherId);
      if (!other) return "";
      return `
      <div class="detail-block detail-block--edge">
        <h3>↔ ${I18n.pick3(other.name)}</h3>
        <p class="detail-eyebrow">${tt(KIND_LABEL[r.kind] || {})}</p>
        <p>${linkify(tt(r.note), "hal", d.id)}</p>
        <cite>${r.cite}</cite>
      </div>`;
    }).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Sıradan Taşan Bağlar", en: "Bonds beyond the sequence", pt: "Vínculos além da sequência" })}</p>${items}`;
  }
  function terkHtml(d) {
    if (!d.terk) return "";
    return `<div class="detail-analogy"><p class="detail-analogy__label">${tt({ tr: "Makamı ve terki", en: "The station and its abandonment", pt: "A estação e seu abandono" })}</p><p>${tt(TERK_NOTE)}</p></div>`;
  }
  // Ortak: graph-utils.js (dört görünümde kopyalanmıştı).
  const analogyHtml = (a) => GU.analogyHtml(a);
  function showDetail(d) {
    currentDetailNode = d; currentRelation = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Hâller", en: "States", pt: "Estados" })}</p>
      <h2 class="detail-title">${I18n.pick3(d.name)}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${I18n.pick3(d.short)}</h3>
        <p>${linkify(I18n.pick3(d.summary), "hal", d.id)}</p>
      </div>
      ${analogyHtml(d.analogy)}
      ${terkHtml(d)}
      ${insightsHtml(d.insights, d.id)}
      ${chordsHtml(d)}
      ${relatedStepsHtml(d)}`;
    detailPanel.hidden = false;
    ensureFrame();
  }
  function showRelationDetail(r) {
    const s = nodeById.get(r.source), t = nodeById.get(r.target);
    if (!s || !t) return;
    currentRelation = r; currentDetailNode = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Sıradan Taşan Bağ", en: "A bond beyond the sequence", pt: "Um vínculo além da sequência" })}</p>
      <h2 class="detail-title">${I18n.pick3(s.name)} ↔ ${I18n.pick3(t.name)}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${tt(KIND_LABEL[r.kind] || {})}</h3>
        <p>${linkify(tt(r.note), "hal", null)}</p>
        <cite>${r.cite}</cite>
      </div>`;
    detailPanel.hidden = false;
    ensureFrame();
  }

  function selectNode(d) {
    showDetail(d);
    window.__dostNav && window.__dostNav.setHash("hal", d.id);
  }

  // ---------------------------------------------------------------------------
  function buildGraph(data) {
    orderedNodes = buildOrderedChain(data.nodes);
    nodeById = new Map(orderedNodes.map((n) => [n.id, n]));
    orderedNodes.forEach((n, i) => { n.__i = i; n.__phase = i * 0.7; });
    // Kirişler: uçları gerçekten var olan ve ARDIŞIK OLMAYAN bağlar (ardışık
    // olanlar zaten yol çizgisiyle görünüyor, ikinci kez çizmek gürültü olur).
    relations = (data.relations || []).filter((r) => {
      const s = nodeById.get(r.source), t = nodeById.get(r.target);
      if (!s || !t) { console.warn("Hâller: kiriş ucu bulunamadı", r); return false; }
      r.__si = s.__i; r.__ti = t.__i;
      return Math.abs(r.__si - r.__ti) > 1;
    });
    buildColorScale(orderedNodes.length);
    layout();
    buildDom();
    initShimmer();
    built = true;
    reveal = reduceMotion ? 1 : 0;
    startTs = 0;
    render(performance.now());
    fitView(false);
    // Varsayılan görünüm 3B (kullanıcı kararı, 2026-07-26): bu haritanın asıl
    // söylediği şey yolun YÜKSELMESİ; düz halka onu göstermiyor. Düğmeyle
    // istendiğinde 2B'ye dönülebiliyor.
    openIn3D();
    ensureFrame();
    window.addEventListener("resize", GU.debounceResize(onResize));
  }

  function onResize() {
    if (!built || wrapEl.hidden) return;
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 640;
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    layout();
    render(performance.now());
    fitView(false);
  }

  function render_relabel() {
    if (!built) return;
    buildColorScale(orderedNodes.length);
    render(performance.now());
    if (currentDetailNode) showDetail(currentDetailNode);
    else if (currentRelation) showRelationDetail(currentRelation);
  }

  // Sekme arkaya alınıp geri gelindiğinde döngü yeniden uyansın.
  GU.onViewWake(() => { if (built && !wrapEl.hidden) ensureFrame(); });

  window.__halApp = {
    activate() { fetchData().then((data) => { if (!data) return; if (!built) buildGraph(data); else ensureFrame(); }); },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        if (!built) buildGraph(data);
        const target = nodeById.get(id);
        if (target) selectNode(target);
      });
    },
    onLangChange() { render_relabel(); },
  };
})();
