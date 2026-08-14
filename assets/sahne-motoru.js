// Sahne Motoru — .claude/commands/sahne.md `motor` adımının kurucusu.
//
// AMAÇ. Sahneleri okurun etkileşimini bekleyen bulmacalardan, kendi kendini
// anlatan sakin animasyonlara dönüştürmek (bkz. TEMPO_GRAMERI.md). Tek bir
// motor, N sahne partisyonu okuyup çalıştırır -- yeni sahne eklemek kod
// yazmak değil, partisyon yazmak.
//
// KURALLAR (bu motorun tuttuğu SÖZLEŞMELER).
// 1. Başlatma: sahne görünür alana girdiğinde IntersectionObserver ile
//    kendiliğinden başlar; tıklama kapısı YOK.
// 2. Sekme arka plandayken durur (visibilitychange). Geri gelirse ve hâlâ
//    görünüyorsa kaldığı yerden devam.
// 3. Bitince DURULUR -- sert döngü yok. Sessiz bir "tekrar" düğmesi belirir;
//    kendiliğinden yeniden başlamaz.
// 4. İlk oynatma bitmeden HİÇBİR kontrol görünmez.
// 5. `prefers-reduced-motion` açıksa motor animasyonu ÇALIŞTIRMAZ; bitiş
//    hâlini doğrudan uygular ve tüm ölçü metinlerini statik bir dizi olarak
//    sunulmak üzere `metinGoster` çağrısına iletir.
// 6. Zamanlayıcı: setInterval değil requestAnimationFrame.
// 7. Motor DOM'da hiçbir CSS yazmaz; yalnız `applyOlcu(olcu)` ile sahnenin
//    kendi çizim mantığını çağırır ve isteğe bağlı `metinGoster`/`olcuGoster`
//    çağrılarıyla arayüzü besler.
//
// PARTISYON. Motorun beklediği şekil için tools/schemas/sahne-partisyon.
// schema.json'a bakın. Kısaca: {id, baslik, olcuLer:[{id, sure_sn,
// gecis_sure_sn?, hedef_hal?, metin?}]}. Metin dile göre okuma süresine
// dinamik uydurulur (aşağıdaki `olcuSuresi()` fonksiyonu).

