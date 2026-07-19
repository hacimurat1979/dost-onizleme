window.DostGraphUtils = (function () {
  "use strict";

  function getVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function moveTooltip(tooltip, wrapEl, event) {
    if (!tooltip || tooltip.hidden || !wrapEl) return;
    const rect = wrapEl.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    x = Math.max(60, Math.min(rect.width - 60, x));
    y = Math.max(50, y);
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function hideTooltip(tooltip) {
    if (tooltip) tooltip.hidden = true;
  }

  // Derinliğe göre boyanan düğümler için paylaşılan mavi rampa (Ontoloji ve
  // Esmâ'da birebir aynı diziler olarak tekrarlanıyordu).
  const LAYER_COLOR = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#2a78d6", "#1c5cab", "#0d366b"];
  const LAYER_COLOR_DARK = ["#184f95", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#86b6ef", "#cde2fb"];

  // Zât is the one node in both Ontoloji and Esmâ whose own "color" is
  // unknowable -- known only through its glow -- so its circle is left the
  // whitest tone possible rather than given a pole/layer color.
  const ZAT_FILL = "#ffffff";

  // Not: OS/tarayıcı tercihini değil, sitenin kendi karanlık-mod anahtarını
  // (document.body[data-theme]) esas alır -- kullanıcı sistem tercihinin
  // aksine bir tema seçtiğinde de doğru rampayı döndürsün diye.
  function isDark() {
    return document.body.getAttribute("data-theme") === "dark";
  }

  return { getVar, moveTooltip, hideTooltip, LAYER_COLOR, LAYER_COLOR_DARK, ZAT_FILL, isDark };
})();
