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

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)

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
      // Etiket ortalanmış (text-anchor:middle) kalırsa kenara yakın
      // düğümlerde (sol/sağ) metnin yarısı viewBox dışına taşıp
      // kırpılıyordu (UI denetimi bulgusu, 206 kavram sayfasının %61'i).
      // futuhat.js'in radyal ağacındaki AYNI çözüm: yatayda merkeze göre
      // hangi tarafta olduğuna bakıp metni merkeze doğru (boşluğun olduğu
      // yöne) büyüt, kenara doğru değil.
      // tx = x (kaydırma yok): "start" metni tam x'ten sağa, "end" metni tam
      // x'ten sola büyütür -- yani hiçbir karakter düğümün kendi x'inden
      // KENARA doğru taşmıyor, yalnız merkeze doğru büyüyor.
      const anchor = x <= cx ? "start" : "end";
      // Yön düzeltmesi tek başına yetmiyor: "Ar-Rahim (The Especially
      // Merciful)" gibi ad+çeviri birleşik etiketler, merkeze en yakın
      // düğümde bile ayrılan tek yönlü boşluğu (~110px) aşıyordu (ölçüldü).
      // Merkeze uzaklığa göre kalan boşluk tahmin edilip (~6.4px/karakter,
      // codebase'in başka yerlerinde de kullanılan aynı kaba oran) gerekirse
      // "…" ile kısaltılıyor -- merkez etiketin zaten yaptığı gibi (aşağıda,
      // .slice(0,10)), yalnız burada sabit değil mesafeye göre.
      const isim = tt(e.isim);
      const room = anchor === "start" ? 220 - x : x;
      const maxChars = Math.max(6, Math.floor(room / 6.4));
      const etiket = isim.length > maxChars ? isim.slice(0, maxChars - 1) + "…" : isim;
      parts.push(
        `<circle class="kavram-minigraf__node" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" style="fill:hsl(${nodeHue} 75% 68% / ${(0.75 + strength * 0.25).toFixed(2)})"></circle>` +
          `<text class="kavram-minigraf__label" x="${x.toFixed(1)}" y="${(y + r + 13).toFixed(1)}" text-anchor="${anchor}"><title>${escapeHtmlKavram(isim)}</title>${escapeHtmlKavram(etiket)}</text>`
      );
    });
    // Merkez dairenin yarıçapı (20px) sabit -- ama etiket eskiden sabit
    // 10 karakterde kesiliyordu, dairenin gerçek genişliğinden bağımsız.
    // Kalın (600) 14px'lik bir yazı için 10 karakter dairenin iki katından
    // fazla taşıyor ve kenar çizgileriyle çakışıyordu (UI denetimi bulgusu).
    // Uydu etiketlerindeki aynı mesafe-tabanlı yaklaşım burada da geçerli.
    const merkezIsim = tt(k.isim);
    const merkezRoom = 2 * 20 - 8;
    const merkezMaxChars = Math.max(3, Math.floor(merkezRoom / 6.4));
    const merkezEtiket = merkezIsim.length > merkezMaxChars ? merkezIsim.slice(0, merkezMaxChars - 1) + "…" : merkezIsim;
    parts.push(
      `<circle class="kavram-minigraf__center" cx="${cx}" cy="${cy}" r="20" style="fill:hsl(${hue} 55% 45%)"></circle>` +
        `<text class="kavram-minigraf__center-label" x="${cx}" y="${cy + 4}" text-anchor="middle"><title>${escapeHtmlKavram(merkezIsim)}</title>${escapeHtmlKavram(merkezEtiket)}</text>`
    );
    const label = escapeHtmlKavram(
      tt({
        tr: "Birlikte en çok geçtiği isimlerle ilişki şeması",
        en: "Diagram of relation to most co-occurring Names",
        pt: "Diagrama de relação com os Nomes mais coocorrentes",
      })
    );
    return `<svg class="kavram-minigraf" viewBox="0 0 220 236" role="img" aria-label="${label}">` + parts.join("") + `</svg>`;
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

  // D9 "Bir kavramın bütün ömrü (anlamsal)" -- kavram-hayati.json'un KELİME
  // eşleşmesinin (ilk/son/en-yoğun) kaçırdığı, aynı kavramı FARKLI
  // kelimelerle konuşan pasajları embedding benzerliğiyle bulan ayrı bir
  // veri seti (data/kavramlar/<id>.json, scripts/kavram-vektoru-uret.mjs +
  // scripts/kavram-vektoru-onay.mjs). Şimdilik yalnız bir pilot kavram için
  // üretildi -- kayıt burada elle tutuluyor, her kısım için 404 denemek
  // yerine.
  const KAVRAM_VEKTORU_IDS = new Set(["perde"]);
  const vektoruCache = new Map(); // id -> Promise<data|null>
  function fetchKavramVektoru(id) {
    if (vektoruCache.has(id)) return vektoruCache.get(id);
    const p = GU.fetchJson("data/kavramlar/" + id + ".json").catch(() => null);
    vektoruCache.set(id, p);
    return p;
  }

  function anlamsalOmurItemHtml(item, gosterSkor) {
    const skorBar = gosterSkor
      ? `<span class="kavram-anlamsal__skor" style="--skor:${Math.max(0, item.skor).toFixed(3)}" title="${(item.skor * 100).toFixed(1)}%"></span>`
      : "";
    const gerekce = item.gerekce
      ? `<span class="futuhat-anlamsal-box__sebep">${tt(item.gerekce)}</span>`
      : `<span class="futuhat-anlamsal-box__sebep">${tt(item.ozet)}</span>`;
    return `<a class="futuhat-anlamsal-box__item kavram-anlamsal__item" href="${item.route.replace(/^\//, "")}" data-nav-route="${item.route}">` +
      skorBar +
      `<span class="futuhat-anlamsal-box__title">${tt(item.baslik)}</span>` +
      gerekce +
      `</a>`;
  }

  // "perde" kavramının iki bağımsız sahnesi var (meditasyon.html'in içinde
  // gömülü perde-zinciri.html + ayna-metaforu.html) ama hiçbir yerden
  // linklenmiyordu (2026-08-04 taramasında ölçüldü). Bu kavramdan daha
  // doğal bir bağlama noktası yok.
  function perdeSahneHtml(k) {
    if (k.view !== "ontoloji" || k.id !== "perde") return "";
    const base = window.__dostRouteBase || "";
    return `<div class="detail-gate detail-gate--sahne kavram-perde-sahne">
      <p class="detail-gate__note">${tt({
        tr: "İki ayrı sahne, perde ile aynayı sürüklenerek keşfedilebilen bir hâle getiriyor: perdenin zincirlenmesi, ve Hakk'ın kulun aynasında görünmesi.",
        en: "Two separate scenes turn the veil and the mirror into something you can explore by dragging: the veil's chaining, and the Real appearing in the servant's mirror.",
        pt: "Duas cenas separadas transformam o véu e o espelho em algo que se pode explorar arrastando: o encadeamento do véu, e o Real aparecendo no espelho do servo.",
      })}</p>
      <a class="detail-gate__btn" href="${base}/meditasyon.html">${tt({
        tr: "Sahneleri aç: Perde Zinciri, Ayna Metaforu",
        en: "Open the scenes: Chain of Veils, Mirror Metaphor",
        pt: "Abrir as cenas: Cadeia de Véus, Metáfora do Espelho",
      })}<span class="detail-gate__arrow" aria-hidden="true">→</span></a>
    </div>`;
  }

  function renderAnlamsalOmur(k, mount) {
    if (!KAVRAM_VEKTORU_IDS.has(k.id)) { mount.innerHTML = ""; return; }
    mount.innerHTML = `<div class="futuhat-anlamsal-box futuhat-anlamsal-box--deneysel kavram-anlamsal">
      <p class="futuhat-anlamsal-box__eyebrow">${tt({
        tr: "Bir kavramın bütün ömrü — anlamsal (deneysel)",
        en: "The whole life of a concept — semantic (experimental)",
        pt: "Toda a vida de um conceito — semântica (experimental)",
      })}</p>
      <p class="futuhat-anlamsal-box__not">${tt({
        tr: "Yukarıdaki ilk/son/en-yoğun taraması kelimenin KENDİSİNİ arıyor. Burada, aynı kavramı FARKLI kelimelerle konuşan pasajları embedding benzerliğiyle arıyoruz.",
        en: "The first/last/densest scan above searches for the word ITSELF. Here we search for passages that speak of the same concept in DIFFERENT words, by embedding similarity.",
        pt: "A varredura primeira/última/mais-densa acima busca a própria palavra. Aqui buscamos passagens que falam do mesmo conceito com OUTRAS palavras, por similaridade de embedding.",
      })}</p>
      <p class="kavram-anlamsal__yukleniyor">${tt({ tr: "Yükleniyor…", en: "Loading…", pt: "Carregando…" })}</p>
    </div>`;
    fetchKavramVektoru(k.id).then((d) => {
      if (!d) { mount.innerHTML = ""; return; }
      const bagli = [...d.cekirdek, ...d.sonuclar.filter((s) => s.verified)];
      const adaylar = d.sonuclar.filter((s) => !s.verified);
      const box = mount.querySelector(".kavram-anlamsal");
      const yukleniyor = mount.querySelector(".kavram-anlamsal__yukleniyor");
      if (yukleniyor) yukleniyor.remove();
      const tabsHtml = `<div class="kavram-anlamsal__tabs" role="tablist">
          <button type="button" class="kavram-anlamsal__tab kavram-anlamsal__tab--active" data-tab="bagli" role="tab" aria-selected="true">${tt({ tr: "Bağlantılar", en: "Connections", pt: "Conexões" })} (${bagli.length})</button>
          <button type="button" class="kavram-anlamsal__tab" data-tab="aday" role="tab" aria-selected="false">${tt({ tr: "Adaylar", en: "Candidates", pt: "Candidatos" })} (${adaylar.length})</button>
        </div>
        <div class="kavram-anlamsal__panel" data-panel="bagli">${bagli.map((it) => anlamsalOmurItemHtml(it, false)).join("") || `<p class="futuhat-anlamsal-box__not">${tt({ tr: "Henüz onaylanmış bağlantı yok.", en: "No confirmed connections yet.", pt: "Ainda sem conexões confirmadas." })}</p>`}</div>
        <div class="kavram-anlamsal__panel" data-panel="aday" hidden>${adaylar.map((it) => anlamsalOmurItemHtml(it, true)).join("")}</div>`;
      box.insertAdjacentHTML("beforeend", tabsHtml);
      box.querySelectorAll(".kavram-anlamsal__tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          box.querySelectorAll(".kavram-anlamsal__tab").forEach((b) => {
            b.classList.toggle("kavram-anlamsal__tab--active", b === btn);
            b.setAttribute("aria-selected", b === btn ? "true" : "false");
          });
          box.querySelectorAll(".kavram-anlamsal__panel").forEach((p) => {
            p.hidden = p.dataset.panel !== btn.dataset.tab;
          });
        });
      });
      box.querySelectorAll(".kavram-anlamsal__item").forEach((a) => {
        a.addEventListener("click", (e) => {
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          const route = a.dataset.navRoute || "";
          const m = /^\/futuhat\/([a-z0-9]+)\/?$/.exec(route);
          if (m) nav("futuhat", m[1]);
        });
      });
    });
  }

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
  // Halkanın rengi ONCE görünüme göre değişiyordu (ontoloji/esma/terimler ayrı
  // ton) -- kullanıcı 2026-08-04'te bunun "yoğunluk" göstergesi olarak site
  // genelinde tek renge (Füsûs sarmalının düğüm rengi, --helix-gold-rim)
  // getirilmesini istedi.
  function kavramGaugeSvg(frac) {
    const f = Math.max(0.05, Math.min(1, frac));
    const off = KAVRAM_GAUGE_C * (1 - f);
    return `<svg class="kavram-tile__gauge" viewBox="0 0 22 22" aria-hidden="true">
      <circle class="kavram-tile__gauge-track" cx="11" cy="11" r="${KAVRAM_GAUGE_R}"></circle>
      <circle class="kavram-tile__gauge-arc" cx="11" cy="11" r="${KAVRAM_GAUGE_R}"
        stroke-dasharray="${KAVRAM_GAUGE_C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"></circle>
    </svg>`;
  }

  function renderList() {
    detailEl.hidden = true;
    listEl.hidden = false;
    const groups = { ontoloji: [], esma: [], terimler: [] };
    kavramlar.forEach((k) => groups[k.view].push(k));
    Object.keys(groups).forEach((v) => groups[v].sort((a, b) => tt(a.isim).localeCompare(tt(b.isim), "tr")));
    const intro = tt({
      tr: "Her kavramın, Fütûhât-ı Mekkiyye ve Füsûsu'l-Hikem boyunca nerede ilk geçtiği, nerede en yoğun göründüğü ve hangi sır/çizim/âyet/hadisle birlikte anıldığına dair, veriden türetilmiş bir özet. Bu bir iddia değil, bir tarama denemesi -- yöntem sayfanın altında.",
      en: "A data-derived summary of where each concept first appears across the Meccan Revelations and the Bezels of Wisdom, where it appears most densely, and which mystery/diagram/verse/hadith it's recorded alongside. Not a claim -- a scanning attempt; method noted at the page's foot.",
      pt: "Um resumo derivado de dados de onde cada conceito aparece pela primeira vez nas Revelações de Meca e nos Engastes da Sabedoria, onde aparece com mais densidade, e com qual mistério/diagrama/versículo/hadith é registrado junto. Não uma afirmação -- uma tentativa de varredura; o método está ao pé da página.",
    });
    const gaugeNote = tt({
      tr: "Her adın yanındaki halka, o kavram için ne kadar malzeme biriktiğini gösterir -- kısım/fass sayısı, birlikte anıldığı esmâ, ilişkili sır/çizim/âyet/hadis toplanarak (kendi grubu içinde ölçeklenmiş).",
      en: "The ring beside each name shows how much material has accumulated for that concept -- part/chapter count, co-occurring Names, and related mysteries/diagrams/verses/hadiths added together (scaled within its own group).",
      pt: "O anel ao lado de cada nome mostra quanto material se acumulou para aquele conceito -- número de partes/capítulos, Nomes coocorrentes, e mistérios/diagramas/versículos/hadiths relacionados somados (escalado dentro do próprio grupo).",
    });
    listEl.innerHTML =
      `<p class="kavram-list__intro">${intro}</p>` +
      `<p class="kavram-list__intro kavram-list__intro--gauge">${gaugeNote}</p>` +
      Object.keys(groups)
        .map((v) => {
          const items = groups[v];
          const scores = items.map(zenginlikSkoru);
          const lo = Math.min.apply(null, scores), hi = Math.max.apply(null, scores);
          return (
            `<div class="kavram-list__group"><h2>${tt(VIEW_LABEL[v])}</h2><div class="kavram-list__grid">` +
            items
              .map((k, i) => {
                const frac = hi === lo ? 0.5 : (scores[i] - lo) / (hi - lo);
                return (
                  `<button type="button" class="kavram-tile" data-view="${k.view}" data-id="${k.id}" title="${escapeHtmlKavram(tt(k.isim))}">` +
                  kavramGaugeSvg(frac) +
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

  function bookBlock(label, book) {
    if (!book) return "";
    const rows = [
      [tt({ tr: "İlk geçtiği yer", en: "First appears", pt: "Primeira aparição" }), book.ilk],
      [tt({ tr: "Son geçtiği yer", en: "Last appears", pt: "Última aparição" }), book.son],
      [tt({ tr: "En yoğun geçtiği yer", en: "Densest appearance", pt: "Aparição mais densa" }), book.enYogun],
    ];
    const view = label === "futuhat" ? "futuhat" : "fusus";
    return (
      `<div class="kavram-book"><h3>${label === "futuhat"
        ? tt({ tr: "Fütûhât-ı Mekkiyye'de", en: "In the Meccan Revelations", pt: "Nas Revelações de Meca" })
        : tt({ tr: "Füsûsu'l-Hikem'de", en: "In the Bezels of Wisdom", pt: "Nos Engastes da Sabedoria" })
      } (${book.toplamKisim} ${label === "futuhat"
        ? tt({ tr: "kısımda", en: "parts", pt: "partes" })
        : tt({ tr: "fassta", en: "chapters", pt: "capítulos" })
      })</h3>` +
      miniTimelineHtml(label, book) +
      rows
        .map(
          ([l, ref], i) =>
            `<button type="button" class="kavram-bookref${i === 2 ? " kavram-bookref--yogun" : ""}" data-view="${view}" data-id="${ref.id}">` +
            `<span class="kavram-bookref__label">${l}</span>` +
            `<span class="kavram-bookref__title">${tt(ref.title)}</span>` +
            (ref.oran != null ? `<span class="kavram-bookref__oran">${ref.oran}‰</span>` : "") +
            `</button>`
        )
        .join("") +
      `</div>`
    );
  }

  function renderDetail(k) {
    listEl.hidden = true;
    detailEl.hidden = false;
    const parts = [];
    parts.push(`<p class="kavram-detail__back"><button type="button" class="kavram-back-link">${tt({
      tr: "← Tüm kavramlar", en: "← All concepts", pt: "← Todos os conceitos",
    })}</button></p>`);
    parts.push(`<h2 class="kavram-detail__title">${tt(k.isim)}</h2>`);
    parts.push(
      `<p class="kavram-detail__source">${tt({
        tr: "Kaynak görünüm", en: "Source view", pt: "Visão de origem",
      })}: <button type="button" class="kavram-source-link" data-view="${k.view}" data-id="${k.id}">${tt(VIEW_LABEL[k.view])}</button></p>`
    );
    parts.push(perdeSahneHtml(k));

    if (k.otomatikEslesmeYok) {
      parts.push(
        `<p class="kavram-note">${tt({
          tr: "Bu kavramın adı, yanlış-pozitif riskini azaltmak için uygulanan dört-harf eşiğinin altında kaldığından, otomatik konum taraması yapılmadı.",
          en: "This concept's name fell below the four-letter threshold used to reduce false positives, so no automatic location scan was run.",
          pt: "O nome deste conceito ficou abaixo do limite de quatro letras usado para reduzir falsos positivos, então nenhuma varredura automática de localização foi feita.",
        })}</p>`
      );
    } else {
      if (!k.futuhat && !k.fusus) {
        parts.push(
          `<p class="kavram-note">${tt({
            tr: `"${k.eslesenTerim}" adı, taranan Fütûhât/Füsûs metinlerinde bulunamadı.`,
            en: `The name "${k.eslesenTerim}" was not found in the scanned Futuhat/Fusus text.`,
            pt: `O nome "${k.eslesenTerim}" não foi encontrado no texto de Futuhat/Fusus rastreado.`,
          })}</p>`
        );
      }
      parts.push(bookBlock("futuhat", k.futuhat));
      parts.push(bookBlock("fusus", k.fusus));
    }

    if (k.birlikteEsma.length) {
      const maxOrtak = Math.max.apply(null, k.birlikteEsma.map((e) => e.ortakBolum));
      parts.push(
        `<div class="kavram-related kavram-related--birlikte"><h3>${tt({
          tr: "Birlikte en çok geçtiği esmâ", en: "Most co-occurring Names", pt: "Nomes mais coocorrentes",
        })}</h3>` +
          `<div class="kavram-minigraf-wrap" role="button" tabindex="0" aria-label="${tt({
            tr: "Büyüt", en: "Enlarge", pt: "Ampliar",
          })}">${birlikteEsmaSvg(k)}</div>` +
          `<div class="kavram-related__chips">` +
          k.birlikteEsma
            .map(
              (e) =>
                `<button type="button" class="kavram-chip${e.ortakBolum === maxOrtak ? " kavram-chip--guclu" : ""}" data-view="esma" data-id="${e.id}">${tt(e.isim)} <span class="kavram-chip__n">${e.ortakBolum}</span></button>`
            )
            .join("") +
          `</div></div>`
      );
    }
    if (k.ilgiliSirlar.length) {
      parts.push(
        `<div class="kavram-related"><h3>${tt({ tr: "İlişkili sırlar", en: "Related mysteries", pt: "Mistérios relacionados" })}</h3><div class="kavram-related__chips">` +
          k.ilgiliSirlar.map((s) => `<button type="button" class="kavram-chip" data-view="sirlar" data-id="${s.id}">${tt(s.topic)}</button>`).join("") +
          `</div></div>`
      );
    }
    if (k.ilgiliCizimler.length) {
      parts.push(
        `<div class="kavram-related"><h3>${tt({ tr: "İlişkili çizimler", en: "Related diagrams", pt: "Diagramas relacionados" })}</h3><div class="kavram-related__chips">` +
          k.ilgiliCizimler.map((c) => `<button type="button" class="kavram-chip" data-view="cizimler" data-id="${c.id}">${tt(c.name)}</button>`).join("") +
          `</div></div>`
      );
    }
    if (k.ilgiliAyet.length || k.ilgiliHadis.length) {
      // Kullanıcı notu (2026-08-02): künyeler düz metindi, hover ile âyeti/
      // hadisi görme imkânı yoktu -- sitede zaten var olan ayet-onizleme.js
      // tooltip sistemine (.ayet-ref/data-ayet, .hadis-ref/data-hadis)
      // bağlanıyoruz, yeni bir JS mekanizması gerekmiyor.
      const chips = [
        ...k.ilgiliAyet.map((r) => `<span class="kavram-chip kavram-chip--static ayet-ref" data-ayet="${r}" tabindex="0">${r}</span>`),
        ...k.ilgiliHadis.map((r) => `<span class="kavram-chip kavram-chip--static hadis-ref" data-hadis="${r}" tabindex="0">${r}</span>`),
      ].join("");
      parts.push(
        `<div class="kavram-related"><h3>${tt({ tr: "Birlikte anılan âyet/hadis", en: "Verses/hadiths cited alongside", pt: "Versículos/hadiths citados junto" })}</h3><div class="kavram-related__chips">${chips}</div></div>`
      );
    }

    parts.push(
      `<p class="kavram-yontem">${tt({
        tr: "Yöntem: kavramın adı, kısım/fass metinlerinde kelime-sınırlı bir taramayla arandı; yoğunluk, ham sayı değil \"binde kaç kelimede bir\" oranıdır (uzun bölümler otomatik \"en yoğun\" çıkmasın diye). Bu YAKLAŞIK bir tarama, kesin bir dizin değil.",
        en: "Method: the concept's name was searched with a word-boundary scan across part/chapter text; density is a per-thousand-word rate, not a raw count (so long parts aren't automatically \"densest\"). This is an APPROXIMATE scan, not an exact index.",
        pt: "Método: o nome do conceito foi buscado com uma varredura de limite de palavra no texto das partes/capítulos; a densidade é uma taxa por mil palavras, não uma contagem bruta (para que partes longas não sejam automaticamente \"mais densas\"). Esta é uma varredura APROXIMADA, não um índice exato.",
      })}</p>`
    );
    parts.push(`<div class="kavram-anlamsal-mount"></div>`);

    detailEl.innerHTML = parts.join("");
    renderAnlamsalOmur(k, detailEl.querySelector(".kavram-anlamsal-mount"));
    // window.__dostNav.goTo("kavram", undefined) burada İŞE YARAMAZ:
    // setMainView zaten "kavram" görünümündeyken (bkz. currentMainView ===
    // view erken çıkışı) hiçbir şey tetiklemiyor -- liste hâline dönmek
    // için modülün kendi showId()'sini doğrudan çağırıp URL'i ayrıca
    // güncelliyoruz (elle test edilip yakalandı: "Tüm kavramlar" linki
    // tıklamaya tepki vermiyordu).
    detailEl.querySelector(".kavram-back-link").addEventListener("click", () => {
      showId(undefined);
      window.__dostNav && window.__dostNav.setHash("kavram");
    });
    detailEl.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => nav(btn.dataset.view, btn.dataset.id || undefined));
    });
    const minigrafWrap = detailEl.querySelector(".kavram-minigraf-wrap");
    if (minigrafWrap) {
      minigrafWrap.addEventListener("click", () => openMinigrafLightbox(k));
      minigrafWrap.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openMinigrafLightbox(k);
        }
      });
    }
  }

  let currentId; // "view/id" ya da undefined (liste hâli) -- dil değişince yeniden çizmek için

  function showId(id) {
    currentId = id;
    const k = id && byKey.get(id);
    if (k) renderDetail(k);
    else renderList();
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
