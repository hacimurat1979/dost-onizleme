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

  function buildRegex(patterns) {
    return new RegExp("(?:" + patterns.join("|") + ")", "g");
  }

  const prophetRe = buildRegex(PROPHET_PATTERNS);
  const allahRe = buildRegex(ALLAH_PATTERNS);

  function makeHonorific(glyph) {
    const el = document.createElement("bdi");
    el.className = "honorific";
    el.lang = "ar";
    el.textContent = glyph;
    return el;
  }

  // Splits a single text node into [text, <bdi honorific>, text, ...] pieces
  // wherever `re` matches; returns null if there was no match (caller keeps
  // the original node untouched).
  function splitOnMatches(text, re, glyph) {
    re.lastIndex = 0;
    let m = re.exec(text);
    if (!m) return null;
    const pieces = [];
    let lastIndex = 0;
    while (m) {
      const end = m.index + m[0].length;
      pieces.push(document.createTextNode(text.slice(lastIndex, end)));
      pieces.push(makeHonorific(glyph));
      lastIndex = end;
      m = re.exec(text);
    }
    pieces.push(document.createTextNode(text.slice(lastIndex)));
    return pieces;
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
    const prophetPieces = splitOnMatches(text, prophetRe, SALLALLAHU);
    const afterProphet = prophetPieces || [document.createTextNode(text)];
    const finalPieces = [];
    afterProphet.forEach((piece) => {
      if (piece.nodeType !== Node.TEXT_NODE) {
        finalPieces.push(piece);
        return;
      }
      const allahPieces = splitOnMatches(piece.nodeValue, allahRe, JALLA_JALALUHU);
      if (allahPieces) finalPieces.push(...allahPieces);
      else finalPieces.push(piece);
    });
    if (prophetPieces || finalPieces.length !== 1) {
      node.replaceWith(...finalPieces);
    }
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
