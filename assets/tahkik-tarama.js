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

  var SURUM = "t5";

  // Dosya listesi artık burada DEĞİL: data/ibn-arabi/tarama-kapsami.json.
  //
  // Önceki hâlinde liste burada duruyordu ve başındaki yorum onun
  // durus-kontrol.js'teki listeyle "AYNI" olduğunu, bilerek kopyalandığını
  // söylüyordu. Söylediği doğru değildi. Altı dosya ayrışmıştı ve daha
  // önemlisi: bu tarama 223 Fütûhât kısım dosyasına hiç bakmıyordu, oysa
  // sitenin en uzun düzyazısı orada -- yani M5 (yoğunluk) tam da en çok
  // işe yarayacağı yeri atlıyordu. "Site taraması" düğmesi sitenin üçte
  // birini tarayıp bütününü taramış gibi görünüyordu.
  //
  // Kopyayı ayrı tutma gerekçesi ("iki tarama bağımsız yaşasın") kâğıt
  // üzerinde makuldü; pratikte ürettiği şey bağımsızlık değil, kimsenin
  // fark etmediği bir kayma oldu. Liste tek dosyaya taşındı,
  // scripts/tarama-kapsami-kontrol.py da yeni bir veri dosyası ne
  // kapsamda ne gerekçeli dışarıda ise derlemeyi durduruyor.
  var KAPSAM = "data/ibn-arabi/tarama-kapsami.json";

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

  // Metinlerin %19,5'i HTML etiketi taşıyor (<em> alıntı, <strong> sayı).
  // Etiketleri ölçmeden önce atmak şart, iki ayrı nedenle:
  //   1) <strong>478</strong> tek bir "kelime" sayılıyordu -- küçük bir
  //      şişme (172 -> 171 bulgu, önemsiz).
  //   2) ASIL MESELE: cümle sonu `iş."</em> <strong>482</strong>` gibi
  //      yerlerde noktadan sonra boşluk değil `<` geliyor, bölücü sınırı
  //      göremiyor ve arka arkaya beş cümleyi "111 kelimelik tek cümle"
  //      diye bildiriyordu. Ölçüldü: 70+ kelimelik cümle bulgusu 54'ten
  //      11'e iniyor. Yani bu türün beşte dördü uydurmaydı.
  // Aynı hatanın kapanış tırnağı yüzünden olan biçimini daha önce bölücüyü
  // düzelterek kapatmıştık; bu, o hatanın etiketlerden gelen ikizi.
  var ETIKET = /<[^>]*>/g;
  function duzMetin(s) {
    return String(s || "").replace(ETIKET, " ").replace(/\s+/g, " ").trim();
  }

  function kelimeSay(s) {
    var t = String(s || "").trim();
    return t ? t.split(/\s+/).length : 0;
  }

  // Sayı ve tarihler üç dilde aynı olmalı: künye, cilt, sayfa, yıl.
  //
  // ESKİ KURAL: üç dilin RAKAM dizileri birebir karşılaştırılırdı; yazıyla
  // yazılmış sayılar "dilden dile değişir" diye kapsam dışıydı. Ama kapsam
  // dışı bırakmak yetmiyordu: TR "43. kısım" yazıp EN "Part Forty-Three"
  // yazınca diziler tutmuyor ve bulgu çıkıyordu. Yani kural, muaf tuttuğunu
  // sandığı şeyi arka kapıdan geri sokuyordu. Ölçüldü (2026-08-30):
  // 144 bulgunun 108'i bu türdendi -- yani dörtte üçü.
  //
  // DAR KURAL, iki parça:
  //   1) ÇOĞUNLUK. Bir sayı ancak İKİ dilde varsa ve ÜÇÜNCÜSÜNDE yoksa
  //      bulgu. Tek bir dilde geçen sayı (TR'nin ISO tarihindeki ay,
  //      "1/2, 1/3" kesirleri, yalnız EN'in verdiği cilt numarası) bir
  //      kayma değil, bir biçim tercihi -- ve üç dilden ikisinin
  //      anlaştığı yerde üçüncünün susması, gerçekten düşmüş bir sayıya
  //      işaret ediyor.
  //   2) YAZIYLA KARŞILANAN MUAF. Eksik görünen sayı, o dilde sözcük
  //      olarak geçiyorsa ("on iki" / "twelve" / "doze") fark sayılmaz.
  //      Sözlük TERSİNDEN çalışıyor: yalnız karşı tarafta RAKAM olarak
  //      gördüğümüz sayının sözcüğünü arıyoruz. Bu önemli, çünkü "bir /
  //      um / one" aynı zamanda belirsiz artikel; metni bu sözcükler için
  //      taramak yüzlerce yanlış eşleşme üretirdi.
  //   3) ROMEN VE YÜZLÜKLER (t5). Yukarıdaki sözlük 1-99 + 100/1000 ile
  //      sınırlıyken iki sınıf daha kaçıyordu ve ikisi de YANLIŞ BULGU
  //      üretiyordu: PT yüzyılı romen yazıyor ("século XIX", "IX/XV",
  //      "XVII") ve bileşik yüzlükleri sözcükle yazıyor ("cento e
  //      cinquenta e cinco" = 155). t4 bu dördünü "PT bu sayıyı DÜŞÜRMÜŞ"
  //      diye raporlamıştı; düşürmemişti, sözlük yetmiyordu. Romen
  //      araması TR'ye de yarıyor ("Kısım XXV").
  //
  //   4) BİNLİK AYRACI ve TÜRKÇE EK (t5). EN "1,646" / PT "1.646" yazınca
  //      ayraç sayıyı bölüyor; "2,008" bölününce "008" = 0 çıkıyor ve
  //      "0 TR'de yok" gibi bir bulgu üretiyordu. Ayrıca TR "iki yüz elli
  //      ÜÇÜ aşkın" yazıyor, katı kelime sonu "üçü"yü "üç" saymıyordu.
  //      Ek toleransı yalnız dört harften uzun sayı ibarelerine veriliyor;
  //      kısa olanlara verilseydi "üçgen" de eşleşir, gerçek bir bulguyu
  //      yanlışlıkla susturabilirdi.
  //
  // Sonuç: 144 -> 9 bulgu, hepsi tr. İki sınıf: TR'nin sûre numarasını
  // yazmadığı künye farkı (5) ve EN'in TR'de bulunmayan bir kısım/cilt
  // numarası vermesi (4) -- ikincisi gerçek bir asimetri.
  // t4'ün "PT dört sayı düşürmüş" bulgusu GERİ ÇEKİLDİ: dördü de
  // merceğin kendi eksiğiydi (üçü romen yüzyıl, biri yazıyla 155).
  var SB = { tr: ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"],
             en: ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
             pt: ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"] };
  var SO = { tr: ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"],
             en: ["", "ten", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"],
             pt: ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"] };
  var ONLAR = {
    en: { 11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen",
          16: "sixteen", 17: "seventeen", 18: "eighteen", 19: "nineteen" },
    pt: { 11: "onze", 12: "doze", 13: "treze", 14: "catorze", 15: "quinze",
          16: "dezasseis", 17: "dezassete", 18: "dezoito", 19: "dezanove" }
  };
  // Sıra sayıları: metinlerimiz "Kırk Dördüncü Kısım" / "Part Forty-Four"
  // biçimini bolca kullanıyor, asıl sayı kadar sık.
  var SIRA = {
    tr: { "bir": "birinci", "iki": "ikinci", "üç": "üçüncü", "dört": "dördüncü",
          "beş": "beşinci", "altı": "altıncı", "yedi": "yedinci", "sekiz": "sekizinci",
          "dokuz": "dokuzuncu", "on": "onuncu", "yirmi": "yirminci", "otuz": "otuzuncu",
          "kırk": "kırkıncı", "elli": "ellinci", "altmış": "altmışıncı",
          "yetmiş": "yetmişinci", "seksen": "sekseninci", "doksan": "doksanıncı" },
    en: { "one": "first", "two": "second", "three": "third", "four": "fourth",
          "five": "fifth", "six": "sixth", "seven": "seventh", "eight": "eighth",
          "nine": "ninth", "ten": "tenth", "eleven": "eleventh", "twelve": "twelfth",
          "twenty": "twentieth", "thirty": "thirtieth", "forty": "fortieth",
          "fifty": "fiftieth", "sixty": "sixtieth", "seventy": "seventieth",
          "eighty": "eightieth", "ninety": "ninetieth" },
    pt: {}
  };

  // Yüzlükler. 2026-08-30'da ölçüldü: sözlük 1-99 + 100/1000 ile sınırlıyken
  // PT'nin "cento e cinquenta e cinco" (155) yazımı bulunamıyor ve "PT bu
  // sayıyı DÜŞÜRMÜŞ" diye raporlanıyordu. Düşürmemişti; sözlük yetmiyordu.
  var YUZ = {
    tr: ["", "yüz", "iki yüz", "üç yüz", "dört yüz", "beş yüz",
         "altı yüz", "yedi yüz", "sekiz yüz", "dokuz yüz"],
    en: ["", "one hundred", "two hundred", "three hundred", "four hundred",
         "five hundred", "six hundred", "seven hundred", "eight hundred", "nine hundred"],
    pt: ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
         "seiscentos", "setecentos", "oitocentos", "novecentos"]
  };

  // Romen rakamı. PT yüzyılı "século XIX" diye yazıyor, TR ise kısımları
  // "Kısım XXV" diye -- ikisi de rakamla yazılmış karşılığı olan sayılar.
  // Aynı ölçümde üç bulgunun üçü de bu yüzden uydurmaydı.
  // DİKKAT: tek harfli romen rakamları (I, V, X, L, C, D, M) sıradan
  // metinde her yerde geçer ("I" İngilizce zamir); yalnız İKİ VE DAHA UZUN
  // olanlar aranıyor. Bu, gerçek kullanımların hepsini kapsıyor (IX, XV,
  // XVII, XIX, XXV) ve yanlış susturma riskini kapatıyor.
  var ROMEN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"],
               [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"],
               [5, "V"], [4, "IV"], [1, "I"]];
  function romen(n) {
    if (n < 1 || n > 3999) return "";
    var s = "";
    for (var i = 0; i < ROMEN.length; i++) {
      while (n >= ROMEN[i][0]) { s += ROMEN[i][1]; n -= ROMEN[i][0]; }
    }
    return s.length >= 2 ? s : "";
  }

  function sayiSozcukleri(n, dil) {
    if (n === 1000) return { tr: ["bin"], en: ["thousand"], pt: ["mil"] }[dil];
    if (n === 100) return { tr: ["yüz"], en: ["hundred"], pt: ["cem", "cento"] }[dil];
    if (n > 100 && n < 1000) {
      var y = Math.floor(n / 100), kalan = n % 100;
      var bas = YUZ[dil][y];
      if (!bas) return [];
      if (kalan === 0) return [bas];
      var ek = sayiSozcukleri(kalan, dil), cik = [];
      for (var j = 0; j < ek.length; j++) {
        if (dil === "pt") cik.push(bas + " e " + ek[j]);
        else if (dil === "en") cik.push(bas + " " + ek[j], bas + " and " + ek[j]);
        else cik.push(bas + " " + ek[j]);
      }
      return cik;
    }
    if (n < 1 || n > 99) return [];
    var out = [], b = SB[dil], o = SO[dil], s = SIRA[dil] || {};
    function ekle(x) { if (x) { out.push(x); if (s[x]) out.push(s[x]); } }
    if (n < 10) { ekle(b[n]); return out; }
    if (n < 20 && ONLAR[dil]) { ekle(ONLAR[dil][n] || o[1]); if (n === 10) ekle(o[1]); return out; }
    var on = Math.floor(n / 10), bir = n % 10;
    if (bir === 0) { ekle(o[on]); return out; }
    if (dil === "tr") { out.push(o[on] + " " + b[bir], o[on] + b[bir], o[on] + " " + (s[b[bir]] || "")); }
    else if (dil === "en") { out.push(o[on] + "-" + b[bir], o[on] + " " + b[bir], o[on] + "-" + (s[b[bir]] || "")); }
    else { out.push(o[on] + " e " + b[bir]); }
    return out.filter(Boolean);
  }

  // Unicode farkında kelime sınırı -- ASCII \b Türkçe harfte sessizce
  // çalışmaz; bu depoda aynı hata daha önce üç kez yapıldı.
  function yaziylaVar(n, metin, dil) {
    var kelimeler = sayiSozcukleri(n, dil).slice();
    var r = romen(n);
    if (r) kelimeler.push(r);
    for (var i = 0; i < kelimeler.length; i++) {
      var k = kelimeler[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Türkçe EK toleransı. Metin "iki yüz elli üçü aşkın" yazıyor; katı
      // kelime sonu "üçü"yü "üç" saymıyor ve sayı yazıyla verilmiş olduğu
      // hâlde "TR'de yok" deniyordu. Yalnız DÖRT harften uzun sayı
      // ibarelerine veriliyor: "üç" gibi kısa olanlara verilseydi "üçgen"
      // de eşleşir, gerçek bir bulgu yanlışlıkla susturulurdu.
      var son = kelimeler[i].length > 4 ? "[\\p{Ll}]{0,3}" : "";
      try {
        if (new RegExp("(?<![\\p{L}\\p{N}])" + k + son + "(?![\\p{L}\\p{N}])", "iu").test(metin)) return true;
      } catch (e) {
        if (metin.toLowerCase().indexOf(kelimeler[i].toLowerCase()) >= 0) return true;
      }
    }
    return false;
  }

  // Binlik ayracı (t5). TR "1646" yazarken EN "1,646", PT "1.646" yazıyor;
  // ayraç sayıyı ikiye bölüyor ve iki uydurma bulgu üretiyordu: "646
  // TR'de yok" ve -- daha da tuhafı -- "2,008" ayrılınca "008" = 0 olduğu
  // için "0 TR'de yok". Ölçüldü: 14 bulgunun 3'ü bu tek hatadan geliyordu.
  // Yalnız TAM ÜÇ basamak birleştiriliyor; "3.5" ya da "1/2" bozulmaz.
  var BINLIK = /(\d)[.,](\d{3})(?!\d)/g;
  function rakamKumesi(s) {
    var t = String(s || "");
    for (var k = 0; k < 3; k++) t = t.replace(BINLIK, "$1$2");
    var m = t.match(/\d+/g) || [];
    var out = {};
    for (var i = 0; i < m.length; i++) out[parseInt(m[i], 10)] = 1;
    return out;
  }

  // --- mercekler --------------------------------------------------------

  function m7(triple, yol, etiket, bulgular) {
    // Etiketsiz ölçüyoruz: bir dilde <em>/<strong> kullanılıp ötekinde
    // kullanılmaması karakter uzunluğunu kaydırıyor ve olmayan bir
    // "belirgin kısa" üretebiliyor. Okuyucunun gördüğü metni ölçmek doğrusu.
    var tr = duzMetin(triple.tr), en = duzMetin(triple.en), pt = duzMetin(triple.pt);
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

    var metin = { tr: tr, en: en, pt: pt };
    var rakam = { tr: rakamKumesi(tr), en: rakamKumesi(en), pt: rakamKumesi(pt) };
    var hepsi = {}, DILLER = ["tr", "en", "pt"];
    DILLER.forEach(function (d) { for (var n in rakam[d]) hepsi[n] = 1; });

    var eksik = {};
    Object.keys(hepsi).forEach(function (ns) {
      var n = parseInt(ns, 10);
      var var_ = DILLER.filter(function (d) { return rakam[d][n]; });
      if (var_.length !== 2) return;                 // çoğunluk kuralı
      var yok = DILLER.filter(function (d) { return !rakam[d][n]; })[0];
      if (yaziylaVar(n, metin[yok], yok)) return;    // yazıyla karşılanmış
      (eksik[yok] = eksik[yok] || []).push(n);
    });

    Object.keys(eksik).forEach(function (d) {
      var ns = eksik[d].sort(function (a, b) { return a - b; });
      ekle(bulgular, "M7", "sayi-farki", etiket, yol,
           d + " dilinde eksik: " + ns.join(", ") + " (öteki iki dilde var, "
           + d + "'de ne rakamla ne yazıyla geçiyor)", metin[d] || tr);
    });
  }

  function m5(triple, yol, etiket, bulgular) {
    var tr = duzMetin(triple.tr);
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
  //
  // `analogy` BU LİSTEDE DEĞİL, ve bu bilinçli. durus-kontrol.js'in MUAF
  // listesinde var, ama oradaki gerekçe başka: CLAUDE.md günlük hayat
  // analojilerini ("yıllarca aynı yoldan geçen biri gibi") süre/emek
  // ŞİŞİRME kurallarından muaf tutuyor. O muafiyet buraya kopyalanmıştı,
  // üstelik "metin değil, veri" gerekçesiyle -- oysa analogy düpedüz
  // metin, hem de okuyucunun gördüğü metin. M5 (uzunluk/yoğunluk) ve M7
  // (üç dil kayması) için o muafiyetin hiçbir dayanağı yok: bir analojide
  // de PT eksik kalabilir, cümle 70 kelimeyi aşabilir, sayı tutmayabilir.
  // Ölçüldü (2026-08-30): muafiyet 202 üç dilli alanı, 190.668 karakteri
  // taramanın dışında tutuyordu -- listenin gizlediği en büyük blok.
  // Kaldırılınca çıkan yeni bulgu: SIFIR. Yani saklanan metin bugün
  // temizdi; muafiyet yine de kalkıyor, çünkü bugün temiz olması yarın
  // da taranmaması için bir sebep değil.
  var MUAF = { source: 1, sources: 1, kaynak: 1, kaynaklar: 1,
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

  function dosyaTara(yol, etiket, bulgular) {
    return json(yol).then(function (d) { gez(d, yol, etiket, bulgular, 0); })
      .catch(function () { /* dosya yoksa sessizce atla */ });
  }

  function siteTara() {
    var bulgular = [];
    return json(KAPSAM).then(function (kapsam) {
      var isler = kapsam.dosyalar.map(function (d) {
        return dosyaTara(d.yol, d.etiket, bulgular);
      });
      // Fütûhât kısımları ayrı dosyalarda; listeyi indeksten alıyoruz.
      // Kısım listesi okunamazsa tarama yine sonuç veriyor ama EKSİK
      // veriyor -- sessiz kalmasın diye konsola yazıyoruz.
      isler.push(json(kapsam.futuhat.indeks).then(function (idx) {
        return Promise.all((idx.parts || []).map(function (p) {
          return dosyaTara(kapsam.futuhat.parcaKlasoru + p.id + ".json",
                           "Fütûhât " + p.id, bulgular);
        }));
      }).catch(function (e) {
        console.warn("Tahkik taraması: Fütûhât kısım listesi okunamadı", e);
      }));
      return Promise.all(isler);
    }).then(function () {
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

  // Fütûhât'ın 223 kısmı ayrı ayrı etiketleniyor ("Fütûhât c10k125");
  // süzgeçte hepsi tek başlık altında toplanıyor, yoksa 223 düğme çıkar.
  function kaynak(b) {
    return /^Fütûhât /.test(b.etiket) ? "Fütûhât" : b.etiket;
  }

  var suzgec = null;

  function ciz() {
    var govde = panel.querySelector(".durus-site__body");
    var hepsi = sonBulgular;
    if (!hepsi.length) {
      govde.innerHTML = '<p class="durus-site__yukleniyor">Mekanik merceklerde bulgu yok.</p>';
      return;
    }

    // Kaynak süzgeci. Kapsam birleştirilince bulgu sayısı 27'den birkaç
    // yüze çıktı -- eşikler değişmediği için değil, tarama nihayet bütün
    // siteye baktığı için (Fütûhât kısımları tek başına metnin dörtte
    // üçü). Tek uzun liste okunmaz; dosya dosya çalışılabilsin diye
    // süzgeç var. Hiçbir bulgu gizlenmiyor, yalnız gruplanıyor.
    var kaynakSayisi = {};
    hepsi.forEach(function (b) {
      var k = kaynak(b);
      kaynakSayisi[k] = (kaynakSayisi[k] || 0) + 1;
    });
    var kaynaklar = Object.keys(kaynakSayisi).sort(function (a, b) {
      return kaynakSayisi[b] - kaynakSayisi[a] || a.localeCompare(b, "tr");
    });
    if (suzgec && !kaynakSayisi[suzgec]) suzgec = null;

    var bs = suzgec ? hepsi.filter(function (b) { return kaynak(b) === suzgec; }) : hepsi;

    var gruplar = {};
    bs.forEach(function (b) { (gruplar[b.mercek] = gruplar[b.mercek] || []).push(b); });

    var html = '<p class="durus-site__ozet">' + hepsi.length + " bulgu"
      + (suzgec ? " (gösterilen: " + bs.length + ")" : "") + " — "
      + Object.keys(gruplar).sort().map(function (m) {
          return esc(MERCEK_ADI[m] || m) + ": " + gruplar[m].length;
        }).join(" · ")
      + '</p>'
      + '<p class="durus-site__not">Bunlar ölçüm, hüküm değil. Yargı mercekleri (M1-M4, M8) burada '
      + 'YOK: protokolün kendi kuralı, yargının tek tek ve dikkatle yapılmasını istiyor — '
      + 'onlar sayfa başına <code>/tahkik</code> ile.</p>'
      + '<p class="durus-site__suzgec">'
      + '<button type="button" data-kaynak="" aria-pressed="' + (suzgec ? "false" : "true") + '">'
      + "Hepsi (" + hepsi.length + ")</button>"
      + kaynaklar.map(function (k) {
          return '<button type="button" data-kaynak="' + esc(k) + '" aria-pressed="'
            + (suzgec === k ? "true" : "false") + '">' + esc(k) + " (" + kaynakSayisi[k] + ")</button>";
        }).join("")
      + "</p>";

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
    govde.querySelectorAll("[data-kaynak]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        suzgec = btn.getAttribute("data-kaynak") || null;
        ciz();
        govde.scrollTop = 0;
      });
    });
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
    }).catch(function (e) {
      // Kapsam dosyası okunamazsa panel sonsuza dek "taranıyor…" demesin
      // (durus-kontrol.js'teki aynı bekçi).
      var govde = panel && panel.querySelector(".durus-site__body");
      if (govde) govde.innerHTML = '<p class="durus-site__yukleniyor">Tarama başlatılamadı: '
        + 'kapsam listesi (tarama-kapsami.json) okunamadı. Konsola bakın.</p>';
      console.error("Tahkik taraması başlatılamadı", e);
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
