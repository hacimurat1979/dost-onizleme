(function () {
  "use strict";

  // ============================================================================
  // Sorular — "keşfedilen bir mana evreni"
  //
  // Klasik bir network graph değil; anlam katmanları arasında yolculuk hissi
  // veren, sakin ve derinlikli bir bilgi haritası. Işıyan küre düğümler, düşük
  // opaklıkta organik bezier bağlantılar, çok hafif bir atmosfer katmanı
  // (radyal ışık + yavaş süzülen parçacıklar), üstüne gelince açılan mini bilgi
  // kartı, odak modu. Salt vanilla D3 (yeni bağımlılık yok — bkz. CLAUDE.md).
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

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)
  function getVar(n) { return GU.getVar(n); }

  // Sitede üç ayrı "soru" görünümü var (Sorular/Bilmiyoruz/Açık Sorular) --
  // isim benzerliği ("soru" üçünde de geçiyor) kafa karıştırabiliyor
  // (kullanıcı bulgusu, 2026-08-09). Veriyi birleştirmek yanlış olurdu
  // (üçü kasıtlı olarak farklı şeyler -- SSS / metnin sınırı / bizim
  // araştırma günlüğümüz), o yüzden küçük bir çözüm: her görünümün giriş
  // panelinde diğer ikisine giden, aralarındaki farkı bir cümleyle
  // açıklayan bir yönlendirme.
  function soruAilesiNavHtml(buradaki) {
    const base = window.__dostRouteBase || "";
    const AILE = {
      sorular: { view: "sorular", href: "/sorular", baslik: { tr: "Sorular", en: "Questions", pt: "Perguntas" }, aciklama: { tr: "okuyucuya cevap veren bir SSS", en: "an FAQ that answers the reader", pt: "um FAQ que responde ao leitor" } },
      bilmiyoruz: { view: "bilmiyoruz", href: "/bilmiyoruz", baslik: { tr: "Bilmiyoruz", en: "We Don't Know", pt: "Não Sabemos" }, aciklama: { tr: "metnin kendi çözülmemiş noktaları -- biz sormuyoruz, sınırı o gösteriyor", en: "the text's own unresolved points -- not our question, its own limit", pt: "os próprios pontos não resolvidos do texto" } },
      "acik-sorular": { view: "acik-sorular", href: "/acik-sorular", baslik: { tr: "Açık Sorular", en: "Open Questions", pt: "Perguntas em Aberto" }, aciklama: { tr: "bizim okurken kapanmayan sorularımız", en: "our own questions that don't close as we read", pt: "as nossas perguntas que não se fecham" } },
    };
    const digerleri = Object.keys(AILE).filter((k) => k !== buradaki);
    const linkler = digerleri.map((k) => {
      const a = AILE[k];
      return `<a class="soru-ailesi-nav__link" href="${base}${a.href}" data-view="${a.view}">
        <strong>${tt(a.baslik)}</strong><span>${tt(a.aciklama)}</span>
      </a>`;
    }).join("");
    return `<div class="soru-ailesi-nav">
      <p class="soru-ailesi-nav__baslik">${tt({ tr: "Sitede üç ayrı “soru” görünümü var, birbirinin yerine geçmiyor:", en: "The site has three separate “question” views, not interchangeable:", pt: "O site tem três vistas de “pergunta” diferentes, não intercambiáveis:" })}</p>
      ${linkler}
    </div>`;
  }
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
      // Sırlar grafiğindeki mute()'la aynı doygunluk/açıklık bandı (2026-08-04
      // kullanıcı bildirimi: Sorular sitenin genel duruşundan "farklı
      // renklerde" duruyordu -- ölçülen fark: burada 0.55, Sırlar'da 0.38).
      const s = 0.38;
      const l = GU.isDark() ? Math.min(0.68, Math.max(0.55, l0)) : Math.min(0.6, Math.max(0.45, l0));
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
  let dragging = false;
  let bgParticles = [], edgeParticles = [];
  let flashId = null, flashStart = 0;

  // ---------------------------------------------------------------------------
  // SORU NEHRİ (2026-08-09) — ikinci bir görünüm modu, aynı veriyi (qNodes +
  // relLinks) farklı okuyor. Kategori-sarmalı yerine `sorularData.relations`
  // (38 elle kurulmuş, gerekçeli soru→soru bağı) bir akış olarak gösteriliyor.
  // Katman-yerleşimi klasik bir DAG "layering" (Sugiyama'nın ilk adımı):
  // her bağlantılı bileşen kendi ırmağı, katman = o bileşendeki köklerden
  // en uzun yol. Bileşenler kesin ayrı tutuluyor -- veri TEK bir kaynaktan
  // çıkan tek bir nehir olduğunu iddia etmiyor, biz de görselde uydurmuyoruz.
  let viewMode = "evren";
  const RIVER_LEFT_PAD = 90, RIVER_LAYER_GAP = 190, RIVER_NODE_GAP = 74, RIVER_BAND_GAP = 48;
  let riverContentW = 0, riverContentH = 0, riverBuilt = false;

  function buildRiverLayout() {
    if (riverBuilt) return;
    riverBuilt = true;
    const adj = new Map(qNodes.map((n) => [n.id, []]));
    relLinks.forEach((r) => { adj.get(r.from).push(r.to); adj.get(r.to).push(r.from); });

    // Bağlantılı bileşenler (undirected BFS) -- ilişkisi olmayan sorular
    // kendi bileşenine değil, ayrı bir "kaynaksız" kümeye düşer.
    const compOf = new Map();
    const comps = [];
    qNodes.forEach((n) => {
      if (compOf.has(n.id) || !adj.get(n.id).length) return;
      const stack = [n.id], comp = [];
      while (stack.length) {
        const x = stack.pop();
        if (compOf.has(x)) continue;
        compOf.set(x, comps.length);
        comp.push(x);
        adj.get(x).forEach((y) => { if (!compOf.has(y)) stack.push(y); });
      }
      comps.push(comp);
    });
    const compNodes = comps.map((ids) => ids.map((id) => qNodes.find((n) => n.id === id)));

    // Katman = bileşen içindeki en uzun yol (Kahn topolojik sırayla ilerleyen
    // gevşetme) -- iki soru arasında birden fazla yol varsa en derin olanı
    // kazanır, akış hep ileri doğru okunsun diye.
    const outEdges = new Map(qNodes.map((n) => [n.id, []]));
    relLinks.forEach((r) => outEdges.get(r.from).push(r.to));
    compNodes.forEach((comp) => {
      const ids = new Set(comp.map((n) => n.id));
      const localIndeg = new Map(comp.map((n) => [n.id, 0]));
      relLinks.forEach((r) => { if (ids.has(r.from) && ids.has(r.to)) localIndeg.set(r.to, localIndeg.get(r.to) + 1); });
      let queue = comp.filter((n) => localIndeg.get(n.id) === 0).map((n) => n.id);
      // Döngü varsa (beklenmiyor ama savunma amaçlı) rastgele bir başlangıç seç.
      if (!queue.length) queue = [comp[0].id];
      const layer = new Map(queue.map((id) => [id, 0]));
      let guard = 0;
      while (queue.length && guard++ < 4000) {
        const cur = queue.shift();
        const curLayer = layer.get(cur);
        outEdges.get(cur).forEach((nxt) => {
          if (!ids.has(nxt)) return;
          if (!layer.has(nxt) || layer.get(nxt) < curLayer + 1) { layer.set(nxt, curLayer + 1); queue.push(nxt); }
        });
      }
      comp.forEach((n) => { n.riverLayer = layer.has(n.id) ? layer.get(n.id) : 0; });
    });

    // En temel sorunun bileşeni en üstteki (ana) ırmak; kalanlar boyuna göre.
    compNodes.sort((a, b) => {
      const aHas = a.some((n) => n.category.id === CENTER_CAT), bHas = b.some((n) => n.category.id === CENTER_CAT);
      if (aHas !== bHas) return aHas ? -1 : 1;
      return b.length - a.length;
    });

    let bandY = 0, maxLayer = 0;
    compNodes.forEach((comp) => {
      const byLayer = new Map();
      comp.forEach((n) => {
        maxLayer = Math.max(maxLayer, n.riverLayer);
        if (!byLayer.has(n.riverLayer)) byLayer.set(n.riverLayer, []);
        byLayer.get(n.riverLayer).push(n);
      });
      const rows = Math.max(...Array.from(byLayer.values()).map((a) => a.length));
      byLayer.forEach((arr) => {
        arr.forEach((n, i) => {
          n.rx = RIVER_LEFT_PAD + n.riverLayer * RIVER_LAYER_GAP;
          n.ry = bandY + (i + 0.5) * RIVER_NODE_GAP + Math.max(0, (rows - arr.length) / 2) * RIVER_NODE_GAP;
        });
      });
      bandY += rows * RIVER_NODE_GAP + RIVER_BAND_GAP;
    });

    // İlişkisi hiç olmayan sorular -- akışın parçası değiller, bunu gizlemek
    // yerine ayrı, adı konmuş küçük bir "kaynaksız sorular" şeridinde duruyorlar.
    const isolated = qNodes.filter((n) => !adj.get(n.id).length);
    isolated.forEach((n, i) => {
      n.riverLayer = 0;
      n.rx = RIVER_LEFT_PAD;
      n.ry = bandY + (i + 0.5) * RIVER_NODE_GAP;
    });
    bandY += isolated.length * RIVER_NODE_GAP;

    riverContentH = bandY;
    riverContentW = RIVER_LEFT_PAD + (maxLayer + 1) * RIVER_LAYER_GAP;
  }

  // source/target BURADA elle çözülüyor -- Evren modunda bu işi
  // d3.forceLink(links).id(...) simülasyonu kurarken kendiliğinden yapıyor
  // (string id'yi gerçek düğüm nesnesine çeviriyor); Nehir'de simülasyon hiç
  // kurulmadığı için (yerleşim zaten sabit) aynı çözümlemeyi burada elle
  // yapmak gerekiyor -- yoksa render()'daki nx_(l.source) gibi çağrılar bir
  // string üzerinde .x arayıp sessizce NaN üretirdi.
  function riverLinks() {
    return relLinks.map((r) => Object.assign({}, r, {
      id: "riv:" + r.from + ">" + r.to, kind: "river",
      source: nodeById.get(r.from), target: nodeById.get(r.to),
    })).filter((l) => l.source && l.target);
  }

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

    // plainWheelZooms (2026-08-09, kullanıcı isteği): bu görünümün altında
    // kaydıracak bir "sayfa" yok -- tam ekran bir harita, o yüzden ctrl/cmd
    // gerektirmeden düz tekerlekle yakınlaştırma serbest (bkz. graph-utils.js
    // içindeki gerekçe). Sorular'ın kendi ETKILESIM_DILI.md kaydı yok çünkü
    // esma/eser-agi'deki gibi düz tekerleğe BAŞKA bir anlam yüklenmiyor --
    // burada yalnız site geneli varsayılanın (ctrl+tekerlek) gevşetilmesi.
    zoomBehavior = GU.createZoomBehavior(svg, zoomLayer, [0.4, 3], (event) => !event.target.closest(".node"), { plainWheelZooms: true });
    svgNode.addEventListener("wheel", () => { setTimeout(() => { currentK = d3.zoomTransform(svgNode).k; }, 0); }, { passive: true });

    // 2026-08-03'e kadar bu düğme showAllQuestionsList() çağırıyordu -- yani
    // ESC ile BİREBİR aynı işi yapıyordu (açık kategoriyi kapat, paneli
    // listeye döndür). O zaman "geri çekilmek" fiilinin Sorular'da kendine
    // ait bir anlamı kalmıyordu. Sözleşmeye göre (ETKILESIM_DILI.md) burada
    // yalnız BAKIŞ sıfırlanır: açık kategori ve açık panel kullanıcının
    // seçimidir, korunur; çerçeve o seçime göre yeniden kurulur.
    GU.wireRecenter("sorular-recenter", () => fitView(true));
    if (backBtn) { backBtn.hidden = !currentDetailQuestion && !expandedCatId; backBtn.onclick = () => showAllQuestionsList(); }
    // Boşluğa tıklamak: önce odağı bırakır, sonra açık kategoriyi kapatır.
    // toggleCategory()'nin aynı kapatma yolunda yaptığı gibi panel de
    // listeye dönmeli -- eskiden yalnız grafik kapanıyordu, panel eski
    // kategori listesini göstermeye devam ediyordu (UI denetimi bulgusu:
    // grafikte artık karşılığı olmayan bir içerik).
    svg.on("click", () => {
      if (focusId) { clearFocus(); return; }
      if (expandedCatId) { collapseCategory(true); showAllQuestionsList(true); }
    });

  }

  // 2026-07-27: Yüzey/Derin/Tam süzgeci kullanıcı isteğiyle kaldırıldı.
  // Gerekçe: sorular zaten kategori açılınca geliyordu; üstteki üç düğme
  // hem sayfanın geri kalanında karşılığı olmayan bir kontroldü hem de
  // "hangi soru daha yüzeysel" gibi, bizim veremeyeceğimiz bir hükmü
  // arayüze yazıyordu. Skor hesabı (`surfaceScore`/`depth`) veride kaldı
  // ama artık hiçbir şeyi gizlemiyor.
  //
  // 2026-08-01: sağ alttaki minimap de kaldırıldı (kullanıcı notu: "grafiğin
  // sağ alt kısmındaki gezinme karesini kaldıralım") -- buildMinimap/
  // mmBounds/updateMinimap ve .sorular-minimap CSS'i bununla birlikte
  // silindi.

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

  // Nehir kenarları klasik akış-diyagramı eğrisi (Sankey/org-chart tarzı):
  // kontrol noktaları YATAY eksende, düğümün kenarından çıkıp kenarına giren
  // dik bir eğri değil, suyun kendi kendine bulduğu yumuşak bir S. Evren
  // modunun dikine bükülen bezier'i burada anlamsız kalırdı (akış yönü hep
  // soldan sağa, dikey sapma yalnız kat farkından geliyor).
  function riverPathCoords(l) {
    const s = l.source, t = l.target;
    const sr = radiusFor(s) + 2, tr = radiusFor(t) + 2;
    const sx = nx_(s) + sr, sy = ny_(s), ex = nx_(t) - tr, ey = ny_(t);
    const midx = (sx + ex) / 2;
    return { sx, sy, ex, ey, midx };
  }
  function linkPath(l) {
    if (l.kind === "river") {
      const { sx, sy, ex, ey, midx } = riverPathCoords(l);
      return `M${sx.toFixed(1)},${sy.toFixed(1)} C${midx.toFixed(1)},${sy.toFixed(1)} ${midx.toFixed(1)},${ey.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
    }
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
    if (l.kind === "river") {
      const { sx, sy, ex, ey, midx } = riverPathCoords(l);
      const mu = 1 - u;
      const x = mu * mu * mu * sx + 3 * mu * mu * u * midx + 3 * mu * u * u * midx + u * u * u * ex;
      const y = mu * mu * mu * sy + 3 * mu * mu * u * sy + 3 * mu * u * u * ey + u * u * u * ey;
      return [x, y];
    }
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
  // rAF döngü iskeleti artık GU.createFrameLoop'ta (bkz. graph-utils.js
  // yorumu -- burada ensureFrame() lastTs'i performance.now() ile SIFIRLIYORDU
  // ve frame() sürekli-aktifken (simActive/dragging) kendi kendini bu
  // fonksiyonla sürdürdüğü için, her karede dt neredeyse 0'a çöküyordu --
  // yani sürükleme/simülasyon fiziği HER ZAMAN olması gerekenden çok daha
  // yavaş çalışıyordu, kimse fark etmemiş olabilir çünkü "çalışıyor" gibi
  // görünüyordu, sadece belirgin şekilde ağır. Ortak yardımcı bunu düzeltir.
  const frameLoop = GU.createFrameLoop(wrapEl, function (ts, dt) {
    if (tilt3d) tilt3d.step(ts, dt, !expandedCatId);
    if (!reduceMotion) {
      bgParticles.forEach((p) => { p.a += p.sp * dt; });
      edgeParticles.forEach((p) => { p.t += p.sp * (dt / 1000); if (p.t > 1) p.t -= 1; });
    }
    render(ts);
    const simActive = simulation && simulation.alpha() > 0.006;
    return !reduceMotion || simActive || dragging;
  });
  function ensureFrame() { frameLoop.ensureFrame(); }

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

    // --- kategori halkası (yalnız Evren'de -- Nehir'in kendi ekseni var) ---
    ringLayer.select("path.sorular-ring-path").attr("d", viewMode === "nehir" ? "" : spiralPath());
    // Sarmalın merkezindeki nefes alan işaret de Evren'e ait -- Nehir'de
    // eski cx/cy'de asılı kalan, akışla ilgisiz bir daire olurdu.
    if (centerLayer) centerLayer.style("display", viewMode === "nehir" ? "none" : null);

    // --- bağlantılar (bezier, düşük opaklık) (#3) ---
    const lk = linkLayer.selectAll("path.sorular-link").data(links, (l) => l.id);
    const lkEnter = lk.enter().append("path").attr("class", "sorular-link").attr("fill", "none");
    // K-01/K-03 (uzman paneli denetimi 2026-08-17): ilişki kenarları
    // klavye/ekran-okuyucuya tamamen kapalıydı. Yalnız ANLAM taşıyan kenarlar
    // (rel: soru-soru ilişkisi, bridge: kolun öteki ucundaki ilişki işareti)
    // açılıyor -- stem/river yapısal süs, onları odak sırasına koymak 48
    // soruluk sahnede klavye kullanıcısını boğardı. Enter, bağın soru ucunu
    // açıyor (kenarın taşıdığı eylem bu).
    const soruUcAdi = (n) => n && n.question ? I18n.pick3(n.question)
      : (n && n.name ? I18n.pick3(n.name) : (n && n.category ? I18n.pick3(n.category.name) : ""));
    GU.wireEdgeAccessibility(lkEnter.filter((l) => l.kind === "rel" || l.kind === "bridge"), {
      label: (l) => {
        const not = l.note ? " — " + I18n.pick3(l.note) : "";
        return soruUcAdi(l.source) + " ↔ " + soruUcAdi(l.target) + not;
      },
      onActivate: (l) => {
        const hedef = l.target && l.target.question ? l.target : l.source;
        if (hedef && hedef.question) openQuestion(hedef);
      },
    });
    lkEnter.merge(lk)
      .each(function (l) {
        const p = d3.select(this);
        const dv = true;
        let op = 0.16;
        const bothActive = act && act.set.has(l.source.id) && act.set.has(l.target.id);
        if (l.kind === "river") {
          // Nehir'in kanalları hover beklemeden kendi renginde akıyor --
          // bir su kütlesi hover'da "belirmiyor", zaten oradaydı.
          op = act ? (bothActive ? 0.85 : 0.12) : 0.4;
        } else if (act) op = bothActive ? 0.8 : 0.05;
        // Kategoriler arası "köprü" kenarı kesikli çiziliyor: doğrudan bir
        // soru-soru ilişkisi değil, "bu ilişkinin öteki ucu şu kolda"
        // işareti (bkz. activeLinks()'teki bridges).
        if (l.kind === "bridge") op = act ? op : 0.13;
        p.attr("d", linkPath(l))
          .classed("sorular-link--bridge", l.kind === "bridge")
          .classed("sorular-link--river", l.kind === "river")
          .classed("sorular-link--active", bothActive)
          .style("stroke", l.kind === "river" ? catColor(l.source) : (bothActive ? catColor(l.source) : null))
          .style("opacity", op * (dv ? 1 : 0.25));
      });
    lk.exit().remove();

    // --- ışık akışı (#3): Evren'de yalnız aktif (üzerine gelinen) bağlarda,
    // Nehir'de İSE her zaman -- bir nehir hover beklemez, sürekli akar
    // (kullanıcının isteği: "sakin, şiirsel, çok yavaş"). Nehir'deki ambiyans
    // parçacıkları hover'dakinden daha soluk (.sorular-flow--ambient).
    if (!reduceMotion && (act || viewMode === "nehir")) {
      const vis = act
        ? edgeParticles.filter((p) => act.set.has(p.l.source.id) && act.set.has(p.l.target.id))
        : edgeParticles;
      const ps = particleLayer.selectAll("circle.sorular-flow").data(vis, (d) => d.l.id);
      ps.enter().append("circle").attr("class", "sorular-flow").attr("r", 1.6).merge(ps)
        .classed("sorular-flow--ambient", (p) => !act)
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

    const pending = [];   // görünür etiketler; çakışma çözümü döngüden sonra
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
      // 3B perspektif ölçeği: uzaktaki düğüm küçülür, öndeki büyür. 0.7
      // çarpanı olmadan öndeki düğümler aşırı şişiyordu (kullanıcı notu
      // 2026-08-01: "çok büyük, sanki çok önde gibi").
      if (tilt3d && tilt3d.value > 0.02) scale *= Math.max(0.6, 1 + ((d.__depth == null ? 1 : d.__depth) - 1) * tilt3d.value * 0.7);
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
      // Nehir'de bloom/kademeli açılım yok -- 48 soru da hep sahnede, o yüzden
      // etiketler de hep açık (aksi hâlde harita "boş noktalar" gibi görünür,
      // akışın nereye gittiği okunmaz).
      const showLabel = viewMode === "nehir" || d.isCat || inOpenArm || isHover || isActive || currentK >= 1.15 || (act && act.set.has(d.id));
      // Açılan koldaki soruların etiketi merkezden DIŞARI bakan tarafa yazılır;
      // yoksa iki sıralı yelpazede dış sıranın etiketi iç sıranın üstüne düşüyor.
      const labelY = inOpenArm && (d.y - cy) < 0 ? -(r + 7) : r + 13;
      const txt = d.isCat ? I18n.pick3(d.category.name) : labelFor(d.question, inOpenArm ? 20 : (viewMode === "nehir" ? 22 : 30));
      lbl.attr("y", labelY).style("display", showLabel ? null : "none")
        .classed("sorular-label--strong", isHover || isActive)
        .classed("sorular-label--cat", !!d.isCat)
        .text(txt);
      if (showLabel && op >= 0.35) {
        pending.push({ lbl, txt, priority: d.isCat ? 1 : 0,
                       x: nx_(d) + dx, y: ny_(d) + dy + labelY, baseY: labelY });
      }
    });
    deconflictLabels(pending);
  }

  // Etiket çakışması: 3B eğimde ve bir kol açıkken düğümler ekranda birbirine
  // yaklaşıyor, etiketler üst üste biniyordu. Motor artık graph-utils.js'te
  // ortak (2026-07-31: /hal/ de aynı kusuru taşıyordu, ikisi tek yerden
  // besleniyor). Denenip tutmayan iki tahmin yöntemi orada kayıtlı.
  const deconflictLabels = GU.createLabelDeconflictor();

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
    // 2026-08-09 (kullanıcı geri bildirimi: Nehir'de düğümler/yazılar çok
    // küçük geliyordu). Evren'de içerik zaten kapsayıcıya yakın boyutta,
    // WIDTH+HEIGHT'ın küçüğüne sığdırmak sorun değil. Nehir dokuz ayrı akış
    // üst üste dizildiği için dikeyde çok uzun olabiliyor -- YÜKSEKLİĞE göre
    // sığdırmak hepsini göstermeye çalışıp her şeyi küçültüyordu. Artık düz
    // tekerlek zaten yakınlaştırıyor ve sürükleyerek dikey gezinilebiliyor,
    // o yüzden Nehir'de yalnız GENİŞLİĞE sığdırıp (okuma yönü soldan sağa)
    // altta bir taban ölçek koyuyoruz -- kalan akışlar sürüklenerek görülür.
    let k;
    if (viewMode === "nehir") {
      k = Math.max(mn, Math.min(mx, Math.max(vw / bw, 0.85)));
    } else {
      k = Math.max(mn, Math.min(mx, Math.min(vw / bw, height / bh)));
    }
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
  // Ortak: graph-utils.js (dört görünümde kopyalanmıştı).
  const analogyHtml = (a) => GU.analogyHtml(a);
  function crossLinkHtml(q) {
    if (!q.link) return "";
    const view = q.link.view, id = q.link.id;
    const base = window.__dostRouteBase || "";
    const href = id ? `${base}/${view}/${id}` : `${base}/${view}`;
    const label = q.linkLabel ? I18n.pick3(q.linkLabel) : tt({ tr: "Devamını oku", en: "Read more", pt: "Ler mais" });
    return `<a class="cross-link sorular-readmore" href="${href}" data-view="${view}"${id ? ` data-id="${id}"` : ""}>${label} →</a>`;
  }
  function sourceHtml(q) { return q.source ? `<cite class="sorular-source">${q.source}</cite>` : ""; }

  // Bir sorunun ayrı, oynanabilir bir sahnesi olabilir (terimler.js'deki
  // TERIM_SAHNELERI ile aynı sözleşme: detail-gate--sahne).
  // 2026-08-15 @revise: tek örnek olan "İnandığın Tanrı" (ilah-i-mutekad.html)
  // sahnesi kullanıcı isteğiyle kaldırıldı; sorunun kendi cevabı sayfada
  // kalıyor, yalnız "Sahneyi aç" düğmesi gitti.
  const SORU_SAHNELERI = {};

  function soruSahneHtml(id) {
    const s = SORU_SAHNELERI[id];
    if (!s) return "";
    const base = window.__dostRouteBase || "";
    return `<div class="detail-gate detail-gate--sahne">
      <p class="detail-gate__note">${I18n.pick3(s.not)}</p>
      <a class="detail-gate__btn" href="${base}/${s.dosya}">${I18n.pick3(s.dugme)}<span class="detail-gate__arrow" aria-hidden="true">→</span></a>
    </div>`;
  }

  // SIRLAR KÖPRÜSÜ (2026-08-03). Sırlar ve Sorular sitenin iki "kapanmamış"
  // defteri ama hiçbir yerde bağlı değillerdi. Bağlar ELLE kuruldu
  // (data/ibn-arabi/sirlar-sorular.json) ve her birinin yanında NEDEN öyle
  // okuduğumuz yazılı -- bir ölçüm ya da kelime eşleşmesi değil.
  // Bir bağ "bu sır şu soruyu cevaplıyor" demek DEĞİL; çoğu zaman tam
  // tersine, sorunun neden kapanmadığını gösteriyor.
  let koprü = null, sirBaslik = new Map();
  function koprüYukle() {
    if (koprü) return Promise.resolve(koprü);
    return Promise.all([
      GU.fetchJson("data/ibn-arabi/sirlar-sorular.json"),
      GU.fetchJson("data/ibn-arabi/sirlar.json"),
    ]).then(([k, sir]) => {
      koprü = k;
      (sir.entries || []).forEach((e) => sirBaslik.set(e.id, e.topic));
      return k;
    }).catch(() => null);
  }
  function sirlarHtml(q) {
    if (!koprü) return "";
    const bag = (koprü.baglar || []).filter((b) => b.soru === q.id);
    if (!bag.length) return "";
    const base = window.__dostRouteBase || "";
    const satir = bag.map((b) => {
      const baslik = sirBaslik.get(b.sir);
      if (!baslik) return "";
      return `<a class="sorular-sir" href="${base}/sirlar/${b.sir}" data-view="sirlar" data-id="${b.sir}">
        <span class="sorular-sir__baslik">${I18n.pick3(baslik)}</span>
        <span class="sorular-sir__neden">${I18n.pick3(b.neden)}</span></a>`;
    }).join("");
    if (!satir) return "";
    return `<div class="sorular-sirlar">
      <p class="detail-eyebrow detail-eyebrow--section">${tt({
        tr: "Bu soruya dokunan sırlar",
        en: "Mysteries that touch this question",
        pt: "Mistérios que tocam esta pergunta" })}</p>
      <p class="sorular-sirlar__not">${tt({
        tr: "Bu bağları biz kurduk; cevap değil, sorunun neden kapanmadığına dair birer işaret olarak okuyoruz.",
        en: "We made these links ourselves; we read them not as answers but as signs of why the question does not close.",
        pt: "Fizemos estes vínculos nós mesmos; lemo-los não como respostas, mas como sinais de por que a pergunta não se fecha." })}</p>
      ${satir}</div>`;
  }
  function relationNote(r) { return r && r.note ? I18n.pick3(r.note) : ""; }
  // 2026-08-09 (Soru Nehri): relations[] zaten YÖNLÜ (from→to, gerekçeli) --
  // eskiden bu yön atılıp tek bir "İlişkili Sorular" listesinde
  // düzleştiriliyordu. Artık "nereden geliyor / nereye götürüyor" ayrı ayrı
  // gösteriliyor; bu hem Nehir'in kendi mantığı hem Evren'de de gerçek bir
  // iyileştirme (aynı veri, daha dürüst bir okuma).
  function relatedQuestionsHtml(q) {
    const gelen = (sorularData.relations || []).filter((r) => r.to === q.id);
    const giden = (sorularData.relations || []).filter((r) => r.from === q.id);
    if (!gelen.length && !giden.length) return "";
    const row = (r, otherId) => {
      const entry = questionIndex.get(otherId); if (!entry) return "";
      return `<button class="sorular-question-row sorular-question-row--related" type="button" data-id="${otherId}">
        <span><span class="sorular-related__q">${I18n.pick3(entry.question.question)}</span>
        <span class="sorular-related__note">${relationNote(r)}</span></span>
        <span class="sorular-question-row__arrow" aria-hidden="true">→</span></button>`;
    };
    const onceRows = gelen.map((r) => row(r, r.from)).join("");
    const sonraRows = giden.map((r) => row(r, r.to)).join("");
    let html = "";
    if (onceRows) html += `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Bu soru nereden geliyor?", en: "Where does this question come from?", pt: "De onde vem esta pergunta?" })}</p><div class="sorular-question-list">${onceRows}</div>`;
    if (sonraRows) html += `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Bu soru nereye götürüyor?", en: "Where does this question lead?", pt: "Para onde leva esta pergunta?" })}</p><div class="sorular-question-list">${sonraRows}</div>`;
    return html;
  }

  // --- Görünüm modu: Evren (sarmal) / Nehir (akış) ---------------------------
  // Nehir'in kendi yerleşimi zaten sabit (buildRiverLayout) -- force
  // simülasyonuna ihtiyacı yok, yalnız rx/ry'yi x/y'ye kopyalayıp sabitliyor.
  // tilt3d'yi 0'a çekmek `positionNodes()`'un px/py'yi x/y'yle birebir aynı
  // hesaplamasını sağlıyor (bkz. graph-utils.js: project(...,tilt<0.001) ==
  // identity) -- akış sakin ve DÜZ kalsın diye (kullanıcının isteği: "çok
  // yavaş hareket eden bir yapı", 3B eğim burada anlam taşımıyor).
  function wireModeToggle() {
    const btn = document.getElementById("sorular-nehir-toggle");
    if (!btn || btn.dataset.wiredNehir) return;
    btn.dataset.wiredNehir = "1";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setViewMode(viewMode === "evren" ? "nehir" : "evren");
    });
  }

  function setViewMode(mode) {
    if (viewMode === mode) return;
    viewMode = mode;
    const nehirBtn = document.getElementById("sorular-nehir-toggle");
    const tiltBtn = document.getElementById("sorular-3d-toggle");
    if (nehirBtn) { nehirBtn.classList.toggle("is-on", mode === "nehir"); nehirBtn.setAttribute("aria-pressed", mode === "nehir" ? "true" : "false"); }
    expandedCatId = null; currentDetailQuestion = null; focusId = null;
    if (backBtn) backBtn.hidden = true;
    if (mode === "nehir") {
      qNodes.forEach((n) => { n.x = n.rx; n.y = n.ry; n.fx = n.rx; n.fy = n.ry; n.px = n.rx; n.py = n.ry; });
      if (tilt3d) tilt3d.set(0, true);
      if (tiltBtn) tiltBtn.hidden = true;
    } else {
      qNodes.forEach((n) => { n.fx = null; n.fy = null; });
      if (tilt3d) tilt3d.set(1, true);
      if (tiltBtn) tiltBtn.hidden = false;
    }
    // rebuildScene ÖNCE: nodes/links yeni moda göre kurulmadan
    // showAllQuestionsList() çağrılırsa, onun kendi fitView() çağrısı hâlâ
    // ESKİ moddaki nodes dizisine göre sığdırır -- bir anlık yanlış kadraj.
    rebuildScene(true);
    showAllQuestionsList(true);
  }

  // --- Kademeli açılım: kategori aç / kapat ----------------------------------
  function rebuildScene(animate) {
    if (viewMode === "nehir") {
      if (simulation) { simulation.stop(); simulation = null; }
      nodes = qNodes;
      links = riverLinks();
      initEdgeParticles();
    } else {
      buildSim();
    }
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

  function showAllQuestionsList(keepScene, openPanel) {
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
      ${introBlock}${soruAilesiNavHtml("sorular")}${sections}`;
    wireQuestionRows();
    if (openPanel !== false) detailPanel.hidden = false;
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
    // Nehir'de "kol" diye bir şey yok -- 48 soru da zaten sahnede -- bu dalı
    // hiç almadan doğrudan pan/panel'e geçiyoruz. (Bir kez atlandı: bu dal
    // alınırsa expandCategory() expandedCatId'yi doldurur, render()'daki
    // "backgrounded" bulanıklaştırması TÜM diğer düğümleri Nehir'de de
    // bulanıklaştırırdı -- kategori-kol mantığı orada anlamsız.)
    if (viewMode !== "nehir" && entry && expandedCatId !== entry.category.id) {
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
      ${analogyHtml(q.analogy)}${soruSahneHtml(q.id)}${crossLinkHtml(q)}${sirlarHtml(q)}${relatedQuestionsHtml(q)}`;
    detailContent.querySelector(".sorular-back-link").addEventListener("click", () => showAllQuestionsList());
    // Köprü verisi geç gelirse paneli tazele -- ilk açılışta bağlar
    // görünmeden kalmasın.
    if (!koprü) koprüYukle().then((k) => {
      if (k && currentDetailQuestion === q) showQuestionDetail(q);
    });
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
    buildRiverLayout();
    buildDom();
    wireModeToggle();
    layoutSeed();
    buildSim();
    initAtmosphere();
    dropH3d = ringR * 1.6;
    // pitch 0.3 -> 0.42: sahnenin 3B olduğu ilk bakışta anlaşılmıyordu
    // (kullanıcı notu 2026-07-27); daha açık bir eğim derinliği görünür
    // kılıyor. spinRate zaten çok yavaş -- "huzurlu dönüş" istenen bu.
    // 0.42 -> 0.34: bu sefer ters yönde bir not geldi (2026-08-01: "çok
    // büyük geliyor, sanki çok önde gibi") -- derinlik hâlâ diğer
    // görünümlerin (0.26) üstünde ve fark ediliyor, ama öndeki düğümler
    // artık bu kadar şişmiyor (bkz. aşağıdaki 0.7 çarpanı, paintPositions).
    tilt3d = GU.createTilt({ focal: 2600, pitch: 0.34, spinRate: 0.00005 });
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
    window.addEventListener("resize", GU.debounceResize(onResize));
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

  // Bir adım geri: açık soru ya da açık kategori varsa bütün-liste hâline
  // dön. (Recenter'dan 2026-08-03'te ayrıştı: o yalnız çerçeveyi kuruyor.)
  GU.registerStepBack("sorular-wrap", () => {
    if (!currentDetailQuestion && !expandedCatId) return false;
    showAllQuestionsList();
    return true;
  });

  // sürükleme sırasında rAF sürsün
  svgNode.addEventListener("pointerdown", () => { dragging = true; ensureFrame(); });
  window.addEventListener("pointerup", () => { dragging = false; });

  // Sekme arkaya alınıp geri gelindiğinde döngü yeniden uyansın.
  GU.onViewWake(() => { if (!wrapEl.hidden) ensureFrame(); });

  // 2026-08-17 (uzman paneli denetimi, O-01/F4 devamı -- Dalga 2.5): soru
  // grafiği dar ekranda okunmuyor. Kategoriler veri yüklenmeden bilinmediği
  // için Esmâ'daki gibi groupBy kullanılıyor; başlık haritası extractNodes
  // sırasında dolduruluyor (groupsHtml extractNodes'tan SONRA çalışır).
  const mobilKategoriBaslik = new Map();
  const sorularMobilListe = GU.createMobileListFallback({
    wrapEl: document.getElementById("sorular-wrap"),
    listEl: document.getElementById("sorular-mobil-liste"),
    fetchUrl: "data/ibn-arabi/sorular.json",
    extractNodes: (d) => {
      const out = [];
      (d.categories || []).forEach((cat) => {
        mobilKategoriBaslik.set(cat.id, cat.name);
        (cat.questions || []).forEach((q) => {
          out.push({ id: q.id, name: q.question, __cat: cat.id });
        });
      });
      return out;
    },
    groupBy: (n) => n.__cat,
    groupTitle: (catId) => mobilKategoriBaslik.get(catId) || null,
    title: { tr: "Sorular", en: "Questions", pt: "Perguntas" },
    note: {
      tr: "Grafiği okumak için ekran dar geldi — sorular burada kümeleriyle listede. Bir soruya dokun, cevabı oku.",
      en: "The graph does not fit this narrow screen — the questions are here as a list, with their clusters. Tap a question to read its answer.",
      pt: "O grafo não cabe neste ecrã estreito — as perguntas estão aqui como lista, com os seus grupos. Toque numa pergunta para ler a resposta.",
    },
    graphButtonLabel: {
      tr: "Haritayı aç (grafiği göster)",
      en: "Open the map (show the graph)",
      pt: "Abrir o mapa (mostrar o grafo)",
    },
    goTo: (id) => window.__sorularApp.goToNode(id),
  });

  window.__sorularApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        if (!catNodes.length) { buildGraph(data); showAllQuestionsList(true, false); }
        else ensureFrame();
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        if (!catNodes.length) buildGraph(data);
        if (questionIndex.has(id)) { const node = nodeById.get(id); if (node) openQuestion(node); else showQuestionDetail(questionIndex.get(id).question); }
        // id'siz derin bağlantıda (/sorular/) panel eskiden her zaman
        // açılıyordu; mobil liste aktifken (Dalga 2.5) bu panel listenin
        // üstünü örtüyor ve ilk dokunuşu yutuyordu (Puppeteer ile ölçüldü:
        // satır tıklaması panele gidiyordu). Liste görünürken panel
        // açılmadan içerik hazırlanıyor; masaüstü davranışı değişmedi.
        else {
          const mobilListeAktif = window.matchMedia("(max-width: 640px)").matches
            && !wrapEl.classList.contains("grafik-acik");
          showAllQuestionsList(undefined, !mobilListeAktif);
        }
      });
    },
    onLangChange() {
      relabel();
      if (sorularMobilListe) sorularMobilListe.onLangChange();
    },
  };
})();
