/**
 * K-031 -- Paragrafa kalıcı bağlantı, alıcı şeridi ve paylaşım kartı.
 * Fütûhât kısım sayfası ve Füsûs fass sayfasının ORTAK modülü
 * (window.DostParagraf). Kaynak: lab/oneri-07/uygula.js (taşındı).
 *
 * DURUŞ: kart ÜRETİLİRKEN yeni metin yazılmaz. Karta yalnız okuma
 * metnimizden seçilmiş cümle ve künye dizilir; "bu metin Dost'un sözü ya da
 * çeviri değil, bizim okuma metnimiz" notu hem panelde hem kartın alt
 * satırında ("Okuma metnimiz") durur.
 *
 * Paragraf numarası = kısım/fass içindeki `type:"p"` blokların 1 tabanlı
 * SIRASI (veri bloğunun kimliği değil). Eylem satırı <div>/<span>: `<p>`
 * değil, çünkü edit-mode.js ve durus-kontrol.js `#...-article p` ile okuma
 * metnini tarıyor; arayüz metni okuma metni sayılmamalı.
 */
window.DostParagraf = (function () {
  "use strict";

  var UI = {
    baglanti: { tr: "Bağlantıyı kopyala", en: "Copy link", pt: "Copiar link" },
    kart: { tr: "Kart yap", en: "Make a card", pt: "Criar cartão" },
    par: { tr: "Paragraf", en: "Paragraph", pt: "Parágrafo" },
    kopyalandi: { tr: "Bağlantı kopyalandı", en: "Link copied", pt: "Link copiado" },
    kopyalanamadi: {
      tr: "Kopyalanamadı; adres çubuğundan alabilirsin",
      en: "Could not copy; take it from the address bar",
      pt: "Não foi possível copiar; pegue na barra de endereço",
    },
    etiket: { tr: "Paylaşılan paragraf", en: "Shared paragraph", pt: "Parágrafo compartilhado" },
    no: { tr: "{n}. paragraf", en: "paragraph {n}", pt: "parágrafo {n}" },
    basa: {
      tr: "Kısmın başına dön",
      en: "Back to the start of this part",
      pt: "Voltar ao início desta parte",
    },
    kapat: { tr: "Kapat", en: "Close", pt: "Fechar" },
    kartBas: { tr: "Paylaşım kartı", en: "Share card", pt: "Cartão de compartilhamento" },
    cumle: { tr: "Karta konacak cümle", en: "Sentence for the card", pt: "Frase para o cartão" },
    png: { tr: "PNG olarak indir", en: "Download as PNG", pt: "Baixar como PNG" },
    svg: { tr: "SVG olarak indir", en: "Download as SVG", pt: "Baixar como SVG" },
    kisaldi: {
      tr: "Cümle kart için kısaltıldı […].",
      en: "Sentence shortened for the card […].",
      pt: "Frase encurtada para o cartão […].",
    },
    okuma: { tr: "Okuma metnimiz", en: "Our reading text", pt: "Nosso texto de leitura" },
    ayrac: {
      tr: "Kart, seçilen paragrafın kendi cümlesinden üretilir; metin bizim okuma metnimizdir, çeviri ya da Dost'un kendi cümlesi değildir.",
      en: "The card is made from a sentence of the chosen paragraph; the text is our own reading text, not a translation or Dost's own sentence.",
      pt: "O cartão é feito a partir de uma frase do parágrafo escolhido; o texto é o nosso texto de leitura, não uma tradução nem uma frase do próprio Dost.",
    },
  };

  function lang() {
    try { return window.DostI18n ? window.DostI18n.getLang() : "tr"; } catch (e) { return "tr"; }
  }
  function T(k) { var d = UI[k]; return d[lang()] || d.tr; }
  function pick(o) { return o ? (o[lang()] || o.tr || "") : ""; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function plain(h) { return String(h).replace(/<[^>]*>/g, ""); }
  function reduce() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }

  // Cümle bölme. Regex LOOKBEHIND Safari < 16.4'te tüm betiği YÜKLENEMEZ
  // yapar; bu yüzden kurulumu try/catch içinde, yedek bölücüyle.
  var SPLIT = null;
  try { SPLIT = new RegExp("(?<=[.!?…”])\\s+(?=[A-ZÇĞİÖŞÜÂÎÛ“\"‘'])"); } catch (e) { SPLIT = null; }
  function sentences(h) {
    var p = plain(h), out;
    if (SPLIT) {
      out = p.split(SPLIT);
    } else {
      var raw = p.split(/([.!?…”])\s+/), pieces = [], i;
      for (i = 0; i < raw.length; i += 2) pieces.push(raw[i] + (raw[i + 1] || ""));
      out = [];
      pieces.forEach(function (s) {
        if (out.length && !/^[A-ZÇĞİÖŞÜÂÎÛ“"‘']/.test(s)) out[out.length - 1] += " " + s;
        else out.push(s);
      });
    }
    return out.filter(function (s) { return s.trim(); });
  }

  var ICON_LINK = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/></svg>';
  var ICON_CARD = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="2" width="12" height="14" rx="2"/><circle cx="9" cy="9" r="3"/></svg>';

  // Eylem satırı: paragrafın hemen ardından KARDEŞ <div>.
  function ekHtml(n) {
    return '<div class="par-ek" data-par="' + n + '">'
      + '<button type="button" class="par-ek__btn par-ek__lnk" data-a="link" data-n="' + n + '" aria-label="'
      + esc(T("baglanti") + " — " + T("par").toLowerCase() + " " + n) + '" title="' + esc(T("baglanti")) + '">'
      + ICON_LINK + '<span class="par-ek__et">' + esc(T("baglanti")) + "</span></button>"
      + '<button type="button" class="par-ek__btn" data-a="kart" data-n="' + n + '" aria-expanded="false">'
      + ICON_CARD + esc(T("kart")) + "</button>"
      + '<span class="par-ek__no">' + esc(T("par") + " " + n) + "</span></div>";
  }

  // --- durum -----------------------------------------------------------
  var ctxByRoot = typeof WeakMap === "function" ? new WeakMap() : null;
  var current = null;           // en son attach edilen bağlam
  var kartN = null, kartS = 0, kartDosya = null;
  var wired = typeof WeakSet === "function" ? new WeakSet() : null;
  var blobUrl = null;

  function toast(msg) {
    var el = document.createElement("div");
    el.className = "futuhat-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("futuhat-toast--visible"); });
    setTimeout(function () {
      el.classList.remove("futuhat-toast--visible");
      setTimeout(function () { el.remove(); }, 300);
    }, 1800);
  }

  function parEl(root, n) { return root.querySelector("#p-" + n); }
  function hashN() {
    var m = /^#p-(\d+)$/.exec(location.hash);
    return m ? +m[1] : null;
  }

  function temizleIsaret(root) {
    root.querySelectorAll(".par-serit").forEach(function (e) { e.remove(); });
    root.querySelectorAll(".is-hedef").forEach(function (e) { e.classList.remove("is-hedef"); });
    root.querySelectorAll(".par-ek--acik").forEach(function (e) { e.classList.remove("par-ek--acik"); });
  }

  // Alıcı şeridi + hedef vurgusu; kaydırma yalnız kaydir === true iken.
  function isaretle(ctx, kaydir, hedef) {
    var root = ctx.root;
    temizleIsaret(root);
    // hedef: 0 = "açıkça yok" (örn. başka fassın varsayılan inişi), sayı = o paragraf,
    // undefined/null = adresteki #p-N'e bak.
    var n = hedef === 0 ? 0 : (hedef || hashN());
    if (!n) return;
    var el = parEl(root, n);
    if (!el) return;
    el.classList.add("is-hedef");
    var ek = el.nextElementSibling;
    if (ek && ek.classList.contains("par-ek")) ek.classList.add("par-ek--acik");
    var serit = document.createElement("div");
    serit.className = "par-serit";
    serit.setAttribute("role", "status");
    serit.innerHTML = '<span class="par-serit__m"><b>' + esc(T("etiket")) + "</b> · "
      + esc(T("no").replace("{n}", n)) + "</span> "
      + '<button type="button" class="par-serit__bas">' + esc(T("basa")) + "</button>"
      + '<button type="button" class="par-serit__kapat" aria-label="' + esc(T("kapat")) + '">×</button>';
    el.insertAdjacentElement("beforebegin", serit);
    if (kaydir) {
      try { el.scrollIntoView({ block: "center", behavior: reduce() ? "auto" : "smooth" }); } catch (e) { el.scrollIntoView(); }
    }
  }

  // --- kopyalama --------------------------------------------------------
  function bagUrl(n) {
    return location.origin + location.pathname.replace(/\/$/, "") + "#p-" + n;
  }
  function kopyala(ctx, n) {
    var url = bagUrl(n);
    var ok = function () {
      // replaceState: aynı belge içinde popstate/hashchange tetiklemez
      // (<a href="#..."> tüm kısmı yeniden render ettirirdi).
      try { history.replaceState(null, "", location.pathname.replace(/\/$/, "") + "#p-" + n); } catch (e) {}
      isaretle(ctx, false);
      toast(T("kopyalandi"));
    };
    var fb = function () {
      var ta = document.createElement("textarea");
      ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var r = false;
      try { r = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      if (r) { ok(); }
      else {
        try { history.replaceState(null, "", location.pathname.replace(/\/$/, "") + "#p-" + n); } catch (e) {}
        isaretle(ctx, false);
        toast(T("kopyalanamadi"));
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, fb);
    else fb();
  }

  // --- kart -------------------------------------------------------------
  var fontsP = null;
  function fontUrl(f) { return new URL("assets/fonts/" + f, document.baseURI).href; }
  function b64(url) {
    return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (b) {
      var s = "", u = new Uint8Array(b);
      for (var i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
      return btoa(s);
    });
  }
  function loadFonts() {
    if (fontsP) return fontsP;
    fontsP = Promise.all([
      b64(fontUrl("Fraunces-Italic-static.woff2")),
      b64(fontUrl("SourceSans3-Regular-static.woff2")),
      b64(fontUrl("SourceSans3-SemiBold-static.woff2")),
    ]).then(function (f) {
      return '@font-face{font-family:"KF";font-style:italic;font-weight:400;src:url(data:font/woff2;base64,' + f[0] + ') format("woff2")}'
        + '@font-face{font-family:"KS";font-weight:400;src:url(data:font/woff2;base64,' + f[1] + ') format("woff2")}'
        + '@font-face{font-family:"KS";font-weight:600;src:url(data:font/woff2;base64,' + f[2] + ') format("woff2")}';
    });
    fontsP.catch(function () { fontsP = null; });
    return fontsP;
  }
  var mc = document.createElement("canvas").getContext("2d");
  function wrapText(text, font, w) {
    mc.font = font;
    var words = text.split(/\s+/), lines = [], cur = "";
    words.forEach(function (wd) {
      var tr = cur ? cur + " " + wd : wd;
      if (mc.measureText(tr).width > w && cur) { lines.push(cur); cur = wd; } else cur = tr;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  async function kartSVG(ctx, sentence, n) {
    var css = await loadFonts();
    await Promise.all([
      document.fonts.load('italic 40px "Fraunces Dost"'),
      document.fonts.load('28px "Source Sans Dost"'),
      document.fonts.load('600 28px "Source Sans Dost"'),
    ]);
    var W = 1080, H = 1350, qw = 640, qs = 56, lines, lh = 0, cut = false, maxH = 520;
    var QF = function (s) { return 'italic ' + s + 'px "Fraunces Dost"'; };
    for (; qs >= 34; qs -= 2) {
      lines = wrapText("“" + sentence + "”", QF(qs), qw);
      lh = Math.round(qs * 1.38);
      if (lines.length * lh <= maxH) break;
    }
    if (lines.length * lh > maxH) {
      cut = true;
      var words = sentence.split(/\s+/);
      qs = 34; lh = Math.round(qs * 1.38);
      while (words.length > 3) {
        words.pop();
        lines = wrapText("“" + words.join(" ") + " […]”", QF(34), qw);
        if (lines.length * lh <= maxH) break;
      }
    }
    var y0 = 675 - (lines.length * lh) / 2 + qs * 0.8, q = "";
    lines.forEach(function (L, i) {
      q += '<text x="540" y="' + (y0 + i * lh).toFixed(0) + '" text-anchor="middle" font-family="KF,\'Fraunces Dost\',Georgia,serif" font-style="italic" font-size="' + qs + '" fill="#1f1d1a">' + esc(L) + "</text>";
    });

    // Künye: çağıran taraf HAZIR verir (kısım başlığıyla aynı dizgeler).
    var ky = ctx.kunye() || {};
    var rows = [];
    wrapText(ky.ana || "", '600 28px "Source Sans Dost"', 900).slice(0, 2)
      .forEach(function (L) { rows.push({ t: L, sz: 28, w: 600, c: "#1f1d1a", gap: 34 }); });
    wrapText(ky.baslik || "", '600 28px "Source Sans Dost"', 880).slice(0, 2)
      .forEach(function (L) { rows.push({ t: L, sz: 28, w: 400, c: "#55514a", gap: 34 }); });
    if (ky.kaynak) {
      wrapText(ky.kaynak, '24px "Source Sans Dost"', 900).slice(0, 3)
        .forEach(function (L) { rows.push({ t: L, sz: 24, w: 400, c: "#55514a", gap: 30 }); });
    }
    rows.push({ t: T("okuma") + " · " + T("par").toLowerCase() + " " + n, sz: 26, w: 400, c: "#55514a", gap: 34 });
    // Son satırın taban çizgisi 1276'de kalsın; blok yukarı doğru büyür.
    var total = 0, i2;
    for (i2 = 1; i2 < rows.length; i2++) total += rows[i2].gap;
    var yy = Math.min(1158, 1276 - total), k = "";
    rows.forEach(function (r, ri) {
      if (ri > 0) yy += r.gap;
      k += '<text x="540" y="' + yy + '" text-anchor="middle" font-family="KS,\'Source Sans Dost\',sans-serif" font-weight="' + r.w + '" font-size="' + r.sz + '" fill="' + r.c + '">' + esc(r.t) + "</text>";
    });

    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '"><style>' + css + "</style>"
      + '<rect width="' + W + '" height="' + H + '" fill="#faf9f6"/>'
      + '<circle cx="540" cy="675" r="440" fill="none" stroke="#d9d4c8" stroke-width="2"/>'
      + '<circle cx="540" cy="235" r="5" fill="#8a5a14"/>'
      + q + k
      + '<text x="540" y="1322" text-anchor="middle" font-family="KS,\'Source Sans Dost\',sans-serif" font-weight="600" font-size="28" letter-spacing="1.5" fill="#8a5a14">dostarabi.com</text></svg>';
    return { svg: svg, cut: cut };
  }

  function panelEl(ctx) { return ctx.root.querySelector(".par-panel"); }

  async function kartCiz(ctx) {
    var box = panelEl(ctx);
    if (!box || !kartN) return;
    var S = sentences(pick(ctx.paragraphs[kartN - 1]));
    var sel = S[Math.min(kartS, S.length - 1)] || "";
    var r = await kartSVG(ctx, sel, kartN);
    box = panelEl(ctx);
    if (!box) return;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(new Blob([r.svg], { type: "image/svg+xml" }));
    box.querySelector(".par-panel__img").src = blobUrl;
    box.querySelector(".par-panel__kisalt").hidden = !r.cut;
    box._svg = r.svg;
  }

  function panelKapat(ctx, odak) {
    var n = kartN;
    kartN = null; kartDosya = null;
    ctx.root.querySelectorAll(".par-panel").forEach(function (e) { e.remove(); });
    ctx.root.querySelectorAll('[data-a="kart"]').forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    if (odak && n) {
      var bb = ctx.root.querySelector('[data-a="kart"][data-n="' + n + '"]');
      if (bb) bb.focus();
    }
  }

  function panelAc(ctx, n, rebuild) {
    ctx.root.querySelectorAll(".par-panel").forEach(function (e) { e.remove(); });
    ctx.root.querySelectorAll('[data-a="kart"]').forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    var ek = ctx.root.querySelector('.par-ek[data-par="' + n + '"]');
    if (!ek) return;
    var S = sentences(pick(ctx.paragraphs[n - 1]));
    if (!rebuild) kartS = 0;
    if (kartS >= S.length) kartS = 0;
    kartN = n; kartDosya = ctx.dosya;
    var btn = ek.querySelector('[data-a="kart"]');
    if (btn) btn.setAttribute("aria-expanded", "true");
    var h = '<div class="par-panel" role="group" aria-labelledby="par-ph-' + n + '">'
      + '<div class="par-panel__bas" id="par-ph-' + n + '">' + esc(T("kartBas")) + "</div>"
      + '<div class="par-panel__not">' + esc(T("ayrac")) + "</div>"
      + '<fieldset class="par-panel__set"><legend>' + esc(T("cumle")) + '</legend><ul class="par-panel__cumleler">'
      + S.map(function (s, i) {
        return '<li><label><input type="radio" name="par-cm" value="' + i + '"' + (i === kartS ? " checked" : "") + "><span>" + esc(s) + "</span></label></li>";
      }).join("")
      + "</ul></fieldset>"
      + '<img class="par-panel__img" alt="' + esc(T("kartBas")) + '" width="1080" height="1350">'
      + '<div class="par-panel__not par-panel__kisalt" hidden>' + esc(T("kisaldi")) + "</div>"
      + '<div class="par-panel__alt">'
      + '<button type="button" class="par-ek__btn par-panel__dugme" data-a="png">' + esc(T("png")) + "</button>"
      + '<button type="button" class="par-ek__btn par-panel__dugme" data-a="svg">' + esc(T("svg")) + "</button>"
      + '<button type="button" class="par-ek__btn par-panel__dugme" data-a="kapat">' + esc(T("kapat")) + "</button>"
      + "</div></div>";
    ek.insertAdjacentHTML("afterend", h);
    kartCiz(ctx);
  }

  function indir(blob, ad) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = ad; a.hidden = true;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function dosyaAd(ctx, ext) { return ctx.dosya + "-p" + kartN + "-" + lang() + "." + ext; }
  function png(ctx) {
    var box = panelEl(ctx);
    if (!box || !box._svg) return;
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas");
      c.width = 1080; c.height = 1350;
      c.getContext("2d").drawImage(img, 0, 0);
      c.toBlob(function (b) { if (b) indir(b, dosyaAd(ctx, "png")); }, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(box._svg);
  }

  // --- olay bağlama (kök başına bir kez; bağlam her attach'te tazelenir) --
  function wire(root) {
    if (wired && wired.has(root)) return;
    if (wired) wired.add(root);
    root.addEventListener("click", function (e) {
      var ctx = ctxByRoot && ctxByRoot.get(root);
      if (!ctx) return;
      var b = e.target.closest && e.target.closest("[data-a]");
      var a = b && b.dataset.a;
      if (a === "link") kopyala(ctx, +b.dataset.n);
      else if (a === "kart") {
        var n = +b.dataset.n;
        if (kartN === n && panelEl(ctx)) panelKapat(ctx, true); else panelAc(ctx, n, false);
      } else if (a === "kapat") panelKapat(ctx, true);
      else if (a === "png") png(ctx);
      else if (a === "svg") {
        var bx = panelEl(ctx);
        if (bx && bx._svg) indir(new Blob([bx._svg], { type: "image/svg+xml" }), dosyaAd(ctx, "svg"));
      } else if (e.target.closest && e.target.closest(".par-serit__bas")) {
        try { history.replaceState(null, "", location.pathname); } catch (x) {}
        temizleIsaret(ctx.root);
        window.scrollTo({ top: 0, behavior: reduce() ? "auto" : "smooth" });
      } else if (e.target.closest && e.target.closest(".par-serit__kapat")) {
        try { history.replaceState(null, "", location.pathname.replace(/\/$/, "")); } catch (x) {}
        temizleIsaret(ctx.root);
      }
    });
    root.addEventListener("change", function (e) {
      var ctx = ctxByRoot && ctxByRoot.get(root);
      if (ctx && e.target && e.target.name === "par-cm") { kartS = +e.target.value; kartCiz(ctx); }
    });
  }

  window.addEventListener("hashchange", function () {
    if (!current || !current.root.isConnected) return;
    var ctx = current;
    setTimeout(function () { if (hashN()) isaretle(ctx, true); else temizleIsaret(ctx.root); }, 0);
  });

  // ctx: { root, paragraphs:[{tr,en,pt}...] (n-1 sırasıyla), kunye:()=>{ana,baslik,kaynak},
  //        dosya:"c1k9", kaydir:bool }
  function attach(ctx) {
    if (!ctx || !ctx.root) return;
    current = ctx;
    if (ctxByRoot) ctxByRoot.set(ctx.root, ctx);
    wire(ctx.root);
    isaretle(ctx, !!ctx.kaydir, ctx.hedef);
    if (kartN && kartDosya === ctx.dosya && ctx.paragraphs[kartN - 1]) panelAc(ctx, kartN, true);
    else { kartN = null; kartDosya = null; }
  }

  return { ekHtml: ekHtml, attach: attach, sentences: sentences };
})();
