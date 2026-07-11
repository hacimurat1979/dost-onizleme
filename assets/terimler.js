(function () {
  "use strict";

  const I18n = window.DostI18n;
  const grid = document.getElementById("terimler-list");
  const chipsWrap = document.getElementById("terimler-chips");
  const diagramWrap = document.getElementById("terimler-diagram");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  if (!grid || !chipsWrap || !diagramWrap || !detailPanel || !detailContent) return;

  let glossaryData = null;
  let fetchPromise = null;
  let activeGroup = "all";

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function fetchData() {
    if (glossaryData) return Promise.resolve(glossaryData);
    if (fetchPromise) return fetchPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("terimler-wrap");
    fetchPromise = fetch("data/ibn-arabi/felsefi-terimler.json")
      .then((r) => r.json())
      .then((data) => {
        glossaryData = data;
        if (window.DostViewStatus) window.DostViewStatus.hide("terimler-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Terimler sözlüğü yüklenemedi / Failed to load glossary", err);
        fetchPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("terimler-wrap", () => window.__terimlerApp.activate());
        return null;
      });
    return fetchPromise;
  }

  function groupById(id) {
    return glossaryData.groups.find((g) => g.id === id);
  }

  function termsInGroup(groupId) {
    return Object.values(glossaryData.terms).filter((t) => groupId === "all" || t.group === groupId);
  }

  // İki (veya daha fazla) kavram arasındaki ilişkiyi tek bakışta gösteren
  // küçük SVG şemalar. Her grubun "diagram" alanındaki tipe göre seçilir.
  const diagramRenderers = {
    "mutual-vs-oneway": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 340 150" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node" cx="60" cy="34" r="24"/>
        <text class="term-diagram-label" x="60" y="39" text-anchor="middle">${tt(d.left)}</text>
        <circle class="term-diagram-node" cx="280" cy="34" r="24"/>
        <text class="term-diagram-label" x="280" y="39" text-anchor="middle">${tt(d.right)}</text>
        <line class="term-diagram-arrow term-diagram-arrow--mutual" x1="86" y1="34" x2="254" y2="34" marker-start="url(#tdArrowStart)" marker-end="url(#tdArrowEnd)"/>
        <text class="term-diagram-note" x="170" y="20" text-anchor="middle">${tt(d.mutualLabel)}</text>

        <circle class="term-diagram-node term-diagram-node--accent" cx="60" cy="116" r="24"/>
        <text class="term-diagram-label" x="60" y="121" text-anchor="middle">${tt(d.oneWayFrom)}</text>
        <circle class="term-diagram-node" cx="280" cy="116" r="24"/>
        <text class="term-diagram-label" x="280" y="121" text-anchor="middle">${tt(d.oneWayTo)}</text>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="86" y1="116" x2="254" y2="116" marker-end="url(#tdArrowEnd)"/>
        <text class="term-diagram-note term-diagram-note--accent" x="170" y="145" text-anchor="middle">${tt(d.oneWayLabel)}</text>
      </svg>
    `,
    "host-satellite": (d) => {
      const cx = 150, cy = 85, hostR = 32, satR = 15, orbit = 62;
      const angles = [-90, 30, 150];
      const sats = angles.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const sx = cx + orbit * Math.cos(rad);
        const sy = cy + orbit * Math.sin(rad);
        return `
          <line class="term-diagram-tether" x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}"/>
          <circle class="term-diagram-node term-diagram-node--dashed" cx="${sx}" cy="${sy}" r="${satR}"/>
        `;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 300 170" role="img" aria-label="${tt(d.note)}">
        ${sats}
        <circle class="term-diagram-node term-diagram-node--accent" cx="${cx}" cy="${cy}" r="${hostR}"/>
        <text class="term-diagram-label term-diagram-label--host" x="${cx}" y="${cy + 5}" text-anchor="middle">${tt(d.host)}</text>
        <text class="term-diagram-label term-diagram-label--small" x="${cx}" y="${cy - orbit - 20}" text-anchor="middle">${tt(d.satellite)}</text>
      </svg>
    `;
    },
    "formula-merge": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 340 100" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node" cx="55" cy="50" r="30"/>
        <text class="term-diagram-label" x="55" y="55" text-anchor="middle">${tt(d.a)}</text>
        <text class="term-diagram-op" x="120" y="58" text-anchor="middle">+</text>
        <circle class="term-diagram-node" cx="185" cy="50" r="30"/>
        <text class="term-diagram-label" x="185" y="55" text-anchor="middle">${tt(d.b)}</text>
        <text class="term-diagram-op" x="245" y="58" text-anchor="middle">=</text>
        <circle class="term-diagram-node term-diagram-node--accent" cx="290" cy="50" r="34"/>
        <text class="term-diagram-label" x="290" y="55" text-anchor="middle">${tt(d.result)}</text>
      </svg>
    `,
    spectrum: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 340 120" role="img" aria-label="${tt(d.note)}">
        <line class="term-diagram-axis" x1="30" y1="55" x2="310" y2="55" marker-end="url(#tdArrowEnd)"/>
        <circle class="term-diagram-node term-diagram-node--sm" cx="80" cy="55" r="16"/>
        <circle class="term-diagram-node term-diagram-node--accent term-diagram-node--sm" cx="270" cy="55" r="16"/>
        <text class="term-diagram-note" x="80" y="90" text-anchor="middle">${tt(d.leftMarker)}</text>
        <text class="term-diagram-note" x="270" y="90" text-anchor="middle">${tt(d.rightMarker)}</text>
        <text class="term-diagram-label" x="30" y="20" text-anchor="start">${tt(d.leftLabel)}</text>
        <text class="term-diagram-label--small" x="30" y="35" text-anchor="start">${tt(d.leftNote)}</text>
        <text class="term-diagram-label" x="310" y="20" text-anchor="end">${tt(d.rightLabel)}</text>
        <text class="term-diagram-label--small" x="310" y="35" text-anchor="end">${tt(d.rightNote)}</text>
      </svg>
    `,
    cascade: (d) => {
      const n = d.steps.length;
      const gap = 300 / (n - 1);
      const circles = d.steps.map((s, i) => {
        const x = 30 + i * gap;
        return `
          <circle class="term-diagram-node${i === 0 ? " term-diagram-node--accent" : ""}" cx="${x}" cy="60" r="28"/>
          <text class="term-diagram-label term-diagram-label--small" x="${x}" y="65" text-anchor="middle">${tt(s)}</text>
        `;
      }).join("");
      const arrows = d.steps.slice(1).map((s, i) => {
        const x1 = 30 + i * gap + 30;
        const x2 = 30 + (i + 1) * gap - 30;
        return `<line class="term-diagram-arrow term-diagram-arrow--oneway" x1="${x1}" y1="60" x2="${x2}" y2="60" marker-end="url(#tdArrowEnd)"/>`;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 340 110" role="img" aria-label="${tt(d.note)}">
        ${arrows}${circles}
        <text class="term-diagram-note" x="170" y="100" text-anchor="middle">${tt(d.relationLabel)}</text>
      </svg>
    `;
    },
    mirror: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 300 120" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node term-diagram-node--accent" cx="55" cy="55" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="55" y="60" text-anchor="middle">${tt(d.source)}</text>
        <line class="term-diagram-mirror" x1="160" y1="15" x2="140" y2="95"/>
        <line class="term-diagram-arrow term-diagram-arrow--dashed" x1="83" y1="55" x2="215" y2="55" marker-end="url(#tdArrowEnd)"/>
        <circle class="term-diagram-node term-diagram-node--faint" cx="245" cy="55" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="245" y="60" text-anchor="middle">${tt(d.target)}</text>
      </svg>
    `,
    "seal-wax": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 300 130" role="img" aria-label="${tt(d.note)}">
        <ellipse class="term-diagram-node term-diagram-node--faint" cx="150" cy="90" rx="90" ry="30"/>
        <text class="term-diagram-label term-diagram-label--small" x="150" y="95" text-anchor="middle">${tt(d.wax)}</text>
        <rect class="term-diagram-node term-diagram-node--accent" x="120" y="15" width="60" height="40" rx="8"/>
        <text class="term-diagram-label term-diagram-label--small" x="150" y="40" text-anchor="middle">${tt(d.seal)}</text>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="150" y1="58" x2="150" y2="68" marker-end="url(#tdArrowEnd)"/>
      </svg>
    `,
    "potential-actual": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 300 100" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node term-diagram-node--dashed" cx="60" cy="50" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="60" y="55" text-anchor="middle">${tt(d.potential)}</text>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="90" y1="50" x2="210" y2="50" marker-end="url(#tdArrowEnd)"/>
        <circle class="term-diagram-node term-diagram-node--accent" cx="240" cy="50" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="240" y="55" text-anchor="middle">${tt(d.actual)}</text>
      </svg>
    `,
    reins: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 300 200" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node term-diagram-node--accent" cx="150" cy="42" r="32"/>
        <text class="term-diagram-label term-diagram-label--small" x="150" y="47" text-anchor="middle">${tt(d.ruler)}</text>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="126" y1="66" x2="82" y2="132" marker-end="url(#tdArrowEnd)"/>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="174" y1="66" x2="218" y2="132" marker-end="url(#tdArrowEnd)"/>
        <circle class="term-diagram-node term-diagram-node--dashed" cx="70" cy="158" r="28"/>
        <text class="term-diagram-label term-diagram-label--small" x="70" y="163" text-anchor="middle">${tt(d.left)}</text>
        <circle class="term-diagram-node term-diagram-node--dashed" cx="230" cy="158" r="28"/>
        <text class="term-diagram-label term-diagram-label--small" x="230" y="163" text-anchor="middle">${tt(d.right)}</text>
        <text class="term-diagram-note" x="150" y="105" text-anchor="middle">${tt(d.rulesLabel)}</text>
      </svg>
    `,
    eclipse: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 340 160" role="img" aria-label="${tt(d.note)}">
        <line class="term-diagram-mirror" x1="170" y1="10" x2="170" y2="150"/>

        <circle class="term-diagram-node term-diagram-node--accent" cx="85" cy="48" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="85" y="53" text-anchor="middle">${tt(d.sunLabel)}</text>
        <circle class="term-diagram-node term-diagram-node--dashed" cx="85" cy="112" r="18"/>
        <text class="term-diagram-label--small" x="85" y="116" text-anchor="middle" style="font-size:8px">${tt(d.moonLabel)}</text>
        <text class="term-diagram-note" x="85" y="145" text-anchor="middle">${tt(d.presentCaption)}</text>

        <circle class="term-diagram-node term-diagram-node--faint" cx="255" cy="48" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="255" y="53" text-anchor="middle">${tt(d.sunLabel)}</text>
        <circle class="term-diagram-node term-diagram-node--accent" cx="255" cy="112" r="18"/>
        <text class="term-diagram-label--small" x="255" y="116" text-anchor="middle" style="font-size:8px">${tt(d.moonLabel)}</text>
        <text class="term-diagram-note" x="255" y="145" text-anchor="middle">${tt(d.absentCaption)}</text>
      </svg>
    `,
    "letter-sequence": (d) => {
      const n = d.letters.length;
      const gap = 400 / (n - 1);
      const items = d.letters.map((it, i) => {
        const x = 20 + i * gap;
        const nodeClass = it.hidden ? "term-diagram-node--dashed" : i === 0 ? "term-diagram-node--accent" : "term-diagram-node";
        return `
          <circle class="term-diagram-node ${nodeClass}" cx="${x}" cy="50" r="21"/>
          <text class="term-diagram-label" x="${x}" y="55" text-anchor="middle">${tt(it.harf)}</text>
          <text class="term-diagram-label--small" x="${x}" y="93" text-anchor="middle" style="font-size:8px">${tt(it.anlam)}</text>
        `;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 440 115" role="img" aria-label="${tt(d.note)}">
        ${items}
      </svg>
    `;
    },
  };

  const DIAGRAM_DEFS = `
    <svg width="0" height="0" style="position:absolute">
      <defs>
        <marker id="tdArrowEnd" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" class="term-diagram-arrowhead"/>
        </marker>
        <marker id="tdArrowStart" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
          <path d="M8,0 L0,4 L8,8 Z" class="term-diagram-arrowhead"/>
        </marker>
      </defs>
    </svg>
  `;

  let currentDiagrams = [];

  function renderDiagrams() {
    if (activeGroup === "all") {
      diagramWrap.innerHTML = "";
      diagramWrap.hidden = true;
      currentDiagrams = [];
      return;
    }
    const group = groupById(activeGroup);
    const diagrams = group && group.diagram;
    if (!diagrams || !diagrams.length) {
      diagramWrap.innerHTML = "";
      diagramWrap.hidden = true;
      currentDiagrams = [];
      return;
    }
    currentDiagrams = diagrams;
    diagramWrap.hidden = false;
    const cards = diagrams
      .map((dg, i) => {
        const renderer = diagramRenderers[dg.type];
        if (!renderer) return "";
        return `<div class="term-diagram-card">
          <div class="term-diagram-svg-wrap" data-diagram-index="${i}" role="button" tabindex="0"
               aria-label="${tt({ tr: "Büyüt", en: "Enlarge", pt: "Ampliar" })}">${renderer(dg)}</div>
          <p class="term-diagram-caption">${tt(dg.note)}</p>
        </div>`;
      })
      .join("");
    diagramWrap.innerHTML = DIAGRAM_DEFS + `<div class="term-diagram-row">${cards}</div>`;
    diagramWrap.querySelectorAll(".term-diagram-svg-wrap").forEach((el) => {
      el.addEventListener("click", () => openDiagramLightbox(Number(el.dataset.diagramIndex)));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDiagramLightbox(Number(el.dataset.diagramIndex));
        }
      });
    });
  }

  // --- Büyütme (lightbox) ---
  let lightboxEl = null;

  function ensureLightbox() {
    if (lightboxEl) return lightboxEl;
    lightboxEl = document.createElement("div");
    lightboxEl.className = "cizim-lightbox";
    lightboxEl.hidden = true;
    lightboxEl.innerHTML = `
      <div class="cizim-lightbox__backdrop"></div>
      <div class="cizim-lightbox__panel" role="dialog" aria-modal="true">
        <button class="cizim-lightbox__close" type="button" aria-label="${tt({ tr: "Kapat", en: "Close", pt: "Fechar" })}">×</button>
        <div class="cizim-lightbox__svg-wrap"></div>
        <p class="cizim-lightbox__caption"></p>
      </div>
    `;
    document.body.appendChild(lightboxEl);
    lightboxEl.querySelector(".cizim-lightbox__backdrop").addEventListener("click", closeLightbox);
    lightboxEl.querySelector(".cizim-lightbox__close").addEventListener("click", closeLightbox);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !lightboxEl.hidden) closeLightbox();
    });
    return lightboxEl;
  }

  function openDiagramLightbox(index) {
    const dg = currentDiagrams[index];
    if (!dg) return;
    const renderer = diagramRenderers[dg.type];
    if (!renderer) return;
    const el = ensureLightbox();
    el.querySelector(".cizim-lightbox__svg-wrap").innerHTML = DIAGRAM_DEFS + renderer(dg);
    el.querySelector(".cizim-lightbox__caption").textContent = tt(dg.note);
    el.hidden = false;
    document.body.classList.add("cizim-lightbox-open");
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.hidden = true;
    document.body.classList.remove("cizim-lightbox-open");
  }

  function renderChips() {
    const allChip = `<button class="theme-chip${activeGroup === "all" ? " theme-chip--active" : ""}" data-group="all">${tt({ tr: "Tümü", en: "All", pt: "Todos" })} <span class="theme-chip__count">${Object.keys(glossaryData.terms).length}</span></button>`;
    const groupChips = glossaryData.groups
      .map((g) => {
        const count = termsInGroup(g.id).length;
        return `<button class="theme-chip${activeGroup === g.id ? " theme-chip--active" : ""}" data-group="${g.id}">${tt(g.name)} <span class="theme-chip__count">${count}</span></button>`;
      })
      .join("");
    chipsWrap.innerHTML = allChip + groupChips;
    chipsWrap.querySelectorAll(".theme-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        activeGroup = chip.dataset.group;
        render();
      });
    });
  }

  function renderList() {
    const terms = termsInGroup(activeGroup);
    grid.innerHTML = terms
      .map(
        (t) => `<button class="terim-card" data-id="${t.id}">
          <span class="terim-card__title">${tt(t.title)}</span>
          <span class="terim-card__ozet">${t.ozet_tr || ""}</span>
        </button>`
      )
      .join("");
    grid.querySelectorAll(".terim-card").forEach((card) => {
      card.addEventListener("click", () => showTermDetail(card.dataset.id));
    });
  }

  function render() {
    if (!glossaryData) return;
    renderChips();
    renderDiagrams();
    renderList();
  }

  function kaynaklarHtml(kaynaklar) {
    if (!kaynaklar || !kaynaklar.length) return "";
    return `<div class="insight-group">${kaynaklar
      .map(
        (k, i) => `<details class="insight" ${i === 0 ? "open" : ""}>
          <summary>${k.kaynak_adi ? k.kaynak_adi : tt({ tr: `Cilt ${k.cilt}`, en: `Volume ${k.cilt}`, pt: `Volume ${k.cilt}` })}</summary>
          <p>${k.alinti_tr}</p>
          ${k.not_tr ? `<cite>${k.not_tr}</cite>` : ""}
        </details>`
      )
      .join("")}</div>`;
  }

  function groupHue(groupId) {
    const idx = (glossaryData.groups || []).findIndex((g) => g.id === groupId);
    const i = idx === -1 ? 0 : idx;
    return Math.round((i * 137.508) % 360);
  }

  function relatedTermsHtml(t) {
    const related = (t.iliskili_kavramlar || [])
      .map((id) => glossaryData.terms[id])
      .filter(Boolean);
    if (!related.length) return "";
    const chips = related
      .map((r) => `<button class="bookmap-concept-tag bookmap-concept-tag--group" data-term="${r.id}" style="--tag-hue:${groupHue(r.group)}">${tt(r.title)}</button>`)
      .join("");
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "İlişkili Terimler", en: "Related Terms", pt: "Termos Relacionados" })}</p>
      <div class="bookmap-concept-tags">${chips}</div>`;
  }

  function celisenYorumlarHtml(t) {
    const views = t.celisen_yorumlar || [];
    if (!views.length) return "";
    const cards = views
      .map(
        (v) => `<div class="divergent-view">
          <p class="divergent-view__kaynak">${v.kaynak}</p>
          <p>${tt(v.gorus)}</p>
        </div>`
      )
      .join("");
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "Çelişen Yorumlar", en: "Differing Readings", pt: "Leituras Divergentes" })}</p>
      <div class="divergent-views">${cards}</div>
      ${t.celisen_yorumlar_not ? `<p class="divergent-views__not">${tt(t.celisen_yorumlar_not)}</p>` : ""}`;
  }

  function siteLinksHtml(t) {
    const links = t.site_baglantilari || [];
    if (!links.length) return "";
    const VIEW_LABEL = {
      ontoloji: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
      esma: { tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" },
      hal: { tr: "Hâller", en: "States", pt: "Estados" },
    };
    const chips = links
      .map((l) => `<button class="bookmap-concept-tag" data-view="${l.view}" data-id="${l.id}">${tt(VIEW_LABEL[l.view] || {})} → ${l.id}</button>`)
      .join("");
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "Haritada Gör", en: "See on the Map", pt: "Ver no Mapa" })}</p>
      <div class="bookmap-concept-tags">${chips}</div>`;
  }

  function showTermDetail(id) {
    const t = glossaryData.terms[id];
    if (!t) return;
    const group = groupById(t.group);

    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(group.name)}</p>
      <h2 class="detail-title">${tt(t.title)}${t.arabic ? ` <span class="detail-title__arabic">${t.arabic}</span>` : ""}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${tt({ tr: "Felsefi Tanım", en: "Philosophical Definition", pt: "Definição Filosófica" })}</h3>
        <p>${tt(t.felsefi_tanim)}</p>
      </div>
      <div class="detail-block">
        <h3>${tt({ tr: "İbn Arabî'nin Yorumu", en: "Ibn Arabi's Interpretation", pt: "A Interpretação de Ibn Arabi" })}</h3>
        <p>${tt(t.ibn_arabi_yorumu)}</p>
      </div>
      <div class="detail-analogy">
        <p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p>
        <p>${tt(t.analogy)}</p>
      </div>
      ${kaynaklarHtml(t.kaynaklar)}
      ${celisenYorumlarHtml(t)}
      ${relatedTermsHtml(t)}
      ${siteLinksHtml(t)}
    `;

    detailContent.querySelectorAll(".bookmap-concept-tag[data-term]").forEach((btn) => {
      btn.addEventListener("click", () => showTermDetail(btn.dataset.term));
    });
    detailContent.querySelectorAll(".bookmap-concept-tag[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.__dostNav && window.__dostNav.goTo(btn.dataset.view, btn.dataset.id);
      });
    });

    detailPanel.hidden = false;
  }

  window.__terimlerApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        render();
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        render();
        if (id) showTermDetail(id);
      });
    },
    onLangChange() {
      if (glossaryData) render();
    },
  };
})();
