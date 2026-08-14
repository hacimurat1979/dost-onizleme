/* Dost Arabî — paylaşılan sarmal (helix) sahne motoru.
 *
 * Neden ayrı bir dosya: Hâller Haritası'ndaki üç boyutlu sarmal
 * (assets/hal.js içindeki `helixPoint`/`project` çifti) CLAUDE.md'de
 * "iki boyutlu bir halka ile üç boyutlu bir sarmal arasında seçim varken
 * sarmalı tercih et" ilkesinin referans uygulaması olarak anılıyor. Füsûs
 * bölümündeki bölüm-içi çizimler de aynı dili konuşsun istendi; aynı
 * matematiği ikinci kez yazmak yerine buraya çıkarıldı.
 *
 * hal.js BİLEREK dokunulmadan bırakıldı: orada sarmal, kendi zoom/pan'i,
 * kirişleri ve dönüş oku olan tam bir görünüm; burada ise bir metnin içine
 * gömülen, kendi başına duran küçük bir sahne. İkisinin ihtiyaçları farklı,
 * ortak olan yalnız nokta üretimi ile projeksiyon.
 *
 * Kullanım:
 *   const sahne = DostHelix.mount(kapsayiciEl, spec);
 *   sahne.setLang();   // dil değişince
 *   sahne.destroy();   // görünümden çıkarken
 *
 * spec = {
 *   id:      "fs1-mertebe",                     // svg içi id önekleri için
 *   nodes:   [{ id, label:{tr,en,pt}, note:{tr,en,pt}, accent?:true }, ...],
 *   turns:   1.35,        // sarmalın kaç tur döneceği (varsayılan 1.25)
 *   closing: false,       // son düğümden ilkine dönüş izi çizilsin mi
 *   caption: {tr,en,pt},  // (opsiyonel) sahnenin altına yazılacak not
 *   spinSpeed: 1,         // (opsiyonel) dönüş hızı çarpanı, varsayılan 1
 *   labelMode: "all",     // "all" | "sparse" (yalnız vurgulu+odak) | "none"
 * }
 */
