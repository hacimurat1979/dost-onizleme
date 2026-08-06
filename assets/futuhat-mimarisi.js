// Fütûhât'ın Mimarisi — kitabın altı büyük fasıla bölünüşü (docs/icerik-
// yol-haritasi.md D11).
//
// KAPSAM. Bu sayfa uzun süre yalnız kitabın kendi YAPISINI gösterdi; sitenin
// okuma birimleri bağlanamamıştı, çünkü kısımlar bab'ı gösteren yapısal bir
// alan taşımıyor. Kısım METİNLERİ ise taşıyor: açık "N. Bölüm" kalıbı.
// scripts/futuhat-bab-eslesme.py onu okuyor (118 kısım, 301 bab); artık iç
// halka sitenin nereye gidip nereye gitmediğini gösteriyor.
//
// İKİNCİ HALKA. Dış halka = kitabın planı (altı fasıl). İç halka = 560 babın
// her biri için bir çentik. Okunmuş bab dolu, okunmamış bab soluk. Kur'ân
// Dokusu'ndaki kararın aynısı: eksiği gizlemek yerine görünür kılıyoruz --
// halka tam okunuyor, boşluk da onun içinde duruyor. Ölçü: münâzalât 78/78
// dolu, muâmelât 115 babın 10'u. Bu fark sayfanın asıl söylediği şey.
//
// YERLEŞIM. CLAUDE.md'nin daire/merkez ilkesi: altı fasıl tek bir halkada,
// her birinin yayı kendi bab sayısıyla orantılı (73/115/81/114/78/99,
// toplam 560) -- büyüklük süs değil, ölçünün kendisi. Halka Ma'ârif'ten
// başlayıp (tepede) saat yönünde Makāmât'ta kapanıyor; 560. bab (Makāmât'ın
// son babı, Şeyh'in vasiyetini taşıyan) halkanın başlangıç noktasına
// bitişik duruyor -- kitap dönüp kendi başına bakıyor.
//
// DERİNLEŞME (2026-08-06). Bir fasıla tıklamak artık yalnız sağda panel
// açmıyor -- grafiğin kendisi de o fasılın içine iniyor: dış halka artık
// altı fasıl değil, TIKLANAN fasılın kısımlarını gösteriyor (yine kendi
// bab sayısıyla orantılı), iç halka da yalnız o fasılın bab aralığını,
// tüm çembere yayarak. Bu iki şeyi birden çözüyor: (1) kullanıcının
// istediği "yalnız o fasılın alt bileşenlerini göster", (2) 560 çentiğin
// ~1,6px aralıkla neredeyse tıklanamaz olması -- odaklanınca aynı çentikler
// 5-8 kat daha geniş yer kaplıyor. Bir kısma (ya da bir baba) tıklamak
// -- veri burada bitiyor, okuma biriminin kendi sayfasına götüren panel
// açılıyor; "inilebildiği kadar derine" ifadesinin karşılığı bu: fasıl ->
// kısım, kısımdan sonrası artık site içi bir grafik değil, kitabın kendisi.
//
// Geri dönüş ETKILESIM_DILI.md'nin üçüncü fiiliyle (Esc, bir adım) --
// kuran-dokusu.js'in izlediği AYNI tek-fonksiyonlu desen: açık bab paneli
// varsa önce fasıl paneline, o da yoksa girişe. Yeni bir hareket icat
// edilmedi; var olan derinleşti.
window.__futuhatMimarisiApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const TOPLAM_BAB = 560;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const svg = d3.select("#futuhat-mimarisi-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("futuhat-mimarisi-wrap");
  const tooltip = document.getElementById("futuhat-mimarisi-tooltip");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");

  if (!svgNode || !wrapEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  function tt(dict) { return I18n.pick3(dict || {}); }

  let data = null;
  let eslesme = null;          // futuhat-bab-eslesme.json
  let babKisim = new Map();    // bab numarası -> kısım kaydı
  let faslar = [];
  let faslById = new Map();
  let zoom = null;
  let g = null;

  // odakFasilId: null ise kök görünüm (altı fasıl); bir id ise dış halka o
  // fasılın kısımlarını gösteriyor. sonAcilanPanel/lastBabNo yalnız "Esc'e
  // basınca nereye dönülecek" sorusunun cevabı için tutuluyor.
  let odakFasilId = null;
  let sonAcilanPanel = "giris"; // "giris" | "fasil" | "bab"
  let lastBabNo = null;

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(360, r.width), h: Math.max(360, r.height) };
  }

  function ciz() {
    const { w, h } = boyut();
    const R_OUT = Math.min(w, h) * 0.4;
    const R_IN = R_OUT * 0.6;
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    g = svg.append("g").attr("class", "futuhat-mimarisi-scene");
    const kok = g.append("g").attr("transform", `translate(${w / 2}, ${h / 2})`);

    const fasil = odakFasilId ? faslById.get(odakFasilId) : null;
    if (fasil) {
      odakHalkaCiz(kok, R_OUT, R_IN, fasil);
      const domain = { start: fasil.aralikBaslangic, end: fasil.aralikBitis };
      // kisimlar=null: odak modunda klavye durakları eklenmiyor (false),
      // parametre zaten okunmuyor -- bkz. babHalkasiCiz'in kendi notu.
      babHalkasiCiz(kok, R_IN, domain, null, false);
    } else {
      disHalkaCiz(kok, R_OUT, R_IN);
      babHalkasiCiz(kok, R_IN, null, eslesme ? eslesme.kisimlar : [], true);
    }

    zoom = GU.createZoomBehavior(svg, g, [0.6, 3]);
    ortala(false);
  }

  // --- DIŞ HALKA: kök görünüm (altı fasıl) --------------------------------

  function disHalkaCiz(kok, R_OUT, R_IN) {
    const toplam = faslar.reduce((s, f) => s + f.babSayisi, 0);
    let acc = 0;
    faslar.forEach((f) => {
      f.a0 = (acc / toplam) * 2 * Math.PI - Math.PI / 2;
      acc += f.babSayisi;
      f.a1 = (acc / toplam) * 2 * Math.PI - Math.PI / 2;
    });

    const arcGen = d3.arc().innerRadius(R_IN).outerRadius(R_OUT).padAngle(0.012).padRadius(R_IN)
      .startAngle((d) => d.a0).endAngle((d) => d.a1);

    const dilimG = kok.append("g").attr("class", "futuhat-mimarisi-dilimler");
    const sel = dilimG.selectAll("path.futuhat-mimarisi-dilim").data(faslar, (d) => d.id).join("path")
      .attr("class", "futuhat-mimarisi-dilim")
      .attr("d", arcGen)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => tt(d.ad) + " — " + d.aralikBaslangic + "–" + d.aralikBitis);

    // Etiketler: her dilimin orta açısında, halkanın hemen dışında. Altı
    // tane olduğu için (kısımların aksine) çakışma riski yok, kalıcı metin
    // kalıyor. Hem çizgiye hem metne aynı davranış bağlanıyor ki isme
    // hover etmek de bilgi versin -- yalnız çiziğe değil.
    const etiketG = kok.append("g").attr("class", "futuhat-mimarisi-etiketler");
    const etiket = etiketG.selectAll("text.futuhat-mimarisi-etiket").data(faslar, (d) => d.id).join("text")
      .attr("class", "futuhat-mimarisi-etiket")
      .attr("x", (d) => Math.cos((d.a0 + d.a1) / 2) * (R_OUT + 14))
      .attr("y", (d) => Math.sin((d.a0 + d.a1) / 2) * (R_OUT + 14) + 4)
      .attr("text-anchor", (d) => {
        const mid = (d.a0 + d.a1) / 2;
        const x = Math.cos(mid);
        return x > 0.12 ? "start" : x < -0.12 ? "end" : "middle";
      })
      .text((d) => tt(d.ad));

    dilimEtkilesimBagla(sel, true);
    dilimEtkilesimBagla(etiket, false);

    // 560→1 kapanışı: halkanın başlangıç noktasında küçük, sabit bir işaret.
    // Yalnız kökte anlamlı -- odaklanınca "kapanış" kendi fasılın dışında.
    const kapanisAcisi = -Math.PI / 2;
    kok.append("circle").attr("class", "futuhat-mimarisi-kapanis")
      .attr("cx", Math.cos(kapanisAcisi) * R_OUT).attr("cy", Math.sin(kapanisAcisi) * R_OUT).attr("r", 3.5);
  }

  // Fasıl dilimine (çizgi ya da isim, ikisi de aynı hareket) fare/klavye
  // bağlanması. `klavye=false` yalnız etiket metni için: aynı fasılın iki
  // ayrı tab durağı olmasın diye tabindex yalnız çizgide.
  function dilimEtkilesimBagla(sel, klavye) {
    sel.on("mouseenter", function (ev, d) { vurgula(d.id, true); ipucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgula(null, false); GU.hideTooltip(tooltip); })
      .on("click", (ev, d) => faslPaneli(d));
    if (klavye) {
      sel.on("focus", function (ev, d) { vurgula(d.id, true); })
        .on("blur", function () { vurgula(null, false); })
        .on("keydown", function (ev, d) {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); faslPaneli(d); }
        });
    }
  }

  // --- DIŞ HALKA: odak görünümü (bir fasılın kısımları) -------------------

  // Bir fasılın bab aralığını kısım/boşluk segmentlerine böler. BAB
  // NUMARASI ÜZERİNDEN, tek doğru kaynak olan babKisim haritasını tarayarak
  // -- eslesme.kisimlar'ın kendi bas/bit sınırlarına GÜVENMİYOR, çünkü
  // güvenmiyordu ve kırıldı: c3k30/c3k31/c3k32 üçü de bab 68'i kapsıyor
  // (üç ayrı kısım metninde "68. Bölüm" atfı var -- script'in tavan kuralı
  // yalnız KESİN geriye referansları (n < tavan) eliyor, n == tavan'ı
  // elemiyor). İlk yazımda üç kısım de kendi [68,68] aralığını çizip TAM
  // AYNI açıyı işgal etti; Playwright ilk denemede "intercepts pointer
  // events" diye yakaladı. Artık her bab NUMARASI, kim "sahibiyse" (babKisim
  // -- kök halkanın da kullandığı, son-yazan-kazanır haritası) o kişiye
  // ait sayılıyor; komşu aynı sahipli bablar tek segmentte birleşiyor.
  // Örtüşme YAPISAL OLARAK imkânsız hâle geldi, veri ne kadar tuhaf olursa
  // olsun.
  function odakSegmentleri(fasil) {
    const segmentler = [];
    let mevcut = null;
    for (let n = fasil.aralikBaslangic; n <= fasil.aralikBitis; n++) {
      const k = babKisim.get(n) || null;
      if (mevcut && mevcut.kisim === k) {
        mevcut.bit = n;
      } else {
        mevcut = { tur: k ? "dolu" : "bos", bas: n, bit: n, kisim: k };
        segmentler.push(mevcut);
      }
    }
    return segmentler;
  }

  // Odaklanılan fasılın dış halkası: artık fasıl değil KISIM dilimleri.
  // Kalıcı isim ETİKETİ BİLEREK YOK -- yoğun fasıllarda (makāmât: 35 kısım)
  // 560 çentiğin paylaştığı 360°'de otuz beş metin çakışmadan sığmaz; Kur'ân
  // Dokusu'nda otuz beş sûre adı için bulduğumuz "eşit aralık + yarıçap
  // yönü" çözümü bile burada işe yaramaz çünkü darlık aralıktan değil
  // segment SAYISININ ta kendisinden geliyor. Bilgi kayıp değil, taşındı:
  // her dilim kendi adını hover/focus'ta ve tıklanan panelde tam söylüyor
  // -- ETKILESIM_DILI.md'nin dördüncü fiili tam bunun için var (hover,
  // tıklamanın göstereceğinin küçültülmüş hâlini önden söylüyor).
  function odakHalkaCiz(kok, R_OUT, R_IN, fasil) {
    const segmentler = odakSegmentleri(fasil);
    const domain = { start: fasil.aralikBaslangic, end: fasil.aralikBitis };

    // Açılar segmentin kendi bas/bit'inden dogrudan: iç halkanın kullandığı
    // babAcisi()'yle AYNI [domain.start,domain.end]->[-π/2,3π/2) eşlemesi,
    // ayrı bir "toplam segment uzunluğu" muhasebesi (accumulator) YOK --
    // öyle bir muhasebe, veri örtüşünce (yukarıdaki not) sessizce kayardı.
    segmentler.forEach((s) => {
      s.a0 = ((s.bas - domain.start) / (domain.end - domain.start + 1)) * 2 * Math.PI - Math.PI / 2;
      s.a1 = ((s.bit + 1 - domain.start) / (domain.end - domain.start + 1)) * 2 * Math.PI - Math.PI / 2;
    });

    const arcGen = d3.arc().innerRadius(R_IN).outerRadius(R_OUT).padAngle(0.012).padRadius(R_IN)
      .startAngle((d) => d.a0).endAngle((d) => d.a1);

    const dilimG = kok.append("g").attr("class", "futuhat-mimarisi-dilimler");

    // Dolu segmentler ÖNCE ekleniyor ki nth-child alternatif rengi
    // yalnız gerçek (tıklanabilir) dilimler arasında dönsün.
    const dolu = dilimG.selectAll("path.futuhat-mimarisi-dilim").data(segmentler.filter((s) => s.tur === "dolu"), (d) => d.kisim.id + ":" + d.bas).join("path")
      .attr("class", "futuhat-mimarisi-dilim")
      .attr("d", arcGen)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => babEtiketi(d.bas));

    dolu.on("mouseenter", function (ev, d) { kisimVurgula(d, true); kisimIpucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { kisimVurgula(null, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { kisimVurgula(d, true); })
      .on("blur", function () { kisimVurgula(null, false); })
      .on("click", (ev, d) => babPaneli(d.bas))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); babPaneli(d.bas); }
      });

    dilimG.selectAll("path.futuhat-mimarisi-dilim--bos")
      .data(segmentler.filter((s) => s.tur === "bos")).join("path")
      .attr("class", "futuhat-mimarisi-dilim futuhat-mimarisi-dilim--bos")
      .attr("d", arcGen)
      .attr("aria-hidden", "true");
  }

  // `d` bir odak-segmenti ({ kisim, bas, bit }) -- kısmın KENDİ tam bab
  // listesi değil, bu fasılda GÖRÜNEN bab aralığı. c8k118 gibi bir fasıl
  // sınırını aşan kısımlarda (bkz. dosya başı) bu ayrım önemli: gösterilen
  // aralık her zaman ekrandaki dilimle birebir örtüşsün diye.
  function kisimVurgula(d, on) {
    if (!g) return;
    g.selectAll("path.futuhat-mimarisi-dilim").classed("futuhat-mimarisi-dilim--deginiliyor",
      (o) => !!on && !!d && o.kisim && o.kisim.id === d.kisim.id);
    babVurgula(on && d ? d.bas : null);
  }

  function kisimIpucu(ev, d) {
    const aralik = d.bit > d.bas ? (d.bas + "–" + d.bit) : String(d.bas);
    tooltip.innerHTML = `<strong>${tt({ tr: "Bab", en: "Chapter", pt: "Capítulo" })} ${aralik}</strong>`
      + `<span class="node-hover-tip__meta">${tt(d.kisim.baslik)}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  // --- İÇ HALKA: 560 bab çentiği (her iki modda da, farklı bab aralığıyla) --

  // Bir bab'ın halka üzerindeki açısı. `domain` verilmezse kök (1..560);
  // odaklıyken yalnız o fasılın aralığı [start,end] TÜM ÇEMBERE yayılıyor --
  // aynı 73-115 bab artık 560 değil kendi babSayısı kadar yuvaya bölünüyor,
  // yani her çentiğe düşen açı 5-8 kat büyüyor. İki halka (dış/iç) yine
  // hizalı kalıyor çünkü ikisi de AYNI domain'i kullanıyor.
  function babAcisi(n, domain) {
    const bas = domain ? domain.start : 1;
    const bit = domain ? domain.end : TOPLAM_BAB;
    const toplam = bit - bas + 1;
    return ((n - bas + 0.5) / toplam) * 2 * Math.PI - Math.PI / 2;
  }

  function babHalkasiCiz(kok, R_IN, domain, kisimlar, klavyeStoklariEkle) {
    if (!eslesme) return;
    const dom = domain || { start: 1, end: TOPLAM_BAB };
    const r1 = R_IN * 0.94;
    const r0 = R_IN * 0.76;
    const halka = kok.append("g").attr("class", "futuhat-mimarisi-bablar");

    const hepsi = [];
    for (let n = dom.start; n <= dom.end; n++) hepsi.push(n);

    halka.append("g").attr("class", "futuhat-mimarisi-bablar__bos")
      .attr("aria-hidden", "true")
      .selectAll("line").data(hepsi.filter((n) => !babKisim.has(n))).join("line")
      .attr("class", "futuhat-mimarisi-bab futuhat-mimarisi-bab--bos")
      .attr("x1", (n) => Math.cos(babAcisi(n, dom)) * r0)
      .attr("y1", (n) => Math.sin(babAcisi(n, dom)) * r0)
      .attr("x2", (n) => Math.cos(babAcisi(n, dom)) * r1)
      .attr("y2", (n) => Math.sin(babAcisi(n, dom)) * r1);

    halka.append("g").attr("class", "futuhat-mimarisi-bablar__dolu")
      .attr("aria-hidden", "true")
      .selectAll("line").data(hepsi.filter((n) => babKisim.has(n))).join("line")
      .attr("class", "futuhat-mimarisi-bab futuhat-mimarisi-bab--dolu")
      .attr("data-bab", (n) => n)
      .attr("x1", (n) => Math.cos(babAcisi(n, dom)) * r0)
      .attr("y1", (n) => Math.sin(babAcisi(n, dom)) * r0)
      .attr("x2", (n) => Math.cos(babAcisi(n, dom)) * r1)
      .attr("y2", (n) => Math.sin(babAcisi(n, dom)) * r1);

    // ETKİLEŞİM. Bu yarıçapta bab başına düşen açı kökte ~1,6px'e kadar
    // düşüyor; her çentiğe kendi vuruş alanı vermek komşularının üstüne
    // biniyordu (Playwright'la ölçülmüştü). Tek bir saydam halka imleci
    // yakalıyor, bab açıdan hesaplanıyor -- domain'e göre.
    halka.append("path").attr("class", "futuhat-mimarisi-bab-avci")
      .attr("d", d3.arc()({ innerRadius: r0 - 4, outerRadius: r1 + 4, startAngle: 0, endAngle: 2 * Math.PI }))
      .on("mousemove", function (ev) {
        const n = yakinKapsananBab(imlectenBab(ev, this, dom), dom);
        if (n) { babVurgula(n); babIpucu(ev, n); }
        else { babVurgula(null); GU.hideTooltip(tooltip); }
      })
      .on("mouseleave", function () { babVurgula(null); GU.hideTooltip(tooltip); })
      .on("click", function (ev) {
        const n = yakinKapsananBab(imlectenBab(ev, this, dom), dom);
        if (n) babPaneli(n);
      });

    // KLAVYE. Yalnız KÖKTE: orada dış halka fasılları temsil ettiği için
    // tek tek kısımlara ulaşmanın başka yolu yok. Odaklıyken dış halkanın
    // kendisi zaten kısım dilimlerinden oluşuyor ve tabbable -- burada
    // aynı kısım için İKİNCİ bir durak eklemek yalnız yinelenmiş, aynı
    // hedefe giden bir Tab durağı olurdu.
    if (klavyeStoklariEkle) {
      halka.append("g").attr("class", "futuhat-mimarisi-kisimlar")
        .selectAll("line").data(kisimlar).join("line")
        .attr("class", "futuhat-mimarisi-kisim-odak")
        .attr("x1", (k) => Math.cos(kisimAcisi(k, dom)) * r0)
        .attr("y1", (k) => Math.sin(kisimAcisi(k, dom)) * r0)
        .attr("x2", (k) => Math.cos(kisimAcisi(k, dom)) * r1)
        .attr("y2", (k) => Math.sin(kisimAcisi(k, dom)) * r1)
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", (k) => babEtiketi(k.bablar[0]))
        .on("focus", (ev, k) => babVurgula(k.bablar[0]))
        .on("blur", () => babVurgula(null))
        .on("keydown", function (ev, k) {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); babPaneli(k.bablar[0]); }
        });
    }
  }

  function kisimAcisi(k, domain) {
    return babAcisi((k.bablar[0] + k.bablar[k.bablar.length - 1]) / 2, domain);
  }

  // İmlecin merkeze göre açısından bab numarası. Halkanın kendi dönüşümü
  // (zoom/pan) hesaba katılsın diye ölçüm SVG'nin yerel koordinatında.
  function imlectenBab(ev, node, domain) {
    const bas = domain ? domain.start : 1;
    const bit = domain ? domain.end : TOPLAM_BAB;
    const toplam = bit - bas + 1;
    const [x, y] = d3.pointer(ev, node);
    let a = Math.atan2(y, x) + Math.PI / 2;          // tepe = 0
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const n = bas + Math.floor((a / (2 * Math.PI)) * toplam);
    return n >= bas && n <= bit ? n : null;
  }

  // Bir bab bu yarıçapta çok az yer tutabiliyor (kökte ~1.6px); imleci tam
  // çentiğin üstüne getirmeyi şart koşarsak okunmuş iki bab arasına düşen
  // piksel hiçbir şey yapmıyor ve halka bozukmuş gibi duruyor (testte bab
  // 47'de görüldü). O yüzden en yakın OKUNMUŞ baba kayıyoruz -- ama yalnız
  // domain SINIRLARI içinde: odaklıyken komşu fasılın bir babına sıçramak
  // yanlış (ve zaten çizilmemiş bir şeyi) işaret ederdi.
  var YAKINLIK = 4;
  function yakinKapsananBab(n, domain) {
    if (!n) return null;
    if (babKisim.has(n)) return n;
    const bas = domain ? domain.start : 1;
    const bit = domain ? domain.end : TOPLAM_BAB;
    for (var d = 1; d <= YAKINLIK; d++) {
      if (n - d >= bas && babKisim.has(n - d)) return n - d;
      if (n + d <= bit && babKisim.has(n + d)) return n + d;
    }
    return null;
  }

  // Vurgu: imlecin üstünde olduğu babın çentiği ve aynı kısmın bütün
  // çentikleri birlikte parlıyor -- tıklamanın nereye gideceği görünsün.
  function babVurgula(n) {
    if (!g) return;
    const k = n ? babKisim.get(n) : null;
    const kume = k ? new Set(k.bablar) : null;
    g.selectAll("line.futuhat-mimarisi-bab--dolu")
      .classed("futuhat-mimarisi-bab--deginiliyor", function () {
        return !!kume && kume.has(+this.getAttribute("data-bab"));
      });
  }

  function babFasli(n) {
    return faslar.find((f) => n >= f.aralikBaslangic && n <= f.aralikBitis) || null;
  }

  function babEtiketi(n) {
    const k = babKisim.get(n);
    return tt({ tr: "Bab", en: "Chapter", pt: "Capítulo" }) + " " + n
      + (k ? " — " + tt(k.baslik) : "");
  }

  function babIpucu(ev, n) {
    const k = babKisim.get(n);
    const f = babFasli(n);
    tooltip.innerHTML =
      `<strong>${tt({ tr: "Bab", en: "Chapter", pt: "Capítulo" })} ${n}</strong>`
      + `<span class="node-hover-tip__meta">${f ? tt(f.ad) + " · " : ""}${k ? tt(k.baslik) : ""}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function babPaneli(n) {
    const k = babKisim.get(n);
    if (!k) return;
    const f = babFasli(n);
    const base = window.__dostRouteBase || "";
    const yol = (base ? base + "/" : "") + "futuhat/" + k.id;
    // Kısmın kapsadığı bütün bablar: okuyucu tek bab'a değil bir okuma
    // birimine gidiyor, hangi babları içerdiğini önden bilsin.
    const aralik = k.bablar.length > 1
      ? k.bablar[0] + "–" + k.bablar[k.bablar.length - 1]
      : String(k.bablar[0]);
    lastBabNo = n;
    sonAcilanPanel = "bab";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Bab", en: "Chapter", pt: "Capítulo" })} ${n}${f ? " · " + tt(f.ad) : ""}</p>
      <h2 class="detail-title">${tt(k.baslik)}</h2>
      <p class="eser-agi-kimlik">${tt({ tr: "Cilt", en: "Volume", pt: "Volume" })} ${k.cilt} · ${tt({ tr: "Kısım", en: "Part", pt: "Parte" })} ${k.kisim} — ${tt({ tr: "bab", en: "chapters", pt: "capítulos" })} ${aralik}</p>
      <p><a class="btn-ghost" href="${yol}">${tt({ tr: "Bu kısmı oku", en: "Read this part", pt: "Ler esta parte" })}</a></p>`;
    detailPanel.hidden = false;
  }

  function vurgula(id, on) {
    if (!g) return;
    g.selectAll("path.futuhat-mimarisi-dilim").classed("futuhat-mimarisi-dilim--deginiliyor", (d) => on && d.id === id);
    g.selectAll("text.futuhat-mimarisi-etiket").classed("futuhat-mimarisi-etiket--deginiliyor", (d) => on && d.id === id);
  }

  function ipucu(ev, d) {
    tooltip.innerHTML = `<strong>${tt(d.ad)}</strong><span class="node-hover-tip__meta">${d.aralikBaslangic}–${d.aralikBitis} (${d.babSayisi} ${tt({ tr: "bab", en: "chapters", pt: "capítulos" })})</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  // Fasıla tıklamak/Enter'lamak iki şeyi BİRLİKTE yapar: panel açılır VE
  // grafik o fasılın içine iner (ciz() odakFasilId'yi görüp dış halkayı
  // kısımlara çevirir). Aynı fasıla ikinci kez girilirse (Esc'ten dönüşte
  // olduğu gibi) gereksiz yeniden çizim atlanıyor.
  function faslPaneli(d) {
    if (odakFasilId !== d.id) {
      odakFasilId = d.id;
      ciz();
    }
    sonAcilanPanel = "fasil";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${d.sira}/6 · ${d.aralikBaslangic}–${d.aralikBitis}</p>
      <h2 class="detail-title">${tt(d.ad)}</h2>
      <p class="eser-agi-kimlik">${d.babSayisi} ${tt({ tr: "bab", en: "chapters", pt: "capítulos" })} — ${tt(d.esmaKarsiligi)}</p>
      <div class="detail-block detail-block--soru"><p>${tt(d.aciklama)}</p></div>
      ${fasilKapsamSatiri(d)}
      ${eslesme ? `<p class="futuhat-mimarisi-kapsam">${tt({ tr: "Halka artık bu fasılın kısımlarını gösteriyor — birine tıklayın.", en: "The ring now shows this section's parts — click one.", pt: "O anel agora mostra as partes desta seção — clique numa." })}</p>` : ""}
      <p class="elestiri-kaynak-satiri">${data.kaynak.yazar}, <em>${data.kaynak.eser}</em></p>`;
    detailPanel.hidden = false;
    vurgula(d.id, true);
  }

  // Kapsam satırı: "24/73 bab okundu". Sayı süs değil -- sitenin nereye
  // gidip nereye gitmediğini tek bakışta söyleyen şey bu.
  function fasilKapsamSatiri(d) {
    if (!eslesme) return "";
    const f = (eslesme.fasilDagilimi || []).find((x) => x.id === d.id);
    if (!f) return "";
    return `<p class="futuhat-mimarisi-kapsam">${f.kapsanan}/${f.babSayisi} `
      + tt({ tr: "bab okundu", en: "chapters read", pt: "capítulos lidos" }) + "</p>";
  }

  function girisPaneli() {
    if (odakFasilId) { odakFasilId = null; ciz(); }
    sonAcilanPanel = "giris";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Fütûhât'ın Mimarisi", en: "The Architecture of the Futûhât", pt: "A Arquitetura das Futûhât" })}</p>
      <h2 class="detail-title">${tt({ tr: "560 bab, altı fasıl", en: "560 chapters, six sections", pt: "560 capítulos, seis seções" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>
      ${eslesme ? `<p class="futuhat-mimarisi-kapsam">${eslesme.kapsananBabSayisi}/${eslesme.toplamBab} `
        + tt({ tr: "bab okundu — bir fasıla tıklayın, içine inin", en: "chapters read — click a section to descend into it", pt: "capítulos lidos — clique numa seção para entrar nela" }) + "</p>" : ""}
      <p class="elestiri-kaynak-satiri elestiri-kaynak-satiri--omurga">${data.kaynak.yazar}, <em>${data.kaynak.eser}</em></p>`;
    detailPanel.hidden = false;
  }

  function ortala(animate) {
    if (!zoom) return;
    const hedef = animate && !reduceMotion ? svg.transition().duration(420) : svg;
    hedef.call(zoom.transform, d3.zoomIdentity);
  }

  let yuklendi = false;
  function yukle() {
    if (yuklendi) return Promise.resolve();
    const base = window.__dostRouteBase || "";
    const p = (ad) => (base ? base + "/" : "") + "data/ibn-arabi/" + ad;
    // Eşleşme dosyası olmadan da sayfa çalışır: yalnız dış halka çizilir.
    // Bu bilinçli -- mimari, kapsam verisine bağımlı olmamalı.
    return Promise.all([
      GU.fetchJson(p("futuhat-mimarisi.json")),
      GU.fetchJson(p("futuhat-bab-eslesme.json")).catch(() => null),
    ]).then(([d, e]) => {
      data = d;
      eslesme = e;
      babKisim = new Map();
      if (e && e.kisimlar) {
        e.kisimlar.forEach((k) => k.bablar.forEach((n) => babKisim.set(n, k)));
      }
      faslar = (d.faslar || []).map((f) => Object.assign({}, f)).sort((a, b) => a.sira - b.sira);
      faslById = new Map(faslar.map((f) => [f.id, f]));
      yuklendi = true;
      ciz();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("futuhat-mimarisi-recenter", () => ortala(true));
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    // "Bir adım geri": açık bir bab paneli varsa önce fasılın kendi
    // paneline (grafik odaklı kalır); o da değilse ve odaklıysak girişe
    // (grafik köke döner); zaten kökteysek ortak katman panelı kapatır.
    // kuran-dokusu.js'in izlediği tek-fonksiyonlu desenin aynısı, bir
    // adım daha derin: burada iki seviye var, orada bir.
    GU.registerStepBack("futuhat-mimarisi-wrap", () => {
      if (sonAcilanPanel === "bab") {
        const f = odakFasilId ? faslById.get(odakFasilId) : null;
        if (f) faslPaneli(f); else girisPaneli();
        return true;
      }
      if (sonAcilanPanel === "fasil") { girisPaneli(); return true; }
      return false;
    });
    window.addEventListener("resize", () => {
      if (!yuklendi || wrapEl.hidden) return;
      ciz();
    });
  }

  return {
    activate() {
      baglaBirKez();
      yukle().then(() => { ciz(); girisPaneli(); }).catch(() => {
        const st = document.getElementById("futuhat-mimarisi-wrap-status");
        if (st) {
          st.hidden = false;
          st.querySelector(".view-status__text").textContent =
            tt({ tr: "Şema yüklenemedi.", en: "The diagram could not be loaded.", pt: "O diagrama não pôde ser carregado." });
        }
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      ciz();
      if (sonAcilanPanel === "bab" && lastBabNo != null && babKisim.has(lastBabNo)) {
        babPaneli(lastBabNo);
      } else if (sonAcilanPanel === "fasil" && odakFasilId) {
        const d = faslById.get(odakFasilId);
        if (d) faslPaneli(d); else girisPaneli();
      } else {
        girisPaneli();
      }
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = faslById.get(id);
        if (d) faslPaneli(d);
      });
    },
  };
})();
