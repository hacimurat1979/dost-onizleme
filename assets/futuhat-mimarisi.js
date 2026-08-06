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

  // gorunumModu: "fasil" (yukarıdaki altı-fasıl/560-bab halkası, Chodkiewicz'in
  // dış çerçevesi) ya da "icindekiler" (aşağıdaki cilt→sifr→kısım→konu
  // dörtlü kademe -- kitabın KENDİ iç bölümlemesi + sitenin gerçek okuma
  // kapsamı). İkisi ayrı veri, ayrı çizim, ayrı durum; yalnız svg/tooltip/
  // detail-panel paylaşılıyor. Bkz. dosya sonundaki İÇİNDEKİLER bloğu.
  let gorunumModu = "fasil";

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(360, r.width), h: Math.max(360, r.height) };
  }

  function ciz() {
    if (gorunumModu === "icindekiler") { icindekilerCiz(); return; }
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

  // =========================================================================
  // İÇİNDEKİLER (2026-08-06) — Cilt → Sifr → Kısım → Konu, dört kademeli
  // yakınlaştırılabilir bir "flame chart" (icicle). Kullanıcının istediği
  // ikinci görünüm: "sifr" Chodkiewicz'in dışarıdan getirdiği altı fasıl
  // değil, Fütûhât'ın KENDİ metninde defalarca anılan iç bölümlemesi
  // ("Beşinci Sifr'in açılışı", "...ile kırk yedinci kısım sona erdi").
  // Kaynak: data/ibn-arabi/futuhat-sifir-eslesme.json (kanıt cümleleri ve
  // yöntem notu orada). 223 kısmın 154'ü kesin bir sifre bağlanabiliyor;
  // 69'u metinde hiç anılmayan aralıklara düştüğü için "sifrBelirsiz" --
  // tahminle doldurulmadı, grafikte de gizlenmiyor (bkz. CSS
  // --belirsiz sınıfı): fasıl/bab halkasındaki "soluk = okunmamış" dilinin
  // aynısı, burada "soluk = sınırı bilinmiyor".
  //
  // NEDEN DONUT DEĞİL. Dört kademe + yaprak düzeyinde ~1520 konu başlığı,
  // gerçek metinle (başlık okunabilir olmalı) taşınacak kadar dar bir
  // radyal dilime sığmıyor -- Kur'ân Dokusu'nda otuz beş sûre adı için
  // bulunan "eşit aralık" çözümü bile burada işe yaramaz (bkz.
  // futuhat-mimarisi.js'in odakHalkaCiz notu, aynı sorunun 560 bab
  // versiyonu). Yatay şeritler (icicle) başlıkları YATAY yazdırabiliyor --
  // okunabilirlik radyalin kaybettiği şey. Tıklanan şerit tam genişliğe
  // yayılır, atalar üstte ince bir "neredeyim" şeridine daralır, kardeş
  // dallar kaybolur -- ETKILESIM_DILI.md'nin "grafiğin içine inme" fiili,
  // burada dördüncü kademeye kadar.
  const ICINDEKILER_SATIR = 4; // cilt / sifr·belirsiz / kısım / konu

  let sifirVeri = null;
  let icindekilerKok = null;        // d3.hierarchy kökü (depth 0, görünmez)
  let icindekilerYuklendi = false;
  let icindekilerOdak = null;       // şu an tam genişliğe yayılan düğüm

  function romen(n) {
    const TABLO = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
      [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let s = "", r = n;
    for (let i = 0; i < TABLO.length; i++) { while (r >= TABLO[i][0]) { s += TABLO[i][1]; r -= TABLO[i][0]; } }
    return s;
  }

  // Kısım listesini (üç dilde, kısım no'ya göre sıralı) cilt→sifr/belirsiz
  // →kısım→konu ağacına toplar. Aynı (cilt, sifr) art arda geldiği sürece
  // TEK gruba birleşir -- bir sifr bir cilt sınırını aşarsa (örn. 16-18
  // belirsizliği cilt 8'den 9'a taşıyor) bu, cilt değişince otomatik
  // olarak yeni bir grup açar; kasıtlı, çünkü üst kademe zaten cilt.
  function icindekilerHiyerarsiKur(v) {
    const ciltMap = new Map();
    let mevcutGrup = null;
    v.kisimlar.forEach((k) => {
      let ciltDugum = ciltMap.get(k.cilt);
      if (!ciltDugum) {
        ciltDugum = { tur: "cilt", no: k.cilt, id: "cilt-" + k.cilt, children: [] };
        ciltMap.set(k.cilt, ciltDugum);
      }
      const anahtar = k.cilt + "|" + (k.sifr != null ? ("s" + k.sifr) : ("b" + k.sifrBelirsiz.join("-")));
      if (!mevcutGrup || mevcutGrup.anahtar !== anahtar) {
        mevcutGrup = {
          tur: k.sifr != null ? "sifr" : "belirsiz",
          sifr: k.sifr, adaylar: k.sifrBelirsiz, cilt: k.cilt,
          id: "grup-" + anahtar, anahtar: anahtar, children: [],
        };
        ciltDugum.children.push(mevcutGrup);
      }
      const konular = (k.konular || []).map((kn, i) => ({
        tur: "konu", ad: kn, kisimId: k.id, kisimBaslik: k.baslik, index: i,
        id: k.id + "-konu-" + i, value: 1,
      }));
      mevcutGrup.children.push({
        tur: "kisim", id: k.id, cilt: k.cilt, kisim: k.kisim,
        baslik: k.baslik, pageRange: k.pageRange,
        children: konular.length ? konular : undefined,
        value: konular.length ? undefined : 1,
      });
    });
    const ciltler = Array.from(ciltMap.values()).sort((a, b) => a.no - b.no);
    const kok = d3.hierarchy({ tur: "kok", id: "kok", children: ciltler }, (d) => d.children)
      .sum((d) => d.value || 0);
    genislikAta(kok, 0, 1);
    return kok;
  }

  // x0/x1: [0,1] aralığında değer-oranlı yatay konum (piksele ciz() çevirir).
  function genislikAta(node, x0, x1) {
    node.x0 = x0; node.x1 = x1;
    if (!node.children) return;
    let acc = x0;
    node.children.forEach((c) => {
      const pay = node.value > 0 ? (c.value / node.value) * (x1 - x0) : 0;
      genislikAta(c, acc, acc + pay);
      acc += pay;
    });
  }

  let icindekilerYukleSozu = null;
  function icindekilerYukle() {
    if (icindekilerYuklendi) return Promise.resolve();
    if (icindekilerYukleSozu) return icindekilerYukleSozu;
    const base = window.__dostRouteBase || "";
    const p = (ad) => (base ? base + "/" : "") + "data/ibn-arabi/" + ad;
    icindekilerYukleSozu = GU.fetchJson(p("futuhat-sifir-eslesme.json")).then((v) => {
      sifirVeri = v;
      icindekilerKok = icindekilerHiyerarsiKur(v);
      icindekilerOdak = icindekilerKok;
      icindekilerYuklendi = true;
    });
    return icindekilerYukleSozu;
  }

  function icindekilerCiz() {
    const { w, h } = boyut();
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    g = svg.append("g").attr("class", "futuhat-icindekiler-scene");
    if (!icindekilerKok) return; // henüz yüklenmedi (ilk moda-geçiş anı)

    // Konu (4. satır) yalnız bir KISMA odaklanılınca çiziliyor. Kökte 1520
    // konu, ~0,8px'lik dilimlere düşüyor -- kenarlık (stroke) dolgudan geniş
    // kalıp şeridi arka plan rengine boyuyor, ölçülüp doğrulandı (Playwright,
    // 2026-08-06). Fasıl/bab halkasının "soluk ama görünür" ilkesi burada
    // farklı bir çözüm istiyor: 560 çentik gibi TEK halkada sıkışmıyor,
    // kendi satırı var, o yüzden satırı TAMAMEN saklamak (yalnız odak
    // derinliği ≥3 kısımdayken göstermek) -- gizlemek değil, henüz alaka
    // düzeyi yok: kısma inmeden hangi konunun nerede olduğu zaten sorulmuyor.
    const satirSayisi = icindekilerOdak.depth >= 3 ? ICINDEKILER_SATIR : ICINDEKILER_SATIR - 1;
    const satirYuksekligi = h / satirSayisi;
    const olcek = icindekilerOdak.x1 > icindekilerOdak.x0 ? 1 / (icindekilerOdak.x1 - icindekilerOdak.x0) : 1;
    const SATIR_TUR = ["", "cilt", "sifr", "kisim", "konu"]; // depth->tür; depth 0 kök, çizilmiyor

    const gorunur = icindekilerKok.descendants().filter((n) => {
      if (n.depth < 1 || n.depth > satirSayisi) return false;
      n._gx0 = Math.max(0, Math.min(1, (n.x0 - icindekilerOdak.x0) * olcek)) * w;
      n._gx1 = Math.max(0, Math.min(1, (n.x1 - icindekilerOdak.x0) * olcek)) * w;
      return n._gx1 > n._gx0;
    });

    const dugumG = g.selectAll("g.futuhat-icindekiler-dugum").data(gorunur, (d) => d.data.id).join("g")
      .attr("class", (d) => "futuhat-icindekiler-dugum futuhat-icindekiler-dugum--" + SATIR_TUR[d.depth]
        + (d.data.tur === "belirsiz" ? " futuhat-icindekiler-dugum--belirsiz" : "")
        + (d === icindekilerOdak ? " futuhat-icindekiler-dugum--odak" : ""));

    dugumG.append("rect").attr("class", "futuhat-icindekiler-rect")
      .attr("x", (d) => d._gx0)
      .attr("y", (d) => (d.depth - 1) * satirYuksekligi)
      .attr("width", (d) => Math.max(0, d._gx1 - d._gx0))
      .attr("height", satirYuksekligi)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => icindekilerEtiket(d));

    // Metin yalnız yeterince geniş hücrelerde -- ölçüm değil eşik: bir
    // clipPath her hücreyi kendi sınırına kesiyor, komşuya taşmıyor.
    const ESIK = 34;
    dugumG.filter((d) => (d._gx1 - d._gx0) > ESIK).each(function (d) {
      const gEl = d3.select(this);
      const y0 = (d.depth - 1) * satirYuksekligi;
      const clipId = "ic-clip-" + d.data.id.replace(/[^a-zA-Z0-9_-]/g, "");
      gEl.append("clipPath").attr("id", clipId).append("rect")
        .attr("x", d._gx0 + 3).attr("y", y0 + 2)
        .attr("width", Math.max(0, d._gx1 - d._gx0 - 6)).attr("height", Math.max(0, satirYuksekligi - 4));
      gEl.append("text").attr("class", "futuhat-icindekiler-metin")
        .attr("clip-path", `url(#${clipId})`)
        .attr("x", d._gx0 + 7).attr("y", y0 + satirYuksekligi / 2 + 4)
        .text(icindekilerBaslikMetni(d));
    });

    icindekilerEtkilesimBagla(dugumG);
  }

  function icindekilerBaslikMetni(d) {
    if (d.data.tur === "cilt") return tt({ tr: "Cilt", en: "Volume", pt: "Volume" }) + " " + romen(d.data.no);
    if (d.data.tur === "sifr") return d.data.sifr + ". " + tt({ tr: "Sifr", en: "Sifr", pt: "Sifr" });
    if (d.data.tur === "belirsiz") return tt({ tr: "sifr belirsiz", en: "sifr uncertain", pt: "sifr incerto" });
    if (d.data.tur === "kisim") return tt(d.data.baslik);
    if (d.data.tur === "konu") return tt(d.data.ad);
    return "";
  }

  function icindekilerEtiket(d) {
    const ana = icindekilerBaslikMetni(d);
    if (d.data.tur === "kisim") return ana + " — " + d.data.id;
    if (d.data.tur === "sifr" || d.data.tur === "belirsiz") {
      const ar = kisimAraligi(d);
      return ana + (ar ? " — " + tt({ tr: "kısım", en: "parts", pt: "partes" }) + " " + ar : "");
    }
    return ana;
  }

  function kisimAraligi(d) {
    const kisimlar = d.descendants().filter((n) => n.data.tur === "kisim").map((n) => n.data.kisim);
    if (!kisimlar.length) return null;
    const min = Math.min.apply(null, kisimlar), max = Math.max.apply(null, kisimlar);
    return min === max ? String(min) : min + "–" + max;
  }

  function icindekilerEtkilesimBagla(sel) {
    sel.on("mouseenter", function (ev, d) { icindekilerVurgula(d, true); icindekilerIpucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { icindekilerVurgula(null, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { icindekilerVurgula(d, true); })
      .on("blur", function () { icindekilerVurgula(null, false); })
      .on("click", (ev, d) => icindekilerTikla(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); icindekilerTikla(d); }
      });
  }

  function icindekilerVurgula(d, on) {
    if (!g) return;
    g.selectAll("g.futuhat-icindekiler-dugum").classed("futuhat-icindekiler-dugum--deginiliyor",
      (o) => !!on && !!d && o.data.id === d.data.id);
  }

  function icindekilerIpucu(ev, d) {
    let alt = "";
    if (d.data.tur === "kisim" && d.data.pageRange) alt = tt({ tr: "s.", en: "p.", pt: "p." }) + " " + d.data.pageRange;
    else if (d.data.tur === "konu") alt = tt(d.data.kisimBaslik);
    else if (d.data.tur === "belirsiz") alt = tt({ tr: "aday: ", en: "candidates: ", pt: "candidatos: " }) + d.data.adaylar.join(", ");
    tooltip.innerHTML = `<strong>${icindekilerBaslikMetni(d)}</strong>` + (alt ? `<span class="node-hover-tip__meta">${alt}</span>` : "");
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  // Dallanan düğüme (cilt/sifr/belirsiz/konusu-olan-kısım) tıklamak hem
  // panel açar hem grafiği onun içine indirir -- fasıl/bab halkasındaki
  // faslPaneli ile AYNI birleşik hareket. Yaprağa (konu, ya da istisnaen
  // konusuz bir kısım) tıklamak yalnız panel açar: veri burada bitiyor.
  function icindekilerTikla(d) {
    if (d.children && d.children.length) icindekilerOdaklan(d);
    else icindekilerPanelGoster(d);
  }

  function icindekilerOdaklan(d) {
    icindekilerOdak = d;
    ciz();
    icindekilerPanelGoster(d);
  }

  function icindekilerPanelGoster(d) {
    const en = d.data;
    let ic = "";
    if (en.tur === "kok") {
      ic = `
        <p class="detail-eyebrow">${tt({ tr: "Fütûhât'ın İçindekileri", en: "The Futûhât's Table of Contents", pt: "O Índice das Futûhât" })}</p>
        <h2 class="detail-title">${tt({ tr: "18 cilt, 36 sifr, 223 kısım", en: "18 volumes, 36 sifrs, 223 parts", pt: "18 volumes, 36 sifrs, 223 partes" })}</h2>
        <div class="detail-block detail-block--soru"><p>${tt(sifirVeri.not)}</p></div>
        <p class="futuhat-mimarisi-kapsam">${sifirVeri.kisimSifreAtanan}/${sifirVeri.toplamKisim} `
          + tt({ tr: "kısım bir sifre bağlı — bir cilde tıklayın, içine inin", en: "parts tied to a sifr — click a volume to descend into it", pt: "partes ligadas a um sifr — clique num volume para entrar nele" }) + "</p>";
    } else if (en.tur === "cilt") {
      const kisimSayisi = d.descendants().filter((n) => n.data.tur === "kisim").length;
      ic = `
        <p class="detail-eyebrow">${tt({ tr: "Cilt", en: "Volume", pt: "Volume" })} ${romen(en.no)}/XVIII</p>
        <h2 class="detail-title">${tt({ tr: "Cilt " + romen(en.no), en: "Volume " + romen(en.no), pt: "Volume " + romen(en.no) })}</h2>
        <p class="eser-agi-kimlik">${kisimSayisi} ${tt({ tr: "kısım", en: "parts", pt: "partes" })} — ${tt({ tr: "kısım", en: "parts", pt: "partes" })} ${kisimAraligi(d)}</p>
        <p class="futuhat-mimarisi-kapsam">${tt({ tr: "Halka artık bu cildin sifr kademesini gösteriyor — birine tıklayın.", en: "The chart now shows this volume's sifr tier — click one.", pt: "O gráfico agora mostra o nível sifr deste volume — clique num." })}</p>`;
    } else if (en.tur === "sifr") {
      const kisimSayisi = d.descendants().filter((n) => n.data.tur === "kisim").length;
      ic = `
        <p class="detail-eyebrow">${tt({ tr: "Cilt", en: "Volume", pt: "Volume" })} ${romen(en.cilt)} · ${tt({ tr: "Sifr", en: "Sifr", pt: "Sifr" })} ${en.sifr}/36</p>
        <h2 class="detail-title">${en.sifr}. ${tt({ tr: "Sifr", en: "Sifr", pt: "Sifr" })}</h2>
        <p class="eser-agi-kimlik">${kisimSayisi} ${tt({ tr: "kısım", en: "parts", pt: "partes" })} — ${tt({ tr: "kısım", en: "parts", pt: "partes" })} ${kisimAraligi(d)}</p>
        <div class="detail-block detail-block--soru"><p>${tt({
          tr: "Fütûhât'ın kendi metninde açıkça anılan bir iç bölüm — modern cilt/kısım sayımından ayrı bir eksen (bkz. giriş paneli).",
          en: "An inner division the Futûhât's own text explicitly names — an axis distinct from the modern volume/part numbering (see the intro panel).",
          pt: "Uma divisão interna que o próprio texto das Futûhât nomeia explicitamente — um eixo distinto da numeração moderna de volume/parte (ver o painel de introdução)."
        })}</p></div>
        <p class="futuhat-mimarisi-kapsam">${tt({ tr: "Halka artık bu sifrin kısımlarını gösteriyor — birine tıklayın.", en: "The chart now shows this sifr's parts — click one.", pt: "O gráfico agora mostra as partes deste sifr — clique numa." })}</p>`;
    } else if (en.tur === "belirsiz") {
      const kisimSayisi = d.descendants().filter((n) => n.data.tur === "kisim").length;
      ic = `
        <p class="detail-eyebrow">${tt({ tr: "Cilt", en: "Volume", pt: "Volume" })} ${romen(en.cilt)} · ${tt({ tr: "sifr belirsiz", en: "sifr uncertain", pt: "sifr incerto" })}</p>
        <h2 class="detail-title">${tt({ tr: "Sifr belirsiz", en: "Sifr uncertain", pt: "Sifr incerto" })}</h2>
        <p class="eser-agi-kimlik">${kisimSayisi} ${tt({ tr: "kısım", en: "parts", pt: "partes" })} — ${tt({ tr: "kısım", en: "parts", pt: "partes" })} ${kisimAraligi(d)}</p>
        <div class="detail-block detail-block--soru"><p>${tt({
          tr: `Bu aralıkta kısım metinleri hiç sifr numarası anmıyor. ${en.adaylar.join(" ya da ")}. sifre ait olabilir -- kesin sınır metinde işaretlenmediği için tahminle doldurulmadı.`,
          en: `Across this stretch, the part texts never name a sifr number. It may belong to Sifr ${en.adaylar.join(" or ")} -- since the text marks no firm boundary, the gap was not filled by guesswork.`,
          pt: `Nesse trecho, os textos das partes nunca nomeiam um número de sifr. Pode pertencer ao Sifr ${en.adaylar.join(" ou ")} -- como o texto não marca uma fronteira firme, a lacuna não foi preenchida por suposição.`
        })}</p></div>
        <p class="futuhat-mimarisi-kapsam">${tt({ tr: "Halka artık bu aralığın kısımlarını gösteriyor — birine tıklayın.", en: "The chart now shows this stretch's parts — click one.", pt: "O gráfico agora mostra as partes deste trecho — clique numa." })}</p>`;
    } else if (en.tur === "kisim") {
      const base = window.__dostRouteBase || "";
      const yol = (base ? base + "/" : "") + "futuhat/" + en.id;
      const konuSayisi = (d.children || []).length;
      ic = `
        <p class="detail-eyebrow">${tt({ tr: "Cilt", en: "Volume", pt: "Volume" })} ${romen(en.cilt)} · ${tt({ tr: "Kısım", en: "Part", pt: "Parte" })} ${en.kisim}${en.pageRange ? " · s. " + en.pageRange : ""}</p>
        <h2 class="detail-title">${tt(en.baslik)}</h2>
        <p class="eser-agi-kimlik">${konuSayisi} ${tt({ tr: "konu", en: "topics", pt: "tópicos" })}</p>
        <p><a class="btn-ghost" href="${yol}">${tt({ tr: "Bu kısmı oku", en: "Read this part", pt: "Ler esta parte" })}</a></p>
        ${konuSayisi ? `<p class="futuhat-mimarisi-kapsam">${tt({ tr: "Halka artık bu kısmın konularını gösteriyor.", en: "The chart now shows this part's topics.", pt: "O gráfico agora mostra os tópicos desta parte." })}</p>` : ""}`;
    } else if (en.tur === "konu") {
      const base = window.__dostRouteBase || "";
      const yol = (base ? base + "/" : "") + "futuhat/" + en.kisimId;
      ic = `
        <p class="detail-eyebrow">${tt(en.kisimBaslik)}</p>
        <h2 class="detail-title">${tt(en.ad)}</h2>
        <p><a class="btn-ghost" href="${yol}">${tt({ tr: "Bu kısmı oku", en: "Read this part", pt: "Ler esta parte" })}</a></p>`;
    }
    detailContent.innerHTML = ic;
    detailPanel.hidden = false;
  }

  function ortala(animate) {
    if (gorunumModu === "icindekiler") { icindekilerOdaklan(icindekilerKok); return; }
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

  // İki mod arası geçiş: "Fasıllar" (Chodkiewicz, mevcut) / "İçindekiler"
  // (cilt→sifr→kısım→konu, yeni). Tek düğme çifti, tek svg -- ciz()'in
  // kendisi zaten gorunumModu'na göre dallanıyor (dosya başı).
  function modaGec(yeniMod) {
    if (gorunumModu === yeniMod) return;
    gorunumModu = yeniMod;
    document.querySelectorAll(".futuhat-mimarisi-mod-btn").forEach((b) => {
      const on = b.dataset.mod === yeniMod;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    if (yeniMod === "icindekiler") {
      icindekilerYukle().then(() => { ciz(); icindekilerPanelGoster(icindekilerOdak); }).catch(() => {
        const st = document.getElementById("futuhat-mimarisi-wrap-status");
        if (st) {
          st.hidden = false;
          st.querySelector(".view-status__text").textContent =
            tt({ tr: "İçindekiler yüklenemedi.", en: "The table of contents could not be loaded.", pt: "O índice não pôde ser carregado." });
        }
      });
    } else {
      ciz();
      if (sonAcilanPanel === "bab" && lastBabNo != null && babKisim.has(lastBabNo)) babPaneli(lastBabNo);
      else if (sonAcilanPanel === "fasil" && odakFasilId) { const f = faslById.get(odakFasilId); if (f) faslPaneli(f); else girisPaneli(); }
      else girisPaneli();
    }
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("futuhat-mimarisi-recenter", () => ortala(true));
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    document.querySelectorAll(".futuhat-mimarisi-mod-btn").forEach((b) => {
      b.addEventListener("click", () => modaGec(b.dataset.mod));
    });
    // "Bir adım geri": İçindekiler modunda tek kural -- odak varsa üst
    // düğümüne çık; kökteysek geri adım yok, ortak katman panelı kapatır.
    // Fasıllar modunda: açık bir bab paneli varsa önce fasılın kendi
    // paneline (grafik odaklı kalır); o da değilse ve odaklıysak girişe
    // (grafik köke döner); zaten kökteysek ortak katman panelı kapatır.
    // kuran-dokusu.js'in izlediği tek-fonksiyonlu desenin aynısı.
    GU.registerStepBack("futuhat-mimarisi-wrap", () => {
      if (gorunumModu === "icindekiler") {
        if (icindekilerOdak && icindekilerOdak.parent) { icindekilerOdaklan(icindekilerOdak.parent); return true; }
        return false;
      }
      if (sonAcilanPanel === "bab") {
        const f = odakFasilId ? faslById.get(odakFasilId) : null;
        if (f) faslPaneli(f); else girisPaneli();
        return true;
      }
      if (sonAcilanPanel === "fasil") { girisPaneli(); return true; }
      return false;
    });
    window.addEventListener("resize", () => {
      if (wrapEl.hidden) return;
      if (gorunumModu === "icindekiler" && icindekilerYuklendi) ciz();
      else if (gorunumModu === "fasil" && yuklendi) ciz();
    });
  }

  return {
    activate() {
      baglaBirKez();
      if (gorunumModu === "icindekiler") {
        icindekilerYukle().then(() => { icindekilerOdak = icindekilerKok; ciz(); icindekilerPanelGoster(icindekilerKok); }).catch(() => {
          const st = document.getElementById("futuhat-mimarisi-wrap-status");
          if (st) {
            st.hidden = false;
            st.querySelector(".view-status__text").textContent =
              tt({ tr: "İçindekiler yüklenemedi.", en: "The table of contents could not be loaded.", pt: "O índice não pôde ser carregado." });
          }
        });
        return;
      }
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
      if (gorunumModu === "icindekiler") {
        // Ağacın kendisi (x0/x1, yapı) dile bağlı değil -- yalnız tt()
        // ile okunan başlıklar değişiyor, o yüzden yeniden kurmaya gerek
        // yok, aynı odakta yeniden çizmek yeterli.
        if (!icindekilerYuklendi) return;
        ciz();
        icindekilerPanelGoster(icindekilerOdak);
        return;
      }
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
      // Dışarıdan gelen derin bağlantılar (ör. arama) hep fasıl id'si
      // taşıyor -- İçindekiler modundaysak önce Fasıllar'a dönülür.
      if (gorunumModu !== "fasil") modaGec("fasil");
      this.activate();
      yukle().then(() => {
        const d = faslById.get(id);
        if (d) faslPaneli(d);
      });
    },
  };
})();
