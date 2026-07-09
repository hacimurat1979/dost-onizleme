(function () {
  "use strict";

  const I18n = window.DostI18n;

  // Enhanced reading modes for detail panel
  const readingModes = {
    compact: "Compact",
    expanded: "Expanded",
    sourceView: "Source View"
  };

  let currentReadingMode = "compact";

  function initializeReadingMode() {
    // Add reading mode selector to detail panel
    const detailPanel = document.getElementById("detail-panel");
    if (!detailPanel || document.getElementById("reading-mode-selector")) return;

    const selector = document.createElement("div");
    selector.id = "reading-mode-selector";
    selector.className = "reading-mode-selector";
    selector.innerHTML = `
      <div class="reading-mode-buttons">
        <button class="reading-mode-btn reading-mode-btn--active" data-mode="compact"
                data-tr="Kısa" data-en="Compact" data-pt="Compacto">Kısa</button>
        <button class="reading-mode-btn" data-mode="expanded"
                data-tr="Geniş" data-en="Expanded" data-pt="Expandido">Geniş</button>
        <button class="reading-mode-btn" data-mode="sourceView"
                data-tr="Kaynaklar" data-en="Sources" data-pt="Fontes">Kaynaklar</button>
      </div>
    `;

    // Insert before detail content
    const detailContent = document.getElementById("detail-content");
    detailPanel.insertBefore(selector, detailContent);

    // Wire up buttons
    selector.querySelectorAll(".reading-mode-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const mode = e.target.dataset.mode;
        switchReadingMode(mode);
      });
    });

    // Add typography control
    addTypographyControls();
  }

  function switchReadingMode(mode) {
    currentReadingMode = mode;

    // Update button states
    document.querySelectorAll(".reading-mode-btn").forEach((btn) => {
      btn.classList.toggle("reading-mode-btn--active", btn.dataset.mode === mode);
    });

    // Update detail panel layout
    const detailPanel = document.getElementById("detail-panel");
    detailPanel.setAttribute("data-reading-mode", mode);

    // Store preference
    try {
      localStorage.setItem("dost-reading-mode", mode);
    } catch (e) {}
  }

  function addTypographyControls() {
    if (document.getElementById("typography-controls")) return;

    const controls = document.createElement("div");
    controls.id = "typography-controls";
    controls.className = "typography-controls";
    controls.innerHTML = `
      <button class="typography-btn" id="font-size-decrease"
              title="Yazı boyutunu küçült / Decrease font size / Diminuir tamanho da fonte"
              aria-label="A-">A-</button>
      <button class="typography-btn" id="font-size-increase"
              title="Yazı boyutunu büyült / Increase font size / Aumentar tamanho da fonte"
              aria-label="A+">A+</button>
      <button class="typography-btn" id="line-height-toggle"
              title="Satır yüksekliğini değiştir / Toggle line height / Alternar altura da linha"
              aria-label="⊕" style="font-weight: 700;">⊕</button>
    `;

    const detailPanel = document.getElementById("detail-panel");
    const header = detailPanel.querySelector(".reading-mode-selector");
    if (header) {
      header.appendChild(controls);
    } else {
      detailPanel.insertBefore(controls, document.getElementById("detail-content"));
    }

    // Setup controls
    let fontScale = localStorage.getItem("dost-font-scale") || "1";
    let lineHeightMode = localStorage.getItem("dost-line-height") || "normal";

    applyFontSize(fontScale);
    applyLineHeight(lineHeightMode);

    document.getElementById("font-size-decrease").addEventListener("click", () => {
      fontScale = Math.max(0.85, parseFloat(fontScale) - 0.15);
      applyFontSize(fontScale);
      try {
        localStorage.setItem("dost-font-scale", fontScale);
      } catch (e) {}
    });

    document.getElementById("font-size-increase").addEventListener("click", () => {
      fontScale = Math.min(1.5, parseFloat(fontScale) + 0.15);
      applyFontSize(fontScale);
      try {
        localStorage.setItem("dost-font-scale", fontScale);
      } catch (e) {}
    });

    document.getElementById("line-height-toggle").addEventListener("click", () => {
      lineHeightMode = lineHeightMode === "normal" ? "spacious" : "normal";
      applyLineHeight(lineHeightMode);
      try {
        localStorage.setItem("dost-line-height", lineHeightMode);
      } catch (e) {}
    });
  }

  function applyFontSize(scale) {
    const root = document.documentElement;
    root.style.setProperty("--detail-font-scale", scale);
  }

  function applyLineHeight(mode) {
    const root = document.documentElement;
    const lh = mode === "spacious" ? "1.9" : "1.6";
    root.style.setProperty("--detail-line-height", lh);
  }

  function restoreReadingPreferences() {
    const savedMode = localStorage.getItem("dost-reading-mode");
    if (savedMode) {
      setTimeout(() => switchReadingMode(savedMode), 500);
    }

    const savedFontScale = localStorage.getItem("dost-font-scale");
    if (savedFontScale) {
      applyFontSize(savedFontScale);
    }

    const savedLineHeight = localStorage.getItem("dost-line-height");
    if (savedLineHeight) {
      applyLineHeight(savedLineHeight);
    }
  }

  // Initialize when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initializeReadingMode();
      restoreReadingPreferences();
    });
  } else {
    initializeReadingMode();
    restoreReadingPreferences();
  }

  window.__readingMode = {
    switchReadingMode,
    currentReadingMode: () => currentReadingMode,
    restoreReadingPreferences
  };
})();
