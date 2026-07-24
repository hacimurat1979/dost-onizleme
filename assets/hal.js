(function () {
  "use strict";

  // ============================================================================
  // Hâller Haritası — "manevi yükseliş yolculuğu"
  //
  // Nefs'ten Hayret'e uzanan bir seyahat; sonda aynı hâle ama bir üst turda
  // dönülür (daire değil, yükselen bir spiral — bkz. CLAUDE.md daire/merkez
  // ilkesi). Bu tasarımda düğümler düz daireler değil ışıyan küreler; yol düz
  // çizgiler değil, Hayret'e doğru parlaklaşan akan bir eğri; renkler keyfî
  // değil, arınma/yükseliş anlatan bir ilerleme (toprak kahvesi → bakır →
  // gümüşi → mavi → mor → çivit → altın). Açılışta yol Nefs'ten Hayret'e doğru
  // kendini çizer; her şey çok hafif nefes alır. Salt vanilla D3 (yeni
  // bağımlılık yok).
  // ============================================================================

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = d3.select("#hal-graph");
  const svgNode = svg.node();
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const tooltip = document.getElementById("hal-tooltip");
  const wrapEl = document.getElementById("hal-wrap");

  function tt(dict) { return I18n.pick3(dict || {}); }
  function getVar(n) { return GU.getVar(n); }
  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

  // --- Kilit taşları (milestone) daha büyük ve daha belirgin (#5). Hayret
  //     hepsinin zirvesi, en büyüğü (#15). ---
  const LANDMARK = new Set(["nefs", "cemfark", "fenabeka", "tevhit", "hayret"]);
  function baseRadius(n) {
    if (n.stage === "hayret") return 26;
    if (LANDMARK.has(n.stage)) return 19;
    return 12;
  }

  // Renk sistemi (#4): manevi ilerlemeyi anlatan bir geçiş. Aşamaların çıpa
  // renklerini (CSS değişkenleri) alıp düğüm sırasına göre yumuşakça
  // interpolе ediyoruz; ara "mu'âmele" düğümleri bakırdan maviye doğru
  // kademeli soğuyor (arınma).
  const STAGE_VAR = {
    nefs: "--series-hal-nefs",
    muameleler: "--series-hal-muameleler",
    cemfark: "--series-hal-cemfark",
    fenabeka: "--series-hal-fenabeka",
    tevhit: "--series-hal-tevhit",
    hayret: "--series-hal-hayret",
  };
  let journeyColor = null; // d3 scale, index -> color
  function buildColorScale(n) {
    journeyColor = d3.scaleLinear()
      .domain([0, 1, n - 4, n - 3, n - 2, n - 1])
      .range([
        getVar("--series-hal-nefs"),
        getVar("--series-hal-muameleler"),
        getVar("--series-hal-cemfark"),
        getVar("--series-hal-fenabeka"),
        getVar("--series-hal-tevhit"),
        getVar("--series-hal-hayret"),
      ])
      .interpolate(d3.interpolateRgb)
      .clamp(true);
  }
  function nodeColor(d) { return journeyColor ? journeyColor(d.__i) : getVar(STAGE_VAR[d.stage]); }
  function labelFor(n) { return I18n.pick3(n.name); }

  // ---------------------------------------------------------------------------
  let halData = null, halDataPromise = null, built = false;
  let orderedNodes = [], nodeById = new Map();
  let links = [], wrapCtrl = null;
  let zoomLayer, bgLayer, linkLayer, glowLayer, nodeLayer, defs;
  let zoomBehavior = null;
  let currentDetailNode = null, hoveredId = null;
  let rafId = null, startTs = 0, lastTs = 0, reveal = 1;
  let shimmer = [];
  let cx = 0, cy = 0;

  function fetchData() {
    if (halDataPromise) return halDataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("hal-wrap");
    halDataPromise = GU.fetchJson("data/ibn-arabi/hal.json")
      .then((data) => { halData = data; if (window.DostViewStatus) window.DostViewStatus.hide("hal-wrap"); return data; })
      .catch((err) => {
        console.error("Hâller verisi yüklenemedi / Failed to load States data", err);
        halDataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("hal-wrap", () => window.__halApp.activate());
      });
    return halDataPromise;
  }

  function buildOrderedChain(nodes) {
    const childOf = new Map();
    nodes.forEach((n) => { if (n.parent) childOf.set(n.parent, n); });
    const root = nodes.find((n) => !n.parent);
    const chain = []; let cur = root;
    while (cur) { chain.push(cur); cur = childOf.get(cur.id); }
    return chain;
  }

  // ---------------------------------------------------------------------------
  function layout() {
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 640;
    cx = w / 2; cy = h / 2;
    const n = orderedNodes.length;
    // Nazik spiral (#6): yarıçap yolculuk boyunca hafifçe genişliyor -- kapanan
    // bir daire değil, başa "bir üst turda" dönen yükselen bir sarmal. Daire/
    // merkez ilkesini korur ama ilerleme hissi verir.
    const base = Math.max(140, Math.min(w, h) / 2 - 120);
    const rOf = (i) => base * (0.80 + 0.24 * (i / (n - 1)));
    orderedNodes.forEach((node, i) => {
      const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
      node.__i = i;
      node.__ang = ang;
      node.__r = rOf(i);
      node.x = cx + node.__r * Math.cos(ang);
      node.y = cy + node.__r * Math.sin(ang);
      node.__phase = i * 0.7;
    });
    // Dönüş yayı: halkanın DIŞINDAN geçip başa bağlanan altın eğri.
    const wrapMid = -Math.PI / 2 + ((n - 0.5) / n) * Math.PI * 2;
    const wrapBow = rOf(n - 1) * 1.32;
    wrapCtrl = { x: cx + wrapBow * Math.cos(wrapMid), y: cy + wrapBow * Math.sin(wrapMid) };
  }

  // Ardışık iki hâl arasındaki akan eğri (#2): halkanın eğrisini izleyen,
  // dışa doğru nazikçe kavisli bir bezier -- çokgen değil, sürekli bir yol.
  function segPath(s, t) {
    const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
    const mang = Math.atan2(my - cy, mx - cx);
    const mr = Math.hypot(mx - cx, my - cy);
    const bow = Math.min(34, Math.hypot(t.x - s.x, t.y - s.y) * 0.14);
    const ccx = cx + (mr + bow) * Math.cos(mang), ccy = cy + (mr + bow) * Math.sin(mang);
    return `M${s.x.toFixed(1)},${s.y.toFixed(1)} Q${ccx.toFixed(1)},${ccy.toFixed(1)} ${t.x.toFixed(1)},${t.y.toFixed(1)}`;
  }

  function isMajor(l) {
    // Büyük dönüşümler: bir kilit taşına (cemfark/fenabeka/tevhit/hayret) giriş.
    return LANDMARK.has(l.target.stage) && l.target.stage !== "nefs";
  }

  // ---------------------------------------------------------------------------
  function buildDom() {
    svg.selectAll("*").remove();
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 640;
    svg.attr("viewBox", `0 0 ${w} ${h}`).attr("preserveAspectRatio", "xMidYMid meet");

    defs = svg.append("defs");
    // dönüş oku
    defs.append("marker").attr("id", "hal-arrow-return").attr("viewBox", "0 -5 10 10")
      .attr("refX", 8).attr("refY", 0).attr("markerWidth", 6.5).attr("markerHeight", 6.5)
      .attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5")
      .attr("fill", getVar("--series-hal-hayret"));
    // yumuşak parıltı filtresi (ambient, glossy değil)
    const glow = defs.append("filter").attr("id", "hal-glow").attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
    glow.append("feGaussianBlur").attr("stdDeviation", "3.4");

    zoomLayer = svg.append("g").attr("class", "hal-canvas");
    bgLayer = zoomLayer.append("g").attr("class", "hal-bg");
    linkLayer = zoomLayer.append("g").attr("class", "hal-links");
    glowLayer = zoomLayer.append("g").attr("class", "hal-glows");
    nodeLayer = zoomLayer.append("g").attr("class", "hal-nodes");

    // her düğüm için ışıyan küre gradyanı (#3)
    orderedNodes.forEach((d) => {
      const c = d3.color(nodeColor(d)) || d3.color("#888");
      const rg = defs.append("radialGradient").attr("id", "hal-sphere-" + d.id).attr("cx", "38%").attr("cy", "32%").attr("r", "72%");
      rg.append("stop").attr("offset", "0%").attr("stop-color", c.brighter(1.15).formatHex());
      rg.append("stop").attr("offset", "45%").attr("stop-color", c.formatHex());
      rg.append("stop").attr("offset", "100%").attr("stop-color", c.darker(0.9).formatHex());
    });

    zoomBehavior = GU.createZoomBehavior(svg, zoomLayer, [0.4, 3]);

    const rc = document.getElementById("hal-recenter");
    if (rc && !rc.dataset.wiredHal) { rc.dataset.wiredHal = "1"; rc.addEventListener("click", () => { clearFocus(); fitView(true); }); }
    svg.on("click", () => { if (currentDetailNode) clearFocus(); });
    if (!document.body.dataset.wiredHalEsc) {
      document.body.dataset.wiredHalEsc = "1";
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (wrapEl.hidden) return;
        if (currentDetailNode) clearFocus();
      });
    }
  }

  function initShimmer() {
    shimmer = [];
    if (reduceMotion) return;
    const hay = orderedNodes.find((d) => d.stage === "hayret");
    if (!hay) return;
    for (let i = 0; i < 10; i++) shimmer.push({ a: Math.random() * 6.28, sp: 0.0004 + Math.random() * 0.0006, rr: 20 + Math.random() * 16, ph: Math.random() * 6.28 });
  }

  // ---------------------------------------------------------------------------
  function ensureFrame() { if (rafId == null) { lastTs = performance.now(); rafId = requestAnimationFrame(frame); } }
  function frame(ts) {
    rafId = null;
    if (!startTs) startTs = ts;
    if (reveal < 1 && !reduceMotion) reveal = Math.min(1, (ts - startTs) / 2000);
    else if (reduceMotion) reveal = 1;
    render(ts);
    // nefes + shimmer sürekli; reveal biterse yine de hafif ambient sürsün
    if (!reduceMotion) ensureFrame(); else rafId = null;
  }

  function focusSet() {
    const anchor = hoveredId || (currentDetailNode ? currentDetailNode.id : null);
    if (!anchor) return null;
    const i = nodeById.get(anchor).__i;
    const set = new Set([anchor]);
    if (i > 0) set.add(orderedNodes[i - 1].id);
    if (i < orderedNodes.length - 1) set.add(orderedNodes[i + 1].id);
    // dönüş bağı: nefs<->hayret komşuluğu
    if (orderedNodes[i].stage === "hayret") set.add(orderedNodes[0].id);
    if (orderedNodes[i].stage === "nefs") set.add(orderedNodes[orderedNodes.length - 1].id);
    return { anchor, set };
  }

  function breath(d, ts) {
    if (reduceMotion) return { s: 1, dx: 0, dy: 0 };
    const isHay = d.stage === "hayret";
    const s = 1 + (isHay ? 0.035 : 0.02) * Math.sin(ts / (isHay ? 5200 : 3000) + d.__phase);
    // çok hafif salınım (1-2px) (#20)
    const dx = 1.4 * Math.sin(ts / 3400 + d.__phase);
    const dy = 1.4 * Math.cos(ts / 3900 + d.__phase * 1.3);
    return { s, dx, dy };
  }

  function render(ts) {
    if (!nodeLayer) return;
    const foc = focusSet();

    // --- yol segmentleri (#2, #7) : akan, Hayret'e doğru parlaklaşan eğri ---
    const segData = links.filter((l) => !l.wrap);
    const segSel = linkLayer.selectAll("path.hal-seg").data(segData, (l) => l.source.id + ">" + l.target.id);
    segSel.enter().append("path").attr("class", "hal-seg").attr("fill", "none").merge(segSel)
      .each(function (l) {
        const p = d3.select(this);
        const major = isMajor(l);
        // parlaklık yolculuk boyunca artar
        const t = l.target.__i / (orderedNodes.length - 1);
        let op = (0.32 + 0.5 * t);
        let wdt = major ? 3.0 : 1.6;
        if (foc) op = (foc.set.has(l.source.id) && foc.set.has(l.target.id)) ? 0.95 : 0.08;
        // açılış: segment sırası geldiğinde belirir (#10)
        const appear = Math.max(0, Math.min(1, (reveal * (orderedNodes.length + 1) - l.target.__i)));
        p.attr("d", segPath(l.source, l.target))
          .style("stroke", journeyColor(l.target.__i))
          .style("stroke-width", wdt)
          .classed("hal-seg--major", major)
          .style("opacity", op * appear);
      });
    segSel.exit().remove();

    // --- dönüş yayı (altın, ışıltılı) (#7) ---
    const n = orderedNodes.length;
    const wrapSel = linkLayer.selectAll("path.hal-return").data([links[links.length - 1]]);
    wrapSel.enter().append("path").attr("class", "hal-return").attr("fill", "none").attr("marker-end", "url(#hal-arrow-return)").merge(wrapSel)
      .attr("d", (l) => `M${l.source.x.toFixed(1)},${l.source.y.toFixed(1)} Q${wrapCtrl.x.toFixed(1)},${wrapCtrl.y.toFixed(1)} ${l.target.x.toFixed(1)},${l.target.y.toFixed(1)}`)
      .style("opacity", (foc ? (foc.set.has(orderedNodes[0].id) && foc.set.has(orderedNodes[n - 1].id) ? 1 : 0.12) : 0.85) * (reveal >= 0.99 ? 1 : Math.max(0, reveal * 3 - 2)));

    // dönüş etiketi
    const lblSel = linkLayer.selectAll("text.hal-return-label").data([wrapCtrl]);
    lblSel.enter().append("text").attr("class", "hal-return-label").attr("text-anchor", "middle").merge(lblSel)
      .attr("x", (d) => d.x).attr("y", (d) => d.y - 8)
      .style("opacity", foc ? 0.25 : 0.85 * (reveal >= 0.99 ? 1 : 0))
      .text(tt({ tr: "→ aynı hâl, bir üst turda", en: "→ same state, a turn higher", pt: "→ mesmo estado, um giro acima" }));

    // --- düğümler + parıltı ---
    const gsel = nodeLayer.selectAll("g.hal-node").data(orderedNodes, (d) => d.id);
    const enter = gsel.enter().append("g")
      .attr("class", (d) => "node hal-node hal-node--" + d.stage)
      .attr("tabindex", 0).attr("role", "button").attr("aria-label", (d) => labelFor(d))
      .on("click", (e, d) => { e.stopPropagation(); selectNode(d); })
      .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); selectNode(d); } })
      .on("pointerenter", (e, d) => { setHover(d.id); showTooltip(d, e); })
      .on("pointermove", (e) => moveTooltip(e))
      .on("pointerleave", () => { setHover(null); hideTooltip(); })
      .on("focus", (e, d) => { setHover(d.id); showTooltip(d, e); })
      .on("blur", () => { setHover(null); hideTooltip(); });
    enter.append("circle").attr("class", "hal-glow");
    enter.append("circle").attr("class", "hal-halo");
    enter.append("circle").attr("class", "hal-sphere").attr("fill", (d) => `url(#hal-sphere-${d.id})`);
    enter.append("circle").attr("class", "hal-sheen");
    enter.append("text").attr("class", "hal-label").attr("text-anchor", "middle");
    const merged = enter.merge(gsel);
    gsel.exit().remove();

    merged.each(function (d) {
      const g = d3.select(this);
      const b = breath(d, ts);
      const r = baseRadius(d) * b.s;
      // açılış: düğümler sırayla belirir (#10)
      let appear = 1;
      if (reveal < 1 && !reduceMotion) {
        const thr = d.__i / (orderedNodes.length + 1);
        appear = Math.max(0, Math.min(1, (reveal - thr) / 0.12));
      }
      let op = appear;
      const isAnchor = foc && d.id === foc.anchor;
      if (foc && !foc.set.has(d.id)) op *= 0.22; // focus mode (#19): ilgisiz düğümler soluk
      g.style("opacity", op).style("display", op < 0.02 ? "none" : null)
        .attr("transform", `translate(${(d.x + b.dx).toFixed(1)},${(d.y + b.dy).toFixed(1)})`);
      g.classed("hal-node--active", currentDetailNode && d.id === currentDetailNode.id);
      const col = nodeColor(d);
      // dış parıltı (Hayret en güçlü) (#3,#15)
      const gstr = d.stage === "hayret" ? 1 : LANDMARK.has(d.stage) ? 0.62 : 0.4;
      const flick = reduceMotion ? 1 : (0.85 + 0.15 * Math.sin(ts / 2200 + d.__phase));
      g.select(".hal-glow").attr("r", r * 1.85).style("fill", col)
        .style("opacity", (d.stage === "hayret" ? 0.32 : 0.16) * gstr * flick * (isAnchor ? 1.5 : 1));
      // aktif halo
      const halo = g.select(".hal-halo");
      if (isAnchor) {
        const puls = reduceMotion ? 1 : (1 + 0.12 * Math.sin(ts / 900));
        halo.attr("r", (r + 7) * puls).style("stroke", col).style("opacity", 0.5);
      } else halo.style("opacity", 0);
      g.select(".hal-sphere").attr("r", r);
      g.select(".hal-sheen").attr("r", r);
      const lbl = g.select(".hal-label");
      lbl.attr("y", r + (d.stage === "hayret" ? 20 : LANDMARK.has(d.stage) ? 16 : 13))
        .classed("hal-label--landmark", LANDMARK.has(d.stage))
        .classed("hal-label--peak", d.stage === "hayret")
        .classed("hal-label--strong", isAnchor)
        .text(labelFor(d));
    });

    // --- Hayret shimmer parçacıkları (#15) ---
    if (!reduceMotion && shimmer.length) {
      const hay = orderedNodes.find((x) => x.stage === "hayret");
      const b = breath(hay, ts);
      const hx = hay.x + b.dx, hy = hay.y + b.dy, hr = baseRadius(hay) * b.s;
      shimmer.forEach((p) => { p.a += p.sp * 16; });
      const sh = glowLayer.selectAll("circle.hal-shimmer").data(shimmer);
      sh.enter().append("circle").attr("class", "hal-shimmer").attr("r", 1.1).merge(sh)
        .attr("cx", (p) => (hx + (hr + p.rr) * Math.cos(p.a)).toFixed(1))
        .attr("cy", (p) => (hy + (hr + p.rr) * Math.sin(p.a)).toFixed(1))
        .style("opacity", (p) => (0.15 + 0.35 * Math.abs(Math.sin(ts / 1400 + p.ph))) * reveal);
      sh.exit().remove();
    }
  }

  // ---------------------------------------------------------------------------
  function setHover(id) { if (hoveredId === id) return; hoveredId = id; ensureFrame(); }
  function clearFocus() { currentDetailNode = null; hoveredId = null; detailPanel.hidden = true; ensureFrame(); }

  function fitView(animate) {
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 640;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    orderedNodes.forEach((d) => { x0 = Math.min(x0, d.x); x1 = Math.max(x1, d.x); y0 = Math.min(y0, d.y); y1 = Math.max(y1, d.y); });
    if (wrapCtrl) { x0 = Math.min(x0, wrapCtrl.x); x1 = Math.max(x1, wrapCtrl.x); y0 = Math.min(y0, wrapCtrl.y); y1 = Math.max(y1, wrapCtrl.y); }
    x0 -= 74; x1 += 74; y0 -= 64; y1 += 74;
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
    const [mn, mx] = zoomBehavior.scaleExtent();
    const k = Math.max(mn, Math.min(mx, Math.min(w / bw, h / bh)));
    const t = d3.zoomIdentity.translate(w / 2 - k * (x0 + bw / 2), h / 2 - k * (y0 + bh / 2)).scale(k);
    const sel = (animate && !reduceMotion) ? svg.transition().duration(500).ease(d3.easeCubicInOut) : svg;
    sel.call(zoomBehavior.transform, t);
  }

  function showTooltip(d, event) {
    if (!tooltip) return;
    const short = I18n.pick3(d.short);
    tooltip.innerHTML = `<div class="node-hover-tip__title">${I18n.pick3(d.name)}</div>${short ? `<div class="node-hover-tip__short">${short}</div>` : ""}`;
    tooltip.hidden = false; moveTooltip(event);
  }
  function moveTooltip(event) { GU.moveTooltip(tooltip, wrapEl, event); }
  function hideTooltip() { GU.hideTooltip(tooltip); }

  // --- Editorial detay paneli (#12,#13) ---
  function insightsHtml(insights, excludeId) {
    if (!insights || !insights.length) return "";
    return `<div class="insight-group">${insights.map((ins, i) => `
      <details class="insight" ${i === 0 ? "open" : ""}>
        <summary>${I18n.pick3(ins.label)}</summary>
        <p>${linkify(I18n.pick3(ins.text), "hal", excludeId)}</p>
        <cite>${ins.cite}</cite>
      </details>`).join("")}</div>`;
  }
  function relatedStepsHtml(d) {
    const idx = d.__i, rows = [];
    if (idx > 0) rows.push({ other: orderedNodes[idx - 1], arrow: "←" });
    if (idx < orderedNodes.length - 1) rows.push({ other: orderedNodes[idx + 1], arrow: "→" });
    if (!rows.length) return "";
    const items = rows.map(({ other, arrow }) => `
      <div class="detail-block detail-block--edge">
        <h3>${arrow} ${I18n.pick3(other.name)}</h3>
        <p>${I18n.pick3(other.short)}</p>
      </div>`).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Basamak Sırası", en: "Sequence", pt: "Sequência" })}</p>${items}`;
  }
  function analogyHtml(analogy) {
    if (!analogy) return "";
    return `<div class="detail-analogy"><p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p><p>${I18n.pick3(analogy)}</p></div>`;
  }
  function showDetail(d) {
    currentDetailNode = d;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Hâller", en: "States", pt: "Estados" })}</p>
      <h2 class="detail-title">${I18n.pick3(d.name)}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${I18n.pick3(d.short)}</h3>
        <p>${linkify(I18n.pick3(d.summary), "hal", d.id)}</p>
      </div>
      ${analogyHtml(d.analogy)}
      ${insightsHtml(d.insights, d.id)}
      ${relatedStepsHtml(d)}`;
    detailPanel.hidden = false;
    ensureFrame();
  }

  function selectNode(d) {
    showDetail(d);
    window.__dostNav && window.__dostNav.setHash("hal", d.id);
  }

  // ---------------------------------------------------------------------------
  function buildGraph(data) {
    orderedNodes = buildOrderedChain(data.nodes);
    nodeById = new Map(orderedNodes.map((n) => [n.id, n]));
    orderedNodes.forEach((n, i) => { n.__i = i; });
    buildColorScale(orderedNodes.length);
    layout();
    links = [];
    for (let i = 0; i < orderedNodes.length - 1; i++) links.push({ source: orderedNodes[i], target: orderedNodes[i + 1], wrap: false });
    links.push({ source: orderedNodes[orderedNodes.length - 1], target: orderedNodes[0], wrap: true });
    buildDom();
    initShimmer();
    built = true;
    reveal = reduceMotion ? 1 : 0;
    startTs = 0;
    render(performance.now());
    fitView(false);
    ensureFrame();
    window.addEventListener("resize", onResize);
  }

  function onResize() {
    if (!built || wrapEl.hidden) return;
    const w = svgNode.clientWidth || 900, h = svgNode.clientHeight || 640;
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    layout();
    render(performance.now());
    fitView(false);
  }

  function render_relabel() {
    if (!built) return;
    // dil değişince renk skalası ve etiketler tazelensin
    buildColorScale(orderedNodes.length);
    render(performance.now());
    if (currentDetailNode) showDetail(currentDetailNode);
  }

  window.__halApp = {
    activate() { fetchData().then((data) => { if (!data) return; if (!built) buildGraph(data); else ensureFrame(); }); },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        if (!built) buildGraph(data);
        const target = nodeById.get(id);
        if (target) selectNode(target);
      });
    },
    onLangChange() { render_relabel(); },
  };
})();
