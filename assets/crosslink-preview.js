// Fütûhât Atlası'ndaki makale metninde, bir cross-link'in üzerine gelince
// önizleme çıkan davranış (Wikipedia tarzı) sadece o görünüme özeldi. Bütün
// görünümler aynı paylaşılan #detail-content paneline yazdığı için, bu
// önizlemeyi burada TEK bir yerden bağlamak Ontoloji/Esmâ/Hâller/Sırlar/
// Terimler/Sorular'ın hepsine birden kazandırıyor.
(function () {
  "use strict";

  const container = document.getElementById("detail-content");
  if (!container) return;

  let tip = null;

  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "node-hover-tip node-hover-tip--fixed";
    tip.hidden = true;
    document.body.appendChild(tip);
    return tip;
  }

  function moveTip(event, anchorEl) {
    if (!tip || tip.hidden) return;
    let x, y;
    if (event && typeof event.clientX === "number") {
      x = event.clientX;
      y = event.clientY - 14;
    } else {
      const rect = anchorEl.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top;
    }
    x = Math.max(90, Math.min(window.innerWidth - 90, x));
    y = Math.max(40, y);
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  function hideTip() {
    if (tip) tip.hidden = true;
  }

  function showPreview(anchorEl, event) {
    if (!window.__dostCrossLink || !window.__dostCrossLink.getSummary) return;
    const view = anchorEl.dataset.view;
    const id = anchorEl.dataset.id;
    const summary = window.__dostCrossLink.getSummary(view, id);
    if (!summary) return;
    const el = ensureTip();
    el.innerHTML = `<div class="node-hover-tip__title">${anchorEl.textContent}</div><p>${summary}</p>`;
    el.hidden = false;
    moveTip(event, anchorEl);
  }

  container.addEventListener("mouseover", (event) => {
    const a = event.target.closest("a.cross-link");
    if (a) showPreview(a, event);
  });
  container.addEventListener("mousemove", (event) => {
    const a = event.target.closest("a.cross-link");
    if (a) moveTip(event, a);
  });
  container.addEventListener("mouseout", (event) => {
    if (event.target.closest("a.cross-link")) hideTip();
  });
  container.addEventListener("focusin", (event) => {
    const a = event.target.closest("a.cross-link");
    if (a) showPreview(a, event);
  });
  container.addEventListener("focusout", (event) => {
    if (event.target.closest("a.cross-link")) hideTip();
  });
  container.addEventListener("mousedown", (event) => {
    if (event.target.closest("a.cross-link")) hideTip();
  });
})();
