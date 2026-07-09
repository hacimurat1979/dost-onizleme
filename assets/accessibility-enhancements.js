(function () {
  "use strict";

  const I18n = window.DostI18n;

  let allNodes = [];
  let currentFocusedNodeIdx = -1;
  let highContrastMode = false;

  function initializeAccessibility(nodes) {
    allNodes = nodes || [];

    // Restore high contrast preference
    const saved = localStorage.getItem("dost-high-contrast");
    if (saved === "true") {
      enableHighContrast();
    }

    // Setup keyboard navigation
    setupKeyboardNavigation();

    // Add accessibility instructions
    addAccessibilityHelpText();
  }

  function setupKeyboardNavigation() {
    document.addEventListener("keydown", (e) => {
      // Only in ontology view
      if (!document.getElementById("ontology-wrap") || document.getElementById("ontology-wrap").hidden) {
        return;
      }

      // Tab through nodes
      if (e.key === "Tab") {
        e.preventDefault();
        const direction = e.shiftKey ? -1 : 1;
        navigateNodes(direction);
      }

      // Enter/Space to open detail
      if ((e.key === "Enter" || e.key === " ") && currentFocusedNodeIdx >= 0) {
        e.preventDefault();
        const node = allNodes[currentFocusedNodeIdx];
        if (node) {
          // Find and click the node element
          const nodeElements = document.querySelectorAll("g.ontology-node");
          if (nodeElements[currentFocusedNodeIdx]) {
            const clickEvent = new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window
            });
            nodeElements[currentFocusedNodeIdx].dispatchEvent(clickEvent);
          }
        }
      }

      // Escape to unfocus
      if (e.key === "Escape") {
        unfocusNodes();
      }
    });
  }

  function navigateNodes(direction) {
    const nodeElements = document.querySelectorAll("g.ontology-node");
    if (nodeElements.length === 0) return;

    // Remove previous focus
    nodeElements.forEach((el) => el.classList.remove("node--keyboard-focus"));

    // Calculate next index
    currentFocusedNodeIdx += direction;
    if (currentFocusedNodeIdx < 0) currentFocusedNodeIdx = nodeElements.length - 1;
    if (currentFocusedNodeIdx >= nodeElements.length) currentFocusedNodeIdx = 0;

    // Add focus to new node
    const focusedNode = nodeElements[currentFocusedNodeIdx];
    if (focusedNode) {
      focusedNode.classList.add("node--keyboard-focus");
      focusedNode.setAttribute("tabindex", "0");

      // Announce to screen readers
      const label = focusedNode.getAttribute("aria-label");
      announceToScreenReader(`Focused: ${label || "Node"}`);
    }
  }

  function unfocusNodes() {
    document.querySelectorAll("g.ontology-node").forEach((el) => {
      el.classList.remove("node--keyboard-focus");
    });
    currentFocusedNodeIdx = -1;
  }

  function enableHighContrast() {
    if (highContrastMode) return;
    highContrastMode = true;
    document.documentElement.setAttribute("data-contrast", "high");
    localStorage.setItem("dost-high-contrast", "true");
  }

  function disableHighContrast() {
    if (!highContrastMode) return;
    highContrastMode = false;
    document.documentElement.removeAttribute("data-contrast");
    localStorage.setItem("dost-high-contrast", "false");
  }

  function toggleHighContrast() {
    if (highContrastMode) {
      disableHighContrast();
    } else {
      enableHighContrast();
    }
  }

  function announceToScreenReader(message) {
    const announcement = document.getElementById("sr-announcement");
    if (announcement) {
      announcement.textContent = message;
    }
  }

  function addAccessibilityHelpText() {
    // Add screen reader announcement area if not exists
    if (!document.getElementById("sr-announcement")) {
      const announcement = document.createElement("div");
      announcement.id = "sr-announcement";
      announcement.className = "sr-only";
      announcement.setAttribute("role", "status");
      announcement.setAttribute("aria-live", "polite");
      announcement.setAttribute("aria-atomic", "true");
      document.body.appendChild(announcement);
    }

    // Add accessibility help button
    const headerControls = document.querySelector(".app-header__controls");
    if (headerControls && !document.getElementById("a11y-help-btn")) {
      const helpBtn = document.createElement("button");
      helpBtn.id = "a11y-help-btn";
      helpBtn.className = "btn-ghost";
      helpBtn.type = "button";
      helpBtn.setAttribute("data-tr", "Erişilebilirlik");
      helpBtn.setAttribute("data-en", "Accessibility");
      helpBtn.setAttribute("data-pt", "Acessibilidade");
      helpBtn.textContent = "Erişilebilirlik";
      helpBtn.title = "Accessibility options / Erişilebilirlik seçenekleri";

      headerControls.insertBefore(helpBtn, document.getElementById("theme-toggle"));
      helpBtn.addEventListener("click", showAccessibilityMenu);
    }
  }

  function showAccessibilityMenu() {
    const menu = document.getElementById("a11y-menu") || createAccessibilityMenu();
    menu.hidden = menu.hidden ? false : true;
  }

  function createAccessibilityMenu() {
    const menu = document.createElement("div");
    menu.id = "a11y-menu";
    menu.className = "a11y-menu";
    menu.hidden = true;

    menu.innerHTML = `
      <div class="a11y-menu__content">
        <h3 class="a11y-menu__title" data-tr="Erişilebilirlik Seçenekleri" data-en="Accessibility Options" data-pt="Opções de Acessibilidade">
          Erişilebilirlik Seçenekleri
        </h3>
        <label class="a11y-option">
          <input type="checkbox" id="high-contrast-toggle" class="a11y-option__input">
          <span class="a11y-option__label" data-tr="Yüksek Kontrast Modu" data-en="High Contrast Mode" data-pt="Modo de Alto Contraste">
            Yüksek Kontrast Modu
          </span>
        </label>
        <div class="a11y-info" data-tr="Tuş Kısayolları: Tab = Gezin, Enter = Aç, Esc = Çık" data-en="Keyboard Shortcuts: Tab = Navigate, Enter = Open, Esc = Exit" data-pt="Atalhos de Teclado: Tab = Navegar, Enter = Abrir, Esc = Sair">
          Tuş Kısayolları: Tab = Gezin, Enter = Aç, Esc = Çık
        </div>
      </div>
    `;

    document.body.appendChild(menu);

    const toggle = menu.querySelector("#high-contrast-toggle");
    if (highContrastMode) toggle.checked = true;
    toggle.addEventListener("change", () => toggleHighContrast());

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && !document.getElementById("a11y-help-btn").contains(e.target)) {
        menu.hidden = true;
      }
    });

    return menu;
  }

  // Initialize when ontology app is ready
  const checkOntology = () => {
    if (window.__ontologyApp && window.__ontologyApp.nodes) {
      initializeAccessibility(window.__ontologyApp.nodes);
      clearInterval(checkInterval);
    }
  };
  const checkInterval = setInterval(checkOntology, 100);
  setTimeout(() => clearInterval(checkInterval), 5000);

  window.__accessibility = {
    enableHighContrast,
    disableHighContrast,
    toggleHighContrast,
    navigateNodes,
    announceToScreenReader
  };
})();
