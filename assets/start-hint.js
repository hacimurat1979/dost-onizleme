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

  setTimeout(() => {
    if (!hint.hidden) return;
    const wrap = document.getElementById("ontology-wrap");
    if (!wrap || wrap.hidden) return;
    hint.hidden = false;
  }, 3200);

  goBtn.addEventListener("click", () => {
    dismiss();
    if (window.__dostNav) window.__dostNav.goTo("ontoloji", "dhat");
  });
  closeBtn.addEventListener("click", dismiss);
})();
