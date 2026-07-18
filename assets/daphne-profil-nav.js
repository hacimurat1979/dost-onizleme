(function () {
  "use strict";
  const CODE = "understand";
  let buffer = "";

  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-CODE.length);
    if (buffer === CODE) {
      window.location.href = "daphne-profil.html";
    }
  });
})();
