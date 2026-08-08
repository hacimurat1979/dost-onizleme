// Âyet künyesi önizlemesi.
//
// Metinde geçen alıntıların ardına küçük bir künye koyuyoruz:
//     <span class="ayet-ref" data-ayet="7:143">A'râf 7:143</span>
// 2026-07-31 taraması şunu ölçtü: `kuran.json` sitede HİÇBİR yerden
// çağrılmıyordu, yani `data-ayet` özniteliği tamamen atıldı ve künye yalnız
// bir metin etiketiydi. Okuyucu "A'râf 7:143" görüp o âyetin ne dediğini
// bilmiyorsa hiçbir şey kazanmıyor.
//
// Bu modül ikisini birleştiriyor: künyeye gelince (ya da dokununca) âyetin
// Arapça aslı ve meali çıkıyor. Veri TEMBEL yükleniyor — sayfada hiç künye
// yoksa ya da kimse künyeye dokunmadıysa `kuran.json` hiç indirilmiyor.
// Dosya 73 KB; site açılışına eklenmemesi için bu şart.
//
// DURUŞ NOTU: kutuda gösterilen şey Kur'ân'ın kendisi ve bir meal; bizim
// yorumumuz değil. O yüzden kutuda hiçbir açıklama/çıkarım yok, yalnız metin
// ve kaynağı. Meal quran-json'dan geliyor ve Portekizcesi YOK; pt seçiliyken
// İngilizce meal gösterilip bu açıkça söyleniyor — sessizce başka bir dile
// kaydırmak, "yaptığımız işi olduğundan farklı göstermemek" kuralına aykırı
// olurdu.
//
// A1 (2026-07-31): künye artık TERS yönde de çalışıyor — aynı âyetin başka
// hangi kısımlarda geçtiğini gösteriyor (data/ibn-arabi/ayet-dizini.json,
// bkz. scripts/ayet-dizini-uret.py). Bu, kutuya ilk tıklanabilir içeriği
// getirdi; bu yüzden eski "fareyi künyeden ayırınca hemen kapat" davranışı
// artık yanlış -- kullanıcı fareyi kutuya taşırken künyeden ayrılmak
// ZORUNDA, ve o an tetiklenen mouseout kutuyu o kişi linke ulaşamadan
// kapatıyordu. gizlemeyiErtele() bunu kısa bir gecikmeyle çözüyor.
//
// A2 (2026-07-31): aynı kutu artık tekrarlayan kutsî hadisler için de
// çalışıyor (<span class="hadis-ref" data-hadis="kalb">), ama BİLEREK
// daha az iddia ediyor -- kuran.json gibi doğrulanmış bir kaynağımız
// hadis için yok, bu hadisin senedi de hadis usulünde tartışmalıdır.
// Kutu yalnız "bu ifade sitede şu kısımlarda da geçiyor" diyor; Arapça
// asıl ya da sahihlik iddiası YOK. Bkz. data/ibn-arabi/hadis-dizini.json.
(function () {
  "use strict";

  const I18n = window.DostI18n;
  let veri = null, sozu = null, tip = null, acikRef = null, acikTur = null;
  let dizin = null, dizinSozu = null;
  let hadisDizin = null, hadisDizinSozu = null;

  function base() { return window.__dostRouteBase || ""; }
  const fetcher = (window.DostGraphUtils && window.DostGraphUtils.fetchJson)
    || ((u) => fetch(u).then((r) => r.json()));

  function yukle() {
    if (sozu) return sozu;
    sozu = fetcher(base() + "/data/ibn-arabi/kuran.json")
      .then((d) => { veri = d; return d; })
      .catch((e) => { console.warn("Âyet verisi yüklenemedi", e); sozu = null; return null; });
    return sozu;
  }

  // Ters dizin (A1, 2026-07-31): aynı âyetin başka hangi kısımlarda
  // geçtiğini gösteriyor. Dost'un yöntemi tam olarak bu -- aynı âyeti
  // farklı bölümlerde farklı mertebeden yeniden okumak (bkz. CLAUDE.md
  // üçüncü ilke). Ayrı dosya, ayrı tembel yükleme: künyelerin çoğu (51'in
  // 48'i) tek yerde geçiyor ve bu durumda dizine hiç ihtiyaç yok.
  function yukleDizin() {
    if (dizinSozu) return dizinSozu;
    dizinSozu = fetcher(base() + "/data/ibn-arabi/ayet-dizini.json")
      .then((d) => { dizin = (d && d.dizin) || {}; return dizin; })
      .catch((e) => { console.warn("Âyet dizini yüklenemedi", e); dizinSozu = null; return {}; });
    return dizinSozu;
  }

  function yukleHadisDizin() {
    if (hadisDizinSozu) return hadisDizinSozu;
    hadisDizinSozu = fetcher(base() + "/data/ibn-arabi/hadis-dizini.json")
      .then((d) => { hadisDizin = (d && d.dizin) || {}; return hadisDizin; })
      .catch((e) => { console.warn("Hadis dizini yüklenemedi", e); hadisDizinSozu = null; return {}; });
    return hadisDizinSozu;
  }

  // Şu an açık künyenin hangi kısımda olduğunu URL'den çıkarır (örn.
  // "futuhat/c1k9"), kendi kısmına bağlantı vermemek için.
  function currentPartKey() {
    const b = base();
    let path = location.pathname;
    if (b && path.startsWith(b)) path = path.slice(b.length);
    return path.replace(/^\/+|\/+$/g, "");
  }

  function digerYerlerHtml(liste, baslikDict) {
    const burada = currentPartKey();
    const diger = (liste || []).filter((e) => `${e.view}/${e.id}` !== burada);
    if (!diger.length) return "";
    const lang = I18n ? I18n.getLang() : "tr";
    const baslik = I18n.pick3(baslikDict);
    const linkler = diger.map((e) => {
      const ad = (e.title && (e.title[lang] || e.title.tr)) || e.id;
      const href = window.__dostNav ? window.__dostNav.href(e.view, e.id) : (base() + e.route);
      return `<a class="cross-link ayet-tip__digeri" href="${esc(href)}" data-view="${esc(e.view)}" data-id="${esc(e.id)}">${esc(ad)}</a>`;
    }).join("");
    return `<p class="ayet-tip__digerleri-baslik">${esc(baslik)}</p>${linkler}`;
  }

  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "node-hover-tip node-hover-tip--fixed ayet-tip";
    tip.hidden = true;
    document.body.appendChild(tip);
    return tip;
  }

  function konumla(el) {
    if (!tip || tip.hidden) return;
    const r = el.getBoundingClientRect();
    const k = tip.getBoundingClientRect();
    // Künyenin ÜSTÜNE koyuyoruz; üstte yer yoksa altına düşüyor. İkisi de
    // dikeyde ekran dışına taşabiliyordu (2026-08-02 kullanıcı bildirimi:
    // özellikle çok künyeli sayfalarda -- /ayethadis, kavram sayfaları --
    // künye ekranın alt kenarına yakınken alta düşen kutu taşıyordu) --
    // şimdi hem üst hem alt kenara clamp uygulanıyor, yatay ile aynı mantık.
    let x = Math.min(Math.max(8, r.left + r.width / 2 - k.width / 2), window.innerWidth - k.width - 8);
    let y = r.top - k.height - 8;
    if (y < 8) y = r.bottom + 8;
    y = Math.min(y, window.innerHeight - k.height - 8);
    y = Math.max(y, 8);
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
    ));
  }

  function icerik(ref) {
    const a = veri && veri.ayetler && veri.ayetler[ref];
    if (!a) return null;
    const lang = I18n ? I18n.getLang() : "tr";
    const meal = a.meal || {};
    // pt yok: quran-json Portekizce içermiyor. Yedek sıra lang -> en -> tr.
    // NOT gerçekten kullanılan dili söyler. İlk sürümde yedek tr'ye düşüyor
    // ama not "İngilizce" diyordu — kendi kendine yalan söyleyen bir uyarı,
    // yani uyarının koruduğu şeyin tam tersi.
    const mealDili = meal[lang] ? lang : (meal.en ? "en" : (meal.tr ? "tr" : null));
    const govde = mealDili ? meal[mealDili] : "";
    const DIL_ADI = {
      tr: { tr: "Türkçe", en: "Turkish", pt: "turco" },
      en: { tr: "İngilizce", en: "English", pt: "inglês" },
    };
    const not = (mealDili && mealDili !== lang)
      ? I18n.pick3({
          tr: `(meal ${DIL_ADI[mealDili].tr} — bu dilde meal elimizde yok)`,
          en: `(translation in ${DIL_ADI[mealDili].en} — we have none in this language)`,
          pt: `(tradução em ${DIL_ADI[mealDili].pt} — não temos nenhuma neste idioma)`,
        })
      : "";
    const sureNo = parseInt(ref.split(":")[0], 10);
    const sure = (veri.sureler || []).find((s) => s.no === sureNo);
    const ad = sure ? (sure.ad && (sure.ad[lang] || sure.ad.tr)) : "";
    return `
      <p class="ayet-tip__ar" dir="rtl" lang="ar">${esc(a.ar || "")}</p>
      <p class="ayet-tip__meal">${esc(govde)}</p>
      <p class="ayet-tip__kaynak">${esc(ad)} ${esc(ref)}${not ? " " + esc(not) : ""}</p>
      ${digerYerlerHtml((dizin && dizin[ref]) || [], {
        tr: "Bu âyet burada da geçiyor", en: "This verse also appears here", pt: "Este versículo também aparece aqui",
      })}`;
  }

  // Hadis kutusu âyet kutusundan BİLEREK daha az söylüyor: Arapça asıl
  // yok, sahihlik iddiası yok -- yalnız tekrar eden yerleri gösteriyor.
  function hadisIcerik(anahtar) {
    const liste = (hadisDizin && hadisDizin[anahtar]) || [];
    if (!liste.length) return null;
    const baslik = I18n.pick3({
      tr: "Tekrarlayan bir kutsî hadis", en: "A recurring sacred saying", pt: "Um dito sagrado recorrente",
    });
    const digerHtml = digerYerlerHtml(liste, {
      tr: "Bu ifade sitede şurada da geçiyor", en: "This wording also appears here", pt: "Esta formulação também aparece aqui",
    });
    if (!digerHtml) return null;   // yalnız kendi kısmındaysa gösterecek bir şey yok
    return `<p class="hadis-tip__baslik">${esc(baslik)}</p>${digerHtml}`;
  }

  function goster(el) {
    const ref = el.getAttribute("data-ayet");
    const hadis = el.getAttribute("data-hadis");
    if (ref) {
      acikRef = ref; acikTur = "ayet";
      Promise.all([yukle(), yukleDizin()]).then(() => {
        if (acikRef !== ref || acikTur !== "ayet") return;   // bu arada başka bir künyeye geçildi
        const html = icerik(ref);
        if (!html) return;
        const t = ensureTip();
        t.innerHTML = html;
        t.hidden = false;
        konumla(el);
      });
    } else if (hadis) {
      acikRef = hadis; acikTur = "hadis";
      yukleHadisDizin().then(() => {
        if (acikRef !== hadis || acikTur !== "hadis") return;
        const html = hadisIcerik(hadis);
        if (!html) return;
        const t = ensureTip();
        t.innerHTML = html;
        t.hidden = false;
        konumla(el);
      });
    }
  }

  function isaretEl(target) {
    return target.closest && (target.closest(".ayet-ref") || target.closest(".hadis-ref"));
  }
  function isaretAnahtari(el) {
    return el.getAttribute("data-ayet") || el.getAttribute("data-hadis");
  }

  let gizleZamanlayici = null;
  function gizle() {
    if (gizleZamanlayici) { clearTimeout(gizleZamanlayici); gizleZamanlayici = null; }
    acikRef = null; acikTur = null;
    if (tip) tip.hidden = true;
  }
  // Kutu artık tıklanabilir bağlantı taşıyabiliyor (A1: "burada da geçiyor").
  // Fareyi künyeden kutuya doğru hareket ettirirken önce künyeden AYRILMAK
  // gerekiyor -- anında gizle() çağıran eski davranış kutuyu kullanıcı daha
  // ulaşamadan kapatıyordu. Kısa bir gecikmeyle erteleniyor; kutunun
  // kendisine girilirse iptal ediliyor.
  function gizlemeyiErtele() {
    if (gizleZamanlayici) clearTimeout(gizleZamanlayici);
    gizleZamanlayici = setTimeout(gizle, 220);
  }

  // Fare + klavye + dokunma. Künyeler/işaretler metin akışının içinde
  // olduğu için delegasyonla bağlanıyor: yeni bir kısım render edildiğinde
  // tekrar bağlanmaya gerek kalmıyor.
  document.addEventListener("mouseover", (e) => {
    const el = isaretEl(e.target);
    if (el) { if (gizleZamanlayici) { clearTimeout(gizleZamanlayici); gizleZamanlayici = null; } goster(el); }
    else if (tip && e.target.closest && e.target.closest(".ayet-tip")) {
      if (gizleZamanlayici) { clearTimeout(gizleZamanlayici); gizleZamanlayici = null; }
    }
  });
  document.addEventListener("mouseout", (e) => {
    const el = isaretEl(e.target);
    const kutu = e.target.closest && e.target.closest(".ayet-tip");
    if (el || kutu) gizlemeyiErtele();
  });
  document.addEventListener("click", (e) => {
    const el = isaretEl(e.target);
    if (el) {
      e.preventDefault();
      // Fare tıklaması önce focusin'i tetikler (el odaklanılabilir), o da
      // goster()'ı çağırıp acikRef'i SENKRON olarak ayarlar -- kutu içerik
      // gelmeden (asenkron) henüz görünür olmadan. Burada yalnız acikRef'e
      // bakılsaydı, focusin'in az önce açtığı kutuyu click hemen kapatırdı
      // (kutu hiç görünür olmadan) -- dokunmatik cihazlarda özellik hiç
      // çalışmıyordu. Yalnız kutu GERÇEKTEN görünürse "kapat" sayılıyor.
      const acik = tip && !tip.hidden && acikRef === isaretAnahtari(el);
      acik ? gizle() : goster(el);
    }
    else gizle();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") gizle(); });
  document.addEventListener("focusin", (e) => {
    const el = isaretEl(e.target);
    if (el) goster(el); else gizle();
  });
  window.addEventListener("scroll", gizle, { passive: true });
})();
