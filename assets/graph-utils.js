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

  // Bir görünümün requestAnimationFrame döngüsü, o görünüm ekranda DEĞİLKEN
  // (başka bir sekmeye/görünüme geçilmişken) çalışmaya devam etmemeli.
  // Hâller/Esmâ/Sorular'ın üçünde de döngü koşulu `!reduceMotion` idi -- yani
  // hareket kısıtlaması açık olmayan normal kullanıcıda HER ZAMAN doğru:
  // görünüm bir kez açıldıktan sonra, başka bölüme geçilse bile saniyede 60
  // kez tam render sürüyordu ve birkaç grafik gezildiğinde bunlar üst üste
  // binip bütün siteyi (metin kutularına yazmayı bile) yavaşlatıyordu.
  // 2026-07-25'te kullanıcının "sayfa yavaşladı, harfler geç çıkıyor"
  // bildirimiyle yakalandı.
  function isViewActive(wrapEl) {
    return !!wrapEl && !wrapEl.hidden && document.visibilityState !== "hidden";
  }

  // Sekme geri geldiğinde / görünüm yeniden açıldığında döngüyü uyandırmak
  // isteyen modüller buraya abone olur.
  const _wakeSubs = [];
  function onViewWake(fn) {
    _wakeSubs.push(fn);
    if (_wakeSubs.length === 1) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") _wakeSubs.forEach((f) => { try { f(); } catch (e) {} });
      });
    }
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

  // -------------------------------------------------------------------------
  // Paylaşılan 2B↔3B eğim motoru (bkz. research/GRAFIK-FELSEFESI.md)
  //
  // Hâller, Menziller, Esmâ ve Ontoloji'de bu projeksiyon dört kez elle
  // yazılmıştı. Sırlar ve Sorular'a da gelince beşinci ve altıncı kopyayı
  // yazmak yerine motoru buraya taşıdık. Felsefe belgesindeki kural
  // ("yeni bir kütüphane ekleme, bu motoru kullan") aynen geçerli --
  // Three.js/WebGL YOK, elle yaw/pitch + perspektif bölme.
  //
  // Sözleşme: tilt=0'da project() gelen (x,y)'yi AYNEN geri verir; yani
  // 2B görünüm matematiksel olarak hiç bozulmaz. tilt=1'de düzlem yatar,
  // `vert` (katman yüksekliği) dikeyde görünür olur.
  function createTilt(opts) {
    const o = opts || {};
    const FOCAL = o.focal || 2400;
    const DUR = o.duration || 1050;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tilt = 0, target = 0, from = 0, animStart = 0;
    let yaw = 0, pitch = o.pitch == null ? 0.26 : o.pitch;
    let dragging = false;

    function set(t, instant) {
      from = tilt; target = t; animStart = performance.now();
      if (t < 0.5) yaw = 0;
      // Varsayılan olarak 3B açılan görünümlerde morfu izleyen olmuyor ama
      // açılıştaki öbür işlerle yarışıp takılmaya yol açıyor -- o yüzden
      // "instant" seçeneği var (bkz. hal/esma/menziller/ontoloji openIn3D).
      if (instant || reduce) { tilt = t; from = t; }
    }
    // Her karede çağrılır; eğim animasyonu ilerler, kendiliğinden dönüş
    // uygulanır. Sahne hâlâ hareketliyse true döner.
    function step(ts, dt, spinning) {
      let active = false;
      if (tilt !== target) {
        if (reduce) tilt = target;
        else {
          const p = Math.min(1, (ts - animStart) / DUR);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          tilt = from + (target - from) * e;
          if (p >= 1) tilt = target; else active = true;
        }
      }
      if (tilt > 0.5 && spinning !== false && !dragging && !reduce) {
        yaw += dt * (o.spinRate == null ? 0.00006 : o.spinRate);
        active = true;
      }
      return active;
    }
    // x,y: düz (2B) konum. vert: bu düğümün katman yüksekliği (0 = düzlem).
    function project(x, y, vert) {
      if (tilt < 0.001) return { x: x, y: y, depth: 1, z: 0 };
      const py = y * (1 - tilt) + (vert || 0) * tilt;
      const pz = y * tilt;
      const yy = yaw * tilt, pp = pitch * tilt;
      const cyw = Math.cos(yy), syw = Math.sin(yy);
      const x1 = x * cyw + pz * syw;
      const z1 = -x * syw + pz * cyw;
      const cpt = Math.cos(pp), spt = Math.sin(pp);
      const y2 = py * cpt - z1 * spt;
      const z2 = py * spt + z1 * cpt;
      const zc = Math.max(z2, -FOCAL * 0.85);
      const depth = FOCAL / (FOCAL + zc);
      return { x: x1 * depth, y: y2 * depth, depth: depth, z: z2 };
    }
    // 3B'de boş alanı sürükleyerek döndürme.
    function wireDrag(el, onChange, skipSel) {
      let lx = 0, ly = 0;
      el.addEventListener("pointerdown", (e) => {
        if (target < 0.5) return;
        if (skipSel && e.target.closest && e.target.closest(skipSel)) return;
        dragging = true; lx = e.clientX; ly = e.clientY;
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      });
      el.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        yaw += (e.clientX - lx) * 0.006;
        pitch = Math.max(0.02, Math.min(1.1, pitch + (e.clientY - ly) * 0.004));
        lx = e.clientX; ly = e.clientY;
        if (onChange) onChange();
      });
      const stop = (e) => {
        if (!dragging) return;
        dragging = false;
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      el.addEventListener("pointerup", stop);
      el.addEventListener("pointercancel", stop);
    }
    function wireToggle(btnId, onChange) {
      const btn = document.getElementById(btnId);
      if (!btn || btn.dataset.wiredTilt) return btn;
      btn.dataset.wiredTilt = "1";
      btn.setAttribute("aria-pressed", String(target > 0.5));
      btn.classList.toggle("is-on", target > 0.5);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const to = target > 0.5 ? 0 : 1;
        set(to);
        btn.classList.toggle("is-on", to > 0.5);
        btn.setAttribute("aria-pressed", to > 0.5 ? "true" : "false");
        if (onChange) onChange(to);
      });
      return btn;
    }
    function markOn(btnId) {
      const btn = document.getElementById(btnId);
      if (btn) { btn.classList.add("is-on"); btn.setAttribute("aria-pressed", "true"); }
    }
    return {
      set: set, step: step, project: project, wireDrag: wireDrag,
      wireToggle: wireToggle, markOn: markOn,
      get value() { return tilt; },
      get on() { return target > 0.5; },
      get dragging() { return dragging; },
    };
  }

  return { getVar, moveTooltip, hideTooltip, LAYER_COLOR, LAYER_COLOR_DARK, ZAT_FILL, isDark, setupLegendToggles, createDragBehavior, setupDetailPanelFocus, createZoomBehavior, fetchJson, isViewActive, onViewWake, createTilt };
})();
