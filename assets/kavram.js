/**
 * FAZ C -- "Bir Kavramın Bütün Hayatı": ontology.json/esma.json/felsefi-
 * terimler.json'daki her kavram için TÜRETİLMİŞ bir hayat özeti (ilk/son/
 * en yoğun geçtiği kısım, birlikte geçtiği esmâ, ilişkili sır/çizim/âyet/
 * hadis). Veri: data/ibn-arabi/kavram-hayati.json (scripts/kavram-hayati-
 * uret.py tarafından üretilir, ELLE DÜZENLENMEZ).
 *
 * Bu görünümün id'si BİLEŞİK: "<view>/<id>" (örn. "esma/zahir") -- çünkü
 * aynı id üç kaynakta da (ontoloji/esma/terimler) tekrarlanabiliyor
 * (bkz. "zahir", "batin", "vahid", "tecelli" -- üretim betiğinde
 * doğrulandı). URL: /kavram/<view>/<id>/. Diğer görünümlerin "edge/..."
 * bileşik id'lerinde olduğu gibi, ontology.js'in restRaw ayrıştırması
 * içindeki slash'ı zaten koruyor -- ek bir routing değişikliği gerekmedi.
 */
window.__kavramApp = (function () {
  "use strict";
  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;

  const wrapEl = document.getElementById("kavram-wrap");
  const listEl = document.getElementById("kavram-list");
  const detailEl = document.getElementById("kavram-detail");

  function tt(dict) {
    return I18n ? I18n.pick3(dict || {}) : (dict && (dict.tr || dict.en || dict.pt)) || "";
  }

  const VIEW_LABEL = {
    ontoloji: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
    esma: { tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" },
    terimler: { tr: "Terimler", en: "Terms", pt: "Termos" },
  };

  // terimler.js'teki VIEW_HUE ile aynı ton sözleşmesi -- görünümler arası
  // renk tutarlılığı için (bkz. GORSEL_DIL.md).
  const VIEW_HUE = { ontoloji: 40, esma: 200, terimler: 15 };

  function escapeHtmlKavram(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Kullanıcı notu (2026-08-02): "birlikte en çok geçtiği esma" listesi düz
  // metin çipleriydi -- ilişkinin GÜCÜNÜ göstermiyordu. GORSEL_DIL.md'nin
  // ilkesi gereği ("davranışı resmet, kavramı değil"): kenar kalınlığı/
  // opaklığı ve düğüm büyüklüğü doğrudan ortakBolum sayısının bir
  // fonksiyonu -- dekoratif değil, ölçülen ilişkiyi taşıyor.
  //
  // 2026-08-02 (kullanıcı bildirimi): tek bir donuk tonun yalnız opaklıkla
  // değişmesi "sade ama sönük" duruyordu. Her uydu düğüm artık küçük,
  // canlı bir pastel paletten kendi rengini alıyor (sırayla döngüsel) --
  // GORSEL_DIL.md'nin davranışı-resmet ilkesi bozulmuyor: hangi ismin ne
  // kadar sık birlikte geçtiği hâlâ SADECE boyut/opaklıkla taşınıyor, renk
  // yalnız düğümleri birbirinden ayırt etmeye yarıyor.
  const MINIGRAF_PALET = [350, 28, 52, 150, 195, 268]; // pembe/şeftali/sarı/nane/gökyüzü/leylak
  function birlikteEsmaSvg(k) {
    const items = k.birlikteEsma;
    if (!items.length) return "";
    const cx = 110, cy = 110, R = 78;
    const maxN = Math.max.apply(null, items.map((e) => e.ortakBolum));
    const hue = VIEW_HUE[k.view] != null ? VIEW_HUE[k.view] : 0;
    const n = items.length;
    const parts = [];
    const nodes = [];
    items.forEach((e, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + R * Math.cos(angle);
      const y = cy + R * Math.sin(angle);
      const strength = maxN > 0 ? e.ortakBolum / maxN : 0;
      const w = 1 + strength * 3.5;
      const op = 0.28 + strength * 0.6;
      const r = 8 + strength * 8;
      parts.push(
        `<line class="kavram-minigraf__edge" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke-width="${w.toFixed(2)}" style="opacity:${op.toFixed(2)}"></line>`
      );
      nodes.push({ x, y, r, e, strength, nodeHue: MINIGRAF_PALET[i % MINIGRAF_PALET.length] });
    });
    nodes.forEach(({ x, y, r, e, strength, nodeHue }) => {
      // K-004: etiket 9,5 px'e çıkınca (ekranda ~11 px) kenara yakın düğümün adı
      // viewBox'tan taşıp kırpılıyordu; yatay konum, tahmini genişlikle (~4,9
      // birim/harf) 0-220 aralığında tutulur. Düğümün kendisi yerinde kalır.
      const lbl = tt(e.isim);
      const yarim = Math.min(108, lbl.length * 2.45);
      const lx = Math.max(yarim + 2, Math.min(220 - yarim - 2, x));
      parts.push(
        `<circle class="kavram-minigraf__node" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" style="fill:hsl(${nodeHue} 75% 68% / ${(0.75 + strength * 0.25).toFixed(2)})"></circle>` +
          `<text class="kavram-minigraf__label" x="${lx.toFixed(1)}" y="${(y + r + 13).toFixed(1)}" text-anchor="middle">${escapeHtmlKavram(lbl)}</text>`
      );
    });
    parts.push(
      `<circle class="kavram-minigraf__center" cx="${cx}" cy="${cy}" r="20" style="fill:hsl(${hue} 55% 45%)"></circle>` +
        `<text class="kavram-minigraf__center-label" x="${cx}" y="${cy + 4}" text-anchor="middle">${escapeHtmlKavram(tt(k.isim)).slice(0, 10)}</text>`
    );
    const label = escapeHtmlKavram(
      tt({
        tr: "Birlikte en çok geçtiği isimlerle ilişki şeması",
        en: "Diagram of relation to most co-occurring Names",
        pt: "Diagrama de relação com os Nomes mais coocorrentes",
      })
    );
    return `<svg class="kavram-minigraf" viewBox="-35 0 290 236" role="img" aria-label="${label}">` + parts.join("") + `</svg>`;
  }

  function openMinigrafLightbox(k) {
    if (!window.DostLightbox || !k.birlikteEsma.length) return;
    window.dostTrack && window.dostTrack("kavram_minigraf_buyutuldu", { view: k.view, id: k.id });
    window.DostLightbox.open({
      closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
      svgHtml: birlikteEsmaSvg(k),
      caption: tt({
        tr: "Birlikte en çok geçtiği isimlerle ilişki şeması",
        en: "Diagram of relation to most co-occurring Names",
        pt: "Diagrama de relação com os Nomes mais coocorrentes",
      }),
    });
  }

  let dataPromise = null;
  let kavramlar = [];
  let byKey = new Map();

  // B3 "mini zaman çizelgesi": ilk/en yoğun/son geçiş noktalarını kitabın
  // TÜM açıklığı (kısım/fass sayısı) içinde konumlamak için toplam sayı
  // gerekiyor -- futuhat-atlas-index.json (1MB) bunun için ağır olurdu,
  // aynı küçük özet (okuma-durumu.json, Neredeyiz halkasıyla paylaşılan
  // kaynak) burada da kullanılıyor. Yüklenemezse zaman çizelgesi sessizce
  // atlanır (bookBlock zaten çizelgesiz de anlamlı).
  let okumaDurumu = null;
  GU.fetchJson("data/ibn-arabi/okuma-durumu.json").then((d) => { okumaDurumu = d; }).catch(() => {});

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("kavram-wrap");
    dataPromise = GU.fetchJson("data/ibn-arabi/kavram-hayati.json")
      .then((d) => {
        kavramlar = d.kavramlar || [];
        byKey = new Map(kavramlar.map((k) => [k.view + "/" + k.id, k]));
        if (window.DostViewStatus) window.DostViewStatus.hide("kavram-wrap");
        return true;
      })
      .catch((err) => {
        console.error("kavram-hayati.json yüklenemedi", err);
        dataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("kavram-wrap", () => window.__kavramApp.activate());
        return false;
      });
    return dataPromise;
  }

  function nav(view, id) {
    window.__dostNav && window.__dostNav.goTo(view, id);
  }

  // Kullanıcı notu (2026-08-02): liste sayfası düz bir isim yığınıydı --
  // "çok basit". GORSEL_DIL.md'nin ilkesi gereği ("davranışı resmet,
  // kavramı değil") süs eklemek yerine zaten elimizdeki veriyi görünür
  // kıldık: her kavramın etrafında ne kadar malzeme biriktiğini (kaç
  // kısımda geçtiği + kaç esmâyla birlikte anıldığı + kaç sır/çizim/âyet/
  // hadisle ilişkilendiği) terimler.js'teki "dönüş yoğunluğu" halkasıyla
  // AYNI görsel dilde (dolan bir daire, ısı haritası değil) gösteren bir
  // ölçü -- bu da bir iddia değil, taramanın kendi izini gösteren bir
  // öz-portre.
  function zenginlikSkoru(k) {
    if (k.otomatikEslesmeYok) return 0;
    return (
      (k.futuhat ? k.futuhat.toplamKisim : 0) +
      (k.fusus ? k.fusus.toplamKisim : 0) +
      k.birlikteEsma.length +
      k.ilgiliSirlar.length +
      k.ilgiliCizimler.length +
      k.ilgiliAyet.length +
      k.ilgiliHadis.length
    );
  }

  const KAVRAM_GAUGE_R = 8;
  const KAVRAM_GAUGE_C = 2 * Math.PI * KAVRAM_GAUGE_R;
  function kavramGaugeSvg(frac, hue) {
    const f = Math.max(0.05, Math.min(1, frac));
    const off = KAVRAM_GAUGE_C * (1 - f);
    return `<svg class="kavram-tile__gauge" viewBox="0 0 22 22" aria-hidden="true" style="--tag-hue:${hue}">
      <circle class="kavram-tile__gauge-track" cx="11" cy="11" r="${KAVRAM_GAUGE_R}"></circle>
      <circle class="kavram-tile__gauge-arc" cx="11" cy="11" r="${KAVRAM_GAUGE_R}"
        stroke-dasharray="${KAVRAM_GAUGE_C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"></circle>
    </svg>`;
  }

  function renderList() {
    detailEl.hidden = true;
    listEl.hidden = false;
    wrapEl.classList.add("kavram-wrap--liste");
    wrapEl.classList.remove("kavram-wrap--detay");
    const groups = { ontoloji: [], esma: [], terimler: [] };
    kavramlar.forEach((k) => groups[k.view].push(k));
    Object.keys(groups).forEach((v) => groups[v].sort((a, b) => tt(a.isim).localeCompare(tt(b.isim), "tr")));
    const intro = tt({
      tr: "Taradığımız Fütûhât-ı Mekkiyye ve Füsûsu'l-Hikem metinlerinde adı bulunabilen kavramlar için, nerede ilk geçtiği, nerede en yoğun göründüğü ve hangi sır/çizim/âyet/hadisle birlikte anıldığına dair, veriden türetilmiş bir özet; adı bu metinlerde bulunamayan ya da taranamayan kavramların sayfasında yalnız tanımı ve bağlı olanlar var. Bu bir iddia değil, bir tarama denemesi — yöntem sayfanın altında.",
      en: "For concepts whose name can be found in the Meccan Revelations and Bezels of Wisdom texts we scanned, a data-derived summary of where each first appears, where it appears most densely, and which mystery/diagram/verse/hadith it's recorded alongside; for concepts whose name was not found or could not be scanned, the page holds only their definition and what is linked. Not a claim — a scanning attempt; method noted at the page's foot.",
      pt: "Para os conceitos cujo nome pode ser encontrado nos textos das Revelações de Meca e dos Engastes da Sabedoria que varremos, um resumo derivado de dados de onde cada um aparece pela primeira vez, onde aparece com mais densidade, e com qual mistério/diagrama/versículo/hadith é registrado junto; para os conceitos cujo nome não foi encontrado ou não pôde ser varrido, a página tem apenas a definição e o que se liga a eles. Não uma afirmação — uma tentativa de varredura; o método está ao pé da página.",
    });
    const gaugeNote = tt({
      tr: "Her adın yanındaki halka, o kavram için ne kadar malzeme biriktiğini gösterir — kısım/fass sayısı, birlikte anıldığı esmâ, ilişkili sır/çizim/âyet/hadis toplanarak (kendi grubu içinde ölçeklenmiş).",
      en: "The ring beside each name shows how much material has accumulated for that concept — part/chapter count, co-occurring Names, and related mysteries/diagrams/verses/hadiths added together (scaled within its own group).",
      pt: "O anel ao lado de cada nome mostra quanto material se acumulou para aquele conceito — número de partes/capítulos, Nomes coocorrentes, e mistérios/diagramas/versículos/hadiths relacionados somados (escalado dentro do próprio grupo).",
    });
    listEl.innerHTML =
      `<p class="kavram-list__intro">${intro}</p>` +
      `<p class="kavram-list__intro kavram-list__intro--gauge">${gaugeNote}</p>` +
      Object.keys(groups)
        .map((v) => {
          const items = groups[v];
          const scores = items.map(zenginlikSkoru);
          const lo = Math.min.apply(null, scores), hi = Math.max.apply(null, scores);
          const hue = VIEW_HUE[v] != null ? VIEW_HUE[v] : 0;
          return (
            `<div class="kavram-list__group"><h2>${tt(VIEW_LABEL[v])}</h2><div class="kavram-list__grid">` +
            items
              .map((k, i) => {
                const frac = hi === lo ? 0.5 : (scores[i] - lo) / (hi - lo);
                return (
                  `<button type="button" class="kavram-tile" data-view="${k.view}" data-id="${k.id}" title="${escapeHtmlKavram(tt(k.isim))}">` +
                  kavramGaugeSvg(frac, hue) +
                  `<span class="kavram-tile__label">${tt(k.isim)}</span>` +
                  `</button>`
                );
              })
              .join("") +
            `</div></div>`
          );
        })
        .join("");
    listEl.querySelectorAll(".kavram-tile").forEach((btn) => {
      btn.addEventListener("click", () => nav("kavram", btn.dataset.view + "/" + btn.dataset.id));
    });
  }

  function parseKisimNo(id) {
    const m = /k(\d+)$/.exec(id);
    return m ? parseInt(m[1], 10) : null;
  }
  function parseFassNo(id) {
    const m = /^fs(\d+)$/.exec(id);
    return m ? parseInt(m[1], 10) : null;
  }

  function miniTimelineHtml(label, book) {
    if (!okumaDurumu) return "";
    const parseNo = label === "futuhat" ? parseKisimNo : parseFassNo;
    const total = label === "futuhat" ? okumaDurumu.futuhat.total : okumaDurumu.fusus.total;
    const points = [
      { key: "ilk", ref: book.ilk, cls: "ilk" },
      { key: "enYogun", ref: book.enYogun, cls: "yogun" },
      { key: "son", ref: book.son, cls: "son" },
    ]
      .map((p) => ({ ...p, no: parseNo(p.ref.id) }))
      .filter((p) => p.no != null);
    if (points.length < 2) return "";
    const w = 260, pad = 10;
    const x = (no) => pad + ((no - 1) / (total - 1)) * (w - 2 * pad);
    const seen = new Set();
    const dots = points
      .filter((p) => { if (seen.has(p.no)) return false; seen.add(p.no); return true; })
      .map((p) => {
        const label3 = tt({
          ilk: { tr: "İlk", en: "First", pt: "Primeira" },
          yogun: { tr: "En yoğun", en: "Densest", pt: "Mais densa" },
          son: { tr: "Son", en: "Last", pt: "Última" },
        }[p.cls]);
        const r = p.cls === "yogun" ? 5 : 3.5;
        return `<circle class="kavram-timeline__dot kavram-timeline__dot--${p.cls}" cx="${x(p.no).toFixed(1)}" cy="14" r="${r}"><title>${label3}: ${p.no}</title></circle>`;
      })
      .join("");
    return `<svg class="kavram-timeline" viewBox="0 0 ${w} 28" role="img" aria-label="${escapeHtmlKavram(
      tt({ tr: "Kitap boyunca ilk, en yoğun ve son geçtiği yer", en: "First, densest, and last appearance across the book", pt: "Primeira, mais densa e última aparição ao longo do livro" })
    )}">` +
      `<line class="kavram-timeline__track" x1="${pad}" y1="14" x2="${w - pad}" y2="14"></line>` +
      dots +
      `</svg>`;
  }

  // ===== K-026: kavram sayfası, dört derinlik (Nefes, Sohbet, Mütalaa, Hazine) =====
  // Referans: lab/oneri-02 (yalnız yapı: halka göstergesi, derinlik ipi, koyulaşan
  // zemin). Metinlerin hiçbiri yeni bir iddia değil: Nefes/Sohbet/benzetme sitenin
  // kendi ontology/esma/terimler kayıtlarından aynen alınır; Mütalaa alıntıları
  // okuma metnimizden (Dost'un sözü değil) türetilmiştir ve öyle etiketlenir.
  const CILT_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII"];
  function roman(n) {
    const table = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let out = "", rem = n;
    for (const [v, s] of table) while (rem >= v) { out += s; rem -= v; }
    return out;
  }

  const KATMANLAR = ["nefes", "sohbet", "mutalaa", "hazine"];
  const L = {
    katman: {
      nefes: { tr: "Nefes", en: "Breath", pt: "Sopro" },
      sohbet: { tr: "Sohbet", en: "Conversation", pt: "Conversa" },
      mutalaa: { tr: "Mütalaa", en: "Study", pt: "Estudo" },
      hazine: { tr: "Hazine", en: "Treasury", pt: "Tesouro" },
    },
    katmanAlt: {
      nefes: { tr: "tek ifade", en: "one phrase", pt: "uma expressão" },
      sohbet: { tr: "kısa okuma", en: "a short reading", pt: "leitura breve" },
      mutalaa: { tr: "geçtiği yerler", en: "where it appears", pt: "onde aparece" },
      hazine: { tr: "bağlı olanlar", en: "what is linked", pt: "o que se liga" },
    },
    ipAria: { tr: "Derinlik", en: "Depth", pt: "Profundidade" },
    benzetme: { tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" },
    yok: { tr: "Henüz yok.", en: "Not yet.", pt: "Ainda não." },
    yuklenemedi: {
      tr: "Bu bölümün metni yüklenemedi.",
      en: "The text for this section could not be loaded.",
      pt: "O texto desta seção não pôde ser carregado.",
    },
    sayimF: {
      var: (n) => ({ tr: `Fütûhât: ${n} kısımda`, en: `Futuhat: in ${n} parts`, pt: `Futuhat: em ${n} partes` }),
      yok: { tr: "Fütûhât: geçtiği kısım yok", en: "Futuhat: no part found", pt: "Futuhat: nenhuma parte encontrada" },
    },
    sayimU: {
      var: (n) => ({ tr: `Füsûs: ${n} fassta`, en: `Fusus: in ${n} bezels`, pt: `Fusus: em ${n} engastes` }),
      yok: { tr: "Füsûs: geçtiği fass yok", en: "Fusus: no bezel found", pt: "Fusus: nenhum engaste encontrado" },
    },
    kitapF: { tr: "Fütûhât-ı Mekkiyye", en: "Meccan Revelations", pt: "Revelações de Meca" },
    kitapU: { tr: "Füsûsu'l-Hikem", en: "Bezels of Wisdom", pt: "Engastes da Sabedoria" },
    rol: {
      ilk: { tr: "İlk geçtiği yer", en: "First appears", pt: "Primeira aparição" },
      son: { tr: "Son geçtiği yer", en: "Last appears", pt: "Última aparição" },
      yogun: { tr: "En yoğun geçtiği yer", en: "Densest appearance", pt: "Aparição mais densa" },
      ilkyogun: { tr: "İlk geçtiği ve en yoğun yer", en: "First and densest appearance", pt: "Primeira e mais densa aparição" },
    },
    // "oran" binde kaç kez geçtiği: Math.round(1000/oran) = "yaklaşık her N kelimede bir"
    yogunluk: (n) => ({
      tr: `yaklaşık her ${n} kelimede bir geçiyor`,
      en: `about once every ${n} words`,
      pt: `cerca de uma vez a cada ${n} palavras`,
    }),
    okumaMetni: { tr: "Okuma metnimizden, paragraf", en: "From our reading text, paragraph", pt: "Do nosso texto de leitura, parágrafo" },
    parBasi: { tr: "paragrafın başı", en: "start of paragraph", pt: "início do parágrafo" },
    ac: { tr: "Kısmı aç", en: "Open the part", pt: "Abrir a parte" },
    acF: { tr: "Fassı aç", en: "Open the bezel", pt: "Abrir o engaste" },
    hepsi: { tr: "Geçtiği bütün kısımlar", en: "All the parts where it appears", pt: "Todas as partes em que aparece" },
    cilt: { tr: "Cilt", en: "Volume", pt: "Volume" },
    kisim: { tr: "Kısım", en: "Part", pt: "Parte" },
    fass: { tr: "Fass", en: "Bezel", pt: "Engaste" },
    belirtilmemis: { tr: "belirtilmemiş", en: "not stated", pt: "não informado" },
    uyari: {
      tr: "Alıntılar yalnız üç işaret noktasından (ilk, son, en yoğun) alındı; adın geçtiği öteki kısımlar yukarıdaki listede yalnız adlarıyla duruyor. Bu, kavram adının kısım metinlerinde aranmasına dayanan yaklaşık bir taramadır; bizim ölçümümüzdür, Dost'un bir iddiası değil.",
      en: "The quotations come only from three markers (first, last, densest); the other parts where the name appears are listed above by name only. This is an approximate scan based on searching the concept's name in the part texts; it is our measurement, not a claim of Ibn Arabi's.",
      pt: "As citações vêm apenas de três marcos (primeiro, último, mais denso); as outras partes em que o nome aparece estão listadas acima apenas pelo nome. É uma varredura aproximada, baseada na busca do nome do conceito nos textos das partes; é uma medida nossa, não uma afirmação de Ibn Arabi.",
    },
    h: {
      esma: { tr: "Birlikte geçtiği esmâ", en: "Most co-occurring Names", pt: "Nomes mais coocorrentes" },
      sirlar: { tr: "İlişkili sırlar", en: "Related mysteries", pt: "Mistérios relacionados" },
      cizimler: { tr: "İlişkili çizimler", en: "Related diagrams", pt: "Diagramas relacionados" },
      ayet: { tr: "İlgili âyetler", en: "Related verses", pt: "Versículos relacionados" },
      hadis: { tr: "İlgili hadis", en: "Related hadith", pt: "Hadith relacionado" },
      kaynak: { tr: "Kaynaklar", en: "Sources", pt: "Fontes" },
      notlar: { tr: "Okurken biriken notlar", en: "Notes gathered while reading", pt: "Notas reunidas durante a leitura" },
    },
    daha: (n) => ({ tr: `+${n} daha`, en: `+${n} more`, pt: `+${n} mais` }),
    hadisYerde: (n) => ({ tr: `${n} yerde geçiyor`, en: `appears in ${n} places`, pt: `aparece em ${n} lugares` }),
    hadisNot: {
      tr: "Hadis metni bu veride yok; yalnız sitede hangi kısımlarda geçtiği tutuluyor.",
      en: "The hadith text is not in this data; only the parts of the site where it appears are kept.",
      pt: "O texto do hadith não está nestes dados; só se guarda em quais partes do site ele aparece.",
    },
    kaynakSatir: (c, s) => ({
      tr: `Fütûhât-ı Mekkiyye, Cilt ${c}, satır ${s}`,
      en: `Meccan Revelations, Volume ${c}, line ${s}`,
      pt: `Revelações de Meca, Volume ${c}, linha ${s}`,
    }),
    ciltNot: (v) => ({ tr: `Cilt ${v}`, en: `Volume ${v}`, pt: `Volume ${v}` }),
    yontem2: {
      tr: "Birlikte geçtiği esmâ listesi ham sayıya değil, iki adın beklenenden fazla birlikte geçip geçmediğine (PPMI) göre sıralandı; Zât, Allah ve üç grup adı (zâtî, nisbî, fiilî) bu listenin dışında bırakıldı, çünkü neredeyse her kavramla birlikte geçiyorlar. Bu sıra bizim ölçümümüzdür, Dost'un bir iddiası değildir.",
      en: "The list of co-occurring Names is ordered not by raw counts but by whether two names appear together more than expected (PPMI); the Essence, Allah and the three group names (essential, relational, active) are left out of the list because they appear together with almost every concept. This ordering is our own measurement, not a claim of Ibn Arabi's.",
      pt: "A lista de Nomes coocorrentes é ordenada não pela contagem bruta, mas por saber se dois nomes aparecem juntos mais do que o esperado (PPMI); a Essência, Allah e os três nomes de grupo (essencial, relacional, ativo) ficam fora da lista porque aparecem junto com quase todo conceito. Essa ordem é uma medida nossa, não uma afirmação de Ibn Arabi.",
    },
  };

  function yokHtml() { return `<p class="kavram-yok">${tt(L.yok)}</p>`; }

  function safeInline(h) {
    return String(h || "").replace(/<(?!\/?(?:em|strong)\b)[^>]*>/gi, "");
  }
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function highlight(html, term) {
    if (!term) return html;
    let re;
    try { re = new RegExp("(?<![\\p{L}])" + escRe(term) + "(?![\\p{L}])", "giu"); } catch (e) { return html; }
    return html.replace(/(<[^>]+>)|([^<]+)/g, (m, tag, txt) => (tag ? tag : txt.replace(re, (x) => `<mark>${x}</mark>`)));
  }

  // ---- ek veri: Mütalaa alıntıları + Nefes/Sohbet için görünüme göre kaynak ----
  let pasajPromise = null;
  function fetchPasajlar() {
    if (pasajPromise) return pasajPromise;
    pasajPromise = GU.fetchJson("data/ibn-arabi/kavram-pasajlar.json").catch((err) => {
      console.error("kavram-pasajlar.json yüklenemedi", err);
      pasajPromise = null;
      return null;
    });
    return pasajPromise;
  }
  const SOURCE_FILE = { ontoloji: "ontology.json", esma: "esma.json", terimler: "felsefi-terimler.json" };
  const sourcePromises = {};
  let hadisPromise = null;
  function fetchHadisDizini() {
    if (hadisPromise) return hadisPromise;
    hadisPromise = GU.fetchJson("data/ibn-arabi/hadis-dizini.json").catch(() => { hadisPromise = null; return null; });
    return hadisPromise;
  }
  function fetchSource(view) {
    if (sourcePromises[view]) return sourcePromises[view];
    sourcePromises[view] = GU.fetchJson("data/ibn-arabi/" + SOURCE_FILE[view])
      .then((d) => {
        const m = new Map();
        if (view === "terimler") Object.keys(d.terms || {}).forEach((key) => m.set((d.terms[key] && d.terms[key].id) || key, d.terms[key]));
        else (d.nodes || []).forEach((n) => m.set(n.id, n));
        return m;
      })
      .catch((err) => {
        console.error(SOURCE_FILE[view] + " yüklenemedi", err);
        delete sourcePromises[view];
        return null;
      });
    return sourcePromises[view];
  }

  // Görünüme göre alan eşlemesi (kart Adım 3).
  function sourceInfo(view, rec) {
    if (!rec) return null;
    if (view === "terimler") {
      const sohbet = [];
      if (rec.felsefi_tanim) sohbet.push(rec.felsefi_tanim);
      if (rec.ibn_arabi_yorumu) sohbet.push(rec.ibn_arabi_yorumu);
      return {
        nefes: rec.ozet_tr || rec.ozet_en || rec.ozet_pt ? { tr: rec.ozet_tr, en: rec.ozet_en, pt: rec.ozet_pt } : null,
        sohbet,
        analogy: rec.analogy || null,
        kaynaklar: (rec.kaynaklar || []).map((s) => tt(L.kaynakSatir(s.cilt, s.satir))),
        notlar: null,
      };
    }
    return {
      nefes: rec.short || null,
      sohbet: rec.summary ? [rec.summary] : [],
      analogy: rec.analogy || null,
      kaynaklar: (rec.sources || []).map((s) => (typeof s === "string" ? s : tt(s))),
      notlar: rec.insights || [],
    };
  }

  // ---- görsel yardımcılar ----
  const HALKA_R = 18, HALKA_C = 2 * Math.PI * HALKA_R;
  function halkaSvg(n) {
    const off = HALKA_C * (1 - n / 4);
    return `<svg class="kavram-halka" viewBox="0 0 44 44" aria-hidden="true" focusable="false">` +
      `<circle class="kavram-halka__iz" cx="22" cy="22" r="${HALKA_R}"></circle>` +
      `<circle class="kavram-halka__ark" cx="22" cy="22" r="${HALKA_R}" stroke-dasharray="${HALKA_C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"></circle>` +
      `<text x="22" y="22">${n}</text></svg>`;
  }
  function katmanBas(id, n) {
    return `<div class="kavram-kat-bas">${halkaSvg(n)}<div><h3 id="${id}-b" tabindex="-1">${tt(L.katman[id])}</h3><span class="kavram-kat-alt">${tt(L.katmanAlt[id])}</span></div></div>`;
  }

  function hrefFor(view, id) {
    return window.__dostNav && window.__dostNav.href ? window.__dostNav.href(view, id) : "#";
  }
  function crossLink(view, id, cls, text) {
    return `<a class="cross-link ${cls}" data-view="${view}" data-id="${id}" href="${hrefFor(view, id)}">${text}</a>`;
  }

  // ---- Mütalaa ----
  function rolAdi(rol) {
    if (rol.length === 2 && rol.includes("ilk") && rol.includes("yogun")) return tt(L.rol.ilkyogun);
    return ["ilk", "yogun", "son"].filter((r) => rol.includes(r)).map((r) => tt(L.rol[r])).join(" · ");
  }

  function kunyeHtml(book, kun) {
    const belirtilmemis = tt(L.belirtilmemis);
    const sayfa = kun && kun.sayfa ? escapeHtmlKavram(tt(kun.sayfa)) : belirtilmemis;
    if (book === "futuhat") {
      const cilt = kun && kun.cilt ? `${tt(L.cilt)} ${CILT_ROMAN[kun.cilt] || kun.cilt}` : `${tt(L.cilt)}: ${belirtilmemis}`;
      const kisim = kun && kun.kisim ? `${tt(L.kisim)} ${roman(kun.kisim)}` : `${tt(L.kisim)}: ${belirtilmemis}`;
      return `<b>${tt({ tr: "Fütûhât-ı Mekkiyye", en: "al-Futuhat al-Makkiyya", pt: "al-Futuhat al-Makkiyya" })}</b> · ${cilt} · ${kisim} · ${sayfa}`;
    }
    const no = kun && kun.no ? `${tt(L.fass)} ${roman(kun.no)}` : `${tt(L.fass)}: ${belirtilmemis}`;
    const kim = kun && kun.prophet && kun.hikmet ? ` (${escapeHtmlKavram(tt(kun.prophet))}, ${escapeHtmlKavram(tt(kun.hikmet))})` : "";
    return `<b>${tt(L.kitapU)}</b> · ${no}${kim} · ${sayfa}`;
  }

  function gecisHtml(k, book, rec, ref, pas) {
    const yogun = rec.rol.includes("yogun");
    const oran = yogun && ref && ref.oran ? ref.oran : null;
    const baslik = ref ? tt(ref.title) : rec.id;
    let govde;
    if (rec.alinti) {
      const q = highlight(safeInline(tt(rec.alinti)), k.eslesenTerim);
      const basi = !!(rec.basi && rec.basi.includes(I18n ? I18n.getLang() : "tr"));
      govde =
        `<blockquote class="kavram-gecis__alinti">${q}</blockquote>` +
        `<p class="kavram-gecis__nit">${tt(L.okumaMetni)} ${rec.n}${basi ? " — " + tt(L.parBasi) : ""}</p>`;
    } else {
      govde = yokHtml();
    }
    const kun = pas && pas.kunyeler ? pas.kunyeler[rec.id] : null;
    return (
      `<article class="kavram-gecis${yogun ? " kavram-gecis--yogun" : ""}">` +
      `<span class="kavram-gecis__rol">${rolAdi(rec.rol)}${oran ? " · " + tt(L.yogunluk(Math.round(1000 / oran))) : ""}</span>` +
      `<h5 class="kavram-gecis__baslik">${escapeHtmlKavram(baslik)}</h5>` +
      govde +
      `<div class="kavram-kunye">${kunyeHtml(book, kun)}</div>` +
      crossLink(book, rec.id, "kavram-gecis__git", `${tt(book === "futuhat" ? L.ac : L.acF)} →`) +
      `</article>`
    );
  }

  function hepsiChip(book, id) {
    let text;
    if (book === "futuhat") {
      const m = /^c(\d+)k(\d+)$/.exec(id);
      text = m ? `${tt(L.cilt)} ${CILT_ROMAN[+m[1]] || m[1]} · ${tt(L.kisim)} ${roman(+m[2])}` : id;
    } else {
      const m = /^fs(\d+)$/.exec(id);
      text = m ? `${tt(L.fass)} ${roman(+m[1])}` : id;
    }
    return crossLink(book, id, "kavram-chip kavram-chip--link", text);
  }

  function mutalaaHtml(k, pas) {
    const out = [];
    if (k.otomatikEslesmeYok) {
      out.push(
        `<p class="kavram-note">${tt({
          tr: "Bu kavramın adı, yanlış-pozitif riskini azaltmak için uygulanan dört-harf eşiğinin altında kaldığından, otomatik konum taraması yapılmadı.",
          en: "This concept's name fell below the four-letter threshold used to reduce false positives, so no automatic location scan was run.",
          pt: "O nome deste conceito ficou abaixo do limite de quatro letras usado para reduzir falsos positivos, então nenhuma varredura automática de localização foi feita.",
        })}</p>`
      );
      return out.join("");
    }
    if (!k.futuhat && !k.fusus) {
      out.push(
        `<p class="kavram-note">${tt({
          tr: `"${k.eslesenTerim}" adı, taranan Fütûhât/Füsûs metinlerinde bulunamadı.`,
          en: `The name "${k.eslesenTerim}" was not found in the scanned Futuhat/Fusus text.`,
          pt: `O nome "${k.eslesenTerim}" não foi encontrado no texto de Futuhat/Fusus rastreado.`,
        })}</p>`
      );
      return out.join("");
    }
    const f = k.futuhat ? tt(L.sayimF.var(k.futuhat.toplamKisim)) : tt(L.sayimF.yok);
    const u = k.fusus ? tt(L.sayimU.var(k.fusus.toplamKisim)) : tt(L.sayimU.yok);
    out.push(`<ul class="kavram-sayim"><li>${f}</li><li>${u}</li></ul>`);
    const kayitlar = (pas && pas.pasajlar && pas.pasajlar[k.view + "/" + k.id]) || null;
    ["futuhat", "fusus"].forEach((book) => {
      const b = k[book];
      if (!b) return;
      out.push(`<h4 class="kavram-kitap">${tt(book === "futuhat" ? L.kitapF : L.kitapU)}</h4>`);
      out.push(miniTimelineHtml(book, b));
      const refs = {};
      [b.ilk, b.son, b.enYogun].forEach((r) => { if (r) refs[r.id] = Object.assign(refs[r.id] || {}, r); });
      if (kayitlar) {
        (kayitlar[book] || []).forEach((rec) => out.push(gecisHtml(k, book, rec, refs[rec.id], pas)));
      } else {
        out.push(`<p class="kavram-note">${tt(L.yuklenemedi)}</p>`);
      }
      if (b.hepsi && b.hepsi.length) {
        out.push(
          `<details class="kavram-hepsi"><summary>${tt(L.hepsi)} (${b.hepsi.length})</summary>` +
          `<div class="kavram-related__chips">${b.hepsi.map((id) => hepsiChip(book, id)).join("")}</div></details>`
        );
      }
    });
    out.push(`<p class="kavram-kucuk">${tt(L.uyari)}</p>`);
    return out.join("");
  }

  // ---- Hazine ----
  function hazineBlok(baslikKey, bodyHtml) {
    return `<div class="kavram-hz"><h4>${tt(L.h[baslikKey])}</h4>${bodyHtml || yokHtml()}</div>`;
  }

  function hazineHtml(k, info, hadisDizini) {
    const out = [];
    // (1) birlikte geçtiği esmâ: yıldız şeması + çipler (DOKUNULMAZ)
    if (k.birlikteEsma.length) {
      const maxOrtak = Math.max.apply(null, k.birlikteEsma.map((e) => e.ortakBolum));
      out.push(
        `<div class="kavram-hz kavram-related--birlikte"><h4>${tt(L.h.esma)}</h4>` +
        `<div class="kavram-minigraf-wrap" role="button" tabindex="0" aria-label="${tt({ tr: "Büyüt", en: "Enlarge", pt: "Ampliar" })}">${birlikteEsmaSvg(k)}</div>` +
        `<div class="kavram-related__chips">` +
        k.birlikteEsma.map((e) =>
          `<button type="button" class="kavram-chip${e.ortakBolum === maxOrtak ? " kavram-chip--guclu" : ""}" data-view="esma" data-id="${e.id}">${tt(e.isim)} <span class="kavram-chip__n">${e.ortakBolum}</span></button>`
        ).join("") + `</div></div>`
      );
    } else {
      out.push(hazineBlok("esma", ""));
    }
    // (2) sırlar, (3) çizimler
    out.push(hazineBlok("sirlar", k.ilgiliSirlar.length
      ? `<div class="kavram-related__chips">` + k.ilgiliSirlar.map((s) => `<button type="button" class="kavram-chip" data-view="sirlar" data-id="${s.id}">${tt(s.topic)}</button>`).join("") + `</div>` : ""));
    out.push(hazineBlok("cizimler", k.ilgiliCizimler.length
      ? `<div class="kavram-related__chips">` + k.ilgiliCizimler.map((c) => `<button type="button" class="kavram-chip" data-view="cizimler" data-id="${c.id}">${tt(c.name)}</button>`).join("") + `</div>` : ""));
    // (4) âyetler: ilk 5 görünür, kalanı açılır (sitenin ayet-onizleme.js mekanizması: hover/odak)
    const ayetChip = (r) => `<span class="kavram-chip kavram-chip--static ayet-ref" data-ayet="${r}" tabindex="0">${r}</span>`;
    let ayetBody = "";
    if (k.ilgiliAyet.length) {
      const ilk = k.ilgiliAyet.slice(0, 5), kalan = k.ilgiliAyet.slice(5);
      ayetBody = `<div class="kavram-related__chips">${ilk.map(ayetChip).join("")}</div>` +
        (kalan.length ? `<details class="kavram-hepsi"><summary>${tt(L.daha(kalan.length))}</summary><div class="kavram-related__chips">${kalan.map(ayetChip).join("")}</div></details>` : "");
    }
    out.push(hazineBlok("ayet", ayetBody));
    // (5) hadis: yalnız hangi kısımlarda geçtiği tutuluyor (metin veride yok)
    let hadisBody = "";
    if (k.ilgiliHadis.length) {
      hadisBody = `<div class="kavram-related__chips">` + k.ilgiliHadis.map((r) => {
        const n = hadisDizini && hadisDizini.dizin && hadisDizini.dizin[r] ? hadisDizini.dizin[r].length : 0;
        return `<span class="kavram-chip kavram-chip--static hadis-ref" data-hadis="${r}" tabindex="0">${r}${n ? ` <span class="kavram-chip__n">${tt(L.hadisYerde(n))}</span>` : ""}</span>`;
      }).join("") + `</div><p class="kavram-kucuk">${tt(L.hadisNot)}</p>`;
    }
    out.push(hazineBlok("hadis", hadisBody));
    // (6) kaynaklar, (7) okurken biriken notlar
    if (info) {
      out.push(hazineBlok("kaynak", info.kaynaklar.length ? `<ul class="kavram-liste">${info.kaynaklar.map((s) => `<li>${escapeHtmlKavram(s)}</li>`).join("")}</ul>` : ""));
      if (info.notlar) {
        out.push(
          `<div class="kavram-hz"><details class="kavram-hepsi"><summary>${tt(L.h.notlar)} (${info.notlar.length})</summary>` +
          (info.notlar.length
            ? `<ul class="kavram-liste">${info.notlar.map((i) => `<li><span class="kavram-kucuk">${tt(L.ciltNot(i.volume))}</span><br>${escapeHtmlKavram(tt(i.text))}</li>`).join("")}</ul>`
            : yokHtml()) +
          `</details></div>`
        );
      }
    } else {
      out.push(`<div class="kavram-hz"><h4>${tt(L.h.kaynak)}</h4><p class="kavram-note">${tt(L.yuklenemedi)}</p></div>`);
    }
    return out.join("");
  }

  // ---- derinlik ipi: kaydırınca aria-current, tıklayınca bölüm başlığına odak ----
  let ipObserver = null;
  function reducedMotion() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function setCurrent(id) {
    detailEl.querySelectorAll(".kavram-ip a").forEach((a) => a.setAttribute("aria-current", String(a.dataset.k === id)));
  }
  function setupIp() {
    if (ipObserver) { ipObserver.disconnect(); ipObserver = null; }
    const secs = KATMANLAR.map((i) => detailEl.querySelector("#" + i)).filter(Boolean);
    if (typeof IntersectionObserver === "function") {
      ipObserver = new IntersectionObserver((es) => {
        es.forEach((e) => { if (e.isIntersecting) setCurrent(e.target.id); });
      }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
      secs.forEach((s) => ipObserver.observe(s));
    }
    setCurrent("nefes");
    detailEl.querySelectorAll(".kavram-ip a").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const id = a.dataset.k;
        const sec = detailEl.querySelector("#" + id);
        if (!sec) return;
        sec.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
        try { history.replaceState(history.state, "", location.pathname + location.search + "#" + id); } catch (err) { /* sessiz */ }
        const h = sec.querySelector("h3");
        if (h) h.focus({ preventScroll: true });
        setCurrent(id);
      });
    });
  }

  function renderDetail(k, pas, src, hadisDizini) {
    listEl.hidden = true;
    detailEl.hidden = false;
    wrapEl.classList.add("kavram-wrap--detay");
    wrapEl.classList.remove("kavram-wrap--liste");
    const info = sourceInfo(k.view, src && src.get(k.id));
    const sohbetHtml = !src
      ? `<p class="kavram-note">${tt(L.yuklenemedi)}</p>`
      : info && info.sohbet.length
        ? info.sohbet.map((d) => `<p class="kavram-sohbet__p">${escapeHtmlKavram(tt(d))}</p>`).join("")
        : yokHtml();
    const nefesHtml = !src
      ? `<p class="kavram-note">${tt(L.yuklenemedi)}</p>`
      : info && info.nefes && tt(info.nefes)
        ? `<p class="kavram-nefes">${escapeHtmlKavram(tt(info.nefes))}</p>`
        : yokHtml();
    const analogyVisible = !(window.DostAnalogy && !window.DostAnalogy.visible());
    let benzetmeHtml = "";
    if (analogyVisible && src) {
      benzetmeHtml = info && info.analogy && tt(info.analogy)
        ? `<aside class="kavram-benzetme"><span class="kavram-benzetme__etiket">${tt(L.benzetme)}</span><p>${escapeHtmlKavram(tt(info.analogy))}</p></aside>`
        : `<p class="kavram-yok">${tt(L.benzetme)}: ${tt(L.yok)}</p>`;
    }

    const ip =
      `<nav class="kavram-ip" aria-label="${tt(L.ipAria)}"><ol>` +
      KATMANLAR.map((id) => `<li><a href="#${id}" data-k="${id}"><span>${tt(L.katman[id])}</span></a></li>`).join("") +
      `</ol></nav>`;

    const backLabel = tt({ tr: "← Tüm kavramlar", en: "← All concepts", pt: "← Todos os conceitos" });
    detailEl.innerHTML =
      `<p class="kavram-detail__back"><button type="button" class="kavram-back-link">${backLabel}</button></p>` +
      `<h2 class="kavram-detail__title">${tt(k.isim)}</h2>` +
      `<div class="kavram-detail__body">${ip}<div class="kavram-katmanlar">` +
      `<section class="kavram-katman kavram-katman--1" id="nefes" aria-labelledby="nefes-b">${katmanBas("nefes", 1)}${nefesHtml}` +
      `<p class="kavram-detail__source">${tt({ tr: "Kaynak görünüm", en: "Source view", pt: "Visão de origem" })}: ` +
      `<button type="button" class="kavram-source-link" data-view="${k.view}" data-id="${k.id}">${tt(VIEW_LABEL[k.view])}</button></p></section>` +
      `<section class="kavram-katman kavram-katman--2" id="sohbet" aria-labelledby="sohbet-b">${katmanBas("sohbet", 2)}${sohbetHtml}${benzetmeHtml}</section>` +
      `<section class="kavram-katman kavram-katman--3" id="mutalaa" aria-labelledby="mutalaa-b">${katmanBas("mutalaa", 3)}${mutalaaHtml(k, pas)}</section>` +
      `<section class="kavram-katman kavram-katman--4" id="hazine" aria-labelledby="hazine-b">${katmanBas("hazine", 4)}<div id="kavram-hazine-ic"></div>` +
      `<p class="kavram-yontem">${tt({
        tr: "Yöntem: kavramın adı, kısım/fass metinlerinde kelime-sınırlı bir taramayla arandı; yoğunluk, ham sayı değil \"binde kaç kelimede bir\" oranıdır (uzun bölümler otomatik \"en yoğun\" çıkmasın diye). Bu YAKLAŞIK bir tarama, kesin bir dizin değil.",
        en: "Method: the concept's name was searched with a word-boundary scan across part/chapter text; density is a per-thousand-word rate, not a raw count (so long parts aren't automatically \"densest\"). This is an APPROXIMATE scan, not an exact index.",
        pt: "Método: o nome do conceito foi buscado com uma varredura de limite de palavra no texto das partes/capítulos; a densidade é uma taxa por mil palavras, não uma contagem bruta (para que partes longas não sejam automaticamente \"mais densas\"). Esta é uma varredura APROXIMADA, não um índice exato.",
      })} ${tt(L.yontem2)}</p>` +
      `</section></div></div>`;

    // Hazine'nin hadis sayıları hadis-dizini'nden (yalnız hadis varsa indirilir; showId bekler)
    detailEl.querySelector("#kavram-hazine-ic").innerHTML = hazineHtml(k, info, hadisDizini);
    bindDetail(k);
    setupIp();
    applyHashScroll();
  }

  function bindDetail(k) {
    const back = detailEl.querySelector(".kavram-back-link");
    if (back && !back.dataset.bound) {
      back.dataset.bound = "1";
      // window.__dostNav.goTo("kavram", undefined) burada İŞE YARAMAZ:
      // setMainView zaten "kavram" görünümündeyken (bkz. currentMainView ===
      // view erken çıkışı) hiçbir şey tetiklemiyor -- liste hâline dönmek
      // için modülün kendi showId()'sini doğrudan çağırıp URL'i ayrıca
      // güncelliyoruz (elle test edilip yakalandı: "Tüm kavramlar" linki
      // tıklamaya tepki vermiyordu).
      back.addEventListener("click", () => {
        showId(undefined);
        window.__dostNav && window.__dostNav.setHash("kavram");
      });
    }
    detailEl.querySelectorAll("button[data-view]").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => nav(btn.dataset.view, btn.dataset.id || undefined));
    });
    const minigrafWrap = detailEl.querySelector(".kavram-minigraf-wrap");
    if (minigrafWrap && !minigrafWrap.dataset.bound) {
      minigrafWrap.dataset.bound = "1";
      minigrafWrap.addEventListener("click", () => openMinigrafLightbox(k));
      minigrafWrap.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openMinigrafLightbox(k);
        }
      });
    }
  }

  // /kavram/<view>/<id>/#mutalaa ile açılan adres doğru bölüme kaydırsın.
  // (Yol yönlendirici yalnız pathname'i okur; parça (#) ona dokunmaz.)
  function applyHashScroll() {
    const m = /^#(nefes|sohbet|mutalaa|hazine)$/.exec(location.hash || "");
    if (!m) return;
    const sec = detailEl.querySelector("#" + m[1]);
    if (!sec) return;
    requestAnimationFrame(() => {
      sec.scrollIntoView({ behavior: "auto", block: "start" });
      setCurrent(m[1]);
    });
  }

  let currentId; // "view/id" ya da undefined (liste hâli) -- dil değişince yeniden çizmek için

  let renderToken = 0;
  function showId(id) {
    currentId = id;
    const k = id && byKey.get(id);
    const token = ++renderToken;
    if (!k) {
      if (ipObserver) { ipObserver.disconnect(); ipObserver = null; }
      renderList();
      return;
    }
    // Nefes/Sohbet metni görünüme göre kaynak dosyadan, Mütalaa alıntıları
    // kavram-pasajlar.json'dan gelir; hepsi gelmeden çizilmez (sayfa sonradan
    // uzayıp kaymasın -- CLS). Önbellekte olunca dil değişimi anında çizer.
    if (window.DostViewStatus) window.DostViewStatus.showLoading("kavram-wrap");
    Promise.all([
      fetchPasajlar(),
      fetchSource(k.view),
      k.ilgiliHadis.length ? fetchHadisDizini() : Promise.resolve(null),
    ]).then(([pas, src, hadis]) => {
      if (window.DostViewStatus) window.DostViewStatus.hide("kavram-wrap");
      if (token !== renderToken) return;
      renderDetail(k, pas, src, hadis);
    });
  }

  let pendingId;
  return {
    activate() {
      fetchData().then((ok) => {
        if (!ok) return;
        showId(pendingId);
        pendingId = undefined;
      });
    },
    goToNode(id) {
      pendingId = id;
      fetchData().then((ok) => {
        if (!ok) return;
        showId(id);
        pendingId = undefined;
      });
    },
    onLangChange() {
      if (!kavramlar.length) return;
      showId(currentId);
    },
  };
})();
