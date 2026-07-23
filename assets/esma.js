(function () {
  "use strict";

  const I18n = window.DostI18n;
  const svg = d3.select("#esma-graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const tooltip = document.getElementById("esma-tooltip");
  const wrapEl = document.getElementById("esma-wrap");

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
  }

  // İki ismin/kutbun ilişkisini tek bakışta gösteren küçük SVG şemalar
  // (bkz. CLAUDE.md ikinci ilke — mümkün olan her yerde çizim kullan).
  const relationDiagramRenderers = {
    nested: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 260 190" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node--accent" cx="130" cy="100" r="78"/>
        <text class="term-diagram-label" x="130" y="34" text-anchor="middle">${tt(d.outer)}</text>
        <circle class="term-diagram-node--dashed" cx="130" cy="112" r="34"/>
        <text class="term-diagram-label term-diagram-label--small" x="130" y="117" text-anchor="middle">${tt(d.inner)}</text>
      </svg>
    `,
    "split-disc": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 240 160" role="img" aria-label="${tt(d.note)}">
        <path class="term-diagram-node--accent" d="M120,20 A70,70 0 0,0 120,160 Z"/>
        <path class="term-diagram-node--dashed" d="M120,20 A70,70 0 0,1 120,160 Z"/>
        <text class="term-diagram-label" x="88" y="94" text-anchor="middle">${tt(d.left)}</text>
        <text class="term-diagram-label" x="152" y="94" text-anchor="middle">${tt(d.right)}</text>
      </svg>
    `,
  };

  function relationDiagramHtml(r) {
    const renderer = r.diagram && relationDiagramRenderers[r.diagram.type];
    if (!renderer) return "";
    return `<div class="term-diagram-row"><div class="term-diagram-card">
      ${renderer(r.diagram)}
      <p class="term-diagram-caption">${tt(r.diagram.note)}</p>
    </div></div>`;
  }

  let esmaData = null;
  let esmaDataPromise = null;
  let built = false;
  let root = null;
  let zatDatum = null;
  let zoomLayer, linkGroup, relationGroup, nodeGroup, ringGroup, boundaryGroup, zatGroup;
  let zoomBehavior;
  let nodeById = new Map();
  let currentDetailNode = null;
  let currentDetailRelation = null;
  let currentDetailIsZat = false;
  let lastBoundaryRadius = 0;
  let focusedNode = null;
  let detailHistory = [];
  let suppressHistoryPush = false;

  // "Varlığın zuhuru" -- haritanın ilk açılışında her şey aynı anda değil,
  // Zât'tan Allah'a, oradan halka halka isimlere, en son da aralarındaki
  // ilişkilere doğru sırayla belirsin istiyoruz (bkz. kullanıcının onayladığı
  // öneri #9). Bu bayrak yalnızca İLK build'de true olur; sonraki her
  // toggle/focus güncellemesi normal, gecikmesiz geçişini korur.
  //
  // İlk sürümdeki tempo (~2.3sn, 260ms'lik adımlar) kullanıcıya göre sitenin
  // sakin, tefekküre açık havasına göre fazla hızlı geldi -- her katmanın
  // kendi başına "yerleşmesi" için daha uzun soluklu, yavaş bir tempoya
  // (~5.5sn, 700-950ms'lik adımlar ve geçişler) çevirdik.
  let firstReveal = true;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const REVEAL_STEP = 700;
  const REVEAL_BASE = 950;
  const REVEAL_NODE_DURATION = 900;
  const REVEAL_ZAT_DURATION = 1100;
  const REVEAL_RELATIONS_DURATION = 900;

  // Zât (haritanın çerçevesi) en önce, Allah (merkez) hemen ardından, sonra
  // halka halka dışa doğru -- derinlik arttıkça isimler de "türeyerek" ortaya
  // çıkıyor hissini verir. reduceMotion'da gecikme uygulanmaz.
  function revealDelayFor(depth) {
    if (reduceMotion || !firstReveal) return 0;
    return REVEAL_BASE + Math.min(depth || 0, 4) * REVEAL_STEP;
  }
  function revealNodeDuration() {
    return firstReveal && !reduceMotion ? REVEAL_NODE_DURATION : 300;
  }
  const REVEAL_RELATIONS_DELAY = REVEAL_BASE + 5 * REVEAL_STEP; // isimlerin en son katmanından sonra

  function fetchData() {
    if (esmaDataPromise) return esmaDataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("esma-wrap");
    esmaDataPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/esma.json")
      .then((data) => {
        esmaData = data;
        if (window.DostViewStatus) window.DostViewStatus.hide("esma-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Esmâ verisi yüklenemedi / Failed to load Esma data", err);
        esmaDataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("esma-wrap", () => window.__esmaApp.activate());
      });
    return esmaDataPromise;
  }

  // Zât ve Allah'ın çapı burada Ontoloji grafiğindeki Zât (dhat) düğümüyle
  // aynı RAW r değerini kullanmıyor -- bunu yapmak görsel eşitlik
  // SAĞLAMIYOR, çünkü bu iki grafiğin kendi otomatik-yakınlaştırma
  // ölçekleri farklı (pencere boyutuna ve içerik yoğunluğuna göre
  // değişebilir). Buradaki 111, iki grafikte ekrana çizilen GERÇEK piksel
  // boyutunu (getBoundingClientRect ile ölçülerek) eşitleyecek şekilde
  // ampirik olarak bulunmuş bir değerdir -- ring1'in (aşağıdaki update())
  // hesabı değiştikçe bu değer de yeniden ölçülüp ayarlanmalı.
  function radiusFor(d) {
    if (d.isZat) return 160;
    const depth = d.depth;
    if (depth === 0) return 160; // Allah -- the map's true center
    if (depth === 1) return 42;
    return Math.max(18, 30 - 3 * depth);
  }

  const LAYER_COLOR = window.DostGraphUtils.LAYER_COLOR;
  const LAYER_COLOR_DARK = window.DostGraphUtils.LAYER_COLOR_DARK;

  function isDark() {
    return window.DostGraphUtils.isDark();
  }

  function getVar(name) {
    return window.DostGraphUtils.getVar(name);
  }

  function colorFor(d) {
    // Same treatment as the ontology graph's "dhat" root node -- see
    // DostGraphUtils.ZAT_FILL for why.
    if (d.isZat) return window.DostGraphUtils.ZAT_FILL;
    // Allah -- the Name that gathers every Name in itself, emerging directly
    // from the Essence -- gets the site's own signature accent gold rather
    // than blending into the ordinary Kemal-pole tone shared by other names,
    // so it reads as distinct at a glance without competing with Zât's own
    // (white + glow) treatment.
    if (d.id === "allah") return getVar("--series-theme");
    const pole = d.data.pole;
    if (pole === "celal") return getVar("--series-celal");
    if (pole === "cemal") return getVar("--series-cemal");
    if (pole === "kemal") return getVar("--series-kemal");
    if (pole === "neutral") return getVar("--series-esma-neutral");
    const ramp = isDark() ? LAYER_COLOR_DARK : LAYER_COLOR;
    return ramp[Math.min(d.depth, ramp.length - 1)];
  }

  const POLE_LABEL = {
    celal: { tr: "Celâl", en: "Jalal", pt: "Jalal" },
    cemal: { tr: "Cemâl", en: "Jamal", pt: "Jamal" },
    kemal: { tr: "Kemâl", en: "Kamal", pt: "Kamal" },
    neutral: { tr: "Grup", en: "Group", pt: "Grupo" },
  };

  // İlişki-tipi taksonomisi (kullanıcının onayladığı öneri, 2026-07-21):
  // iki isim arasındaki bağın NE TÜRDEN bir bağ olduğunu (yalnızca "bir
  // ilişki var" değil) adlandırır. Dokuz tip -- sebep/sonuç tek bir yönlü
  // tipe (sebep) indirgeniyor, çünkü `from`/`to` alanları zaten yönü taşıyor
  // (from = sebep, to = sonuç). Her tip için `label` (lejant + detay
  // panelindeki rozet metni) ve `directional` (ok ucu gerekip gerekmediği,
  // bkz. RELATION_ARROW_TYPES) burada bir arada tutuluyor ki yeni bir tip
  // eklendiğinde tek bir yerden CSS sınıfı + lejant + rozet senkron kalsın.
  const RELATION_TYPE_META = {
    tecelli: { label: { tr: "Tecellî", en: "Self-disclosure", pt: "Autorrevelação" }, directional: true },
    "ayni-sinif": { label: { tr: "Aynı Sınıf", en: "Same Class", pt: "Mesma Classe" }, directional: false },
    zid: { label: { tr: "Zıt Kutup", en: "Opposite Pole", pt: "Polo Oposto" }, directional: false },
    sebep: { label: { tr: "Sebep — Sonuç", en: "Cause — Effect", pt: "Causa — Efeito" }, directional: true },
    parca: { label: { tr: "Parça — Bütün", en: "Part — Whole", pt: "Parte — Todo" }, directional: false },
    ayni: { label: { tr: "Aynıdır (Özdeş)", en: "Identical", pt: "Idêntico" }, directional: false },
    temsil: { label: { tr: "Temsil Eder", en: "Represents", pt: "Representa" }, directional: false },
    mertebe: { label: { tr: "Mertebe (Derece)", en: "Rank (Degree)", pt: "Grau (Posição)" }, directional: true },
    kapsar: { label: { tr: "Kapsar (İçerir)", en: "Contains", pt: "Contém" }, directional: true },
  };

  function relationTypeBadgeHtml(r) {
    const meta = RELATION_TYPE_META[r.type];
    if (!meta) return "";
    return `<span class="pole-badge pole-badge--relation pole-badge--relation-${r.type}">${tt(meta.label)}</span>`;
  }

  // Rozet, düğümün kendi (bazen açık tonlu -- örn. Kemâl altını) rengini
  // aynen kullanırsa beyaz metin bazı renklerde okunmuyordu; koyu metin
  // seçmek de başka renklerde okunurluğu bozuyordu (bkz. eski deneme,
  // git geçmişi). Kalıcı çözüm: rozetin arka planını (düğümün kendi
  // rengini, haritadaki hâliyle değiştirmeden) biraz koyulaştırıp metni
  // her zaman beyaz tutmak -- bu üç kutbun rengiyle de yeterli kontrastı
  // sağlıyor.
  function poleBadgeHtml(d) {
    if (d.isZat) return "";
    const label = POLE_LABEL[d.data.pole];
    if (!label) return "";
    const bg = colorFor(d);
    return `<span class="pole-badge" style="background:color-mix(in srgb, ${bg} 72%, black)">${I18n.pick3(label)}</span>`;
  }

  function labelFor(d) {
    const full = I18n.pick3(d.data.name);
    const idx = full.indexOf(" (");
    return idx === -1 ? full : full.slice(0, idx);
  }

  // Radial ("dairesel") düzen. İbn Arabî'nin kendi ifadesiyle (bkz. "allah"
  // düğümünün insight'ı): "Bütün isimler ... imam isimlere, imam isimler ...
  // Allah ismine ... Allah ismi ise ... zata yönelir." Yani isimler Allah'a,
  // Allah da Zât'a döner -- Zât ise (kendi özetinin dediği gibi) "her
  // isimlendirmenin ötesinde," isimler arasında bir isim değil. Bu yüzden
  // harita Allah'ı merkeze alır (Ism-i A'zam, bütün isimleri kendinde
  // toplayan İsim); Zât ise halkaların dışında, haritanın kendisini saran
  // bir çerçeve olarak durur -- kendi düğümü tepe noktasında, ayrı ve
  // tıklanabilir.
  let outerRadius = 320;

  function radialPoint(angle, radius) {
    const a = angle - Math.PI / 2;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  }

  // Tek çocuklu zincirler (örn. Rab→Hayy→Alim→Mürîd→...) dallanma olmadığı
  // için aynı açıda üst üste biner. Zincir boyunca hafif bir açısal kayma
  // ekleyerek düğümleri okunur bir spiral hâline getiriyoruz.
  function applySpiralOffset(node, inherited) {
    const siblingCount = node.parent ? node.parent.children.length : 1;
    const ownOffset = node.parent && siblingCount === 1 ? inherited + 0.16 : 0;
    node.x += ownOffset;
    (node.children || []).forEach((c) => applySpiralOffset(c, ownOffset));
  }

  // İlişki-tipi oku uçları. Yalnızca yönü anlamlı olan tipler (sebep,
  // tecelli, mertebe, kapsar) kendi ok rengiyle bir marker alır; simetrik tipler
  // (ayni, ayni-sinif, zid, parca, temsil) oksuz kalır -- bkz. RELATION_TYPE_META.
  const RELATION_ARROW_TYPES = ["sebep", "tecelli", "mertebe", "kapsar"];

  function buildGraph(data) {
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    RELATION_ARROW_TYPES.forEach((type) => {
      defs.append("marker")
        .attr("id", `esma-arrow-${type}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 9)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("class", `esma-arrowhead esma-arrowhead--${type}`);
    });

    // Zât is excluded from the tree itself and rendered separately (see
    // updateZatMarker) -- the ring system is rooted at "Allah" so it takes
    // the map's true center. Allah's own `parent` (originally "zat", used
    // when Zât WAS part of the tree) is cleared so stratify roots there.
    zatDatum = data.nodes.find((n) => n.id === "zat");
    const treeInput = data.nodes
      .filter((n) => n.id !== "zat")
      .map((n) => (n.id === "allah" ? Object.assign({}, n, { parent: undefined }) : n));

    root = d3.stratify()
      .id((d) => d.id)
      .parentId((d) => d.parent)(treeInput);

    nodeById = new Map();
    root.each((d) => nodeById.set(d.id, d));
    nodeById.set("zat", { id: "zat", data: zatDatum, isZat: true });

    root.x0 = 0;
    root.y0 = 0;

    zoomLayer = svg.append("g").attr("class", "esma-canvas");
    boundaryGroup = zoomLayer.append("g").attr("class", "esma-boundary-group");
    ringGroup = zoomLayer.append("g").attr("class", "esma-rings");
    relationGroup = zoomLayer.append("g").attr("class", "esma-relations");
    linkGroup = zoomLayer.append("g").attr("class", "esma-links");
    nodeGroup = zoomLayer.append("g").attr("class", "esma-nodes");
    zatGroup = zoomLayer.append("g").attr("class", "esma-zat-group");

    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");

    // Alt sınır 0.35'ten 0.18'e indirildi: derinlik 2 halkasındaki isim
    // sayısı artık pencereye değil veriye bağlı (bkz. update()'teki
    // minRing1ForSpacing) ve 74 isme çıktığında gereken sığdırma ölçeği
    // eski 0.35 tabanının altına düşüyor -- taban çok yüksek kalırsa
    // zoomToFit dairenin tamamını sığdıramayıp Zât'ı üstten kırpıyordu.
    zoomBehavior = window.DostGraphUtils.createZoomBehavior(svg, zoomLayer, [0.18, 5]);
    svg.on("click", () => { if (focusedNode) unfocusNode(true); });

    const recenterBtn = document.getElementById("esma-recenter");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", () => unfocusNode(true));
    }

    // Guarded on wrapEl.hidden (only the currently active view's own
    // #esma-wrap is unhidden) so this doesn't also fire while some other
    // view (Ontoloji, Hâller, ...) is the one on screen -- every view
    // module shares the same document, so an unguarded listener here
    // would react to Escape no matter which graph is actually visible.
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (wrapEl.hidden || detailPanel.hidden) return;
      if (!currentDetailNode && !currentDetailIsZat && !currentDetailRelation) return;
      goBackInHistory();
    });

    update(root, false);
    built = true;

    if (firstReveal && !reduceMotion) {
      const formingHint = document.getElementById("esma-forming-hint");
      if (formingHint) {
        // Belirir belirmez değil, Zât+boundary yerleştikten hemen sonra
        // görünsün (üstlerine binmesin); isimlerin son katmanı ortaya
        // çıktığında da ilişkiler henüz çizilmemişken sessizce solsun.
        setTimeout(() => formingHint.classList.add("esma-forming-hint--visible"), 300);
        setTimeout(() => formingHint.classList.remove("esma-forming-hint--visible"), REVEAL_RELATIONS_DELAY);
      }
      setTimeout(() => { firstReveal = false; }, REVEAL_RELATIONS_DELAY + REVEAL_RELATIONS_DURATION);
    } else {
      firstReveal = false;
    }
  }

  // While a cluster is focused, its own children need much more angular
  // room than the default layout gives every ring member -- otherwise
  // zooming in just enlarges the same cramped, overlapping arrangement.
  // Set right before treeLayout(root) runs in update(); the tree's total
  // angular budget is fixed, so this necessarily compresses everything
  // else, which is fine since the rest of the map is dimmed anyway.
  let focusSeparationIds = null;

  const treeLayout = d3.tree()
    .size([2 * Math.PI, 1])
    .separation((a, b) => {
      const base = (a.parent === b.parent ? 1.6 : 3.4) / Math.sqrt(a.depth || 1);
      if (a.parent === b.parent && focusSeparationIds && focusSeparationIds.has(a.parent.id)) {
        return base * 7;
      }
      return base;
    });

  function drawRings(ring1, ring2) {
    const rings = [ring1, ring2];
    const ringSel = ringGroup.selectAll("circle.esma-ring").data(rings, (d, i) => i);
    ringSel.exit().remove();
    ringSel.enter()
      .append("circle")
      .attr("class", "esma-ring")
      .merge(ringSel)
      .attr("r", (d) => d);
  }

  // Zât'ın kendi düğümü ağacın dışında olduğu için ayrı bir grup halinde
  // çizilir: haritayı saran, sabit (nefes almayan) bir çerçeve dairesi +
  // tepe noktasında (saat 12 yönü) kendi tıklanabilir işareti -- ontoloji
  // grafiğindeki "dhat" düğümüyle aynı görsel dil (beyaz daire + altın
  // nefes alan hale).
  function updateZatMarker(boundaryRadius) {
    lastBoundaryRadius = boundaryRadius;

    const boundaryIsNew = boundaryGroup.selectAll("circle.esma-boundary").empty();
    const boundary = boundaryGroup.selectAll("circle.esma-boundary").data([boundaryRadius]);
    const boundaryEnter = boundary.enter()
      .append("circle")
      .attr("class", "esma-boundary")
      .style("opacity", boundaryIsNew && !reduceMotion && firstReveal ? 0 : null);
    boundaryEnter.merge(boundary).attr("r", (d) => d);
    if (boundaryIsNew && !reduceMotion && firstReveal) {
      boundaryEnter.transition().delay(200).duration(REVEAL_ZAT_DURATION).style("opacity", 1);
    }

    const [zx, zy] = radialPoint(0, boundaryRadius);
    const zatWrapper = { data: zatDatum, isZat: true };

    const zatIsNew = zatGroup.selectAll("g.esma-zat-node").empty();
    const zatSel = zatGroup.selectAll("g.esma-zat-node").data([zatWrapper]);
    const zatEnter = zatSel.enter().append("g")
      .attr("class", "node esma-zat-node node--root")
      .style("opacity", zatIsNew && !reduceMotion && firstReveal ? 0 : null)
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", () => tt(zatDatum.name))
      .on("click", (event) => {
        event.stopPropagation();
        showZatDetail();
      })
      .on("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          showZatDetail();
        }
      })
      .on("mouseenter", (event) => { showTooltip(zatWrapper, event); })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => hideTooltip())
      .on("focus", (event) => { showTooltip(zatWrapper, event); })
      .on("blur", () => hideTooltip());

    zatEnter.append("circle").attr("class", "node-halo").attr("r", radiusFor(zatWrapper) * 1.4);
    zatEnter.append("circle").attr("fill", colorFor(zatWrapper)).attr("r", radiusFor(zatWrapper));
    zatEnter.append("circle").attr("class", "node-sheen").attr("r", radiusFor(zatWrapper));
    zatEnter.append("text")
      .attr("class", "node-label")
      .attr("text-anchor", "middle")
      .attr("transform", `translate(0,${radiusFor(zatWrapper) + 14})`)
      .text(() => {
        const full = tt(zatDatum.name);
        const idx = full.indexOf(" (");
        return idx === -1 ? full : full.slice(0, idx);
      });

    zatGroup.selectAll("g.esma-zat-node")
      .classed("node--active", currentDetailIsZat)
      .attr("transform", `translate(${zx},${zy})`);

    if (zatIsNew && !reduceMotion && firstReveal) {
      zatEnter.transition().delay(0).duration(REVEAL_ZAT_DURATION).style("opacity", 1);
    }
  }

  function zoomToBox(nodes, animate, margin, maxScaleCap) {
    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    nodes.forEach((d) => {
      const [cx, cy] = radialPoint(d.x, d.y);
      x0 = Math.min(x0, cx);
      x1 = Math.max(x1, cx);
      y0 = Math.min(y0, cy);
      y1 = Math.max(y1, cy);
    });
    const m = margin || { x0: 70, x1: 70, y0: 70, y1: 70 };
    x0 -= m.x0; x1 += m.x1; y0 -= m.y0; y1 += m.y1;
    const treeW = Math.max(1, x1 - x0);
    const treeH = Math.max(1, y1 - y0);
    const [minScale, maxScale] = zoomBehavior.scaleExtent();
    const cap = maxScaleCap || 1.3;
    const scale = Math.min(maxScale, cap, width / treeW, height / treeH);
    const clampedScale = Math.max(minScale, scale);
    const tx = width / 2 - clampedScale * (x0 + treeW / 2);
    const ty = height / 2 - clampedScale * (y0 + treeH / 2);
    const transform = d3.zoomIdentity.translate(tx, ty).scale(clampedScale);
    const sel = animate ? svg.transition().duration(400) : svg;
    sel.call(zoomBehavior.transform, transform);
  }

  function zoomToFit(animate) {
    // Zât's boundary frame + top marker enclose the whole map -- include
    // them so the fit never crops the frame itself.
    const nodes = root.descendants();
    if (lastBoundaryRadius) {
      nodes.push(
        { x: 0, y: lastBoundaryRadius + radiusFor({ isZat: true }) },
        { x: Math.PI, y: lastBoundaryRadius },
        { x: Math.PI / 2, y: lastBoundaryRadius },
        { x: -Math.PI / 2, y: lastBoundaryRadius }
      );
    }
    zoomToBox(nodes, animate);
  }

  function update(source, animate) {
    focusSeparationIds = focusedNode ? new Set(focusedNode.descendants().map((n) => n.id)) : null;
    treeLayout(root);
    applySpiralOffset(root, 0);
    const nodes = root.descendants();
    const links = root.links();

    const width = svg.node().clientWidth || 800;
    const height = svg.node().clientHeight || 600;
    outerRadius = Math.max(120, Math.min(width, height) / 2 - 40);

    // Two true rings, matching Ibn Arabi's own three-way classification of
    // the Names in the "allah" node's insight text (ring 1: the Names/
    // groups directly under Allah -- er-Rahmân, er-Rahîm, er-Rab, el-Velî,
    // and the Zâtî/Nispetî/Fiilî groupings; ring 2: the particular Names
    // nested under those). A single rare chain (Hayy -> Âlim -> Mürîd ->
    // Mütekellim -> Kâdir -> Cevâd -> Muksit) descends much deeper than
    // anything else in the tree -- rather than force several more
    // mostly-empty rings to fit it, it continues outward past ring 2 as its
    // own spiraling "sequence of derivation" tail (each Name in the chain
    // necessarily implying the next).
    // Ring 1'in payı sabit değil: el-Bülgâ/Yüz Mertebe grup düğümleri
    // kaldırılıp çocukları doğrudan allah'a bağlandığından (bkz. yukarıdaki
    // yorum) bu halkadaki isim sayısı pencereye göre değil, veriye göre
    // değişiyor (şu an 74) -- sabit bir oran, bu kadar çok ismi aynı
    // dairede sıkıştırıp üst üste bindirirdi. Bu yüzden ring1, ya pencere
    // oranını ya da o derinlikteki gerçek düğüm sayısının gerektirdiği asgari
    // çevre uzunluğunu (hangisi büyükse) kullanıyor; zoomToFit sahnenin
    // tamamını orantılı küçülttüğü için bu oran korunuyor, sıkışma geri
    // gelmiyor.
    const depth1Count = nodes.filter((d) => d.depth === 1).length;
    const minRing1ForSpacing = (depth1Count * (radiusFor({ depth: 1 }) * 2 + 14)) / (2 * Math.PI);
    const ring1 = Math.max(outerRadius * 0.42, minRing1ForSpacing);
    const ring2 = outerRadius * 0.74;
    const tailStep = outerRadius * 0.11;
    function radiusForDepth(depth) {
      if (depth <= 0) return 0;
      if (depth === 1) return ring1;
      if (depth === 2) return Math.max(ring2, ring1 + 60);
      return radiusForDepth(2) + (depth - 2) * tailStep;
    }
    nodes.forEach((d) => { d.y = radiusForDepth(d.depth); });
    // Deneme: ring1'deki 74 isim artık düz bir daire değil, hafif bir
    // "dalgalanma" (spiral hissi) ile duruyor -- komşu isimler dönüşümlü
    // olarak biraz içeri/dışarı kayıyor, bu da salt çevresel boşluğun
    // üzerine bir miktar RADYAL boşluk da ekliyor (aynı çevre uzunluğunda
    // daha az sıkışma hissi).
    nodes.forEach((d) => {
      if (d.depth === 1) d.y = ring1 * (1 + 0.12 * Math.sin(d.x * 9));
    });

    const maxDepth = Math.max(2, d3.max(nodes, (d) => d.depth));
    const boundaryRadius = Math.max(outerRadius * 1.1, radiusForDepth(maxDepth) + 50);

    drawRings(ring1, ring2);
    updateZatMarker(boundaryRadius);

    const nodeSet = new Set(nodes);
    const relations = (esmaData.relations || []).filter((r) => {
      const s = nodeById.get(r.from);
      const t = nodeById.get(r.to);
      return s && t && nodeSet.has(s) && nodeSet.has(t);
    });

    const linkGen = d3.linkRadial().angle((d) => d.x).radius((d) => d.y);

    // links
    const link = linkGroup.selectAll("path.esma-link").data(links, (d) => d.target.id);
    link.exit()
      .transition().duration(300)
      .attr("d", () => linkGen({ source: { x: source.x, y: source.y }, target: { x: source.x, y: source.y } }))
      .remove();
    // Bir bağın hedefinde linkEmphasis alanı varsa (bkz. data/ibn-arabi/esma.json
    // -- şu an yalnızca hayy->alim->murid->mutekellim->kadir zincirinde,
    // Kısım XVI'daki Dua Menzili pasajından: "Bu isme özgü hakikat, mertebe
    // bakımından altında bulunan ilahi isimleri içermiş olmaktır"), o bağ
    // sıradan bir soy-kütüğü çizgisi değil bir KAPSAMA ilişkisi olarak
    // vurgulanır -- ok ucuyla ve ayrı bir renkle, ama ayrı bir kenar EKLEMEDEN
    // (aynı iki düğüm zaten ağaç kenarıyla bağlı; ikinci bir path relationGroup
    // linkGroup'tan önce çizildiği için görünmez kalırdı).
    const emphasisClass = (d) => (d.target.data.linkEmphasis ? ` esma-link--${d.target.data.linkEmphasis}` : "");
    const emphasisMarker = (d) => (d.target.data.linkEmphasis ? `url(#esma-arrow-${d.target.data.linkEmphasis})` : null);
    const linkEnter = link.enter().append("path")
      .attr("class", (d) => "esma-link" + emphasisClass(d))
      .attr("marker-end", emphasisMarker)
      .attr("d", () => linkGen({ source: { x: source.x0, y: source.y0 }, target: { x: source.x0, y: source.y0 } }))
      .style("opacity", firstReveal && !reduceMotion ? 0 : null);
    linkEnter.merge(link)
      .attr("class", (d) => "esma-link" + emphasisClass(d))
      .attr("marker-end", emphasisMarker)
      .transition().duration(revealNodeDuration())
      .delay((d) => revealDelayFor(d.target.depth))
      .style("opacity", 1)
      .attr("d", linkGen);

    // cross-relations (dashed) — only drawn once both endpoints are visible,
    // and (on first reveal) only after every name has already appeared, so
    // the relations read as connections discovered between names already on
    // screen rather than arriving alongside them.
    const relSel = relationGroup.selectAll("path.esma-relation")
      .data(relations, (r) => `${r.from}->${r.to}`);
    relSel.exit().remove();
    const relEnter = relSel.enter().append("path")
      .attr("class", (r) => `esma-relation esma-relation--${r.type}`)
      .attr("marker-end", (r) => (RELATION_ARROW_TYPES.includes(r.type) ? `url(#esma-arrow-${r.type})` : null))
      .style("opacity", firstReveal && !reduceMotion ? 0 : null)
      .on("click", (event, r) => {
        event.stopPropagation();
        showRelationDetail(r);
      });
    relEnter.append("title").text((r) => I18n.pick3(r.label));
    relEnter.merge(relSel)
      .attr("d", (r) => linkGen({ source: nodeById.get(r.from), target: nodeById.get(r.to) }));
    relEnter.transition()
      .delay(firstReveal && !reduceMotion ? REVEAL_RELATIONS_DELAY : 0)
      .duration(firstReveal && !reduceMotion ? REVEAL_RELATIONS_DURATION : 400)
      .style("opacity", 1);
    relationGroup.selectAll("path.esma-relation title").text((r) => I18n.pick3(r.label));

    // nodes
    const node = nodeGroup.selectAll("g.esma-node").data(nodes, (d) => d.id);

    const nodeEnter = node.enter().append("g")
      .attr("class", "node esma-node")
      .attr("transform", () => `translate(${radialPoint(source.x0, source.y0).join(",")})`)
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d) => labelFor(d))
      .style("opacity", 0)
      .on("click", (event, d) => {
        event.stopPropagation();
        toggle(d);
      })
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          toggle(d);
        }
      })
      .on("mouseenter", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => { highlight(null); hideTooltip(); })
      .on("focus", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("blur", () => { highlight(null); hideTooltip(); });

    nodeEnter.append("circle")
      .attr("class", "node-halo")
      .attr("r", (d) => radiusFor(d) * 1.4);

    nodeEnter.append("circle")
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    nodeEnter.append("circle")
      .attr("class", "node-sheen")
      .attr("r", (d) => radiusFor(d));

    nodeEnter.append("text")
      .attr("class", "node-label")
      .attr("text-anchor", (d) => (d.depth === 0 ? "middle" : (d.x < Math.PI ? "start" : "end")))
      .attr("transform", (d) => {
        if (d.depth === 0) return `translate(0,${radiusFor(d) + 14})`;
        const deg = (d.x * 180 / Math.PI) - 90;
        const flip = d.x >= Math.PI;
        const offset = radiusFor(d) + 8;
        return `rotate(${deg}) translate(${offset},0) rotate(${flip ? 180 : 0})`;
      })
      .text((d) => labelFor(d));

    nodeEnter.append("text")
      .attr("class", "esma-expand-badge")
      .attr("dy", 4)
      .attr("text-anchor", "middle")
      .text((d) => (d._children ? "+" : ""));

    // Target opacity has to account for focus-dimming here, not just rely
    // on the .esma-node--dimmed CSS class -- this transition sets opacity
    // inline (needed for the enter fade-in), and an inline style always
    // wins over a class, so a flat "1" here would silently erase the
    // class's 0.12 on every single update(), focused or not.
    node.merge(nodeEnter)
      .transition().duration(revealNodeDuration())
      .delay((d) => revealDelayFor(d.depth))
      .style("opacity", (d) => (focusSeparationIds && !focusSeparationIds.has(d.id) ? 0.12 : 1))
      .attr("transform", (d) => `translate(${radialPoint(d.x, d.y).join(",")})`);

    node.merge(nodeEnter).select("text.node-label")
      .attr("text-anchor", (d) => (d.depth === 0 ? "middle" : (d.x < Math.PI ? "start" : "end")))
      .attr("transform", (d) => {
        if (d.depth === 0) return `translate(0,${radiusFor(d) + 14})`;
        const deg = (d.x * 180 / Math.PI) - 90;
        const flip = d.x >= Math.PI;
        const offset = radiusFor(d) + 8;
        return `rotate(${deg}) translate(${offset},0) rotate(${flip ? 180 : 0})`;
      });

    node.merge(nodeEnter).select("text.esma-expand-badge")
      .text((d) => (d._children ? "+" : ""));

    node.exit()
      .transition().duration(300)
      .style("opacity", 0)
      .attr("transform", `translate(${radialPoint(source.x, source.y).join(",")})`)
      .remove();

    nodes.forEach((d) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });

    applyFocusClasses();
    if (focusedNode && nodeById.get(focusedNode.id)) {
      zoomToBox(focusedNode.descendants(), animate !== false, { x0: 80, x1: 80, y0: 70, y1: 80 }, 4.5);
    } else {
      focusedNode = null;
      zoomToFit(animate !== false);
    }
  }

  // Mirrors sirlar-graph.js's theme-focus: clicking a "hub" node (one with
  // its own children -- a group heading, or a name like Rab/Hayy that opens
  // onto a chain of others) dims every node outside its own cluster and
  // zooms in on just that cluster, so a dense ring of names doesn't have to
  // be read all at once. Allah itself (the tree root) is exempted -- it
  // already sits at the map's center, so clicking it resets to the full
  // view instead of zooming in on "everything."
  function applyFocusClasses() {
    if (!focusedNode) {
      nodeGroup.selectAll("g.esma-node").classed("esma-node--dimmed", false).classed("esma-node--focused", false);
      linkGroup.selectAll("path.esma-link").classed("esma-link--dimmed", false);
      return;
    }
    const clusterIds = new Set(focusedNode.descendants().map((n) => n.id));
    nodeGroup.selectAll("g.esma-node")
      .classed("esma-node--dimmed", (n) => !clusterIds.has(n.id))
      .classed("esma-node--focused", (n) => n.id === focusedNode.id);
    linkGroup.selectAll("path.esma-link")
      .classed("esma-link--dimmed", (l) => !clusterIds.has(l.target.id));
  }

  // Focus now widens the focused cluster's own separation at layout time
  // (see focusSeparationIds), so clearing focus has to re-run the full
  // treeLayout, not just reset a transform -- otherwise every other
  // branch would stay compressed into the room that widening made for the
  // (no longer focused) cluster. update()'s own tail already re-applies
  // focus classes and picks zoomToBox vs zoomToFit correctly once
  // focusedNode is cleared here.
  function unfocusNode(animate) {
    focusedNode = null;
    update(root, animate);
  }

  function toggle(d) {
    const isHub = !!(d.children || d._children);

    if (!d.parent) {
      // Allah -- the tree root -- keeps its own independent collapse
      // toggle, and always resets focus to the full view (mirrors
      // sirlar-graph.js's root-node behavior) rather than "focusing" on
      // its own cluster, which is everything.
      if (d.children) { d._children = d.children; d.children = null; }
      else if (d._children) { d.children = d._children; d._children = null; }
      focusedNode = null;
    } else if (isHub) {
      // Clicking a hub (a group heading, or a name that opens onto a chain
      // of others) focuses on it -- dimming everyone else and zooming into
      // its cluster -- which requires it to actually be expanded, so
      // focusing also expands it if it was collapsed. Clicking an
      // already-focused hub again collapses it and clears the focus,
      // returning to the full view -- a single two-state toggle per hub,
      // rather than letting "expand/collapse" and "focus" drift out of
      // sync with each other.
      if (focusedNode && focusedNode.id === d.id) {
        if (d.children) { d._children = d.children; d.children = null; }
        focusedNode = null;
      } else {
        if (d._children) { d.children = d._children; d._children = null; }
        focusedNode = d;
      }
    }

    update(d, true);
    showDetail(d);
    window.__dostNav && window.__dostNav.setHash("esma", d.id);
  }

  function highlight(d) {
    // Hover-based ancestor/descendant emphasis and cluster-focus dimming
    // both work by setting opacity, but this one used to set it inline
    // (nodeSel.style(...)), which -- being higher-precedence than any CSS
    // class -- silently overwrote .esma-node--dimmed's 0.12 the moment the
    // mouse left a node after a focus click. Bailing out entirely while a
    // cluster is focused (rather than trying to layer both systems) avoids
    // that clash; clearing via `null` rather than forcing `1` elsewhere
    // means the underlying CSS class (dimmed or not) is always what
    // actually governs resting opacity.
    if (focusedNode) return;
    const nodeSel = nodeGroup.selectAll("g.esma-node");
    const linkSel = linkGroup.selectAll("path.esma-link");
    const relationSel = relationGroup.selectAll("path.esma-relation");
    if (!d) {
      nodeSel.style("opacity", null);
      linkSel.classed("esma-link--highlight", false);
      relationSel.style("opacity", null);
      return;
    }
    const ids = new Set(d.ancestors().map((a) => a.id));
    const descendantIds = new Set(d.descendants().map((a) => a.id));
    nodeSel.style("opacity", (n) => (ids.has(n.id) || descendantIds.has(n.id) ? null : 0.35));
    linkSel.classed("esma-link--highlight", (l) => l.target.id === d.id);
    relationSel.style("opacity", (r) => (r.from === d.id || r.to === d.id ? 1 : 0.15));
  }

  function showTooltip(d, event) {
    if (!tooltip) return;
    const short = I18n.pick3(d.data.short);
    tooltip.innerHTML = `
      <div class="node-hover-tip__title">${I18n.pick3(d.data.name)} ${poleBadgeHtml(d)}</div>
      ${short ? `<div class="node-hover-tip__short">${short}</div>` : ""}
    `;
    tooltip.hidden = false;
    moveTooltip(event);
  }

  function moveTooltip(event) {
    window.DostGraphUtils.moveTooltip(tooltip, wrapEl, event);
  }

  function hideTooltip() {
    window.DostGraphUtils.hideTooltip(tooltip);
  }

  const VOLUME_LABEL_OVERRIDE = {
    "izutsu-anahtar": { tr: "Anahtar-Kavramlar (İzutsu)", en: "Key Concepts (Izutsu)", pt: "Conceitos-Chave (Izutsu)" },
  };

  const VOLUME_SOURCE_MATCH = {
    "izutsu-anahtar": "İbn Arabî'nin Fusûsu'ndaki Anahtar-Kavramlar (Toshihiko İzutsu",
  };

  function volumeLabel(v) {
    if (VOLUME_LABEL_OVERRIDE[v]) return tt(VOLUME_LABEL_OVERRIDE[v]);
    return tt({ tr: `Fütûhât, Cilt ${v}`, en: `Futuhat, Volume ${v}`, pt: `Futuhat, Volume ${v}` });
  }

  function sourcesForInsight(ins, sources) {
    if (ins.source) return [ins.source];
    if (!sources || !sources.length) return [];
    const v = ins.volume;
    if (typeof v === "number") {
      const re = new RegExp(`Cilt ${v}\\b`);
      return sources.filter((s) => re.test(s));
    }
    if (VOLUME_SOURCE_MATCH[v]) {
      return sources.filter((s) => s.includes(VOLUME_SOURCE_MATCH[v]));
    }
    return [];
  }

  function insightsHtml(insights, sources, excludeId) {
    if (!insights || !insights.length) return "";
    return `<div class="insight-group">${insights.map((ins, i) => {
      const cite = sourcesForInsight(ins, sources);
      return `
      <details class="insight" ${i === 0 ? "open" : ""}>
        <summary>${volumeLabel(ins.volume)}</summary>
        <p>${linkify(I18n.pick3(ins.text), "esma", excludeId)}</p>
        ${cite.length ? `<cite>${cite.join(" · ")}</cite>` : ""}
      </details>
    `;
    }).join("")}</div>`;
  }

  function relatedNamesHtml(d) {
    const rows = [];
    if (d.id === "allah") {
      // Zât sits outside the tree now (see buildGraph), so Allah's "return
      // to the Essence" -- the very cascade this map's intro describes --
      // has to be added by hand rather than found via d.parent.
      rows.push({ other: { data: zatDatum }, arrow: "↑", note: I18n.pick3(zatDatum.short) });
    } else if (d.parent) {
      rows.push({ other: d.parent, arrow: "↑", note: I18n.pick3(d.parent.data.short) });
    }
    const kids = d.children || d._children || [];
    kids.forEach((c) => rows.push({ other: c, arrow: "↓", note: I18n.pick3(c.data.short) }));
    const relations = (esmaData.relations || []).filter(
      (r) => r.from === d.id || r.to === d.id
    );
    relations.forEach((r) => {
      const otherId = r.from === d.id ? r.to : r.from;
      const other = nodeById.get(otherId);
      if (other) rows.push({ other, arrow: "↔", note: I18n.pick3(r.label) });
    });
    if (!rows.length) return "";
    const items = rows.map(({ other, arrow, note }) => `
      <div class="detail-block detail-block--edge">
        <h3>${arrow} ${I18n.pick3(other.data.name)}</h3>
        ${note ? `<p>${note}</p>` : ""}
      </div>
    `).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlişkiler", en: "Relations", pt: "Relações" })}</p>${items}`;
  }

  function analogyHtml(analogy) {
    if (!analogy) return "";
    return `<div class="detail-analogy">
      <p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p>
      <p>${I18n.pick3(analogy)}</p>
    </div>`;
  }

  // Esc steps back through whatever was shown in the detail panel just
  // before the current thing -- a node, Zât, or a cross-relation. Each
  // show* function records what was on screen right before it takes over,
  // but only when the target actually differs (otherwise re-rendering the
  // same node on a language switch, or re-clicking an already-open node,
  // would each wrongly count as a new history step).
  function pushCurrentToHistory() {
    if (suppressHistoryPush) return;
    if (currentDetailNode) detailHistory.push({ type: "node", id: currentDetailNode.id });
    else if (currentDetailIsZat) detailHistory.push({ type: "zat" });
    else if (currentDetailRelation) detailHistory.push({ type: "relation", from: currentDetailRelation.from, to: currentDetailRelation.to });
  }

  function goBackInHistory() {
    const prev = detailHistory.pop();
    if (!prev) return false;
    suppressHistoryPush = true;
    try {
      if (prev.type === "zat") showZatDetail();
      else if (prev.type === "relation") {
        const r = (esmaData.relations || []).find((rel) => rel.from === prev.from && rel.to === prev.to);
        if (r) showRelationDetail(r);
      } else if (prev.type === "node") {
        revealPathTo(prev.id);
      }
    } finally {
      suppressHistoryPush = false;
    }
    return true;
  }

  function showDetail(d) {
    if (!currentDetailNode || currentDetailNode.id !== d.id) pushCurrentToHistory();
    currentDetailNode = d;
    currentDetailRelation = null;
    currentDetailIsZat = false;
    const n = d.data;
    const hint = d._children
      ? `<p class="detail-resonance">${tt({ tr: "Devamı için düğüme tekrar tıklayın.", en: "Click the node again to reveal what follows.", pt: "Clique no nó novamente para revelar o que se segue." })}</p>`
      : "";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" })}</p>
      <h2 class="detail-title">${I18n.pick3(n.name)} ${poleBadgeHtml(d)}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${I18n.pick3(n.short)}</h3>
        <p>${linkify(I18n.pick3(n.summary), "esma", d.id)}</p>
      </div>
      ${analogyHtml(n.analogy)}
      ${insightsHtml(n.insights, n.sources, d.id)}
      ${hint}
      ${relatedNamesHtml(d)}
    `;
    detailPanel.hidden = false;
    nodeGroup.selectAll("g.esma-node").classed("node--active", (nd) => nd.id === d.id);
    zatGroup.selectAll("g.esma-zat-node").classed("node--active", false);
  }

  function showZatDetail() {
    if (!currentDetailIsZat) pushCurrentToHistory();
    currentDetailNode = null;
    currentDetailRelation = null;
    currentDetailIsZat = true;
    const n = zatDatum;
    const allahNode = nodeById.get("allah");
    const related = allahNode ? `
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlişkiler", en: "Relations", pt: "Relações" })}</p>
      <div class="detail-block detail-block--edge">
        <h3>↓ ${I18n.pick3(allahNode.data.name)}</h3>
        <p>${I18n.pick3(allahNode.data.short)}</p>
      </div>
    ` : "";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" })}</p>
      <h2 class="detail-title">${I18n.pick3(n.name)}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${I18n.pick3(n.short)}</h3>
        <p>${linkify(I18n.pick3(n.summary), "esma", "zat")}</p>
      </div>
      ${analogyHtml(n.analogy)}
      ${insightsHtml(n.insights, n.sources, "zat")}
      ${related}
    `;
    detailPanel.hidden = false;
    nodeGroup.selectAll("g.esma-node").classed("node--active", false);
    zatGroup.selectAll("g.esma-zat-node").classed("node--active", true);
  }

  function showRelationDetail(r) {
    if (!currentDetailRelation || currentDetailRelation.from !== r.from || currentDetailRelation.to !== r.to) pushCurrentToHistory();
    currentDetailNode = null;
    currentDetailRelation = r;
    currentDetailIsZat = false;
    const from = nodeById.get(r.from);
    const to = nodeById.get(r.to);
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "İlişki", en: "Relation", pt: "Relação" })}</p>
      <h2 class="detail-title">${I18n.pick3(from.data.name)} ↔ ${I18n.pick3(to.data.name)} ${relationTypeBadgeHtml(r)}</h2>
      ${relationDiagramHtml(r)}
      <div class="detail-block detail-block--ibnarabi">
        <p>${I18n.pick3(r.label)}</p>
      </div>
    `;
    detailPanel.hidden = false;
    nodeGroup.selectAll("g.esma-node").classed("node--active", false);
    zatGroup.selectAll("g.esma-zat-node").classed("node--active", false);
  }

  function render() {
    if (!built || !esmaData) return;
    nodeGroup.selectAll("g.esma-node text.node-label").text((d) => labelFor(d));
    relationGroup.selectAll("path.esma-relation title").text((r) => I18n.pick3(r.label));
    if (currentDetailNode) showDetail(currentDetailNode);
    else if (currentDetailRelation) showRelationDetail(currentDetailRelation);
    else if (currentDetailIsZat) showZatDetail();
  }

  function revealPathTo(id) {
    if (id === "zat") {
      showZatDetail();
      return;
    }
    const target = nodeById.get(id);
    if (!target) return;
    let n = target.parent;
    while (n) {
      if (n._children) {
        n.children = n._children;
        n._children = null;
      }
      n = n.parent;
    }
    update(root, false);
    showDetail(target);
  }

  window.__esmaApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        if (!built) buildGraph(data);
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        if (!built) buildGraph(data);
        revealPathTo(id);
      });
    },
    onLangChange() {
      render();
    },
  };
})();
