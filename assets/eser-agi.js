// Eser Ağı — Dost'un eserlerinin kronolojik sarmalı (docs/icerik-yol-
// haritasi.md D7). Roadmap'in "gerçek kenarları olan ilk graf" isteği:
// düğümler (eserler) MIAS'ın kendi tarih/şehir verisinden, kenarlar (aynı
// şehirde art arda yazılan eserler) yine o veriden -- hiçbiri uydurma değil.
//
// NEDEN SARMAL. CLAUDE.md'nin daire/merkez ilkesi + roadmap'in kendi isteği
// ("merkezde ilk eser, dışa doğru zaman") birleşiyor: yarıçap = yıl (Dost'un
// ilk eseri merkezde), açı = sıra (aynı yılda yazılan birkaç eser bile farklı
// açılarda durur, üst üste binmez). Kaç tur döndüğü kronolojinin 44 yıllık
// uzunluğunu okunur kılıyor.
window.__eserAgiApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const svg = d3.select("#eser-agi-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("eser-agi-wrap");
  const tooltip = document.getElementById("eser-agi-tooltip");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");

  if (!svgNode || !wrapEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  function tt(dict) { return I18n.pick3(dict || {}); }

  const LOOPS = 3;
  const R_MIN = 30;

  let data = null;
  let eserler = [];
  let baglar = [];
  let eserById = new Map();
  let zoom = null;
  let g = null;
  let focusId = null;
  let focusEdge = null;

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(360, r.width), h: Math.max(360, r.height) };
  }

  function yerlestir() {
    const { w, h } = boyut();
    const R_MAX = Math.min(w, h) * 0.42;
    const n = eserler.length;
    const years = eserler.map((d) => d.yil.miladi);
    const minY = Math.min(...years), maxY = Math.max(...years);
    const rScale = d3.scaleLinear().domain([minY, maxY]).range([R_MIN, R_MAX]);
    const angleStep = (2 * Math.PI * LOOPS) / n;
    eserler.forEach((d, i) => {
      const a = -Math.PI / 2 + i * angleStep;
      const rad = rScale(d.yil.miladi);
      d.x = Math.cos(a) * rad;
      d.y = Math.sin(a) * rad;
    });
    return { w, h };
  }

  function spiralYolu() {
    const n = eserler.length;
    const angleStep = (2 * Math.PI * LOOPS) / n;
    const { w, h } = boyut();
    const R_MAX = Math.min(w, h) * 0.42;
    const years = eserler.map((d) => d.yil.miladi);
    const minY = Math.min(...years), maxY = Math.max(...years);
    const rScale = d3.scaleLinear().domain([minY, maxY]).range([R_MIN, R_MAX]);
    const pts = [];
    for (let t = 0; t <= n - 1; t += 0.1) {
      const i0 = Math.floor(t), frac = t - i0;
      const y0 = eserler[i0].yil.miladi;
      const y1 = eserler[Math.min(i0 + 1, n - 1)].yil.miladi;
      const yr = y0 + (y1 - y0) * frac;
      const a = -Math.PI / 2 + t * angleStep;
      const rad = rScale(yr);
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    const line = d3.line();
    return line(pts);
  }

  function ciz() {
    const { w, h } = yerlestir();
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    g = svg.append("g").attr("class", "eser-agi-scene");
    const kok = g.append("g").attr("transform", `translate(${w / 2}, ${h / 2})`);

    kok.append("path").attr("class", "eser-agi-sarmal").attr("d", spiralYolu()).attr("fill", "none");

    // Kenarlar (aynı şehir zinciri) -- sarmalın kendi çizgisinden ayrı,
    // doğrudan iki düğüm merkezini birleştiren kısa akorlar.
    const kenarG = kok.append("g").attr("class", "eser-agi-kenarler");
    const kenarSel = kenarG.selectAll("line.eser-agi-kenar").data(baglar, (d, i) => d.kaynak_id + "|" + i).join("line")
      .attr("class", "eser-agi-kenar")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => edgeAriaLabel(d))
      .attr("x1", (d) => eserById.get(d.kaynak_id).x).attr("y1", (d) => eserById.get(d.kaynak_id).y)
      .attr("x2", (d) => eserById.get(d.hedef_id).x).attr("y2", (d) => eserById.get(d.hedef_id).y);

    kenarSel.on("mouseenter", function (ev, d) { vurgulaKenar(d, true); kenarIpucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgulaKenar(null, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgulaKenar(d, true); })
      .on("blur", function () { vurgulaKenar(null, false); })
      .on("click", (ev, d) => kenarPaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); kenarPaneli(d); }
      });

    const dugumG = kok.append("g").attr("class", "eser-agi-dugumler");
    const sel = dugumG.selectAll("g.eser-agi-eser").data(eserler, (d) => d.id).join("g")
      .attr("class", (d) => "eser-agi-eser" + (d.ozel === "katalog" ? " eser-agi-eser--katalog" : ""))
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => d.eser);

    const R = 7;
    sel.append("circle").attr("class", "eser-agi-eser__vurus").attr("r", R + 9).attr("fill", "transparent");

    sel.each(function (d) {
      const node = d3.select(this);
      if (d.ozel === "katalog") {
        node.append("path").attr("class", "eser-agi-eser__sekil")
          .attr("d", `M0,${-R * 1.2} L${R * 1.2},0 L0,${R * 1.2} L${-R * 1.2},0 Z`);
      } else {
        node.append("circle").attr("class", "eser-agi-eser__sekil").attr("r", R);
      }
    });

    sel.append("text").attr("class", "eser-agi-eser__etiket")
      .attr("text-anchor", (d) => (d.x > 8 ? "start" : d.x < -8 ? "end" : "middle"))
      .attr("x", (d) => (d.x > 8 ? R + 7 : d.x < -8 ? -(R + 7) : 0))
      .attr("y", (d) => (Math.abs(d.x) > 8 ? 4 : (d.y >= 0 ? R + 14 : -(R + 8))))
      .text((d) => kisalt(d.eser, 22));

    sel.on("mouseenter", function (ev, d) { vurgulaEser(d.id, true); ipucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgulaEser(null, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgulaEser(d.id, true); })
      .on("blur", function () { vurgulaEser(null, false); })
      .on("click", (ev, d) => eserPaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); eserPaneli(d); }
      });

    zoom = GU.createZoomBehavior(svg, g, [0.6, 3.5]);
    ortala(false);
  }

  function kisalt(s, n) {
    if (!s) return "";
    if (s.length <= n) return s;
    const kes = s.slice(0, n);
    const i = kes.lastIndexOf(" ");
    return (i > 8 ? kes.slice(0, i) : kes) + "…";
  }

  function vurgulaEser(id, on) {
    if (!g) return;
    g.selectAll("g.eser-agi-eser").classed("eser-agi-eser--deginiliyor", (d) => on && d.id === id);
  }
  function vurgulaKenar(d, on) {
    if (!g) return;
    g.selectAll("line.eser-agi-kenar").classed("eser-agi-kenar--deginiliyor", (l) => on && l === d);
  }

  function ipucu(ev, d) {
    tooltip.innerHTML =
      `<strong>${d.eser}</strong>` +
      `<span class="node-hover-tip__meta">${tt(d.sehir)} · ${d.yil.hicri ? d.yil.hicri + "/" : ""}${d.yil.miladi}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function edgeAriaLabel(d) {
    const a = eserById.get(d.kaynak_id), b = eserById.get(d.hedef_id);
    return (a ? a.eser : d.kaynak_id) + " → " + (b ? b.eser : d.hedef_id) + " — " + tt({ tr: "aynı şehir", en: "same city", pt: "mesma cidade" });
  }

  function kenarIpucu(ev, d) {
    const a = eserById.get(d.kaynak_id), b = eserById.get(d.hedef_id);
    tooltip.innerHTML = GU.edgeReasonHtml({
      title: (a ? a.eser : d.kaynak_id) + " → " + (b ? b.eser : d.hedef_id),
      kindLabel: tt({ tr: "aynı şehir", en: "same city", pt: "mesma cidade" }),
      reason: tt(d.neden),
    });
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function eserPaneli(d) {
    focusId = d.id;
    focusEdge = null;
    const katalogRozet = d.ozel === "katalog"
      ? `<span class="eser-agi-rozet">${tt({ tr: "katalog", en: "catalogue", pt: "catálogo" })}</span>` : "";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(d.sehir)}${katalogRozet}</p>
      <h2 class="detail-title">${d.eser}</h2>
      <p class="eser-agi-kimlik">${d.yil.hicri ? d.yil.hicri + "/" : ""}${d.yil.miladi}${d.yil.kesin ? "" : " " + tt({ tr: "(yaklaşık)", en: "(approximate)", pt: "(aproximado)" })}</p>
      <div class="detail-block detail-block--soru"><p>${tt(d.aciklama)}</p></div>
      <p class="elestiri-kaynak-satiri">${data.kaynak.yazar}, <em>${data.kaynak.eser}</em></p>`;
    detailPanel.hidden = false;
    vurgulaEser(d.id, true);
  }

  function kenarPaneli(b) {
    focusEdge = b;
    focusId = null;
    const a = eserById.get(b.kaynak_id), h = eserById.get(b.hedef_id);
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Bağ", en: "Connection", pt: "Ligação" })}
        <span class="eser-agi-rozet">${tt({ tr: "aynı şehir", en: "same city", pt: "mesma cidade" })}</span></p>
      <h2 class="detail-title">${a ? a.eser : b.kaynak_id} → ${h ? h.eser : b.hedef_id}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(b.neden)}</p></div>`;
    detailPanel.hidden = false;
    vurgulaKenar(b, true);
  }

  function girisPaneli() {
    focusId = null;
    focusEdge = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Eser Ağı", en: "The Works Spiral", pt: "A Espiral das Obras" })}</p>
      <h2 class="detail-title">${eserler.length} ${tt({ tr: "eser", en: "works", pt: "obras" })}, ${baglar.length} ${tt({ tr: "bağ", en: "connections", pt: "ligações" })}</h2>
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
    const url = (base ? base + "/" : "") + "data/ibn-arabi/eser-agi.json";
    return GU.fetchJson(url).then((d) => {
      data = d;
      eserler = (d.eserler || []).map((e) => Object.assign({}, e));
      baglar = d.baglar || [];
      eserById = new Map(eserler.map((e) => [e.id, e]));
      yuklendi = true;
      ciz();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("eser-agi-recenter", () => ortala(true));
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("eser-agi-wrap", () => {
      if (focusId || focusEdge) { girisPaneli(); return true; }
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
        const st = document.getElementById("eser-agi-wrap-status");
        if (st) {
          st.hidden = false;
          st.querySelector(".view-status__text").textContent =
            tt({ tr: "Ağ yüklenemedi.", en: "The network could not be loaded.", pt: "A rede não pôde ser carregada." });
        }
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      ciz();
      if (focusId) {
        const d = eserById.get(focusId);
        if (d) eserPaneli(d); else girisPaneli();
      } else if (focusEdge) {
        kenarPaneli(focusEdge);
      } else girisPaneli();
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = eserById.get(id);
        if (d) eserPaneli(d);
      });
    },
  };
})();
