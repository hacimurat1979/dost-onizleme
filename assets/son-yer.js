/* K-025: Fütûhât ve Füsûs için ORTAK "son okunan yer" kaydı. Yalnız okuyucunun bilerek açtığı bir
   kısım/fass kaydedilir (açık adres, çip/önceki-sonraki tıklaması); menüden varsayılan iniş kaydedilmez.
   `etiket` {tr,en,pt} olarak KAYIT ANINDA yazılır; karşılama ekranı büyük atlas dosyalarını çekmeden okur. */
window.DostSonYer = (function () {
  "use strict";
  var KEY = "dost-son-yer";
  return {
    kaydet: function (tur, id, etiket) {
      try { localStorage.setItem(KEY, JSON.stringify({ tur: tur, id: id, etiket: etiket, t: Date.now() })); } catch (e) {}
    },
    oku: function () {
      try {
        var v = JSON.parse(localStorage.getItem(KEY) || "null");
        return v && v.tur && v.id && v.etiket && (v.tur === "futuhat" || v.tur === "fusus") ? v : null;
      } catch (e) { return null; }
    }
  };
})();
