// Seyahat Atlası — Dost'un Mürsiye'den Şam'a uzanan güzergâhı, her durakta
// yazdığı eserlerle birlikte (docs/icerik-yol-haritasi.md D8).
//
// NEDEN BU BİÇİM. Statik site kısıtıyla uyumlu: harita tile servisi yok,
// kendi çizdiğimiz şematik bir kıyı şeridi var -- "dönemin coğrafya
// tasavvuruna yakın, modern sınırlar yok" (roadmap'in kendi isteği).
// Zaman kaydırıcısı GORSEL_DIL.md'nin "davranışı resmet" kuralını
// karşılıyor: bir yıl seçildiğinde, o yıldan SONRA varılan duraklar ve
// onlara giden rota parçaları sönükleşiyor -- güzergâh zamanla AÇILIYOR,
// süs değil.
window.__seyahatAtlasiApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;

  const svg = d3.select("#seyahat-atlasi-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("seyahat-atlasi-wrap");
  const tooltip = document.getElementById("seyahat-atlasi-tooltip");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const slider = document.getElementById("seyahat-atlasi-slider");
  const sliderEtiket = document.getElementById("seyahat-atlasi-slider-etiket");

  if (!svgNode || !wrapEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  function tt(dict) { return I18n.pick3(dict || {}); }

  let data = null;
  let eserAgiData = null;
  let duraklar = [];
  let durakById = new Map();
  let eserById = new Map();
  let zoom = null;
  let g = null;
  let focusId = null;
  let minYear = 1165, maxYear = 1240, sliderYear = 1240;

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(360, r.width), h: Math.max(320, r.height) };
  }

  // Basit düzlem izdüşümü (gerçek bir harita projeksiyonu değil) -- enlem/
  // boylamı doğrudan x/y'e ölçekliyoruz. Şematik olduğu için yeterli.
  function yerlestir() {
    const { w, h } = boyut();
    const PAD = 50;
    const lons = duraklar.map((d) => d.lon), lats = duraklar.map((d) => d.lat);
    const x = d3.scaleLinear().domain([Math.min(...lons) - 3, Math.max(...lons) + 3]).range([PAD, w - PAD]);
    const y = d3.scaleLinear().domain([Math.max(...lats) + 3, Math.min(...lats) - 3]).range([PAD, h - PAD]);
    duraklar.forEach((d) => { d.x = x(d.lon); d.y = y(d.lat); });
    return { w, h };
  }

  // Kara parçalarının ÇOK şematik, yumuşak lekeleri -- gerçek bir kıyı
  // şeridi değil, "burada kara var" izlenimi. Kasıtlı belirsiz.
  function karaLekeleri(w, h) {
    return [
      `M ${w * 0.02} ${h * 0.1} Q ${w * 0.15} ${h * 0.02} ${w * 0.32} ${h * 0.12}
       Q ${w * 0.4} ${h * 0.3} ${w * 0.28} ${h * 0.42} Q ${w * 0.1} ${h * 0.45} ${w * 0.02} ${h * 0.3} Z`,
      `M ${w * 0.05} ${h * 0.55} Q ${w * 0.3} ${h * 0.5} ${w * 0.55} ${h * 0.58}
       Q ${w * 0.6} ${h * 0.78} ${w * 0.35} ${h * 0.95} Q ${w * 0.05} ${h * 0.98} ${w * 0.0} ${h * 0.7} Z`,
      `M ${w * 0.62} ${h * 0.35} Q ${w * 0.85} ${h * 0.15} ${w * 1.0} ${h * 0.3}
       Q ${w * 1.0} ${h * 0.7} ${w * 0.9} ${h * 0.95} Q ${w * 0.65} ${h * 0.9} ${w * 0.6} ${h * 0.6} Z`,
    ];
  }

  function ciz() {
    const { w, h } = yerlestir();
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    g = svg.append("g").attr("class", "seyahat-scene");

    g.append("g").attr("class", "seyahat-kara").selectAll("path").data(karaLekeleri(w, h)).join("path").attr("d", (d) => d);

    // Rota: kronolojik sırayla duraklar arası kavisli çizgi.
    const line = d3.line().x((d) => d.x).y((d) => d.y).curve(d3.curveCatmullRom.alpha(0.6));
    const rotaSel = g.append("g").attr("class", "seyahat-rota-g").selectAll("path.seyahat-rota-parca")
      .data(duraklar.slice(1).map((d, i) => ({ a: duraklar[i], b: d })))
      .join("path")
      .attr("class", "seyahat-rota-parca")
      .attr("d", (d) => line([d.a, d.b]))
      .attr("fill", "none");

    const durakSel = g.append("g").attr("class", "seyahat-durak-g").selectAll("g.seyahat-durak")
      .data(duraklar, (d) => d.id).join("g")
      .attr("class", "seyahat-durak")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => tt(d.sehir));

    durakSel.append("circle").attr("class", "seyahat-durak__vurus").attr("r", 16).attr("fill", "transparent");
    durakSel.append("circle").attr("class", "seyahat-durak__nokta").attr("r", 6);
    durakSel.append("text").attr("class", "seyahat-durak__etiket")
      .attr("text-anchor", (d) => (d.x > w * 0.7 ? "end" : "start"))
      .attr("x", (d) => (d.x > w * 0.7 ? -10 : 10))
      .attr("y", 4)
      .text((d) => tt(d.sehir));

    durakSel.on("mouseenter", function (ev, d) { vurgula(d.id, true); ipucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgula(null, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgula(d.id, true); })
      .on("blur", function () { vurgula(null, false); })
      .on("click", (ev, d) => durakPaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); durakPaneli(d); }
      });

    zoom = GU.createZoomBehavior(svg, g, [0.7, 3]);
    ortala(false);
    uygulaZamanFiltresi();
  }

  function uygulaZamanFiltresi() {
    if (!g) return;
    g.selectAll("g.seyahat-durak").classed("seyahat-durak--gelecek", (d) => d.yil_baslangic > sliderYear);
    g.selectAll("path.seyahat-rota-parca").classed("seyahat-rota-parca--gelecek", (d) => d.b.yil_baslangic > sliderYear);
  }

  function vurgula(id, on) {
    if (!g) return;
    g.selectAll("g.seyahat-durak").classed("seyahat-durak--deginiliyor", (d) => on && d.id === id);
  }

  function ipucu(ev, d) {
    tooltip.innerHTML = `<strong>${tt(d.sehir)}</strong><span class="node-hover-tip__meta">${d.yil_baslangic}${d.yil_bitis !== d.yil_baslangic ? "–" + d.yil_bitis : ""}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function eserBaslik(id) {
    const e = eserById.get(id);
    return e ? e.eser : id;
  }

  function eserlerHtml(d) {
    if (!d.eserler || !d.eserler.length) return "";
    const rows = d.eserler.map((eid) =>
      `<a class="cross-link seyahat-eser-bag" href="${window.__dostNav.href("eser-agi", eid)}" data-view="eser-agi" data-id="${eid}">${eserBaslik(eid)}</a>`).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Burada yazılan eserler", en: "Works written here", pt: "Obras escritas aqui" })}</p>
            <div class="seyahat-eser-listesi">${rows}</div>`;
  }

  function durakPaneli(d) {
    focusId = d.id;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${d.yil_baslangic}${d.yil_bitis !== d.yil_baslangic ? "–" + d.yil_bitis : ""}</p>
      <h2 class="detail-title">${tt(d.sehir)}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(d.ozet)}</p></div>
      ${eserlerHtml(d)}`;
    detailPanel.hidden = false;
    vurgula(d.id, true);
  }

  function girisPaneli() {
    focusId = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Seyahat Atlası", en: "Travel Atlas", pt: "Atlas de Viagem" })}</p>
      <h2 class="detail-title">${duraklar.length} ${tt({ tr: "durak", en: "stops", pt: "paragens" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>
      <ul class="bilmiyoruz-madde__kaynaklar">${data.kaynaklar.map((k) => {
        const not = k.not ? ` <span class="bilmiyoruz-madde__kaynak-not">— ${k.not}</span>` : "";
        const yil = k.yil ? ", " + k.yil : "";
        return `<li class="bilmiyoruz-madde__kaynak">${k.yazar}, <em>${k.eser}</em>${yil}${not}</li>`;
      }).join("")}</ul>`;
    detailPanel.hidden = false;
  }

  function ortala(animate) {
    if (!zoom) return;
    const hedef = animate ? svg.transition().duration(420) : svg;
    hedef.call(zoom.transform, d3.zoomIdentity);
  }

  function slidereBagla() {
    if (!slider) return;
    slider.min = String(minYear);
    slider.max = String(maxYear);
    slider.value = String(maxYear);
    sliderYear = maxYear;
    if (sliderEtiket) sliderEtiket.textContent = String(sliderYear);
    slider.addEventListener("input", () => {
      sliderYear = Number(slider.value);
      if (sliderEtiket) sliderEtiket.textContent = String(sliderYear);
      uygulaZamanFiltresi();
    });
  }

  let yuklendi = false;
  function yukle() {
    if (yuklendi) return Promise.resolve();
    const base = window.__dostRouteBase || "";
    const urlAtlas = (base ? base + "/" : "") + "data/ibn-arabi/seyahat-atlasi.json";
    const urlEser = (base ? base + "/" : "") + "data/ibn-arabi/eser-agi.json";
    return Promise.all([GU.fetchJson(urlAtlas), GU.fetchJson(urlEser)]).then(([d, e]) => {
      data = d;
      eserAgiData = e;
      duraklar = (d.duraklar || []).map((x) => Object.assign({}, x));
      durakById = new Map(duraklar.map((x) => [x.id, x]));
      eserById = new Map((e.eserler || []).map((x) => [x.id, x]));
      const years = duraklar.map((x) => x.yil_baslangic);
      minYear = Math.min(...years);
      maxYear = Math.max(...duraklar.map((x) => x.yil_bitis).concat(years));
      yuklendi = true;
      ciz();
      slidereBagla();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("seyahat-atlasi-recenter", () => ortala(true));
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("seyahat-atlasi-wrap", () => {
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
      yukle().then(() => { girisPaneli(); }).catch(() => {
        const st = document.getElementById("seyahat-atlasi-wrap-status");
        if (st) {
          st.hidden = false;
          st.querySelector(".view-status__text").textContent =
            tt({ tr: "Atlas yüklenemedi.", en: "The atlas could not be loaded.", pt: "O atlas não pôde ser carregado." });
        }
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      ciz();
      if (focusId) {
        const d = durakById.get(focusId);
        if (d) durakPaneli(d); else girisPaneli();
      } else girisPaneli();
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = durakById.get(id);
        if (d) durakPaneli(d);
      });
    },
  };
})();
