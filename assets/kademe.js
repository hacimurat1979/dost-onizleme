/* Kademeli açılım (arayuz-kesif-yol-haritasi.md G15).
 *
 * Okuyucu metnin ne kadarını istediğini kendisi seçer: ozet (tek cümle) /
 * giris (bir paragraf) / govde (tam metin). Seçim localStorage'da
 * hatırlanır ve BÜTÜN site için tektir -- her kayıtta yeniden seçmek
 * zorunda kalmak, kademenin çözmeye çalıştığı yorgunluğun ta kendisi
 * olurdu. Varsayılan: giris.
 *
 * Kademe değişince sayfa YENİDEN YÜKLENMEZ; yalnız metin düğümü
 * değiştirilir. Okuyucu kaydırma konumunu ve bağlamını kaybetmez.
 *
 * Bağımsız modül: bir kaydın {ozet, giris, govde} üçlüsünü alır, geri
 * kalanını bilmez. Şu an Sırlar detayına bağlı, ama başka her yüzeye de
 * aynı çağrıyla takılabilir.
 */
(function () {
  "use strict";

  var KADEMELER = ["ozet", "giris", "govde"];
  var VARSAYILAN = "giris";
  var DEPO = "dost-kademe";

  var ETIKET = {
    ozet: { tr: "Özet", en: "Summary", pt: "Resumo" },
    giris: { tr: "Giriş", en: "Introduction", pt: "Introdução" },
    govde: { tr: "Tam metin", en: "Full text", pt: "Texto completo" }
  };
  var BASLIK = { tr: "Ne kadarını okumak istersin?",
                 en: "How much do you want to read?",
                 pt: "Quanto você quer ler?" };

  // Aynı seçimi paylaşan canlı bloklar. Her yayında DOM'dan kopmuş
  // olanlar ayıklanıyor (isConnected) -- böylece çağıranın elle temizlik
  // yapması gerekmiyor ve detay paneli her yeniden çizildiğinde liste
  // sonsuza kadar büyümüyor.
  var bloklar = [];

  function tt(sozluk) {
    if (window.I18n && typeof window.I18n.pick3 === "function") return window.I18n.pick3(sozluk);
    var dil = (document.documentElement.lang || "tr").slice(0, 2);
    return sozluk[dil] || sozluk.tr;
  }

  function oku() {
    try {
      var v = window.localStorage.getItem(DEPO);
      if (KADEMELER.indexOf(v) !== -1) return v;
    } catch (e) { /* gizli mod / kota */ }
    return VARSAYILAN;
  }

  function seciliKademe() { return oku(); }

  function kademeAyarla(k) {
    if (KADEMELER.indexOf(k) === -1) return;
    try { window.localStorage.setItem(DEPO, k); } catch (e) { /* yok say */ }
    bloklar = bloklar.filter(function (b) { return b.kok.isConnected; });
    bloklar.forEach(function (b) {
      try { b.ciz(k); } catch (e) { /* bir blok ötekini düşürmesin */ }
    });
  }

  /* metinler: {ozet:{tr,en,pt}, giris:{...}, govde:{...}}
   * Üçü de zorunlu (şema da öyle diyor). Biri eksikse hiç çizilmez --
   * yarım bir kademe çubuğu, okuyucuya var olmayan bir seçenek
   * göstermek olurdu. */
  function kur(kap, metinler) {
    if (!kap || !metinler) return null;
    for (var i = 0; i < KADEMELER.length; i++) {
      if (!metinler[KADEMELER[i]]) return null;
    }

    var aktif = oku();

    var kok = document.createElement("div");
    kok.className = "kademe";

    var serit = document.createElement("div");
    serit.className = "kademe__serit";
    serit.setAttribute("role", "group");
    serit.setAttribute("aria-label", tt(BASLIK));

    var metinEl = document.createElement("p");
    metinEl.className = "kademe__metin";
    // Kademe değişince ekran okuyucu yeni metni duyursun -- görsel
    // kullanıcı değişimi görüyor, o da duymalı.
    metinEl.setAttribute("aria-live", "polite");

    var dugmeler = {};
    KADEMELER.forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kademe__btn";
      b.textContent = tt(ETIKET[k]);
      b.setAttribute("aria-pressed", k === aktif ? "true" : "false");
      b.addEventListener("click", function () { kademeAyarla(k); });
      dugmeler[k] = b;
      serit.appendChild(b);
    });

    kok.appendChild(serit);
    kok.appendChild(metinEl);

    function ciz(k) {
      aktif = KADEMELER.indexOf(k) === -1 ? VARSAYILAN : k;
      metinEl.textContent = tt(metinler[aktif]);
      kok.dataset.kademe = aktif;
      KADEMELER.forEach(function (x) {
        dugmeler[x].setAttribute("aria-pressed", x === aktif ? "true" : "false");
      });
    }
    ciz(aktif);

    kap.appendChild(kok);
    // DOM'dan kopmuş blokları HER kurulumda ayıkla, yalnız kademe
    // değişiminde değil: detay paneli dil değişiminde ve her gezinmede
    // yeniden çiziliyor (bkz. ontology.js render()), yani kademe hiç
    // değişmese bile liste büyürdü. Ölçüldü: 6 tur gidip gelmede 9 blok.
    bloklar = bloklar.filter(function (b) { return b.kok.isConnected; });
    bloklar.push({ kok: kok, ciz: ciz });
    return kok;
  }

  window.__dostKademe = {
    kur: kur,
    seciliKademe: seciliKademe,
    kademeAyarla: kademeAyarla,
    KADEMELER: KADEMELER.slice(),
    _blokSayisi: function () { return bloklar.length; }   // yalnız test için
  };
})();
