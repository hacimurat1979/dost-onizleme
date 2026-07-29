/* Dost Arabî — Füsûsu'l-Hikem görünümü.
 *
 * Fütûhât görünümüyle aynı iskelet (açılışta bütünün haritası, tıklayınca o
 * parçanın yazısı), ama iki farkı var ve ikisi de bilerek:
 *
 *  1. Bütün şemalar SARMAL. Fütûhât'ta bölüm-içi çizimler ağaç/ikili/üçlü
 *     olabiliyor; burada tek bir dil var (assets/helix.js). Gerekçe CLAUDE.md:
 *     "iki boyutlu bir halka ile üç boyutlu bir sarmal arasında seçim varken
 *     sarmalı tercih et." Füsûs'un kendi yapısı da buna elverişli -- kitap
 *     yirmi yedi peygamberde yirmi yedi hikmeti dolaşıp aynı meseleye başka
 *     bir yükseklikten dönüyor.
 *  2. Açılış haritasının kendisi de bir sarmal: yirmi yedi fass, okunma
 *     sırasıyla dizilmiş; okunmuş olanlar vurgulu, henüz okunmamışlar sönük.
 *
 * Veri: data/ibn-arabi/fusus-atlas.json (tek dosya -- Fütûhât'taki gibi
 * kısım başına ayrı dosyaya bölmek için henüz sebep yok; 27 fass hepsi
 * yazıldığında bile atlas'ın bugünkü boyunun çok altında kalıyor).
 */
