/* Dost Arabî — mekanik tahkik taraması (tarayıcıda).
 *
 * docs/tahkik-protokolu.md'nin MEKANİK merceklerini @revise kipinde,
 * tarayıcıda çalıştırır. Amaç: tahkiki Murat'ın kendi başına da
 * yürütebilmesi -- `/tahkik-tarama` komutunun etkileşimli ikizi.
 *
 * HANGİ MERCEKLER, NEDEN YALNIZ BUNLAR
 *
 *   M5 Yoğunluk           — ölçülebilir (kelime, cümle, okuma süresi).
 *   M7 Üç dil kayması     — ölçülebilir (boş/kısa dil, sayı-tarih farkı).
 *
 * Yargı mercekleri (M1 kaynak taşması, M2 kavram/davranış, M3 gerilimin
 * düzleşmesi, M4 erken kapanma, M8 sessizlik testi) BİLEREK YOK.
 * Protokolün kendi kuralı: "yargı, tek tek ve dikkatle yapılır. Toplu
 * taramada yapılan yargı, yargı değil kalıp eşleştirmedir." Onlar sayfa
 * başına `/tahkik` ile yapılır.
 *
 * M6 (tanımsız terim) de yok: "sözlükte olmayan teknik terimi" bulmak
 * serbest metinde hangi kelimenin teknik olduğunu bilmeyi gerektiriyor;
 * tarayıcıda dürüst bir cevabı yok. Uydurma bir yaklaşımla doldurmaktansa
 * eksik bırakıldı.
 *
 * M1'in "kaynak kartı var mı" kısmı da çalışamaz: docs/kaynaklar/ siteye
 * senkronlanmıyor (derleme-zamanı belge). Onu scripts/validate_sources.py
 * yapıyor.
 *
 * Ne YAPMAZ: hiçbir metni değiştirmez, hiçbir şeyi sunucuya göndermez,
 * sıradan okuyucuya görünmez (yalnız @revise kipinde). Bulduğu şey bir
 * hüküm değil, bir bakma davetidir.
 */
