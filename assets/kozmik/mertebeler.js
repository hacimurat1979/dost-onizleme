/**
 * MERTEBELER (Hazarât-ı Hamse) -- bir katmandan diğerine SINIR AŞARAK değil
 * ÇÖZÜNÜRLÜK DEĞİŞEREK geçiliyor: yaklaştıkça netleşiyor, uzaklaştıkça
 * bulanıklaşıyor (bulanıklık=bilgisizlik, görsel dil kuralı). Beş katman
 * d3-zoom ile sürekli bir "focus" ekseninde geziniyor -- Atlas'ın (FAZ B)
 * "zoom'lanabilir" fikrinin küçük bir önizlemesi.
 *
 * Kullanıcı kararı (2026-08-02, "hepsini 3B'ye taşı"): düz DOM-katman
 * kesişmesi yerine, Atlas'ın (bkz. atlas.js) benimsediği aynı motor --
 * kamera merkez eksene yakın, alçalan bir sarmal boyunca iniyor, beş
 * katman kendi konumlarında bir çekirdek+parlama olarak duruyor.
 *
 * API: mount(el, opts) -> { destroy() }.
 */
window.DostKozmikSahne = window.DostKozmikSahne || {};
window.DostKozmikSahne.mertebeler = (function () {
  "use strict";

  const HAZARAT = [
    { tr: "Gayb-ı Mutlak", en: "Absolute Unseen", pt: "Invisível Absoluto", hue: 230 },
    { tr: "Gayb-ı İzâfî", en: "Relative Unseen", pt: "Invisível Relativo", hue: 265 },
    { tr: "Âlem-i Misâl", en: "World of Imagination", pt: "Mundo da Imaginação", hue: 310 },
    { tr: "Âlem-i Şehâdet", en: "World of Witnessing", pt: "Mundo do Testemunho", hue: 32 },
    { tr: "İnsân-ı Kâmil", en: "The Perfect Human", pt: "O Ser Humano Perfeito", hue: 45 },
  ];

  const TURNS = 1.35, HEIGHT = 3.4, NODE_R = 1.55, CAM_R = 0.6;
  function helixPoint(i, n, radius) {
    const t = n > 1 ? i / (n - 1) : 0;
    const angle = t * TURNS * Math.PI * 2;
    return { x: Math.cos(angle) * radius, y: HEIGHT / 2 - t * HEIGHT, z: Math.sin(angle) * radius, angle: angle };
  }

  function mount(el, opts) {
    opts = opts || {};
    const KU = window.DostKozmikUtils;
    const lang = (window.DostI18n && window.DostI18n.getLang && window.DostI18n.getLang()) || "tr";
    const n = HAZARAT.length;

    const labelEl = document.createElement("div");
    labelEl.className = "kozmik-mertebeler-label";
    el.appendChild(labelEl);
    function updateLabel() {
      const idx = Math.max(0, Math.min(n - 1, Math.round(focus)));
      labelEl.textContent = HAZARAT[idx][lang] || HAZARAT[idx].tr;
    }

    let focus = 2, target = 2, destroyed = false, rafId = null, groupSpin = 0;
    let three3d = null;

    function updateCamera() {
      if (!three3d) return;
      const t = n > 1 ? Math.max(0, Math.min(1, focus / (n - 1))) : 0;
      const y = HEIGHT / 2 - t * HEIGHT;
      const angle = t * TURNS * Math.PI * 2 + groupSpin;
      three3d.camera.position.set(Math.cos(angle) * CAM_R, y, Math.sin(angle) * CAM_R);
      // Küçük bir ileri kayma (Atlas'taki aynı ders: büyük kayma odaktaki
      // düğümü kadraj köşesine itip orada kırpılmış gösteriyordu).
      const la = angle + 0.15;
      three3d.camera.lookAt(Math.cos(la) * CAM_R * 0.4, y - 0.5, Math.sin(la) * CAM_R * 0.4);
      three3d.nodes.forEach(function (nd) {
        const p = helixPoint(nd.i, n, NODE_R);
        const a = p.angle + groupSpin;
        const x = Math.cos(a) * NODE_R, z = Math.sin(a) * NODE_R;
        nd.mesh.position.set(x, p.y, z);
        nd.glow.position.set(x, p.y, z);
        const dist = Math.abs(nd.i - focus);
        const closeness = Math.max(0, 1 - dist * 0.6);
        nd.mat.emissiveIntensity = 0.4 + closeness * 1.1;
        // Atlas'ta yakalanan aynı hata: kamera odaklanılan düğüme yakınken
        // glow'un DÜNYA boyutunu da büyütmek, perspektifin zaten büyüttüğü
        // nesneyi katlıyor, kadrajı dolduran bir leke üretiyordu. Büyümeyi
        // tamamen perspektife bırakıp yakınlığı parlaklık/opaklıkta taşı.
        const s = 0.08 + closeness * 0.04;
        nd.glow.scale.set(s, s, 1);
        nd.glowMat.opacity = 0.25 + closeness * 0.55;
      });
    }

    function renderThree() {
      updateCamera();
      if (three3d) three3d.renderer.render(three3d.scene, three3d.camera);
    }

    function render() {
      renderThree();
      updateLabel();
    }

    window.DostKozmikLoader.loadThree().then(function (THREE) {
      if (destroyed) return;
      const canvas = document.createElement("canvas");
      el.appendChild(canvas);
      const r = el.getBoundingClientRect();
      const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(r.width, r.height, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, r.width / Math.max(1, r.height), 0.05, 20);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const dl = new THREE.DirectionalLight(0xfff3d8, 0.65);
      dl.position.set(2, 3, 2);
      scene.add(dl);

      const glowTex = KU.makeGlowTexture(THREE);
      const nodes = HAZARAT.map(function (hz, i) {
        const p = helixPoint(i, n, NODE_R);
        const color = new THREE.Color("hsl(" + hz.hue + ",58%,62%)");
        const geo = new THREE.SphereGeometry(0.055, 18, 14);
        const mat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5, roughness: 0.4 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.x, p.y, p.z);
        scene.add(mesh);
        const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(0.8, 0.8, 1);
        glow.position.copy(mesh.position);
        scene.add(glow);
        return { mesh: mesh, glow: glow, mat: mat, glowMat: glowMat, i: i };
      });

      three3d = { renderer: renderer, scene: scene, camera: camera, nodes: nodes };
      const ro = new ResizeObserver(function () {
        const rr = el.getBoundingClientRect();
        renderer.setSize(rr.width, rr.height, false);
        camera.aspect = rr.width / Math.max(1, rr.height);
        camera.updateProjectionMatrix();
      });
      ro.observe(el);
      three3d.ro = ro;

      render();

      if (opts.reducedMotion) return;

      function loop() {
        if (destroyed) return;
        focus += (target - focus) * 0.09;
        groupSpin += 0.0007;
        render();
        rafId = requestAnimationFrame(loop);
      }
      loop();

      const stopVisibility = KU.watchVisibility(
        function () { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
        function () { if (!rafId && !destroyed) loop(); }
      );
      three3d.cleanupExtra = function () {
        stopVisibility();
      };
    });

    const zoom = d3.zoom()
      .scaleExtent([0.4, 6])
      .filter(function (event) { return !opts.reducedMotion && !event.button; })
      .on("zoom", function (event) {
        const k = event.transform.k;
        target = Math.max(0, Math.min(n - 1, 2 + Math.log2(k) * 1.6));
      });
    const sel = d3.select(el).call(zoom);

    return {
      destroy() {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        sel.on(".zoom", null);
        if (three3d) {
          if (three3d.cleanupExtra) three3d.cleanupExtra();
          if (three3d.ro) three3d.ro.disconnect();
          three3d.nodes.forEach(function (nd) {
            nd.mesh.geometry.dispose();
            nd.mat.dispose();
            nd.glowMat.dispose();
          });
          three3d.renderer.dispose();
        }
        el.innerHTML = "";
      },
    };
  }

  return { mount };
})();
