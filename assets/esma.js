(function () {
  "use strict";

  const I18n = window.DostI18n;
  const svg = d3.select("#esma-graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const tooltip = document.getElementById("esma-tooltip");
  const wrapEl = document.getElementById("esma-wrap");

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

  // İki ismin/kutbun ilişkisini tek bakışta gösteren küçük SVG şemalar
  // (bkz. CLAUDE.md ikinci ilke — mümkün olan her yerde çizim kullan).
  const relationDiagramRenderers = {
    nested: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 260 190" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node--accent" cx="130" cy="100" r="78"/>
        <text class="term-diagram-label" x="130" y="34" text-anchor="middle">${tt(d.outer)}</text>
        <circle class="term-diagram-node--dashed" cx="130" cy="112" r="34"/>
        <text class="term-diagram-label term-diagram-label--small" x="130" y="117" text-anchor="middle">${tt(d.inner)}</text>
      </svg>
    `,
    "split-disc": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 240 160" role="img" aria-label="${tt(d.note)}">
        <path class="term-diagram-node--accent" d="M120,20 A70,70 0 0,0 120,160 Z"/>
        <path class="term-diagram-node--dashed" d="M120,20 A70,70 0 0,1 120,160 Z"/>
        <text class="term-diagram-label" x="88" y="94" text-anchor="middle">${tt(d.left)}</text>
        <text class="term-diagram-label" x="152" y="94" text-anchor="middle">${tt(d.right)}</text>
      </svg>
    `,
  };

  function relationDiagramHtml(r) {
    const renderer = r.diagram && relationDiagramRenderers[r.diagram.type];
    if (!renderer) return "";
    return `<div class="term-diagram-row"><div class="term-diagram-card">
      ${renderer(r.diagram)}
      <p class="term-diagram-caption">${tt(r.diagram.note)}</p>
    </div></div>`;
  }

  let esmaData = null;
  let esmaDataPromise = null;
  let built = false;
  let root = null;
  let zoomLayer, linkGroup, relationGroup, nodeGroup, ringGroup;
  let zoomBehavior;
  let nodeById = new Map();
  let currentDetailNode = null;
  let currentDetailRelation = null;

  function fetchData() {
    if (esmaDataPromise) return esmaDataPromise;
    esmaDataPromise = fetch("data/ibn-arabi/esma.json")
      .then((r) => r.json())
      .then((data) => {
        esmaData = data;
        return data;
      })
      .catch((err) => {
        console.error("Esmâ verisi yüklenemedi / Failed to load Esma data", err);
        esmaDataPromise = null;
      });
    return esmaDataPromise;
  }

  function radiusFor(d) {
    const depth = d.depth;
    if (depth === 0) return 34;
    if (depth === 1) return 22;
    return Math.max(9, 16 - depth);
  }

  const LAYER_COLOR = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#2a78d6", "#1c5cab", "#0d366b"];
  const LAYER_COLOR_DARK = ["#184f95", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#86b6ef", "#cde2fb"];

  function isDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function getVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function colorFor(d) {
    const pole = d.data.pole;
    if (pole === "celal") return getVar("--series-celal");
    if (pole === "cemal") return getVar("--series-cemal");
    const ramp = isDark() ? LAYER_COLOR_DARK : LAYER_COLOR;
    return ramp[Math.min(d.depth, ramp.length - 1)];
  }

  function labelFor(d) {
    const full = I18n.pick3(d.data.name);
    const idx = full.indexOf(" (");
    return idx === -1 ? full : full.slice(0, idx);
  }

  function collapseAll(d) {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(collapseAll);
      d.children = null;
    }
  }

  // Radial ("dairesel") düzen: İbn Arabî'nin İnşâü'd-Devâir'de tarif ettiği
  // "feleklerin sûreti" gibi, merkezde Zât, dışa doğru iç içe mertebe halkaları.
  let outerRadius = 320;
  let maxDepth = 1;
  let radiusScale = d3.scaleSqrt().domain([0, 1]).range([0, 320]);

  function radialPoint(angle, radius) {
    const a = angle - Math.PI / 2;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  }

  // Tek çocuklu zincirler (örn. Rab→Hayy→Alim→Mürîd→...) dallanma olmadığı
  // için aynı açıda üst üste biner. Zincir boyunca hafif bir açısal kayma
  // ekleyerek düğümleri okunur bir spiral hâline getiriyoruz.
  function applySpiralOffset(node, inherited) {
    const siblingCount = node.parent ? node.parent.children.length : 1;
    const ownOffset = node.parent && siblingCount === 1 ? inherited + 0.16 : 0;
    node.x += ownOffset;
    (node.children || []).forEach((c) => applySpiralOffset(c, ownOffset));
  }

  function buildGraph(data) {
    svg.selectAll("*").remove();

    root = d3.stratify()
      .id((d) => d.id)
      .parentId((d) => d.parent)(data.nodes);

    nodeById = new Map();
    root.each((d) => nodeById.set(d.id, d));

    collapseAll(root);
    root.x0 = 0;
    root.y0 = 0;

    zoomLayer = svg.append("g").attr("class", "esma-canvas");
    ringGroup = zoomLayer.append("g").attr("class", "esma-rings");
    relationGroup = zoomLayer.append("g").attr("class", "esma-relations");
    linkGroup = zoomLayer.append("g").attr("class", "esma-links");
    nodeGroup = zoomLayer.append("g").attr("class", "esma-nodes");

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

    const recenterBtn = document.getElementById("esma-recenter");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", () => zoomToFit(true));
    }

    update(root, false);
    built = true;
  }

  const treeLayout = d3.tree()
    .size([2 * Math.PI, 1])
    .separation((a, b) => (a.parent === b.parent ? 1.1 : 2.2) / a.depth || 1);

  function drawRings() {
    const depths = Array.from(new Set(root.descendants().map((d) => d.depth))).sort((a, b) => a - b);
    const ringSel = ringGroup.selectAll("circle.esma-ring").data(depths, (d) => d);
    ringSel.exit().remove();
    ringSel.enter()
      .append("circle")
      .attr("class", "esma-ring")
      .merge(ringSel)
      .attr("r", (depth) => radiusScale(depth));
  }

  function zoomToFit(animate) {
    const nodes = root.descendants();
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
    x0 -= 70; x1 += 70; y0 -= 70; y1 += 70;
    const treeW = Math.max(1, x1 - x0);
    const treeH = Math.max(1, y1 - y0);
    const [minScale, maxScale] = zoomBehavior.scaleExtent();
    const scale = Math.min(maxScale, 1.3, width / treeW, height / treeH);
    const clampedScale = Math.max(minScale, scale);
    const tx = width / 2 - clampedScale * (x0 + treeW / 2);
    const ty = height / 2 - clampedScale * (y0 + treeH / 2);
    const transform = d3.zoomIdentity.translate(tx, ty).scale(clampedScale);
    const sel = animate ? svg.transition().duration(400) : svg;
    sel.call(zoomBehavior.transform, transform);
  }

  function update(source, animate) {
    treeLayout(root);
    applySpiralOffset(root, 0);
    const nodes = root.descendants();
    const links = root.links();

    maxDepth = Math.max(1, d3.max(nodes, (d) => d.depth));
    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    outerRadius = Math.max(120, Math.min(width, height) / 2 - 60);
    radiusScale = d3.scaleSqrt().domain([0, maxDepth]).range([0, outerRadius]);
    nodes.forEach((d) => { d.y = radiusScale(d.depth); });

    drawRings();

    const nodeSet = new Set(nodes);
    const relations = (esmaData.relations || []).filter((r) => {
      const s = nodeById.get(r.from);
      const t = nodeById.get(r.to);
      return s && t && nodeSet.has(s) && nodeSet.has(t);
    });

    const linkGen = d3.linkRadial().angle((d) => d.x).radius((d) => d.y);

    // links
    const link = linkGroup.selectAll("path.esma-link").data(links, (d) => d.target.id);
    link.exit()
      .transition().duration(300)
      .attr("d", () => linkGen({ source: { x: source.x, y: source.y }, target: { x: source.x, y: source.y } }))
      .remove();
    link.enter().append("path")
      .attr("class", "esma-link")
      .attr("d", () => linkGen({ source: { x: source.x0, y: source.y0 }, target: { x: source.x0, y: source.y0 } }))
      .merge(link)
      .transition().duration(300)
      .attr("d", linkGen);

    // cross-relations (dashed) — only drawn once both endpoints are visible
    const relSel = relationGroup.selectAll("path.esma-relation")
      .data(relations, (r) => `${r.from}->${r.to}`);
    relSel.exit().remove();
    const relEnter = relSel.enter().append("path")
      .attr("class", (r) => `esma-relation esma-relation--${r.type}`)
      .on("click", (event, r) => {
        event.stopPropagation();
        showRelationDetail(r);
      });
    relEnter.append("title").text((r) => I18n.pick3(r.label));
    relEnter.merge(relSel)
      .attr("d", (r) => linkGen({ source: nodeById.get(r.from), target: nodeById.get(r.to) }));
    relationGroup.selectAll("path.esma-relation title").text((r) => I18n.pick3(r.label));

    // nodes
    const node = nodeGroup.selectAll("g.esma-node").data(nodes, (d) => d.id);

    const nodeEnter = node.enter().append("g")
      .attr("class", "node esma-node")
      .attr("transform", () => `translate(${radialPoint(source.x0, source.y0).join(",")})`)
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d) => labelFor(d))
      .style("opacity", 0)
      .on("click", (event, d) => {
        event.stopPropagation();
        toggle(d);
      })
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          toggle(d);
        }
      })
      .on("mouseenter", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => { highlight(null); hideTooltip(); })
      .on("focus", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("blur", () => { highlight(null); hideTooltip(); });

    nodeEnter.append("circle")
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    nodeEnter.append("text")
      .attr("class", "node-label")
      .attr("text-anchor", (d) => (d.depth === 0 ? "middle" : (d.x < Math.PI ? "start" : "end")))
      .attr("transform", (d) => {
        if (d.depth === 0) return `translate(0,${radiusFor(d) + 14})`;
        const deg = (d.x * 180 / Math.PI) - 90;
        const flip = d.x >= Math.PI;
        const offset = radiusFor(d) + 8;
        return `rotate(${deg}) translate(${offset},0) rotate(${flip ? 180 : 0})`;
      })
      .text((d) => labelFor(d));

    nodeEnter.append("text")
      .attr("class", "esma-expand-badge")
      .attr("dy", 4)
      .attr("text-anchor", "middle")
      .text((d) => (d._children ? "+" : ""));

    node.merge(nodeEnter)
      .transition().duration(300)
      .style("opacity", 1)
      .attr("transform", (d) => `translate(${radialPoint(d.x, d.y).join(",")})`);

    node.merge(nodeEnter).select("text.node-label")
      .attr("text-anchor", (d) => (d.depth === 0 ? "middle" : (d.x < Math.PI ? "start" : "end")))
      .attr("transform", (d) => {
        if (d.depth === 0) return `translate(0,${radiusFor(d) + 14})`;
        const deg = (d.x * 180 / Math.PI) - 90;
        const flip = d.x >= Math.PI;
        const offset = radiusFor(d) + 8;
        return `rotate(${deg}) translate(${offset},0) rotate(${flip ? 180 : 0})`;
      });

    node.merge(nodeEnter).select("text.esma-expand-badge")
      .text((d) => (d._children ? "+" : ""));

    node.exit()
      .transition().duration(300)
      .style("opacity", 0)
      .attr("transform", `translate(${radialPoint(source.x, source.y).join(",")})`)
      .remove();

    nodes.forEach((d) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });

    zoomToFit(animate !== false);
  }

  function toggle(d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else if (d._children) {
      d.children = d._children;
      d._children = null;
    }
    update(d, true);
    showDetail(d);
    window.__dostNav && window.__dostNav.setHash("esma", d.id);
  }

  function highlight(d) {
    const nodeSel = nodeGroup.selectAll("g.esma-node");
    const linkSel = linkGroup.selectAll("path.esma-link");
    const relationSel = relationGroup.selectAll("path.esma-relation");
    if (!d) {
      nodeSel.style("opacity", 1);
      linkSel.classed("esma-link--highlight", false);
      relationSel.style("opacity", null);
      return;
    }
    const ids = new Set(d.ancestors().map((a) => a.id));
    const descendantIds = new Set(d.descendants().map((a) => a.id));
    nodeSel.style("opacity", (n) => (ids.has(n.id) || descendantIds.has(n.id) ? 1 : 0.35));
    linkSel.classed("esma-link--highlight", (l) => l.target.id === d.id);
    relationSel.style("opacity", (r) => (r.from === d.id || r.to === d.id ? 1 : 0.15));
  }

  function showTooltip(d, event) {
    if (!tooltip) return;
    const short = I18n.pick3(d.data.short);
    tooltip.innerHTML = `
      <div class="node-hover-tip__title">${I18n.pick3(d.data.name)}</div>
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

  const VOLUME_LABEL_OVERRIDE = {
    "izutsu-anahtar": { tr: "Anahtar-Kavramlar (İzutsu)", en: "Key Concepts (Izutsu)", pt: "Conceitos-Chave (Izutsu)" },
  };

  const VOLUME_SOURCE_MATCH = {
    "izutsu-anahtar": "İbn Arabî'nin Fusûsu'ndaki Anahtar-Kavramlar (Toshihiko İzutsu",
  };

  function volumeLabel(v) {
    if (VOLUME_LABEL_OVERRIDE[v]) return tt(VOLUME_LABEL_OVERRIDE[v]);
    return tt({ tr: `Fütûhât, Cilt ${v}`, en: `Futuhat, Volume ${v}`, pt: `Futuhat, Volume ${v}` });
  }

  function sourcesForInsight(ins, sources) {
    if (ins.source) return [ins.source];
    if (!sources || !sources.length) return [];
    const v = ins.volume;
    if (typeof v === "number") {
      const re = new RegExp(`Cilt ${v}\\b`);
      return sources.filter((s) => re.test(s));
    }
    if (VOLUME_SOURCE_MATCH[v]) {
      return sources.filter((s) => s.includes(VOLUME_SOURCE_MATCH[v]));
    }
    return [];
  }

  function insightsHtml(insights, sources, excludeId) {
    if (!insights || !insights.length) return "";
    return `<div class="insight-group">${insights.map((ins, i) => {
      const cite = sourcesForInsight(ins, sources);
      return `
      <details class="insight" ${i === 0 ? "open" : ""}>
        <summary>${volumeLabel(ins.volume)}</summary>
        <p>${linkify(I18n.pick3(ins.text), "esma", excludeId)}</p>
        ${cite.length ? `<cite>${cite.join(" · ")}</cite>` : ""}
      </details>
    `;
    }).join("")}</div>`;
  }

  function relatedNamesHtml(d) {
    const rows = [];
    if (d.parent) rows.push({ other: d.parent, arrow: "↑", note: I18n.pick3(d.parent.data.short) });
    const kids = d.children || d._children || [];
    kids.forEach((c) => rows.push({ other: c, arrow: "↓", note: I18n.pick3(c.data.short) }));
    const relations = (esmaData.relations || []).filter(
      (r) => r.from === d.id || r.to === d.id
    );
    relations.forEach((r) => {
      const otherId = r.from === d.id ? r.to : r.from;
      const other = nodeById.get(otherId);
      if (other) rows.push({ other, arrow: "↔", note: I18n.pick3(r.label) });
    });
    if (!rows.length) return "";
    const items = rows.map(({ other, arrow, note }) => `
      <div class="detail-block detail-block--edge">
        <h3>${arrow} ${I18n.pick3(other.data.name)}</h3>
        ${note ? `<p>${note}</p>` : ""}
      </div>
    `).join("");
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "İlişkiler", en: "Relations", pt: "Relações" })}</p>${items}`;
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
    currentDetailRelation = null;
    const n = d.data;
    const hint = d._children
      ? `<p class="detail-resonance">${tt({ tr: "Devamı için düğüme tekrar tıklayın.", en: "Click the node again to reveal what follows.", pt: "Clique no nó novamente para revelar o que se segue." })}</p>`
      : "";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" })}</p>
      <h2 class="detail-title">${I18n.pick3(n.name)}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${I18n.pick3(n.short)}</h3>
        <p>${linkify(I18n.pick3(n.summary), "esma", d.id)}</p>
      </div>
      ${analogyHtml(n.analogy)}
      ${insightsHtml(n.insights, n.sources, d.id)}
      ${hint}
      ${relatedNamesHtml(d)}
    `;
    detailPanel.hidden = false;
    nodeGroup.selectAll("g.esma-node").classed("node--active", (n) => n.id === d.id);
  }

  function showRelationDetail(r) {
    currentDetailNode = null;
    currentDetailRelation = r;
    const from = nodeById.get(r.from);
    const to = nodeById.get(r.to);
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "İlişki", en: "Relation", pt: "Relação" })}</p>
      <h2 class="detail-title">${I18n.pick3(from.data.name)} ↔ ${I18n.pick3(to.data.name)}</h2>
      ${relationDiagramHtml(r)}
      <div class="detail-block detail-block--ibnarabi">
        <p>${I18n.pick3(r.label)}</p>
      </div>
    `;
    detailPanel.hidden = false;
    nodeGroup.selectAll("g.esma-node").classed("node--active", false);
  }

  function render() {
    if (!built || !esmaData) return;
    nodeGroup.selectAll("g.esma-node text.node-label").text((d) => labelFor(d));
    relationGroup.selectAll("path.esma-relation title").text((r) => I18n.pick3(r.label));
    if (currentDetailNode) showDetail(currentDetailNode);
    else if (currentDetailRelation) showRelationDetail(currentDetailRelation);
  }

  function revealPathTo(id) {
    const target = nodeById.get(id);
    if (!target) return;
    let n = target.parent;
    while (n) {
      if (n._children) {
        n.children = n._children;
        n._children = null;
      }
      n = n.parent;
    }
    update(root, false);
    showDetail(target);
  }

  window.__esmaApp = {
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
        revealPathTo(id);
      });
    },
    onLangChange() {
      render();
    },
  };
})();
