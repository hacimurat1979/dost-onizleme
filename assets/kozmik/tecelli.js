/**
 * TECELLÎ -- bir olay, bir cisim değil. Kaynak (Zât) hiçbir noktada
 * çizilmiyor; yalnız bir "kabiliyet" alanı (3B bir toz bulutu) üzerinde bir
 * ışımanın doğuşu ve sönüşü görünür. "lâ tekrâre fi't-tecellî" ilkesi kodun
 * içinde somut: her döngü, o döngüye özel taze bir tohumla (freshSeed)
 * farklı bir konum/büyüklük/süre hesaplıyor.
 *
 * Kullanıcı kararı (2026-08-02, "hepsini 3B'ye taşı"): kabiliyet artık düz
 * bir 2B gradyan değil, gerçek bir 3B toz alanı (THREE.Points) -- tecellî
 * bu alanın İÇİNDE bir noktada doğuyor, yakınındaki tozu (mesafeyle
 * orantılı) aydınlatıyor. Tıklanan/dokunulan nokta bir sonraki tecellînin
 * merkezi oluyor (raycast ile 3B'ye çevrilerek) -- kullanıcı DİKKATİNİ
 * yöneltir, tecellînin eğrisini (büyüklük/süre) değil; bu, önceki 2B
 * sürümdeki aynı ilkenin üç boyuttaki karşılığı.
 *
 * API: mount(el, opts) -> { destroy() }. opts: { reducedMotion, particleScale, seed }.
 */
