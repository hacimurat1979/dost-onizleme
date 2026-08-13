/* Dost Arabî — Mişkâtü'l-Envâr görünümü.
 *
 * Füsûs görünümüyle aynı iskelet (açılışta bütünün haritası, tıklayınca o
 * parçanın yazısı) ve aynı CSS sınıfları (fusus-shell/fusus-map/fusus-list/
 * fusus-article/fusus-chip...) -- yeni bir kütüphane/CSS eklemeye gerek
 * yok, "harita + tek birim okuma" düzeni ikisinde de aynı, yalnız veri ve
 * birim farklı (fass yerine hadis; sections/blocks yerine düz blocks --
 * her hadis kendi içinde alt bölümlere ayrılmıyor, tek bir birim).
 *
 * Kapsam (kullanıcı kararı): yalnız Dost'un kendi seçip derlediği 101
 * hadîs-i kudsî (3 Bölüm: 40+40+21). Aynı ciltte yer alan, Dost'tan sonra
 * yaşamış Molla Ali el-Kari'nin eklediği kırk hadis bu okumanın dışında.
 *
 * Veri: data/ibn-arabi/miskat-atlas.json (tek dosya -- Füsûs'teki gibi,
 * 101 hadis toplansa bile Fütûhât'ın kısım-başına-dosya bölünmesini
 * gerektirecek boyuta yakın değil).
 */
