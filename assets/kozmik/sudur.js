/**
 * SUDÛR / TENEZZÜLÂT -- mertebelerden iniş, basamak basamak değil sürekli
 * bir akış olarak. Keskin iç içe çemberler YASAK (görsel dil kuralı); bu
 * yüzden katmanlar ayrı halkalar değil, derinlik ekseninde yoğunlaşan bir
 * gürültü/akış alanı ve o alanda süzülen parçacıklar olarak kodlandı.
 * Katman GEÇİŞİ yok, katman İMASI var -- renk ve doku birbirine karışıyor.
 *
 * Kullanıcı notu (2026-08-02): şerit/parçacık opaklıkları çok düşüktü --
 * akış gözle zor seçiliyordu ("çok sade"). Değerler yükseltildi; davranış
 * (katman geçişsiz akış) aynı kaldı, yalnız okunurluk arttı.
 *
 * API: mount(el, opts) -> { destroy() }.
 */
window.DostKozmikSahne = window.DostKozmikSahne || {};
window.DostKozmikSahne.sudur = (function () {
  "use strict";

  // Ucuz, bağımlılıksız "gürültü": birkaç sinüsün üst üste binmesi.
  // Gerçek Perlin/simplex değil ama organik, sürekli bir doku için yeterli.
  function noise2(x, y, t) {
    return (
      Math.sin(x * 1.3 + t * 0.6) * 0.4 +
      Math.sin(y * 2.1 - t * 0.4 + x * 0.7) * 0.35 +
      Math.sin((x + y) * 0.9 + t * 0.25) * 0.25
    );
  }

  function mount(el, opts) {
    opts = opts || {};
    const canvas = document.createElement("canvas");
    el.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5);

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

    const N = Math.round(160 * (opts.particleScale != null ? opts.particleScale : 1));
    const particles = [];
    for (let i = 0; i < N; i++) {
      particles.push({ x: Math.random(), y: Math.random(), speed: 0.05 + Math.random() * 0.09, phase: Math.random() * 10 });
    }

    // Üstten (Hak'a yakın, "hafif") alta (âleme yakın, "yoğun") renk yolu.
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
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }

    let destroyed = false;
    let rafId = null;
    let t = 0;
    const speedMul = opts.reducedMotion ? 0 : 1;

    function frame() {
      t += 0.01 * speedMul;
      ctx.clearRect(0, 0, w, h);

      // Arka plan dokusu: gürültüyle örneklenmiş yatay şeritler, derinlikle
      // renk değiştiriyor -- ayrık halkalar/sınırlar yok.
      const rows = 48;
      for (let i = 0; i < rows; i++) {
        const depth = i / (rows - 1);
        const y = depth * h;
        const n = noise2(depth * 3, 0, t) * 0.06;
        const [r, g, b] = colorAt(depth + n);
        ctx.fillStyle = "rgba(" + r.toFixed(0) + "," + g.toFixed(0) + "," + b.toFixed(0) + "," + (0.1 + depth * 0.09) + ")";
        ctx.fillRect(0, y, w, h / rows + 1);
      }

      particles.forEach((p) => {
        p.y += p.speed * 0.0035 * speedMul;
        if (p.y > 1) { p.y = 0; p.x = Math.random(); }
        const drift = noise2(p.x * 4, p.y * 4, t + p.phase) * 0.01;
        const x = (p.x + drift) * w;
        const y = p.y * h;
        const [r, g, b] = colorAt(p.y);
        const size = 1 + p.y * 2.6;
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + r.toFixed(0) + "," + g.toFixed(0) + "," + b.toFixed(0) + "," + (0.55 + p.y * 0.4) + ")";
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      rafId = requestAnimationFrame(frame);
    }
    frame();

    let stopVisibility = window.DostKozmikUtils.watchVisibility(
      function () { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
      function () { if (!rafId && !destroyed) frame(); }
    );

    return {
      destroy() {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        stopVisibility();
        ro.disconnect();
        if (canvas.parentNode) el.removeChild(canvas);
      },
    };
  }

  return { mount };
})();
