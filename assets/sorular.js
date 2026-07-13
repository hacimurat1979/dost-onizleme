(function () {
  "use strict";

  const I18n = window.DostI18n;
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
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function colorFor(d) {
    const catId = d.kind === "category" ? d.id : currentCategory.id;
    return getVar(CATEGORY_COLOR_VAR[catId] || "--series-theme");
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
  let zoomLayer, linkGroup, nodeGroup;
  let zoomBehavior;
  let currentNodes = [];
  let currentLevel = "categories"; // "categories" | "questions"
  let currentCategory = null;
  let currentDetailQuestion = null;

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("sorular-wrap");
    dataPromise = fetch("data/ibn-arabi/sorular.json")
      .then((r) => r.json())
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

  function labelFor(dict) {
    return I18n.pick3(dict);
  }

  function layoutNodes(items, cx, cy, radius) {
    const n = items.length;
    items.forEach((node, i) => {
      const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
      node.x = cx + radius * Math.cos(angle);
      node.y = cy + radius * Math.sin(angle);
    });
  }

  function renderLevel() {
    svg.selectAll("*").remove();

    zoomLayer = svg.append("g").attr("class", "sorular-canvas");
    linkGroup = zoomLayer.append("g").attr("class", "sorular-links");
    nodeGroup = zoomLayer.append("g").attr("class", "sorular-nodes");
    const hubGroup = zoomLayer.append("g").attr("class", "sorular-hub");

    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(110, Math.min(width, height) / 2 - 100);

    const items = currentLevel === "categories"
      ? sorularData.categories.map((c) => ({ id: c.id, kind: "category", data: c }))
      : currentCategory.questions.map((q) => ({ id: q.id, kind: "question", data: q }));

    layoutNodes(items, cx, cy, radius);
    currentNodes = items;

    const hubLabel = currentLevel === "categories"
      ? tt({ tr: "Sorular", en: "Questions", pt: "Perguntas" })
      : labelFor(currentCategory.name);

    hubGroup.append("circle")
      .attr("class", "sorular-hub__circle")
      .attr("cx", cx).attr("cy", cy).attr("r", currentLevel === "categories" ? 30 : 26)
      .attr("tabindex", currentLevel === "questions" ? "0" : "-1")
      .attr("role", currentLevel === "questions" ? "button" : null)
      .attr("aria-label", currentLevel === "questions" ? tt({ tr: "Kategorilere dön", en: "Back to categories", pt: "Voltar às categorias" }) : null)
      .style("cursor", currentLevel === "questions" ? "pointer" : "default")
      .on("click", () => {
        if (currentLevel === "questions") showCategories();
      });

    hubGroup.append("circle")
      .attr("class", "node-sheen")
      .attr("cx", cx).attr("cy", cy).attr("r", currentLevel === "categories" ? 30 : 26)
      .style("pointer-events", "none");

    hubGroup.append("text")
      .attr("class", "sorular-hub__label")
      .attr("x", cx).attr("y", cy)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(hubLabel);

    if (currentLevel === "questions") {
      hubGroup.append("text")
        .attr("class", "sorular-hub__back")
        .attr("x", cx).attr("y", cy + 44)
        .attr("text-anchor", "middle")
        .text("← " + tt({ tr: "Sorular", en: "Questions", pt: "Perguntas" }));
    }

    linkGroup.selectAll("line.sorular-spoke")
      .data(items, (d) => d.id)
      .join("line")
      .attr("class", "sorular-spoke")
      .attr("x1", cx).attr("y1", cy)
      .attr("x2", (d) => d.x).attr("y2", (d) => d.y);

    zoomBehavior = d3.zoom()
      .scaleExtent([0.5, 3])
      .filter((event) => {
        if (event.type === "wheel") return event.ctrlKey || event.metaKey;
        if (event.touches) return event.touches.length > 1;
        return true;
      })
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform));
    svg.call(zoomBehavior).on("dblclick.zoom", null);

    const recenterBtn = document.getElementById("sorular-recenter");
    if (recenterBtn) recenterBtn.onclick = () => zoomToFit(true, items, cx, cy);

    if (backBtn) {
      backBtn.hidden = currentLevel !== "questions";
      backBtn.onclick = () => showCategories();
    }

    const nodeSel = nodeGroup.selectAll("g.sorular-node")
      .data(items, (d) => d.id)
      .join("g")
      .attr("class", "node sorular-node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d) => labelFor(d.kind === "category" ? d.data.name : d.data.question))
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

    nodeSel.append("circle")
      .attr("r", currentLevel === "categories" ? 19 : 15)
      .attr("fill", (d) => colorFor(d));
    nodeSel.append("circle")
      .attr("class", "node-sheen")
      .attr("r", currentLevel === "categories" ? 19 : 15);

    nodeSel.append("text")
      .attr("class", "node-label")
      .attr("dy", (currentLevel === "categories" ? 19 : 15) + 13)
      .attr("text-anchor", "middle")
      .text((d) => {
        const label = labelFor(d.kind === "category" ? d.data.name : d.data.question);
        return label.length > 28 ? label.slice(0, 27) + "…" : label;
      });

    if (currentDetailQuestion) {
      nodeGroup.selectAll("g.sorular-node").classed("sorular-node--active", (n) => n.id === currentDetailQuestion.id);
    }

    zoomToFit(false, items, cx, cy);
  }

  function activateNode(d) {
    if (d.kind === "category") {
      showCategoryQuestions(d.data);
    } else {
      showQuestionDetail(d.data, currentCategory);
    }
  }

  function showCategories() {
    currentLevel = "categories";
    currentCategory = null;
    currentDetailQuestion = null;
    renderLevel();
    showCategoryList(sorularData.categories);
  }

  function showCategoryQuestions(cat) {
    currentLevel = "questions";
    currentCategory = cat;
    currentDetailQuestion = null;
    renderLevel();
    showCategoryList(cat);
    window.__dostNav && window.__dostNav.setHash("sorular", cat.id);
  }

  function zoomToFit(animate, items, cx, cy) {
    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
    items.forEach((d) => {
      x0 = Math.min(x0, d.x); x1 = Math.max(x1, d.x);
      y0 = Math.min(y0, d.y); y1 = Math.max(y1, d.y);
    });
    x0 -= 70; x1 += 70; y0 -= 60; y1 += 60;
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
    const nodeSel = nodeGroup.selectAll("g.sorular-node");
    const linkSel = linkGroup.selectAll("line.sorular-spoke");
    if (!d) {
      nodeSel.style("opacity", 1);
      linkSel.classed("sorular-spoke--highlight", false);
      return;
    }
    nodeSel.style("opacity", (n) => (n.id === d.id ? 1 : 0.45));
    linkSel.classed("sorular-spoke--highlight", (l) => l.id === d.id);
  }

  function showTooltip(d, event) {
    if (!tooltip) return;
    const label = labelFor(d.kind === "category" ? d.data.name : d.data.question);
    tooltip.innerHTML = `<div class="node-hover-tip__title">${label}</div>`;
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
    const href = id ? `#/${view}/${id}` : `#/${view}`;
    const label = q.linkLabel ? I18n.pick3(q.linkLabel) : tt({ tr: "Devamını oku", en: "Read more", pt: "Ler mais" });
    return `<a class="cross-link sorular-readmore" href="${href}">${label} →</a>`;
  }

  function sourceHtml(q) {
    if (!q.source) return "";
    return `<cite class="sorular-source">${q.source}</cite>`;
  }

  function showCategoryList(catOrCats) {
    const isSingleCategory = !Array.isArray(catOrCats);
    const cats = isSingleCategory ? [catOrCats] : catOrCats;
    const introBlock = !isSingleCategory
      ? `<div class="detail-block detail-block--ibnarabi"><p>${I18n.pick3(sorularData.intro)}</p></div>`
      : "";
    const sections = cats.map((cat) => {
      const rows = cat.questions.map((q) => `
        <button class="sorular-question-row" type="button" data-id="${q.id}">
          <span>${I18n.pick3(q.question)}</span>
          <span class="sorular-question-row__arrow" aria-hidden="true">→</span>
        </button>
      `).join("");
      return `
        ${isSingleCategory ? "" : `<p class="detail-eyebrow" style="margin-top:18px;">${I18n.pick3(cat.name)}</p>`}
        <div class="sorular-question-list">${rows}</div>
      `;
    }).join("");

    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Sorular", en: "Questions", pt: "Perguntas" })}</p>
      <h2 class="detail-title">${isSingleCategory ? I18n.pick3(cats[0].name) : tt({ tr: "Bütün Kategoriler", en: "All Categories", pt: "Todas as Categorias" })}</h2>
      ${introBlock}
      ${sections}
    `;
    detailContent.querySelectorAll(".sorular-question-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const entry = questionIndex.get(btn.dataset.id);
        if (entry) {
          if (currentLevel !== "questions" || currentCategory.id !== entry.category.id) {
            currentCategory = entry.category;
            currentLevel = "questions";
            renderLevel();
          }
          showQuestionDetail(entry.question, entry.category);
        }
      });
    });
    detailPanel.hidden = false;
  }

  function showQuestionDetail(q, cat) {
    currentDetailQuestion = q;
    detailContent.innerHTML = `
      <p class="detail-eyebrow"><button class="sorular-back-link" type="button" data-cat="${cat.id}">← ${I18n.pick3(cat.name)}</button></p>
      <h2 class="detail-title">${I18n.pick3(q.question)}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <p>${linkify(I18n.pick3(q.answer), "sorular", q.id)}</p>
        ${sourceHtml(q)}
      </div>
      ${analogyHtml(q.analogy)}
      ${crossLinkHtml(q)}
    `;
    detailContent.querySelector(".sorular-back-link").addEventListener("click", () => {
      showCategoryList(cat);
    });
    detailPanel.hidden = false;
    if (nodeGroup) nodeGroup.selectAll("g.sorular-node").classed("sorular-node--active", (n) => n.id === q.id);
    window.__dostNav && window.__dostNav.setHash("sorular", q.id);
  }

  function render() {
    if (!sorularData) return;
    if (nodeGroup) {
      nodeGroup.selectAll("g.sorular-node text.node-label").text((d) => {
        const label = labelFor(d.kind === "category" ? d.data.name : d.data.question);
        return label.length > 28 ? label.slice(0, 27) + "…" : label;
      });
    }
    if (currentDetailQuestion) {
      showQuestionDetail(currentDetailQuestion, currentCategory);
    } else if (currentLevel === "questions" && currentCategory) {
      showCategoryList(currentCategory);
    } else if (detailPanel && !detailPanel.hidden && currentLevel === "categories") {
      showCategoryList(sorularData.categories);
    }
  }

  window.__sorularApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        if (!currentNodes.length) {
          currentLevel = "categories";
          renderLevel();
        }
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        if (questionIndex.has(id)) {
          const entry = questionIndex.get(id);
          currentCategory = entry.category;
          currentLevel = "questions";
          renderLevel();
          showQuestionDetail(entry.question, entry.category);
        } else if (categoryById.has(id)) {
          currentCategory = categoryById.get(id);
          currentLevel = "questions";
          renderLevel();
          showCategoryList(currentCategory);
        } else {
          currentLevel = "categories";
          renderLevel();
          showCategoryList(data.categories);
        }
      });
    },
    onLangChange() {
      render();
    },
  };
})();
