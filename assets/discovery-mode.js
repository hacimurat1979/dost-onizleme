(function () {
  "use strict";

  const I18n = window.DostI18n;
  let discoveryData = null;
  let currentRoute = null;
  let currentStep = 0;

  async function loadDiscoveryData() {
    if (!discoveryData) {
      const [routes, timeline, layers] = await Promise.all([
        fetch('/data/ibn-arabi/discovery-routes.json').then(r => r.json()),
        fetch('/data/ibn-arabi/timeline.json').then(r => r.json()),
        fetch('/data/ibn-arabi/concept-layers.json').then(r => r.json())
      ]);
      discoveryData = { routes, timeline, layers };
    }
    return discoveryData;
  }

  function createDiscoveryPanel() {
    if (document.getElementById("discovery-panel")) return;

    const panel = document.createElement("div");
    panel.id = "discovery-panel";
    panel.className = "discovery-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");

    panel.innerHTML = `
      <div class="discovery-panel__overlay"></div>
      <div class="discovery-panel__content">
        <div class="discovery-panel__header">
          <h2 class="discovery-panel__title" data-tr="Dost'u Keşfet" data-en="Discover Dost" data-pt="Descubra Dost">
            Dost'u Keşfet
          </h2>
          <button class="discovery-panel__close" type="button" aria-label="Kapat">×</button>
        </div>
        <div class="discovery-panel__body" id="discovery-content"></div>
      </div>
    `;

    document.body.appendChild(panel);

    const closeBtn = panel.querySelector(".discovery-panel__close");
    const overlay = panel.querySelector(".discovery-panel__overlay");
    closeBtn.addEventListener("click", closeDiscoveryMode);
    overlay.addEventListener("click", closeDiscoveryMode);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) closeDiscoveryMode();
    });

    return panel;
  }

  function showRouteSelection(routes) {
    const content = document.getElementById("discovery-content");
    content.innerHTML = `
      <div class="discovery-routes-selector">
        <p class="discovery-routes-intro" data-tr="İbn Arabi'nin düşüncesine bir yolculuğa başlayın. Altı keşif rotasından birini seçin."
                                         data-en="Begin a journey into Ibn Arabi's thought. Choose one of six discovery routes."
                                         data-pt="Comece uma jornada pelo pensamento de Ibn Arabi. Escolha uma de seis rotas de descoberta.">
          İbn Arabi'nin düşüncesine bir yolculuğa başlayın. Altı keşif rotasından birini seçin.
        </p>
        <div class="discovery-routes-grid">
          ${routes.map(route => `
            <div class="discovery-route-card" data-route-id="${route.id}" style="border-left: 4px solid ${route.color};">
              <div class="discovery-route-card__color-indicator" style="background-color: ${route.color};"></div>
              <h3 class="discovery-route-card__title">${I18n.pick3(route.title)}</h3>
              <p class="discovery-route-card__subtitle">${I18n.pick3(route.subtitle)}</p>
              <p class="discovery-route-card__description">${I18n.pick3(route.description)}</p>
              <div class="discovery-route-card__steps">
                <small>${route.steps.length} adım</small>
              </div>
              <button class="discovery-route-btn" data-route-id="${route.id}"
                      data-tr="Başla" data-en="Start" data-pt="Começar">Başla</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    content.querySelectorAll(".discovery-route-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const routeId = e.target.dataset.routeId;
        const route = routes.find(r => r.id === routeId);
        if (route) startRoute(route);
      });
    });
  }

  function startRoute(route) {
    currentRoute = route;
    currentStep = 0;
    showRouteStep();
  }

  function showRouteStep() {
    if (!currentRoute || currentStep >= currentRoute.steps.length) return;

    const step = currentRoute.steps[currentStep];
    const content = document.getElementById("discovery-content");

    content.innerHTML = `
      <div class="discovery-journey">
        <div class="journey-header">
          <button class="journey-back-btn" data-tr="← Rotalar" data-en="← Routes" data-pt="← Rotas">← Rotalar</button>
          <h3 class="journey-title">${I18n.pick3(currentRoute.title)}</h3>
          <div class="journey-progress">
            <div class="journey-progress-bar" style="width: ${((currentStep + 1) / currentRoute.steps.length) * 100}%;"></div>
            <span class="journey-progress-text">${currentStep + 1}/${currentRoute.steps.length}</span>
          </div>
        </div>

        <div class="journey-step" style="border-top: 3px solid ${currentRoute.color};">
          <h4 class="journey-step__title">${I18n.pick3(step.title)}</h4>
          <p class="journey-step__question">${I18n.pick3(step.question)}</p>

          <div class="journey-controls">
            ${currentStep > 0 ? `<button class="journey-nav-btn journey-nav-btn--prev" data-tr="← Önceki" data-en="← Previous" data-pt="← Anterior">← Önceki</button>` : ''}
            ${currentStep < currentRoute.steps.length - 1 ? `<button class="journey-nav-btn journey-nav-btn--next" data-tr="Sonraki →" data-en="Next →" data-pt="Próximo →">Sonraki →</button>` : `<button class="journey-nav-btn journey-nav-btn--complete" data-tr="Rotayı Tamamla" data-en="Complete Route" data-pt="Completar Rota">Rotayı Tamamla</button>`}
          </div>

          <div class="journey-concept" id="journey-concept">
            <!-- Concept layers will be loaded here -->
          </div>
        </div>
      </div>
    `;

    // Load concept layers
    loadConceptLayers(step.nodeId);

    // Wire up navigation
    const backBtn = content.querySelector(".journey-back-btn");
    const prevBtn = content.querySelector(".journey-nav-btn--prev");
    const nextBtn = content.querySelector(".journey-nav-btn--next");
    const completeBtn = content.querySelector(".journey-nav-btn--complete");

    if (backBtn) backBtn.addEventListener("click", () => showRouteSelection(discoveryData.routes.routes));
    if (prevBtn) prevBtn.addEventListener("click", () => { currentStep--; showRouteStep(); });
    if (nextBtn) nextBtn.addEventListener("click", () => { currentStep++; showRouteStep(); });
    if (completeBtn) completeBtn.addEventListener("click", () => showRouteCompletion());

    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" && prevBtn) prevBtn.click();
      if (e.key === "ArrowRight" && (nextBtn || completeBtn)) (nextBtn || completeBtn).click();
    });
  }

  function loadConceptLayers(nodeId) {
    const conceptDiv = document.getElementById("journey-concept");
    if (!conceptDiv) return;

    // Find concept in layers data
    const concept = discoveryData.layers.concepts[nodeId.replace(/-/g, '-')] ||
                   Object.values(discoveryData.layers.concepts)[0]; // fallback

    if (!concept) {
      conceptDiv.innerHTML = `<p>${I18n.pick3({ tr: "Kavram detayları yakında eklenecek", en: "Concept details coming soon", pt: "Detalhes do conceito em breve" })}</p>`;
      return;
    }

    // Build layers interface
    conceptDiv.innerHTML = `
      <div class="concept-tabs">
        ${discoveryData.layers.schema.layers.map((layer, idx) => `
          <button class="concept-tab ${idx === 0 ? 'concept-tab--active' : ''}" data-layer="${layer.id}">
            <span class="concept-tab__icon">${layer.icon}</span>
            <span class="concept-tab__name">${I18n.pick3(layer.name)}</span>
          </button>
        `).join('')}
      </div>
      <div class="concept-content" id="concept-content"></div>
    `;

    // Wire up tabs
    const tabs = conceptDiv.querySelectorAll(".concept-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("concept-tab--active"));
        tab.classList.add("concept-tab--active");
        showConceptLayer(concept, tab.dataset.layer);
      });
    });

    // Show first layer
    if (tabs.length > 0) showConceptLayer(concept, tabs[0].dataset.layer);
  }

  function showConceptLayer(concept, layerId) {
    const contentDiv = document.getElementById("concept-content");
    const layer = concept.layers[layerId];

    if (!layer) {
      contentDiv.innerHTML = `<p>Detaylar yakında...</p>`;
      return;
    }

    let layerHTML = `
      <div class="concept-layer">
        <h5 class="concept-layer__title">${I18n.pick3(layer.title)}</h5>
    `;

    if (typeof layer.content === 'string') {
      // Simple text content
      layerHTML += `<div class="concept-layer__content">${layer.content.replace(/\n/g, '<br>')}</div>`;
    } else if (Array.isArray(layer.content)) {
      // Array of items (e.g., verses, quotes)
      layerHTML += `<div class="concept-layer__items">`;
      layer.content.forEach(item => {
        layerHTML += `
          <div class="concept-item">
            ${item.verse ? `<p class="concept-item__ref">${item.verse}</p>` : ''}
            ${item.quote ? `<p class="concept-item__quote">"${I18n.pick3(item.quote)}"</p>` : ''}
            ${item.text ? `<p class="concept-item__text">${I18n.pick3(item.text)}</p>` : ''}
            ${item.interpretation ? `<p class="concept-item__interpretation">${I18n.pick3(item.interpretation)}</p>` : ''}
            ${item.source ? `<p class="concept-item__source">— ${I18n.pick3(item.source)}</p>` : ''}
          </div>
        `;
      });
      layerHTML += `</div>`;
    } else if (typeof layer.content === 'object') {
      // Multilingual object
      layerHTML += `<div class="concept-layer__content">${I18n.pick3(layer.content).replace(/\n/g, '<br>')}</div>`;
    }

    layerHTML += `</div>`;
    contentDiv.innerHTML = layerHTML;
  }

  function showRouteCompletion() {
    const content = document.getElementById("discovery-content");
    content.innerHTML = `
      <div class="discovery-completion">
        <div class="completion-message">
          <h3 data-tr="Rotayı Tamamladınız!" data-en="You Completed the Route!" data-pt="Você Completou a Rota!">
            Rotayı Tamamladınız!
          </h3>
          <p>${I18n.pick3(currentRoute.title)}</p>
          <p class="completion-reflection" data-tr="Şimdi bu dörtlü arasında nasıl bir ilişki olduğunu anlıyor musunuz?"
                                          data-en="Now do you see how these concepts relate?"
                                          data-pt="Agora você vê como esses conceitos se relacionam?">
            Şimdi bu dörtlü arasında nasıl bir ilişki olduğunu anlıyor musunuz?
          </p>
          <button class="completion-btn" data-tr="Başka Bir Rotayı Dene" data-en="Try Another Route" data-pt="Tente Outra Rota">
            Başka Bir Rotayı Dene
          </button>
        </div>
      </div>
    `;

    content.querySelector(".completion-btn").addEventListener("click", () => {
      currentRoute = null;
      showRouteSelection(discoveryData.routes.routes);
    });
  }

  function openDiscoveryMode() {
    const modal = document.getElementById("discovery-panel") || createDiscoveryPanel();
    modal.hidden = false;
    document.body.style.overflow = "hidden";

    loadDiscoveryData().then(data => {
      showRouteSelection(data.routes.routes);
    });
  }

  function closeDiscoveryMode() {
    const modal = document.getElementById("discovery-panel");
    if (modal) {
      modal.hidden = true;
      document.body.style.overflow = "";
    }
  }

  function addDiscoveryButton() {
    const headerControls = document.querySelector(".app-header__controls");
    if (!headerControls || document.getElementById("discovery-btn")) return;

    const btn = document.createElement("button");
    btn.id = "discovery-btn";
    btn.className = "btn-ghost";
    btn.type = "button";
    btn.setAttribute("data-tr", "Keşfet");
    btn.setAttribute("data-en", "Discover");
    btn.setAttribute("data-pt", "Descobrir");
    btn.textContent = "Keşfet";
    btn.title = "Dost'u keşfet / Discover Dost / Descubra Dost";

    headerControls.insertBefore(btn, document.getElementById("theme-toggle"));
    btn.addEventListener("click", openDiscoveryMode);
  }

  // Initialize when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      addDiscoveryButton();
      createDiscoveryPanel();
    });
  } else {
    addDiscoveryButton();
    createDiscoveryPanel();
  }

  window.__discoveryMode = {
    openDiscoveryMode,
    closeDiscoveryMode,
    startRoute
  };
})();
