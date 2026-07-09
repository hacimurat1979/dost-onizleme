(function () {
  "use strict";

  let lang = "tr";

  const svg = d3.select("#graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");

  function t(tr, en) {
    return lang === "tr" ? tr : en;
  }

  function applyStaticLang() {
    document.querySelectorAll("[data-tr][data-en]").forEach((el) => {
      el.textContent = lang === "tr" ? el.dataset.tr : el.dataset.en;
    });
    document.getElementById("lang-toggle").textContent = lang === "tr" ? "EN" : "TR";
    document.documentElement.lang = lang;
  }

  document.getElementById("lang-toggle").addEventListener("click", () => {
    lang = lang === "tr" ? "en" : "tr";
    applyStaticLang();
    render();
  });

  detailClose.addEventListener("click", () => {
    detailPanel.hidden = true;
  });

  applyStaticLang();

  Promise.all([
    fetch("data/themes.json").then((r) => r.json()),
    fetch("data/ibn-arabi/concepts.json").then((r) => r.json()),
  ]).then(([themes, concepts]) => {
    const conceptById = new Map(concepts.map((c) => [c.id, c]));
    buildGraph(themes, conceptById);
  }).catch((err) => {
    console.error("Veri yüklenemedi / Failed to load data", err);
  });

  let simulation, nodeSel, linkSel, labelSel;

  function buildGraph(themes, conceptById) {
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;

    const usedConceptIds = Array.from(new Set(themes.map((th) => th.ibn_arabi_concept)));

    const nodes = [];
    const links = [];

    nodes.push({ id: "hub-ibnarabi", type: "hub-ibnarabi", label: "İbn Arabî" });
    nodes.push({ id: "hub-daphne", type: "hub-daphne", label: "Daphne" });

    usedConceptIds.forEach((cid) => {
      const c = conceptById.get(cid);
      if (!c) return;
      nodes.push({ id: "concept-" + cid, type: "concept", concept: c });
      links.push({ source: "hub-ibnarabi", target: "concept-" + cid, kind: "ibnarabi" });
    });

    themes.forEach((th) => {
      nodes.push({ id: "theme-" + th.id, type: "theme", theme: th });
      links.push({ source: "concept-" + th.ibn_arabi_concept, target: "theme-" + th.id, kind: "bridge" });
      links.push({ source: "theme-" + th.id, target: "hub-daphne", kind: "daphne" });
    });

    function targetX(d) {
      if (d.type === "hub-ibnarabi" || d.type === "concept") return width * 0.24;
      if (d.type === "hub-daphne") return width * 0.76;
      return width * 0.5;
    }

    simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance((l) => (l.kind === "bridge" ? 150 : 170)).strength(0.35))
      .force("charge", d3.forceManyBody().strength(-420))
      .force("x", d3.forceX(targetX).strength((d) => (d.type.startsWith("hub") ? 0.35 : 0.12)))
      .force("y", d3.forceY(height / 2).strength(0.06))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + 46));

    nodes.forEach((d) => {
      if (d.type === "hub-ibnarabi") { d.x = width * 0.2; d.y = height / 2; }
      if (d.type === "hub-daphne") { d.x = width * 0.8; d.y = height / 2; }
    });

    linkSel = svg
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link");

    const nodeGroup = svg.append("g").attr("class", "nodes");

    nodeSel = nodeGroup
      .selectAll("g.node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .call(drag(simulation))
      .on("click", (event, d) => onNodeClick(d))
      .on("mouseenter", (event, d) => highlight(d))
      .on("mouseleave", () => highlight(null));

    nodeSel
      .append("circle")
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    labelSel = nodeSel
      .append("text")
      .attr("class", (d) => (d.type.startsWith("hub") ? "node-label node-label--hub" : "node-label"))
      .attr("dy", (d) => radiusFor(d) + 12)
      .attr("text-anchor", "middle")
      .text((d) => labelFor(d));

    simulation.on("tick", () => {
      linkSel
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    window.__daphneApp = { nodes, links, conceptById, themes };
  }

  function render() {
    if (!labelSel) return;
    labelSel.text((d) => labelFor(d));
    if (currentDetailTheme) showThemeDetail(currentDetailTheme);
  }

  function radiusFor(d) {
    if (d.type === "hub-ibnarabi" || d.type === "hub-daphne") return 26;
    if (d.type === "theme") return 14;
    return 10;
  }

  function colorFor(d) {
    if (d.type === "hub-ibnarabi") return getVar("--series-ibnarabi");
    if (d.type === "hub-daphne") return getVar("--series-daphne");
    if (d.type === "theme") return getVar("--series-theme");
    return getVar("--series-ibnarabi-line");
  }

  function getVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function labelFor(d) {
    if (d.type === "hub-ibnarabi") return "İbn Arabî";
    if (d.type === "hub-daphne") return "Daphne";
    if (d.type === "theme") return t(d.theme.title_tr, d.theme.title_en || d.theme.title_tr);
    if (d.type === "concept") return t(d.concept.name_tr, d.concept.name_en);
    return "";
  }

  function highlight(d) {
    if (!d) {
      linkSel.classed("link--highlight", false).style("stroke-opacity", null);
      nodeSel.style("opacity", 1);
      return;
    }
    const connected = new Set([d.id]);
    linkSel.each((l) => {
      if (l.source.id === d.id) connected.add(l.target.id);
      if (l.target.id === d.id) connected.add(l.source.id);
    });
    linkSel.classed("link--highlight", (l) => l.source.id === d.id || l.target.id === d.id);
    nodeSel.style("opacity", (n) => (connected.has(n.id) ? 1 : 0.25));
  }

  let currentDetailTheme = null;

  function onNodeClick(d) {
    if (d.type === "theme") {
      currentDetailTheme = d.theme;
      showThemeDetail(d.theme);
    } else if (d.type === "concept") {
      currentDetailTheme = null;
      showConceptDetail(d.concept);
    } else {
      detailPanel.hidden = true;
      currentDetailTheme = null;
    }
  }

  function showThemeDetail(theme) {
    const concept = window.__daphneApp.conceptById.get(theme.ibn_arabi_concept);
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${t("Ortak Tema", "Shared Theme")}</p>
      <h2 class="detail-title">${t(theme.title_tr, theme.title_en || theme.title_tr)}</h2>

      <div class="detail-block detail-block--ibnarabi">
        <h3>İbn Arabî — ${t(concept ? concept.name_tr : "", concept ? concept.name_en : "")}</h3>
        <p>${t(theme.ibn_arabi_note_tr, theme.ibn_arabi_note_en)}</p>
      </div>

      <div class="detail-block detail-block--daphne">
        <h3>Daphne</h3>
        <blockquote>&ldquo;${theme.daphne_quote}&rdquo;</blockquote>
        <cite><a href="${theme.daphne_url}" target="_blank" rel="noopener">${theme.daphne_source}</a></cite>
      </div>

      <p class="detail-resonance">${t(theme.resonance_tr, theme.resonance_en)}</p>
    `;
    detailPanel.hidden = false;
  }

  function showConceptDetail(concept) {
    detailContent.innerHTML = `
      <p class="detail-eyebrow">İbn Arabî</p>
      <h2 class="detail-title">${t(concept.name_tr, concept.name_en)}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <p>${t(concept.summary_tr, concept.summary_en)}</p>
        <cite>${(concept.sources || []).join(" · ")}</cite>
      </div>
    `;
    detailPanel.hidden = false;
  }

  function drag(sim) {
    function dragstarted(event, d) {
      if (!event.active) sim.alphaTarget(0.2).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event, d) {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
  }
})();
