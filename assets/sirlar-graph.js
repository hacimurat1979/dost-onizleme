(function () {
  "use strict";

  const I18n = window.DostI18n;
  const svg = d3.select("#sirlar-graph");
  const wrapEl = document.getElementById("sirlar-wrap");
  const tooltip = document.getElementById("sirlar-tooltip");
  if (!svg.node() || !wrapEl) return;

  function tt(dict) {
    return I18n.pick3(dict);
  }

  const THEME_LABELS = {
    "suskunluk": { tr: "Suskunluk ve Perdeleme", en: "Silence and Veiling", pt: "Silêncio e Velamento" },
    "peygamber-kissalari": { tr: "Peygamber Kıssalarındaki Sırlar", en: "Secrets in the Prophets' Stories", pt: "Segredos nas Histórias dos Profetas" },
    "kader-tevhid": { tr: "Kader, Tevhid, Tenzih-Teşbih", en: "Destiny, Divine Unity, Tanzih-Tashbih", pt: "Destino, Unidade Divina, Tanzih-Tashbih" },
    "dil-ve-kelime": { tr: "Dilde ve Kelimede Gizlenen Sırlar", en: "Secrets Hidden in Language and Words", pt: "Segredos Ocultos na Língua e nas Palavras" },
    "insan-i-kamil": { tr: "İnsan-ı Kâmil ve Velâyet", en: "The Perfect Human and Sainthood", pt: "O Ser Humano Perfeito e a Santidade" },
  };
  const THEME_ORDER = Object.keys(THEME_LABELS);
  const THEME_COLOR_VAR = {
    "suskunluk": "--series-sir-suskunluk",
    "peygamber-kissalari": "--series-sir-peygamber",
    "kader-tevhid": "--series-sir-kader",
    "dil-ve-kelime": "--series-sir-dil",
    "insan-i-kamil": "--series-sir-insan",
  };

  let sirlarData = null;
  let sirlarDataPromise = null;
  let built = false;
  let root = null;
  let zoomLayer, linkGroup, nodeGroup;
  let zoomBehavior;
  let nodeById = new Map();
  let focusedTheme = null;

  function fetchData() {
    if (sirlarDataPromise) return sirlarDataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("sirlar-wrap");
    sirlarDataPromise = fetch("data/ibn-arabi/sirlar.json")
      .then((r) => r.json())
      .then((data) => {
        sirlarData = data;
        if (window.DostViewStatus) window.DostViewStatus.hide("sirlar-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Sırlar verisi yüklenemedi / Failed to load Mysteries data", err);
        sirlarDataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("sirlar-wrap", () => window.__sirlarGraphApp.activate());
      });
    return sirlarDataPromise;
  }

  function buildNodeList(data) {
    const nodes = [{ id: "sirlar-root", parent: null, kind: "root" }];
    THEME_ORDER.forEach((theme) => {
      nodes.push({ id: "theme-" + theme, parent: "sirlar-root", kind: "theme", theme });
    });
    data.entries.forEach((entry) => {
      nodes.push(Object.assign({ parent: "theme-" + entry.theme, kind: "entry" }, entry));
    });
    return nodes;
  }

  function radiusFor(d) {
    if (d.depth === 0) return 26;
    if (d.depth === 1) return 15;
    return 7;
  }

  function getVar(name) {
    return window.DostGraphUtils.getVar(name);
  }

  function colorFor(d) {
    if (d.depth === 0) return getVar("--text-secondary");
    const theme = d.depth === 1 ? d.data.theme : d.data.theme;
    const varName = THEME_COLOR_VAR[theme] || "--series-theme";
    return getVar(varName);
  }

  function labelFor(d) {
    if (d.depth === 0) return tt({ tr: "Sırlar", en: "Mysteries", pt: "Mistérios" });
    if (d.depth === 1) return tt(THEME_LABELS[d.data.theme]);
    return tt(d.data.topic);
  }

  function nodeLabelFor(d) {
    if (d.depth === 2) return tt(d.data.label);
    return labelFor(d);
  }

  function radialPoint(angle, radius) {
    const a = angle - Math.PI / 2;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  }

  const treeLayout = d3.tree()
    .size([2 * Math.PI, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2.6) / (a.depth || 1));

  function buildGraph(data) {
    svg.selectAll("*").remove();

    root = d3.stratify()
      .id((d) => d.id)
      .parentId((d) => d.parent)(buildNodeList(data));

    nodeById = new Map();
    root.each((d) => nodeById.set(d.id, d));

    zoomLayer = svg.append("g").attr("class", "sirlar-canvas");
    linkGroup = zoomLayer.append("g").attr("class", "sirlar-links");
    nodeGroup = zoomLayer.append("g").attr("class", "sirlar-nodes");

    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");

    zoomBehavior = d3.zoom()
      .scaleExtent([0.35, 2.5])
      .filter((event) => {
        if (event.type === "wheel") return event.ctrlKey || event.metaKey;
        if (event.touches) return event.touches.length > 1;
        return true;
      })
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform));
    svg.call(zoomBehavior).on("dblclick.zoom", null);
    svg.on("click", () => { if (focusedTheme) unfocusTheme(true); });

    const recenterBtn = document.getElementById("sirlar-recenter");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", () => { focusedTheme = null; zoomToFit(true); });
    }

    treeLayout(root);
    const nodes = root.descendants();
    const outerRadius = Math.max(140, Math.min(width, height) / 2 - 70);
    const radiusScale = d3.scaleSqrt().domain([0, 2]).range([0, outerRadius]);
    nodes.forEach((d) => { d.y = radiusScale(d.depth); });

    const linkGen = d3.linkRadial().angle((d) => d.x).radius((d) => d.y);
    linkGroup.selectAll("path.sirlar-link")
      .data(root.links())
      .join("path")
      .attr("class", "sirlar-link")
      .attr("d", linkGen);

    const node = nodeGroup.selectAll("g.sirlar-node")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("class", (d) => "node sirlar-node sirlar-node--" + d.data.kind)
      .attr("transform", (d) => `translate(${radialPoint(d.x, d.y).join(",")})`)
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d) => labelFor(d))
      .on("click", (event, d) => {
        event.stopPropagation();
        activateNode(d);
      })
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          activateNode(d);
        }
      })
      .on("mouseenter", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => { highlight(null); hideTooltip(); })
      .on("focus", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("blur", () => { highlight(null); hideTooltip(); });

    node.append("circle")
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    node.append("circle")
      .attr("class", "node-sheen")
      .attr("r", (d) => radiusFor(d));

    node.append("text")
      .attr("class", "node-label")
      .attr("text-anchor", (d) => (d.depth === 0 ? "middle" : (d.x < Math.PI ? "start" : "end")))
      .attr("transform", (d) => {
        if (d.depth === 0) return `translate(0,${radiusFor(d) + 14})`;
        const deg = (d.x * 180 / Math.PI) - 90;
        const flip = d.x >= Math.PI;
        const offset = radiusFor(d) + (d.depth === 1 ? 8 : 6);
        return `rotate(${deg}) translate(${offset},0) rotate(${flip ? 180 : 0})`;
      })
      .text((d) => nodeLabelFor(d));

    built = true;
    zoomToFit(false);
  }

  function zoomToBox(nodes, animate, margin, maxScaleCap) {
    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    nodes.forEach((d) => {
      const [cx, cy] = radialPoint(d.x, d.y);
      x0 = Math.min(x0, cx);
      x1 = Math.max(x1, cx);
      y0 = Math.min(y0, cy);
      y1 = Math.max(y1, cy);
    });
    const m = margin || { x0: 80, x1: 80, y0: 70, y1: 80 };
    x0 -= m.x0; x1 += m.x1; y0 -= m.y0; y1 += m.y1;
    const treeW = Math.max(1, x1 - x0);
    const treeH = Math.max(1, y1 - y0);
    const [minScale, maxScale] = zoomBehavior.scaleExtent();
    const cap = maxScaleCap || 1.2;
    const scale = Math.min(maxScale, cap, width / treeW, height / treeH);
    const clampedScale = Math.max(minScale, scale);
    const tx = width / 2 - clampedScale * (x0 + treeW / 2);
    const ty = height / 2 - clampedScale * (y0 + treeH / 2);
    const transform = d3.zoomIdentity.translate(tx, ty).scale(clampedScale);
    const sel = animate ? svg.transition().duration(400) : svg;
    sel.call(zoomBehavior.transform, transform);
  }

  function zoomToFit(animate) {
    zoomToBox(root.descendants(), animate);
  }

  function activateNode(d) {
    if (d.data.kind === "entry") {
      window.__dostNav && window.__dostNav.goTo("sirlar", d.id);
    } else if (d.data.kind === "theme") {
      if (focusedTheme && focusedTheme.id === d.id) {
        unfocusTheme(true);
      } else {
        focusOnTheme(d, true);
      }
    } else if (d.data.kind === "root") {
      if (focusedTheme) unfocusTheme(true);
      else if (window.__sirlarShowOverview) window.__sirlarShowOverview();
    }
  }

  function focusOnTheme(themeNode, animate) {
    focusedTheme = themeNode;
    const clusterIds = new Set(themeNode.descendants().map((n) => n.id));
    nodeGroup.selectAll("g.sirlar-node")
      .classed("sirlar-node--dimmed", (n) => !clusterIds.has(n.id))
      .classed("sirlar-node--focused", (n) => n.id === themeNode.id);
    zoomToBox(themeNode.descendants(), animate, { x0: 130, x1: 130, y0: 60, y1: 90 }, 2.5);
  }

  function unfocusTheme(animate) {
    focusedTheme = null;
    nodeGroup.selectAll("g.sirlar-node")
      .classed("sirlar-node--dimmed", false)
      .classed("sirlar-node--focused", false);
    zoomToFit(animate);
  }

  function highlight(d) {
    const nodeSel = nodeGroup.selectAll("g.sirlar-node");
    const linkSel = linkGroup.selectAll("path.sirlar-link");
    if (!d) {
      nodeSel.style("opacity", null);
      linkSel.classed("sirlar-link--highlight", false);
      return;
    }
    const ids = new Set(d.ancestors().map((a) => a.id));
    const descendantIds = new Set(d.descendants().map((a) => a.id));
    nodeSel.style("opacity", (n) => (ids.has(n.id) || descendantIds.has(n.id) ? 1 : 0.35));
    linkSel.classed("sirlar-link--highlight", (l) => l.target.id === d.id);
  }

  function showTooltip(d, event) {
    if (!tooltip) return;
    let short = "";
    if (d.data.kind === "theme") {
      short = tt({ tr: `${d.children ? d.children.length : 0} sır`, en: `${d.children ? d.children.length : 0} entries`, pt: `${d.children ? d.children.length : 0} entradas` });
    } else if (d.data.kind === "entry") {
      short = tt(d.data.quote);
    }
    tooltip.innerHTML = `
      <div class="node-hover-tip__title">${labelFor(d)}</div>
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

  function render() {
    if (!built) return;
    nodeGroup.selectAll("g.sirlar-node text.node-label").text((d) => nodeLabelFor(d));
  }

  window.__sirlarGraphApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        if (!built) buildGraph(data);
      });
    },
    onLangChange() {
      render();
    },
    isFocused() {
      return !!focusedTheme;
    },
    unfocusTheme() {
      if (focusedTheme) unfocusTheme(true);
    },
  };
})();
