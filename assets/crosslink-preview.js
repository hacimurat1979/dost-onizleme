// Fütûhât Atlası'ndaki makale metninde, bir cross-link'in üzerine gelince
// önizleme çıkan davranış (Wikipedia tarzı) sadece o görünüme özeldi. Bunu
// tek bir yerden, tüm belgeye (document) bağlıyoruz -- böylece paylaşılan
// #detail-content paneline yazan Ontoloji/Esmâ/Hâller/Sırlar/Terimler/
// Sorular'ın yanında, kendi ana sayfasına doğrudan basan Çizimler gibi
// görünümler de otomatik olarak aynı davranışı kazanıyor. Fütûhât Atlası
// kendi çizim düğümleriyle paylaştığı ayrı bir tooltip mekanizmasını zaten
// kullanıyor (bkz. futuhat.js), o yüzden #futuhat-article içindeki
// bağlantıları burada atlıyoruz ki aynı anda iki önizleme kutusu çıkmasın.
(function () {
  "use strict";

  const container = document;

  function hasOwnPreview(el) {
    return !!el.closest("#futuhat-article");
  }

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

  // Sözlük ipucu (.glossary-hint) cross-link'ten farklı: bağlı olduğu bir
  // sayfa/düğüm yok, tanım metni doğrudan span'ın kendi data-glossary-def
  // özniteliğinde geliyor (bkz. assets/ontology.js'teki glossify()) --
  // burada ayrı bir lookup gerekmiyor.
  function showGlossaryPreview(el, event) {
    const def = el.dataset.glossaryDef;
    if (!def) return;
    const tip = ensureTip();
    tip.innerHTML = `<p>${def}</p>`;
    tip.hidden = false;
    moveTip(event, el);
  }

  container.addEventListener("mouseover", (event) => {
    const a = event.target.closest("a.cross-link");
    if (a && !hasOwnPreview(a)) { showPreview(a, event); return; }
    const g = event.target.closest(".glossary-hint");
    if (g) showGlossaryPreview(g, event);
  });
  container.addEventListener("mousemove", (event) => {
    const a = event.target.closest("a.cross-link");
    if (a && !hasOwnPreview(a)) { moveTip(event, a); return; }
    const g = event.target.closest(".glossary-hint");
    if (g) moveTip(event, g);
  });
  container.addEventListener("mouseout", (event) => {
    const a = event.target.closest("a.cross-link");
    if (a && !hasOwnPreview(a)) { hideTip(); return; }
    const g = event.target.closest(".glossary-hint");
    if (g) hideTip();
  });
  container.addEventListener("focusin", (event) => {
    const a = event.target.closest("a.cross-link");
    if (a && !hasOwnPreview(a)) { showPreview(a, event); return; }
    const g = event.target.closest(".glossary-hint");
    if (g) showGlossaryPreview(g, event);
  });
  container.addEventListener("focusout", (event) => {
    const a = event.target.closest("a.cross-link");
    if (a && !hasOwnPreview(a)) { hideTip(); return; }
    const g = event.target.closest(".glossary-hint");
    if (g) hideTip();
  });
  container.addEventListener("mousedown", (event) => {
    const a = event.target.closest("a.cross-link");
    if (a && !hasOwnPreview(a)) hideTip();
  });
})();
