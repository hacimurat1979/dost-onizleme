(function () {
  "use strict";

  const I18n = window.DostI18n;

  const svg = d3.select("#profile-graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");
  const articlesList = document.getElementById("articles-list");

  function tt(dict) {
    return I18n.pick3(dict);
  }

  I18n.applyStatic();
  I18n.renderLangSwitcher(document.getElementById("lang-switch"), () => render());

  const tabButtons = document.querySelectorAll("#profile-tabs .bookmap-tab");
  const tabPanels = document.querySelectorAll("[data-tab-panel]");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => {
        b.classList.toggle("bookmap-tab--active", b === btn);
        b.setAttribute("aria-selected", String(b === btn));
      });
      tabPanels.forEach((p) => { p.hidden = p.dataset.tabPanel !== btn.dataset.tab; });
      if (btn.dataset.tab !== "map") detailPanel.hidden = true;
    });
  });

  detailClose.addEventListener("click", () => {
    detailPanel.hidden = true;
  });

  // Node clicks bubble up to this same listener; skip those so the panel
  // that a click just opened isn't immediately closed by that same click.
  document.addEventListener("click", (e) => {
    if (detailPanel.hidden) return;
    if (detailPanel.contains(e.target) || e.target === detailClose) return;
    if (e.target.closest && e.target.closest(".node")) return;
    detailPanel.hidden = true;
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!detailPanel.hidden) {
      detailPanel.hidden = true;
    } else {
      window.location.href = "compare.html";
    }
  });

  // Touch devices have no Escape key -- give tablet/mobile users the same
  // "go back a level" gesture by making the header title tappable, mirroring
  // the conventional click-the-logo-to-go-back pattern.
  const headerTitle = document.querySelector(".app-header__title");
  if (headerTitle) {
    headerTitle.classList.add("app-header__title--clickable");
    headerTitle.style.cursor = "pointer";
    headerTitle.title = "Geri dön / Go back / Voltar";
    headerTitle.addEventListener("click", () => {
      window.location.href = "compare.html";
    });
  }

  let pageData = null;
  let nodeSel, linkSel, labelSel;
  let currentDetailParam = null;

  function loadData() {
    if (window.DostViewStatus) window.DostViewStatus.showLoading("profile-wrap");
    fetch("data/daphne-profile.json")
      .then((r) => r.json())
      .then((data) => {
        pageData = data;
        if (window.DostViewStatus) window.DostViewStatus.hide("profile-wrap");
        buildGraph(data);
        renderArticles(data);
      })
      .catch((err) => {
        console.error("Daphne profil verisi yüklenemedi / Failed to load Daphne profile data", err);
        if (window.DostViewStatus) window.DostViewStatus.showError("profile-wrap", loadData);
      });
  }
  loadData();

  function radiusFor(d) {
    if (d.type === "hub") return 30;
    return 8 + (d.param.weight || 5) * 1.8;
  }

  function colorFor(d) {
    if (d.type === "hub") return getVar("--series-daphne");
    return getVar("--series-daphne-line");
  }

  function getVar(name) {
    return window.DostGraphUtils.getVar(name);
  }

  function buildGraph(data) {
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;
    const cx = width / 2;
    const cy = height / 2;
    const orbit = Math.min(width, height) * 0.34;

    const params = data.core_parameters;
    const nodes = [{ id: "hub", type: "hub" }];
    const links = [];

    params.forEach((param, i) => {
      const angle = (2 * Math.PI * i) / params.length - Math.PI / 2;
      nodes.push({
        id: "param-" + param.id,
        type: "param",
        param: param,
        tx: cx + orbit * Math.cos(angle),
        ty: cy + orbit * Math.sin(angle),
      });
      links.push({ source: "hub", target: "param-" + param.id });
    });

    nodes[0].fx = cx;
    nodes[0].fy = cy;

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(orbit).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-90))
      .force("x", d3.forceX((d) => (d.type === "param" ? d.tx : cx)).strength(0.25))
      .force("y", d3.forceY((d) => (d.type === "param" ? d.ty : cy)).strength(0.25))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + 28));

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
      .attr("class", (d) => "node" + (d.type === "hub" ? " node--root" : ""))
      .call(drag(simulation))
      .on("click", (event, d) => onNodeClick(d))
      .on("mouseenter", (event, d) => highlight(d))
      .on("mouseleave", () => highlight(null));

    nodeSel.filter((d) => d.type === "hub").append("circle").attr("class", "node-halo").attr("r", radiusFor(nodes[0]) * 1.4);

    nodeSel
      .append("circle")
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    labelSel = nodeSel
      .append("text")
      .attr("class", (d) => (d.type === "hub" ? "node-label node-label--hub" : "node-label"))
      .attr("dy", (d) => radiusFor(d) + 14)
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

    window.__daphneProfileApp = { nodes, links, data };
  }

  function labelFor(d) {
    if (d.type === "hub") return "Daphne";
    return tt(d.param.label);
  }

  function render() {
    if (!labelSel) return;
    labelSel.text((d) => labelFor(d));
    if (currentDetailParam) showParamDetail(currentDetailParam);
    if (pageData) renderArticles(pageData);
  }

  function highlight(d) {
    if (!d) {
      linkSel.classed("link--highlight", false);
      nodeSel.style("opacity", 1);
      return;
    }
    const connected = new Set([d.id]);
    linkSel.each((l) => {
      if (l.source.id === d.id) connected.add(l.target.id);
      if (l.target.id === d.id) connected.add(l.source.id);
    });
    linkSel.classed("link--highlight", (l) => l.source.id === d.id || l.target.id === d.id);
    nodeSel.style("opacity", (n) => (connected.has(n.id) ? 1 : 0.3));
  }

  function onNodeClick(d) {
    if (d.type === "param") {
      currentDetailParam = d.param;
      showParamDetail(d.param);
    } else {
      detailPanel.hidden = true;
      currentDetailParam = null;
    }
  }

  function showParamDetail(param) {
    const related = (param.relatedArticles || [])
      .map((url) => {
        const a = (pageData.articles || []).find((art) => art.url === url);
        const title = a ? a.title : url;
        return `<button class="bookmap-concept-tag bookmap-concept-tag--group" data-url="${url}">${title}</button>`;
      })
      .join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Temel Parametre", en: "Core Parameter", pt: "Parâmetro Central" })}</p>
      <h2 class="detail-title">${tt(param.label)}</h2>
      <div class="detail-block detail-block--daphne">
        <p>${tt(param.note)}</p>
      </div>
      ${related ? `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlgili Yazılar", en: "Related Articles", pt: "Textos Relacionados" })}</p><div class="bookmap-concept-tags">${related}</div>` : ""}
    `;
    detailContent.querySelectorAll("[data-url]").forEach((btn) => {
      btn.addEventListener("click", () => window.open(btn.dataset.url, "_blank", "noopener"));
    });
    detailPanel.hidden = false;
  }

  function renderArticles(data) {
    if (!articlesList) return;
    articlesList.innerHTML = data.articles
      .map((a) => {
        const status = a.note_tr
          ? `<span class="daphne-profile-card__status daphne-profile-card__status--pending">${tt({ tr: "Henüz işlenmedi", en: "Not yet processed", pt: "Ainda não processado" })}</span>`
          : `<span class="daphne-profile-card__status daphne-profile-card__status--done">${tt({ tr: "Profile işlendi", en: "Worked into profile", pt: "Incorporado ao perfil" })}</span>`;
        const note = a.note_tr ? `<p class="daphne-profile-card__note">${tt({ tr: a.note_tr, en: a.note_en, pt: a.note_pt })}</p>` : "";
        return `<a class="daphne-profile-card" href="${a.url}" target="_blank" rel="noopener">
          <span class="daphne-profile-card__title">${a.title}</span>
          ${status}
          ${note}
        </a>`;
      })
      .join("");
  }

  function drag(sim) {
    return window.DostGraphUtils.createDragBehavior(sim, (d) => d.type === "hub");
  }
})();
