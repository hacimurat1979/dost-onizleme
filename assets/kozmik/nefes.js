/**
 * NEFES-İ RAHMÂNÎ -- kabz-bast (daralma-genişleme) ritmi. Basılı tutmak
 * kullanıcının kendi nefesiyle senkronlanmayı sağlar: bastığın sürece
 * genişler (bir nefes alma gibi), bıraktığında geri daralır. Harfler bu
 * genişlemeden doğar gibi belirir -- nefes harfin taşıyıcısı.
 *
 * API: mount(el, opts) -> { destroy() }.
 */
window.DostKozmikSahne = window.DostKozmikSahne || {};
window.DostKozmikSahne.nefes = (function () {
  "use strict";
  const LETTERS = ["ا", "ب", "ن", "ك", "ح", "ي", "م", "ر"];

  function mount(el, opts) {
    opts = opts || {};
    const canvas = document.createElement("canvas");
    el.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const r = el.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const state = { breath: opts.reducedMotion ? 0.55 : 0.2 };
    let destroyed = false;
    let rafId = null;

    function render() {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const baseR = Math.min(w, h) * 0.14;
      const r = baseR + state.breath * Math.min(w, h) * 0.22;

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.6);
      g.addColorStop(0, "rgba(150,175,190," + (0.22 + state.breath * 0.28) + ")");
      g.addColorStop(1, "rgba(150,175,190,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(120,140,155," + (0.35 + state.breath * 0.4) + ")";
      ctx.lineWidth = 1.4;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Harfler: nefes arttıkça belirir, radyal olarak çevrede dururlar.
      const letterOpacity = Math.max(0, (state.breath - 0.25) / 0.75);
      if (letterOpacity > 0.01) {
        ctx.font = Math.round(Math.min(w, h) * 0.06) + "px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(90,100,110," + (letterOpacity * 0.8) + ")";
        LETTERS.forEach((ch, i) => {
          const a = (i / LETTERS.length) * Math.PI * 2 - Math.PI / 2;
          const rr = r + Math.min(w, h) * 0.14;
          ctx.fillText(ch, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        });
      }
      rafId = requestAnimationFrame(render);
    }
    render();

    if (opts.reducedMotion) {
      return {
        destroy() {
          destroyed = true;
          if (rafId) cancelAnimationFrame(rafId);
          ro.disconnect();
          el.removeChild(canvas);
        },
      };
    }

    let idleTween = null;
    let holdTween = null;
    let stopVisibility = function () {};

    window.DostKozmikLoader.loadGsap().then(function (gsap) {
      if (destroyed) return;
      function startIdle() {
        idleTween = gsap.to(state, {
          breath: 0.42,
          duration: 4.2,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      }
      startIdle();
      stopVisibility = window.DostKozmikUtils.watchVisibility(
        function () { if (idleTween) idleTween.pause(); if (holdTween) holdTween.pause(); },
        function () { if (idleTween) idleTween.resume(); if (holdTween) holdTween.resume(); }
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
          breath: 0.2,
          duration: 2.1,
          ease: "sine.in",
          onComplete: function () {
            if (!destroyed) startIdle();
          },
        });
      }
      canvas.addEventListener("pointerdown", onDown);
      window.addEventListener("pointerup", onUp);
      canvas._dostCleanup = function () {
        canvas.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);
      };
    });

    return {
      destroy() {
        destroyed = true;
        if (idleTween) idleTween.kill();
        if (holdTween) holdTween.kill();
        if (rafId) cancelAnimationFrame(rafId);
        stopVisibility();
        if (canvas._dostCleanup) canvas._dostCleanup();
        ro.disconnect();
        if (canvas.parentNode) el.removeChild(canvas);
      },
    };
  }

  return { mount };
})();
