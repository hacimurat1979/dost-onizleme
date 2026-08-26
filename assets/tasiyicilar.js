/* Dost Arabî — "Taşıyanlar" görünümü.
 *
 * Neden ayrı bir görünüm: içerik iki Fütûhât bölümünden geliyor (13 ve 476)
 * ama ikisi de bir *kısım okuması* değil, ayakta duran bir yapı tarif
 * ediyor. Füsûs sekmesine koymak yanlış olurdu -- kaynak Fütûhât. Kısım
 * sayfalarının içine gömmek de olmazdı, çünkü şema iki kısmın ortasında
 * duruyor ve ikisine birden bakıyor.
 *
 * Neden helix.js'i kullanmıyor: helix.js TEK iplikli bir sahne. Burada
 * gereken şey iki ayrı çift-iplikli sistem (peygamber ipliği + melek
 * ipliği, ters yönde dönen), aralarında basamaklar, ve birinin ötekinin
 * içinde bir köşede durması. Projeksiyon matematiği aynı fikirde
 * (helixPoint/project), ama sahne yapısı farklı olduğu için ayrı yazıldı;
 * helix.js bilerek sadeliğini koruyor.
 *
 * Gövde silüeti: yarıçap yükseklikle sabit değil, ortada genişleyip iki
 * uçta daralan bir profilden geçiyor (rProfile). Amaç bir insan çizmek
 * değil -- şeffaf bir beden çizip üstüne isim yazmak istemedik; amaç
 * dört taşıyıcının bir *gövde* gibi birbirine bağlı olduğunu göstermek.
 */
