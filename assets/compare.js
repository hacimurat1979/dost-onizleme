(function () {
  "use strict";

  const I18n = window.DostI18n;

  const svg = d3.select("#graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)

  I18n.applyStatic();
  // Dil değişince İKİ graf da yeniden çizilmeli: Daphne profili artık ayrı
  // bir sayfa değil, bu sayfanın bir sekmesi (2026-07-27).
  I18n.renderLangSwitcher(document.getElementById("lang-switch"), () => {
    render();
    if (window.__dostDaphneProfileApp) window.__dostDaphneProfileApp.render();
    if (window.__dostDaphneBaglarApp) window.__dostDaphneBaglarApp.render();
  });
  window.DostGraphUtils.setupLegendToggles();
  window.DostGraphUtils.setupDetailPanelFocus();

  // Sekmeler. "Daphne'nin Profili" ile "Taranan Yazılar" 2026-07-27'ye
  // kadar ayrı bir sayfaydı (daphne-profil.html, "understand" yazınca
  // açılıyordu); o sayfa silindi, içeriği buraya sekme olarak taşındı.
  // Profil grafiği ilk kez sekmesi açıldığında kuruluyor -- bölüm
  // gizliyken svg genişliği 0 olur ve graf bozuk çıkar.
  (function wireTabs() {
    const tabButtons = document.querySelectorAll("#compare-tabs .bookmap-tab");
    if (!tabButtons.length) return;
    const tabPanels = document.querySelectorAll("[data-tab-panel]");
    const introThemes = document.getElementById("intro-text");
    const introProfile = document.getElementById("intro-text-profile");
    const introBaglar = document.getElementById("intro-text-baglar");
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        tabButtons.forEach((b) => {
          b.classList.toggle("bookmap-tab--active", b === btn);
          b.setAttribute("aria-selected", String(b === btn));
        });
        tabPanels.forEach((p) => { p.hidden = p.dataset.tabPanel !== tab; });
        if (introThemes) introThemes.hidden = tab !== "temalar";
        if (introProfile) introProfile.hidden = tab !== "profil";
        if (introBaglar) introBaglar.hidden = tab !== "baglar";
        detailPanel.hidden = true;
        if ((tab === "profil" || tab === "yazilar") && window.__dostDaphneProfileApp) {
          // double-RAF ensures panel has reflowed (clientWidth > 0) before buildGraph reads it
          requestAnimationFrame(() => requestAnimationFrame(() => {
            window.__dostDaphneProfileApp.activate();
          }));
        }
        if (tab === "baglar" && window.__dostDaphneBaglarApp) {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            window.__dostDaphneBaglarApp.activate();
          }));
        }
      });
    });
  })();

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

  // Esc: bir adım geri (ETKILESIM_DILI.md üçüncü fiil). Önce detay paneli,
  // o kapalıysa sayfadan çıkış.
  //
  // 2026-08-28'de bir kaçamak çözümle "düzeltilmişti": iki ayrı window
  // keydown dinleyicisi (biri yakalama evresinde durumu not ediyor, diğeri
  // kabarma evresinde karara bağlıyordu), çünkü graph-utils.js'in merkezî
  // Esc zinciri (registerStepBack) kendi belgesiz yan etkisiyle -- hiçbir
  // stepBack üstlenmezse zincir sonunda `#detail-panel`i sessizce kapatıyor
  // -- compare.js'in kendi mantığından ÖNCE devreye giriyordu ve panel
  // zaten kapanmış görünüyordu. 2026-09-12 taramasında bu iki dinleyici
  // kaldırılıp aynı davranış zincirin KENDİSİNE bir stepBack olarak
  // kaydedildi -- artık zamanlamaya bağlı bir bayrağa (escPanelAcikti)
  // gerek yok, sıra tek bir merkezi yerde tanımlı. wrapId burada `null`:
  // bu sayfanın dört sekmesi (temalar/profil/baglar/yazilar) ayrı
  // wrap'lara bölünmüş ve o an aktif olmayanı `hidden` -- sekme hangisi
  // olursa olsun Esc aynı anlama gelmeli, o yüzden görünürlük kapısına
  // bağlanmıyor (lightbox.js/graph-hint.js/durus-kontrol.js'teki aynı
  // desen: sayfa-genel bir davranış tek bir wrap'a hapsedilmez).
  window.DostGraphUtils.registerStepBack(null, () => {
    if (!detailPanel.hidden) {
      detailPanel.hidden = true;
      return true;
    }
    window.location.href = "index.html";
    return true;
  });

  // Touch devices have no Escape key. The tappable title below is the quiet
  // fallback, but it is invisible -- nothing tells you it can be tapped. The
  // header's back circle is the discoverable version of the same move.
  const headerBack = document.getElementById("header-back");
  if (headerBack) {
    headerBack.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  const headerTitle = document.querySelector(".app-header__title");
  if (headerTitle) {
    headerTitle.classList.add("app-header__title--clickable");
    headerTitle.style.cursor = "pointer";
    headerTitle.title = "Dost'a dön / Back to Dost / Voltar ao Dost";
    headerTitle.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  function loadData() {
    if (window.DostViewStatus) window.DostViewStatus.showLoading("compare-wrap");
    Promise.all([
      window.DostGraphUtils.fetchJson("data/themes.json"),
      window.DostGraphUtils.fetchJson("data/ibn-arabi/concepts.json"),
    ]).then(([themes, concepts]) => {
      const conceptById = new Map(concepts.map((c) => [c.id, c]));
      if (window.DostViewStatus) window.DostViewStatus.hide("compare-wrap");
      buildGraph(themes, conceptById);
    }).catch((err) => {
      console.error("Veri yüklenemedi / Failed to load data", err);
      if (window.DostViewStatus) window.DostViewStatus.showError("compare-wrap", loadData);
    });
  }
  loadData();

  let simulation, nodeSel, linkSel, labelSel, zoomBehavior, links;
  // Önceden window.__daphneApp idi. Hiçbir dosya dışarıdan okumuyordu
  // (grep ile doğrulandı) -- yalnız bu dosyanın kendi showThemeDetail'i
  // kullanıyordu, yani global'e hiç gerek yoktu; modül kapsamında bir
  // değişkene indirildi (2026-09-12 taraması).
  let daphneApp;

  function buildGraph(themes, conceptById) {
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;

    const usedConceptIds = Array.from(new Set(themes.map((th) => th.ibn_arabi_concept)));

    const nodes = [];
    links = [];

    nodes.push({ id: "hub-ibnarabi", type: "hub-ibnarabi", label: "İbn Arabî" });
    nodes.push({ id: "hub-daphne", type: "hub-daphne", label: "Daphne" });

    usedConceptIds.forEach((cid) => {
      const c = conceptById.get(cid);
      if (!c) return;
      nodes.push({ id: "concept-" + cid, type: "concept", concept: c });
      links.push({ source: "hub-ibnarabi", target: "concept-" + cid, kind: "ibnarabi" });
    });

    themes.forEach((th) => {
      // concepts.forEach yukarıda aynı korumayı yapıyor (bulunamayan concept
      // için düğüm eklemiyor) ama tema burada korumasızdı: concepts.json'da
      // olmayan bir ibn_arabi_concept'e işaret eden bir tema, var olmayan
      // "concept-<id>" düğümüne köprü kenarı açardı -- d3.forceLink bunu id
      // bulamayınca hata verir, simülasyon hiç kurulmaz (2026-09-12
      // taraması). Concept yoksa o temayı da eklemiyoruz.
      if (!conceptById.has(th.ibn_arabi_concept)) return;
      nodes.push({ id: "theme-" + th.id, type: "theme", theme: th });
      links.push({ source: "concept-" + th.ibn_arabi_concept, target: "theme-" + th.id, kind: "bridge" });
      links.push({ source: "theme-" + th.id, target: "hub-daphne", kind: "daphne" });
    });

    // Vesica piscis (2026-09-13): önceki kompozisyon iki hub'ı sabit bir x
    // sütununa (0.24/0.76), temaları da ortada tek başka bir sabit sütuna
    // (0.5) iğneliyordu -- dogrusal/eksen tabanlı bir yerleşim. Burada
    // hub'lar vesica piscis'in iki merkezi gibi düşünülüyor: her biri
    // kendi "alanının" (dairesinin) merkezi. Kavramlar (concept) yalnız
    // hub-ibnarabi'nin dairesinde bir yörüngede kalıyor -- özel/tekil alan.
    // Temalar (theme) ise HEM hub-ibnarabi'ye HEM hub-daphne'ye göre aynı
    // yarıçapta tutulmaya çalışılıyor; bu iki kısıt birden ancak iki
    // dairenin kesiştiği bölgede (vesica'nın "gözü") karşılanabildiği için
    // temalar kendiliğinden oraya toplanıyor -- "Daire ve merkez" ilkesinin
    // (CLAUDE.md) bu grafiğe uygulanışı, soyut ok ya da eşmerkezli statik
    // çember yok, yalnız kuvvet dengesi.
    const hubIbnX = width * 0.32;
    const hubDaphneX = width * 0.68;
    const hubY = height / 2;
    const hubDist = hubDaphneX - hubIbnX;
    // Klasik vesica piscis oranı, iki dairenin her biri diğerinin
    // merkezinden geçer (yarıçap = merkezler arası mesafe); grafik
    // dolup taşmasın diye 0.62 ile hafifçe daraltıldı -- yine de belirgin
    // bir kesişim ("göz") bırakacak kadar örtüşüyorlar.
    const vesicaR = hubDist * 0.62;
    // Kavramların yörünge yarıçapı: hub-ibnarabi dairesinin İÇİNDE ama
    // kesişime taşmayacak kadar dar (kesişimin en yakın sınırı ~0.38 *
    // hubDist noktasında başlıyor, 0.30 güvenli payla altında kalıyor).
    const conceptOrbitR = hubDist * 0.30;

    simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance((l) => (l.kind === "bridge" ? 90 : 110)).strength(0.35))
      .force("charge", d3.forceManyBody().strength(-420))
      // Hub'lar vesica'nın iki sabit merkezinde kalsın (sürüklenebilir
      // olma özelliği korunuyor: drag sırasında fx/fy devreye girip bu
      // kuvveti geçici olarak geçersiz kılıyor, bkz. graph-utils.js
      // createDragBehavior).
      .force("hubx", d3.forceX((d) => (d.type === "hub-ibnarabi" ? hubIbnX : hubDaphneX)).strength((d) => (d.type.startsWith("hub") ? 0.35 : 0)))
      .force("huby", d3.forceY(hubY).strength((d) => (d.type.startsWith("hub") ? 0.35 : 0)))
      // Concept: yalnız hub-ibnarabi'ye göre sabit yarıçap -- açı serbest,
      // birden çok concept birbirini charge/collide ile ittiği için
      // yörünge boyunca kendiliğinden dağılıyor (dairesel "yörünge").
      .force("orbit-concept", d3.forceRadial(conceptOrbitR, hubIbnX, hubY).strength((d) => (d.type === "concept" ? 0.5 : 0)))
      // Theme: hem hub-ibnarabi hem hub-daphne'den aynı vesicaR uzaklıkta
      // tutulmaya çalışılan iki yumuşak kuvvet -- ikisi birden ancak iki
      // dairenin kesiştiği bölgede dengeye gelebiliyor.
      .force("orbit-theme-ibn", d3.forceRadial(vesicaR, hubIbnX, hubY).strength((d) => (d.type === "theme" ? 0.2 : 0)))
      .force("orbit-theme-daphne", d3.forceRadial(vesicaR, hubDaphneX, hubY).strength((d) => (d.type === "theme" ? 0.2 : 0)))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + 46));

    nodes.forEach((d) => {
      if (d.type === "hub-ibnarabi") { d.x = hubIbnX; d.y = hubY; }
      if (d.type === "hub-daphne") { d.x = hubDaphneX; d.y = hubY; }
      if (d.type === "concept") {
        // Başlangıçta da kendi yörüngesinin üstünde (rastgele açı) --
        // d3'ün varsayılan spiral başlangıcı yerine, sahne ilk kareden
        // itibaren zaten dairesel görünsün.
        const a = Math.random() * Math.PI * 2;
        d.x = hubIbnX + Math.cos(a) * conceptOrbitR;
        d.y = hubY + Math.sin(a) * conceptOrbitR;
      }
      if (d.type === "theme") {
        // Kesişim bölgesinin ortasına yakın bir başlangıç -- simülasyon
        // oraya zaten yakın başlayınca daha az sıçrayarak yerleşiyor.
        const midX = (hubIbnX + hubDaphneX) / 2;
        d.x = midX + (Math.random() - 0.5) * hubDist * 0.2;
        d.y = hubY + (Math.random() - 0.5) * hubDist * 0.5;
      }
    });

    // Siteki diğer 12 grafik görünümünün hepsi yakınlaştırma/geri-merkezleme
    // taşırken bu ikisi (Ortak Temalar + Daphne'nin Profili) hiç taşımıyordu
    // -- yoğun bir kümede etiketler okunamıyor, ve okumak için yakınlaşmanın
    // hiçbir yolu yoktu (UI denetimi bulgusu, ETKILESIM_DILI.md'nin "bir
    // hareket her yerde aynı anlam taşır" ilkesiyle çelişiyordu).
    const zoomLayer = svg.append("g").attr("class", "compare-zoom-layer");
    linkSel = zoomLayer
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link");

    const nodeGroup = zoomLayer.append("g").attr("class", "nodes");

    nodeSel = nodeGroup
      .selectAll("g.node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
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

    nodeSel
      .append("circle")
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    labelSel = nodeSel
      .append("text")
      .attr("class", (d) => (d.type.startsWith("hub") ? "node-label node-label--hub" : "node-label"))
      .attr("dy", (d) => radiusFor(d) + 12)
      .attr("text-anchor", "middle")
      .text((d) => labelFor(d));

    // H-09 / Çatışma-1 kararı (uzman paneli denetimi 2026-08-17): bu graf,
    // sitenin merkezi etiket-çakışma çözücüsünden muaf tek kalanlardandı --
    // iki merkez + onlarca tema düğümünde etiketler üst üste binebiliyordu.
    // Desen ontology.js'in pend dizisiyle aynı; baseY=0 çünkü etiketin
    // dikey ofseti zaten dy özniteliğinde, deconflict yalnız EK kaymayı
    // y'ye yazıyor.
    const deconflictLabels = window.DostGraphUtils.createLabelDeconflictor();

    function etiketleriYerlestir() {
      const pend = [];
      labelSel.each(function (d) {
        pend.push({
          lbl: d3.select(this), txt: labelFor(d),
          x: d.x, y: d.y + radiusFor(d) + 12, baseY: 0,
          priority: d.type.startsWith("hub") ? 1 : 0,
        });
      });
      // Engeller: düğüm dairelerinin kendisi (ontology.js'teki aynı ders --
      // yalnız yazı-yazı çakışmasına bakmak, yazıyı komşu dairenin üstüne
      // oturtabiliyor).
      const engeller = nodes.map((d) => ({ x: d.x, y: d.y, half: radiusFor(d) + 3, h: radiusFor(d) * 2 + 6 }));
      deconflictLabels(pend, engeller);
    }

    simulation.on("tick", () => {
      linkSel
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
      etiketleriYerlestir();
    });
    // Simülasyonun İLK karelerinde getBBox metin daha boyanmadan 0 genişlik
    // döndürebiliyor (ölçüldü: üç etiket aynı satırda donmuş kalmıştı) --
    // sahne durulunca, fontlar da yüklüyken, SON bir tam yerleşim geçişi.
    simulation.on("end", () => {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(etiketleriYerlestir);
      else etiketleriYerlestir();
    });

    zoomBehavior = window.DostGraphUtils.createZoomBehavior(svg, zoomLayer, [0.4, 3]);
    window.DostGraphUtils.wireRecenter("compare-recenter", () => {
      const sel = svg.transition().duration(420);
      sel.call(zoomBehavior.transform, d3.zoomIdentity);
    });

    daphneApp = { nodes, links, conceptById, themes };
  }

  function render() {
    if (!labelSel) return;
    labelSel.text((d) => labelFor(d));
    // Görünen etiketle birlikte ekran okuyucunun okuduğu ad da güncellenmeli
    // -- yalnız labelSel.text() güncellenirse dil değişiminden sonra
    // aria-label eski dilde donuk kalıyordu (2026-09-12 taraması).
    nodeSel.attr("aria-label", (d) => labelFor(d));
    if (currentDetailTheme) showThemeDetail(currentDetailTheme);
    else if (currentDetailConcept) showConceptDetail(currentDetailConcept);
  }

  function radiusFor(d) {
    if (d.type === "hub-ibnarabi" || d.type === "hub-daphne") return 26;
    if (d.type === "theme") return 14;
    return 10;
  }

  function colorFor(d) {
    if (d.type === "hub-ibnarabi") return getVar("--series-ibnarabi");
    if (d.type === "hub-daphne") return getVar("--series-daphne");
    if (d.type === "theme") return getVar("--series-theme");
    // Concept düğümleri lejantta "İbn Arabî kavramları" olarak --series-ibnarabi
    // rengiyle vaat ediliyor (legend__dot--ibnarabi); burası önceden çizgi
    // rengini (--series-ibnarabi-line, çok açık bir mavi) kullanıyordu -- hem
    // lejantla uyuşmuyordu hem zemine karşı WCAG'nin 3:1 grafik-nesnesi
    // eşiğinin altında kalıyordu. --series-ibnarabi-text, aynı renk ailesinin
    // kontrast için koyulaştırılmış hâli (2026-09-12 taraması).
    return getVar("--series-ibnarabi-text");
  }

  function getVar(name) {
    return window.DostGraphUtils.getVar(name);
  }

  function labelFor(d) {
    if (d.type === "hub-ibnarabi") return "İbn Arabî";
    if (d.type === "hub-daphne") return "Daphne";
    if (d.type === "theme") return I18n.pick(d.theme, "title");
    if (d.type === "concept") return I18n.pick(d.concept, "name");
    return "";
  }

  // Bir "tema" (Daphne tarafı) ya da "concept" (İbn Arabî tarafı) düğümüne
  // gelindiğinde, yalnız o düğümün bir komşusunu değil -- iki ana düğüme
  // (hub-ibnarabi, hub-daphne) kadar uzanan TÜM zinciri öne çıkarır. Zincir
  // her zaman iki ana düğümde son buluyor: kullanıcı isteği (2026-08-26)
  // "öne alınan bağlantının son noktası her seferinde her iki tarafın ana
  // düğümleri de olsun" -- yani hub-ibnarabi ve hub-daphne, ne kadar ara
  // düğüm (concept/tema) katılırsa katılsın, vurgulanan yolun uçları hep
  // sabit kalır. Bir concept'e birden çok tema bağlıysa hepsinin
  // hub-daphne'ye giden kolu birlikte öne çıkar (tek bir yol değil, o
  // concept'ten yayılan bütün yelpaze).
  function highlight(d) {
    if (!d) {
      linkSel.classed("link--highlight", false);
      nodeSel.style("opacity", 1);
      return;
    }
    const connectedNodes = new Set([d.id]);
    const connectedLinks = new Set();
    function add(l) {
      connectedLinks.add(l);
      connectedNodes.add(l.source.id);
      connectedNodes.add(l.target.id);
    }
    if (d.type === "theme") {
      const bridge = links.find((l) => l.kind === "bridge" && l.target.id === d.id);
      if (bridge) {
        add(bridge);
        const ibn = links.find((l) => l.kind === "ibnarabi" && l.target.id === bridge.source.id);
        if (ibn) add(ibn);
      }
      const daphne = links.find((l) => l.kind === "daphne" && l.source.id === d.id);
      if (daphne) add(daphne);
    } else if (d.type === "concept") {
      const ibn = links.find((l) => l.kind === "ibnarabi" && l.target.id === d.id);
      if (ibn) add(ibn);
      links.filter((l) => l.kind === "bridge" && l.source.id === d.id).forEach((bridge) => {
        add(bridge);
        const daphne = links.find((l) => l.kind === "daphne" && l.source.id === bridge.target.id);
        if (daphne) add(daphne);
      });
    } else {
      // Ana düğümler (hub-ibnarabi / hub-daphne): mevcut, tek-adımlık davranış
      // korunuyor -- bir hub'a gelince zaten kendi tarafındaki bütün doğrudan
      // komşuları öne çıkıyor.
      links.forEach((l) => {
        if (l.source.id === d.id || l.target.id === d.id) add(l);
      });
    }
    linkSel.classed("link--highlight", (l) => connectedLinks.has(l));
    nodeSel.style("opacity", (n) => (connectedNodes.has(n.id) ? 1 : 0.25));
  }

  let currentDetailTheme = null;
  let currentDetailConcept = null;

  function onNodeClick(d) {
    if (d.type === "theme") {
      currentDetailTheme = d.theme;
      currentDetailConcept = null;
      showThemeDetail(d.theme);
    } else if (d.type === "concept") {
      currentDetailTheme = null;
      currentDetailConcept = d.concept;
      showConceptDetail(d.concept);
    } else {
      detailPanel.hidden = true;
      currentDetailTheme = null;
      currentDetailConcept = null;
    }
  }

  function showThemeDetail(theme) {
    const concept = daphneApp.conceptById.get(theme.ibn_arabi_concept);
    const lang = I18n.getLang();
    const quote =
      lang === "pt" && theme.daphne_quote_pt
        ? theme.daphne_quote_pt
        : lang === "tr" && theme.daphne_quote_tr
          ? theme.daphne_quote_tr
          : theme.daphne_quote;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Ortak Tema", en: "Shared Theme", pt: "Tema Compartilhado" })}</p>
      <h2 class="detail-title">${I18n.pick(theme, "title")}</h2>

      <div class="detail-block detail-block--ibnarabi">
        <h3>İbn Arabî — ${concept ? I18n.pick(concept, "name") : ""}</h3>
        <p>${I18n.pick(theme, "ibn_arabi_note")}</p>
      </div>

      <div class="detail-block detail-block--daphne">
        <h3>Daphne</h3>
        <blockquote>&ldquo;${quote}&rdquo;</blockquote>
        <cite><a href="${theme.daphne_url}" target="_blank" rel="noopener">${theme.daphne_source}</a></cite>
      </div>

      <p class="detail-resonance">${I18n.pick(theme, "resonance")}</p>
    `;
    detailPanel.hidden = false;
  }

  function showConceptDetail(concept) {
    detailContent.innerHTML = `
      <p class="detail-eyebrow">İbn Arabî</p>
      <h2 class="detail-title">${I18n.pick(concept, "name")}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <p>${I18n.pick(concept, "summary")}</p>
        <cite>${(concept.sources || []).join(" · ")}</cite>
      </div>
    `;
    detailPanel.hidden = false;
  }

  function drag(sim) {
    return window.DostGraphUtils.createDragBehavior(sim);
  }
})();
