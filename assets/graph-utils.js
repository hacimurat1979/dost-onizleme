window.DostGraphUtils = (function () {
  "use strict";

  // Every view's data-loading boilerplate was `fetch(url).then(r => r.json())`
  // with no check that the response actually succeeded -- a 404/500 (bad
  // deploy, renamed file) surfaced as an opaque "Unexpected token '<'"
  // JSON-parse error instead of a clear failure. One shared helper for all
  // ~24 call sites across the site's view modules.
  // ÖNBELLEK (2026-08-03, denetimde ölçüldü). Aynı JSON'u birden çok modül
  // istiyor ve her biri ayrı bir indirme başlatıyordu: ana sayfada
  // sirlar.json (345KB) İKİ kez, /sirlar/'da ÜÇ kez, /esma/'da esma.json
  // (415KB) iki kez iniyordu -- yani her sayfa yüklemesinde 350-760KB saf
  // israf. Tarayıcının HTTP önbelleği bunu kurtarmıyordu çünkü istekler
  // eşzamanlı başlıyor (biri bitmeden öteki çıkıyor).
  //
  // Söz (promise) düzeyinde önbellek: aynı URL için ikinci çağrı YENİ bir
  // istek açmıyor, ilkinin sözünü paylaşıyor. Hata durumunda kayıt
  // siliniyor ki geçici bir ağ hatası kalıcı bir başarısızlığa dönüşmesin.
  const jsonCache = new Map();
  function fetchJson(url) {
    if (jsonCache.has(url)) return jsonCache.get(url);
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`fetchJson: ${url} -> HTTP ${r.status}`);
      return r.json();
    }).catch((e) => { jsonCache.delete(url); throw e; });
    jsonCache.set(url, p);
    return p;
  }

  function getVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  // Bir görünümün requestAnimationFrame döngüsü, o görünüm ekranda DEĞİLKEN
  // (başka bir sekmeye/görünüme geçilmişken) çalışmaya devam etmemeli.
  // Hâller/Esmâ/Sorular'ın üçünde de döngü koşulu `!reduceMotion` idi -- yani
  // hareket kısıtlaması açık olmayan normal kullanıcıda HER ZAMAN doğru:
  // görünüm bir kez açıldıktan sonra, başka bölüme geçilse bile saniyede 60
  // kez tam render sürüyordu ve birkaç grafik gezildiğinde bunlar üst üste
  // binip bütün siteyi (metin kutularına yazmayı bile) yavaşlatıyordu.
  // 2026-07-25'te kullanıcının "sayfa yavaşladı, harfler geç çıkıyor"
  // bildirimiyle yakalandı.
  function isViewActive(wrapEl) {
    return !!wrapEl && !wrapEl.hidden && document.visibilityState !== "hidden";
  }

  // Sekme geri geldiğinde / görünüm yeniden açıldığında döngüyü uyandırmak
  // isteyen modüller buraya abone olur.
  const _wakeSubs = [];
  function onViewWake(fn) {
    _wakeSubs.push(fn);
    if (_wakeSubs.length === 1) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") _wakeSubs.forEach((f) => { try { f(); } catch (e) {} });
      });
    }
  }

  function moveTooltip(tooltip, wrapEl, event) {
    if (!tooltip || tooltip.hidden || !wrapEl) return;
    const rect = wrapEl.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    x = Math.max(60, Math.min(rect.width - 60, x));
    y = Math.max(50, y);
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
    // .node-hover-tip'in tabanı imlecin ~14px üstünde büyür (bkz. style.css
    // transform: translate(-50%, calc(-100% - 14px))) -- uzun bir alıntı
    // (örn. Sırlar'daki bir sır'ın tam metni) imleç ekranın üst kısmındayken
    // bu yükseklikle görünüm alanının üstüne taşabiliyordu. İçerik
    // yerleştirildikten sonra gerçek yüksekliği ölçüp üstten taşıyorsa
    // imlecin ALTINA doğru büyümeye çeviriyoruz.
    tooltip.classList.remove("node-hover-tip--flip");
    if (tooltip.getBoundingClientRect().top < 4) tooltip.classList.add("node-hover-tip--flip");
  }

  function hideTooltip(tooltip) {
    if (tooltip) tooltip.hidden = true;
  }

  // Derinliğe göre boyanan düğümler için paylaşılan mavi rampa (Ontoloji ve
  // Esmâ'da birebir aynı diziler olarak tekrarlanıyordu). Rampanın orta
  // noktası (LAYER_COLOR[4], LAYER_COLOR_DARK[2]) KASITLI olarak style.css'teki
  // --series-ibnarabi/--series-ibnarabi (dark) ile aynı hex değeri taşıyor --
  // biri değişirse diğeri de elle güncellenmeli (7 renklik bir gradyanı
  // CSS'ten canlı okumak, aktif temaya göre yanlış ucundan değer okuma riski
  // taşıdığı için burada tercih edilmedi).
  const LAYER_COLOR = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#2a78d6", "#1c5cab", "#0d366b"];
  const LAYER_COLOR_DARK = ["#184f95", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#86b6ef", "#cde2fb"];

  // Zât is the one node in both Ontoloji and Esmâ whose own "color" is
  // unknowable -- known only through its glow -- so its circle is left the
  // whitest tone possible rather than given a pole/layer color.
  const ZAT_FILL = "#ffffff";

  // Not: OS/tarayıcı tercihini değil, sitenin kendi karanlık-mod anahtarını
  // (document.body[data-theme]) esas alır -- kullanıcı sistem tercihinin
  // aksine bir tema seçtiğinde de doğru rampayı döndürsün diye.
  function isDark() {
    return document.body.getAttribute("data-theme") === "dark";
  }

  // Wires up every ".legend" panel's collapse/expand toggle on the page.
  // On short/touch viewports the panel starts collapsed by default, since a
  // fully-expanded legend can otherwise sit on top of the graph and hide
  // nodes behind it.
  function setupLegendToggles() {
    const collapseByDefault = window.matchMedia("(max-height: 700px)").matches
      || window.matchMedia("(pointer: coarse)").matches;
    document.querySelectorAll(".legend").forEach((legend) => {
      const toggle = legend.querySelector(".legend__toggle");
      if (!toggle) return;
      if (collapseByDefault) {
        legend.classList.add("legend--collapsed");
        toggle.setAttribute("aria-expanded", "false");
      }
      toggle.addEventListener("click", () => {
        const collapsed = legend.classList.toggle("legend--collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
      });
    });
  }

  // Shared D3 zoom setup (esma/hal/sorular/sirlar-graph/ontology all
  // repeated this identically, only scaleExtent differing). Ctrl/Cmd+wheel
  // or a two-finger touch to zoom -- plain wheel/scroll is left free for
  // the page itself to scroll. `extraFilter(event)`, if given, is ANDed
  // into the fallback case (ontology.js's force-layout needs this to keep
  // a node-drag click from also panning the whole canvas; the four
  // fixed-layout tree/radial views don't need it and pass nothing).
  function createZoomBehavior(svg, zoomLayer, scaleExtent, extraFilter) {
    const zoomBehavior = d3.zoom()
      .scaleExtent(scaleExtent)
      .filter((event) => {
        if (event.type === "wheel") return event.ctrlKey || event.metaKey;
        if (event.touches) return event.touches.length > 1;
        return extraFilter ? extraFilter(event) : true;
      })
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform));
    svg.call(zoomBehavior).on("dblclick.zoom", null);
    return zoomBehavior;
  }

  // Shared D3 force-simulation drag behavior (Ontoloji/Compare/Daphne-profil
  // all wired this up independently). `shouldSkip(d)`, if given, excludes
  // nodes (e.g. a fixed central hub) from being draggable.
  function createDragBehavior(sim, shouldSkip) {
    function dragstarted(event, d) {
      if (shouldSkip && shouldSkip(d)) return;
      if (!event.active) sim.alphaTarget(0.2).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d) {
      if (shouldSkip && shouldSkip(d)) return;
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event, d) {
      if (shouldSkip && shouldSkip(d)) return;
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
  }

  // #detail-panel/#detail-close aynı id'lerle her üç sayfada da yaşıyor
  // (index.html/ontology.js, compare.html/compare.js, daphne-profil.html/
  // daphne-profil.js) -- her görünümün kendi "hidden = false" satırını tek
  // tek yamamak yerine (14+ çağrı yeri), MutationObserver ile TEK bir yerden
  // odak yönetimi ekliyoruz: panel açılınca kapatma düğmesine odaklan,
  // panel kapanınca odağı paneli açan öğeye geri döndür.
  function setupDetailPanelFocus() {
    const panel = document.getElementById("detail-panel");
    if (!panel) return;
    let lastFocused = null;
    const observer = new MutationObserver(() => {
      if (panel.hidden) {
        if (lastFocused && document.contains(lastFocused) && typeof lastFocused.focus === "function") {
          lastFocused.focus();
        }
        lastFocused = null;
      } else {
        lastFocused = document.activeElement;
        const closeBtn = document.getElementById("detail-close");
        if (closeBtn) closeBtn.focus();
      }
    });
    observer.observe(panel, { attributes: true, attributeFilter: ["hidden"] });

    // Basit odak-tuzağı: panel açıkken Tab, arkadaki sayfaya kaçmasın.
    panel.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'))
        .filter((n) => !n.hidden && n.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  // -------------------------------------------------------------------------
  // Paylaşılan 2B↔3B eğim motoru (bkz. research/GRAFIK-FELSEFESI.md)
  //
  // Hâller, Menziller, Esmâ ve Ontoloji'de bu projeksiyon dört kez elle
  // yazılmıştı. Sırlar ve Sorular'a da gelince beşinci ve altıncı kopyayı
  // yazmak yerine motoru buraya taşıdık. Felsefe belgesindeki kural
  // ("yeni bir kütüphane ekleme, bu motoru kullan") aynen geçerli --
  // Three.js/WebGL YOK, elle yaw/pitch + perspektif bölme.
  //
  // Sözleşme: tilt=0'da project() gelen (x,y)'yi AYNEN geri verir; yani
  // 2B görünüm matematiksel olarak hiç bozulmaz. tilt=1'de düzlem yatar,
  // `vert` (katman yüksekliği) dikeyde görünür olur.
  function createTilt(opts) {
    const o = opts || {};
    const FOCAL = o.focal || 2400;
    const DUR = o.duration || 1050;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tilt = 0, target = 0, from = 0, animStart = 0;
    let yaw = 0, pitch = o.pitch == null ? 0.26 : o.pitch;
    let dragging = false;

    function set(t, instant) {
      from = tilt; target = t; animStart = performance.now();
      if (t < 0.5) yaw = 0;
      // Varsayılan olarak 3B açılan görünümlerde morfu izleyen olmuyor ama
      // açılıştaki öbür işlerle yarışıp takılmaya yol açıyor -- o yüzden
      // "instant" seçeneği var (bkz. hal/esma/menziller/ontoloji openIn3D).
      if (instant || reduce) { tilt = t; from = t; }
    }
    // Her karede çağrılır; eğim animasyonu ilerler, kendiliğinden dönüş
    // uygulanır. Sahne hâlâ hareketliyse true döner.
    function step(ts, dt, spinning) {
      let active = false;
      if (tilt !== target) {
        if (reduce) tilt = target;
        else {
          const p = Math.min(1, (ts - animStart) / DUR);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          tilt = from + (target - from) * e;
          if (p >= 1) tilt = target; else active = true;
        }
      }
      if (tilt > 0.5 && spinning !== false && !dragging && !reduce) {
        yaw += dt * (o.spinRate == null ? 0.00006 : o.spinRate);
        active = true;
      }
      return active;
    }
    // x,y: düz (2B) konum. vert: bu düğümün katman yüksekliği (0 = düzlem).
    function project(x, y, vert) {
      if (tilt < 0.001) return { x: x, y: y, depth: 1, z: 0 };
      const py = y * (1 - tilt) + (vert || 0) * tilt;
      const pz = y * tilt;
      const yy = yaw * tilt, pp = pitch * tilt;
      const cyw = Math.cos(yy), syw = Math.sin(yy);
      const x1 = x * cyw + pz * syw;
      const z1 = -x * syw + pz * cyw;
      const cpt = Math.cos(pp), spt = Math.sin(pp);
      const y2 = py * cpt - z1 * spt;
      const z2 = py * spt + z1 * cpt;
      const zc = Math.max(z2, -FOCAL * 0.85);
      const depth = FOCAL / (FOCAL + zc);
      return { x: x1 * depth, y: y2 * depth, depth: depth, z: z2 };
    }
    // 3B'de boş alanı sürükleyerek döndürme.
    function wireDrag(el, onChange, skipSel) {
      let lx = 0, ly = 0;
      el.addEventListener("pointerdown", (e) => {
        if (target < 0.5) return;
        if (skipSel && e.target.closest && e.target.closest(skipSel)) return;
        dragging = true; lx = e.clientX; ly = e.clientY;
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      });
      el.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        yaw += (e.clientX - lx) * 0.006;
        pitch = Math.max(0.02, Math.min(1.1, pitch + (e.clientY - ly) * 0.004));
        lx = e.clientX; ly = e.clientY;
        if (onChange) onChange();
      });
      const stop = (e) => {
        if (!dragging) return;
        dragging = false;
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      el.addEventListener("pointerup", stop);
      el.addEventListener("pointercancel", stop);
    }
    function wireToggle(btnId, onChange) {
      const btn = document.getElementById(btnId);
      if (!btn || btn.dataset.wiredTilt) return btn;
      btn.dataset.wiredTilt = "1";
      btn.setAttribute("aria-pressed", String(target > 0.5));
      btn.classList.toggle("is-on", target > 0.5);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const to = target > 0.5 ? 0 : 1;
        set(to);
        btn.classList.toggle("is-on", to > 0.5);
        btn.setAttribute("aria-pressed", to > 0.5 ? "true" : "false");
        if (onChange) onChange(to);
      });
      return btn;
    }
    function markOn(btnId) {
      const btn = document.getElementById(btnId);
      if (btn) { btn.classList.add("is-on"); btn.setAttribute("aria-pressed", "true"); }
    }
    return {
      set: set, step: step, project: project, wireDrag: wireDrag,
      wireToggle: wireToggle, markOn: markOn,
      get value() { return tilt; },
      get on() { return target > 0.5; },
      get dragging() { return dragging; },
    };
  }

  // --- Etiket çakışması ------------------------------------------------------
  // Önce sorular.js'te çözüldü, sonra buraya taşındı: 2026-07-31 taraması
  // /hal/ görünümünde aynı kusurun hiç düzeltilmemiş olduğunu ölçtü
  // (masaüstü 5, mobil 12 çakışma; /sorular/ ikisinde de 0).
  //
  // İKİ DENEME TUTMADI, tekrar denenmesin diye kayıtta:
  //   1. genişliği "karakter sayısı × punto × 0,52" ile tahmin etmek
  //      (masaüstü 2 / mobil 5 çakışma bıraktı),
  //   2. aynı tahmini zoom katsayısına bölmek (masaüstü 4 / mobil 1).
  // Tutan şey tahmin değil ÖLÇÜM: getBBox() metnin kendi yerel biriminde
  // döner, yani düğüm koordinatlarıyla aynı uzayda — zoom dönüşümü işin
  // içine girmiyor. Ölçüm pahalı olduğu için dize başına bir kez yapılır.
  //
  // Ayrıca ölçüldü: yalnız puntoyu büyütmek çözüm DEĞİL. /hal/'de 10,5px'ten
  // 12px'e çıkarmak mobil çakışmayı 12'den 14'e taşıdı. Yer açan şey kaydırma.
  function createLabelDeconflictor() {
    const box = new Map();            // metin -> {w,h}
    function measure(node, txt) {
      let m = box.get(txt);
      if (!m) {
        try { const b = node.getBBox(); m = { w: b.width, h: b.height }; }
        catch (e) { m = { w: txt.length * 5.6, h: 12 }; }
        if (m.w > 0) box.set(txt, m);
      }
      return m;
    }
    // items: {lbl (d3 seçimi), txt, x, y, baseY, priority?}
    // priority yüksek olan önce yerleşir (kategoriler, dönüm noktaları).
    return function deconflict(items) {
      if (!items.length) return;
      for (const it of items) {
        const m = measure(it.lbl.node(), it.txt);
        it.half = m.w / 2;
        it.h = m.h || 12;
      }
      items.sort((a, b) => ((b.priority || 0) - (a.priority || 0)) || (a.y - b.y));
      const placed = [];
      for (const it of items) {
        let y = it.y, guard = 0, clash = true;
        while (clash && guard++ < 24) {
          clash = false;
          for (const p of placed) {
            const dyGap = (it.h + p.h) / 2 + 2;
            if (Math.abs(y - p.y) < dyGap && Math.abs(it.x - p.x) < it.half + p.half + 5) {
              y = p.y + dyGap;        // aşağı doğru kaydır
              clash = true;
              break;
            }
          }
        }
        placed.push({ x: it.x, y, half: it.half, h: it.h });
        if (y !== it.y) it.lbl.attr("y", it.baseY + (y - it.y));
      }
    };
  }

  // KAPI — bkz. ETKILESIM_DILI.md: "geçiş dekor değil, dönüşümdür."
  //
  // İki bölüm arasındaki ilişki metafizik olarak "içinde" ise (Esmâ, Zât'ın
  // ilk belirişinin İÇİDİR), geçiş de "içine girme" gibi görünmeli — yan
  // yana iki sekme gibi değil. Bu yüzden kapıdan geçerken sahne kesilmiyor:
  // kapı olan düğüm BÜYÜYEREK gidilen haritanın merkezine oturuyor, yeni
  // sahne onun içinden açılıyor.
  //
  // Ucuz tutuldu (planın kendi ölçüsü: "tek canvas hissinin ~%80'i,
  // maliyetinin ~%20'siyle"): iki grafiği tek bir canvas'a taşımıyoruz;
  // yalnız kapı düğümünün ekrandaki dairesini alıp hedefin merkezine doğru
  // büyütüyoruz. Gerçek grafikler altında sessizce yer değiştiriyor.
  //
  // reduced-motion'da hiç çalışmaz — atlanır, taklit edilmez. Doğrudan bir
  // adrese gelindiğinde de çağrılmaz (çağıran taraf karar verir):
  // gelinmemiş bir yerden çıkış animasyonu yalan olurdu.
  function gateTransition(opts, onSwitch) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kaynak = opts.fromRect;
    if (reduce || !kaynak || !kaynak.width) { onSwitch(); return; }

    // Hedef merkez, GÖRÜNÜR olan sahne alanından ölçülür. Gidilecek görünümün
    // sarmalayıcısı o an `hidden` olduğu için ölçüsü 0x0'dır -- ilk yazımda
    // hedef olarak o alınmıştı ve daire ekranın sol üst köşesine (0,0) doğru
    // açılıyordu. İki graf görünümü aynı alanı paylaştığı için görünür olanı
    // ölçmek hem doğru hem sağlam.
    let hedefEl = document.querySelector(".graph-wrap:not([hidden])");
    if (opts.targetEl && opts.targetEl.getBoundingClientRect().width > 0) hedefEl = opts.targetEl;
    const hedef = hedefEl && hedefEl.getBoundingClientRect().width > 0
      ? hedefEl.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const hx = hedef.left + hedef.width / 2;
    const hy = hedef.top + hedef.height / 2;

    const daire = document.createElement("div");
    daire.className = "gate-orb";
    daire.setAttribute("aria-hidden", "true");
    const r0 = Math.max(6, Math.min(kaynak.width, kaynak.height) / 2);
    daire.style.left = (kaynak.left + kaynak.width / 2) + "px";
    daire.style.top = (kaynak.top + kaynak.height / 2) + "px";
    daire.style.width = daire.style.height = (r0 * 2) + "px";
    // Yalnız DÜZ bir renk kabul ediliyor. SVG'de bir düğümün `fill`i
    // gradyan olabiliyor (`url(#...)`) ve bu CSS'te geçerli bir
    // background-image olarak ayrıştığı için sınıfın rengini eziyor,
    // daire de görünmez kalıyordu (ilk yazımda öyle oldu, ölçülüp
    // düzeltildi: computed background "rgba(0,0,0,0) none" çıkıyordu).
    if (opts.color && /^(rgb|#|hsl)/i.test(opts.color.trim())) {
      daire.style.background = `radial-gradient(circle at 50% 50%, ${opts.color} 0%, ${opts.color} 45%, transparent 72%)`;
    }
    document.body.appendChild(daire);

    // İki hareket, tek devir: önce kapı merkeze doğru büyür (sahne onun
    // içine çekilir), sonra yeni sahne onun içinden açılırken daire söner.
    const buyume = daire.animate(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: 0.85 },
        { transform: `translate(-50%, -50%) translate(${hx - (kaynak.left + kaynak.width / 2)}px, ${hy - (kaynak.top + kaynak.height / 2)}px) scale(${Math.max(6, hedef.height / (r0 * 2))})`, opacity: 0.5 },
      ],
      { duration: 620, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" }
    );

    buyume.onfinish = () => {
      onSwitch();
      const sonme = daire.animate([{ opacity: 0.5 }, { opacity: 0 }],
        { duration: 420, easing: "ease-out", fill: "forwards" });
      sonme.onfinish = () => daire.remove();
      // Animasyon API'si bir sebeple sessiz kalırsa daire ekranda asılı
      // kalmasın: her hâlükârda temizleyen bir emniyet.
      setTimeout(() => daire.remove(), 900);
    };
    setTimeout(() => { if (daire.isConnected && buyume.playState !== "finished") { buyume.cancel(); onSwitch(); daire.remove(); } }, 1600);
  }

  // "Değinmek" — bkz. ETKILESIM_DILI.md'nin dördüncü fiili: hover'ın
  // gösterdiği şey, tıklamanın göstereceğinin KÜÇÜLTÜLMÜŞ hâli olmalı.
  //
  // Kenarlarda bu tutmuyordu: Ontoloji'de bir çizgiye değinmek yalnız onu
  // vurguluyordu (hiç metin yok), Hâller'de ise ilişkinin TÜRÜNÜ yazıyordu
  // ("yankı") ama GEREKÇESİNİ değil. Yani "bu ikisi neden bağlı" sorusunun
  // cevabı ancak tıklayınca görünüyordu. Bir çizgi çizip gerekçesini
  // saklamak, sitenin "biz bunu böyle okuyoruz" duruşunun tersidir.
  //
  // İlk cümle(ler)i alır: kısa bir gerekçe tek cümlede biterse ikinciyi de
  // ekler. Cümle sınırı ancak noktalamadan SONRA büyük harf geliyorsa
  // kabul ediliyor -- "s.58", "bkz.", "c.14", "vb." gibi kısaltmalar
  // yüzünden cümle ortasından kesilmesin diye.
  const CUMLE_SINIRI = /(?<=[.!?…])\s+(?=[A-ZÂÎÛÖÜÇĞİŞ"'«])/;
  function ilkCumleler(metin, hedef) {
    if (!metin) return "";
    const parcalar = String(metin).split(CUMLE_SINIRI);
    let out = parcalar[0] || "";
    for (let i = 1; i < parcalar.length && out.length < (hedef || 110); i++) out += " " + parcalar[i];
    if (out.length > 260) out = out.slice(0, 257).replace(/\s+\S*$/, "") + "…";
    return out;
  }

  // Kenar önizlemesi: başlık (iki uç ya da ilişkinin adı), varsa tür etiketi,
  // ve gerekçenin ilk cümlesi. `guven` verilirse bizim okuma güvenimizi de
  // yazar -- sitede zaten panelde gösterilen etiketin aynısı.
  function edgeReasonHtml(opts) {
    const parts = ['<div class="node-hover-tip__title">' + opts.title + "</div>"];
    if (opts.kindLabel) parts.push('<div class="node-hover-tip__eyebrow">' + opts.kindLabel + "</div>");
    const gerekce = ilkCumleler(opts.reason);
    if (gerekce) parts.push('<div class="node-hover-tip__short">' + gerekce + "</div>");
    if (opts.confidence) parts.push('<div class="node-hover-tip__conf">' + opts.confidence + "</div>");
    return parts.join("");
  }

  // "Bir adım geri" (Esc) — bkz. ETKILESIM_DILI.md'nin üçüncü fiili.
  //
  // 2026-08-03'e kadar ESC beş dosyada beş ayrı `keydown` dinleyicisiyle
  // yazılmıştı; daha kötüsü, SIRLAR'ın geri davranışı kendi dosyasında
  // değil ontology.js'in içinde özel bir dal olarak yaşıyordu
  // (`window.__sirlarGraphApp.isFocused() -> unfocusTheme()`). Bir
  // görünümün davranışının başka bir dosyada durması, sözleşmenin
  // olmadığının en açık işaretiydi.
  //
  // Sözleşme: ortak katman NE ZAMAN sorusunu bilir (hangi görünüm açık,
  // sıra kimde), görünüm NE YAPILACAĞINI bilir. Görünümün geri-adım
  // fonksiyonu bir adım aldıysa `true` döner ve zincir orada durur;
  // `false` dönerse genel geri adım (açık paneli kapat) devreye girer.
  const stepBacks = [];
  function registerStepBack(wrapId, fn) {
    stepBacks.push({ wrapId: wrapId, fn: fn });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (let i = 0; i < stepBacks.length; i++) {
      const wrap = document.getElementById(stepBacks[i].wrapId);
      if (!wrap || wrap.hidden) continue;
      if (stepBacks[i].fn() === true) return;
    }
    const panel = document.getElementById("detail-panel");
    if (panel && !panel.hidden) panel.hidden = true;
  });

  // Recenter ("geri çekilmek") — bkz. ETKILESIM_DILI.md'nin ikinci fiili.
  // Altı graf görünümünün altısında da bir `.graph-recenter` düğmesi var ve
  // her biri kendi bağlama satırını, kendi tekrar-bağlama koruyucusunu
  // (dataset.wiredHal / dataset.wiredSir / hiç) ayrı yazmıştı -- Esmâ'nınki
  // ise HİÇ yazılmamıştı: düğme duruyor, hiçbir dinleyicisi yok, tıklayınca
  // sahne başlangıca dönmüyordu (2026-08-03'te ölçülüp Playwright ile
  // doğrulandı). "Bağlanmamış düğme" o yüzden bu tur yasak oldu ve bağlama
  // işi tek bir yere alındı: bir görünüm reset'in NE OLDUĞUNU bilir, bağlama
  // disiplinini burası bilir.
  function wireRecenter(buttonId, reset) {
    const btn = document.getElementById(buttonId);
    if (!btn || btn.dataset.wiredRecenter) return null;
    btn.dataset.wiredRecenter = "1";
    btn.addEventListener("click", () => reset());
    return btn;
  }

  // AKRABA SEKMELER — ETKILESIM_DILI.md'nin kapı kuralının tam tersi
  // durumu için: "yan yana iki sekme gibi değil" cümlesi yalnız metafizik
  // olarak İÇİNDE olan ilişkiler içindi (Esmâ, Zât'ın içi). Fütûhât'ın
  // kendi okuması ile Kur'ân Dokusu / Fütûhât'ın Mimarisi arasında öyle
  // bir ilişki yok -- üçü de aynı külliyatın kardeş kesitleri, hiçbiri
  // ötekinin içi değil. Bu yüzden burada düz bir sekme geçişi doğru olan
  // (Hakkında'nın alt-sekmeleriyle aynı görsel dil).
  //
  // Sekmeler YENİ bir görünüm/route İCAT ETMİYOR: her biri var olan bir
  // üst-menü düğmesini (data-goto-btn) tıklıyor, o düğmenin kendi
  // setMainView/updateHash/meta zincirini olduğu gibi çalıştırıyor. Bunun
  // nedeni, bu üç sayfanın da .pa11yci.json'un kendi erişilebilirlik CI
  // listesinde ayrı ayrı denetlenen, kendi URL'i olan gerçek rotalar
  // olması -- bir sekme sistemi onları BİRLEŞTİRSEYDİ o rotalar kırılır,
  // yer imleri ve dışarıdan gelen bağlantılar 404 olurdu.
  function wireRelatedTabs() {
    const barlar = document.querySelectorAll(".related-tabs");
    if (!barlar.length) return;
    const hedefIdler = new Set();
    barlar.forEach((bar) => {
      bar.querySelectorAll("[data-goto-btn]").forEach((pill) => {
        if (pill.dataset.wiredRelatedTab) return;
        pill.dataset.wiredRelatedTab = "1";
        const hedefId = pill.dataset.gotoBtn;
        hedefIdler.add(hedefId);
        pill.addEventListener("click", () => {
          const hedef = document.getElementById(hedefId);
          if (hedef) hedef.click();
        });
      });
    });
    // Aktiflik: hangi pill'in "buradasın" göstereceği, gerçek nav
    // düğmesindeki .btn-ghost--active sınıfından okunuyor -- setMainView'a
    // dokunmadan, bir MutationObserver ile. Böylece geri/ileri tuşu,
    // doğrudan bağlantıyla gelme, ya da drawer'dan tıklama -- hepsi aynı
    // yoldan senkronlanıyor.
    //
    // Bar `<main>`'in İÇİNDE ama HERHANGİ bir `.graph-wrap`'ın dışında
    // duruyor (üç sekilebilir görünümün hiçbirinin sabit-yükseklik/
    // overflow:hidden SVG kutusuna normal-akış içerik eklemek, o
    // görünümlerin kendi getBoundingClientRect() ölçümlerini bozardı).
    // Bu yüzden görünürlüğü kendi kendine karar veriyor: kendi pill'lerinden
    // BİRİ bile aktif değilse (kullanıcı ailenin dışına çıktıysa) bar
    // tamamen gizleniyor.
    function sync() {
      barlar.forEach((bar) => {
        let birAktif = false;
        bar.querySelectorAll("[data-goto-btn]").forEach((pill) => {
          const hedef = document.getElementById(pill.dataset.gotoBtn);
          const aktif = !!(hedef && hedef.classList.contains("btn-ghost--active"));
          pill.classList.toggle("related-tab--active", aktif);
          pill.setAttribute("aria-selected", String(aktif));
          if (aktif) birAktif = true;
        });
        bar.hidden = !birAktif;
      });
    }
    hedefIdler.forEach((id) => {
      const hedef = document.getElementById(id);
      if (hedef) new MutationObserver(sync).observe(hedef, { attributes: true, attributeFilter: ["class"] });
    });
    sync();
  }

  // "Bir benzetmeyle" bloğu. Dört görünümde (esma/hal/ontology/sorular)
  // gövdesiyle birlikte kopyalanmıştı; 2026-07-31 taraması yakaladı.
  // Benzetmeler şu an görünen yüzden kaldırıldı ve gizli düzenleme kipiyle
  // geri açılıyor (bkz. assets/edit-mode.js) — görünürlük koşulu tek yerde
  // dursun ki kip değişirse dört dosyayı ayrı ayrı düzeltmek gerekmesin.
  function analogyHtml(analogy) {
    if (!analogy || !(window.DostAnalogy && window.DostAnalogy.visible())) return "";
    const I18n = window.DostI18n;
    const etiket = I18n.pick3({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" });
    return `<div class="detail-analogy"><p class="detail-analogy__label">${etiket}</p>`
         + `<p>${I18n.pick3(analogy)}</p></div>`;
  }

  return { getVar, analogyHtml, moveTooltip, hideTooltip, LAYER_COLOR, LAYER_COLOR_DARK, ZAT_FILL, isDark, setupLegendToggles, createDragBehavior, setupDetailPanelFocus, createZoomBehavior, wireRecenter, wireRelatedTabs, registerStepBack, edgeReasonHtml, gateTransition, fetchJson, isViewActive, onViewWake, createTilt, createLabelDeconflictor };
})();
