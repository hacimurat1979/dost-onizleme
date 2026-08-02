/**
 * NEFES-İ RAHMÂNÎ -- kabz-bast (daralma-genişleme) ritmi. Basılı tutmak
 * kullanıcının kendi nefesiyle senkronlanmayı sağlar: bastığın sürece
 * genişler (bir nefes alma gibi), bıraktığında geri daralır. Harfler bu
 * genişlemeden doğar gibi belirir -- nefes harfin taşıyıcısı.
 *
 * Kullanıcı kararı (2026-08-02, "hepsini 3B'ye taşı"): merkez artık düz bir
 * 2B daire değil, gerçek bir 3B küre (nefesle çapı/parlaklığı değişen);
 * sekiz harf kendi ekseninde hafif eğik bir halka üzerinde, kameraya hep
 * dönük sprite'lar (billboard) olarak duruyor -- 2B'deki "çevrede sabit
 * duran metin" yerini 3B derinlikli bir halkaya bırakıyor.
 *
 * API: mount(el, opts) -> { destroy() }.
 */
window.DostKozmikSahne = window.DostKozmikSahne || {};
window.DostKozmikSahne.nefes = (function () {
  "use strict";
  const LETTERS = ["ا", "ب", "ن", "ك", "ح", "ي", "م", "ر"];
  const RING_R = 1.15, TILT = 0.32;

  function makeLetterTexture(THREE, ch) {
    const size = 96;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const cx = c.getContext("2d");
    cx.font = "600 " + Math.round(size * 0.62) + "px serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillStyle = "rgba(150,165,180,0.95)";
    cx.fillText(ch, size / 2, size / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  function mount(el, opts) {
    opts = opts || {};
    const KU = window.DostKozmikUtils;
    let destroyed = false, rafId = null, spin = 0;
    let three3d = null;
    const state = { breath: opts.reducedMotion ? 0.55 : 0.2 };

    window.DostKozmikLoader.loadThree().then(function (THREE) {
      if (destroyed) return;
      const canvas = document.createElement("canvas");
      el.appendChild(canvas);
      const r0 = el.getBoundingClientRect();
      const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(r0.width, r0.height, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(48, r0.width / Math.max(1, r0.height), 0.05, 20);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const dl = new THREE.DirectionalLight(0xdfeaf5, 0.6);
      dl.position.set(2, 2, 3);
      scene.add(dl);

      const color = new THREE.Color(0x96afbe);
      const sphereGeo = new THREE.SphereGeometry(0.5, 32, 24);
      const sphereMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5, roughness: 0.35, transparent: true, opacity: 0.85 });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      scene.add(sphere);

      const glowTex = KU.makeGlowTexture(THREE);
      const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const glow = new THREE.Sprite(glowMat);
      scene.add(glow);

      const letterTextures = LETTERS.map(function (ch) { return makeLetterTexture(THREE, ch); });
      const letters = LETTERS.map(function (ch, i) {
        const mat = new THREE.SpriteMaterial({ map: letterTextures[i], transparent: true, opacity: 0, depthWrite: false });
        const sp = new THREE.Sprite(mat);
        sp.scale.set(0.32, 0.32, 1);
        const a = (i / LETTERS.length) * Math.PI * 2;
        sp.userData.angle = a;
        scene.add(sp);
        return { sprite: sp, mat: mat };
      });

      three3d = { renderer: renderer, scene: scene, camera: camera, sphereGeo: sphereGeo, sphereMat: sphereMat, glowMat: glowMat, glowTex: glowTex, letterTextures: letterTextures, letters: letters };

      function render() {
        // Küre + glow ölçeği bilerek küçük tutuluyor -- ilk denemede sahne
        // nefesin en yüksek anında kadrajı devasa bir turuncu leke gibi
        // dolduruyordu (elle test edilip yakalandı, bkz. atlas.js/
        // mertebeler.js'teki aynı ders).
        const baseR = 0.16;
        const r = baseR + state.breath * 0.22;
        sphere.scale.setScalar(r / 0.5);
        sphereMat.emissiveIntensity = 0.35 + state.breath * 0.9;
        const gs = r * 1.8;
        glow.scale.set(gs, gs, 1);
        glowMat.opacity = 0.25 + state.breath * 0.4;

        const letterOpacity = Math.max(0, (state.breath - 0.22) / 0.6);
        letters.forEach(function (L) {
          const a = L.sprite.userData.angle + spin;
          L.sprite.position.set(Math.cos(a) * RING_R, Math.sin(a) * RING_R * TILT, Math.sin(a * 0.7) * 0.25);
          L.mat.opacity = Math.min(1, letterOpacity);
        });

        const camAngle = spin * 0.6;
        camera.position.set(Math.cos(camAngle) * 2.6, 0.6, Math.sin(camAngle) * 2.6);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      }
      render();

      const ro = new ResizeObserver(function () {
        const rr = el.getBoundingClientRect();
        renderer.setSize(rr.width, rr.height, false);
        camera.aspect = rr.width / Math.max(1, rr.height);
        camera.updateProjectionMatrix();
      });
      ro.observe(el);
      three3d.ro = ro;

      if (opts.reducedMotion) return;

      let idleTween = null, holdTween = null;
      window.DostKozmikLoader.loadGsap().then(function (gsap) {
        if (destroyed) return;
        function startIdle() {
          idleTween = gsap.to(state, { breath: 0.42, duration: 4.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
        }
        startIdle();

        function loop() {
          if (destroyed) return;
          spin += 0.0011;
          render();
          rafId = requestAnimationFrame(loop);
        }
        loop();

        const stopVisibility = KU.watchVisibility(
          function () { if (idleTween) idleTween.pause(); if (holdTween) holdTween.pause(); if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
          function () { if (idleTween) idleTween.resume(); if (holdTween) holdTween.resume(); if (!rafId && !destroyed) loop(); }
        );

        function onDown(e) {
          e.preventDefault();
          if (idleTween) idleTween.pause();
          if (holdTween) holdTween.kill();
          holdTween = gsap.to(state, { breath: 1, duration: 2.6, ease: "sine.out" });
        }
        function onUp() {
          if (holdTween) holdTween.kill();
          holdTween = gsap.to(state, {
            breath: 0.2, duration: 2.1, ease: "sine.in",
            onComplete: function () { if (!destroyed) startIdle(); },
          });
        }
        canvas.addEventListener("pointerdown", onDown);
        window.addEventListener("pointerup", onUp);
        three3d.cleanupExtra = function () {
          stopVisibility();
          canvas.removeEventListener("pointerdown", onDown);
          window.removeEventListener("pointerup", onUp);
          if (idleTween) idleTween.kill();
          if (holdTween) holdTween.kill();
        };
      });
    });

    return {
      destroy() {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (three3d) {
          if (three3d.cleanupExtra) three3d.cleanupExtra();
          if (three3d.ro) three3d.ro.disconnect();
          three3d.sphereGeo.dispose();
          three3d.sphereMat.dispose();
          three3d.glowMat.dispose();
          three3d.glowTex.dispose();
          three3d.letterTextures.forEach(function (t) { t.dispose(); });
          three3d.letters.forEach(function (L) { L.mat.dispose(); });
          three3d.renderer.dispose();
        }
        el.innerHTML = "";
      },
    };
  }

  return { mount };
})();
