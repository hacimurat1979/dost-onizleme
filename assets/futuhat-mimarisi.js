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
  let focusId = null;

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

    sel.on("mouseenter", function (ev, d) { vurgula(d.id, true); ipucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgula(null, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgula(d.id, true); })
      .on("blur", function () { vurgula(null, false); })
      .on("click", (ev, d) => faslPaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); faslPaneli(d); }
      });

    // Etiketler: her dilimin orta açısında, halkanın hemen dışında.
    const etiketG = kok.append("g").attr("class", "futuhat-mimarisi-etiketler");
    etiketG.selectAll("text.futuhat-mimarisi-etiket").data(faslar, (d) => d.id).join("text")
      .attr("class", "futuhat-mimarisi-etiket")
      .attr("x", (d) => Math.cos((d.a0 + d.a1) / 2) * (R_OUT + 14))
      .attr("y", (d) => Math.sin((d.a0 + d.a1) / 2) * (R_OUT + 14) + 4)
      .attr("text-anchor", (d) => {
        const mid = (d.a0 + d.a1) / 2;
        const x = Math.cos(mid);
        return x > 0.12 ? "start" : x < -0.12 ? "end" : "middle";
      })
      .text((d) => tt(d.ad));

    // 560→1 kapanışı: halkanın başlangıç noktasında küçük, sabit bir işaret.
    const kapanisAcisi = -Math.PI / 2;
    kok.append("circle").attr("class", "futuhat-mimarisi-kapanis")
      .attr("cx", Math.cos(kapanisAcisi) * R_OUT).attr("cy", Math.sin(kapanisAcisi) * R_OUT).attr("r", 3.5);

    babHalkasiCiz(kok, R_IN);

    zoom = GU.createZoomBehavior(svg, g, [0.6, 3]);
    ortala(false);
  }

  // Bir bab'ın halka üzerindeki açısı. Dış yaylar da bab sayısıyla orantılı
  // olduğu için iki halka kendiliğinden hizalanıyor: 73. babın çentiği
  // Ma'ârif yayının tam bittiği yerde duruyor.
  function babAcisi(n) {
    return ((n - 0.5) / TOPLAM_BAB) * 2 * Math.PI - Math.PI / 2;
  }

  function babHalkasiCiz(kok, R_IN) {
    if (!eslesme) return;
    const r1 = R_IN * 0.94;
    const r0 = R_IN * 0.76;
    const halka = kok.append("g").attr("class", "futuhat-mimarisi-bablar");

    // Önce bütün 560 çentik soluk çizilir; sonra okunanlar üzerine dolu
    // çizilir. Sıra önemli: dolu olanlar üstte kalsın ve tıklanabilsin.
    const hepsi = [];
    for (let n = 1; n <= TOPLAM_BAB; n++) hepsi.push(n);

    halka.append("g").attr("class", "futuhat-mimarisi-bablar__bos")
      .attr("aria-hidden", "true")
      .selectAll("line").data(hepsi.filter((n) => !babKisim.has(n))).join("line")
      .attr("class", "futuhat-mimarisi-bab futuhat-mimarisi-bab--bos")
      .attr("x1", (n) => Math.cos(babAcisi(n)) * r0)
      .attr("y1", (n) => Math.sin(babAcisi(n)) * r0)
      .attr("x2", (n) => Math.cos(babAcisi(n)) * r1)
      .attr("y2", (n) => Math.sin(babAcisi(n)) * r1);

    halka.append("g").attr("class", "futuhat-mimarisi-bablar__dolu")
      .attr("aria-hidden", "true")
      .selectAll("line").data(hepsi.filter((n) => babKisim.has(n))).join("line")
      .attr("class", "futuhat-mimarisi-bab futuhat-mimarisi-bab--dolu")
      .attr("data-bab", (n) => n)
      .attr("x1", (n) => Math.cos(babAcisi(n)) * r0)
      .attr("y1", (n) => Math.sin(babAcisi(n)) * r0)
      .attr("x2", (n) => Math.cos(babAcisi(n)) * r1)
      .attr("y2", (n) => Math.sin(babAcisi(n)) * r1);

    // ETKİLEŞİM. 560 çentik bu yarıçapta ~1.6px aralıkla diziliyor. Her
    // çentiğe kendi vuruş alanını vermeyi denedik: dokunulabilir bir hedef
    // (9px) komşu altı babın üstüne biniyor ve tıklama yanlış baba gidiyor
    // -- Playwright ilk denemede yakaladı. Onun yerine tek bir saydam halka
    // imleci yakalıyor, bab açıdan hesaplanıyor. Örtüşme imkânsız, hedef
    // her yerde aynı büyüklükte.
    halka.append("path").attr("class", "futuhat-mimarisi-bab-avci")
      .attr("d", d3.arc()({ innerRadius: r0 - 4, outerRadius: r1 + 4, startAngle: 0, endAngle: 2 * Math.PI }))
      .on("mousemove", function (ev) {
        const n = yakinKapsananBab(imlectenBab(ev, this));
        if (n) { babVurgula(n); babIpucu(ev, n); }
        else { babVurgula(null); GU.hideTooltip(tooltip); }
      })
      .on("mouseleave", function () { babVurgula(null); GU.hideTooltip(tooltip); })
      .on("click", function (ev) {
        const n = yakinKapsananBab(imlectenBab(ev, this));
        if (n) babPaneli(n);
      });

    // KLAVYE. İmleç halkası fareye göre; klavye kullanıcısı için her okuma
    // birimi ayrı bir durak. 118 durak, 560 değil -- gidilecek yer kısım.
    halka.append("g").attr("class", "futuhat-mimarisi-kisimlar")
      .selectAll("line").data(eslesme.kisimlar).join("line")
      .attr("class", "futuhat-mimarisi-kisim-odak")
      .attr("x1", (k) => Math.cos(kisimAcisi(k)) * r0)
      .attr("y1", (k) => Math.sin(kisimAcisi(k)) * r0)
      .attr("x2", (k) => Math.cos(kisimAcisi(k)) * r1)
      .attr("y2", (k) => Math.sin(kisimAcisi(k)) * r1)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (k) => babEtiketi(k.bablar[0]))
      .on("focus", (ev, k) => babVurgula(k.bablar[0]))
      .on("blur", () => babVurgula(null))
      .on("keydown", function (ev, k) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); babPaneli(k.bablar[0]); }
      });
  }

  function kisimAcisi(k) {
    return babAcisi((k.bablar[0] + k.bablar[k.bablar.length - 1]) / 2);
  }

  // İmlecin merkeze göre açısından bab numarası. Halkanın kendi dönüşümü
  // (zoom/pan) hesaba katılsın diye ölçüm SVG'nin yerel koordinatında.
  function imlectenBab(ev, node) {
    const [x, y] = d3.pointer(ev, node);
    let a = Math.atan2(y, x) + Math.PI / 2;          // tepe = 0
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const n = Math.floor((a / (2 * Math.PI)) * TOPLAM_BAB) + 1;
    return n >= 1 && n <= TOPLAM_BAB ? n : null;
  }

  // Bir bab bu yarıçapta ~1.6px yer tutuyor; imleci tam çentiğin üstüne
  // getirmeyi şart koşarsak okunmuş iki bab arasına düşen piksel hiçbir şey
  // yapmıyor ve halka bozukmuş gibi duruyor (testte bab 47'de görüldü).
  // O yüzden en yakın OKUNMUŞ baba kayıyoruz. Tolerans dar: 4 bab ~6px,
  // yani boş bir bölgede gezinirken yanlışlıkla uzaktaki bir kısmı
  // yakalamıyor -- boşluk boşluk olarak kalıyor.
  var YAKINLIK = 4;
  function yakinKapsananBab(n) {
    if (!n) return null;
    if (babKisim.has(n)) return n;
    for (var d = 1; d <= YAKINLIK; d++) {
      if (babKisim.has(n - d)) return n - d;
      if (babKisim.has(n + d)) return n + d;
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
    focusId = null;
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
  }

  function ipucu(ev, d) {
    tooltip.innerHTML = `<strong>${tt(d.ad)}</strong><span class="node-hover-tip__meta">${d.aralikBaslangic}–${d.aralikBitis} (${d.babSayisi} ${tt({ tr: "bab", en: "chapters", pt: "capítulos" })})</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function faslPaneli(d) {
    focusId = d.id;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${d.sira}/6 · ${d.aralikBaslangic}–${d.aralikBitis}</p>
      <h2 class="detail-title">${tt(d.ad)}</h2>
      <p class="eser-agi-kimlik">${d.babSayisi} ${tt({ tr: "bab", en: "chapters", pt: "capítulos" })} — ${tt(d.esmaKarsiligi)}</p>
      <div class="detail-block detail-block--soru"><p>${tt(d.aciklama)}</p></div>
      ${fasilKapsamSatiri(d)}
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
    focusId = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Fütûhât'ın Mimarisi", en: "The Architecture of the Futûhât", pt: "A Arquitetura das Futûhât" })}</p>
      <h2 class="detail-title">${tt({ tr: "560 bab, altı fasıl", en: "560 chapters, six sections", pt: "560 capítulos, seis seções" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>
      ${eslesme ? `<p class="futuhat-mimarisi-kapsam">${eslesme.kapsananBabSayisi}/${eslesme.toplamBab} `
        + tt({ tr: "bab okundu — dolu çentikler tıklanabilir", en: "chapters read — filled ticks are clickable", pt: "capítulos lidos — as marcas preenchidas são clicáveis" }) + "</p>" : ""}
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
    GU.registerStepBack("futuhat-mimarisi-wrap", () => {
      if (focusId) { girisPaneli(); return true; }
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
      if (focusId) {
        const d = faslById.get(focusId);
        if (d) faslPaneli(d); else girisPaneli();
      } else girisPaneli();
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
