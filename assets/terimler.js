(function () {
  "use strict";

  const I18n = window.DostI18n;
  const grid = document.getElementById("terimler-list");
  const chipsWrap = document.getElementById("terimler-chips");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  if (!grid || !chipsWrap || !detailPanel || !detailContent) return;

  let glossaryData = null;
  let fetchPromise = null;
  let activeGroup = "all";

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function fetchData() {
    if (glossaryData) return Promise.resolve(glossaryData);
    if (fetchPromise) return fetchPromise;
    fetchPromise = fetch("data/ibn-arabi/felsefi-terimler.json")
      .then((r) => r.json())
      .then((data) => {
        glossaryData = data;
        return data;
      })
      .catch((err) => {
        console.error("Terimler sözlüğü yüklenemedi / Failed to load glossary", err);
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
          <span class="terim-card__arabic">${t.arabic || ""}</span>
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
    renderList();
  }

  function kaynaklarHtml(kaynaklar) {
    if (!kaynaklar || !kaynaklar.length) return "";
    return `<div class="insight-group">${kaynaklar
      .map(
        (k, i) => `<details class="insight" ${i === 0 ? "open" : ""}>
          <summary>${tt({ tr: `Cilt ${k.cilt}`, en: `Volume ${k.cilt}`, pt: `Volume ${k.cilt}` })}</summary>
          <p>${k.alinti_tr}</p>
          ${k.not_tr ? `<cite>${k.not_tr}</cite>` : ""}
        </details>`
      )
      .join("")}</div>`;
  }

  function relatedTermsHtml(t) {
    const related = (t.iliskili_kavramlar || [])
      .map((id) => glossaryData.terms[id])
      .filter(Boolean);
    if (!related.length) return "";
    const chips = related
      .map((r) => `<button class="bookmap-concept-tag" data-term="${r.id}">${tt(r.title)}</button>`)
      .join("");
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "İlişkili Terimler", en: "Related Terms", pt: "Termos Relacionados" })}</p>
      <div class="bookmap-concept-tags">${chips}</div>`;
  }

  function siteLinksHtml(t) {
    const links = t.site_baglantilari || [];
    if (!links.length) return "";
    const VIEW_LABEL = {
      ontoloji: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
      esma: { tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" },
      hal: { tr: "Hâller Haritası", en: "Map of States", pt: "Mapa dos Estados" },
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
