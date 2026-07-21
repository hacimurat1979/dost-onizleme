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
  // Esmâ'da birebir aynı diziler olarak tekrarlanıyordu). Rampanın orta
  // noktası (LAYER_COLOR[4], LAYER_COLOR_DARK[2]) KASITLI olarak style.css'teki
  // --series-ibnarabi/--series-ibnarabi (dark) ile aynı hex değeri taşıyor --
  // biri değişirse diğeri de elle güncellenmeli (7 renklik bir gradyanı
  // CSS'ten canlı okumak, aktif temaya göre yanlış ucundan değer okuma riski
  // taşıdığı için burada tercih edilmedi).
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

  // Wires up every ".legend" panel's collapse/expand toggle on the page.
  // On short/touch viewports the panel starts collapsed by default, since a
  // fully-expanded legend can otherwise sit on top of the graph and hide
  // nodes behind it.
  function setupLegendToggles() {
    const collapseByDefault = window.matchMedia("(max-height: 700px)").matches
      || window.matchMedia("(pointer: coarse)").matches;
    document.querySelectorAll(".legend").forEach((legend) => {
      const toggle = legend.querySelector(".legend__toggle");
      if (!toggle) return;
      if (collapseByDefault) {
        legend.classList.add("legend--collapsed");
        toggle.setAttribute("aria-expanded", "false");
      }
      toggle.addEventListener("click", () => {
        const collapsed = legend.classList.toggle("legend--collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
      });
    });
  }

  // Shared D3 force-simulation drag behavior (Ontoloji/Compare/Daphne-profil
  // all wired this up independently). `shouldSkip(d)`, if given, excludes
  // nodes (e.g. a fixed central hub) from being draggable.
  function createDragBehavior(sim, shouldSkip) {
    function dragstarted(event, d) {
      if (shouldSkip && shouldSkip(d)) return;
      if (!event.active) sim.alphaTarget(0.2).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d) {
      if (shouldSkip && shouldSkip(d)) return;
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event, d) {
      if (shouldSkip && shouldSkip(d)) return;
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
  }

  return { getVar, moveTooltip, hideTooltip, LAYER_COLOR, LAYER_COLOR_DARK, ZAT_FILL, isDark, setupLegendToggles, createDragBehavior };
})();
