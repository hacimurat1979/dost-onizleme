/**
 * MERTEBELER (Hazarât-ı Hamse) -- bir katmandan diğerine SINIR AŞARAK değil
 * ÇÖZÜNÜRLÜK DEĞİŞEREK geçiliyor: yaklaştıkça netleşiyor, uzaklaştıkça
 * bulanıklaşıyor (bulanıklık=bilgisizlik, görsel dil kuralı). Beş katman
 * d3-zoom ile sürekli bir "focus" ekseninde geziniyor -- ayrı sayfalar
 * değil, kesintisiz bir geçiş (FAZ B'nin zoom'lanabilir atlas fikrinin
 * küçük bir önizlemesi).
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

  function mount(el, opts) {
    opts = opts || {};
    el.style.position = "relative";
    const lang = (window.DostI18n && window.DostI18n.getLang && window.DostI18n.getLang()) || "tr";
    const layerEls = HAZARAT.map(function (hz, i) {
      const d = document.createElement("div");
      d.style.position = "absolute";
      d.style.inset = "0";
      d.style.display = "flex";
      d.style.alignItems = "center";
      d.style.justifyContent = "center";
      d.style.willChange = "filter, opacity, transform";
      d.innerHTML =
        '<div style="width:44%;aspect-ratio:1;border-radius:50%;' +
        "background:radial-gradient(circle at 42% 38%, hsla(" + hz.hue + ",55%,72%,0.85), hsla(" + hz.hue + ",50%,45%,0.15) 70%);" +
        'display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;">' +
        '<span style="font-size:0.92rem;color:hsla(' + hz.hue + ',30%,20%,0.85);font-weight:600;">' +
        (hz[lang] || hz.tr) +
        "</span></div>";
      el.appendChild(d);
      return d;
    });

    let focus = 2; // 0..4, hangi katman merkezde
    let target = 2;
    let destroyed = false;
    let rafId = null;

    function render() {
      layerEls.forEach(function (d, i) {
        const dist = Math.abs(i - focus);
        const blur = opts.reducedMotion ? (i === 2 ? 0 : 6) : Math.min(16, dist * dist * 5);
        const opacity = Math.max(0.08, 1 - dist * 0.32);
        const scale = 1 - dist * 0.12;
        d.style.filter = "blur(" + blur.toFixed(1) + "px)";
        d.style.opacity = String(opacity);
        d.style.transform = "scale(" + scale.toFixed(3) + ")";
        d.style.zIndex = String(100 - Math.round(dist * 10));
      });
    }

    if (opts.reducedMotion) {
      focus = 2;
      render();
      return {
        destroy() {
          destroyed = true;
          layerEls.forEach(function (d) { if (d.parentNode) el.removeChild(d); });
        },
      };
    }

    function loop() {
      if (destroyed) return;
      focus += (target - focus) * 0.08;
      render();
      rafId = requestAnimationFrame(loop);
    }
    loop();

    const zoom = d3.zoom()
      .scaleExtent([0.4, 6])
      .filter(function (event) { return !event.button; })
      .on("zoom", function (event) {
        // ölçek arttıkça (yakınlaşınca) alt katmanlara doğru, azalınca üst
        // katmanlara doğru -- Google Earth mantığının küçük bir önizlemesi.
        const k = event.transform.k;
        target = Math.max(0, Math.min(4, 2 + Math.log2(k) * 1.6));
      });
    const sel = d3.select(el).call(zoom);

    let stopVisibility = window.DostKozmikUtils.watchVisibility(
      function () { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
      function () { if (!rafId && !destroyed) loop(); }
    );

    return {
      destroy() {
        destroyed = true;
        if (rafId) cancelAnimationFrame(rafId);
        stopVisibility();
        sel.on(".zoom", null);
        layerEls.forEach(function (d) { if (d.parentNode) el.removeChild(d); });
      },
    };
  }

  return { mount };
})();
