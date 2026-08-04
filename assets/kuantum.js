// Kuantum meselesinin dürüst hâli (docs/icerik-yol-haritasi.md D3).
//
// Diğer yeni görünümlerden (Bilmiyoruz'un yay-halkası) FARKLI bir biçim
// bilinçli: burada ölçülen şey "ne kadar açık/tartışmalı" değil, üç ayrı
// TÜRDE pozisyonun (zayıf/temkinli/yerleşik) yan yana durması -- bu daha
// çok bir karşılaştırma tablosu, bir halka değil. ETKILESIM_DILI.md
// sözleşmesi yine geçerli: değinmek (hover) = ipucu; seçmek (tıklama) =
// panel; bir adım geri (ESC) = panelden listeye.
window.__kuantumApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;

  const wrapEl = document.getElementById("kuantum-wrap");
  const listEl = document.getElementById("kuantum-list");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");

  if (!wrapEl || !listEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  function tt(dict) { return I18n.pick3(dict || {}); }

  let data = null;
  let rows = [];
  let focusId = null;

  const DURUM_CLASS = { zayif: "kuantum-satir--zayif", temkinli: "kuantum-satir--temkinli", yerlesik: "kuantum-satir--yerlesik" };

  function kaynaklarHtml(list) {
    return list.map((k) => {
      const yil = k.yil ? ", " + k.yil : "";
      const not = k.not ? ` <span class="bilmiyoruz-madde__kaynak-not">— ${k.not}</span>` : "";
      return `<li class="bilmiyoruz-madde__kaynak">${k.yazar}, <em>${k.eser}</em>${yil}${not}</li>`;
    }).join("");
  }

  function panelGoster(d) {
    focusId = d.id;
    const durum = data.durumlar[d.durum] || {};
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Kuantum Meselesi", en: "The Quantum Question", pt: "A Questão Quântica" })}
        <span class="bilmiyoruz-madde__durum bilmiyoruz-madde__durum--${d.durum === "zayif" ? "tartismali" : d.durum === "temkinli" ? "belirsiz" : "bizim_sinirimiz"}">${tt(durum)}</span></p>
      <h2 class="detail-title">${tt(d.iddia)}</h2>
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Bu ne kadar dayanıyor", en: "How much this holds up", pt: "O quanto isto se sustenta" })}</p>
      <div class="detail-block detail-block--soru"><p>${tt(d.dayanak)}</p></div>
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Kim ne diyor", en: "Who says what", pt: "Quem diz o quê" })}</p>
      <ul class="bilmiyoruz-madde__kaynaklar">${kaynaklarHtml(d.kimNeDiyor)}</ul>`;
    detailPanel.hidden = false;
  }

  function renderList() {
    listEl.innerHTML = rows.map((d) => {
      const durum = data.durumlar[d.durum] || {};
      return `<button class="kuantum-satir ${DURUM_CLASS[d.durum] || ""}" type="button" data-id="${d.id}">
        <span class="kuantum-satir__durum">${tt(durum)}</span>
        <span class="kuantum-satir__iddia">${tt(d.iddia)}</span>
      </button>`;
    }).join("");
    listEl.querySelectorAll(".kuantum-satir").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = rows.find((x) => x.id === btn.dataset.id);
        if (d) panelGoster(d);
      });
    });
  }

  function girisPaneli() {
    focusId = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Kuantum Meselesi", en: "The Quantum Question", pt: "A Questão Quântica" })}</p>
      <h2 class="detail-title">${tt({ tr: "Üç pozisyon, üç dayanak", en: "Three positions, three grounds", pt: "Três posições, três fundamentos" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>`;
    detailPanel.hidden = false;
  }

  let yuklendi = false;
  function yukle() {
    if (yuklendi) return Promise.resolve();
    const base = window.__dostRouteBase || "";
    const url = (base ? base + "/" : "") + "data/ibn-arabi/kuantum.json";
    return GU.fetchJson(url).then((d) => {
      data = d;
      rows = (d.satirlar || []).map((s) => Object.assign({}, s));
      yuklendi = true;
      renderList();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("kuantum-wrap", () => {
      if (focusId) { girisPaneli(); return true; }
      return false;
    });
  }

  return {
    activate() {
      baglaBirKez();
      yukle().then(() => { girisPaneli(); }).catch(() => {
        const st = document.getElementById("kuantum-wrap-status");
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
        const d = rows.find((x) => x.id === focusId);
        if (d) panelGoster(d); else girisPaneli();
      } else girisPaneli();
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = rows.find((x) => x.id === id);
        if (d) panelGoster(d);
      });
    },
  };
})();
