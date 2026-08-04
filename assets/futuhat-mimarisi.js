// Fütûhât'ın Mimarisi — kitabın altı büyük fasıla bölünüşü (docs/icerik-
// yol-haritasi.md D11).
//
// KAPSAM (bkz. data/ibn-arabi/futuhat-mimarisi.json'un "not" alanı, aynı
// metin giriş panelinde de gösteriliyor): bu yalnız kitabın kendi YAPISINI
// gösteriyor -- sitenin 268 kısmı bu yapıya henüz BAĞLANMADI, çünkü kısımlar
// hangi bab'a denk geldiğini gösteren güvenilir bir alan taşımıyor.
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

    zoom = GU.createZoomBehavior(svg, g, [0.6, 3]);
    ortala(false);
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
      <p class="elestiri-kaynak-satiri">${data.kaynak.yazar}, <em>${data.kaynak.eser}</em></p>`;
    detailPanel.hidden = false;
    vurgula(d.id, true);
  }

  function girisPaneli() {
    focusId = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Fütûhât'ın Mimarisi", en: "The Architecture of the Futûhât", pt: "A Arquitetura das Futûhât" })}</p>
      <h2 class="detail-title">${tt({ tr: "560 bab, altı fasıl", en: "560 chapters, six sections", pt: "560 capítulos, seis seções" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>
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
    const url = (base ? base + "/" : "") + "data/ibn-arabi/futuhat-mimarisi.json";
    return GU.fetchJson(url).then((d) => {
      data = d;
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
