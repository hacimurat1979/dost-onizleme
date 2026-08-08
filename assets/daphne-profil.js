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

  function tt(dict) {
    return I18n.pick3(dict);
  }

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

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!detailPanel.hidden) {
      detailPanel.hidden = true;
    } else {
      window.location.href = "compare.html";
    }
  });

  // Touch devices have no Escape key. The tappable title below is the quiet
  // fallback, but it is invisible -- nothing tells you it can be tapped. The
  // header's back circle is the discoverable version of the same move.
  const headerBack = document.getElementById("header-back");
  if (headerBack) {
    headerBack.addEventListener("click", () => {
      window.location.href = "compare.html";
    });
  }

  const headerTitle = document.querySelector(".app-header__title");
  if (headerTitle) {
    headerTitle.classList.add("app-header__title--clickable");
    headerTitle.style.cursor = "pointer";
    headerTitle.title = "Geri dön / Go back / Voltar";
    headerTitle.addEventListener("click", () => {
      window.location.href = "compare.html";
    });
  }

  let pageData = null;
  let nodeSel, linkSel, labelSel, zoomBehavior;
  let currentDetailParam = null;

  function loadData() {
    if (window.DostViewStatus) window.DostViewStatus.showLoading("profile-wrap");
    window.DostGraphUtils.fetchJson("data/daphne-profile.json")
      .then((data) => {
        pageData = data;
        if (window.DostViewStatus) window.DostViewStatus.hide("profile-wrap");
        buildGraph(data);
        renderArticles(data);
      })
      .catch((err) => {
        console.error("Daphne profil verisi yüklenemedi / Failed to load Daphne profile data", err);
        if (window.DostViewStatus) window.DostViewStatus.showError("profile-wrap", loadData);
      });
  }
  // loadData() artık açılışta çağrılmıyor: bölüm gizliyken svg genişliği
  // 0 oluyor ve graf bozuk kuruluyor. Sekmesi ilk açıldığında çağrılıyor.
  let started = false;
  window.__dostDaphneProfileApp = {
    activate: function (retries) {
      if (started) return;
      // SVG genişliği henüz 0'sa (layout reflow bitmemiş) bir kare daha bekle.
      const s = svg.node();
      if (s && s.clientWidth === 0 && (retries || 0) < 12) {
        requestAnimationFrame(() => window.__dostDaphneProfileApp.activate((retries || 0) + 1));
        return;
      }
      started = true;
      loadData();
    },
    render: function () { if (started) render(); },
  };

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

    simulation.on("tick", () => {
      linkSel.attr("d", (d) => branchPath(d.source, d.target));
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
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

  function renderArticles(data) {
    if (!articlesList) return;
    articlesList.innerHTML = data.articles
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map((a) => {
        // "İşlendi" rozeti not_tr'nin VARLIĞINA değil, kartta gerçekten
        // gösterilecek bir şey olup olmadığına bakmalı (2026-08-04 kullanıcı
        // bildirimi: "profile işlendi" görünen bazı yazıların detayı yoktu).
        // Eski mantık (`!a.note_tr`) tam tersini yapıyordu: not_tr'si OLMAYAN
        // -- yani eksen/Dost bağı da özeti de olmayan, tamamen boş -- on beş
        // kayıt "İşlendi" görünüyordu; not_tr'sinde açıkça "henüz işlenmedi"
        // yazan sekiz kayıt ise (metne erişilemedi ya da örtüşme bulunamadı)
        // zaten doğru rozeti alıyordu, bu yüzden karışıklık asıl boş
        // kayıtlardaydı.
        const islendi = !!(a.ozet || (a.eksenler && a.eksenler.length) || (a.dost && a.dost.length));
        const status = !islendi
          ? `<span class="daphne-profile-card__status daphne-profile-card__status--pending">${tt({ tr: "Henüz işlenmedi", en: "Not yet processed", pt: "Ainda não processado" })}</span>`
          : `<span class="daphne-profile-card__status daphne-profile-card__status--done">${tt({ tr: "Profile işlendi", en: "Worked into profile", pt: "Incorporado ao perfil" })}</span>`;
        const note = a.note_tr ? `<p class="daphne-profile-card__note">${tt({ tr: a.note_tr, en: a.note_en, pt: a.note_pt })}</p>` : "";
        const ozet = a.ozet ? `<p class="daphne-profile-card__note">${tt(a.ozet)}</p>` : "";
        const tarih = a.date ? `<span class="daphne-profile-card__tarih">${a.date}</span>` : "";
        // Kart artık bir <a> değil: içinde başka bağlantılar var (eksenler,
        // Dost kavramları) ve iç içe bağlantı hem geçersiz HTML hem
        // erişilebilirlik hatasıdır.
        return `<article class="daphne-profile-card">
          <a class="daphne-profile-card__link" href="${a.url}" target="_blank" rel="noopener">
            <span class="daphne-profile-card__title">${a.title}</span></a>
          ${tarih}${status}${note}${ozet}
          ${eksenlerHtml(a, data)}${dostHtml(a)}
        </article>`;
      })
      .join("");
  }

  function drag(sim) {
    return window.DostGraphUtils.createDragBehavior(sim, (d) => d.type === "hub");
  }
})();
