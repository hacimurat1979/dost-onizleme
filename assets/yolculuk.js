// Yolculuk — /birlestir'in ilk dilimi. Eser Ağı + Seyahat Atlası'nın
// birleşik atlas izdüşümü: her durak coğrafi konumunda, her eser o
// durakta yazıldığı için durağın yakınında küçük bir kart olarak.
//
// KOMUT DOSYASI: .claude/commands/birlestir.md izdusum adımı. Bu dilim
// yalnızca ATLAS izdüşümü + eser noktaları -- zaman izdüşümü, iki
// izdüşüm arası geçiş (`gecis` adımı) ve eski URL yönlendirmesi sonraki
// dilim.
//
// NEDEN AYRI SAYFA. Komut dosyası "Eski iki sayfanın URL'leri kırılmıyor"
// diyor; ilk dilimde eski Eser Ağı ve Seyahat Atlası sayfaları hiç
// dokunulmadan yaşamaya devam ediyor -- yeni /yolculuk/ üçüncü bir
// görünüm olarak eklendi. Onay ve test sonrası (dilim 2) eski URL'ler
// buraya yönlendirilebilir.
//
// KIYI_SERITLERI seyahat-atlasi.js'de de var; bilinçli kopya (statik
// coğrafya, sonraki turda ortak modüle taşınacak).
window.__yolculukApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const deconflictLabels = GU.createLabelDeconflictor();

  const svg = d3.select("#yolculuk-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("yolculuk-wrap");
  const tooltip = document.getElementById("yolculuk-tooltip");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");

  if (!svgNode || !wrapEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)
  function linkify(text) { return window.__dostCrossLink ? window.__dostCrossLink.linkify(text) : text; }

  let atlasData = null;
  let eserAgiData = null;
  let duraklar = [];
  let eserler = [];
  let durakById = new Map();
  let eserById = new Map();
  let eserlerByDurakId = new Map(); // durak.id -> [eser, ...]
  let sehirBelirsizEserler = []; // mekân eksenine giremeyenler
  let zoom = null;
  let g = null;
  let focusId = null;
  let focusKind = null; // 'durak' | 'eser'
  // İki izdüşüm arası geçiş anahtar durumu. Varsayılan: atlas (coğrafi).
  // Değeri değişince ciz() yeniden çağrılır; iki izdüşüm arasında SMOOTH
  // ANİMASYON YOK (bu, `.claude/commands/birlestir.md`'nin `gecis` adımının
  // işi -- bu dilimde toggle anlık). Kullanıcı geri geldiğinde son
  // izdüşümü hatırlar (sessionStorage üzerinden, kalıcı değil).
  let currentProjection = "atlas"; // "atlas" | "zaman"
  try {
    const s = sessionStorage.getItem("yolculuk-projection");
    if (s === "atlas" || s === "zaman") currentProjection = s;
  } catch (_) { /* sessionStorage yasak/dolu olabilir */ }

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(360, r.width), h: Math.max(320, r.height) };
  }

  function yerlestirAtlas() {
    const { w, h } = boyut();
    const PAD = 50;
    const lons = duraklar.map((d) => d.lon), lats = duraklar.map((d) => d.lat);
    const xScale = d3.scaleLinear().domain([Math.min(...lons) - 3, Math.max(...lons) + 3]).range([PAD, w - PAD]);
    const yScale = d3.scaleLinear().domain([Math.max(...lats) + 3, Math.min(...lats) - 3]).range([PAD, h - PAD]);
    duraklar.forEach((d) => { d.x = xScale(d.lon); d.y = yScale(d.lat); });
    // Her eseri kendi durağının etrafına küçük bir yay üzerine dizeriz.
    // Aynı durakta N eser varsa, bir yay üzerinde N eşit noktaya
    // dağıtılırlar; yay durağın sağ üstünden başlar, saat yönünde döner.
    const R = 22, ADIM = Math.PI / 6;
    for (const [durakId, list] of eserlerByDurakId.entries()) {
      const dur = durakById.get(durakId);
      if (!dur) continue;
      const n = list.length;
      // Merkez etrafında n=1 için tek nokta üstte; n=2 için iki yanda;
      // n>=3 için bir yay boyunca (üstten başlayıp sağa doğru).
      for (let i = 0; i < n; i++) {
        let a;
        if (n === 1) a = -Math.PI / 2;
        else if (n === 2) a = -Math.PI / 2 + (i - 0.5) * ADIM * 2;
        else a = -Math.PI / 2 + (i - (n - 1) / 2) * ADIM;
        list[i].x = dur.x + R * Math.cos(a);
        list[i].y = dur.y + R * Math.sin(a);
      }
    }
    return { w, h };
  }

  // Zaman izdüşümü: x=yıl, y=boylam. Coğrafya düzleşir, zaman açılır.
  // /birlestir.md izdusum spec: "hareket tek yönlü, batıdan doğuya ve geri
  // dönüşsüz; izdüşümde bu bir çizgi olarak GÖRÜNÜR, anlatılması gerekmez."
  // Endülüs-Fas gidiş gelişleri sol altta dalgalanma, 1200'deki kopuş
  // ortada dik bir tırmanış, Şam'daki son on yedi yıl sağda uzun düz bir
  // hat olur.
  function yerlestirZaman() {
    const { w, h } = boyut();
    const PAD_L = 60, PAD_R = 30, PAD_T = 30, PAD_B = 50;
    const lons = duraklar.map((d) => d.lon);
    const yillar = [...duraklar.map((d) => d.yil_baslangic), ...duraklar.map((d) => d.yil_bitis).filter(Boolean)];
    const xScale = d3.scaleLinear().domain([Math.min(...yillar) - 2, Math.max(...yillar) + 2]).range([PAD_L, w - PAD_R]);
    // y-ekseninde boylam: küçük boylam (batı) üstte olsun ki İber Yarımadası
    // yukarıda, Şam aşağıda kalsın -- bu "batıdan doğuya" hareketi görsel
    // olarak "yukarıdan aşağıya" bir zaman çizgisiyle çakışıyor.
    const yScale = d3.scaleLinear().domain([Math.min(...lons) - 3, Math.max(...lons) + 3]).range([PAD_T, h - PAD_B]);
    duraklar.forEach((d) => { d.x = xScale(d.yil_baslangic); d.y = yScale(d.lon); });
    // Eserleri kendi yıllarında yerleştir; y ekseni ise ait olduğu durağın
    // boylamı. Aynı yıl+boylam çakışması olursa küçük bir dikey ofsetle
    // ayır (aynı durakta aynı yıl birden fazla eser varsa görünsün).
    const grup = new Map(); // key: `${x|0}-${y|0}` -> count
    for (const [durakId, list] of eserlerByDurakId.entries()) {
      const dur = durakById.get(durakId);
      if (!dur) continue;
      list.forEach((eser) => {
        const ex = xScale(eser.yil.miladi);
        const ey = yScale(dur.lon);
        const key = `${Math.round(ex / 8)}-${Math.round(ey / 8)}`;
        const idx = grup.get(key) || 0;
        grup.set(key, idx + 1);
        eser.x = ex;
        eser.y = ey - idx * 8;
      });
    }
    return { w, h, xScale, yScale };
  }

  // KIYI_SERITLERI seyahat-atlasi.js'den bilinçli kopya (statik coğrafya)
  const KIYI_SERITLERI = [
    // İber Yarımadası
    [[-9.3, 43.1], [-8.8, 41.5], [-9.5, 38.7], [-8.9, 37.0], [-7.5, 36.7],
     [-5.4, 36.1], [-2.5, 36.7], [-0.5, 37.9], [0.3, 39.5], [1.2, 41.0],
     [2.2, 41.4], [3.2, 42.4], [1.5, 43.4], [-1.8, 43.4], [-6.5, 43.6]],
    // Mağrib kıyısı
    [[-9.3, 35.7], [-6.0, 35.4], [-2.9, 35.2], [-0.6, 35.7], [3.0, 36.8],
     [7.0, 37.0], [9.5, 37.2], [10.5, 34.5], [8.5, 32.3], [3.0, 32.0],
     [-2.0, 33.2], [-4.5, 34.3], [-7.5, 34.0]],
    // Anadolu + Şam + Mezopotamya + Arabistan
    [[26.0, 40.4], [28.5, 41.2], [31.5, 41.3], [35.0, 41.5], [37.5, 41.0],
     [41.0, 41.5], [44.0, 40.5], [46.0, 39.0], [48.0, 37.0], [48.5, 30.0],
     [48.0, 25.0], [50.5, 22.0], [54.0, 17.0], [51.0, 12.5], [43.5, 12.7],
     [42.5, 15.0], [39.5, 21.0], [37.5, 24.5], [35.5, 27.5], [33.0, 30.5],
     [32.5, 31.5], [34.5, 31.5], [35.5, 33.0], [36.0, 36.0], [35.5, 37.5],
     [32.5, 36.5], [29.5, 36.5], [27.0, 37.5], [26.0, 40.4]],
  ];

  function karaLekeleri(xScale, yScale) {
    const line = d3.line().x((d) => xScale(d[0])).y((d) => yScale(d[1])).curve(d3.curveCatmullRom.alpha(0.6));
    return KIYI_SERITLERI.map((seri) => line(seri));
  }

  function ciz() {
    if (!duraklar.length) return;
    svg.selectAll("*").remove();
    let w, h, xScale, yScale;
    if (currentProjection === "atlas") {
      ({ w, h } = yerlestirAtlas());
      const lons = duraklar.map((d) => d.lon), lats = duraklar.map((d) => d.lat);
      xScale = d3.scaleLinear().domain([Math.min(...lons) - 3, Math.max(...lons) + 3]).range([50, w - 50]);
      yScale = d3.scaleLinear().domain([Math.max(...lats) + 3, Math.min(...lats) - 3]).range([50, h - 50]);
    } else {
      ({ w, h, xScale, yScale } = yerlestirZaman());
    }

    svg.attr("viewBox", `0 0 ${w} ${h}`);
    g = svg.append("g").attr("class", "yolculuk-scene yolculuk-scene--" + currentProjection);

    if (currentProjection === "atlas") {
      // Kara lekeleri (kıyı çizgisi)
      g.append("g").attr("class", "yolculuk-kara").selectAll("path")
        .data(karaLekeleri(xScale, yScale)).join("path").attr("d", (d) => d);
      // Duraklar arası rota (kronolojik zincir, kavisli)
      const line = d3.line().x((d) => d.x).y((d) => d.y).curve(d3.curveCatmullRom.alpha(0.6));
      g.append("g").attr("class", "yolculuk-rota-g").selectAll("path.yolculuk-rota-parca")
        .data(duraklar.slice(1).map((d, i) => ({ a: duraklar[i], b: d })))
        .join("path")
        .attr("class", "yolculuk-rota-parca")
        .attr("d", (d) => line([d.a, d.b]))
        .attr("fill", "none");
    } else {
      // Zaman izdüşümü: alt kenarda yıl ekseni, sol kenarda boylam ekseni.
      // Duraklar arası bağ kronolojik zincir olarak korunur -- ama artık
      // görünürde "batıdan doğuya" YUKARIDAN aşağıya bir çizgi.
      const yillar = xScale.domain();
      // On yıllık aralıklarla tick + etiket
      const tickStep = 10;
      const ilkTick = Math.ceil(yillar[0] / tickStep) * tickStep;
      const ticks = [];
      for (let y = ilkTick; y <= yillar[1]; y += tickStep) ticks.push(y);
      const axisG = g.append("g").attr("class", "yolculuk-eksen-yil");
      axisG.selectAll("line.yolculuk-eksen-yil__grid")
        .data(ticks).join("line").attr("class", "yolculuk-eksen-yil__grid")
        .attr("x1", (t) => xScale(t)).attr("x2", (t) => xScale(t))
        .attr("y1", 20).attr("y2", h - 40);
      axisG.selectAll("text.yolculuk-eksen-yil__etiket")
        .data(ticks).join("text").attr("class", "yolculuk-eksen-yil__etiket")
        .attr("x", (t) => xScale(t)).attr("y", h - 22)
        .attr("text-anchor", "middle").text((t) => t);
      axisG.append("text").attr("class", "yolculuk-eksen__baslik")
        .attr("x", (w) / 2).attr("y", h - 6).attr("text-anchor", "middle")
        .text(tt({ tr: "Yıl (Miladi)", en: "Year (CE)", pt: "Ano (EC)" }));
      // Sol kenarda boylam ekseni: batı üstte, doğu altta
      const lonTicks = [-5, 0, 10, 20, 30, 40];
      axisG.selectAll("text.yolculuk-eksen-lon__etiket")
        .data(lonTicks).join("text").attr("class", "yolculuk-eksen-lon__etiket")
        .attr("x", 8).attr("y", (l) => yScale(l) + 4)
        .attr("text-anchor", "start")
        .text((l) => (l >= 0 ? l + "°E" : Math.abs(l) + "°W"));
      // Kronolojik zincir: duraklardan çizilen bağ
      const line = d3.line().x((d) => d.x).y((d) => d.y).curve(d3.curveMonotoneX);
      g.append("g").attr("class", "yolculuk-rota-g").selectAll("path.yolculuk-rota-parca")
        .data(duraklar.slice(1).map((d, i) => ({ a: duraklar[i], b: d })))
        .join("path")
        .attr("class", "yolculuk-rota-parca")
        .attr("d", (d) => line([d.a, d.b]))
        .attr("fill", "none");
    }

    // Duraklar
    const durakSel = g.append("g").attr("class", "yolculuk-durak-g").selectAll("g.yolculuk-durak")
      .data(duraklar, (d) => d.id).join("g")
      .attr("class", "yolculuk-durak")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => tt(d.sehir));
    durakSel.append("circle").attr("class", "yolculuk-durak__vurus").attr("r", 18).attr("fill", "transparent");
    durakSel.append("circle").attr("class", "yolculuk-durak__nokta").attr("r", 6);

    // Eserler (durakların etrafında küçük noktalar; katalog=elmas, kesin=false=içi boş)
    const eserSel = g.append("g").attr("class", "yolculuk-eser-g").selectAll("g.yolculuk-eser")
      .data(eserler.filter((e) => typeof e.x === "number"), (d) => d.id).join("g")
      .attr("class", (d) => "yolculuk-eser"
        + (d.yil && !d.yil.kesin ? " yolculuk-eser--yaklasik" : "")
        + (d.ozel === "katalog" ? " yolculuk-eser--katalog" : ""))
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => d.eser);
    eserSel.each(function (d) {
      const node = d3.select(this);
      node.append("circle").attr("class", "yolculuk-eser__vurus").attr("r", 10).attr("fill", "transparent");
      if (d.ozel === "katalog") {
        node.append("path").attr("class", "yolculuk-eser__isaret")
          .attr("d", "M0,-5 L5,0 L0,5 L-5,0 Z");
      } else {
        node.append("circle").attr("class", "yolculuk-eser__isaret").attr("r", 3.5);
      }
    });

    // Etiketler: duraklara ait ad
    const etiketSel = durakSel.append("text").attr("class", "yolculuk-durak__etiket")
      .attr("text-anchor", (d) => (d.x > w * 0.7 ? "end" : "start"))
      .attr("x", (d) => (d.x > w * 0.7 ? -12 : 12))
      .attr("y", 4)
      .text((d) => tt(d.sehir));

    // Çakışma çözümü
    const pendingLabels = [];
    etiketSel.each(function (d) {
      const offsetX = d.x > w * 0.7 ? -12 : 12;
      pendingLabels.push({ lbl: d3.select(this), txt: tt(d.sehir), x: d.x + offsetX, y: d.y + 4, baseY: 4 });
    });
    const obstacles = [
      ...duraklar.map((d) => ({ x: d.x, y: d.y, half: 7, h: 14 })),
      ...eserler.filter((e) => typeof e.x === "number").map((e) => ({ x: e.x, y: e.y, half: 5, h: 10 })),
    ];
    deconflictLabels(pendingLabels, obstacles);
    GU.attachLeaderLines(pendingLabels, { className: "yolculuk-durak__leader", threshold: 6, gap: 6 });

    // Etkileşim: durak
    durakSel.on("mouseenter", function (ev, d) { vurgula(d.id, "durak"); ipucuDurak(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgula(null, null); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgula(d.id, "durak"); })
      .on("blur", function () { vurgula(null, null); })
      .on("click", (ev, d) => durakPaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); durakPaneli(d); }
      });

    // Etkileşim: eser
    eserSel.on("mouseenter", function (ev, d) { vurgula(d.id, "eser"); ipucuEser(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgula(null, null); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgula(d.id, "eser"); })
      .on("blur", function () { vurgula(null, null); })
      .on("click", (ev, d) => { ev.stopPropagation(); eserPaneli(d); })
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); eserPaneli(d); }
      });

    zoom = GU.createZoomBehavior(svg, g, [0.7, 4]);
    ortala(false);
  }

  function ortala(animate) {
    if (!zoom || !g) return;
    const { w, h } = boyut();
    const box = g.node().getBBox();
    const scale = Math.min(w / (box.width + 40), h / (box.height + 40), 1.4);
    const tx = w / 2 - (box.x + box.width / 2) * scale;
    const ty = h / 2 - (box.y + box.height / 2) * scale;
    const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
    (animate ? svg.transition().duration(600) : svg).call(zoom.transform, t);
  }

  function vurgula(id, kind) {
    if (!g) return;
    g.selectAll("g.yolculuk-durak").classed("yolculuk-durak--deginiliyor", (d) => kind === "durak" && d.id === id);
    g.selectAll("g.yolculuk-eser").classed("yolculuk-eser--deginiliyor", (d) => kind === "eser" && d.id === id);
  }

  function ipucuDurak(ev, d) {
    const eserSayisi = (eserlerByDurakId.get(d.id) || []).length;
    tooltip.innerHTML = `<strong>${tt(d.sehir)}</strong><span class="node-hover-tip__meta">${d.yil_baslangic}${d.yil_bitis !== d.yil_baslangic ? "–" + d.yil_bitis : ""} · ${eserSayisi} ${tt({tr:"eser",en:"work"+(eserSayisi===1?"":"s"),pt:"obra"+(eserSayisi===1?"":"s")})}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function ipucuEser(ev, d) {
    const yilStr = (d.yil.hicri ? d.yil.hicri + "/" : "") + d.yil.miladi + (d.yil.kesin ? "" : " " + tt({tr:"(yaklaşık)",en:"(approx.)",pt:"(aprox.)"}));
    tooltip.innerHTML = `<strong>${d.eser}</strong><span class="node-hover-tip__meta">${yilStr} · ${tt(d.sehir)}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function durakPaneli(d) {
    focusId = d.id; focusKind = "durak";
    const eserlerBurada = eserlerByDurakId.get(d.id) || [];
    const eserSatirlari = eserlerBurada.map((e) =>
      `<li><button class="yolculuk-panel__eser-btn" data-eser-id="${e.id}">${e.eser}</button> <span class="yolculuk-panel__meta">${e.yil.miladi}${e.yil.kesin ? "" : " (yaklaşık)"}</span></li>`
    ).join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({tr:"Durak",en:"Stop",pt:"Paragem"})}</p>
      <h2 class="detail-title">${tt(d.sehir)}</h2>
      <p class="yolculuk-panel__meta">${d.yil_baslangic}${d.yil_bitis !== d.yil_baslangic ? "–" + d.yil_bitis : ""}</p>
      <div class="detail-block detail-block--soru"><p>${linkify(tt(d.ozet))}</p></div>
      ${eserlerBurada.length ? `<p class="detail-eyebrow detail-eyebrow--section">${tt({tr:"Burada yazılan eserler",en:"Works written here",pt:"Obras escritas aqui"})}</p><ul class="yolculuk-panel__eser-listesi">${eserSatirlari}</ul>` : ""}`;
    detailPanel.hidden = false;
    vurgula(d.id, "durak");
    detailContent.querySelectorAll(".yolculuk-panel__eser-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const e = eserById.get(btn.dataset.eserId);
        if (e) eserPaneli(e);
      });
    });
  }

  function eserPaneli(e) {
    focusId = e.id; focusKind = "eser";
    const katalogRozet = e.ozel === "katalog"
      ? `<span class="eser-agi-rozet">${tt({tr:"katalog",en:"catalogue",pt:"catálogo"})}</span>` : "";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({tr:"Eser",en:"Work",pt:"Obra"})}${katalogRozet}</p>
      <h2 class="detail-title">${e.eser}</h2>
      <p class="eser-agi-kimlik">${e.yil.hicri ? e.yil.hicri + "/" : ""}${e.yil.miladi}${e.yil.kesin ? "" : " " + tt({tr:"(yaklaşık)",en:"(approximate)",pt:"(aproximado)"})} — ${tt(e.sehir)}${e.sehir_belirsiz ? " " + tt({tr:"(şehir belirsiz)",en:"(city uncertain)",pt:"(cidade incerta)"}) : ""}</p>
      <div class="detail-block detail-block--soru"><p>${linkify(tt(e.aciklama))}</p></div>
      ${dayanakHtml(e)}
      ${sehirDayanakHtml(e)}`;
    detailPanel.hidden = false;
    vurgula(e.id, "eser");
  }

  function dayanakHtml(d) {
    const dayanaklar = d.yil && d.yil.dayanak;
    if (!Array.isArray(dayanaklar) || !dayanaklar.length) return "";
    const guvenEtiket = { yuksek: {tr:"yüksek güven",en:"high confidence",pt:"confiança alta"},
                          orta: {tr:"orta güven",en:"medium confidence",pt:"confiança média"},
                          dusuk: {tr:"düşük güven",en:"low confidence",pt:"confiança baixa"} };
    const satirlar = dayanaklar.map((r) => {
      const gg = guvenEtiket[r.guven] || guvenEtiket.orta;
      return `<li><span class="eser-agi-dayanak__guven eser-agi-dayanak__guven--${r.guven}">${tt(gg)}</span> ${r.detay}</li>`;
    }).join("");
    return `<details class="eser-agi-dayanak" open><summary>${tt({tr:"Tarih dayanağı",en:"Date evidence",pt:"Base da datação"})}</summary><ul class="eser-agi-dayanak__liste">${satirlar}</ul></details>`;
  }

  function sehirDayanakHtml(d) {
    const dayanaklar = d.sehir_dayanak;
    if (!Array.isArray(dayanaklar) || !dayanaklar.length) return "";
    const guvenEtiket = { yuksek: {tr:"yüksek güven",en:"high confidence",pt:"confiança alta"},
                          orta: {tr:"orta güven",en:"medium confidence",pt:"confiança média"},
                          dusuk: {tr:"düşük güven",en:"low confidence",pt:"confiança baixa"} };
    const satirlar = dayanaklar.map((r) => {
      const gg = guvenEtiket[r.guven] || guvenEtiket.orta;
      return `<li><span class="eser-agi-dayanak__guven eser-agi-dayanak__guven--${r.guven}">${tt(gg)}</span> ${r.detay}</li>`;
    }).join("");
    return `<details class="eser-agi-dayanak" open><summary>${tt({tr:"Şehir dayanağı",en:"City evidence",pt:"Base do local"})}</summary><ul class="eser-agi-dayanak__liste">${satirlar}</ul></details>`;
  }

  function girisPaneli() {
    focusId = null; focusKind = null;
    const belirsizSayisi = sehirBelirsizEserler.length;
    const belirsizListe = belirsizSayisi
      ? `<p class="yolculuk-belirsiz">${tt({
          tr: "Bu grafikte yer alamayan " + belirsizSayisi + " eser var (şehri belirsiz -- mekân eksenine giremez): ",
          en: belirsizSayisi + " work" + (belirsizSayisi > 1 ? "s" : "") + " cannot appear on this graph (city uncertain -- outside the spatial axis): ",
          pt: belirsizSayisi + " obra" + (belirsizSayisi > 1 ? "s" : "") + " não pode" + (belirsizSayisi > 1 ? "m" : "") + " aparecer neste gráfico (cidade incerta -- fora do eixo espacial): "
        })}${sehirBelirsizEserler.map((e) => `<button class="yolculuk-belirsiz__btn" data-eser-id="${e.id}">${e.eser}</button>`).join(", ")}.</p>`
      : "";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({tr:"Yolculuk",en:"The Journey",pt:"A Jornada"})}</p>
      <h2 class="detail-title">${duraklar.length} ${tt({tr:"durak",en:"stops",pt:"paragens"})}, ${eserler.length} ${tt({tr:"eser",en:"works",pt:"obras"})}</h2>
      <div class="detail-block detail-block--soru"><p>${tt({
        tr: "Eser Ağı ve Seyahat Atlası'nın birleşmesi -- iki izdüşümlü. **Atlas** izdüşümünde her durak coğrafi konumunda ve her eser o durakta yazıldığı için durağın yakınında. **Zaman** izdüşümünde aynı düğümler yer değiştirir: x=yıl, y=boylam. Harita düzleşir, zaman açılır. Endülüs-Fas gidiş gelişleri sol üstte dalgalanma, 1200'deki kopuş ortada dik bir tırmanış, Şam'daki son on yedi yıl sağda düz bir hat olur. Üstteki iki düğmeyle izdüşümü değiştirin.",
        en: "The combining of the Works Timeline with the Travel Atlas -- two projections. In **Atlas** each stop sits at its geographic position, each work next to the stop where it was written. In **Time** the same nodes take new positions: x=year, y=longitude. The map flattens, time unfolds. The Andalusia-Morocco crossings become an undulation at upper left, the 1200 rupture a steep climb in the middle, the last seventeen years in Damascus a straight line to the right. Use the two buttons above to switch projections.",
        pt: "A união da Linha do Tempo das Obras com o Atlas de Viagem -- duas projeções. No **Atlas** cada paragem está na sua posição geográfica, cada obra ao lado da paragem onde foi escrita. Em **Tempo** os mesmos nós tomam novas posições: x=ano, y=longitude. O mapa aplana-se, o tempo desdobra-se. As travessias Al-Andalus–Marrocos tornam-se uma ondulação no canto superior esquerdo, a rutura de 1200 uma subida abrupta no meio, os últimos dezassete anos em Damasco uma linha reta à direita. Use os dois botões acima para alternar as projeções."
      })}</p></div>
      ${belirsizListe}`;
    detailPanel.hidden = false;
    detailContent.querySelectorAll(".yolculuk-belirsiz__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const e = eserById.get(btn.dataset.eserId);
        if (e) eserPaneli(e);
      });
    });
  }

  let yuklendi = false;
  function yukle() {
    if (yuklendi) return Promise.resolve();
    const base = window.__dostRouteBase || "";
    const p = (base ? base + "/" : "") + "data/ibn-arabi/";
    return Promise.all([GU.fetchJson(p + "seyahat-atlasi.json"), GU.fetchJson(p + "eser-agi.json")]).then(([a, e]) => {
      atlasData = a;
      eserAgiData = e;
      duraklar = a.duraklar || [];
      eserler = e.eserler || [];
      durakById = new Map(duraklar.map((d) => [d.id, d]));
      eserById = new Map(eserler.map((x) => [x.id, x]));
      // Eserleri duraklara eşle: durak.eserler[] ya da eser.sehir.tr ile substring.
      eserlerByDurakId = new Map(duraklar.map((d) => [d.id, []]));
      sehirBelirsizEserler = [];
      for (const eser of eserler) {
        if (eser.sehir_belirsiz) { sehirBelirsizEserler.push(eser); continue; }
        // 1) Atlas duraklarında zaten eserler[] backref varsa onu kullan
        let atandiId = null;
        for (const dur of duraklar) {
          if (Array.isArray(dur.eserler) && dur.eserler.includes(eser.id)) {
            atandiId = dur.id; break;
          }
        }
        // 2) Yoksa sehir.tr üzerinden substring eşleme (yedek)
        if (!atandiId) {
          for (const dur of duraklar) {
            if (tt(dur.sehir).includes(tt(eser.sehir)) || tt(eser.sehir).includes(tt(dur.sehir))) {
              atandiId = dur.id; break;
            }
          }
        }
        if (atandiId) {
          eserlerByDurakId.get(atandiId).push(eser);
        } else {
          // Ne backref ne isim eşleşti -- sehir_belirsiz gibi davran (izdüşüm dışı)
          sehirBelirsizEserler.push(eser);
        }
      }
      yuklendi = true;
      ciz();
    });
  }

  function setProjection(next) {
    if (next !== "atlas" && next !== "zaman") return;
    if (next === currentProjection) return;
    currentProjection = next;
    try { sessionStorage.setItem("yolculuk-projection", next); } catch (_) {}
    updateToggleUI();
    if (yuklendi) ciz();
    // Kimlik korunur: aynı düğüm seçiliyse yeniden çizimden sonra panel
    // aynı seçili kayda dönsün.
    if (focusId) {
      if (focusKind === "durak") { const d = durakById.get(focusId); if (d) vurgula(d.id, "durak"); }
      else if (focusKind === "eser") { const e = eserById.get(focusId); if (e) vurgula(e.id, "eser"); }
    }
  }

  function updateToggleUI() {
    const atlasBtn = document.getElementById("yolculuk-toggle-atlas");
    const zamanBtn = document.getElementById("yolculuk-toggle-zaman");
    if (atlasBtn) atlasBtn.setAttribute("aria-pressed", String(currentProjection === "atlas"));
    if (zamanBtn) zamanBtn.setAttribute("aria-pressed", String(currentProjection === "zaman"));
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("yolculuk-recenter", () => ortala(true));
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("yolculuk-wrap", () => {
      if (focusId) { girisPaneli(); return true; }
      return false;
    });
    window.addEventListener("resize", GU.debounceResize(() => {
      if (!yuklendi || wrapEl.hidden) return;
      ciz();
    }));
    // Toggle butonları: atlas ⇄ zaman izdüşümü
    const atlasBtn = document.getElementById("yolculuk-toggle-atlas");
    const zamanBtn = document.getElementById("yolculuk-toggle-zaman");
    if (atlasBtn) atlasBtn.addEventListener("click", () => setProjection("atlas"));
    if (zamanBtn) zamanBtn.addEventListener("click", () => setProjection("zaman"));
    updateToggleUI();
  }

  return {
    activate() {
      baglaBirKez();
      yukle().catch(() => {
        if (window.DostViewStatus) window.DostViewStatus.showError("yolculuk-wrap", () => window.__yolculukApp.activate());
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      ciz();
      if (focusId) {
        if (focusKind === "durak") {
          const d = durakById.get(focusId);
          if (d) durakPaneli(d);
        } else if (focusKind === "eser") {
          const e = eserById.get(focusId);
          if (e) eserPaneli(e);
        }
      } else if (!detailPanel.hidden) {
        girisPaneli();
      }
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = durakById.get(id);
        if (d) { durakPaneli(d); return; }
        const e = eserById.get(id);
        if (e) eserPaneli(e);
      });
    },
  };
})();
