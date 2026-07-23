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
  // okunaksız bir kalabalık oluşuyordu. Etiketler renkli birer "rozet"
  // (düğümün kendi rengi, koyulaştırılmış) olarak açılıyor -- düz metin +
  // ince kontur, dönen bir sahnenin üzerinde okunaksız kalıyordu.
  //
  // Renkler/efektler kasıtlı olarak esma.js'teki (2B) şemayla BİREBİR
  // aynı: Zât beyaz dolgu + altın "soluyan" halo (bkz. paylaşılan
  // .node--root .node-halo kuralı), Allah --series-theme altını, diğer
  // isimler kutuplarına göre (celâl/cemâl/kemâl/nötr), hepsinde aynı
  // parlaklık/sheen dolgusu (#node-sheen, index.html'deki paylaşılan SVG
  // defs). Zât'ın yarıçapı (34px) da Ontoloji ve Esmâ'nın 2B
  // graflarındaki "dhat"/"zat" düğümüyle birebir aynı (bkz. ontology.js
  // RADIUS_BY_ID yorumu: "matches esma.js's zat root radius").

  const Z_STEP = 130;
  const FOCAL = 900;
  const ALWAYS_LABELED_DEPTH = 1;

  // Mertebe başına yörünge yarıçapı -- derinlik 3'te 84 isim olduğu için
  // (en kalabalık halka) orana göre çok daha geniş bir yörünge alıyor;
  // derinlik 4+ zaten birkaç isimden oluştuğu için sıkışma riski yok.
  const RING_R = { 0: 0, 1: 120, 2: 250, 3: 560, 4: 700, 5: 750, 6: 790, 7: 820, 8: 848, 9: 872 };
  function ringRadiusFor(depth) {
    return RING_R[depth] !== undefined ? RING_R[depth] : 872;
  }

  // Düğüm yarıçapı -- esma.js'in kendi radiusFor()'uyla birebir aynı
  // ölçek: Zât ve Allah 34 (esma.js/ontology.js'teki paylaşılan 34px),
  // ana isimler (esma.json depth 2) 22, geri kalanı esma.js'teki
  // Math.max(9, 16 - derinlik) formülüyle -- sadece derinlik burada bir
  // kaydırmayla (esma.js'in ağacı Zât'ı dışarıda tutup Allah'ı kök
  // saydığı için) hesaplanıyor.
  function dotRadiusFor(depth) {
    if (depth <= 1) return 34;
    const treeDepth = depth - 1;
    if (treeDepth === 1) return 22;
    return Math.max(9, 16 - treeDepth);
  }

  let data = null;
  let root = null;
  let nodesFlat = [];
  let built = false;
  let toggled = false;
  let yaw = 0.5;
  let pitch = -0.14;
  let zoomScale = 0.5;
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

  function colorFor(node, id) {
    if (node.depth === 0) return GU.ZAT_FILL;
    if (id === "allah") return GU.getVar("--series-theme");
    if (node.pole === "celal") return GU.getVar("--series-celal");
    if (node.pole === "cemal") return GU.getVar("--series-cemal");
    if (node.pole === "kemal") return GU.getVar("--series-kemal");
    return GU.getVar("--series-esma-neutral");
  }

  // Rozetin (etiket arka planının) rengi genelde düğümün kendi rengini
  // koyulaştırıyor (bkz. render()'daki color-mix) -- ama Zât'ın dolgusu
  // beyaz (GU.ZAT_FILL, 2B ile birebir aynı) olduğu için bu formül
  // neredeyse renksiz, soluk bir gri üretirdi. Zât'ın rozeti bunun yerine
  // kendi altın halosuyla aynı tonu (--series-theme) kullanıyor.
  function badgeColorFor(node, id) {
    if (node.depth === 0) return GU.getVar("--series-theme");
    return colorFor(node, id);
  }

  function buildHierarchy() {
    root = d3.stratify()
      .id((d) => d.id)
      .parentId((d) => d.parent)(data);

    d3.tree().size([2 * Math.PI, 1])(root);

    nodesFlat = root.descendants().map((d) => {
      const depth = d.depth;
      const theta = d.x;
      const r = ringRadiusFor(depth);
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
    // depthScale sadece derinliğe (kameraya uzaklığa) bağlı -- opaklık
    // ("sis") buradan hesaplanıyor. scale ise kullanıcının yakınlaştırma
    // seviyesini de içeriyor ve konum/boyut için kullanılıyor. İkisini
    // karıştırmak, kullanıcı uzaklaştırdığında (zoomScale küçüldüğünde)
    // Zât dahil BÜTÜN düğümlerin -- sadece küçülmesi değil -- solup
    // yıkanmış görünmesine yol açıyordu.
    const depthScale = FOCAL / (FOCAL + zClamped);
    const scale = depthScale * zoomScale;
    return { sx: x2 * scale, sy: y2 * scale, scale, depthScale, z2 };
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
        const g = enter.append("g")
          .attr("class", (d) => "esma3d-node" + (d.depth === 0 ? " node--root" : ""))
          .attr("data-id", (d) => d.node.id);
        // Zât'a özgü altın "soluyan" halo -- ontoloji/esma 2B graflarındaki
        // paylaşılan .node--root .node-halo kuralını doğrudan yeniden
        // kullanıyor (index.html'in defs'i, style.css'in animasyonu).
        g.filter((d) => d.depth === 0)
          .append("circle")
          .attr("class", "node-halo");
        g.append("circle").attr("class", "esma3d-node__dot");
        // Her düğüme aynı parlaklık/sheen bindirmesi -- esma.js'in her
        // düğüme uyguladığı #node-sheen ile birebir aynı.
        g.append("circle").attr("class", "node-sheen");
        g.append("rect").attr("class", "esma3d-node__badge");
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
      .style("opacity", (d) => Math.max(0.35, Math.min(1, d.depthScale * 1.05)));

    nodeSel.each(function (d) {
      const g = d3.select(this);
      const r = dotRadiusFor(d.depth) * d.scale;
      const color = colorFor(d.node, d.node.id);

      g.select(".node-halo").attr("r", r * 1.4);

      g.select(".esma3d-node__dot")
        .attr("r", r)
        .style("fill", color);

      g.select(".node-sheen").attr("r", r);

      const showLabel = d.node.id === hoveredId || d.depth <= ALWAYS_LABELED_DEPTH;
      const label = g.select(".esma3d-node__label")
        .attr("y", -r - 6)
        .style("font-size", Math.max(11, 13 - d.depth * 0.4) + "px")
        .style("display", showLabel ? null : "none")
        .text(I18n.pick3(d.node.name));

      const badge = g.select(".esma3d-node__badge")
        .style("display", showLabel ? null : "none");

      if (showLabel) {
        const bbox = label.node().getBBox();
        const badgeColor = badgeColorFor(d.node, d.node.id);
        badge
          .attr("x", bbox.x - 7)
          .attr("y", bbox.y - 3)
          .attr("width", bbox.width + 14)
          .attr("height", bbox.height + 6)
          .attr("rx", (bbox.height + 6) / 2)
          .style("fill", `color-mix(in srgb, ${badgeColor} 78%, black)`);
      }
    });
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
      zoomScale = Math.max(0.15, Math.min(3, zoomScale * (e.deltaY < 0 ? 1.08 : 0.93)));
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
