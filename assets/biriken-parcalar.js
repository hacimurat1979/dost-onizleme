(function () {
  "use strict";

  const I18n = window.DostI18n;
  const grid = document.getElementById("biriken-parcalar-list");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  if (!grid || !detailPanel || !detailContent) return;

  const VIEW_LABEL = {
    ontoloji: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
    esma: { tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" },
    hal: { tr: "Hâller", en: "States", pt: "Estados" },
    terimler: { tr: "Terimler", en: "Terms", pt: "Termos" },
    sirlar: { tr: "Sırlar", en: "Mysteries", pt: "Mistérios" },
    sorular: { tr: "Sorular", en: "Questions", pt: "Perguntas" },
    futuhat: { tr: "Fütûhât Atlası", en: "Futuhat Atlas", pt: "Atlas do Futuhat" },
  };

  let pageData = null;
  let fetchPromise = null;
  let entryById = new Map();

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function fetchData() {
    if (pageData) return Promise.resolve(pageData);
    if (fetchPromise) return fetchPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("biriken-parcalar-wrap");
    fetchPromise = fetch("data/ibn-arabi/biriken-parcalar.json")
      .then((r) => r.json())
      .then((data) => {
        pageData = data;
        entryById = new Map(data.entries.map((e) => [e.id, e]));
        if (window.DostViewStatus) window.DostViewStatus.hide("biriken-parcalar-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Biriken Parçalar verisi yüklenemedi / Failed to load Gathered Pieces data", err);
        if (window.DostViewStatus) window.DostViewStatus.showError("biriken-parcalar-wrap", () => window.__birikenParcalarApp.activate());
        throw err;
      });
    return fetchPromise;
  }

  function kaynaklarChipsHtml(kaynaklar) {
    if (!kaynaklar || !kaynaklar.length) return "";
    const chips = kaynaklar
      .map((l) => `<button class="bookmap-concept-tag bookmap-concept-tag--group" data-view="${l.view}" data-id="${l.id}">${tt(VIEW_LABEL[l.view] || {})} → ${l.id}</button>`)
      .join("");
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "Görüldüğü Yerler", en: "Where It Appears", pt: "Onde Aparece" })}</p>
      <div class="bookmap-concept-tags">${chips}</div>`;
  }

  function renderList() {
    grid.innerHTML = pageData.entries
      .map(
        (e) => `<button class="terim-card terim-card--tier-1" data-id="${e.id}">
          <span class="terim-card__title">${tt(e.title)}</span>
          <span class="terim-card__ozet">${tt(e.ozet)}</span>
        </button>`
      )
      .join("");
    grid.querySelectorAll(".terim-card").forEach((card) => {
      card.addEventListener("click", () => showEntryDetail(card.dataset.id));
    });
  }

  function showEntryDetail(id) {
    const e = entryById.get(id);
    if (!e) return;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Biriken Parçalar", en: "Gathered Pieces", pt: "Peças Reunidas" })}</p>
      <h2 class="detail-title">${tt(e.title)}</h2>
      <div class="detail-block">
        <h3>${tt({ tr: "Görüldüğü Yerler", en: "Where It Appears", pt: "Onde Aparece" })}</h3>
        <p>${tt(e.gorulen_yerler)}</p>
      </div>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${tt({ tr: "Bir Okuma Denemesi", en: "A Reading Attempt", pt: "Uma Tentativa de Leitura" })}</h3>
        <p>${tt(e.sentez)}</p>
      </div>
      ${kaynaklarChipsHtml(e.kaynaklar)}
    `;
    detailContent.querySelectorAll(".bookmap-concept-tag[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.__dostNav && window.__dostNav.goTo(btn.dataset.view, btn.dataset.id);
      });
    });
    detailPanel.hidden = false;
    window.__dostNav && window.__dostNav.setHash("biriken-parcalar", id);
  }

  function activate() {
    fetchData().then(() => renderList());
  }

  function goToNode(id) {
    fetchData().then(() => {
      renderList();
      if (id) showEntryDetail(id);
    });
  }

  function onLangChange() {
    if (pageData) renderList();
  }

  window.__birikenParcalarApp = { activate, goToNode, onLangChange };
})();
