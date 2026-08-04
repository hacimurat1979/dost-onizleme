// FAZ (JS lazy-load): 5 görünüm-özel script'i (sirlar-graph/kavram/ayet-hadis/
// siirler/vahdet, ~82 KB) sayfa ilk yüklendiğinde değil, o görünüm ilk kez
// açıldığında indirilsin diye eklendi (bkz. teknik analiz raporu, 2026-08).
//
// NEDEN SADECE BU 5'İ (14 DEĞİL): geri kalan 9 görünüm dosyası (esma, hal,
// terimler, cizimler, sorular, menziller, tasiyicilar, futuhat, fusus) kendi
// üst-seviye kodunda registerCrossLinkTerm() çağırıyor -- yani başka bir
// sayfadaki bir kelimenin üzerine gelindiğinde anında önizleme göstermesi,
// o dosyanın SAYFA AÇILIŞINDA çalışmış olmasına bağlı. Onları da tembel
// yüklersek, o görünüm hiç ziyaret edilmeden önce çapraz-bağlantı önizlemesi
// sessizce kaybolurdu -- bu ölçülüp bilerek dışarıda bırakıldı. Aşağıdaki 5
// dosya cross-link kaydı YAPMIYOR (doğrulandı), bu yüzden güvenli.
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
    __sirlarGraphApp: { src: "assets/sirlar-graph.js", integrity: "sha384-K4sFr2bJxo4Mb74GC9YPUlwENeQ2/cvhFW7lpQj/jqSxwAkgKEgRL9Q4ZBZBW8ql" },
    __kavramApp: { src: "assets/kavram.js", integrity: "sha384-O3adaeJf3nGp7ixKz2xEgI2d7eaCq4rgrBVVdyfkhckwFoCh9jgGKW4ZeL616gFH" },
    __ayetHadisApp: { src: "assets/ayet-hadis.js", integrity: "sha384-NqjeB685KS7IBcItAvAwOeWxt/vF6SrgMn3SvwFR5aON3x+23Cpcv81QwL2B+Sp8" },
    __siirlerApp: { src: "assets/siirler.js", integrity: "sha384-9LylDZ5mjiEKs/Bo/Wc+qYTUdeFt56xQCT71VdhE2weqN6MLMuhvgporkSM4qwXW" },
    __vahdetApp: { src: "assets/vahdet.js", integrity: "sha384-u8Hu4zkYTCJHkdw63jhcfroxHJYcXgoeD0jTqrqgwkjmS5fyW/RYFqdqS2kEhxQm" },
    __acikSorularApp: { src: "assets/acik-sorular.js", integrity: "sha384-DaP5VlgsP7Es5dvGttDQqu1MhxA4MRMrhFdzmHe+w6zsmk1hlyiM3wYR5PlZ8ZdS" },
    __bilmiyoruzApp: { src: "assets/bilmiyoruz.js", integrity: "sha384-lwJhdx6cYpw+87L1srGDOoxU2udEgxpdGwSrjP6S/xKOCka/DMctO8m3XKUlhren" },
    __kuantumApp: { src: "assets/kuantum.js", integrity: "sha384-181Vy3ByxGVSeIRWv7J3ntc1LO6zbZgE5zvvmIzZdb734apMq6xZJdO122tM7qIc" },
    __elestiriArkeolojisiApp: { src: "assets/elestiri-arkeolojisi.js", integrity: "sha384-D1/41ywKzbxcqAaDBdVA0/ILbc3HEXKZUurasI9Vlwt9mSL4yGH5sS7+Oz7nK9+P" },
    __hocalarApp: { src: "assets/hocalar.js", integrity: "sha384-r7ryWMDxHo1XBsChUULP+77NgCthVzMEsSfNS25xVsmPrBozA8uqO+FM6BbYbYQ5" },
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
