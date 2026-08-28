/**
 * Hakkında sayfasının beşinci sekmesi: "Nereden Başlamalı" (2026-08-28).
 *
 * Sitenin on dokuz görünümü var ve giriş kapısı bir grafik: ilk kez gelen
 * biri on beş düğüm görüyor ve nereye tıklayacağını bilmiyor. #start-hint
 * kartı iki kapı gösteriyor (Zât'tan başla / Kalp'ten başla) ama orada
 * biten şey bir DURAK, bir yol değil.
 *
 * Bu sayfa yolları veriyor. "Okuma Yolları" ile karıştırılmamalı ve o
 * yüzden adı ondan ayrı: orası bir KONU için üç kademeli bir KAYNAK sırası
 * (bir makale, bir kitap, bir birincil metin), burası sitenin kendi
 * sayfaları arasında bir gezinti.
 *
 * İki kural, ikisi de ETKILESIM_DILI.md'den:
 *  - Bağlanmamış düğme yok. Bir yol haritasında bu özellikle geçerli,
 *    çünkü bu sayfanın TEK işi bir yere göndermek; şemadaki `view` listesi
 *    ontology.js'in rota sözlüğüyle aynı tutuluyor.
 *  - Tıklama kullanıcıyı habersiz taşımaz: durak düğmesi ne olacağını
 *    (hangi bölüm, hangi sayfa) yazıyor, sonra oraya gidiyor.
 */
window.__neredenBaslamaliApp = (function () {
  "use strict";
  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;

  const contentEl = document.getElementById("nereden-baslamali-content");
  const tt = I18n.pick3;

  let data = null;
  let fetchPromise = null;

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Bölüm adları. Rota sözlüğünün TAMAMI değil, yalnız bu sayfada geçenler
  // -- eksik bir ad sessizce "view" kodunu gösterir, uydurma bir ad değil.
  const GORUNUM_ADI = {
    ontoloji: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
    terimler: { tr: "Terimler", en: "Terms", pt: "Termos" },
    bilmiyoruz: { tr: "Bilmiyoruz", en: "We Don't Know", pt: "Não Sabemos" },
    "acik-sorular": { tr: "Açık Sorular", en: "Open Questions", pt: "Perguntas Abertas" },
    "elestiri-arkeolojisi": { tr: "Eleştiri Arkeolojisi", en: "Archaeology of Criticism", pt: "Arqueologia da Crítica" },
    futuhat: { tr: "Fütûhât-ı Mekkiyye", en: "The Meccan Openings", pt: "As Aberturas de Meca" },
    fusus: { tr: "Füsûsu'l-Hikem", en: "Fusus al-Hikam", pt: "Fusus al-Hikam" },
    miskat: { tr: "Mişkâtü'l-Envâr", en: "Mishkat al-Anwar", pt: "Mishkat al-Anwar" },
    kavram: { tr: "Kavram Sayfası", en: "Concept Page", pt: "Página do Conceito" },
    hakkinda: { tr: "Hakkında", en: "About", pt: "Sobre" },
  };

  function fetchData() {
    if (data) return Promise.resolve(data);
    if (fetchPromise) return fetchPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("nereden-baslamali-panel");
    fetchPromise = GU.fetchJson("data/nereden-baslamali.json")
      .then((d) => {
        data = d;
        if (window.DostViewStatus) window.DostViewStatus.hide("nereden-baslamali-panel");
        return data;
      })
      .catch((err) => {
        console.error("nereden-baslamali verisi yüklenemedi / failed to load", err);
        fetchPromise = null;
        if (window.DostViewStatus) {
          window.DostViewStatus.showError("nereden-baslamali-panel", () => window.__neredenBaslamaliApp.activate());
        }
        return null;
      });
    return fetchPromise;
  }

  function durakHtml(d, sira) {
    const gorunum = GORUNUM_ADI[d.view] ? tt(GORUNUM_ADI[d.view]) : d.view;
    // Gidilecek yer düğmenin ÜSTÜNDE yazılı: tıklamadan önce nereye
    // gidileceği belli olsun (habersiz taşımama kuralı).
    // Aynı yolda iki durak aynı bölüme gidebiliyor (Ontoloji -> Zât ve
    // Ontoloji -> Kalp); yalnız bölüm adını yazan bir düğme ikisini
    // ayırt ettirmiyordu. Sayfa adı da düğmede.
    const hedef = d.hedef ? tt(d.hedef) : "";
    return `<li class="nb-durak">
      <span class="nb-durak__no" aria-hidden="true">${sira}</span>
      <div class="nb-durak__govde">
        <p class="nb-durak__ne">${esc(tt(d.ne))}</p>
        <p class="nb-durak__bak">${esc(tt(d.bak))}</p>
        <button type="button" class="nb-durak__git" data-view="${esc(d.view)}"${d.id ? ` data-id="${esc(d.id)}"` : ""}>
          <span class="nb-durak__git-yer">${esc(gorunum)}${hedef ? ` <span class="nb-durak__git-sayfa">· ${esc(hedef)}</span>` : ""}</span>
          <span class="nb-durak__git-ok" aria-hidden="true">→</span>
        </button>
      </div>
    </li>`;
  }

  function yolHtml(y) {
    const n = (y.duraklar || []).length;
    const durakSayisi = tt({
      tr: n + " durak", en: n + (n === 1 ? " stop" : " stops"), pt: n + (n === 1 ? " parada" : " paradas"),
    });
    return `<section class="nb-yol">
      <h3 class="nb-yol__baslik">${esc(tt(y.baslik))}</h3>
      <p class="nb-yol__olcu">${esc(durakSayisi)}</p>
      <p class="nb-yol__kim">${esc(tt(y.kim))}</p>
      <ol class="nb-durak-liste">${(y.duraklar || []).map((d, i) => durakHtml(d, i + 1)).join("")}</ol>
    </section>`;
  }

  function render() {
    if (!contentEl || !data) return;
    contentEl.innerHTML = `
      <p class="nb-not">${esc(tt(data.not))}</p>
      <div class="nb-yollar">${(data.yollar || []).map(yolHtml).join("")}</div>
    `;
    contentEl.querySelectorAll(".nb-durak__git").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view, id = btn.dataset.id;
        if (window.__dostNav && window.__dostNav.goTo) window.__dostNav.goTo(view, id);
        else window.location.href = (window.__dostRouteBase || "") + "/" + view + (id ? "/" + id : "");
      });
    });
  }

  function activate() {
    fetchData().then((d) => { if (d) render(); });
  }

  return {
    activate: activate,
    onLangChange: function () { if (data) render(); },
  };
})();
