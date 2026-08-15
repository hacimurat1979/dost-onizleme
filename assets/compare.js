(function () {
  "use strict";

  const I18n = window.DostI18n;

  const svg = d3.select("#graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)

  I18n.applyStatic();
  // Dil değişince İKİ graf da yeniden çizilmeli: Daphne profili artık ayrı
  // bir sayfa değil, bu sayfanın bir sekmesi (2026-07-27).
  I18n.renderLangSwitcher(document.getElementById("lang-switch"), () => {
    render();
    if (window.__dostDaphneProfileApp) window.__dostDaphneProfileApp.render();
  });
  window.DostGraphUtils.setupLegendToggles();
  window.DostGraphUtils.setupDetailPanelFocus();

  // Sekmeler. "Daphne'nin Profili" ile "Taranan Yazılar" 2026-07-27'ye
  // kadar ayrı bir sayfaydı (daphne-profil.html, "understand" yazınca
  // açılıyordu); o sayfa silindi, içeriği buraya sekme olarak taşındı.
  // Profil grafiği ilk kez sekmesi açıldığında kuruluyor -- bölüm
  // gizliyken svg genişliği 0 olur ve graf bozuk çıkar.
  (function wireTabs() {
    const tabButtons = document.querySelectorAll("#compare-tabs .bookmap-tab");
    if (!tabButtons.length) return;
    const tabPanels = document.querySelectorAll("[data-tab-panel]");
    const introThemes = document.getElementById("intro-text");
    const introProfile = document.getElementById("intro-text-profile");
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        tabButtons.forEach((b) => {
          b.classList.toggle("bookmap-tab--active", b === btn);
          b.setAttribute("aria-selected", String(b === btn));
        });
        tabPanels.forEach((p) => { p.hidden = p.dataset.tabPanel !== tab; });
        if (introThemes) introThemes.hidden = tab !== "temalar";
        if (introProfile) introProfile.hidden = tab !== "profil";
        detailPanel.hidden = true;
        if ((tab === "profil" || tab === "yazilar") && window.__dostDaphneProfileApp) {
          // double-RAF ensures panel has reflowed (clientWidth > 0) before buildGraph reads it
          requestAnimationFrame(() => requestAnimationFrame(() => {
            window.__dostDaphneProfileApp.activate();
          }));
        }
      });
    });
  })();

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
      window.location.href = "index.html";
    }
  });

  // Touch devices have no Escape key. The tappable title below is the quiet
  // fallback, but it is invisible -- nothing tells you it can be tapped. The
  // header's back circle is the discoverable version of the same move.
  const headerBack = document.getElementById("header-back");
  if (headerBack) {
    headerBack.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  const headerTitle = document.querySelector(".app-header__title");
  if (headerTitle) {
    headerTitle.classList.add("app-header__title--clickable");
    headerTitle.style.cursor = "pointer";
    headerTitle.title = "Dost'a dön / Back to Dost / Voltar ao Dost";
    headerTitle.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  function loadData() {
    if (window.DostViewStatus) window.DostViewStatus.showLoading("compare-wrap");
    Promise.all([
      window.DostGraphUtils.fetchJson("data/themes.json"),
      window.DostGraphUtils.fetchJson("data/ibn-arabi/concepts.json"),
    ]).then(([themes, concepts]) => {
      const conceptById = new Map(concepts.map((c) => [c.id, c]));
      if (window.DostViewStatus) window.DostViewStatus.hide("compare-wrap");
      buildGraph(themes, conceptById);
    }).catch((err) => {
      console.error("Veri yüklenemedi / Failed to load data", err);
      if (window.DostViewStatus) window.DostViewStatus.showError("compare-wrap", loadData);
    });
  }
  loadData();

  let simulation, nodeSel, linkSel, labelSel, zoomBehavior;

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

    // Siteki diğer 12 grafik görünümünün hepsi yakınlaştırma/geri-merkezleme
    // taşırken bu ikisi (Ortak Temalar + Daphne'nin Profili) hiç taşımıyordu
    // -- yoğun bir kümede etiketler okunamıyor, ve okumak için yakınlaşmanın
    // hiçbir yolu yoktu (UI denetimi bulgusu, ETKILESIM_DILI.md'nin "bir
    // hareket her yerde aynı anlam taşır" ilkesiyle çelişiyordu).
    const zoomLayer = svg.append("g").attr("class", "compare-zoom-layer");
    linkSel = zoomLayer
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link");

    const nodeGroup = zoomLayer.append("g").attr("class", "nodes");

    nodeSel = nodeGroup
      .selectAll("g.node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d) => labelFor(d))
      .call(drag(simulation))
      .on("click", (event, d) => onNodeClick(d))
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onNodeClick(d);
        }
      })
      .on("mouseenter", (event, d) => highlight(d))
      .on("mouseleave", () => highlight(null))
      .on("focus", (event, d) => highlight(d))
      .on("blur", () => highlight(null));

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

    zoomBehavior = window.DostGraphUtils.createZoomBehavior(svg, zoomLayer, [0.4, 3]);
    window.DostGraphUtils.wireRecenter("compare-recenter", () => {
      const sel = svg.transition().duration(420);
      sel.call(zoomBehavior.transform, d3.zoomIdentity);
    });

    window.__daphneApp = { nodes, links, conceptById, themes };
  }

  function render() {
    if (!labelSel) return;
    labelSel.text((d) => labelFor(d));
    if (currentDetailTheme) showThemeDetail(currentDetailTheme);
    else if (currentDetailConcept) showConceptDetail(currentDetailConcept);
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
    return window.DostGraphUtils.getVar(name);
  }

  function labelFor(d) {
    if (d.type === "hub-ibnarabi") return "İbn Arabî";
    if (d.type === "hub-daphne") return "Daphne";
    if (d.type === "theme") return I18n.pick(d.theme, "title");
    if (d.type === "concept") return I18n.pick(d.concept, "name");
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
  let currentDetailConcept = null;

  function onNodeClick(d) {
    if (d.type === "theme") {
      currentDetailTheme = d.theme;
      currentDetailConcept = null;
      showThemeDetail(d.theme);
    } else if (d.type === "concept") {
      currentDetailTheme = null;
      currentDetailConcept = d.concept;
      showConceptDetail(d.concept);
    } else {
      detailPanel.hidden = true;
      currentDetailTheme = null;
      currentDetailConcept = null;
    }
  }

  function showThemeDetail(theme) {
    const concept = window.__daphneApp.conceptById.get(theme.ibn_arabi_concept);
    const quote = I18n.getLang() === "pt" && theme.daphne_quote_pt ? theme.daphne_quote_pt : theme.daphne_quote;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Ortak Tema", en: "Shared Theme", pt: "Tema Compartilhado" })}</p>
      <h2 class="detail-title">${I18n.pick(theme, "title")}</h2>

      <div class="detail-block detail-block--ibnarabi">
        <h3>İbn Arabî — ${concept ? I18n.pick(concept, "name") : ""}</h3>
        <p>${I18n.pick(theme, "ibn_arabi_note")}</p>
      </div>

      <div class="detail-block detail-block--daphne">
        <h3>Daphne</h3>
        <blockquote>&ldquo;${quote}&rdquo;</blockquote>
        <cite><a href="${theme.daphne_url}" target="_blank" rel="noopener">${theme.daphne_source}</a></cite>
      </div>

      <p class="detail-resonance">${I18n.pick(theme, "resonance")}</p>
    `;
    detailPanel.hidden = false;
  }

  function showConceptDetail(concept) {
    detailContent.innerHTML = `
      <p class="detail-eyebrow">İbn Arabî</p>
      <h2 class="detail-title">${I18n.pick(concept, "name")}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <p>${I18n.pick(concept, "summary")}</p>
        <cite>${(concept.sources || []).join(" · ")}</cite>
      </div>
    `;
    detailPanel.hidden = false;
  }

  function drag(sim) {
    return window.DostGraphUtils.createDragBehavior(sim);
  }
})();
