/**
 * SUDÛR / TENEZZÜLÂT -- mertebelerden iniş, basamak basamak değil sürekli
 * bir akış olarak. Keskin iç içe çemberler YASAK (görsel dil kuralı);
 * katmanlar ayrı halkalar değil, derinlik ekseninde renk değiştiren tek bir
 * parçacık sütunu olarak kodlandı -- katman GEÇİŞİ yok, katman İMASI var.
 *
 * Kullanıcı kararı (2026-08-02, "hepsini 3B'ye taşı"): akış artık düz bir
 * 2B canvas değil, gerçek bir 3B hacim -- kamera bu sütunun içinde/üstünde,
 * parçacıklar yakınlaştıkça (kameraya yaklaştıkça) doğal perspektifle
 * büyüyüp parlıyor (three.js'in sizeAttenuation'ı, elle hesaplanan bir
 * "derinlik" formülü değil).
 *
 * API: mount(el, opts) -> { destroy() }.
 */
window.DostKozmikSahne = window.DostKozmikSahne || {};
window.DostKozmikSahne.sudur = (function () {
  "use strict";

  // Üstten (Hak'a yakın, "hafif") alta (âleme yakın, "yoğun") renk yolu --
  // eski 2B sahnenin aynı paleti.
  const PALETTE = [
    [235, 214, 168],
    [201, 161, 74],
    [124, 108, 96],
    [70, 66, 74],
  ];
  function colorAt(depth) {
    const n = PALETTE.length - 1;
    const f = Math.max(0, Math.min(1, depth)) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const t = f - i;
    const a = PALETTE[i], b = PALETTE[i + 1];
    return [
      (a[0] + (b[0] - a[0]) * t) / 255,
      (a[1] + (b[1] - a[1]) * t) / 255,
      (a[2] + (b[2] - a[2]) * t) / 255,
    ];
  }

  const HEIGHT = 3.2, COL_R = 1.1;

  function mount(el, opts) {
    opts = opts || {};
    const KU = window.DostKozmikUtils;
    let destroyed = false, rafId = null, spin = 0;
    let three3d = null;

    const N = Math.round(220 * (opts.particleScale != null ? opts.particleScale : 1));

    window.DostKozmikLoader.loadThree().then(function (THREE) {
      if (destroyed) return;
      const canvas = document.createElement("canvas");
      el.appendChild(canvas);
      const r = el.getBoundingClientRect();
      const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(r.width, r.height, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, r.width / Math.max(1, r.height), 0.05, 20);
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));

      const positions = new Float32Array(N * 3);
      const colors = new Float32Array(N * 3);
      const sizes = new Float32Array(N);
      const state = [];
      for (let i = 0; i < N; i++) {
        const y0 = Math.random();
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * COL_R;
        state.push({ y: y0, angle: ang, rad: rad, speed: 0.05 + Math.random() * 0.09, phase: Math.random() * 10 });
      }
      function writeAttrs() {
        state.forEach(function (p, i) {
          const x = Math.cos(p.angle) * p.rad;
          const z = Math.sin(p.angle) * p.rad;
          const y = HEIGHT / 2 - p.y * HEIGHT;
          positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
          const c = colorAt(p.y);
          colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
          sizes[i] = 0.03 + p.y * 0.05;
        });
      }
      writeAttrs();

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
      const glowTex = KU.makeGlowTexture(THREE, 64);
      const mat = new THREE.PointsMaterial({
        size: 0.055,
        map: glowTex,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);

      three3d = { renderer: renderer, scene: scene, camera: camera, geo: geo, mat: mat, glowTex: glowTex };

      function placeCamera() {
        // Sütunun biraz üstünde/dışında, aşağı bakan bir kamera -- "inişi"
        // yandan/yukarıdan izliyoruz, tam tepeden değil (düz tepeden bakış
        // parçacıkları bir halka gibi göstererek "iç içe çember" yasağına
        // yaklaşırdı).
        const camAngle = spin;
        camera.position.set(Math.cos(camAngle) * 1.7, HEIGHT * 0.32, Math.sin(camAngle) * 1.7);
        camera.lookAt(0, -HEIGHT * 0.15, 0);
      }
      placeCamera();
      renderer.render(scene, camera);

      const ro = new ResizeObserver(function () {
        const rr = el.getBoundingClientRect();
        renderer.setSize(rr.width, rr.height, false);
        camera.aspect = rr.width / Math.max(1, rr.height);
        camera.updateProjectionMatrix();
      });
      ro.observe(el);
      three3d.ro = ro;

      if (opts.reducedMotion) return;

      function frame() {
        if (destroyed) return;
        spin += 0.0009;
        state.forEach(function (p) {
          p.y += p.speed * 0.0035;
          if (p.y > 1) { p.y = 0; p.angle = Math.random() * Math.PI * 2; p.rad = Math.sqrt(Math.random()) * COL_R; }
        });
        writeAttrs();
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        placeCamera();
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(frame);
      }
      frame();

      const stopVisibility = KU.watchVisibility(
        function () { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
        function () { if (!rafId && !destroyed) frame(); }
      );
      three3d.cleanupExtra = stopVisibility;
    });

    return {
      destroy() {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (three3d) {
          if (three3d.cleanupExtra) three3d.cleanupExtra();
          if (three3d.ro) three3d.ro.disconnect();
          three3d.geo.dispose();
          three3d.mat.dispose();
          three3d.glowTex.dispose();
          three3d.renderer.dispose();
        }
        el.innerHTML = "";
      },
    };
  }

  return { mount };
})();