(function () {
  "use strict";

  var I18n = window.DostI18n;
  var FOCAL = 900;           // perspektif odak uzaklığı (hal.js ile aynı his)
  var PITCH = 0.62;          // sahneye bakış açısı (X ekseni)
  var SPIN_PER_MS = 0.00006; // ~29 saniyede tam tur -- "sakin dönüş"
  var scenes = [];           // tek bir rAF döngüsü bütün sahneleri sürüyor
  var rafId = null;
  var uid = 0;               // sahneye özel marker id'leri için sayaç

  function pick(o) {
    if (!o) return "";
    if (I18n && I18n.pick3) return I18n.pick3(o);
    return o.tr || o.en || o.pt || "";
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // --- sarmalın parametrik tanımı --------------------------------------------
  // t tam sayı olduğunda o sıradaki düğümün yeri; kesirli değerler yolu
  // pürüzsüz çizmeyi ve kapanış izini (t > n-1) sağlıyor. hal.js'teki
  // helixPoint ile aynı fikir: yarıçap yavaşça açılırken yükseklik birikiyor,
  // böylece daire kapanırken aynı noktaya değil bir üstüne geliyor.
  function helixPoint(sc, t) {
    var n = Math.max(1, sc.nodes.length);
    var span = Math.max(1, n - 1);
    var a = -Math.PI / 2 + (t / span) * Math.PI * 2 * sc.turns;
    var r = sc.baseR * (0.78 + 0.26 * (t / span));
    var hStep = sc.riseH / span;
    return { x: r * Math.cos(a), y: -hStep * t + sc.riseH / 2, z: r * Math.sin(a) };
  }

  function project(sc, p) {
    var cyw = Math.cos(sc.yaw), syw = Math.sin(sc.yaw);
    var x1 = p.x * cyw + p.z * syw;
    var z1 = -p.x * syw + p.z * cyw;
    var cpt = Math.cos(PITCH), spt = Math.sin(PITCH);
    var y2 = p.y * cpt - z1 * spt;
    var z2 = p.y * spt + z1 * cpt;
    var zc = Math.max(z2, -FOCAL * 0.85);
    var d = FOCAL / (FOCAL + zc);
    return { x: sc.cx + x1 * d, y: sc.cy + y2 * d, depth: d, z: z2 };
  }

  function projectT(sc, t) { return project(sc, helixPoint(sc, t)); }

  function pathBetween(sc, t0, t1, steps) {
    var d = "";
    for (var s = 0; s <= steps; s++) {
      var p = projectT(sc, t0 + (t1 - t0) * (s / steps));
      d += (s === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1);
    }
    return d;
  }

  // --- çizim -----------------------------------------------------------------
  function layout(sc) {
    var w = sc.svg.clientWidth || sc.el.clientWidth || 520;
    // Yükseklik oranı sabit: sarmalın yükselişi yatay salınımı aşmalı, yoksa
    // son düğüm bir öncekinin altına düşüp sarmal bir halkaya benziyor.
    var h = Math.max(260, Math.min(sc.maxH, w * sc.hRatio));
    sc.w = w; sc.h = h;
    sc.cx = w / 2; sc.cy = h / 2;
    sc.baseR = Math.max(74, Math.min(w, h * 0.72) / 2 - 46);
    sc.riseH = Math.max(sc.baseR * 1.85, h - sc.baseR * 1.15);
    sc.svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    sc.svg.setAttribute("height", h);
  }

  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(name) { return document.createElementNS(SVGNS, name); }

  // DOM'u BİR KEZ kurar. Her karede yeniden yazmak (innerHTML) düğümleri
  // sürekli koparıp yeniden bağlıyordu; sonucu iki gerçek kusurdu:
  // klavye odağı her karede kayboluyor (yani sarmalda ok tuşlarıyla
  // gezinmek imkânsız) ve tıklama hedefi elin altından çekiliyordu
  // (2026-07-29, Playwright "element was detached from the DOM" ile
  // yakalandı). Artık öğeler yerinde duruyor, her karede yalnız
  // nitelikleri güncelleniyor.
  function build(sc) {
    sc.svg.textContent = "";
    // Okun ucu yolun hangi yönde okunacağını gösteriyor; bu olmadan
    // sarmalın nereden başlayıp nereye gittiği belli olmuyordu.
    var defs = svgEl("defs");
    var mk = svgEl("marker");
    sc.markerId = "helix-ok-" + (++uid);
    mk.setAttribute("id", sc.markerId);
    mk.setAttribute("viewBox", "0 -5 10 10");
    mk.setAttribute("refX", "9"); mk.setAttribute("refY", "0");
    mk.setAttribute("markerWidth", "5.5"); mk.setAttribute("markerHeight", "5.5");
    mk.setAttribute("orient", "auto");
    mk.setAttribute("class", "helix-scene__marker");
    var mp = svgEl("path");
    mp.setAttribute("d", "M0,-4L9,0L0,4");
    mk.appendChild(mp); defs.appendChild(mk); sc.svg.appendChild(defs);

    sc.pathEl = svgEl("path");
    sc.pathEl.setAttribute("class", "helix-scene__path");
    sc.pathEl.setAttribute("marker-end", "url(#" + sc.markerId + ")");
    sc.svg.appendChild(sc.pathEl);
    if (sc.closing) {
      sc.ghostEl = svgEl("path");
      sc.ghostEl.setAttribute("class", "helix-scene__path helix-scene__path--ghost");
      sc.svg.appendChild(sc.ghostEl);
    }
    sc.gs = sc.nodes.map(function (node, i) {
      var g = svgEl("g");
      g.setAttribute("data-i", i);
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "listitem");
      var ttl = svgEl("title");
      var c = svgEl("circle");
      var tx = svgEl("text");
      g.appendChild(ttl); g.appendChild(c); g.appendChild(tx);
      sc.svg.appendChild(g);
      return { g: g, title: ttl, circle: c, text: tx };
    });
    sc.order = "";
  }

  function draw(sc) {
    var span = Math.max(1, sc.nodes.length - 1);
    sc.pathEl.setAttribute("d", pathBetween(sc, 0, span, 120));
    if (sc.ghostEl) {
      // Kısa tutuluyor (çeyrek tur): amaç bir tur daha çizmek değil,
      // "burada bitmiyor" demek. Uzun olduğunda sahnenin üstünü kaplayıp
      // asıl yolu okunmaz hâle getiriyordu (2026-07-29).
      sc.ghostEl.setAttribute("d",
        pathBetween(sc, span, span + span * 0.22 / Math.max(0.5, sc.turns), 30));
    }

    var pts = sc.nodes.map(function (node, i) {
      return { node: node, i: i, p: projectT(sc, i) };
    });

    pts.forEach(function (it) {
      var p = it.p, node = it.node, el = sc.gs[it.i];
      var r = (node.accent ? 8.5 : 6.4) * p.depth;
      el.g.setAttribute("class", "helix-scene__node"
        + (node.accent ? " helix-scene__node--accent" : "")
        + (sc.focus === it.i ? " is-focus" : ""));
      // labelMode "sparse": yalnız vurgulu ve odaktaki düğümün adı yazılır.
      // Kalabalık sahnelerde (yirmi yedi fasslı harita) hepsini yazmak
      // üst üste binen okunmaz bir yığın üretiyordu (2026-07-29).
      // labelMode "none": hiç etiket yazılmaz (101 düğümlü Mişkât sarmalı
      // gibi çok kalabalık sahnelerde "sparse" bile odak kaydıkça sürekli
      // metin belirip kaybolan bir gürültü üretiyordu, 2026-08-14). Erişilebilir
      // ad (title/aria-label) her durumda ayrıca yazılıyor, aşağıda.
      var goster = sc.labelMode === "none" ? false
        : sc.labelMode !== "sparse" ? true
        : (node.accent || sc.focus === it.i);
      // Sıra numarası: üç boyutlu perspektifte hangi düğümün önce geldiği
      // gözle anlaşılmıyordu (2026-07-29). Veriye dokunmadan, yalnız
      // gösterimde ekleniyor; etiket zaten numarayla başlıyorsa tekrarlanmaz.
      var ham = pick(node.label);
      var label = !goster ? ""
        : (sc.numbered && !/^\d/.test(ham) ? (it.i + 1) + " · " + ham : ham);
      if (el.__label !== label) {
        el.__label = label;
        el.title.textContent = pick(node.label);
        el.text.textContent = label;
        el.g.setAttribute("aria-label", pick(node.label));
      }
      el.circle.setAttribute("cx", p.x.toFixed(1));
      el.circle.setAttribute("cy", p.y.toFixed(1));
      el.circle.setAttribute("r", r.toFixed(1));
      // Etiket, düğümün merkezden dışa bakan tarafına yazılır; yatayda
      // merkeze yakın olanlar ortalanır ki iki yandaki etiketler çakışmasın.
      var dx = p.x - sc.cx;
      var anchor = Math.abs(dx) < sc.baseR * 0.28 ? "middle" : (dx > 0 ? "start" : "end");
      var off = (anchor === "middle" ? 0 : (dx > 0 ? 1 : -1)) * (r + 7);
      el.text.setAttribute("x", (p.x + off).toFixed(1));
      el.text.setAttribute("y", (anchor === "middle" ? p.y - r - 8 : p.y + 4).toFixed(1));
      el.text.setAttribute("text-anchor", anchor);
      el.text.setAttribute("style", "font-size:" + (11.5 * p.depth).toFixed(1)
        + "px;opacity:" + (0.45 + 0.55 * p.depth).toFixed(2));
    });

    // Derinlik sıralaması (arkadakiler önce çizilsin) DOM sırasını
    // değiştirmeyi gerektiriyor, o da öğeyi kısa süre koparıyor. Bu yüzden
    // yalnız sıra GERÇEKTEN değiştiğinde ve kullanıcı sahneyle
    // uğraşmıyorken yapılıyor -- yani saniyede altmış kez değil, turda
    // birkaç kez.
    if (sc.hover) return;
    var sorted = pts.slice().sort(function (a, b) { return b.p.z - a.p.z; });
    var key = sorted.map(function (it) { return it.i; }).join(",");
    if (key === sc.order) return;
    sc.order = key;
    sorted.forEach(function (it) { sc.svg.appendChild(sc.gs[it.i].g); });
  }

  function renderNote(sc) {
    var node = sc.nodes[sc.focus];
    if (!node) { sc.note.innerHTML = ""; return; }
    var sira = (I18n && I18n.getLang && I18n.getLang() === "tr") ? "Sırada" : "Step";
    sc.note.innerHTML =
      '<p class="helix-scene__note-label"><span class="helix-scene__note-no">'
      + (sc.focus + 1) + "/" + sc.nodes.length + "</span> "
      + esc(pick(node.label)) + "</p>"
      + (node.note ? '<p class="helix-scene__note-body">' + pick(node.note) + "</p>" : "");
    sc.note.setAttribute("aria-label", sira);
  }

  function tick(ts) {
    rafId = null;
    var live = false;
    scenes.forEach(function (sc) {
      if (!sc.el.isConnected) return;
      if (sc.spin && sc.visible && !sc.hover) {
        var dt = sc.last ? Math.min(64, ts - sc.last) : 16;
        sc.yaw += dt * SPIN_PER_MS * sc.spinSpeed * Math.PI * 2;
        draw(sc);
      }
      sc.last = ts;
      if (sc.spin) live = true;
    });
    scenes = scenes.filter(function (sc) { return sc.el.isConnected; });
    if (live && scenes.length) rafId = requestAnimationFrame(tick);
  }

  function ensureLoop() {
    if (rafId == null && scenes.length) rafId = requestAnimationFrame(tick);
  }

  function mount(el, spec) {
    if (!el || !spec || !spec.nodes || !spec.nodes.length) return null;
    var sc = {
      el: el,
      nodes: spec.nodes,
      turns: spec.turns || 1.25,
      closing: !!spec.closing,
      caption: spec.caption || null,
      yaw: -0.55,
      focus: spec.initialFocus != null ? spec.initialFocus : 0,
      hover: false,
      visible: true,
      last: 0,
      spin: !reducedMotion(),
      spinSpeed: spec.spinSpeed != null ? spec.spinSpeed : 1,
      onActivate: spec.onActivate || null,
      labelMode: spec.labelMode || "all",
      hRatio: spec.hRatio || 0.78,
      maxH: spec.maxH || 430,
      numbered: spec.numbered !== false,
    };

    el.classList.add("helix-scene");
    el.innerHTML =
      '<svg class="helix-scene__svg" role="list" aria-label="'
      + esc(pick(spec.title) || (I18n && I18n.getLang() === "tr" ? "Sarmal şema" : "Spiral diagram"))
      + '"></svg>'
      + (spec.onActivate ? "" : '<div class="helix-scene__note" role="status" aria-live="polite"></div>');
    sc.svg = el.querySelector(".helix-scene__svg");
    sc.note = el.querySelector(".helix-scene__note");

    layout(sc);
    build(sc);
    draw(sc);
    if (!sc.onActivate) renderNote(sc);

    // Dönüş, üzerine gelindiğinde/odaklanıldığında durur: okurken sahnenin
    // altından kayması rahatsız ediciydi.
    // Dokunmatikte "üzerine gelme" diye bir şey yok: parmak inince
    // döndürmeyi hemen durduruyoruz, yoksa nişan alınan düğüm parmak
    // inerken altından kayıyor.
    el.addEventListener("pointerdown", function () { sc.hover = true; });
    el.addEventListener("pointerenter", function () { sc.hover = true; });
    el.addEventListener("pointerleave", function () { sc.hover = false; ensureLoop(); });
    el.addEventListener("focusin", function () { sc.hover = true; });
    el.addEventListener("focusout", function () { sc.hover = false; ensureLoop(); });

    // İki kullanım var: metin içindeki şemalarda tıklama düğümün notunu
    // açar; Füsûs açılışındaki fasıl sarmalında ise o fasla gider. İkincisi
    // için `onActivate` veriliyor ve o zaman not paneli hiç kullanılmıyor.
    function selectFrom(target) {
      var g = target.closest && target.closest(".helix-scene__node");
      if (!g) return;
      sc.focus = +g.dataset.i;
      draw(sc);
      if (sc.onActivate) sc.onActivate(sc.nodes[sc.focus], sc.focus);
      else renderNote(sc);
    }
    // Dönen bir sahnede tam olarak küçük bir dairenin üstüne basmak zor --
    // özellikle dokunmatikte. Bu yüzden seçim, basılan noktaya EN YAKIN
    // düğümü alıyor (cömert bir yarıçap içinde); böylece nişan biraz
    // kaysa da doğru düğüm açılıyor. Basar basmaz dönüş de duruyor.
    function nearest(e) {
      var r = sc.svg.getBoundingClientRect();
      if (!r.width || !r.height) return -1;
      var vb = sc.svg.viewBox.baseVal;
      var x = (e.clientX - r.left) / r.width * (vb.width || r.width);
      var y = (e.clientY - r.top) / r.height * (vb.height || r.height);
      var best = -1, bestD = Infinity;
      sc.nodes.forEach(function (_, i) {
        var p = projectT(sc, i);
        var d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (d < bestD) { bestD = d; best = i; }
      });
      // 34 birimlik hoşgörü: düğüm yarıçapının yaklaşık dört katı.
      return bestD <= 34 * 34 ? best : -1;
    }

    sc.svg.addEventListener("click", function (e) {
      // Önce doğrudan isabet (daire ya da ETİKET), sonra en yakın düğüm.
      // Sıra önemli: etiket kendi düğümünün merkezinden uzakta olabiliyor,
      // "en yakın"ı önce sorarsak yanlış düğümü açardık.
      var hit = e.target.closest && e.target.closest(".helix-scene__node");
      var i = hit ? +hit.dataset.i : nearest(e);
      if (i < 0) { selectFrom(e.target); return; }
      sc.focus = i;
      draw(sc);
      // Odağı seçilen düğüme taşı: tıklamayla başlayıp ok tuşlarıyla devam
      // etmek mümkün olsun. preventScroll, sayfanın zıplamasını engelliyor.
      try { sc.gs[i].g.focus({ preventScroll: true }); } catch (err) { /* eski tarayıcı */ }
      if (sc.onActivate) sc.onActivate(sc.nodes[i], i);
      else renderNote(sc);
    });
    sc.svg.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectFrom(e.target); return; }
      var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1
        : (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0);
      if (!d) return;
      e.preventDefault();
      sc.focus = (sc.focus + d + sc.nodes.length) % sc.nodes.length;
      draw(sc);
      if (!sc.onActivate) renderNote(sc);
      var g = sc.svg.querySelector('.helix-scene__node[data-i="' + sc.focus + '"]');
      if (g) g.focus();
    });

    // Görünmüyorken dönmesin (pil/işlemci); ayrıca genişlik değişince yeniden
    // yerleştir -- svg genişliği 0 iken kurulan sahne bozuk çıkıyordu.
    if (window.IntersectionObserver) {
      sc.io = new IntersectionObserver(function (entries) {
        sc.visible = entries.some(function (en) { return en.isIntersecting; });
        if (sc.visible) ensureLoop();
      }, { threshold: 0.05 });
      sc.io.observe(el);
    }
    if (window.ResizeObserver) {
      sc.ro = new ResizeObserver(function () { layout(sc); draw(sc); });
      sc.ro.observe(el);
    }

    scenes.push(sc);
    ensureLoop();

    return {
      setLang: function () {
        // Etiket metni yalnız değişince yazılıyor; dil değişiminde
        // önbelleği temizlemezsek eski dilde kalırdı.
        sc.gs.forEach(function (el) { el.__label = null; });
        draw(sc); if (!sc.onActivate) renderNote(sc);
      },
      relayout: function () { layout(sc); draw(sc); },
      destroy: function () {
        if (sc.io) sc.io.disconnect();
        if (sc.ro) sc.ro.disconnect();
        scenes = scenes.filter(function (x) { return x !== sc; });
        el.innerHTML = "";
      },
    };
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) ensureLoop();
  });

  window.DostHelix = { mount: mount };
})();
