(function () {
  "use strict";

  // ============================================================================
  // Esmâü'l-Hüsnâ — ilerlemeli-açılım (progressive disclosure) haritası
  //
  // Bu görünüm, İbn Arabî'nin varlık anlayışını bir "tecellî" (manifestation)
  // hareketi olarak okumaya çalışır: her şey Zât'tan Allah ismine, oradan
  // kutuplara (Celâl/Cemâl/Kemâl) ve isimlere doğru açılır -- ama hepsi bir
  // anda değil. İlk açılışta yalnız merkez (Zât + Allah + üç kutup) görünür;
  // derinlik, kullanıcı istedikçe (kaydırma / seçim) katman katman belirir.
  // Amaç ilk kez gelen birini 99 düğümle boğmamak, "anlamaya çalışan" sakin
  // bir giriş sunmaktır (bkz. CLAUDE.md kökensel duruş).
  //
  // TEK SAHNE, İKİ UÇ: Her düğümün bir düzlem konumu (bx,by) ve bir derinlik-z
  // değeri (bz) vardır. `tilt` ∈ [0,1] parametresi 0'da sahneyi düz (2B) tutar,
  // 1'de perspektifle eğerek 3B'ye çevirir -- yani "2B↔3B sinematik geçiş"
  // sadece tilt'i 0→1 yumuşatmaktır. Three.js/WebGL YOK: eski esma-3d.js'in
  // elle yaw/pitch/perspektif projeksiyonu bu tek motorda birleştirildi.
  // ============================================================================

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const svg = d3.select("#esma-graph");
  const svgNode = svg.node();
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const wrapEl = document.getElementById("esma-wrap");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tt(dict) { return I18n.pick3(dict || {}); }
  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }
  function getVar(n) { return GU.getVar(n); }
  function isDark() { return GU.isDark(); }

  // ---------------------------------------------------------------------------
  // 1) Detay paneli içerik üreticileri -- eski esma.js'ten korunan, olgun kısım.
  //    Basit tooltip yerine "bağlamsal bilgi paneli": anlam + ilişkiler +
  //    kategori (kutup) + tamamlayıcı isimler + metin referansları.
  // ---------------------------------------------------------------------------
  const relationDiagramRenderers = {
    nested: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 260 190" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node--accent" cx="130" cy="100" r="78"/>
        <text class="term-diagram-label" x="130" y="34" text-anchor="middle">${tt(d.outer)}</text>
        <circle class="term-diagram-node--dashed" cx="130" cy="112" r="34"/>
        <text class="term-diagram-label term-diagram-label--small" x="130" y="117" text-anchor="middle">${tt(d.inner)}</text>
      </svg>`,
    "split-disc": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 240 160" role="img" aria-label="${tt(d.note)}">
        <path class="term-diagram-node--accent" d="M120,20 A70,70 0 0,0 120,160 Z"/>
        <path class="term-diagram-node--dashed" d="M120,20 A70,70 0 0,1 120,160 Z"/>
        <text class="term-diagram-label" x="88" y="94" text-anchor="middle">${tt(d.left)}</text>
        <text class="term-diagram-label" x="152" y="94" text-anchor="middle">${tt(d.right)}</text>
      </svg>`,
  };
  function relationDiagramHtml(r) {
    const renderer = r.diagram && relationDiagramRenderers[r.diagram.type];
    if (!renderer) return "";
    return `<div class="term-diagram-row"><div class="term-diagram-card">
      ${renderer(r.diagram)}
      <p class="term-diagram-caption">${tt(r.diagram.note)}</p>
    </div></div>`;
  }

  const RELATION_TYPE_META = {
    tecelli: { label: { tr: "Tecellî", en: "Self-disclosure", pt: "Autorrevelação" }, directional: true },
    "ayni-sinif": { label: { tr: "Aynı Sınıf", en: "Same Class", pt: "Mesma Classe" }, directional: false },
    zid: { label: { tr: "Zıt Kutup", en: "Opposite Pole", pt: "Polo Oposto" }, directional: false },
    sebep: { label: { tr: "Sebep — Sonuç", en: "Cause — Effect", pt: "Causa — Efeito" }, directional: true },
    parca: { label: { tr: "Parça — Bütün", en: "Part — Whole", pt: "Parte — Todo" }, directional: false },
    ayni: { label: { tr: "Aynıdır (Özdeş)", en: "Identical", pt: "Idêntico" }, directional: false },
    temsil: { label: { tr: "Temsil Eder", en: "Represents", pt: "Representa" }, directional: false },
    mertebe: { label: { tr: "Mertebe (Derece)", en: "Rank (Degree)", pt: "Grau (Posição)" }, directional: true },
    kapsar: { label: { tr: "Kapsar (İçerir)", en: "Contains", pt: "Contém" }, directional: true },
  };
  function relationTypeBadgeHtml(r) {
    const meta = RELATION_TYPE_META[r.type];
    if (!meta) return "";
    return `<span class="pole-badge pole-badge--relation pole-badge--relation-${r.type}">${tt(meta.label)}</span>`;
  }

  const POLE_LABEL = {
    celal: { tr: "Celâl", en: "Jalal", pt: "Jalal" },
    cemal: { tr: "Cemâl", en: "Jamal", pt: "Jamal" },
    kemal: { tr: "Kemâl", en: "Kamal", pt: "Kamal" },
    neutral: { tr: "Grup", en: "Group", pt: "Grupo" },
  };

  const VOLUME_LABEL_OVERRIDE = {
    "izutsu-anahtar": { tr: "Anahtar-Kavramlar (İzutsu)", en: "Key Concepts (Izutsu)", pt: "Conceitos-Chave (Izutsu)" },
  };
  const VOLUME_SOURCE_MATCH = {
    "izutsu-anahtar": "İbn Arabî'nin Fusûsu'ndaki Anahtar-Kavramlar (Toshihiko İzutsu",
  };
  function volumeLabel(v) {
    if (VOLUME_LABEL_OVERRIDE[v]) return tt(VOLUME_LABEL_OVERRIDE[v]);
    return tt({ tr: `Fütûhât, Cilt ${v}`, en: `Futuhat, Volume ${v}`, pt: `Futuhat, Volume ${v}` });
  }
  function sourcesForInsight(ins, sources) {
    if (ins.source) return [ins.source];
    if (!sources || !sources.length) return [];
    const v = ins.volume;
    if (typeof v === "number") return sources.filter((s) => new RegExp(`Cilt ${v}\\b`).test(s));
    if (VOLUME_SOURCE_MATCH[v]) return sources.filter((s) => s.includes(VOLUME_SOURCE_MATCH[v]));
    return [];
  }
  function insightsHtml(insights, sources, excludeId) {
    if (!insights || !insights.length) return "";
    return `<div class="insight-group">${insights.map((ins, i) => {
      const cite = sourcesForInsight(ins, sources);
      return `<details class="insight" ${i === 0 ? "open" : ""}>
        <summary>${volumeLabel(ins.volume)}</summary>
        <p>${linkify(tt(ins.text), "esma", excludeId)}</p>
        ${cite.length ? `<cite>${cite.join(" · ")}</cite>` : ""}
      </details>`;
    }).join("")}</div>`;
  }
  function analogyHtml(analogy) {
    if (!analogy) return "";
    return `<div class="detail-analogy">
      <p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p>
      <p>${tt(analogy)}</p>
    </div>`;
  }

  // ---------------------------------------------------------------------------
  // 2) Veri + sahne kurulumu
  // ---------------------------------------------------------------------------
  let esmaData = null, esmaDataPromise = null;
  let built = false;

  // sceneNode: { id, raw, kind, pole, depthA (Allah'a mertebe uzaklığı),
  //   parentId (çizilen ebeveyn), childIds, level (hangi açılım katmanında
  //   belirir), importance, radius, bx,by,bz, offx,offy (etki alanı ötelemesi),
  //   vis (0..1 anlık görünürlük), visTarget, + her karede projeksiyon alanları }
  const nodes = [];            // tüm sceneNode'lar
  const byId = new Map();      // id -> sceneNode
  const rawById = new Map();   // id -> ham JSON düğümü
  let edges = [];              // { from, to } çizilen kenarlar (ebeveyn-çocuk + kümeler)
  let relations = [];          // 6 çapraz ilişki (ham)
  const POLES = ["celal", "cemal", "kemal"];
  const CLUSTER_POLE_OF = { celal: "celal", cemal: "cemal", kemal: "kemal", neutral: "kemal" };

  // "İmam" isimler -- İbn Arabî'nin metninde diğerlerini kapsayan/onlara
  // öncelik eden isimler; kavramsal önem puanına küçük bir katkı verir.
  const IMAM = new Set(["rahman", "rahim", "rab", "veli", "hayy", "alim", "murid", "mutekellim", "kadir", "melik", "kuddus", "hak"]);

  const CLUSTER_META = {
    celal: {
      name: { tr: "Celâl — Yücelik", en: "Jalal — Majesty", pt: "Jalal — Majestade" },
      short: { tr: "Kahır, azamet ve aşkınlık isimleri", en: "Names of severity, majesty and transcendence", pt: "Nomes de severidade, majestade e transcendência" },
      summary: {
        tr: "Celâl kutbu, Hakk'ın yüceliğini, kahrını ve kuldan uzaklığını (tenzih) dile getiren isimleri toplar — el-Kahhâr, el-Azîz, el-Müntakim gibi. İbn Arabî'ye göre Celâl hiçbir zaman çıplak tecelli etmez; her azamet, bir Cemâl'in (yakınlık, rahmet) içinden gelir.",
        en: "The pole of Majesty gathers the Names that voice God's loftiness, severity and remoteness from the servant (transcendence) — al-Qahhar, al-'Aziz, al-Muntaqim. For Ibn Arabi, Majesty never discloses itself bare; every act of severity comes clothed in a Beauty (nearness, mercy).",
        pt: "O polo da Majestade reúne os Nomes que expressam a altivez, a severidade e a distância de Deus em relação ao servo (transcendência) — al-Qahhar, al-'Aziz, al-Muntaqim. Para Ibn Arabi, a Majestade nunca se revela nua; todo ato de severidade vem revestido de uma Beleza (proximidade, misericórdia)."
      },
      analogy: { tr: "Gökgürültüsü gibi: sesi korkutur ama getirdiği yağmur rahmettir.", en: "Like thunder: its sound frightens, yet the rain it brings is mercy.", pt: "Como o trovão: seu som assusta, mas a chuva que traz é misericórdia." }
    },
    cemal: {
      name: { tr: "Cemâl — Güzellik", en: "Jamal — Beauty", pt: "Jamal — Beleza" },
      short: { tr: "Rahmet, yakınlık ve lütuf isimleri", en: "Names of mercy, nearness and grace", pt: "Nomes de misericórdia, proximidade e graça" },
      summary: {
        tr: "Cemâl kutbu, Hakk'ın güzelliğini, yakınlığını ve kula lütfunu (teşbih) dile getiren isimleri toplar — er-Rahmân, el-Latîf, el-Vedûd gibi. Cemâl, Celâl'i kuşatan daha geniş dairedir: her tecelli önce bir güzellik olarak gelir.",
        en: "The pole of Beauty gathers the Names that voice God's beauty, nearness and grace toward the servant (immanence) — ar-Rahman, al-Latif, al-Wadud. Beauty is the wider circle enclosing Majesty: every self-disclosure arrives first as a beauty.",
        pt: "O polo da Beleza reúne os Nomes que expressam a beleza, a proximidade e a graça de Deus para com o servo (imanência) — ar-Rahman, al-Latif, al-Wadud. A Beleza é o círculo mais amplo que envolve a Majestade: toda autorrevelação chega primeiro como uma beleza."
      },
      analogy: { tr: "Şafak gibi: karanlığı dağıtan ilk ışık her zaman yumuşaktır.", en: "Like dawn: the first light that scatters the dark is always gentle.", pt: "Como a aurora: a primeira luz que dispersa a escuridão é sempre suave." }
    },
    kemal: {
      name: { tr: "Kemâl — Kemâl (İkisi Birden)", en: "Kamal — Perfection (Both at Once)", pt: "Kamal — Perfeição (Ambos ao Mesmo Tempo)" },
      short: { tr: "Celâl ile Cemâl'i birleştiren isimler", en: "Names uniting Majesty and Beauty", pt: "Nomes que unem Majestade e Beleza" },
      summary: {
        tr: "Kemâl kutbu, Celâl ile Cemâl'i bir arada taşıyan, ikisinin ötesinde bir bütünlüğe işaret eden isimleri toplar — Allah, el-Melik, el-Kuddûs gibi; ayrıca isimlerin sınıflandırıldığı grup başlıkları (Zâtî/Nispetî/Fiilî) da bu kutupta durur. Kemâl, kemâl (tamlık): zıtları bir arada tutabilme.",
        en: "The pole of Perfection gathers the Names that carry Majesty and Beauty together, pointing to a wholeness beyond both — Allah, al-Malik, al-Quddus; the classifying group-headings (Names of the Essence / of relation / of act) also rest here. Kamal is completeness: the capacity to hold opposites at once.",
        pt: "O polo da Perfeição reúne os Nomes que carregam Majestade e Beleza juntas, apontando para uma totalidade além de ambas — Allah, al-Malik, al-Quddus; os títulos de grupo classificadores (Nomes da Essência / de relação / de ato) também repousam aqui. Kamal é completude: a capacidade de sustentar opostos ao mesmo tempo."
      },
      analogy: { tr: "Berzah gibi: iki denizi ayıran ama ikisine de ait olan ince çizgi.", en: "Like a barzakh: the fine line that separates two seas yet belongs to both.", pt: "Como um barzakh: a linha fina que separa dois mares e pertence a ambos." }
    }
  };

  function fetchData() {
    if (esmaDataPromise) return esmaDataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("esma-wrap");
    esmaDataPromise = GU.fetchJson("data/ibn-arabi/esma.json")
      .then((data) => {
        esmaData = data;
        if (window.DostViewStatus) window.DostViewStatus.hide("esma-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Esmâ verisi yüklenemedi / Failed to load Esma data", err);
        esmaDataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("esma-wrap", () => window.__esmaApp.activate());
      });
    return esmaDataPromise;
  }

  function trueChildren(id) {
    return (esmaData.nodes || []).filter((n) => n.parent === id);
  }

  // Her düğümün önemini merkeziyet (Allah'a yakınlık), bağ sayısı (çocuk +
  // ilişki) ve kavramsal ağırlıktan (imam isimler) türetiyoruz -- sabit,
  // elle atanmış boyutlar yerine (kullanıcının isteği #11). 0..1 arası puan
  // sonra yarıçapa ölçekleniyor.
  function computeImportance(raw, depthA, childCount, relCount) {
    let s = 0.18;
    s += 0.16 * Math.min(childCount, 6) / 6;
    s += 0.12 * Math.min(relCount, 4) / 4;
    s += 0.20 * Math.max(0, 1 - (depthA - 1) / 5); // Allah'a yakınlık
    if (IMAM.has(raw.id)) s += 0.14;
    return Math.max(0.15, Math.min(0.72, s));
  }

  function radiusFromImportance(kind, importance) {
    // Zât, Allah'ın bile ötesindeki Kaynak'tır ("her isimlendirmenin
    // ötesinde") -- haritada Allah'tan daha küçük görünmesi bu hiyerarşiyle
    // çelişiyordu; şimdi en büyük düğüm Zât.
    if (kind === "zat") return 52;
    if (kind === "allah") return 44;
    if (kind === "cluster") return 25;
    return 6 + importance * 20; // 8.7 .. 20.4
  }

  function prepareScene(data) {
    nodes.length = 0; byId.clear(); rawById.clear(); edges = [];
    (data.nodes || []).forEach((n) => rawById.set(n.id, n));
    relations = (data.relations || []).slice();

    const relCountOf = new Map();
    relations.forEach((r) => {
      relCountOf.set(r.from, (relCountOf.get(r.from) || 0) + 1);
      relCountOf.set(r.to, (relCountOf.get(r.to) || 0) + 1);
    });

    function add(node) { nodes.push(node); byId.set(node.id, node); return node; }

    const zatRaw = rawById.get("zat");
    const allahRaw = rawById.get("allah");

    // Zât -- kaynak (haritanın merkezinin hemen üstünde, "her isimlendirmenin
    // ötesinde"). Allah -- merkez, bütün isimleri toplayan İsm-i Âzam.
    add({ id: "zat", raw: zatRaw, kind: "zat", pole: "neutral", depthA: 0, parentId: null, childIds: ["allah"], level: 0, importance: 1 });
    add({ id: "allah", raw: allahRaw, kind: "allah", pole: "kemal", depthA: 0, parentId: "zat", childIds: [], level: 0, importance: 1 });

    // Üç kutup kümesi (sentetik) -- Allah ile isimler arasına giren katman.
    POLES.forEach((p) => {
      add({
        id: "cluster-" + p, raw: { id: "cluster-" + p, pole: p, name: CLUSTER_META[p].name, short: CLUSTER_META[p].short, summary: CLUSTER_META[p].summary, analogy: CLUSTER_META[p].analogy, insights: [], sources: [] },
        kind: "cluster", pole: p, depthA: 1, parentId: "allah", childIds: [], level: 0, importance: 0.7,
      });
    });

    // Bütün isimler (Zât/Allah dışındaki her ham düğüm) sahneye. depth-2
    // isimler kutup kümelerine, daha derinler kendi gerçek ebeveynlerine bağlı.
    (data.nodes || []).forEach((raw) => {
      if (raw.id === "zat" || raw.id === "allah") return;
      const kids = trueChildren(raw.id);
      const depthA = Math.max(1, raw.depth - 1);
      const importance = computeImportance(raw, depthA, kids.length, relCountOf.get(raw.id) || 0);
      let parentId, level;
      if (raw.depth === 2) {
        parentId = "cluster-" + CLUSTER_POLE_OF[raw.pole || "neutral"];
        level = 1;
      } else {
        parentId = raw.parent; // gerçek ebeveyn (bir depth-2 isim ya da grup başlığı)
        level = 2;
      }
      add({ id: raw.id, raw, kind: "name", pole: raw.pole || "neutral", depthA: depthA + 1, parentId, childIds: [], level, importance });
    });

    // childIds + edges (çizilen ebeveyn-çocuk kenarları)
    nodes.forEach((n) => {
      if (n.parentId && byId.has(n.parentId)) {
        byId.get(n.parentId).childIds.push(n.id);
        edges.push({ from: n.parentId, to: n.id });
      }
    });

    // Yarıçaplar
    nodes.forEach((n) => { n.radius = radiusFromImportance(n.kind, n.importance); n.offx = 0; n.offy = 0; n.vis = 0; n.visTarget = 0; });

    layout();
  }

  // ---------------------------------------------------------------------------
  // 3) Düzen (radyal, tam yapı bir kez hesaplanır; açılım = görünürlük)
  // ---------------------------------------------------------------------------
  const Z_STEP = 96;   // derinlik başına z (uzaklaşma)
  const FOCAL = 1000;

  let R_CLUSTER = 210, R_NAME = 430, R_NAME2 = 560, R_TAIL = 96;

  // Kutup kümeleri Allah'ın çevresinde dengeli bir üçgen (mandala) oluşturur --
  // bkz. CLAUDE.md "daire ve merkez" ilkesi. Tepe (saat 12) Zât'a ayrılır;
  // Celâl üst-sağ, Cemâl üst-sol, Kemâl altta (ikisini bütünleyen).
  const CLUSTER_ANGLE = { celal: Math.PI / 3, cemal: Math.PI * (5 / 3), kemal: Math.PI };

  function polar(angle, radius) {
    // angle: 0 = yukarı (saat 12), saat yönünde artar.
    const a = angle - Math.PI / 2;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  }

  function layout() {
    const w = svgNode.clientWidth || 900;
    const h = svgNode.clientHeight || 620;
    const minDim = Math.min(w, h);
    R_CLUSTER = minDim * 0.26;
    R_NAME = minDim * 0.50;
    R_NAME2 = minDim * 0.66;
    R_TAIL = minDim * 0.11;
    const zatDist = minDim * 0.34;

    const allah = byId.get("allah");
    allah.bx = 0; allah.by = 0; allah.bz = 0;
    const zat = byId.get("zat");
    [zat.bx, zat.by] = polar(0, zatDist); zat.bz = 0;

    // Kümeler
    POLES.forEach((p) => {
      const c = byId.get("cluster-" + p);
      [c.bx, c.by] = polar(CLUSTER_ANGLE[p], R_CLUSTER);
      c.bz = Z_STEP;
      c.angle = CLUSTER_ANGLE[p];
    });

    // Kümeye bağlı isimler (level 1): kümenin açısı çevresinde bir yaya dağıt.
    POLES.forEach((p) => {
      const c = byId.get("cluster-" + p);
      const members = c.childIds.map((id) => byId.get(id)).filter(Boolean)
        .sort((a, b) => b.importance - a.importance);
      const n = members.length;
      // Kalabalık kutuplar iki yaya bölünüyor (iç/dış) ki açısal sıkışma azalsın.
      const twoRings = n > 14;
      const spanBase = Math.min(Math.PI * 0.92, 0.34 + n * 0.055);
      members.forEach((m, i) => {
        const ring = twoRings ? (i % 2) : 0;
        const idxInRing = twoRings ? Math.floor(i / 2) : i;
        const countInRing = twoRings ? Math.ceil((n - ring) / 2) : n;
        const span = spanBase;
        const t = countInRing <= 1 ? 0.5 : idxInRing / (countInRing - 1);
        const ang = c.angle - span / 2 + t * span;
        const rad = ring === 0 ? R_NAME : R_NAME2;
        [m.bx, m.by] = polar(ang, rad);
        m.bz = Z_STEP * 2;
        m.angle = ang;
        m._radial = rad;
      });
    });

    // Daha derin isimler (level 2, depth>=3): gerçek ebeveynlerinden dışa doğru
    // küçük bir yelpaze/spiral. Ebeveyn zaten yerleşmiş olmalı; derinliğe göre
    // birden çok geçiş yapıyoruz.
    let remaining = nodes.filter((n) => n.kind === "name" && n.raw.depth >= 3);
    let guard = 0;
    while (remaining.length && guard++ < 12) {
      const next = [];
      remaining.forEach((m) => {
        const par = byId.get(m.parentId);
        if (!par || par.bx === undefined) { next.push(m); return; }
        const sibs = par.childIds.map((id) => byId.get(id)).filter((x) => x && x.raw.depth >= 3);
        const k = sibs.indexOf(m);
        const parAngle = par.angle !== undefined ? par.angle : Math.atan2(par.bx, -par.by) + Math.PI / 2;
        const spread = Math.min(0.5, 0.12 * Math.max(1, sibs.length));
        const ang = parAngle - spread / 2 + (sibs.length <= 1 ? spread / 2 : (k / (sibs.length - 1)) * spread);
        const parRad = Math.hypot(par.bx, par.by);
        const rad = parRad + R_TAIL;
        [m.bx, m.by] = polar(ang, rad);
        m.bz = Z_STEP * (m.depthA);
        m.angle = ang;
      });
      if (next.length === remaining.length) break;
      remaining = next;
    }

    applyRevealTargets();
  }

  // ---------------------------------------------------------------------------
  // 4) Açılım (reveal) katmanları -- kaydırma bunları değiştirir
  // ---------------------------------------------------------------------------
  const MAX_LEVEL = 2;
  let revealLevel = 0;

  function applyRevealTargets() {
    nodes.forEach((n) => { n.visTarget = n.level <= revealLevel ? 1 : 0; });
    // Kaydırma katman değiştirdiğinde kamerayı görünür kümeye göre çerçevele
    // (derine indikçe geriye açılır) -- "yakınlaştırma" değil "derinlik" hissi.
    if (!selectedId) fitVisible();
  }

  // Görünür düğümleri (2B taban konumlarına göre) çerçeveye sığdır; hiçbir
  // şey kırpılmasın, alt-sol lejanta olabildiğince az girsin.
  function fitVisible() {
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 620;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, any = false;
    nodes.forEach((n) => {
      if (n.visTarget > 0.5 && n.bx !== undefined) {
        any = true;
        const r = n.radius + 18; // etiket payı
        minx = Math.min(minx, n.bx - r); maxx = Math.max(maxx, n.bx + r);
        miny = Math.min(miny, n.by - r); maxy = Math.max(maxy, n.by + r);
      }
    });
    if (!any) return;
    const bw = Math.max(1, maxx - minx), bh = Math.max(1, maxy - miny);
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const s = Math.max(0.32, Math.min(1.35, Math.min(w / bw, h / bh) * 0.82));
    zoomTarget = s;
    panTargetX = -cx * s;
    panTargetY = -cy * s - h * 0.02; // içeriği hafifçe yukarı al (alt marj)
  }

  function setRevealLevel(lv, opts) {
    lv = Math.max(0, Math.min(MAX_LEVEL, lv));
    if (lv === revealLevel && !(opts && opts.force)) return;
    revealLevel = lv;
    applyRevealTargets();
    updateRevealIndicator();
    ensureFrame();
  }

  // ---------------------------------------------------------------------------
  // 5) Projeksiyon + render döngüsü
  // ---------------------------------------------------------------------------
  let tilt = 0, tiltTarget = 0, tiltAnimStart = 0, tiltFrom = 0;
  let yaw = 0, pitch = -0.42;         // pitch yalnız tilt ile devreye girer
  let zoom = 1.08, zoomTarget = 1.08;
  let panX = 0, panY = 0, panTargetX = 0, panTargetY = 0;
  const TILT_DUR = 1050;

  function project(n) {
    const x0 = n.bx + n.offx;
    const y0 = n.by + n.offy;
    const z0 = n.bz * tilt;
    const yy = yaw * tilt, pp = pitch * tilt;
    const cy = Math.cos(yy), sy = Math.sin(yy);
    const x1 = x0 * cy + z0 * sy;
    const z1 = -x0 * sy + z0 * cy;
    const y1 = y0;
    const cx = Math.cos(pp), sx = Math.sin(pp);
    const y2 = y1 * cx - z1 * sx;
    const z2 = y1 * sx + z1 * cx;
    const x2 = x1;
    const zc = Math.max(z2, -FOCAL * 0.85);
    const depthScale = FOCAL / (FOCAL + zc);
    const s = depthScale * zoom;
    n.px = x2 * s + panX;
    n.py = y2 * s + panY;
    n.pscale = s;
    n.depthScale = depthScale;
    n.pz = z2;
    return n;
  }

  let bgLayer, edgeLayer, relLayer, flowLayer, particleLayer, nodeLayer;
  let particles = [];
  let flow = null;   // { chain:[ids], start, dur }
  let rafId = null;
  let lastTs = 0;

  function buildDom() {
    svg.selectAll("*").remove();
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 620;
    svg.attr("viewBox", `${-w / 2} ${-h / 2} ${w} ${h}`).attr("preserveAspectRatio", "xMidYMid meet");

    // Neredeyse görünmez İslami geometrik doku (%2-3) -- atmosferi zenginleştirir,
    // grafikle asla yarışmaz.
    const defs = svg.append("defs");
    buildGeoPattern(defs);
    // Altın akış için yumuşak parıltı filtresi
    const f = defs.append("filter").attr("id", "esmaX-glow").attr("x", "-60%").attr("y", "-60%").attr("width", "220%").attr("height", "220%");
    f.append("feGaussianBlur").attr("stdDeviation", "3.2").attr("result", "b");
    const fm = f.append("feMerge");
    fm.append("feMergeNode").attr("in", "b");
    fm.append("feMergeNode").attr("in", "SourceGraphic");

    bgLayer = svg.append("g").attr("class", "esmaX-bg");
    bgLayer.append("rect").attr("class", "esmaX-bg-rect").attr("x", -w).attr("y", -h).attr("width", 2 * w).attr("height", 2 * h).attr("fill", "url(#esmaX-geo)");

    edgeLayer = svg.append("g").attr("class", "esmaX-edges");
    relLayer = svg.append("g").attr("class", "esmaX-relations");
    particleLayer = svg.append("g").attr("class", "esmaX-particles");
    flowLayer = svg.append("g").attr("class", "esmaX-flow");
    nodeLayer = svg.append("g").attr("class", "esmaX-nodes");
  }

  function buildGeoPattern(defs) {
    // Sekiz köşeli yıldız (girih) döşemesini ince çizgilerle -- opaklık CSS'te.
    const p = defs.append("pattern").attr("id", "esmaX-geo").attr("width", 120).attr("height", 120).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(0)");
    const star = [];
    const cx = 60, cy = 60, R = 44, r = 18;
    for (let i = 0; i < 16; i++) {
      const ang = (Math.PI / 8) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? R : r;
      star.push(`${cx + rad * Math.cos(ang)},${cy + rad * Math.sin(ang)}`);
    }
    p.append("polygon").attr("class", "esmaX-geo-line").attr("points", star.join(" "));
    // köşe bağlantı çizgileri (döşeme hissi)
    p.append("path").attr("class", "esmaX-geo-line").attr("d", "M0,60 L120,60 M60,0 L60,120");
  }

  // Bir düğümün Allah'a kadar (çizilen ebeveyn zinciri) yolu -- altın akış +
  // ilişki vurgusu için.
  function chainToAllah(id) {
    const chain = [];
    let cur = byId.get(id);
    while (cur) { chain.push(cur.id); if (cur.id === "allah") break; cur = cur.parentId ? byId.get(cur.parentId) : null; }
    return chain.reverse(); // allah ... node
  }

  // İlişkili küme: seçilenin kendisi + Allah'a giden zincir + Zât + çocuklar +
  // çapraz ilişki ortakları (1. derece); ikinci derece = bunların komşuları.
  let selectedId = null, hoverId = null;
  function relationSets(id) {
    const first = new Set([id]);
    chainToAllah(id).forEach((x) => first.add(x));
    const node = byId.get(id);
    if (node) node.childIds.forEach((c) => first.add(c));
    relations.forEach((r) => { if (r.from === id) first.add(r.to); if (r.to === id) first.add(r.from); });
    const second = new Set();
    first.forEach((fid) => {
      const fn = byId.get(fid);
      if (!fn) return;
      if (fn.parentId) second.add(fn.parentId);
      fn.childIds.forEach((c) => second.add(c));
      relations.forEach((r) => { if (r.from === fid) second.add(r.to); if (r.to === fid) second.add(r.from); });
    });
    second.forEach((s) => { if (!first.has(s)) {} });
    return { first, second };
  }

  function ensureFrame() {
    if (rafId == null) { lastTs = performance.now(); rafId = requestAnimationFrame(frame); }
  }

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function frame(ts) {
    rafId = null;
    const dt = Math.min(64, ts - lastTs); lastTs = ts;
    let active = false;

    // tilt animasyonu (zamanlı, 800-1200ms sinematik)
    if (tilt !== tiltTarget) {
      if (reduceMotion) { tilt = tiltTarget; }
      else {
        const p = Math.min(1, (ts - tiltAnimStart) / TILT_DUR);
        tilt = tiltFrom + (tiltTarget - tiltFrom) * easeInOut(p);
        if (p >= 1) tilt = tiltTarget; else active = true;
      }
    }
    // zoom & pan yumuşaması
    const lerpK = reduceMotion ? 1 : 1 - Math.pow(0.0025, dt / 1000);
    if (Math.abs(zoom - zoomTarget) > 0.0005) { zoom += (zoomTarget - zoom) * lerpK; active = true; } else zoom = zoomTarget;
    if (Math.abs(panX - panTargetX) > 0.4) { panX += (panTargetX - panX) * lerpK; active = true; } else panX = panTargetX;
    if (Math.abs(panY - panTargetY) > 0.4) { panY += (panTargetY - panY) * lerpK; active = true; } else panY = panTargetY;

    // görünürlük (açılım) + etki alanı ötelemeleri
    const relSet = selectedId ? relationSets(selectedId) : null;
    nodes.forEach((n) => {
      if (Math.abs(n.vis - n.visTarget) > 0.004) { n.vis += (n.visTarget - n.vis) * (reduceMotion ? 1 : 1 - Math.pow(0.004, dt / 1000)); active = true; }
      else n.vis = n.visTarget;
      // etki alanı: seçili düğüme yakın ilişkili düğümler nazikçe yaklaşır
      let tox = 0, toy = 0;
      if (selectedId && relSet && n.id !== selectedId && relSet.first.has(n.id)) {
        const sel = byId.get(selectedId);
        tox = (sel.bx - n.bx) * 0.12;
        toy = (sel.by - n.by) * 0.12;
      }
      if (Math.abs(n.offx - tox) > 0.3 || Math.abs(n.offy - toy) > 0.3) {
        n.offx += (tox - n.offx) * (reduceMotion ? 1 : 1 - Math.pow(0.02, dt / 1000));
        n.offy += (toy - n.offy) * (reduceMotion ? 1 : 1 - Math.pow(0.02, dt / 1000));
        active = true;
      } else { n.offx = tox; n.offy = toy; }
    });

    // parçacıklar (yavaş, dingin ışık) -- reduceMotion'da yok
    if (!reduceMotion && particlesEnabled) { stepParticles(dt); active = true; }

    // altın akış
    if (flow) { active = true; if (ts - flow.start > flow.dur + 400) flow = null; }

    // otomatik dönüş (3B'de, keşif kapalıysa, boştayken)
    if (tilt > 0.5 && !dragging && !reduceMotion && idleRotate) { yaw += dt * 0.00006; active = true; }

    render(ts);

    // Zât/Allah'ın nefes alan halosu sürekli hafifçe değişiyor -- reduceMotion
    // kapalıyken kare döngüsü hep sürsün ki bu ambient nefes hiç durmasın
    // (diğer graflardaki -- hal.js, sirlar-graph.js -- aynı desen).
    if (active || exploreOn || !reduceMotion) ensureFrame();
  }

  function warmthColor(base, depthA) {
    // 3B derinliği: Allah'a yakın = sıcak/parlak, uzak = serin/atmosferik.
    // tilt ile devreye girer (düz 2B'de kutup renkleri korunur).
    if (tilt < 0.02) return base;
    const near = Math.max(0, 1 - depthA / 5);
    const warm = isDark() ? "#ffd27a" : "#e8a63c"; // sıcak altın
    const cool = isDark() ? "#5b6b82" : "#8f97a6";
    const target = near > 0.5 ? warm : cool;
    const amt = Math.round(tilt * (near > 0.5 ? near * 45 : (1 - near) * 40));
    return `color-mix(in srgb, ${base} ${100 - amt}%, ${target} ${amt}%)`;
  }

  function colorForNode(n) {
    if (n.kind === "zat") return GU.ZAT_FILL;
    if (n.kind === "allah") return getVar("--series-theme");
    if (n.pole === "celal") return getVar("--series-celal");
    if (n.pole === "cemal") return getVar("--series-cemal");
    if (n.pole === "kemal") return getVar("--series-kemal");
    return getVar("--series-esma-neutral");
  }

  // Allah'a yakınlığa göre hale gücü (#6): yakın düğümler daha güçlü, yumuşak
  // altın parıltı yayar; uzaktakiler daha sessiz.
  function haloStrength(n) {
    if (n.kind === "zat" || n.kind === "allah") return 1;
    if (n.kind === "cluster") return 0.72;
    return Math.max(0.12, 0.6 - (n.depthA - 1) * 0.12);
  }

  // Halo rengi: Zât, Ontoloji grafiğindeki .node--root ile aynı ışıması
  // gerekiyor -- orada halo her zaman doğrudan --series-theme (dark modda
  // --accent-glow-dark), soluk bir beyaz-altın karışımı değil, doygun/solid
  // altın rengidir (bkz. style.css .node--root .node-halo). Önceki soluk
  // color-mix burada bir "iyileştirme" sanılmıştı ama aslında Zât'ı sönük/
  // içi boş bir halkaya çeviriyordu -- iki grafikte de aynı Zât'ın aynı
  // ışımayla görünmesi için buradan da doğrudan tema rengi kullanılıyor.
  function haloColor(n) {
    if (n.kind === "zat") return isDark() ? getVar("--accent-glow-dark") : getVar("--series-theme");
    return warmthColor(colorForNode(n), n.depthA);
  }

  // Nefes alan halo: Ontoloji'deki .node--root .node-halo keyframe'iyle
  // (node-halo-breathe: 0%/100% opacity .14 scale 1 -> 50% opacity .34 scale
  // 1.4, 6sn) BİREBİR aynı genlikte -- 0 (dip) ile 1 (tepe) arasında bir faz
  // döndürür; çağıran yer bunu ontoloji'deki gibi opacity/scale'e uygular.
  // Önceki ±%8-10'luk ince salınım ontoloji'nin göze çarpan nefesiyle
  // eşleşmiyordu ("canlı glow etkisi yok" şikâyeti kısmen buradandı).
  function haloBreathPhase(n, ts) {
    if (reduceMotion) return 0.5;
    const period = 6000;
    const phase = n.kind === "allah" ? 0 : Math.PI; // Zât/Allah farklı ritimde nefes alsın
    return (1 - Math.cos((ts / period) * 2 * Math.PI + phase)) / 2;
  }

  function labelMode(n, effScale) {
    // Zoom seviyesine göre kademeli etiket (#5): düşük=daire, orta=kısa,
    // yüksek=tam. Seçili/hover/merkez düğümler her zaman tam.
    if (n.id === selectedId || n.id === hoverId || n.kind === "zat" || n.kind === "allah" || n.kind === "cluster") return "full";
    if (effScale >= 0.92) return "full";
    if (effScale >= 0.6) return "short";
    return "none";
  }

  function fullName(raw) { return tt(raw.name); }
  function shortName(raw) {
    const full = tt(raw.name);
    const idx = full.indexOf(" (");
    return idx === -1 ? full : full.slice(0, idx);
  }

  function render(ts) {
    if (!nodeLayer) return;
    ts = ts || performance.now();
    nodes.forEach(project);

    const relSet = selectedId ? relationSets(selectedId) : null;
    const flowSet = new Set(flow ? flow.chain : []);
    const hoverChain = hoverId && !selectedId ? new Set(chainToAllah(hoverId)) : null;

    function nodeOpacity(n) {
      let o = n.vis;
      if (o < 0.01) return 0;
      if (selectedId) {
        if (n.id === selectedId) o *= 1;
        else if (relSet.first.has(n.id)) o *= 1;
        else if (relSet.second.has(n.id)) o *= 0.6;
        else o *= 0.15;
      } else if (hoverChain) {
        if (!hoverChain.has(n.id) && n.id !== hoverId) o *= 0.5;
      }
      // 3B atmosferi: uzak düğümler biraz daha soluk
      if (tilt > 0.02) o *= Math.max(0.4, Math.min(1, n.depthScale * 1.02));
      return o;
    }

    // Etiket çakışma-önleme (#f2 düzeltmesi): eskiden mod salt zoom seviyesine
    // bakıyordu, komşu etiketlerle örtüşmeyi hiç kontrol etmiyordu -- yoğun
    // kümelerde (özellikle uzun, birleşik eşanlamlı isimlerde, örn. "Al-Ghaffar
    // / Al-Ghafir / Al-Ghafur") onlarca "tam" etiket aynı anda üst üste
    // biniyordu. Önce her düğümün ZOOM'a göre aday modunu/metnini/önceliğini
    // topluyoruz; sonra önem sırasına göre açgözlü (greedy) bir yerleştirme
    // geçişiyle çakışan düşük-öncelikli etiketleri "none"a düşürüyoruz.
    // Zât/Allah/kutup/seçili/hover her zaman kazanır (öncelik sonsuz).
    function estimateLabelBox(n, mode) {
      const eff = n.pscale;
      const fontSize = Math.max(10, Math.min(17, 11 + n.importance * 8));
      const text = mode === "full" ? fullName(n.raw) : shortName(n.raw);
      const w = Math.max(20, text.length * fontSize * 0.56);
      const h = fontSize * 1.25;
      const labelY = n.py - n.radius * eff - 7;
      return { x0: n.px - w / 2, x1: n.px + w / 2, y0: labelY - h, y1: labelY, text };
    }
    function boxesOverlap(a, b) {
      const pad = 3;
      return a.x0 - pad < b.x1 && a.x1 + pad > b.x0 && a.y0 - pad < b.y1 && a.y1 + pad > b.y0;
    }
    function buildLabelPlan() {
      const plan = new Map();
      const always = [];
      const candidates = [];
      nodes.forEach((n) => {
        if (nodeOpacity(n) < 0.02) { plan.set(n.id, "none"); return; }
        const forced = n.id === selectedId || n.id === hoverId || n.kind === "zat" || n.kind === "allah" || n.kind === "cluster";
        const mode = labelMode(n, n.pscale);
        if (mode === "none") { plan.set(n.id, "none"); return; }
        const priority = forced ? Infinity : n.importance;
        const item = { n, mode, priority, box: estimateLabelBox(n, mode) };
        if (forced) always.push(item); else candidates.push(item);
      });
      const placed = [];
      always.forEach((it) => { placed.push(it.box); plan.set(it.n.id, it.mode); });
      candidates.sort((a, b) => b.priority - a.priority);
      candidates.forEach((it) => {
        const collides = placed.some((p) => boxesOverlap(it.box, p));
        if (collides) { plan.set(it.n.id, "none"); return; }
        placed.push(it.box);
        plan.set(it.n.id, it.mode);
      });
      return plan;
    }
    const labelPlan = buildLabelPlan();

    // düğümler (ressam algoritması: arkadan öne)
    const ordered = nodes.slice().sort((a, b) => b.pz - a.pz);
    const sel = nodeLayer.selectAll("g.esmaX-node").data(ordered, (d) => d.id);
    const enter = sel.enter().append("g")
      .attr("class", (d) => "esmaX-node esmaX-node--" + d.kind + (d.kind === "zat" || d.kind === "allah" ? " node--root" : ""))
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (d) => fullName(d.raw))
      .on("click", (e, d) => { e.stopPropagation(); onNodeActivate(d); })
      .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onNodeActivate(d); } })
      .on("pointerenter", (e, d) => { if (!dragCandidate) { hoverId = d.id; ensureFrame(); } })
      .on("pointerleave", (e, d) => { if (hoverId === d.id) { hoverId = null; ensureFrame(); } })
      .on("focus", (e, d) => { hoverId = d.id; ensureFrame(); })
      .on("blur", (e, d) => { if (hoverId === d.id) { hoverId = null; ensureFrame(); } });
    enter.append("circle").attr("class", "esmaX-halo");
    enter.append("circle").attr("class", "esmaX-dot");
    enter.append("circle").attr("class", "node-sheen");
    enter.append("text").attr("class", "esmaX-label").attr("text-anchor", "middle");
    const merged = enter.merge(sel);
    merged.order();
    sel.exit().remove();

    merged.each(function (n) {
      const g = d3.select(this);
      const op = nodeOpacity(n);
      g.style("opacity", op).style("display", op < 0.01 ? "none" : null)
        .attr("transform", `translate(${n.px.toFixed(1)},${n.py.toFixed(1)})`);
      if (op < 0.01) return;
      const r = n.radius * n.pscale;
      const hs = haloStrength(n);
      const isActive = n.id === selectedId;
      g.classed("is-active", isActive);
      const isRoot = n.kind === "zat" || n.kind === "allah";
      let haloR, haloOp;
      if (isRoot) {
        // Ontoloji'deki .node--root .node-halo dinlenme boyutu, kendi
        // düğümünün ~1.95 katı (bkz. RADIUS_BY_ID notu); 0.4'lük ek katsayı
        // nefes tepe noktasında bu tabanın üzerine (~%40) ekleniyor.
        const phase = reduceMotion ? 0.5 : haloBreathPhase(n, ts);
        haloR = r * 1.95 * (1 + 0.4 * phase);
        haloOp = (0.14 + 0.20 * phase) * (isActive ? 1.7 : 1);
      } else {
        haloR = r * (1.25 + hs * 0.85);
        haloOp = (0.07 + hs * 0.20) * (isActive ? 1.7 : 1);
      }
      g.select(".esmaX-halo")
        .attr("r", haloR)
        .style("fill", haloColor(n))
        .style("opacity", haloOp);
      g.select(".esmaX-dot").attr("r", r).style("fill", warmthColor(colorForNode(n), n.depthA));
      g.select(".node-sheen").attr("r", r);
      const mode = labelPlan.get(n.id) || "none";
      const label = g.select(".esmaX-label");
      if (mode === "none") { label.style("display", "none"); }
      else {
        label.style("display", null)
          .attr("y", -r - 7)
          .style("font-size", Math.max(10, Math.min(17, 11 + n.importance * 8)) + "px")
          .classed("esmaX-label--strong", n.kind !== "name" || isActive || n.id === hoverId)
          .text(mode === "full" ? fullName(n.raw) : shortName(n.raw));
      }
    });

    // kenarlar
    function edgeVisible(e) { return byId.get(e.from).vis > 0.05 && byId.get(e.to).vis > 0.05; }
    const visEdges = edges.filter(edgeVisible);
    const es = edgeLayer.selectAll("line.esmaX-edge").data(visEdges, (d) => d.from + ">" + d.to);
    es.exit().remove();
    const ee = es.enter().append("line").attr("class", "esmaX-edge");
    ee.merge(es).each(function (e) {
      const a = byId.get(e.from), b = byId.get(e.to);
      const inFlow = flowSet.has(e.from) && flowSet.has(e.to);
      const dim = selectedId && !(relSet.first.has(e.from) && relSet.first.has(e.to)) && !(relSet.second.has(e.from) || relSet.second.has(e.to));
      d3.select(this)
        .attr("x1", a.px).attr("y1", a.py).attr("x2", b.px).attr("y2", b.py)
        .classed("esmaX-edge--flow", inFlow)
        .style("opacity", (dim ? 0.05 : Math.max(0.06, Math.min(0.4, 0.5 - b.depthA * 0.05))) * Math.min(a.vis, b.vis));
    });

    // çapraz ilişkiler (yalnız her iki uç görünürken)
    const visRel = relations.filter((r) => byId.get(r.from) && byId.get(r.to) && byId.get(r.from).vis > 0.05 && byId.get(r.to).vis > 0.05);
    const rs = relLayer.selectAll("line.esmaX-rel").data(visRel, (r) => r.from + "~" + r.to);
    rs.exit().remove();
    const re = rs.enter().append("line").attr("class", (r) => "esmaX-rel esmaX-rel--" + r.type)
      .on("click", (e, r) => { e.stopPropagation(); showRelationDetail(r); });
    re.merge(rs).each(function (r) {
      const a = byId.get(r.from), b = byId.get(r.to);
      const rel = selectedId && (r.from === selectedId || r.to === selectedId);
      d3.select(this).attr("x1", a.px).attr("y1", a.py).attr("x2", b.px).attr("y2", b.py)
        .style("opacity", (selectedId ? (rel ? 0.9 : 0.06) : 0.5) * Math.min(a.vis, b.vis));
    });

    renderParticles();
    renderFlow();
  }

  // ---- parçacıklar: yavaş ilerleyen ışık noktaları (#7) ----
  let particlesEnabled = !reduceMotion;
  function rebuildParticles() {
    particles = [];
    if (reduceMotion) return;
    edges.forEach((e) => {
      // yalnız isim-üstü katmanlar için az sayıda; kalabalık dış halka için seyrek
      particles.push({ from: e.from, to: e.to, t: Math.random(), speed: 0.06 + Math.random() * 0.05 });
    });
  }
  function stepParticles(dt) {
    const s = dt / 1000;
    particles.forEach((p) => { p.t += p.speed * s; if (p.t > 1) p.t -= 1; });
  }
  function renderParticles() {
    if (reduceMotion) return;
    const vis = particles.filter((p) => {
      const a = byId.get(p.from), b = byId.get(p.to);
      return a && b && a.vis > 0.3 && b.vis > 0.3;
    });
    const ps = particleLayer.selectAll("circle.esmaX-particle").data(vis, (d) => d.from + ">" + d.to);
    ps.exit().remove();
    ps.enter().append("circle").attr("class", "esmaX-particle").attr("r", 1.5)
      .merge(ps).each(function (p) {
        const a = byId.get(p.from), b = byId.get(p.to);
        const x = a.px + (b.px - a.px) * p.t;
        const y = a.py + (b.py - a.py) * p.t;
        const dim = selectedId && !(relationSets(selectedId).first.has(p.from));
        d3.select(this).attr("cx", x).attr("cy", y).style("opacity", (dim ? 0.06 : 0.34) * Math.min(a.vis, b.vis));
      });
  }

  // ---- altın tecellî akışı (#3, #12): Allah'tan seçilen isme doğru ----
  function startFlow(id) {
    const chain = chainToAllah(id);
    if (chain.length < 2) { flow = null; return; }
    flow = { chain, start: performance.now(), dur: reduceMotion ? 0 : Math.max(700, chain.length * 260) };
    ensureFrame();
  }
  function renderFlow() {
    flowLayer.selectAll("*").remove();
    if (!flow || reduceMotion) return;
    // zincir boyunca ilerleyen parlak bir "comet"
    const pts = flow.chain.map((id) => { const n = byId.get(id); return [n.px, n.py]; });
    // toplam uzunluk
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); total += d; }
    const t = Math.min(1, (performance.now() - flow.start) / flow.dur);
    let dist = t * total, acc = 0, cx = pts[0][0], cy = pts[0][1];
    for (let i = 0; i < segs.length; i++) {
      if (dist <= acc + segs[i] || i === segs.length - 1) {
        const f = segs[i] ? Math.min(1, (dist - acc) / segs[i]) : 1;
        cx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f;
        cy = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
        break;
      }
      acc += segs[i];
    }
    // geçilen yolu altın bir çizgiyle vurgula
    const passed = [pts[0]];
    let dd = t * total, a2 = 0;
    for (let i = 1; i < pts.length; i++) {
      const segLen = segs[i - 1];
      if (dd >= a2 + segLen) { passed.push(pts[i]); a2 += segLen; }
      else { const f = segLen ? (dd - a2) / segLen : 0; passed.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]); break; }
    }
    flowLayer.append("polyline").attr("class", "esmaX-flow-line")
      .attr("points", passed.map((p) => p.join(",")).join(" "));
    flowLayer.append("circle").attr("class", "esmaX-flow-comet").attr("cx", cx).attr("cy", cy).attr("r", 4.5).attr("filter", "url(#esmaX-glow)");
  }

  // ---------------------------------------------------------------------------
  // 6) Etkileşim: seçim, kaydırma (semantik derinlik), sürükleme, zoom
  // ---------------------------------------------------------------------------
  let dragging = false, dragCandidate = false, idleRotate = true;
  let dragStartX = 0, dragStartY = 0, dragStartPanX = 0, dragStartPanY = 0, dragStartYaw = 0, dragStartPitch = 0, dragPointerId = null;

  function onNodeActivate(n) {
    // Küme ve isimler seçilebilir; seçildiğinde önce (gerekiyorsa) o katmanı aç.
    // Önceden bu yalnız n'nin KENDİ katmanı gizliyken (deep-link/arama) işe
    // yarıyordu -- bir kümeye (kutup) ya da bir isme tıklamak, altındaki bir
    // sonraki katmanı hiç açmıyordu; tek yol sağdaki 3 derinlik düğmesiydi.
    // Şimdi n'nin doğrudan çocuklarının katmanına da bakılıyor, ki bir
    // kümeye/isme tıklamak kendi altındaki katmanı da açsın.
    let targetLv = revealLevel;
    if (n.level > targetLv) targetLv = n.level;
    n.childIds.forEach((cid) => {
      const c = byId.get(cid);
      if (c && c.level > targetLv) targetLv = c.level;
    });
    if (targetLv > revealLevel) setRevealLevel(targetLv);
    selectNode(n.id, { flow: true });
  }

  function selectNode(id, opts) {
    const n = byId.get(id);
    if (!n) return;
    selectedId = id;
    idleRotate = false;
    if (n.kind === "zat") showZatDetail();
    else if (n.kind === "cluster") showClusterDetail(n);
    else showNameDetail(n);
    if (opts && opts.flow) startFlow(id);
    // kamerayı seçilene doğru nazikçe kaydır (etki alanı hissini pekiştirir)
    focusCameraOn(n);
    window.__dostNav && window.__dostNav.setHash("esma", id);
    ensureFrame();
  }

  function deselect() {
    selectedId = null;
    flow = null;
    idleRotate = tilt > 0.5;
    fitVisible();
    ensureFrame();
  }

  function focusCameraOn(n) {
    // n'yi merkeze getirmeye çalış (projeksiyon konumunu değil, pan hedefini
    // ayarlıyoruz; seçili düğüm ekranda ortaya yakın dursun).
    project(n);
    panTargetX = panX - n.px * 0.55;
    panTargetY = panY - n.py * 0.55;
  }

  function fitAll() { fitVisible(); }

  // Kaydırma: düz tekerlek = semantik derinlik (katman aç/kapa). Ctrl/⌘ +
  // tekerlek = klasik yakınlaştırma (etiket ayrıntı düzeyini de sürer).
  let wheelAccum = 0, wheelLock = false;
  function onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const k = e.deltaY < 0 ? 1.12 : 0.89;
      zoomTarget = Math.max(0.28, Math.min(3.2, zoomTarget * k));
      ensureFrame();
      return;
    }
    wheelAccum += e.deltaY;
    if (wheelLock) return;
    if (Math.abs(wheelAccum) > 70) {
      setRevealLevel(revealLevel + (wheelAccum > 0 ? 1 : -1));
      wheelAccum = 0;
      wheelLock = true;
      setTimeout(() => { wheelLock = false; }, 380);
    }
  }

  function wireInteractions() {
    if (svgNode.dataset.wiredX) return;
    svgNode.dataset.wiredX = "1";

    svgNode.addEventListener("wheel", onWheel, { passive: false });

    const DRAG_THRESHOLD = 5;
    svgNode.addEventListener("pointerdown", (e) => {
      dragCandidate = true; dragPointerId = e.pointerId;
      dragStartX = e.clientX; dragStartY = e.clientY;
      dragStartPanX = panTargetX; dragStartPanY = panTargetY;
      dragStartYaw = yaw; dragStartPitch = pitch;
    });
    svgNode.addEventListener("pointermove", (e) => {
      if (!dragCandidate) return;
      const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
      if (!dragging) { if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return; dragging = true; try { svgNode.setPointerCapture(dragPointerId); } catch (_) {} }
      if (tilt > 0.25) {
        // 3B: döndür
        yaw = dragStartYaw + dx * 0.006;
        pitch = Math.max(-1.1, Math.min(0.4, dragStartPitch - dy * 0.006));
      } else {
        // 2B: kaydır (pan)
        panTargetX = dragStartPanX + dx; panTargetY = dragStartPanY + dy;
        panX = panTargetX; panY = panTargetY;
      }
      ensureFrame();
    });
    function endDrag() {
      const wasDragging = dragging;
      dragCandidate = false; dragging = false;
      if (dragPointerId != null) { try { svgNode.releasePointerCapture(dragPointerId); } catch (_) {} dragPointerId = null; }
      return wasDragging;
    }
    svgNode.addEventListener("pointerup", (e) => { const was = endDrag(); });
    svgNode.addEventListener("pointercancel", endDrag);

    // boşluğa tıklama: seçimi kaldır
    svgNode.addEventListener("click", (e) => {
      if (e.target === svgNode || e.target.classList.contains("esmaX-bg-rect")) { if (selectedId) deselect(); }
    });

    // Escape: seçim/geçmiş
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (wrapEl.hidden) return;
      if (!detailPanel.hidden && (currentDetailNode || currentDetailIsZat || currentDetailRelation)) { goBackInHistory(); }
      else if (selectedId) deselect();
    });

    window.addEventListener("resize", () => { if (built && !wrapEl.hidden) { onResize(); } });
  }

  function onResize() {
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 620;
    svg.attr("viewBox", `${-w / 2} ${-h / 2} ${w} ${h}`);
    if (bgLayer) bgLayer.select("rect").attr("x", -w).attr("y", -h).attr("width", 2 * w).attr("height", 2 * h);
    layout();
    ensureFrame();
  }

  // ---------------------------------------------------------------------------
  // 7) Detay paneli (bağlamsal bilgi) -- kutup=kategori, ilişkiler=tamamlayıcı
  // ---------------------------------------------------------------------------
  let currentDetailNode = null, currentDetailIsZat = false, currentDetailRelation = null;
  let detailHistory = [], suppressHistoryPush = false;

  function poleBadgeHtml(raw) {
    const label = POLE_LABEL[raw.pole];
    if (!label || raw.id === "zat") return "";
    const bg = colorForRaw(raw);
    return `<span class="pole-badge" style="background:color-mix(in srgb, ${bg} 72%, black)">${tt(label)}</span>`;
  }
  function colorForRaw(raw) {
    if (raw.id === "zat") return GU.ZAT_FILL;
    if (raw.id === "allah") return getVar("--series-theme");
    if (raw.pole === "celal") return getVar("--series-celal");
    if (raw.pole === "cemal") return getVar("--series-cemal");
    if (raw.pole === "kemal") return getVar("--series-kemal");
    return getVar("--series-esma-neutral");
  }

  function edgeRow(nameDict, arrow, note) {
    return `<div class="detail-block detail-block--edge"><h3>${arrow} ${tt(nameDict)}</h3>${note ? `<p>${note}</p>` : ""}</div>`;
  }

  function relatedNamesHtml(sceneNode) {
    const raw = sceneNode.raw;
    const rows = [];
    // Kategori (kutup) satırı zaten başlık rozetinde; burada ilişkiler.
    // Üst (çizilen ebeveyn: küme ya da Allah ya da gerçek ebeveyn)
    if (sceneNode.parentId) {
      const par = byId.get(sceneNode.parentId);
      if (par) rows.push(edgeRow(par.raw.name, "↑", tt(par.raw.short)));
    }
    // Alt (çocuklar)
    sceneNode.childIds.forEach((cid) => { const c = byId.get(cid); if (c) rows.push(edgeRow(c.raw.name, "↓", tt(c.raw.short))); });
    // Tamamlayıcı isimler (çapraz ilişkiler)
    relations.forEach((r) => {
      if (r.from === raw.id || r.to === raw.id) {
        const otherId = r.from === raw.id ? r.to : r.from;
        const o = rawById.get(otherId);
        if (o) rows.push(edgeRow(o.name, "↔", tt(r.label)));
      }
    });
    if (!rows.length) return "";
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlişkiler ve tamamlayıcılar", en: "Relations & complements", pt: "Relações e complementos" })}</p>${rows.join("")}`;
  }

  function pushCurrentToHistory() {
    if (suppressHistoryPush) return;
    if (currentDetailNode) detailHistory.push({ type: "node", id: currentDetailNode });
    else if (currentDetailIsZat) detailHistory.push({ type: "zat" });
    else if (currentDetailRelation) detailHistory.push({ type: "relation", from: currentDetailRelation.from, to: currentDetailRelation.to });
  }
  function goBackInHistory() {
    const prev = detailHistory.pop();
    if (!prev) { deselect(); detailPanel.hidden = true; return; }
    suppressHistoryPush = true;
    try {
      if (prev.type === "zat") selectNode("zat", { flow: false });
      else if (prev.type === "node") selectNode(prev.id, { flow: false });
      else if (prev.type === "relation") { const r = relations.find((x) => x.from === prev.from && x.to === prev.to); if (r) showRelationDetail(r); }
    } finally { suppressHistoryPush = false; }
  }

  function openPanel(html) { detailContent.innerHTML = html; detailPanel.hidden = false; }

  function showNameDetail(sceneNode) {
    if (currentDetailNode !== sceneNode.id) pushCurrentToHistory();
    currentDetailNode = sceneNode.id; currentDetailIsZat = false; currentDetailRelation = null;
    const raw = sceneNode.raw;
    const eyebrow = sceneNode.kind === "cluster" ? tt({ tr: "Kutup", en: "Pole", pt: "Polo" }) : tt({ tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" });
    openPanel(`
      <p class="detail-eyebrow">${eyebrow}</p>
      <h2 class="detail-title">${tt(raw.name)} ${poleBadgeHtml(raw)}</h2>
      <div class="detail-block detail-block--ibnarabi"><h3>${tt(raw.short)}</h3><p>${linkify(tt(raw.summary), "esma", raw.id)}</p></div>
      ${analogyHtml(raw.analogy)}
      ${insightsHtml(raw.insights, raw.sources, raw.id)}
      ${relatedNamesHtml(sceneNode)}
    `);
  }
  function showClusterDetail(sceneNode) { showNameDetail(sceneNode); }

  function showZatDetail() {
    if (!currentDetailIsZat) pushCurrentToHistory();
    currentDetailNode = null; currentDetailIsZat = true; currentDetailRelation = null;
    const raw = rawById.get("zat");
    const allah = rawById.get("allah");
    openPanel(`
      <p class="detail-eyebrow">${tt({ tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" })}</p>
      <h2 class="detail-title">${tt(raw.name)}</h2>
      <div class="detail-block detail-block--ibnarabi"><h3>${tt(raw.short)}</h3><p>${linkify(tt(raw.summary), "esma", "zat")}</p></div>
      ${analogyHtml(raw.analogy)}
      ${insightsHtml(raw.insights, raw.sources, "zat")}
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlişkiler", en: "Relations", pt: "Relações" })}</p>
      ${edgeRow(allah.name, "↓", tt(allah.short))}
    `);
  }

  function showRelationDetail(r) {
    if (!currentDetailRelation || currentDetailRelation.from !== r.from || currentDetailRelation.to !== r.to) pushCurrentToHistory();
    currentDetailNode = null; currentDetailIsZat = false; currentDetailRelation = r;
    const from = rawById.get(r.from), to = rawById.get(r.to);
    openPanel(`
      <p class="detail-eyebrow">${tt({ tr: "İlişki", en: "Relation", pt: "Relação" })}</p>
      <h2 class="detail-title">${tt(from.name)} ↔ ${tt(to.name)} ${relationTypeBadgeHtml(r)}</h2>
      ${relationDiagramHtml(r)}
      <div class="detail-block detail-block--ibnarabi"><p>${tt(r.label)}</p></div>
    `);
    detailPanel.hidden = false;
  }

  // ---------------------------------------------------------------------------
  // 8) Kademeli açılım göstergesi + Keşfet + 2B/3B + onboarding (JS ile enjekte)
  // ---------------------------------------------------------------------------
  let revealDots = null, exploreBtn = null;
  function buildControls() {
    if (document.getElementById("esmaX-controls")) return;
    // Derinlik göstergesi (dikey, dairesel noktalar) + Keşfet düğmesi
    const bar = document.createElement("div");
    bar.id = "esmaX-controls";
    bar.className = "esmaX-controls";
    bar.innerHTML = `
      <div class="esmaX-depth" id="esmaX-depth" role="group" aria-label="${tt({ tr: "Derinlik katmanı", en: "Depth layer", pt: "Camada de profundidade" })}">
        <button class="esmaX-depth-btn" data-lv="0" type="button" title="${tt({ tr: "Merkez", en: "Center", pt: "Centro" })}"><span></span></button>
        <button class="esmaX-depth-btn" data-lv="1" type="button" title="${tt({ tr: "İsimler", en: "The Names", pt: "Os Nomes" })}"><span></span></button>
        <button class="esmaX-depth-btn" data-lv="2" type="button" title="${tt({ tr: "Türeyişler", en: "Derivations", pt: "Derivações" })}"><span></span></button>
      </div>
      <p class="esmaX-depth-hint" id="esmaX-depth-hint"></p>`;
    wrapEl.appendChild(bar);
    revealDots = bar;
    bar.querySelectorAll(".esmaX-depth-btn").forEach((b) => b.addEventListener("click", () => setRevealLevel(+b.dataset.lv)));

    // Keşfet düğmesi (recenter'ın yanına)
    exploreBtn = document.createElement("button");
    exploreBtn.id = "esmaX-explore";
    exploreBtn.className = "esmaX-explore";
    exploreBtn.type = "button";
    exploreBtn.setAttribute("aria-pressed", "false");
    exploreBtn.title = tt({ tr: "Keşfet — isimleri sırayla dolaş", en: "Explore — visit the Names in turn", pt: "Explorar — visite os Nomes em sequência" });
    exploreBtn.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7.5 14 12l-2 4.5L10 12Z" fill="currentColor"/></svg><span class="esmaX-explore__txt">${tt({ tr: "Keşfet", en: "Explore", pt: "Explorar" })}</span>`;
    wrapEl.appendChild(exploreBtn);
    exploreBtn.addEventListener("click", () => (exploreOn ? stopExplore() : startExplore()));

    updateRevealIndicator();
  }

  const DEPTH_HINT = [
    { tr: "Merkez: Zât, Allah ve üç kutup. Derine inmek için kaydırın ↓", en: "Center: the Essence, Allah, and the three poles. Scroll to descend ↓", pt: "Centro: a Essência, Allah e os três polos. Role para descer ↓" },
    { tr: "İsimler beliriyor. Bir isme dokunun; Allah'tan ona akan tecellîyi izleyin.", en: "The Names emerge. Touch one; watch the self-disclosure flow to it from Allah.", pt: "Os Nomes emergem. Toque num; veja a autorrevelação fluir até ele desde Allah." },
    { tr: "Türeyişler açıldı: bir isim, altındaki isimleri kendinde taşır.", en: "Derivations revealed: a Name carries the Names beneath it within itself.", pt: "Derivações reveladas: um Nome carrega em si os Nomes abaixo dele." },
  ];
  function updateRevealIndicator() {
    if (!revealDots) return;
    revealDots.querySelectorAll(".esmaX-depth-btn").forEach((b) => b.classList.toggle("is-active", +b.dataset.lv === revealLevel));
    const hint = document.getElementById("esmaX-depth-hint");
    if (hint) hint.textContent = tt(DEPTH_HINT[revealLevel]);
  }

  // ---- Keşfet modu: her 9 saniyede bir ismi ziyaret et (#10) ----
  let exploreOn = false, exploreTimer = null, exploreList = [], exploreIdx = -1;
  function buildExploreList() {
    // Anlamlı bir tur: önce Allah, sonra kutuplar, sonra her kutupta önem
    // sırasıyla başlıca isimler.
    const order = ["allah", "cluster-celal", "cluster-cemal", "cluster-kemal"];
    POLES.forEach((p) => {
      byId.get("cluster-" + p).childIds
        .map((id) => byId.get(id)).filter(Boolean)
        .sort((a, b) => b.importance - a.importance)
        .forEach((n) => order.push(n.id));
    });
    exploreList = order;
  }
  function exploreStep() {
    if (!exploreList.length) buildExploreList();
    exploreIdx = (exploreIdx + 1) % exploreList.length;
    const id = exploreList[exploreIdx];
    const n = byId.get(id);
    if (n && n.level > revealLevel) setRevealLevel(n.level);
    // yumuşak kamera: 3B'de hafif yaw kayması
    selectNode(id, { flow: true });
  }
  function startExplore() {
    exploreOn = true;
    if (exploreBtn) { exploreBtn.classList.add("is-on"); exploreBtn.setAttribute("aria-pressed", "true"); }
    idleRotate = false;
    exploreStep();
    exploreTimer = setInterval(exploreStep, 9000);
    ensureFrame();
  }
  function stopExplore() {
    exploreOn = false;
    if (exploreBtn) { exploreBtn.classList.remove("is-on"); exploreBtn.setAttribute("aria-pressed", "false"); }
    if (exploreTimer) { clearInterval(exploreTimer); exploreTimer = null; }
  }

  // ---- 2B ↔ 3B sinematik geçiş (mevcut #esma-3d-toggle yeniden bağlanır) ----
  function setTilt(target) {
    tiltFrom = tilt; tiltTarget = target; tiltAnimStart = performance.now();
    idleRotate = target > 0.5;
    if (target < 0.5) { yaw = 0; pitch = -0.42; }
    ensureFrame();
  }
  function wireTiltToggle() {
    const btn = document.getElementById("esma-3d-toggle");
    if (!btn || btn.dataset.wiredX) return;
    btn.dataset.wiredX = "1";
    btn.setAttribute("aria-pressed", "false");
    btn.title = tt({ tr: "3 boyuta eğ — mertebe derinliğini göster / 2B'ye dön", en: "Tilt into 3D — show the depth of ranks / back to 2D", pt: "Incline para 3D — mostre a profundidade das hierarquias / voltar ao 2D" });
    btn.addEventListener("click", () => {
      const to = tiltTarget > 0.5 ? 0 : 1;
      setTilt(to);
      btn.classList.toggle("is-on", to > 0.5);
      btn.setAttribute("aria-pressed", to > 0.5 ? "true" : "false");
    });
    // Eski 3B overlay'i kalıcı gizle (bu motor onun yerine geçti).
    const old = document.getElementById("esma3d"); if (old) old.hidden = true;
  }

  // ---- 3 adımlı onboarding (#9) ----
  // onboardRedraw: kutucuk açıkken dil değişirse (bkz. onLangChange) aynı
  // draw() kapanışını yeniden çağırıp mevcut adımı GÜNCEL dilde tazelemek
  // için tutulan referans -- #f1 düzeltmesi: önceden dil değişince kutucuk
  // ilk açıldığı dilde donuk kalıyordu (sayfa dili ile popup dili uyuşmuyordu).
  let onboardRedraw = null;
  function maybeShowOnboarding() {
    try { if (sessionStorage.getItem("dost-esma-onboard-seen")) return; } catch (_) {}
    const steps = [
      { t: { tr: "O'ndan geldik, O'na gidiyoruz", en: "From Him we came, to Him we go", pt: "D'Ele viemos, a Ele vamos" },
        b: { tr: "Bu harita merkezde Allah ismiyle başlar — bütün isimleri kendinde toplayan İsm-i Âzam — ve onun ötesine, her isimlendirmenin ötesindeki Zât'a işaret eder.", en: "This map begins at the center with the Name Allah — the Name that gathers every Name within itself — and points beyond it, to the Essence beyond all naming.", pt: "Este mapa começa no centro com o Nome Allah — o Nome que reúne todos os Nomes em si — e aponta para além dele, para a Essência além de toda nomeação." } },
      { t: { tr: "Katman katman inin", en: "Descend layer by layer", pt: "Desça camada por camada" },
        b: { tr: "Kaydırarak (ya da yandaki noktalarla) derinliğe inin: önce üç kutup — Celâl, Cemâl, Kemâl — sonra isimler, sonra onlardan türeyenler belirir. Harita sizi hiçbir zaman bir anda boğmaz.", en: "Scroll (or use the dots on the side) to descend: first the three poles — Majesty, Beauty, Perfection — then the Names, then what derives from them. The map never overwhelms you all at once.", pt: "Role (ou use os pontos ao lado) para descer: primeiro os três polos — Majestade, Beleza, Perfeição — depois os Nomes, depois o que deriva deles. O mapa nunca o sobrecarrega de uma vez." } },
      { t: { tr: "Bir ismi seçin", en: "Select a Name", pt: "Selecione um Nome" },
        b: { tr: "Bir isme dokunun: Allah'tan ona doğru akan altın bir tecellî izleyin, ilişkili isimler yaklaşsın, ve anlamını, benzetmesini, kaynaklarını yandaki panelde okuyun. Dilerseniz 'Keşfet' sizi isimler arasında gezdirsin.", en: "Touch a Name: watch a golden self-disclosure flow to it from Allah, see related Names draw near, and read its meaning, analogy and sources in the side panel. Or let 'Explore' wander among the Names for you.", pt: "Toque num Nome: veja uma autorrevelação dourada fluir até ele desde Allah, os Nomes relacionados se aproximarem, e leia seu significado, analogia e fontes no painel lateral. Ou deixe 'Explorar' vagar entre os Nomes por você." } },
    ];
    const ov = document.createElement("div");
    ov.className = "esmaX-onb";
    ov.id = "esmaX-onb";
    let i = 0;
    function draw() {
      const s = steps[i];
      ov.innerHTML = `
        <div class="esmaX-onb__card" role="dialog" aria-modal="true" aria-label="${tt(s.t)}">
          <div class="esmaX-onb__dots">${steps.map((_, k) => `<span class="${k === i ? "is-active" : ""}"></span>`).join("")}</div>
          <h2>${tt(s.t)}</h2>
          <p>${tt(s.b)}</p>
          <div class="esmaX-onb__actions">
            <button class="esmaX-onb__skip" type="button">${tt({ tr: "Geç", en: "Skip", pt: "Pular" })}</button>
            <button class="esmaX-onb__next" type="button">${i < steps.length - 1 ? tt({ tr: "Devam", en: "Next", pt: "Próximo" }) : tt({ tr: "Başla", en: "Begin", pt: "Começar" })}</button>
          </div>
        </div>`;
      ov.querySelector(".esmaX-onb__skip").addEventListener("click", done);
      ov.querySelector(".esmaX-onb__next").addEventListener("click", () => { if (i < steps.length - 1) { i++; draw(); } else done(); });
    }
    function done() {
      try { sessionStorage.setItem("dost-esma-onboard-seen", "1"); } catch (_) {}
      onboardRedraw = null;
      ov.classList.add("esmaX-onb--out");
      setTimeout(() => ov.remove(), reduceMotion ? 0 : 320);
    }
    ov.addEventListener("keydown", (e) => { if (e.key === "Escape") done(); });
    if (reduceMotion) ov.classList.add("esmaX-onb--nomo");
    wrapEl.appendChild(ov);
    onboardRedraw = draw;
    draw();
    setTimeout(() => { const nx = ov.querySelector(".esmaX-onb__next"); if (nx) nx.focus(); }, 60);
  }

  // ---------------------------------------------------------------------------
  // 9) Kuruluş + public API
  // ---------------------------------------------------------------------------
  // Sağ kenara sabitlenmiş derinlik-noktaları ve Keşfet düğmesi, sağdan açılan
  // #detail-panel (420px) altında kalıp tıklanamaz hâle geliyordu -- bir
  // düğüme her tıklandığında (ki grafiğin asıl kullanım biçimi budur) bu iki
  // temel kontrol fiilen erişilemez oluyordu. Panel açık olduğunu izleyip
  // kontrolleri panel genişliği kadar sola kaydırıyoruz (bkz. .esma-panel-open
  // CSS kuralı) -- diğer graflardaki paylaşılan setupDetailPanelFocus() ile
  // aynı MutationObserver deseni.
  function wirePanelAwareControls() {
    if (!detailPanel || wrapEl.dataset.wiredPanelObs) return;
    wrapEl.dataset.wiredPanelObs = "1";
    const sync = () => wrapEl.classList.toggle("esma-panel-open", !detailPanel.hidden);
    sync();
    new MutationObserver(sync).observe(detailPanel, { attributes: true, attributeFilter: ["hidden"] });
  }

  function buildAll(data) {
    prepareScene(data);
    buildDom();
    buildControls();
    wireInteractions();
    wireTiltToggle();
    wirePanelAwareControls();
    rebuildParticles();
    built = true;
    setRevealLevel(0, { force: true });
    fitAll();
    render();
    ensureFrame();
    maybeShowOnboarding();

    // İlk açılış: merkez bir an sonra (Zât+Allah) yerleşsin, sonra kaydırma
    // ipucu belirsin. reduceMotion'da anında.
    if (!reduceMotion) {
      // hafif bir "nefes": merkezden dışa doğru vis zaten 0'dan geliyor.
    }
  }

  function render0() { render(); }

  function goToNode(id) {
    fetchData().then((data) => {
      if (!data) return;
      if (!built) buildAll(data);
      const n = byId.get(id) || byId.get("cluster-" + (rawById.get(id) ? CLUSTER_POLE_OF[(rawById.get(id).pole) || "neutral"] : "kemal"));
      const target = byId.get(id);
      if (target) { if (target.level > revealLevel) setRevealLevel(target.level); selectNode(id, { flow: true }); }
      else if (id === "zat") selectNode("zat", { flow: false });
    });
  }

  function relangControls() {
    // diller değişince kontrol metinlerini tazele
    updateRevealIndicator();
    const et = document.querySelector("#esmaX-explore .esmaX-explore__txt");
    if (et) et.textContent = tt({ tr: "Keşfet", en: "Explore", pt: "Explorar" });
  }

  window.__esmaApp = {
    activate() {
      fetchData().then((data) => { if (!data) return; if (!built) buildAll(data); else { ensureFrame(); } });
    },
    goToNode,
    onLangChange() {
      if (!built) return;
      relangControls();
      if (onboardRedraw) onboardRedraw();
      // açık panel içeriğini yeniden çiz
      if (currentDetailNode) { const n = byId.get(currentDetailNode); if (n) showNameDetail(n); }
      else if (currentDetailIsZat) showZatDetail();
      else if (currentDetailRelation) showRelationDetail(currentDetailRelation);
      render();
    },
  };
})();
