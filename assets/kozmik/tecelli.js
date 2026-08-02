/**
 * TECELLÎ -- bir olay, bir cisim değil. Kaynak (Zât) hiçbir noktada
 * çizilmiyor; yalnız bir "kabiliyet" (soft, sabit bir alan) üzerinde bir
 * ışımanın doğuşu ve sönüşü görünür. "lâ tekrâre fi't-tecellî" ilkesi
 * kodun içinde somut: her döngü, o döngüye özel taze bir tohumla (freshSeed)
 * farklı bir doğuş eğrisi (açı, süre, büyüklük) hesaplıyor. Sahne sonsuz
 * akmıyor -- bir dinlenme anına geliyor, sonra yeniden başlıyor.
 *
 * API: mount(el, opts) -> { destroy() }. opts: { reducedMotion, particleScale, seed }.
 */
window.DostKozmikSahne = window.DostKozmikSahne || {};
window.DostKozmikSahne.tecelli = (function () {
  "use strict";
  const KU = window.DostKozmikUtils;

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

    // Kabiliyet: sabit, nötr bir zemin -- bu asla değişmez, tecellî bunun
    // ÜZERİNDE olur. Kaynağın kendisi (Zât) hiçbir yerde temsil edilmiyor.
    function drawReceptivity() {
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
      g.addColorStop(0, "rgba(120,110,90,0.05)");
      g.addColorStop(1, "rgba(120,110,90,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    const dust = [];
    const dustCount = Math.round(40 * (opts.particleScale != null ? opts.particleScale : 1));
    for (let i = 0; i < dustCount; i++) {
      dust.push({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.1, a: 0.08 + Math.random() * 0.12 });
    }
    function drawDust() {
      dust.forEach((d) => {
        ctx.beginPath();
        ctx.fillStyle = "rgba(150,140,120," + d.a + ")";
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    let destroyed = false;
    let tl = null;
    let rafId = null;
    let bloom = null; // { x, y, r, opacity }

    function renderFrame() {
      drawReceptivity();
      drawDust();
      if (bloom && bloom.opacity > 0.001) {
        const g = ctx.createRadialGradient(bloom.x, bloom.y, 0, bloom.x, bloom.y, bloom.r);
        g.addColorStop(0, "rgba(201,161,74," + (0.5 * bloom.opacity) + ")");
        g.addColorStop(0.5, "rgba(201,161,74," + (0.22 * bloom.opacity) + ")");
        g.addColorStop(1, "rgba(201,161,74,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bloom.x, bloom.y, bloom.r, 0, Math.PI * 2);
        ctx.fill();
      }
      rafId = requestAnimationFrame(renderFrame);
    }

    if (opts.reducedMotion) {
      // Durağan alternatif: TEK, sabit bir tecellî anı -- ne doğuyor ne
      // sönüyor, yalnız var. Döngü/rastgelelik yok.
      bloom = { x: w / 2, y: h / 2, r: Math.min(w, h) * 0.28, opacity: 0.7 };
      renderFrame();
      return {
        destroy() {
          destroyed = true;
          if (rafId) cancelAnimationFrame(rafId);
          ro.disconnect();
          el.removeChild(canvas);
        },
      };
    }

    renderFrame();

    let stopVisibility = function () {};
    window.DostKozmikLoader.loadGsap().then(function (gsap) {
      if (destroyed) return;
      function cycle() {
        if (destroyed) return;
        const seed = KU.freshSeed();
        const rand = KU.mulberry32(seed);
        const angle = rand() * Math.PI * 2;
        const dist = rand() * Math.min(w, h) * 0.22;
        const cx = w / 2 + Math.cos(angle) * dist;
        const cy = h / 2 + Math.sin(angle) * dist;
        const maxR = Math.min(w, h) * (0.18 + rand() * 0.16);
        const riseTime = 1.6 + rand() * 1.4;
        const fallTime = 1.4 + rand() * 1.6;
        const restTime = 1.2 + rand() * 1.6;

        bloom = { x: cx, y: cy, r: 0, opacity: 0 };
        tl = gsap.timeline({
          onComplete: function () {
            if (!destroyed) gsap.delayedCall(restTime, cycle);
          },
        });
        tl.to(bloom, { r: maxR, opacity: 1, duration: riseTime, ease: "sine.out" })
          .to(bloom, { opacity: 0, duration: fallTime, ease: "sine.in" }, ">-0.1");
      }
      cycle();
      stopVisibility = KU.watchVisibility(
        function () { if (tl) tl.pause(); },
        function () { if (tl) tl.resume(); }
      );
    });

    return {
      destroy() {
        destroyed = true;
        if (tl) tl.kill();
        if (rafId) cancelAnimationFrame(rafId);
        stopVisibility();
        ro.disconnect();
        if (canvas.parentNode) el.removeChild(canvas);
      },
    };
  }

  return { mount };
})();
