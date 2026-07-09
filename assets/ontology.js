(function () {
  "use strict";

  const I18n = window.DostI18n;

  const svg = d3.select("#graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");

  function tt(dict) {
    return I18n.pick3(dict);
  }

  I18n.applyStatic();
  I18n.renderLangSwitcher(document.getElementById("lang-switch"), () => {
    render();
    if (currentMainView === "esma") window.__esmaApp && window.__esmaApp.onLangChange();
    else if (currentMainView === "hal") window.__halApp && window.__halApp.onLangChange();
    else if (currentMainView === "bookmap") window.__bookmapApp && window.__bookmapApp.onLangChange();
  });

  detailClose.addEventListener("click", () => {
    detailPanel.hidden = true;
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !detailPanel.hidden) {
      detailPanel.hidden = true;
    }
  });

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

  fetch("data/ibn-arabi/ontology.json")
    .then((r) => r.json())
    .then((data) => {
      buildGraph(data);
      registerOntologyCrossLinks(data);
      parseHashAndGo();
      window.__dostAppReady = true;
    })
    .catch((err) => console.error("Ontoloji verisi yüklenemedi / Failed to load ontology data", err));

  let sirlarData = null;
  fetch("data/ibn-arabi/sirlar.json")
    .then((r) => r.json())
    .then((data) => {
      sirlarData = data;
      if (pendingSirlarId) goToSirlar(pendingSirlarId);
      maybeInitLandingQuote();
      render();
    })
    .catch((err) => console.error("Sırlar verisi yüklenemedi / Failed to load mysteries data", err));

  fetch("data/ibn-arabi/esma.json")
    .then((r) => r.json())
    .then((data) => {
      registerEsmaCrossLinks(data);
      render();
    })
    .catch((err) => console.error("Esmâ verisi yüklenemedi / Failed to load Esma data", err));

  fetch("data/ibn-arabi/hal.json")
    .then((r) => r.json())
    .then((data) => {
      registerHalCrossLinks(data);
      render();
    })
    .catch((err) => console.error("Hâller verisi yüklenemedi / Failed to load States data", err));

  let landingQuoteIds = null;
  fetch("data/ibn-arabi/quotes.json")
    .then((r) => r.json())
    .then((data) => {
      landingQuoteIds = data.ids;
      maybeInitLandingQuote();
    })
    .catch((err) => console.error("Alıntılar yüklenemedi / Failed to load quotes", err));

  const sirlarBtn = document.getElementById("sirlar-btn");
  if (sirlarBtn) {
    sirlarBtn.addEventListener("click", () => goToSirlar());
  }

  let currentMainView = "ontology";
  const ontologyBtn = document.getElementById("ontology-btn");
  const esmaBtn = document.getElementById("esma-btn");
  const halBtn = document.getElementById("hal-btn");
  const bookmapBtn = document.getElementById("bookmap-btn");
  const ontologyWrap = document.getElementById("ontology-wrap");
  const esmaWrap = document.getElementById("esma-wrap");
  const halWrap = document.getElementById("hal-wrap");
  const bookmapWrap = document.getElementById("bookmap-wrap");

  function setMainView(view) {
    if (currentMainView === view) return;
    currentMainView = view;
    if (ontologyBtn) ontologyBtn.classList.toggle("btn-ghost--active", view === "ontology");
    if (esmaBtn) esmaBtn.classList.toggle("btn-ghost--active", view === "esma");
    if (halBtn) halBtn.classList.toggle("btn-ghost--active", view === "hal");
    if (bookmapBtn) bookmapBtn.classList.toggle("btn-ghost--active", view === "bookmap");
    if (ontologyWrap) ontologyWrap.hidden = view !== "ontology";
    if (esmaWrap) esmaWrap.hidden = view !== "esma";
    if (halWrap) halWrap.hidden = view !== "hal";
    if (bookmapWrap) bookmapWrap.hidden = view !== "bookmap";
    const introOntology = document.getElementById("intro-ontology");
    const introEsma = document.getElementById("intro-esma");
    const introHal = document.getElementById("intro-hal");
    const introBookmap = document.getElementById("intro-bookmap");
    if (introOntology) introOntology.hidden = view !== "ontology";
    if (introEsma) introEsma.hidden = view !== "esma";
    if (introHal) introHal.hidden = view !== "hal";
    if (introBookmap) introBookmap.hidden = view !== "bookmap";
    currentDetailNode = null;
    currentDetailEdge = null;
    detailPanel.hidden = true;
    if (view === "esma") {
      currentDetailView = "esma";
      window.__esmaApp && window.__esmaApp.activate();
    } else if (view === "hal") {
      currentDetailView = "hal";
      window.__halApp && window.__halApp.activate();
    } else if (view === "bookmap") {
      currentDetailView = "bookmap";
      window.__bookmapApp && window.__bookmapApp.activate();
    } else {
      currentDetailView = null;
    }
  }

  if (ontologyBtn) ontologyBtn.addEventListener("click", () => { setMainView("ontology"); updateHash("ontoloji"); });
  if (esmaBtn) esmaBtn.addEventListener("click", () => { setMainView("esma"); updateHash("esma"); });
  if (halBtn) halBtn.addEventListener("click", () => { setMainView("hal"); updateHash("hal"); });
  if (bookmapBtn) bookmapBtn.addEventListener("click", () => { setMainView("bookmap"); updateHash("kitap"); });

  // --- Deep linking & cross-view navigation ---
  let pendingSirlarId = null;

  function updateHash(view, id) {
    const hash = "#/" + view + (id ? "/" + id : "");
    if (location.hash !== hash) history.replaceState(null, "", hash);
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

  function goToBookmap(id) {
    setMainView("bookmap");
    window.__bookmapApp && window.__bookmapApp.goToNode(id);
  }

  function goToSirlar(id) {
    currentDetailNode = null;
    currentDetailEdge = null;
    currentDetailView = "sirlar";
    if (!sirlarData) {
      pendingSirlarId = id || null;
      return;
    }
    pendingSirlarId = null;
    showSirlarPanel(id);
  }

  function parseHashAndGo() {
    const m = /^#\/(ontoloji|esma|sirlar|hal|kitap)(?:\/(.+))?$/.exec(location.hash);
    if (!m) return;
    const [, view, id] = m;
    if (view === "ontoloji") goToOntologyNode(id);
    else if (view === "esma") goToEsma(id);
    else if (view === "sirlar") goToSirlar(id);
    else if (view === "hal") goToHal(id);
    else if (view === "kitap") goToBookmap(id);
  }

  window.addEventListener("hashchange", parseHashAndGo);

  window.__dostNav = {
    goTo(view, id) {
      if (view === "ontoloji") goToOntologyNode(id);
      else if (view === "esma") goToEsma(id);
      else if (view === "sirlar") goToSirlar(id);
      else if (view === "hal") goToHal(id);
      else if (view === "kitap") goToBookmap(id);
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
    if (landingQuoteEntries.length) renderLandingQuote(true);
    if (!labelSel) return;
    labelSel.text((d) => labelFor(d));
    if (currentDetailNode) showNodeDetail(currentDetailNode);
    else if (currentDetailEdge) showEdgeDetail(currentDetailEdge);
  }

  // --- Rotating landing quote ---
  let landingQuoteEntries = [];
  let landingQuoteIndex = 0;
  let landingQuoteInited = false;

  function maybeInitLandingQuote() {
    if (landingQuoteInited || !sirlarData || !landingQuoteIds) return;
    landingQuoteInited = true;
    landingQuoteEntries = landingQuoteIds
      .map((id) => sirlarData.entries.find((e) => e.id === id))
      .filter(Boolean);
    if (!landingQuoteEntries.length) return;
    landingQuoteIndex = Math.floor(Math.random() * landingQuoteEntries.length);
    const el = document.getElementById("landing-quote");
    if (!el) return;
    el.addEventListener("click", () => {
      const entry = landingQuoteEntries[landingQuoteIndex];
      if (entry) window.__dostNav.goTo("sirlar", entry.id);
    });
    renderLandingQuote(true);
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      setInterval(() => {
        landingQuoteIndex = (landingQuoteIndex + 1) % landingQuoteEntries.length;
        renderLandingQuote(false);
      }, 22000);
    }
  }

  function renderLandingQuote(immediate) {
    const el = document.getElementById("landing-quote");
    if (!el || !landingQuoteEntries.length) return;
    const paint = () => {
      const entry = landingQuoteEntries[landingQuoteIndex];
      el.innerHTML = `<blockquote>${I18n.pick3(entry.quote)}</blockquote><cite>${entry.source}</cite>`;
    };
    if (immediate) {
      paint();
      el.classList.add("landing-quote--visible");
      return;
    }
    el.classList.remove("landing-quote--visible");
    setTimeout(() => {
      paint();
      el.classList.add("landing-quote--visible");
    }, 400);
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
