window.__esma3dApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;

  // Esmâ'nın mertebe/kapsayıcılık ilişkisini üç boyutta gösteren görünüm.
  // esma.js'teki mevcut d3.stratify + d3.tree radyal düzenini yeniden
  // kullanıp, derinliği gerçek bir Z eksenine taşıyoruz ve elle bir
  // yaw/pitch rotasyon + perspektif projeksiyonla tek bir SVG'ye
  // düşürüyoruz -- yeni bir framework/bağımlılık eklemeden (Three.js
  // değil, salt D3 + matematik). Bütün 103 ismi (ve ebeveyn-çocuk
  // kenarlarını) tek sahnede gösterebiliyor; performans maliyeti düşük
  // çünkü her düğüm mutlak konumlu bir HTML elemanı değil, SVG içinde
  // çizilen bir daire+metin.
  //
  // Okunabilirlik için: sadece Zât ve Allah (derinlik 0-1) her zaman
  // yazıyla etiketli; geri kalan 101 isim üzerine gelindiğinde (hover)
  // beliriyor -- aksi hâlde derinlik-3'teki 84 isim aynı anda yazılınca
  // okunaksız bir kalabalık oluşuyordu.

  const Z_STEP = 95;
  const BASE_R = 46;
  const R_STEP = 15;
  const FOCAL = 640;
  const ALWAYS_LABELED_DEPTH = 1;

  let data = null;
  let root = null;
  let nodesFlat = [];
  let built = false;
  let toggled = false;
  let yaw = 0.5;
  let pitch = -0.28;
  let zoomScale = 1;
  let dragging = false;
  let hovering = false;
  let hoveredId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartYaw = 0;
  let dragStartPitch = 0;
  let autoRotateRAF = null;
  let idleTimer = null;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fetchData() {
    if (data) return Promise.resolve(data);
    return GU.fetchJson("data/ibn-arabi/esma.json").then((json) => {
      data = json.nodes;
      return data;
    });
  }

  function colorFor(node) {
    if (node.depth === 0) return "var(--series-esma-neutral)";
    if (node.pole === "celal") return "var(--series-celal)";
    if (node.pole === "cemal") return "var(--series-cemal)";
    if (node.pole === "kemal") return "var(--series-kemal)";
    return "var(--series-esma-neutral)";
  }

  function buildHierarchy() {
    root = d3.stratify()
      .id((d) => d.id)
      .parentId((d) => d.parent)(data);

    d3.tree().size([2 * Math.PI, 1])(root);

    nodesFlat = root.descendants().map((d) => {
      const depth = d.depth;
      const theta = d.x;
      const r = depth === 0 ? 0 : BASE_R + (depth - 1) * R_STEP;
      return {
        node: d.data,
        depth,
        x0: r * Math.cos(theta),
        y0: r * Math.sin(theta),
        z0: -depth * Z_STEP,
        parentId: d.parent ? d.parent.id : null,
      };
    });
  }

  function project(p) {
    // Yaw (Y ekseni etrafında), sonra pitch (X ekseni etrafında).
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const x1 = p.x0 * cosY + p.z0 * sinY;
    const z1 = -p.x0 * sinY + p.z0 * cosY;
    const y1 = p.y0;

    const cosX = Math.cos(pitch), sinX = Math.sin(pitch);
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;
    const x2 = x1;

    // Döndürme sırasında bir düğüm sanal kameranın arkasına geçebilir
    // (z2 <= -FOCAL); bu durumda ölçek negatife/sonsuza gidip geçersiz
    // (negatif) bir SVG yarıçapı üretiyordu. z2'yi kamera düzleminin
    // önünde kalacak şekilde kırpmak, ölçeği her zaman pozitif tutuyor.
    const zClamped = Math.max(z2, -FOCAL * 0.85);
    const scale = (FOCAL / (FOCAL + zClamped)) * zoomScale;
    return { sx: x2 * scale, sy: y2 * scale, scale, z2 };
  }

  let svgSel = null;
  let nodeSel = null;

  function render() {
    if (!svgSel) return;
    const projected = nodesFlat.map((p) => Object.assign({}, p, project(p)));
    const byId = new Map(projected.map((p) => [p.node.id, p]));

    // Ebeveyn-çocuk kenarları -- ilişki türleri (aynı sınıf, zıt kutup vb.)
    // bu sade prototipte bilinçli olarak dışarıda bırakıldı; sadece
    // hiyerarşinin kendisi (kapsayıcılık) gösteriliyor.
    const links = projected.filter((p) => p.parentId).map((p) => ({
      source: byId.get(p.parentId),
      target: p,
    }));

    // Arkadan öne çiz (ressam algoritması) -- SVG gerçek bir z-buffer
    // tutmuyor, bu yüzden derinliğe göre elle sıralamak gerekiyor.
    const sortedNodes = projected.slice().sort((a, b) => b.z2 - a.z2);

    svgSel.select(".esma3d-links")
      .selectAll("line")
      .data(links, (d) => d.source.node.id + "->" + d.target.node.id)
      .join("line")
      .attr("class", "esma3d-link")
      .attr("x1", (d) => d.source.sx)
      .attr("y1", (d) => d.source.sy)
      .attr("x2", (d) => d.target.sx)
      .attr("y2", (d) => d.target.sy)
      .style("opacity", (d) => Math.max(0.08, Math.min(0.55, 1.15 - d.target.depth * 0.11)));

    nodeSel = svgSel.select(".esma3d-nodes")
      .selectAll("g.esma3d-node")
      .data(sortedNodes, (d) => d.node.id)
      .join((enter) => {
        const g = enter.append("g").attr("class", "esma3d-node").attr("data-id", (d) => d.node.id);
        g.append("circle").attr("class", "esma3d-node__dot");
        g.append("text").attr("class", "esma3d-node__label");
        g.on("pointerenter", (event, d) => { hoveredId = d.node.id; render(); });
        g.on("pointerleave", (event, d) => { if (hoveredId === d.node.id) hoveredId = null; render(); });
        return g;
      });

    // Ressam algoritması sırasını DOM sırasına da yansıt (SVG boyama
    // sırası doküman sırasını izler).
    nodeSel.order();

    nodeSel
      .attr("transform", (d) => `translate(${d.sx},${d.sy})`)
      .style("opacity", (d) => Math.max(0.22, Math.min(1, d.scale * 1.05)));

    nodeSel.select(".esma3d-node__dot")
      .attr("r", (d) => (d.depth === 0 ? 22 : Math.max(3.2, 9 - d.depth * 0.6)) * d.scale)
      .style("fill", (d) => colorFor(d.node));

    nodeSel.select(".esma3d-node__label")
      .attr("y", (d) => -((d.depth === 0 ? 22 : Math.max(3.2, 9 - d.depth * 0.6)) * d.scale) - 4)
      .style("font-size", (d) => Math.max(7, 12 - d.depth * 0.6) + "px")
      .style("opacity", (d) => {
        if (d.node.id === hoveredId) return 1;
        if (d.depth <= ALWAYS_LABELED_DEPTH) return 1;
        return 0;
      })
      .text((d) => I18n.pick3(d.node.name));
  }

  function showTooltip(node, event) {
    const tooltip = document.getElementById("esma3d-tooltip");
    const wrap = document.getElementById("esma3d");
    if (!tooltip || !wrap) return;
    tooltip.innerHTML = `<strong>${I18n.pick3(node.name)}</strong><br>${I18n.pick3(node.short || {})}`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrap, event);
  }
  function hideTooltip() {
    GU.hideTooltip(document.getElementById("esma3d-tooltip"));
  }

  function settle() {
    const svg = document.getElementById("esma3d-svg");
    if (!svg) return;
    svg.classList.add("esma3d-settling");
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => svg.classList.remove("esma3d-settling"), 500);
  }

  function stopAutoRotate() {
    if (autoRotateRAF) {
      window.cancelAnimationFrame(autoRotateRAF);
      autoRotateRAF = null;
    }
  }
  function startAutoRotate() {
    // Kullanıcı hiçbir şey yapmadığı sürece sakin, yavaş bir dönüş --
    // tam tur yaklaşık 45 saniye sürüyor (dikkat dağıtmadan derinliği
    // hissettirecek kadar yavaş).
    if (reduceMotion || autoRotateRAF) return;
    let last = performance.now();
    function tick(now) {
      const dt = now - last;
      last = now;
      if (!dragging && !hovering) {
        yaw += dt * 0.00014;
        render();
      }
      autoRotateRAF = window.requestAnimationFrame(tick);
    }
    autoRotateRAF = window.requestAnimationFrame(tick);
  }

  function wireInteractions() {
    const viewport = document.getElementById("esma3d-viewport");
    if (!viewport || viewport.dataset.wired) return;
    viewport.dataset.wired = "1";

    viewport.addEventListener("pointerenter", () => { hovering = true; });
    viewport.addEventListener("pointerleave", () => { hovering = false; });

    const DRAG_THRESHOLD = 5;
    let dragCandidate = false;
    let pointerId = null;

    viewport.addEventListener("pointerdown", (e) => {
      dragCandidate = true;
      pointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartYaw = yaw;
      dragStartPitch = pitch;
    });
    viewport.addEventListener("pointermove", (e) => {
      if (!dragCandidate) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragging = true;
        stopAutoRotate();
        viewport.setPointerCapture(pointerId);
      }
      yaw = dragStartYaw + dx * 0.008;
      pitch = Math.max(-1.2, Math.min(1.2, dragStartPitch - dy * 0.008));
      render();
    });
    function endDrag() {
      dragCandidate = false;
      if (!dragging) return;
      dragging = false;
      settle();
      if (!reduceMotion) startAutoRotate();
    }
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomScale = Math.max(0.4, Math.min(3, zoomScale * (e.deltaY < 0 ? 1.08 : 0.93)));
      render();
    }, { passive: false });

    svgSel.select(".esma3d-nodes").on("click", (e) => {
      const g = e.target.closest("g.esma3d-node");
      if (!g) return;
      e.stopPropagation();
      const id = g.getAttribute("data-id");
      const found = nodesFlat.find((p) => p.node.id === id);
      if (found) showTooltip(found.node, e);
    });
    viewport.addEventListener("pointerdown", hideTooltip, { capture: true });
  }

  function buildScene() {
    if (built) return;
    buildHierarchy();
    const svg = d3.select("#esma3d-svg");
    svgSel = svg;
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("class", "esma3d-scene");
    g.append("g").attr("class", "esma3d-links");
    g.append("g").attr("class", "esma3d-nodes");

    function resize() {
      const el = document.getElementById("esma3d-viewport");
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight;
      svg.attr("viewBox", `${-w / 2} ${-h / 2} ${w} ${h}`);
    }
    resize();
    window.addEventListener("resize", resize);

    render();
    built = true;
  }

  function open() {
    const panel = document.getElementById("esma3d");
    if (!panel) return;
    fetchData().then(() => {
      // Panel gizliyken viewport'un clientWidth/Height'ı 0 döner --
      // buildScene()'in ilk resize() çağrısının doğru boyutu okuyabilmesi
      // için hidden'ı KALDIRMAK, sahneyi kurmaktan ÖNCE gelmeli.
      panel.hidden = false;
      buildScene();
      wireInteractions();
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
      if (built) render();
    },
  };
})();
