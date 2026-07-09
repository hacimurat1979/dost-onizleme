(function () {
  "use strict";

  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  function currentTheme() {
    return document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }

  applyTheme(currentTheme());

  btn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("dost-theme", next);
    } catch (e) {}
    applyTheme(next);
  });
})();
