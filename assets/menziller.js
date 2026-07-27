(function () {
  "use strict";

  // ============================================================================
  // Menziller — 28 ay menzilinin halkası
  //
  // Fütûhât'ın 198. Bölümü, yirmi sekiz fasıl boyunca aynı dörtlüyü tekrarlar:
  // bir ilahi isim, o isimden zuhur eden şey, bir harf, bir ay menzili. Bu
  // görünüm o yirmi sekiz faslı tek bir halkaya topluyor.
  //
  // Halkanın MERKEZİNDE Nefes-i Rahmânî var, çünkü sıra keyfi değil: harfler
  // nefesin boğazdan dudağa uzanan yolunda ayrışıyor ve Dost'a göre varlık
  // mertebeleri de aynı güzergâhı izliyor ("Hebâ dördüncü mertebededir;
  // nitekim Ha harfi de nefeste dördüncü mahreçtedir"). İlk menzilden İlk
  // Akıl, sonuncudan insan ve mertebelerin tayini çıkıyor; çember başına
  // kapanıyor (bkz. "daire ve merkez" ilkesi).
  //
  // Salt vanilla D3 + SVG; yeni bağımlılık yok.
  // ============================================================================

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = d3.select("#menziller-graph");
  const svgNode = svg.node();
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const tooltip = document.getElementById("menziller-tooltip");
  const wrapEl = document.getElementById("menziller-wrap");

  function tt(dict) { return I18n.pick3(dict || {}); }
  function getVar(n) { return GU.getVar(n); }
  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

  let data = null, dataPromise = null;
  let nodes = [];
  let zoomLayer, ringLayer, nodeLayer, centerLayer, defs;
  let zoomBehavior = null;
  let width = 900, height = 640, cx = 450, cy = 320, ringR = 240, dropH = 420;
  let rafId = null, lastTs = 0, spin = 0, hoveredId = null, activeId = null;

  // Sakin, huzurlu dönüş -- öteki graflarla aynı hız ailesinden (~140 sn/tur).
  const SPIN_RATE = 0.000045;

  // --- 3B durumu (hal.js'teki sarmal motorunun aynısı; referansımız o) ---
  // Fark şu: Hâller'de yol YÜKSELİYOR (nefsten hayrete), burada İNİYOR --
  // çünkü verimizin sırası bir iniş: İlk Akıl'dan toprağa, oradan madene,
  // bitkiye, hayvana, insana. Sonuncusu (Reşâ) hiçbir şey var etmiyor,
  // mertebeleri tayin ediyor; bu yüzden sarmalın dibinden tepeye bir kapanış
  // kirişi çiziyoruz -- çember kendi kendine kapanıyor.
  // FOCAL, Hâller'inkinden (1900) uzun: 28 düğüm tek bir tura yayıldığı için
  // güçlü perspektif, sarmalın UZAK yarısını ezip etiketleri üst üste
  // bindiriyordu. Uzun odak = daha az bükülme, okunur etiketler.
  const FOCAL = 3200;
  const TILT_DUR = 1050;
  let tilt = 0, tiltTarget = 0, tiltAnimStart = 0, tiltFrom = 0;
  let yaw = 0, pitch = 0.18, dragging = false;

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("menziller-wrap");
    dataPromise = GU.fetchJson("data/ibn-arabi/menziller.json")
      .then((d) => {
        data = d;
        if (window.DostViewStatus) window.DostViewStatus.hide("menziller-wrap");
        return d;
      })
      .catch((err) => {
        console.error("Menziller verisi yüklenemedi / Failed to load mansions data", err);
        dataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("menziller-wrap", () => window.__menzillerApp.activate());
      });
    return dataPromise;
  }

  // Harfin nefesteki sırası (boğazdan dudağa) rengi belirliyor: içerideki
  // mahreçler koyu, dudağa yaklaştıkça açılıyor. Renk bir süs değil, metnin
  // kendi iddiasının görünür hâli.
  function hueFor(i) {
    const t = i / 27;
    const h = 210 - 175 * t;             // derin mavi -> sıcak amber
    const sat = 52;
    const l = GU.isDark() ? 56 + 6 * t : 42 + 6 * t;
    return `hsl(${h.toFixed(0)}, ${sat}%, ${l.toFixed(0)}%)`;
  }

  function layout() {
    width = svgNode.clientWidth || 900;
    height = svgNode.clientHeight || 640;
    cx = width / 2; cy = height / 2;
    ringR = Math.max(120, Math.min(width, height) / 2 - (Math.min(width, height) < 620 ? 74 : 96));
    // İniş yüksekliği kritik: yalnız TOPLAM iniş elipsin salınımını aşsın
    // yetmiyor -- ADIM BAŞINA iniş de, elipsin o adımdaki dikey salınımını
    // aşmalı. Aşmazsa sarmalın ilk yarısı yükselerek geri dönüyor ve mertebe
    // farkı okunmaz oluyor (Hâller'de 18 düğümle fark edilmemişti; 28 düğümde
    // görünür hâle geldi). Adım salınımı ≈ r·(2π/n)·sin(pitch), adım inişi
    // ≈ dropH·cos(pitch)/(n-1). Oranı sadeleştirince kaldıracın EĞİM olduğu
    // çıkıyor: salınım/iniş = 2π·tan(pitch)·r/dropH. Hâller'in eğimiyle (0.62)
    // monotonluk için dropH > 4.5·r gerekiyordu ve sarmal ince uzun bir şeride
    // dönüyordu. Eğimi düzleştirince eşik düşüyor.
    //
    // 2026-07-27 (kullanıcı notu: "düğümler bu halleriyle anlaşılmıyorlar").
    // Ölçtük: düğüm çapı ekranda ~25px, ve en yakın iki düğüm merkezi arası
    // yalnız 3.7px. Yani asıl sorun boyut kadar ÇAKIŞMAYDI. Nedenini
    // aradık ve şu çıktı: 28 düğüm TEK bir tura yayıldığı için, halkanın
    // gözden UZAK yayında ardışık 4-6 düğüm hep bir küme yapıyor. Bunun
    // bir yerleşim hatası değil, bu geometrinin kendi sonucu olduğunu
    // dönüşün farklı anlarında ölçerek doğruladık: çakışan çiftler sabit
    // değil, dönüşle birlikte GEZİYOR (9-13 -> 11-14 -> 13-16 -> 14-19).
    //
    // Denenip işe yaramayanlar (hepsi ölçüldü): eğimi açmak (0.34/0.42 ->
    // çakışma aynı, en yakın mesafe daha da kötü), sarmalın yarıçap
    // büyümesini artırmak (0.55/0.75 -> düğümler küçüldü, çakışma aynı).
    // Turu ikiye çıkarmak kümeyi gerçekten yarıya indirirdi ama 28 menzil
    // BİR ay döngüsü demek; iki tur veriyi yanlış anlatırdı, o yüzden
    // yapmadık.
    //
    // Kalan gerçek kaldıraç eğim+iniş ikilisi. fitView yüksekliğe göre
    // sığdırdığı için iniş arttıkça ölçek düşüyor, yani düğümler yine
    // küçülüyor -- ikisi birbiriyle yarışıyor. Ölçülen denge:
    //   eğim 0.18 + iniş 2.2·r -> yarıçap 16.3, çakışan çift 7
    //   eğim 0.18 + iniş 2.4·r -> yarıçap 15.2, çakışan çift 5-11 (seçilen)
    //   eğim 0.18 + iniş 2.6·r -> yarıçap 14.3, çakışan çift 5
    // 2.4'te düğüm çapı 25.4px'ten 30.4px'e çıkıyor ve çakışma eski
    // seviyesinde kalıyor; yani boyut kazanılırken kalabalık artmıyor.
    dropH = ringR * 2.4;
    positionNodes();
  }

  // --- Sarmalın sürekli parametrik tanımı (hal.js ile aynı model) ---
  // tilt=0: düz halka (z yok, yükseklik yok) -- eski görünümün birebir aynısı.
  // tilt=1: halka yatay düzleme yatar, mertebe farkı Y ekseninde birikir.
  // Sakin dönüş 2B'de halkayı kendi düzleminde döndürür (açıya eklenir),
  // 3B'de ise sahneyi dikey eksen etrafında çevirir (yaw'a eklenir).
  function helixPoint(t) {
    const n = nodes.length;
    const a = -Math.PI / 2 + (t / n) * Math.PI * 2 + spin * (1 - tilt);
    // 3B'de halkayı genişletiyoruz: eğilince elips dikeyde zaten eziliyor,
    // yarıçapı büyütmezsek sarmal ince uzun bir şerit gibi görünüyor.
    const r = ringR * (0.86 + 0.18 * (t / Math.max(1, n - 1)) + 0.34 * (t / Math.max(1, n - 1)) * tilt) * (1 + 0.14 * tilt);
    const flatY = r * Math.sin(a);
    const hStep = dropH / Math.max(1, n - 1);
    const dropY = -dropH / 2 + hStep * t;   // ilk menzil en üstte, son menzil en altta
    return { x: r * Math.cos(a), y: flatY * (1 - tilt) + dropY * tilt, z: flatY * tilt };
  }

  function project(p) {
    const yy = (yaw + spin) * tilt, pp = pitch * tilt;
    const cyw = Math.cos(yy), syw = Math.sin(yy);
    const x1 = p.x * cyw + p.z * syw;
    const z1 = -p.x * syw + p.z * cyw;
    const cpt = Math.cos(pp), spt = Math.sin(pp);
    const y2 = p.y * cpt - z1 * spt;
    const z2 = p.y * spt + z1 * cpt;
    const zc = Math.max(z2, -FOCAL * 0.85);
    const depth = FOCAL / (FOCAL + zc);
    return { x: cx + x1 * depth, y: cy + y2 * depth, depth: depth, z: z2 };
  }
  function projectT(t) { return project(helixPoint(t)); }

  function positionNodes() {
    nodes.forEach((n, i) => {
      const p = projectT(i);
      n.x = p.x; n.y = p.y; n.__depth = p.depth; n.__z = p.z;
    });
  }

  // Sürekli sarmal üzerinde t0..t1 arasını örnekleyip ekran yolu üretir.
  function samplePath(t0, t1, steps) {
    let d = "";
    for (let s = 0; s <= steps; s++) {
      const p = projectT(t0 + (t1 - t0) * (s / steps));
      d += (s ? " L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1);
    }
    return d;
  }

  function buildDom() {
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");
    defs = svg.append("defs");
    nodes.forEach((n, i) => {
      const c = d3.color(hueFor(i)) || d3.color("#888");
      const rg = defs.append("radialGradient").attr("id", "menzil-sphere-" + n.sira)
        .attr("cx", "38%").attr("cy", "32%").attr("r", "72%");
      rg.append("stop").attr("offset", "0%").attr("stop-color", c.brighter(0.55).formatHex());
      rg.append("stop").attr("offset", "52%").attr("stop-color", c.formatHex());
      rg.append("stop").attr("offset", "100%").attr("stop-color", c.darker(0.85).formatHex());
    });

    zoomLayer = svg.append("g").attr("class", "menziller-canvas");
    ringLayer = zoomLayer.append("g").attr("class", "menziller-ringlayer");
    nodeLayer = zoomLayer.append("g").attr("class", "menziller-nodes");
    centerLayer = zoomLayer.append("g").attr("class", "menziller-center");

    // 2B'de düz halka, 3B'de sarmalın kendisi: tek bir path ikisini de çiziyor.
    ringLayer.append("path").attr("class", "menziller-ring-path").attr("fill", "none");
    // Sonu başa bağlayan kapanış kirişi (yalnız 3B'de görünür).
    ringLayer.append("path").attr("class", "menziller-close-chord").attr("fill", "none");
    centerLayer.append("circle").attr("class", "node-halo").attr("r", 46);
    centerLayer.append("text").attr("class", "menziller-center__label").attr("text-anchor", "middle").attr("y", -4);
    centerLayer.append("text").attr("class", "menziller-center__sub").attr("text-anchor", "middle").attr("y", 15);

    zoomBehavior = GU.createZoomBehavior(svg, zoomLayer, [0.5, 3], (event) => !event.target.closest(".node") && tiltTarget < 0.5);

    const rc = document.getElementById("menziller-recenter");
    if (rc && !rc.dataset.wiredMenziller) {
      rc.dataset.wiredMenziller = "1";
      rc.addEventListener("click", () => { activeId = null; showIntro(); fitView(true); });
    }
    svg.on("click", () => { if (activeId) { activeId = null; showIntro(); ensureFrame(); } });
  }

  function render(ts) {
    if (!nodeLayer) return;
    positionNodes();

    // Yol: 2B'de kapalı halka, 3B'de inen sarmal -- aynı parametrik eğri.
    ringLayer.select("path.menziller-ring-path")
      .attr("d", samplePath(0, nodes.length - 1 + (tilt < 0.5 ? 1 : 0), 240));

    // Kapanış kirişi: son menzil (mertebeleri tayin eden) ilk menzile (İlk
    // Akıl) geri bağlanıyor. 2B'de halka zaten kapalı olduğu için gizli.
    const a = projectT(nodes.length - 1), b = projectT(0);
    ringLayer.select("path.menziller-close-chord")
      .attr("d", `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}`)
      .style("opacity", tilt * 0.5);

    // Merkezdeki nefes işareti yalnız 2B'de anlamlı: 3B'de halka yatınca
    // merkez sarmalın ortasına düşüyor ve düğümlerin arkasında kalıyor.
    centerLayer.attr("transform", `translate(${cx},${cy})`).style("opacity", 1 - tilt);
    centerLayer.select(".menziller-center__label").text(tt(data.center.baslik));
    centerLayer.select(".menziller-center__sub").text("28");

    const gsel = nodeLayer.selectAll("g.menzil-node").data(nodes, (n) => n.sira);
    const enter = gsel.enter().append("g")
      .attr("class", "node menzil-node")
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (n) => `${n.sira}. ${n.menzil}`)
      .attr("data-sira", (n) => n.sira)
      .on("click", (e, n) => { e.stopPropagation(); openMenzil(n); })
      .on("keydown", (e, n) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openMenzil(n); } })
      .on("pointerenter", (e, n) => { hoveredId = n.sira; showTooltip(n, e); ensureFrame(); })
      .on("pointermove", (e) => moveTooltip(e))
      .on("pointerleave", () => { hoveredId = null; hideTooltip(); ensureFrame(); })
      .on("focus", (e, n) => { hoveredId = n.sira; showTooltip(n, e); })
      .on("blur", () => { hoveredId = null; hideTooltip(); });
    enter.append("circle").attr("class", "menzil-node__glow");
    enter.append("circle").attr("class", "menzil-node__sphere").attr("fill", (n) => `url(#menzil-sphere-${n.sira})`);
    enter.append("text").attr("class", "menzil-node__harf").attr("text-anchor", "middle");
    enter.append("text").attr("class", "menzil-node__label").attr("text-anchor", "middle");
    const merged = enter.merge(gsel);
    gsel.exit().remove();

    merged.each(function (n) {
      const g = d3.select(this);
      const isActive = activeId === n.sira;
      const isHover = hoveredId === n.sira;
      const breath = reduceMotion ? 1 : 1 + 0.02 * Math.sin(ts / 3000 + n.sira);
      // 3B'de uzaktaki düğümler küçülüp soluyor (perspektif derinliği).
      const dep = 1 + (n.__depth - 1) * tilt;
      const r = (isActive ? 24 : 18) * breath * (isHover ? 1.08 : 1) * dep;
      const fade = tilt > 0 ? Math.max(0.35, Math.min(1, 0.35 + 0.9 * (dep - 0.55))) : 1;
      g.attr("transform", `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`)
        .style("opacity", (activeId && !isActive ? 0.42 : 1) * fade);
      g.select(".menzil-node__glow").attr("r", r * 1.9)
        .style("fill", hueFor(n.sira - 1))
        .style("opacity", (isActive ? 0.42 : 0.15) * (isHover ? 1.6 : 1));
      g.select(".menzil-node__sphere").attr("r", r);
      // Halka döndüğü için harf ve etiketi kendi noktaları etrafında ters
      // çevirip dik tutuyoruz.
      // Etiketler artık grup döndürmesiyle değil, düğümün kendi ekran
      // konumuyla yerleşiyor; hem 2B'de hem 3B'de kendiliğinden dik duruyorlar.
      g.select(".menzil-node__harf").attr("y", 4 * dep)
        .style("font-size", (0.72 * dep).toFixed(2) + "rem")
        .text(n.harfArapca);
      g.select(".menzil-node__label").attr("y", r + 14)
        .classed("menzil-node__label--active", isActive)
        .text(n.menzil);
    });

    // Yakındaki düğümler uzaktakilerin üstünde çizilsin (3B derinlik sırası).
    if (tilt > 0.05) {
      nodeLayer.selectAll("g.menzil-node").sort((p, q) => (p.__z || 0) - (q.__z || 0));
    }
  }

  // ---- 2B ↔ 3B sinematik geçiş (hal.js ile aynı) ----
  function setTilt(target) {
    tiltFrom = tilt; tiltTarget = target; tiltAnimStart = performance.now();
    if (target < 0.5) { yaw = 0; pitch = 0.18; }
    ensureFrame();
    setTimeout(() => { if (!wrapEl.hidden) fitView(true); }, reduceMotion ? 30 : TILT_DUR + 60);
  }

  // Açılışta doğrudan sarmala eğ (kullanıcı kararı, 2026-07-26): bu haritanın
  // asıl söylediği şey mertebelerin İNİŞİ; düz halka onu göstermiyor.
  // Animasyonsuz (bkz. hal.js/esma.js'teki aynı not): 3B varsayılan olduğu
  // için eğim morfu açılıştaki diğer işlerle yarışıp takılmaya yol açıyordu.
  function openIn3D() {
    tilt = 1; tiltFrom = 1; tiltTarget = 1;
    ensureFrame();
    setTimeout(() => { if (!wrapEl.hidden) fitView(false); }, 60);
    const btn = document.getElementById("menziller-3d-toggle");
    if (btn) { btn.classList.add("is-on"); btn.setAttribute("aria-pressed", "true"); }
  }

  function wireTiltToggle() {
    const btn = document.getElementById("menziller-3d-toggle");
    if (!btn || btn.dataset.wiredMenziller3d) return;
    btn.dataset.wiredMenziller3d = "1";
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const to = tiltTarget > 0.5 ? 0 : 1;
      setTilt(to);
      btn.classList.toggle("is-on", to > 0.5);
      btn.setAttribute("aria-pressed", to > 0.5 ? "true" : "false");
    });
  }

  // 3B'de sürükleyerek döndürme.
  function wireRotateDrag() {
    let lastX = 0, lastY = 0;
    svgNode.addEventListener("pointerdown", (e) => {
      if (tiltTarget < 0.5) return;
      if (e.target.closest(".menzil-node")) return;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      svgNode.setPointerCapture(e.pointerId);
    });
    svgNode.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.006;
      pitch = Math.max(-0.2, Math.min(1.25, pitch + (e.clientY - lastY) * 0.004));
      lastX = e.clientX; lastY = e.clientY;
      ensureFrame();
    });
    const stop = (e) => {
      if (!dragging) return;
      dragging = false;
      try { svgNode.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    svgNode.addEventListener("pointerup", stop);
    svgNode.addEventListener("pointercancel", stop);
  }

  // Not: lastTs BURADA sıfırlanmıyor -- ensureFrame her karenin sonunda
  // çağrıldığı için burada sıfırlamak dt'yi kalıcı 0 yapar ve dönüşü dondurur
  // (hal.js'te bir kez bu hataya düşmüştük).
  function ensureFrame() { if (rafId == null) rafId = requestAnimationFrame(frame); }
  function frame(ts) {
    rafId = null;
    if (!GU.isViewActive(wrapEl)) { lastTs = 0; return; }
    const dt = lastTs ? Math.min(64, ts - lastTs) : 16; lastTs = ts;
    if (tilt !== tiltTarget) {
      if (reduceMotion) tilt = tiltTarget;
      else {
        const pr = Math.min(1, (ts - tiltAnimStart) / TILT_DUR);
        const e = pr < 0.5 ? 2 * pr * pr : 1 - Math.pow(-2 * pr + 2, 2) / 2;
        tilt = tiltFrom + (tiltTarget - tiltFrom) * e;
        if (pr >= 1) tilt = tiltTarget;
      }
    }
    // Bir menzil açıkken ve sürüklerken durur: okurken sahne kıpırdamasın.
    if (!reduceMotion && !activeId && !dragging) spin += dt * SPIN_RATE;
    render(ts);
    if (!reduceMotion) ensureFrame();
  }

  function visibleWidth() {
    if (!detailPanel || detailPanel.hidden) return width;
    const sr = svgNode.getBoundingClientRect();
    if (!sr.width) return width;
    const pr = detailPanel.getBoundingClientRect();
    if (!pr.width || pr.left >= sr.right) return width;
    const visiblePx = pr.left - sr.left;
    if (visiblePx < sr.width * 0.45) return width;
    return width * (visiblePx / sr.width);
  }

  // Sığdırma yarıçapı halkanın kendisi değil, etiketleriyle birlikte en dışa
  // taşan menzilin merkeze uzaklığı: "Fer'u'd-Delvi'l-Mukaddem" gibi uzun
  // adlar sadece ringR'e bakınca çerçevenin dışında kalıyordu. Her düğümün
  // kutusunun merkeze en uzak köşesini ölçtüğümüz için halka dönerken de
  // geçerli kalıyor.
  // Sığdırma, düğümlerin ETİKETLERİYLE birlikte kapladığı gerçek kutuya
  // bakıyor. 3B'de sarmal düz halkadan belirgin biçimde daha uzun olduğu için
  // yarıçap temelli bir hesap yetmiyordu.
  function contentBox() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    nodeLayer.selectAll("g.menzil-node").each(function (n) {
      let b; try { b = this.getBBox(); } catch (e) { b = { x: -14, y: -14, width: 28, height: 34 }; }
      x0 = Math.min(x0, n.x + b.x); x1 = Math.max(x1, n.x + b.x + b.width);
      y0 = Math.min(y0, n.y + b.y); y1 = Math.max(y1, n.y + b.y + b.height);
    });
    if (!isFinite(x0)) return { x0: cx - ringR, x1: cx + ringR, y0: cy - ringR, y1: cy + ringR };
    return { x0, x1, y0, y1 };
  }

  function fitView(animate) {
    if (!zoomBehavior || !nodeLayer) return;
    const pad = 26;
    const vw = visibleWidth();
    const b = contentBox();
    const bw = Math.max(1, b.x1 - b.x0) + pad * 2;
    const bh = Math.max(1, b.y1 - b.y0) + pad * 2;
    const k = Math.max(0.5, Math.min(3, Math.min(vw / bw, height / bh)));
    const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    const t = d3.zoomIdentity.translate(vw / 2 - k * mx, height / 2 - k * my).scale(k);
    const sel = (animate && !reduceMotion) ? svg.transition().duration(450).ease(d3.easeCubicInOut) : svg;
    sel.call(zoomBehavior.transform, t);
  }

  function showTooltip(n, event) {
    if (!tooltip) return;
    tooltip.innerHTML =
      `<div class="node-hover-tip__title">${n.sira}. ${n.menzil}</div>` +
      `<div class="node-hover-tip__short">${tt(n.zuhur)}</div>` +
      `<div class="node-hover-tip__meta">${n.harf} ${n.harfArapca} · ${n.isim} · ${katmanAdi(n)}</div>`;
    tooltip.hidden = false; moveTooltip(event);
  }
  function moveTooltip(event) { GU.moveTooltip(tooltip, wrapEl, event); }
  function hideTooltip() { GU.hideTooltip(tooltip); }

  // --- Detay paneli ---
  function katmanAdi(n) {
    const k = (data.katmanlar || []).find((x) => x.id === n.katman);
    return k ? tt(k.ad) : "";
  }

  function rowHtml(label, value) {
    return `<div class="menzil-row"><span class="menzil-row__k">${label}</span><span class="menzil-row__v">${value}</span></div>`;
  }

  // Panel şimdiye kadar dört satırlık kuru bir künye veriyordu (harf, isim,
  // katman, zuhur) -- okuyucu bu satırların birbiriyle ne ilgisi olduğunu
  // kendi çıkarmak zorundaydı (kullanıcı notu 2026-07-27). Bu paragraf
  // şemanın kendisini bir kez anlatıyor ve o menzilin kendi değerlerini
  // geri okuyor. İçerik uydurulmuyor: yalnız veride duran alanlar
  // cümleye çevriliyor, ve karşılıkların gerekçesini bilmediğimizi
  // söylüyoruz (bkz. sitenin kökensel duruşu).
  function okumaNotuHtml(n) {
    const katman = katmanAdi(n);
    const zuhur = tt(n.zuhur);
    const txt = I18n.pick3({
      tr: `Dost'un burada kurduğu şema şu: ayın yirmi sekiz menzilinin her birine bir <em>harf</em> ve bir <em>ilâhî isim</em> düşüyor, ve o menzilden âlemde neyin göründüğü (<em>zuhur</em>) sayılıyor. ${n.sira}. menzil olan <em>${n.menzil}</em>'de harf <em>${n.harf}</em>, isim <em>${n.isim}</em>; halkadaki yeri <em>${katman}</em> katmanı. Zuhur satırında sayılanlar ise şunlar: ${zuhur}. Bu üçünün neden yan yana durduğunu biz de tam çıkarabilmiş değiliz — metin karşılıkları çoğu zaman gerekçelendirmeden veriyor. Olduğu gibi aktarıyoruz, aradaki bağı okuyucunun bizimle birlikte aramasını tercih ederek.`,
      en: `The scheme Ibn Arabi sets up here is this: to each of the moon's twenty-eight mansions there falls a <em>letter</em> and a <em>divine name</em>, and what appears in the world from that mansion (<em>zuhur</em>) is enumerated. In mansion ${n.sira}, <em>${n.menzil}</em>, the letter is <em>${n.harf}</em> and the name <em>${n.isim}</em>; its place on the ring is the <em>${katman}</em> tier. What the zuhur line enumerates is: ${zuhur}. Why these three stand side by side we have not been able to work out either — the text mostly gives the correspondences without grounding them. We pass them on as they are, preferring that the reader look for the link along with us.`,
      pt: `O esquema que Ibn Arabi monta aqui é este: a cada uma das vinte e oito mansões da lua cabe uma <em>letra</em> e um <em>nome divino</em>, e enumera-se o que dessa mansão aparece no mundo (<em>zuhur</em>). Na mansão ${n.sira}, <em>${n.menzil}</em>, a letra é <em>${n.harf}</em> e o nome <em>${n.isim}</em>; o seu lugar no anel é o estrato <em>${katman}</em>. O que a linha do zuhur enumera é: ${zuhur}. Porque é que estes três estão lado a lado, também nós não conseguimos apurar — o texto dá as correspondências, na maior parte das vezes, sem as fundamentar. Transmitimo-las tal como estão, preferindo que o leitor procure o elo connosco.`,
    });
    return `<div class="detail-block"><p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Bu satırlar ne diyor?", en: "What do these lines say?", pt: "O que dizem estas linhas?" })}</p><p>${linkify(txt, "menziller", String(n.sira))}</p></div>`;
  }

  // Bu halka 198. Bölümün yirmi sekiz faslından derlendi, ama Fütûhât'ı
  // kısım kısım okuma turumuz o fasılların şu an yalnız ilk onuna ulaştı
  // (Cilt IX, kısım CXXI ve CXXII). Ulaştıklarımızda o kısma geri götüren
  // bir bağ veriyoruz; ulaşmadıklarımızda susuyoruz -- okumadığımız bir
  // yeri okumuş gibi göstermemek için.
  function okumaBagiHtml(n) {
    if (!n.okuma) return "";
    const base = window.__dostRouteBase || "";
    const label = tt({
      tr: "Bu faslı okuduğumuz kısım",
      en: "The part where we read this section",
      pt: "A parte onde lemos esta secção",
    });
    return `<a class="cross-link" href="${base}/futuhat/${n.okuma}" data-view="futuhat" data-id="${n.okuma}">${label} →</a>`;
  }

  function openMenzil(n) {
    activeId = n.sira;
    const L = {
      harf: tt({ tr: "Harf", en: "Letter", pt: "Letra" }),
      isim: tt({ tr: "İlahi isim", en: "Divine name", pt: "Nome divino" }),
      zuhur: tt({ tr: "Bu menzilden zuhur eden", en: "What appears from this mansion", pt: "O que aparece desta mansão" }),
      kaynak: tt({ tr: "Kaynak", en: "Source", pt: "Fonte" }),
      katman: tt({ tr: "Mertebe katmanı", en: "Tier of ranks", pt: "Estrato dos graus" }),
    };
    const varyant = n.varyant
      ? `<p class="menzil-varyant">${tt({ tr: "Bir diğer adı", en: "Also called", pt: "Também chamada" })}: ${n.varyant}</p>` : "";
    const notu = n.not
      ? `<div class="detail-analogy"><p class="detail-analogy__label">${tt({ tr: "Bir çekince", en: "A caveat", pt: "Uma ressalva" })}</p><p>${tt(n.not)}</p></div>` : "";
    detailContent.innerHTML = `
      <p class="detail-eyebrow"><button class="menzil-back-link" type="button">← ${tt({ tr: "Halkaya dön", en: "Back to the ring", pt: "Voltar ao anel" })}</button></p>
      <h2 class="detail-title">${n.sira}. ${n.menzil}</h2>
      ${varyant}
      <div class="menzil-rows">
        ${rowHtml(L.harf, `${n.harf} <span class="menzil-harf-ar">${n.harfArapca}</span>`)}
        ${rowHtml(L.isim, n.isim)}
        ${rowHtml(L.katman, katmanAdi(n))}
      </div>
      <div class="detail-block detail-block--ibnarabi"><p class="menzil-zuhur__label">${L.zuhur}</p><p>${linkify(tt(n.zuhur), "menziller", String(n.sira))}</p></div>
      ${okumaNotuHtml(n)}
      ${notu}
      ${okumaBagiHtml(n)}
      <p class="menzil-kaynak">${L.kaynak}: ${n.kaynak}</p>`;
    detailContent.querySelector(".menzil-back-link").addEventListener("click", () => { activeId = null; showIntro(); ensureFrame(); });
    detailPanel.hidden = false;
    window.__dostNav && window.__dostNav.setHash("menziller", String(n.sira));
    ensureFrame();
  }

  function showIntro() {
    const notlar = (data.notlar || []).map((x) => `<li>${tt(x)}</li>`).join("");
    const kaynaklar = (data.sources || []).map((s) => `<li>${tt(s)}</li>`).join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Menziller", en: "The Mansions", pt: "As Mansões" })}</p>
      <h2 class="detail-title">${tt({ tr: "Yirmi Sekiz Ay Menzili", en: "The Twenty-Eight Mansions of the Moon", pt: "As Vinte e Oito Mansões da Lua" })}</h2>
      <div class="detail-block detail-block--ibnarabi"><p>${tt(data.intro)}</p></div>
      <div class="detail-block detail-block--ibnarabi"><p>${tt(data.center.not)}</p></div>
      <div class="detail-analogy"><p class="detail-analogy__label">${tt({ tr: "Sarmal ne gösteriyor", en: "What the spiral shows", pt: "O que a espiral mostra" })}</p><p>${tt(data.katmanNotu)}</p></div>
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Çekincelerimiz", en: "Our caveats", pt: "As nossas ressalvas" })}</p>
      <ul class="menzil-notlar">${notlar}</ul>
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Kaynak", en: "Sources", pt: "Fontes" })}</p>
      <ul class="menzil-notlar">${kaynaklar}</ul>`;
    detailPanel.hidden = false;
    window.__dostNav && window.__dostNav.setHash("menziller");
  }

  function build() {
    nodes = data.menziller.map((m) => Object.assign({}, m));
    layout();
    buildDom();
    wireTiltToggle();
    wireRotateDrag();
    render(performance.now());
    fitView(false);
    ensureFrame();
    window.addEventListener("resize", onResize);
  }

  function onResize() {
    if (!nodes.length || wrapEl.hidden) return;
    layout();
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    render(performance.now());
    fitView(false);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || wrapEl.hidden || !activeId) return;
    activeId = null; showIntro(); ensureFrame();
  });

  GU.onViewWake(() => { if (!wrapEl.hidden) ensureFrame(); });

  window.__menzillerApp = {
    activate() {
      fetchData().then((d) => {
        if (!d) return;
        if (!nodes.length) { build(); showIntro(); fitView(false); openIn3D(); }
        else ensureFrame();
      });
    },
    goToNode(id) {
      fetchData().then((d) => {
        if (!d) return;
        if (!nodes.length) build();
        const n = nodes.find((x) => String(x.sira) === String(id));
        if (n) openMenzil(n); else showIntro();
      });
    },
    onLangChange() {
      if (!nodes.length) return;
      render(performance.now());
      const n = activeId ? nodes.find((x) => x.sira === activeId) : null;
      if (n) openMenzil(n);
      else if (detailPanel && !detailPanel.hidden) showIntro();
    },
  };
})();
