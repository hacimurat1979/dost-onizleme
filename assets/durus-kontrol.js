/* Dost Arabî — duruş taraması (s2).
 *
 * Ne yapar: gizli düzenleme kipi (@revise) açıkken CLAUDE.md'de yazılı
 * duruşumuza uymayabilecek yerleri işaretler. İki yolu var:
 *   1) SAYFA TARAMASI — açık olan sayfadaki metin kutularına işaret koyar.
 *   2) SİTE TARAMASI — veri dosyalarının hepsini indirip tarar ve bulguları
 *      tek listede gösterir. Sayfa sayfa gezmeye gerek kalmaz; asıl
 *      kullanım biçimi budur.
 *
 * Kurallar `research/anlayis-evrimi/DURUS_KONTROL.md`'den türetildi;
 * ikisi elle senkron tutulur.
 *
 * Ne YAPMAZ: hiçbir metni değiştirmez, hiçbir şeyi sunucuya göndermez,
 * sıradan okuyucuya hiçbir şey göstermez. Bulduğu şey bir iddia değil,
 * bir bakma davetidir -- her işaret susturulabilir.
 *
 * En önemli tek karar: <em> içindeki metin TARANMAZ. Sitede alıntılar
 * <em> ile işaretleniyor; Dost'un/Konuk'un/Daphne'nin kendi kesinliği ya
 * da kendi süre ifadesi bizim iddiamız değil (CLAUDE.md "Kapsam DIŞI").
 *
 * Canlıda da yayındadır (kullanıcı kararı, 2026-07-29): sync-to-live.py
 * artık dosyanın canlıda VAR olduğunu doğrular. Bu başlık uzun süre
 * tersini söyledi ("yalnızca önizlemede"); karar değişince yorum
 * unutulmuştu, 2026-08-05 çapraz denetiminde yakalandı.
 */
