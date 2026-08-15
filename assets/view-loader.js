// FAZ (JS lazy-load): görünüm-özel script'ler sayfa ilk yüklendiğinde değil,
// o görünüm ilk kez açıldığında indirilsin diye eklendi (bkz. teknik analiz
// raporu, 2026-08). Başlangıçta 5 dosyayla (sirlar-graph/kavram/ayet-hadis/
// siirler/vahdet, ~82 KB) başladı; 2026-08-04 sonrası eklenen 7 görünüm de
// (acik-sorular, bilmiyoruz, elestiri-arkeolojisi, hocalar, eser-agi,
// seyahat-atlasi, kuran-dokusu) aynı desene katıldı.
//
// 2026-08-15: esma/hal/menziller/sorular/terimler/futuhat (~390 KB gzip,
// altısı da her sayfada koşulsuz iniyordu) de eklendi. Eskiden bu altısı
// (ve cizimler/tasiyicilar/fusus) registerCrossLinkTerm() çağırdığı için
// dışarıda bırakılmıştı -- ama terimler.js'in 2026-08-03 tarihli kendi
// yorumunun belgelediği gibi o bağımlılık artık yok: çapraz-bağlantı
// önizlemesi derleme zamanında üretilen ortak indeksten
// (data/ibn-arabi/capraz-baglanti-indeksi.json) besleniyor, ontology.js
// bunu SAYFA AÇILIŞINDA yüklüyor -- tek tek görünüm dosyalarının o anda
// yüklenmiş olmasına bağlı değil. cizimler/tasiyicilar/fusus/miskat şimdilik
// dışarıda kalmaya devam ediyor (ayrı bir ölçüm konusu).
//
// VIEWS'teki girişlerin hiçbiri cross-link kaydını SAYFA AÇILIŞINDA
// yapmıyor (doğrulandı), bu yüzden tembel yükleme güvenli.
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
    __sirlarGraphApp: { src: "assets/sirlar-graph.js", integrity: "sha384-GAkpG/fiyuMb5dI6zbtM9QBuUefv80x0SeiDhY0xJclXtdylwqjxcasfHqZskQ5b" },
    __kavramApp: { src: "assets/kavram.js", integrity: "sha384-6X2e7OFYaHkqno9xgF0yyPttgXVZrc7fUbADJ5nsb/Yv3l5vtGciRkwAs1HdQmes" },
    __ayetHadisApp: { src: "assets/ayet-hadis.js", integrity: "sha384-ueJyuy/b04NHTcHqZ0FdSQVTq3egRzUMDMlzsTW9FbKOpJ1RAIxqRvS7ukUSIoaI" },
    __siirlerApp: { src: "assets/siirler.js", integrity: "sha384-tnUujR0/9VXod3fMsZhg/TpcB6kG4FsJYxCyVQkjPlaDOGneSHSEopCeccba364W" },
    __vahdetApp: { src: "assets/vahdet.js", integrity: "sha384-vUMUhTP8C9J1eYREPxr3KjV3gHHUGHuV9kXb1E2WDKMgpEXdG5bedODRU4Wavpp9" },
    __okumaYollariApp: { src: "assets/okuma-yollari.js", integrity: "sha384-f3AwGIN00ENzTIgo4xzB1bgSzYoqz0VsDiHFCA63q4mDpaEHg1fMRVfCESArkdzL" },
    __acikSorularApp: { src: "assets/acik-sorular.js", integrity: "sha384-QP3Zz2J33MW27jd+vdHJmpkGdHzxETnMM8izdG4JGcYgwIxidbkuBbtcmTL1wSkZ" },
    __bilmiyoruzApp: { src: "assets/bilmiyoruz.js", integrity: "sha384-XdrBtKW8Y2fGfX05UUXKut0g6V8x5nXNSvFjou/cjrr3UvgNXDHLFfjbOj6pIrx+" },
    __elestiriArkeolojisiApp: { src: "assets/elestiri-arkeolojisi.js", integrity: "sha384-pjHCNouaInwoh1kfegO5inUHqz5C7m1IcgIexxwzUtE2USqMH1icbqH3iuw6hwDm" },
    __hocalarApp: { src: "assets/hocalar.js", integrity: "sha384-zcLam01u2hhsitjOxEAy74Z1eR36QELGCdHPTDa+IFekZtCvSZvQ06F0nuqSUnEK" },
    __eserAgiApp: { src: "assets/eser-agi.js", integrity: "sha384-+DxF+zZlrJmQGenYy+pB3B/3UquZlKMBT+gQ3DHl9MjnIjBes3Xg+o8K7pEi01Lp" },
    __seyahatAtlasiApp: { src: "assets/seyahat-atlasi.js", integrity: "sha384-ZeccvfV8m4hAk+oSIEmcCBx84qMV3xbvwqbwwy+ad1/1t3VWDsrU94LQQM1YftMt" },
    __yolculukApp: { src: "assets/yolculuk.js", integrity: "sha384-QlAIDOlNSY8+Pgryegu5T8dh2tRJz/qrqAOafemsIgGBWq9vkgpUEp2PZjz177I8" },
    __kuranDokusuApp: { src: "assets/kuran-dokusu.js", integrity: "sha384-XmeCLWDI3sg38uvXQVgf//GTNCe7l99cf+uYvC5jPQxJEr1/oKI0HLeTgb8bfMLC" },
    __esmaApp: { src: "assets/esma.js", integrity: "sha384-LEB+VD1I/3TlhKUAJdFMYfrqKVpqEVN+33jaP/R1kQ2INKyb2ks23oDv0k2hXyxu" },
    __halApp: { src: "assets/hal.js", integrity: "sha384-X1LL9QQPt+M8z9i8hwppf3oU5CZv7KrC+wgA6Rd9TESErhCPHrDw2F826yH2qPoE" },
    __terimlerApp: { src: "assets/terimler.js", integrity: "sha384-i67cRlJ7Vs3BqHvXKw1PV/rHVYymerkC3SXJ0WuprGA0rjMWSQA6oRKwrRywta1k" },
    __sorularApp: { src: "assets/sorular.js", integrity: "sha384-2Vln1BcKKcsY87l6Idx+oBsa7pIaCqYw6/OzfIM6cpFLICa/M0j+Tu4VwWqES5h4" },
    __menzillerApp: { src: "assets/menziller.js", integrity: "sha384-UNu3PnlIt9nPiOz7RUEfTq8M81l0rtrf5cQx9wtO/mE1QIoal04Ibprhbzsa4EhQ" },
    __futuhatApp: { src: "assets/futuhat.js", integrity: "sha384-f6dBy8DGb9oAuE5pE9INObqa5OLOZlp37WZB6C1Xts802eJfLlFkkI2IXvFMukre" },
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
