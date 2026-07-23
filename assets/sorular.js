(function () {
  "use strict";

  const I18n = window.DostI18n;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = d3.select("#sorular-graph");

  const CATEGORY_COLOR_VAR = {
    "en-temel": "--series-sorular-en-temel",
    "varlik": "--series-sorular-varlik",
    "bilgi": "--series-sorular-bilgi",
    "insan": "--series-sorular-insan",
    "allah": "--series-sorular-allah",
    "kozmos": "--series-sorular-kozmos",
    "kuran": "--series-sorular-kuran",
    "metot": "--series-sorular-metot",
    "deneyim": "--series-sorular-deneyim",
  };

  function getVar(name) {
    return window.DostGraphUtils.getVar(name);
  }

  function colorFor(d) {
    return getVar(CATEGORY_COLOR_VAR[d.category.id] || "--series-theme");
  }

  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const tooltip = document.getElementById("sorular-tooltip");
  const wrapEl = document.getElementById("sorular-wrap");
  const backBtn = document.getElementById("sorular-back");

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

  let sorularData = null;
  let dataPromise = null;
  let categoryById = new Map();
  let questionIndex = new Map(); // question id -> { question, category }
  let nodes = [];
  let nodeById = new Map();
  let links = [];
  let zoomLayer, linkGroup, nodeGroup;
  let nodeSel, linkSel;
  let zoomBehavior;
  let simulation;
  let currentDetailQuestion = null;
  let width = 800, height = 600;

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("sorular-wrap");
    dataPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/sorular.json")
      .then((data) => {
        sorularData = data;
        categoryById = new Map(data.categories.map((c) => [c.id, c]));
        questionIndex = new Map();
        data.categories.forEach((c) => {
          c.questions.forEach((q) => questionIndex.set(q.id, { question: q, category: c }));
        });
        if (window.DostViewStatus) window.DostViewStatus.hide("sorular-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Sorular verisi yüklenemedi / Failed to load Questions data", err);
        dataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("sorular-wrap", () => window.__sorularApp.activate());
      });
    return dataPromise;
  }

  function labelFor(q) {
    const label = I18n.pick3(q.question);
    return label.length > 30 ? label.slice(0, 29) + "…" : label;
  }

  // Her kategoriye bir daire dilimi ayrılıyor (9 kategori = 40 derece);
  // bir kategorinin soruları o dilim içinde altın açıyla (phyllotaxis)
  // yayılarak başlangıç konumunu alıyor -- sonra kuvvet benzetimi devralıp
  // ilişkilerin (relations) çektiği sorulara göre bu konumları yeniden
  // düzenliyor. Böylece kategoriler gevşekçe bir arada kalırken, gerçek
  // çapraz-ilişkiler kümeler arasında görünür köprüler kurabiliyor.
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  function buildGraphData(data) {
    const cats = data.categories;
    const sectorSpan = (2 * Math.PI) / cats.length;
    const items = [];
    cats.forEach((cat, ci) => {
      const sectorCenter = -Math.PI / 2 + ci * sectorSpan;
      cat.questions.forEach((q, qi) => {
        items.push({
          id: q.id,
          question: q,
          category: cat,
          sectorAngle: sectorCenter + (qi % 2 === 0 ? 1 : -1) * (qi * 0.35 * sectorSpan / Math.max(1, cat.questions.length)),
          sectorIndex: qi,
        });
      });
    });
    const relLinks = (data.relations || [])
      .filter((r) => items.some((n) => n.id === r.from) && items.some((n) => n.id === r.to))
      .map((r) => Object.assign({}, r));
    const degree = new Map();
    relLinks.forEach((r) => {
      degree.set(r.from, (degree.get(r.from) || 0) + 1);
      degree.set(r.to, (degree.get(r.to) || 0) + 1);
    });
    items.forEach((n) => { n.degree = degree.get(n.id) || 0; });
    return { nodes: items, links: relLinks };
  }

  function radiusFor(d) {
    return 9 + Math.min(6, d.degree) * 1.6;
  }

  function relationNote(r) {
    return r && r.note ? I18n.pick3(r.note) : "";
  }

  function renderGraph() {
    svg.selectAll("*").remove();

    zoomLayer = svg.append("g").attr("class", "sorular-canvas");
    linkGroup = zoomLayer.append("g").attr("class", "sorular-links");
    nodeGroup = zoomLayer.append("g").attr("class", "sorular-nodes");
    const centerGroup = zoomLayer.append("g").attr("class", "sorular-center");

    width = svg.node().clientWidth || 800;
    height = svg.node().clientHeight || 600;
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");

    const cx = width / 2;
    const cy = height / 2;
    const layoutRadius = Math.max(140, Math.min(width, height) / 2 - 70);

    const built = buildGraphData(sorularData);
    nodes = built.nodes;
    links = built.links;
    nodeById = new Map(nodes.map((n) => [n.id, n]));
    links.forEach((l) => {
      l.source = l.from;
      l.target = l.to;
    });

    nodes.forEach((n) => {
      const r = layoutRadius * (0.35 + 0.65 * ((n.sectorIndex + 1) / (categoryById.get(n.category.id).questions.length + 1)));
      n.x = cx + r * Math.cos(n.sectorAngle);
      n.y = cy + r * Math.sin(n.sectorAngle);
      n.tx = cx + layoutRadius * 0.55 * Math.cos(n.sectorAngle);
      n.ty = cy + layoutRadius * 0.55 * Math.sin(n.sectorAngle);
    });

    // Merkezde, sitenin daire-merkez ilkesine uygun sessiz, nefes alan bir
    // odak noktası -- tıklanabilir bir "hub" değil, hâlâ açık kalan sorunun
    // kendisini sezdiren dekoratif bir işaret (bkz. Ontoloji'deki Zât
    // düğümünün aynı .node-halo soluma deseni).
    centerGroup.attr("transform", `translate(${cx},${cy})`).attr("aria-hidden", "true");
    centerGroup.append("circle").attr("class", "node-halo").attr("r", 34);
    centerGroup.append("circle").attr("class", "sorular-center__core").attr("r", 5);

    if (simulation) simulation.stop();
    simulation = d3.forceSimulation(nodes)
      .alphaDecay(0.05)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(95).strength(0.35))
      .force("charge", d3.forceManyBody().strength(-90))
      .force("x", d3.forceX((d) => d.tx).strength(0.06))
      .force("y", d3.forceY((d) => d.ty).strength(0.06))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + 20));

    zoomBehavior = window.DostGraphUtils.createZoomBehavior(svg, zoomLayer, [0.4, 3], (event) => !event.target.closest(".node"));

    const recenterBtn = document.getElementById("sorular-recenter");
    if (recenterBtn) recenterBtn.onclick = () => zoomToFit(true);

    if (backBtn) {
      backBtn.hidden = !currentDetailQuestion;
      backBtn.onclick = () => showAllQuestionsList();
    }

    linkSel = linkGroup.selectAll("path.sorular-link")
      .data(links, (l) => l.from + "->" + l.to)
      .join("path")
      .attr("class", "sorular-link")
      .attr("fill", "none")
      .on("mouseenter", (event, l) => highlightLink(l))
      .on("mouseleave", () => highlightLink(null));

    nodeSel = nodeGroup.selectAll("g.sorular-node")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("class", "node sorular-node")
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d) => I18n.pick3(d.question.question))
      .call(drag(simulation))
      .on("click", (event, d) => openQuestion(d))
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          openQuestion(d);
        }
      })
      .on("mouseenter", (event, d) => { highlightNode(d); showTooltip(d, event); })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => { highlightNode(null); hideTooltip(); })
      .on("focus", (event, d) => { highlightNode(d); showTooltip(d, event); })
      .on("blur", () => { highlightNode(null); hideTooltip(); });

    nodeSel.append("circle")
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));
    nodeSel.append("circle")
      .attr("class", "node-sheen")
      .attr("r", (d) => radiusFor(d));

    nodeSel.append("text")
      .attr("class", "node-label")
      .attr("dy", (d) => radiusFor(d) + 13)
      .attr("text-anchor", "middle")
      .text((d) => labelFor(d.question));

    if (currentDetailQuestion) {
      nodeSel.classed("sorular-node--active", (n) => n.id === currentDetailQuestion.id);
    }

    simulation.on("tick", () => {
      linkSel.attr("d", (d) => linkPath(d));
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // İlk zoomToFit, düğümler henüz kuvvet benzetiminin başlangıç
    // konumlarındayken (tek bir anda) hesaplanıyor -- ama ilişkiler
    // (relations) bazı düğümleri (özellikle "En Temel Soru" gibi tek
    // sorulu, yalnız bir dilimdeki düğümleri) benzetim otururken kendi
    // diliminin çok dışına çekebiliyor. Benzetim İLK KEZ sakinleşince
    // ("end" olayı) görünümü son konumlara göre bir kez daha ortalıyoruz
    // ki hiçbir düğüm kenarda/başlığın altında kalmasın -- ama bunu
    // sadece ilk yerleşimde yapıyoruz; bir düğümü sürükleyip bıraktıktan
    // sonra da benzetim yeniden "end"e ulaşır, o an görünümü otomatik
    // kaydırmak kullanıcının az önce elle yaptığı yerleşimi bozar.
    let settledOnce = false;
    simulation.on("end", () => {
      if (settledOnce) return;
      settledOnce = true;
      zoomToFit(true);
    });

    zoomToFit(false);
  }

  function linkPath(d) {
    const s = d.source, t = d.target;
    const dx = t.x - s.x, dy = t.y - s.y;
    const dr = Math.sqrt(dx * dx + dy * dy) * 1.6;
    return `M${s.x},${s.y}A${dr},${dr} 0 0,1 ${t.x},${t.y}`;
  }

  function drag(sim) {
    return window.DostGraphUtils.createDragBehavior(sim);
  }

  function zoomToFit(animate) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    nodes.forEach((d) => {
      x0 = Math.min(x0, d.x); x1 = Math.max(x1, d.x);
      y0 = Math.min(y0, d.y); y1 = Math.max(y1, d.y);
    });
    x0 -= 60; x1 += 60; y0 -= 50; y1 += 50;
    const boxW = Math.max(1, x1 - x0);
    const boxH = Math.max(1, y1 - y0);
    const [minScale, maxScale] = zoomBehavior.scaleExtent();
    const scale = Math.min(maxScale, width / boxW, height / boxH);
    const clampedScale = Math.max(minScale, scale);
    const tx = width / 2 - clampedScale * (x0 + boxW / 2);
    const ty = height / 2 - clampedScale * (y0 + boxH / 2);
    const transform = d3.zoomIdentity.translate(tx, ty).scale(clampedScale);
    const sel = (animate && !reduceMotion) ? svg.transition().duration(500) : svg;
    sel.call(zoomBehavior.transform, transform);
  }

  function connectedIds(d) {
    const set = new Set([d.id]);
    links.forEach((l) => {
      if (l.source.id === d.id) set.add(l.target.id);
      if (l.target.id === d.id) set.add(l.source.id);
    });
    return set;
  }

  function highlightNode(d) {
    if (!d) {
      nodeSel.style("opacity", 1);
      linkSel.classed("sorular-link--highlight", false).style("opacity", null);
      return;
    }
    const connected = connectedIds(d);
    nodeSel.style("opacity", (n) => (connected.has(n.id) ? 1 : 0.3));
    linkSel
      .classed("sorular-link--highlight", (l) => l.source.id === d.id || l.target.id === d.id)
      .style("opacity", (l) => (l.source.id === d.id || l.target.id === d.id ? 1 : 0.15));
  }

  function highlightLink(l) {
    if (!l) {
      nodeSel.style("opacity", 1);
      linkSel.classed("sorular-link--highlight", false).style("opacity", null);
      return;
    }
    const ids = new Set([l.source.id, l.target.id]);
    nodeSel.style("opacity", (n) => (ids.has(n.id) ? 1 : 0.3));
    linkSel.classed("sorular-link--highlight", (r) => r === l).style("opacity", (r) => (r === l ? 1 : 0.15));
  }

  function showTooltip(d, event) {
    if (!tooltip) return;
    tooltip.innerHTML = `<div class="node-hover-tip__title">${I18n.pick3(d.question.question)}</div>`;
    tooltip.hidden = false;
    moveTooltip(event);
  }

  function moveTooltip(event) {
    window.DostGraphUtils.moveTooltip(tooltip, wrapEl, event);
  }

  function hideTooltip() {
    window.DostGraphUtils.hideTooltip(tooltip);
  }

  function analogyHtml(analogy) {
    if (!analogy) return "";
    return `<div class="detail-analogy">
      <p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p>
      <p>${I18n.pick3(analogy)}</p>
    </div>`;
  }

  function crossLinkHtml(q) {
    if (!q.link) return "";
    const view = q.link.view;
    const id = q.link.id;
    const base = window.__dostRouteBase || "";
    const href = id ? `${base}/${view}/${id}` : `${base}/${view}`;
    const label = q.linkLabel ? I18n.pick3(q.linkLabel) : tt({ tr: "Devamını oku", en: "Read more", pt: "Ler mais" });
    return `<a class="cross-link sorular-readmore" href="${href}">${label} →</a>`;
  }

  function sourceHtml(q) {
    if (!q.source) return "";
    return `<cite class="sorular-source">${q.source}</cite>`;
  }

  // Bir sorunun ilişkili olduğu diğer soruları (relations[]), her birinin
  // NEDEN ilişkili olduğuna dair kısa notla birlikte, tıklanabilir satırlar
  // olarak gösterir -- grafikteki çizgileri metin hâlinde de dolaşılabilir
  // kılıyor (özellikle dokunmatik/klavye kullanıcıları için).
  function relatedQuestionsHtml(q) {
    const rel = (sorularData.relations || []).filter((r) => r.from === q.id || r.to === q.id);
    if (!rel.length) return "";
    const rows = rel.map((r) => {
      const otherId = r.from === q.id ? r.to : r.from;
      const entry = questionIndex.get(otherId);
      if (!entry) return "";
      return `<button class="sorular-question-row sorular-question-row--related" type="button" data-id="${otherId}">
        <span>
          <span class="sorular-related__q">${I18n.pick3(entry.question.question)}</span>
          <span class="sorular-related__note">${relationNote(r)}</span>
        </span>
        <span class="sorular-question-row__arrow" aria-hidden="true">→</span>
      </button>`;
    }).join("");
    return `
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlişkili Sorular", en: "Related Questions", pt: "Perguntas Relacionadas" })}</p>
      <div class="sorular-question-list">${rows}</div>
    `;
  }

  function showAllQuestionsList() {
    currentDetailQuestion = null;
    if (nodeSel) nodeSel.classed("sorular-node--active", false);
    highlightNode(null);
    if (backBtn) backBtn.hidden = true;
    // Bir soruya tıklamak grafiği o düğüme kaydırıp yakınlaştırıyordu
    // (panTo); "Bütün Sorular"a dönüş, kameranın da bütün ağı gösteren
    // genel görünüme dönmesi anlamına gelmeli -- yoksa kullanıcı panelin
    // sıfırlandığını görüp de grafiğin hâlâ eski, yakınlaştırılmış hâlde
    // kaldığını fark ederdi (esc'nin "önceki hâle dönmüyor" hissi burada
    // da geçerli olurdu).
    if (zoomBehavior && nodes.length) zoomToFit(true);
    const introBlock = `<div class="detail-block detail-block--ibnarabi"><p>${I18n.pick3(sorularData.intro)}</p></div>`;
    const sections = sorularData.categories.map((cat) => {
      const rows = cat.questions.map((q) => `
        <button class="sorular-question-row" type="button" data-id="${q.id}">
          <span>${I18n.pick3(q.question)}</span>
          <span class="sorular-question-row__arrow" aria-hidden="true">→</span>
        </button>
      `).join("");
      return `
        <p class="detail-eyebrow detail-eyebrow--section">${I18n.pick3(cat.name)}</p>
        <div class="sorular-question-list">${rows}</div>
      `;
    }).join("");

    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Sorular", en: "Questions", pt: "Perguntas" })}</p>
      <h2 class="detail-title">${tt({ tr: "Bütün Sorular", en: "All Questions", pt: "Todas as Perguntas" })}</h2>
      ${introBlock}
      ${sections}
    `;
    wireQuestionRows();
    detailPanel.hidden = false;
  }

  function wireQuestionRows() {
    detailContent.querySelectorAll(".sorular-question-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const entry = questionIndex.get(btn.dataset.id);
        if (entry) {
          const node = nodeById.get(btn.dataset.id);
          if (node) openQuestion(node); else showQuestionDetail(entry.question);
        }
      });
    });
  }

  function openQuestion(d) {
    if (nodeSel) nodeSel.classed("sorular-node--active", (n) => n.id === d.id);
    highlightNode(d);
    panTo(d);
    showQuestionDetail(d.question);
  }

  function panTo(d) {
    if (!zoomBehavior || reduceMotion) return;
    const currentTransform = d3.zoomTransform(svg.node());
    const scale = Math.max(currentTransform.k, 1);
    const tx = width / 2 - scale * d.x;
    const ty = height / 2 - scale * d.y;
    svg.transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function showQuestionDetail(q) {
    currentDetailQuestion = q;
    if (backBtn) backBtn.hidden = false;
    const cat = questionIndex.get(q.id) ? questionIndex.get(q.id).category : null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow"><button class="sorular-back-link" type="button">← ${tt({ tr: "Bütün Sorular", en: "All Questions", pt: "Todas as Perguntas" })}</button></p>
      <h2 class="detail-title">${I18n.pick3(q.question)}</h2>
      <p class="sorular-category-tag">${cat ? I18n.pick3(cat.name) : ""}</p>
      <div class="detail-block detail-block--ibnarabi">
        <p>${linkify(I18n.pick3(q.answer), "sorular", q.id)}</p>
        ${sourceHtml(q)}
      </div>
      ${analogyHtml(q.analogy)}
      ${crossLinkHtml(q)}
      ${relatedQuestionsHtml(q)}
    `;
    detailContent.querySelector(".sorular-back-link").addEventListener("click", () => {
      showAllQuestionsList();
    });
    wireQuestionRows();
    detailPanel.hidden = false;
    window.__dostNav && window.__dostNav.setHash("sorular", q.id);
  }

  function render() {
    if (!sorularData) return;
    if (nodeSel) {
      nodeSel.selectAll("text.node-label").text((d) => labelFor(d.question));
    }
    if (currentDetailQuestion) {
      showQuestionDetail(currentDetailQuestion);
    } else if (detailPanel && !detailPanel.hidden) {
      showAllQuestionsList();
    }
  }

  // Bir önceki tasarımda ESC, paylaşılan (ontology.js'teki) genel dinleyici
  // yüzünden sadece detay panelini kapatıyordu; grafiğin kendi "seçili
  // düğüm" ve opaklık durumunu sıfırlamıyordu -- kullanıcı "önceki hâline
  // dönemiyorum" hissi yaşıyordu. Esma/Sırlar grafiklerindeki desenle aynı
  // şekilde, sadece bu görünüm ekranda görünürken (wrapEl.hidden değilken)
  // devreye giren yerel bir dinleyici ekliyoruz.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (wrapEl.hidden) return;
    if (!currentDetailQuestion) return;
    showAllQuestionsList();
  });

  window.__sorularApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        if (!nodes.length) {
          renderGraph();
          showAllQuestionsList();
        }
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        if (!nodes.length) renderGraph();
        if (questionIndex.has(id)) {
          const node = nodeById.get(id);
          if (node) openQuestion(node); else showQuestionDetail(questionIndex.get(id).question);
        } else if (categoryById.has(id)) {
          showAllQuestionsList();
        } else {
          showAllQuestionsList();
        }
      });
    },
    onLangChange() {
      render();
    },
  };
})();