(function () {
  "use strict";

  var SURUM = "s6";
  var DISMISS_KEY = "dost-durus-susturulan";

  // YALNIZ TÜRKÇE (s3, kullanıcı kararı). Gerekçe: kalıplar Türkçe için
  // yazıldı ve Türkçede ölçüldü; üç dile birden nişan almak hem kuralları
  // bulanıklaştırıyordu hem üç kat gürültü üretiyordu. İş akışı da buna
  // uygun: bir metni Türkçesinden düzeltiyoruz, sonra İngilizce ve
  // Portekizcesi ona göre yeniden yazılıyor (bkz. CLAUDE.md, "üç dilde
  // birlikte revizyon" kuralı). Yani Türkçeyi taramak üçünü de taramak
  // demek -- yeter ki o kural tutulsun.
  function turkceMi() {
    return !window.DostI18n || window.DostI18n.getLang() === "tr";
  }

  // --- ortak koşullar ---------------------------------------------------

  // "Bu söz/bağ bizim" diyen işaretler. Birden çok kural buna bakıyor:
  // CLAUDE.md'nin künye kuralları yalnız KENDİMİZ hakkındaki cümleler için
  // geçerli, âlemin tarifi için değil.
  // Not: \b burada da ASCII, ama bu kalıpların hepsi ASCII harfle
  // başlıyor (b/k/o/y/i/t) -- sınır doğru kuruluyor. Yine de yeni bir
  // kalıp eklerken dikkat: "şey" gibi bir sözcük eklenirse çalışmaz.
  var SAHIPLIK = /\b(biz|bizim|bizce|kuruyoruz|kurduğumuz|kurduk|okuyoruz|okumamız|okuma denemesi|yazdığımız|izlediğimiz|biriktirdiğimiz|taradığımız)\b/i;
  function BIZIM(metin) { return SAHIPLIK.test(metin); }
  function BAGSIZ(metin) { return !SAHIPLIK.test(metin); }

  // Bir isabetin ÖNÜNDE, yakınında bir nakil işareti var mı? Sitede her
  // alıntı <em> ile sarılmıyor -- özellikle esma.json'da "İbn Arabî: '…'"
  // biçiminde düz tırnaklı nakiller var ve Türkçede düz tırnak aynı
  // zamanda kesme işareti olduğu için ("Hakk'ın") onları körlemesine
  // silemiyoruz. Onun yerine nakli, kendinden önce gelen atıf ifadesinden
  // tanıyoruz. Ölçüldü: kapali-ses isabetlerinin çoğu bu türdendi.
  var NAKIL = /(İbn Arabî|İbn Arabi|Dost|Konuk|İzutsu|Affifi|Daphne|şöyle diyor|şöyle der|şöyle yazıyor|buyurur|diyor ki|anlatıyor|aktarıyor|nakleder|yazıyor)\s*[-–—:'"“‘]/i;
  function NAKIL_DISI(metin, index) {
    return !NAKIL.test(metin.slice(Math.max(0, index - 170), index));
  }

  // JS'in \b'si ASCII: "şüphesiz" sözcüğünün başındaki ş bir "word
  // character" sayılmadığı için /\bşüphesiz\b/ HİÇ eşleşmiyor. s1'de bu
  // sessizce yanlış çalışıyordu (Türkçe harfle başlayan bütün kalıplar
  // kaçıyordu; Python'la yaptığımız ön ölçüm bunu göstermemişti, çünkü
  // Python'un \b'si Unicode farkında). Sınırları Unicode harf/rakam
  // sınıflarıyla kendimiz kuruyoruz.
  var ONEK = "(?<![\\p{L}\\p{N}])";
  var SONEK = "(?![\\p{L}\\p{N}])";
  function tamKelime(alt) { return new RegExp(ONEK + "(?:" + alt + ")" + SONEK, "giu"); }
  function basKelime(alt) { return new RegExp(ONEK + "(?:" + alt + ")", "giu"); }

  // --- Kurallar (DURUS_KONTROL.md s2) ----------------------------------
  // `re` global olmalı: bir metinde birden çok isabet sayılabilsin diye
  // lastIndex sıfırlanarak kullanılıyor.
  var KURALLAR = [
    {
      id: "sure-sisirme", seviye: "kural", ad: "Süre şişirme",
      re: tamKelime("yıllar boyunca|yıllardır|yıllarca|aylar boyunca|aylardır|haftalardır|uzun süredir|uzun zamandır|nice zamandır"),
      neden: "Kendimiz hakkında süre iddiası. CLAUDE.md: “Okuma tarihimiz kısa; uzunmuş gibi yazmak yalandır.”",
      yerine: "Süre değil kapsam yaz: “bu ciltte”, “okuduğumuz bölümlerde”, “şimdiye kadar” — ya da sayı ver.",
    },
    {
      id: "emek-sisirme", seviye: "kural", ad: "Emek/ölçek şişirme",
      re: basKelime("titizlikle tara|didik didik|sayısız|binlerce|yüzlerce|büyük bir çabayla|kapsamlı bir tarama"),
      neden: "Ölçüsü doğrulanamayan bir emek/ölçek nitelemesi.",
      yerine: "Sayılabilir olanı say; sayamıyorsan niteleme.",
      // Yalnız BİZİM hakkımızdaki cümlelerde geçerli: "tek bir Vücûd'un
      // sayısız sûrette göründüğü gibi" bir emek iddiası değil, âlemin
      // tarifi -- ölçtük, isabetlerin çoğu bu türdendi.
      kosul: BIZIM,
    },
    {
      id: "sureklilik-ima", seviye: "kural", ad: "Süreklilik ima etme",
      re: basKelime("düzenli olarak|düzenli aralıklarla|sistematik olarak (?:tara|izl|takip)|her gün|her hafta|aralıksız|durmadan (?:tara|izl)|sürekli (?:tarıyor|izliyor|takip ediyor)"),
      neden: "CLAUDE.md: “Süreklilik ima etme: aslında tek bir turda yapılmış bir işi sürekli/düzenli bir çalışmaymış gibi anlatmak.”",
      yerine: "Ne yaptıysak onu yaz: “bu turda”, “bu ciltte”, “bir kez”.",
      kosul: BIZIM,
    },
    {
      id: "bilimsel-oncelik", seviye: "kural", ad: "Bilimsel öncelik iddiası",
      // Olumsuzlanmış hâli isabet saymıyoruz: sitede bu kalıp çoğu zaman
      // TAM TERSİ için, bir çekince cümlesinde geçiyor ("…önceden görmüş
      // ya da kastetmiş DEĞİL").
      re: new RegExp(ONEK + "(?:önceden görmüş|önceden bilmiş|öngörmüş|bilim bunu kanıtl|bilim doğrul|modern bilim göster|bilimsel olarak doğrulan)"
        + "(?![^.!?]{0,70}(?:değil|değildir|olmuyor)" + SONEK + ")", "giu"),
      neden: "CLAUDE.md: “asla ‘İbn Arabî bunu önceden görmüştü’ ya da ‘bilim bunu kanıtlıyor’ gibi bir iddiaya dönüştürülmemeli.”",
      yerine: "“Bize … hatırlatıyor”, “bir çağrışım olarak”.",
    },
    {
      id: "kanit-dili", seviye: "kural", ad: "Kanıt dili",
      re: new RegExp(ONEK + "(?:kanıtlıyor|kanıtlar ki|kanıtıdır|ispatlıyor|ispat ediyor|ispatıdır|kesin olarak göster|tartışmasız biçimde|şüpheye yer bırakmayacak)"
        + "(?![^.!?]{0,70}(?:değil|değildir)" + SONEK + ")", "giu"),
      neden: "CLAUDE.md: kapanmış, otoriter bir ses değil; arayan bir ses.",
      yerine: "“Şöyle okuyoruz”, “bu satırlar şuna işaret ediyor olabilir”.",
      esKosul: NAKIL_DISI,
    },

    {
      id: "kapali-ses", seviye: "gozden-gecir", ad: "Kapalı ses",
      re: tamKelime("şüphesiz|kuşkusuz|elbette|besbelli|apaçık|hiç kuşku yok|açıkça görülüyor"),
      neden: "Kesinlik bildiren bir bağlaç. Kendi sesimizdeyse duruşumuza aykırı.",
      yerine: "Kesinliği kaldır ya da kimin kesinliği olduğunu söyle.",
      esKosul: NAKIL_DISI,
    },
    {
      id: "gosterme-dili", seviye: "gozden-gecir", ad: "Gösterme dili",
      // Yalın "gösteriyor" bilerek YOK: "şunu gösteriyor olabilir" gibi
      // temkinli kullanımları da yakalar ve kuralı kullanılamaz yapardı.
      // Yalnız kapanış bildiren biçimleri arıyoruz.
      re: basKelime("açıkça gösteriyor|net (?:bir )?biçimde gösteriyor|gösterir ki|ortaya koyuyor ki|ortaya koymaktadır|görüldüğü üzere|anlaşılacağı üzere"),
      neden: "Bir okumayı sonuç gibi kapatan biçim. Duruşumuz: “bize göre”, “olabilir”.",
      yerine: "“Bu satırları şöyle okuyoruz”, “bize şunu düşündürüyor”.",
      esKosul: NAKIL_DISI,
    },
    {
      id: "tamamlanmis-anlama", seviye: "gozden-gecir", ad: "Tamamlanmış anlama",
      re: basKelime("artık (?:biliyoruz|anlıyoruz|biliriz)|anlaşılmıştır|netleşmiştir|kesinleşmiştir|böylece anlaşıl|sonuç olarak diyebiliriz|meselenin özü şudur|artık açıktır"),
      neden: "Kökensel duruş: “anlamaya çalışıyoruz, anlatmaya değil.” Anlama kapanmış gibi yazılmamalı.",
      yerine: "“Şimdilik şöyle okuyoruz”, “bu tur bize şunu düşündürdü”.",
      esKosul: NAKIL_DISI,
    },
    {
      id: "mutlak-genelleme", seviye: "gozden-gecir", ad: "Külliyat ölçeğinde genelleme",
      // İlk hâli "her zaman / asla / kesinlikle / mutlaka" gibi sıradan
      // pekiştireçleri de yakalıyordu: 444 isabet, yani kullanılamaz.
      // Asıl kaygı bunlar değil, KÜLLİYATIN TAMAMI hakkında hüküm kurmak
      // -- okuduğumuz kısım sınırlı. Kalıplar ona indirildi.
      re: basKelime("hiçbir yerde|hiçbir eserinde|hiçbir kitabında|bütün külliyat|tüm külliyat|bütün eserlerinde|tüm eserlerinde|her zaman ve her yerde|istisnasız|hiçbir yerinde"),
      neden: "Külliyatın tamamı hakkında bir hüküm. Okuduğumuz kısım sınırlı; bunu doğrulayamayız.",
      yerine: "Kapsamı söyle: “okuduğumuz bölümlerde”, “bu ciltte karşımıza çıkmadı”.",
      esKosul: NAKIL_DISI,
    },
    {
      id: "sarih-hakemligi", seviye: "gozden-gecir", ad: "Şârihi hakem yapmak",
      re: new RegExp("(?:Konuk|İzutsu|Izutsu|Affifi|Chittick|Corbin)[^.!?]{0,70}?" + ONEK
        + "(?:haklı olarak|doğru olarak|doğrusu|isabetle|doğru biçimde|yanılıyor|hatalı olarak|yanlış anlamış)" + SONEK, "giu"),
      neden: "CLAUDE.md: şârihler “hakem değil” — onların yorumu da bir okuma.",
      yerine: "“… şöyle okuyor”, “bir yaklaşım olarak”.",
    },
    {
      id: "okuru-yonlendirme", seviye: "gozden-gecir", ad: "Okuru yönlendirme",
      re: tamKelime("unutmayın|unutmayalım|dikkat edin ki|bilmelisiniz|anlamalısınız|şunu bilin|görmelisiniz|kabul etmeliyiz"),
      neden: "Öğretici/buyurucu ses. Duruşumuz okuru ortak bir arayışa davet ediyor, yönlendirmiyor.",
      yerine: "“Bize öyle geliyor ki”, “burada şunu sorabiliriz”.",
      esKosul: NAKIL_DISI,
    },
    {
      id: "bag-kimin", seviye: "gozden-gecir", ad: "Bağ kimin?",
      // "tıpkı" ve "benzer biçimde" bilerek YOK: sıradan benzetme
      // sözcükleri ("tıpkı evren gibi") ve kuralı kullanılamaz hâle
      // getiriyorlardı -- ölçtük, 297 isabetin çoğu onlardan geliyordu.
      re: tamKelime("aynı hareketi|aynı deseni|aynı örüntü|aynı formülü|örtüşüyor|örtüşmesi|paralellik|birebir aynı"),
      neden: "İki kaynağı birbirine bağlayan bir cümle, ama bağın bize ait olduğu söylenmemiş.",
      yerine: "“Bağı biz kuruyoruz”, “iki metin birbirine atıf yapmıyor” gibi bir cümle ekle.",
      kosul: BAGSIZ,
    },
    {
      id: "niyeti-bilmek", seviye: "gozden-gecir", ad: "Dost'un niyetini bilmek",
      // Kalıp kasıtlı dar: "Dost'un kastı ne?" biçimindeki retorik soru
      // ya da "kastı şu:" biçimindeki net beyan yakalanıyor; olasılık
      // bildiren "kastını anlamaya çalışıyoruz" yakalanmıyor.
      re: new RegExp(ONEK + "(?:(?:Dost'un|İbn Arabî'nin|onun)\\s+(?:kastı|muradı)|(?:kastı|muradı)\\s+şu(?:dur)?)" + SONEK, "giu"),
      neden: "Bir müellifin niyetini ya da kastını doğrudan bilmek iddialı. Kökensel duruş: anlama çabasındayız, hakem değiliz.",
      yerine: "“Bu satırları şöyle okuyoruz”, “bize kastı şunu çağrıştırıyor”, “şöyle yorumlanabilir”.",
      esKosul: NAKIL_DISI,
    },
    {
      id: "dogmatik-ozet", seviye: "gozden-gecir", ad: "Dogmatik özet",
      re: basKelime("buradaki (?:temel )?mesaj|öğretinin özü|bir cümleyle özetl|kısacası şunu söyl|özetle şunu söyl|özetle diyebilir"),
      neden: "Bir pasajı veya öğretiyi tek bir mesaja/öze indirgemek, okumayı kapanmış bir sonuç gibi sunar.",
      yerine: "“Bu satırlar bize şunu düşündürüyor”, “bu bölümden çıkardığımız bir şey şu”.",
      esKosul: NAKIL_DISI,
    },
  ];

  var SECICI = [
    "#detail-content p", "#detail-content li", "#detail-content blockquote",
    "#futuhat-article p", "#futuhat-article li", "#futuhat-article blockquote",
    "#fusus-article p", "#fusus-article li", "#fusus-article blockquote",
    ".hakkinda-content__section p", ".hakkinda-content__subtitle",
    ".tasiyici-intro__p", ".tasiyici-sira p", ".tasiyici-sonnot",
    ".tasiyici-note__body", ".helix-scene__note-body",
    ".futuhat-hero__summary", ".fusus-hero__summary",
  ].join(", ");

  // Site taraması için hangi veri dosyası hangi görünüme ait:
  // data/ibn-arabi/tarama-kapsami.json. Liste eskiden hem burada hem
  // tahkik-tarama.js içinde ayrı ayrı dururdu; ikisi zamanla ayrıştı ve
  // kimse fark etmedi. Artık tek kaynak var, üstelik
  // scripts/tarama-kapsami-kontrol.py kapsam kararı verilmemiş bir veri
  // dosyası bulduğunda derlemeyi durduruyor.
  var KAPSAM = "data/ibn-arabi/tarama-kapsami.json";

  // Taranmayan alanlar. `analogy`: CLAUDE.md'nin "Kapsam DIŞI" maddesi
  // günlük hayat analojilerini açıkça muaf tutuyor. Ötekiler metin değil
  // künye/etiket alanları.
  var MUAF_ALAN = { analogy: 1, source: 1, sources: 1, kaynak: 1, cite: 1,
                    url: 1, id: 1, view: 1, pageRange: 1, arabic: 1 };
  var DIL = { tr: 1, en: 1, pt: 1 };

  var acikKutu = null;
  var siteBulgulari = null;

  // --- yardımcılar ------------------------------------------------------
  function hash(s) {
    // djb2. Susturma anahtarı metne bağlı: metin değişince işaret geri
    // gelsin diye.
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function susturulanlar() {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function sustur(anahtar) {
    var d = susturulanlar();
    d[anahtar] = new Date().toISOString();
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(d)); } catch (e) {}
  }
  function anahtarla(kuralId, metin) {
    return kuralId + ":" + hash(metin.replace(/\s+/g, " ").trim());
  }

  // Alıntı dışı metin: <em>/<q> içeriği aynı uzunlukta boşluğa çevriliyor
  // (konumlar korunsun diye).
  function alintisizDom(el) {
    var out = "";
    (function yuru(node) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var c = node.childNodes[i];
        if (c.nodeType === 3) { out += c.nodeValue; continue; }
        if (c.nodeType !== 1) continue;
        if (c.tagName === "EM" || c.tagName === "Q") {
          out += new Array((c.textContent || "").length + 1).join(" ");
          continue;
        }
        yuru(c);
      }
    })(el);
    return out;
  }
  function alintisizMetin(s) {
    return String(s).replace(/<em>[\s\S]*?<\/em>/g, function (m) {
      return new Array(m.length + 1).join(" ");
    }).replace(/<[^>]+>/g, " ");
  }

  // Ortak çekirdek: bir metinde hangi kurallar tetikleniyor?
  function kurallariUygula(taranan, tamMetin) {
    if (taranan.replace(/\s+/g, "").length < 40) return [];
    var d = susturulanlar();
    var out = [];
    KURALLAR.forEach(function (k) {
      if (k.kosul && !k.kosul(taranan)) return;
      k.re.lastIndex = 0;
      var m, esler = [];
      while ((m = k.re.exec(taranan)) !== null) {
        if (!k.esKosul || k.esKosul(taranan, m.index)) {
          esler.push({ es: m[0].trim(), i: m.index });
        }
        if (k.re.lastIndex === m.index) k.re.lastIndex++;
      }
      if (!esler.length) return;
      var anahtar = anahtarla(k.id, tamMetin);
      if (d[anahtar]) return;
      out.push({ kural: k, esler: esler, anahtar: anahtar });
    });
    return out;
  }

  // Günlük hayat analojileri ve benzeri etiketli bloklar taranmıyor
  // (CLAUDE.md "Kapsam DIŞI"). DİKKAT: .detail-analogy sınıfını "Bir
  // çekince", "Makamı ve terki" gibi başka etiketler de kullanıyor --
  // yani muafiyet gereğinden biraz geniş. Bilerek böyle: taramanın
  // yanlış susması, yanlış bağırmasından iyidir.
  function muafMi(el) { return !!el.closest(".detail-analogy"); }

  function bulgular(el) {
    if (!turkceMi() || muafMi(el)) return [];
    return kurallariUygula(alintisizDom(el), el.textContent || "");
  }

  // --- sayfa içi işaretleme ---------------------------------------------
  function kutuAc(rozet, bulgu, el) {
    kutuKapat();
    var kutu = document.createElement("div");
    kutu.className = "durus-kutu";
    kutu.innerHTML = kutuIcerik(bulgu);
    document.body.appendChild(kutu);
    var r = rozet.getBoundingClientRect();
    kutu.style.top = (window.scrollY + r.bottom + 6) + "px";
    kutu.style.left = Math.max(8, Math.min(
      window.scrollX + r.left - 140,
      window.scrollX + document.documentElement.clientWidth - kutu.offsetWidth - 8)) + "px";
    acikKutu = kutu;
    kutu.querySelector('[data-act="kapat"]').addEventListener("click", kutuKapat);
    kutu.querySelector('[data-act="sustur"]').addEventListener("click", function () {
      sustur(bulgu.anahtar);
      kutuKapat();
      isaretle(el);
      sayaciGuncelle();
    });
  }
  function kutuIcerik(bulgu) {
    var esler = bulgu.esler.map(function (e) { return e.es; });
    return '<p class="durus-kutu__ad">' + (bulgu.kural.seviye === "kural" ? "🔸" : "🔹")
      + " " + esc(bulgu.kural.ad)
      + ' <span class="durus-kutu__sev">' + (bulgu.kural.seviye === "kural" ? "kural" : "gözden geçir") + "</span></p>"
      + '<p class="durus-kutu__es">' + esler.map(function (e) {
          return "<span>" + esc(e) + "</span>";
        }).join(" ") + "</p>"
      + '<p class="durus-kutu__neden">' + esc(bulgu.kural.neden) + "</p>"
      + '<p class="durus-kutu__yerine"><strong>Yerine:</strong> ' + esc(bulgu.kural.yerine) + "</p>"
      + '<div class="durus-kutu__alt">'
      + '<button type="button" data-act="sustur">Bu doğru — işareti kaldır</button>'
      + '<button type="button" data-act="kapat">Kapat</button>'
      + "</div>";
  }
  function kutuKapat() { if (acikKutu) { acikKutu.remove(); acikKutu = null; } }

  function isaretle(el) {
    var eski = el.querySelector(":scope > .durus-rozet-grup");
    if (eski) eski.remove();
    el.classList.remove("durus-isaretli", "durus-isaretli--kural");

    var bs = bulgular(el);
    if (!bs.length) return;

    var grup = document.createElement("span");
    grup.className = "durus-rozet-grup";
    grup.setAttribute("contenteditable", "false");   // @revise metni düzenlenebilir yapıyor
    bs.forEach(function (b) {
      var rozet = document.createElement("button");
      rozet.type = "button";
      rozet.className = "durus-rozet durus-rozet--" + b.kural.seviye;
      rozet.textContent = b.kural.seviye === "kural" ? "🔸" : "🔹";
      rozet.title = b.kural.ad + " — " + b.esler.map(function (e) { return e.es; }).join(", ");
      rozet.setAttribute("aria-label", "Duruş uyarısı: " + b.kural.ad);
      rozet.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        kutuAc(rozet, b, el);
      });
      grup.appendChild(rozet);
    });
    el.appendChild(grup);
    el.classList.add("durus-isaretli");
    if (bs.some(function (b) { return b.kural.seviye === "kural"; })) {
      el.classList.add("durus-isaretli--kural");
    }
  }

  function tara() {
    document.querySelectorAll(SECICI).forEach(isaretle);
    sayaciGuncelle();
  }

  function temizle() {
    kutuKapat();
    siteKapat();
    document.querySelectorAll(".durus-rozet-grup").forEach(function (g) { g.remove(); });
    document.querySelectorAll(".durus-isaretli").forEach(function (el) {
      el.classList.remove("durus-isaretli", "durus-isaretli--kural");
    });
    if (cip) { cip.remove(); cip = null; }
  }

  // --- sayaç (kip açıkken HER ZAMAN görünür) ----------------------------
  // İlk sürümde sayaç yalnız bulgu varken çıkıyordu; temiz bir sayfada
  // ekranda hiçbir şey olmadığı için taramanın çalışıp çalışmadığı belli
  // olmuyordu (kullanıcı bildirdi). Artık "temiz" hâli de görünüyor.
  var cip = null;
  function sayaciGuncelle() {
    var kural = document.querySelectorAll(".durus-rozet--kural").length;
    var gg = document.querySelectorAll(".durus-rozet--gozden-gecir").length;
    if (!cip) {
      cip = document.createElement("div");
      cip.className = "durus-cip";
      cip.innerHTML =
        '<button type="button" class="durus-cip__sayac"></button>'
        + '<button type="button" class="durus-cip__site" title="Bütün veri dosyalarını tara">Siteyi tara</button>'
        // Mekanik tahkik (assets/tahkik-tarama.js) aynı çipten açılıyor:
        // ikisi de @revise kipinin "metne bakma" araçları ve aynı veri
        // dosyalarını okuyorlar. Ayrı düğme, çünkü ayrı soru soruyorlar --
        // duruş: "bu cümle duruşumuza uyuyor mu"; tahkik: "bu metin
        // ölçülebilir biçimde yoğun mu, bir dili eksik mi".
        + '<button type="button" class="durus-cip__tahkik" title="Mekanik tahkik: M5 yoğunluk + M7 üç dil kayması">Tahkik</button>';
      document.body.appendChild(cip);
      cip.querySelector(".durus-cip__sayac").addEventListener("click", sonrakineGit);
      cip.querySelector(".durus-cip__site").addEventListener("click", siteAc);
      cip.querySelector(".durus-cip__tahkik").addEventListener("click", function () {
        if (window.__dostTahkik) window.__dostTahkik.ac();
      });
    }
    var s = cip.querySelector(".durus-cip__sayac");
    if (!turkceMi()) {
      // Sayaç yine de duruyor: "hiçbir şey görünmüyor" hâli bir kez
      // kafa karıştırdı, bir daha karıştırmasın.
      s.innerHTML = '<span class="durus-cip__temiz">🇹🇷 tarama yalnız Türkçede</span>';
      s.title = "Duruş taraması " + SURUM + " — kalıplar Türkçe için yazıldı";
      return;
    }
    s.innerHTML = (kural || gg)
      ? (kural ? '<span class="durus-cip__k">🔸 ' + kural + "</span>" : "")
        + (gg ? '<span class="durus-cip__g">🔹 ' + gg + "</span>" : "")
      : '<span class="durus-cip__temiz">✓ bu sayfa temiz</span>';
    s.title = "Duruş taraması " + SURUM + " — sıradaki işarete git";
  }

  var sonrakiIdx = 0;
  function sonrakineGit() {
    var hepsi = document.querySelectorAll(".durus-rozet");
    if (!hepsi.length) return;
    sonrakiIdx = sonrakiIdx % hepsi.length;
    var hedef = hepsi[sonrakiIdx++];
    hedef.scrollIntoView({ block: "center", behavior: "smooth" });
    hedef.focus({ preventScroll: true });
  }

  // --- SİTE TARAMASI ----------------------------------------------------
  // Asıl kullanım biçimi: bütün veri dosyalarını indirip tarar. Sayfa
  // sayfa gezmeye gerek kalmaz.
  function json(yol) {
    return window.DostGraphUtils
      ? window.DostGraphUtils.fetchJson(yol)
      : fetch(yol).then(function (r) { return r.json(); });
  }

  // JSON ağacında yürürken: en yakın "id"li ata kaydı ve alan adını
  // taşıyoruz, ki bulguyu bir kayda ve mümkünse bir bağlantıya
  // bağlayabilelim.
  // `dilTr`: bu dal bir {tr,en,pt} sözlüğünün TÜRKÇE kolundan mı geliyor?
  // Yalnız o dal taranıyor (s3). Hiçbir dil sözlüğünün altında olmayan
  // düz metinler de taranmıyor: onlar id/url/etiket gibi alanlar, revize
  // edilecek düzyazı değil.
  // `kok`: yoldaki EN DIŞTAKİ id'li kayıt -- gezinmenin hedefi bu olmalı.
  // `kayit`: en yakın id'li kayıt -- başlık/etiket için. Fütûhât
  // kısımlarında ikisi ayrışıyor: kök `c14k158` (kısmın kendisi, yani
  // açılacak sayfa), yakın kayıt `c14k158-s1` (bölüm). Önce yalnız
  // yakını taşıyorduk ve `goTo("futuhat","c14k158-s1")` diye gidiyorduk;
  // kısım açılıyordu ama doğru kısım olduğu tesadüftü.
  function gez(o, alan, kok, kayit, dilTr, cb) {
    if (o && typeof o === "object" && !Array.isArray(o)) {
      var yakin = (typeof o.id === "string") ? o : kayit;
      var yeniKok = kok || ((typeof o.id === "string") ? o : null);
      Object.keys(o).forEach(function (anahtar) {
        gez(o[anahtar], DIL[anahtar] ? alan : anahtar, yeniKok, yakin,
            DIL[anahtar] ? (anahtar === "tr") : dilTr, cb);
      });
    } else if (Array.isArray(o)) {
      o.forEach(function (v) { gez(v, alan, kok, kayit, dilTr, cb); });
    } else if (typeof o === "string") {
      if (dilTr) cb(alan, o, kok, kayit);
    }
  }

  function dosyaTara(yol, view, etiket, bulgular) {
    return json(yol).then(function (d) {
      gez(d, null, null, null, false, function (alan, s, kok, kayit) {
        if (MUAF_ALAN[alan] || s.length < 40) return;
        kurallariUygula(alintisizMetin(s), s).forEach(function (b) {
          bulgular.push({
            kural: b.kural, esler: b.esler, anahtar: b.anahtar,
            etiket: etiket, view: view,
            id: (kok && kok.id) || (kayit && kayit.id),
            baslik: kayit && (kayit.title || kayit.name || kayit.topic || kayit.question || kayit.label),
            metin: s,
          });
        });
      });
    }).catch(function (e) {
      console.warn("Duruş taraması: " + yol + " okunamadı", e);
    });
  }

  // --- "buradayım": hedefe gidip ilgili paragrafı gösterme -------------
  // Doğru sayfayı açmak yetmiyordu; kullanıcı paragrafı elle arıyordu.
  // Gezindikten sonra metni DOM'da bulup ekrana getiriyor, paragrafı
  // kısa süre vurguluyor ve eşleşen ifadeyi geçici bir <mark> ile
  // işaretliyor. İçerik eşzamansız çizildiği için bir süre yokluyoruz.
  function sadelestir(s) {
    return String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  // HTML etiketlerini boşluk bırakmadan siler — DOM textContent ile karşılaştırma için
  function etiketSil(s) {
    return String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }
  function trKucuk(s) { return String(s).toLocaleLowerCase("tr"); }

  var vurguZaman = null;
  function vurguTemizle() {
    document.querySelectorAll(".durus-vurgu").forEach(function (el) {
      el.classList.remove("durus-vurgu");
    });
    document.querySelectorAll("mark.durus-vurgu-es").forEach(function (m) {
      var p = m.parentNode;
      if (!p) return;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
      p.normalize();
    });
  }

  // Eşleşen ifadeyi tek bir metin düğümü içinde bulup <mark>'a sarar.
  // Düğüm sınırına denk gelirse (araya bir <em>/<a> girmişse) vazgeçer --
  // paragraf vurgusu zaten yeterli bir "buradayım".
  function esiIsaretle(el, es) {
    var yuru = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var hedef = trKucuk(es);
    var n;
    while ((n = yuru.nextNode())) {
      if (n.parentNode && n.parentNode.closest(".durus-rozet-grup")) continue;
      var i = trKucuk(n.nodeValue).indexOf(hedef);
      if (i < 0) continue;
      var r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + es.length);
      var m = document.createElement("mark");
      m.className = "durus-vurgu-es";
      try { r.surroundContents(m); return m; } catch (e) { return null; }
    }
    return null;
  }

  function vurgula(bulgu) {
    vurguTemizle();
    if (vurguZaman) { clearTimeout(vurguZaman); vurguZaman = null; }
    var es = bulgu.esler[0].es;
    // İki kademeli arama: önce metnin başından uzunca bir dilim (kesin),
    // bulunamazsa yalnız eşleşen ifade (honorifics gibi eklentiler metni
    // değiştirmiş olabilir).
    // etiketSil: DOM textContent ile örtüşmesi için <em> gibi etiketleri
    // boşluk yerine silerek kaldırır (sadelestir " " bırakır → uyuşmazlık).
    var uzun = trKucuk(etiketSil(bulgu.metin).slice(0, 90));
    var kisa = trKucuk(es);
    var bitis = Date.now() + 8000;

    (function dene() {
      var adaylar = document.querySelectorAll(SECICI);
      var el = null, yedek = null;
      for (var i = 0; i < adaylar.length; i++) {
        var t = trKucuk(sadelestir(adaylar[i].textContent));
        if (t.indexOf(uzun) !== -1) { el = adaylar[i]; break; }
        if (!yedek && t.indexOf(kisa) !== -1) yedek = adaylar[i];
      }
      el = el || yedek;
      if (!el) {
        if (Date.now() < bitis) setTimeout(dene, 220);
        return;
      }
      esiIsaretle(el, es);
      el.classList.add("durus-vurgu");
      // detail-panel position:fixed içindeyse scrollIntoView ana sayfayı
      // kaydırır, panelin içini değil — panelin scrollTop'unu elle ayarla.
      var panelEl = document.getElementById("detail-panel");
      if (panelEl && !panelEl.hidden && panelEl.contains(el)) {
        var elRect = el.getBoundingClientRect();
        var pRect = panelEl.getBoundingClientRect();
        panelEl.scrollTop += elRect.top - pRect.top - panelEl.clientHeight / 2 + elRect.height / 2;
      } else {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      vurguZaman = setTimeout(vurguTemizle, 6000);
    })();
  }

  function siteTara() {
    var bulgular = [];
    return json(KAPSAM).then(function (kapsam) {
      var isler = kapsam.dosyalar.map(function (d) {
        return dosyaTara(d.yol, d.gorunum, d.etiket, bulgular);
      });
      isler.push(json(kapsam.futuhat.indeks).then(function (idx) {
        var parcalar = (idx.parts || []).map(function (p) { return p.id; });
        return Promise.all(parcalar.map(function (pid) {
          return dosyaTara(kapsam.futuhat.parcaKlasoru + pid + ".json",
                           "futuhat", "Fütûhât " + pid, bulgular);
        }));
      }).catch(function (e) { console.warn("Duruş taraması: kısım listesi okunamadı", e); }));
      return Promise.all(isler);
    }).then(function () {
      // Aynı metin birden çok dosyada geçebiliyor (atlas + parça kopyası);
      // aynı kural+metin çiftini bir kez gösteriyoruz.
      var gorulen = {};
      return bulgular.filter(function (b) {
        var k = b.anahtar;
        if (gorulen[k]) return false;
        gorulen[k] = 1;
        return true;
      });
    });
  }

  var sitePanel = null;
  function siteKapat() { if (sitePanel) { sitePanel.remove(); sitePanel = null; } }

  function siteAc() {
    siteKapat();
    sitePanel = document.createElement("div");
    sitePanel.className = "durus-site";
    sitePanel.innerHTML =
      '<div class="durus-site__backdrop"></div>'
      + '<div class="durus-site__card" role="dialog" aria-modal="true" aria-label="Site duruş taraması">'
      + '<div class="durus-site__head"><p class="durus-site__title">Site duruş taraması <span>' + SURUM + '</span></p>'
      + '<button type="button" class="durus-site__close" aria-label="Kapat">×</button></div>'
      + '<div class="durus-site__body"><p class="durus-site__yukleniyor">Veri dosyaları taranıyor…</p></div>'
      + "</div>";
    document.body.appendChild(sitePanel);
    sitePanel.querySelector(".durus-site__backdrop").addEventListener("click", siteKapat);
    sitePanel.querySelector(".durus-site__close").addEventListener("click", siteKapat);

    var yukle = siteBulgulari ? Promise.resolve(siteBulgulari) : siteTara();
    yukle.then(function (bs) {
      siteBulgulari = bs;
      siteCiz();
    }).catch(function (e) {
      // Kapsam dosyası (tarama-kapsami.json) okunamazsa panel sonsuza
      // dek "taranıyor…" diyordu + yakalanmamış bir rejection kalıyordu.
      // Tek tek veri dosyaları zaten sessizce atlanıyor; buraya yalnız
      // kapsamın kendisi düşer -- o da susturulacak bir şey değil.
      var govde = sitePanel && sitePanel.querySelector(".durus-site__body");
      if (govde) govde.innerHTML = '<p class="durus-site__yukleniyor">Tarama başlatılamadı: '
        + 'kapsam listesi (tarama-kapsami.json) okunamadı. Konsola bakın.</p>';
      console.error("Duruş taraması başlatılamadı", e);
    });
  }

  function siteCiz() {
    if (!sitePanel) return;
    var d = susturulanlar();
    var bs = siteBulgulari.filter(function (b) { return !d[b.anahtar]; });
    var body = sitePanel.querySelector(".durus-site__body");
    if (!bs.length) {
      body.innerHTML = '<p class="durus-site__temiz">✓ Kuralların hiçbiri tetiklenmedi. '
        + "Bu, metinlerin doğru olduğunu değil, bu " + KURALLAR.length
        + " kalıbın bulunmadığını söyler.</p>";
      return;
    }
    // Kurala göre grupla; kural seviyesi önce.
    var gruplar = {};
    bs.forEach(function (b) { (gruplar[b.kural.id] = gruplar[b.kural.id] || []).push(b); });
    var sirali = KURALLAR.filter(function (k) { return gruplar[k.id]; });

    bs.forEach(function (b, i) { b.__i = i; });
    var kSay = bs.filter(function (b) { return b.kural.seviye === "kural"; }).length;
    body.innerHTML =
      '<p class="durus-site__ozet">🔸 ' + kSay + " kural · 🔹 " + (bs.length - kSay)
      + " gözden geçir · " + siteBulgulari.length + " bulgunun "
      + (siteBulgulari.length - bs.length) + " tanesi susturulmuş</p>"
      + sirali.map(function (k) {
        var g = gruplar[k.id];
        return '<section class="durus-site__grup">'
          + '<h3>' + (k.seviye === "kural" ? "🔸" : "🔹") + " " + esc(k.ad)
          + ' <span>' + g.length + "</span></h3>"
          + '<p class="durus-site__neden">' + esc(k.neden) + "</p>"
          + g.map(function (b) { return siteSatir(b); }).join("")
          + "</section>";
      }).join("");

    body.querySelectorAll("[data-sustur]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        sustur(btn.dataset.sustur);
        siteCiz();
        tara();
      });
    });
    body.querySelectorAll("a.durus-site__git").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var b = bs[Number(a.dataset.i)];
        siteKapat();
        window.__dostNav.goTo(a.dataset.view, a.dataset.id || undefined);
        if (b) setTimeout(function() { vurgula(b); }, 350);
      });
    });
  }

  function siteSatir(b) {
    var i = b.esler[0].i;
    var duz = alintisizMetin(b.metin);
    var bas = Math.max(0, i - 90);
    var parca = (bas ? "…" : "") + duz.slice(bas, i)
      + '<mark>' + esc(b.esler[0].es) + "</mark>"
      + duz.slice(i + b.esler[0].es.length, i + b.esler[0].es.length + 90) + "…";
    var nere = esc(b.etiket) + (b.baslik ? " · " + esc(t3(b.baslik)) : (b.id ? " · " + esc(b.id) : ""));
    return '<div class="durus-site__satir">'
      + '<p class="durus-site__nere">' + nere
      + (b.view && b.id
          ? ' <a class="durus-site__git" href="#" data-i="' + b.__i + '" data-view="' + esc(b.view)
            + '" data-id="' + esc(b.id) + '">aç →</a>'
          : "")
      + "</p>"
      + '<p class="durus-site__parca">' + parca + "</p>"
      + '<button type="button" class="durus-site__sustur" data-sustur="' + esc(b.anahtar) + '">Bu doğru — kaldır</button>'
      + "</div>";
  }
  function t3(x) {
    if (typeof x === "string") return x;
    return (window.DostI18n && window.DostI18n.pick3(x)) || (x && (x.tr || x.en || x.pt)) || "";
  }

  // --- kipe bağlanma ----------------------------------------------------
  // edit-mode.js'e dokunmuyoruz; sadece body sınıfını izliyoruz. Böylece
  // iki dosya bağımsız kalıyor ve kip kapanınca bütün işaretler siliniyor.
  var acik = false;
  var icerikGozcusu = null;
  var taramaZaman = null;

  // Bir mutasyon kaydı yalnızca BİZİM ürettiğimiz düğümlerden mi
  // oluşuyor? (Yukarıdaki (a) korumasının ölçütü.)
  var BIZIM_SINIFLAR = ["durus-rozet-grup", "durus-rozet", "durus-cip",
                        "durus-kutu", "durus-site", "durus-vurgu-es"];
  function bizimDugum(n) {
    if (!n) return false;
    if (n.nodeType === 3) {
      // Kendi <mark>'ımızı sararken/çözerken metin düğümü taşınıyor.
      return !!(n.parentNode && n.parentNode.closest
                && n.parentNode.closest("mark.durus-vurgu-es, .durus-rozet-grup, .durus-site, .durus-kutu"));
    }
    if (n.nodeType !== 1) return true;
    for (var i = 0; i < BIZIM_SINIFLAR.length; i++) {
      if (n.classList && n.classList.contains(BIZIM_SINIFLAR[i])) return true;
    }
    return !!(n.closest && n.closest(".durus-site, .durus-kutu, .durus-rozet-grup"));
  }
  function bizimMi(k) {
    var hepsi = [].slice.call(k.addedNodes).concat([].slice.call(k.removedNodes));
    return hepsi.length > 0 && hepsi.every(bizimDugum);
  }
  function taramaGecikmeli() {
    if (taramaZaman) clearTimeout(taramaZaman);
    taramaZaman = setTimeout(function () { taramaZaman = null; tara(); }, 300);
  }

  function kipDegisti() {
    var simdi = document.body.classList.contains("dost-edit-mode");
    if (simdi === acik) return;
    acik = simdi;
    if (acik) {
      tara();
      // Detay paneli / kısım metni sonradan çiziliyor, o yüzden DOM'u
      // izliyoruz. Ama bu iki koruma olmadan sayfa KİLİTLENİYOR:
      //
      // (a) Kendi ürettiğimiz düğümleri (rozet, sayaç, kutu, vurgu)
      //     yok sayıyoruz. Yoksa şu zincir kuruluyor: biz rozet ekliyoruz
      //     → sayfadaki başka bir gözcü (honorifics/çapraz-link gibi metne
      //     dokunanlar) tetikleniyor ve DOM'u değiştiriyor → bizim gözcü
      //     tetikleniyor → yeniden rozet ekliyoruz → …
      // (b) Tarama bir zamanlayıcıya alınıyor. MutationObserver geri
      //     çağrıları mikro-görev; uçtan uca bir zincir kurulduğunda
      //     fetch/promise'lere hiç sıra gelmiyor ve sayfa yanıt vermiyor.
      //     setTimeout bir makro-görev olduğu için olay döngüsü nefes
      //     alıyor. (2026-07-29'da ölçüldü: @revise açıkken sayfadaki bir
      //     fetch hiç tamamlanmıyordu.)
      icerikGozcusu = new MutationObserver(function (kayitlar) {
        if (kayitlar.every(bizimMi)) return;
        taramaGecikmeli();
      });
      icerikGozcusu.observe(document.body, { childList: true, subtree: true });
    } else {
      if (icerikGozcusu) { icerikGozcusu.disconnect(); icerikGozcusu = null; }
      if (taramaZaman) { clearTimeout(taramaZaman); taramaZaman = null; }
      temizle();
    }
  }

  new MutationObserver(kipDegisti).observe(document.body, {
    attributes: true, attributeFilter: ["class"],
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kipDegisti);
  } else kipDegisti();

  document.addEventListener("click", function (e) {
    if (acikKutu && !e.target.closest(".durus-kutu") && !e.target.closest(".durus-rozet")) kutuKapat();
  });
  // Escape artık burada değil, GU.registerStepBack'in merkezi sırasında --
  // iki katman aynı anda açıkken tek Escape'in hepsini kapatmaması için.
  // İki alt-katman arasındaki öncelik (site paneli > tekil kutu) korunuyor.
  if (window.DostGraphUtils) {
    window.DostGraphUtils.registerStepBack(null, function () {
      if (sitePanel) { siteKapat(); return true; }
      if (acikKutu) { kutuKapat(); return true; }
      return false;
    });
  }

  // Testler ve elden tarama için.
  window.__dostDurus = {
    tara: tara, bulgular: bulgular, kurallar: KURALLAR, surum: SURUM,
    siteTara: siteTara, siteAc: siteAc,
    metinTara: function (s) { return kurallariUygula(alintisizMetin(s), s); },
    vurgula: vurgula, vurguTemizle: vurguTemizle,
    // Tek dosya taraması: testler 209 dosyayı indirmeden hedef id'lerini
    // doğrulayabilsin diye açık.
    dosyaTara: function (yol, view, etiket) {
      var bs = [];
      return dosyaTara(yol, view, etiket, bs).then(function () { return bs; });
    },
  };
})();
