(function () {
  "use strict";
  const CODE = "daphne";
  const MAX_GAP_MS = 1500;
  let buffer = "";
  let lastKeyAt = 0;

  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;

    const now = Date.now();
    if (now - lastKeyAt > MAX_GAP_MS) buffer = "";
    lastKeyAt = now;

    const key = e.key.toLowerCase();
    const candidate = buffer + key;
    if (CODE.startsWith(candidate)) {
      e.preventDefault();
      buffer = candidate;
      if (buffer === CODE) {
        buffer = "";
        window.location.href = "compare.html";
      }
    } else if (key === CODE[0]) {
      e.preventDefault();
      buffer = key;
    } else {
      buffer = "";
    }
  });
})();
