// Hocalar — İbnü'l-Arabî'nin Rûhu'l-kuds'ta andığı 55 hocadan son ikisi,
// ikisi de kadın (docs/icerik-yol-haritasi.md D6).
//
// NEDEN BU BİÇİM. Kuantum'un liste-panel'iyle aynı iskelet ama farklı
// yoğunluk taşıyor: orada üç kısa pozisyon vardı, burada iki uzun PORTRE --
// her biri birden fazla doğrudan alıntı taşıyor (İbnü'l-Arabî'nin kendi
// sözleri, Austin'in çevirisinden). Bu yüzden panel bir "durum" değil bir
// "anlatı" gösteriyor; alıntılar sırayla, bağlamlarıyla birlikte.
window.__hocalarApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;

  const wrapEl = document.getElementById("hocalar-wrap");
  const listEl = document.getElementById("hocalar-list");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");

  if (!wrapEl || !listEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  function tt(dict) { return I18n.pick3(dict || {}); }

  let data = null;
  let hocalar = [];
  let focusId = null;

  function alintiHtml(a) {
    const baglam = a.baglam ? `<p class="hoca-alinti__baglam">${tt(a.baglam)}</p>` : "";
    return `<blockquote class="hoca-alinti">
      <p class="hoca-alinti__metin">${tt(a.metin)}</p>
      ${baglam}
      <cite class="hoca-alinti__kaynak">${a.kaynak.eser}, s. ${a.kaynak.sayfa}</cite>
    </blockquote>`;
  }

  function kaynaklarHtml(list) {
    return list.map((k) => {
      const yil = k.yil ? ", " + k.yil : "";
      const not = k.not ? ` <span class="bilmiyoruz-madde__kaynak-not">— ${k.not}</span>` : "";
      return `<li class="bilmiyoruz-madde__kaynak">${k.yazar}, <em>${k.eser}</em>${yil}${not}</li>`;
    }).join("");
  }

  function panelGoster(d) {
    focusId = d.id;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(d.konum)}
        <span class="hoca-sira-rozet">${d.sira}</span></p>
      <h2 class="detail-title">${tt(d.ad)}</h2>
      <p class="hoca-kimlik">${tt(d.kimlik)}</p>
      <div class="detail-block detail-block--soru"><p>${tt(d.ozet)}</p></div>
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Kendi ağzından", en: "In his own words", pt: "Nas suas próprias palavras" })}</p>
      ${d.alintilar.map(alintiHtml).join("")}
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Kaynaklar", en: "Sources", pt: "Fontes" })}</p>
      <ul class="bilmiyoruz-madde__kaynaklar">${kaynaklarHtml(d.kaynaklar)}</ul>`;
    detailPanel.hidden = false;
  }

  function renderList() {
    listEl.innerHTML = hocalar.map((d) => `<button class="hoca-satir" type="button" data-id="${d.id}">
        <span class="hoca-satir__sira">${d.sira}</span>
        <span class="hoca-satir__govde">
          <span class="hoca-satir__ad">${tt(d.ad)}</span>
          <span class="hoca-satir__konum">${tt(d.konum)}</span>
        </span>
      </button>`).join("");
    listEl.querySelectorAll(".hoca-satir").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = hocalar.find((x) => x.id === btn.dataset.id);
        if (d) panelGoster(d);
      });
    });
  }

  function girisPaneli() {
    focusId = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Hocalar", en: "Teachers", pt: "Mestres" })}</p>
      <h2 class="detail-title">${tt({ tr: "Listenin sonundaki iki isim", en: "The last two names on the list", pt: "Os dois últimos nomes da lista" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>`;
    detailPanel.hidden = false;
  }

  let yuklendi = false;
  function yukle() {
    if (yuklendi) return Promise.resolve();
    const base = window.__dostRouteBase || "";
    const url = (base ? base + "/" : "") + "data/ibn-arabi/hocalar.json";
    return GU.fetchJson(url).then((d) => {
      data = d;
      hocalar = d.hocalar || [];
      yuklendi = true;
      renderList();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("hocalar-wrap", () => {
      if (focusId) { girisPaneli(); return true; }
      return false;
    });
  }

  return {
    activate() {
      baglaBirKez();
      yukle().then(() => { girisPaneli(); }).catch(() => {
        const st = document.getElementById("hocalar-wrap-status");
        if (st) {
          st.hidden = false;
          st.querySelector(".view-status__text").textContent =
            tt({ tr: "İçerik yüklenemedi.", en: "The content could not be loaded.", pt: "O conteúdo não pôde ser carregado." });
        }
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      renderList();
      if (focusId) {
        const d = hocalar.find((x) => x.id === focusId);
        if (d) panelGoster(d); else girisPaneli();
      } else girisPaneli();
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = hocalar.find((x) => x.id === id);
        if (d) panelGoster(d);
      });
    },
  };
})();
