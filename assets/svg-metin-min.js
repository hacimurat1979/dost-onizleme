(function () {
  "use strict";

  // K-004: bir SVG'nin `viewBox`ı ekrana küçülerek sığdığında (390 px'te ölçek
  // 0,5-0,9) içindeki yazı da küçülür: CSS'te 9,5 px yazan etiket ekranda 5-8 px
  // görünüyordu. Bu işlev, her svg[viewBox] için ekranda minPx'ten küçük görünen
  // metnin font-size'ını minPx / ölçek'e çıkarır (kullanıcı birimi). Şekillerin
  // kendisine (koordinat, yerleşim, viewBox) dokunmaz, yalnız yazı boyutunu
  // yükseltir; zaten yeterince büyük metne dokunmaz.
  //
  // Ölçek = svg'nin ekran dönüşümünün ölçeği (getScreenCTM). Gizli svg'yi atlar
  // (ölçek 0) -- görünür olunca yeniden çağrılmalı (resize / activate).
  // `graph-utils.js`'e değil buraya yazıldı: o dosya Ontoloji/Hâller grafiklerinin
  // ortak yardımcılarını taşıyor ve bu işte kasıtlı olarak değişmiyor.
  function ensureMinSvgText(root, minPx) {
    if (!root) return;
    root.querySelectorAll("svg[viewBox]").forEach((svg) => {
      const m = svg.getScreenCTM && svg.getScreenCTM();
      const olcek = m ? Math.hypot(m.a, m.b) : 0;
      if (!olcek) return;
      // Füsûs sarmalı her karede kendi yazı stilini yazıyor; ona dokunulmaz.
      if (svg.classList.contains("helix-scene__svg")) return;
      svg.querySelectorAll("text").forEach((t) => {
        if (!t.textContent.trim()) return;
        if (t.dataset.minPx) t.style.fontSize = "";
        const fs = parseFloat(getComputedStyle(t).fontSize);
        if (fs * olcek < minPx) {
          t.style.fontSize = (minPx / olcek).toFixed(2) + "px";
          t.dataset.minPx = "1";
        } else if (t.dataset.minPx) {
          delete t.dataset.minPx;
        }
      });
    });
  }

  // Bir kabın yeniden boyutlanmasında (pencere / yönlendirme) rAF'a ertelenmiş
  // yeniden hesap; döndürülen işlev dinleyiciyi kaldırır.
  function watch(root, minPx, isActive) {
    let raf = 0;
    const run = () => {
      raf = 0;
      if (!isActive || isActive()) ensureMinSvgText(root, minPx);
    };
    const onResize = () => { if (!raf) raf = requestAnimationFrame(run); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }

  window.DostSvgMin = { ensureMinSvgText, watch };
})();