window.DostKozmikSahne = window.DostKozmikSahne || {};
window.DostKozmikSahne.tecelli = (function () {
  "use strict";

  const FIELD_R = 1.5;

  function mount(el, opts) {
    opts = opts || {};
    const KU = window.DostKozmikUtils;
    let destroyed = false, rafId = null, spin = 0;
    let three3d = null;
    let bloom = null; // { x, y, z, r, opacity }
    let tl = null;

    const N = Math.round(70 * (opts.particleScale != null ? opts.particleScale : 1));

    window.DostKozmikLoader.loadThree().then(function (THREE) {
      if (destroyed) return;
      const canvas = document.createElement("canvas");
      el.appendChild(canvas);
      const r0 = el.getBoundingClientRect();
      const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(r0.width, r0.height, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, r0.width / Math.max(1, r0.height), 0.05, 20);
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));

      // Kabiliyet: sabit, nötr bir toz bulutu -- bu asla değişmez, tecellî
      // bunun ÜZERİNDE olur. Kaynağın kendisi (Zât) hiçbir yerde temsil
      // edilmiyor.
      const basePositions = [];
      const positions = new Float32Array(N * 3);
      const colors = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const p = new THREE.Vector3(
          (Math.random() * 2 - 1) * FIELD_R,
          (Math.random() * 2 - 1) * FIELD_R * 0.7,
          (Math.random() * 2 - 1) * FIELD_R * 0.6
        );
        basePositions.push(p);
        positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
        colors[i * 3] = 0.42; colors[i * 3 + 1] = 0.4; colors[i * 3 + 2] = 0.35;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const glowTex = KU.makeGlowTexture(THREE, 64);
      const dustMat = new THREE.PointsMaterial({
        size: 0.045, map: glowTex, vertexColors: true, transparent: true,
        depthWrite: false, sizeAttenuation: true, opacity: 0.5,
      });
      const dust = new THREE.Points(geo, dustMat);
      scene.add(dust);

      // Aktif tecellînin çekirdeği -- toz bulutundan ayrı, çünkü her kare
      // güçlü şekilde değişiyor (renk/boyut/opaklık).
      const coreMat = new THREE.SpriteMaterial({
        map: glowTex, color: new THREE.Color(0xffdca0), transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
      });
      const core = new THREE.Sprite(coreMat);
      core.scale.set(0.01, 0.01, 1);
      scene.add(core);

      // Tıklama/dokunma için görünmez bir düzlem -- ekran noktasını 3B'ye
      // çeviriyor (raycast), tecellî oraya "davet ediliyor".
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(FIELD_R * 6, FIELD_R * 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      scene.add(plane);
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      three3d = { renderer: renderer, scene: scene, camera: camera, geo: geo, dustMat: dustMat, coreMat: coreMat, glowTex: glowTex, plane: plane };

      function placeCamera() {
        const angle = spin;
        camera.position.set(Math.cos(angle) * 2.6, 0.3, Math.sin(angle) * 2.6);
        camera.lookAt(0, 0, 0);
        plane.lookAt(camera.position);
      }
      placeCamera();

      function renderFrame() {
        // Tozu bloom'a göre aydınlat: yakın olan tozlar mesafeyle orantılı
        // parlar -- ısı haritası değil, doğrudan mesafe.
        const posAttr = geo.attributes.position;
        const colAttr = geo.attributes.color;
        for (let i = 0; i < N; i++) {
          const bp = basePositions[i];
          let cr = 0.42, cg = 0.4, cb = 0.35;
          if (bloom && bloom.opacity > 0.01) {
            const dx = bp.x - bloom.x, dy = bp.y - bloom.y, dz = bp.z - bloom.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const falloff = Math.max(0, 1 - d / bloom.r);
            const glow = falloff * falloff * bloom.opacity;
            cr = 0.42 + glow * 0.58; cg = 0.4 + glow * 0.5; cb = 0.35 + glow * 0.25;
          }
          colAttr.setXYZ(i, cr, cg, cb);
          posAttr.setXYZ(i, bp.x, bp.y, bp.z);
        }
        colAttr.needsUpdate = true;
        if (bloom && bloom.opacity > 0.01) {
          core.visible = true;
          core.position.set(bloom.x, bloom.y, bloom.z);
          const s = bloom.r * 0.5;
          core.scale.set(s, s, 1);
          coreMat.opacity = bloom.opacity * 0.9;
        } else {
          core.visible = false;
        }
        placeCamera();
        renderer.render(scene, camera);
      }
      renderFrame();

      const ro = new ResizeObserver(function () {
        const rr = el.getBoundingClientRect();
        renderer.setSize(rr.width, rr.height, false);
        camera.aspect = rr.width / Math.max(1, rr.height);
        camera.updateProjectionMatrix();
        placeCamera();
      });
      ro.observe(el);
      three3d.ro = ro;

      if (opts.reducedMotion) {
        bloom = { x: 0, y: 0, z: 0, r: FIELD_R * 0.9, opacity: 0.7 };
        renderFrame();
        return;
      }

      function ambientLoop() {
        if (destroyed) return;
        spin += 0.0007;
        renderFrame();
        rafId = requestAnimationFrame(ambientLoop);
      }
      ambientLoop();

      const stopVisibility = KU.watchVisibility(
        function () { if (tl) tl.pause(); if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
        function () { if (tl) tl.resume(); if (!rafId && !destroyed) ambientLoop(); }
      );

      window.DostKozmikLoader.loadGsap().then(function (gsap) {
        if (destroyed) return;
        function cycle(forcedCenter) {
          if (destroyed) return;
          if (tl) tl.kill();
          const seed = KU.freshSeed();
          const rand = KU.mulberry32(seed);
          const center = forcedCenter || new THREE.Vector3(
            (rand() * 2 - 1) * FIELD_R * 0.7,
            (rand() * 2 - 1) * FIELD_R * 0.5,
            (rand() * 2 - 1) * FIELD_R * 0.4
          );
          const maxR = FIELD_R * (0.55 + rand() * 0.45);
          const riseTime = 1.6 + rand() * 1.4;
          const fallTime = 1.4 + rand() * 1.6;
          const restTime = 1.2 + rand() * 1.6;

          bloom = { x: center.x, y: center.y, z: center.z, r: 0.01, opacity: 0 };
          tl = gsap.timeline({
            onComplete: function () { if (!destroyed) gsap.delayedCall(restTime, cycle); },
          });
          tl.to(bloom, { r: maxR, opacity: 1, duration: riseTime, ease: "sine.out" })
            .to(bloom, { opacity: 0, duration: fallTime, ease: "sine.in" }, ">-0.1");
        }
        cycle();

        function onPointerDown(e) {
          const rect = canvas.getBoundingClientRect();
          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hits = raycaster.intersectObject(plane);
          if (hits.length) cycle(hits[0].point);
        }
        canvas.style.cursor = "pointer";
        canvas.addEventListener("pointerdown", onPointerDown);
        three3d.cleanupExtra = function () {
          stopVisibility();
          canvas.removeEventListener("pointerdown", onPointerDown);
        };
      });
    });

    return {
      destroy() {
        destroyed = true;
        if (tl) tl.kill();
        if (rafId) cancelAnimationFrame(rafId);
        if (three3d) {
          if (three3d.cleanupExtra) three3d.cleanupExtra();
          if (three3d.ro) three3d.ro.disconnect();
          three3d.geo.dispose();
          three3d.dustMat.dispose();
          three3d.coreMat.dispose();
          three3d.glowTex.dispose();
          three3d.plane.geometry.dispose();
          three3d.plane.material.dispose();
          three3d.renderer.dispose();
        }
        el.innerHTML = "";
      },
    };
  }

  return { mount };
})();
