(function () {
  "use strict";

  const SEEN_KEY = "dost-start-hint-seen";
  const hint = document.getElementById("start-hint");
  const goBtn = document.getElementById("start-hint-go");
  const closeBtn = document.getElementById("start-hint-close");
  if (!hint || !goBtn || !closeBtn) return;

  function dismiss() {
    hint.hidden = true;
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (e) {}
  }

  let seen = false;
  try { seen = !!localStorage.getItem(SEEN_KEY); } catch (e) {}
  if (seen) return;

  // K-025: tek tanıtım. Bu kart yalnız karşılama ekranını (kök adres) görmüş/geçmiş okura çıkar;
  // derin bağlantıdan gelen okura çıkmaz. Karşılama hâlâ sürüyorsa onun sönmesini bekler, böylece
  // iki tanıtım üst üste binmez.
  function show() {
    if (!hint.hidden) return;
    const wrap = document.getElementById("ontology-wrap");
    if (!wrap || wrap.hidden) return;
    hint.hidden = false;
  }
  let welcomeSeen = false;
  try { welcomeSeen = !!sessionStorage.getItem("dost-welcome-seen"); } catch (e) {}
  const welcomeEl = document.getElementById("welcome-screen");
  if (welcomeSeen) {
    setTimeout(show, 3200);
  } else if (welcomeEl && !welcomeEl.hidden) {
    document.addEventListener("dost:welcome-left", () => setTimeout(show, 1200), { once: true });
  }

  goBtn.addEventListener("click", () => {
    dismiss();
    if (window.__dostNav) window.__dostNav.goTo("ontoloji", "dhat");
  });
  closeBtn.addEventListener("click", dismiss);
})();
