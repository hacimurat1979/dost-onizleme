(function () {
  "use strict";

  const I18n = window.DostI18n;
  const grid = document.getElementById("terimler-list");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  if (!grid || !detailPanel || !detailContent) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let glossaryData = null;
  let fetchPromise = null;
  let derivedTermRelations = [];
  let derivedTermPromise = null;
  let clusterFocus = null;

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)

  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

  function truncate(str, max) {
    if (!str) return "";
    if (str.length <= max) return str;
    const cut = str.slice(0, max);
    return cut.slice(0, cut.lastIndexOf(" ")) + "…";
  }

  function registerTerimlerCrossLinks(data) {
    if (!window.__dostCrossLink || !window.__dostCrossLink.register) return;
    Object.values(data.terms).forEach((t) => {
      const def = t.felsefi_tanim || {};
      const summary = {
        tr: truncate(def.tr, 160),
        en: truncate(def.en, 160),
        pt: truncate(def.pt, 160),
      };
      window.__dostCrossLink.register(t.title, "terimler", t.id, summary);
    });
    if (window.__dostCrossLink.notifyReady) window.__dostCrossLink.notifyReady();
  }

  function fetchData() {
    if (glossaryData) return Promise.resolve(glossaryData);
    if (fetchPromise) return fetchPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("terimler-wrap");
    fetchPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/felsefi-terimler.json")
      .then((data) => {
        glossaryData = data;
        registerTerimlerCrossLinks(data);
        if (window.DostViewStatus) window.DostViewStatus.hide("terimler-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Terimler sözlüğü yüklenemedi / Failed to load glossary", err);
        fetchPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("terimler-wrap", () => window.__terimlerApp.activate());
        return null;
      });
    return fetchPromise;
  }

  // A3: Esmâ'daki türetilmiş-kenar fikrinin Terimler karşılığı (bkz.
  // scripts/kenar-turet.py --site-terim). Bu bağlar `iliskili_kavramlar`
  // gibi elle yazılmadı — ko-okurans/PPMI ile SAYILDI; bu yüzden ayrı bir
  // dosyada, ayrı bir stille ve açık bir "biz saydık" notuyla gösterilir.
  function fetchDerivedTerms() {
    if (derivedTermPromise) return derivedTermPromise;
    derivedTermPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/turetilmis-kenarlar-terimler.json")
      .then((d) => { derivedTermRelations = (d && d.kenarlar) || []; return derivedTermRelations; })
      .catch((e) => { console.warn("Türetilmiş terim kenarları yüklenemedi", e); derivedTermPromise = null; return []; });
    return derivedTermPromise;
  }

  // ÇEVİRİNİN KAYBETTİĞİ ŞEY (docs/icerik-yol-haritasi.md D17). Üç dilli
  // olmanın yan ürünü: aynı terimi üç kez seçmek zorunda kaldık ve her
  // seferinde bir şey düştü. Ayrı dosyada tutuluyor -- felsefi-terimler.json
  // terimin KENDİ tanımıdır; bu ise bizim çeviri kararlarımız üzerine bir
  // not, yani ayrı bir iddia sınıfı (türetilmiş kenarlarla aynı gerekçe).
  let ceviriKaybi = null, ceviriKaybiPromise = null;
  function fetchCeviriKaybi() {
    if (ceviriKaybiPromise) return ceviriKaybiPromise;
    ceviriKaybiPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/ceviri-kaybi.json")
      .then((d) => { ceviriKaybi = d || null; return ceviriKaybi; })
      .catch((e) => { console.warn("Çeviri kaybı verisi yüklenemedi", e); ceviriKaybiPromise = null; return null; });
    return ceviriKaybiPromise;
  }

  const CEVIRI_DIL_ADI = {
    tr: { tr: "Türkçe", en: "Turkish", pt: "Turco" },
    en: { tr: "İngilizce", en: "English", pt: "Inglês" },
    pt: { tr: "Portekizce", en: "Portuguese", pt: "Português" },
  };

  function ceviriKaybiHtml(id) {
    const kayit = ceviriKaybi && ceviriKaybi.terimler && ceviriKaybi.terimler[id];
    if (!kayit) return "";
    // diller bir LİSTE: {dil, kelime, kayip}. Dil koduyla anahtarlanmış bir
    // sözlük olamaz -- scripts/dil-denetimi.py {tr,en,pt} anahtarlı HER
    // sözlüğü "üç dilli metin" sayıp içindekileri string bekliyor, ve bu
    // yapı onu çökertiyordu (2026-08-04'te ölçüldü).
    const secenekler = kayit.diller.map((d, i) =>
      `<button class="ceviri-kaybi__dil${i === 0 ? " on" : ""}" type="button" data-dil="${d.dil}">${tt(CEVIRI_DIL_ADI[d.dil])}: ${d.kelime}</button>`
    ).join("");
    return `<div class="ceviri-kaybi">
      <p class="detail-eyebrow detail-eyebrow--section">${tt({
        tr: "Çevrilirken ne düştü", en: "What fell away in translation", pt: "O que se perdeu na tradução" })}</p>
      <p class="ceviri-kaybi__kok"><span class="ceviri-kaybi__harf" dir="rtl" lang="ar">${kayit.kok.harf}</span>
        <span class="ceviri-kaybi__translit">${kayit.kok.translit}</span></p>
      <p class="ceviri-kaybi__kok-anlam">${tt(kayit.kok.anlam)}</p>
      <div class="ceviri-kaybi__diller">${secenekler}</div>
      <p class="ceviri-kaybi__kayip" id="ceviri-kaybi-kayip">${tt(kayit.diller[0].kayip)}</p>
      <p class="ceviri-kaybi__not">${tt(ceviriKaybi.meta.not)}</p>
    </div>`;
  }

  function ceviriKaybiBagla(id) {
    const kayit = ceviriKaybi && ceviriKaybi.terimler && ceviriKaybi.terimler[id];
    if (!kayit) return;
    const kutu = detailContent.querySelector(".ceviri-kaybi");
    if (!kutu) return;
    kutu.querySelectorAll(".ceviri-kaybi__dil").forEach((btn) => {
      btn.addEventListener("click", () => {
        kutu.querySelectorAll(".ceviri-kaybi__dil").forEach((b) => b.classList.remove("on"));
        btn.classList.add("on");
        const secili = kayit.diller.find((d) => d.dil === btn.dataset.dil);
        const hedef = kutu.querySelector("#ceviri-kaybi-kayip");
        if (hedef && secili) hedef.textContent = tt(secili.kayip);
      });
    });
  }

  // 2026-08-03'e kadar burada `deferFetch(() => { fetchData(); ... })`
  // vardı: kullanıcı Terimler sekmesini hiç açmasa da felsefi-terimler.json
  // (409KB) HER sayfada iniyordu -- tek sebebi çapraz-bağlantı önizlemesinin
  // terim adlarına ihtiyaç duymasıydı. O adlar artık derleme zamanında
  // üretilen ortak indekste (data/ibn-arabi/capraz-baglanti-indeksi.json,
  // ontology.js yüklüyor), yani önizleme hiçbir şey kaybetmiyor. Tam dosya
  // ancak Terimler görünümü gerçekten açıldığında geliyor (activate()).
  //
  // Türetilmiş kenarlar (12KB) da aynı sebeple erteleniyor: yalnız bu
  // görünümün grafiğinde kullanılıyor.

  function groupById(id) {
    return glossaryData.groups.find((g) => g.id === id);
  }

  // Grup başına küçük, elle çizilmiş bir sembol -- emoji değil, sitenin
  // ince-çizgi/altın diliyle uyumlu, tek renkli (currentColor) SVG'ler.
  const ICON_PATHS = {
    rings: '<circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="2.6"/>',
    branch: '<path d="M10 3v6M10 9l-5 8M10 9l5 8"/><circle cx="10" cy="3" r="1.6"/><circle cx="5" cy="17" r="1.6"/><circle cx="15" cy="17" r="1.6"/>',
    bolt: '<path d="M11 2 4 12h5l-1 6 7-10h-5l1-6z"/>',
    steps: '<path d="M3 17h4v-4h4V9h4V5h2"/>',
    rays: '<circle cx="10" cy="10" r="2.2"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.5 4.5l2 2M13.5 13.5l2 2M4.5 15.5l2-2M13.5 6.5l2-2"/>',
    eye: '<path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.4"/>',
    flame: '<path d="M10 2c1 3-3 4-3 7.5a3 3 0 0 0 6 0C13 6.5 10.5 7 10 2z"/><path d="M7.5 12a2.5 4 0 0 0 5 0"/>',
    "dot-circle": '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="1.6"/>',
    stroke: '<path d="M10 2v11"/><circle cx="10" cy="16" r="1.8"/>',
    star: '<path d="M10 2l1.9 5.8h6.1l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8-4.9-3.6h6.1z"/>',
    wave: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 4 0"/><path d="M2 7c2-3 4-3 6 0"/>',
    "veil-x": '<path d="M3 4c3 8 11 8 14 0" /><path d="M7 15l6-6M13 15L7 9"/>',
    veil: '<path d="M3 5c2 2 2 4 0 6M8 4c2 2 2 8 0 10M13 4c2 2 2 8 0 10M18 5c-2 2-2 4 0 6"/>',
    cycle: '<path d="M15.5 6.5A6 6 0 1 0 16 11"/><path d="M15.5 3v4h-4"/>',
    lamp: '<path d="M10 2a5 5 0 0 0-3 9c0 1 0 2 1 2h4c1 0 1-1 1-2a5 5 0 0 0-3-9z"/><path d="M8.5 16h3M9 18.5h2"/>',
    beam: '<path d="M10 2v4"/><path d="M6 8l8 0-2 10H8L6 8z"/>',
    scale: '<path d="M10 2v15M5 6h10M5 6l-2.5 6h5L5 6zM15 6l-2.5 6h5L15 6z"/>',
    compass: '<circle cx="10" cy="10" r="2"/><circle cx="10" cy="4" r="1.4"/><circle cx="16" cy="10" r="1.4"/><circle cx="10" cy="16" r="1.4"/><circle cx="4" cy="10" r="1.4"/><path d="M10 6v2M14 10h-2M10 14v-2M6 10h2"/>',
  };
  const GROUP_ICON = {
    "toz-nitelik": "rings",
    "siniflandirma": "branch",
    "sebep-sonuc": "bolt",
    "varlik-mertebesi": "steps",
    "kozmik-hiyerarsi": "rays",
    "kopru-kavram": "eye",
    "firaset": "eye",
    "nefsin-gucleri": "flame",
    "ahad-vahid": "dot-circle",
    "lafza-i-celal": "stroke",
    "velayet-risalet": "star",
    "sahv-sekr": "wave",
    "itibar-edilmez": "veil-x",
    "halvet-perdeleri": "veil",
    "mebde-mead": "cycle",
    "nubuvvetin-zarureti": "lamp",
    "vahyin-mertebeleri": "beam",
    "hayir-ve-ser": "scale",
    "tezkire-i-erbaa": "compass",
    "kutbiyet-hiyerarsisi": "steps",
    "ahval-makamat": "wave",
    "kurani-kozmoloji": "rays",
    "idrak-sureci": "eye",
    "kader-tevhid": "rays",
  };
  function groupIconSvg(groupId) {
    const key = GROUP_ICON[groupId] || "dot-circle";
    return `<svg class="terim-card__icon-svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[key]}</svg>`;
  }

  // GORSEL_DIL.md: "Soyut ok kullanma... Kesik çizgili ok + üçgen uç bir
  // diyagram dilidir, istiare dili değil." Aşağıdaki iki fonksiyon, bu
  // çizimlerin hepsinde kesik-üçgen-uçlu oku değiştiren ORTAK teknik:
  // yönü bir ok başıyla değil, ışığın kendi mantığıyla (kaynakta sönük,
  // vardığı yerde parlak -- ya da karşılıklı ilişkilerde ortada parlak,
  // uçlarda sönük) gösteren bir gradyan çizgi. isikYollariniCalistir ise
  // panel açıldığında/büyütüldüğünde HER ışık yolu boyunca bir kıvılcım
  // koşturuyor -- ontology.js'in ana grafiğindeki AYNI teknik (kivilcim/
  // getPointAtLength), yalnız burada tetikleyici düğüme tıklamak değil,
  // terimi/çizimi AÇMAK: "her etkileşimin görünür bir sonucu olmalı."
  let isikYoluSayaci = 0;
  function isikCizgisi(x1, y1, x2, y2, yon, extraClass) {
    const id = "tdIsik" + (isikYoluSayaci++);
    // stop-color'ı bir XML özniteliği DEĞİL, style= içinde veriyoruz --
    // yalnız öyle yazılırsa CSS değişkeni (var(--series-theme)) çözülüyor;
    // currentColor'a güvenmek burada işe yaramazdı çünkü <defs> bu satırın
    // KARDEŞİ, atası değil -- .term-diagram-isikyolu'ya renk vermek
    // gradyanın kendi <stop>'larına hiç ulaşmıyordu (ölçüldü).
    const renk = "var(--series-theme)";
    let stops;
    if (yon === "mutual") {
      stops = `<stop offset="0%" style="stop-color:${renk};stop-opacity:0.12"/>` +
        `<stop offset="50%" style="stop-color:${renk};stop-opacity:0.95"/>` +
        `<stop offset="100%" style="stop-color:${renk};stop-opacity:0.12"/>`;
    } else if (yon === "return") {
      stops = `<stop offset="0%" style="stop-color:${renk};stop-opacity:0.9"/>` +
        `<stop offset="100%" style="stop-color:${renk};stop-opacity:0.1"/>`;
    } else {
      stops = `<stop offset="0%" style="stop-color:${renk};stop-opacity:0.1"/>` +
        `<stop offset="100%" style="stop-color:${renk};stop-opacity:0.9"/>`;
    }
    return (
      `<defs><linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stops}</linearGradient></defs>` +
      `<line class="term-diagram-isikyolu${extraClass ? " " + extraClass : ""}" data-isikyolu-yon="${yon || "oneway"}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#${id})"/>`
    );
  }
  // Düğüm adı: kısaysa dairenin İÇİNE, uzunsa ALTINA yazılır. Üç dilde
  // aynı çizim kullanıldığı için aynı alan bir dilde 5, ötekinde 50
  // karakter olabiliyor ("Kuvve" -> "vehim/hayâl: yalnız zihinde"); sabit
  // yerleşim uzun olanı dairenin ve kutunun dışına taşırıyordu (üç dilde
  // de ölçüldü). Genişlik tahmini 7.0 birim/karakter -- tarayıcıda ölçülen
  // 6.3-6.8'in üstünde, konturun payıyla birlikte.
  function dugumYazisi(yazi, r) {
    const uzun = yazi.length > 14;
    return {
      yari: (yazi.length * 7.0) / 2,
      tasma: uzun ? 22 : 0,
      metin(x, y, rr) {
        const ty = uzun ? y + (rr || r) + 17 : y + 5;
        return `<text class="term-diagram-label term-diagram-label--small" x="${x.toFixed(0)}" y="${ty.toFixed(0)}" text-anchor="middle">${yazi}</text>`;
      },
    };
  }

  function kivilcimKostur(pathNode, gecikme, sure, ters) {
    const uzunluk = pathNode.getTotalLength ? pathNode.getTotalLength() : 0;
    if (!uzunluk) return;
    const parent = pathNode.parentNode;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("class", "term-diagram-kivilcim");
    c.setAttribute("r", "4");
    c.setAttribute("opacity", "0");
    parent.appendChild(c);
    const bas = performance.now() + gecikme;
    function adim(t) {
      // Kullanıcı animasyon bitmeden başka bir terime geçmiş olabilir --
      // panel innerHTML'i değişince bu çizgi (ve kıvılcım) belgeden
      // kopuyor ama rAF döngüsü onu bilmiyordu, her karede
      // getPointAtLength'i kopmuş bir düğümde çağırıp hata basıyordu.
      if (!pathNode.isConnected) { c.remove(); return; }
      const p = (t - bas) / sure;
      if (p < 0) { requestAnimationFrame(adim); return; }
      if (p >= 1) { c.remove(); return; }
      const nokta = pathNode.getPointAtLength((ters ? 1 - p : p) * uzunluk);
      c.setAttribute("cx", nokta.x);
      c.setAttribute("cy", nokta.y);
      c.setAttribute("opacity", Math.sin(p * Math.PI).toFixed(3));
      requestAnimationFrame(adim);
    }
    requestAnimationFrame(adim);
  }
  function isikYollariniCalistir(root) {
    if (reduceMotion || !root) return;
    const lines = root.querySelectorAll(".term-diagram-isikyolu");
    lines.forEach((line, i) => {
      const yon = line.dataset.isikyoluYon;
      const gecikme = i * 90;
      if (yon === "mutual") {
        kivilcimKostur(line, gecikme, 1300, false);
        kivilcimKostur(line, gecikme + 140, 1300, true);
      } else {
        kivilcimKostur(line, gecikme, 1100, yon === "return");
      }
    });
  }

  // İki (veya daha fazla) kavram arasındaki ilişkiyi tek bakışta gösteren
  // küçük SVG şemalar. Her grubun "diagram" alanındaki tipe göre seçilir.
  const diagramRenderers = {
    "mutual-vs-oneway": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 340 150" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node" cx="60" cy="34" r="24"/>
        <text class="term-diagram-label" x="60" y="39" text-anchor="middle">${tt(d.left)}</text>
        <circle class="term-diagram-node" cx="280" cy="34" r="24"/>
        <text class="term-diagram-label" x="280" y="39" text-anchor="middle">${tt(d.right)}</text>
        ${isikCizgisi(86, 34, 254, 34, "mutual")}
        <text class="term-diagram-note" x="170" y="20" text-anchor="middle">${tt(d.mutualLabel)}</text>

        <circle class="term-diagram-node term-diagram-node--accent" cx="60" cy="116" r="24"/>
        <text class="term-diagram-label" x="60" y="121" text-anchor="middle">${tt(d.oneWayFrom)}</text>
        <circle class="term-diagram-node" cx="280" cy="116" r="24"/>
        <text class="term-diagram-label" x="280" y="121" text-anchor="middle">${tt(d.oneWayTo)}</text>
        ${isikCizgisi(86, 116, 254, 116, "oneway")}
        <text class="term-diagram-note term-diagram-note--accent" x="170" y="145" text-anchor="middle">${tt(d.oneWayLabel)}</text>
      </svg>
    `,
    "host-satellite": (d) => {
      const cx = 150, cy = 85, hostR = 32, satR = 15, orbit = 62;
      const angles = [-90, 30, 150];
      const sats = angles.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const sx = cx + orbit * Math.cos(rad);
        const sy = cy + orbit * Math.sin(rad);
        return `
          <line class="term-diagram-tether" x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}"/>
          <circle class="term-diagram-node term-diagram-node--dashed" cx="${sx}" cy="${sy}" r="${satR}"/>
        `;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 300 170" role="img" aria-label="${tt(d.note)}">
        ${sats}
        <circle class="term-diagram-node term-diagram-node--accent" cx="${cx}" cy="${cy}" r="${hostR}"/>
        <text class="term-diagram-label term-diagram-label--host" x="${cx}" y="${cy + 5}" text-anchor="middle">${tt(d.host)}</text>
        <text class="term-diagram-label term-diagram-label--small" x="${cx}" y="${cy - orbit - 20}" text-anchor="middle">${tt(d.satellite)}</text>
      </svg>
    `;
    },
    // Kutu içerikten (2026-08-28): PT'de "Necessidade da Criação" 300
    // birimlik kutunun sağından taşıyordu.
    "formula-merge": (d) => {
      const a = tt(d.a), bb = tt(d.b);
      const W = Math.max(300, 2 * (88 + Math.max(a.length, bb.length) * 3.5));
      const c = W / 2;
      return `
      <svg class="term-diagram__svg" viewBox="0 0 ${W.toFixed(0)} 150" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node--venn" cx="${(c - 38).toFixed(0)}" cy="75" r="58"/>
        <circle class="term-diagram-node--venn" cx="${(c + 38).toFixed(0)}" cy="75" r="58"/>
        <text class="term-diagram-label--small" x="${(c - 82).toFixed(0)}" y="75" text-anchor="middle">${a}</text>
        <text class="term-diagram-label--small" x="${(c + 82).toFixed(0)}" y="75" text-anchor="middle">${bb}</text>
        <text class="term-diagram-label term-diagram-label--result" x="${c.toFixed(0)}" y="80" text-anchor="middle">${tt(d.result)}</text>
      </svg>
    `;
    },
    // Kutu genişliği içerikten (2026-08-28): sabit 340 birimde uzun
    // işaretler ("kudretli bir tecellî ile yitirilir" gibi) iki uçtan da
    // taşıyordu -- altı terimde ölçüldü. Uçtaki iki kısa metin ortalanmış
    // olduğu için yarısı kadar yer istiyor; kutu ikisinin toplamına göre
    // açılıyor.
    spectrum: (d) => {
      const en = (s) => tt(s).length;
      const yariAlt = Math.max(en(d.leftMarker), en(d.rightMarker)) * 3.1;
      const ustSol = Math.max(en(d.leftLabel) * 7.6, en(d.leftNote) * 7.0);
      const ustSag = Math.max(en(d.rightLabel) * 7.6, en(d.rightNote) * 7.0);
      const W = Math.max(360, ustSol + ustSag + 40, yariAlt * 2 + 180);
      const solX = Math.max(80, yariAlt + 14);
      const sagX = W - solX;
      return `
      <svg class="term-diagram__svg" viewBox="0 0 ${W.toFixed(0)} 120" role="img" aria-label="${tt(d.note)}">
        ${isikCizgisi(solX - 50, 55, sagX + 50, 55, "mutual")}
        <circle class="term-diagram-node term-diagram-node--sm" cx="${solX.toFixed(0)}" cy="55" r="16"/>
        <circle class="term-diagram-node term-diagram-node--accent term-diagram-node--sm" cx="${sagX.toFixed(0)}" cy="55" r="16"/>
        <text class="term-diagram-note" x="${solX.toFixed(0)}" y="90" text-anchor="middle">${tt(d.leftMarker)}</text>
        <text class="term-diagram-note" x="${sagX.toFixed(0)}" y="90" text-anchor="middle">${tt(d.rightMarker)}</text>
        <text class="term-diagram-label" x="14" y="20" text-anchor="start">${tt(d.leftLabel)}</text>
        <text class="term-diagram-label--small" x="14" y="35" text-anchor="start">${tt(d.leftNote)}</text>
        <text class="term-diagram-label" x="${(W - 14).toFixed(0)}" y="20" text-anchor="end">${tt(d.rightLabel)}</text>
        <text class="term-diagram-label--small" x="${(W - 14).toFixed(0)}" y="35" text-anchor="end">${tt(d.rightNote)}</text>
      </svg>
    `;
    },
    // Basamaklar. 2026-08-28'e kadar YATAYDI ve adlar r=28'lik dairelerin
    // İÇİNE yazılıyordu: "Yedi Gök" 56 birimlik daireye 116 birim olarak
    // sığmıyor, komşusunun üstüne taşıyordu (tarayıcıda ölçüldü; dokuz
    // çizimin hepsinde). Yatayda düzeltmek kutuyu 868 birime çıkarıyordu,
    // yani kartta okunmayacak kadar küçültüyordu. Dikey dizilim hem yazıya
    // yer açıyor hem de yön söylemeye izin veriyor.
    //
    // YÖN bir tercih değil, verinin kendi iddiası: bu çizimlerin altısı bir
    // iniş/açılım (Zât -> İlk Akıl -> Tümel Nefs), üçü ise açıkça bir
    // YÜKSELİŞ ("Her perdede durmayıp zikre devam eden, bir sonrakine
    // yükselir"; "mertebe yükseldikçe himmet de yükselir"). Hepsini aşağı
    // çizmek o üçünde metnin tersini söylerdi -- `yon: "yukselis"` olan
    // çizim aşağıdan yukarı diziliyor.
    cascade: (d) => {
      const n = d.steps.length;
      const yukari = d.yon === "yukselis";
      const yazilar = d.steps.map((s) => tt(s));
      const enGenis = Math.max.apply(null, yazilar.map((s) => s.length * 7.0));
      const alt = tt(d.relationLabel);
      const W = Math.max(66 + enGenis + 12, alt.length * 6.2 + 24);
      const H = (n - 1) * 64 + 60 + 28;
      const yOf = (i) => 30 + (yukari ? n - 1 - i : i) * 64;
      const circles = yazilar.map((s, i) => {
        const y = yOf(i);
        return `
          <circle class="term-diagram-node${i === 0 ? " term-diagram-node--accent" : ""}" cx="34" cy="${y}" r="22"/>
          <text class="term-diagram-label--small" x="66" y="${y + 5}" text-anchor="start">${s}</text>
        `;
      }).join("");
      const arrows = yazilar.slice(1).map((s, i) => {
        const y1 = yOf(i) + (yukari ? -24 : 24);
        const y2 = yOf(i + 1) + (yukari ? 24 : -24);
        return isikCizgisi(34, y1, 34, y2, "oneway");
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 ${W.toFixed(0)} ${H}" role="img" aria-label="${tt(d.note)}">
        ${arrows}${circles}
        <text class="term-diagram-note" x="${(W / 2).toFixed(0)}" y="${H - 8}" text-anchor="middle">${alt}</text>
      </svg>
    `;
    },
    mirror: (d) => {
      const sol = dugumYazisi(tt(d.source), 26), sag = dugumYazisi(tt(d.target), 26);
      const solX = Math.max(55, sol.yari + 10);
      const W = Math.max(300, solX + Math.max(55, sag.yari + 10) + 190);
      const sagX = W - Math.max(55, sag.yari + 10);
      const H = 120 + Math.max(sol.tasma, sag.tasma);
      return `
      <svg class="term-diagram__svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node term-diagram-node--accent" cx="${solX.toFixed(0)}" cy="55" r="26"/>
        ${sol.metin(solX, 55, 26)}
        <line class="term-diagram-mirror" x1="${(W / 2 + 10).toFixed(0)}" y1="15" x2="${(W / 2 - 10).toFixed(0)}" y2="95"/>
        ${isikCizgisi(solX + 28, 55, sagX - 30, 55, "oneway")}
        <circle class="term-diagram-node term-diagram-node--faint" cx="${sagX.toFixed(0)}" cy="55" r="26"/>
        ${sag.metin(sagX, 55, 26)}
      </svg>
    `;
    },
    "seal-wax": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 300 130" role="img" aria-label="${tt(d.note)}">
        <ellipse class="term-diagram-node term-diagram-node--faint" cx="150" cy="90" rx="90" ry="30"/>
        <text class="term-diagram-label term-diagram-label--small" x="150" y="95" text-anchor="middle">${tt(d.wax)}</text>
        <rect class="term-diagram-node term-diagram-node--accent" x="120" y="15" width="60" height="40" rx="8"/>
        <text class="term-diagram-label term-diagram-label--small" x="150" y="40" text-anchor="middle">${tt(d.seal)}</text>
        ${isikCizgisi(150, 58, 150, 68, "oneway")}
      </svg>
    `,
    "potential-actual": (d) => {
      const sol = dugumYazisi(tt(d.potential), 26), sag = dugumYazisi(tt(d.actual), 26);
      const solX = Math.max(60, sol.yari + 10);
      const sagPay = Math.max(60, sag.yari + 10);
      const W = Math.max(300, solX + sagPay + 180);
      const sagX = W - sagPay;
      const H = 100 + Math.max(sol.tasma, sag.tasma);
      return `
      <svg class="term-diagram__svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node term-diagram-node--dashed" cx="${solX.toFixed(0)}" cy="50" r="26"/>
        ${sol.metin(solX, 50, 26)}
        ${isikCizgisi(solX + 30, 50, sagX - 30, 50, "oneway")}
        <circle class="term-diagram-node term-diagram-node--accent" cx="${sagX.toFixed(0)}" cy="50" r="26"/>
        ${sag.metin(sagX, 50, 26)}
      </svg>
    `;
    },
    reins: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 300 200" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node term-diagram-node--accent" cx="150" cy="42" r="32"/>
        <text class="term-diagram-label term-diagram-label--small" x="150" y="47" text-anchor="middle">${tt(d.ruler)}</text>
        ${isikCizgisi(126, 66, 82, 132, "oneway")}
        ${isikCizgisi(174, 66, 218, 132, "oneway")}
        <circle class="term-diagram-node term-diagram-node--dashed" cx="70" cy="158" r="28"/>
        <text class="term-diagram-label term-diagram-label--small" x="70" y="163" text-anchor="middle">${tt(d.left)}</text>
        <circle class="term-diagram-node term-diagram-node--dashed" cx="230" cy="158" r="28"/>
        <text class="term-diagram-label term-diagram-label--small" x="230" y="163" text-anchor="middle">${tt(d.right)}</text>
        <text class="term-diagram-note" x="150" y="105" text-anchor="middle">${tt(d.rulesLabel)}</text>
      </svg>
    `,
    eclipse: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 340 160" role="img" aria-label="${tt(d.note)}">
        <line class="term-diagram-mirror" x1="170" y1="10" x2="170" y2="150"/>

        <circle class="term-diagram-node term-diagram-node--accent" cx="85" cy="48" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="85" y="53" text-anchor="middle">${tt(d.sunLabel)}</text>
        <circle class="term-diagram-node term-diagram-node--dashed" cx="85" cy="112" r="18"/>
        <text class="term-diagram-label--small" x="85" y="116" text-anchor="middle">${tt(d.moonLabel)}</text>
        <text class="term-diagram-note" x="85" y="145" text-anchor="middle">${tt(d.presentCaption)}</text>

        <circle class="term-diagram-node term-diagram-node--faint" cx="255" cy="48" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="255" y="53" text-anchor="middle">${tt(d.sunLabel)}</text>
        <circle class="term-diagram-node term-diagram-node--accent" cx="255" cy="112" r="18"/>
        <text class="term-diagram-label--small" x="255" y="116" text-anchor="middle">${tt(d.moonLabel)}</text>
        <text class="term-diagram-note" x="255" y="145" text-anchor="middle">${tt(d.absentCaption)}</text>
      </svg>
    `,
    // Harf dizisi. Aralık 2026-08-28'de içerikten hesaplanır oldu: sabit
    // 400/(n-1) aralıkta "Görünür âlem (gizli)" gibi uzun anlamlar hem
    // komşusuna hem de kutunun dışına taşıyordu (ölçüldü).
    "letter-sequence": (d) => {
      const n = d.letters.length;
      const anlamlar = d.letters.map((it) => tt(it.anlam));
      const enGenis = Math.max.apply(null, anlamlar.map((s) => s.length * 7.0));
      const gap = Math.max(96, enGenis + 10);
      const kenar = enGenis / 2 + 10;
      const W = kenar * 2 + gap * (n - 1);
      const items = d.letters.map((it, i) => {
        const x = kenar + i * gap;
        const nodeClass = it.hidden ? "term-diagram-node--dashed" : i === 0 ? "term-diagram-node--accent" : "term-diagram-node";
        return `
          <circle class="term-diagram-node ${nodeClass}" cx="${x.toFixed(0)}" cy="50" r="21"/>
          <text class="term-diagram-label" x="${x.toFixed(0)}" y="55" text-anchor="middle">${tt(it.harf)}</text>
          <text class="term-diagram-label--small" x="${x.toFixed(0)}" y="93" text-anchor="middle">${anlamlar[i]}</text>
        `;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 ${W.toFixed(0)} 115" role="img" aria-label="${tt(d.note)}">
        ${items}
      </svg>
    `;
    },
    // Kutu 2026-08-28'de genişletildi: iki okuma metni 340 birimlik
    // kutuda iki kenardan birden taşıyordu (tarayıcıda ölçüldü).
    "tinted-glass": (d) => {
      const sol = tt(d.reasonReading), sag = tt(d.senseReading);
      const yari = Math.max(sol.length, sag.length) * 3.1 + 12;
      const W = Math.max(360, yari * 4);
      const cam = W / 2;
      return `
      <svg class="term-diagram__svg" viewBox="0 0 ${W.toFixed(0)} 130" role="img" aria-label="${tt(d.note)}">
        ${isikCizgisi(20, 65, cam - 12, 65, "oneway")}
        <rect class="term-diagram-node--dashed" x="${(cam - 12).toFixed(0)}" y="25" width="24" height="80" style="fill:none"/>
        ${isikCizgisi(cam + 12, 65, W - 22, 65, "oneway")}
        <text class="term-diagram-label--small" x="${cam.toFixed(0)}" y="18" text-anchor="middle">${tt(d.glassLabel)}</text>
        <text class="term-diagram-note" x="${(cam / 2).toFixed(0)}" y="45" text-anchor="middle">${sol}</text>
        <text class="term-diagram-note--accent" x="${(cam + cam / 2).toFixed(0)}" y="45" text-anchor="middle">${sag}</text>
      </svg>
    `;
    },
    "heart-visitors": (d) => {
      const cx = 170, cy = 170, hostR = 34, satR = 26, orbit = 112;
      const n = d.visitors.length;
      const items = d.visitors.map((v, i) => {
        const deg = -90 + (360 / n) * i;
        const rad = (deg * Math.PI) / 180;
        const sx = cx + orbit * Math.cos(rad);
        const sy = cy + orbit * Math.sin(rad);
        const nodeClass = v.accent ? "term-diagram-node--accent" : "term-diagram-node--dashed";
        return `
          <line class="term-diagram-tether" x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}"/>
          <circle class="term-diagram-node ${nodeClass}" cx="${sx}" cy="${sy}" r="${satR}"/>
          <text class="term-diagram-label--small" x="${sx}" y="${sy + 4}" text-anchor="middle">${tt(v.label)}</text>
        `;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 340 340" role="img" aria-label="${tt(d.note)}">
        ${items}
        <circle class="term-diagram-node term-diagram-node--faint" cx="${cx}" cy="${cy}" r="${hostR}"/>
        <text class="term-diagram-label" x="${cx}" y="${cy + 5}" text-anchor="middle">${tt(d.center)}</text>
      </svg>
    `;
    },

    // Berzah: ikisinden de pay alan, ikisine de indirgenemeyen ara bölge.
    // İki yarı saydam alan ve ortadaki MERCEK. Keskin bir sınır çizgisi
    // yok, çünkü berzah bir sınır değil, iki tarafın birlikte bulunduğu
    // bir yer -- GORSEL_DIL'in "perde keskin halka değil, yarı saydam
    // katman" kuralı burada da geçerli. (Eşmerkezli değil, kesişen: yasak
    // olan iç içe halkalar, örtüşen alanlar değil.)
    "berzah-ara-bolge": (d) => {
      // r=72, merkezler 122/218 -> kesişim noktaları x=170, y=80±53.67.
      const mercek = "M 170 26.33 A 72 72 0 0 1 170 133.67 A 72 72 0 0 1 170 26.33 Z";
      return `
      <svg class="term-diagram__svg" viewBox="0 0 340 180" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node--venn" cx="122" cy="80" r="72"/>
        <circle class="term-diagram-node--venn" cx="218" cy="80" r="72"/>
        <path class="term-diagram-node--venn" d="${mercek}"/>
        <text class="term-diagram-label--small" x="66" y="84" text-anchor="middle">${tt(d.left)}</text>
        <text class="term-diagram-label--small" x="274" y="84" text-anchor="middle">${tt(d.right)}</text>
        <text class="term-diagram-label term-diagram-label--small" x="170" y="84" text-anchor="middle">${tt(d.middle)}</text>
        <text class="term-diagram-note--accent" x="170" y="170" text-anchor="middle">${tt(d.caption)}</text>
      </svg>
    `;
    },

    // Mertebeler bir merdiven değil, merkezden açılan bir sarmal üzerinde
    // -- Ontoloji'nin 2B düzeniyle aynı biçim, aynı sebeple (CLAUDE.md,
    // "Sarmal -- üçüncü boyut" ve "daire ve merkez"). Merkezdeki mertebe
    // (Gayb-ı Mutlak / Zât) PARLAK BİR CİSİM DEĞİL, kesik çizgili bir
    // yokluk: en gizli sıfatı gizliliği (GORSEL_DIL yasağı).
    "sarmal-mertebe": (d) => {
      const n = d.ranks.length;
      const adim = 360 / Math.max(n, 1);
      // İlk halka merkezden BELİRGİN uzakta başlar: doğrusal bir yarıçap
      // (r = kMax*i/(n-1)) ikinci mertebeyi merkezdeki dairenin üstüne
      // bindiriyordu (15+11=26 birim yarıçap, 27.5 birim uzaklık).
      const R0 = 56, R1 = 138;
      const yaricap = (i) => (i === 0 ? 0 : R0 + ((R1 - R0) * (i - 1)) / Math.max(n - 2, 1));
      const aci = (t) => ((-90 + adim * t) * Math.PI) / 180;
      const nokta = (t) => {
        const a = aci(t), r = yaricap(t);
        return { x: r * Math.cos(a), y: r * Math.sin(a), a: a };
      };
      // Sürekli iplik: düğümlerin üstünde durduğu eğrinin ta kendisi.
      const orgu = [];
      for (let j = 0; j <= (n - 1) * 16; j += 1) {
        const p = nokta(j / 16);
        orgu.push([p.x, p.y]);
      }
      // Kutu içerikten hesaplanıyor: TR/EN/PT etiketleri farklı uzunlukta,
      // sabit bir viewBox birinde taşıyor ötekinde boş kalıyordu.
      const parca = d.ranks.map((it, i) => {
        const p = nokta(i);
        const yazi = tt(it);
        // Merkezdeki mertebenin "dışarısı" yok; adı SOLA yazılıyor, çünkü
        // sarmal merkezden yukarı-sağa doğru çıkıyor -- altına yazınca
        // yazı ipliğin altında kalıyordu (ölçüldü).
        const yan = i === 0 || Math.abs(Math.cos(p.a)) >= 0.3;
        const yon = i === 0 ? -1 : Math.sign(Math.cos(p.a));
        const anchor = !yan ? "middle" : (yon > 0 ? "start" : "end");
        const lx = yan ? p.x + yon * 26 : p.x;
        const ly = yan ? p.y + 4 : p.y + (Math.sin(p.a) >= 0 ? 28 : -18);
        // 7.0 birim/karakter: tarayıcıda ölçüldü (14.5px, 600 ağırlık ->
        // 6.3-6.8 birim/karakter) + 3px'lik konturun payı.
        const gen = yazi.length * 7.0;
        const x0 = anchor === "start" ? lx : anchor === "end" ? lx - gen : lx - gen / 2;
        return { p: p, i: i, yazi: yazi, lx: lx, ly: ly, anchor: anchor, x0: x0, x1: x0 + gen };
      });
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      orgu.forEach(([x, y]) => {
        minX = Math.min(minX, x - 14); maxX = Math.max(maxX, x + 14);
        minY = Math.min(minY, y - 14); maxY = Math.max(maxY, y + 14);
      });
      parca.forEach((s) => {
        minX = Math.min(minX, s.x0); maxX = Math.max(maxX, s.x1);
        minY = Math.min(minY, s.ly - 12); maxY = Math.max(maxY, s.ly + 6);
      });
      const altYazi = tt(d.caption);
      const altYari = (altYazi.length * 6.2) / 2;
      const orta = (minX + maxX) / 2;
      minX = Math.min(minX, orta - altYari); maxX = Math.max(maxX, orta + altYari);
      const pay = 10;
      const vbX = minX - pay, vbY = minY - pay;
      const vbW = maxX - minX + pay * 2, vbH = maxY - minY + pay * 2 + 26;
      const dugumler = parca.map((s) => `
          <circle class="term-diagram-node ${s.i === 0 ? "term-diagram-node--dashed" : "term-diagram-node"}"
                  cx="${s.p.x.toFixed(1)}" cy="${s.p.y.toFixed(1)}" r="${s.i === 0 ? 15 : 11}"/>
          <text class="term-diagram-label--small" x="${s.lx.toFixed(1)}" y="${s.ly.toFixed(1)}" text-anchor="${s.anchor}">${s.yazi}</text>
        `).join("");
      return `
      <svg class="term-diagram__svg" viewBox="${vbX.toFixed(1)} ${vbY.toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}" role="img" aria-label="${tt(d.note)}">
        <polyline class="term-diagram-tether" fill="none" points="${orgu.map(([x, y]) => x.toFixed(1) + "," + y.toFixed(1)).join(" ")}"/>
        ${dugumler}
        <text class="term-diagram-note" x="${orta.toFixed(1)}" y="${(vbY + vbH - 8).toFixed(1)}" text-anchor="middle">${altYazi}</text>
      </svg>
    `;
    },

    // İki rahmet. İç içe iki daire ÇİZMİYORUZ (yasak) -- ayrım kapsamda
    // değil, işaretlemede: aynı ışık hepsinin üstünde (İmtinân, fark
    // gözetmez), bir kısmı ayrıca işaretlenmiş (Vücûb, seçer). Yani
    // ikincisi birincisini daraltmıyor, onun üstüne bir şey ekliyor.
    "kapsayan-secen": (d) => {
      const kolon = 7, satir = 3;
      const secili = new Set(d.selected || [3, 9, 12, 16]);
      let hucre = "";
      for (let s = 0; s < satir; s += 1) {
        for (let k = 0; k < kolon; k += 1) {
          const i = s * kolon + k;
          const x = 80 + k * 50, y = 52 + s * 42;
          hucre += `<circle class="term-diagram-node term-diagram-node--sm" cx="${x}" cy="${y}" r="9"/>`;
          if (secili.has(i)) {
            // fill style= ile veriliyor, öznitelikle DEĞİL: sınıfın CSS
            // dolgusu (--accent) bir sunum özniteliğini yener, halka içi
            // dolu çıkıp altındaki noktayı örtüyordu -- o zaman çizim
            // "işaretlenmiş olanlar" değil "başka bir şey" diyordu.
            hucre += `<circle class="term-diagram-node--accent" cx="${x}" cy="${y}" r="15" style="fill:none"/>`;
          }
        }
      }
      return `
      <svg class="term-diagram__svg" viewBox="0 0 460 216" role="img" aria-label="${tt(d.note)}">
        ${isikCizgisi(20, 24, 440, 24, "mutual")}
        <text class="term-diagram-note" x="230" y="16" text-anchor="middle">${tt(d.allLabel)}</text>
        ${hucre}
        <text class="term-diagram-note--accent" x="230" y="192" text-anchor="middle">${tt(d.someLabel)}</text>
        <text class="term-diagram-note" x="230" y="209" text-anchor="middle">${tt(d.caption)}</text>
      </svg>
    `;
    },

    // Aynı dizi, iki yönde okunuyor: bir ölçüt en üste koyduğunu öbürü en
    // alta koyuyor. Tek bir halka, iki sayı dizisi -- iki ayrı çizim değil,
    // çünkü söylenen şey "iki ayrı sıralama" değil, "aynı sıralamanın iki
    // ucundan okunması".
    "cift-okunus": (d) => {
      const cx = 250, cy = 150, R = 96, n = d.stations.length;
      const items = d.stations.map((st, i) => {
        const a = ((-90 + (360 / n) * i) * Math.PI) / 180;
        const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
        const ix = cx + (R - 30) * Math.cos(a), iy = cy + (R - 30) * Math.sin(a);
        const ox = cx + (R + 30) * Math.cos(a), oy = cy + (R + 30) * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : (Math.cos(a) > 0 ? "start" : "end");
        return `
          <circle class="term-diagram-node" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11"/>
          <text class="term-diagram-label--small" x="${ox.toFixed(1)}" y="${(oy + 4).toFixed(1)}" text-anchor="${anchor}">${tt(st)}</text>
          <text class="term-diagram-note--accent" x="${ix.toFixed(1)}" y="${(iy + 4).toFixed(1)}" text-anchor="middle">${i + 1}</text>
          <text class="term-diagram-note" x="${ix.toFixed(1)}" y="${(iy + 18).toFixed(1)}" text-anchor="middle">${n - i}</text>
        `;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 500 330" role="img" aria-label="${tt(d.note)}">
        ${items}
        <text class="term-diagram-note--accent" x="${cx}" y="${cy - 4}" text-anchor="middle">${tt(d.readingA)}</text>
        <text class="term-diagram-note" x="${cx}" y="${cy + 12}" text-anchor="middle">${tt(d.readingB)}</text>
        <text class="term-diagram-note" x="${cx}" y="320" text-anchor="middle">${tt(d.caption)}</text>
      </svg>
    `;
    },
  };

  const DIAGRAM_DEFS = `
    <svg width="0" height="0" style="position:absolute">
      <defs>
        <filter id="tdSketchy" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="tdNoise"/>
          <feDisplacementMap in="SourceGraphic" in2="tdNoise" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>
  `;

  let currentDiagrams = [];

  // Bir terimin çizimi varsa, terim detayının içine (Benzetme'den hemen
  // sonra) gömülü olarak gösteriyoruz -- ayrı bir tıklama gerekmeden,
  // terime bakan herkes çizimi de görsün diye. Tıklanınca büyütme (lightbox)
  // aynı şekilde çalışıyor.
  //
  // 2026-08-28: çizimler grubun altında duruyor ama 31'inin 23'ü kendi
  // `termId`siyle HANGİ terime ait olduğunu söylüyordu -- ve bu alanı kod
  // hiç okumuyordu. Sonuç: 19 terimlik kurani-kozmoloji grubunda "berzah"a
  // bakan biri, Arş/Kürsî basamaklarını ve yeşil camı kendi teriminin
  // çizimi sanıyordu. Artık ayrım yapılıyor:
  //   * termId bu terim ise    -> "Çizim" (terimin kendisinin)
  //   * termId hiç yoksa       -> "Grup Çizimi" (gruba ait, herkese)
  //   * termId BAŞKA terim ise -> gösterilmiyor; o çizim onun sayfasında,
  //     oraya İlgili Kavramlar'dan geçiliyor.
  function termDiagramHtml(group, term) {
    const hepsi = (group && group.diagram) || [];
    const kendi = hepsi.filter((dg) => dg.termId === term.id);
    const grup = hepsi.filter((dg) => !dg.termId);
    // Lightbox indisleri bu birleşik dizinin üstünden yürüyor.
    currentDiagrams = kendi.concat(grup);
    if (!currentDiagrams.length) return "";
    function kartlar(liste, kaydir) {
      return liste
        .map((dg, i) => {
          const renderer = diagramRenderers[dg.type];
          if (!renderer) return "";
          return `<div class="term-diagram-card">
            <div class="term-diagram-svg-wrap" data-diagram-index="${i + kaydir}" role="button" tabindex="0"
                 aria-label="${tt({ tr: "Büyüt", en: "Enlarge", pt: "Ampliar" })}">${renderer(dg)}</div>
            <p class="term-diagram-caption">${tt(dg.note)}</p>
          </div>`;
        })
        .join("");
    }
    function bolum(baslik, liste, kaydir) {
      const html = kartlar(liste, kaydir);
      if (!html.trim()) return "";
      return `
        <p class="detail-eyebrow detail-eyebrow--section">${tt(baslik)}</p>
        <div class="term-diagram-row term-diagram-row--panel">${html}</div>
      `;
    }
    return DIAGRAM_DEFS
      + bolum({ tr: "Çizim", en: "Diagram", pt: "Diagrama" }, kendi, 0)
      + bolum({ tr: "Grup Çizimi", en: "Group Diagram", pt: "Diagrama do Grupo" }, grup, kendi.length);
  }

  // --- Büyütme (lightbox) ---
  function openDiagramLightbox(index) {
    const dg = currentDiagrams[index];
    if (!dg) return;
    const renderer = diagramRenderers[dg.type];
    if (!renderer) return;
    window.dostTrack && window.dostTrack("sema_acildi", { type: dg.type });
    // DIAGRAM_DEFS burada tekrar eklenmiyor: bu çizim zaten açık olan detay
    // panelinin (termDiagramHtml) kendi kopyası DOM'da duruyor ve url(#...)
    // referansı belge genelinde çözüldüğü için o yeterli -- cizimler.js'teki
    // aynı düzeltmeyle tutarlı (UI denetimi bulgusu, iki modülde de vardı).
    window.DostLightbox.open({
      closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
      svgHtml: renderer(dg),
      caption: tt(dg.note),
    });
    // Büyütmek de bir etkileşim -- kendi ışık geçişini tekrar yaşatıyor.
    isikYollariniCalistir(document.querySelector(".cizim-lightbox__svg-wrap"));
  }

  function relatedChipsInline(t) {
    const related = (t.iliskili_kavramlar || [])
      .map((id) => glossaryData.terms[id])
      .filter(Boolean)
      .slice(0, 3);
    if (!related.length) return "";
    return `<span class="terim-card__related">${related.map((r) => tt(r.title)).join(" · ")}</span>`;
  }

  // 68 terim düz bir ızgarada değil, kendi 22 ilişkisel grubuna göre
  // kümelenmiş gösteriliyor -- bir sözlük için tam bir kuvvet-yönlü graf
  // (68 düğüm) hem taramayı zorlaştırırdı hem de CLAUDE.md'nin kendi
  // uyarısına ("bir öğe doğası gereği dairesel değilse zorla daireye
  // sokma") aykırı düşerdi; bunun yerine her grup başlığına, o grubun
  // kendi rengiyle (GROUP_HUE) boyanmış küçük dairesel bir "küme" rozeti
  // eklendi -- ilişkiyi taramayı bozmadan görünür kılan, daha ölçülü bir
  // orta yol.
  // ---------------------------------------------------------------------
  // "Dönüş yoğunluğu" — ısı haritası yerine hâle
  //
  // Bir ısı haritası her zaman bir ŞEYİ ölçer, ve burada ölçebileceğimiz
  // tek dürüst şey bir terimin "önemi" DEĞİL: onu ölçmeye kalkmak, kendi
  // kararımızı sayıya çevirip veri gibi göstermek olurdu. Ölçebildiğimiz
  // şey kendi okumamız: bu terime kaç kere geri dönmek zorunda kaldık?
  //
  //   yoğunluk = kaydettiğimiz kaynak pasajı sayısı
  //            + başka terimlerin ona işaret etme sayısı (iç derece)
  //            + sitenin başka bölümlerine kurulmuş bağlantı sayısı
  //
  // Yani bu harita İbn Arabî'nin neye ağırlık verdiğini değil, BİZİM
  // neye tekrar tekrar döndüğümüzü gösteriyor. Sayfada da böyle yazılı.
  //
  // Biçim olarak dikdörtgen bir ısı ızgarası (treemap/matris) sitenin
  // diline yabancı düşerdi; onun yerine kartlar yerinde kalıyor ve her
  // biri kendi yoğunluğu kadar ışıyor -- renk değil, hâle. Kapalıyken
  // sayfa hiç değişmiyor.
  // Düğme kaldırıldı (2026-07-26): yoğunluk sekme açılışında zaten açık.
  // Bir seçenek olarak sunulunca çoğu ziyaretçi hiç açmıyordu; oysa bu
  // haritanın söylediği şey (nereye tekrar tekrar döndüğümüz) sayfanın
  // kendi içeriğinin bir parçası, isteğe bağlı bir katman değil.
  const heatOn = true;
  let heatByTerm = null;

  function computeHeat(terms) {
    const scores = new Map();
    const inDegree = new Map();
    Object.values(terms).forEach((t) => {
      (t.iliskili_kavramlar || []).forEach((r) => {
        const id = typeof r === "string" ? r : r && r.id;
        if (id) inDegree.set(id, (inDegree.get(id) || 0) + 1);
      });
    });
    Object.values(terms).forEach((t) => {
      const s =
        (t.kaynaklar || []).length +
        (inDegree.get(t.id) || 0) +
        (t.site_baglantilari || []).length;
      scores.set(t.id, s);
    });
    const vals = Array.from(scores.values());
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const norm = new Map();
    scores.forEach((v, k) => norm.set(k, hi === lo ? 0.5 : (v - lo) / (hi - lo)));
    return { raw: scores, norm: norm, lo: lo, hi: hi };
  }

  // Yoğunluk artık bir "ışıma" değil, bir ÖLÇEK. İlk tasarımda her kart
  // kendi yoğunluğu kadar ışıyordu; koyu zeminde çalışıyordu ama açık
  // zeminde hâle bir leke gibi okunuyordu (kullanıcı tespiti, 2026-07-27).
  // Yerine her terimin yanında küçük bir HALKA var: çemberin ne kadarının
  // çizildiği, o terime kaç kere geri döndüğümüz. İki zeminde de aynı
  // netlikte okunuyor, ve bir atmosfer değil bir ölçü olduğunu -- yani
  // iddiasının ne olduğunu -- biçimiyle söylüyor. Dairesel oluşu da
  // sitenin kendi diline ait (bkz. CLAUDE.md, "daire ve merkez").
  const GAUGE_R = 7.4;
  const GAUGE_C = 2 * Math.PI * GAUGE_R;

  function gaugeSvg(n, hue) {
    const frac = Math.max(0.06, Math.min(1, n));
    const off = GAUGE_C * (1 - frac);
    return `<svg class="terim-entry__gauge" viewBox="0 0 20 20" aria-hidden="true" style="--tag-hue:${hue}">
      <circle class="terim-entry__gauge-track" cx="10" cy="10" r="${GAUGE_R}"></circle>
      <circle class="terim-entry__gauge-arc" cx="10" cy="10" r="${GAUGE_R}"
        stroke-dasharray="${GAUGE_C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"></circle>
    </svg>`;
  }

  function introHtml() {
    return `<p class="terimler-intro">${tt({
      tr: "Bu bir sözlük değil; aynı kelimenin İbn Arabî'nin farklı yerlerinde nasıl karşımıza çıktığını izleme çabası. Bir terime tıklayın, kaynağına ve ilişkili terimlere oradan ulaşın.",
      en: "This isn't a dictionary; it's an attempt to follow how the same word keeps turning up in different places in Ibn Arabi's work. Click a term to reach its sources and related terms from there.",
      pt: "Isto não é um dicionário; é uma tentativa de seguir como a mesma palavra volta a aparecer em lugares diferentes na obra de Ibn Arabi. Clique num termo para chegar às suas fontes e termos relacionados a partir dali.",
    })}</p>`;
  }

  function heatKeyHtml() {
    return `<div class="terimler-heat">
      <p class="terimler-heat__title">
        <svg class="terim-entry__gauge terimler-heat__gauge" viewBox="0 0 20 20" aria-hidden="true">
          <circle class="terim-entry__gauge-track" cx="10" cy="10" r="${GAUGE_R}"></circle>
          <circle class="terim-entry__gauge-arc" cx="10" cy="10" r="${GAUGE_R}"
            stroke-dasharray="${GAUGE_C.toFixed(2)}" stroke-dashoffset="${(GAUGE_C * 0.32).toFixed(2)}"></circle>
        </svg>
        <span>${tt({ tr: "Dönüş yoğunluğu", en: "Return density", pt: "Densidade de retorno" })}</span>
      </p>
      <p class="terimler-heat__note">${tt({
        tr: "Her terimin yanındaki halka, ona kaç kere geri döndüğümüz kadar doluyor — kaydettiğimiz kaynak pasajları, başka terimlerin ona verdiği atıflar ve sitenin öbür bölümlerine kurduğumuz bağlar toplanarak. Bu, Dost'un neye ağırlık verdiğini değil, bizim okumamızın nerede yoğunlaştığını gösteriyor; yani bir ölçü değil, bir öz-portre.",
        en: "The ring beside each term fills in proportion to how often we have had to come back to it — the source passages we recorded, the references other terms make to it, and the links we built to other parts of the site, added together. This shows not what Dost emphasised but where our own reading has thickened; a self-portrait rather than a measurement.",
        pt: "O anel ao lado de cada termo preenche-se na proporção de quantas vezes tivemos de voltar a ele — as passagens-fonte que registámos, as referências que outros termos lhe fazem e os vínculos que construímos com outras partes do site, somados. Isto mostra não o que Dost enfatizou, mas onde a nossa própria leitura se adensou; um autorretrato, não uma medição.",
      })}</p>
    </div>`;
  }

  function renderList() {
    const terms = glossaryData.terms;
    if (!heatByTerm) heatByTerm = computeHeat(terms);
    const byGroup = new Map();
    Object.values(terms).forEach((t) => {
      if (!byGroup.has(t.group)) byGroup.set(t.group, []);
      byGroup.get(t.group).push(t);
    });
    const groups = (glossaryData.groups || []).filter((g) => (byGroup.get(g.id) || []).length);

    // Sol taraftaki "sırt": sözlüğün kendi omurgası. Grupları hem gezinti
    // hem içindekiler olarak taşıyor; sayfanın solunu doldurup terimleri
    // kalan bütün genişliğe yayıyor -- eski düzende terimler dar bir
    // sütuna sıkışıp sağ yarı boş kalıyordu (kullanıcı tespiti).
    const rail = `<nav class="terimler-rail" aria-label="${tt({ tr: "Sözlük bölümleri", en: "Glossary sections", pt: "Secções do glossário" })}">
      <label class="terimler-filter">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><line x1="15.8" y1="15.8" x2="20" y2="20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <input type="search" id="terimler-filter-input" autocomplete="off"
          placeholder="${tt({ tr: "Terim ara…", en: "Search terms…", pt: "Procurar termos…" })}"
          aria-label="${tt({ tr: "Terim ara", en: "Search terms", pt: "Procurar termos" })}">
      </label>
      <button class="terimler-fca-btn" id="terimler-fca-btn" type="button"
        title="${tt({ tr: "Makine kümelemesi — grup/mertebe niteliklerinden kurulan bir kavram kafesi", en: "Machine clustering — a concept lattice built from group/tier attributes", pt: "Agrupamento por máquina — uma rede de conceitos construída a partir dos atributos grupo/nível" })}"
        aria-label="${tt({ tr: "Makine kümelemesi (FCA)", en: "Machine clustering (FCA)", pt: "Agrupamento por máquina (FCA)" })}">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="8.5" y="14" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="6.5" y1="10" x2="10.5" y2="14.5" stroke="currentColor" stroke-width="1.3"/><line x1="17.5" y1="10" x2="13.5" y2="14.5" stroke="currentColor" stroke-width="1.3"/></svg>
        <span>${tt({ tr: "Makine Kümelemesi", en: "Machine Clustering", pt: "Agrupamento por Máquina" })}</span>
      </button>
      <p class="terimler-rail__count" id="terimler-rail-count"></p>
      <ol class="terimler-rail__list">${groups
        .map((g) => {
          const n = (byGroup.get(g.id) || []).length;
          return `<li><a class="terimler-rail__item" href="#terim-grup-${g.id}" data-group="${g.id}" style="--tag-hue:${groupHue(g.id)}">
            <span class="terimler-rail__dot" aria-hidden="true"></span>
            <span class="terimler-rail__name">${tt(g.name)}</span>
            <span class="terimler-rail__n">${n}</span>
          </a></li>`;
        })
        .join("")}</ol>
    </nav>`;

    const body = groups
      .map((g) => {
        const groupTerms = byGroup.get(g.id) || [];
        const hue = groupHue(g.id);
        const entries = groupTerms
          .map((t) => {
            const tier = t.tier || 2;
            const n = heatByTerm.norm.get(t.id);
            const raw = heatByTerm.raw.get(t.id);
            const ozet = tt({ tr: t.ozet_tr, en: t.ozet_en, pt: t.ozet_pt });
            const gaugeTitle = tt({
              tr: "Dönüş yoğunluğu: " + raw,
              en: "Return density: " + raw,
              pt: "Densidade de retorno: " + raw,
            });
            return `<button class="terim-entry terim-entry--tier-${tier}" data-id="${t.id}"
                data-search="${(tt(t.title) + " " + ozet).toLowerCase().replace(/"/g, "")}"
                title="${gaugeTitle}">
              ${gaugeSvg(n == null ? 0 : n, hue)}
              <span class="terim-entry__text">
                <span class="terim-entry__title">${tt(t.title)}</span>
                <span class="terim-entry__ozet">${ozet}</span>
                ${relatedChipsInline(t)}
              </span>
            </button>`;
          })
          .join("");
        return `<section class="terimler-group" id="terim-grup-${g.id}" data-group="${g.id}" style="--tag-hue:${hue}">
          <header class="terimler-group__header">
            <span class="terimler-group__badge">${groupIconSvg(g.id)}</span>
            <div>
              <h2 class="terimler-group__title">${tt(g.name)}</h2>
              <p class="terimler-group__desc">${tt(g.description)}</p>
            </div>
          </header>
          <div class="terimler-group__entries">${entries}</div>
          <p class="terimler-group__empty" hidden>${tt({
            tr: "Bu bölümde eşleşen terim yok.",
            en: "No matching term in this section.",
            pt: "Nenhum termo correspondente nesta secção.",
          })}</p>
        </section>`;
      })
      .join("");

    grid.innerHTML = `<div class="terimler-shell">${rail}<div class="terimler-body">${introHtml()}${heatKeyHtml()}${body}</div></div>`;

    grid.querySelectorAll(".terim-entry").forEach((el) => {
      el.addEventListener("click", () => showTermDetail(el.dataset.id));
    });
    wireRail();
    wireFilter();
    wireFcaButton();
    if (clusterFocus) applyClusterClasses();
  }

  // Sol sırttaki bağlantılar sayfayı gerçekten kaydırıyor; ayrıca hangi
  // bölümde olduğumuzu işaretliyor. IntersectionObserver kullanılıyor ki
  // kaydırma sırasında her karede hesap yapılmasın.
  function wireRail() {
    const items = Array.from(grid.querySelectorAll(".terimler-rail__item"));
    if (!items.length) return;
    items.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const sec = grid.querySelector("#terim-grup-" + CSS.escape(a.dataset.group));
        if (!sec) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        sec.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        pulseGroup(sec, reduce);
      });
    });
    if (!("IntersectionObserver" in window)) return;
    const seen = new Set();
    const obs = new IntersectionObserver(
      (recs) => {
        recs.forEach((r) => {
          const id = r.target.dataset.group;
          if (r.isIntersecting) seen.add(id);
          else seen.delete(id);
        });
        items.forEach((a) => a.classList.remove("is-current"));
        const first = items.find((a) => seen.has(a.dataset.group));
        if (first) {
          first.classList.add("is-current");
          keepRailVisible(first);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    grid.querySelectorAll(".terimler-group").forEach((sec) => obs.observe(sec));
  }

  // Sırttan bir bölüme gidildiğinde, inilen yer kaydırma bitince de belli
  // olsun diye kısa bir vurgu: Fütûhât'ta bir kaynağa gidildiğindeki
  // hareketin aynısı (bkz. assets/futuhat.js -> navigateToSource) --
  // rozet halkalanıyor, başlık satırı bir an grubun rengine bulanıyor.
  let pulseTimers = [];
  function pulseGroup(sec, reduce) {
    pulseTimers.forEach(clearTimeout);
    pulseTimers = [];
    grid.querySelectorAll(".terimler-group.is-pulsing").forEach((el) => el.classList.remove("is-pulsing"));
    grid.querySelectorAll(".terimler-group__badge.futuhat-pulse").forEach((el) => el.classList.remove("futuhat-pulse"));
    const badge = sec.querySelector(".terimler-group__badge");
    // kaydırma bitmeye yakın başlasın; yoksa vurgu daha yolda sönüyor
    pulseTimers.push(
      setTimeout(() => {
        sec.classList.add("is-pulsing");
        if (badge) badge.classList.add("futuhat-pulse");
        pulseTimers.push(
          setTimeout(() => {
            sec.classList.remove("is-pulsing");
            if (badge) badge.classList.remove("futuhat-pulse");
          }, 1700)
        );
      }, reduce ? 0 : 350)
    );
  }

  // İşaretli bölüm bağlantısı, sırtın kendi kaydırma penceresinin dışına
  // düşebiliyor (masaüstünde dikey liste, dar ekranda yatay şerit). Sayfayı
  // değil SADECE sırtı kaydırıyoruz -- scrollIntoView burada sayfayı da
  // oynatıp okuma yerini kaybettirirdi.
  function keepRailVisible(item) {
    const list = item.closest(".terimler-rail__list");
    const rail = item.closest(".terimler-rail");
    const horiz = list && list.scrollWidth - list.clientWidth > 1 ? list : null;
    const vert = rail && rail.scrollHeight - rail.clientHeight > 1 ? rail : null;
    if (horiz) {
      const b = item.getBoundingClientRect();
      const c = horiz.getBoundingClientRect();
      if (b.left < c.left) horiz.scrollLeft += b.left - c.left - 8;
      else if (b.right > c.right) horiz.scrollLeft += b.right - c.right + 8;
    }
    if (vert) {
      const b = item.getBoundingClientRect();
      const c = vert.getBoundingClientRect();
      if (b.top < c.top) vert.scrollTop += b.top - c.top - 8;
      else if (b.bottom > c.bottom) vert.scrollTop += b.bottom - c.bottom + 8;
    }
  }

  // --- Makine kümelemesi (FCA) ---
  // scripts/fca-terimler.py -> research/fca-terimler.json (elle seçilmiş
  // 3-12 nesnelik kümeler, grup/mertebe niteliklerinden). Terimler bir graf
  // değil kart listesi olduğu için esma.js/hal.js'teki "haritada göster"
  // burada "listede vurgula" olarak uyarlandı: üye kartlar parlıyor, diğer
  // her şey soluklaşıyor, ilk üyenin bölümüne kaydırılıyor.
  let fcaData = null;
  function fetchFcaData() {
    if (!fcaData) {
      fcaData = window.DostGraphUtils.fetchJson("data/ibn-arabi/terimler-fca.json").catch(() => null);
    }
    return fcaData;
  }
  const FCA_SHOW_LABEL = { tr: "Listede vurgula", en: "Highlight in list", pt: "Destacar na lista" };
  function fcaClusterHtml(kume) {
    const nitelikler = kume.nitelikler.map((n) => tt(n.label)).join(", ");
    const isimler = kume.uyeler
      .map((id) => {
        const term = glossaryData.terms[id];
        const label = term ? tt(term.title) : id;
        return `<a class="cross-link" href="${window.__dostNav.href("terimler", id)}" data-view="terimler" data-id="${id}">${label}</a>`;
      })
      .join(", ");
    return `<div class="esma-fca-cluster">
      <p class="esma-fca-cluster__nitelik">${nitelikler}</p>
      <p class="esma-fca-cluster__isimler">${isimler}</p>
      <button class="esma-fca-cluster__show" type="button" data-cluster-id="${kume.id}">${tt(FCA_SHOW_LABEL)}</button>
    </div>`;
  }
  function openFcaLightbox() {
    fetchFcaData().then((data) => {
      if (!data || !window.DostLightbox) return;
      window.dostTrack && window.dostTrack("sema_acildi", { type: "terimler-fca" });
      const clusters = data.kumeler.map(fcaClusterHtml).join("");
      window.DostLightbox.open({
        closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
        name: tt({ tr: "Makine Kümelemesi (FCA)", en: "Machine Clustering (FCA)", pt: "Agrupamento por Máquina (FCA)" }),
        svgHtml: `<div class="esma-fca-lightbox">
          <p class="esma-fca-lightbox__not">${tt(data.not)}</p>
          <div class="esma-fca-lightbox__list">${clusters}</div>
        </div>`,
        caption: "",
      });
      // İsme tıklayınca önce lightbox kapanmalı (esma.js'teki aynı gerekçe):
      // hedefe eklenen dinleyici kabarcıklanmada document'teki delege
      // navigasyon dinleyicisinden önce çalışır.
      const wrap = document.querySelector(".cizim-lightbox__svg-wrap");
      if (wrap) {
        wrap.querySelectorAll(".cross-link").forEach((a) => {
          a.addEventListener("click", () => { window.DostLightbox.close(); });
        });
        wrap.querySelectorAll(".esma-fca-cluster__show").forEach((btn) => {
          btn.addEventListener("click", () => {
            const kume = data.kumeler.find((k) => String(k.id) === btn.dataset.clusterId);
            if (!kume) return;
            window.DostLightbox.close();
            enterClusterFocus(kume);
          });
        });
      }
    });
  }
  function wireFcaButton() {
    const btn = document.getElementById("terimler-fca-btn");
    if (!btn || btn.dataset.wiredFcaButton) return;
    btn.dataset.wiredFcaButton = "1";
    btn.addEventListener("click", openFcaLightbox);
  }

  function applyClusterClasses() {
    grid.classList.toggle("terimler-shell--cluster-active", !!clusterFocus);
    grid.querySelectorAll(".terim-entry").forEach((el) => {
      el.classList.toggle("is-cluster-member", !!clusterFocus && clusterFocus.members.has(el.dataset.id));
    });
  }

  function enterClusterFocus(kume) {
    clusterFocus = { id: kume.id, members: new Set(kume.uyeler), nitelikler: kume.nitelikler };
    applyClusterClasses();
    showClusterFocusCaption(kume);
    const firstTerm = glossaryData.terms[kume.uyeler[0]];
    const sec = firstTerm ? grid.querySelector("#terim-grup-" + CSS.escape(firstTerm.group)) : null;
    if (sec) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      sec.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
    window.dostTrack && window.dostTrack("terimler_fca_odak", { id: kume.id });
  }

  function exitClusterFocus() {
    if (!clusterFocus) return;
    clusterFocus = null;
    applyClusterClasses();
    hideClusterFocusCaption();
  }

  function showClusterFocusCaption(kume) {
    const cap = document.getElementById("terimler-fca-caption");
    const text = document.getElementById("terimler-fca-caption-nitelik");
    if (!cap || !text) return;
    text.textContent = kume.nitelikler.map((n) => tt(n.label)).join(" · ");
    cap.hidden = false;
  }
  function hideClusterFocusCaption() {
    const cap = document.getElementById("terimler-fca-caption");
    if (cap) cap.hidden = true;
  }

  if (window.DostGraphUtils) {
    window.DostGraphUtils.registerStepBack("terimler-wrap", () => {
      if (!clusterFocus) return false;
      exitClusterFocus();
      return true;
    });
  }

  function wireFilter() {
    const input = grid.querySelector("#terimler-filter-input");
    const countEl = grid.querySelector("#terimler-rail-count");
    if (!input) return;
    const entries = Array.from(grid.querySelectorAll(".terim-entry"));
    const total = entries.length;
    function setCount(n) {
      if (!countEl) return;
      countEl.textContent =
        n === total
          ? tt({ tr: total + " terim", en: total + " terms", pt: total + " termos" })
          : tt({ tr: n + " / " + total + " terim", en: n + " / " + total + " terms", pt: n + " / " + total + " termos" });
    }
    function apply() {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      entries.forEach((el) => {
        const hit = !q || el.dataset.search.indexOf(q) !== -1;
        el.hidden = !hit;
        if (hit) shown++;
      });
      grid.querySelectorAll(".terimler-group").forEach((sec) => {
        const any = sec.querySelector(".terim-entry:not([hidden])");
        sec.classList.toggle("is-empty", !any);
        const empty = sec.querySelector(".terimler-group__empty");
        if (empty) empty.hidden = !!any;
      });
      setCount(shown);
    }
    input.addEventListener("input", apply);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && input.value) {
        e.stopPropagation();
        input.value = "";
        apply();
      }
    });
    setCount(total);
  }

  function render() {
    if (!glossaryData) return;
    renderList();
  }

  // Benzetmeler sitenin görünen yüzünden kaldırıldı; gizli anahtar
  // kelimeyle geri açılıyor (bkz. assets/edit-mode.js).
  function analogyHtml(t) {
    if (!t.analogy || !(window.DostAnalogy && window.DostAnalogy.visible())) return "";
    return `<div class="detail-analogy">
      <p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p>
      <p>${linkify(tt(t.analogy), "terimler", t.id)}</p>
    </div>`;
  }

  function kaynaklarHtml(kaynaklar, id) {
    if (!kaynaklar || !kaynaklar.length) return "";
    return `<div class="insight-group">${kaynaklar
      .map(
        (k, i) => `<details class="insight" ${i === 0 ? "open" : ""}>
          <summary>${k.kaynak_adi ? k.kaynak_adi : tt({ tr: `Cilt ${k.cilt}`, en: `Volume ${k.cilt}`, pt: `Volume ${k.cilt}` })}</summary>
          <p>${linkify(k.alinti_tr, "terimler", id)}</p>
          ${k.not_tr ? `<cite>${linkify(k.not_tr, "terimler", id)}</cite>` : ""}
        </details>`
      )
      .join("")}</div>`;
  }

  // Her grup için elle seçilmiş, sabit bir ton -- index'e bağlı rastgele bir
  // gökkuşağı yerine, sitenin öbür yerlerindeki (Sırlar/Hâller/Sorular) muted
  // paletlerle aynı ruhta, kasıtlı olarak seçilmiş renkler.
  const GROUP_HUE = {
    "toz-nitelik": 35,
    "siniflandirma": 200,
    "sebep-sonuc": 15,
    "varlik-mertebesi": 265,
    "kozmik-hiyerarsi": 225,
    "kopru-kavram": 185,
    "itibar-edilmez": 350,
    "halvet-perdeleri": 300,
    "sahv-sekr": 20,
    "velayet-risalet": 45,
    "lafza-i-celal": 250,
    "ahad-vahid": 210,
    "nefsin-gucleri": 5,
    "mebde-mead": 330,
    "nubuvvetin-zarureti": 40,
    "vahyin-mertebeleri": 190,
    "hayir-ve-ser": 100,
    "tezkire-i-erbaa": 275,
    "firaset": 55,
    "kutbiyet-hiyerarsisi": 165,
    "ahval-makamat": 70,
    "kurani-kozmoloji": 235,
    "idrak-sureci": 150,
    "kader-tevhid": 120,
  };
  function groupHue(groupId) {
    return GROUP_HUE[groupId] !== undefined ? GROUP_HUE[groupId] : 40;
  }

  function relatedTermsHtml(t) {
    const related = (t.iliskili_kavramlar || [])
      .map((id) => glossaryData.terms[id])
      .filter(Boolean);
    if (!related.length) return "";
    const chips = related
      .map((r) => `<button class="bookmap-concept-tag bookmap-concept-tag--group" data-term="${r.id}" style="--tag-hue:${groupHue(r.group)}">${tt(r.title)}</button>`)
      .join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlişkili Terimler", en: "Related Terms", pt: "Termos Relacionados" })}</p>
      <div class="bookmap-concept-tags">${chips}</div>`;
  }

  // A3: türetilmiş (sayılmış) bağlar -- yukarıdaki elle yazılmış
  // `iliskili_kavramlar`dan görsel olarak (kesikli çerçeve, ayrı başlık,
  // her çipte "biz saydık" açıklaması) ayrı tutulur. Veri henüz yüklenmediyse
  // (kullanıcı sekmeyi açar açmaz detay panelini açtıysa) sessizce boş döner
  // -- showTermDetail'in sonundaki tembel çağrı veriyi getirip paneli
  // tazeliyor. (2026-08-03'e kadar bu dosya açılışta çekiliyordu; artık
  // yalnız gerektiğinde.)
  function derivedTermsHtml(t) {
    const rows = derivedTermRelations.filter((r) => r.from === t.id || r.to === t.id);
    if (!rows.length) return "";
    const chips = rows
      .map((r) => {
        const otherId = r.from === t.id ? r.to : r.from;
        const other = glossaryData.terms[otherId];
        if (!other) return "";
        return `<button class="bookmap-concept-tag bookmap-concept-tag--derived" data-term="${other.id}" title="${tt(r.aciklama).replace(/"/g, "&quot;")}">${tt(other.title)}</button>`;
      })
      .filter(Boolean)
      .join("");
    if (!chips) return "";
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Türetilmiş Bağlar", en: "Derived Links", pt: "Vínculos Derivados" })}</p>
      <p class="detail-derived-note">${tt({
        tr: "Bu bağları biz saydık (aynı bölümlerde birlikte geçme sıklığından) — Dost'un bunları bağladığı anlamına gelmez.",
        en: "We counted these links (from how often the terms occur together in the same chapters) — it does not mean Ibn Arabi connects them.",
        pt: "Nós contamos estes vínculos (pela frequência com que os termos ocorrem juntos nos mesmos capítulos) — não significa que Ibn Arabi os conecte.",
      })}</p>
      <div class="bookmap-concept-tags">${chips}</div>`;
  }

  function celisenYorumlarHtml(t) {
    const views = t.celisen_yorumlar || [];
    if (!views.length) return "";
    const cards = views
      .map(
        (v) => `<div class="divergent-view">
          <p class="divergent-view__kaynak">${v.kaynak}</p>
          <p>${linkify(tt(v.gorus), "terimler", t.id)}</p>
        </div>`
      )
      .join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Çelişen Yorumlar", en: "Differing Readings", pt: "Leituras Divergentes" })}</p>
      <div class="divergent-views">${cards}</div>
      ${t.celisen_yorumlar_not ? `<p class="divergent-views__not">${linkify(tt(t.celisen_yorumlar_not), "terimler", t.id)}</p>` : ""}`;
  }

  // Terim gruplarındaki GROUP_HUE'ya paralel, ama bölüm bazında: her görünüm
  // (ontoloji/esma/hal/...) kendi sabit tonuyla ayırt edilsin diye.
  const VIEW_HUE = {
    ontoloji: 40,
    esma: 200,
    hal: 265,
    terimler: 15,
    sorular: 225,
    futuhat: 340,
    sirlar: 100,
    cizimler: 185,
  };

  function siteLinksHtml(t) {
    const links = t.site_baglantilari || [];
    if (!links.length) return "";
    const VIEW_LABEL = {
      ontoloji: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
      esma: { tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" },
      hal: { tr: "Hâller", en: "States", pt: "Estados" },
      terimler: { tr: "Terimler", en: "Terms", pt: "Termos" },
      sorular: { tr: "Sorular", en: "Questions", pt: "Perguntas" },
      futuhat: { tr: "Fütûhât Atlası", en: "Futuhat Atlas", pt: "Atlas do Futuhat" },
      sirlar: { tr: "Sırlar", en: "Mysteries", pt: "Mistérios" },
      cizimler: { tr: "Çizimler", en: "Diagrams", pt: "Diagramas" },
    };
    const chips = links
      .map((l) => `<button class="bookmap-concept-tag bookmap-concept-tag--group" data-view="${l.view}" data-id="${l.id}" style="--tag-hue:${VIEW_HUE[l.view] !== undefined ? VIEW_HUE[l.view] : 40}">${tt(VIEW_LABEL[l.view] || {})} → ${l.id}</button>`)
      .join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Haritada Gör", en: "See on the Map", pt: "Ver no Mapa" })}</p>
      <div class="bookmap-concept-tags">${chips}</div>`;
  }

  function showTermDetail(id) {
    const t = glossaryData.terms[id];
    if (!t) return;
    window.dostTrack && window.dostTrack("kavram_sayfasi_goruntulendi", { id: t.id });
    const group = groupById(t.group);
    detailPanel.dataset.currentTerm = id;
    // URL'yi güncelle -- bunsuz Kavram Defterim (kavram-defteri.js) her
    // terimi aynı location.href'e (bare /terimler/) göre kaydediyordu,
    // panelde ikinci bir terime geçip yıldızlamak ilkinin kaydını sessizce
    // siliyordu (href tabanlı kimlik ayrımı sağlayamıyordu).
    window.__dostNav && window.__dostNav.setHash && window.__dostNav.setHash("terimler", id);

    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt((group && group.name) || {})}</p>
      <h2 class="detail-title">${tt(t.title)}${t.arabic ? ` <span class="detail-title__arabic">${t.arabic}</span>` : ""}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${tt({ tr: "Felsefi Tanım", en: "Philosophical Definition", pt: "Definição Filosófica" })}</h3>
        <p>${linkify(tt(t.felsefi_tanim), "terimler", t.id)}</p>
      </div>
      <div class="detail-block">
        <h3>${tt({ tr: "İbn Arabî'nin Yorumu", en: "Ibn Arabi's Interpretation", pt: "A Interpretação de Ibn Arabi" })}</h3>
        <p>${linkify(tt(t.ibn_arabi_yorumu), "terimler", t.id)}</p>
      </div>
      ${ceviriKaybiHtml(t.id)}
      ${analogyHtml(t)}
      ${termDiagramHtml(group, t)}
      ${kaynaklarHtml(t.kaynaklar, t.id)}
      ${celisenYorumlarHtml(t)}
      ${relatedTermsHtml(t)}
      ${derivedTermsHtml(t)}
      ${siteLinksHtml(t)}
    `;

    detailContent.querySelectorAll(".bookmap-concept-tag[data-term]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.dostTrack && window.dostTrack("ilgili_kavram_secildi", { from: id, to: btn.dataset.term });
        showTermDetail(btn.dataset.term);
      });
    });
    detailContent.querySelectorAll(".bookmap-concept-tag[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.__dostNav && window.__dostNav.goTo(btn.dataset.view, btn.dataset.id);
      });
    });
    detailContent.querySelectorAll(".term-diagram-svg-wrap").forEach((el) => {
      el.addEventListener("click", () => openDiagramLightbox(Number(el.dataset.diagramIndex)));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDiagramLightbox(Number(el.dataset.diagramIndex));
        }
      });
    });
    detailPanel.hidden = false;
    // GORSEL_DIL.md: "her etkileşimin görünür bir sonucu olmalı." Bu küçük
    // çizimlerin tek etkileşimi terimi AÇMAK -- o yüzden tetikleyici tıklama
    // değil, panelin kendisi: terim açılınca ışık yolları boyunca (yukarıdaki
    // isikCizgisi'nin ürettiği çizgiler) bir kıvılcım koşuyor.
    isikYollariniCalistir(detailContent);

    // Türetilmiş bağlar dosyası küçük ama ayrı bir fetch; panel bu terimi
    // veri gelmeden önce açtıysa (nadir -- idle callback genelde önden
    // biter), veri gelince aynı terim hâlâ açıksa paneli sessizce tazele.
    if (!derivedTermRelations.length) {
      fetchDerivedTerms().then(() => {
        if (detailPanel.dataset.currentTerm === id) showTermDetail(id);
      });
    }

    // Çeviri kaybı katmanı da ayrı bir fetch: aynı sessiz tazeleme.
    ceviriKaybiBagla(id);
    if (!ceviriKaybi) {
      fetchCeviriKaybi().then((d) => {
        if (d && detailPanel.dataset.currentTerm === id) showTermDetail(id);
      });
    }
  }

  window.__terimlerApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        render();
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        render();
        if (id) showTermDetail(id);
      });
    },
    onLangChange() {
      if (!glossaryData) return;
      render();
    },
  };
})();
