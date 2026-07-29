/* Dost Arabî — duruş taraması.
 *
 * Ne yapar: gizli düzenleme kipi (@revise) açıkken, sayfadaki düz yazı
 * metinlerini CLAUDE.md'de yazılı duruşumuza göre tarar ve uymayabilecek
 * yerlere sarı bir işaret koyar. Kurallar `research/anlayis-evrimi/
 * DURUS_KONTROL.md`'den türetildi; ikisi elle senkron tutulur.
 *
 * Ne YAPMAZ: hiçbir metni değiştirmez, hiçbir şeyi sunucuya göndermez,
 * ve sıradan okuyucuya hiçbir şey göstermez. Bulduğu şey bir iddia değil,
 * bir bakma davetidir -- bu yüzden her işaret susturulabilir.
 *
 * En önemli tek karar: <em> içindeki metin TARANMAZ. Bu sitede alıntılar
 * <em> ile işaretleniyor; Dost'un/Konuk'un/Daphne'nin kendi kesinliği ya
 * da kendi süre ifadesi bizim iddiamız değil (CLAUDE.md'nin "Kapsam DIŞI"
 * maddesi). Bu ayrım olmadan tarama, sitenin her alıntısını yanlışlıkla
 * kendi sözümüz sanardı.
 *
 * Yalnızca önizlemede yayınlanır: sync-to-live.py hem bu dosyayı hem de
 * script etiketini çıkarır ve çıkardığını doğrular.
 */
