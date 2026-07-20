(function () {
  "use strict";

  const I18n = window.DostI18n;
  const svg = d3.select("#halka-i-vucud-graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const tooltip = document.getElementById("halka-i-vucud-tooltip");
  const wrapEl = document.getElementById("halka-i-vucud-wrap");

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

  let ontoData = null;
  let ontoDataPromise = null;
  let built = false;
  let nodeById = new Map();
  let edgeList = [];
  let zoomLayer, linkGroup, nodeGroup;
  let zoomBehavior;
  let currentDetailNode = null;
  let currentDetailEdge = null;
  let center = { x: 0, y: 0 };
  let fitPoints = [];

  function fetchData() {
    if (ontoDataPromise) return ontoDataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("halka-i-vucud-wrap");
    ontoDataPromise = fetch("data/ibn-arabi/ontology.json")
      .then((r) => r.json())
      .then((data) => {
        ontoData = data;
        if (window.DostViewStatus) window.DostViewStatus.hide("halka-i-vucud-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Halka-i Vücûd verisi yüklenemedi / Failed to load Ring of Being data", err);
        ontoDataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("halka-i-vucud-wrap", () => window.__halkaIVucudApp.activate());
      });
    return ontoDataPromise;
  }

  // Sarmalın kolu, verideki gerçek "descent" zincirini birebir izliyor:
  // dhat merkezde (r=0), sonra bu yedi durak sırayla dışa doğru açılıyor.
  // İnsan-ı Kâmil'in üç âlemden "gather" ile beslenmesi de bu yüzden zincirin
  // doğal bir devamı gibi okunuyor -- veri bunu zaten böyle kurmuş.
  const ARM_ORDER = ["sifat-asma", "ayan-sabite", "tecelli", "alem-ervah", "alem-misal", "alem-ecsam", "insan-i-kamil"];

  const NODE_COLOR_VAR = {
    "sifat-asma": "--series-halka-sifat",
    "ayan-sabite": "--series-halka-ayan",
    tecelli: "--series-halka-tecelli",
    "alem-ervah": "--series-halka-ervah",
    "alem-misal": "--series-halka-misal",
    "alem-ecsam": "--series-halka-ecsam",
    "insan-i-kamil": "--series-halka-insan",
    kalp: "--series-halka-kalp",
  };

  const NODE_RADIUS = {
    dhat: 27,
    "insan-i-kamil": 24,
    "sifat-asma": 16,
    "ayan-sabite": 16,
    tecelli: 16,
    "alem-ervah": 15,
    "alem-misal": 15,
    "alem-ecsam": 15,
    kalp: 11,
  };

  function getVar(name) {
    return window.DostGraphUtils.getVar(name);
  }

  function colorFor(n) {
    if (n.id === "dhat") return window.DostGraphUtils.ZAT_FILL;
    return getVar(NODE_COLOR_VAR[n.id] || "--series-halka-sifat");
  }

  function radiusFor(n) {
    return NODE_RADIUS[n.id] || 14;
  }

  function labelFor(n) {
    return I18n.pick3(n.name);
  }

  function layoutNodes(nodes, width, height) {
    center = { x: width / 2, y: height / 2 };
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const dhat = byId.get("dhat");
    dhat.x = center.x;
    dhat.y = center.y;
    dhat.__angle = 0;
    dhat.__r = 0;

    const minR = 100;
    const maxR = Math.max(190, Math.min(width, height) / 2 - 95);
    // Sarmalın 360°'nin biraz altında bırakılan boşluğu (kapanmayan bir
    // spiral -- bkz. "daire değil" ilkesi), bilhassa sol-altta duran lejant
    // paneliyle çakışmasın diye TAM O bölgeye denk getiriliyor.
    const startAngle = (-150 * Math.PI) / 180;
    const totalSweep = (280 * Math.PI) / 180;

    ARM_ORDER.forEach((id, i) => {
      const n = byId.get(id);
      const t = i / (ARM_ORDER.length - 1);
      const r = minR + t * (maxR - minR);
      const angle = startAngle + t * totalSweep;
      n.x = center.x + r * Math.cos(angle);
      n.y = center.y + r * Math.sin(angle);
      n.__angle = angle;
      n.__r = r;
    });

    // Kalp, sarmalın bir sonraki turu değil -- İnsan-ı Kâmil'in "tohum ve
    // mikrokozmosu" (bkz. edge nature metni), bu yüzden ayrı bir uzak durak
    // yerine İnsan-ı Kâmil'in hemen yanında küçük bir uydu olarak duruyor.
    const insan = byId.get("insan-i-kamil");
    const kalp = byId.get("kalp");
    const kalpAngle = insan.__angle + (32 * Math.PI) / 180;
    const kalpR = insan.__r + 58;
    kalp.x = center.x + kalpR * Math.cos(kalpAngle);
    kalp.y = center.y + kalpR * Math.sin(kalpAngle);
    kalp.__angle = kalpAngle;
    kalp.__r = kalpR;
  }

  function returnPath(s) {
    // Merkeze düz bir kirişle değil, dışından dolanıp bir üst turdan bağlanan
    // bir yayla dönüyor -- Hâller Haritası'ndaki aynı "daire değil, yükselen
    // spiral" ilkesinin buradaki karşılığı.
    const bowR = s.__r * 1.28 + 30;
    const dir = s.id === "kalp" ? 1 : -1;
    const bowAngle = s.__angle + dir * ((38 * Math.PI) / 180);
    const qx = center.x + bowR * Math.cos(bowAngle);
    const qy = center.y + bowR * Math.sin(bowAngle);
    return { d: `M${s.x},${s.y} Q${qx},${qy} ${center.x},${center.y}`, mid: { x: qx, y: qy } };
  }

  function gatherPath(s, t) {
    const mx = (s.x + t.x) / 2;
    const my = (s.y + t.y) / 2;
    const midAngle = Math.atan2(my - center.y, mx - center.x);
    const midR = Math.hypot(mx - center.x, my - center.y) + 16;
    const qx = center.x + midR * Math.cos(midAngle);
    const qy = center.y + midR * Math.sin(midAngle);
    return `M${s.x},${s.y} Q${qx},${qy} ${t.x},${t.y}`;
  }

  function pathFor(l) {
    if (l.kind === "return") return returnPath(l.source).d;
    if (l.kind === "gather") return gatherPath(l.source, l.target);
    return `M${l.source.x},${l.source.y} L${l.target.x},${l.target.y}`;
  }

  function buildGraph(data) {
    svg.selectAll("*").remove();

    const nodes = data.nodes.map((n) => Object.assign({}, n));
    nodeById = new Map(nodes.map((n) => [n.id, n]));
    edgeList = data.edges.map((e) => Object.assign({}, e, { source: nodeById.get(e.source), target: nodeById.get(e.target) }));

    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");

    layoutNodes(nodes, width, height);

    zoomLayer = svg.append("g").attr("class", "halka-canvas");
    linkGroup = zoomLayer.append("g").attr("class", "halka-links");
    nodeGroup = zoomLayer.append("g").attr("class", "halka-nodes");

    zoomBehavior = d3.zoom()
      .scaleExtent([0.4, 3])
      .filter((event) => {
        if (event.type === "wheel") return event.ctrlKey || event.metaKey;
        if (event.touches) return event.touches.length > 1;
        return true;
      })
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform));
    svg.call(zoomBehavior).on("dblclick.zoom", null);

    const recenterBtn = document.getElementById("halka-i-vucud-recenter");
    if (recenterBtn) recenterBtn.addEventListener("click", () => zoomToFit(true));

    linkGroup.selectAll("path.halka-link")
      .data(edgeList, (l) => l.source.id + "->" + l.target.id)
      .join("path")
      .attr("class", (l) => "halka-link halka-link--" + l.kind)
      .attr("d", pathFor)
      .style("cursor", "pointer")
      .style("pointer-events", "stroke")
      .on("click", (event, l) => {
        event.stopPropagation();
        selectEdge(l);
      });

    const returnEdges = edgeList.filter((l) => l.kind === "return");
    linkGroup.selectAll("text.halka-link--return-label")
      .data(returnEdges)
      .join("text")
      .attr("class", "halka-link--return-label")
      .attr("x", (l) => returnPath(l.source).mid.x)
      .attr("y", (l) => returnPath(l.source).mid.y)
      .text((l) => tt(l.relation));

    fitPoints = nodes.map((n) => ({ x: n.x, y: n.y }))
      .concat(returnEdges.map((l) => returnPath(l.source).mid));

    const nodeSel = nodeGroup.selectAll("g.halka-node")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("class", (d) => "node halka-node" + (d.id === "dhat" ? " halka-node--dhat" : ""))
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d) => labelFor(d))
      .on("click", (event, d) => {
        event.stopPropagation();
        selectNode(d);
      })
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          selectNode(d);
        }
      })
      .on("mouseenter", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => { highlight(null); hideTooltip(); })
      .on("focus", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("blur", () => { highlight(null); hideTooltip(); });

    nodeSel.append("circle")
      .attr("class", "halka-node__core")
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    nodeSel.append("circle")
      .attr("class", "node-sheen")
      .attr("r", (d) => radiusFor(d));

    nodeSel.append("text")
      .attr("class", "node-label")
      .attr("dy", (d) => radiusFor(d) + 13)
      .attr("text-anchor", "middle")
      .text((d) => labelFor(d));

    svg.on("click", () => { highlight(null); });

    built = true;
    zoomToFit(false);
  }

  function zoomToFit(animate) {
    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    fitPoints.forEach((p) => {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    });
    x0 -= 70; x1 += 70; y0 -= 60; y1 += 70;
    const boxW = Math.max(1, x1 - x0);
    const boxH = Math.max(1, y1 - y0);
    const [minScale, maxScale] = zoomBehavior.scaleExtent();
    const scale = Math.min(maxScale, width / boxW, height / boxH);
    const clampedScale = Math.max(minScale, scale);
    const tx = width / 2 - clampedScale * (x0 + boxW / 2);
    const ty = height / 2 - clampedScale * (y0 + boxH / 2);
    const transform = d3.zoomIdentity.translate(tx, ty).scale(clampedScale);
    const sel = animate ? svg.transition().duration(400) : svg;
    sel.call(zoomBehavior.transform, transform);
  }

  function highlight(d) {
    const nodeSel = nodeGroup.selectAll("g.halka-node");
    const linkSel = linkGroup.selectAll("path.halka-link");
    if (!d) {
      nodeSel.style("opacity", 1);
      linkSel.classed("halka-link--highlight", false);
      return;
    }
    nodeSel.style("opacity", (n) => (n.id === d.id ? 1 : 0.4));
    linkSel.classed("halka-link--highlight", (l) => l.source.id === d.id || l.target.id === d.id);
  }

  function showTooltip(d, event) {
    if (!tooltip) return;
    const short = I18n.pick3(d.short);
    tooltip.innerHTML = `
      <div class="node-hover-tip__title">${I18n.pick3(d.name)}</div>
      ${short ? `<div class="node-hover-tip__short">${short}</div>` : ""}
    `;
    tooltip.hidden = false;
    moveTooltip(event);
  }

  function moveTooltip(event) {
    window.DostGraphUtils.moveTooltip(tooltip, wrapEl, event);
  }

  function hideTooltip() {
    window.DostGraphUtils.hideTooltip(tooltip);
  }

  // Aynı hacim/kaynak eşleme mantığı ontology.js'te de var -- iki modül
  // birbirinden bağımsız çalışsın diye (hal.js'in kendi kopyasını tuttuğu
  // gibi) burada da küçük bir kopyası tutuluyor.
  const VOLUME_LABEL_OVERRIDE = {
    "fusus-konuk": { tr: "Füsûsu'l-Hikem", en: "Fusus al-Hikam", pt: "Fusus al-Hikam" },
    "izutsu-anahtar": { tr: "Anahtar-Kavramlar (İzutsu)", en: "Key Concepts (Izutsu)", pt: "Conceitos-Chave (Izutsu)" },
    "affifi-tasavvuf": { tr: "Tasavvuf Felsefesi (Affifi)", en: "The Mystical Philosophy (Affifi)", pt: "A Filosofia Mística (Affifi)" },
    "varlik-agaci": { tr: "Varlık Ağacı (Şeceretü'l-Kevn)", en: "The Tree of Being (Shajarat al-Kawn)", pt: "A Árvore do Ser (Shajarat al-Kawn)" },
    "ozun-ozu": { tr: "Özün Özü (Lübbü'l-Lübb)", en: "The Kernel of the Kernel (Lubb al-Lubb)", pt: "O Cerne do Cerne (Lubb al-Lubb)" },
    "tedbirat-konuk": { tr: "et-Tedbîrâtü'l-İlâhiyye (Konuk)", en: "et-Tadbirat al-Ilahiyya (Konuk)", pt: "et-Tadbirat al-Ilahiyya (Konuk)" },
    "risaleler-1": { tr: "İbn Arabî'nin Risaleleri, 1. Cild", en: "The Epistles of Ibn Arabi, Vol. 1", pt: "As Epístolas de Ibn Arabi, Vol. 1" },
    "risaleler-2": { tr: "İbn Arabî'nin Risaleleri, 2. Cild", en: "The Epistles of Ibn Arabi, Vol. 2", pt: "As Epístolas de Ibn Arabi, Vol. 2" },
    "el-bulga": { tr: "El-Bülga fi'l-Hikme", en: "Al-Bulgha fi'l-Hikma", pt: "Al-Bulgha fi'l-Hikma" },
  };

  const VOLUME_SOURCE_MATCH = {
    "fusus-konuk": "Fusûsu'l-Hikem Tercüme ve Şerhi (Ahmed Avni Konuk)",
    "izutsu-anahtar": "İbn Arabî'nin Fusûsu'ndaki Anahtar-Kavramlar (Toshihiko İzutsu",
    "affifi-tasavvuf": "Muhyiddîn İbnü'l-Arabî'nin Tasavvuf Felsefesi (A. E. Affifi",
    "varlik-agaci": "Şeceretü'l-Kevn / Varlık Ağacı",
    "tedbirat-konuk": "et-Tedbîrâtü'l-İlâhiyye",
    "ozun-ozu": "Özün Özü / Lübbü'l-Lübb",
    "risaleler-1": "İbn Arabî'nin Risaleleri, 1. Cild",
    "risaleler-2": "İbn Arabî'nin Risaleleri, 2. Cild",
    "el-bulga": "El-Bülga fi'l-Hikme",
  };

  function volumeLabel(n) {
    if (VOLUME_LABEL_OVERRIDE[n]) return tt(VOLUME_LABEL_OVERRIDE[n]);
    return tt({ tr: `Cilt ${n}`, en: `Volume ${n}`, pt: `Volume ${n}` });
  }

  function sourcesForInsight(ins, sources) {
    if (ins.source) return [ins.source];
    if (!sources || !sources.length) return [];
    const v = ins.volume;
    if (typeof v === "number") {
      const re = new RegExp(`Cilt ${v}\\b`);
      return sources.filter((s) => re.test(s));
    }
    if (VOLUME_SOURCE_MATCH[v]) return sources.filter((s) => s.includes(VOLUME_SOURCE_MATCH[v]));
    return [];
  }

  function insightsHtml(insights, sources, excludeView, excludeId) {
    if (!insights || !insights.length) return "";
    return `<div class="insight-group">${insights.map((ins, i) => {
      const cite = sourcesForInsight(ins, sources);
      return `
      <details class="insight" ${i === 0 ? "open" : ""}>
        <summary>${volumeLabel(ins.volume)}</summary>
        <p>${linkify(I18n.pick3(ins.text), excludeView, excludeId)}</p>
        ${cite.length ? `<cite>${cite.join(" · ")}</cite>` : ""}
      </details>
    `;
    }).join("")}</div>`;
  }

  function analogyHtml(analogy) {
    if (!analogy) return "";
    return `<div class="detail-analogy">
      <p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p>
      <p>${I18n.pick3(analogy)}</p>
    </div>`;
  }

  function relatedEdgesHtml(d) {
    const outgoing = edgeList.filter((l) => l.source.id === d.id);
    const incoming = edgeList.filter((l) => l.target.id === d.id);
    const rows = [...outgoing.map((l) => ({ l, dir: "out" })), ...incoming.map((l) => ({ l, dir: "in" }))];
    if (!rows.length) return "";
    const items = rows.map(({ l, dir }) => {
      const other = dir === "out" ? l.target : l.source;
      const arrow = dir === "out" ? "→" : "←";
      return `<div class="detail-block detail-block--edge">
        <h3>${arrow} ${I18n.pick3(other.name)} — <em>${I18n.pick3(l.relation)}</em></h3>
        <p>${linkify(I18n.pick3(l.nature), null, null)}</p>
        ${insightsHtml(l.insights, null, null, null)}
      </div>`;
    }).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlişkiler", en: "Relations", pt: "Relações" })}</p>${items}`;
  }

  function showDetail(d) {
    currentDetailNode = d;
    currentDetailEdge = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Halka-i Vücûd", en: "The Ring of Being", pt: "O Anel do Ser" })}</p>
      <h2 class="detail-title">${I18n.pick3(d.name)}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${I18n.pick3(d.short)}</h3>
        <p>${linkify(I18n.pick3(d.summary), "halka-i-vucud", d.id)}</p>
      </div>
      ${analogyHtml(d.analogy)}
      ${insightsHtml(d.insights, d.sources, "halka-i-vucud", d.id)}
      ${relatedEdgesHtml(d)}
    `;
    detailPanel.hidden = false;
    nodeGroup.selectAll("g.halka-node").classed("halka-node--active", (n) => n.id === d.id);
  }

  function showEdgeDetail(l) {
    currentDetailNode = null;
    currentDetailEdge = l;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${I18n.pick3(l.relation)}</p>
      <h2 class="detail-title">${I18n.pick3(l.source.name)} → ${I18n.pick3(l.target.name)}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <p>${linkify(I18n.pick3(l.nature), null, null)}</p>
        ${insightsHtml(l.insights, null, null, null)}
      </div>
    `;
    detailPanel.hidden = false;
    nodeGroup.selectAll("g.halka-node").classed("halka-node--active", false);
  }

  function selectNode(d) {
    window.dostTrack && window.dostTrack("bilgi_grafi_node_tiklandi", { id: d.id, view: "halka-i-vucud" });
    showDetail(d);
    window.__dostNav && window.__dostNav.setHash("halka-i-vucud", d.id);
  }

  function selectEdge(l) {
    showEdgeDetail(l);
  }

  function render() {
    if (!built || !ontoData) return;
    nodeGroup.selectAll("g.halka-node text.node-label").text((d) => labelFor(d));
    nodeGroup.selectAll("g.halka-node").attr("aria-label", (d) => labelFor(d));
    linkGroup.selectAll("text.halka-link--return-label").text((l) => tt(l.relation));
    if (currentDetailNode) showDetail(currentDetailNode);
    else if (currentDetailEdge) showEdgeDetail(currentDetailEdge);
  }

  window.__halkaIVucudApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        if (!built) buildGraph(data);
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        if (!built) buildGraph(data);
        const target = nodeById.get(id);
        if (target) selectNode(target);
      });
    },
    onLangChange() {
      render();
    },
  };
})();
