(function () {
  "use strict";

  // FAZ 1 (grafik-önce arayüz, 2026-08-03): 14 bölüm sekmesi ☰ çekmecesine
  // taşındı (bkz. index.html'deki yorum). Bu dosya yalnız çekmecenin AÇILIP
  // KAPANMASINI ve ☰ yanındaki "neredeyim" etiketini yönetir — gezinmenin
  // kendisi (hangi düğme hangi görünümü açar, aktif işaretleme) eskisi gibi
  // tamamen ontology.js'te; düğme id'lerine dokunulmadı.
  const toggle = document.getElementById("nav-toggle");
  const drawer = document.getElementById("nav-drawer");
  if (!toggle || !drawer) return;
  const label = document.getElementById("nav-toggle-label");

  // ☰ yanında o an açık bölümün adı yazar — menü gizlendiği için "neredeyim"
  // sorusunun tek kalıcı cevabı bu. Aktif düğmeyi ontology.js işaretliyor
  // (btn-ghost--active); biz yalnız izliyoruz. MutationObserver hem sınıf
  // değişimini (görünüm değişti) hem metin değişimini (dil değişti,
  // applyStatic textContent'i yeniden yazar) yakalar.
  // NOT (2026-08-03): burada bir süre, çekmecede karşılığı OLMAYAN görünümler
  // için ("hangi sarmalayıcı görünürse onun adını yaz") ek bir katman vardı.
  // Tek tüketicisi kaldırılan Tenezzül pilotuydu; tüketicisiz kalınca
  // silindi. Yeniden böyle bir görünüm eklenirse (nav'da olmayan bir bölüm)
  // aynı katman gerekecek: aksi hâlde ☰ etiketi bir ÖNCEKİ bölümün adında
  // asılı kalır ve kullanıcıya nerede olduğu hakkında yanlış bilgi verir --
  // yanlış etiket, hiç etiket olmamasından kötüdür.
  function updateLabel() {
    if (!label) return;
    const active = drawer.querySelector(".btn-ghost--active");
    if (active) label.textContent = active.textContent.trim();
  }
  new MutationObserver(updateLabel).observe(drawer, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    characterData: true,
  });
  updateLabel();

  // GRUP COLLAPSE (2026-08-05, 2026-08-17 @revise: her ekranda varsayılan
  // kapalı). Nav konsolidasyonu drawer'ı 22 girdiden ~16'ya indirdi ve
  // altı gruba topladı -- bu hâlâ, çekmecenin kendi max-height:auto
  // kutusunda uzun bir kaydırma demek. Gruplar ekran boyutundan bağımsız
  // varsayılan KAPALI başlıyor, kullanıcının ŞU AN İÇİNDE olduğu grup
  // hariç -- deep-link'le doğrudan örn. /hocalar/'a gelen biri kendi
  // bölümünü kapalı bulmasın diye.
  //
  // Başlık gerçek bir <button> DEĞİL (<p role="button">): drawer'ın
  // "bir düğmeye tıklayınca kapan" dinleyicisi (aşağıda) closest("button")
  // arıyor; gerçek buton olsaydı grup her açılışta çekmeceyi de kapatırdı.
  function wireGroupCollapse() {
    const gruplar = [...drawer.querySelectorAll(".nav-drawer__group")]
      .map((g) => ({ g, baslik: g.querySelector('.nav-drawer__heading[role="button"]') }))
      .filter((x) => x.baslik);
    if (!gruplar.length) return;

    const collapseByDefault = true;

    function ayarla(entry, kapali) {
      entry.g.classList.toggle("nav-drawer__group--collapsed", kapali);
      entry.baslik.setAttribute("aria-expanded", String(!kapali));
    }
    function ac(entry) { ayarla(entry, false); }
    function kapat(entry) { ayarla(entry, true); }
    function ters(entry) { ayarla(entry, entry.g.classList.contains("nav-drawer__group--collapsed") ? false : true); }

    gruplar.forEach((entry) => {
      const icindeAktifVar = !!entry.g.querySelector(".btn-ghost--active");
      ayarla(entry, collapseByDefault && !icindeAktifVar);
      entry.baslik.addEventListener("click", () => ters(entry));
      entry.baslik.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ters(entry); }
      });
    });

    // Görünüm değişince (ör. akraba-sekme pill'inden ya da drawer'ın
    // kendisinden), o an aktif düğmeyi taşıyan grup varsa açılsın --
    // kullanıcı gezinirken kendi bulunduğu bölümün katlanmış kalması
    // kafa karıştırırdı.
    new MutationObserver(() => {
      gruplar.forEach((entry) => {
        if (entry.g.querySelector(".btn-ghost--active")) ac(entry);
      });
    }).observe(drawer, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  wireGroupCollapse();

  function open() {
    drawer.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    const first = drawer.querySelector(".btn-ghost--active") || drawer.querySelector("button");
    if (first) first.focus();
  }
  function close(focusToggle) {
    if (drawer.hidden) return;
    drawer.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (focusToggle) toggle.focus();
  }

  toggle.addEventListener("click", () => {
    if (drawer.hidden) open();
    else close();
  });
  // Bir bölüme tıklanınca çekmece kapanır — gezinme ontology.js'in aynı
  // click dinleyicisiyle zaten gerçekleşiyor (iki dinleyici, tek tık).
  drawer.addEventListener("click", (e) => {
    if (e.target.closest("button")) close();
  });
  document.addEventListener("click", (e) => {
    if (!drawer.hidden && !drawer.contains(e.target) && !toggle.contains(e.target)) close();
  });
  // Escape artık burada değil, GU.registerStepBack'in merkezi sırasında --
  // iki katman aynı anda açıkken tek Escape'in hepsini kapatmaması için.
  if (window.DostGraphUtils) {
    window.DostGraphUtils.registerStepBack("nav-drawer", () => { close(true); return true; });
  }

  // --- Fütûhât+Füsûs birleşik okuma ilerlemesi ----------------------------
  // Tek halka, ortak bir tepe noktasından (saat 12 yönü) iki yöne büyüyen
  // yarım-yay: Fütûhât sola, Füsûs sağa. Alt nokta (saat 6) ikisi de
  // tamamlanınca halkanın kapandığı yer -- "O'ndan geldik, O'na gidiyoruz"
  // ilkesinin bu küçük göstergeye yansıması (bkz. CLAUDE.md "Daire ve
  // merkez"). Okunan dilim tam opak (--series-theme), kalan dilim AYNI
  // renk ama soluk -- GORSEL_DIL.md'nin sabit "Matlık = Perdelenme"
  // eşlemesi; iç içe eşmerkezli halka YOK, tek yarıçap. Veri
  // data/ibn-arabi/okuma-durumu.json'dan -- karşılama "Neredeyiz"
  // özetiyle paylaşılan aynı küçük kaynak (bkz. assets/kavram.js'teki aynı
  // yorum: futuhat-atlas-index.json/fusus-atlas.json burada da ağır
  // kalırdı). Bu dosyaya (nav-drawer.js) konması bilinçli: iki kitabın
  // düğmeleri zaten burada yan yana ve dosya her sayfada tek sefer
  // yükleniyor -- futuhat.js/fusus.js'in kendi "Neredeyim" alanına
  // konsaydı iki kitabı BİRDEN gösteren tek bir gösterge için o iki
  // dosyayı birbirine bağımlı hâle getirmek gerekirdi.
  function wireOkumaIlerleme() {
    const el = document.getElementById("okuma-ilerleme");
    if (!el || !window.DostGraphUtils) return;
    window.DostGraphUtils.fetchJson("data/ibn-arabi/okuma-durumu.json").then((veri) => {
      if (!veri || !veri.futuhat || !veri.fusus) return;
      const cx = 12, cy = 12, r = 9;
      const tepe = -Math.PI / 2; // saat 12
      function yay(a0, a1) {
        const x0 = (cx + r * Math.cos(a0)).toFixed(2), y0 = (cy + r * Math.sin(a0)).toFixed(2);
        const x1 = (cx + r * Math.cos(a1)).toFixed(2), y1 = (cy + r * Math.sin(a1)).toFixed(2);
        const sweep = a1 > a0 ? 1 : 0;
        const buyukYay = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
        return `M ${x0} ${y0} A ${r} ${r} 0 ${buyukYay} ${sweep} ${x1} ${y1}`;
      }
      const fOran = Math.max(0, Math.min(1, veri.futuhat.done / veri.futuhat.total));
      const suOran = Math.max(0, Math.min(1, veri.fusus.done / veri.fusus.total));
      // Fütûhât: tepeden SOLA (açı azalarak) büyür. Füsûs: tepeden SAĞA
      // (açı artarak) büyür. İkisi de alt noktada (tepe ± π) biter.
      const fBitis = tepe - fOran * Math.PI;
      const suBitis = tepe + suOran * Math.PI;
      const segments = [
        ["okuma-ilerleme__seg", yay(tepe, fBitis)],
        ["okuma-ilerleme__seg okuma-ilerleme__seg--soluk", yay(fBitis, tepe - Math.PI)],
        ["okuma-ilerleme__seg", yay(tepe, suBitis)],
        ["okuma-ilerleme__seg okuma-ilerleme__seg--soluk", yay(suBitis, tepe + Math.PI)],
      ];
      const svg = `<svg class="okuma-ilerleme__ring" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">`
        + segments.map(([cls, d]) => `<path class="${cls}" fill="none" d="${d}"></path>`).join("")
        + `</svg>`;
      const etiket = `<span class="okuma-ilerleme__label">${veri.futuhat.done}/${veri.futuhat.total} · ${veri.fusus.done}/${veri.fusus.total}</span>`;
      el.innerHTML = svg + etiket;
      el.dataset.trTitle = `Fütûhât ${veri.futuhat.done}/${veri.futuhat.total} kısım, Füsûs ${veri.fusus.done}/${veri.fusus.total} fass okundu`;
      el.dataset.enTitle = `Futuhat ${veri.futuhat.done}/${veri.futuhat.total} parts, Fusus ${veri.fusus.done}/${veri.fusus.total} bezels read`;
      el.dataset.ptTitle = `Futuhat ${veri.futuhat.done}/${veri.futuhat.total} partes, Fusus ${veri.fusus.done}/${veri.fusus.total} engastes lidos`;
      const lang = window.DostI18n ? window.DostI18n.getLang() : "tr";
      const baslik = el.dataset[lang + "Title"] || el.dataset.enTitle;
      el.setAttribute("title", baslik);
      el.setAttribute("aria-label", baslik);
      el.hidden = false;
    }).catch(() => {
      // Sessizce atlanır -- futuhat.js'in kendi yoğunluk halkasıyla aynı
      // ilke: ölçü bir süs değil ama onsuz da sayfa çalışmalı.
    });
  }
  wireOkumaIlerleme();
})();