(function () {
  "use strict";

  var I18n = window.DostI18n;
  var wrap = document.getElementById("miskat-wrap");
  if (!wrap) return;

  var mapEl = document.getElementById("miskat-map");
  var listEl = document.getElementById("miskat-list");
  var articleEl = document.getElementById("miskat-article");

  var data = null;
  var dataPromise = null;
  var activeId = null;
  var mapScene = null;
  var sectionScenes = [];

  // B2 "Kaldığın yer": bkz. fusus.js'teki aynı isimli mantık.
  var LAST_HADIS_KEY = "dost-miskat-last-hadis";
  function saveLastHadis(id) {
    try { localStorage.setItem(LAST_HADIS_KEY, id); } catch (_) {}
  }
  function loadLastHadis() {
    try { return localStorage.getItem(LAST_HADIS_KEY); } catch (_) { return null; }
  }

  // B1 "başlangıç güzergâhı": bkz. fusus.js'teki aynı isimli mantık --
  // activeHadisId de okumanın en son ulaştığı hadis, h1 değil.
  var isDefaultLanding = false;

  function t(d) { return d ? I18n.pick3(d) : ""; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function linkify(text) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text) : text;
  }

  function load() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("miskat-wrap");
    dataPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/miskat-atlas.json")
      .then(function (d) {
        data = d;
        if (window.DostViewStatus) window.DostViewStatus.hide("miskat-wrap");
        return d;
      })
      .catch(function (err) {
        console.error("Mişkâtü'l-Envâr verisi yüklenemedi / Failed to load Mishkat al-Anwar data", err);
        dataPromise = null;
        if (window.DostViewStatus) {
          window.DostViewStatus.showError("miskat-wrap", function () { window.__miskatApp.activate(); });
        }
      });
    return dataPromise;
  }

  function hadisById(id) {
    if (!data) return null;
    for (var i = 0; i < data.hadisler.length; i++) {
      if (data.hadisler[i].id === id) return data.hadisler[i];
    }
    return null;
  }

  function hadisLabel(h) {
    // Sarmal düğümünde yer dar: bölüm-içi sıra numarası yeter, tam başlık ipucuna kalıyor.
    // Bölüm 2'deki birimler Dost'un kendi ayrımıyla "hadis" değil "haber" (bkz. book.bolumler).
    if (h.etiket === "haber") return { tr: h.no + ". Haber", en: "Report " + h.no, pt: "Relato " + h.no };
    return { tr: h.no + ". Hadis", en: "Hadith " + h.no, pt: "Hadith " + h.no };
  }

  // --- açılış haritası: 101 hadisin sarmalı (yalnız yazılmışlar tıklanabilir) ---
  function renderMap() {
    if (!mapEl || !window.DostHelix) return;
    if (mapScene) { mapScene.destroy(); mapScene = null; }
    var nodes = data.hadisler.map(function (h) {
      return {
        id: h.id,
        label: hadisLabel(h),
        accent: h.status === "active",
        __planned: h.status !== "active",
      };
    });
    mapScene = window.DostHelix.mount(mapEl, {
      id: "miskat-map",
      nodes: nodes,
      turns: 2.4,
      closing: false,
      hRatio: 1.45,
      maxH: 620,
      numbered: false,
      labelMode: "sparse",
      title: { tr: "Yüz bir hadisin sarmalı", en: "The spiral of the hundred and one hadith", pt: "A espiral dos cento e um hadith" },
      onActivate: function (node) {
        var h = hadisById(node.id);
        if (!h) return;
        if (h.status !== "active") return;   // henüz okunmamış hadis açılmaz
        activate(h.id);
      },
    });
  }

  function renderList() {
    if (!listEl) return;
    var yazildi = t({ tr: "yazıldı", en: "written", pt: "escrito" });
    var bekliyor = t({ tr: "henüz okunmadı", en: "not yet read", pt: "ainda não lido" });
    listEl.innerHTML = data.hadisler.map(function (h) {
      var on = h.status === "active";
      return '<button type="button" class="fusus-chip' + (on ? "" : " is-planned")
        + (h.id === activeId ? " is-active" : "") + '"'
        + (on ? ' data-id="' + esc(h.id) + '"' : ' disabled aria-disabled="true"')
        + ' title="' + esc(t(h.pageRange)) + " — " + esc(on ? yazildi : bekliyor) + '">'
        + '<span class="fusus-chip__no">' + h.no + "</span>"
        + '<span class="fusus-chip__name">' + esc(t(hadisLabel(h))) + "</span>"
        + "</button>";
    }).join("");
    listEl.querySelectorAll("button[data-id]").forEach(function (b) {
      b.addEventListener("click", function () { activate(b.dataset.id); });
    });
  }

  // --- bir hadisin yazısı --------------------------------------------------
  function clearSectionScenes() {
    sectionScenes.forEach(function (s) { s.destroy(); });
    sectionScenes = [];
  }

  function helixBlockHtml(block, key) {
    return '<figure class="fusus-figure">'
      + '<div class="fusus-figure__scene" data-helix="' + esc(key) + '"></div>'
      + '<button type="button" class="fusus-figure__expand" data-expand="' + esc(key) + '" aria-label="'
      + esc(t({ tr: "Çizimi büyüt", en: "Enlarge diagram", pt: "Ampliar diagrama" })) + '">⤢</button>'
      + '<figcaption class="fusus-figure__cap">'
      + (block.caption ? linkify(t(block.caption)) : "")
      + (block.source ? '<cite>' + esc(t(block.source)) + "</cite>" : "")
      + "</figcaption></figure>";
  }

  // Lightbox açıkken içeride ayrıca kurulan (daha büyük) sarmal sahnesi --
  // bkz. fusus.js'teki aynı adlı fonksiyondaki gerekçe.
  var lightboxScene = null;

  function openHelixLightbox(spec, captionHtml) {
    if (!window.DostLightbox || !window.DostHelix) return;
    window.DostLightbox.open({
      closeLabel: t({ tr: "Kapat", en: "Close", pt: "Fechar" }),
      svgHtml: "",
      caption: captionHtml || "",
      onClose: function () {
        if (lightboxScene) { lightboxScene.destroy(); lightboxScene = null; }
      },
    });
    var wrapEl = document.querySelector(".cizim-lightbox__svg-wrap");
    if (!wrapEl) return;
    var host = document.createElement("div");
    host.className = "fusus-figure__scene fusus-figure__scene--lightbox";
    wrapEl.appendChild(host);
    lightboxScene = window.DostHelix.mount(host, Object.assign({}, spec, { maxH: 620 }));
  }

  function mountHelixBlocks(scope, blocks, captions) {
    Object.keys(blocks).forEach(function (key) {
      var host = scope.querySelector('[data-helix="' + key + '"]');
      if (!host || !window.DostHelix) return;
      var spec = blocks[key];
      var s = window.DostHelix.mount(host, spec);
      if (s) sectionScenes.push(s);
      var btn = scope.querySelector('[data-expand="' + key + '"]');
      if (btn) {
        var captionHtml = (captions && captions[key]) || "";
        btn.addEventListener("click", function () { openHelixLightbox(spec, captionHtml); });
      }
    });
  }

  function lightboxCaptionText(block) {
    if (block.caption) return t(block.caption);
    if (block.source) return t(block.source);
    return "";
  }

  function hadisBlockHtml(b) {
    var html = '<blockquote class="miskat-hadis-metin">';
    html += "<p>" + esc(t(b.metin)).replace(/\n\n/g, "</p><p>") + "</p>";
    if (b.ravi || b.senet) {
      html += '<footer class="miskat-hadis-metin__footer">';
      if (b.ravi) html += '<cite class="miskat-hadis-metin__ravi">' + esc(t(b.ravi)) + "</cite>";
      if (b.senet) html += '<p class="miskat-hadis-metin__senet">' + esc(t(b.senet)) + "</p>";
      html += "</footer>";
    }
    html += "</blockquote>";
    return html;
  }

  function renderArticle(h) {
    clearSectionScenes();
    var helixes = {};
    var captions = {};
    var idx = 0;

    var html = "";
    if (isDefaultLanding && data.hadisler[0] && data.hadisler[0].id !== h.id) {
      html += '<div class="futuhat-start-hint fusus-start-hint">'
        + "<p>" + esc(t({
          tr: "Bu, okumanın en son ulaştığı yer. Yeni geliyorsan, baştan başlamak isteyebilirsin.",
          en: "This is where the reading currently stands. If you're new here, you may want to start from the beginning.",
          pt: "É aqui que a leitura chegou. Se você é novo aqui, talvez queira começar do início.",
        })) + "</p>"
        + '<button type="button" class="futuhat-start-hint__btn" data-start-hadis="' + esc(data.hadisler[0].id) + '">'
        + esc(t({ tr: "Baştan başla", en: "Start from the beginning", pt: "Começar do início" })) + "</button>"
        + '<button type="button" class="futuhat-start-hint__close" aria-label="' + esc(t({ tr: "Kapat", en: "Close", pt: "Fechar" })) + '">×</button>'
        + "</div>";
    }

    var bolumEtiket = t({ tr: "Bölüm", en: "Section", pt: "Seção" });
    var birimEtiket = t(h.etiket === "haber"
      ? { tr: "Haber", en: "Report", pt: "Relato" }
      : { tr: "Hadis", en: "Hadith", pt: "Hadith" });
    html += '<header class="fusus-article__head">'
      + '<button type="button" class="fusus-print-btn" title="' + esc(t({ tr: "Yazdır", en: "Print", pt: "Imprimir" })) + ' / Print / Imprimir" aria-label="Yazdır / Print / Imprimir">'
      + '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="6" y="3" width="12" height="6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="9" width="16" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="7" y="14" width="10" height="7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
      + "</button>"
      + '<p class="fusus-article__eyebrow">'
      + esc(bolumEtiket + " " + h.bolum + " · " + h.no + ". " + birimEtiket) + "</p>"
      + '<h2 class="fusus-article__title">' + esc(t(h.title)) + "</h2>"
      + '<p class="fusus-article__range">' + esc(t(h.pageRange)) + "</p>"
      + '<div class="fusus-article__summary">' + linkify(t(h.hero.summary)) + "</div>"
      + "</header>";

    if (h.mainHelix) {
      var mk = "m" + (idx++);
      helixes[mk] = Object.assign({}, h.mainHelix.helix, { title: h.title });
      captions[mk] = lightboxCaptionText(h.mainHelix);
      html += helixBlockHtml(h.mainHelix, mk);
    }

    (h.blocks || []).forEach(function (b) {
      if (b.type === "p") {
        html += "<p>" + linkify(t(b.text)) + "</p>";
      } else if (b.type === "hadis") {
        html += hadisBlockHtml(b);
      } else if (b.type === "helix") {
        var k = "s" + (idx++);
        helixes[k] = Object.assign({}, b.helix, { title: h.title });
        captions[k] = lightboxCaptionText(b);
        html += helixBlockHtml(b, k);
      }
    });

    if (h.sources && h.sources.length) {
      html += '<footer class="fusus-article__sources"><h3>'
        + esc(t({ tr: "Kaynak", en: "Source", pt: "Fonte" })) + "</h3><ul>"
        + h.sources.map(function (s) { return "<li>" + esc(t(s)) + "</li>"; }).join("")
        + "</ul></footer>";
    }

    articleEl.innerHTML = html;
    mountHelixBlocks(articleEl, helixes, captions);
    var printBtn = articleEl.querySelector(".fusus-print-btn");
    if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
    var startBtn = articleEl.querySelector("[data-start-hadis]");
    var startClose = articleEl.querySelector(".fusus-start-hint .futuhat-start-hint__close");
    if (startBtn) {
      startBtn.addEventListener("click", function () {
        isDefaultLanding = false;
        activate(startBtn.getAttribute("data-start-hadis"));
      });
    }
    if (startClose) {
      startClose.addEventListener("click", function () {
        var hint = articleEl.querySelector(".fusus-start-hint");
        if (hint) hint.remove();
      });
    }
  }

  function activate(id) {
    load().then(function () {
      if (!data) return;
      var h = hadisById(id) || (!id ? hadisById(loadLastHadis()) : null) || hadisById(data.activeHadisId) || data.hadisler[0];
      if (!h) return;
      isDefaultLanding = !id && !loadLastHadis();
      activeId = h.id;
      saveLastHadis(h.id);
      renderMap();
      renderList();
      renderArticle(h);
      if (window.__dostNav) window.__dostNav.setHash("miskat", h.id);
    });
  }

  window.__miskatApp = {
    activate: function (id) { activate(id || activeId || null); },
    onLangChange: function () {
      if (!data || !activeId) return;
      renderList();
      if (mapScene) mapScene.setLang();
      renderArticle(hadisById(activeId));
    },
  };
})();
