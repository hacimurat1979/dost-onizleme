// Terimler, Çizimler ve Fütûhât Atlası'ndaki "çizime tıkla, büyüt" davranışı
// birebir aynı DOM/CSS iskeletini (.cizim-lightbox) kullanıyordu; bu paylaşılan
// modül o iskeleti tek bir yerden yönetir.
window.DostLightbox = (function () {
  "use strict";

  let el = null;

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
      if (e.key === "Escape" && el && !el.hidden) close();
    });
    return el;
  }

  function open({ closeLabel, svgHtml, caption, ref, name }) {
    const node = ensure(closeLabel);
    node.querySelector(".cizim-lightbox__svg-wrap").innerHTML = svgHtml || "";

    const capEl = node.querySelector(".cizim-lightbox__caption");
    capEl.textContent = caption || "";
    capEl.hidden = !caption;

    const refEl = node.querySelector(".cizim-lightbox__ref");
    refEl.textContent = ref || "";
    refEl.hidden = !ref;

    const nameEl = node.querySelector(".cizim-lightbox__name");
    nameEl.textContent = name || "";
    nameEl.hidden = !name;

    node.hidden = false;
    document.body.classList.add("cizim-lightbox-open");
  }

  function close() {
    if (!el) return;
    el.hidden = true;
    document.body.classList.remove("cizim-lightbox-open");
    // Lightbox içeriğine özel, ayrı bir kutu (ör. Fütûhât'ın düğüm bilgi
    // kutusu) açık kalmış olabilir -- lightbox kapanınca o da kapansın.
    document.querySelectorAll(".node-hover-tip--lightbox").forEach((t) => { t.hidden = true; });
  }

  return { open, close };
})();
