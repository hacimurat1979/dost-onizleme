(function () {
  "use strict";

  function initializeTypographyControls() {
    const detailPanel = document.getElementById("detail-panel");
    if (!detailPanel || document.getElementById("typography-controls")) return;

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
    `;

    const detailContent = document.getElementById("detail-content");
    detailPanel.insertBefore(controls, detailContent);

    let fontScale = parseFloat(localStorage.getItem("dost-font-scale")) || 1;
    applyFontSize(fontScale);

    document.getElementById("font-size-decrease").addEventListener("click", () => {
      fontScale = Math.max(0.8, Math.round((fontScale - 0.2) * 100) / 100);
      applyFontSize(fontScale);
      try { localStorage.setItem("dost-font-scale", fontScale); } catch (e) {}
    });

    document.getElementById("font-size-increase").addEventListener("click", () => {
      fontScale = Math.min(1.8, Math.round((fontScale + 0.2) * 100) / 100);
      applyFontSize(fontScale);
      try { localStorage.setItem("dost-font-scale", fontScale); } catch (e) {}
    });
  }

  function applyFontSize(scale) {
    document.documentElement.style.setProperty("--detail-font-scale", scale);
  }

  function restoreReadingPreferences() {
    const savedFontScale = localStorage.getItem("dost-font-scale");
    if (savedFontScale) applyFontSize(savedFontScale);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initializeTypographyControls();
      restoreReadingPreferences();
    });
  } else {
    initializeTypographyControls();
    restoreReadingPreferences();
  }
})();
