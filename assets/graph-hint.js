(function () {
  "use strict";

  // .graph-hint butonları (Ontoloji/Esmâ/Hâller/Terimler/Sırlar grafiklerinin
  // sol üstündeki "i" ikonu) şimdiye kadar sadece native `title` tooltip'ine
  // güveniyordu -- hover ile görünüyordu ama tıklamak hiçbir şey yapmıyordu,
  // ve dokunmatik cihazlarda (hover diye bir şey olmadığı için) tamamen
  // erişilemezdi. Bu, tıklandığında aynı metni görünür bir baloncukta
  // gösteren, tekrar tıklayınca/Escape'le/başka yere tıklayınca kapanan
  // paylaşılan bir davranış ekliyor.

  const I18n = window.DostI18n;

  function pickFromTitle(title) {
    if (!title) return "";
    const parts = title.split(" / ");
    if (parts.length < 3) return title;
    const lang = I18n && I18n.getLang ? I18n.getLang() : "tr";
    const idx = lang === "en" ? 1 : lang === "pt" ? 2 : 0;
    return parts[idx] || parts[0];
  }

  let openPopover = null;
  let openForBtn = null;

  function close() {
    if (openPopover) {
      openPopover.remove();
      openPopover = null;
      openForBtn = null;
    }
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".graph-hint");
    if (!btn) {
      close();
      return;
    }
    e.stopPropagation();
    const wasOpen = openForBtn === btn;
    close();
    if (wasOpen) return;

    const rect = btn.getBoundingClientRect();
    const pop = document.createElement("div");
    pop.className = "graph-hint-popover";
    pop.setAttribute("role", "tooltip");
    pop.textContent = pickFromTitle(btn.getAttribute("title"));
    pop.style.top = rect.bottom + 8 + "px";
    pop.style.left = rect.left + "px";
    document.body.appendChild(pop);
    openPopover = pop;
    openForBtn = btn;
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
})();
