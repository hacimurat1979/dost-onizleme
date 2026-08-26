(function () {
  "use strict";

  const root = document.getElementById("welcome-screen");
  if (!root) return;

  // 2026-08-16 (uzman paneli denetimi, G-01/ONBOARDING-01): sessionStorage
  // yerine localStorage -- ritüel cihaz başına bir kez gösterilsin, her
  // yeni sekmede yeniden oynamasın.
  const SEEN_KEY = "dost-welcome-seen";
  let seen = false;
  try { seen = !!localStorage.getItem(SEEN_KEY); } catch (e) {}
  if (seen) {
    root.hidden = true;
    return;
  }

  // Derin bir rotaya doğrudan gelindiğinde (paylaşılan link, arama sonucu)
  // ritüel araya girmesin -- gateTransition'ın zaten benimsediği "gelinmemiş
  // bir yerden çıkış animasyonu yalan olurdu" ilkesi karşılama ekranına da
  // uygulanıyor. Kök rotanın kendisi <base href> yüzünden her dağıtımda
  // (canlı "/", önizleme "/dost-onizleme/") farklı olabildiği için ROUTE_BASE
  // buradan hesaplanıyor (bkz. assets/ontology.js'teki aynı desen). "Seen"
  // OLARAK işaretlenmiyor -- kullanıcı ileride köke gelirse ritüeli yine görsün.
  const ROUTE_BASE = (function () {
    const baseEl = document.querySelector("base");
    if (!baseEl) return "";
    try {
      const u = new URL(baseEl.getAttribute("href"), location.origin);
      return u.pathname.replace(/\/+$/, "");
    } catch (e) { return ""; }
  })();
  if (location.pathname.replace(/\/+$/, "") !== ROUTE_BASE) {
    root.hidden = true;
    return;
  }

  const beam = document.getElementById("welcome-beam");
  const spark = document.getElementById("welcome-spark");
  const text = document.getElementById("welcome-text");
  const tagline = document.getElementById("welcome-tagline");
  const glow = document.getElementById("welcome-glow");
  const skipBtn = document.getElementById("welcome-skip");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let finished = false;

  // 2026-08-26 sağlamlaştırma: bu blok eskiden aşağıdaki animasyon
  // kurulumundan SONRA geliyordu -- getElementById'lerden biri (beam/spark/
  // glow/skipBtn) ileride bir düzenlemeyle eksik/yanlış id'li kalırsa, o
  // satırdaki TypeError IIFE'yi burada keserdi ve leave() hiç
  // tanımlanamadan/kanca hiç takılamadan tam ekran siyah perde kalıcı
  // olarak asılı kalırdı -- hiçbir tıklama/Esc onu kapatamazdı. Dinleyiciler
  // artık her şeyden ÖNCE, kendi null-guard'larıyla bağlanıyor; ayrıca bir
  // üst sınır zamanlayıcısı (aşağıda) normal akış her ne sebeple olursa
  // olsun tamamlanamazsa perdeyi yine de kaldırıyor.
  skipBtn && skipBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    finished = true;
    leave();
  });
  root.addEventListener("click", () => {
    finished = true;
    leave();
  });
  window.addEventListener("keydown", (event) => {
    if (root.hidden) return;
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      finished = true;
      leave();
    }
  });
  setTimeout(() => { if (!finished) leave(); }, 12000);

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  const cx = 150;
  const cy = 150;
  const r = 120;
  const len = 2 * Math.PI * r;

  function placeSpark(progress) {
    const angle = -Math.PI / 2 + progress * Math.PI * 2;
    spark.setAttribute("cx", cx + r * Math.cos(angle));
    spark.setAttribute("cy", cy + r * Math.sin(angle));
  }

  function leave() {
    if (root.classList.contains("welcome-screen--leaving") || root.hidden) return;
    root.classList.add("welcome-screen--leaving");
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (e) {}
    // FAZ 1 (grafik-önce, 2026-08-03): karşılama halkası sönmeye BAŞLARKEN
    // haber veriyoruz ki altındaki ontoloji grafiği doğuş animasyonuna
    // (ontology.js runBirth) tam bu esnada başlasın — halka kaybolurken
    // Zât belirir, iki hareket tek bir devir gibi okunur.
    document.dispatchEvent(new CustomEvent("dost:welcome-left"));
    setTimeout(() => {
      root.hidden = true;
    }, 950);
  }

  function finish() {
    if (finished) return;
    finished = true;
    beam.style.strokeDashoffset = "0";
    beam.classList.add("welcome-screen__beam--complete");
    spark.classList.add("welcome-screen__spark--hidden");
    glow.style.opacity = "0.5";
    setTimeout(() => {
      text.classList.add("welcome-screen__text--visible");
      if (tagline) tagline.classList.add("welcome-screen__tagline--visible");
    }, 260);
    // Tanıtım cümlesi eklenince (2026-08-10) bekleme, cümlenin okunabileceği
    // kadar uzatıldı; tıklama/Esc ile her an geçilebilir.
    const holdMs = reduceMotion ? 1800 : 4200;
    setTimeout(leave, holdMs);
  }

  function runDraw(durationMs) {
    const start = performance.now();
    function frame(now) {
      if (finished) return;
      const raw = Math.min(1, (now - start) / durationMs);
      const eased = easeInOutCubic(raw);
      const offset = len * (1 - eased);
      beam.style.strokeDashoffset = String(offset);
      placeSpark(eased);
      glow.style.opacity = String(0.18 + eased * 0.22);
      if (raw < 1) {
        requestAnimationFrame(frame);
      } else {
        finish();
      }
    }
    requestAnimationFrame(frame);
  }

  // 2026-08-26: animasyon kurulumu/oynatımı try/catch içinde -- beam/spark/
  // glow eksik ya da SVG API'sinde beklenmeyen bir hata çıkarsa (yukarıdaki
  // dinleyiciler zaten bağlı olduğu için tıklama/Esc her durumda çalışır),
  // burada bir hata da perdeyi asılı bırakmasın diye leave() ile geri
  // dönülüyor.
  try {
    beam.style.strokeDasharray = String(len);
    beam.style.strokeDashoffset = String(len);
    if (reduceMotion) {
      placeSpark(1);
      finish();
    } else {
      runDraw(4500);
    }
  } catch (e) {
    leave();
  }
})();
