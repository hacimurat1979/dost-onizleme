// Açık Sorular — kapanmamış soruların halkası.
//
// NEDEN BU BİÇİM (GORSEL_DIL.md: "kavramı resmetme, davranışını resmet").
// Bir açık sorunun davranışı şudur: etrafında kanıt birikir ama soru
// KAPANMAZ. Bu yüzden her soru, kapanmamış bir yay olarak çiziliyor —
// çemberin bir parçası hiç çizilmiyor, ve o boşluk sorunun ne kadar açık
// olduğu kadar büyük. Yayın üzerindeki küçük çentikler, o soru için okuma
// kaydımızda bulduğumuz kayıtlar: kanıt arttıkça çentik artıyor, ama yay
// yine de kapanmıyor. Kapanan tek şey yok; bu bilinçli.
//
// Halkanın kendisi sitenin kalıcı ilkesinden geliyor (CLAUDE.md: daire ve
// merkez). Merkezde bir cevap değil, bir sayı duruyor: kaç soru hâlâ açık.
//
// ETKILESIM_DILI.md sözleşmesi: değinmek (hover) = yayın çentikleri
// belirir + ipucu; seçmek (tıklama) = panel; bir adım geri (ESC) =
// panelden halkaya. Bağlanmamış düğme yok — buradaki tek düğme
// (#acik-sorular-recenter) GU.wireRecenter ile gerçekten bağlı.
window.__acikSorularApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const svg = d3.select("#acik-sorular-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("acik-sorular-wrap");
  const tooltip = document.getElementById("acik-sorular-tooltip");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");

  if (!svgNode || !wrapEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)

  // Sitede üç ayrı "soru" görünümü var (Sorular/Bilmiyoruz/Açık Sorular) --
  // isim benzerliği kafa karıştırabiliyor (kullanıcı bulgusu, 2026-08-09).
  // sorular.js'teki AYNI fonksiyon (görünümler birbirinden bağımsız tembel
  // yükleniyor, paylaşılamaz -- tt() de aynı sebeple her dosyada ayrı).
  function soruAilesiNavHtml(buradaki) {
    const base = window.__dostRouteBase || "";
    const AILE = {
      sorular: { view: "sorular", href: "/sorular", baslik: { tr: "Sorular", en: "Questions", pt: "Perguntas" }, aciklama: { tr: "okuyucuya cevap veren bir SSS", en: "an FAQ that answers the reader", pt: "um FAQ que responde ao leitor" } },
      bilmiyoruz: { view: "bilmiyoruz", href: "/bilmiyoruz", baslik: { tr: "Bilmiyoruz", en: "We Don't Know", pt: "Não Sabemos" }, aciklama: { tr: "metnin kendi çözülmemiş noktaları -- biz sormuyoruz, sınırı o gösteriyor", en: "the text's own unresolved points -- not our question, its own limit", pt: "os próprios pontos não resolvidos do texto" } },
      "acik-sorular": { view: "acik-sorular", href: "/acik-sorular", baslik: { tr: "Açık Sorular", en: "Open Questions", pt: "Perguntas em Aberto" }, aciklama: { tr: "bizim okurken kapanmayan sorularımız", en: "our own questions that don't close as we read", pt: "as nossas perguntas que não se fecham" } },
    };
    const digerleri = Object.keys(AILE).filter((k) => k !== buradaki);
    const linkler = digerleri.map((k) => {
      const a = AILE[k];
      return `<a class="soru-ailesi-nav__link" href="${base}${a.href}" data-view="${a.view}">
        <strong>${tt(a.baslik)}</strong><span>${tt(a.aciklama)}</span>
      </a>`;
    }).join("");
    return `<div class="soru-ailesi-nav">
      <p class="soru-ailesi-nav__baslik">${tt({ tr: "Sitede üç ayrı “soru” görünümü var, birbirinin yerine geçmiyor:", en: "The site has three separate “question” views, not interchangeable:", pt: "O site tem três vistas de “pergunta” diferentes, não intercambiáveis:" })}</p>
      ${linkler}
    </div>`;
  }

  // Boşluk açısı = sorunun ne kadar açık olduğu. Sayılar keyfi değil,
  // üç durumu birbirinden GÖZLE ayırt edilebilecek kadar ayırıyor.
  const BOSLUK = { acik: 118, kismen: 54, kaynak_tukendi: 92 };
  const DURUM_VAR = {
    acik: "--series-kemal",
    kismen: "--series-theme",
    kaynak_tukendi: "--text-muted",
  };

  let data = null;
  let nodes = [];
  let zoom = null;
  let g = null;
  let focusId = null;

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(320, r.width), h: Math.max(320, r.height) };
  }

  // Yay yolu: merkezi (0,0) olan, boşluğu YUKARI bakan bir çember parçası.
  // Boşluk hep aynı yöne bakıyor ki halkada gezerken boşlukların büyüklüğü
  // karşılaştırılabilsin — dönen bir boşluk okunamaz.
  function yayYolu(r, bosluk) {
    const yariAcik = (360 - bosluk) / 2;
    const a0 = (-90 + bosluk / 2) * Math.PI / 180;
    const a1 = (-90 + bosluk / 2 + yariAcik * 2) * Math.PI / 180;
    const x0 = r * Math.cos(a0), y0 = r * Math.sin(a0);
    const x1 = r * Math.cos(a1), y1 = r * Math.sin(a1);
    const buyuk = 360 - bosluk > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${buyuk} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  // Çentikler: yayın üzerine eşit aralıklarla, bulunan kayıt sayısı kadar.
  function centikler(r, bosluk, adet) {
    if (!adet) return [];
    const yay = 360 - bosluk;
    const out = [];
    for (let i = 0; i < adet; i++) {
      const t = adet === 1 ? 0.5 : i / (adet - 1);
      const a = (-90 + bosluk / 2 + yay * (0.08 + 0.84 * t)) * Math.PI / 180;
      out.push({ x: r * Math.cos(a), y: r * Math.sin(a), i: i });
    }
    return out;
  }

  function yerlestir() {
    const { w, h } = boyut();
    const R = Math.min(w, h) * 0.36;
    const n = nodes.length;
    nodes.forEach((d, i) => {
      const a = (-Math.PI / 2) + (i / n) * Math.PI * 2;
      d.x = Math.cos(a) * R;
      d.y = Math.sin(a) * R;
    });
  }

  function ciz() {
    svg.selectAll("*").remove();
    const { w, h } = boyut();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    g = svg.append("g").attr("class", "acik-sorular-scene");
    const kok = g.append("g").attr("transform", `translate(${w / 2}, ${h / 2})`);

    // Merkez: bir cevap değil, bir sayı. Halka boyunca dolaşan her yay
    // buraya bakıyor; merkez sitenin kalıcı imgesi (daire ve merkez).
    const acikSayisi = nodes.filter((d) => d.durum !== "kaynak_tukendi").length;
    const merkez = kok.append("g").attr("class", "acik-sorular-merkez");
    merkez.append("circle").attr("r", 46).attr("class", "acik-sorular-merkez__halka");
    merkez.append("text").attr("class", "acik-sorular-merkez__sayi")
      .attr("text-anchor", "middle").attr("dy", "-0.05em").text(acikSayisi);
    merkez.append("text").attr("class", "acik-sorular-merkez__etiket")
      .attr("text-anchor", "middle").attr("dy", "1.5em")
      .text(tt({ tr: "soru açık", en: "still open", pt: "em aberto" }));

    const sel = kok.selectAll("g.acik-soru").data(nodes, (d) => d.id).join("g")
      .attr("class", "acik-soru")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => tt(d.soru));

    const R = 27;

    // Vuruş alanı. Yayın kendisi `fill: none` bir çizgi; tıklama yalnız o
    // 2,4px'lik çizgiye denk gelirse çalışırdı. Ontoloji kenarlarında
    // ölçülen aynı kusur (bkz. `path.link-hit`): görünmez ama tıklanabilir
    // bir daire, hedefi ~0'dan yayın tamamına çıkarıyor.
    sel.append("circle")
      .attr("class", "acik-soru__vurus")
      .attr("r", R + 7)
      .attr("fill", "transparent");

    sel.append("path")
      .attr("class", (d) => "acik-soru__yay acik-soru__yay--" + d.durum)
      .attr("d", (d) => yayYolu(R, BOSLUK[d.durum] || 90))
      .attr("stroke", (d) => GU.getVar(DURUM_VAR[d.durum] || "--text-muted"));

    // Kayıt çentikleri: hover'dan ÖNCE de görünüyorlar (sönük), çünkü
    // "kanıt var ama soru kapanmıyor" bilgisi ilk bakışta okunmalı.
    sel.each(function (d) {
      const adet = (d.arama && d.arama.kayitlar ? d.arama.kayitlar.length : 0);
      d3.select(this).selectAll("circle.acik-soru__centik")
        .data(centikler(R, BOSLUK[d.durum] || 90, Math.min(adet, 12)))
        .join("circle")
        .attr("class", "acik-soru__centik")
        .attr("cx", (p) => p.x).attr("cy", (p) => p.y).attr("r", 1.9)
        .attr("fill", GU.getVar(DURUM_VAR[d.durum] || "--text-muted"))
        .style("transition-delay", (p) => (reduceMotion ? "0ms" : (p.i * 45) + "ms"));
    });

    sel.append("text").attr("class", "acik-soru__no")
      .attr("text-anchor", "middle").attr("dy", "0.35em")
      .text((d) => "#" + d.no);

    // Etiketler halkanın DIŞINA taşınıyor (yayın merkezinden dışa doğru),
    // yoksa on dokuz etiket halkanın içinde üst üste biner.
    sel.append("text").attr("class", "acik-soru__etiket")
      .attr("text-anchor", (d) => (d.x > 6 ? "start" : d.x < -6 ? "end" : "middle"))
      .attr("x", (d) => (d.x > 6 ? R + 8 : d.x < -6 ? -(R + 8) : 0))
      .attr("y", (d) => (Math.abs(d.x) > 6 ? 4 : (d.y >= 0 ? R + 16 : -(R + 10))))
      .text((d) => kisalt(tt(d.soru), 30));

    sel.on("mouseenter", function (ev, d) { vurgula(d.id, true); ipucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function (ev, d) { vurgula(d.id, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgula(d.id, true); })
      .on("blur", function (ev, d) { vurgula(d.id, false); })
      .on("click", (ev, d) => panelGoster(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); panelGoster(d); }
      });

    zoom = GU.createZoomBehavior(svg, g, [0.5, 3]);
    ortala(false);
  }

  function kisalt(s, n) {
    if (!s) return "";
    if (s.length <= n) return s;
    const kes = s.slice(0, n);
    const i = kes.lastIndexOf(" ");
    return (i > 12 ? kes.slice(0, i) : kes) + "…";
  }

  function vurgula(id, on) {
    if (!g) return;
    g.selectAll("g.acik-soru").classed("acik-soru--deginiliyor", (d) => on && d.id === id);
  }

  function ipucu(ev, d) {
    const durum = data.durumlar[d.durum] || {};
    const adet = (d.arama && d.arama.kayitlar ? d.arama.kayitlar.length : 0);
    const kanit = adet
      ? tt({ tr: adet + " kayıtta iz", en: "traces in " + adet + " records", pt: "vestígios em " + adet + " registos" })
      : tt({ tr: "kaydımızda iz yok", en: "no trace in our record", pt: "sem vestígio no nosso registo" });
    // Numara (#144 gibi) tek başına anlaşılmıyor -- 19 soru varken 144
    // görmek okuyucuyu şaşırtır. "kayıt no" etiketi bunun bir sıra değil,
    // okuma kaydımızdaki yer olduğunu ilk bakışta açıklıyor (bkz. data.not).
    const kayitNo = tt({ tr: "kayıt no " + d.no, en: "log #" + d.no, pt: "registo nº " + d.no });
    tooltip.innerHTML =
      `<strong>${tt(d.soru)}</strong>` +
      `<span class="node-hover-tip__meta">${kayitNo} · ${tt(durum)} · ${kanit}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function baglarHtml(d) {
    if (!d.baglar || !d.baglar.length) return "";
    // 2026-08-06 denetiminde bulundu: bu satır bir `<a href="#/view/id">`
    // idi -- site hash tabanlı değil History API tabanlı yönlendirme
    // kullanıyor (bkz. ontology.js updateHash), o yüzden bu href hiçbir
    // yere gitmiyordu, 18 bağın hepsi sessizce ölüydü. data-view/data-id +
    // goTo() sitedeki her yerde kullanılan gerçek desen.
    const rows = d.baglar.map((b) =>
      `<button type="button" class="acik-soru__bag" data-view="${b.view}" data-id="${b.id}">${b.id.replace(/-/g, " ")}</button>`).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Nereye dokunuyor", en: "What it touches", pt: "O que toca" })}</p>
            <div class="acik-soru__baglar">${rows}</div>`;
  }
  function wireBaglar() {
    detailContent.querySelectorAll(".acik-soru__bag").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.__dostNav && window.__dostNav.goTo(btn.dataset.view, btn.dataset.id);
      });
    });
  }

  function panelGoster(d) {
    focusId = d.id;
    const durum = data.durumlar[d.durum] || {};
    const okumalar = (d.okumalar || []).map((o) => {
      const kayit = (o.dayanak || []).length
        ? `<p class="acik-soru__dayanak">${tt({ tr: "dayanak", en: "grounds", pt: "fundamento" })}: ${o.dayanak.join(", ")}</p>`
        : "";
      return `<div class="detail-block"><p>${tt(o.metin)}</p>${kayit}</div>`;
    }).join("");
    const arama = d.arama
      ? `<div class="acik-soru__olcum">
           <p class="acik-soru__olcum-baslik">${tt({ tr: "Ne aradık, ne bulduk", en: "What we searched, what we found", pt: "O que procurámos, o que encontrámos" })}</p>
           <p class="acik-soru__olcum-sorgu"><code>${d.arama.sorgu}</code></p>
           <p class="acik-soru__olcum-sonuc">${tt(d.arama.sonuc)}</p>
         </div>` : "";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Açık Soru", en: "Open Question", pt: "Pergunta em Aberto" })} #${d.no}
        <span class="acik-soru__durum acik-soru__durum--${d.durum}">${tt(durum)}</span></p>
      <h2 class="detail-title">${tt(d.soru)}</h2>
      <p class="acik-soru__kaynak">${tt({ tr: "Doğduğu yer", en: "Where it arose", pt: "Onde surgiu" })}: ${tt(d.dogdugu_yer)}</p>
      ${arama}
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Olası okumalar", en: "Possible readings", pt: "Leituras possíveis" })}</p>
      ${okumalar}
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Kapanması için ne gerekir", en: "What would close it", pt: "O que a fecharia" })}</p>
      <div class="detail-block detail-block--soru"><p>${tt(d.ne_gerekir)}</p></div>
      ${baglarHtml(d)}`;
    wireBaglar();
    detailPanel.hidden = false;
    vurgula(d.id, true);
  }

  function girisPaneli() {
    focusId = null;
    const satirlar = nodes.map((d) =>
      `<button class="acik-soru-satir" type="button" data-id="${d.id}">
         <span class="acik-soru-satir__no">#${d.no}</span>
         <span>${tt(d.soru)}</span>
       </button>`).join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Açık Sorular", en: "Open Questions", pt: "Perguntas em Aberto" })}</p>
      <h2 class="detail-title">${nodes.length} ${tt({ tr: "kapanmamış soru", en: "questions that have not closed", pt: "perguntas que não se fecharam" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>
      ${soruAilesiNavHtml("acik-sorular")}
      <div class="acik-soru-liste">${satirlar}</div>`;
    detailContent.querySelectorAll(".acik-soru-satir").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = nodes.find((x) => x.id === btn.dataset.id);
        if (d) panelGoster(d);
      });
    });
    detailPanel.hidden = false;
  }

  // "Görünümü ortala" = zoom dönüşümünü kimliğe döndürmek. Sahne zaten
  // wrap'in merkezine göre çizildiği için başka bir hesap gerekmiyor.
  function ortala(animate) {
    if (!zoom) return;
    const hedef = animate && !reduceMotion
      ? svg.transition().duration(420)
      : svg;
    hedef.call(zoom.transform, d3.zoomIdentity);
  }

  let yuklendi = false;
  function yukle() {
    if (yuklendi) return Promise.resolve();
    const base = window.__dostRouteBase || "";
    const url = (base ? base + "/" : "") + "data/ibn-arabi/acik-sorular.json";
    return GU.fetchJson(url).then((d) => {
      data = d;
      nodes = (d.sorular || []).map((s) => Object.assign({}, s));
      yuklendi = true;
      yerlestir();
      ciz();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("acik-sorular-recenter", () => ortala(true));
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("acik-sorular-wrap", () => {
      if (focusId) { girisPaneli(); return true; }
      return false;
    });
    // 2026-08-10 denetim (G40): soruların tam metnini görmek için grafik
    // yerine liste görünümü. Mevcut girisPaneli() ZATEN üç dilli tam liste
    // gösteriyordu -- düğme yalnız o paneli tetikler, mimari değişmez.
    const listeBtn = document.getElementById("acik-sorular-liste-btn");
    if (listeBtn) listeBtn.addEventListener("click", () => girisPaneli());
    window.addEventListener("resize", GU.debounceResize(() => {
      if (!yuklendi || wrapEl.hidden) return;
      yerlestir(); ciz();
    }));
  }

  return {
    activate() {
      // 2026-08-06 kullanıcı bulgusu: girisPaneli() burada çağrılıp panel
      // her açılışta otomatik gösteriliyordu -- artık yalnız bir soru
      // seçildiğinde açılıyor (bkz. hocalar.js'teki aynı düzeltme).
      baglaBirKez();
      yukle().then(() => {
        yerlestir(); ciz();
      }).catch(() => {
        if (window.DostViewStatus) window.DostViewStatus.showError("acik-sorular-wrap", () => window.__acikSorularApp.activate());
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      ciz();
      if (focusId) {
        const d = nodes.find((x) => x.id === focusId);
        if (d) panelGoster(d); else if (!detailPanel.hidden) girisPaneli();
      } else if (!detailPanel.hidden) girisPaneli();
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = nodes.find((x) => x.id === id);
        if (d) panelGoster(d);
      });
    },
  };
})();
