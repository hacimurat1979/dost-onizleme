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
    cizimler: { tr: "Çizimler", en: "Diagrams", pt: "Diagramas" },
    "biriken-parcalar": { tr: "Biriken Parçalar", en: "Gathered Pieces", pt: "Peças Reunidas" },
  };

  // terimler.js'teki VIEW_HUE'nun aynısı -- her görünüm sitede aynı sabit
  // tonla anılıyor (chip'lerde olduğu gibi burada da düğüm/istasyon rengi).
  const VIEW_HUE = {
    ontoloji: 40,
    esma: 200,
    hal: 265,
    terimler: 15,
    sorular: 225,
    futuhat: 340,
    sirlar: 100,
    cizimler: 185,
    "biriken-parcalar": 45,
  };

  let pageData = null;
  let fetchPromise = null;
  let entryById = new Map();

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeHtmlAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function fetchData() {
    if (pageData) return Promise.resolve(pageData);
    if (fetchPromise) return fetchPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("biriken-parcalar-wrap");
    fetchPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/biriken-parcalar.json")
      .then((data) => {
        pageData = data;
        entryById = new Map(data.entries.map((e) => [e.id, e]));
        if (window.DostViewStatus) window.DostViewStatus.hide("biriken-parcalar-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Biriken Parçalar verisi yüklenemedi / Failed to load Gathered Pieces data", err);
        fetchPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("biriken-parcalar-wrap", () => window.__birikenParcalarApp.activate());
      });
    return fetchPromise;
  }

  // Bu bölümün tüm anlamı "dağınık parçaların bir merkeze yakınsaması"
  // (bkz. CLAUDE.md üçüncü ilke) -- düz bir liste yerine, her kaynağı bir
  // istasyon, senteze giden her okumayı da o istasyondan merkeze uzanan bir
  // ışın olarak gösteren dairesel bir diyagram (daire+çizim ilkeleri burada
  // birebir örtüşüyor). Düğümler tıklanabilir/klavye erişilebilir kalır --
  // eski chip butonunun yaptığı navigasyonu üstleniyor.
  function convergenceDiagramSvg(kaynaklar) {
    const n = kaynaklar.length;
    if (!n) return "";
    // Genişlik yüksekten fazla: sol/sağ uçtaki düğümlerin etiketleri yatayda
    // dışa doğru uzanıyor (text-anchor start/end), kare bir viewBox'ta bu
    // metinler kenardan taşıp kırpılıyordu -- yatay pay için genişlik artırıldı.
    const width = 320;
    const height = 260;
    const cx = 160;
    const cy = height / 2;
    const outerR = 92;
    const nodeR = 9;
    const centerR = 14;
    const nodes = kaynaklar.map((k, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = cx + outerR * Math.cos(angle);
      const y = cy + outerR * Math.sin(angle);
      const hue = VIEW_HUE[k.view] !== undefined ? VIEW_HUE[k.view] : 40;
      const chipLabel = k.label ? tt(k.label) : tt(VIEW_LABEL[k.view] || {});
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const anchor = cos > 0.2 ? "start" : cos < -0.2 ? "end" : "middle";
      const labelX = x + (cos > 0.2 ? nodeR + 6 : cos < -0.2 ? -(nodeR + 6) : 0);
      const labelY = y + (sin > 0.4 ? 18 : sin < -0.4 ? -12 : 4);
      return { x, y, hue, chipLabel, anchor, labelX, labelY, view: k.view, id: k.id };
    });
    const convergingLabel = tt({
      tr: "Bu okumanın toplandığı yerler",
      en: "Where this reading converges from",
      pt: "De onde esta leitura converge",
    });
    const spokes = nodes
      .map((nd) => `<line class="gorulen-yer-diagram__spoke" x1="${cx}" y1="${cy}" x2="${nd.x.toFixed(1)}" y2="${nd.y.toFixed(1)}" style="--tag-hue:${nd.hue}"></line>`)
      .join("");
    const nodeEls = nodes
      .map(
        (nd) => `<g class="gorulen-yer-diagram__node" tabindex="0" role="button" data-view="${nd.view}" data-id="${nd.id}" style="--tag-hue:${nd.hue}" aria-label="${escapeHtmlAttr(nd.chipLabel)}">
          <circle cx="${nd.x.toFixed(1)}" cy="${nd.y.toFixed(1)}" r="${nodeR}"></circle>
          <text x="${nd.labelX.toFixed(1)}" y="${nd.labelY.toFixed(1)}" text-anchor="${nd.anchor}">${escapeHtml(nd.chipLabel)}</text>
        </g>`
      )
      .join("");
    return `<svg class="gorulen-yer-diagram" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtmlAttr(convergingLabel)}">
      ${spokes}
      <circle class="gorulen-yer-diagram__center" cx="${cx}" cy="${cy}" r="${centerR}"></circle>
      ${nodeEls}
    </svg>`;
  }

  function gorulenYerlerHtml(kaynaklar, gorulenYerler) {
    if (!kaynaklar || !gorulenYerler) return "";
    const items = kaynaklar
      .map((k, i) => {
        const text = gorulenYerler[i];
        if (!text) return "";
        const hue = VIEW_HUE[k.view] !== undefined ? VIEW_HUE[k.view] : 40;
        const chipLabel = k.label ? tt(k.label) : `${tt(VIEW_LABEL[k.view] || {})} → ${k.id}`;
        return `<div class="gorulen-yer-item">
          <p class="gorulen-yer-item__label" style="--tag-hue:${hue}"><span class="gorulen-yer-item__dot"></span>${chipLabel}</p>
          <p>${tt(text)}</p>
        </div>`;
      })
      .join("");
    return `${convergenceDiagramSvg(kaynaklar)}<div class="gorulen-yer-list">${items}</div>`;
  }

  // Üç durak (önce / fark edişi / şimdi) hafif bir eğri üzerinde --
  // düz bir "1-2-3" kutusu yerine, sitenin köşeli değil eğrisel/dairesel
  // biçimleri tercih etme ilkesine uygun bir yumuşak yay. Tam bir daireye
  // zorlamıyoruz (CLAUDE.md: doğası gereği dairesel olmayanı zorlama) --
  // bu bir gelişim/derinleşme süreci, başa dönüş değil.
  function timelineDiagramSvg(labels) {
    const width = 320;
    const height = 110;
    const xs = [36, 160, 284];
    const ys = [70, 30, 55];
    const r = 8;
    const path = `M ${xs[0]} ${ys[0]} Q ${xs[1]} ${ys[1] - 30} ${xs[1]} ${ys[1]} Q ${xs[1]} ${ys[2] - 20} ${xs[2]} ${ys[2]}`;
    const stageClasses = ["anlayis-timeline__node--once", "anlayis-timeline__node--fark", "anlayis-timeline__node--simdi"];
    const nodes = labels
      .map(
        (label, i) => `<g class="anlayis-timeline__node ${stageClasses[i]}">
          <circle cx="${xs[i]}" cy="${ys[i]}" r="${r}"></circle>
          <text x="${xs[i]}" y="${ys[i] + (i === 1 ? -16 : 20)}" text-anchor="middle">${escapeHtml(label)}</text>
        </g>`
      )
      .join("");
    return `<svg class="anlayis-timeline__diagram" viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">
      <path class="anlayis-timeline__path" d="${path}"></path>
      ${nodes}
    </svg>`;
  }

  function renderTimeline() {
    const section = document.getElementById("anlayis-timeline");
    const introEl = document.getElementById("anlayis-timeline-intro");
    const entriesEl = document.getElementById("anlayis-timeline-entries");
    if (!section || !introEl || !entriesEl) return;
    const tc = pageData.zaman_cizelgesi;
    if (!tc || !tc.entries || !tc.entries.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    introEl.textContent = tt(tc.intro);
    const stageLabels = tt({
      tr: ["Önce", "Fark Edişi", "Şimdi"],
      en: ["Before", "The Realization", "Now"],
      pt: ["Antes", "A Percepção", "Agora"],
    });
    entriesEl.innerHTML = tc.entries
      .map(
        (e) => `<article class="anlayis-timeline__entry">
          <h3 class="anlayis-timeline__entry-title">${tt(e.konu)}</h3>
          ${timelineDiagramSvg(stageLabels)}
          <div class="anlayis-timeline__stages">
            <div class="anlayis-timeline__stage anlayis-timeline__stage--once">
              <p class="anlayis-timeline__stage-label">${escapeHtml(stageLabels[0])}</p>
              <p>${tt(e.once)}</p>
            </div>
            <div class="anlayis-timeline__stage anlayis-timeline__stage--fark">
              <p class="anlayis-timeline__stage-label">${escapeHtml(stageLabels[1])}</p>
              <p>${tt(e.fark_edis)}</p>
            </div>
            <div class="anlayis-timeline__stage anlayis-timeline__stage--simdi">
              <p class="anlayis-timeline__stage-label">${escapeHtml(stageLabels[2])}</p>
              <p>${tt(e.simdi)}</p>
            </div>
          </div>
        </article>`
      )
      .join("");
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
        ${gorulenYerlerHtml(e.kaynaklar, e.gorulen_yerler)}
      </div>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${tt({ tr: "Bir Okuma Denemesi", en: "A Reading Attempt", pt: "Uma Tentativa de Leitura" })}</h3>
        <p>${tt(e.sentez)}</p>
      </div>
    `;
    detailContent.querySelectorAll(".gorulen-yer-diagram__node").forEach((node) => {
      const go = () => window.__dostNav && window.__dostNav.goTo(node.dataset.view, node.dataset.id);
      node.addEventListener("click", go);
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          go();
        }
      });
    });
    detailPanel.hidden = false;
    window.__dostNav && window.__dostNav.setHash("biriken-parcalar", id);
  }

  function activate() {
    fetchData().then((data) => {
      if (!data) return;
      renderList();
      renderTimeline();
    });
  }

  function goToNode(id) {
    fetchData().then((data) => {
      if (!data) return;
      renderList();
      renderTimeline();
      if (id) showEntryDetail(id);
    });
  }

  function onLangChange() {
    if (pageData) {
      renderList();
      renderTimeline();
    }
  }

  window.__birikenParcalarApp = { activate, goToNode, onLangChange };
})();
