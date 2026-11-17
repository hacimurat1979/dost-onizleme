(function () {
  "use strict";

  // K-025 (2026-08-04): karşılama
  //  - yalnız KÖK adreste (derin bağlantıda, `?p=` ile gelinenler dahil, hiç) ve oturumda bir kez;
  //  - toplam ≤ 3 sn (çizim ~1,4 sn + bekleme + sönüş), "Geç" her an görünür, ekrana tek dokunuş da geçer;
  //  - zemin/yazı sitenin o anki temasını izler (aydınlık/karanlık), altın parıltı/hale yok;
  //  - halka ve "O'ndan O'na" cümlesi aynen; gerçek bir okuma kaydı varsa tek satır "kaldığın yerden devam et".
  const root = document.getElementById("welcome-screen");
  if (!root) return;

  // Derin bağlantı: assets/ontology.js'teki ROUTE_BASE hesabının aynısı (o dosya bundan sonra yüklenir).
  let routeBase = "";
  try {
    const baseEl = document.querySelector("base");
    if (baseEl) routeBase = new URL(baseEl.getAttribute("href"), location.origin).pathname.replace(/\/+$/, "");
  } catch (e) {}
  const path = location.pathname.slice(routeBase.length) || "/";
  const isRoot = path === "/" || path === "/index.html";
  if (!isRoot) { root.hidden = true; return; }

  const SEEN_KEY = "dost-welcome-seen";
  let seen = false;
  try { seen = !!sessionStorage.getItem(SEEN_KEY); } catch (e) {}
  if (seen) { root.hidden = true; return; }

  root.hidden = false;

  const beam = document.getElementById("welcome-beam");
  const spark = document.getElementById("welcome-spark");
  const skipBtn = document.getElementById("welcome-skip");
  const devamEl = document.getElementById("welcome-devam");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DRAW_MS = 1400;     // halka çizimi
  const LEAVE_AT_MS = 2300; // otomatik çıkış (sönüş 600 ms sürer: toplam ≤ 2,9 sn)

  let leaveTimer = null;

  // B4 "Bugünün parçası" + B3 "Neredeyiz" + son-yer: window.__dostRouteBase/DostI18n bu script'in kendi
  // etiketinden SONRA yüklendiği için DOMContentLoaded'a erteleniyor.
  document.addEventListener("DOMContentLoaded", function () {
    const I18n = window.DostI18n;
    const base = window.__dostRouteBase || "";
    const t = (dict) => (I18n ? I18n.pick3(dict) : dict.tr);

    // Gerçek bir okuma kaydı varsa (assets/son-yer.js; yalnız bilerek açılan kısım/fass yazılır).
    if (devamEl && window.DostSonYer) {
      const son = window.DostSonYer.oku();
      if (son) {
        const yol = (son.tur === "fusus" ? "/fusus/" : "/futuhat/") + son.id + "/";
        devamEl.href = base + yol;
        devamEl.textContent = t({ tr: "Kaldığın yerden devam et: ", en: "Continue where you left off: ", pt: "Continue de onde parou: " }) + t(son.etiket);
        devamEl.hidden = false;
        devamEl.addEventListener("click", (event) => {
          event.stopPropagation();
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
          event.preventDefault();
          leave();
          if (window.__dostNav && window.__dostNav.goTo) window.__dostNav.goTo(son.tur, son.id);
          else location.href = devamEl.href;
        });
        // Bağlantıya yaklaşan/odaklanan okuru otomatik çıkış yarıda kesmesin.
        const hold = () => { if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; } };
        devamEl.addEventListener("pointerenter", hold);
        devamEl.addEventListener("focus", hold);
      }
    }

    const gununEl = document.getElementById("welcome-gunun");
    if (gununEl) {
      fetch(base + "/data/ibn-arabi/sirlar.json")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d || !Array.isArray(d.entries) || !d.entries.length) return;
          const dayIndex = Math.floor(Date.now() / 86400000);
          const entry = d.entries[dayIndex % d.entries.length];
          const topic = entry.topic || {};
          const text3 = (I18n ? I18n.pick3(topic) : null) || topic.tr || topic.en || "";
          if (!text3) return;
          gununEl.textContent = text3;
          gununEl.hidden = false;
        })
        .catch(() => {});
    }

    // B3 "Neredeyiz": okuma durumunun SAYISAL özeti (yorum değil, sayım); küçük bir özet dosyası.
    const neredeyizEl = document.getElementById("welcome-neredeyiz");
    if (!neredeyizEl) return;
    fetch(base + "/data/ibn-arabi/okuma-durumu.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !d.futuhat || !d.fusus) return;
        const ring = (label, done, total) => {
          const r = 8, c = 2 * Math.PI * r, fill = (done / total) * c;
          return `<span class="welcome-neredeyiz__item" title="${label}: ${done}/${total}">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
              <circle class="welcome-neredeyiz__track" cx="10" cy="10" r="${r}" fill="none" stroke-width="2.2"></circle>
              <circle class="welcome-neredeyiz__fill" cx="10" cy="10" r="${r}" fill="none" stroke-width="2.2"
                stroke-dasharray="${fill} ${c}" transform="rotate(-90 10 10)"></circle>
            </svg>
            <span class="welcome-neredeyiz__label">${label} ${done}/${total}</span>
          </span>`;
        };
        neredeyizEl.innerHTML =
          ring(t({ tr: "Fütûhât", en: "Futuhat", pt: "Futuhat" }), d.futuhat.done, d.futuhat.total) +
          ring(t({ tr: "Füsûs", en: "Fusus", pt: "Fusus" }), d.fusus.done, d.fusus.total);
        neredeyizEl.hidden = false;
      })
      .catch(() => {});
  });

  const cx = 150;
  const cy = 150;
  const r = 120;
  const len = 2 * Math.PI * r;
  beam.style.strokeDasharray = String(len);
  beam.style.strokeDashoffset = String(len);

  let finished = false;

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function placeSpark(progress) {
    const angle = -Math.PI / 2 + progress * Math.PI * 2;
    spark.setAttribute("cx", cx + r * Math.cos(angle));
    spark.setAttribute("cy", cy + r * Math.sin(angle));
  }

  function leave() {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    if (root.classList.contains("welcome-screen--leaving") || root.hidden) return;
    finished = true;
    root.classList.add("welcome-screen--leaving");
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch (e) {}
    // Karşılama sönmeye BAŞLARKEN haber veriyoruz: altındaki ontoloji grafiği doğuş animasyonuna
    // (ontology.js runBirth) bu esnada başlasın. Yalnız burada yayılır.
    document.dispatchEvent(new CustomEvent("dost:welcome-left"));
    setTimeout(() => { root.hidden = true; }, reduceMotion ? 350 : 650);
  }

  function finish() {
    if (finished) return;
    finished = true;
    beam.style.strokeDashoffset = "0";
    spark.classList.add("welcome-screen__spark--hidden");
    root.classList.add("welcome-screen--ready");
  }

  function runDraw(durationMs) {
    const start = performance.now();
    function frame(now) {
      if (finished) return;
      const raw = Math.min(1, (now - start) / durationMs);
      const eased = easeInOutCubic(raw);
      beam.style.strokeDashoffset = String(len * (1 - eased));
      placeSpark(eased);
      if (raw >= 0.9) root.classList.add("welcome-screen--ready");
      if (raw < 1) requestAnimationFrame(frame);
      else finish();
    }
    requestAnimationFrame(frame);
  }

  skipBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    leave();
  });
  // Ekrana tek dokunuş da geçer.
  root.addEventListener("click", () => leave());
  window.addEventListener("keydown", (event) => {
    if (root.hidden) return;
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      if (event.target === devamEl) return;
      leave();
    }
  });

  leaveTimer = setTimeout(leave, LEAVE_AT_MS);

  if (reduceMotion) {
    placeSpark(1);
    finish();
  } else {
    runDraw(DRAW_MS);
  }
})();
