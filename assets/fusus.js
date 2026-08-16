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

  // B2 "Kaldığın yer": bkz. futuhat.js'teki aynı isimli mantık.
  var LAST_FASS_KEY = "dost-fusus-last-fass";
  function saveLastFass(id) {
    try { localStorage.setItem(LAST_FASS_KEY, id); } catch (_) {}
  }
  function loadLastFass() {
    try { return localStorage.getItem(LAST_FASS_KEY); } catch (_) { return null; }
  }

  // B1 "başlangıç güzergâhı": bkz. futuhat.js'teki aynı isimli mantık --
  // activeFassId (fs27) de okumanın en son ulaştığı fass, fs1 değil.
  var isDefaultLanding = false;

  function t(d) { return d ? I18n.pick3(d) : ""; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Yazdır düğmesinin yanına paylaş düğmesi (kullanıcı isteği, 2026-08-16):
  // futuhat.js'teki sharePart/showToast ile aynı desen -- navigator.share
  // varsa oradan, yoksa panoya kopyala + geçici bir uyarı.
  function routeBase() {
    var baseEl = document.querySelector("base");
    if (!baseEl) return "";
    try {
      var u = new URL(baseEl.getAttribute("href"), location.origin);
      return u.pathname.replace(/\/+$/, "");
    } catch (e) { return ""; }
  }
  function shareFass(f) {
    var url = location.origin + routeBase() + "/fusus/" + f.id;
    var title = t({ tr: "Dost Arabî", en: "Dost Arabi", pt: "Dost Arabi" }) + " — " + t(f.prophet ? { tr: f.no + ". " + f.prophet.tr, en: f.no + ". " + f.prophet.en, pt: f.no + ". " + f.prophet.pt } : f.title);
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        showToast(t({ tr: "Bağlantı kopyalandı", en: "Link copied", pt: "Link copiado" }));
      });
    }
  }
  var toastEl = null, toastTimer = null;
  function showToast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "futuhat-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("futuhat-toast--visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("futuhat-toast--visible"); }, 2400);
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
      + '<button type="button" class="fusus-figure__expand" data-expand="' + esc(key) + '" aria-label="'
      + esc(t({ tr: "Çizimi büyüt", en: "Enlarge diagram", pt: "Ampliar diagrama" })) + '">⤢</button>'
      + '<figcaption class="fusus-figure__cap">'
      + (block.caption ? linkify(t(block.caption)) : "")
      + (block.source ? '<cite>' + esc(t(block.source)) + "</cite>" : "")
      + "</figcaption></figure>";
  }

  // Lightbox açıkken içeride ayrıca kurulan (daha büyük) sarmal sahnesi --
  // Fütûhât'taki gibi statik SVG kopyalamıyoruz, çünkü sarmalın kendi
  // dönüşü ve tıklanınca değişen not paneli D3 gibi canlı bir mekanizma;
  // kopyalanan innerHTML bu davranışı taşımazdı. Onun yerine aynı `spec`
  // ile DostHelix.mount()'u lightbox'ın içinde bir daha çağırıyoruz.
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
    var wrap = document.querySelector(".cizim-lightbox__svg-wrap");
    if (!wrap) return;
    // `.cizim-lightbox__svg-wrap` sitedeki HER lightbox kullanımının
    // paylaştığı tek (kalıcı) düğüm -- kendi sınıf listesine dokunmak
    // (DostHelix.mount()'un ekleyip hiç kaldırmadığı "helix-scene" gibi)
    // sonraki, Füsûs'le ilgisiz bir lightbox açılışına da yapışık kalırdı.
    // Bunun yerine kendi alt kabımızı açıyoruz; `open()` zaten her
    // çağrıda wrap'ın içeriğini temizliyor, o yüzden ayrıca silmemiz
    // gerekmiyor.
    var host = document.createElement("div");
    host.className = "fusus-figure__scene fusus-figure__scene--lightbox";
    wrap.appendChild(host);
    lightboxScene = window.DostHelix.mount(host, Object.assign({}, spec, { maxH: 620 }));
  }

  function mountHelixBlocks(scope, blocks, captions) {
    Object.keys(blocks).forEach(function (key) {
      var host = scope.querySelector('[data-helix="' + key + '"]');
      if (!host || !window.DostHelix) return;
      var spec = blocks[key];
      var s = window.DostHelix.mount(host, spec);
      if (s) sectionScenes.push(s);
      // Büyüt düğmesi ayrı bir öğe -- sahnenin kendi düğümleri zaten
      // tıklamayı not panelini değiştirmek için kullanıyor (bkz. helix.js);
      // aynı tıklamayı hem nota hem popup'a bağlamak ikisini çakıştırırdı.
      var btn = scope.querySelector('[data-expand="' + key + '"]');
      if (btn) {
        var captionHtml = (captions && captions[key]) || "";
        btn.addEventListener("click", function () { openHelixLightbox(spec, captionHtml); });
      }
    });
  }

  function lightboxCaptionText(block) {
    // Fütûhât'ın diyagram büyütme kalıbıyla aynı kural (assets/futuhat.js):
    // büyütülmüş görünümde caption VEYA source gösterilir, ikisi birden
    // değil, ve çapraz-link eklenmez (kapanmayan bir bağlantı modalin
    // içinde kafa karıştırırdı).
    if (block.caption) return t(block.caption);
    if (block.source) return t(block.source);
    return "";
  }

  function renderArticle(f) {
    clearSectionScenes();
    var helixes = {};
    var captions = {};
    var idx = 0;

    var html = "";
    if (isDefaultLanding && data.fasses[0] && data.fasses[0].id !== f.id) {
      html += '<div class="futuhat-start-hint fusus-start-hint">'
        + "<p>" + esc(t({
          tr: "Bu, okumanın en son ulaştığı yer. Yeni geliyorsan, baştan başlamak isteyebilirsin.",
          en: "This is where the reading currently stands. If you're new here, you may want to start from the beginning.",
          pt: "É aqui que a leitura chegou. Se você é novo aqui, talvez queira começar do início.",
        })) + "</p>"
        + '<button type="button" class="futuhat-start-hint__btn" data-start-fass="' + esc(data.fasses[0].id) + '">'
        + esc(t({ tr: "Baştan başla", en: "Start from the beginning", pt: "Começar do início" })) + "</button>"
        + '<button type="button" class="futuhat-start-hint__close" aria-label="' + esc(t({ tr: "Kapat", en: "Close", pt: "Fechar" })) + '">×</button>'
        + "</div>";
    }
    html += '<header class="fusus-article__head">'
      + '<button type="button" class="fusus-print-btn" title="' + esc(t({ tr: "Yazdır", en: "Print", pt: "Imprimir" })) + ' / Print / Imprimir" aria-label="Yazdır / Print / Imprimir">'
      + '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="6" y="3" width="12" height="6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="9" width="16" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="7" y="14" width="10" height="7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
      + "</button>"
      + '<button type="button" class="fusus-share-btn" title="' + esc(t({ tr: "Paylaş", en: "Share", pt: "Compartilhar" })) + ' / Share / Compartilhar" aria-label="Paylaş / Share / Compartilhar">'
      + '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="5.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="18.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="8.3" y1="10.8" x2="15.7" y2="6.7" stroke="currentColor" stroke-width="1.6"/><line x1="8.3" y1="13.2" x2="15.7" y2="17.3" stroke="currentColor" stroke-width="1.6"/></svg>'
      + "</button>"
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
      captions[mk] = lightboxCaptionText(f.mainHelix);
      html += helixBlockHtml(f.mainHelix, mk);
    }

    f.sections.forEach(function (sec) {
      html += '<section class="fusus-section" id="' + esc(sec.id) + '">'
        + "<h3>" + esc(t(sec.heading)) + "</h3>";
      sec.blocks.forEach(function (b) {
        if (b.type === "p") {
          html += "<p>" + linkify(t(b.text)) + "</p>";
        } else if (b.type === "serh") {
          html += '<div class="fusus-serh">'
            + '<div class="fusus-serh__col fusus-serh__col--konuk">'
            + '<span class="fusus-serh__eyebrow">' + esc(t({ tr: "Konuk'un okuduğu", en: "What Konuk reads", pt: "O que Konuk lê" })) + "</span>"
            + "<p>" + linkify(t(b.konuk)) + "</p></div>"
            + '<div class="fusus-serh__col fusus-serh__col--konevi">'
            + '<span class="fusus-serh__eyebrow">' + esc(t({ tr: "Konevî'nin eklediği", en: "What Qunawi adds", pt: "O que Qunawi acrescenta" })) + "</span>"
            + "<p>" + linkify(t(b.konevi)) + "</p>"
            + '<cite class="fusus-serh__kaynak">' + esc(t(b.kaynak)) + "</cite>"
            + "</div></div>";
        } else if (b.type === "helix") {
          var k = "s" + (idx++);
          helixes[k] = Object.assign({}, b.helix, { title: sec.heading });
          captions[k] = lightboxCaptionText(b);
          html += helixBlockHtml(b, k);
        }
      });
      html += "</section>";
    });

    html += '<div id="fusus-anlamsal"></div>';
    html += '<div id="fusus-yakin-pasaj"></div>';

    if (f.sources && f.sources.length) {
      html += '<footer class="fusus-article__sources"><h3>'
        + esc(t({ tr: "Kaynak", en: "Source", pt: "Fonte" })) + "</h3><ul>"
        + f.sources.map(function (s) { return "<li>" + esc(t(s)) + "</li>"; }).join("")
        + "</ul></footer>";
    }

    articleEl.innerHTML = html;
    mountHelixBlocks(articleEl, helixes, captions);
    renderAnlamsalBaglantilar(f);
    renderYakinPasajlar(f);
    var printBtn = articleEl.querySelector(".fusus-print-btn");
    if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
    var shareBtn = articleEl.querySelector(".fusus-share-btn");
    if (shareBtn) shareBtn.addEventListener("click", function () { shareFass(f); });
    var startBtn = articleEl.querySelector("[data-start-fass]");
    var startClose = articleEl.querySelector(".fusus-start-hint .futuhat-start-hint__close");
    if (startBtn) {
      startBtn.addEventListener("click", function () {
        isDefaultLanding = false;
        activate(startBtn.getAttribute("data-start-fass"));
      });
    }
    if (startClose) {
      startClose.addEventListener("click", function () {
        var hint = articleEl.querySelector(".fusus-start-hint");
        if (hint) hint.remove();
      });
    }
  }

  // Embedding altyapısı: bkz. assets/futuhat.js'teki aynı adlı fonksiyon --
  // burada Füsûs tarafı. Aynı veri dosyası (data/ibn-arabi/anlamsal-
  // baglantilar.json), aynı görsel aile (kesikli çerçeve = bizim ölçümümüz).
  var anlamsalPromise = null;
  function fetchAnlamsalBaglantilar() {
    if (!anlamsalPromise) {
      anlamsalPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/anlamsal-baglantilar.json").catch(function () { return null; });
    }
    return anlamsalPromise;
  }
  function renderAnlamsalBaglantilar(f) {
    var mount = document.getElementById("fusus-anlamsal");
    if (!mount) return;
    fetchAnlamsalBaglantilar().then(function (baglantiData) {
      var liste = baglantiData && baglantiData.dizin && baglantiData.dizin[f.id];
      if (!mount.isConnected || !liste || !liste.length) return;
      var html = '<div class="futuhat-anlamsal-box"><p class="futuhat-anlamsal-box__eyebrow">'
        + esc(t({ tr: "Bu konuyu başka nerelerde görüyoruz?", en: "Where else do we see this?", pt: "Onde mais vemos isto?" }))
        + "</p>";
      liste.forEach(function (baglanti) {
        html += '<a class="futuhat-anlamsal-box__item" href="' + esc(window.__dostNav.href(baglanti.view, baglanti.id)) + '" data-view="' + esc(baglanti.view) + '" data-id="' + esc(baglanti.id) + '">'
          + '<span class="futuhat-anlamsal-box__title">' + esc(t(baglanti.title)) + "</span>"
          + '<span class="futuhat-anlamsal-box__sebep">' + esc(t(baglanti.sebep)) + "</span></a>";
      });
      html += "</div>";
      mount.innerHTML = html;
      mount.querySelectorAll(".futuhat-anlamsal-box__item").forEach(function (item) {
        item.addEventListener("click", function (e) {
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          window.__dostNav.goTo(item.dataset.view, item.dataset.id);
        });
      });
    });
  }

  // FAZ 5: bkz. assets/futuhat.js'teki aynı adlı fonksiyon -- burada Füsûs
  // tarafı. Bu sonuçlar HİÇ insan gözden geçirmesinden geçmedi (yukarıdaki
  // elle onaylanmış anlamsal-baglantilar.json'dan farklı); yalnız
  // "Göster"e basılınca data/ibn-arabi/pasaj-vektorleri-<dil>.bin iniyor.
  function renderYakinPasajlar(f) {
    var mount = document.getElementById("fusus-yakin-pasaj");
    if (!mount || !window.DostAnlamsalYakin) return;
    var html = '<div class="futuhat-anlamsal-box futuhat-anlamsal-box--deneysel">'
      + '<p class="futuhat-anlamsal-box__eyebrow">' + esc(t({
        tr: "Anlamca yakın olabilecek pasajlar (deneysel)",
        en: "Passages that may be semantically close (experimental)",
        pt: "Passagens que podem ser semanticamente próximas (experimental)",
      })) + "</p>"
      + '<p class="futuhat-anlamsal-box__not">' + esc(t({
        tr: "Bu bizim ölçümümüzdür, Dost'un çapraz-referansı değildir; embedding benzerliğine göre hesaplanmıştır ve hiçbir insan gözden geçirmesinden geçmemiştir.",
        en: "This is our own measurement, not Dost's cross-reference; computed from embedding similarity, and has not passed any human review.",
        pt: "Esta é a nossa própria medição, não uma referência cruzada de Dost; calculada por similaridade de embedding, e não passou por nenhuma revisão humana.",
      })) + "</p>"
      + '<button type="button" class="futuhat-anlamsal-box__gosterBtn">' + esc(t({ tr: "Göster", en: "Show", pt: "Mostrar" })) + "</button>"
      + "</div>";
    mount.innerHTML = html;
    var box = mount.querySelector(".futuhat-anlamsal-box");
    var btn = box.querySelector(".futuhat-anlamsal-box__gosterBtn");
    btn.addEventListener("click", function () {
      btn.disabled = true;
      btn.textContent = t({ tr: "Yükleniyor…", en: "Loading…", pt: "Carregando…" });
      window.DostAnlamsalYakin.bul(f.id, I18n.getLang(), 5).then(function (sonuclar) {
        btn.remove();
        if (!sonuclar.length) {
          var bos = document.createElement("p");
          bos.className = "futuhat-anlamsal-box__not";
          bos.textContent = t({ tr: "Bu fass için yakın bir pasaj bulunamadı.", en: "No close passage found for this bezel.", pt: "Nenhuma passagem próxima encontrada para este engaste." });
          box.appendChild(bos);
          return;
        }
        sonuclar.forEach(function (s) {
          var item = document.createElement("a");
          item.className = "futuhat-anlamsal-box__item";
          // pasaj-vektorleri-*.json'daki route kök-göreli ("/futuhat/...") --
          // canlıda (base="/") sorun çıkarmıyordu ama önizlemede (base=
          // "/dost-onizleme/") kökten çözüldüğü için 404 veriyordu (2026-08-04
          // kullanıcı bildirimi, futuhat.js'teki ikizinde bulundu).
          item.href = s.route.replace(/^\//, "");
          item.innerHTML = '<span class="futuhat-anlamsal-box__title">' + esc(s.baslik) + "</span>"
            + '<span class="futuhat-anlamsal-box__sebep">' + esc(s.ozet) + "</span>";
          box.appendChild(item);
        });
      }).catch(function () {
        btn.textContent = t({ tr: "Şu an kullanılamıyor", en: "Unavailable right now", pt: "Indisponível no momento" });
      });
    });
  }

  function activate(id) {
    load().then(function () {
      if (!data) return;
      // Yavaş ağ bekçisi: veri gelene kadar kullanıcı başka görünüme
      // geçmiş olabilir; geç gelen .then render+setHash ile URL'yi ve
      // başlığı artık bakılmayan görünüme yazıyordu (futuhat.js'teki
      // bekçiyle aynı aile). Aynı bekçi aşağıdaki onReady aboneliğinde de
      // var: o abonelik başka görünümlerin verisi hazır olunca da düşüyor.
      if (!window.DostGraphUtils.isViewActive(wrap)) return;
      var f = fassById(id) || (!id ? fassById(loadLastFass()) : null) || fassById(data.activeFassId) || data.fasses[0];
      if (!f) return;
      isDefaultLanding = !id && !loadLastFass();
      activeId = f.id;
      saveLastFass(f.id);
      renderMap();
      renderList();
      renderArticle(f);
      if (window.__dostNav) window.__dostNav.setHash("fusus", f.id);
      if (!crossLinkSubscribed && window.__dostCrossLink && window.__dostCrossLink.onReady) {
        crossLinkSubscribed = true;
        window.__dostCrossLink.onReady(function () {
          if (data && activeId && window.DostGraphUtils.isViewActive(wrap)) renderArticle(fassById(activeId));
        });
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
