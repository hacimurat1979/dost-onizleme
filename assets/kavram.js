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
  // Kaynak türüne göre kırılım -- zenginlikSkoru'nun TOPLAMını oluşturan altı
  // bileşen. otomatikEslesmeYok durumunda (eski davranışla aynı) hepsi 0:
  // "bu kavram için otomatik tarama güvenilir değil" demek, kısmi bir kırılım
  // göstermek yanıltıcı olurdu.
  function kzrKirilim(k) {
    if (k.otomatikEslesmeYok) {
      return { kisim: 0, esma: 0, sir: 0, cizim: 0, ayet: 0, hadis: 0 };
    }
    return {
      kisim: (k.futuhat ? k.futuhat.toplamKisim : 0) + (k.fusus ? k.fusus.toplamKisim : 0),
      esma: k.birlikteEsma.length,
      sir: k.ilgiliSirlar.length,
      cizim: k.ilgiliCizimler.length,
      ayet: k.ilgiliAyet.length,
      hadis: k.ilgiliHadis.length,
    };
  }

  function zenginlikSkoru(k) {
    const b = kzrKirilim(k);
    return b.kisim + b.esma + b.sir + b.cizim + b.ayet + b.hadis;
  }

  // Sabit kaynak-türü sırası/renk/etiket sözleşmesi -- bkz. GORSEL_DIL.md
  // "Kaynak türü renkleri" (--kzr-* değişkenleri, assets/style.css). Sıra
  // burada ve lejantta AYNI olmalı ki bir türün rengi iki yerde de aynı
  // konumda görünsün.
  const KZR_TYPES = [
    { key: "kisim", label: { tr: "Kısım/fas", en: "Part/chapter", pt: "Parte/capítulo" } },
    { key: "esma", label: { tr: "Esmâ", en: "Names", pt: "Nomes" } },
    { key: "sir", label: { tr: "Sır", en: "Mystery", pt: "Mistério" } },
    { key: "cizim", label: { tr: "Çizim", en: "Diagram", pt: "Diagrama" } },
    { key: "ayet", label: { tr: "Âyet", en: "Verse", pt: "Versículo" } },
    { key: "hadis", label: { tr: "Hadis", en: "Hadith", pt: "Hadith" } },
  ];

  const KAVRAM_GAUGE_R = 8;
  const KAVRAM_GAUGE_C = 2 * Math.PI * KAVRAM_GAUGE_R;
  // Halka ÖNCE tek renkli/tek oranlıydı (yoğunluk = tek altın yay, bkz. git
  // tarihçesi). 2026-09-13'te kullanıcı, aynı toplam yay uzunluğunu (grubu
  // içindeki göreli zenginlik -- değişmedi) ALTI kaynak türüne göre renkli
  // segmentlere bölünmesini istedi: yay hâlâ "bu kavram için ne kadar
  // malzeme var" der, ama artık rengiyle "hangi TÜRden" olduğunu da gösterir
  // -- GORSEL_DIL.md'nin "davranışı resmet" ilkesi: tek bir sayı değil,
  // sayının NEREDEN geldiği de görünür olsun.
  function kavramGaugeSvg(k, frac) {
    const f = Math.max(0.05, Math.min(1, frac));
    const ringLen = KAVRAM_GAUGE_C * f;
    const b = kzrKirilim(k);
    const total = KZR_TYPES.reduce((s, t) => s + b[t.key], 0);
    let arcs;
    if (total > 0) {
      let acc = 0;
      arcs = KZR_TYPES.map((t) => {
        const count = b[t.key];
        if (!count) return "";
        const segLen = (count / total) * ringLen;
        const dashoffset = -acc;
        acc += segLen;
        return `<circle class="kavram-tile__gauge-arc kavram-tile__gauge-arc--${t.key}" data-kzr-type="${t.key}"
          cx="11" cy="11" r="${KAVRAM_GAUGE_R}"
          stroke-dasharray="${segLen.toFixed(2)} ${(KAVRAM_GAUGE_C - segLen).toFixed(2)}"
          stroke-dashoffset="${dashoffset.toFixed(2)}"><title>${escapeHtmlKavram(tt(t.label))}: ${count}</title></circle>`;
      }).join("");
    } else {
      // Hiçbir türde malzeme yok (otomatikEslesmeYok ya da gerçekten boş) --
      // renkli bir tür iddia etmeden, nötr/soluk bir kırıntı göster.
      arcs = `<circle class="kavram-tile__gauge-arc kavram-tile__gauge-arc--bos" cx="11" cy="11" r="${KAVRAM_GAUGE_R}"
        stroke-dasharray="${ringLen.toFixed(2)} ${(KAVRAM_GAUGE_C - ringLen).toFixed(2)}" stroke-dashoffset="0"></circle>`;
    }
    return `<svg class="kavram-tile__gauge" viewBox="0 0 22 22" aria-hidden="true">
      <circle class="kavram-tile__gauge-track" cx="11" cy="11" r="${KAVRAM_GAUGE_R}"></circle>
      ${arcs}
    </svg>`;
  }

  // Lejant: bir satırın üzerine gelmek/Tab'lamak halkalardaki karşılık gelen
  // yayı büyütüp öne çıkarır, diğerleri soluklaşır -- ETKILESIM_DILI.md'nin
  // "değinmek" fiili (hover/:focus-visible, klavye karşılığı zorunlu) ve
  // GORSEL_DIL.md'nin "her etkileşimin görünür bir sonucu olmalı" kuralı.
  // Vurgu `wrapEl` üzerindeki data-kzr-active ile CSS'e taşınıyor (bkz.
  // assets/style.css [data-kzr-active] kuralları) -- görünümün davranışı
  // yine bu dosyada, ama gerçek büyütme/soluklaştırma CSS geçişiyle olur.
  function kzrLegendHtml() {
    return (
      `<div class="kzr-legend" role="list">` +
      KZR_TYPES.map(
        (t) =>
          `<button type="button" class="kzr-legend__item" data-kzr-type="${t.key}" role="listitem">` +
          `<span class="kzr-legend__swatch kzr-legend__swatch--${t.key}" aria-hidden="true"></span>` +
          `<span class="kzr-legend__label">${tt(t.label)}</span>` +
          `</button>`
      ).join("") +
      `</div>`
    );
  }

  function bindKzrLegend() {
    listEl.querySelectorAll(".kzr-legend__item").forEach((btn) => {
      const type = btn.dataset.kzrType;
      const on = () => { wrapEl.dataset.kzrActive = type; };
      const off = () => { delete wrapEl.dataset.kzrActive; };
      btn.addEventListener("mouseenter", on);
      btn.addEventListener("mouseleave", off);
      btn.addEventListener("focus", on);
      btn.addEventListener("blur", off);
    });
  }

  function renderList() {
    detailEl.hidden = true;
    listEl.hidden = false;
    const groups = { ontoloji: [], esma: [], terimler: [] };
    kavramlar.forEach((k) => groups[k.view].push(k));
    // "tr" karşılaştırma yalnız TR görünümde doğru sırayı verir (ör. Türkçe
    // harf sırası); EN/PT'de kendi dillerinin varsayılan sıralamasını
    // kullanmaları için locale argümanı verilmiyor (2026-09-13).
    const sortLocale = I18n.getLang() === "tr" ? "tr" : undefined;
    Object.keys(groups).forEach((v) => groups[v].sort((a, b) => tt(a.isim).localeCompare(tt(b.isim), sortLocale)));
    const intro = tt({
      tr: "Her kavramın, Fütûhât-ı Mekkiyye ve Füsûsu'l-Hikem boyunca nerede ilk geçtiği, nerede en yoğun göründüğü ve hangi sır/çizim/âyet/hadisle birlikte anıldığına dair, veriden türetilmiş bir özet. Bu bir iddia değil, bir tarama denemesi -- yöntem sayfanın altında.",
      en: "A data-derived summary of where each concept first appears across the Meccan Revelations and the Bezels of Wisdom, where it appears most densely, and which mystery/diagram/verse/hadith it's recorded alongside. Not a claim -- a scanning attempt; method noted at the page's foot.",
      pt: "Um resumo derivado de dados de onde cada conceito aparece pela primeira vez nas Revelações de Meca e nos Engastes da Sabedoria, onde aparece com mais densidade, e com qual mistério/diagrama/versículo/hadith é registrado junto. Não uma afirmação -- uma tentativa de varredura; o método está ao pé da página.",
    });
    const gaugeNote = tt({
      tr: "Her adın yanındaki halka, o kavram için ne kadar malzeme biriktiğini gösterir -- kısım/fass sayısı, birlikte anıldığı esmâ, ilişkili sır/çizim/âyet/hadis toplanarak (kendi grubu içinde ölçeklenmiş). Halkanın renkli dilimleri bu malzemenin hangi türden geldiğini gösterir -- altta lejantın üzerine gelmek/Tab'lamak bir türü öne çıkarır.",
      en: "The ring beside each name shows how much material has accumulated for that concept -- part/chapter count, co-occurring Names, and related mysteries/diagrams/verses/hadiths added together (scaled within its own group). The ring's colored slices show which type each piece is -- hovering or tabbing to a row in the legend below highlights one type.",
      pt: "O anel ao lado de cada nome mostra quanto material se acumulou para aquele conceito -- número de partes/capítulos, Nomes coocorrentes, e mistérios/diagramas/versículos/hadiths relacionados somados (escalado dentro do próprio grupo). As fatias coloridas do anel mostram de qual tipo vem cada parte -- passar o mouse ou usar Tab numa linha da legenda abaixo destaca um tipo.",
    });
    listEl.innerHTML =
      `<p class="kavram-list__intro">${intro}</p>` +
      `<p class="kavram-list__intro kavram-list__intro--gauge">${gaugeNote}</p>` +
      kzrLegendHtml() +
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
                  kavramGaugeSvg(k, frac) +
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
    bindKzrLegend();
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

  // "Bir adım geri": kavram detayındayken Esc, "Tüm kavramlar" linkiyle
  // aynı adımı atar (bkz. renderDetail'deki .kavram-back-link) -- ortak
  // zincir graph-utils.js'te (bkz. esma.js:1420 aynı desen), 2026-09-13'e
  // kadar kavram görünümü bu zincire hiç katılmıyordu.
  GU.registerStepBack("kavram-wrap", () => {
    if (!detailEl.hidden) {
      showId(undefined);
      window.__dostNav && window.__dostNav.setHash("kavram");
      return true;
    }
    return false;
  });

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
