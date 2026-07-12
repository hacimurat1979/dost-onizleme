(function () {
  "use strict";

  const I18n = window.DostI18n;

  const svg = d3.select("#graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");
  const breadcrumbEl = document.getElementById("detail-breadcrumb");

  // Her görünümün detay şablonu ".detail-eyebrow" + ".detail-title" ile
  // başlıyor; bunları scroll sırasında yazı boyutu kontrollerinin hemen
  // altında sabit kalan tek bir başlık bloğuna sarıyoruz.
  function updateTypoHeightVar() {
    const controls = document.getElementById("typography-controls");
    if (!controls || !controls.offsetHeight) return;
    document.documentElement.style.setProperty("--typo-controls-height", controls.offsetHeight + "px");
  }

  function wrapStickyHead() {
    const eyebrow = detailContent.firstElementChild;
    if (!eyebrow || !eyebrow.classList.contains("detail-eyebrow")) return;
    const title = eyebrow.nextElementSibling;
    if (!title || !title.classList.contains("detail-title")) return;
    const head = document.createElement("div");
    head.className = "detail-sticky-head";
    detailContent.insertBefore(head, eyebrow);
    head.appendChild(eyebrow);
    head.appendChild(title);
    updateTypoHeightVar();
  }
  new MutationObserver(wrapStickyHead).observe(detailContent, { childList: true });
  const tooltip = document.getElementById("ontology-tooltip");
  const wrapEl = document.getElementById("ontology-wrap");

  function tt(dict) {
    return I18n.pick3(dict);
  }

  // İki kavram/ilişkinin salt metinle anlatıldığında soyut kalan bağını
  // tek bakışta gösteren küçük SVG şemalar (bkz. CLAUDE.md ikinci ilke).
  const entityDiagramRenderers = {
    "twin-truth": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 320 180" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node--venn" cx="125" cy="88" r="68"/>
        <circle class="term-diagram-node--venn" cx="195" cy="88" r="68"/>
        <text class="term-diagram-label" x="68" y="42" text-anchor="middle">${tt(d.left)}</text>
        <text class="term-diagram-note" x="68" y="150" text-anchor="middle">${tt(d.leftNote)}</text>
        <text class="term-diagram-label" x="252" y="42" text-anchor="middle">${tt(d.right)}</text>
        <text class="term-diagram-note" x="252" y="150" text-anchor="middle">${tt(d.rightNote)}</text>
        <text class="term-diagram-label term-diagram-note--accent" x="160" y="93" text-anchor="middle">${tt(d.center)}</text>
      </svg>
    `,
    "seed-fork": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 260 240" role="img" aria-label="${tt(d.note)}">
        <line class="term-diagram-tether" x1="114" y1="167" x2="73" y2="197"/>
        <line class="term-diagram-arrow" x1="130" y1="135" x2="130" y2="97" marker-end="url(#odArrowEnd)"/>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="112" y1="63" x2="73" y2="37" marker-end="url(#odArrowEnd)"/>
        <line class="term-diagram-arrow term-diagram-arrow--dashed" x1="148" y1="63" x2="187" y2="37" marker-end="url(#odArrowEnd)"/>
        <circle class="term-diagram-node" cx="130" cy="155" r="20"/>
        <text class="term-diagram-label--small" x="130" y="192" text-anchor="middle">${tt(d.seed)}</text>
        <circle class="term-diagram-node--dashed" cx="55" cy="210" r="22"/>
        <text class="term-diagram-label--small" x="55" y="215" text-anchor="middle">${tt(d.root)}</text>
        <circle class="term-diagram-node" cx="130" cy="75" r="22"/>
        <text class="term-diagram-label--small" x="130" y="80" text-anchor="middle">${tt(d.branch)}</text>
        <circle class="term-diagram-node--accent" cx="55" cy="25" r="22"/>
        <text class="term-diagram-label--small" x="55" y="30" text-anchor="middle">${tt(d.leftLeaf)}</text>
        <circle class="term-diagram-node--faint" cx="205" cy="25" r="22"/>
        <text class="term-diagram-label--small" x="205" y="30" text-anchor="middle">${tt(d.rightLeaf)}</text>
      </svg>
    `,
    "cascade-seas": (d) => {
      const xs = [45, 145, 245, 345];
      const classes = ["term-diagram-node--accent", "term-diagram-node", "term-diagram-node", "term-diagram-node--faint"];
      const circles = d.stops.map((s, i) => `
        <circle class="${classes[i]}" cx="${xs[i]}" cy="55" r="26"/>
        <text class="term-diagram-label--small" x="${xs[i]}" y="60" text-anchor="middle">${tt(s)}</text>
      `).join("");
      const arrows = [0, 1, 2].map((i) => `
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="${xs[i] + 26}" y1="55" x2="${xs[i + 1] - 26}" y2="55" marker-end="url(#odArrowEnd)"/>
      `).join("");
      return `
        <svg class="term-diagram__svg" viewBox="0 0 390 110" role="img" aria-label="${tt(d.note)}">
          ${arrows}
          ${circles}
        </svg>
      `;
    },
  };

  const ODD_DIAGRAM_DEFS = `
    <svg width="0" height="0" style="position:absolute">
      <defs>
        <marker id="odArrowEnd" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" class="term-diagram-arrowhead"/>
        </marker>
      </defs>
    </svg>
  `;

  function entityDiagramHtml(obj) {
    const renderer = obj.diagram && entityDiagramRenderers[obj.diagram.type];
    if (!renderer) return "";
    return `<div class="term-diagram-row"><div class="term-diagram-card">
      ${ODD_DIAGRAM_DEFS}
      ${renderer(obj.diagram)}
      <p class="term-diagram-caption">${tt(obj.diagram.note)}</p>
    </div></div>`;
  }

  function sirlarGestureDiagramHtml() {
    return `<div class="term-diagram-row"><div class="term-diagram-card">
      ${ODD_DIAGRAM_DEFS}
      <svg class="term-diagram__svg" viewBox="0 0 300 150" role="img" aria-label="${tt({ tr: "İşaret eder, açıklamaz", en: "Points, but does not explain", pt: "Aponta, mas não explica" })}">
        <circle class="term-diagram-node--sm" cx="34" cy="75" r="7"/>
        <line class="term-diagram-arrow term-diagram-arrow--dashed" x1="48" y1="75" x2="196" y2="75" marker-end="url(#odArrowEnd)"/>
        <line class="term-diagram-mirror" x1="208" y1="35" x2="208" y2="115"/>
        <circle class="term-diagram-node--barrier" cx="256" cy="75" r="38"/>
        <text class="term-diagram-label" x="256" y="80" text-anchor="middle">?</text>
        <text class="term-diagram-note" x="120" y="100" text-anchor="middle">${tt({ tr: "işaret", en: "gesture", pt: "gesto" })}</text>
        <text class="term-diagram-note term-diagram-note--accent" x="256" y="132" text-anchor="middle">${tt({ tr: "açıklanmaz", en: "not explained", pt: "não explicado" })}</text>
      </svg>
      <p class="term-diagram-caption">${tt({
        tr: "İbn Arabî sırrın yönünü gösterir, ama eşikte durur - içeriğini açıklamaz.",
        en: "Ibn Arabi points toward the secret, but stops at the threshold - he does not disclose its content.",
        pt: "Ibn Arabi aponta a direção do segredo, mas para no limiar - não revela seu conteúdo.",
      })}</p>
    </div></div>`;
  }

  I18n.applyStatic();
  I18n.renderLangSwitcher(document.getElementById("lang-switch"), () => {
    render();
    if (currentMainView === "esma") window.__esmaApp && window.__esmaApp.onLangChange();
    else if (currentMainView === "hal") window.__halApp && window.__halApp.onLangChange();
    else if (currentMainView === "terimler") window.__terimlerApp && window.__terimlerApp.onLangChange();
    else if (currentMainView === "cizimler") window.__cizimlerApp && window.__cizimlerApp.onLangChange();
    else if (currentMainView === "sirlar") window.__sirlarGraphApp && window.__sirlarGraphApp.onLangChange();
    else if (currentMainView === "sorular") window.__sorularApp && window.__sorularApp.onLangChange();
    else if (currentMainView === "futuhat") window.__futuhatApp && window.__futuhatApp.onLangChange();
    updateHeaderHeightVar();
  });

  // Sabit (sticky) üst kısmın gerçek yüksekliğini ölçüp detail-panel'in
  // altında başlamasını sağlayan CSS değişkeni.
  function updateHeaderHeightVar() {
    const header = document.querySelector(".app-header");
    if (header) {
      document.documentElement.style.setProperty("--app-header-height", header.offsetHeight + "px");
    }
  }
  updateHeaderHeightVar();
  window.addEventListener("resize", updateHeaderHeightVar);
  window.addEventListener("resize", updateTypoHeightVar);

  detailClose.addEventListener("click", () => {
    detailPanel.hidden = true;
  });

  const detailPrint = document.getElementById("detail-print");
  if (detailPrint) {
    detailPrint.addEventListener("click", () => {
      detailContent.querySelectorAll("details:not([open])").forEach((d) => d.setAttribute("open", ""));
      window.print();
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    // Bir adım geri: önce açık detay panelini kapat; panel zaten kapalıysa
    // ve Sırlar grafiğinde bir tema odaklanmışsa (bkz. sirlar-graph.js
    // focusOnTheme), o odağı geri al -- "mevcut durumdan bir önceki duruma."
    if (!detailPanel.hidden) {
      detailPanel.hidden = true;
      return;
    }
    if (window.__sirlarGraphApp && window.__sirlarGraphApp.isFocused && window.__sirlarGraphApp.isFocused()) {
      window.__sirlarGraphApp.unfocusTheme();
    }
  });

  // Lejant kutuları (Ontoloji/Esmâ/Hâller/Sırlar), özellikle dokunmatik/
  // tablet ekranlarda kısa viewport yüksekliğinde grafiğin üstüne düşüp
  // düğümleri kapatabiliyor -- varsayılan olarak kısık/dokunmatik
  // ekranlarda katlanmış başlasın, kullanıcı isterse açsın.
  function setupLegendToggles() {
    const collapseByDefault = window.matchMedia("(max-height: 700px)").matches
      || window.matchMedia("(pointer: coarse)").matches;
    document.querySelectorAll(".legend").forEach((legend) => {
      const toggle = legend.querySelector(".legend__toggle");
      if (!toggle) return;
      if (collapseByDefault) {
        legend.classList.add("legend--collapsed");
        toggle.setAttribute("aria-expanded", "false");
      }
      toggle.addEventListener("click", () => {
        const collapsed = legend.classList.toggle("legend--collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
      });
    });
  }
  setupLegendToggles();

  const TARGET = {
    "dhat": { x: 0.5, y: 0.09 },
    "sifat-asma": { x: 0.5, y: 0.21 },
    "ayan-sabite": { x: 0.5, y: 0.33 },
    "tecelli": { x: 0.5, y: 0.45 },
    "alem-ervah": { x: 0.20, y: 0.60 },
    "alem-misal": { x: 0.5, y: 0.60 },
    "alem-ecsam": { x: 0.80, y: 0.60 },
    "insan-i-kamil": { x: 0.5, y: 0.75 },
    "kalp": { x: 0.5, y: 0.90 },
  };

  function loadOntologyData() {
    if (window.DostViewStatus) window.DostViewStatus.showLoading("ontology-wrap");
    fetch("data/ibn-arabi/ontology.json")
      .then((r) => r.json())
      .then((data) => {
        buildGraph(data);
        registerOntologyCrossLinks(data);
        parseHashAndGo();
        window.__dostAppReady = true;
        if (window.DostViewStatus) window.DostViewStatus.hide("ontology-wrap");
      })
      .catch((err) => {
        console.error("Ontoloji verisi yüklenemedi / Failed to load ontology data", err);
        if (window.DostViewStatus) window.DostViewStatus.showError("ontology-wrap", loadOntologyData);
      });
  }
  loadOntologyData();

  // Bu üç veri seti yalnızca cross-link kaydı için gerekli; kritik olan
  // ontoloji haritasının ilk boyanmasıyla bant genişliği için yarışmasınlar
  // diye ana iş parçacığı boşta kalınca (veya en geç kısa bir gecikmeyle)
  // çekiliyor.
  const deferFetch = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));

  let sirlarData = null;
  deferFetch(() => {
    fetch("data/ibn-arabi/sirlar.json")
      .then((r) => r.json())
      .then((data) => {
        sirlarData = data;
        if (pendingSirlarId) goToSirlar(pendingSirlarId);
        render();
      })
      .catch((err) => console.error("Sırlar verisi yüklenemedi / Failed to load mysteries data", err));
  });

  deferFetch(() => {
    fetch("data/ibn-arabi/esma.json")
      .then((r) => r.json())
      .then((data) => {
        registerEsmaCrossLinks(data);
        render();
      })
      .catch((err) => console.error("Esmâ verisi yüklenemedi / Failed to load Esma data", err));
  });

  deferFetch(() => {
    fetch("data/ibn-arabi/hal.json")
      .then((r) => r.json())
      .then((data) => {
        registerHalCrossLinks(data);
        render();
      })
      .catch((err) => console.error("Hâller verisi yüklenemedi / Failed to load States data", err));
  });

  let currentMainView = "ontology";
  const ontologyBtn = document.getElementById("ontology-btn");
  const esmaBtn = document.getElementById("esma-btn");
  const halBtn = document.getElementById("hal-btn");
  const terimlerBtn = document.getElementById("terimler-btn");
  const cizimlerBtn = document.getElementById("cizimler-btn");
  const sirlarBtn = document.getElementById("sirlar-btn");
  const sorularBtn = document.getElementById("sorular-btn");
  const futuhatBtn = document.getElementById("futuhat-btn");
  const ontologyWrap = document.getElementById("ontology-wrap");
  const esmaWrap = document.getElementById("esma-wrap");
  const halWrap = document.getElementById("hal-wrap");
  const terimlerWrap = document.getElementById("terimler-wrap");
  const cizimlerWrap = document.getElementById("cizimler-wrap");
  const sirlarWrap = document.getElementById("sirlar-wrap");
  const sorularWrap = document.getElementById("sorular-wrap");
  const futuhatWrap = document.getElementById("futuhat-wrap");

  function setMainView(view) {
    if (currentMainView === view) return;
    currentMainView = view;
    if (ontologyBtn) ontologyBtn.classList.toggle("btn-ghost--active", view === "ontology");
    if (esmaBtn) esmaBtn.classList.toggle("btn-ghost--active", view === "esma");
    if (halBtn) halBtn.classList.toggle("btn-ghost--active", view === "hal");
    if (terimlerBtn) terimlerBtn.classList.toggle("btn-ghost--active", view === "terimler");
    if (cizimlerBtn) cizimlerBtn.classList.toggle("btn-ghost--active", view === "cizimler");
    if (sirlarBtn) sirlarBtn.classList.toggle("btn-ghost--active", view === "sirlar");
    if (sorularBtn) sorularBtn.classList.toggle("btn-ghost--active", view === "sorular");
    if (futuhatBtn) futuhatBtn.classList.toggle("btn-ghost--active", view === "futuhat");
    if (ontologyWrap) ontologyWrap.hidden = view !== "ontology";
    if (esmaWrap) esmaWrap.hidden = view !== "esma";
    if (halWrap) halWrap.hidden = view !== "hal";
    if (terimlerWrap) terimlerWrap.hidden = view !== "terimler";
    if (cizimlerWrap) cizimlerWrap.hidden = view !== "cizimler";
    if (sirlarWrap) sirlarWrap.hidden = view !== "sirlar";
    if (sorularWrap) sorularWrap.hidden = view !== "sorular";
    if (futuhatWrap) futuhatWrap.hidden = view !== "futuhat";
    currentDetailNode = null;
    currentDetailEdge = null;
    detailPanel.hidden = true;
    if (view === "esma") {
      currentDetailView = "esma";
      window.__esmaApp && window.__esmaApp.activate();
    } else if (view === "hal") {
      currentDetailView = "hal";
      window.__halApp && window.__halApp.activate();
    } else if (view === "terimler") {
      currentDetailView = "terimler";
      window.__terimlerApp && window.__terimlerApp.activate();
    } else if (view === "cizimler") {
      currentDetailView = "cizimler";
      window.__cizimlerApp && window.__cizimlerApp.activate();
    } else if (view === "sirlar") {
      currentDetailView = null;
      window.__sirlarGraphApp && window.__sirlarGraphApp.activate();
    } else if (view === "sorular") {
      currentDetailView = "sorular";
      window.__sorularApp && window.__sorularApp.activate();
    } else if (view === "futuhat") {
      currentDetailView = null;
      window.__futuhatApp && window.__futuhatApp.activate();
    } else {
      currentDetailView = null;
    }
  }

  if (sirlarBtn) {
    sirlarBtn.addEventListener("click", () => { goToSirlar(); updateHash("sirlar"); });
  }

  if (ontologyBtn) ontologyBtn.addEventListener("click", () => { setMainView("ontology"); updateHash("ontoloji"); });
  if (esmaBtn) esmaBtn.addEventListener("click", () => { setMainView("esma"); updateHash("esma"); });
  if (halBtn) halBtn.addEventListener("click", () => { setMainView("hal"); updateHash("hal"); });
  if (terimlerBtn) terimlerBtn.addEventListener("click", () => { setMainView("terimler"); updateHash("terimler"); });
  if (cizimlerBtn) cizimlerBtn.addEventListener("click", () => { setMainView("cizimler"); updateHash("cizimler"); });
  if (sorularBtn) sorularBtn.addEventListener("click", () => { setMainView("sorular"); updateHash("sorular"); });
  if (futuhatBtn) futuhatBtn.addEventListener("click", () => { setMainView("futuhat"); updateHash("futuhat"); });

  // --- Deep linking & cross-view navigation ---
  let pendingSirlarId = null;

  function updateHash(view, id) {
    const hash = "#/" + view + (id ? "/" + id : "");
    if (location.hash !== hash) history.replaceState(null, "", hash);
    if (id) pushBreadcrumb(view, id);
  }

  let breadcrumbTrail = [];

  function pushBreadcrumb(view, id) {
    requestAnimationFrame(() => {
      const titleEl = detailContent.querySelector(".detail-title");
      let label = "";
      if (titleEl) {
        const clone = titleEl.cloneNode(true);
        clone.querySelectorAll(".pole-badge").forEach((b) => b.remove());
        label = clone.textContent.trim();
      }
      if (!label) return;
      const last = breadcrumbTrail[breadcrumbTrail.length - 1];
      if (last && last.view === view && last.id === id) {
        last.label = label;
        renderBreadcrumb();
        return;
      }
      if (!last || last.view !== view) breadcrumbTrail = [];
      breadcrumbTrail.push({ view, id, label });
      if (breadcrumbTrail.length > 4) breadcrumbTrail.shift();
      renderBreadcrumb();
    });
  }

  function renderBreadcrumb() {
    if (!breadcrumbEl) return;
    if (breadcrumbTrail.length < 2) {
      breadcrumbEl.hidden = true;
      breadcrumbEl.innerHTML = "";
      return;
    }
    breadcrumbEl.hidden = false;
    breadcrumbEl.innerHTML = breadcrumbTrail
      .map((c, i) => {
        if (i === breadcrumbTrail.length - 1) {
          return `<span class="detail-breadcrumb__item detail-breadcrumb__item--current">${c.label}</span>`;
        }
        return `<button type="button" class="detail-breadcrumb__item" data-view="${c.view}" data-id="${c.id}">${c.label}</button>`;
      })
      .join('<span class="detail-breadcrumb__sep">›</span>');
    breadcrumbEl.querySelectorAll("button.detail-breadcrumb__item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        const id = btn.dataset.id;
        const idx = breadcrumbTrail.findIndex((c) => c.view === view && c.id === id);
        if (idx !== -1) breadcrumbTrail = breadcrumbTrail.slice(0, idx + 1);
        window.__dostNav.goTo(view, id);
      });
    });
  }

  function goToOntologyNode(id) {
    setMainView("ontology");
    const d = nodeById && nodeById.get(id);
    if (d) onNodeClick(d);
  }

  function goToEsma(id) {
    setMainView("esma");
    if (id) window.__esmaApp && window.__esmaApp.goToNode(id);
  }

  function goToHal(id) {
    setMainView("hal");
    if (id) window.__halApp && window.__halApp.goToNode(id);
  }

  function goToTerimler(id) {
    setMainView("terimler");
    window.__terimlerApp && window.__terimlerApp.goToNode(id);
  }

  function goToCizimler() {
    setMainView("cizimler");
    window.__cizimlerApp && window.__cizimlerApp.activate();
  }

  function goToSirlar(id) {
    setMainView("sirlar");
    currentDetailNode = null;
    currentDetailEdge = null;
    if (!sirlarData) {
      pendingSirlarId = id || null;
      return;
    }
    pendingSirlarId = null;
    if (!id) return;
    currentDetailView = "sirlar";
    showSirlarPanel(id);
  }

  function goToSorular(id) {
    setMainView("sorular");
    window.__sorularApp && window.__sorularApp.goToNode(id);
  }

  function goToFutuhat() {
    setMainView("futuhat");
    window.__futuhatApp && window.__futuhatApp.activate();
  }

  function parseHashAndGo() {
    const m = /^#\/(ontoloji|esma|sirlar|hal|terimler|cizimler|sorular|futuhat)(?:\/(.+))?$/.exec(location.hash);
    if (!m) return;
    const [, view, id] = m;
    if (view === "ontoloji") goToOntologyNode(id);
    else if (view === "esma") goToEsma(id);
    else if (view === "sirlar") goToSirlar(id);
    else if (view === "hal") goToHal(id);
    else if (view === "terimler") goToTerimler(id);
    else if (view === "cizimler") goToCizimler();
    else if (view === "sorular") goToSorular(id);
    else if (view === "futuhat") goToFutuhat();
  }

  window.addEventListener("hashchange", parseHashAndGo);

  window.__dostNav = {
    goTo(view, id) {
      if (view === "ontoloji") goToOntologyNode(id);
      else if (view === "esma") goToEsma(id);
      else if (view === "sirlar") goToSirlar(id);
      else if (view === "hal") goToHal(id);
      else if (view === "terimler") goToTerimler(id);
      else if (view === "cizimler") goToCizimler();
      else if (view === "sorular") goToSorular(id);
      else if (view === "futuhat") goToFutuhat();
      updateHash(view, id);
    },
    setHash: updateHash,
  };

  let simulation, nodeSel, pathSel, labelSel, nodeById;

  function buildGraph(data) {
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;

    const defs = svg.append("defs");
    ["descent", "return", "paradox"].forEach((kind) => {
      defs.append("marker")
        .attr("id", "arrow-" + kind)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 9)
        .attr("refY", 0)
        .attr("markerWidth", 7)
        .attr("markerHeight", 7)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("class", "arrowhead arrowhead--" + kind);
    });

    const nodes = data.nodes.map((n) => Object.assign({}, n));
    nodeById = new Map(nodes.map((n) => [n.id, n]));

    const links = data.edges.map((e) => Object.assign({}, e));

    nodes.forEach((n) => {
      const t = TARGET[n.id] || { x: 0.5, y: 0.5 };
      n.tx = t.x * width;
      n.ty = t.y * height;
      n.x = n.tx;
      n.y = n.ty;
    });

    simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(120).strength(0.15))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("x", d3.forceX((d) => d.tx).strength(0.85))
      .force("y", d3.forceY((d) => d.ty).strength(0.85))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + 44));

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");

    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 4])
      .filter((event) => {
        if (event.type === "wheel") return event.ctrlKey || event.metaKey;
        if (event.touches) return event.touches.length > 1;
        return !event.target.closest(".node");
      })
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform));

    svg.call(zoom).on("dblclick.zoom", null);
    window.__ontologyZoom = { svg, zoom };

    const recenterBtn = document.getElementById("ontology-recenter");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", () => {
        svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
      });
    }

    const linkGroup = zoomLayer.append("g").attr("class", "links");

    pathSel = linkGroup
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", (d) => "link link--" + d.kind)
      .attr("marker-end", (d) => "url(#arrow-" + (d.kind === "gather" ? "descent" : d.kind) + ")")
      .attr("fill", "none")
      .on("mouseenter", (event, d) => highlightEdge(d))
      .on("mouseleave", () => highlight(null))
      .on("click", (event, d) => onEdgeClick(d));

    const nodeGroup = zoomLayer.append("g").attr("class", "nodes");

    nodeSel = nodeGroup
      .selectAll("g.node")
      .data(nodes)
      .join("g")
      .attr("class", "node ontology-node")
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
      .on("mouseenter", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => { highlight(null); hideTooltip(); })
      .on("focus", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("blur", () => { highlight(null); hideTooltip(); });

    nodeSel
      .append("circle")
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    nodeSel
      .append("circle")
      .attr("class", "node-sheen")
      .attr("r", (d) => radiusFor(d));

    labelSel = nodeSel
      .append("text")
      .attr("class", "node-label")
      .attr("dy", (d) => radiusFor(d) + 14)
      .attr("text-anchor", "middle")
      .text((d) => labelFor(d));

    simulation.on("tick", () => {
      pathSel.attr("d", (d) => edgePath(d));
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    window.__ontologyApp = { nodes, links, nodeById };
  }

  function pullBack(fromX, fromY, toX, toY, dist) {
    const dx = toX - fromX, dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: toX - (dx / len) * dist, y: toY - (dy / len) * dist };
  }

  function edgePath(d) {
    const s = d.source, t = d.target;
    const pad = radiusFor(t) + 2;
    if (d.kind === "descent" || d.kind === "gather") {
      const e = pullBack(s.x, s.y, t.x, t.y, pad);
      return `M${s.x},${s.y}L${e.x},${e.y}`;
    }
    // curved bow for "return" (bow right) and "paradox" (bow left)
    const dx = t.x - s.x, dy = t.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / dist, ny = dx / dist;
    const bow = d.kind === "return" ? 90 : -70;
    const mx = (s.x + t.x) / 2 + nx * bow;
    const my = (s.y + t.y) / 2 + ny * bow;
    const e = pullBack(mx, my, t.x, t.y, pad);
    return `M${s.x},${s.y}Q${mx},${my} ${e.x},${e.y}`;
  }

  function render() {
    if (currentDetailView === "sirlar") showSirlarPanel();
    if (!labelSel) return;
    labelSel.text((d) => labelFor(d));
    if (currentDetailNode) showNodeDetail(currentDetailNode);
    else if (currentDetailEdge) showEdgeDetail(currentDetailEdge);
  }

  function registerOntologyCrossLinks(data) {
    data.nodes.forEach((n) => {
      registerCrossLinkTerm(n.name, "ontoloji", n.id);
    });
  }

  function registerEsmaCrossLinks(data) {
    data.nodes.forEach((n) => {
      registerCrossLinkTerm(n.name, "esma", n.id);
    });
  }

  function registerHalCrossLinks(data) {
    data.nodes.forEach((n) => {
      registerCrossLinkTerm(n.name, "hal", n.id);
    });
  }

  // --- Cross-linking between insights ---
  const crossLinkTermsByLang = { tr: [], en: [], pt: [] };

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function registerCrossLinkTerm(nameDict, view, id) {
    if (!nameDict) return;
    ["tr", "en", "pt"].forEach((lang) => {
      const term = nameDict[lang];
      if (term && term.length >= 4) {
        crossLinkTermsByLang[lang].push({ term, view, id });
      }
    });
  }

  function linkify(text, excludeView, excludeId) {
    if (!text) return text;
    const lang = I18n.getLang();
    const terms = crossLinkTermsByLang[lang]
      .filter((t) => !(t.view === excludeView && t.id === excludeId))
      .sort((a, b) => b.term.length - a.term.length);
    if (!terms.length) return text;
    const pattern = terms.map((t) => `(?<![\\p{L}])${escapeRegExp(t.term)}(?![\\p{L}])`).join("|");
    const re = new RegExp(pattern, "gu");
    const seen = new Set();
    return text.replace(re, (match) => {
      if (seen.has(match)) return match;
      const hit = terms.find((t) => t.term === match);
      if (!hit) return match;
      seen.add(match);
      return `<a href="#/${hit.view}/${hit.id}" class="cross-link" data-view="${hit.view}" data-id="${hit.id}">${match}</a>`;
    });
  }

  window.__dostCrossLink = { linkify };

  const SIRLAR_THEME_LABELS = {
    "suskunluk": { tr: "Suskunluk ve Perdeleme", en: "Silence and Veiling", pt: "Silêncio e Velamento" },
    "peygamber-kissalari": { tr: "Peygamber Kıssalarındaki Sırlar", en: "Secrets in the Prophets' Stories", pt: "Segredos nas Histórias dos Profetas" },
    "kader-tevhid": { tr: "Kader, Tevhid, Tenzih-Teşbih", en: "Destiny, Divine Unity, Tanzih-Tashbih", pt: "Destino, Unidade Divina, Tanzih-Tashbih" },
    "dil-ve-kelime": { tr: "Dilde ve Kelimede Gizlenen Sırlar", en: "Secrets Hidden in Language and Words", pt: "Segredos Ocultos na Língua e nas Palavras" },
    "insan-i-kamil": { tr: "İnsan-ı Kâmil ve Velâyet", en: "The Perfect Human and Sainthood", pt: "O Ser Humano Perfeito e a Santidade" },
  };

  let sirlarThemeFilter = null;

  function sirlarThemeChipsHtml() {
    const themes = Object.keys(SIRLAR_THEME_LABELS);
    const allChip = `<button type="button" class="theme-chip${sirlarThemeFilter ? "" : " theme-chip--active"}" data-theme="">${tt({ tr: "Tümü", en: "All", pt: "Todos" })}</button>`;
    const chips = themes.map((th) => {
      const count = sirlarData.entries.filter((e) => e.theme === th).length;
      return `<button type="button" class="theme-chip${sirlarThemeFilter === th ? " theme-chip--active" : ""}" data-theme="${th}">${tt(SIRLAR_THEME_LABELS[th])} <span class="theme-chip__count">${count}</span></button>`;
    }).join("");
    return `<div class="theme-chips">${allChip}${chips}</div>`;
  }

  function sirlarEntryHtml(entry, i, openFirst) {
    return `
      <details class="insight" id="sir-${entry.id}" ${i === 0 && openFirst ? "open" : ""}>
        <summary>${volumeLabel(entry.volume)} — ${I18n.pick3(entry.topic)}</summary>
        <div class="detail-block detail-block--sir">
          <blockquote>${I18n.pick3(entry.quote)}</blockquote>
          <p>${linkify(I18n.pick3(entry.note), null, null)}</p>
          <cite>${entry.source}</cite>
        </div>
      </details>
    `;
  }

  function showSirlarPanel(focusId) {
    if (!sirlarData) return;
    if (focusId) sirlarThemeFilter = null;
    const entries = sirlarThemeFilter
      ? sirlarData.entries.filter((e) => e.theme === sirlarThemeFilter)
      : sirlarData.entries;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "İşaret Edilen, Açıklanmayan", en: "Pointed To, Not Explained", pt: "Apontado, Não Explicado" })}</p>
      <h2 class="detail-title">${tt({ tr: "Sırlar", en: "Mysteries", pt: "Mistérios" })}</h2>
      <p class="detail-resonance">${I18n.pick3(sirlarData.intro)}</p>
      ${sirlarGestureDiagramHtml()}
      ${sirlarThemeChipsHtml()}
      ${entries.map((e, i) => sirlarEntryHtml(e, i, !focusId)).join("")}
    `;
    detailContent.querySelectorAll(".theme-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        sirlarThemeFilter = chip.dataset.theme || null;
        showSirlarPanel();
      });
    });
    detailPanel.hidden = false;
    if (focusId) {
      const el = document.getElementById("sir-" + focusId);
      if (el) {
        el.open = true;
        el.classList.add("insight--focus");
        setTimeout(() => el.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
        setTimeout(() => el.classList.remove("insight--focus"), 2600);
      }
    }
  }

  const RADIUS_BY_ID = {
    "dhat": 22,
    "sifat-asma": 15,
    "ayan-sabite": 14,
    "tecelli": 14,
    "insan-i-kamil": 18,
    "kalp": 16,
  };

  function radiusFor(d) {
    return RADIUS_BY_ID[d.id] || 13;
  }

  const LAYER_COLOR = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#2a78d6", "#1c5cab", "#0d366b"];
  const LAYER_COLOR_DARK = ["#184f95", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#86b6ef", "#cde2fb"];

  function isDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function colorFor(d) {
    if (d.id === "insan-i-kamil") return getVar("--series-daphne");
    if (d.id === "kalp") return getVar("--series-theme");
    const ramp = isDark() ? LAYER_COLOR_DARK : LAYER_COLOR;
    return ramp[Math.min(d.layer, ramp.length - 1)];
  }

  function getVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function labelFor(d) {
    return I18n.pick3(d.name);
  }

  function highlight(d) {
    if (!d) {
      pathSel.classed("link--highlight", false);
      nodeSel.style("opacity", 1);
      return;
    }
    const connected = new Set([d.id]);
    pathSel.each((l) => {
      if (l.source.id === d.id) connected.add(l.target.id);
      if (l.target.id === d.id) connected.add(l.source.id);
    });
    pathSel.classed("link--highlight", (l) => l.source.id === d.id || l.target.id === d.id);
    nodeSel.style("opacity", (n) => (connected.has(n.id) ? 1 : 0.3));
  }

  function highlightEdge(d) {
    pathSel.classed("link--highlight", (l) => l === d);
    nodeSel.style("opacity", (n) => (n.id === d.source.id || n.id === d.target.id ? 1 : 0.3));
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

  let currentDetailNode = null;
  let currentDetailEdge = null;
  let currentDetailView = null;

  function onNodeClick(d) {
    currentDetailNode = d;
    currentDetailEdge = null;
    currentDetailView = null;
    showNodeDetail(d);
    updateHash("ontoloji", d.id);
  }

  function onEdgeClick(l) {
    currentDetailNode = null;
    currentDetailEdge = l;
    currentDetailView = null;
    showEdgeDetail(l);
    updateHash("ontoloji", "edge/" + l.source.id + "-" + l.target.id);
  }

  const VOLUME_LABEL_OVERRIDE = {
    "fusus-konuk": { tr: "Füsûsu'l-Hikem", en: "Fusus al-Hikam", pt: "Fusus al-Hikam" },
    "fukuk-konevi": { tr: "Fusûsu'l-Hikem'in Sırları (Konevî)", en: "The Secrets of the Fusus (Qunawi)", pt: "Os Segredos do Fusus (Qunawi)" },
    "izutsu-anahtar": { tr: "Anahtar-Kavramlar (İzutsu)", en: "Key Concepts (Izutsu)", pt: "Conceitos-Chave (Izutsu)" },
    "affifi-tasavvuf": { tr: "Tasavvuf Felsefesi (Affifi)", en: "The Mystical Philosophy (Affifi)", pt: "A Filosofia Mística (Affifi)" },
    "varlik-agaci": { tr: "Varlık Ağacı (Şeceretü'l-Kevn)", en: "The Tree of Being (Shajarat al-Kawn)", pt: "A Árvore do Ser (Shajarat al-Kawn)" },
    "ozun-ozu": { tr: "Özün Özü (Lübbü'l-Lübb)", en: "The Kernel of the Kernel (Lubb al-Lubb)", pt: "O Cerne do Cerne (Lubb al-Lubb)" },
    "tedbirat-konuk": { tr: "et-Tedbîrâtü'l-İlâhiyye (Konuk)", en: "et-Tadbirat al-Ilahiyya (Konuk)", pt: "et-Tadbirat al-Ilahiyya (Konuk)" },
    "risaleler-1": { tr: "İbn Arabî'nin Risaleleri, 1. Cild", en: "The Epistles of Ibn Arabi, Vol. 1", pt: "As Epístolas de Ibn Arabi, Vol. 1" },
    "risaleler-2": { tr: "İbn Arabî'nin Risaleleri, 2. Cild", en: "The Epistles of Ibn Arabi, Vol. 2", pt: "As Epístolas de Ibn Arabi, Vol. 2" },
    "el-bulga": { tr: "El-Bülga fi'l-Hikme", en: "Al-Bulgha fi'l-Hikma", pt: "Al-Bulgha fi'l-Hikma" },
  };

  function volumeLabel(n) {
    if (VOLUME_LABEL_OVERRIDE[n]) return tt(VOLUME_LABEL_OVERRIDE[n]);
    return tt({ tr: `Cilt ${n}`, en: `Volume ${n}`, pt: `Volume ${n}` });
  }

  const VOLUME_SOURCE_MATCH = {
    "fusus-konuk": "Fusûsu'l-Hikem Tercüme ve Şerhi (Ahmed Avni Konuk)",
    "fukuk-konevi": "El-Fükük fi Esrâr-ı Müstenidât-ı Hikemi'l-Fusûs (Sadreddin Konevî",
    "izutsu-anahtar": "İbn Arabî'nin Fusûsu'ndaki Anahtar-Kavramlar (Toshihiko İzutsu",
    "affifi-tasavvuf": "Muhyiddîn İbnü'l-Arabî'nin Tasavvuf Felsefesi (A. E. Affifi",
    "varlik-agaci": "Şeceretü'l-Kevn / Varlık Ağacı",
    "tedbirat-konuk": "et-Tedbîrâtü'l-İlâhiyye",
    "ozun-ozu": "Özün Özü / Lübbü'l-Lübb",
    "risaleler-1": "İbn Arabî'nin Risaleleri, 1. Cild",
    "risaleler-2": "İbn Arabî'nin Risaleleri, 2. Cild",
    "el-bulga": "El-Bülga fi'l-Hikme",
  };

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

  function showNodeDetail(d) {
    const metadataHtml = window.__graphEnhancement
      ? (() => {
          const meta = window.__graphEnhancement.getMetadata(d.id);
          if (!meta) return "";
          return `<div class="detail-block detail-block--metadata">
            <p class="detail-metadata__category">${meta.category}</p>
            <p class="detail-metadata__meaning">${meta.meaning}</p>
          </div>`;
        })()
      : "";

    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Varlık Mertebesi", en: "Level of Being", pt: "Nível do Ser" })}</p>
      <h2 class="detail-title">${I18n.pick3(d.name)}</h2>
      ${metadataHtml}
      <div class="detail-block detail-block--ibnarabi">
        <h3>${I18n.pick3(d.short)}</h3>
        <p>${linkify(I18n.pick3(d.summary), "ontoloji", d.id)}</p>
      </div>
      ${analogyHtml(d.analogy)}
      ${entityDiagramHtml(d)}
      ${insightsHtml(d.insights, d.sources, "ontoloji", d.id)}
      ${relatedEdgesHtml(d)}
    `;
    detailPanel.hidden = false;
    if (nodeSel) nodeSel.classed("node--active", (n) => n.id === d.id);
  }

  function relatedEdgesHtml(d) {
    const outgoing = window.__ontologyApp.links.filter((l) => l.source.id === d.id);
    const incoming = window.__ontologyApp.links.filter((l) => l.target.id === d.id);
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
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "İlişkiler", en: "Relations", pt: "Relações" })}</p>${items}`;
  }

  function showEdgeDetail(l) {
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${I18n.pick3(l.relation)}</p>
      <h2 class="detail-title">${I18n.pick3(l.source.name)} → ${I18n.pick3(l.target.name)}</h2>
      ${entityDiagramHtml(l)}
      <div class="detail-block detail-block--ibnarabi">
        <p>${linkify(I18n.pick3(l.nature), null, null)}</p>
        ${insightsHtml(l.insights, null, null, null)}
      </div>
    `;
    detailPanel.hidden = false;
    if (nodeSel) nodeSel.classed("node--active", false);
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