(function () {
  "use strict";

  var I18n = window.DostI18n;
  var wrap = document.getElementById("tasiyicilar-wrap");
  if (!wrap) return;

  var sceneEl = document.getElementById("tasiyicilar-scene");
  var noteEl = document.getElementById("tasiyicilar-note");
  var introEl = document.getElementById("tasiyicilar-intro");
  var footEl = document.getElementById("tasiyicilar-foot");

  var SVGNS = "http://www.w3.org/2000/svg";
  var FOCAL = 900;
  var PITCH = 0.58;
  var SPIN_PER_MS = 0.000048;   // ~36 sn/tur -- helix.js'ten biraz daha sakin

  var data = null;
  var dataPromise = null;
  var sc = null;                // sahne durumu
  var focusKey = null;

  function t(d) { return d ? I18n.pick3(d) : ""; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function linkify(x) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(x) : x;
  }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function el(name) { return document.createElementNS(SVGNS, name); }

  // --- geometri ---------------------------------------------------------
  // u: 0 (en alt) → 1 (en üst). Ortada genişleyen bir iğ profili; iki uçta
  // daralması gövde hissini veriyor. sin eğrisi seçildi çünkü türevi uçlarda
  // yumuşak -- keskin bir omuz çizgisi istemiyoruz.
  // Genlik bilerek ölçülü (0.62 taban): ilk denemede 0.40 tabanla profil
  // öyle şişiyordu ki sarmal bir gövdeden çok yatık bir elipse benziyordu.
  function rProfile(u) {
    return 0.62 + 0.38 * Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
  }

  // sistem: { baseR, turns, dir, offX, offZ, katSayisi }
  // faz: 0 → peygamber ipliği, PI → melek ipliği (karşılıklı)
  function strandPoint(sys, u, faz) {
    var a = sys.dir * (u * Math.PI * 2 * sys.turns) - Math.PI / 2 + faz;
    var r = sys.baseR * rProfile(u);
    return {
      x: sys.offX + r * Math.cos(a),
      z: sys.offZ + r * Math.sin(a),
      y: sc.riseH / 2 - u * sc.riseH,
    };
  }

  function project(p) {
    var cy = Math.cos(sc.yaw), sy = Math.sin(sc.yaw);
    var x1 = p.x * cy + p.z * sy;
    var z1 = -p.x * sy + p.z * cy;
    var cp = Math.cos(PITCH), sp = Math.sin(PITCH);
    var y2 = p.y * cp - z1 * sp;
    var z2 = p.y * sp + z1 * cp;
    var zc = Math.max(z2, -FOCAL * 0.85);
    var d = FOCAL / (FOCAL + zc);
    return { x: sc.cx + x1 * d, y: sc.cy + y2 * d, depth: d, z: z2 };
  }

  function strandPath(sys, faz, steps) {
    var d = "";
    for (var i = 0; i <= steps; i++) {
      var p = project(strandPoint(sys, i / steps, faz));
      d += (i ? "L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1);
    }
    return d;
  }

  // Katın yüksekliği: en alttaki 0'a değil biraz içeriye, en üstteki 1'e
  // değil biraz içeriye konuyor -- uçlarda yarıçap sıfıra yaklaştığı için
  // düğümler tam uçta üst üste binerdi.
  function katU(i, n) { return 0.12 + (i / Math.max(1, n - 1)) * 0.76; }

  // --- veri → düğüm listesi --------------------------------------------
  function buildNodes() {
    var out = [];
    data.sistemler.forEach(function (s) {
      var sys = sc.sys[s.id];
      s.katlar.forEach(function (k, i) {
        var u = katU(i, s.katlar.length);
        if (s.id === "ars") {
          // Arş katının iki adı var: peygamber ve melek, karşılıklı.
          out.push({ key: s.id + ":" + k.id + ":p", sys: sys, u: u, faz: 0,
                     ad: k.peygamber, kat: k, sistem: s, rol: "peygamber", accent: true });
          out.push({ key: s.id + ":" + k.id + ":m", sys: sys, u: u, faz: Math.PI,
                     ad: k.melek, kat: k, sistem: s, rol: "melek", accent: false });
        } else {
          // Kalp katının tek adı var; yine de iki iplik çiziliyor, düğüm
          // peygamber ipliğinin üstünde duruyor.
          out.push({ key: s.id + ":" + k.id, sys: sys, u: u, faz: 0,
                     ad: k.label, kat: k, sistem: s, rol: "kat", accent: true });
        }
      });
    });
    return out;
  }

  // --- yerleşim ---------------------------------------------------------
  function layout() {
    var w = sc.svg.clientWidth || sceneEl.clientWidth || 560;
    var h = Math.max(460, Math.min(700, w * 1.05));
    sc.w = w; sc.h = h;
    sc.cx = w / 2; sc.cy = h * 0.5;
    sc.riseH = h * 0.78;
    // Yarıçap genişliğe değil YÜKSEKLİĞE bağlı: geniş ekranda sarmalın
    // şişip yatık bir elipse dönüşmemesi için. Gövde dar ve uzun olmalı;
    // helezonun okunur kalması da buna bağlı (bkz. hal.js'teki aynı
    // "dropH > 2π·tan(pitch)·r" kaygısı).
    sc.sys.kalp.baseR = Math.max(64, Math.min(w * 0.30, h * 0.20));
    // Dış sistem (kalp) geniş; iç sistem (Arş) dar ve bir yana kaymış --
    // metnin cümlesi: "kalbin bir köşesinde".
    sc.sys.ars.baseR = sc.sys.kalp.baseR * 0.34;
    sc.sys.ars.offX = sc.sys.kalp.baseR * 0.52;
    sc.sys.ars.offZ = -sc.sys.kalp.baseR * 0.34;
    sc.svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    sc.svg.setAttribute("height", h);
  }

  // --- DOM'u bir kez kur -------------------------------------------------
  function build() {
    sc.svg.textContent = "";
    sc.strandEls = {};
    sc.rungEls = [];

    // İplikler önce (arkada), sonra basamaklar, en son düğümler.
    ["kalp", "ars"].forEach(function (id) {
      sc.strandEls[id] = [0, Math.PI].map(function (faz, k) {
        var p = el("path");
        p.setAttribute("class", "tasiyici-strand tasiyici-strand--" + id
          + (k ? " tasiyici-strand--melek" : ""));
        sc.svg.appendChild(p);
        return p;
      });
    });

    sc.nodes.forEach(function (n) {
      if (n.rol !== "peygamber") return;
      var l = el("line");
      l.setAttribute("class", "tasiyici-rung");
      sc.svg.appendChild(l);
      sc.rungEls.push({ line: l, node: n });
    });

    sc.gs = sc.nodes.map(function (n, i) {
      var g = el("g");
      g.setAttribute("data-i", i);
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "listitem");
      var ttl = el("title"), c = el("circle"), tx = el("text");
      g.appendChild(ttl); g.appendChild(c); g.appendChild(tx);
      sc.svg.appendChild(g);
      return { g: g, title: ttl, circle: c, text: tx, label: null };
    });
    sc.order = "";
  }

  function draw() {
    ["kalp", "ars"].forEach(function (id) {
      var sys = sc.sys[id];
      sc.strandEls[id][0].setAttribute("d", strandPath(sys, 0, 150));
      sc.strandEls[id][1].setAttribute("d", strandPath(sys, Math.PI, 150));
    });

    sc.rungEls.forEach(function (r) {
      var a = project(strandPoint(r.node.sys, r.node.u, 0));
      var b = project(strandPoint(r.node.sys, r.node.u, Math.PI));
      r.line.setAttribute("x1", a.x.toFixed(1)); r.line.setAttribute("y1", a.y.toFixed(1));
      r.line.setAttribute("x2", b.x.toFixed(1)); r.line.setAttribute("y2", b.y.toFixed(1));
      r.line.setAttribute("style", "opacity:" + (0.20 + 0.30 * Math.min(a.depth, b.depth)).toFixed(2));
    });

    var pts = sc.nodes.map(function (n, i) {
      return { n: n, i: i, p: project(strandPoint(n.sys, n.u, n.faz)) };
    });

    // Etiketler iki aşamada yerleştiriliyor: önce hepsinin kutusu
    // hesaplanıyor, sonra öne yakın olandan başlayarak çakışanlar
    // gizleniyor. Tek aşamada yazınca iki sistemin düğümleri belirli
    // dönüş açılarında üst üste biniyor ve "İsrâfîl|Hayat" gibi okunmaz
    // yığınlar çıkıyordu. Odaktaki düğüm her zaman öncelikli.
    // Doluluk listesi düğüm dairelerinin kendisiyle başlıyor: yalnız
    // etiket-etiket çakışmasına bakınca bir etiket komşu bir düğümün
    // üstüne oturabiliyordu ("Will" ile "İbrâhîm" düğümü gibi).
    var boxes = pts.map(function (it) {
      var rr = (it.n.accent ? 8.0 : 5.8) * it.p.depth;
      return { x1: it.p.x - rr, x2: it.p.x + rr, y1: it.p.y - rr, y2: it.p.y + rr };
    });
    var placed = pts.slice().sort(function (a, b) {
      if ((focusKey === a.n.key) !== (focusKey === b.n.key)) return focusKey === a.n.key ? -1 : 1;
      return a.p.z - b.p.z;   // küçük z = öne yakın
    });

    placed.forEach(function (it) {
      var p = it.p, n = it.n, g = sc.gs[it.i];
      var r = (n.accent ? 8.0 : 5.8) * p.depth;
      g.g.setAttribute("class", "tasiyici-node tasiyici-node--" + n.sistem.id
        + (n.accent ? " tasiyici-node--accent" : "")
        + (focusKey === n.key ? " is-focus" : ""));
      var ad = t(n.ad);
      if (g.label !== ad) {
        g.label = ad;
        g.title.textContent = ad;
        g.text.textContent = ad;
        g.g.setAttribute("aria-label", ad + " — " + t(n.kat.label));
      }
      g.circle.setAttribute("cx", p.x.toFixed(1));
      g.circle.setAttribute("cy", p.y.toFixed(1));
      g.circle.setAttribute("r", r.toFixed(1));

      var fs = 11.5 * p.depth;
      var dx = p.x - sc.cx;
      var anchor = dx >= 0 ? "start" : "end";
      var tx = p.x + (dx >= 0 ? 1 : -1) * (r + 6);
      var ty = p.y + fs * 0.34;
      // Kaba kutu: SVG'de gerçek genişliği ölçmek (getBBox) her karede
      // reflow'a yol açardı; harf başına ~0.55em yeterince iyi bir tahmin.
      var wBox = ad.length * fs * 0.55;
      var box = {
        x1: anchor === "start" ? tx : tx - wBox,
        x2: anchor === "start" ? tx + wBox : tx,
        y1: ty - fs, y2: ty + fs * 0.3,
      };
      var carpisiyor = boxes.some(function (b) {
        return box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1;
      });
      if (carpisiyor) {
        g.text.setAttribute("style", "display:none");
        return;
      }
      boxes.push(box);
      g.text.setAttribute("x", tx.toFixed(1));
      g.text.setAttribute("y", ty.toFixed(1));
      g.text.setAttribute("text-anchor", anchor);
      g.text.setAttribute("style", "font-size:" + fs.toFixed(1)
        + "px;opacity:" + (0.42 + 0.58 * p.depth).toFixed(2));
    });

    if (sc.hover) return;
    var sorted = pts.slice().sort(function (a, b) { return b.p.z - a.p.z; });
    var key = sorted.map(function (x) { return x.i; }).join(",");
    if (key === sc.order) return;
    sc.order = key;
    sorted.forEach(function (x) { sc.svg.appendChild(sc.gs[x.i].g); });
  }

  function renderNote() {
    var n = sc.nodes.filter(function (x) { return x.key === focusKey; })[0] || sc.nodes[0];
    if (!n) { noteEl.innerHTML = ""; return; }
    var rolAd = "";
    if (n.rol === "peygamber") rolAd = t({ tr: "peygamber", en: "prophet", pt: "profeta" });
    else if (n.rol === "melek") rolAd = t({ tr: "melek", en: "angel", pt: "anjo" });
    noteEl.innerHTML =
      '<p class="tasiyici-note__sistem">' + esc(t(n.sistem.label)) + "</p>"
      + '<p class="tasiyici-note__label">' + esc(t(n.kat.label))
      + (rolAd ? ' <span class="tasiyici-note__rol">' + esc(t(n.ad)) + " · " + esc(rolAd) + "</span>" : "")
      + "</p>"
      + '<div class="tasiyici-note__body">' + linkify(t(n.kat.note)) + "</div>"
      + '<p class="tasiyici-note__src">' + esc(t(n.sistem.kaynak)) + "</p>";
  }

  // 2026-08-26: GU.createFrameLoop'a taşındı -- eskiden bu döngü yalnız
  // sc.el.isConnected'e bakıyordu, GU.isViewActive'in kapattığı asıl deliği
  // (görünüm gizliyken/sekme arka plandayken bile sonsuza kadar 60fps
  // tıklamaya devam etmek) kapatmıyordu. wrap artık aynı diğer beş
  // görünümdeki gibi görünürlük kapısı olarak kullanılıyor.
  var frameLoop = window.DostGraphUtils.createFrameLoop(wrap, function (ts, dt) {
    if (!sc || !sc.el.isConnected) return false;
    if (sc.spin && sc.visible && !sc.hover) {
      sc.yaw += dt * SPIN_PER_MS * Math.PI * 2;
      draw();
    }
    return true;
  });
  function ensureLoop() { if (sc) frameLoop.ensureFrame(); }

  // K-04/O-02 (uzman paneli denetimi 2026-08-17): bu görünümde ayrı bir
  // isabet şeridi (link-hit) YOK ve gerekmedi -- svg'nin click dinleyicisi
  // düğüme doğrudan isabet olmasa da 34px yarıçap içindeki en yakın düğümü
  // seçiyor; fiilî dokunma hedefi WCAG 2.5.8'in 24px tabanının üstünde.
  function nearest(e) {
    var r = sc.svg.getBoundingClientRect();
    if (!r.width) return -1;
    var vb = sc.svg.viewBox.baseVal;
    var x = (e.clientX - r.left) / r.width * (vb.width || r.width);
    var y = (e.clientY - r.top) / r.height * (vb.height || r.height);
    var best = -1, bd = Infinity;
    sc.nodes.forEach(function (n, i) {
      var p = project(strandPoint(n.sys, n.u, n.faz));
      var d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bd) { bd = d; best = i; }
    });
    return bd <= 34 * 34 ? best : -1;
  }

  function select(i) {
    if (i < 0 || i >= sc.nodes.length) return;
    focusKey = sc.nodes[i].key;
    draw();
    renderNote();
  }

  function mountScene() {
    sc = {
      el: sceneEl,
      yaw: -0.5,
      hover: false,
      visible: true,
      last: 0,
      spin: !reducedMotion(),
      sys: {
        // İki tam turdan fazla: dört kat bir tura sığdırıldığında sarmal
        // "dönüyor" gibi değil "eğik bir halka" gibi okunuyordu.
        kalp: { turns: 2.1, dir: 1, offX: 0, offZ: 0 },
        ars: { turns: 2.45, dir: -1, offX: 0, offZ: 0 },
      },
    };
    sceneEl.innerHTML = '<svg class="tasiyici-svg" role="list" aria-label="'
      + esc(t({ tr: "Taşıyanlar şeması", en: "Diagram of the bearers", pt: "Diagrama dos portadores" }))
      + '"></svg>';
    sc.svg = sceneEl.querySelector(".tasiyici-svg");
    layout();
    sc.nodes = buildNodes();
    focusKey = focusKey || sc.nodes[0].key;
    build();
    draw();
    renderNote();

    sceneEl.addEventListener("pointerdown", function () { sc.hover = true; });
    sceneEl.addEventListener("pointerenter", function () { sc.hover = true; });
    sceneEl.addEventListener("pointerleave", function () { sc.hover = false; ensureLoop(); });
    sceneEl.addEventListener("focusin", function () { sc.hover = true; });
    sceneEl.addEventListener("focusout", function () { sc.hover = false; ensureLoop(); });

    sc.svg.addEventListener("click", function (e) {
      var hit = e.target.closest && e.target.closest(".tasiyici-node");
      var i = hit ? +hit.dataset.i : nearest(e);
      if (i < 0) return;
      select(i);
      try { sc.gs[i].g.focus({ preventScroll: true }); } catch (err) { /* eski tarayıcı */ }
    });
    sc.svg.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        var g = e.target.closest && e.target.closest(".tasiyici-node");
        if (g) { e.preventDefault(); select(+g.dataset.i); }
        return;
      }
      var d = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1
        : ((e.key === "ArrowLeft" || e.key === "ArrowUp") ? -1 : 0);
      if (!d) return;
      e.preventDefault();
      var cur = sc.nodes.findIndex(function (n) { return n.key === focusKey; });
      var next = (cur + d + sc.nodes.length) % sc.nodes.length;
      select(next);
      var gg = sc.svg.querySelector('.tasiyici-node[data-i="' + next + '"]');
      if (gg) gg.focus();
    });

    if (window.IntersectionObserver) {
      sc.io = new IntersectionObserver(function (en) {
        sc.visible = en.some(function (x) { return x.isIntersecting; });
        if (sc.visible) ensureLoop();
      }, { threshold: 0.05 });
      sc.io.observe(sceneEl);
    }
    if (window.ResizeObserver) {
      sc.ro = new ResizeObserver(function () { layout(); draw(); });
      sc.ro.observe(sceneEl);
    }
    ensureLoop();
  }

  function renderText() {
    introEl.innerHTML = '<p class="tasiyici-intro__p">' + linkify(t(data.intro)) + "</p>"
      + '<p class="tasiyici-intro__p tasiyici-intro__p--cizim">' + linkify(t(data.cizimNotu)) + "</p>";
    var sira = data.sistemler.map(function (s) {
      return '<div class="tasiyici-sira"><h2>' + esc(t(s.label)) + "</h2>"
        + "<p>" + linkify(t(s.note)) + "</p>"
        + '<p class="tasiyici-sira__not">' + linkify(t(s.siraNotu)) + "</p></div>";
    }).join("");
    var bag = (data.baglantilar || []).map(function (b) {
      return '<a class="cross-link" data-view="' + esc(b.view) + '" data-id="' + esc(b.id)
        + '" href="' + (window.__dostNav ? window.__dostNav.href(b.view, b.id) : "#")
        + '">' + esc(t(b.label)) + "</a>";
    }).join(" · ");
    footEl.innerHTML = sira
      + '<p class="tasiyici-sonnot">' + linkify(t(data.sonNot)) + "</p>"
      + (bag ? '<p class="tasiyici-bag">' + bag + "</p>" : "");
  }

  function load() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("tasiyicilar-wrap");
    dataPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/tasiyicilar.json")
      .then(function (d) {
        data = d;
        if (window.DostViewStatus) window.DostViewStatus.hide("tasiyicilar-wrap");
        return d;
      })
      .catch(function (err) {
        console.error("Taşıyanlar verisi yüklenemedi / Failed to load bearers data", err);
        dataPromise = null;
        if (window.DostViewStatus) {
          window.DostViewStatus.showError("tasiyicilar-wrap",
            function () { window.__tasiyicilarApp.activate(); });
        }
        throw err;
      });
    return dataPromise;
  }

  function activate() {
    load().then(function () {
      if (!data) return;
      renderText();
      // Sahne, bölüm gizliyken kurulursa svg genişliği 0 olur ve şema
      // bozuk çıkar (Daphne profilinde yaşanmıştı). O yüzden her
      // etkinleştirmede yeniden yerleştiriliyor.
      if (!sc) mountScene();
      else { layout(); draw(); }
      if (window.__dostNav) window.__dostNav.setHash("tasiyicilar");
    }).catch(function () { /* hata zaten gösterildi */ });
  }

  window.__tasiyicilarApp = {
    activate: activate,
    onLangChange: function () {
      if (!data) return;
      renderText();
      if (sc) { sc.gs.forEach(function (g) { g.label = null; }); draw(); renderNote(); }
    },
  };
})();
