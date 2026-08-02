/**
 * VARLIĞIN DÖNÜŞÜ -- kavs-i nüzûl (iniş) ve kavs-i urûc (çıkış) birlikte,
 * TEK bir üç boyutlu sarmal olarak dönüyor. Kapalı bir daire DEĞİL: sarmal
 * aynı açısal konuma her tur döndüğünde farklı bir yükseklikte -- küçük
 * işaret noktaları bunu gösteriyor. Gerçek 3B (three.js) burada gerekliydi
 * çünkü "aynı düzlemde olmayan bir dönüş" sahte-3B projeksiyonla (bu
 * projenin başka yerlerindeki helix.js gibi) ikna edici anlatılamazdı.
 *
 * API: mount(el, opts) -> { destroy() }.
 */
window.DostKozmikSahne = window.DostKozmikSahne || {};
window.DostKozmikSahne.donus = (function () {
  "use strict";

  function helixPoints(turns, height, radius, segsPerTurn) {
    const pts = [];
    const total = Math.round(turns * segsPerTurn);
    for (let i = 0; i <= total; i++) {
      const t = i / total;
      const angle = t * turns * Math.PI * 2;
      const y = height / 2 - t * height;
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    }
    return pts;
  }

  function mount(el, opts) {
    opts = opts || {};
    const canvas = document.createElement("canvas");
    el.appendChild(canvas);
    let destroyed = false;
    let rafId = null;
    let handleObj = { destroy: cleanup };

    function cleanup() {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      if (canvas.parentNode) el.removeChild(canvas);
    }

    let renderer, scene, camera, group, ro;
    function onResize() {
      if (!renderer) return;
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / Math.max(1, r.height);
      camera.updateProjectionMatrix();
    }

    window.DostKozmikLoader.loadThree().then(function () {
      if (destroyed) return;
      const r = el.getBoundingClientRect();
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(r.width, r.height, false);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, r.width / Math.max(1, r.height), 0.1, 100);
      camera.position.set(0, 1.4, 9);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const dl = new THREE.DirectionalLight(0xfff3d8, 1.0);
      dl.position.set(3, 5, 4);
      scene.add(dl);
      const dl2 = new THREE.DirectionalLight(0x8fb3ff, 0.4);
      dl2.position.set(-4, -2, -3);
      scene.add(dl2);

      group = new THREE.Group();
      scene.add(group);

      const turns = 3.5;
      const height = 5.2;
      const radius = 1.9;
      const segs = Math.round(24 * (opts.particleScale != null ? Math.max(0.5, opts.particleScale) : 1));
      const pts = helixPoints(turns, height, radius, segs);
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubularSegs = Math.round(pts.length);
      const geo = new THREE.TubeGeometry(curve, tubularSegs, 0.055, 8, false);

      // Renk: iniş (üst, sıcak altın) -- çıkış (alt, serin mavi) tek bir
      // sarmalın iki yarısı olarak vertex-renk ile karışıyor, ayrı ayrı
      // çizilmiş iki obje değil.
      const colorTop = new THREE.Color(0xd8b25a);
      const colorBottom = new THREE.Color(0x6f8fbf);
      const posAttr = geo.attributes.position;
      const colors = new Float32Array(posAttr.count * 3);
      for (let i = 0; i < posAttr.count; i++) {
        const y = posAttr.getY(i);
        const t = 1 - (y + height / 2) / height;
        const c = colorTop.clone().lerp(colorBottom, t);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 });
      group.add(new THREE.Mesh(geo, mat));

      // Aynı açısal konuma her tam turda geri dönüşü işaretleyen küçük
      // noktalar -- farklı yüksekliklerde, "kapalı daire değil" bunu gösterir.
      const markerGeo = new THREE.SphereGeometry(0.07, 12, 12);
      const markerMat = new THREE.MeshStandardMaterial({ color: 0xf3ead2, emissive: 0x554320, roughness: 0.3 });
      for (let turn = 0; turn <= Math.floor(turns); turn++) {
        const t = turn / turns;
        const y = height / 2 - t * height;
        const m = new THREE.Mesh(markerGeo, markerMat);
        m.position.set(radius, y, 0);
        group.add(m);
      }

      function disposeThree() {
        geo.dispose();
        mat.dispose();
        markerGeo.dispose();
        markerMat.dispose();
        renderer.dispose();
      }

      if (opts.reducedMotion) {
        group.rotation.y = 0.6;
        renderer.render(scene, camera);
        window.addEventListener("resize", onResize);
        ro = new ResizeObserver(onResize);
        ro.observe(el);
        handleObj.destroy = function () {
          cleanup();
          if (ro) ro.disconnect();
          disposeThree();
        };
        return;
      }

      let angle = 0;
      function frame() {
        if (destroyed) return;
        angle += 0.0022;
        group.rotation.y = angle;
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(frame);
      }
      frame();
      window.addEventListener("resize", onResize);
      ro = new ResizeObserver(onResize);
      ro.observe(el);

      const stopVisibility = window.DostKozmikUtils.watchVisibility(
        function () { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
        function () { if (!rafId && !destroyed) frame(); }
      );
      handleObj.destroy = function () {
        cleanup();
        stopVisibility();
        if (ro) ro.disconnect();
        disposeThree();
      };
    });

    return handleObj;
  }

  return { mount };
})();
