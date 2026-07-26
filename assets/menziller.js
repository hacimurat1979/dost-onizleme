(function () {
  "use strict";

  // ============================================================================
  // Menziller — 28 ay menzilinin halkası
  //
  // Fütûhât'ın 198. Bölümü, yirmi sekiz fasıl boyunca aynı dörtlüyü tekrarlar:
  // bir ilahi isim, o isimden zuhur eden şey, bir harf, bir ay menzili. Bu
  // görünüm o yirmi sekiz faslı tek bir halkaya topluyor.
  //
  // Halkanın MERKEZİNDE Nefes-i Rahmânî var, çünkü sıra keyfi değil: harfler
  // nefesin boğazdan dudağa uzanan yolunda ayrışıyor ve Dost'a göre varlık
  // mertebeleri de aynı güzergâhı izliyor ("Hebâ dördüncü mertebededir;
  // nitekim Ha harfi de nefeste dördüncü mahreçtedir"). İlk menzilden İlk
  // Akıl, sonuncudan insan ve mertebelerin tayini çıkıyor; çember başına
  // kapanıyor (bkz. "daire ve merkez" ilkesi).
  //
  // Salt vanilla D3 + SVG; yeni bağımlılık yok.
  // ============================================================================

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = d3.select("#menziller-graph");
  const svgNode = svg.node();
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const tooltip = document.getElementById("menziller-tooltip");
  const wrapEl = document.getElementById("menziller-wrap");

  function tt(dict) { return I18n.pick3(dict || {}); }
  function getVar(n) { return GU.getVar(n); }
  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

  let data = null, dataPromise = null;
  let nodes = [];
  let zoomLayer, spinLayer, ringLayer, nodeLayer, centerLayer, defs;
  let zoomBehavior = null;
  let width = 900, height = 640, cx = 450, cy = 320, ringR = 240;
  let rafId = null, lastTs = 0, spin = 0, hoveredId = null, activeId = null;

  // Sakin, huzurlu dönüş -- öteki graflarla aynı hız ailesinden (~140 sn/tur).
  const SPIN_RATE = 0.000045;

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("menziller-wrap");
    dataPromise = GU.fetchJson("data/ibn-arabi/menziller.json")
      .then((d) => {
        data = d;
        if (window.DostViewStatus) window.DostViewStatus.hide("menziller-wrap");
        return d;
      })
      .catch((err) => {
        console.error("Menziller verisi yüklenemedi / Failed to load mansions data", err);
        dataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("menziller-wrap", () => window.__menzillerApp.activate());
      });
    return dataPromise;
  }

  // Harfin nefesteki sırası (boğazdan dudağa) rengi belirliyor: içerideki
  // mahreçler koyu, dudağa yaklaştıkça açılıyor. Renk bir süs değil, metnin
  // kendi iddiasının görünür hâli.
  function hueFor(i) {
    const t = i / 27;
    const h = 210 - 175 * t;             // derin mavi -> sıcak amber
    const sat = 52;
    const l = GU.isDark() ? 56 + 6 * t : 42 + 6 * t;
    return `hsl(${h.toFixed(0)}, ${sat}%, ${l.toFixed(0)}%)`;
  }

  function layout() {
    width = svgNode.clientWidth || 900;
    height = svgNode.clientHeight || 640;
    cx = width / 2; cy = height / 2;
    ringR = Math.max(120, Math.min(width, height) / 2 - (Math.min(width, height) < 620 ? 74 : 96));
    nodes.forEach((n, i) => {
      const a = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2;
      n.angle = a;
      n.x = cx + ringR * Math.cos(a);
      n.y = cy + ringR * Math.sin(a);
    });
  }

  function buildDom() {
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");
    defs = svg.append("defs");
    nodes.forEach((n, i) => {
      const c = d3.color(hueFor(i)) || d3.color("#888");
      const rg = defs.append("radialGradient").attr("id", "menzil-sphere-" + n.sira)
        .attr("cx", "38%").attr("cy", "32%").attr("r", "72%");
      rg.append("stop").attr("offset", "0%").attr("stop-color", c.brighter(0.55).formatHex());
      rg.append("stop").attr("offset", "52%").attr("stop-color", c.formatHex());
      rg.append("stop").attr("offset", "100%").attr("stop-color", c.darker(0.85).formatHex());
    });

    zoomLayer = svg.append("g").attr("class", "menziller-canvas");
    ringLayer = zoomLayer.append("g").attr("class", "menziller-ringlayer");
    spinLayer = zoomLayer.append("g").attr("class", "menziller-spin");
    nodeLayer = spinLayer.append("g").attr("class", "menziller-nodes");
    centerLayer = zoomLayer.append("g").attr("class", "menziller-center");

    ringLayer.append("circle").attr("class", "menziller-ring-path");
    centerLayer.append("circle").attr("class", "node-halo").attr("r", 46);
    centerLayer.append("text").attr("class", "menziller-center__label").attr("text-anchor", "middle").attr("y", -4);
    centerLayer.append("text").attr("class", "menziller-center__sub").attr("text-anchor", "middle").attr("y", 15);

    zoomBehavior = GU.createZoomBehavior(svg, zoomLayer, [0.5, 3], (event) => !event.target.closest(".node"));

    const rc = document.getElementById("menziller-recenter");
    if (rc && !rc.dataset.wiredMenziller) {
      rc.dataset.wiredMenziller = "1";
      rc.addEventListener("click", () => { activeId = null; showIntro(); fitView(true); });
    }
    svg.on("click", () => { if (activeId) { activeId = null; showIntro(); ensureFrame(); } });
  }

  function render(ts) {
    if (!nodeLayer) return;
    const deg = spin * 180 / Math.PI;

    ringLayer.select("circle.menziller-ring-path")
      .attr("cx", cx).attr("cy", cy).attr("r", ringR);

    centerLayer.attr("transform", `translate(${cx},${cy})`);
    centerLayer.select(".menziller-center__label").text(tt(data.center.baslik));
    centerLayer.select(".menziller-center__sub").text("28");

    const gsel = nodeLayer.selectAll("g.menzil-node").data(nodes, (n) => n.sira);
    const enter = gsel.enter().append("g")
      .attr("class", "node menzil-node")
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (n) => `${n.sira}. ${n.menzil}`)
      .on("click", (e, n) => { e.stopPropagation(); openMenzil(n); })
      .on("keydown", (e, n) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openMenzil(n); } })
      .on("pointerenter", (e, n) => { hoveredId = n.sira; showTooltip(n, e); ensureFrame(); })
      .on("pointermove", (e) => moveTooltip(e))
      .on("pointerleave", () => { hoveredId = null; hideTooltip(); ensureFrame(); })
      .on("focus", (e, n) => { hoveredId = n.sira; showTooltip(n, e); })
      .on("blur", () => { hoveredId = null; hideTooltip(); });
    enter.append("circle").attr("class", "menzil-node__glow");
    enter.append("circle").attr("class", "menzil-node__sphere").attr("fill", (n) => `url(#menzil-sphere-${n.sira})`);
    enter.append("text").attr("class", "menzil-node__harf").attr("text-anchor", "middle");
    enter.append("text").attr("class", "menzil-node__label").attr("text-anchor", "middle");
    const merged = enter.merge(gsel);
    gsel.exit().remove();

    merged.each(function (n) {
      const g = d3.select(this);
      const isActive = activeId === n.sira;
      const isHover = hoveredId === n.sira;
      const breath = reduceMotion ? 1 : 1 + 0.02 * Math.sin(ts / 3000 + n.sira);
      const r = (isActive ? 17 : 13) * breath * (isHover ? 1.08 : 1);
      g.attr("transform", `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`)
        .style("opacity", activeId && !isActive ? 0.42 : 1);
      g.select(".menzil-node__glow").attr("r", r * 1.9)
        .style("fill", hueFor(n.sira - 1))
        .style("opacity", (isActive ? 0.42 : 0.15) * (isHover ? 1.6 : 1));
      g.select(".menzil-node__sphere").attr("r", r);
      // Halka döndüğü için harf ve etiketi kendi noktaları etrafında ters
      // çevirip dik tutuyoruz.
      g.select(".menzil-node__harf")
        .attr("y", 4).attr("transform", `rotate(${(-deg).toFixed(2)},0,4)`)
        .text(n.harfArapca);
      g.select(".menzil-node__label")
        .attr("y", r + 14).attr("transform", `rotate(${(-deg).toFixed(2)},0,${(r + 14).toFixed(1)})`)
        .classed("menzil-node__label--active", isActive)
        .text(n.menzil);
    });

    spinLayer.attr("transform", `rotate(${deg.toFixed(2)},${cx.toFixed(1)},${cy.toFixed(1)})`);
  }

  function ensureFrame() { if (rafId == null) rafId = requestAnimationFrame(frame); }
  function frame(ts) {
    rafId = null;
    if (!GU.isViewActive(wrapEl)) { lastTs = 0; return; }
    const dt = lastTs ? Math.min(64, ts - lastTs) : 16; lastTs = ts;
    // Bir menzil açıkken durur: okurken sahne kıpırdamasın.
    if (!reduceMotion && !activeId) spin += dt * SPIN_RATE;
    render(ts);
    if (!reduceMotion) ensureFrame();
  }

  function visibleWidth() {
    if (!detailPanel || detailPanel.hidden) return width;
    const sr = svgNode.getBoundingClientRect();
    if (!sr.width) return width;
    const pr = detailPanel.getBoundingClientRect();
    if (!pr.width || pr.left >= sr.right) return width;
    const visiblePx = pr.left - sr.left;
    if (visiblePx < sr.width * 0.45) return width;
    return width * (visiblePx / sr.width);
  }

  // Sığdırma yarıçapı halkanın kendisi değil, etiketleriyle birlikte en dışa
  // taşan menzilin merkeze uzaklığı: "Fer'u'd-Delvi'l-Mukaddem" gibi uzun
  // adlar sadece ringR'e bakınca çerçevenin dışında kalıyordu. Her düğümün
  // kutusunun merkeze en uzak köşesini ölçtüğümüz için halka dönerken de
  // geçerli kalıyor.
  function contentRadius() {
    let maxR = ringR + 20;
    if (!nodeLayer) return maxR;
    nodeLayer.selectAll("g.menzil-node").each(function (n) {
      let b; try { b = this.getBBox(); } catch (e) { return; }
      const corner = Math.max(
        Math.hypot(b.x, b.y), Math.hypot(b.x + b.width, b.y),
        Math.hypot(b.x, b.y + b.height), Math.hypot(b.x + b.width, b.y + b.height));
      const d = Math.hypot(n.x - cx, n.y - cy) + corner;
      if (d > maxR) maxR = d;
    });
    return maxR;
  }

  function fitView(animate) {
    if (!zoomBehavior) return;
    const pad = 30;
    const vw = visibleWidth();
    const need = contentRadius() * 2 + pad * 2;
    const k = Math.max(0.5, Math.min(3, Math.min(vw / need, height / need)));
    const t = d3.zoomIdentity.translate(vw / 2 - k * cx, height / 2 - k * cy).scale(k);
    const sel = (animate && !reduceMotion) ? svg.transition().duration(450).ease(d3.easeCubicInOut) : svg;
    sel.call(zoomBehavior.transform, t);
  }

  function showTooltip(n, event) {
    if (!tooltip) return;
    tooltip.innerHTML =
      `<div class="node-hover-tip__title">${n.sira}. ${n.menzil}</div>` +
      `<div class="node-hover-tip__short">${tt(n.zuhur)}</div>` +
      `<div class="node-hover-tip__meta">${n.harf} ${n.harfArapca} · ${n.isim}</div>`;
    tooltip.hidden = false; moveTooltip(event);
  }
  function moveTooltip(event) { GU.moveTooltip(tooltip, wrapEl, event); }
  function hideTooltip() { GU.hideTooltip(tooltip); }

  // --- Detay paneli ---
  function rowHtml(label, value) {
    return `<div class="menzil-row"><span class="menzil-row__k">${label}</span><span class="menzil-row__v">${value}</span></div>`;
  }

  function openMenzil(n) {
    activeId = n.sira;
    const L = {
      harf: tt({ tr: "Harf", en: "Letter", pt: "Letra" }),
      isim: tt({ tr: "İlahi isim", en: "Divine name", pt: "Nome divino" }),
      zuhur: tt({ tr: "Bu menzilden zuhur eden", en: "What appears from this mansion", pt: "O que aparece desta mansão" }),
      kaynak: tt({ tr: "Kaynak", en: "Source", pt: "Fonte" }),
    };
    const varyant = n.varyant
      ? `<p class="menzil-varyant">${tt({ tr: "Bir diğer adı", en: "Also called", pt: "Também chamada" })}: ${n.varyant}</p>` : "";
    const notu = n.not
      ? `<div class="detail-analogy"><p class="detail-analogy__label">${tt({ tr: "Bir çekince", en: "A caveat", pt: "Uma ressalva" })}</p><p>${tt(n.not)}</p></div>` : "";
    detailContent.innerHTML = `
      <p class="detail-eyebrow"><button class="menzil-back-link" type="button">← ${tt({ tr: "Halkaya dön", en: "Back to the ring", pt: "Voltar ao anel" })}</button></p>
      <h2 class="detail-title">${n.sira}. ${n.menzil}</h2>
      ${varyant}
      <div class="menzil-rows">
        ${rowHtml(L.harf, `${n.harf} <span class="menzil-harf-ar">${n.harfArapca}</span>`)}
        ${rowHtml(L.isim, n.isim)}
      </div>
      <div class="detail-block detail-block--ibnarabi"><p class="menzil-zuhur__label">${L.zuhur}</p><p>${linkify(tt(n.zuhur), "menziller", String(n.sira))}</p></div>
      ${notu}
      <p class="menzil-kaynak">${L.kaynak}: ${n.kaynak}</p>`;
    detailContent.querySelector(".menzil-back-link").addEventListener("click", () => { activeId = null; showIntro(); ensureFrame(); });
    detailPanel.hidden = false;
    window.__dostNav && window.__dostNav.setHash("menziller", String(n.sira));
    ensureFrame();
  }

  function showIntro() {
    const notlar = (data.notlar || []).map((x) => `<li>${tt(x)}</li>`).join("");
    const kaynaklar = (data.sources || []).map((s) => `<li>${tt(s)}</li>`).join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Menziller", en: "The Mansions", pt: "As Mansões" })}</p>
      <h2 class="detail-title">${tt({ tr: "Yirmi Sekiz Ay Menzili", en: "The Twenty-Eight Mansions of the Moon", pt: "As Vinte e Oito Mansões da Lua" })}</h2>
      <div class="detail-block detail-block--ibnarabi"><p>${tt(data.intro)}</p></div>
      <div class="detail-block detail-block--ibnarabi"><p>${tt(data.center.not)}</p></div>
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Çekincelerimiz", en: "Our caveats", pt: "As nossas ressalvas" })}</p>
      <ul class="menzil-notlar">${notlar}</ul>
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Kaynak", en: "Sources", pt: "Fontes" })}</p>
      <ul class="menzil-notlar">${kaynaklar}</ul>`;
    detailPanel.hidden = false;
    window.__dostNav && window.__dostNav.setHash("menziller");
  }

  function build() {
    nodes = data.menziller.map((m) => Object.assign({}, m));
    layout();
    buildDom();
    render(performance.now());
    fitView(false);
    ensureFrame();
    window.addEventListener("resize", onResize);
  }

  function onResize() {
    if (!nodes.length || wrapEl.hidden) return;
    layout();
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    render(performance.now());
    fitView(false);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || wrapEl.hidden || !activeId) return;
    activeId = null; showIntro(); ensureFrame();
  });

  GU.onViewWake(() => { if (!wrapEl.hidden) ensureFrame(); });

  window.__menzillerApp = {
    activate() {
      fetchData().then((d) => {
        if (!d) return;
        if (!nodes.length) { build(); showIntro(); fitView(false); }
        else ensureFrame();
      });
    },
    goToNode(id) {
      fetchData().then((d) => {
        if (!d) return;
        if (!nodes.length) build();
        const n = nodes.find((x) => String(x.sira) === String(id));
        if (n) openMenzil(n); else showIntro();
      });
    },
    onLangChange() {
      if (!nodes.length) return;
      render(performance.now());
      const n = activeId ? nodes.find((x) => x.sira === activeId) : null;
      if (n) openMenzil(n);
      else if (detailPanel && !detailPanel.hidden) showIntro();
    },
  };
})();
