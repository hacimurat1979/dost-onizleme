// Terimler, Çizimler ve Fütûhât Atlası'ndaki "çizime tıkla, büyüt" davranışı
// birebir aynı DOM/CSS iskeletini (.cizim-lightbox) kullanıyordu; bu paylaşılan
// modül o iskeleti tek bir yerden yönetir.
window.DostLightbox = (function () {
  "use strict";

  let el = null;
  let lastFocused = null;
  let onCloseCb = null;

  function focusableChildren(panel) {
    return Array.from(panel.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'))
      .filter((n) => !n.hidden && n.offsetParent !== null);
  }

  function ensure(closeLabel) {
    if (el) return el;
    el = document.createElement("div");
    el.className = "cizim-lightbox";
    el.hidden = true;
    el.innerHTML = `
      <div class="cizim-lightbox__backdrop"></div>
      <div class="cizim-lightbox__panel" role="dialog" aria-modal="true">
        <button class="cizim-lightbox__close" type="button" aria-label="${closeLabel}">×</button>
        <p class="cizim-lightbox__ref" hidden></p>
        <h3 class="cizim-lightbox__name" hidden></h3>
        <div class="cizim-lightbox__svg-wrap"></div>
        <p class="cizim-lightbox__caption" hidden></p>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector(".cizim-lightbox__backdrop").addEventListener("click", close);
    el.querySelector(".cizim-lightbox__close").addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (!el || el.hidden) return;
      if (e.key === "Escape") { close(); return; }
      // Basit odak-tuzağı: panel açıkken Tab, arkadaki sayfaya kaçmasın.
      if (e.key === "Tab") {
        const panel = el.querySelector(".cizim-lightbox__panel");
        const focusable = focusableChildren(panel);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    return el;
  }

  function open({ closeLabel, svgHtml, caption, ref, name, onClose }) {
    const node = ensure(closeLabel);
    node.querySelector(".cizim-lightbox__svg-wrap").innerHTML = svgHtml || "";
    onCloseCb = onClose || null;

    const capEl = node.querySelector(".cizim-lightbox__caption");
    // innerHTML: caption'lar sitenin kendi metinleri, <em> gibi vurgu
    // etiketleri taşıyabiliyor (ör. Fütûhât/Füsûs diyagram altyazıları).
    // textContent kullanılsaydı bu etiketler işlenmeden düz metin olarak
    // görünürdü (2026-07-30 denetimi).
    capEl.innerHTML = caption || "";
    capEl.hidden = !caption;

    const refEl = node.querySelector(".cizim-lightbox__ref");
    refEl.textContent = ref || "";
    refEl.hidden = !ref;

    const nameEl = node.querySelector(".cizim-lightbox__name");
    nameEl.textContent = name || "";
    nameEl.hidden = !name;

    lastFocused = document.activeElement;
    node.hidden = false;
    document.body.classList.add("cizim-lightbox-open");
    node.querySelector(".cizim-lightbox__close").focus();
  }

  function close() {
    if (!el) return;
    el.hidden = true;
    document.body.classList.remove("cizim-lightbox-open");
    // Lightbox içeriğine özel, ayrı bir kutu (ör. Fütûhât'ın düğüm bilgi
    // kutusu) açık kalmış olabilir -- lightbox kapanınca o da kapansın.
    document.querySelectorAll(".node-hover-tip--lightbox").forEach((t) => { t.hidden = true; });
    if (lastFocused && document.contains(lastFocused) && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
    lastFocused = null;
    // İçeriği kendi başına canlı olan çağıranlar (ör. Füsûs'ün lightbox
    // içine yeniden monte ettiği sarmal sahnesi) burada temizlensin --
    // yoksa requestAnimationFrame döngüsü görünmez DOM'da sonsuza dek sürer.
    if (onCloseCb) { const cb = onCloseCb; onCloseCb = null; cb(); }
  }

  return { open, close };
})();
