// Açık Sorular — dolmayan kaplar.
//
// NEDEN BU BİÇİM (GORSEL_DIL.md: "kavramı resmetme, davranışını resmet";
// 2026-08-19 yeniden tasarım -- eski yay-boşluk idiomu bilmiyoruz.js ile
// ayırt edilemiyordu). Bir açık sorunun davranışı şudur: etrafında kanıt
// birikir ama soru KAPANMAZ. Her soru artık bir KAP (sahnelerdeki kap
// ailesinin aynı soyundan): okuma kaydımızda bulduğumuz iz sayısı kabı
// doldurur, ama `durum`a göre bir TAVAN vardır ve dolgu o kesikli çizgiyi
// asla geçemez -- ağzıyla arasındaki boşluk her kapta görünür kalır.
// Doluluk merkeze UZAKLIĞI da belirler: kanıtı birikmiş kaplar merkeze
// (hakikate) yakın, boş kaplar kesrete (kenara) savrulmuş durur --
// CLAUDE.md'nin derinlik/uzaklık eşleşmesi graf düzeninin kendisinde.
//
// Merkezde bir cevap değil, bir sayı duruyor: kaç soru hâlâ açık.
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
  const deconflictLabels = GU.createLabelDeconflictor();

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

  // 2026-08-19 yeniden tasarım (kullanıcı isteği: "daha doyurucu ve ilk
  // görüşte kendini ifade eden" -- bilmiyoruz.js'in AYNI yay-boşluk
  // idiomundan tamamen ayrılıyor). Yeni davranış: her açık soru bir KAP --
  // kanıt biriktikçe içi dolar, ama `durum`a göre bir TAVAN var; o tavanın
  // üstüne asla çıkmıyor. Sitedeki "kap" ailesiyle aynı dil (bkz.
  // sahne-cizim.js KAP_YOLLARI) -- sahnelerde kurulan imge burada grafiğe
  // taşınıyor. Kabın üstünden ağır ağır kaçan birkaç ışık zerresi, "kanıt
  // birikir ama hiçbir zaman kapanmaz" davranışını dondurulmuş bir gap
  // açısı yerine SÜREN bir hareketle anlatıyor.
  //
  // İkinci katman: kabın ne kadar dolu olduğu (dolumSkoru) merkeze
  // UZAKLIĞI da belirliyor -- doluya yakın kaplar merkeze (hakikate) daha
  // yakın, boş kaplar kesrete (kenara) savruluyor. CLAUDE.md'nin "derinlik
  // = hakikate yaklaşma, uzaklık = kesret" eşleşmesi burada ilk kez bir
  // graf düzeninin KENDİSİNE, yalnız bir sahneye değil, uygulanıyor.
  const KAP_TAVAN = { acik: 0.32, kismen: 0.60, kaynak_tukendi: 0.88 };
  const DURUM_VAR = {
    acik: "--series-kemal",
    kismen: "--series-theme",
    kaynak_tukendi: "--text-muted",
  };
  const KAP_R = 17;

  let data = null;
  let nodes = [];
  let zoom = null;
  let g = null;
  let focusId = null;

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(320, r.width), h: Math.max(320, r.height) };
  }

  function dolumHesapla(d) {
    const adet = (d.arama && d.arama.kayitlar ? d.arama.kayitlar.length : 0);
    const tavan = KAP_TAVAN[d.durum] != null ? KAP_TAVAN[d.durum] : 0.5;
    return { adet: adet, dolum: tavan * Math.min(1, adet / 6) };
  }

  function yerlestir() {
    const { w, h } = boyut();
    const RMIN = Math.min(w, h) * 0.15, RMAX = Math.min(w, h) * 0.42;
    const n = nodes.length;
    const TAVAN_MAX = 0.88;
    nodes.forEach((d, i) => {
      const { adet, dolum } = dolumHesapla(d);
      d.adet = adet; d.dolum = dolum;
      const skor = Math.min(1, dolum / TAVAN_MAX);
      const R = RMIN + (1 - skor) * (RMAX - RMIN);
      const a = (-Math.PI / 2) + (i / n) * Math.PI * 2;
      d.x = Math.cos(a) * R;
      d.y = Math.sin(a) * R;
    });
  }

  // Kap geometrisi: yarım-küre çanak (sahne-cizim.js KAP_YOLLARI.kap ile
  // aynı soy) + içindeki dolgu, kabın alt yayının bir klip içinde
  // yükselmesiyle çiziliyor. Dolgunun üst çizgisi ile kabın ağzı arasındaki
  // boşluk, dondurulmuş bir açı değil GERÇEK bir eksiklik olarak okunuyor.
  function kapYolu(r) {
    return "M " + (-r) + " 0 A " + r + " " + r + " 0 0 0 " + r + " 0";
  }

  function ciz() {
    svg.selectAll("*").remove();
    const { w, h } = boyut();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    const defs = svg.append("defs");
    g = svg.append("g").attr("class", "acik-sorular-scene");
    const kok = g.append("g").attr("transform", `translate(${w / 2}, ${h / 2})`);

    // Merkez: bir cevap değil, bir sayı. Dolu kaplar ona yaklaşıyor,
    // boşlar kesrete savruluyor; merkez sitenin kalıcı imgesi.
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

    const R = KAP_R;

    sel.append("circle")
      .attr("class", "acik-soru__vurus")
      .attr("r", R + 11)
      .attr("fill", "transparent");

    // Kap içi dolgu: kabın çanağını klip olarak kullanan, yüksekliği
    // dolum oranına göre yukarı uzanan bir dikdörtgen. Kap ağzı y=0'da,
    // çanak y=+R'ye iniyor; dolum 0..1 => dikdörtgen tabandan yükseliyor.
    sel.each(function (d, i) {
      const kapsel = d3.select(this);
      const cid = "acik-kap-klip-" + i;
      defs.append("clipPath").attr("id", cid)
        .append("path").attr("d", kapYolu(R) + " Z");
      // Çanağın derinliği R (ağız y=0, dip y=+R); dolum 1 = ağza kadar.
      const doluY = R - d.dolum * R;
      kapsel.append("rect")
        .attr("class", "acik-soru__dolgu")
        .attr("clip-path", "url(#" + cid + ")")
        .attr("x", -R).attr("width", R * 2)
        .attr("y", doluY).attr("height", R * 2)
        .attr("fill", GU.getVar(DURUM_VAR[d.durum] || "--text-muted"));
      // Tavan çizgisi: kabın DOLABİLECEĞİ en üst nokta -- kesikli, sönük.
      // Dolgu ile ağız arasındaki boşluğun "daha dolabilirdi ama duracak"
      // değil "buraya kadar dolabilir, yine de kapanmaz" olduğunu söylüyor.
      const tavan = KAP_TAVAN[d.durum] != null ? KAP_TAVAN[d.durum] : 0.5;
      const tavanY = R - tavan * R;
      const tavanW = Math.sqrt(Math.max(0, R * R - tavanY * tavanY));
      kapsel.append("line")
        .attr("class", "acik-soru__tavan")
        .attr("x1", -tavanW).attr("x2", tavanW)
        .attr("y1", tavanY).attr("y2", tavanY);
    });

    // Kabın kendisi: dolgunun ÜSTÜNE çizilir ki kenar hep okunur kalsın.
    sel.append("path")
      .attr("class", (d) => "acik-soru__kap acik-soru__kap--" + d.durum)
      .attr("d", (d) => kapYolu(R))
      .attr("stroke", (d) => GU.getVar(DURUM_VAR[d.durum] || "--text-muted"));

    sel.append("text").attr("class", "acik-soru__no")
      .attr("text-anchor", "middle").attr("y", -R - 6)
      .text((d) => "#" + d.no);

    const etiketSel = sel.append("text").attr("class", "acik-soru__etiket")
      .attr("text-anchor", (d) => (d.x > 6 ? "start" : d.x < -6 ? "end" : "middle"))
      .attr("x", (d) => (d.x > 6 ? R + 10 : d.x < -6 ? -(R + 10) : 0))
      .attr("y", (d) => (Math.abs(d.x) > 6 ? 4 : (d.y >= 0 ? R + 16 : -(R + 14))))
      .text((d) => kisalt(tt(d.soru), 30));

    const pendingLabels = [];
    etiketSel.each(function (d) {
      const lx = d.x > 6 ? R + 10 : d.x < -6 ? -(R + 10) : 0;
      const ly = Math.abs(d.x) > 6 ? 4 : (d.y >= 0 ? R + 16 : -(R + 14));
      pendingLabels.push({
        lbl: d3.select(this), txt: kisalt(tt(d.soru), 30),
        x: d.x + lx, y: d.y + ly, baseY: ly,
      });
    });
    deconflictLabels(pendingLabels);

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
    const adet = d.adet || 0;
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
