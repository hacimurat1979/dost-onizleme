/**
 * Hakkında sayfasının üçüncü sekmesi: "Eleştiriler" -- Dost'un vahdet-i vücûd
 * başlığı altında andığı görüşe yöneltilen eleştirileri (akademik kaynaklı)
 * ve Dost'un kendi metninden (şimdiye kadar okuduğumuz Fütûhât/Füsûs
 * bölümlerinden) bulabildiğimiz cevabı/gerilimi yan yana koyar.
 *
 * Veri: data/ibn-arabi/vahdet-elestiri.json. Kökensel duruş gereği (bkz.
 * CLAUDE.md), "gerilim" alanı olan maddelerde ihtilaf kapatılmaz -- eleştiri
 * ve cevap kartlarının altına üçüncü, ayrı renkli bir blok olarak eklenir.
 */
window.__vahdetApp = (function () {
  "use strict";
  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;

  const contentEl = document.getElementById("vahdet-content");

  let data = null;
  let fetchPromise = null;

  // Eleştiri Arkeolojisi köprüsü (2026-08-06). vahdet-elestiri.json'daki
  // maddeler ile elestiri-arkeolojisi.json'daki kişiler arasında ELLE
  // kurulmuş bağlar -- sirlar-sorular.json ile aynı desen (bkz.
  // data/ibn-arabi/vahdet-elestiri-kopru.json'un `not` alanı). Bağlar geç
  // gelirse (ikinci fetch daha yavaşsa) panel bağlar olmadan bir kez
  // render olur, sonra kendini tazeler -- sirlar/sorular köprüsüyle aynı
  // desen.
  let koprü = null;
  const kisiAdi = new Map();
  function koprüYukle() {
    if (koprü) return Promise.resolve(koprü);
    return Promise.all([
      GU.fetchJson("data/ibn-arabi/vahdet-elestiri-kopru.json"),
      GU.fetchJson("data/ibn-arabi/elestiri-arkeolojisi.json"),
    ]).then(([k, ea]) => {
      koprü = k;
      (ea.kisiler || []).forEach((p) => kisiAdi.set(p.id, p.ad));
      return k;
    }).catch(() => null);
  }
  function elestiriArkeolojisiHtml(maddeId) {
    if (!koprü) return "";
    const bag = (koprü.baglar || []).filter((b) => b.madde === maddeId);
    if (!bag.length) return "";
    const satir = bag.map((b) => {
      const ad = kisiAdi.get(b.kisi);
      if (!ad) return "";
      return `<button type="button" class="vahdet-ea-baglar__satir" data-view="elestiri-arkeolojisi" data-id="${esc(b.kisi)}">
        <span class="vahdet-ea-baglar__ad">${esc(tt(ad))}</span>
        <span class="vahdet-ea-baglar__neden">${esc(tt(b.neden))}</span></button>`;
    }).join("");
    if (!satir) return "";
    return `<div class="vahdet-ea-baglar">
      <p class="detail-eyebrow detail-eyebrow--section">${esc(tt({
        tr: "Eleştiri Arkeolojisi'nde de var",
        en: "Also in Archaeology of Criticism",
        pt: "Também na Arqueologia da Crítica" }))}</p>
      ${satir}</div>`;
  }

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function fetchData() {
    if (data) return Promise.resolve(data);
    if (fetchPromise) return fetchPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("vahdet-panel");
    fetchPromise = GU.fetchJson("data/ibn-arabi/vahdet-elestiri.json")
      .then((d) => {
        data = d;
        if (window.DostViewStatus) window.DostViewStatus.hide("vahdet-panel");
        return d;
      })
      .catch((err) => {
        console.error("vahdet-elestiri.json yüklenemedi", err);
        fetchPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("vahdet-panel", () => window.__vahdetApp.activate());
        return null;
      });
    return fetchPromise;
  }

  function kaynakHtml(k) {
    const atif = esc(tt(k.atif));
    if (k.url) {
      return `<li class="vahdet-kaynak"><a href="${esc(k.url)}" target="_blank" rel="noopener noreferrer">${atif} ↗</a></li>`;
    }
    return `<li class="vahdet-kaynak">${atif}</li>`;
  }

  function alintiHtml(a) {
    const site = a.site
      ? `<button type="button" class="vahdet-alinti__site" data-view="${esc(a.site.view)}" data-id="${esc(a.site.id)}">${esc(
          tt({
            tr: "Kaynağa git ↗",
            en: "Go to the source ↗",
            pt: "Ir para a fonte ↗",
          })
        )}</button>`
      : "";
    return (
      `<li class="vahdet-alinti">` +
      `<blockquote>${esc(tt(a.metin))}</blockquote>` +
      `<p class="vahdet-alinti__kaynak">${esc(tt(a.kaynak))}</p>` +
      site +
      `</li>`
    );
  }

  function maddeHtml(m) {
    const gerilim = m.gerilim
      ? `<div class="vahdet-gerilim">` +
        `<span class="vahdet-gerilim__label">${esc(
          tt({ tr: "Açık kalan gerilim", en: "The tension we leave open", pt: "A tensão que deixamos em aberto" })
        )}</span>` +
        `<p>${esc(tt(m.gerilim))}</p>` +
        `</div>`
      : "";
    return (
      `<article class="vahdet-madde">` +
      `<h3 class="vahdet-madde__baslik">${esc(tt(m.baslik))}</h3>` +
      `<div class="vahdet-pair">` +
      `<div class="vahdet-card vahdet-card--elestiri">` +
      `<span class="vahdet-card__label">${esc(tt({ tr: "Eleştiri", en: "The Criticism", pt: "A Crítica" }))}</span>` +
      `<p class="vahdet-card__ozet">${esc(tt(m.elestiri.ozet))}</p>` +
      `<ul class="vahdet-kaynaklar">${m.elestiri.kaynaklar.map(kaynakHtml).join("")}</ul>` +
      `</div>` +
      `<div class="vahdet-card vahdet-card--cevap">` +
      `<span class="vahdet-card__label">${esc(tt({ tr: "Dost'un Dediği", en: "What Dost Said", pt: "O Que Dost Disse" }))}</span>` +
      `<p class="vahdet-card__ozet">${esc(tt(m.dostunDedigi.ozet))}</p>` +
      `<ul class="vahdet-alintilar">${m.dostunDedigi.alintilar.map(alintiHtml).join("")}</ul>` +
      `</div>` +
      `</div>` +
      gerilim +
      elestiriArkeolojisiHtml(m.id) +
      `</article>`
    );
  }

  function render() {
    if (!contentEl || !data) return;
    const intro =
      `<p class="vahdet-intro">${esc(tt(data.description))}</p>` +
      (data.not ? `<p class="vahdet-not">${esc(tt(data.not))}</p>` : "");
    contentEl.innerHTML = intro + data.maddeler.map(maddeHtml).join("");
    contentEl.querySelectorAll(".vahdet-alinti__site").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.__dostNav && window.__dostNav.goTo(btn.dataset.view, btn.dataset.id || undefined);
      });
    });
    contentEl.querySelectorAll(".vahdet-ea-baglar__satir").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.__dostNav && window.__dostNav.goTo(btn.dataset.view, btn.dataset.id || undefined);
      });
    });
  }

  return {
    activate() {
      fetchData().then((d) => {
        if (d) render();
        // Köprü verisi geç gelirse paneli tazele -- bağlar görünmeden kalmasın.
        if (!koprü) koprüYukle().then((k) => { if (k && data) render(); });
      });
    },
    onLangChange() {
      if (data) render();
    },
  };
})();
