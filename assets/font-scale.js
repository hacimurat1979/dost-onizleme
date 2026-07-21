(function () {
  "use strict";

  const STORAGE_KEY = "dost-font-scale";
  const MIN_SCALE = 0.8;
  const MAX_SCALE = 1.8;
  const STEP = 0.2;

  function getStoredScale() {
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    return parseFloat(stored) || 1;
  }

  function applyScale(scale) {
    document.documentElement.style.setProperty("--detail-font-scale", scale);
  }

  function storeScale(scale) {
    try { localStorage.setItem(STORAGE_KEY, scale); } catch (e) {}
  }

  // Wires up a decrease/increase button pair sharing the site-wide
  // --detail-font-scale variable and dost-font-scale storage key, so the
  // reading-panel and Fütûhât toolbar controls stay in sync with each other.
  function bindFontScaleButtons(decreaseEl, increaseEl) {
    let scale = getStoredScale();
    applyScale(scale);

    if (decreaseEl) {
      decreaseEl.addEventListener("click", () => {
        scale = Math.max(MIN_SCALE, Math.round((scale - STEP) * 100) / 100);
        applyScale(scale);
        storeScale(scale);
      });
    }
    if (increaseEl) {
      increaseEl.addEventListener("click", () => {
        scale = Math.min(MAX_SCALE, Math.round((scale + STEP) * 100) / 100);
        applyScale(scale);
        storeScale(scale);
      });
    }
  }

  window.DostFontScale = { getStoredScale, applyScale, bindFontScaleButtons };
})();
