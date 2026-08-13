/**
 * FAZ 5: "Anlamca yakın pasajlar" — tarayıcıda, saf JS ile kosinüs hesabı.
 *
 * Plan metni: "gömme vektörlerini statik dosyadan okuyup tarayıcıda saf JS
 * ile kosinüs hesaplayan bir 'anlamca yakın pasajlar' özelliği yaz.
 * transformers.js'i runtime'a SOKMA — vektörler derleme zamanında
 * üretilecek." Vektörlerin kendisi scripts/anlamsal-komsuluk.mjs ile
 * derleme zamanında (Node/transformers.js, offline) üretiliyor; bu dosya
 * yalnız üretilmiş int8 vektörleri okuyup dot-product hesaplıyor --
 * hiçbir model/kütüphane tarayıcıya inmiyor.
 *
 * Veri: data/ibn-arabi/pasaj-vektorleri-<dil>.bin (ham Int8Array, satır
 * başı `boyut` bayt) + aynı adı taşıyan .json manifest (kisim/route/
 * başlık/kısa alıntı, .bin ile SIRA hizalı). Yalnız istenince (bir kısım/
 * fass sayfasında "Göster"e tıklanınca) indirilir, önbelleğe alınır --
 * her sayfa yüklemesinde otomatik inmiyor.
 *
 * DURUŞ: bu bir ÖNERİdir, Dost'un çapraz-referansı değildir -- aynı
 * temkin data/ibn-arabi/anlamsal-baglantilar.json (elle onaylanmış alt
 * küme) için de geçerli, ama BURADAKİ sonuçlar hiç insan gözden
 * geçirmesinden geçmemiştir. Çağıran kod (futuhat.js/fusus.js) bunu
 * görsel/metinsel olarak açıkça ayırt etmeli.
 */
window.DostAnlamsalYakin = (function () {
  "use strict";

  var cache = {}; // dil -> Promise<{view, dim, olcek, pasajlar}> | null (başarısızsa)

  function loadLang(lang) {
    if (lang in cache) return cache[lang];
    var p = Promise.all([
      fetch("data/ibn-arabi/pasaj-vektorleri-" + lang + ".bin").then(function (r) {
        if (!r.ok) throw new Error("vektor .bin bulunamadı: " + r.status);
        return r.arrayBuffer();
      }),
      fetch("data/ibn-arabi/pasaj-vektorleri-" + lang + ".json").then(function (r) {
        if (!r.ok) throw new Error("manifest bulunamadı: " + r.status);
        return r.json();
      }),
    ]).then(function (parts) {
      return { view: new Int8Array(parts[0]), dim: parts[1].boyut, pasajlar: parts[1].pasajlar };
    });
    cache[lang] = p;
    return p;
  }

  function cosine(view, dim, i, j) {
    var offA = i * dim, offB = j * dim;
    var dot = 0, na = 0, nb = 0;
    for (var d = 0; d < dim; d++) {
      var a = view[offA + d], b = view[offB + d];
      dot += a * b; na += a * a; nb += b * b;
    }
    if (!na || !nb) return 0;
    return dot / Math.sqrt(na * nb);
  }

  /**
   * kisimId'ye ait pasajları, AYNI dilde farklı kısımlardaki en yakın
   * pasajlarla eşleştirir. Her hedef kısımdan yalnız en iyi eşleşme
   * tutulur (bir kısımla 3 ayrı pasaj eşleşse bile listede bir kez
   * görünür). Döner: [{ skor, kisim, route, baslik, ozet }, ...] (skor
   * büyükten küçüğe sıralı).
   */
  function bul(kisimId, lang, topN) {
    return loadLang(lang).then(function (data) {
      var kendiIdx = [];
      for (var i = 0; i < data.pasajlar.length; i++) {
        if (data.pasajlar[i].kisim === kisimId) kendiIdx.push(i);
      }
      if (!kendiIdx.length) return [];
      var enIyi = Object.create(null);
      for (var a = 0; a < kendiIdx.length; a++) {
        for (var b = 0; b < data.pasajlar.length; b++) {
          var hedef = data.pasajlar[b];
          if (hedef.kisim === kisimId) continue;
          var s = cosine(data.view, data.dim, kendiIdx[a], b);
          var mevcut = enIyi[hedef.kisim];
          if (!mevcut || s > mevcut.skor) enIyi[hedef.kisim] = { skor: s, pasaj: hedef };
        }
      }
      return Object.keys(enIyi)
        .map(function (k) { return enIyi[k]; })
        .sort(function (x, y) { return y.skor - x.skor; })
        .slice(0, topN || 5)
        .map(function (m) {
          return { skor: m.skor, kisim: m.pasaj.kisim, route: m.pasaj.route, baslik: m.pasaj.baslik, ozet: m.pasaj.ozet };
        });
    });
  }

  return { bul: bul };
})();
