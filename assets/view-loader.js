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
    __sirlarGraphApp: { src: "assets/sirlar-graph.js", integrity: "sha384-BRzLS2A7b2GtSzC/029wyFnItyzgtts/kZu3yvo2aXTdQgM2qDhVAN4QjbBOlJfK" },
    __kavramApp: { src: "assets/kavram.js", integrity: "sha384-cB0CHRDcCKIabXy545C7bSjQNEmI5EBsIZdV4wxkybxE2biVzqdL2hAr7dDmyvnH" },
    __ayetHadisApp: { src: "assets/ayet-hadis.js", integrity: "sha384-nIFZDSqrBwHlvPJqtVx/Jgr+P4JtIuJki94cVcIk2Zhk+8d6D9HaiOFUE3f80zIB" },
    __siirlerApp: { src: "assets/siirler.js", integrity: "sha384-3DAmRScI+L9wWXXhl7hJ+vPPOCivyCDlNFjOkGi+POHuSA/16/KYsSWuqWgoKJ/9" },
    __vahdetApp: { src: "assets/vahdet.js", integrity: "sha384-2rN3S/i2hCI+gsfcxXbYk077iG7ineliJ4mSDwiZoVruUR8eOOqc9ctW2W4Q7I79" },
    __okumaYollariApp: { src: "assets/okuma-yollari.js", integrity: "sha384-f3AwGIN00ENzTIgo4xzB1bgSzYoqz0VsDiHFCA63q4mDpaEHg1fMRVfCESArkdzL" },
    __neredenBaslamaliApp: { src: "assets/nereden-baslamali.js", integrity: "sha384-yDtO/XYSNvn8Pdmncj6PbBcRtcFwXHCYduLifAcnm764wmD5VDT4msgSMHvrPk+C" },
    __acikSorularApp: { src: "assets/acik-sorular.js", integrity: "sha384-0Yr7y0F+LXN+oMbT+0CCmTOx8npa2Mi9iHedV7xG0xWkFaSeknU93E8qzgGiaTLS" },
    __bilmiyoruzApp: { src: "assets/bilmiyoruz.js", integrity: "sha384-2fR7iMfe8Vm0JvN/yGmWElcfKaAmcQHH2t5ijPf0CSCJ3LxqqfWy7UpDwdLZzlgg" },
    __elestiriArkeolojisiApp: { src: "assets/elestiri-arkeolojisi.js", integrity: "sha384-m4BYZstyOGMBJr17vXHvrHjTAja9ebKADMXQqdt+PTqumd9ifXMnXi19GeZaZmkp" },
    __hocalarApp: { src: "assets/hocalar.js", integrity: "sha384-zcLam01u2hhsitjOxEAy74Z1eR36QELGCdHPTDa+IFekZtCvSZvQ06F0nuqSUnEK" },
    __eserAgiApp: { src: "assets/eser-agi.js", integrity: "sha384-57omR3wjoY3rD1vTnKv/z5KlRrSjO9IDcjxInujlN7wjAISFF5VIVEWvAn08F9vV" },
    __seyahatAtlasiApp: { src: "assets/seyahat-atlasi.js", integrity: "sha384-kl48zvjGhCjql6ilzjKBLNV+o8iJC8Aa9VWWZs2PcW4CRsYqu936jtfJaJDxoY0k" },
    __yolculukApp: { src: "assets/yolculuk.js", integrity: "sha384-4rFNj/JUH7Mr0a6bUe2+DXBMA729ejih0SnKi4JjwiyDpWMm76JHIdiDkCLzplkl" },
    __kuranDokusuApp: { src: "assets/kuran-dokusu.js", integrity: "sha384-oidFJfgo+xoAz+O7Bbd6B8dvvi7onts6hQrS9QUbJ6KlizRcMxipsiysamiWtf39" },
    __esmaApp: { src: "assets/esma.js", integrity: "sha384-itI0QocQMU3WJQq6Fc00QuCiiwgzNoOfAlMfLa56oixZNAIbMqOZQIygHvvYXjP8" },
    __halApp: { src: "assets/hal.js", integrity: "sha384-6FyyE1p9PyylCpdaRSz7Xs+OgKfrbGwCgKchzhoJQ6AEf6o5Pp51EAx+/VD3Yqxw" },
    __terimlerApp: { src: "assets/terimler.js", integrity: "sha384-jGMyHf2FmsoxMzhIees9cckXaNUce1llkPllNa1C+FEtwkryHYFugE+J/gKWPCcd" },
    __sorularApp: { src: "assets/sorular.js", integrity: "sha384-N1uSiPe8lffbKjlqmlkz4tGyIFwhxCaNT/EQCkRu0D7JRpFWny4WZLrmV0asTO6c" },
    __menzillerApp: { src: "assets/menziller.js", integrity: "sha384-8DMi+ndcYocH8RT225ZPxcC0pmi0ChHG3NiFoYbTFJhrAc1k9B4Iz7O0H20nGenB" },
    __futuhatApp: { src: "assets/futuhat.js", integrity: "sha384-1fiswUyPfMQ3x4yRzul7OX2UwP5U40j2uiqLdQDtd9TTmOedtk2o1HfEOp2pDCSo" },
    __cizimlerApp: { src: "assets/cizimler.js", integrity: "sha384-mt0ikh8D/Yuo0BC0WYDpGHMSt7hFl/KgK7G4lRfmNRFvogaRqkHnZIkYhOOWhqJO" },
    __tasiyicilarApp: { src: "assets/tasiyicilar.js", integrity: "sha384-QgCqx0oiM2uUWN4NfoO0RYMw9Vl1crt43kzKE4JzgG9To7+0U7bsNrmm3BAG5MVn" },
    __fususApp: { src: "assets/fusus.js", integrity: "sha384-hthm8scYI5UnQN80SpAsoWhagPfKoVMuY7vsV2GCqOjV0SjkfdGWvpIXREiFeuV5" },
    __miskatApp: { src: "assets/miskat.js", integrity: "sha384-meLF0z2MtyiwaYx/wmfbLo+x2gISV64aDp84bdAvZ81BgIdSuZZBbp/jbYORC2oU" },
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
            return loadScript(globalName)
              .then(function () {
                var real = window[globalName];
                if (real && typeof real[prop] === "function") {
                  return real[prop].apply(real, args);
                }
              })
              .catch(function (err) {
                console.error(
                  "view-loader: " + globalName + "." + prop + "() çalıştırılamadı --",
                  err
                );
              });
          };
        },
      }
    );
  });
})();
