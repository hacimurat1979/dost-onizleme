// Seyahat Atlası — Dost'un Mürsiye'den Şam'a uzanan güzergâhı, her durakta
// yazdığı eserlerle birlikte (docs/icerik-yol-haritasi.md D8).
//
// NEDEN BU BİÇİM. Statik site kısıtıyla uyumlu: harita tile servisi yok,
// kendi çizdiğimiz bir kıyı şeridi var. İlk hâli (2026-08) tamamen soyuk
// Bezier lekelerdi -- hiçbir gerçek noktaya bağlı değildi. Kullanıcı
// isteğiyle (2026-08-09) sitenin dokusuna uyan, TANINABİLİR bir dünya
// haritası biçimine dönüştü: KIYI_SERITLERI'ndeki enlem/boylam dizileri
// elle basitleştirilmiş bir yaklaşıklama (coğrafya ders kitabı hassasiyeti
// İDDİA ETMİYORUZ), ama artık İber Yarımadası/Mağrib/Anadolu-Arabistan
// gerçekten o biçimde duruyor. Modern siyasi sınır yine yok (roadmap'in
// ilk isteği), yalnız kıyı çizgisi eklendi.
// Zaman kaydırıcısı GORSEL_DIL.md'nin "davranışı resmet" kuralını
// karşılıyor: bir yıl seçildiğinde, o yıldan SONRA varılan duraklar ve
// onlara giden rota parçaları sönükleşiyor -- güzergâh zamanla AÇILIYOR,
// süs değil.
window.__seyahatAtlasiApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  // Duraklar gerçek enlem/boylamla yerleşiyor -- iki durak coğrafyada
  // gerçekten yakınsa (Mekke/Tâif, İşbiliye/Mevrûr gibi) etiketleri
  // üst üste biniyordu. Ortak motor (Hâller/Ontoloji/Sorular'da zaten
  // kanıtlanmış) etiketleri ölçüp çakışanı aşağı kaydırıyor.
  const deconflictLabels = GU.createLabelDeconflictor();

  const svg = d3.select("#seyahat-atlasi-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("seyahat-atlasi-wrap");
  const tooltip = document.getElementById("seyahat-atlasi-tooltip");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const slider = document.getElementById("seyahat-atlasi-slider");
  const sliderEtiket = document.getElementById("seyahat-atlasi-slider-etiket");
  const geriBtn = document.getElementById("seyahat-atlasi-geri");
  const ileriBtn = document.getElementById("seyahat-atlasi-ileri");
  const oynatBtn = document.getElementById("seyahat-atlasi-oynat");
  const OYNAT_IKON = '<svg class="seyahat-atlasi-zaman__oynat-ikon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5 L19 12 L8 19 Z" fill="currentColor"/></svg>';
  const DURAKLAT_IKON = '<svg class="seyahat-atlasi-zaman__oynat-ikon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 5 H10 V19 H7 Z M14 5 H17 V19 H14 Z" fill="currentColor"/></svg>';

  if (!svgNode || !wrapEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  function tt(dict) { return I18n.pick3(dict || {}); }

  // Eser Ağı/Sorular'da iki kez işe yarayan üçlü (2026-08-09): otomatik
  // kavram linki + kronolojik önce/sonra gezinme + katlanır kaynak notu.
  // Seyahat Atlası zaten kronolojik bir güzergah (duraklar sırayla), bu
  // üçlü buraya da doğal bir sonraki durak.
  function linkify(text) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text) : text;
  }

  let data = null;
  let eserAgiData = null;
  let duraklar = [];
  let durakById = new Map();
  let eserById = new Map();
  let zoom = null;
  let g = null;
  let focusId = null;
  let minYear = 1165, maxYear = 1240, sliderYear = 1240;
  // Kaydırıcı artık yıl değil DURAK indeksiyle çalışıyor (2026-08-14 karar):
  // 75 yıllık aralıkta 1'er adım, yalnız 15 anlamlı durağa karşılık geliyordu
  // -- baştan sona 75 tıklama gerektiriyordu (kullanıcı bulgusu). sliderYear
  // hâlâ gerçek filtre/render mantığının (uygulaZamanFiltresi, ...) dayandığı
  // değer; stopIndex yalnız kaydırıcının kendi ölçeğini durağa hizalıyor.
  let stopIndex = 0;
  let xScale = null, yScale = null;

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(360, r.width), h: Math.max(320, r.height) };
  }

  // Basit düzlem izdüşümü (gerçek bir harita projeksiyonu değil) -- enlem/
  // boylamı doğrudan x/y'e ölçekliyoruz. Şematik olduğu için yeterli.
  function yerlestir() {
    const { w, h } = boyut();
    const PAD = 50;
    const lons = duraklar.map((d) => d.lon), lats = duraklar.map((d) => d.lat);
    xScale = d3.scaleLinear().domain([Math.min(...lons) - 3, Math.max(...lons) + 3]).range([PAD, w - PAD]);
    yScale = d3.scaleLinear().domain([Math.max(...lats) + 3, Math.min(...lats) - 3]).range([PAD, h - PAD]);
    duraklar.forEach((d) => { d.x = xScale(d.lon); d.y = yScale(d.lat); });
    return { w, h };
  }

  // Kıyı şeritleri -- kullanıcı isteğiyle (2026-08-09) eskiki tamamen soyut
  // Bezier lekelerin (rastgele eğriler, hiçbir gerçek noktaya bağlı değildi)
  // yerine geçti. Aşağıdaki enlem/boylam dizileri elle basitleştirilmiş bir
  // yaklaşıklama -- coğrafya ders kitabı hassasiyetinde DEĞİL, ama artık
  // GERÇEK kıyı biçimine (İber Yarımadası, Cebelitarık Boğazı, Kızıldeniz'in
  // Hicaz kıyısı boyunca çizdiği eğri) yakın ve durakların KENDİSİYLE AYNI
  // projeksiyondan geçiyor -- yani her durak, ait olduğu kara parçasının
  // gerçekten İÇİNDE duruyor. Modern siyasi sınır yok (roadmap'in ilk
  // isteği hâlâ geçerli), yalnız kıyı çizgisi.
  const KIYI_SERITLERI = [
    // İber Yarımadası
    [[-9.3, 43.1], [-8.8, 41.5], [-9.5, 38.7], [-8.9, 37.0], [-7.5, 36.7],
     [-5.4, 36.1], [-2.5, 36.7], [-0.5, 37.9], [0.3, 39.5], [1.2, 41.0],
     [2.2, 41.4], [3.2, 42.4], [1.5, 43.4], [-1.8, 43.4], [-6.5, 43.6]],
    // Mağrib kıyısı (Fas'tan Tunus'a)
    [[-9.3, 35.7], [-6.0, 35.4], [-2.9, 35.2], [-0.6, 35.7], [3.0, 36.8],
     [7.0, 37.0], [9.5, 37.2], [10.5, 34.5], [8.5, 32.3], [3.0, 32.0],
     [-2.0, 33.2], [-4.5, 34.3], [-7.5, 34.0]],
    // Anadolu + Şam bölgesi + Mezopotamya + Arabistan (tek parça, kıyısı
    // Hicaz boyunca Kızıldeniz'e sokularak gerçek biçimine yaklaşıyor)
    [[26.5, 40.3], [29.0, 41.3], [35.0, 42.0], [41.5, 41.2], [44.3, 39.5],
     [43.0, 37.2], [41.2, 36.5], [44.4, 33.3], [48.0, 30.0], [48.5, 27.0],
     [50.0, 24.0], [46.0, 19.5], [39.8, 21.4], [38.9, 22.5], [37.2, 24.5],
     [34.9, 27.9], [34.5, 31.5], [34.8, 32.8], [35.9, 34.9], [36.2, 36.2],
     [38.0, 37.5], [35.5, 37.0], [30.5, 36.7], [27.0, 37.0]],
  ];

  function karaLekeleri() {
    const line = d3.line()
      .x((p) => xScale(p[0]))
      .y((p) => yScale(p[1]))
      .curve(d3.curveCatmullRomClosed.alpha(0.7));
    return KIYI_SERITLERI.map((seri) => line(seri));
  }

  function ciz() {
    const { w, h } = yerlestir();
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    g = svg.append("g").attr("class", "seyahat-scene");

    g.append("g").attr("class", "seyahat-kara").selectAll("path").data(karaLekeleri()).join("path").attr("d", (d) => d);

    // Rota: kronolojik sırayla duraklar arası kavisli çizgi.
    const line = d3.line().x((d) => d.x).y((d) => d.y).curve(d3.curveCatmullRom.alpha(0.6));
    const rotaSel = g.append("g").attr("class", "seyahat-rota-g").selectAll("path.seyahat-rota-parca")
      .data(duraklar.slice(1).map((d, i) => ({ a: duraklar[i], b: d })))
      .join("path")
      .attr("class", "seyahat-rota-parca")
      .attr("d", (d) => line([d.a, d.b]))
      .attr("fill", "none");

    const durakSel = g.append("g").attr("class", "seyahat-durak-g").selectAll("g.seyahat-durak")
      .data(duraklar, (d) => d.id).join("g")
      .attr("class", "seyahat-durak")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => tt(d.sehir));

    durakSel.append("circle").attr("class", "seyahat-durak__vurus").attr("r", 16).attr("fill", "transparent");
    durakSel.append("circle").attr("class", "seyahat-durak__nokta").attr("r", 6);
    const etiketSel = durakSel.append("text").attr("class", "seyahat-durak__etiket")
      .attr("text-anchor", (d) => (d.x > w * 0.7 ? "end" : "start"))
      .attr("x", (d) => (d.x > w * 0.7 ? -10 : 10))
      .attr("y", 4)
      .text((d) => tt(d.sehir));

    // Coğrafyada yakın duraklar (Mekke/Tâif gibi) etiketleri çakıştırıyordu
    // -- çakışan aşağı kaydırılıyor, dur noktalarının kendisi de birer
    // engel sayılıyor ki etiket komşu bir noktanın TAM üstüne düşmesin.
    const pendingLabels = [];
    etiketSel.each(function (d) {
      const offsetX = d.x > w * 0.7 ? -10 : 10;
      pendingLabels.push({ lbl: d3.select(this), txt: tt(d.sehir), x: d.x + offsetX, y: d.y + 4, baseY: 4 });
    });
    const obstacles = duraklar.map((d) => ({ x: d.x, y: d.y, half: 7, h: 14 }));
    deconflictLabels(pendingLabels, obstacles);
    // Kaydırılan etiketleri kendi durak noktalarına ince bir çizgiyle
    // bağla -- Mekke/Tâif yoğunluğunda hangi ad hangi noktaya ait
    // okunmuyordu (motor elestiri G37'den gelme, graph-utils.js).
    GU.attachLeaderLines(pendingLabels, {
      className: "seyahat-durak__leader",
      threshold: 6,
      gap: 6,
    });

    durakSel.on("mouseenter", function (ev, d) { vurgula(d.id, true); ipucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgula(null, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgula(d.id, true); })
      .on("blur", function () { vurgula(null, false); })
      .on("click", (ev, d) => durakPaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); durakPaneli(d); }
      });

    zoom = GU.createZoomBehavior(svg, g, [0.7, 3]);
    ortala(false);
    uygulaZamanFiltresi();
  }

  function uygulaZamanFiltresi() {
    if (!g) return;
    g.selectAll("g.seyahat-durak").classed("seyahat-durak--gelecek", (d) => d.yil_baslangic > sliderYear);
    g.selectAll("path.seyahat-rota-parca").classed("seyahat-rota-parca--gelecek", (d) => d.b.yil_baslangic > sliderYear);
  }

  function vurgula(id, on) {
    if (!g) return;
    g.selectAll("g.seyahat-durak").classed("seyahat-durak--deginiliyor", (d) => on && d.id === id);
  }

  function ipucu(ev, d) {
    tooltip.innerHTML = `<strong>${tt(d.sehir)}</strong><span class="node-hover-tip__meta">${d.yil_baslangic}${d.yil_bitis !== d.yil_baslangic ? "–" + d.yil_bitis : ""}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function eserBaslik(id) {
    const e = eserById.get(id);
    return e ? e.eser : id;
  }

  function eserlerHtml(d) {
    if (!d.eserler || !d.eserler.length) return "";
    const rows = d.eserler.map((eid) =>
      `<a class="cross-link seyahat-eser-bag" href="${window.__dostNav.href("eser-agi", eid)}" data-view="eser-agi" data-id="${eid}">${eserBaslik(eid)}</a>`).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Burada yazılan eserler", en: "Works written here", pt: "Obras escritas aqui" })}</p>
            <div class="seyahat-eser-listesi">${rows}</div>`;
  }

  // "Bu durak güzergâhın neresinde?" -- duraklar zaten kronolojik sırada
  // (bkz. yukle()), yalnız dizideki komşuları okuyoruz. Tıklanınca gerçekten
  // o durağa gidiyor (wireIzAdimlari) -- ETKILESIM_DILI.md'nin "bağlanmamış
  // düğme" yasağına uyuyor.
  function izHtml(d) {
    const idx = duraklar.indexOf(d);
    const onceki = idx > 0 ? duraklar[idx - 1] : null;
    const sonraki = idx < duraklar.length - 1 ? duraklar[idx + 1] : null;
    if (!onceki && !sonraki) return "";
    const adim = (yon, hedef) => hedef
      ? `<button type="button" class="eser-agi-iz__adim eser-agi-iz__adim--${yon}" data-id="${hedef.id}">
          <span class="eser-agi-iz__etiket">${tt(yon === "once"
            ? { tr: "Öncesinde", en: "Before", pt: "Antes" }
            : { tr: "Sonrasında", en: "After", pt: "Depois" })}</span>
          <span class="eser-agi-iz__eser">${tt(hedef.sehir)}</span></button>`
      : "<span></span>";
    return `<nav class="eser-agi-iz" aria-label="${tt({ tr: "Güzergâhtaki komşu duraklar", en: "Neighbouring stops on the route", pt: "Paragens vizinhas na rota" })}">
      ${adim("once", onceki)}${adim("sonra", sonraki)}</nav>`;
  }

  function wireIzAdimlari() {
    detailContent.querySelectorAll(".eser-agi-iz__adim").forEach((btn) => {
      btn.addEventListener("click", () => {
        const hedef = durakById.get(btn.dataset.id);
        if (hedef) durakPaneli(hedef);
      });
    });
  }

  function durakPaneli(d) {
    focusId = d.id;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${d.yil_baslangic}${d.yil_bitis !== d.yil_baslangic ? "–" + d.yil_bitis : ""}</p>
      <h2 class="detail-title">${tt(d.sehir)}</h2>
      ${izHtml(d)}
      <div class="detail-block detail-block--soru"><p>${linkify(tt(d.ozet))}</p></div>
      ${eserlerHtml(d)}`;
    detailPanel.hidden = false;
    vurgula(d.id, true);
    kayirPanelinDisina();
    wireIzAdimlari();
  }

  // Panel (#detail-panel) position:fixed; harita konteynerinin genişliğini
  // DEĞİŞTİRMİYOR, yalnız sağdaki ~420px'i (bkz. style.css .detail-panel
  // width:min(420px,92vw)) üstüne kaplıyor. Haritadaki 15 duraktan çoğu
  // (varış noktası Şam dahil) bu şeritte kalıp panel açıkken tıklanamıyordu
  // (UI denetimi bulgusu). Yalnız tıklanan durağı kaydırmak yetmiyor --
  // ÖNCEKİ deneme bunu yaptı ama diğer 8 durak yine örtülü kaldı, çünkü
  // güzergâhın geri kalanı hâlâ panelin altındaydı. Bunun yerine bütün
  // güzergâhı panelin SOLUNDAKİ boşluğa sığdırıyoruz (gerekirse küçülterek)
  // -- odaklanılan durak değil, güzergâhın TAMAMI erişilebilir kalsın diye.
  function kayirPanelinDisina() {
    if (!zoom || !svg || !wrapEl || !duraklar.length) return;
    requestAnimationFrame(() => {
      const panelRect = detailPanel.getBoundingClientRect();
      const wrapRect = wrapEl.getBoundingClientRect();
      const panelLeftInWrap = panelRect.left - wrapRect.left;
      if (panelLeftInWrap >= wrapRect.width - 4) return; // panel bu genişlikte haritayı örtmüyor (örn. mobil tam ekran panel)
      const margin = 28;
      const availW = panelLeftInWrap - margin * 2;
      if (availW < 80) return; // ekran çok dar, sığdırmaya yer yok
      const xs = duraklar.map((s) => s.x), ys = duraklar.map((s) => s.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const routeW = Math.max(1, maxX - minX), routeH = Math.max(1, maxY - minY);
      const wrapH = wrapRect.height;
      const currentT = d3.zoomTransform(svg.node());
      let k = Math.min(3, availW / routeW, (wrapH - margin * 2) / routeH);
      k = Math.min(k, currentT.k); // yalnız küçültüyoruz -- kullanıcının kendi yakınlaştırdığı bir görünümü büyütüp bozmuyoruz
      if (currentT.k * routeW <= availW) return; // güzergâh zaten tamamen görünür alanda sığıyor
      k = Math.max(0.7, k);
      const tx = margin - minX * k + Math.max(0, (availW - routeW * k) / 2);
      const ty = margin - minY * k + Math.max(0, (wrapH - margin * 2 - routeH * k) / 2);
      const newT = d3.zoomIdentity.translate(tx, ty).scale(k);
      svg.transition().duration(420).call(zoom.transform, newT);
    });
  }

  function girisPaneli() {
    focusId = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Seyahat Atlası", en: "Travel Atlas", pt: "Atlas de Viagem" })}</p>
      <h2 class="detail-title">${duraklar.length} ${tt({ tr: "durak", en: "stops", pt: "paragens" })}</h2>
      <div class="detail-block detail-block--soru"><p>${linkify(tt(data.not))}</p></div>
      <details class="eser-agi-kaynak-detay">
        <summary>${tt({ tr: "Kaynak ve yöntem", en: "Source and method", pt: "Fonte e método" })}</summary>
        <ul class="bilmiyoruz-madde__kaynaklar">${data.kaynaklar.map((k) => {
          const not = k.not ? ` <span class="bilmiyoruz-madde__kaynak-not">— ${k.not}</span>` : "";
          const yil = k.yil ? ", " + k.yil : "";
          return `<li class="bilmiyoruz-madde__kaynak">${k.yazar}, <em>${k.eser}</em>${yil}${not}</li>`;
        }).join("")}</ul>
      </details>`;
    detailPanel.hidden = false;
  }

  function ortala(animate) {
    if (!zoom) return;
    const hedef = animate ? svg.transition().duration(420) : svg;
    hedef.call(zoom.transform, d3.zoomIdentity);
  }

  // Yıl kaydırıcısına ileri/geri/oynat -- eskiden yalnız elle sürüklenebiliyordu
  // (kullanıcı bulgusu: "ileri geri gibi bir seçenek ekleyelim"). setStop tek bir
  // yerden slider.value + etiket + filtreyi birlikte günceller ki geri/ileri/
  // oynat/elle sürükleme dördü de aynı yoldan geçsin.
  let oynatTimer = null;
  function oynatDurdur() {
    if (oynatTimer) { clearInterval(oynatTimer); oynatTimer = null; }
    if (oynatBtn) {
      oynatBtn.setAttribute("aria-pressed", "false");
      oynatBtn.innerHTML = OYNAT_IKON;
    }
  }
  function setStop(i) {
    stopIndex = Math.max(0, Math.min(duraklar.length - 1, i));
    sliderYear = duraklar[stopIndex].yil_baslangic;
    if (slider) slider.value = String(stopIndex);
    if (sliderEtiket) sliderEtiket.textContent = String(sliderYear);
    uygulaZamanFiltresi();
  }
  function slidereBagla() {
    if (!slider || !duraklar.length) return;
    slider.min = "0";
    slider.max = String(duraklar.length - 1);
    slider.step = "1";
    stopIndex = duraklar.length - 1;
    slider.value = String(stopIndex);
    sliderYear = duraklar[stopIndex].yil_baslangic;
    if (sliderEtiket) sliderEtiket.textContent = String(sliderYear);
    slider.addEventListener("input", () => {
      oynatDurdur();
      setStop(Number(slider.value));
    });
    if (geriBtn) geriBtn.addEventListener("click", () => { oynatDurdur(); setStop(stopIndex - 1); });
    if (ileriBtn) ileriBtn.addEventListener("click", () => { oynatDurdur(); setStop(stopIndex + 1); });
    if (oynatBtn) {
      oynatBtn.addEventListener("click", () => {
        if (oynatTimer) { oynatDurdur(); return; }
        // Sona gelinmişse baştan başlat -- aksi hâlde "oynat"a basınca hiçbir
        // şey olmuyor izlenimi verir.
        if (stopIndex >= duraklar.length - 1) setStop(0);
        oynatBtn.setAttribute("aria-pressed", "true");
        oynatBtn.innerHTML = DURAKLAT_IKON;
        oynatTimer = setInterval(() => {
          // Görünüm arka plana geçtiyse (başka bir bölüme geçildiyse)
          // oynatmayı durdur -- aksi hâlde kullanıcı geri döndüğünde
          // beklenmedik bir durakta bulur kendini.
          if (!GU.isViewActive(wrapEl) || stopIndex >= duraklar.length - 1) { oynatDurdur(); return; }
          setStop(stopIndex + 1);
        }, 650);
      });
    }
  }

  let yuklendi = false;
  function yukle() {
    if (yuklendi) return Promise.resolve();
    const base = window.__dostRouteBase || "";
    const urlAtlas = (base ? base + "/" : "") + "data/ibn-arabi/seyahat-atlasi.json";
    const urlEser = (base ? base + "/" : "") + "data/ibn-arabi/eser-agi.json";
    return Promise.all([GU.fetchJson(urlAtlas), GU.fetchJson(urlEser)]).then(([d, e]) => {
      data = d;
      eserAgiData = e;
      // Kronolojik sırayla -- ham veri dizisi bu sırada değil (ör. "meriye"
      // 1199, ondan sonraki "fas" 1194'te geçiyor); durak-indeksli kaydırıcı
      // (aşağı bkz.) bu sıraya güveniyor.
      duraklar = (d.duraklar || []).map((x) => Object.assign({}, x))
        .sort((a, b) => a.yil_baslangic - b.yil_baslangic);
      durakById = new Map(duraklar.map((x) => [x.id, x]));
      eserById = new Map((e.eserler || []).map((x) => [x.id, x]));
      const years = duraklar.map((x) => x.yil_baslangic);
      minYear = Math.min(...years);
      maxYear = Math.max(...duraklar.map((x) => x.yil_bitis).concat(years));
      yuklendi = true;
      ciz();
      slidereBagla();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("seyahat-atlasi-recenter", () => ortala(true));
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("seyahat-atlasi-wrap", () => {
      if (focusId) { girisPaneli(); return true; }
      return false;
    });
    window.addEventListener("resize", GU.debounceResize(() => {
      if (!yuklendi || wrapEl.hidden) return;
      ciz();
    }));
  }

  return {
    activate() {
      // 2026-08-06 kullanıcı bulgusu: girisPaneli() burada çağrılıp panel
      // her açılışta otomatik gösteriliyordu -- artık yalnız bir durak
      // seçildiğinde açılıyor (bkz. hocalar.js'teki aynı düzeltme).
      baglaBirKez();
      yukle().catch(() => {
        const st = document.getElementById("seyahat-atlasi-wrap-status");
        if (st) {
          st.hidden = false;
          st.querySelector(".view-status__text").textContent =
            tt({ tr: "Atlas yüklenemedi.", en: "The atlas could not be loaded.", pt: "O atlas não pôde ser carregado." });
        }
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      ciz();
      if (focusId) {
        const d = durakById.get(focusId);
        if (d) durakPaneli(d); else if (!detailPanel.hidden) girisPaneli();
      } else if (!detailPanel.hidden) girisPaneli();
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = durakById.get(id);
        if (d) durakPaneli(d);
      });
    },
  };
})();
