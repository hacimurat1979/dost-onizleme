/**
 * "Âyet & Hadis İndeksi" -- sitenin Fütûhât/Füsûs okuması boyunca alıntılanan
 * âyet ve hadislerin, TEKRARLADIKLARI yere göre sıralanmış tek bir liste
 * hâlinde toplandığı görünüm. Veri: data/ibn-arabi/kuran.json (Arapça asıl +
 * meal), data/ibn-arabi/ayet-dizini.json ve hadis-dizini.json (hangi âyet/
 * ifadenin sitede nerelerde geçtiği -- bkz. assets/ayet-onizleme.js'in aynı
 * kaynakları hover künyeleri için kullanması). Bu görünüm o hover mekanizmasının
 * TERSİ: künyeyi metnin içinde tek tek bulmak yerine, hepsini tek sayfada
 * gezilebilir kılıyor.
 */
window.__ayetHadisApp = (function () {
  "use strict";
  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;

  const wrapEl = document.getElementById("ayethadis-wrap");
  const listEl = document.getElementById("ayethadis-list");

  function tt(dict) {
    return I18n ? I18n.pick3(dict || {}) : (dict && (dict.tr || dict.en || dict.pt)) || "";
  }

  let dataPromise = null;
  let kuran = null, ayetDizin = null, hadisDizin = null;

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("ayethadis-wrap");
    dataPromise = Promise.all([
      GU.fetchJson("data/ibn-arabi/kuran.json"),
      GU.fetchJson("data/ibn-arabi/ayet-dizini.json"),
      GU.fetchJson("data/ibn-arabi/hadis-dizini.json"),
    ])
      .then(([k, ad, hd]) => {
        kuran = k;
        ayetDizin = ad.dizin || {};
        hadisDizin = hd.dizin || {};
        if (window.DostViewStatus) window.DostViewStatus.hide("ayethadis-wrap");
        return true;
      })
      .catch((err) => {
        console.error("Âyet/hadis indeksi yüklenemedi", err);
        dataPromise = null;
        if (window.DostViewStatus) {
          window.DostViewStatus.showError("ayethadis-wrap", () => window.__ayetHadisApp.activate());
        }
        return false;
      });
    return dataPromise;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
    ));
  }

  function sureAdi(ref) {
    const no = parseInt(ref.split(":")[0], 10);
    const s = (kuran.sureler || []).find((x) => x.no === no);
    return s ? esc(tt(s.ad)) : "";
  }

  function ayetMeal(ref) {
    const a = kuran.ayetler && kuran.ayetler[ref];
    if (!a) return "";
    const lang = I18n ? I18n.getLang() : "tr";
    const meal = a.meal || {};
    return esc(meal[lang] || meal.en || meal.tr || "");
  }

  function locHtml(list) {
    return (list || [])
      .map((e) => {
        const href = window.__dostNav ? window.__dostNav.href(e.view, e.id) : esc(e.route || "");
        return `<a class="cross-link ayethadis-item__loc" href="${esc(href)}" data-view="${esc(e.view)}" data-id="${esc(e.id)}">${esc(tt(e.title))}</a>`;
      })
      .join("");
  }

  function render() {
    const ayetItems = Object.keys(ayetDizin).map((ref) => ({ tip: "ayet", ref, list: ayetDizin[ref] }));
    const hadisItems = Object.keys(hadisDizin).map((ref) => ({ tip: "hadis", ref, list: hadisDizin[ref] }));
    const all = ayetItems.concat(hadisItems).sort((a, b) => b.list.length - a.list.length);

    const intro = tt({
      tr: `Fütûhât ve Füsûs okuması boyunca sitede alıntılanan ${ayetItems.length} âyet ve ${hadisItems.length} kutsî hadisin, en çok tekrarladıkları yerden başlayarak sıralanmış bir dizini. Tekrar bir şeyin önemli olduğunun kanıtı değil, ama dikkatimizi çeken bir örüntü -- bkz. sitenin "biriken parçalar" ilkesi.`,
      en: `An index of the ${ayetItems.length} verses and ${hadisItems.length} sacred sayings quoted across the site's reading of the Futuhat and the Fusus, ordered by how often each recurs. Recurrence isn't proof that something matters -- but it's a pattern that draws our attention; see the site's "accumulating fragments" principle.`,
      pt: `Um índice dos ${ayetItems.length} versículos e ${hadisItems.length} ditos sagrados citados ao longo da leitura do Futuhat e do Fusus no site, ordenados por quantas vezes cada um recorre. A recorrência não é prova de que algo importa -- mas é um padrão que chama nossa atenção; veja o princípio do site de "acumular fragmentos".`,
    });

    const rows = all
      .map((item) => {
        if (item.tip === "ayet") {
          const a = kuran.ayetler && kuran.ayetler[item.ref];
          const ar = a ? esc(a.ar || "") : "";
          return (
            `<article class="ayethadis-item">` +
            `<div class="ayethadis-item__head">` +
            `<span class="ayet-ref ayethadis-item__ref" data-ayet="${esc(item.ref)}" tabindex="0">${sureAdi(item.ref)} ${esc(item.ref)}</span>` +
            `<span class="ayethadis-item__n">${item.list.length}</span>` +
            `</div>` +
            (ar ? `<p class="ayethadis-item__ar" dir="rtl" lang="ar">${ar}</p>` : "") +
            `<p class="ayethadis-item__meal">${ayetMeal(item.ref)}</p>` +
            `<div class="ayethadis-item__locs">${locHtml(item.list)}</div>` +
            `</article>`
          );
        }
        return (
          `<article class="ayethadis-item">` +
          `<div class="ayethadis-item__head">` +
          `<span class="hadis-ref ayethadis-item__ref" data-hadis="${esc(item.ref)}" tabindex="0">${esc(
            tt({ tr: "Tekrarlayan bir kutsî hadis", en: "A recurring sacred saying", pt: "Um dito sagrado recorrente" })
          )}</span>` +
          `<span class="ayethadis-item__n">${item.list.length}</span>` +
          `</div>` +
          `<div class="ayethadis-item__locs">${locHtml(item.list)}</div>` +
          `</article>`
        );
      })
      .join("");

    listEl.innerHTML = `<p class="ayethadis-intro">${intro}</p><div class="ayethadis-list">${rows}</div>`;
  }

  return {
    activate() {
      fetchData().then((ok) => { if (ok) render(); });
    },
    onLangChange() {
      if (kuran) render();
    },
  };
})();
