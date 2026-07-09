(function () {
  "use strict";
  const CODE = "dost";
  let buffer = "";

  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-CODE.length);
    if (buffer === CODE) {
      window.location.href = "compare.html";
    }
  });
})();
