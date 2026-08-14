/**
 * Hakkında sayfasının dördüncü sekmesi: "Okuma Yolları" -- docs/icerik-
 * uretim-plani.md'nin "Kullanım 3" dediği içerik türü: her ana konu için
 * üç kademeli bir okuma sırası (bir makale, bir kitap, bir birincil metin).
 *
 * ADIM 4'te (2026-08-04 civarı) şema kurulmuş ve TEK bir örnek (vahdet-i
 * vücûd) yazılmıştı -- ama hiçbir sayfa bu veriyi okumuyordu, yani okuyucu
 * için görünmezdi (2026-08-09 taramasında bulundu). Bu dosya yalnız
 * SUNUYOR; yeni okuma yolu METNİ yazmıyor -- o, icerik-uretim-plani.md'nin
 * kendi kuralı gereği ("gerisini ben yazacağım") Murat'a ait.
 *
 * İki ayrı kaynak dosyası birleştiriliyor: "makale"/"kitap" kademeleri
 * data/ibn-arabi/kaynaklar-ozet.json'dan (docs/kaynaklar/*.yaml'ın kamuya
 * açık künye özeti -- kartların kendisi hiç yayımlanmıyor, bkz. scripts/
 * kaynak-ozet-uret.py), "birincil" kademesi ise data/ibn-arabi/eser-agi.
 * json'daki bir eserden (bkz. tools/schemas/okuma-yollari.schema.json).
 */
window.__okumaYollariApp = (function () {
  "use strict";
  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;

  const contentEl = document.getElementById("okuma-yollari-content");

  let data = null;
  let kaynaklar = null;
  let eserler = null;
  let fetchPromise = null;

  function tt(dict) {
    return I18n ? I18n.pick3(dict || {}) : (dict && (dict.tr || dict.en || dict.pt)) || "";
  }
  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const KADEME_ETIKET = {
    makale: { tr: "Makale", en: "Article", pt: "Artigo" },
    kitap: { tr: "Kitap", en: "Book", pt: "Livro" },
    birincil: { tr: "Birincil Kaynak", en: "Primary Source", pt: "Fonte Primária" },
  };

  function fetchData() {
    if (data) return Promise.resolve(data);
    if (fetchPromise) return fetchPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("okuma-yollari-panel");
    fetchPromise = Promise.all([
      GU.fetchJson("data/ibn-arabi/okuma-yollari.json"),
      GU.fetchJson("data/ibn-arabi/kaynaklar-ozet.json"),
      GU.fetchJson("data/ibn-arabi/eser-agi.json"),
    ]).then(([y, k, e]) => {
      data = y;
      kaynaklar = (k && k.kaynaklar) || {};
      eserler = new Map((e && e.eserler || []).map((x) => [x.id, x]));
      if (window.DostViewStatus) window.DostViewStatus.hide("okuma-yollari-panel");
      return data;
    }).catch((err) => {
      console.error("okuma-yollari verisi yüklenemedi", err);
      fetchPromise = null;
      if (window.DostViewStatus) window.DostViewStatus.showError("okuma-yollari-panel", () => window.__okumaYollariApp.activate());
      return null;
    });
    return fetchPromise;
  }

  // "makale"/"kitap": künye kaynaklar-ozet.json'dan. Yıl/yayıncı bilinmiyorsa
  // (null) satırdan bırakılıyor -- var olmayan bir şey uydurulmuyor.
  function kunyeSatiri(k) {
    if (!k) return "";
    const parcalar = [k.yazar, k.yil, k.yayinci].filter(Boolean);
    return esc(parcalar.join(" — "));
  }

  function kademeHtml(basamak, i) {
    // --okuma-yolu-sira: üç kademenin sırayla belirmesi için (bkz.
    // style.css'teki okuma-yolu-durak-belir) -- bir yol yürünür, bir liste
    // taranır; salt süs değil, "üç durak" çerçevesinin görsel karşılığı.
    const sira = ` style="--okuma-yolu-sira: ${i}"`;
    const etiket = esc(tt(KADEME_ETIKET[basamak.kademe]));
    const neden = `<p class="okuma-yolu-kademe__neden">${esc(tt(basamak.neden))}</p>`;
    if (basamak.kademe === "birincil") {
      const eser = eserler.get(basamak.kaynak_id);
      const baslik = eser ? esc(eser.eser) : esc(basamak.kaynak_id);
      const kunye = eser
        ? `${esc(tt(eser.sehir))} — ${eser.yil.hicri ? eser.yil.hicri + "/" : ""}${eser.yil.miladi}`
        : "";
      const link = eser
        ? `<button type="button" class="okuma-yolu-kademe__git" data-view="eser-agi" data-id="${esc(eser.id)}">${esc(tt({
            tr: "Eser Ağı'nda gör ↗", en: "See in the Works Timeline ↗", pt: "Ver na Linha do Tempo das Obras ↗",
          }))}</button>`
        : "";
      return `<div class="okuma-yolu-kademe okuma-yolu-kademe--birincil"${sira}>
        <span class="okuma-yolu-kademe__etiket">${etiket}</span>
        <p class="okuma-yolu-kademe__baslik">${baslik}</p>
        <p class="okuma-yolu-kademe__kunye">${kunye}</p>
        ${neden}${link}
      </div>`;
    }
    const k = kaynaklar[basamak.kaynak_id];
    const baslik = k ? esc(k.baslik) : esc(basamak.kaynak_id);
    const doi = k && k.doi
      ? `<a class="okuma-yolu-kademe__doi" href="https://doi.org/${esc(k.doi)}" target="_blank" rel="noopener noreferrer">DOI ↗</a>` : "";
    return `<div class="okuma-yolu-kademe"${sira}>
      <span class="okuma-yolu-kademe__etiket">${etiket}</span>
      <p class="okuma-yolu-kademe__baslik">${baslik}</p>
      <p class="okuma-yolu-kademe__kunye">${kunyeSatiri(k)}</p>
      ${neden}${doi}
    </div>`;
  }

  function yolHtml(y) {
    return `<article class="okuma-yolu">
      <h3 class="okuma-yolu__konu">${esc(tt(y.konu))}</h3>
      <div class="okuma-yolu__kademeler">
        ${y.uc_kademe.map((b, i) => kademeHtml(b, i)).join('<span class="okuma-yolu__ok" aria-hidden="true"><span>→</span></span>')}
      </div>
    </article>`;
  }

  function render() {
    if (!contentEl || !data) return;
    const intro = `<p class="okuma-yolu-intro">${esc(tt({
      tr: "Her konu için üç durak: önce kısa bir makale, sonra bir kitap, sonra Şeyh'in kendi metnine dönüş. Zorunlu bir sıra değil -- yalnız bir öneri.",
      en: "Three stops per topic: first a short article, then a book, then a return to the Shaykh's own text. Not a required order -- only a suggestion.",
      pt: "Três paradas por tema: primeiro um artigo curto, depois um livro, depois um regresso ao próprio texto do Xeique. Não é uma ordem obrigatória -- apenas uma sugestão.",
    }))}</p>`;
    contentEl.innerHTML = intro + data.yollar.map(yolHtml).join("");
    contentEl.querySelectorAll(".okuma-yolu-kademe__git").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.__dostNav && window.__dostNav.goTo(btn.dataset.view, btn.dataset.id || undefined);
      });
    });
  }

  return {
    activate() {
      fetchData().then((d) => { if (d) render(); });
    },
    onLangChange() {
      if (data) render();
    },
  };
})();
