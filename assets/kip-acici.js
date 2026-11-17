(function () {
  "use strict";
  // Sahibe özel araçların (@share, @revise) açıcıları + TEMBEL YÜKLEYİCİSİ (K-020).
  // Görünür düğme/ipucu YOK: araçlar "yalnız sahibe özel" kalmalı. share-mode.js
  // (92 KB), edit-mode.js (21 KB) ve durus-kontrol.js (38 KB) artık her ziyaretçiye
  // ilk açılışta inmiyor; yalnız bir açıcı kullanıldığında (kod yazma, `?kip=`,
  // 5 dokunuş) ya da @revise kipi önceki oturumdan açık kaldıysa yükleniyor.
  // `?kip=` yönlendirici tarafından silineceği için betik çalışır çalışmaz okunur.
  var KIP = null;
  try { KIP = new URLSearchParams(location.search).get("kip"); } catch (e) {}

  // Benzetme bayrağı ANA sitenin parçasıdır, sahibe özel değildir: edit-mode.js
  // artık hemen yüklenmediği için DostAnalogy'nin ince hâli burada. Varsayılan
  // GÖRÜNÜR; yalnız localStorage "dost-analogy-visible" === "0" ise gizli
  // (edit-mode.js yüklenince kendi aynı tanımıyla bunun yerini alır).
  if (!window.DostAnalogy) {
    window.DostAnalogy = {
      visible: function () {
        try { return localStorage.getItem("dost-analogy-visible") !== "0"; } catch (e) { return true; }
      }
    };
  }

  // SRI hash'leri scripts/sri-guncelle.py tarafından otomatik tazelenir (elle girme).
  var ARACLAR = {
    share: { src: "assets/share-mode.js", integrity: "sha384-+gNfS3J2Uqf4zOq/ksnU7avLdTIrTvy3CFJsaHTuVm+8a7RfyVNUQ3DIEvboaJ0O" },
    revise: { src: "assets/edit-mode.js", integrity: "sha384-sq0ubjkAg2A96a0o/dYWLXgR4gPIb/rDaSHZbsM9FYIGtdO+h/3ilRd2oLLMDMv2" },
    durus: { src: "assets/durus-kontrol.js", integrity: "sha384-mOaPr1KcLaieLM7Dsc9IJR5DoayUHvlAQVVAb5qWHg3W/JIfbZX6DPdOHZ5zqO3J" }
  };
  var yukleniyor = {};
  function yukleBir(ad) {
    if (yukleniyor[ad]) return yukleniyor[ad];
    var cfg = ARACLAR[ad];
    yukleniyor[ad] = new Promise(function (resolve, reject) {
      var el = document.createElement("script");
      el.src = new URL(cfg.src, document.baseURI).href;
      if (cfg.integrity) el.integrity = cfg.integrity;
      el.onload = function () { resolve(); };
      el.onerror = function () { delete yukleniyor[ad]; reject(new Error("kip-acici: " + cfg.src + " yüklenemedi")); };
      document.body.appendChild(el);
    });
    return yukleniyor[ad];
  }
  // revise kipi duruş taramasını da ister (durus-kontrol.js body sınıfını izler),
  // o yüzden edit-mode.js önce, durus-kontrol.js sonra.
  function yukle(ad) {
    if (ad === "revise") return yukleBir("revise").then(function () { return yukleBir("durus"); });
    return yukleBir(ad);
  }

  var ACICI = {
    share: function () {
      return yukle("share").then(function () {
        if (window.__dostShare && !document.querySelector(".share-panel")) window.__dostShare.toggle();
      });
    },
    revise: function () {
      return yukle("revise").then(function () {
        if (window.__dostEdit && !window.__dostEdit.isOn()) window.__dostEdit.toggle();
      });
    }
  };
  function ac(ad) { if (ACICI[ad]) return ACICI[ad](); }
  window.__dostKipAc = { ac: ac };

  // 0) Klavye: gizli kelimeler (@share / @revise). Eskiden her aracın kendi
  // dinleyicisi vardı; araçlar tembel yüklendiği için tek tampon burada.
  // Korumalar eskisiyle aynı: AltGr (Ctrl+Alt) serbest (Türkçe klavyede "@"),
  // tek başına Ctrl/Alt/Meta kısayoldur, INPUT/TEXTAREA/contentEditable atlanır.
  var KODLAR = {
    "@share": function () { yukle("share").then(function () { if (window.__dostShare) window.__dostShare.toggle(); }); },
    "@revise": function () { yukle("revise").then(function () { if (window.__dostEdit) window.__dostEdit.toggle(); }); }
  };
  var tampon = "";
  window.addEventListener("keydown", function (e) {
    if (!e.key || e.key.length !== 1) return;
    if (e.metaKey) return;
    if ((e.ctrlKey || e.altKey) && !(e.ctrlKey && e.altKey)) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    var duzenlenebilir = !!(t && t.isContentEditable);
    tampon = (tampon + e.key.toLowerCase()).slice(-7);
    for (var k in KODLAR) {
      // Eskiden: @revise yalnız INPUT/TEXTAREA'da atlanırdı (kip içinde contenteditable
      // alandayken de kapatılabilsin); @share ise contenteditable'da da atlanırdı.
      if (tampon.slice(-k.length) === k && !(k === "@share" && duzenlenebilir)) { tampon = ""; KODLAR[k](); return; }
    }
  });

  // Önceki oturumdan açık kalmış @revise kipi: sayfa yenilenince geri açılabilsin
  // diye edit-mode.js (ve duruş taraması) bayrak "1" ise HEMEN yüklenir (bütün
  // defer betikleri çalıştıktan sonra, DOMContentLoaded'da).
  try {
    if (localStorage.getItem("dost-edit-mode-on") === "1") {
      var onceden = function () { yukle("revise").catch(function () {}); };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onceden);
      else onceden();
    }
  } catch (e) {}

  // 1) Adres parametresi: yalnız bilinen iki değer; başka değer sessizce yok sayılır.
  if (KIP && ACICI[KIP]) {
    var basla = function () { setTimeout(function () { ac(KIP); }, 400); };
    if (document.readyState === "complete") basla(); else window.addEventListener("load", basla);
  }

  // 2) Hakkında sayfasında altbilgiye 5 ardışık dokunuş (her dokunuş arası <= 2 sn).
  var sayac = 0, son = 0, SURE = 2000, ESIK = 5, secici = null, seciciZaman = null;
  function seciciKapat() {
    if (seciciZaman) { clearTimeout(seciciZaman); seciciZaman = null; }
    if (secici) { secici.remove(); secici = null; }
  }
  function seciciAc() {
    seciciKapat();
    var I = window.DostI18n, tt = function (d) { return I ? I.pick3(d) : d.tr; };
    secici = document.createElement("div");
    secici.className = "kip-secici"; secici.setAttribute("role", "group");
    [["share", { tr: "Paylaşım sahnesi", en: "Share stage", pt: "Palco de partilha" }],
     ["revise", { tr: "Düzenleme kipi", en: "Edit mode", pt: "Modo de edição" }]].forEach(function (k) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = tt(k[1]);
      b.addEventListener("click", function () { seciciKapat(); ac(k[0]); });
      secici.appendChild(b);
    });
    document.body.appendChild(secici);
    seciciZaman = setTimeout(seciciKapat, 8000);
  }
  document.addEventListener("pointerup", function (e) {
    var hk = document.getElementById("hakkinda-wrap");
    var f = e.target.closest && e.target.closest(".app-footer");
    if (secici && !e.target.closest(".kip-secici")) seciciKapat();
    if (!f || !hk || hk.hidden || e.target.closest("a")) { sayac = 0; return; }   // bağlantıya (e-posta) dokunma sayılmaz
    var t = Date.now(); sayac = (t - son < SURE) ? sayac + 1 : 1; son = t;
    if (sayac >= ESIK) { sayac = 0; seciciAc(); }
  }, { passive: true });
})();
