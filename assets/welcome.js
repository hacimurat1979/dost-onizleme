(function () {
  "use strict";

  const root = document.getElementById("welcome-screen");
  if (!root) return;

  const SEEN_KEY = "dost-welcome-seen";
  let seen = false;
  try { seen = !!sessionStorage.getItem(SEEN_KEY); } catch (e) {}
  if (seen) {
    root.hidden = true;
    return;
  }

  const beam = document.getElementById("welcome-beam");
  const spark = document.getElementById("welcome-spark");
  const text = document.getElementById("welcome-text");
  const glow = document.getElementById("welcome-glow");
  const skipBtn = document.getElementById("welcome-skip");

  // B4 "Bugünün parçası": Sırlar'ın zaten kürasyonlu 86 kaydından, güne göre
  // sabit (herkes için aynı gün aynı kayıt) tek bir başlık seçip karşılama
  // ekranına ekliyor. Yeni bir içerik üretmiyor -- var olan, zaten üç dilli
  // ve kaynaklı bir kaydı gösteriyor. window.__dostRouteBase/DostI18n bu
  // script'in kendi script etiketinden SONRA yüklendiği için DOMContentLoaded'a
  // erteleniyor (o ana kadar ikisi de hazır olur).
  document.addEventListener("DOMContentLoaded", function () {
    const gununEl = document.getElementById("welcome-gunun");
    if (!gununEl) return;
    const base = window.__dostRouteBase || "";
    fetch(base + "/data/ibn-arabi/sirlar.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !Array.isArray(d.entries) || !d.entries.length) return;
        const dayIndex = Math.floor(Date.now() / 86400000);
        const entry = d.entries[dayIndex % d.entries.length];
        const I18n = window.DostI18n;
        const topic = entry.topic || {};
        const text3 = (I18n ? I18n.pick3(topic) : null) || topic.tr || topic.en || "";
        if (!text3) return;
        gununEl.textContent = text3;
        gununEl.hidden = false;
      })
      .catch(() => {});
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cx = 150;
  const cy = 150;
  const r = 120;
  const len = 2 * Math.PI * r;
  beam.style.strokeDasharray = String(len);
  beam.style.strokeDashoffset = String(len);

  let finished = false;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function placeSpark(progress) {
    const angle = -Math.PI / 2 + progress * Math.PI * 2;
    spark.setAttribute("cx", cx + r * Math.cos(angle));
    spark.setAttribute("cy", cy + r * Math.sin(angle));
  }

  function leave() {
    if (root.classList.contains("welcome-screen--leaving") || root.hidden) return;
    root.classList.add("welcome-screen--leaving");
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch (e) {}
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
    }, 260);
    const holdMs = reduceMotion ? 1300 : 2900;
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

  skipBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    finished = true;
    leave();
  });
  root.addEventListener("click", () => {
    if (!finished) {
      finished = true;
      finish();
    } else {
      leave();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (root.hidden) return;
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      if (!finished) {
        finished = true;
        finish();
      } else {
        leave();
      }
    }
  });

  if (reduceMotion) {
    placeSpark(1);
    finish();
  } else {
    runDraw(4500);
  }
})();
