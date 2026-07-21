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
              aria-label="A− / A- / A-">A−</button>
      <button class="typography-btn" id="font-size-increase"
              title="Yazı boyutunu büyült / Increase font size / Aumentar tamanho da fonte"
              aria-label="A+">A+</button>
    `;

    const detailContent = document.getElementById("detail-content");
    detailPanel.insertBefore(controls, detailContent);

    window.DostFontScale.bindFontScaleButtons(
      document.getElementById("font-size-decrease"),
      document.getElementById("font-size-increase")
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeTypographyControls);
  } else {
    initializeTypographyControls();
  }
})();
