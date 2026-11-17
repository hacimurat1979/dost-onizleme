(function () {
  "use strict";

  // FAZ 1 (grafik-önce arayüz, 2026-08-03): 14 bölüm sekmesi ☰ çekmecesine
  // taşındı (bkz. index.html'deki yorum). Bu dosya yalnız çekmecenin AÇILIP
  // KAPANMASINI ve ☰ yanındaki "neredeyim" etiketini yönetir — gezinmenin
  // kendisi (hangi düğme hangi görünümü açar, aktif işaretleme) eskisi gibi
  // tamamen ontology.js'te; düğme id'lerine dokunulmadı.
  const toggle = document.getElementById("nav-toggle");
  const drawer = document.getElementById("nav-drawer");
  if (!toggle || !drawer) return;
  const label = document.getElementById("nav-toggle-label");

  // ☰ yanında o an açık bölümün adı yazar — menü gizlendiği için "neredeyim"
  // sorusunun tek kalıcı cevabı bu. Aktif düğmeyi ontology.js işaretliyor
  // (btn-ghost--active); biz yalnız izliyoruz. MutationObserver hem sınıf
  // değişimini (görünüm değişti) hem metin değişimini (dil değişti,
  // applyStatic textContent'i yeniden yazar) yakalar.
  function updateLabel() {
    if (!label) return;
    const active = drawer.querySelector(".btn-ghost--active");
    if (active) {
      const ad = active.querySelector(".nav-item__ad");
      label.textContent = (ad || active).textContent.trim();
    }
  }
  new MutationObserver(updateLabel).observe(drawer, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    characterData: true,
  });
  updateLabel();

  function open() {
    drawer.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    const first = drawer.querySelector(".btn-ghost--active") || drawer.querySelector("button");
    if (first) first.focus();
  }
  function close(focusToggle) {
    if (drawer.hidden) return;
    drawer.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (focusToggle) toggle.focus();
  }

  toggle.addEventListener("click", () => {
    if (drawer.hidden) open();
    else close();
  });
  // Bir bölüme tıklanınca çekmece kapanır — gezinme ontology.js'in aynı
  // click dinleyicisiyle zaten gerçekleşiyor (iki dinleyici, tek tık).
  drawer.addEventListener("click", (e) => {
    // K-015: "Ayarlar" grubundaki düğmeler (tema, şaşırt, dil) çekmeceyi kapatmaz.
    // composedPath: dil düğmeleri tıklamada yeniden çizilir (hedef DOM'dan
    // kopar); closest() kopmuş düğümde ayarlar grubunu bulamaz.
    const path = e.composedPath ? e.composedPath() : [];
    const inAyarlar = path.some((n) => n.id === "nav-ayarlar-items") || !!e.target.closest("#nav-ayarlar-items");
    if (e.target.closest("button") && !inAyarlar) close();
  });
  document.addEventListener("click", (e) => {
    // Kopmuş (yeniden çizilmiş) hedef için de çekmecenin içinde sayılır.
    const path = e.composedPath ? e.composedPath() : [];
    if (!drawer.hidden && !drawer.contains(e.target) && !path.includes(drawer) && !toggle.contains(e.target)) close();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close(true);
  });

  // K-015: ≤640px'te şaşırt/tema/dil düğmeleri üst çubuktan ☰ çekmecesindeki
  // "Ayarlar" grubuna, defter düğmesi alt köşeden üst çubuğa taşınır (üst çubuk
  // tek satır kalsın, sabit düğmeler metnin üstüne binmesin). Aynı DOM
  // düğümleri taşınır: id'ler ve dinleyiciler korunur. Taşıma `load`'da
  // yapılır — search.js `theme-toggle`ı `.app-header__controls`'ın çocuğu
  // varsayarak insertBefore çağırıyor, o çalıştıktan SONRA olmalı.
  const mq = window.matchMedia("(max-width: 640px)");
  function place() {
    const ctrls = document.querySelector(".app-header__controls");
    const box = document.getElementById("nav-ayarlar-items");
    if (!ctrls || !box) return;
    const mobile = mq.matches;
    ["surprise-toggle", "theme-toggle", "lang-switch"].forEach((id) => {
      const el = document.getElementById(id);
      const target = mobile ? box : ctrls;
      if (el && el.parentNode !== target) target.appendChild(el);
    });
    const defter = document.getElementById("defter-toggle"); // kavram-defteri.js body'ye ekliyor
    const dTarget = mobile ? ctrls : document.body;
    if (defter && defter.parentNode !== dTarget) dTarget.appendChild(defter);
  }
  window.addEventListener("load", place);
  mq.addEventListener("change", place);
})();
