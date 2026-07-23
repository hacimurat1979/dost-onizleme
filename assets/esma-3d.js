window.__esma3dApp = (function () {
  "use strict";

  const I18n = window.DostI18n;

  // Kapsayıcılık/mertebe ilişkisini deneysel olarak üç boyutta gösteren bir
  // prototip (bkz. CLAUDE.md'ye eklenecek not, kullanıcı talebi 2026-07-23).
  // Bilinçli olarak sade tutuluyor: sadece ilk üç mertebe (Zât, Allah, dokuz
  // ana isim) -- esma.json'daki 84 adet derinlik-3 ismin hepsini aynı sahneye
  // sığdırmak okunaksız bir kalabalık üretirdi. Derinlik (z ekseni),
  // node.depth ile birebir orantılı; "billboard" tekniğiyle (her düğüm
  // sahnenin rotasyonunun tersini uygulayarak) etiketler her açıdan okunaklı
  // kalıyor, ama düğümlerin konumu gerçek 3B uzayda hesaplanıyor -- yani
  // döndürüldükçe dış halkanın iç halkaları gerçekten kuşattığı görülebiliyor.

  const RING_Z = [0, -150, -300];
  const RING_RADIUS = [0, 0, 215];

  let data = null;
  let nodeEls = [];
  let built = false;
  let toggled = false;
  let rotX = -12;
  let rotY = 18;
  let dragging = false;
  let hovering = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartRotX = 0;
  let dragStartRotY = 0;
  let idleTimer = null;
  let autoRotateRAF = null;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fetchData() {
    if (data) return Promise.resolve(data);
    return window.DostGraphUtils.fetchJson("data/ibn-arabi/esma.json").then((json) => {
      data = json.nodes.filter((n) => n.depth <= 2);
      return data;
    });
  }

  function colorVarFor(node) {
    if (node.depth === 0) return "var(--series-esma-neutral)";
    if (node.pole === "celal") return "var(--series-celal)";
    if (node.pole === "cemal") return "var(--series-cemal)";
    if (node.pole === "kemal") return "var(--series-kemal)";
    return "var(--series-esma-neutral)";
  }

  function layout(nodes) {
    const byDepth = { 0: [], 1: [], 2: [] };
    nodes.forEach((n) => byDepth[n.depth].push(n));
    const positioned = [];
    [0, 1, 2].forEach((depth) => {
      const list = byDepth[depth];
      const z = RING_Z[depth];
      const r = RING_RADIUS[depth];
      list.forEach((n, i) => {
        const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2;
        const x = r ? r * Math.cos(angle) : 0;
        const y = r ? r * Math.sin(angle) * 0.55 : 0; // hafif elips: tam yatay bir halkadan daha "kâse" hissi
        positioned.push({ node: n, x, y, z, depth });
      });
    });
    return positioned;
  }

  function buildScene() {
    const scene = document.getElementById("esma3d-scene");
    if (!scene || built) return;
    const positioned = layout(data);
    scene.innerHTML = "";
    nodeEls = positioned.map((p) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "esma3d__node" + (p.depth === 0 ? " esma3d__node--zat" : "");
      el.style.setProperty("--node-color", colorVarFor(p.node));
      el.style.setProperty("--node-d", p.depth === 0 ? "78px" : p.depth === 1 ? "62px" : "50px");
      el.dataset.id = p.node.id;
      scene.appendChild(el);
      return { el, p };
    });
    render();
    renderLabels();
    built = true;
  }

  function render() {
    const scene = document.getElementById("esma3d-scene");
    if (scene) scene.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    nodeEls.forEach(({ el, p }) => {
      el.style.transform =
        `translate3d(${p.x}px, ${p.y}px, ${p.z}px) rotateY(${-rotY}deg) rotateX(${-rotX}deg)`;
    });
  }

  function renderLabels() {
    nodeEls.forEach(({ el, p }) => {
      el.textContent = I18n.pick3(p.node.name);
    });
  }

  function settleOn(scene) {
    scene.classList.add("esma3d__scene--settling");
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => scene.classList.remove("esma3d__scene--settling"), 650);
  }

  function stopAutoRotate() {
    if (autoRotateRAF) {
      window.cancelAnimationFrame(autoRotateRAF);
      autoRotateRAF = null;
    }
  }

  function startAutoRotate() {
    if (reduceMotion || autoRotateRAF) return;
    let last = performance.now();
    function tick(now) {
      const dt = now - last;
      last = now;
      if (!dragging && !hovering) {
        rotY += dt * 0.012;
        render();
      }
      autoRotateRAF = window.requestAnimationFrame(tick);
    }
    autoRotateRAF = window.requestAnimationFrame(tick);
  }

  function showTooltip(node, event) {
    const tooltip = document.getElementById("esma3d-tooltip");
    const wrap = document.getElementById("esma3d");
    if (!tooltip || !wrap) return;
    tooltip.innerHTML = `<strong>${I18n.pick3(node.name)}</strong><br>${I18n.pick3(node.short || {})}`;
    tooltip.hidden = false;
    window.DostGraphUtils.moveTooltip(tooltip, wrap, event);
  }

  function hideTooltip() {
    window.DostGraphUtils.hideTooltip(document.getElementById("esma3d-tooltip"));
  }

  function wireInteractions() {
    const viewport = document.getElementById("esma3d-viewport");
    const scene = document.getElementById("esma3d-scene");
    if (!viewport || !scene) return;

    // Düğümler sürekli döndüğü için tıklamak zorlaşıyor -- fare üzerindeyken
    // ambient dönüşü durdurmak, hem gerçek kullanım hem de tıklamanın
    // güvenilir hedeflenmesi için gerekli.
    viewport.addEventListener("pointerenter", () => { hovering = true; });
    viewport.addEventListener("pointerleave", () => { hovering = false; });

    // Bir düğüme tıklamak da bu dinleyicilere kabarcıklanıyor (bubble) --
    // pointerdown anında hemen sürüklemeyi "taahhüt etmek" (setPointerCapture
    // dahil), düğümün kendi "click" olayının hedefini bozup tooltip'in hiç
    // açılmamasına yol açıyordu. Bunun yerine: pointerdown sadece bir ADAY
    // sürükleme başlatır; gerçek dönüş, işaretçi eşiği (DRAG_THRESHOLD)
    // aşacak kadar hareket ettiğinde başlar -- küçük bir hareketle biten
    // bir pointerdown+up, normal bir "click" olarak düğüme ulaşmaya devam
    // eder.
    const DRAG_THRESHOLD = 5;
    let dragCandidate = false;
    let pointerId = null;

    viewport.addEventListener("pointerdown", (e) => {
      dragCandidate = true;
      pointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartRotX = rotX;
      dragStartRotY = rotY;
    });
    viewport.addEventListener("pointermove", (e) => {
      if (!dragCandidate) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragging = true;
        stopAutoRotate();
        scene.classList.remove("esma3d__scene--settling");
        viewport.setPointerCapture(pointerId);
      }
      rotY = dragStartRotY + dx * 0.35;
      rotX = Math.max(-60, Math.min(60, dragStartRotX - dy * 0.35));
      render();
    });
    function endDrag() {
      dragCandidate = false;
      if (!dragging) return;
      dragging = false;
      settleOn(scene);
      if (!reduceMotion) startAutoRotate();
    }
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    nodeEls.forEach(({ el, p }) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        showTooltip(p.node, e);
      });
    });
    viewport.addEventListener("pointerdown", hideTooltip, { capture: true });
  }

  function open() {
    const wrap = document.getElementById("esma-wrap");
    const panel = document.getElementById("esma3d");
    if (!wrap || !panel) return;
    fetchData().then(() => {
      buildScene();
      wireInteractions();
      panel.hidden = false;
      toggled = true;
      if (!reduceMotion) startAutoRotate();
    });
  }

  function close() {
    const panel = document.getElementById("esma3d");
    if (panel) panel.hidden = true;
    toggled = false;
    stopAutoRotate();
    hideTooltip();
  }

  function initToggle() {
    const toggleBtn = document.getElementById("esma-3d-toggle");
    const exitBtn = document.getElementById("esma3d-exit");
    if (toggleBtn) toggleBtn.addEventListener("click", () => (toggled ? close() : open()));
    if (exitBtn) exitBtn.addEventListener("click", close);
  }

  initToggle();

  return {
    onLangChange() {
      if (built) renderLabels();
    },
  };
})();
