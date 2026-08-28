(function () {
  "use strict";

  const I18n = window.DostI18n;

  // Bu modül 2026-07-27'ye kadar kendi sayfasıydı (daphne-profil.html,
  // "understand" yazınca açılıyordu). Artık compare.html'in bir sekmesi:
  // sayfayı o yönetiyor, burası yalnız kendi grafiğini kuruyor. Bu yüzden
  // ne dil seçiciyi çiziyor ne de sekmeleri bağlıyor -- ikisi de
  // compare.js'te, yoksa iki modül birbirinin üstüne yazardı.
  const svg = d3.select("#profile-graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");
  const articlesList = document.getElementById("articles-list");
  if (!svg.node()) return;

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)

  window.DostGraphUtils.setupDetailPanelFocus();

  detailClose.addEventListener("click", () => {
    detailPanel.hidden = true;
  });

  // Node clicks bubble up to this same listener; skip those so the panel
  // that a click just opened isn't immediately closed by that same click.
  document.addEventListener("click", (e) => {
    if (detailPanel.hidden) return;
    if (detailPanel.contains(e.target) || e.target === detailClose) return;
    if (e.target.closest && e.target.closest(".node")) return;
    detailPanel.hidden = true;
  });

  // Escape/header-back/header-title navigasyonu buradan kaldırıldı
  // (2026-08-15): compare.js aynı #detail-panel, #header-back ve
  // .app-header__title'a kendi dinleyicilerini de bağlıyordu -- iki
  // bağımsız keydown dinleyicisi aynı Escape basışında hem paneli kapatıp
  // hem kullanıcıyı index.html'e atıyordu (ve headerBack/headerTitle
  // tıklamaları aynı yarış koşuluyla compare.html yerine index.html'e
  // gidiyordu, çünkü compare.js script sırasında sonra yükleniyor).
  // Sayfa/geri-gitme mantığının tek sahibi artık compare.js.

  let pageData = null;
  let nodeSel, linkSel, labelSel, zoomBehavior;
  let currentDetailParam = null;

  // Veri yüklemesi ile GRAF KURULUMU ayrı (2026-08-28). Eskiden ikisi tek
  // adımdı ve bu iki yönlü sorun üretiyordu:
  //   - "Taranan yazılar" sekmesi doğrudan açıldığında profil paneli
  //     gizli, dolayısıyla svg genişliği 0; graf bozuk kuruluyordu.
  //   - Genişlik 0 iken kurmayı reddetmeye başlayınca (aşağıdaki tablet
  //     düzeltmesi) bu sefer YAZI LİSTESİ de hiç çizilmiyordu -- oysa
  //     listenin svg ile hiçbir işi yok.
  // Artık veri gelir gelmez liste çiziliyor; graf yalnız ölçü varken.
  function loadData() {
    if (window.DostViewStatus) window.DostViewStatus.showLoading("profile-wrap");
    window.DostGraphUtils.fetchJson("data/daphne-profile.json")
      .then((data) => {
        pageData = data;
        if (window.DostViewStatus) window.DostViewStatus.hide("profile-wrap");
        renderArticles(data);
        grafiKur();
      })
      .catch((err) => {
        console.error("Daphne profil verisi yüklenemedi / Failed to load Daphne profile data", err);
        if (window.DostViewStatus) window.DostViewStatus.showError("profile-wrap", loadData);
      });
  }
  // loadData() artık açılışta çağrılmıyor: bölüm gizliyken svg genişliği
  // 0 oluyor ve graf bozuk kuruluyor. Sekmesi ilk açıldığında çağrılıyor.
  //
  // 2026-08-28 (tablet bulgusu, kullanıcı): "grafik sol üst köşede
  // kaybolmak üzere görünüyor." İki ayrı kusur vardı, ikisi de burada:
  //
  //  1) Bekleme koşulsuz PES EDİYORDU. 12 kare sonra `started = true`
  //     olup graf yine kuruluyordu -- genişlik hâlâ 0 olsa bile. cx = 0/2
  //     = 0, orbit = 0 demek; bütün düğümler tek noktaya, sol üste
  //     yığılıyor. Yavaş bir tablette 12 kare (~200 ms) yetmiyor. Artık
  //     genişlik 0 iken ASLA kurulmuyor: raf denemeleri bitince
  //     ResizeObserver devreye giriyor ve ölçü gerçekten geldiğinde
  //     kuruluyor.
  //  2) Kurulduktan sonra yeniden ÖLÇÜLMÜYORDU. Tablet döndürüldüğünde
  //     ya da panel yeniden boyutlandığında graf eski (belki çok dar)
  //     geometride kalıyordu. Artık ölçü anlamlı biçimde değişince
  //     yeniden kuruluyor.
  //
  // rAF yerine sonunda ResizeObserver: rAF arka plandaki sekmede hiç
  // ateşlenmiyor, ResizeObserver ise ölçü değişince ateşleniyor.
  let started = false;      // veri yüklendi mi
  let grafKuruldu = false;  // graf ÇİZİLDİ mi (ölçü geldiğinde)
  let sonGenislik = 0;

  function kurulabilirMi() {
    const s = svg.node();
    return !!(s && s.clientWidth > 0 && s.clientHeight > 0);
  }

  // Ölçü varsa çizer, yoksa dokunmaz. Genişlik 0 iken çizmek demek
  // cx = 0, orbit = 0 demek: bütün düğümler sol üst köşede tek noktaya
  // yığılır. Bildirilen tablet hatası buydu.
  function grafiKur() {
    if (grafKuruldu || !pageData || !kurulabilirMi()) return;
    grafKuruldu = true;
    sonGenislik = svg.node().clientWidth;
    buildGraph(pageData);
    render();
  }

  // Tablet döndürüldüğünde ya da panel yeniden boyutlandığında graf eski
  // (belki çok dar) geometride kalıyordu. Küçük dalgalanmalar (kaydırma
  // çubuğu, adres çubuğu) sayılmıyor; yalnız gerçek bir boyut değişimi.
  function yenidenKur() {
    if (!grafKuruldu || !pageData || !kurulabilirMi()) return;
    const g = svg.node().clientWidth;
    if (Math.abs(g - sonGenislik) < 24) return;
    sonGenislik = g;
    svg.selectAll("*").remove();
    buildGraph(pageData);
    render();
  }

  // rAF yerine ResizeObserver: rAF arka plandaki sekmede hiç ateşlenmiyor,
  // ResizeObserver ise ölçü değişince ateşleniyor. Panel gizliyken açılan
  // "Taranan yazılar" sekmesinden profile geçildiğinde graf burada kuruluyor.
  let gozlemci = null;
  function olcuyuIzle() {
    if (gozlemci || typeof ResizeObserver === "undefined" || !svg.node()) return;
    gozlemci = new ResizeObserver(() => {
      if (!grafKuruldu) grafiKur();
      else yenidenKur();
    });
    gozlemci.observe(svg.node());
  }

  window.__dostDaphneProfileApp = {
    activate: function () {
      // Veri her iki sekmede de hemen yükleniyor: yazı listesinin svg ile
      // işi yok, ölçü beklemesi gerekmiyor.
      olcuyuIzle();
      if (started) { grafiKur(); return; }
      started = true;
      loadData();
    },
    render: function () { if (grafKuruldu) render(); },
  };

  window.addEventListener("resize", window.DostGraphUtils.debounceResize(yenidenKur, 200));
  window.addEventListener("orientationchange", window.DostGraphUtils.debounceResize(yenidenKur, 300));

  function radiusFor(d) {
    if (d.type === "hub") return 30;
    return 8 + (d.param.weight || 5) * 1.8;
  }

  function colorFor(d) {
    if (d.type === "hub") return getVar("--series-daphne");
    return getVar("--series-daphne-line");
  }

  function getVar(name) {
    return window.DostGraphUtils.getVar(name);
  }

  // "Daphne" Türkçede defne ağacı demek (laurel/bay). Kullanıcının fikri
  // (2026-08-03): grafiklerden birinde bir defne ağacı gösterelim, dalları
  // ya da meyveleri Daphne'nin düşüncelerine dönüşmüş olsun. Bunu süs
  // olarak değil, GRAFİĞİN KENDİSİ olarak kuruyoruz -- eskiden tam çember
  // üzerinde duran on bir parametre düğümü, şimdi bir gövdeden yukarı
  // açılan on bir dal/yaprak. Hiçbir veri/etkileşim değişmedi (aynı force
  // simülasyonu, aynı tıklama/hover/klavye/sürükleme), yalnız düzen tam
  // daire yerine yukarı açılan bir yelpaze, çizgiler düz tel yerine dal
  // gibi hafifçe kavisli, yaprak düğümleri daire yerine defne yaprağı
  // biçiminde.
  const CANOPY_START = (-172 * Math.PI) / 180;
  const CANOPY_END = (-8 * Math.PI) / 180;

  function buildGraph(data) {
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;
    const cx = width / 2;
    // Gövde tabanı aşağıda, taç yukarıda açılsın diye kök düğüm merkezde
    // değil altta duruyor.
    const trunkBaseY = height - 18;
    const hubY = height * 0.86;
    const orbit = Math.min(width * 0.46, height * 0.62);

    const params = data.core_parameters;
    const nodes = [{ id: "hub", type: "hub" }];
    const links = [];

    params.forEach((param, i) => {
      const t = params.length > 1 ? i / (params.length - 1) : 0.5;
      const angle = CANOPY_START + (CANOPY_END - CANOPY_START) * t;
      nodes.push({
        id: "param-" + param.id,
        type: "param",
        param: param,
        angle: angle,
        tx: cx + orbit * Math.cos(angle),
        ty: hubY + orbit * Math.sin(angle),
      });
      links.push({ source: "hub", target: "param-" + param.id });
    });

    nodes[0].fx = cx;
    nodes[0].fy = hubY;

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(orbit).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-90))
      .force("x", d3.forceX((d) => (d.type === "param" ? d.tx : cx)).strength(0.25))
      .force("y", d3.forceY((d) => (d.type === "param" ? d.ty : hubY)).strength(0.25))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + 22));

    // Ortak Temalar grafiğiyle aynı sebep: bu ağaç da yakınlaşma/geri-
    // merkezleme taşımıyordu (UI denetimi bulgusu, #17). Gövde/dallar/
    // düğümler artık tek bir yakınlaşma katmanının içinde.
    const zoomLayer = svg.append("g").attr("class", "compare-zoom-layer");

    // Gövde: sabit (hub fx/fy ile kilitli), tek seferlik çiziliyor.
    // Dalların/kökün altına düşsün diye ilk eklenen katman bu.
    const trunkHalfWidth = 15;
    zoomLayer
      .append("path")
      .attr("class", "daphne-trunk")
      .attr(
        "d",
        `M ${cx - trunkHalfWidth} ${trunkBaseY} ` +
          `C ${cx - trunkHalfWidth} ${hubY + 34}, ${cx - 5} ${hubY + 8}, ${cx} ${hubY} ` +
          `C ${cx + 5} ${hubY + 8}, ${cx + trunkHalfWidth} ${hubY + 34}, ${cx + trunkHalfWidth} ${trunkBaseY} Z`
      );

    linkSel = zoomLayer
      .append("g")
      .attr("class", "links")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "link daphne-branch");

    const nodeGroup = zoomLayer.append("g").attr("class", "nodes");

    nodeSel = nodeGroup
      .selectAll("g.node")
      .data(nodes)
      .join("g")
      .attr("class", (d) => "node" + (d.type === "hub" ? " node--root" : " daphne-leaf-node"))
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d) => labelFor(d))
      .call(drag(simulation))
      .on("click", (event, d) => onNodeClick(d))
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onNodeClick(d);
        }
      })
      .on("mouseenter", (event, d) => highlight(d))
      .on("mouseleave", () => highlight(null))
      .on("focus", (event, d) => highlight(d))
      .on("blur", () => highlight(null));

    nodeSel.filter((d) => d.type === "hub").append("circle").attr("class", "node-halo").attr("r", radiusFor(nodes[0]) * 1.4);

    nodeSel
      .filter((d) => d.type === "hub")
      .append("circle")
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    // Parametre düğümleri: daire değil, dalın ucunda duran defne yaprağı.
    // Ağırlık (weight) hâlâ aynı yeri taşıyor -- radiusFor() değişmedi,
    // yalnız o yarıçap artık bir yaprağın boyu oluyor.
    nodeSel
      .filter((d) => d.type === "param")
      .append("path")
      .attr("class", "daphne-leaf")
      .attr("d", (d) => leafPath(radiusFor(d)))
      .attr("transform", (d) => `rotate(${(d.angle * 180) / Math.PI + 90})`)
      .attr("fill", (d) => colorFor(d));

    labelSel = nodeSel
      .append("text")
      .attr("class", (d) => (d.type === "hub" ? "node-label node-label--hub" : "node-label"))
      .attr("dy", (d) => radiusFor(d) + 14)
      .attr("text-anchor", "middle")
      .text((d) => labelFor(d));

    // H-09 / Çatışma-1 kararı (uzman paneli denetimi 2026-08-17): compare.js
    // ile aynı ekleme -- merkezi etiket-çakışma çözücüsü (bkz. oradaki not).
    const deconflictLabels = window.DostGraphUtils.createLabelDeconflictor();

    function etiketleriYerlestir() {
      const pend = [];
      labelSel.each(function (d) {
        pend.push({
          lbl: d3.select(this), txt: labelFor(d),
          x: d.x, y: d.y + radiusFor(d) + 14, baseY: 0,
          priority: d.type === "hub" ? 1 : 0,
        });
      });
      const engeller = nodes.map((d) => ({ x: d.x, y: d.y, half: radiusFor(d) + 3, h: radiusFor(d) * 2 + 6 }));
      deconflictLabels(pend, engeller);
    }

    simulation.on("tick", () => {
      linkSel.attr("d", (d) => branchPath(d.source, d.target));
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
      etiketleriYerlestir();
    });
    // compare.js ile aynı son-geçiş (bkz. oradaki not): ilk karelerde
    // getBBox 0 dönebiliyor, sahne durulunca fontlarla bir tam yerleşim.
    simulation.on("end", () => {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(etiketleriYerlestir);
      else etiketleriYerlestir();
    });

    zoomBehavior = window.DostGraphUtils.createZoomBehavior(svg, zoomLayer, [0.4, 3]);
    window.DostGraphUtils.wireRecenter("profile-recenter", () => {
      const sel = svg.transition().duration(420);
      sel.call(zoomBehavior.transform, d3.zoomIdentity);
    });

    window.__daphneProfileApp = { nodes, links, data };
  }

  // Defne yaprağı: sivri uçlu, simetrik bir oval -- yerel eksende yukarı
  // bakar (rotate ile dalın açısına döndürülür). Uzunluk `len` = radiusFor
  // (ağırlık burada da aynı anlamı taşımaya devam ediyor).
  function leafPath(len) {
    const w = len * 0.62;
    return (
      `M 0 ${-len} C ${w} ${-len * 0.55} ${w} ${len * 0.55} 0 ${len} ` +
      `C ${-w} ${len * 0.55} ${-w} ${-len * 0.55} 0 ${-len} Z`
    );
  }

  // Dal: düz tel değil, gövdeden yukarı doğru hafifçe kavisli bir eğri --
  // kontrol noktası, iki uç arasındaki yatay mesafeye göre yukarı kayar.
  function branchPath(a, b) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - Math.abs(b.x - a.x) * 0.22;
    return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
  }

  function labelFor(d) {
    if (d.type === "hub") return "Daphne";
    return tt(d.param.label);
  }

  function render() {
    if (!labelSel) return;
    labelSel.text((d) => labelFor(d));
    if (currentDetailParam) showParamDetail(currentDetailParam);
    if (pageData) renderArticles(pageData);
  }

  function highlight(d) {
    if (!d) {
      linkSel.classed("link--highlight", false);
      nodeSel.style("opacity", 1);
      return;
    }
    const connected = new Set([d.id]);
    linkSel.each((l) => {
      if (l.source.id === d.id) connected.add(l.target.id);
      if (l.target.id === d.id) connected.add(l.source.id);
    });
    linkSel.classed("link--highlight", (l) => l.source.id === d.id || l.target.id === d.id);
    nodeSel.style("opacity", (n) => (connected.has(n.id) ? 1 : 0.3));
  }

  function onNodeClick(d) {
    if (d.type === "param") {
      currentDetailParam = d.param;
      showParamDetail(d.param);
    } else {
      detailPanel.hidden = true;
      currentDetailParam = null;
    }
  }

  function showParamDetail(param) {
    const related = (param.relatedArticles || [])
      .map((url) => {
        const a = (pageData.articles || []).find((art) => art.url === url);
        const title = a ? a.title : url;
        return `<button class="bookmap-concept-tag bookmap-concept-tag--group" data-url="${url}">${title}</button>`;
      })
      .join("");
    const resonance = param.dost_resonance
      ? `<div class="detail-analogy">
          <p class="detail-analogy__label">${tt({ tr: "Dost'un dünyasından bir yankı", en: "An echo from Dost's world", pt: "Um eco do mundo de Dost" })}</p>
          <p>${tt(param.dost_resonance)}</p>
          ${param.dost_resonance.link ? `<button type="button" class="bookmap-concept-tag bookmap-concept-tag--group" data-nav-view="${param.dost_resonance.link.view}" data-nav-id="${param.dost_resonance.link.id}">${tt({ tr: "Dost'ta ilgili sayfaya git", en: "Go to the related page in Dost", pt: "Ir à página relacionada em Dost" })}</button>` : ""}
        </div>`
      : "";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Temel Parametre", en: "Core Parameter", pt: "Parâmetro Central" })}</p>
      <h2 class="detail-title">${tt(param.label)}</h2>
      <div class="detail-block detail-block--daphne">
        <p>${tt(param.note)}</p>
      </div>
      ${resonance}
      ${related ? `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlgili Yazılar", en: "Related Articles", pt: "Textos Relacionados" })}</p><div class="bookmap-concept-tags">${related}</div>` : ""}
    `;
    detailContent.querySelectorAll("[data-url]").forEach((btn) => {
      btn.addEventListener("click", () => window.open(btn.dataset.url, "_blank", "noopener"));
    });
    detailContent.querySelectorAll("[data-nav-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.open(`${btn.dataset.navView}/${btn.dataset.navId}/`, "_blank", "noopener");
      });
    });
    detailPanel.hidden = false;
  }

  // Bir yazının hangi ekseni neden beslediği + Dost'un hangi kavramına
  // dokunduğu (2026-08-03). Eskiden bir yazı ya "işlendi" ya "işlenmedi"
  // rozetiyle duruyordu ve İLİŞKİ hiçbir yerde görünmüyordu -- oysa bu
  // sayfanın bütün amacı o ilişki. Bağlar ELLE kuruldu ve her birinin
  // yanında gerekçesi var; türü de yazılı, çünkü bir örtüşme ile bir FARK
  // aynı şey değildir ve farkı örtüşme gibi göstermek yanlış olurdu.
  const BAG_TURU = {
    ortusme: { tr: "örtüşme", en: "overlap", pt: "sobreposição" },
    fark: { tr: "fark", en: "difference", pt: "diferença" },
    soru: { tr: "açık soru", en: "open question", pt: "pergunta aberta" },
  };
  const DOST_GORUNUM = {
    ontoloji: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
    terimler: { tr: "Terimler", en: "Terms", pt: "Termos" },
    esma: { tr: "Esmâ", en: "The Names", pt: "Os Nomes" },
    hal: { tr: "Hâller", en: "States", pt: "Estados" },
    sirlar: { tr: "Sırlar", en: "Mysteries", pt: "Mistérios" },
    sorular: { tr: "Sorular", en: "Questions", pt: "Perguntas" },
  };

  function eksenlerHtml(a, data) {
    if (!a.eksenler || !a.eksenler.length) return "";
    const adi = (id) => {
      const p = (data.core_parameters || []).find((x) => x.id === id);
      return p ? tt(p.label) : id;
    };
    const rows = a.eksenler.map((e) => `<li class="daphne-bag">
      <span class="daphne-bag__ad">${adi(e.id)}</span>
      <span class="daphne-bag__neden">${tt(e.neden)}</span></li>`).join("");
    return `<div class="daphne-baglar">
      <p class="daphne-baglar__baslik">${tt({
        tr: "Bu yazı hangi ekseni besliyor", en: "Which axes this essay feeds",
        pt: "Quais eixos este ensaio alimenta" })}</p>
      <ul class="daphne-bag-liste">${rows}</ul></div>`;
  }

  // "Bu yazıyı okuduktan sonra doğal olarak akla gelen sorular." Cevap
  // vermiyor; okuyucuyu bir sonraki durağa doğru itiyor. Renk anahtarı:
  // ortusme/fark/soru gibi bir tür değil, tek bir bölüm -- açık bir
  // yönelim rengiyle (kemal) çerçeveleniyor, çünkü hepsi birer açık soru.
  function sorularHtml(a) {
    if (!a.sorular || !a.sorular.length) return "";
    const rows = a.sorular.map((s, i) => `<li class="daphne-soru">
      <span class="daphne-soru__no">${i + 1}</span>
      <span class="daphne-soru__metin">${tt(s)}</span></li>`).join("");
    return `<div class="daphne-baglar daphne-baglar--sorular">
      <p class="daphne-baglar__baslik">${tt({
        tr: "Okurken açılan sorular",
        en: "Questions this reading opens",
        pt: "Perguntas que esta leitura abre" })}</p>
      <p class="daphne-baglar__not">${tt({
        tr: "Cevap değil; ilerlemek istersen kendine sorabileceğin şeyler. Doğru cevabı biz de bilmiyoruz.",
        en: "Not answers; things you can ask yourself if you want to keep going. We do not know the right answer either.",
        pt: "Não respostas; coisas que você pode se perguntar se quiser prosseguir. Também não sabemos a resposta certa." })}</p>
      <ol class="daphne-soru-liste">${rows}</ol></div>`;
  }

  function dostHtml(a) {
    if (!a.dost || !a.dost.length) return "";
    const base = window.__dostRouteBase || "";
    const rows = a.dost.map((b) => {
      const gorunum = DOST_GORUNUM[b.view] ? tt(DOST_GORUNUM[b.view]) : b.view;
      const tur = BAG_TURU[b.tur] ? tt(BAG_TURU[b.tur]) : "";
      return `<li class="daphne-bag daphne-bag--dost daphne-bag--${b.tur || "ortusme"}">
        <a class="daphne-bag__ad" href="${base}/${b.view}/${b.id}">${gorunum} › ${b.id}</a>
        ${tur ? `<span class="daphne-bag__tur">${tur}</span>` : ""}
        <span class="daphne-bag__neden">${tt(b.neden)}</span></li>`;
    }).join("");
    return `<div class="daphne-baglar daphne-baglar--dost">
      <p class="daphne-baglar__baslik">${tt({
        tr: "Dost'un hangi kavramına dokunuyor",
        en: "Which of the Friend's concepts it touches",
        pt: "Quais conceitos do Amigo ele toca" })}</p>
      <p class="daphne-baglar__not">${tt({
        tr: "Bu bağları biz kurduk. Bir örtüşme ile bir fark aynı şey değil; farkı örtüşme gibi göstermemek için türünü de yazıyoruz.",
        en: "We made these links ourselves. An overlap and a difference are not the same thing; we name the kind so a difference is not shown as agreement.",
        pt: "Fizemos estes vínculos nós mesmos. Uma sobreposição e uma diferença não são a mesma coisa; nomeamos o tipo para que uma diferença não seja mostrada como concordância." })}</p>
      <ul class="daphne-bag-liste">${rows}</ul></div>`;
  }

  // Okuma görünümünün veri kaynağı: kartlar tarihe göre sıralı çiziliyor,
  // düğmedeki data-okuma o SIRALANMIŞ dizideki indeks. İkisi tek yerde
  // tutuluyor ki sıralama değişirse bağ kopmasın.
  let siraliYazilar = [];

  function renderArticles(data) {
    if (!articlesList) return;
    siraliYazilar = data.articles
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    articlesList.innerHTML = siraliYazilar
      .map((a, i) => {
        // "İşlendi" rozeti not_tr'nin VARLIĞINA değil, kartta gerçekten
        // gösterilecek bir şey olup olmadığına bakmalı (2026-08-04 kullanıcı
        // bildirimi: "profile işlendi" görünen bazı yazıların detayı yoktu).
        const eksenSayisi = (a.eksenler || []).length;
        const dostSayisi = (a.dost || []).length;
        const soruSayisi = (a.sorular || []).length;
        const islendi = !!(a.ozet || eksenSayisi || dostSayisi);
        // Kartın kalınlığı (--derinlik) Dost bağı sayısıyla değişiyor:
        // 4+ = derin (dolu şerit), 2-3 = orta, 0-1 = ince, işlenmemiş = boş.
        // Bu bir "puan" değil, kartların birbirine bir bakışta ayrılması
        // için görsel bir dokunuş.
        let derinlik = "yok";
        if (dostSayisi >= 4) derinlik = "derin";
        else if (dostSayisi >= 2) derinlik = "orta";
        else if (islendi) derinlik = "hafif";
        const status = !islendi
          ? `<span class="daphne-profile-card__status daphne-profile-card__status--pending">${tt({ tr: "Henüz işlenmedi", en: "Not yet processed", pt: "Ainda não processado" })}</span>`
          : `<span class="daphne-profile-card__status daphne-profile-card__status--done">${tt({ tr: "Profile işlendi", en: "Worked into profile", pt: "Incorporado ao perfil" })}</span>`;
        // Kısa rozetler kartın kapalı hâlinde de görünsün: kaç eksen, kaç
        // Dost bağı, kaç soru. Böylece detay açmadan kartın "yoğunluğu"
        // anlaşılıyor.
        const rozetler = islendi
          ? `<span class="daphne-rozet-satiri">
              ${eksenSayisi ? `<span class="daphne-rozet daphne-rozet--eksen" title="${tt({ tr: "eksen", en: "axes", pt: "eixos" })}">${eksenSayisi} ${tt({ tr: "eksen", en: "axes", pt: "eixos" })}</span>` : ""}
              ${dostSayisi ? `<span class="daphne-rozet daphne-rozet--dost" title="${tt({ tr: "Dost bağı", en: "Dost link", pt: "vínculo com Dost" })}">${dostSayisi} ${tt({ tr: "Dost bağı", en: "Dost link", pt: "vínculo Dost" })}</span>` : ""}
              ${soruSayisi ? `<span class="daphne-rozet daphne-rozet--soru" title="${tt({ tr: "açık soru", en: "open questions", pt: "perguntas abertas" })}">${soruSayisi} ${tt({ tr: "soru", en: "questions", pt: "perguntas" })}</span>` : ""}
            </span>`
          : "";
        const note = a.note_tr ? `<p class="daphne-profile-card__note">${tt({ tr: a.note_tr, en: a.note_en, pt: a.note_pt })}</p>` : "";
        const ozet = a.ozet ? `<p class="daphne-profile-card__note">${tt(a.ozet)}</p>` : "";
        const tarih = a.date ? `<span class="daphne-profile-card__tarih">${a.date}</span>` : "";
        // 2026-08-28 (kullanıcı isteği): kart artık yerinde açılan bir
        // <details> değil, TAM SAYFA bir okumaya açılıyor. Sebebi ölçülür:
        // işlenmiş bir kartın içeriği üç dilde özet + 3-4 eksen + 3-4 Dost
        // bağı + 2-3 soru, yani 260 pikselik bir ızgara hücresinde
        // okunacak bir metin değil. Açıldığında ızgarayı da itip
        // kaydırıyordu.
        //
        // ETKILESIM_DILI'nin beşinci fiili ("seçmek: tek anlamı, o şeyin
        // paneli açılır") ve üçüncüsü ("bir adım geri: Esc") burada
        // birebir uygulanıyor: tıklama okumayı açar, Esc kapatır --
        // registerStepBack üzerinden, yani Esc sırası bozulmadan. Ayrıca
        // görünür bir "Geri" düğmesi var (dokunmatikte Esc yok).
        //
        // <details>'in verdiği klavye/ekran okuyucu erişimi kaybolmasın
        // diye açıcı gerçek bir <button>: Enter/Space zaten çalışıyor,
        // aria-haspopup="dialog" da ne açılacağını söylüyor.
        return `<article class="daphne-profile-card daphne-profile-card--${derinlik}">
          <button class="daphne-profile-card__ac" type="button" data-okuma="${i}"
                  aria-haspopup="dialog"${islendi ? "" : ' data-bos="1"'}>
            <span class="daphne-profile-card__title">${a.title}</span>
            <span class="daphne-profile-card__meta">${tarih}${status}${rozetler}</span>
          </button>
          <a class="daphne-profile-card__link daphne-profile-card__kaynak" href="${a.url}"
             target="_blank" rel="noopener">${tt({ tr: "kaynağı aç", en: "open source", pt: "abrir a fonte" })} ↗</a>
        </article>`;
      })
      .join("");
  }

  function drag(sim) {
    return window.DostGraphUtils.createDragBehavior(sim, (d) => d.type === "hub");
  }

  // --- Tam sayfa okuma ---------------------------------------------------
  //
  // Kartın içeriği ızgara hücresinde değil, kendi sayfasında okunuyor.
  // Kapanış üç yoldan: Esc (registerStepBack sırasına takılı), görünür
  // "Geri" düğmesi, ve zeminin kendisine tıklama.
  //
  // Odak yönetimi: açılırken odak okumanın başına gider, kapanırken
  // GELİNEN KARTA döner -- klavyeyle gezen biri listede yerini
  // kaybetmesin. Sekme dolaşımı okumanın içinde tutuluyor (odak tuzağı),
  // çünkü arkadaki ızgara hâlâ DOM'da.
  let okuma = null;
  let okumaAcanOge = null;

  function okumaKur() {
    if (okuma) return okuma;
    okuma = document.createElement("div");
    okuma.className = "daphne-okuma";
    okuma.id = "daphne-okuma";
    okuma.hidden = true;
    okuma.setAttribute("role", "dialog");
    okuma.setAttribute("aria-modal", "true");
    okuma.setAttribute("aria-labelledby", "daphne-okuma-baslik");
    document.body.appendChild(okuma);
    okuma.addEventListener("click", (e) => {
      if (e.target === okuma || e.target.closest(".daphne-okuma__kapat")) okumaKapat();
    });
    okuma.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const odaklanabilir = okuma.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])');
      if (!odaklanabilir.length) return;
      const ilk = odaklanabilir[0];
      const son = odaklanabilir[odaklanabilir.length - 1];
      if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
      else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
    });
    return okuma;
  }

  function okumaAc(i, acanOge) {
    const a = siraliYazilar[i];
    if (!a || !pageData) return;
    const el = okumaKur();
    okumaAcanOge = acanOge || null;
    const islendi = !!(a.ozet || (a.eksenler || []).length || (a.dost || []).length);
    const note = a.note_tr ? `<p class="daphne-profile-card__note">${tt({ tr: a.note_tr, en: a.note_en, pt: a.note_pt })}</p>` : "";
    const ozet = a.ozet ? `<p class="daphne-okuma__ozet">${tt(a.ozet)}</p>` : "";
    const bos = islendi ? "" : `<p class="daphne-okuma__bos">${tt({
      tr: "Bu yazı korpüste var ama henüz profile işlenmedi. Kaynağı açıp okuyabilirsin.",
      en: "This piece is in the corpus but has not yet been worked into the profile. You can open the source and read it.",
      pt: "Este texto está no corpus mas ainda não foi incorporado ao perfil. Pode abrir a fonte e lê-lo." })}</p>`;
    el.innerHTML = `
      <div class="daphne-okuma__ic">
        <div class="daphne-okuma__ust">
          <button class="daphne-okuma__kapat" type="button">← ${tt({ tr: "Geri", en: "Back", pt: "Voltar" })}</button>
          <a class="daphne-okuma__kaynak" href="${a.url}" target="_blank" rel="noopener">${tt({ tr: "kaynağı aç", en: "open source", pt: "abrir a fonte" })} ↗</a>
        </div>
        <article class="daphne-okuma__govde">
          <h2 class="daphne-okuma__baslik" id="daphne-okuma-baslik">${a.title}</h2>
          ${a.date ? `<p class="daphne-okuma__tarih">${a.date}</p>` : ""}
          ${note}${ozet}${bos}
          ${eksenlerHtml(a, pageData)}${dostHtml(a)}${sorularHtml(a)}
        </article>
      </div>`;
    el.hidden = false;
    document.body.classList.add("daphne-okuma-acik");
    const kapat = el.querySelector(".daphne-okuma__kapat");
    if (kapat) kapat.focus();
  }

  function okumaKapat() {
    if (!okuma || okuma.hidden) return false;
    okuma.hidden = true;
    document.body.classList.remove("daphne-okuma-acik");
    if (okumaAcanOge && document.contains(okumaAcanOge)) okumaAcanOge.focus();
    okumaAcanOge = null;
    return true;
  }

  if (articlesList) {
    articlesList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-okuma]");
      if (!btn) return;
      okumaAc(Number(btn.getAttribute("data-okuma")), btn);
    });
  }
  // Esc: YAKALAMA (capture) evresinde dinleniyor, çünkü compare.js'in
  // kendi Esc dinleyicisi kabarma evresinde ve detay paneli kapalıysa
  // doğrudan `location.href = "index.html"` diyor -- yani okuma açıkken
  // Esc'e basmak siteden çıkıyordu (ölçüldü: sayfa index.html'e gitti).
  // Yakalama evresi kabarmadan önce çalışır; okuma açıksa kapatıp
  // yayılmayı burada durduruyoruz.
  //
  // Sonuç, ETKILESIM_DILI'nin istediği sıra: önce okuma kapanır, sonra
  // (bir daha basılırsa) detay paneli, sonra sayfadan çıkış.
  window.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (okumaKapat()) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
})();
