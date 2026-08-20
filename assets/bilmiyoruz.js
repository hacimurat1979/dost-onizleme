// Bilmiyoruz — görüşün sisli kenarı.
//
// NEDEN BU BİÇİM (GORSEL_DIL.md: "kavramı resmetme, davranışını resmet";
// 2026-08-19 yeniden tasarım -- eski yay-boşluk idiomu acik-sorular.js ile
// ayırt edilemiyordu). Burada ölçülen şey bizim iz sayımız değil, maddenin
// KENDİ doğasının ne kadar bilinebilir olduğu. Bu yüzden her madde,
// görüş dairemizin SINIRINDA duran bir ışık: `durum`una göre sisin daha
// derinine gömülü (tartismali en derin/en bulanık, bizim_sinirimiz sınıra
// en yakın/en az bulanık). Bulanıklık = bilgisizlik eşleşmesi (GORSEL_DIL)
// burada ilk kez bir graf görünümünün ana kodlaması. Değinince ışık bir
// nebze toparlanır ama HİÇBİR ZAMAN tam netleşmez -- "kaçan merkez"
// davranışı: bu maddeler hover'la çözülecek şeyler değil.
//
// Görüş dairesi (net iç alan + sise geçen kenar) CLAUDE.md'nin
// daire/merkez ilkesini koruyor; merkezde yine bir cevap değil bir sayı.
//
// ETKILESIM_DILI.md sözleşmesi: değinmek (hover) = ipucu; seçmek
// (tıklama) = panel; bir adım geri (ESC) = panelden halkaya. Bağlanmamış
// düğme yok -- #bilmiyoruz-recenter GU.wireRecenter ile gerçekten bağlı.
window.__bilmiyoruzApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const deconflictLabels = GU.createLabelDeconflictor();

  const svg = d3.select("#bilmiyoruz-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("bilmiyoruz-wrap");
  const tooltip = document.getElementById("bilmiyoruz-tooltip");
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

  // Sise gömülme derinliği = maddenin durumuna göre sabit: tartışmalı bir
  // mesele (alanın kendisi anlaşmamış) en derinde ve en bulanık, bizim
  // sınırımız (ileride araştırmayla kapanabilir) görüş sınırına en yakın.
  // derinlik: görüş yarıçapının ÜSTÜNE binen pay; blur: px cinsinden.
  const SIS = {
    tartismali:      { derinlik: 0.34, blur: 3.4 },
    belirsiz:        { derinlik: 0.20, blur: 2.2 },
    bizim_sinirimiz: { derinlik: 0.08, blur: 1.1 },
  };
  const DURUM_VAR = {
    tartismali: "--series-kemal",
    belirsiz: "--series-theme",
    bizim_sinirimiz: "--text-muted",
  };

  let data = null;
  let nodes = [];
  let zoom = null;
  let g = null;
  let focusId = null;

  // 2026-08-10 denetim (G41): sitenin duruş beyanı olan bu sayfa görsel olarak
  // neredeyse boş kalıyor, manifesto metni yalnız ipucu/panel arkasında
  // duruyordu. Şimdi bilmiyoruz.json'daki `not` alanı (üç dilli) sayfanın
  // başına DOĞRUDAN yazılıyor -- ana ilkenin en görünür sözü.
  function renderManifest() {
    const el = document.getElementById("bilmiyoruz-manifest");
    if (!el || !data) return;
    const metin = tt(data.not);
    if (!metin) { el.hidden = true; return; }
    el.innerHTML = `<p class="bilmiyoruz-manifest__p">${metin}</p>`;
    el.hidden = false;
  }

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(320, r.width), h: Math.max(320, r.height) };
  }

  // Görüş yarıçapı: net iç alan buraya kadar; maddeler bunun DIŞINA,
  // durumlarının sis derinliğine göre yerleşiyor.
  function gorusYaricapi() {
    const { w, h } = boyut();
    return Math.min(w, h) * 0.24;
  }

  function yerlestir() {
    const n = nodes.length;
    const R0 = gorusYaricapi();
    nodes.forEach((d, i) => {
      const sis = SIS[d.durum] || SIS.belirsiz;
      const R = R0 * (1 + sis.derinlik + 0.16);
      const a = (-Math.PI / 2) + (i / n) * Math.PI * 2;
      d.x = Math.cos(a) * R;
      d.y = Math.sin(a) * R;
    });
  }

  function ciz() {
    svg.selectAll("*").remove();
    const { w, h } = boyut();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    const defs = svg.append("defs");
    g = svg.append("g").attr("class", "bilmiyoruz-scene");
    const kok = g.append("g").attr("transform", `translate(${w / 2}, ${h / 2})`);
    const R0 = gorusYaricapi();

    // Görüş dairesi: net iç alan, kenara doğru sise geçiyor. Keskin bir
    // halka DEĞİL (GORSEL_DIL: iç içe eşmerkezli çember yasağı) -- tek,
    // yumuşak kenarlı bir alan; sınır bir çizgi değil bir SOLUŞ.
    const gid = "bilmiyoruz-gorus-grad";
    const gorusRenk = GU.getVar("--series-theme") || "#c9971a";
    const grad = defs.append("radialGradient").attr("id", gid);
    grad.append("stop").attr("offset", "0%").attr("stop-color", gorusRenk).attr("stop-opacity", 0.10);
    grad.append("stop").attr("offset", "62%").attr("stop-color", gorusRenk).attr("stop-opacity", 0.05);
    grad.append("stop").attr("offset", "100%").attr("stop-color", gorusRenk).attr("stop-opacity", 0);
    kok.append("circle")
      .attr("class", "bilmiyoruz-gorus")
      .attr("r", R0 * 1.12)
      .attr("fill", "url(#" + gid + ")");

    // Durum başına bir blur filtresi (madde başına değil -- filtre sayısı
    // sabit kalsın). Değinince blur'un yarısına iner ama sıfırlanmaz.
    Object.keys(SIS).forEach((k) => {
      const f = defs.append("filter").attr("id", "bilmiyoruz-sis-" + k)
        .attr("x", "-60%").attr("y", "-60%").attr("width", "220%").attr("height", "220%");
      f.append("feGaussianBlur").attr("stdDeviation", SIS[k].blur);
      const f2 = defs.append("filter").attr("id", "bilmiyoruz-sis-" + k + "-yakin")
        .attr("x", "-60%").attr("y", "-60%").attr("width", "220%").attr("height", "220%");
      f2.append("feGaussianBlur").attr("stdDeviation", SIS[k].blur * 0.45);
    });

    // Merkez: bir cevap değil, bir sayı -- "kaç sınır işaretlendi".
    const merkez = kok.append("g").attr("class", "bilmiyoruz-merkez");
    merkez.append("text").attr("class", "bilmiyoruz-merkez__sayi")
      .attr("text-anchor", "middle").attr("dy", "-0.05em").text(nodes.length);
    merkez.append("text").attr("class", "bilmiyoruz-merkez__etiket")
      .attr("text-anchor", "middle").attr("dy", "1.5em")
      .text(tt({ tr: "sınır işaretli", en: "limits marked", pt: "limites marcados" }));

    const sel = kok.selectAll("g.bilmiyoruz-madde").data(nodes, (d) => d.id).join("g")
      .attr("class", "bilmiyoruz-madde")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => tt(d.baslik));

    const R = 27;

    sel.append("circle")
      .attr("class", "bilmiyoruz-madde__vurus")
      .attr("r", R + 7)
      .attr("fill", "transparent");

    // Sisin içindeki ışık: durumuna göre bulanık. Işık = zuhur; buradaki
    // maddeler VAR (metin onları açıkça söylüyor) ama NET DEĞİL -- varlığı
    // ışıkla, bilinemezliği bulanıklıkla kodlanıyor. reduced-motion'da da
    // blur duruyor (hareket değil, durum kodlaması).
    sel.append("circle")
      .attr("class", (d) => "bilmiyoruz-madde__isik bilmiyoruz-madde__isik--" + d.durum)
      .attr("r", 10)
      .attr("fill", (d) => GU.getVar(DURUM_VAR[d.durum] || "--text-muted"))
      .attr("filter", (d) => "url(#bilmiyoruz-sis-" + (SIS[d.durum] ? d.durum : "belirsiz") + ")");

    sel.append("text").attr("class", "bilmiyoruz-madde__ikon")
      .attr("text-anchor", "middle").attr("dy", "0.35em").text("?");

    // Ölçüm tabanlı deconflictLabels (hal.js/menziller/seyahat-atlası'nda
    // kanıtlanmış) -- acik-sorular.js'teki aynı düzeltme: madde sayısı
    // arttıkça komşu etiketler halkanın dışında bile üst üste binebiliyordu
    // (kullanıcı isteği, "grafiği zenginleştir", 2026-08-16).
    const etiketSel = sel.append("text").attr("class", "bilmiyoruz-madde__etiket")
      .attr("text-anchor", (d) => (d.x > 6 ? "start" : d.x < -6 ? "end" : "middle"))
      .attr("x", (d) => (d.x > 6 ? R + 8 : d.x < -6 ? -(R + 8) : 0))
      .attr("y", (d) => (Math.abs(d.x) > 6 ? 4 : (d.y >= 0 ? R + 16 : -(R + 10))))
      .text((d) => kisalt(tt(d.baslik), 30));

    const pendingLabels = [];
    etiketSel.each(function (d) {
      const lx = d.x > 6 ? R + 8 : d.x < -6 ? -(R + 8) : 0;
      const ly = Math.abs(d.x) > 6 ? 4 : (d.y >= 0 ? R + 16 : -(R + 10));
      pendingLabels.push({
        lbl: d3.select(this), txt: kisalt(tt(d.baslik), 30),
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
    g.selectAll("g.bilmiyoruz-madde").classed("bilmiyoruz-madde--deginiliyor", (d) => on && d.id === id);
    // Değinilen ışık bir nebze toparlanır ama TAM netleşmez ("kaçan
    // merkez") -- blur yarıya iner, sıfırlanmaz.
    g.selectAll("circle.bilmiyoruz-madde__isik")
      .attr("filter", (d) => {
        const k = SIS[d.durum] ? d.durum : "belirsiz";
        return "url(#bilmiyoruz-sis-" + k + ((on && d.id === id) ? "-yakin" : "") + ")";
      });
  }

  function ipucu(ev, d) {
    const durum = data.durumlar[d.durum] || {};
    const kategori = data.kategoriler[d.kategori] || {};
    tooltip.innerHTML =
      `<strong>${tt(d.baslik)}</strong>` +
      `<span class="node-hover-tip__meta">${tt(kategori)} · ${tt(durum)}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function kaynaklarHtml(d) {
    if (!d.kaynaklar || !d.kaynaklar.length) return "";
    const rows = d.kaynaklar.map((k) => {
      const yil = k.yil ? ", " + k.yil : "";
      const not = k.not ? ` <span class="bilmiyoruz-madde__kaynak-not">— ${k.not}</span>` : "";
      return `<li class="bilmiyoruz-madde__kaynak">${k.yazar}, <em>${k.eser}</em>${yil}${not}</li>`;
    }).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Kaynaklar", en: "Sources", pt: "Fontes" })}</p>
            <ul class="bilmiyoruz-madde__kaynaklar">${rows}</ul>`;
  }

  // docs/icerik-uretim-plani.md Bölüm G / ADIM 5'in önerdiği "taraflar"
  // fikri mevcut sayfaya EKLENDİ (2026-08-06, kullanıcı kararı) -- ayrı bir
  // şemaya geçmek yerine. "kaynaklar" bir isim listesiyken, "taraflar" o
  // isimlerden her birinin NE dediğini ayrı ayrı yapılandırıyor.
  function taraflarHtml(d) {
    if (!d.taraflar || !d.taraflar.length) return "";
    const rows = d.taraflar.map((t) =>
      `<div class="bilmiyoruz-madde__taraf">
         <p class="bilmiyoruz-madde__taraf-kim">${t.kim}</p>
         <p class="bilmiyoruz-madde__taraf-ne">${tt(t.ne_diyor)}</p>
       </div>`).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Taraflar", en: "Positions", pt: "Posições" })}</p>
            <div class="bilmiyoruz-madde__taraflar">${rows}</div>`;
  }

  function baglarHtml(d) {
    if (!d.baglar || !d.baglar.length) return "";
    // 2026-08-06 denetiminde bulundu: acik-sorular.js'teki aynı hatanın
    // kopyası -- `<a href="#/view/id">` site hash tabanlı değil History
    // API tabanlı yönlendirme kullandığı için hiçbir yere gitmiyordu.
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
    const kategori = data.kategoriler[d.kategori] || {};
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(kategori)}
        <span class="bilmiyoruz-madde__durum bilmiyoruz-madde__durum--${d.durum}">${tt(durum)}</span></p>
      <h2 class="detail-title">${tt(d.baslik)}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(d.aciklama)}</p></div>
      ${taraflarHtml(d)}
      ${kaynaklarHtml(d)}
      ${baglarHtml(d)}`;
    wireBaglar();
    detailPanel.hidden = false;
    vurgula(d.id, true);
  }

  function girisPaneli() {
    focusId = null;
    const satirlar = nodes.map((d) => {
      const durum = data.durumlar[d.durum] || {};
      return `<button class="acik-soru-satir" type="button" data-id="${d.id}">
         <span class="bilmiyoruz-madde__durum bilmiyoruz-madde__durum--${d.durum}">${tt(durum)}</span>
         <span>${tt(d.baslik)}</span>
       </button>`;
    }).join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Bilmiyoruz", en: "We Don't Know", pt: "Não Sabemos" })}</p>
      <h2 class="detail-title">${nodes.length} ${tt({ tr: "sınır işaretlendi", en: "limits marked", pt: "limites marcados" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>
      ${soruAilesiNavHtml("bilmiyoruz")}
      <div class="acik-soru-liste">${satirlar}</div>`;
    detailContent.querySelectorAll(".acik-soru-satir").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = nodes.find((x) => x.id === btn.dataset.id);
        if (d) panelGoster(d);
      });
    });
    detailPanel.hidden = false;
  }

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
    const url = (base ? base + "/" : "") + "data/ibn-arabi/bilmiyoruz.json";
    return GU.fetchJson(url).then((d) => {
      data = d;
      nodes = (d.maddeler || []).map((s) => Object.assign({}, s));
      yuklendi = true;
      yerlestir();
      ciz();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("bilmiyoruz-recenter", () => ortala(true));
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("bilmiyoruz-wrap", () => {
      if (focusId) { girisPaneli(); return true; }
      return false;
    });
    window.addEventListener("resize", GU.debounceResize(() => {
      if (!yuklendi || wrapEl.hidden) return;
      yerlestir(); ciz();
    }));
  }

  return {
    activate() {
      // 2026-08-06 kullanıcı bulgusu: girisPaneli() burada çağrılıp panel
      // her açılışta otomatik gösteriliyordu -- artık yalnız bir madde
      // seçildiğinde açılıyor (bkz. hocalar.js'teki aynı düzeltme).
      baglaBirKez();
      yukle().then(() => {
        yerlestir(); ciz(); renderManifest();
      }).catch(() => {
        if (window.DostViewStatus) window.DostViewStatus.showError("bilmiyoruz-wrap", () => window.__bilmiyoruzApp.activate());
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      renderManifest();
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
