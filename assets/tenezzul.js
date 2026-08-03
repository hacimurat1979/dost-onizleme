/* Tenezzül — sürekli-zoom pilotu (FAZ 3, 2026-08-03; genişletildi 2026-08-03)
 *
 * NE OLDUĞU. Zât'tan başlayan İKİ inişte, kesintisiz yaklaşarak derine
 * gitme denemesi. Ayrı sayfalar arasında geçiş yok: kullanıcı yaklaştıkça
 * sahne KESİLMİYOR, ÇÖZÜNÜRLÜK DEĞİŞTİRİYOR.
 *
 *   İSİMLER   : Zât → Allah → Esmâ → bir isim (varsa alt isimleriyle) → metin
 *   MERTEBELER: Zât → Esmâ/Sıfat → A'yân-ı Sâbite → Tecellî → Âlemler →
 *               İnsân-ı Kâmil → Kalp (ve oradan Zât'a dönen yay)
 *
 * NEDEN İKİ EKSEN. İbn Arabî'de iniş tek çizgi değil: bir yandan Zât
 * isimlerde çoğalır (isimlendirme), bir yandan varlık mertebe mertebe
 * kesifleşir (vücûdî tenezzül). İkisi aynı yerden çıkıyor, o yüzden bu
 * görünümde de aynı sisten çıkıyorlar. İkinci eksenin sonu daireyi
 * kapatıyor (insân-ı kâmil → Zât, ontology.json'daki `return` kenarı) --
 * sitenin kurucu imgesi burada eksenin kendi şekli oluyor.
 *
 * NEDEN BÖYLE ÇİZİLİYOR. GORSEL_DIL.md: "kavramı resmetme, davranışını
 * resmet." Buradaki davranış TENEZZÜL'dür: yaklaştıkça Bir olan çokluğa
 * ayrışır. O yüzden bir alt mertebenin noktaları boş yerden BELİRMİYOR,
 * bir üsttekilerin İÇİNDEN çıkıyor -- her nokta kendi kaynağından ayrılarak
 * yerine gidiyor. Ayrışmanın kendisi görünür olmalı, sonucu değil.
 *
 * ZÂT'IN İSTİSNASI. GORSEL_DIL.md "Zât'ı parlak bir cisim gibi çizme"
 * diyor. İlk istasyonun etiketi, kenarı, biçimi yok: yalnız bir sis.
 * Yaklaştıkça NETLEŞMİYOR -- geriye açılıp daha da belirsizleşiyor.
 * Bakışı sıkılaştırarak Zât'a yaklaşılamaz; sahne bunu söylüyor.
 *
 * TEKERLEK. Burada yalın tekerlek yakınlaştırır -- ETKILESIM_DILI.md'de
 * adıyla yazılı KASITLI bir istisna, Esmâ'nınkinin sınır hâli (orada da
 * yalın tekerlek "bir kademe derine in" demektir). Bu görünümün tek
 * iddiası zaten iniştir. reduced-motion'da tekerlek devre dışı; düğmeler
 * ve ok tuşları her iki kipte de çalışır.
 */