(function () {
  "use strict";

  var SURUM = "s1";
  var DISMISS_KEY = "dost-durus-susturulan";

  // "Bu bağ bizim" diyen işaretler; birden çok kural buna bakıyor.
  var SAHIPLIK = /\b(biz|bizim|bizce|kuruyoruz|kurduğumuz|kurduk|okuyoruz|okumamız|okuma denemesi|ours|we |our |nossa|nosso|nós)\b/i;

  // Bir isabetin ÖNÜNDE, yakınında bir nakil işareti var mı? Sitede her
  // alıntı <em> ile sarılmıyor -- özellikle esma.json'da "İbn Arabî: '…'"
  // biçiminde düz tırnaklı nakiller var ve Türkçede düz tırnak aynı
  // zamanda kesme işareti olduğu için ("Hakk'ın") onları körlemesine
  // silemiyoruz. Onun yerine nakli, kendinden önce gelen atıf ifadesinden
  // tanıyoruz. Ölçüldü: kapali-ses isabetlerinin çoğu bu türdendi.
  var NAKIL = /(İbn Arabî|İbn Arabi|Dost|Konuk|İzutsu|Affifi|şöyle diyor|şöyle der|buyurur|diyor ki|aktarıyor|nakleder)\s*[:'"“‘]/i;
  function NAKIL_DISI(metin, index) {
    return !NAKIL.test(metin.slice(Math.max(0, index - 160), index));
  }

  // --- Kurallar (DURUS_KONTROL.md s1) ----------------------------------
  // `re` global+ignorecase olmalı: bir paragrafta birden çok isabet
  // sayabilmek için lastIndex sıfırlanarak kullanılıyor.
  var KURALLAR = [
    {
      id: "sure-sisirme", seviye: "kural",
      ad: "Süre şişirme",
      re: /\b(yıllar boyunca|yıllardır|yıllarca|aylardır|uzun süredir|uzun zamandır|for years|for months|for a long time|há anos|há muito|ao longo dos anos)\b/gi,
      neden: "Kendimiz hakkında süre iddiası. CLAUDE.md: “Okuma tarihimiz kısa; uzunmuş gibi yazmak yalandır.”",
      yerine: "Süre değil kapsam yaz: “bu ciltte”, “okuduğumuz bölümlerde”, “şimdiye kadar” — ya da sayı ver.",
    },
    {
      id: "emek-sisirme", seviye: "kural",
      ad: "Emek/ölçek şişirme",
      re: /\b(titizlikle tara|sayısız|binlerce|yüzlerce|büyük bir çabayla|kapsamlı bir tarama|exhaustive|countless|meticulously|incontáveis)/gi,
      neden: "Ölçüsü doğrulanamayan bir emek/ölçek nitelemesi.",
      yerine: "Sayılabilir olanı say; sayamıyorsan niteleme.",
      // Kural yalnız BİZİM hakkımızdaki cümlelerde geçerli. "tek bir
      // Vücûd'un sayısız sûrette göründüğü gibi" bir emek iddiası değil,
      // âlemin tarifi -- ölçtük, isabetlerin çoğu bu türdendi.
      kosul: function (metin) { return SAHIPLIK.test(metin); },
    },
    {
      id: "bilimsel-oncelik", seviye: "kural",
      ad: "Bilimsel öncelik iddiası",
      // Olumsuzlanmış hâli isabet saymıyoruz: sitede bu kalıp çoğu zaman
      // TAM TERSİ için, bir çekince cümlesinde geçiyor ("…önceden görmüş
      // ya da kastetmiş DEĞİL"). Onları işaretlemek taramayı gürültüye
      // boğardı ve tam da doğru yazılmış cümleleri cezalandırırdı.
      re: /(önceden görmüş|öngörmüş|bilim bunu kanıtl|bilim doğrul|modern bilim göster|science confirms|science proves|anticipated modern)(?![^.!?]{0,60}\b(değil|değildir)\b)/gi,
      neden: "CLAUDE.md: “asla ‘İbn Arabî bunu önceden görmüştü’ ya da ‘bilim bunu kanıtlıyor’ gibi bir iddiaya dönüştürülmemeli.”",
      yerine: "“Bize … hatırlatıyor”, “bir çağrışım olarak”.",
    },
    {
      id: "kanit-dili", seviye: "kural",
      ad: "Kanıt dili",
      re: /(kanıtlıyor|kanıtlar ki|ispatlıyor|ispat ediyor|kesin olarak göster|tartışmasız biçimde|\bproves\b|demonstrates conclusively)(?![^.!?]{0,60}\b(değil|değildir)\b)/gi,
      neden: "CLAUDE.md: kapanmış, otoriter bir ses değil; arayan bir ses.",
      yerine: "“Şöyle okuyoruz”, “bu satırlar şuna işaret ediyor olabilir”.",
      esKosul: NAKIL_DISI,
    },
    {
      id: "kapali-ses", seviye: "gozden-gecir",
      ad: "Kapalı ses",
      re: /\b(şüphesiz|kuşkusuz|elbette|besbelli|apaçık|hiç kuşku yok|açıkça görülüyor|undoubtedly|clearly shows|obviously)\b/gi,
      neden: "Kesinlik bildiren bir bağlaç. Kendi sesimizdeyse duruşumuza aykırı.",
      yerine: "Kesinliği kaldır ya da kimin kesinliği olduğunu söyle.",
      esKosul: NAKIL_DISI,
    },
    {
      id: "sarih-hakemligi", seviye: "gozden-gecir",
      ad: "Şârihi hakem yapmak",
      re: /(Konuk|İzutsu|Izutsu|Affifi|Chittick|Corbin)[^.!?]{0,60}?\b(haklı olarak|doğru olarak|doğrusu|isabetle|doğru biçimde|correctly|rightly)\b/gi,
      neden: "CLAUDE.md: şârihler “hakem değil” — onların yorumu da bir okuma.",
      yerine: "“… şöyle okuyor”, “bir yaklaşım olarak”.",
    },
    {
      id: "bag-kimin", seviye: "gozden-gecir",
      ad: "Bağ kimin?",
      // "tıpkı" ve "benzer biçimde" bilerek YOK: bunlar sıradan benzetme
      // sözcükleri ("tıpkı evren gibi") ve kuralı kullanılamaz hâle
      // getiriyorlardı -- ölçtük, 297 isabetin ezici çoğunluğu onlardan
      // geliyordu. Burada aranan şey iki KAYNAĞI birbirine bağlayan bir
      // iddia; o yüzden yalnız o işi yapan ifadeler bırakıldı.
      re: /\b(aynı hareketi|aynı deseni|aynı örüntü|örtüşüyor|örtüşmesi|paralellik|birebir aynı|echoes|parallels)\b/gi,
      // Bu kural tek başına değil: yalnızca bağın sahibi söylenmemişse
      // işaretleniyor (aşağıdaki sahiplikVar kontrolü).
      neden: "İki kaynağı birbirine bağlayan bir cümle, ama bağın bize ait olduğu söylenmemiş.",
      yerine: "“Bağı biz kuruyoruz”, “iki metin birbirine atıf yapmıyor” gibi bir cümle ekle.",
      kosul: function (metin) { return !SAHIPLIK.test(metin); },
    },
  ];

  var SECICI = [
    "#detail-content p", "#detail-content li", "#detail-content blockquote",
    "#futuhat-article p", "#futuhat-article blockquote",
    "#fusus-article p", "#fusus-article blockquote",
    ".hakkinda-content__section p", ".hakkinda-content__subtitle",
    ".tasiyici-intro__p", ".tasiyici-sira p", ".tasiyici-sonnot",
    ".tasiyici-note__body", ".helix-scene__note-body",
  ].join(", ");

  var acikKutu = null;

  // --- yardımcılar ------------------------------------------------------
  function hash(s) {
    // djb2. Susturma anahtarının metne bağlı olması gerekiyor: metin
    // değişince işaret geri gelsin diye.
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

  // Alıntı dışı metin: <em> (ve <blockquote> içi alıntı imleri) çıkarılmış
  // hâli. Konumları korumak için <em> içeriği aynı uzunlukta boşlukla
  // değiştiriliyor -- böylece regex isabetinin indeksi hâlâ anlamlı.
  function alintisizMetin(el) {
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

  // Günlük hayat analojileri taranmıyor: CLAUDE.md'nin "Kapsam DIŞI"
  // maddesi bunları açıkça muaf tutuyor ("yıllarca aynı yoldan geçen biri
  // gibi"). Analoji blokları .detail-analogy sınıfını taşıyor. DİKKAT: bu
  // sınıfı "Bir çekince", "Makamı ve terki" gibi başka etiketler de
  // kullanıyor (bkz. CLAUDE.md) -- yani muafiyet gereğinden biraz geniş.
  // Bilerek böyle: taramanın yanlış susması, yanlış bağırmasından iyidir.
  function muafMi(el) {
    return !!el.closest(".detail-analogy");
  }

  function bulgular(el) {
    if (muafMi(el)) return [];
    var metin = alintisizMetin(el);
    if (metin.replace(/\s+/g, "").length < 40) return [];   // çok kısa: etiket/rozet
    var tam = el.textContent || "";
    var d = susturulanlar();
    var out = [];
    KURALLAR.forEach(function (k) {
      if (k.kosul && !k.kosul(metin)) return;
      k.re.lastIndex = 0;
      var m, esler = [];
      while ((m = k.re.exec(metin)) !== null) {
        if (!k.esKosul || k.esKosul(metin, m.index)) esler.push(m[0].trim());
        if (k.re.lastIndex === m.index) k.re.lastIndex++;   // sıfır uzunluk koruması
      }
      if (!esler.length) return;
      var anahtar = k.id + ":" + hash(tam.replace(/\s+/g, " ").trim());
      if (d[anahtar]) return;
      out.push({ kural: k, esler: esler, anahtar: anahtar });
    });
    return out;
  }

  // --- işaretleme -------------------------------------------------------
  function kutuAc(rozet, bulgu, el) {
    kutuKapat();
    var kutu = document.createElement("div");
    kutu.className = "durus-kutu";
    kutu.innerHTML =
      '<p class="durus-kutu__ad">' + (bulgu.kural.seviye === "kural" ? "🔸" : "🔹")
        + " " + esc(bulgu.kural.ad)
        + ' <span class="durus-kutu__sev">' + (bulgu.kural.seviye === "kural" ? "kural" : "gözden geçir") + "</span></p>"
      + '<p class="durus-kutu__es">' + bulgu.esler.map(function (e) {
          return '<span>' + esc(e) + "</span>";
        }).join(" ") + "</p>"
      + '<p class="durus-kutu__neden">' + esc(bulgu.kural.neden) + "</p>"
      + '<p class="durus-kutu__yerine"><strong>Yerine:</strong> ' + esc(bulgu.kural.yerine) + "</p>"
      + '<div class="durus-kutu__alt">'
      + '<button type="button" data-act="sustur">Bu doğru — işareti kaldır</button>'
      + '<button type="button" data-act="kapat">Kapat</button>'
      + "</div>";
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
      isaretle(el);      // aynı paragrafı yeniden değerlendir
      sayaciGuncelle();
    });
  }
  function kutuKapat() {
    if (acikKutu) { acikKutu.remove(); acikKutu = null; }
  }

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
      rozet.title = b.kural.ad + " — " + b.esler.join(", ");
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
    document.querySelectorAll(".durus-rozet-grup").forEach(function (g) { g.remove(); });
    document.querySelectorAll(".durus-isaretli").forEach(function (el) {
      el.classList.remove("durus-isaretli", "durus-isaretli--kural");
    });
    if (cip) { cip.remove(); cip = null; }
  }

  // --- sayfa başına sayaç ----------------------------------------------
  var cip = null;
  function sayaciGuncelle() {
    var kural = document.querySelectorAll(".durus-rozet--kural").length;
    var gg = document.querySelectorAll(".durus-rozet--gozden-gecir").length;
    if (!kural && !gg) { if (cip) { cip.remove(); cip = null; } return; }
    if (!cip) {
      cip = document.createElement("button");
      cip.type = "button";
      cip.className = "durus-cip";
      cip.title = "Sıradaki duruş uyarısına git (" + SURUM + ")";
      cip.addEventListener("click", sonrakineGit);
      document.body.appendChild(cip);
    }
    cip.innerHTML = (kural ? '<span class="durus-cip__k">🔸 ' + kural + "</span>" : "")
      + (gg ? '<span class="durus-cip__g">🔹 ' + gg + "</span>" : "");
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

  // --- kipe bağlanma ----------------------------------------------------
  // durus-kontrol.js edit-mode.js'e dokunmuyor; sadece body sınıfını
  // izliyor. Böylece iki dosya birbirinden bağımsız kalıyor ve kip
  // kapandığında bütün işaretler kendiliğinden siliniyor.
  var acik = false;
  var icerikGozcusu = null;

  function kipDegisti() {
    var simdi = document.body.classList.contains("dost-edit-mode");
    if (simdi === acik) return;
    acik = simdi;
    if (acik) {
      tara();
      // Detay paneli / kısım metni sonradan çiziliyor; her değişimde
      // yeniden tara. Kendi rozetlerimiz sonsuz döngü kurmasın diye
      // gözcü tarama sırasında duraklatılıyor.
      icerikGozcusu = new MutationObserver(function () {
        icerikGozcusu.disconnect();
        tara();
        icerikGozcusu.observe(document.body, { childList: true, subtree: true });
      });
      icerikGozcusu.observe(document.body, { childList: true, subtree: true });
    } else {
      if (icerikGozcusu) { icerikGozcusu.disconnect(); icerikGozcusu = null; }
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
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") kutuKapat();
  });

  // Testler ve elden tarama için.
  window.__dostDurus = { tara: tara, bulgular: bulgular, kurallar: KURALLAR, surum: SURUM };
})();
