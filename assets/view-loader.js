// FAZ (JS lazy-load): görünüm-özel script'ler sayfa ilk yüklendiğinde değil,
// o görünüm ilk kez açıldığında indirilsin diye eklendi (bkz. teknik analiz
// raporu, 2026-08). Başlangıçta 5 dosyayla (sirlar-graph/kavram/ayet-hadis/
// siirler/vahdet, ~82 KB) başladı; 2026-08-04 sonrası eklenen 7 görünüm de
// (acik-sorular, bilmiyoruz, elestiri-arkeolojisi, hocalar, eser-agi,
// seyahat-atlasi, kuran-dokusu) aynı desene katıldı -- VIEWS'teki 12
// girişin hepsi tembel yükleniyor. (kuantum ve futuhat-mimarisi
// görünümleri 2026-08-06'da kaldırıldı, bkz. CLAUDE.md.)
//
// NEDEN esma/hal/terimler/cizimler/sorular/menziller/tasiyicilar/futuhat/
// fusus BURADA DEĞİL: bu 9 görünüm dosyası kendi üst-seviye kodunda
// registerCrossLinkTerm() çağırıyor -- yani başka bir sayfadaki bir
// kelimenin üzerine gelindiğinde anında önizleme göstermesi, o dosyanın
// SAYFA AÇILIŞINDA çalışmış olmasına bağlı. Onları da tembel yüklersek, o
// görünüm hiç ziyaret edilmeden önce çapraz-bağlantı önizlemesi sessizce
// kaybolurdu -- bu ölçülüp bilerek dışarıda bırakıldı. VIEWS'teki 12 dosya
// cross-link kaydı YAPMIYOR (doğrulandı), bu yüzden güvenli.
//
// Yöntem: her görünüm dosyası kendi window.__xApp'ini KOŞULSUZ, TEK bir
// atamayla kurar (doğrulandı -- hiçbiri bir guard'ın arkasında değil). Bu
// script, gerçek dosya yüklenmeden ÖNCE aynı isme bir "vekil" (stub) nesne
// koyar; ontology.js'teki mevcut çağrı noktaları (`window.__sirlarGraphApp
// && window.__sirlarGraphApp.activate()`, `.isFocused()`, `.onLangChange()`,
// siirler.js'in kendi içindeki `.wireTabs()`/`.activate()` zinciri) HİÇBİRİ
// değişmeden çalışmaya devam eder -- vekil, çağrılan her metodu (Proxy ile,
// isim sabit kodlanmadan) yakalayıp script yüklenene kadar kuyruğa alır,
// yüklenince gerçek nesneye iletir.
//
// SRI: aşağıdaki INTEGRITY haritası scripts/sri-guncelle.py tarafından
// otomatik tazelenir (bkz. o dosyadaki guncelle_view_loader()) -- elle
// girilmez, kozmik-loader.js'teki (artık kaldırılmış) aynı desenin devamı.
(function () {
  "use strict";

  var VIEWS = {
    __sirlarGraphApp: { src: "assets/sirlar-graph.js", integrity: "sha384-K9PQeYGqjajla+bt+wh4SGx1tV35QSUgrPBOTAP5+E8yNNtoHfhFNlFPVKku5O0z" },
    __kavramApp: { src: "assets/kavram.js", integrity: "sha384-i8/9VFY8BMOqTPx3VOHJmOIb31fAhCmXHK6OZ7MGIR9F8+FxJcz0iTWklXvXrGz6" },
    __ayetHadisApp: { src: "assets/ayet-hadis.js", integrity: "sha384-GpUaMIEGBhps5r0MKFnWciC/O5ySr+GVhvJ1yepaC8LRhf/dWaEHT5NZPzdCG3ou" },
    __siirlerApp: { src: "assets/siirler.js", integrity: "sha384-BpTiVS/tR2HCtg0LO6GDqc9AJcpdE3Z4xLr3FMP+QGfPk7XNVuzZUwlhAACHWnTG" },
    __vahdetApp: { src: "assets/vahdet.js", integrity: "sha384-+MRrJXhBAHBlXEtXB63QkL/Yo/kFMsKUcMt46TzYFXdmcBAJ4XyxRI0izTR2TA6a" },
    __okumaYollariApp: { src: "assets/okuma-yollari.js", integrity: "sha384-7OyQU5sFVr9maE5chX4myAMBbRTMTyep8wX9/ZTn6/RJZRZgNrFQyYXb2H5VPBco" },
    __acikSorularApp: { src: "assets/acik-sorular.js", integrity: "sha384-jlq0FxALd+m1RZacWXwJy/zR1D61numdvf+J9K452u55BjlCjB8/Nu8EUmTt7W8v" },
    __bilmiyoruzApp: { src: "assets/bilmiyoruz.js", integrity: "sha384-ddviFXH0Y4NLMQmP284dwlLeZ1PIQiENiuMJEXUTdpxLapmf/Tm3sUBcJKBRciyI" },
    __elestiriArkeolojisiApp: { src: "assets/elestiri-arkeolojisi.js", integrity: "sha384-wMl2x3s/kOdwvMCj5o0ZLcuw9pi1g+6OzfeKrxHUbrWm86kJjLUCsYh8BzT9k1zy" },
    __hocalarApp: { src: "assets/hocalar.js", integrity: "sha384-wL2vWr9ldB1cFR1ie7elEnd/mgArZ7MR9QYIRnYHpls0eZ/c29FaIwGma1DJmzo7" },
    __eserAgiApp: { src: "assets/eser-agi.js", integrity: "sha384-ReKx0X4mDzNVOZCT7aA1zQZP/j+86gay6S2ARgxPXAHGBf5YA70W2UYHX45PRXkc" },
    __seyahatAtlasiApp: { src: "assets/seyahat-atlasi.js", integrity: "sha384-+eqN7QDtXc/UkWxYUlr/X4VNVw9Nu8ax4DXdrYYU3f3mowPi4KUDm71B8A7aG0E8" },
    __kuranDokusuApp: { src: "assets/kuran-dokusu.js", integrity: "sha384-zpleZYoxcar7e1EFE5mpgq6sXk5G/9Vg/xqryNGLqsi4n8eY/KzPl2zYCz3v5EQG" },
  };

  var loadingPromises = {};

  function loadScript(globalName) {
    if (loadingPromises[globalName]) return loadingPromises[globalName];
    var cfg = VIEWS[globalName];
    loadingPromises[globalName] = new Promise(function (resolve, reject) {
      var el = document.createElement("script");
      el.src = new URL(cfg.src, document.baseURI).href;
      el.integrity = cfg.integrity;
      el.onload = function () { resolve(); };
      el.onerror = function () {
        delete loadingPromises[globalName];
        reject(new Error("view-loader: " + cfg.src + " yüklenemedi"));
      };
      document.body.appendChild(el);
    });
    return loadingPromises[globalName];
  }

  // Proxy yoksa (çok eski bir tarayıcı) vekil kurulmuyor -- o durumda mevcut
  // `window.__xApp && ...` guard'ları zaten no-op olarak sessizce atlar,
  // görünüm hiç açılmaz. Bu yeni bir risk değil: aynı guard, bugün de dosya
  // yüklenemediğinde (ağ hatası) aynı şekilde sessizce atlıyordu.
  if (typeof Proxy === "undefined") return;

  Object.keys(VIEWS).forEach(function (globalName) {
    window[globalName] = new Proxy(
      {},
      {
        get: function (_target, prop) {
          if (typeof prop !== "string") return undefined;
          return function () {
            var args = arguments;
            return loadScript(globalName).then(function () {
              var real = window[globalName];
              if (real && typeof real[prop] === "function") {
                return real[prop].apply(real, args);
              }
            });
          };
        },
      }
    );
  });
})();
