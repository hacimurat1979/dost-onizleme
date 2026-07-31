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
(function () {
  "use strict";

  const I18n = window.DostI18n;
  let veri = null, sozu = null, tip = null, acikRef = null;

  function base() { return window.__dostRouteBase || ""; }

  function yukle() {
    if (sozu) return sozu;
    const url = base() + "/data/ibn-arabi/kuran.json";
    const fetcher = (window.DostGraphUtils && window.DostGraphUtils.fetchJson)
      || ((u) => fetch(u).then((r) => r.json()));
    sozu = fetcher(url)
      .then((d) => { veri = d; return d; })
      .catch((e) => { console.warn("Âyet verisi yüklenemedi", e); sozu = null; return null; });
    return sozu;
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
    // Künyenin ÜSTÜNE koyuyoruz; üstte yer yoksa altına düşüyor.
    let x = Math.min(Math.max(8, r.left + r.width / 2 - k.width / 2), window.innerWidth - k.width - 8);
    let y = r.top - k.height - 8;
    if (y < 8) y = r.bottom + 8;
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
      <p class="ayet-tip__kaynak">${esc(ad)} ${esc(ref)}${not ? " " + esc(not) : ""}</p>`;
  }

  function goster(el) {
    const ref = el.getAttribute("data-ayet");
    if (!ref) return;
    acikRef = ref;
    yukle().then(() => {
      if (acikRef !== ref) return;      // bu arada başka bir künyeye geçildi
      const html = icerik(ref);
      if (!html) return;
      const t = ensureTip();
      t.innerHTML = html;
      t.hidden = false;
      konumla(el);
    });
  }

  function gizle() { acikRef = null; if (tip) tip.hidden = true; }

  // Fare + klavye + dokunma. Künyeler metin akışının içinde olduğu için
  // delegasyonla bağlanıyor: yeni bir kısım render edildiğinde tekrar
  // bağlanmaya gerek kalmıyor.
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest && e.target.closest(".ayet-ref");
    if (el) goster(el);
  });
  document.addEventListener("mouseout", (e) => {
    const el = e.target.closest && e.target.closest(".ayet-ref");
    if (el) gizle();
  });
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest(".ayet-ref");
    if (el) { e.preventDefault(); acikRef === el.getAttribute("data-ayet") ? gizle() : goster(el); }
    else gizle();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") gizle(); });
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest && e.target.closest(".ayet-ref");
    if (el) goster(el); else gizle();
  });
  window.addEventListener("scroll", gizle, { passive: true });
})();
