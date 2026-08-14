// Sahne Çizim Sözlüğü — docs/05-teknik-plan.md §2'nin kurucusu.
//
// S1/S3/S4/S5 sahnelerinin ortak imge ailesi ("sonsuzun kaba girmesi",
// karanlıkta netleşme) sahne başına kopyalanmasın diye tek modül.
// Bağımlılıksız, yalnız SVG DOM üretir. Hareketi ÜRETMEZ — hareket
// partisyon+motor+sahnenin kendi applyOlcu'sundadır (iki katman
// sözleşmesi). Buradaki her parça yalnız düğüm kurar ve geri verir.
//
// GORSEL_DIL.md güvenceleri bu modülde koda bağlanır:
// - isikKatmani kaynak koordinatını viewBox İÇİNDE kabul etmez
//   (parlak-Zât yasağı: kaynak her zaman sahne dışında).
// - netBulanikCifti blur'u BİR KEZ atar; canlandırılacak olan yalnız
//   iki grubun opaklığıdır (transform/opacity bütçesi).
// - isikOrtusu perde DEĞİLDİR: nötr, dokusuz, kenarsız tek dikdörtgen.
//   Matlık=perdelenme anlamına çarpmasın diye id'si sabittir.

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function defsOf(svg) {
    var d = svg.querySelector("defs");
    return d || el("defs", {}, svg);
  }

  function vb(svg) {
    var p = (svg.getAttribute("viewBox") || "0 0 440 440").split(/\s+/).map(Number);
    return { x: p[0], y: p[1], w: p[2], h: p[3] };
  }

  // ── Nötr ışık örtüsü ─────────────────────────────────────────────────
  // Işık kısma = bu örtünün opaklığı. Başka hiçbir anlamı yok.
  function isikOrtusu(svg) {
    var v = vb(svg);
    return el("rect", {
      id: "isik-ortusu",
      x: v.x - 4, y: v.y - 4, width: v.w + 8, height: v.h + 8,
      fill: "#050505", opacity: "0", "pointer-events": "none",
    }, svg);
  }

  // ── Net + bulanık çift katman ────────────────────────────────────────
  // cizFn(g) aynı geometriyi iki gruba da çizer. Blur filtresi statiktir;
  // crossfade yalnız opaklıkla yapılır.
  function netBulanikCifti(svg, cizFn, opts) {
    opts = opts || {};
    var fid = opts.filtreId || "sc-bulanik-" + Math.floor(1e6 * ((opts.tohum || 0.734953) % 1));
    var f = el("filter", { id: fid, x: "-25%", y: "-25%", width: "150%", height: "150%" }, defsOf(svg));
    el("feGaussianBlur", { stdDeviation: String(opts.stdDeviation || 6) }, f);
    var bulanik = el("g", { "class": "sc-bulanik", filter: "url(#" + fid + ")", opacity: String(opts.bulanikOpaklik != null ? opts.bulanikOpaklik : 1) }, svg);
    var net = el("g", { "class": "sc-net", opacity: String(opts.netOpaklik != null ? opts.netOpaklik : 0) }, svg);
    cizFn(bulanik);
    cizFn(net);
    return { net: net, bulanik: bulanik };
  }

  // ── Kaynağı görünmeyen ışık alanı ────────────────────────────────────
  // yon: 'ust' | 'alt' | 'sol' | 'sag'. Degradenin merkezi viewBox
  // dışına itilir; fonksiyon içeride bir kaynak noktası kabul etmez.
  function isikKatmani(svg, opts) {
    opts = opts || {};
    var v = vb(svg);
    var gid = opts.gradyanId || "sc-isik-" + (opts.yon || "ust");
    var tasma = (opts.tasma != null ? opts.tasma : 0.35) * Math.max(v.w, v.h);
    var merkez = { ust: [v.x + v.w / 2, v.y - tasma], alt: [v.x + v.w / 2, v.y + v.h + tasma], sol: [v.x - tasma, v.y + v.h / 2], sag: [v.x + v.w + tasma, v.y + v.h / 2] }[opts.yon || "ust"];
    var g = el("radialGradient", { id: gid, cx: merkez[0], cy: merkez[1], r: (opts.erisim || 1.25) * Math.max(v.w, v.h), gradientUnits: "userSpaceOnUse" }, defsOf(svg));
    el("stop", { offset: "0%", "stop-color": opts.renk || "#FFE9B8", "stop-opacity": String(opts.siddet != null ? opts.siddet : 0.85) }, g);
    el("stop", { offset: "70%", "stop-color": opts.renk || "#FFE9B8", "stop-opacity": String((opts.siddet != null ? opts.siddet : 0.85) * 0.35) }, g);
    el("stop", { offset: "100%", "stop-color": opts.renk || "#FFE9B8", "stop-opacity": "0" }, g);
    return el("rect", { "class": "sc-isik", x: v.x, y: v.y, width: v.w, height: v.h, fill: "url(#" + gid + ")", "pointer-events": "none" }, svg);
  }

  // ── Kap ──────────────────────────────────────────────────────────────
  // Daire soyundan sade kap biçimleri. bicim yalnız yol verisini seçer;
  // anlam sahnenin partisyonundadır. cx/cy taban orta noktası, r ölçek.
  var KAP_YOLLARI = {
    // yarım küre kap (S3/S4): ağzı açık çanak
    kap: function (r) { return "M " + (-r) + " 0 A " + r + " " + r + " 0 0 0 " + r + " 0"; },
    // kandil (S5): çanak + kısa lüle
    kandil: function (r) { return "M " + (-r) + " 0 A " + r + " " + r + " 0 0 0 " + r + " 0 L " + (r * 1.35) + " " + (-r * 0.18); },
    // dağ (S3): iki eğimli sırt
    dag: function (r) { return "M " + (-r * 1.4) + " 0 L " + (-r * 0.2) + " " + (-r * 1.5) + " L " + (r * 0.35) + " " + (-r * 0.7) + " L " + (r * 1.4) + " 0"; },
    // eğilen soyut biçim (S3, Musa ölçüsü): dik ince yay
    insan: function (r) { return "M 0 0 C " + (-r * 0.12) + " " + (-r * 0.9) + " " + (r * 0.1) + " " + (-r * 1.4) + " 0 " + (-r * 1.8); },
  };

  function kap(parent, opts) {
    opts = opts || {};
    var yol = (KAP_YOLLARI[opts.bicim] || KAP_YOLLARI.kap)(opts.r || 40);
    return el("path", {
      "class": "sc-kap sc-kap--" + (opts.bicim || "kap"),
      d: yol,
      transform: "translate(" + (opts.cx || 0) + " " + (opts.cy || 0) + ")",
      fill: opts.dolgu || "none",
      stroke: opts.cizgi || "currentColor",
      "stroke-width": String(opts.kalinlik || 2),
      "stroke-linecap": "round", "stroke-linejoin": "round",
    }, parent);
  }

  // ── Künye bloğu ──────────────────────────────────────────────────────
  // kayitlar: [{tur:'dost'|'okuma'|'serh', metin:{tr,en,pt}, kaynak?:{href,etiket}}]
  // Kapalı <details> kurar (ETKILESIM_DILI: panel varsayılan kapalı).
  // Dil değişince sahne kunyeGuncelle(lang) çağırır — DOM yeniden kurulmaz,
  // yalnız metin düğümleri güncellenir.
  function kunye(container, kayitlar, baslik) {
    var det = document.createElement("details");
    det.className = "sahne-kunye";
    var sum = document.createElement("summary");
    det.appendChild(sum);
    var ul = document.createElement("ul");
    det.appendChild(ul);
    var hucreLer = kayitlar.map(function (k) {
      var li = document.createElement("li");
      li.className = "sahne-kunye__" + (k.tur || "dost");
      var span = document.createElement("span");
      li.appendChild(span);
      if (k.kaynak) {
        var a = document.createElement("a");
        a.href = k.kaynak.href;
        a.textContent = k.kaynak.etiket;
        li.appendChild(document.createTextNode(" — "));
        li.appendChild(a);
      }
      ul.appendChild(li);
      return span;
    });
    container.appendChild(det);
    function guncelle(lang) {
      sum.textContent = (baslik && (baslik[lang] || baslik.tr)) || "Künye";
      kayitlar.forEach(function (k, i) {
        hucreLer[i].textContent = k.metin[lang] || k.metin.tr;
      });
    }
    return { el: det, guncelle: guncelle };
  }

  window.DostSahneCizim = {
    isikOrtusu: isikOrtusu,
    netBulanikCifti: netBulanikCifti,
    isikKatmani: isikKatmani,
    kap: kap,
    kunye: kunye,
  };
})();