(function () {
  "use strict";

  var I18n = window.DostI18n;
  var wrap = document.getElementById("fusus-wrap");
  if (!wrap) return;

  var mapEl = document.getElementById("fusus-map");
  var listEl = document.getElementById("fusus-list");
  var articleEl = document.getElementById("fusus-article");

  var data = null;
  var dataPromise = null;
  var activeId = null;
  var mapScene = null;
  var sectionScenes = [];
  var crossLinkSubscribed = false;

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
    if (window.DostViewStatus) window.DostViewStatus.showLoading("fusus-wrap");
    dataPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/fusus-atlas.json")
      .then(function (d) {
        data = d;
        if (window.DostViewStatus) window.DostViewStatus.hide("fusus-wrap");
        return d;
      })
      .catch(function (err) {
        console.error("Füsûs verisi yüklenemedi / Failed to load Fusus data", err);
        dataPromise = null;
        if (window.DostViewStatus) {
          window.DostViewStatus.showError("fusus-wrap", function () { window.__fususApp.activate(); });
        }
      });
    return dataPromise;
  }

  function fassById(id) {
    if (!data) return null;
    for (var i = 0; i < data.fasses.length; i++) {
      if (data.fasses[i].id === id) return data.fasses[i];
    }
    return null;
  }

  function fassLabel(f) {
    // Sarmal düğümünde yer dar: peygamber adı + numara yeter, hikmetin adı
    // ipucuna (title/aria) kalıyor.
    return { tr: f.no + ". " + f.prophet.tr, en: f.no + ". " + f.prophet.en, pt: f.no + ". " + f.prophet.pt };
  }

  // --- açılış haritası: yirmi yedi fassın sarmalı --------------------------
  function renderMap() {
    if (!mapEl || !window.DostHelix) return;
    if (mapScene) { mapScene.destroy(); mapScene = null; }
    var nodes = data.fasses.map(function (f) {
      return {
        id: f.id,
        label: fassLabel(f),
        accent: f.status === "active",
        __planned: f.status !== "active",
      };
    });
    mapScene = window.DostHelix.mount(mapEl, {
      id: "fusus-map",
      nodes: nodes,
      turns: 2.4,
      closing: false,
      // Yirmi yedi düğüm dar bir kutuda üst üste yığılıyordu; harita
      // sarmalı bu yüzden geniş değil UZUN çiziliyor (2026-07-29).
      hRatio: 1.45,
      maxH: 620,
      numbered: false,   // etiket zaten "1. Âdem" diye başlıyor
      // Yirmi yedi ad yan yana okunmaz; yalnız yazılmış fassların ve
      // odaktakinin adı yazılıyor, gerisi ipucunda (2026-07-29).
      labelMode: "sparse",
      title: { tr: "Yirmi yedi fassın sarmalı", en: "The spiral of the twenty-seven bezels", pt: "A espiral dos vinte e sete engastes" },
      onActivate: function (node) {
        var f = fassById(node.id);
        if (!f) return;
        if (f.status !== "active") return;   // henüz okunmamış fass açılmaz
        activate(f.id);
      },
    });
  }

  function renderList() {
    if (!listEl) return;
    var yazildi = t({ tr: "yazıldı", en: "written", pt: "escrito" });
    var bekliyor = t({ tr: "henüz okunmadı", en: "not yet read", pt: "ainda não lido" });
    listEl.innerHTML = data.fasses.map(function (f) {
      var on = f.status === "active";
      return '<button type="button" class="fusus-chip' + (on ? "" : " is-planned")
        + (f.id === activeId ? " is-active" : "") + '"'
        + (on ? ' data-id="' + esc(f.id) + '"' : ' disabled aria-disabled="true"')
        + ' title="' + esc(t(f.hikmet)) + " — " + esc(on ? yazildi : bekliyor) + '">'
        + '<span class="fusus-chip__no">' + f.no + "</span>"
        + '<span class="fusus-chip__name">' + esc(t(f.prophet)) + "</span>"
        + "</button>";
    }).join("");
    listEl.querySelectorAll("button[data-id]").forEach(function (b) {
      b.addEventListener("click", function () { activate(b.dataset.id); });
    });
  }

  // --- bir fassın yazısı ---------------------------------------------------
  function clearSectionScenes() {
    sectionScenes.forEach(function (s) { s.destroy(); });
    sectionScenes = [];
  }

  function helixBlockHtml(block, key) {
    return '<figure class="fusus-figure">'
      + '<div class="fusus-figure__scene" data-helix="' + esc(key) + '"></div>'
      + '<figcaption class="fusus-figure__cap">'
      + (block.caption ? linkify(t(block.caption)) : "")
      + (block.source ? '<cite>' + esc(t(block.source)) + "</cite>" : "")
      + "</figcaption></figure>";
  }

  function mountHelixBlocks(scope, blocks) {
    Object.keys(blocks).forEach(function (key) {
      var host = scope.querySelector('[data-helix="' + key + '"]');
      if (!host || !window.DostHelix) return;
      var s = window.DostHelix.mount(host, blocks[key]);
      if (s) sectionScenes.push(s);
    });
  }

  function renderArticle(f) {
    clearSectionScenes();
    var helixes = {};
    var idx = 0;

    var html = '<header class="fusus-article__head">'
      + '<p class="fusus-article__eyebrow">'
      + esc(t({ tr: "Fass " + f.no, en: "Bezel " + f.no, pt: "Engaste " + f.no })) + " · "
      + esc(t(f.hikmet)) + "</p>"
      + '<h2 class="fusus-article__title">' + esc(t(f.title)) + "</h2>"
      + '<p class="fusus-article__range">' + esc(t(f.pageRange)) + "</p>"
      + '<div class="fusus-article__summary">' + linkify(t(f.hero.summary)) + "</div>"
      + "</header>";

    if (f.mainHelix) {
      var mk = "m" + (idx++);
      helixes[mk] = Object.assign({}, f.mainHelix.helix, { title: f.title });
      html += helixBlockHtml(f.mainHelix, mk);
    }

    f.sections.forEach(function (sec) {
      html += '<section class="fusus-section" id="' + esc(sec.id) + '">'
        + "<h3>" + esc(t(sec.heading)) + "</h3>";
      sec.blocks.forEach(function (b) {
        if (b.type === "p") {
          html += "<p>" + linkify(t(b.text)) + "</p>";
        } else if (b.type === "helix") {
          var k = "s" + (idx++);
          helixes[k] = Object.assign({}, b.helix, { title: sec.heading });
          html += helixBlockHtml(b, k);
        }
      });
      html += "</section>";
    });

    if (f.sources && f.sources.length) {
      html += '<footer class="fusus-article__sources"><h3>'
        + esc(t({ tr: "Kaynak", en: "Source", pt: "Fonte" })) + "</h3><ul>"
        + f.sources.map(function (s) { return "<li>" + esc(t(s)) + "</li>"; }).join("")
        + "</ul></footer>";
    }

    articleEl.innerHTML = html;
    mountHelixBlocks(articleEl, helixes);
  }

  function activate(id) {
    load().then(function () {
      if (!data) return;
      var f = fassById(id) || fassById(data.activeFassId) || data.fasses[0];
      if (!f) return;
      activeId = f.id;
      renderMap();
      renderList();
      renderArticle(f);
      if (window.__dostNav) window.__dostNav.setHash("fusus", f.id);
      if (!crossLinkSubscribed && window.__dostCrossLink && window.__dostCrossLink.onReady) {
        crossLinkSubscribed = true;
        window.__dostCrossLink.onReady(function () { if (data && activeId) renderArticle(fassById(activeId)); });
      }
    });
  }

  window.__fususApp = {
    activate: function (id) { activate(id || activeId || null); },
    onLangChange: function () {
      if (!data || !activeId) return;
      renderList();
      if (mapScene) mapScene.setLang();
      renderArticle(fassById(activeId));
    },
  };
})();
