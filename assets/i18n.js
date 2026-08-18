window.DostI18n = (function () {
  "use strict";

  const LANGS = ["tr", "en", "pt"];
  const LANG_LABEL = { tr: "TR", en: "EN", pt: "PT" };

  function detectBrowserLang() {
    const candidates = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || ""];
    for (const raw of candidates) {
      const code = (raw || "").toLowerCase();
      if (code.startsWith("pt")) return "pt";
      if (code.startsWith("en")) return "en";
      if (code.startsWith("tr")) return "tr";
    }
    return "tr";
  }

  function getLang() {
    let l = null;
    try { l = localStorage.getItem("dost-lang"); } catch (e) {}
    if (LANGS.includes(l)) return l;
    // SEO-03/04 (uzman paneli denetimi 2026-08-17): /en/ ve /pt/ önekli
    // statik kopyalar <html data-dost-lang="en"> taşıyor -- o sayfaya
    // arama motorundan/dış bağlantıdan gelen ziyaretçi, tarayıcı dili ne
    // olursa olsun sayfanın vaat ettiği dille karşılanmalı. Kullanıcının
    // kendi seçimi (localStorage) yine de her şeyin üstünde.
    const attr = document.documentElement.getAttribute("data-dost-lang");
    if (LANGS.includes(attr)) return attr;
    return detectBrowserLang();
  }

  function setLang(l) {
    if (!LANGS.includes(l)) return;
    try { localStorage.setItem("dost-lang", l); } catch (e) {}
  }

  // obj has keys like `${base}_tr`, `${base}_en`, `${base}_pt`
  function pick(obj, base) {
    const lang = getLang();
    return obj[base + "_" + lang] || obj[base + "_en"] || obj[base + "_tr"] || "";
  }

  // obj is a nested { tr, en, pt } dict (used by ontology.json)
  function pick3(obj) {
    if (!obj) return "";
    const lang = getLang();
    return obj[lang] || obj.en || obj.tr || "";
  }

  function applyStatic(root) {
    const scope = root || document;
    const lang = getLang();
    scope.querySelectorAll("[data-tr]").forEach((el) => {
      const v = el.dataset[lang] || el.dataset.en || el.dataset.tr;
      el.textContent = v;
    });
    // Metin taşımayan ama ada ihtiyacı olan öğeler (ana graf svg'leri gibi)
    // adlarını data-{dil}-aria-label ile veriyor -- textContent'e yazmak
    // svg'nin içeriğini silerdi (2026-07-28 denetimi).
    scope.querySelectorAll("[data-tr-aria-label]").forEach((el) => {
      const v = el.dataset[lang + "AriaLabel"] || el.dataset.enAriaLabel || el.dataset.trAriaLabel;
      if (v) el.setAttribute("aria-label", v);
    });
    // Graf köşe düğmelerinin title/aria-label'ı önceden üç dili tek metinde
    // birleştiriyordu ("A / B / C") -- fare imleci üstünde duran yerel
    // balon üçünü birden gösterip okunaksızlaşıyordu. Artık dile göre TEK
    // dil gösteriliyor (2026-08-01, kullanıcı geri bildirimi).
    scope.querySelectorAll("[data-tr-title]").forEach((el) => {
      const v = el.dataset[lang + "Title"] || el.dataset.enTitle || el.dataset.trTitle;
      if (v) { el.setAttribute("title", v); el.setAttribute("aria-label", v); }
    });
    document.documentElement.lang = lang;
  }

  function renderLangSwitcher(container, onChange) {
    container.innerHTML = "";
    const lang = getLang();
    LANGS.forEach((l) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = LANG_LABEL[l];
      b.className = "lang-btn" + (l === lang ? " lang-btn--active" : "");
      b.setAttribute("aria-pressed", String(l === lang));
      b.addEventListener("click", () => {
        if (getLang() === l) return;
        setLang(l);
        applyStatic();
        renderLangSwitcher(container, onChange);
        if (onChange) onChange(l);
      });
      container.appendChild(b);
    });
  }

  return { LANGS, getLang, setLang, pick, pick3, applyStatic, renderLangSwitcher };
})();
