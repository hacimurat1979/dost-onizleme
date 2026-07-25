(function () {
  "use strict";

  // ============================================================================
  // Sorular — "kategori halkası + okunabilir liste"
  //
  // Bu görünüm önce 46 sorunun tamamını tek bir kuvvet grafiğinde düğüm olarak
  // gösteriyordu. 2026-07-25'te kullanıcı "grafik çok kolay kullanılabilir
  // değil" diye bildirdi; tablet boyutunda ölçtüğümüzde sebep netleşti:
  //
  //   - Detay paneli 420px, yani 1024px'lik bir ekranın %41'i. Grafiğe 604px
  //     kalıyor ve o dar alana 46 düğüm + 38 bağlantı sıkışıyor.
  //   - Düğüm etiketleri 30 karakterde kesiliyor ve üst üste biniyordu:
  //     "Why does he describe the sa..." / "Are the places that look cont..."
  //   - Yani grafik "bozuk" değildi, YANLIŞ İŞİ yapıyordu: 46 soruyu tek tek
  //     düğüm olarak göstermek hiçbir gerçekçi ekran boyutunda okunaklı
  //     olamıyor. Okunabilir liste zaten sağdaki panelde vardı ve asıl işi
  //     o yapıyordu; grafik onunla yer için yarışıyordu.
  //
  // Yeni tasarım -- her yüzey iyi olduğu işi yapsın:
  //   - GRAFİK: yalnız 9 KATEGORİ, bir halka üzerinde; merkezde "En Temel
  //     Soru" (veride zaten tek bir soru). Her boyutta okunaklı, dairesel
  //     (bkz. CLAUDE.md daire/merkez ilkesi), bir bakışta yapıyı veriyor.
  //     Halka sakin sakin dönüyor; etiketler dik tutuluyor.
  //   - LİSTE: 46 sorunun tamamı, kategoriye göre gruplanmış, tam metin
  //     (kesme yok) -- detay panelinde.
  //   - İLİŞKİLER: 38 ilişki hairball olarak değil, açılan sorunun altında
  //     "İlişkili Sorular" olarak; bağlam olarak duruyor.
  //
  // Salt vanilla D3 (yeni bağımlılık yok).
  // ============================================================================

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = d3.select("#sorular-graph");
  const svgNode = svg.node();
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const tooltip = document.getElementById("sorular-tooltip");
  const wrapEl = document.getElementById("sorular-wrap");
  const backBtn = document.getElementById("sorular-back");

  function tt(dict) { return I18n.pick3(dict || {}); }
  function getVar(n) { return GU.getVar(n); }
  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

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
  function catColor(id) { return getVar(CATEGORY_COLOR_VAR[id] || "--series-theme"); }

  // ---------------------------------------------------------------------------
  let sorularData = null, dataPromise = null;
  let categoryById = new Map(), questionIndex = new Map();
  let ringNodes = [], centerNode = null, built = false;
  let zoomLayer, spinLayer, ringLayer, nodeLayer, defs;
  let zoomBehavior = null;
  let currentDetailQuestion = null, activeCategoryId = null, hoveredId = null;
  let width = 900, height = 640, cx = 450, cy = 320, ringR = 200;
  let rafId = null, lastTs = 0, spin = 0;
  const SPIN_RATE = 0.000048;   // tam tur ~130 sn

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("sorular-wrap");
    dataPromise = GU.fetchJson("data/ibn-arabi/sorular.json")
      .then((data) => {
        sorularData = data;
        categoryById = new Map(data.categories.map((c) => [c.id, c]));
        questionIndex = new Map();
        data.categories.forEach((c) => { c.questions.forEach((q) => questionIndex.set(q.id, { question: q, category: c })); });
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

  function relationsOf(id) { return (sorularData.relations || []).filter((r) => r.from === id || r.to === id); }

  // ---------------------------------------------------------------------------
  // Halka düzeni: merkezde "en-temel", çevrede diğer sekiz kategori.
  function buildRing(data) {
    const center = data.categories.find((c) => c.id === "en-temel");
    const others = data.categories.filter((c) => c.id !== "en-temel");
    centerNode = center ? { cat: center, isCenter: true } : null;
    ringNodes = others.map((cat, i) => ({
      cat,
      isCenter: false,
      angle: -Math.PI / 2 + (i / others.length) * Math.PI * 2,
    }));
  }

  function layout() {
    width = svgNode.clientWidth || 900;
    height = svgNode.clientHeight || 640;
    cx = width / 2; cy = height / 2;
    ringR = Math.max(110, Math.min(width, height) / 2 - 84);
    ringNodes.forEach((n) => {
      n.x = cx + ringR * Math.cos(n.angle);
      n.y = cy + ringR * Math.sin(n.angle);
    });
    if (centerNode) { centerNode.x = cx; centerNode.y = cy; }
  }

  function radiusFor(n) {
    if (n.isCenter) return 30;
    return 20 + Math.min(8, n.cat.questions.length) * 1.5;
  }

  // ---------------------------------------------------------------------------
  function buildDom() {
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");
    defs = svg.append("defs");

    [centerNode].concat(ringNodes).filter(Boolean).forEach((n) => {
      const c = d3.color(catColor(n.cat.id)) || d3.color("#888");
      const rg = defs.append("radialGradient").attr("id", "sorular-sphere-" + n.cat.id)
        .attr("cx", "38%").attr("cy", "32%").attr("r", "72%");
      rg.append("stop").attr("offset", "0%").attr("stop-color", c.brighter(1.1).formatHex());
      rg.append("stop").attr("offset", "48%").attr("stop-color", c.formatHex());
      rg.append("stop").attr("offset", "100%").attr("stop-color", c.darker(0.85).formatHex());
    });

    zoomLayer = svg.append("g").attr("class", "sorular-canvas");
    spinLayer = zoomLayer.append("g").attr("class", "sorular-spin");
    ringLayer = spinLayer.append("g").attr("class", "sorular-ring");
    nodeLayer = spinLayer.append("g").attr("class", "sorular-cats");

    zoomBehavior = GU.createZoomBehavior(svg, zoomLayer, [0.5, 2.5]);

    const rc = document.getElementById("sorular-recenter");
    if (rc && !rc.dataset.wiredSorular) {
      rc.dataset.wiredSorular = "1";
      rc.addEventListener("click", () => { showAllQuestionsList(); fitView(true); });
    }
    svg.on("click", () => { if (currentDetailQuestion || activeCategoryId) showAllQuestionsList(); });
  }

  function render(ts) {
    if (!nodeLayer) return;

    // halka çemberi (kategorileri birbirine bağlayan sakin daire)
    const ringSel = ringLayer.selectAll("circle.sorular-ring-path").data([0]);
    ringSel.enter().append("circle").attr("class", "sorular-ring-path").attr("fill", "none").merge(ringSel)
      .attr("cx", cx).attr("cy", cy).attr("r", ringR)
      .style("stroke", getVar("--border")).style("stroke-width", 1).style("opacity", 0.55);

    // merkezden her kategoriye giden ince tel
    const spokeSel = ringLayer.selectAll("line.sorular-spoke").data(ringNodes, (n) => n.cat.id);
    spokeSel.enter().append("line").attr("class", "sorular-spoke").merge(spokeSel)
      .attr("x1", cx).attr("y1", cy).attr("x2", (n) => n.x).attr("y2", (n) => n.y)
      .style("stroke", (n) => catColor(n.cat.id))
      .style("stroke-width", 1)
      .style("opacity", (n) => (activeCategoryId && activeCategoryId !== n.cat.id ? 0.06 : 0.2));
    spokeSel.exit().remove();

    const all = (centerNode ? [centerNode] : []).concat(ringNodes);
    const gsel = nodeLayer.selectAll("g.sorular-cat").data(all, (n) => n.cat.id);
    const enter = gsel.enter().append("g")
      .attr("class", "node sorular-cat")
      .attr("tabindex", 0).attr("role", "button")
      .on("click", (e, n) => { e.stopPropagation(); openCategory(n.cat.id); })
      .on("keydown", (e, n) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openCategory(n.cat.id); } })
      .on("pointerenter", (e, n) => { hoveredId = n.cat.id; showTooltip(n, e); ensureFrame(); })
      .on("pointermove", (e) => moveTooltip(e))
      .on("pointerleave", () => { hoveredId = null; hideTooltip(); ensureFrame(); })
      .on("focus", (e, n) => { hoveredId = n.cat.id; showTooltip(n, e); })
      .on("blur", () => { hoveredId = null; hideTooltip(); });
    enter.append("circle").attr("class", "sorular-cat__glow");
    enter.append("circle").attr("class", "sorular-cat__sphere").attr("fill", (n) => `url(#sorular-sphere-${n.cat.id})`);
    enter.append("text").attr("class", "sorular-cat__label").attr("text-anchor", "middle");
    enter.append("text").attr("class", "sorular-cat__count").attr("text-anchor", "middle");
    const merged = enter.merge(gsel);
    gsel.exit().remove();

    const deg = spin * 180 / Math.PI;
    merged.each(function (n) {
      const g = d3.select(this);
      const active = activeCategoryId === n.cat.id;
      const dim = activeCategoryId && !active;
      const breath = reduceMotion ? 1 : 1 + 0.02 * Math.sin(ts / 3200 + (n.isCenter ? 0 : n.angle * 3));
      const r = radiusFor(n) * breath * (active ? 1.1 : 1);
      g.attr("transform", `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`)
        .style("opacity", dim ? 0.35 : 1);
      g.select(".sorular-cat__glow").attr("r", r * 1.7)
        .style("fill", catColor(n.cat.id))
        .style("opacity", (n.isCenter ? 0.3 : 0.16) * (active ? 1.8 : 1) * (hoveredId === n.cat.id ? 1.5 : 1));
      g.select(".sorular-cat__sphere").attr("r", r);
      // Halka döndüğü için etiketleri kendi noktaları etrafında ters çevirip
      // dik ve yerinde tutuyoruz.
      g.select(".sorular-cat__label")
        .attr("y", r + 17)
        .attr("transform", `rotate(${(-deg).toFixed(2)},0,${(r + 17).toFixed(1)})`)
        .classed("sorular-cat__label--center", n.isCenter)
        .text(I18n.pick3(n.cat.name));
      g.select(".sorular-cat__count")
        .attr("y", 4)
        .attr("transform", `rotate(${(-deg).toFixed(2)},0,4)`)
        .text(n.cat.questions.length);
    });

    spinLayer.attr("transform", `rotate(${deg.toFixed(2)},${cx.toFixed(1)},${cy.toFixed(1)})`);
  }

  function ensureFrame() { if (rafId == null) rafId = requestAnimationFrame(frame); }
  function frame(ts) {
    rafId = null;
    // Görünüm ekranda değilse döngüyü tamamen durdur (bkz. GU.isViewActive).
    if (!GU.isViewActive(wrapEl)) { lastTs = 0; return; }
    const dt = lastTs ? Math.min(64, ts - lastTs) : 16; lastTs = ts;
    // Sakin, huzurlu dönüş. Bir kategori seçiliyken / bir soru açıkken durur:
    // kullanıcı okurken sahne kıpırdamasın.
    if (!reduceMotion && !activeCategoryId && !currentDetailQuestion) spin += dt * SPIN_RATE;
    render(ts);
    if (!reduceMotion) ensureFrame();
  }

  // Detay paneli grafiğin SAĞINI örter (sabit ~420px). Sığdırma bunu hesaba
  // katmazsa halkanın sağ yarısı panelin arkasında kalıyor -- eski tasarımda
  // da böyleydi. Görünür alanı panelin soluyla sınırlayıp oraya ortalıyoruz.
  function visibleWidth() {
    const sr = svgNode.getBoundingClientRect();
    if (!sr.width) return width;
    if (!detailPanel || detailPanel.hidden) return width;
    const pr = detailPanel.getBoundingClientRect();
    if (!pr.width || pr.left >= sr.right) return width;
    const visiblePx = pr.left - sr.left;
    // Mobilde panel bir yan sütun değil, alttan gelen tam genişlikte bir sayfa:
    // orada soluna sığdırmaya çalışmak halkayı ekranın soluna itiyordu. Sadece
    // gerçekten sağ yarıyı örten bir yan panel varsa daraltıyoruz.
    if (visiblePx < sr.width * 0.45) return width;
    return width * (visiblePx / sr.width);
  }

  // Sığdırma yarıçapı: halkanın kendi yarıçapı değil, etiketleriyle birlikte
  // en dışa taşan kategorinin merkeze uzaklığı. (Sadece ringR'e bakınca alt ve
  // sol kenardaki uzun kategori adları çerçevenin dışında kalıyordu.) Her
  // düğümün kutusunun merkeze en uzak köşesini ölçtüğümüz için halka dönerken
  // de geçerli kalır.
  function contentRadius() {
    let maxR = ringR;
    if (!nodeLayer) return maxR;
    nodeLayer.selectAll("g.sorular-cat").each(function (n) {
      let b; try { b = this.getBBox(); } catch (e) { return; }
      const corner = Math.max(
        Math.hypot(b.x, b.y), Math.hypot(b.x + b.width, b.y),
        Math.hypot(b.x, b.y + b.height), Math.hypot(b.x + b.width, b.y + b.height));
      const d = Math.hypot(n.x - cx, n.y - cy) + corner;
      if (d > maxR) maxR = d;
    });
    return maxR;
  }

  function fitView(animate) {
    if (!zoomBehavior) return;
    const pad = 24;
    const vw = visibleWidth();
    const need = contentRadius() * 2 + pad * 2;
    const k = Math.max(0.4, Math.min(2.5, Math.min(vw / need, height / need)));
    const t = d3.zoomIdentity.translate(vw / 2 - k * cx, height / 2 - k * cy).scale(k);
    const sel = (animate && !reduceMotion) ? svg.transition().duration(450).ease(d3.easeCubicInOut) : svg;
    sel.call(zoomBehavior.transform, t);
  }

  function showTooltip(n, event) {
    if (!tooltip) return;
    const count = n.cat.questions.length;
    tooltip.innerHTML =
      `<div class="node-hover-tip__title">${I18n.pick3(n.cat.name)}</div>` +
      `<div class="node-hover-tip__short">${count} ${tt({ tr: "soru", en: "questions", pt: "perguntas" })}</div>`;
    tooltip.hidden = false; moveTooltip(event);
  }
  function moveTooltip(event) { GU.moveTooltip(tooltip, wrapEl, event); }
  function hideTooltip() { GU.hideTooltip(tooltip); }

  // --- Editorial detay paneli (kitap hissi) ---
  function analogyHtml(analogy) {
    if (!analogy) return "";
    return `<div class="detail-analogy"><p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p><p>${I18n.pick3(analogy)}</p></div>`;
  }
  function crossLinkHtml(q) {
    if (!q.link) return "";
    const view = q.link.view, id = q.link.id;
    const base = window.__dostRouteBase || "";
    const href = id ? `${base}/${view}/${id}` : `${base}/${view}`;
    const label = q.linkLabel ? I18n.pick3(q.linkLabel) : tt({ tr: "Devamını oku", en: "Read more", pt: "Ler mais" });
    return `<a class="cross-link sorular-readmore" href="${href}">${label} →</a>`;
  }
  function sourceHtml(q) { return q.source ? `<cite class="sorular-source">${q.source}</cite>` : ""; }
  function relationNote(r) { return r && r.note ? I18n.pick3(r.note) : ""; }
  function relatedQuestionsHtml(q) {
    const rel = relationsOf(q.id);
    if (!rel.length) return "";
    const rows = rel.map((r) => {
      const otherId = r.from === q.id ? r.to : r.from;
      const entry = questionIndex.get(otherId); if (!entry) return "";
      return `<button class="sorular-question-row sorular-question-row--related" type="button" data-id="${otherId}">
        <span><span class="sorular-related__q">${I18n.pick3(entry.question.question)}</span>
        <span class="sorular-related__note">${relationNote(r)}</span></span>
        <span class="sorular-question-row__arrow" aria-hidden="true">→</span></button>`;
    }).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlişkili Sorular", en: "Related Questions", pt: "Perguntas Relacionadas" })}</p><div class="sorular-question-list">${rows}</div>`;
  }

  function categoryRowsHtml(cat) {
    return cat.questions.map((q) => `
      <button class="sorular-question-row" type="button" data-id="${q.id}"><span>${I18n.pick3(q.question)}</span><span class="sorular-question-row__arrow" aria-hidden="true">→</span></button>`).join("");
  }

  function showAllQuestionsList() {
    currentDetailQuestion = null; activeCategoryId = null;
    if (backBtn) backBtn.hidden = true;
    const introBlock = `<div class="detail-block detail-block--ibnarabi"><p>${I18n.pick3(sorularData.intro)}</p></div>`;
    const sections = sorularData.categories.map((cat) => `
      <p class="detail-eyebrow detail-eyebrow--section">${I18n.pick3(cat.name)}</p>
      <div class="sorular-question-list">${categoryRowsHtml(cat)}</div>`).join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Sorular", en: "Questions", pt: "Perguntas" })}</p>
      <h2 class="detail-title">${tt({ tr: "Bütün Sorular", en: "All Questions", pt: "Todas as Perguntas" })}</h2>
      ${introBlock}${sections}`;
    wireQuestionRows();
    detailPanel.hidden = false;
    fitView(true);
    ensureFrame();
  }

  // Halkadan bir kategoriye dokununca: yalnız o kategorinin soruları.
  function openCategory(catId) {
    const cat = categoryById.get(catId);
    if (!cat) return;
    currentDetailQuestion = null;
    activeCategoryId = catId;
    if (backBtn) backBtn.hidden = false;
    detailContent.innerHTML = `
      <p class="detail-eyebrow"><button class="sorular-back-link" type="button">← ${tt({ tr: "Bütün Sorular", en: "All Questions", pt: "Todas as Perguntas" })}</button></p>
      <h2 class="detail-title">${I18n.pick3(cat.name)}</h2>
      <p class="sorular-category-tag">${cat.questions.length} ${tt({ tr: "soru", en: "questions", pt: "perguntas" })}</p>
      <div class="sorular-question-list">${categoryRowsHtml(cat)}</div>`;
    detailContent.querySelector(".sorular-back-link").addEventListener("click", () => showAllQuestionsList());
    wireQuestionRows();
    detailPanel.hidden = false;
    ensureFrame();
  }

  function wireQuestionRows() {
    detailContent.querySelectorAll(".sorular-question-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const entry = questionIndex.get(btn.dataset.id);
        if (entry) showQuestionDetail(entry.question);
      });
    });
  }

  function showQuestionDetail(q) {
    currentDetailQuestion = q;
    const entry = questionIndex.get(q.id);
    const cat = entry ? entry.category : null;
    activeCategoryId = cat ? cat.id : null;
    if (backBtn) backBtn.hidden = false;
    detailContent.innerHTML = `
      <p class="detail-eyebrow"><button class="sorular-back-link" type="button">← ${tt({ tr: "Bütün Sorular", en: "All Questions", pt: "Todas as Perguntas" })}</button></p>
      <h2 class="detail-title">${I18n.pick3(q.question)}</h2>
      <p class="sorular-category-tag">${cat ? I18n.pick3(cat.name) : ""}</p>
      <div class="detail-block detail-block--ibnarabi"><p>${linkify(I18n.pick3(q.answer), "sorular", q.id)}</p>${sourceHtml(q)}</div>
      ${analogyHtml(q.analogy)}${crossLinkHtml(q)}${relatedQuestionsHtml(q)}`;
    detailContent.querySelector(".sorular-back-link").addEventListener("click", () => showAllQuestionsList());
    wireQuestionRows();
    detailPanel.hidden = false;
    window.__dostNav && window.__dostNav.setHash("sorular", q.id);
    ensureFrame();
  }

  // ---------------------------------------------------------------------------
  function buildAll(data) {
    buildRing(data);
    layout();
    buildDom();
    built = true;
    render(performance.now());
    fitView(false);
    ensureFrame();
    window.addEventListener("resize", onResize);
  }

  function onResize() {
    if (!built || wrapEl.hidden) return;
    layout();
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    render(performance.now());
    fitView(false);
  }

  function relabel() {
    if (!built) return;
    render(performance.now());
    if (currentDetailQuestion) showQuestionDetail(currentDetailQuestion);
    else if (activeCategoryId) openCategory(activeCategoryId);
    else if (detailPanel && !detailPanel.hidden) showAllQuestionsList();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (wrapEl.hidden) return;
    if (!currentDetailQuestion && !activeCategoryId) return;
    showAllQuestionsList();
  });

  if (backBtn && !backBtn.dataset.wiredSorular) {
    backBtn.dataset.wiredSorular = "1";
    backBtn.addEventListener("click", () => showAllQuestionsList());
  }

  // Sekme arkaya alınıp geri gelindiğinde döngü yeniden uyansın.
  GU.onViewWake(() => { if (!wrapEl.hidden) ensureFrame(); });

  window.__sorularApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        if (!built) { buildAll(data); showAllQuestionsList(); }
        else ensureFrame();
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        if (!built) buildAll(data);
        if (questionIndex.has(id)) showQuestionDetail(questionIndex.get(id).question);
        else if (categoryById.has(id)) openCategory(id);
        else showAllQuestionsList();
      });
    },
    onLangChange() { relabel(); },
  };
})();