(function () {
  "use strict";

  const GU = window.DostGraphUtils;
  const I18n = window.DostI18n;
  const tt = (o) => I18n.pick3(o);

  const wrapEl = document.getElementById("tenezzul-wrap");
  if (!wrapEl) return;
  const svgNode = document.getElementById("tenezzul-graph");
  const svg = d3.select(svgNode);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let esmaData = null, ontData = null, built = false;
  let names = [], byId = new Map(), kidsOf = new Map();
  let mertebeler = [];

  // --- Eksenler ------------------------------------------------------------
  const AXES = {
    isimler: {
      label: { tr: "İsimler", en: "The Names", pt: "Os Nomes" },
      stations: [
        { tr: "Zât", en: "The Essence", pt: "A Essência" },
        { tr: "Allah", en: "Allah", pt: "Allah" },
        { tr: "Esmâ", en: "The Names", pt: "Os Nomes" },
        { tr: "Bir isim", en: "One Name", pt: "Um Nome" },
        { tr: "Metin", en: "The text", pt: "O texto" },
      ],
    },
    mertebeler: {
      label: { tr: "Mertebeler", en: "Levels of being", pt: "Graus do ser" },
      // İstasyon adları ontology.json'dan geliyor (aşağıda dolduruluyor);
      // burada yalnız hangi düğümlerin hangi basamağa düştüğü yazılı.
      steps: [
        ["dhat"],
        ["sifat-asma"],
        ["ayan-sabite"],
        ["tecelli"],
        ["alem-ervah", "alem-misal", "alem-ecsam"],
        ["insan-i-kamil"],
        ["kalp"],
      ],
      stations: [],
    },
  };
  let axis = "isimler";
  const A = () => AXES[axis];
  const stationCount = () => A().stations.length;

  let focus = 0, target = 0, zoomBehavior = null;
  let steerX = 0, steerY = 0;
  // İnişte seçilen dal KİLİTLENİYOR: bir isme inmek ona bağlanmaktır.
  // Kilit olmasaydı, alt isimler açılırken en yakın "üst" isim de her
  // karede yeniden seçilir ve sahne titrerdi (elle denenip görüldü).
  let kilitliIsim = null;

  const layers = {};
  let esmaSel = null, altSel = null;

  function size() {
    const r = svgNode.getBoundingClientRect();
    return { w: Math.max(320, r.width || 900), h: Math.max(320, r.height || 620) };
  }
  function bandOpacity(i, width) {
    return Math.max(0, 1 - Math.abs(focus - i) / (width || 1));
  }
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // --- Kurulum -------------------------------------------------------------
  function build() {
    built = true;
    const { w, h } = size();
    svg.attr("viewBox", `${-w / 2} ${-h / 2} ${w} ${h}`);

    const defs = svg.append("defs");
    const g = defs.append("radialGradient").attr("id", "tenezzul-sis");
    g.append("stop").attr("offset", "0%").attr("stop-color", "currentColor").attr("stop-opacity", 0.30);
    g.append("stop").attr("offset", "55%").attr("stop-color", "currentColor").attr("stop-opacity", 0.14);
    g.append("stop").attr("offset", "100%").attr("stop-color", "currentColor").attr("stop-opacity", 0);
    defs.append("filter").attr("id", "tenezzul-blur")
      .attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%")
      .append("feGaussianBlur").attr("stdDeviation", 18);

    layers.sis = svg.append("g").attr("class", "tnz-sis");
    layers.sis.append("circle").attr("r", 1).attr("fill", "url(#tenezzul-sis)").attr("filter", "url(#tenezzul-blur)");

    layers.donus = svg.append("g").attr("class", "tnz-donus");
    layers.donus.append("path").attr("class", "tnz-donus__yay").attr("fill", "none");
    layers.donus.append("text").attr("class", "tnz-donus__etiket").attr("text-anchor", "middle");

    layers.allah = svg.append("g").attr("class", "tnz-allah");
    layers.allah.append("circle").attr("class", "tnz-allah__disc");
    layers.allah.append("text").attr("class", "tnz-allah__label").attr("text-anchor", "middle");

    layers.esma = svg.append("g").attr("class", "tnz-esma");
    layers.alt = svg.append("g").attr("class", "tnz-alt");
    layers.mert = svg.append("g").attr("class", "tnz-mert");
    layers.isim = svg.append("g").attr("class", "tnz-isim");
    layers.isim.append("circle").attr("class", "tnz-isim__disc");
    layers.isim.append("text").attr("class", "tnz-isim__name").attr("text-anchor", "middle");
    layers.isim.append("text").attr("class", "tnz-isim__short").attr("text-anchor", "middle");

    yerlestirIsimler();
    wire();
    render();
  }

  function yerlestirIsimler() {
    // İsimler KUTUPLARINA göre üç yaya bölünüyor (celâl / cemâl / kemâl) ve
    // hepsi TEK bir sarmal üzerinde ilerliyor. İlk denemede altın açılı bir
    // Fermat spirali kullanılmıştı; ekran görüntüsünde ölçüldü ve yapısız
    // bir serpinti gibi okundu -- oysa iddia "Bir olan çokluğa AYRIŞIR"dır
    // ve ayrışma rastgele değil ailelere göredir.
    const { w, h } = size();
    const R = Math.min(w, h) * 0.42;
    const POLES = ["cemal", "kemal", "celal"];
    const gruplar = { neutral: [] };
    POLES.forEach((p) => { gruplar[p] = []; });
    names.forEach((n) => (gruplar[n.pole] || gruplar.neutral).push(n));
    const sirali = POLES.concat(["neutral"]).filter((p) => gruplar[p].length);
    const BOSLUK = 0.16, toplam = names.length;
    let acc = 0, gecen = 0;
    sirali.forEach((p) => {
      const grup = gruplar[p];
      const pay = (grup.length / toplam) * (Math.PI * 2) - BOSLUK;
      const bas = acc + BOSLUK / 2;
      grup.forEach((n, j) => {
        const t = grup.length === 1 ? 0.5 : j / (grup.length - 1);
        const a = bas + pay * t;
        // Sarmalın yarıçapı GRUP İÇİ değil bütün tur boyunca ilerliyor;
        // grup içi olsaydı üç kişilik bir küme küçücük bir açıda bütün
        // yarıçapı tarar ve halkanın içine dik bir çizgi gibi düşerdi.
        const kure = (gecen + j) / Math.max(1, toplam - 1);
        const r = R * (0.66 + 0.34 * kure);
        n.x = Math.cos(a) * r;
        n.y = Math.sin(a) * r;
      });
      acc += pay + BOSLUK;
      gecen += grup.length;
    });

    esmaSel = layers.esma.selectAll("g.tnz-name").data(names, (d) => d.id)
      .join("g").attr("class", "tnz-name");
    // Altında BAŞKA isimler olan isimler ince bir halka taşıyor. 74 ismin
    // yalnız 4'ünde alt dal var; işaretlenmeseydi özellik pratikte
    // bulunamazdı -- ve "burada daha var" bilgisi kendi başına doğru bir
    // bilgi, süs değil.
    esmaSel.selectAll("circle.tnz-name__halka")
      .data((d) => ((kidsOf.get(d.id) || []).length ? [d] : []))
      .join("circle").attr("class", "tnz-name__halka").attr("r", 9);
    esmaSel.selectAll("circle.tnz-name__dot").data((d) => [d]).join("circle")
      .attr("class", (d) => "tnz-name__dot tnz-name__dot--" + (d.pole || "neutral")).attr("r", 4.5);
    esmaSel.selectAll("title").data((d) => [d]).join("title")
      .text((d) => tt(d.name) + ((kidsOf.get(d.id) || []).length
        ? " — " + tt({ tr: "altında isimler var", en: "has Names beneath it", pt: "tem Nomes abaixo" }) : ""));
  }

  // --- Seçim ---------------------------------------------------------------
  function adaylar() {
    // Kilitliyken aday kümesi: kilitli isim + ONUN alt isimleri. Kilit yoksa
    // bütün isimler. Böylece iniş bir dala BAĞLANMA oluyor.
    if (!kilitliIsim) return names;
    const alt = kidsOf.get(kilitliIsim.id) || [];
    return [kilitliIsim].concat(alt);
  }

  function secilen() {
    const { w, h } = size();
    const px = steerX * w * 0.32, py = steerY * h * 0.32;
    let best = null, bestD = Infinity;
    adaylar().forEach((n) => {
      const d = Math.hypot((n.x || 0) - px, (n.y || 0) - py);
      if (d < bestD) { bestD = d; best = n; }
    });
    return best;
  }

  function altYerlestir(parent) {
    // Alt isimler ANA İSMİN ÇEVRESİNDE açılıyor: tenezzül kendini bir alt
    // çözünürlükte tekrar ediyor. Konumları ana isme GÖRE, çünkü sahne o
    // isme yaklaşırken onunla birlikte taşınıyorlar.
    const alt = kidsOf.get(parent.id) || [];
    const { w, h } = size();
    // Halka ana ismin DİSKİNDEN dışarıda kalmalı; ilk denemede 0.19 idi ve
    // çocuklar diskin kenarına biniyordu, bir etiket diskin içinde kalmıştı
    // (ekran görüntüsünde görüldü).
    const R = Math.min(w, h) * 0.30;
    alt.forEach((n, i) => {
      const a = (-Math.PI / 2) + (i / Math.max(1, alt.length)) * Math.PI * 2;
      n.x = parent.x + Math.cos(a) * R;
      n.y = parent.y + Math.sin(a) * R;
    });
    return alt;
  }

  // --- Çizim: İSİMLER ekseni ----------------------------------------------
  function renderIsimler(w, h) {
    layers.mert.attr("opacity", 0).selectAll("*").remove();
    layers.donus.attr("opacity", 0);

    const allahOp = focus < 0.25 ? 0 : bandOpacity(1, 1.15);
    const verme = clamp01(focus - 1);
    const allahR = Math.min(w, h) * (0.16 - 0.09 * verme);
    layers.allah.attr("opacity", allahOp.toFixed(3));
    layers.allah.select(".tnz-allah__disc").attr("r", allahR.toFixed(1));
    layers.allah.select(".tnz-allah__label").attr("y", 6)
      .text(allahOp > 0.05 ? tt(A().stations[1]) : "")
      .attr("font-size", Math.max(11, allahR * 0.30).toFixed(1))
      .attr("opacity", (1 - verme * 0.75).toFixed(3));

    const esmaOp = bandOpacity(2, 1.45);
    const acilma = clamp01(focus - 1);
    layers.esma.attr("opacity", esmaOp.toFixed(3));
    if (esmaSel) esmaSel.attr("transform", (d) =>
      `translate(${(d.x * acilma).toFixed(1)},${(d.y * acilma).toFixed(1)})`);

    // Kilit: 2.5'ten derine inince o an bakılan isme bağlanılıyor; yukarı
    // çıkınca çözülüyor.
    if (focus > 2.5 && !kilitliIsim) kilitliIsim = secilen();
    else if (focus < 2.35 && kilitliIsim) kilitliIsim = null;

    const secili = focus > 2.15 ? secilen() : null;
    if (esmaSel) esmaSel.classed("is-chosen", (d) => secili && d.id === secili.id)
      .attr("opacity", (d) => (secili && d.id !== secili.id ? Math.max(0.12, 1 - (focus - 2) * 0.8) : 1));

    // Alt isimler: kilitli ismin çocukları, ondan AYRILARAK yerlerine
    // gidiyorlar (boş yerden belirmiyorlar).
    const alt = kilitliIsim ? altYerlestir(kilitliIsim) : [];
    const altAcilma = clamp01((focus - 2.6) / 0.7);
    altSel = layers.alt.selectAll("g.tnz-alt-name").data(alt, (d) => d.id)
      .join(
        (enter) => {
          const g = enter.append("g").attr("class", "tnz-alt-name");
          g.append("circle").attr("class", "tnz-name__dot").attr("r", 4);
          g.append("text").attr("class", "tnz-alt-name__label").attr("text-anchor", "middle").attr("y", -10);
          g.append("title");
          return g;
        },
        (update) => update,
        (exit) => exit.remove()
      );
    layers.alt.attr("opacity", (alt.length ? altAcilma : 0).toFixed(3));
    if (alt.length) {
      altSel.attr("transform", (d) => {
        const x = kilitliIsim.x + (d.x - kilitliIsim.x) * altAcilma;
        const y = kilitliIsim.y + (d.y - kilitliIsim.y) * altAcilma;
        return `translate(${x.toFixed(1)},${y.toFixed(1)})`;
      });
      altSel.select("circle").attr("class", (d) => "tnz-name__dot tnz-name__dot--" + (d.pole || "neutral"))
        .classed("is-chosen", (d) => secili && d.id === secili.id);
      altSel.select("text").text((d) => tt(d.name)).attr("opacity", altAcilma.toFixed(2));
      altSel.select("title").text((d) => tt(d.name));
    }

    renderOdak(secili, w, h, bandOpacity(3, 1.5));
    renderMetin(secili, bandOpacity(4, 1.2), "esma");
  }

  // Seçilen ismin (ya da mertebenin) büyüyen diski + adı.
  function renderOdak(n, w, h, op, opts) {
    opts = opts || {};
    layers.isim.attr("opacity", op.toFixed(3));
    if (!n || op <= 0.01) {
      layers.isim.select(".tnz-isim__name").text("");
      layers.isim.select(".tnz-isim__short").text("");
      return;
    }
    const son = stationCount() - 1;
    const metne = clamp01(focus - (son - 1));
    const yaklas = clamp01(focus - (son - 1.6));
    // Alt isimler açıkken ana disk küçülüyor: çocuklarına yer açıyor.
    // (Tenezzülün kendisi de bu: veren küçülür.)
    const cocuk = (kilitliIsim && (kidsOf.get(kilitliIsim.id) || []).length && n.id === kilitliIsim.id)
      ? clamp01((focus - 2.6) / 0.7) : 0;
    // Mertebeler ekseninde asıl özne HALKA'dır (mertebenin kalabalığı),
    // disk yalnız çekirdek; o yüzden orada küçük tutuluyor.
    const cekirdek = opts.kucukDisk ? 0.62 : 1;
    const r = Math.min(w, h) * (0.13 + 0.07 * yaklas - 0.05 * metne - 0.05 * cocuk) * cekirdek;
    // Dar ekranda metin paneli SAĞA değil ALTA oturuyor (style.css'in 720px
    // kuralı), o yüzden sahne sola değil YUKARI çekiliyor.
    const dar = w < 720;
    const kayma = dar ? 0 : -w * 0.16 * metne;
    const dikey = dar ? -h * 0.16 * metne : 0;
    layers.isim.attr("transform",
      `translate(${((n.x || 0) * (1 - yaklas) + kayma).toFixed(1)},${((n.y || 0) * (1 - yaklas) + dikey).toFixed(1)})`);
    layers.isim.select(".tnz-isim__disc").attr("r", r.toFixed(1))
      .attr("class", "tnz-isim__disc tnz-isim__disc--" + (n.pole || "neutral"));
    // Uzun adlar (özellikle mertebeler: "Tecellî ve Nefesü'r-Rahmân") diskin
    // içine sığmıyordu, iki yana taşıyordu -- ölçülüp düzeltildi: 22 harfi
    // geçen ad diskin ÜSTÜNE, kısası içine yazılıyor.
    const ad = tt(n.name);
    const uzun = ad.length > 22;
    // Uzun ad diskin değil, BÜTÜN sahnenin üstüne çıkıyor -- yoksa disk ile
    // dış halkanın arasına düşüp noktaların üstünü kesiyordu (ölçüldü).
    const ustY = opts.disHalka ? -(opts.disHalka + 24) : -(r + 14);
    layers.isim.select(".tnz-isim__name")
      .attr("y", uzun ? ustY.toFixed(1) : -4)
      .attr("opacity", (dar ? 1 - metne : 1).toFixed(3))
      .text(dar && metne > 0.85 ? "" : ad)
      .attr("font-size", Math.max(13, Math.min(dar ? 18 : (uzun ? 20 : 30), r * 0.22)).toFixed(1));
    layers.isim.select(".tnz-isim__short")
      .attr("y", uzun ? (opts.disHalka ? opts.disHalka + 30 : r + 22).toFixed(1) : Math.max(18, r * 0.30))
      .attr("opacity", (1 - metne).toFixed(3))
      .text(metne > 0.9 ? "" : (tt(n.short) || ""))
      .attr("font-size", Math.max(11, Math.min(15, r * 0.11)).toFixed(1));
  }

  // --- Çizim: MERTEBELER ekseni -------------------------------------------
  // Her basamak bir öncekinin İÇİNDEN çıkıyor: alt mertebenin noktaları
  // üsttekinin konumundan ayrılarak yerlerine gidiyor, ve inildikçe hem
  // sayıları artıyor hem netleşiyorlar (bulanıklık = bilgisizlik, netlik =
  // belirlenme -- GORSEL_DIL.md'nin grameri).
  const MERT_SAYI = [1, 3, 8, 16, 30, 12, 1];
  function renderMertebeler(w, h) {
    layers.allah.attr("opacity", 0);
    layers.esma.attr("opacity", 0);
    layers.alt.attr("opacity", 0);

    const R = Math.min(w, h) * 0.34;
    const ust = Math.max(0, Math.min(stationCount() - 1, Math.floor(focus)));
    const alt = Math.min(stationCount() - 1, ust + 1);
    const t = clamp01(focus - ust);

    const son = stationCount() - 1;
    const konum = (lv, i, say) => {
      const rr = R * (0.30 + 0.70 * (lv / son));
      const a = (-Math.PI / 2) + (i / say) * Math.PI * 2;
      return { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
    };

    const halkalar = [];
    // Üstteki mertebe yerinde durup soluyor.
    if (ust >= 1) {
      const say = MERT_SAYI[ust] || 8;
      halkalar.push({
        lv: ust, op: 1 - t * 0.6, bulanik: Math.max(0, 1 - ust / son) * 3.2,
        noktalar: d3.range(say).map((i) => konum(ust, i, say)),
        r: 2.4 + 2.4 * (ust / son),
      });
    }
    // Alttaki mertebe, ÜSTTEKİNİN NOKTALARINDAN ayrılarak yerine gidiyor.
    // İlk yazımda bu yalnız yorumda vardı, kodda yoktu: iki halka ayrı ayrı
    // çiziliyordu ve ayrışma değil yalnız "başka bir halka" görünüyordu.
    if (alt >= 1 && alt !== ust) {
      const sayA = MERT_SAYI[alt] || 8;
      const sayU = MERT_SAYI[ust] || 1;
      const noktalar = d3.range(sayA).map((i) => {
        const hedef = konum(alt, i, sayA);
        // Kaynağı: üstteki mertebede kendisine denk gelen nokta (üst mertebe
        // Zât ise merkezin kendisi).
        const kaynak = ust >= 1 ? konum(ust, Math.floor(i * sayU / sayA), sayU) : { x: 0, y: 0 };
        return { x: kaynak.x + (hedef.x - kaynak.x) * t, y: kaynak.y + (hedef.y - kaynak.y) * t };
      });
      halkalar.push({
        lv: alt, op: t, bulanik: Math.max(0, 1 - alt / son) * 3.2,
        noktalar, r: 2.4 + 2.4 * (alt / son),
      });
    }

    const gsel = layers.mert.attr("opacity", 1)
      .selectAll("g.tnz-halka").data(halkalar, (d) => d.lv)
      .join((enter) => enter.append("g").attr("class", "tnz-halka"));
    gsel.attr("opacity", (d) => d.op.toFixed(3))
      .style("filter", (d) => (d.bulanik > 0.15 ? `blur(${d.bulanik.toFixed(1)}px)` : null));
    gsel.each(function (d) {
      d3.select(this).selectAll("circle").data(d.noktalar)
        .join("circle")
        .attr("class", "tnz-mert__dot")
        .attr("cx", (p) => p.x.toFixed(1)).attr("cy", (p) => p.y.toFixed(1))
        // Kesifleşme: alt mertebelerde noktalar büyüyor ve doluyor.
        .attr("r", d.r.toFixed(2));
    });

    // Bu basamağın adı ve düğümü
    const idx = Math.round(Math.max(0, Math.min(stationCount() - 1, focus)));
    const dugumler = (A().steps[idx] || []).map((id) => mertebeler.find((m) => m.id === id)).filter(Boolean);
    const n = dugumler[Math.min(dugumler.length - 1, Math.max(0,
      Math.round(((steerX + 1) / 2) * (dugumler.length - 1))))] || null;
    if (n) { n.x = 0; n.y = 0; }
    const disR = R * (0.30 + 0.70 * (Math.max(ust, 1) / son));
    renderOdak(n, w, h, idx >= 1 ? bandOpacity(idx, 1.2) : 0,
      { kucukDisk: true, disHalka: disR });
    renderMetin(n, focus >= stationCount() - 1.2 ? bandOpacity(stationCount() - 1, 1.2) : 0, "ontoloji");

    // Daire kapanıyor: son basamakta Zât'a dönen yay.
    // (ontology.json'daki `return` kenarı: insan-i-kamil -> dhat.)
    const donusOp = clamp01(focus - (stationCount() - 2));
    layers.donus.attr("opacity", donusOp.toFixed(3));
    if (donusOp > 0.01) {
      const rr = R * 1.02;
      layers.donus.select(".tnz-donus__yay")
        .attr("d", `M ${rr.toFixed(1)} 0 A ${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 1 ${(-rr * 0.02).toFixed(1)} ${(-rr).toFixed(1)}`);
      layers.donus.select(".tnz-donus__etiket").attr("x", 0).attr("y", (-rr - 14).toFixed(1))
        .text(tt({ tr: "…ve O'na dönüyor", en: "…and returns to Him", pt: "…e retorna a Ele" }))
        .attr("font-size", 13);
    }
  }

  // --- Çizim: ortak --------------------------------------------------------
  function render() {
    if (!built) return;
    const { w, h } = size();

    const sisScale = 0.30 * Math.min(w, h) * (1 + focus * 0.55);
    layers.sis.attr("transform", `scale(${sisScale.toFixed(2)})`)
      .attr("opacity", Math.max(0.10, 1 - focus * 0.20).toFixed(3));

    if (axis === "isimler") renderIsimler(w, h);
    else renderMertebeler(w, h);

    updateChrome();
  }

  let metinEl = null;
  function renderMetin(n, op, hedefGorunum) {
    if (!metinEl) metinEl = document.getElementById("tenezzul-metin");
    if (!metinEl) return;
    if (!n || op < 0.02) { metinEl.hidden = true; metinEl.dataset.id = ""; return; }
    metinEl.hidden = false;
    metinEl.style.opacity = op.toFixed(3);
    const key = hedefGorunum + "/" + n.id;
    if (metinEl.dataset.id === key && metinEl.dataset.lang === I18n.getLang()) return;
    metinEl.dataset.id = key;
    metinEl.dataset.lang = I18n.getLang();
    const ins = (n.insights || [])[0];
    const kaynak = (n.sources || [])[0];
    const rota = hedefGorunum === "ontoloji" ? "ontoloji" : "esma";
    metinEl.innerHTML =
      `<p class="tnz-metin__eyebrow">${tt(n.name)}</p>`
      + `<p class="tnz-metin__body">${tt(n.summary) || ""}</p>`
      + (ins ? `<blockquote class="tnz-metin__quote">${tt(ins.text)}</blockquote>` : "")
      + (kaynak ? `<p class="tnz-metin__source">${kaynak}</p>` : "")
      + `<p class="tnz-metin__more"><a class="cross-link" href="${window.__dostNav.href(rota, n.id)}" data-view="${rota}" data-id="${n.id}">${tt(
          rota === "ontoloji"
            ? { tr: "Bu mertebeyi haritada aç", en: "Open this level on the map", pt: "Abra este grau no mapa" }
            : { tr: "Bu ismi Esmâ haritasında aç", en: "Open this Name on the map of Names", pt: "Abra este Nome no mapa dos Nomes" })}</a></p>`;
  }

  function updateChrome() {
    const dots = document.getElementById("tenezzul-stations");
    if (dots) {
      const n = stationCount();
      while (dots.children.length < n) dots.appendChild(document.createElement("span"));
      while (dots.children.length > n) dots.removeChild(dots.lastChild);
      [...dots.children].forEach((el, i) => {
        const yakin = Math.max(0, 1 - Math.abs(focus - i));
        el.classList.toggle("is-active", yakin > 0.5);
        el.style.opacity = (0.35 + 0.65 * yakin).toFixed(2);
      });
    }
    const lbl = document.getElementById("tenezzul-station-label");
    if (lbl) lbl.textContent = tt(A().stations[Math.round(Math.max(0, Math.min(stationCount() - 1, focus)))]);
    const up = document.getElementById("tenezzul-up"), down = document.getElementById("tenezzul-down");
    if (up) up.disabled = focus <= 0.01;
    if (down) down.disabled = focus >= stationCount() - 1.01;
    document.querySelectorAll(".tnz-axis__chip").forEach((c) => {
      const on = c.dataset.axis === axis;
      c.classList.toggle("is-on", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // --- Etkileşim -----------------------------------------------------------
  function setFocus(f, animate) {
    target = Math.max(0, Math.min(stationCount() - 1, f));
    const sel = (animate && !reduceMotion) ? svg.transition().duration(520).ease(d3.easeCubicInOut) : svg;
    sel.call(zoomBehavior.transform, d3.zoomIdentity.scale(Math.pow(2, target)));
  }

  function setAxis(id) {
    if (!AXES[id] || id === axis) return;
    axis = id;
    kilitliIsim = null;
    steerX = 0; steerY = 0;
    // Derinlik korunuyor ama yeni eksenin sınırına kırpılıyor: kullanıcı
    // ekseni değiştirince en baştan başlamak zorunda kalmasın.
    setFocus(Math.min(target, stationCount() - 1), false);
    render();
  }

  function wire() {
    zoomBehavior = d3.zoom()
      .scaleExtent([1, Math.pow(2, 8)])   // en uzun eksen 7 istasyon (2^6)
      .filter((event) => {
        if (event.type === "wheel") return !reduceMotion;
        if (event.type === "dblclick") return false;
        return true;
      })
      .on("zoom", (event) => {
        focus = Math.min(stationCount() - 1, Math.log(event.transform.k) / Math.LN2);
        // `target`ı da güncelliyoruz. Aksi hâlde tekerlekle inen kullanıcı
        // sonra düğmeye/ok tuşuna bastığında hareket, tekerleğin bıraktığı
        // yerden değil ESKİ hedeften sayılıyordu -- yani "bir üst mertebe"
        // beklenen yere değil, önceki hedefin bir üstüne gidiyordu.
        // (Ölçüldü: tekerlekle son istasyona inip ok yukarı basınca hiçbir
        // şey olmuyordu.) Bu, kaldırılan Atlas'ta da yakalanmış aynı sınıf
        // hataydı; oradaki çözüm de hedefi hareket bitince hizalamaktı.
        target = focus;
        render();
      });
    svg.call(zoomBehavior).on("dblclick.zoom", null);

    let dragging = false, sx = 0, sy = 0, bx = 0, by = 0;
    svgNode.addEventListener("pointerdown", (e) => {
      dragging = true; sx = e.clientX; sy = e.clientY; bx = steerX; by = steerY;
      svgNode.setPointerCapture && svgNode.setPointerCapture(e.pointerId);
    });
    svgNode.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const { w, h } = size();
      steerX = Math.max(-1, Math.min(1, bx - (e.clientX - sx) / (w * 0.5)));
      steerY = Math.max(-1, Math.min(1, by - (e.clientY - sy) / (h * 0.5)));
      render();
    });
    const bitir = () => { dragging = false; };
    svgNode.addEventListener("pointerup", bitir);
    svgNode.addEventListener("pointercancel", bitir);

    const up = document.getElementById("tenezzul-up");
    const down = document.getElementById("tenezzul-down");
    if (up) up.addEventListener("click", () => setFocus(Math.round(target) - 1, true));
    if (down) down.addEventListener("click", () => setFocus(Math.round(target) + 1, true));
    document.querySelectorAll(".tnz-axis__chip").forEach((c) =>
      c.addEventListener("click", () => setAxis(c.dataset.axis)));

    svgNode.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); setFocus(Math.round(target) + 1, true); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); setFocus(Math.round(target) - 1, true); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); steerX = Math.max(-1, steerX - 0.18); render(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); steerX = Math.min(1, steerX + 0.18); render(); }
    });

    // "Geri çekilmek": inilen derinlik kullanıcının bilerek seçtiği kiptir,
    // korunur; sıfırlanan şey sürükleyerek verilen YÖN'dür.
    GU.wireRecenter("tenezzul-recenter", () => { steerX = 0; steerY = 0; render(); });
    // "Bir adım geri": bir istasyon yukarı.
    GU.registerStepBack("tenezzul-wrap", () => {
      if (target <= 0.01) return false;
      setFocus(Math.round(target) - 1, true);
      return true;
    });

    window.addEventListener("resize", () => {
      if (!built || wrapEl.hidden) return;
      const { w, h } = size();
      svg.attr("viewBox", `${-w / 2} ${-h / 2} ${w} ${h}`);
      yerlestirIsimler(); render();
    });
  }

  // --- Veri ----------------------------------------------------------------
  function fetchData() {
    if (esmaData && ontData) return Promise.resolve(true);
    return Promise.all([
      GU.fetchJson("data/ibn-arabi/esma.json"),
      GU.fetchJson("data/ibn-arabi/ontology.json"),
    ]).then(([e, o]) => {
      if (!e || !o) return false;
      esmaData = e; ontData = o;
      e.nodes.forEach((n) => byId.set(n.id, n));
      e.nodes.forEach((n) => {
        if (!n.parent) return;
        if (!kidsOf.has(n.parent)) kidsOf.set(n.parent, []);
        kidsOf.get(n.parent).push(n);
      });
      names = e.nodes.filter((n) => n.depth === 2);
      // Metni olan isimler önce: eksenin sonu gerçekten okunacak bir şeye
      // çıksın, boş bir başlığa değil.
      names.sort((a, b) => ((b.insights || []).length ? 1 : 0) - ((a.insights || []).length ? 1 : 0));
      mertebeler = o.nodes;
      AXES.mertebeler.stations = AXES.mertebeler.steps.map((ids) => {
        const ns = ids.map((id) => o.nodes.find((x) => x.id === id)).filter(Boolean);
        if (ns.length === 1) return ns[0].name;
        return { tr: "Âlemler", en: "The worlds", pt: "Os mundos" };
      });
      return true;
    }).catch(() => false);
  }

  window.__tenezzulApp = {
    activate() {
      fetchData().then((ok) => { if (!ok) return; if (!built) build(); else render(); });
    },
    onLangChange() {
      if (!built) return;
      if (metinEl) metinEl.dataset.id = "";
      if (esmaSel) esmaSel.selectAll("title").text((d) => tt(d.name));
      render();
    },
  };
})();
