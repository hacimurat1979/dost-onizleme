/* Sahne sayfalarının ortak kabuğu (K-013): tema + dil + üst çubuk.
   Bu dosya <head>'de yüklenir: tema, ilk boyamadan önce uygulanır (titreme
   olmasın). Çubuk, sayfa yüklenince DostSahne.init(...) ile kurulur.
   Dil kaynağı assets/i18n.js (DostI18n.getLang/setLang; anahtar dost-lang),
   tema anahtarı dost-theme (light|dark) — ana siteyle aynı. */
(function () {
  "use strict";
  var root = document.documentElement;

  function storedTheme() {
    try { var t = localStorage.getItem("dost-theme"); return (t === "light" || t === "dark") ? t : null; }
    catch (e) { return null; }
  }
  var st = storedTheme();
  if (st) root.setAttribute("data-theme", st);

  function curTheme() {
    var a = root.getAttribute("data-theme");
    if (a === "dark" || a === "light") return a;
    return (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  function setTheme(t) {
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("dost-theme", t); } catch (e) {}
  }
  function getLang() {
    return (window.DostI18n && DostI18n.getLang) ? DostI18n.getLang() : "tr";
  }

  // index.html #theme-toggle etiketinin ("Aydınlık / Karanlık mod — Light /
  // Dark mode — Modo claro / escuro") dile göre tek parçası; yeni metin yok.
  var THEME_LABEL = { tr: "Aydınlık / Karanlık mod", en: "Light / Dark mode", pt: "Modo claro / escuro" };
  var LANG_LABEL = { tr: "Dil", en: "Language", pt: "Idioma" };
  var NT = {
    tr: { home: "← Haritaya", ayna: "Ayna Metaforu", perde: "Perde Zinciri", iki: "Aynı Âyet, İki Mertebe" },
    en: { home: "← Map", ayna: "Mirror Metaphor", perde: "Chain of Veiling", iki: "The Same Verse, Two Levels" },
    pt: { home: "← Mapa", ayna: "Metáfora do Espelho", perde: "Cadeia do Véu", iki: "O Mesmo Versículo, Dois Graus" }
  };
  var PAGES = [
    { k: "ayna", href: "ayna-metaforu.html" },
    { k: "perde", href: "perde-zinciri.html" },
    { k: "iki", href: "iki-mertebe.html" }
  ];
  var SUN = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="12" y1="1.5" x2="12" y2="4.2"/><line x1="12" y1="19.8" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="4.2" y2="12"/><line x1="19.8" y1="12" x2="22.5" y2="12"/><line x1="4.4" y1="4.4" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.6" y2="19.6"/><line x1="4.4" y1="19.6" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.6" y2="4.4"/></g></svg>';
  var MOON = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  // Tema düğmesi: tek başına da kullanılabilir (meditasyon.html kendi çubuğuna koyar).
  function themeToggle(onChange) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "sahne-theme";
    function paint() {
      var dark = curTheme() === "dark";
      b.innerHTML = dark ? SUN : MOON;
      b.setAttribute("aria-pressed", dark ? "true" : "false");
      var lbl = THEME_LABEL[getLang()] || THEME_LABEL.tr;
      b.setAttribute("aria-label", lbl); b.setAttribute("title", lbl);
    }
    b.addEventListener("click", function () {
      setTheme(curTheme() === "dark" ? "light" : "dark");
      paint();
      if (onChange) onChange(curTheme());
    });
    b.paint = paint; paint();
    return b;
  }

  // opts: { setLang(l) (sayfanın kendi fonksiyonu), titles:{tr,en,pt}, current:'ayna'|'perde'|'iki' }
  function init(opts) {
    if (window.top !== window) root.classList.add("in-frame"); // meditasyon iframe'lerinde çubuk yok
    var lang = getLang();
    var bar = document.createElement("div");
    bar.className = "sahne-bar"; bar.setAttribute("role", "navigation");
    bar.setAttribute("aria-label", "Site gezinmesi");
    var home = document.createElement("a"); home.href = "./"; home.id = "sn-home";
    bar.appendChild(home);
    PAGES.forEach(function (p) {
      var e;
      if (p.k === opts.current) { e = document.createElement("span"); e.setAttribute("aria-current", "page"); }
      else { e = document.createElement("a"); e.href = p.href; }
      e.id = "sn-" + p.k; bar.appendChild(e);
    });
    var tools = document.createElement("div"); tools.className = "sahne-bar__tools";
    var lg = document.createElement("div"); lg.className = "sahne-lang"; lg.setAttribute("role", "group");
    var btns = {};
    ["tr", "en", "pt"].forEach(function (l) {
      var b = document.createElement("button"); b.type = "button"; b.id = "sl-" + l; b.textContent = l.toUpperCase();
      b.addEventListener("click", function () { apply(l, true); });
      btns[l] = b; lg.appendChild(b);
    });
    var th = themeToggle();
    tools.appendChild(lg); tools.appendChild(th); bar.appendChild(tools);
    document.body.insertBefore(bar, document.body.firstChild);

    function apply(l, persist) {
      if (persist && window.DostI18n) DostI18n.setLang(l);
      if (opts.setLang) opts.setLang(l);
      root.lang = l;
      if (opts.titles) document.title = (opts.titles[l] || opts.titles.tr) + " — Dost Arabi";
      var t = NT[l] || NT.tr;
      home.textContent = t.home;
      PAGES.forEach(function (p) { document.getElementById("sn-" + p.k).textContent = t[p.k]; });
      lg.setAttribute("aria-label", LANG_LABEL[l] || LANG_LABEL.tr);
      Object.keys(btns).forEach(function (k) { btns[k].setAttribute("aria-pressed", k === l ? "true" : "false"); });
      th.paint();
    }
    // postMessage ile gelen dil (meditasyon) sayfanın setLang'ini doğrudan çağırır;
    // çubuk etiketleri de eşlensin diye sarmalıyoruz.
    if (opts.setLang && typeof window.setLang === "function") {
      var orig = window.setLang;
      window.setLang = function (l) { orig(l); syncBar(l); };
    }
    function syncBar(l) {
      root.lang = l;
      if (opts.titles) document.title = (opts.titles[l] || opts.titles.tr) + " — Dost Arabi";
      var t = NT[l] || NT.tr;
      home.textContent = t.home;
      PAGES.forEach(function (p) { document.getElementById("sn-" + p.k).textContent = t[p.k]; });
      lg.setAttribute("aria-label", LANG_LABEL[l] || LANG_LABEL.tr);
      Object.keys(btns).forEach(function (k) { btns[k].setAttribute("aria-pressed", k === l ? "true" : "false"); });
      th.paint();
    }
    apply(lang, false);
  }

  window.DostSahne = { init: init, themeToggle: themeToggle, curTheme: curTheme, setTheme: setTheme };
})();