(function () {
  "use strict";

  var I18n = window.DostI18n;

  // Okuma süresi tahmini: ortalama sessiz okuma ~250 karakter/dakika = ~4.2
  // karakter/saniye. Türkçe/Portekizce Türkçe İngilizce'den biraz uzun
  // sürer diye 3.5 CPS'i güvenli bir taban aldık. Ölçü süresi bu tabana
  // göre HESAPLANIR ama partisyon'un kendi min süresinin altına düşemez.
  var CPS = 3.5;
  var VARSAYILAN_MIN_OLCU_SN = 4;
  var VARSAYILAN_MAX_OLCU_SN = 8;
  var VARSAYILAN_GECIS_SN = 1.5;

  function metinSaniye(metin) {
    if (!metin || typeof metin !== "string") return 0;
    return metin.length / CPS;
  }

  function tt(dict) { return I18n && I18n.pick3 ? I18n.pick3(dict || {}) : (dict && (dict.tr || dict.en || "")); }

  // Ölçü süresi: partisyondaki `sure_sn` alt sınır; metin varsa aktif dildeki
  // okuma süresine yukarı yuvarlanır; max ile üst sınır. Böylece kısa
  // Türkçesi olan bir ölçü Portekizce sürümde otomatik uzar.
  function olcuSuresi(olcu, ust) {
    var alt = typeof olcu.sure_sn === "number" ? olcu.sure_sn : VARSAYILAN_MIN_OLCU_SN;
    var tavan = typeof ust === "number" ? ust : VARSAYILAN_MAX_OLCU_SN;
    var m = olcu.metin ? tt(olcu.metin) : "";
    var s = metinSaniye(m);
    return Math.min(Math.max(alt, s), tavan);
  }

  function reduceMotionAcik() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; }
  }

  // Motorun ana fabrikası. Bir sahne için yalnız BİR örnek üretin ve destroy'a
  // kadar aynı örneği kullanın.
  //
  // opts.applyOlcu(olcu) — bir ölçü değişince çağrılır (BOUNDARY). Sahne
  //   burada hedef hâli sabitler (ör. angle=0 hedef diye kaydeder).
  // opts.frame(fraz, olcu) — OPSİYONEL. Her rAF turunda çağrılır; fraz
  //   0..1 arası bu ölçünün ne kadarının geçtiğini söyler. Sahne burada
  //   tween yapar (ör. angle = eskiHedef + (yeniHedef - eskiHedef) * ease(fraz)).
  //   Motor kendi rAF döngüsünü zaten sürüyor; opsiyonel frame sadece bu
  //   döngünün her ticker'ında da sahneyi haberdar eder.
  function yarat(opts) {
    if (!opts || !opts.container || !opts.partisyon) {
      throw new Error("sahne-motoru.yarat: container ve partisyon zorunlu");
    }
    var container = opts.container;
    var partisyon = opts.partisyon;
    var applyOlcu = opts.applyOlcu || function () {};
    var frame = opts.frame || null;
    var olcuGoster = opts.olcuGoster || function () {};
    var metinGoster = opts.metinGoster || function () {};
    var biterEl = opts.biterEl || null;
    var tepki = opts.tepki || function () {};
    var olcuLer = Array.isArray(partisyon.olcuLer) ? partisyon.olcuLer : [];
    if (!olcuLer.length) throw new Error("sahne-motoru: partisyonun en az bir ölçüsü olmalı");

    var maxOlcuSn = typeof partisyon.max_olcu_sn === "number" ? partisyon.max_olcu_sn : VARSAYILAN_MAX_OLCU_SN;
    var reduce = reduceMotionAcik();

    // Durum makinesi
    // 'hazir'   -- ilk çalıştırılmadı
    // 'oynuyor' -- rAF döngüsü aktif, sahne akıyor
    // 'durakli' -- görünmüyor veya sekme kapalı; state korunur
    // 'bitti'   -- son ölçüye ulaşıldı, sahne durdu; tekrar düğmesi görünür
    var durum = "hazir";
    var aktifIdx = 0;
    var olcuBaslangicTs = 0; // performance.now()
    var kalanZamanMs = 0;    // duraklatıldığında sabitlenir
    var rafId = 0;
    var tekrarBtn = null;

    // Reduced motion: sahneyi hiç oynatma. Son ölçünün hedef hâlini uygula,
    // tüm ölçü metinlerini birleştirip metinGoster'a bir kez ver (statik
    // sunumdır -- TEMPO_GRAMERI.md "ikinci meşru biçim").
    if (reduce) {
      var sonOlcu = olcuLer[olcuLer.length - 1];
      applyOlcu(sonOlcu);
      var tumMetin = olcuLer.map(function (o) { return o.metin ? tt(o.metin) : ""; }).filter(Boolean).join("\n\n");
      metinGoster(tumMetin ? { tr: tumMetin, en: tumMetin, pt: tumMetin } : null);
      olcuGoster(olcuLer.length - 1, olcuLer.length);
      durum = "bitti";
      biterDugmesiniGoster();
      tepki({ tip: "bitti", nedeni: "reduced-motion" });
      return kamuAPI();
    }

    function baslat() {
      if (durum === "oynuyor") return;
      durum = "oynuyor";
      aktifIdx = 0;
      olcuUygula(aktifIdx);
      olcuBaslangicTs = performance.now();
      rafDongusu();
      tepki({ tip: "baslat", olcu: aktifIdx });
    }

    function durakla() {
      if (durum !== "oynuyor") return;
      cancelAnimationFrame(rafId);
      kalanZamanMs = Math.max(0, aktifOlcuSuresiMs() - (performance.now() - olcuBaslangicTs));
      durum = "durakli";
      tepki({ tip: "duraklat", olcu: aktifIdx });
    }

    function devam() {
      if (durum !== "durakli") return;
      durum = "oynuyor";
      olcuBaslangicTs = performance.now() - (aktifOlcuSuresiMs() - kalanZamanMs);
      kalanZamanMs = 0;
      rafDongusu();
      tepki({ tip: "devam", olcu: aktifIdx });
    }

    function tekrar() {
      cancelAnimationFrame(rafId);
      biterDugmesiniKaldir();
      aktifIdx = 0;
      olcuUygula(aktifIdx);
      olcuBaslangicTs = performance.now();
      durum = "oynuyor";
      rafDongusu();
      tepki({ tip: "tekrar" });
    }

    function gotoOlcu(idx) {
      if (idx < 0 || idx >= olcuLer.length) return;
      cancelAnimationFrame(rafId);
      biterDugmesiniKaldir();
      aktifIdx = idx;
      olcuUygula(aktifIdx);
      olcuBaslangicTs = performance.now();
      durum = "oynuyor";
      rafDongusu();
    }

    function destroy() {
      cancelAnimationFrame(rafId);
      biterDugmesiniKaldir();
      if (obs) obs.disconnect();
      document.removeEventListener("visibilitychange", visibilityDinleyicisi);
    }

    function aktifOlcuSuresiMs() {
      return olcuSuresi(olcuLer[aktifIdx], maxOlcuSn) * 1000;
    }

    function olcuUygula(idx) {
      var o = olcuLer[idx];
      applyOlcu(o);
      metinGoster(o.metin || null);
      olcuGoster(idx, olcuLer.length);
    }

    function rafDongusu() {
      if (durum !== "oynuyor") return;
      var simdi = performance.now();
      var gecen = simdi - olcuBaslangicTs;
      var suresi = aktifOlcuSuresiMs();
      if (gecen >= suresi) {
        // Sıradaki ölçüye geç
        if (aktifIdx + 1 >= olcuLer.length) {
          // Sahne bitti: durulur; tekrar düğmesi belirir
          if (frame) frame(1, olcuLer[aktifIdx]);
          durum = "bitti";
          biterDugmesiniGoster();
          tepki({ tip: "bitti" });
          return;
        }
        aktifIdx += 1;
        olcuBaslangicTs = simdi;
        olcuUygula(aktifIdx);
        if (frame) frame(0, olcuLer[aktifIdx]);
      } else if (frame) {
        frame(gecen / suresi, olcuLer[aktifIdx]);
      }
      rafId = requestAnimationFrame(rafDongusu);
    }

    function biterDugmesiniGoster() {
      if (!biterEl) return;
      if (tekrarBtn) return;
      tekrarBtn = document.createElement("button");
      tekrarBtn.type = "button";
      tekrarBtn.className = "sahne-motoru-tekrar";
      tekrarBtn.setAttribute("data-tr", "Tekrar");
      tekrarBtn.setAttribute("data-en", "Replay");
      tekrarBtn.setAttribute("data-pt", "Repetir");
      tekrarBtn.textContent = tt({ tr: "Tekrar", en: "Replay", pt: "Repetir" });
      tekrarBtn.addEventListener("click", tekrar);
      biterEl.appendChild(tekrarBtn);
    }
    function biterDugmesiniKaldir() {
      if (tekrarBtn && tekrarBtn.parentNode) tekrarBtn.parentNode.removeChild(tekrarBtn);
      tekrarBtn = null;
    }

    // Görünürlük: sahne ekrana girdiğinde başla, çıkınca durakla, geri
    // girince devam. Bitmişse tekrar için düğmeye tıklama beklenir.
    var obs = null;
    if (typeof IntersectionObserver !== "undefined") {
      obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) {
            if (durum === "oynuyor") durakla();
            return;
          }
          if (durum === "hazir") baslat();
          else if (durum === "durakli") devam();
        });
      }, { threshold: 0.35 });
      obs.observe(container);
    } else {
      // IntersectionObserver yoksa (çok eski tarayıcı): doğrudan başlat
      baslat();
    }

    // Sekme arka plana geçince durakla
    function visibilityDinleyicisi() {
      if (document.hidden) {
        if (durum === "oynuyor") durakla();
      } else {
        // Görünür alanda mıyız? IntersectionObserver bir sonraki tik'te
        // devam eder; burada elle devam etmiyoruz.
      }
    }
    document.addEventListener("visibilitychange", visibilityDinleyicisi);

    function kamuAPI() {
      return {
        start: baslat,
        pause: durakla,
        resume: devam,
        restart: tekrar,
        gotoOlcu: gotoOlcu,
        destroy: destroy,
        get durum() { return durum; },
        get aktifIdx() { return aktifIdx; },
        get olcuSayisi() { return olcuLer.length; },
      };
    }

    return kamuAPI();
  }

  window.__sahneMotoru = {
    yarat: yarat,
    olcuSuresi: olcuSuresi,   // dışa açık: test/debug için
    reduceMotionAcik: reduceMotionAcik,
  };
})();