(function () {
  "use strict";

  var SURUM = "t1";

  // durus-kontrol.js ile AYNI dosya listesi. Bilerek kopyalandı, oradan
  // ithal edilmedi: iki tarama birbirinden bağımsız yaşamalı, birinin
  // listesi değişince öteki sessizce değişmemeli.
  var VERI = [
    ["data/ibn-arabi/ontology.json", "Ontoloji"],
    ["data/ibn-arabi/esma.json", "Esmâ"],
    ["data/ibn-arabi/hal.json", "Hâller"],
    ["data/ibn-arabi/felsefi-terimler.json", "Terimler"],
    ["data/ibn-arabi/sirlar.json", "Sırlar"],
    ["data/ibn-arabi/sorular.json", "Sorular"],
    ["data/ibn-arabi/menziller.json", "Menziller"],
    ["data/ibn-arabi/tasiyicilar.json", "Taşıyanlar"],
    ["data/ibn-arabi/fusus-atlas.json", "Füsûs"],
    ["data/ibn-arabi/bilmiyoruz.json", "Bilmiyoruz"],
    ["data/ibn-arabi/kuantum.json", "Kuantum"],
    ["data/ibn-arabi/elestiri-arkeolojisi.json", "Eleştiri Arkeolojisi"],
    ["data/ibn-arabi/acik-sorular.json", "Açık Sorular"]
  ];

  // M5 eşikleri -- protokolün kendi önerdiği sayılar. Kural değil,
  // dikkat çağrısı: yoğun bir metin yanlış değildir, yoğun olduğunu
  // BİLMEDEN yayınlanmış olan risklidir.
  // Eşikler TAHMİN DEĞİL, sitenin kendi metninden ÖLÇÜLDÜ (2026-08-05,
  // 13 veri dosyası: 3.893 cümle, 1.455 metin alanı):
  //   cümle uzunluğu  — medyan 19, %95: 43, %99: 62, en uzun 123 kelime
  //   alan uzunluğu   — medyan 49, %95: 108, %99: 150, en uzun 343 kelime
  // İlk denemede 45/900 yazmıştım; ölçünce ikisi de yanlış çıktı:
  //   45 kelime %96'ıncı yüzdelik demekti -> 143 bulgu, yani okunmayacak
  //     bir liste. Bir tarama her şeyi işaretliyorsa hiçbir şeyi
  //     işaretlemiyor demektir.
  //   900 kelimelik alan HİÇ yoktu -> o mercek sessizce ölü koddu.
  // Şimdi ikisi de gerçek aykırıları hedefliyor (~%0,5 ve ~%1).
  var DK_KELIME = 180;        // dakikada okunan kelime (Türkçe)
  var UZUN_CUMLE = 70;        // %99,5 -- 18 cümle
  var COK_UZUN_METIN = 160;   // %99   -- 14 alan

  // M7: bir dil ötekinin bu oranından kısaysa "belirgin biçimde kısa".
  // 0.55 ampirik: TR->EN çeviri doğal olarak %10-25 kısalabiliyor, ama
  // yarıdan aza düşmesi cümle düşmüş olabileceğini gösterir.
  var KISA_ORAN = 0.55;
  // Çok kısa alanlarda (etiket, başlık) oran gürültü üretir.
  var EN_AZ_UZUNLUK = 120;

  var DISMISS_KEY = "dost-tahkik-susturulan";

  function json(yol) {
    return window.DostGraphUtils
      ? window.DostGraphUtils.fetchJson(yol)
      : fetch(yol).then(function (r) { return r.json(); });
  }

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h >>> 0);
  }

  function susturulan() {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function sustur(anahtar) {
    var s = susturulan(); s[anahtar] = 1;
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function kelimeSay(s) {
    var t = String(s || "").trim();
    return t ? t.split(/\s+/).length : 0;
  }

  // Sayı ve tarihler üç dilde aynı olmalı: künye, cilt, sayfa, yıl.
  // Yalnız RAKAM dizileri karşılaştırılıyor -- "üç" / "three" gibi
  // yazıyla yazılmış sayılar bilerek kapsam dışı (dilden dile değişir).
  function sayilar(s) {
    var m = String(s || "").match(/\d+/g) || [];
    return m.slice().sort().join(",");
  }

  // --- mercekler --------------------------------------------------------

  function m7(triple, yol, etiket, bulgular) {
    var tr = String(triple.tr || ""), en = String(triple.en || ""), pt = String(triple.pt || "");
    var enUzun = Math.max(tr.length, en.length, pt.length);
    if (enUzun < EN_AZ_UZUNLUK) return;

    var eksik = [];
    if (!tr.trim()) eksik.push("tr");
    if (!en.trim()) eksik.push("en");
    if (!pt.trim()) eksik.push("pt");
    if (eksik.length) {
      ekle(bulgular, "M7", "dil-bos", etiket, yol,
           eksik.join("+") + " boş", tr || en || pt);
      return;
    }

    var kisa = [];
    if (tr.length < enUzun * KISA_ORAN) kisa.push("tr");
    if (en.length < enUzun * KISA_ORAN) kisa.push("en");
    if (pt.length < enUzun * KISA_ORAN) kisa.push("pt");
    if (kisa.length) {
      ekle(bulgular, "M7", "dil-kisa", etiket, yol,
           kisa.join("+") + " belirgin kısa (" + tr.length + "/" + en.length + "/" + pt.length + " karakter)",
           tr);
    }

    var str = sayilar(tr), sen = sayilar(en), spt = sayilar(pt);
    if (str !== sen || str !== spt) {
      ekle(bulgular, "M7", "sayi-farki", etiket, yol,
           "sayılar üç dilde aynı değil (tr:" + (str || "—") + " en:" + (sen || "—") + " pt:" + (spt || "—") + ")",
           tr);
    }
  }

  function m5(triple, yol, etiket, bulgular) {
    var tr = String(triple.tr || "");
    if (!tr) return;
    var kelime = kelimeSay(tr);
    if (kelime > COK_UZUN_METIN) {
      ekle(bulgular, "M5", "uzun-metin", etiket, yol,
           kelime + " kelime (~" + Math.max(1, Math.round(kelime / DK_KELIME)) + " dk okuma)", tr);
    }
    // Uzun cümle: tek bir cümlede eşiği aşan kelime sayısı.
    // Kapanış tırnağı/parantezi noktadan SONRA gelir; metinlerimiz alıntı
    // yoğun olduğu için (…takyîddir." Gerekçe…) sade bir /(?<=[.!?…])\s+/
    // bölücü bu sınırları hiç görmüyor, beş cümleyi iki sayıp uydurma
    // "92 kelimelik cümle" bulguları üretiyordu. Ölçüm: yeni bölücü 4332
    // sınır daha buluyor, 70+ kelimelik cümle 2736'dan 2255'e iniyor.
    var cumleler = tr.split(/(?<=[.!?…]["”’»')\]]?)\s+/);
    for (var i = 0; i < cumleler.length; i++) {
      var n = kelimeSay(cumleler[i]);
      if (n > UZUN_CUMLE) {
        ekle(bulgular, "M5", "uzun-cumle", etiket, yol,
             n + " kelimelik tek cümle", cumleler[i]);
        break;   // alan başına bir kez yeter; amaç sayım değil dikkat
      }
    }
  }

  function ekle(bulgular, mercek, tur, etiket, yol, aciklama, ornek) {
    var kisa = String(ornek || "").slice(0, 220);
    bulgular.push({
      mercek: mercek, tur: tur, etiket: etiket, yol: yol,
      aciklama: aciklama, ornek: kisa,
      anahtar: mercek + "|" + tur + "|" + hash(etiket + "|" + kisa)
    });
  }

  // --- gezinme ----------------------------------------------------------

  // Bir nesne {tr,en,pt} üçlüsü mü?
  function ucluMu(o) {
    return o && typeof o === "object" && !Array.isArray(o)
      && (typeof o.tr === "string" || typeof o.en === "string" || typeof o.pt === "string");
  }

  // Künye/etiket alanları taranmaz -- metin değil, veri.
  var MUAF = { analogy: 1, source: 1, sources: 1, kaynak: 1, kaynaklar: 1,
               cite: 1, url: 1, id: 1, view: 1, pageRange: 1, arabic: 1, ad: 1 };

  function gez(o, yol, etiket, bulgular, derinlik) {
    if (!o || derinlik > 12) return;
    if (Array.isArray(o)) {
      for (var i = 0; i < o.length; i++) gez(o[i], yol, etiket, bulgular, derinlik + 1);
      return;
    }
    if (typeof o !== "object") return;
    if (ucluMu(o)) { m7(o, yol, etiket, bulgular); m5(o, yol, etiket, bulgular); return; }
    for (var k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      if (MUAF[k]) continue;
      gez(o[k], yol, etiket, bulgular, derinlik + 1);
    }
  }

  function siteTara() {
    var bulgular = [];
    var isler = VERI.map(function (v) {
      return json(v[0]).then(function (d) { gez(d, v[0], v[1], bulgular, 0); })
        .catch(function () { /* dosya yoksa sessizce atla */ });
    });
    return Promise.all(isler).then(function () {
      var gorulen = {}, sus = susturulan();
      return bulgular.filter(function (b) {
        if (sus[b.anahtar]) return false;
        if (gorulen[b.anahtar]) return false;
        gorulen[b.anahtar] = 1;
        return true;
      });
    });
  }

  // --- panel ------------------------------------------------------------

  var panel = null;
  var sonBulgular = null;

  function kapat() { if (panel) { panel.remove(); panel = null; } }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var MERCEK_ADI = {
    "M5": "M5 — Yoğunluk",
    "M7": "M7 — Üç dil kayması"
  };
  var TUR_ADI = {
    "dil-bos": "bir dil boş",
    "dil-kisa": "bir dil belirgin kısa",
    "sayi-farki": "sayılar üç dilde farklı",
    "uzun-metin": "çok uzun metin",
    "uzun-cumle": "çok uzun cümle"
  };

  function ciz() {
    var govde = panel.querySelector(".durus-site__body");
    var bs = sonBulgular;
    if (!bs.length) {
      govde.innerHTML = '<p class="durus-site__yukleniyor">Mekanik merceklerde bulgu yok.</p>';
      return;
    }
    var gruplar = {};
    bs.forEach(function (b) { (gruplar[b.mercek] = gruplar[b.mercek] || []).push(b); });

    var html = '<p class="durus-site__ozet">' + bs.length + " bulgu — "
      + Object.keys(gruplar).sort().map(function (m) {
          return esc(MERCEK_ADI[m] || m) + ": " + gruplar[m].length;
        }).join(" · ")
      + '</p>'
      + '<p class="durus-site__not">Bunlar ölçüm, hüküm değil. Yargı mercekleri (M1-M4, M8) burada '
      + 'YOK: protokolün kendi kuralı, yargının tek tek ve dikkatle yapılmasını istiyor — '
      + 'onlar sayfa başına <code>/tahkik</code> ile.</p>';

    Object.keys(gruplar).sort().forEach(function (m) {
      html += '<p class="detail-eyebrow detail-eyebrow--section">' + esc(MERCEK_ADI[m] || m) + "</p>";
      gruplar[m].forEach(function (b) {
        html += '<div class="durus-site__bulgu">'
          + '<p class="durus-site__ad">' + esc(b.etiket) + " — " + esc(TUR_ADI[b.tur] || b.tur) + "</p>"
          + '<p class="durus-site__neden">' + esc(b.aciklama) + "</p>"
          + (b.ornek ? '<p class="durus-site__ornek">' + esc(b.ornek) + "…</p>" : "")
          + '<button type="button" class="durus-site__sustur" data-sustur="' + esc(b.anahtar) + '">Bu doğru — kaldır</button>'
          + "</div>";
      });
    });
    govde.innerHTML = html;
    govde.querySelectorAll("[data-sustur]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        sustur(btn.getAttribute("data-sustur"));
        sonBulgular = sonBulgular.filter(function (x) { return x.anahtar !== btn.getAttribute("data-sustur"); });
        ciz();
      });
    });
  }

  function ac() {
    kapat();
    panel = document.createElement("div");
    panel.className = "durus-site";
    panel.innerHTML =
      '<div class="durus-site__backdrop"></div>'
      + '<div class="durus-site__card" role="dialog" aria-modal="true" aria-label="Mekanik tahkik taraması">'
      + '<div class="durus-site__head"><p class="durus-site__title">Mekanik tahkik <span>' + SURUM + '</span></p>'
      + '<button type="button" class="durus-site__close" aria-label="Kapat">×</button></div>'
      + '<div class="durus-site__body"><p class="durus-site__yukleniyor">Veri dosyaları taranıyor…</p></div>'
      + "</div>";
    document.body.appendChild(panel);
    panel.querySelector(".durus-site__backdrop").addEventListener("click", kapat);
    panel.querySelector(".durus-site__close").addEventListener("click", kapat);

    (sonBulgular ? Promise.resolve(sonBulgular) : siteTara()).then(function (bs) {
      sonBulgular = bs;
      if (panel) ciz();
    });
  }

  window.__dostTahkik = {
    surum: SURUM,
    ac: ac,
    siteTara: siteTara,
    // Testler için: tek bir üçlüyü merceklerden geçir.
    ucluTara: function (triple) {
      var bs = [];
      m7(triple, "(test)", "(test)", bs);
      m5(triple, "(test)", "(test)", bs);
      return bs;
    }
  };
})();
