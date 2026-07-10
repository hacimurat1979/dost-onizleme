(function () {
  "use strict";

  const I18n = window.DostI18n;
  const svg = d3.select("#hal-graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const tooltip = document.getElementById("hal-tooltip");
  const wrapEl = document.getElementById("hal-wrap");

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

  let halData = null;
  let halDataPromise = null;
  let built = false;
  let orderedNodes = [];
  let nodeById = new Map();
  let zoomLayer, linkGroup, nodeGroup;
  let zoomBehavior;
  let currentDetailNode = null;

  function fetchData() {
    if (halDataPromise) return halDataPromise;
    halDataPromise = fetch("data/ibn-arabi/hal.json")
      .then((r) => r.json())
      .then((data) => {
        halData = data;
        return data;
      })
      .catch((err) => {
        console.error("Hâller verisi yüklenemedi / Failed to load States data", err);
        halDataPromise = null;
      });
    return halDataPromise;
  }

  const LANDMARK_STAGES = new Set(["nefs", "cemfark", "fenabeka", "tevhit", "hayret"]);

  function radiusFor(n) {
    return LANDMARK_STAGES.has(n.stage) ? 20 : 13;
  }

  const STAGE_COLOR = {
    nefs: "--series-hal-nefs",
    muameleler: "--series-hal-muameleler",
    cemfark: "--series-hal-cemfark",
    fenabeka: "--series-hal-fenabeka",
    tevhit: "--series-hal-tevhit",
    hayret: "--series-hal-hayret",
  };

  function getVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function colorFor(n) {
    return getVar(STAGE_COLOR[n.stage] || "--series-hal-nefs");
  }

  function labelFor(n) {
    return I18n.pick3(n.name);
  }

  function buildOrderedChain(nodes) {
    const childOf = new Map();
    nodes.forEach((n) => {
      if (n.parent) childOf.set(n.parent, n);
    });
    const root = nodes.find((n) => !n.parent);
    const chain = [];
    let cur = root;
    while (cur) {
      chain.push(cur);
      cur = childOf.get(cur.id);
    }
    return chain;
  }

  function buildGraph(data) {
    svg.selectAll("*").remove();

    orderedNodes = buildOrderedChain(data.nodes);
    nodeById = new Map(orderedNodes.map((n) => [n.id, n]));

    zoomLayer = svg.append("g").attr("class", "hal-canvas");
    linkGroup = zoomLayer.append("g").attr("class", "hal-links");
    nodeGroup = zoomLayer.append("g").attr("class", "hal-nodes");

    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(120, Math.min(width, height) / 2 - 110);
    const n = orderedNodes.length;
    orderedNodes.forEach((node, i) => {
      const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
      node.x = cx + radius * Math.cos(angle);
      node.y = cy + radius * Math.sin(angle);
    });

    zoomBehavior = d3.zoom()
      .scaleExtent([0.4, 3])
      .filter((event) => {
        if (event.type === "wheel") return event.ctrlKey || event.metaKey;
        if (event.touches) return event.touches.length > 1;
        return true;
      })
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform));
    svg.call(zoomBehavior).on("dblclick.zoom", null);

    const recenterBtn = document.getElementById("hal-recenter");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", () => zoomToFit(true));
    }

    const links = [];
    for (let i = 0; i < n - 1; i++) {
      links.push({ source: orderedNodes[i], target: orderedNodes[i + 1], wrap: false });
    }
    links.push({ source: orderedNodes[n - 1], target: orderedNodes[0], wrap: true });

    const linkGen = (l) => {
      if (l.wrap) {
        return `M${l.source.x},${l.source.y} Q${cx},${cy} ${l.target.x},${l.target.y}`;
      }
      return `M${l.source.x},${l.source.y} L${l.target.x},${l.target.y}`;
    };

    linkGroup.selectAll("path.hal-link")
      .data(links, (l) => l.source.id + "->" + l.target.id)
      .join("path")
      .attr("class", (l) => "hal-link" + (l.wrap ? " hal-link--return" : ""))
      .attr("d", linkGen);

    const nodeSel = nodeGroup.selectAll("g.hal-node")
      .data(orderedNodes, (d) => d.id)
      .join("g")
      .attr("class", "node hal-node")
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
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    nodeSel.append("text")
      .attr("class", "node-label")
      .attr("dy", (d) => radiusFor(d) + 13)
      .attr("text-anchor", "middle")
      .text((d) => labelFor(d));

    built = true;
    zoomToFit(false);
  }

  function zoomToFit(animate) {
    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    orderedNodes.forEach((d) => {
      x0 = Math.min(x0, d.x);
      x1 = Math.max(x1, d.x);
      y0 = Math.min(y0, d.y);
      y1 = Math.max(y1, d.y);
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
    const nodeSel = nodeGroup.selectAll("g.hal-node");
    const linkSel = linkGroup.selectAll("path.hal-link");
    if (!d) {
      nodeSel.style("opacity", 1);
      linkSel.classed("hal-link--highlight", false);
      return;
    }
    nodeSel.style("opacity", (n) => (n.id === d.id ? 1 : 0.4));
    linkSel.classed("hal-link--highlight", (l) => l.source.id === d.id || l.target.id === d.id);
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
    if (!tooltip || tooltip.hidden || !wrapEl) return;
    const rect = wrapEl.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    x = Math.max(60, Math.min(rect.width - 60, x));
    y = Math.max(50, y);
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  function insightsHtml(insights, excludeId) {
    if (!insights || !insights.length) return "";
    return `<div class="insight-group">${insights.map((ins, i) => `
      <details class="insight" ${i === 0 ? "open" : ""}>
        <summary>${I18n.pick3(ins.label)}</summary>
        <p>${linkify(I18n.pick3(ins.text), "hal", excludeId)}</p>
        <cite>${ins.cite}</cite>
      </details>
    `).join("")}</div>`;
  }

  function relatedStepsHtml(d) {
    const idx = orderedNodes.findIndex((n) => n.id === d.id);
    const rows = [];
    if (idx > 0) rows.push({ other: orderedNodes[idx - 1], arrow: "←" });
    if (idx < orderedNodes.length - 1) rows.push({ other: orderedNodes[idx + 1], arrow: "→" });
    if (!rows.length) return "";
    const items = rows.map(({ other, arrow }) => `
      <div class="detail-block detail-block--edge">
        <h3>${arrow} ${I18n.pick3(other.name)}</h3>
        <p>${I18n.pick3(other.short)}</p>
      </div>
    `).join("");
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "Basamak Sırası", en: "Sequence", pt: "Sequência" })}</p>${items}`;
  }

  function analogyHtml(analogy) {
    if (!analogy) return "";
    return `<div class="detail-analogy">
      <p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p>
      <p>${I18n.pick3(analogy)}</p>
    </div>`;
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
      ${relatedStepsHtml(d)}
    `;
    detailPanel.hidden = false;
    nodeGroup.selectAll("g.hal-node").classed("hal-node--active", (n) => n.id === d.id);
  }

  function selectNode(d) {
    showDetail(d);
    window.__dostNav && window.__dostNav.setHash("hal", d.id);
  }

  function render() {
    if (!built || !halData) return;
    nodeGroup.selectAll("g.hal-node text.node-label").text((d) => labelFor(d));
    if (currentDetailNode) showDetail(currentDetailNode);
  }

  window.__halApp = {
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
