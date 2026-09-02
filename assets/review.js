/**
 * FAZ 4 — Öneri inceleme aracı (review.html).
 *
 * Amaç (plan metni): "Önerilen bağlantıları tek tek gözden geçirebileceğim
 * küçük, yerel, statik bir inceleme sayfası... iki pasajı yan yana göster,
 * neden bağlandığını yaz, onayla/reddet. Kararlar bir JSON'a yazılsın. Bu
 * dosya insan onayının kaydıdır."
 *
 * Statik site kuralı gereği bu sayfa hiçbir şeyi sunucuya YAZAMAZ --
 * kararlar tarayıcıda (localStorage) birikir, "Dışa Aktar" ile bir JSON
 * dosyası olarak indirilir (assets/edit-mode.js'teki export deseniyle
 * aynı), ve o dosya elle research/karar-defteri.json olarak commit edilir.
 * Sayfa açılışında research/karar-defteri.json (varsa) otomatik OKUNUP
 * localStorage'daki boşluklar doldurulur -- böylece bir önceki oturumda
 * committed edilen kararlar kaybolmaz, ama bu oturumdaki TAZE kararların
 * üzerine yazılmaz.
 */
(function () {
  "use strict";

  var LEDGER_KEY = "dost-review-kararlar";
  var LEDGER_URL = "research/karar-defteri.json";

  var KAYNAKLAR = [
    { id: "anlamsal-tr", dosya: "research/anlamsal-komsuluk-tr.json", tip: "pasaj", baslik: "Anlamsal komşuluk — TR" },
    { id: "anlamsal-en", dosya: "research/anlamsal-komsuluk-en.json", tip: "pasaj", baslik: "Anlamsal komşuluk — EN" },
    { id: "anlamsal-pt", dosya: "research/anlamsal-komsuluk-pt.json", tip: "pasaj", baslik: "Anlamsal komşuluk — PT" },
    { id: "kavram", dosya: "research/turetilmis-kenarlar.json", tip: "kavram", baslik: "Kavram ko-okurans (PPMI) — Esmâ/Ontoloji/Terim" },
  ];

  // Ürün denetimi P2 (2026-09-02): önbelleksiz bir fallback tanımlıydı ama
  // review.html'de graph-utils.js her zaman review.js'ten ÖNCE yükleniyor
  // (satır sırası doğrulandı) -- window.DostGraphUtils asla eksik olmuyor,
  // fallback hiç tetiklenmeyen ölü koddu ve varsa da önbelleksiz olduğu
  // için LEDGER_URL/mevcutKaynak.dosya çift indirme riski taşıyordu.
  var fetchJson = window.DostGraphUtils.fetchJson;

  function keyOf(a, b) {
    return [a, b].sort().join("|");
  }

  function loadLedger() {
    try {
      return JSON.parse(localStorage.getItem(LEDGER_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveLedger(ledger) {
    try {
      localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    } catch (e) {}
  }
  function ledgerKey(kaynakId, anahtar) {
    return kaynakId + "::" + anahtar;
  }

  var ledger = loadLedger();

  // Sayfa açılışında, daha önce commit edilmiş karar defterini oku ve
  // yalnız localStorage'da HENÜZ karşılığı olmayan anahtarları doldur.
  fetchJson(LEDGER_URL)
    .then(function (d) {
      var degisti = false;
      (d.kararlar || []).forEach(function (k) {
        var lk = ledgerKey(k.kaynak, k.anahtar);
        if (!(lk in ledger)) {
          ledger[lk] = { onay: k.onay, not: k.not || "", zaman: k.zaman || "" };
          degisti = true;
        }
      });
      if (degisti) { saveLedger(ledger); render(); }
    })
    .catch(function () { /* henüz commit edilmiş bir defter yok -- normal */ });

  function normalizePasaj(kaynakId, ciftler) {
    return (ciftler || []).map(function (c) {
      var anahtar = keyOf(c.a.kisim, c.b.kisim);
      return {
        kaynakId: kaynakId, tip: "pasaj", anahtar: anahtar,
        skorEtiket: "kosinüs", skor: c.skor,
        a: { baslik: c.a.baslik, route: c.a.route, metin: c.a.metin },
        b: { baslik: c.b.baslik, route: c.b.route, metin: c.b.metin },
        dosyaOnay: c.onay,
      };
    });
  }

  function normalizeKavram(kaynakId, kenarlar) {
    return (kenarlar || []).map(function (k) {
      var anahtar = keyOf(k.a.kaynak + ":" + k.a.id, k.b.kaynak + ":" + k.b.id);
      return {
        kaynakId: kaynakId, tip: "kavram", anahtar: anahtar,
        skorEtiket: "PPMI", skor: k.ppmi, ortakBelge: k.birlikte_belge,
        a: { baslik: k.a.ad, route: null, metin: "(" + k.a.kaynak + ")" },
        b: { baslik: k.b.ad, route: null, metin: "(" + k.b.kaynak + ")" },
        dosyaOnay: k.onay,
      };
    });
  }

  var mevcutKaynak = KAYNAKLAR[0];
  var mevcutAday = [];
  var kuyrukIndex = 0;

  var kaynakSec = document.getElementById("review-kaynak-sec");
  var filtreSec = document.getElementById("review-filtre-sec");
  var listEl = document.getElementById("review-list");
  var progressEl = document.getElementById("review-progress");

  KAYNAKLAR.forEach(function (k) {
    var opt = document.createElement("option");
    opt.value = k.id;
    opt.textContent = k.baslik;
    kaynakSec.appendChild(opt);
  });

  function kararOf(aday) {
    var lk = ledgerKey(aday.kaynakId, aday.anahtar);
    if (ledger[lk]) return ledger[lk];
    if (aday.dosyaOnay === true || aday.dosyaOnay === false) {
      return { onay: aday.dosyaOnay, not: "", zaman: "" };
    }
    return null;
  }

  function karar(aday, onay, not) {
    var lk = ledgerKey(aday.kaynakId, aday.anahtar);
    ledger[lk] = { onay: onay, not: not || "", zaman: new Date().toISOString() };
    saveLedger(ledger);
  }

  function kaynakYukle(id) {
    mevcutKaynak = KAYNAKLAR.filter(function (k) { return k.id === id; })[0];
    kuyrukIndex = 0;
    listEl.innerHTML = '<p class="review-empty">Yükleniyor…</p>';
    fetchJson(mevcutKaynak.dosya)
      .then(function (d) {
        mevcutAday = mevcutKaynak.tip === "pasaj"
          ? normalizePasaj(mevcutKaynak.id, d.ciftler)
          : normalizeKavram(mevcutKaynak.id, d.kenarlar);
        render();
      })
      .catch(function (e) {
        listEl.innerHTML = '<p class="review-empty">' + mevcutKaynak.dosya + " yüklenemedi: " + e.message +
          "<br>Bu sayfa yalnız yerelden (python3 -m http.server) çalıştırıldığında research/ dosyalarına erişebilir.</p>";
      });
  }

  function pasajBaslikHtml(taraf) {
    if (!taraf.route) return "<h3>" + escapeHtml(taraf.baslik) + "</h3>";
    return '<h3><a href="' + taraf.route + '" target="_blank" rel="noopener">' + escapeHtml(taraf.baslik) + " ↗</a></h3>";
  }

  // Ürün denetimi D1 (2026-09-02): ortak yardımcıya taşındı, bkz.
  // graph-utils.js:escapeHtml (aynı gerekçe: DOM tekniği " kaçırmıyordu,
  // burada zararsızdı ama tek fonksiyona taşırken en güvenli seçildi).
  var escapeHtml = window.DostGraphUtils.escapeHtml;

  function cardHtml(aday, karar_, salt) {
    var skorTxt = aday.skorEtiket + ": " + (typeof aday.skor === "number" ? aday.skor.toFixed(3) : aday.skor);
    if (aday.ortakBelge != null) skorTxt += " · ortak belge: " + aday.ortakBelge;
    var badge = karar_ ? '<span class="review-done-badge" data-onay="' + karar_.onay + '">' + (karar_.onay ? "onaylandı" : "reddedildi") + "</span>" : "";
    var actions = salt
      ? '<div class="review-actions"><button type="button" data-act="geri-al">Geri Al (bekleyene döndür)</button></div>'
      : ('<div class="review-actions">' +
          '<button type="button" data-act="onayla">Onayla <kbd>A</kbd></button>' +
          '<button type="button" data-act="reddet">Reddet <kbd>R</kbd></button>' +
          '<button type="button" data-act="atla">Atla <kbd>S</kbd></button>' +
          "</div>" +
          '<input type="text" class="review-note" placeholder="Not (opsiyonel — neden onayladın/reddettin)">');
    return (
      '<div class="review-card" data-kaynak="' + aday.kaynakId + '" data-anahtar="' + encodeURIComponent(aday.anahtar) + '">' +
      '<div class="meta-row"><span>' + skorTxt + "</span>" + badge + "</div>" +
      '<div class="review-pair">' +
      '<div class="review-side">' + pasajBaslikHtml(aday.a) + "<p>" + escapeHtml(aday.a.metin) + "</p></div>" +
      '<div class="review-side">' + pasajBaslikHtml(aday.b) + "<p>" + escapeHtml(aday.b.metin) + "</p></div>" +
      "</div>" +
      '<p class="review-why">' + (aday.tip === "pasaj"
        ? "Neden önerildi: iki pasajın anlamsal gömme (embedding) vektörleri arasında yüksek kosinüs benzerliği ölçüldü — bu Dost'un aynı fikri iki yerde söylediği anlamına GELMEZ, yalnız bir adaydır."
        : "Neden önerildi: bu iki kavram, okuduğumuz bölümlerin beklenenden fazlasında birlikte geçiyor (PPMI) — Dost'un bunları ilişkilendirdiği anlamına GELMEZ, yalnız bir ölçümdür.") +
      "</p>" +
      actions +
      "</div>"
    );
  }

  function bekleyenler() {
    return mevcutAday.filter(function (a) { return !kararOf(a); });
  }

  function render() {
    var filtre = filtreSec.value;
    var toplam = mevcutAday.length;
    var bekleyenSayi = bekleyenler().length;
    progressEl.textContent = toplam
      ? (toplam - bekleyenSayi) + " / " + toplam + " incelendi (" + bekleyenSayi + " bekliyor)"
      : "";

    if (filtre === "bekleyen") {
      var kalan = bekleyenler();
      if (!kalan.length) {
        listEl.innerHTML = toplam
          ? '<p class="review-empty">Bu kaynakta bekleyen aday kalmadı. "Göster" menüsünden onaylanan/reddedilenleri gözden geçirebilir ya da "Dışa Aktar" ile karar defterini indirebilirsin.</p>'
          : '<p class="review-empty">Yükleniyor…</p>';
        return;
      }
      var aday = kalan[0];
      listEl.innerHTML = cardHtml(aday, null, false);
      wireActiveCard(aday);
      return;
    }

    var gosterilecek = mevcutAday.filter(function (a) {
      var k = kararOf(a);
      if (filtre === "hepsi") return true;
      if (filtre === "onaylanan") return k && k.onay === true;
      if (filtre === "reddedilen") return k && k.onay === false;
      return true;
    });
    if (!gosterilecek.length) {
      listEl.innerHTML = '<p class="review-empty">Bu filtreye uyan bir aday yok.</p>';
      return;
    }
    listEl.innerHTML = gosterilecek.map(function (a) {
      return cardHtml(a, kararOf(a), true);
    }).join("");
    Array.prototype.forEach.call(listEl.querySelectorAll('[data-act="geri-al"]'), function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest(".review-card");
        var lk = ledgerKey(card.dataset.kaynak, decodeURIComponent(card.dataset.anahtar));
        delete ledger[lk];
        saveLedger(ledger);
        render();
      });
    });
  }

  function wireActiveCard(aday) {
    var card = listEl.querySelector(".review-card");
    if (!card) return;
    var noteInput = card.querySelector(".review-note");
    function act(onay) {
      karar(aday, onay, noteInput ? noteInput.value.trim() : "");
      render();
    }
    card.querySelector('[data-act="onayla"]').addEventListener("click", function () { act(true); });
    card.querySelector('[data-act="reddet"]').addEventListener("click", function () { act(false); });
    card.querySelector('[data-act="atla"]').addEventListener("click", function () {
      // atla: karar YAZMADAN kuyruğun sonuna atar (bu oturum için) --
      // bir sonraki sayfa yüklemesinde tekrar en başta çıkar.
      mevcutAday.splice(mevcutAday.indexOf(aday), 1);
      mevcutAday.push(aday);
      render();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (filtreSec.value !== "bekleyen") return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    var card = listEl.querySelector(".review-card");
    if (!card) return;
    if (e.key === "a" || e.key === "A") card.querySelector('[data-act="onayla"]').click();
    else if (e.key === "r" || e.key === "R") card.querySelector('[data-act="reddet"]').click();
    else if (e.key === "s" || e.key === "S") card.querySelector('[data-act="atla"]').click();
  });

  kaynakSec.addEventListener("change", function () { kaynakYukle(kaynakSec.value); });
  filtreSec.addEventListener("change", render);

  document.getElementById("review-export-btn").addEventListener("click", function () {
    var kararlar = Object.keys(ledger).map(function (lk) {
      var idx = lk.indexOf("::");
      var kaynak = lk.slice(0, idx), anahtar = lk.slice(idx + 2);
      var v = ledger[lk];
      return { kaynak: kaynak, anahtar: anahtar, onay: v.onay, not: v.not, zaman: v.zaman };
    });
    var payload = {
      uretim: "review.html (elle, insan kararı)",
      not: "Bu dosya insan onayının kaydıdır. FAZ 4 -- research/karar-defteri.json olarak commit edilmeli.",
      tarih: new Date().toISOString(),
      toplam_karar: kararlar.length,
      kararlar: kararlar,
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "karar-defteri-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  document.getElementById("review-import-btn").addEventListener("click", function () {
    document.getElementById("review-import-file").click();
  });
  document.getElementById("review-import-file").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var d = JSON.parse(reader.result);
        (d.kararlar || []).forEach(function (k) {
          ledger[ledgerKey(k.kaynak, k.anahtar)] = { onay: k.onay, not: k.not || "", zaman: k.zaman || "" };
        });
        saveLedger(ledger);
        render();
      } catch (err) {
        alert("Dosya okunamadı: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  kaynakYukle(mevcutKaynak.id);
})();
