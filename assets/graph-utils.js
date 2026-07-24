window.DostGraphUtils = (function () {
  "use strict";

  // Every view's data-loading boilerplate was `fetch(url).then(r => r.json())`
  // with no check that the response actually succeeded -- a 404/500 (bad
  // deploy, renamed file) surfaced as an opaque "Unexpected token '<'"
  // JSON-parse error instead of a clear failure. One shared helper for all
  // ~24 call sites across the site's view modules.
  function fetchJson(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(`fetchJson: ${url} -> HTTP ${r.status}`);
      return r.json();
    });
  }

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
    // .node-hover-tip'in tabanı imlecin ~14px üstünde büyür (bkz. style.css
    // transform: translate(-50%, calc(-100% - 14px))) -- uzun bir alıntı
    // (örn. Sırlar'daki bir sır'ın tam metni) imleç ekranın üst kısmındayken
    // bu yükseklikle görünüm alanının üstüne taşabiliyordu. İçerik
    // yerleştirildikten sonra gerçek yüksekliği ölçüp üstten taşıyorsa
    // imlecin ALTINA doğru büyümeye çeviriyoruz.
    tooltip.classList.remove("node-hover-tip--flip");
    if (tooltip.getBoundingClientRect().top < 4) tooltip.classList.add("node-hover-tip--flip");
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

  // Shared D3 zoom setup (esma/hal/sorular/sirlar-graph/ontology all
  // repeated this identically, only scaleExtent differing). Ctrl/Cmd+wheel
  // or a two-finger touch to zoom -- plain wheel/scroll is left free for
  // the page itself to scroll. `extraFilter(event)`, if given, is ANDed
  // into the fallback case (ontology.js's force-layout needs this to keep
  // a node-drag click from also panning the whole canvas; the four
  // fixed-layout tree/radial views don't need it and pass nothing).
  function createZoomBehavior(svg, zoomLayer, scaleExtent, extraFilter) {
    const zoomBehavior = d3.zoom()
      .scaleExtent(scaleExtent)
      .filter((event) => {
        if (event.type === "wheel") return event.ctrlKey || event.metaKey;
        if (event.touches) return event.touches.length > 1;
        return extraFilter ? extraFilter(event) : true;
      })
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform));
    svg.call(zoomBehavior).on("dblclick.zoom", null);
    return zoomBehavior;
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

  // #detail-panel/#detail-close aynı id'lerle her üç sayfada da yaşıyor
  // (index.html/ontology.js, compare.html/compare.js, daphne-profil.html/
  // daphne-profil.js) -- her görünümün kendi "hidden = false" satırını tek
  // tek yamamak yerine (14+ çağrı yeri), MutationObserver ile TEK bir yerden
  // odak yönetimi ekliyoruz: panel açılınca kapatma düğmesine odaklan,
  // panel kapanınca odağı paneli açan öğeye geri döndür.
  function setupDetailPanelFocus() {
    const panel = document.getElementById("detail-panel");
    if (!panel) return;
    let lastFocused = null;
    const observer = new MutationObserver(() => {
      if (panel.hidden) {
        if (lastFocused && document.contains(lastFocused) && typeof lastFocused.focus === "function") {
          lastFocused.focus();
        }
        lastFocused = null;
      } else {
        lastFocused = document.activeElement;
        const closeBtn = document.getElementById("detail-close");
        if (closeBtn) closeBtn.focus();
      }
    });
    observer.observe(panel, { attributes: true, attributeFilter: ["hidden"] });

    // Basit odak-tuzağı: panel açıkken Tab, arkadaki sayfaya kaçmasın.
    panel.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'))
        .filter((n) => !n.hidden && n.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  return { getVar, moveTooltip, hideTooltip, LAYER_COLOR, LAYER_COLOR_DARK, ZAT_FILL, isDark, setupLegendToggles, createDragBehavior, setupDetailPanelFocus, createZoomBehavior, fetchJson };
})();
