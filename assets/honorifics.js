(function () {
  "use strict";

  // Sallallahu aleyhi ve sellem / Jalla jalaluhu -- single-character Arabic
  // ligatures (Unicode Presentation Forms-A) that render as the traditional
  // rounded calligraphic seal, not spelled-out text.
  const SALLALLAHU = "ﷺ";
  const JALLA_JALALUHU = "ﷻ";

  // Only phrases that unambiguously name Allah or specifically the Prophet
  // Muhammad get the honorific -- bare "peygamber"/"prophet"/"profeta" are
  // ordinary words this site also uses for prophets in general (Mûsâ, İsâ,
  // İbrâhîm...), and tagging those with Muhammad's own honorific would be
  // wrong. Bare "Prophet"/"Profeta" (capitalized) are included EXCEPT when
  // immediately followed by another capitalized name (e.g. "Prophet Abraham",
  // "o Profeta Abraão") -- confirmed against the actual corpus before adding
  // this exception.
  const PROPHET_PATTERNS = [
    "\\bHz\\.\\s?Muhammed\\b", "\\bMuhammed Mustafa\\b", "\\bHz\\.\\s?Peygamber\\b",
    "\\bPeygamber Efendimiz\\b", "\\bPeygamberimiz\\b",
    "\\bRes[uû]lullah\\b", "\\bRas[uû]lullah\\b",
    "\\bProphet Muhammad\\b",
    "\\bProphet\\b(?!\\s+[A-ZÀ-Ý])",
    "\\bProfeta Muhammad\\b",
    "\\bProfeta\\b(?!\\s+[A-ZÀ-Ý])",
  ];
  const ALLAH_PATTERNS = ["\\bAllah\\b"];

  // Tek geçiş: hangi grubun eşleştiğine bakarak mührü seçiyoruz. (Önce iki
  // ayrı geçiş vardı -- peygamber, sonra Allah; alternasyonda peygamber
  // kalıpları başta durduğu için sıra aynı kalıyor, ama artık her metin
  // düğümü bir kez taranıyor ve her eşleşmenin sonu tek bir yerde biliniyor.)
  const HONORIFIC_RE = new RegExp(
    "(" + PROPHET_PATTERNS.join("|") + ")|(" + ALLAH_PATTERNS.join("|") + ")", "g");

  function makeHonorific(glyph) {
    const el = document.createElement("bdi");
    el.className = "honorific";
    el.lang = "ar";
    el.textContent = glyph;
    return el;
  }

  function isHonorific(node) {
    return !!node && node.nodeType === Node.ELEMENT_NODE &&
      node.classList && node.classList.contains("honorific");
  }

  // Bir metin düğümünün SONUNDAKI eşleşmenin mührü, düğümün içinde değil bir
  // sonraki kardeşinde durur -- yani metin hâlâ "...Allah" ile bittiği için
  // yeniden tarandığında yine eşleşir. Mühür orada mı diye bakmazsak her
  // tarama bir mühür daha ekler; bu yüzden bir sonraki (boş metin düğümlerini
  // atlayan) kardeşe bakıyoruz.
  function nextMeaningful(node) {
    let n = node.nextSibling;
    while (n && n.nodeType === Node.TEXT_NODE && n.nodeValue === "") n = n.nextSibling;
    return n;
  }

  function trailingGlyph(node) {
    let n = nextMeaningful(node);
    // Metin düğümü bir sarmalayıcının (çapraz-bağlantı <a>'sı, geçici bir
    // <mark>...) son çocuğuysa mühür o sarmalayıcının DIŞINDA kalır; bu
    // yüzden kardeş bulunamadıkça body'ye kadar yukarı tırmanıyoruz.
    let el = node;
    while (!n && el.parentNode && el.parentNode !== document.body) {
      el = el.parentNode;
      n = nextMeaningful(el);
    }
    return isHonorific(n) ? n.textContent : null;
  }

  function annotateTextNode(node) {
    const text = node.nodeValue;
    if (!text || (text.indexOf("Allah") === -1 && text.indexOf("Peygamber") === -1 &&
        text.indexOf("Prophet") === -1 && text.indexOf("Profeta") === -1 &&
        text.indexOf("Rasulullah") === -1 && text.indexOf("Rasûlullah") === -1 &&
        text.indexOf("Resulullah") === -1 && text.indexOf("Resûlullah") === -1 &&
        text.indexOf("Muhammed") === -1)) {
      return;
    }
    HONORIFIC_RE.lastIndex = 0;
    let m = HONORIFIC_RE.exec(text);
    if (!m) return;
    const kuyruk = trailingGlyph(node);
    const pieces = [];
    let lastIndex = 0;
    let degisti = false;
    while (m) {
      const end = m.index + m[0].length;
      const glyph = m[1] ? SALLALLAHU : JALLA_JALALUHU;
      pieces.push(document.createTextNode(text.slice(lastIndex, end)));
      if (end === text.length && kuyruk === glyph) {
        // Bu eşleşme zaten mühürlü -- ikincisini eklemiyoruz.
      } else {
        pieces.push(makeHonorific(glyph));
        degisti = true;
      }
      lastIndex = end;
      m = HONORIFIC_RE.exec(text);
    }
    // Hiçbir mühür eklenmediyse DOM'a HİÇ dokunmuyoruz: dokunsaydık kendi
    // gözcümüzü (ve sayfadaki öteki gözcüleri) boşuna tetiklerdik.
    if (!degisti) return;
    // Sondaki artık metin boşsa düğüm eklemiyoruz; eklersek mührü bir sonraki
    // taramada "kardeş" olarak bulamaz, kuyruk kontrolü boşa çıkardı.
    if (lastIndex < text.length) pieces.push(document.createTextNode(text.slice(lastIndex)));
    node.replaceWith(...pieces);
  }

  function annotate(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(annotateTextNode);
  }

  function watch(id) {
    const el = document.getElementById(id);
    if (!el) return;
    annotate(el);
    const observer = new MutationObserver(() => {
      observer.disconnect();
      annotate(el);
      observer.observe(el, { childList: true, subtree: true, characterData: true });
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    watch("detail-content");
    watch("futuhat-article");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
