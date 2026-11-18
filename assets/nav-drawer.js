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
    if (active) label.textContent = active.textContent.trim();
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
    if (e.target.closest("button")) close();
  });
  document.addEventListener("click", (e) => {
    if (!drawer.hidden && !drawer.contains(e.target) && !toggle.contains(e.target)) close();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close(true);
  });
})();
