(function () {
  "use strict";

  const I18n = window.DostI18n;
  const wrapEl = document.getElementById("futuhat-wrap");
  const mapEl = document.getElementById("futuhat-map");
  const partsEl = document.getElementById("futuhat-parts");
  const articleEl = document.getElementById("futuhat-article");
  const statsEl = document.getElementById("futuhat-stats");
  const tooltip = document.getElementById("futuhat-tooltip");
  const popupEl = document.getElementById("futuhat-popup");
  const popupBackdrop = document.getElementById("futuhat-popup-backdrop");
  const popupClose = document.getElementById("futuhat-popup-close");
  const popupTitleEl = document.getElementById("futuhat-popup-title");
  const popupListEl = document.getElementById("futuhat-popup-list");

  function tt(dict) {
    return I18n.pick3(dict);
  }

  // Kısımlar iki farklı `sources` şemasıyla yazıldı: eski kısımlarda her
  // kaynak düz {tr,en,pt} (sayfa aralığı metnin içine gömülü, "s. 291-299."
  // gibi); Cilt III'ten (c2k28'den) itibaren {title:{tr,en,pt}, pageRange}
  // olarak ayrıştırıldı. Bu fonksiyon olmadan yeni şemadaki kaynaklar
  // tt(s) çağrısıyla boş string dönüyordu (s'in kendisinde tr/en/pt yok,
  // s.title'da var) -- hem Kaynaklar popup'ı hem sayfa altındaki liste
  // sessizce boş satırlar gösteriyordu.
  function sourceLabel(s) {
    if (s.title) {
      return tt(s.title) + (s.pageRange ? `, s. ${s.pageRange}.` : "");
    }
    return tt(s);
  }

  // Kısım düzeyindeki `pageRange` de iki şemayla yazıldı: ilk 67 kısımda
  // düz metin ("73–126", önek yok), sonrakilerde üç dilli sözlük
  // ("s. 361-369" / "pp. 361-369"). Alan veride taşınıyordu ama
  // hiçbir yerde render edilmiyordu; bu yüzden şema farkı da hiç yüzeye
  // çıkmamıştı. Eski kayıtları toplu düzenlemek yerine (bkz. CLAUDE.md:
  // veri dosyalarında toplu yeniden serileştirme yok) düz metin biçimine
  // öneki burada, dile göre ekliyoruz.
  function pageRangeLabel(pr) {
    if (!pr) return "";
    if (typeof pr === "string") {
      const raw = pr.trim();
      if (!raw) return "";
      const prefix = I18n.pick3({ tr: "s. ", en: "pp. ", pt: "pp. " });
      return /^(s\.|pp\.|p\.)/i.test(raw) ? raw : prefix + raw;
    }
    return tt(pr);
  }

  function linkify(text) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text) : text;
  }

  // --- K-027 Adım 4: künye bloğu ---
  // Çeviri/baskı ve bölüm (bâb) numarası ayrı bir alanda tutulmuyor; yalnız
  // `sources[]` metninin içinden, dile göre kalıpla okunabiliyor. Veride
  // olmayan alan "belirtilmemiş" yazar -- ASLA tahmin edilmez (CLAUDE.md:
  // yaptığımız işi olduğundan farklı göstermemek).
  const KUNYE_RX = {
    ceviri: { tr: /çev\.\s*([^)]+)\)/i, en: /trans\.\s*([^)]+)\)/i, pt: /trad\.\s*([^)]+)\)/i },
    bolum: {
      tr: /(\d+(?:\s*[-–]\s*\d+)?)\.\s*Bölüm/i,
      en: /Chapters?\s+(\d+(?:\s*[-–]\s*\d+)?)/i,
      pt: /Cap[ií]tulos?\s+(\d+(?:\s*[-–]\s*\d+)?)/i,
    },
  };
  function kunyeFirstMatch(part, rx) {
    const lang = I18n.getLang();
    const list = part.sources || [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const txt = tt(s && s.title ? s.title : s) || "";
      const m = txt.match(rx[lang]);
      if (m) return m[1].trim();
    }
    return null;
  }
  // Kaynak satırlarında geçen sayfa aralıkları (yeni şemada s.pageRange, eskide
  // metnin içinde "s. 291-299").
  function kunyeSourcePages(part) {
    const out = [];
    (part.sources || []).forEach((s) => {
      if (!s) return;
      if (s.pageRange) {
        const m = /(\d+)\s*[-–]\s*(\d+)/.exec(typeof s.pageRange === "string" ? s.pageRange : tt(s.pageRange));
        if (m) out.push([+m[1], +m[2]]);
      }
      const title = tt(s.title ? s.title : s) || "";
      const re = /(?:\bs\.|\bpp?\.)\s*(\d+)\s*[-–]\s*(\d+)/g;
      let m;
      while ((m = re.exec(title))) out.push([+m[1], +m[2]]);
    });
    return out;
  }
  function kunyeHtml(part) {
    const yok = `<span class="yok">${tt({ tr: "belirtilmemiş", en: "not stated", pt: "não informado" })}</span>`;
    const L = {
      cilt: tt({ tr: "Cilt", en: "Volume", pt: "Volume" }),
      kisim: tt({ tr: "Kısım", en: "Part", pt: "Parte" }),
      sayfa: tt({ tr: "Sayfa aralığı", en: "Page range", pt: "Páginas" }),
      bolum: tt({ tr: "Bölüm (bâb) no.", en: "Chapter (bāb) no.", pt: "Capítulo (bāb) n.º" }),
      baski: tt({ tr: "Çeviri / baskı", en: "Translation / edition", pt: "Tradução / edição" }),
      aria: tt({ tr: "Okuma yeri", en: "Where this part sits", pt: "Onde esta parte se situa" }),
      kisimIpucu: tt({
        tr: "Kısım numarası tüm kitap boyunca süren sıradır.",
        en: "The part number runs continuously across the whole work.",
        pt: "O número da parte segue em sequência por toda a obra.",
      }),
      sayfaFark: tt({ tr: "Kaynak satırlarındaki sayfalar", en: "Pages in the source lines", pt: "Páginas nas linhas de fonte" }),
    };
    const pr = pageRangeLabel(part.pageRange);
    const bolum = kunyeFirstMatch(part, KUNYE_RX.bolum);
    const baski = kunyeFirstMatch(part, KUNYE_RX.ceviri);
    const rows = [
      [L.cilt, escapeHtml(CILT_ROMAN[part.cilt]), ""],
      [L.kisim, escapeHtml(roman(part.kisim)), L.kisimIpucu],
      [L.sayfa, pr ? escapeHtml(pr) : yok, ""],
      [L.bolum, bolum ? escapeHtml(bolum) : yok, ""],
      [L.baski, baski ? escapeHtml(baski) : yok, ""],
    ];
    let note = "";
    const nums = kunyeSourcePages(part);
    const rangeStr = typeof part.pageRange === "string" ? part.pageRange : (part.pageRange ? tt(part.pageRange) : "");
    const rng = /(\d+)\s*[-–]\s*(\d+)/.exec(rangeStr || "");
    if (nums.length && rng) {
      const lo = Math.min(...nums.map((n) => n[0]));
      const hi = Math.max(...nums.map((n) => n[1]));
      if (lo < +rng[1] || hi > +rng[2]) note = `<div class="kunye__not">${escapeHtml(L.sayfaFark)}: ${lo}–${hi}</div>`;
    }
    return `<aside class="kunye kunye--okuma" aria-label="${escapeHtml(L.aria)}"><dl>${rows
      .map((r) => `<dt${r[2] ? ` title="${escapeHtml(r[2])}"` : ""}>${escapeHtml(r[0])}</dt><dd>${r[1]}</dd>`)
      .join("")}${note}</dl></aside>`;
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : s;
    return d.innerHTML;
  }

  // --- Popup (used by the "in this part" stats panel) ---
  function openPopup(title, items, renderRow, onItemClick) {
    if (!popupEl) return;
    popupTitleEl.textContent = title;
    popupListEl.innerHTML = items.map((it, i) => renderRow(it, i)).join("");
    popupListEl.querySelectorAll("[data-popup-idx]").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.popupIdx);
        onItemClick(items[idx], idx);
        closePopup();
      });
    });
    popupEl.hidden = false;
  }

  function closePopup() {
    if (popupEl) popupEl.hidden = true;
  }

  if (popupBackdrop) popupBackdrop.addEventListener("click", closePopup);
  if (popupClose) popupClose.addEventListener("click", closePopup);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && popupEl && !popupEl.hidden) closePopup();
  });

  // Ağaç düğümüne tıklanınca gösterilen bilgi kutusu; aynı düğüme tekrar
  // tıklanınca veya başka bir yere tıklanınca kapanır.
  let activeTipNodeId = null;
  document.addEventListener("click", () => {
    if (activeTipNodeId) hideTip();
  });

  // --- Diagram lightbox (click a diagram to see it enlarged) ---
  function openDiagramLightbox(mount, captionText) {
    // Yoğun diyagramda dar ekranda liste gösteriliyorsa (K-004) lightbox yine
    // radyal şemayı büyütür: yalnız svg'nin kendisi kopyalanır.
    const svgEl = mount.querySelector("svg.futuhat-tree__svg");
    window.DostLightbox.open({
      closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
      svgHtml: svgEl && mount.classList.contains("futuhat-tree--listmode") ? svgEl.outerHTML : mount.innerHTML,
      caption: captionText || "",
    });
    wireLightboxNodeTooltips();
  }

  // mount.innerHTML sadece bir metin dizesi olarak kopyalanıp lightbox'ın
  // içine yeniden ayrıştırıldığı için, orijinal düğümlere D3 ile bağlanmış
  // olay dinleyicileri (hover/tıklama) ve bağlı veri (d.data) kopyada
  // kaybolur. Bu yüzden lightbox açılınca, düğümlerin üzerine önceden
  // gömdüğümüz data-label-*/data-note-* özniteliklerinden okuyan, ayrı ve
  // sabit-konumlu (position:fixed) bir bilgi kutusunu yeniden bağlıyoruz.
  let lightboxTipEl = null;
  let lightboxActiveTipId = null;

  function ensureLightboxTip() {
    if (lightboxTipEl) return lightboxTipEl;
    lightboxTipEl = document.createElement("div");
    lightboxTipEl.className = "node-hover-tip node-hover-tip--lightbox";
    lightboxTipEl.hidden = true;
    document.body.appendChild(lightboxTipEl);
    return lightboxTipEl;
  }

  function dataI18n(el, base) {
    const lang = I18n.getLang();
    return el.getAttribute(`data-${base}-${lang}`) || el.getAttribute(`data-${base}-en`) || el.getAttribute(`data-${base}-tr`) || "";
  }

  function moveLightboxTip(event) {
    if (!lightboxTipEl || lightboxTipEl.hidden) return;
    let x = event.clientX;
    let y = event.clientY;
    x = Math.max(90, Math.min(window.innerWidth - 90, x));
    y = Math.max(40, y);
    lightboxTipEl.style.left = x + "px";
    lightboxTipEl.style.top = y + "px";
  }

  function wireLightboxNodeTooltips() {
    const wrap = document.querySelector(".cizim-lightbox__svg-wrap");
    if (!wrap) return;
    const tip = ensureLightboxTip();
    tip.hidden = true;
    lightboxActiveTipId = null;
    wrap.querySelectorAll(".futuhat-tree__node").forEach((el) => {
      const note = dataI18n(el, "note");
      if (!note) return;
      const label = dataI18n(el, "label");
      const show = (event) => {
        tip.innerHTML = `<div class="node-hover-tip__title">${label}</div><p>${note}</p>`;
        tip.hidden = false;
        moveLightboxTip(event);
      };
      const hide = () => {
        tip.hidden = true;
        lightboxActiveTipId = null;
      };
      el.addEventListener("mouseenter", show);
      el.addEventListener("mousemove", moveLightboxTip);
      el.addEventListener("mouseleave", hide);
      el.addEventListener("focus", show);
      el.addEventListener("blur", hide);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = el.getAttribute("data-node-id");
        if (lightboxActiveTipId === id) {
          hide();
        } else {
          show(event);
          lightboxActiveTipId = id;
        }
      });
    });
  }

  function navigateToDiagram(diagramId, nodeId) {
    closePopup();
    const diagramEl = wrapEl && wrapEl.querySelector(`[data-diagram-id="${CSS.escape(diagramId)}"]`);
    if (!diagramEl) return;
    diagramEl.scrollIntoView({ behavior: "smooth", block: "center" });
    const target = nodeId ? diagramEl.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`) : diagramEl;
    if (target) {
      setTimeout(() => {
        target.classList.add("futuhat-pulse");
        setTimeout(() => target.classList.remove("futuhat-pulse"), 1700);
      }, 350);
    }
  }

  function navigateToSource(index) {
    closePopup();
    const li = wrapEl && wrapEl.querySelector(`.futuhat-sources li[data-source-index="${index}"]`);
    if (!li) return;
    li.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      li.classList.add("futuhat-pulse");
      setTimeout(() => li.classList.remove("futuhat-pulse"), 1700);
    }, 350);
  }

  let futuhatData = null;
  let dataPromise = null;
  let activePartId = null;
  // B1 "başlangıç güzergâhı": açık bir id yoksa VE okuyucunun kaydedilmiş
  // bir "kaldığın yer"i yoksa, activePartId atlas'ın kendi varsayılanına
  // (en son yazılan kısım -- şu an Cilt XVIII, neredeyse sonda) düşüyor.
  // Yani ilk kez gelen bir okuyucu, 223 kısımlık okumanın BAŞINA değil,
  // en son bırakılan yere iniyor -- hiçbir orantı hissi olmadan. Bu bayrak
  // true olduğunda renderPart() ilk parçaya bir bağlantı gösteriyor.
  let isDefaultLanding = false;
  // K-025: adreste/çağrıda AÇIKÇA verilen kısım kimliği (varsayılan iniş değil); bkz. activatePart.
  let explicitPartId = null;

  // B2 "Kaldığın yer": deep-link olmadan girişte (menüden tıklama, açılış
  // ekranından "devam et" gibi) atlas'ın varsayılan activePartId'si yerine
  // okuyucunun son bıraktığı kısmı öneririz -- açık bir id her zaman kazanır.
  const LAST_PART_KEY = "dost-futuhat-last-part";
  function saveLastPart(id) {
    try { localStorage.setItem(LAST_PART_KEY, id); } catch (_) {}
  }
  function loadLastPart() {
    try { return localStorage.getItem(LAST_PART_KEY); } catch (_) { return null; }
  }

  // Atlas artık ikiye bölünmüş yükleniyor (bkz. scripts/build-static-routes.py
  // -> write_futuhat_split): önce hafif indeks (kısım listesi + arama için,
  // ~240KB), sonra açılan her kısmın tam içeriği talep üzerine (~100KB).
  // Böylece Fütûhât görünümü 2.5MB'lık tek dosyayı baştan çekmiyor.
  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("futuhat-wrap");
    // K-027: ilk adım için 1 MB'lık indeks yerine ~57 KB'lık yalın kısım listesi
    // (id/cilt/kisim/title + book.cilts + activePartId; scripts/build-static-
    // routes.py üretir). İndeks arama ve diğer araçlar için olduğu gibi duruyor.
    dataPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/futuhat-kisimlar.json")
      .then((data) => {
        futuhatData = data;
        activePartId = data.activePartId;
        if (window.DostViewStatus) window.DostViewStatus.hide("futuhat-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Fütûhât indeksi yüklenemedi / Failed to load Futuhat index", err);
        dataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("futuhat-wrap", () => window.__futuhatApp.activate());
      });
    return dataPromise;
  }

  // Bir kısmın TAM içeriğini (mainDiagram + sections + sources) talep üzerine
  // çeker ve önbelleğe alır; renderPart/computeStats/forEachDiagramBlock bunu
  // kullanır. İndeksteki hafif kayıt yalnızca liste + başlık/özet içindir.
  // Promise'in kendisi önbelleğe alınıyor ki aynı kısım için eşzamanlı iki
  // çağrı (örn. açılışta activate + cross-link-ready re-render) tek fetch'e
  // insin; hata durumunda kayıt siliniyor ki "tekrar dene" gerçekten denesin.
  const partCache = new Map();
  function fetchPart(id) {
    if (partCache.has(id)) return partCache.get(id);
    const p = window.DostGraphUtils.fetchJson("data/ibn-arabi/futuhat-parts/" + id + ".json")
      .catch((err) => {
        console.error("Fütûhât kısmı yüklenemedi / Failed to load Futuhat part", id, err);
        partCache.delete(id);
        return null;
      });
    partCache.set(id, p);
    return p;
  }

  // İndeksteki hafif kayıt (id/cilt/kisim/title/pageRange/hero.summary).
  function partById(id) {
    return futuhatData.parts.find((p) => p.id === id);
  }

  // --- Stats: walk the part's diagrams and count concepts / relations ---
  function collectTreeStats(node, acc) {
    acc.concepts += 1;
    (node.children || node.nodes || []).forEach((c) => {
      acc.relations += 1;
      collectTreeStats(c, acc);
    });
  }

  function computeStats(part) {
    const acc = { concepts: 0, relations: 0, diagrams: 0 };
    collectTreeStats(part.mainDiagram.tree, acc);
    acc.diagrams += 1;
    (part.sections || []).forEach((s) => {
      (s.blocks || []).forEach((b) => {
        if (b.type !== "diagram") return;
        if (b.triad) {
          acc.diagrams += 1;
          acc.concepts += 3;
          acc.relations += 2;
        } else if (b.pair) {
          acc.diagrams += 1;
          acc.concepts += 2;
          acc.relations += 1;
        } else if (b.tree) {
          acc.diagrams += 1;
          collectTreeStats(b.tree, acc);
        } else if (!b.useMainDiagram) {
          acc.diagrams += 1;
        }
      });
    });
    return { concepts: acc.concepts, diagrams: acc.diagrams, relations: acc.relations, sources: (part.sources || []).length };
  }

  // --- Flat lists for the "in this part" popups ---
  function walkConcepts(node, diagramId, out) {
    out.push({ diagramId, nodeId: node.id, label: node.label, note: node.note });
    (node.children || node.nodes || []).forEach((c) => walkConcepts(c, diagramId, out));
  }

  function walkRelations(node, diagramId, out) {
    (node.children || node.nodes || []).forEach((c) => {
      out.push({ diagramId, nodeId: c.id, parentLabel: node.label, childLabel: c.label, note: c.note });
      walkRelations(c, diagramId, out);
    });
  }

  function forEachDiagramBlock(part, fn) {
    fn({ diagramId: "main", tree: part.mainDiagram.tree, sectionHeading: part.title });
    (part.sections || []).forEach((s, si) => {
      (s.blocks || []).forEach((b, bi) => {
        if (b.type !== "diagram" || b.useMainDiagram) return;
        fn({ diagramId: `s${si}-b${bi}`, tree: b.tree, triad: b.triad, pair: b.pair, sectionHeading: s.heading, caption: b.caption || b.source });
      });
    });
  }

  function collectConcepts(part) {
    const out = [];
    forEachDiagramBlock(part, (d) => {
      if (d.tree) walkConcepts(d.tree, d.diagramId, out);
      else if (d.triad) {
        out.push({ diagramId: d.diagramId, nodeId: "left", label: d.triad.left.label, note: d.triad.left.note });
        out.push({ diagramId: d.diagramId, nodeId: "middle", label: d.triad.middle.label, note: d.triad.middle.note });
        out.push({ diagramId: d.diagramId, nodeId: "right", label: d.triad.right.label, note: d.triad.right.note });
      } else if (d.pair) {
        out.push({ diagramId: d.diagramId, nodeId: "left", label: d.pair.left.label, note: d.pair.left.note });
        out.push({ diagramId: d.diagramId, nodeId: "right", label: d.pair.right.label, note: d.pair.right.note });
      }
    });
    return out;
  }

  function collectDiagramsList(part) {
    const out = [];
    forEachDiagramBlock(part, (d) => {
      out.push({ diagramId: d.diagramId, label: d.sectionHeading, caption: d.caption || part.mainDiagram.caption });
    });
    return out;
  }

  function collectRelations(part) {
    const out = [];
    forEachDiagramBlock(part, (d) => {
      if (d.tree) walkRelations(d.tree, d.diagramId, out);
      else if (d.triad) {
        out.push({ diagramId: d.diagramId, nodeId: "left", parentLabel: d.triad.middle.label, childLabel: d.triad.left.label, note: d.triad.left.note });
        out.push({ diagramId: d.diagramId, nodeId: "right", parentLabel: d.triad.middle.label, childLabel: d.triad.right.label, note: d.triad.right.note });
      } else if (d.pair) {
        out.push({ diagramId: d.diagramId, nodeId: "right", parentLabel: d.pair.left.label, childLabel: d.pair.right.label, note: d.pair.right.note });
      }
    });
    return out;
  }

  // --- Radial tree diagram (Bölüm Haritası) ---
  function renderRadialTree(mount, treeData, opts) {
    const radius = opts.radius || 190;

    const root = d3.hierarchy(treeData, (d) => d.children || d.nodes);
    const sweep = Math.PI * 2 * 0.94;
    const layout = d3
      .tree()
      .size([sweep, radius])
      .separation((a, b) => (a.parent === b.parent ? 1.4 : 2) / Math.max(1, Math.sqrt(a.depth)));
    layout(root);

    // d3's radial convention: angle 0 = north (up), increasing clockwise.
    // Node position and linkRadial() below both use this same convention,
    // so the connecting lines land exactly on the node centers.
    root.each((d) => {
      d.px = d.y * Math.sin(d.x);
      d.py = -d.y * Math.cos(d.x);
    });

    // Auto-fit the viewBox to the actual node bounds (plus room for labels)
    // instead of a fixed canvas, so the tree is centered whatever its shape.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    root.each((d) => {
      x0 = Math.min(x0, d.px); x1 = Math.max(x1, d.px);
      y0 = Math.min(y0, d.py); y1 = Math.max(y1, d.py);
    });
    x0 -= 220; x1 += 220; y0 -= 36; y1 += 36;

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-tree__svg")
      .attr("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`)
      .attr("role", "img")
      .attr("aria-label", tt(opts.ariaLabel || { tr: "Kavram haritası", en: "Concept map", pt: "Mapa de conceitos" }));

    const linkGen = d3.linkRadial().angle((d) => d.x).radius((d) => d.y);

    svg
      .append("g")
      .attr("class", "futuhat-tree__links")
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("class", "futuhat-tree__link")
      .attr("d", linkGen);

    const nodeSel = svg
      .append("g")
      .attr("class", "futuhat-tree__nodes")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("class", (d) => "futuhat-tree__node futuhat-tree__node--depth-" + d.depth)
      .attr("transform", (d) => `translate(${d.px},${d.py})`)
      .attr("data-node-id", (d) => d.data.id)
      .attr("data-label-tr", (d) => (d.data.label ? d.data.label.tr : ""))
      .attr("data-label-en", (d) => (d.data.label ? d.data.label.en : ""))
      .attr("data-label-pt", (d) => (d.data.label ? d.data.label.pt : ""))
      .attr("data-note-tr", (d) => (d.data.note ? d.data.note.tr : ""))
      .attr("data-note-en", (d) => (d.data.note ? d.data.note.en : ""))
      .attr("data-note-pt", (d) => (d.data.note ? d.data.note.pt : ""))
      .attr("tabindex", "0")
      .attr("aria-label", (d) => tt(d.data.label))
      .on("mouseenter", (event, d) => showTip(d, event))
      .on("mousemove", (event) => moveTip(event))
      .on("mouseleave", hideTip)
      .on("focus", (event, d) => showTip(d, event))
      .on("blur", hideTip)
      .on("click", (event, d) => {
        // Fare ile üzerine gelmenin (hover) açığa çıkardığı bilgiyi, dokunmatik
        // ekranlarda hover diye bir şey olmadığı için tıklamayla da göster --
        // ikinci kez aynı düğüme dokununca kapansın, yayılımı (propagation)
        // durdurup mount'un "büyüt" tıklamasını tetiklemesin.
        event.stopPropagation();
        if (activeTipNodeId === d.data.id) {
          hideTip();
        } else {
          showTip(d, event);
          activeTipNodeId = d.data.id;
        }
      });

    nodeSel
      .append("circle")
      .attr("r", (d) => (d.depth === 0 ? 15 : d.depth === 1 ? 11 : 8));

    nodeSel
      .append("circle")
      .attr("class", "node-sheen")
      .attr("r", (d) => (d.depth === 0 ? 15 : d.depth === 1 ? 11 : 8));

    nodeSel
      .append("text")
      .attr("class", "futuhat-tree__label")
      .attr("text-anchor", (d) => {
        if (d.depth === 0) return "middle";
        const a = ((d.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        return a > Math.PI ? "end" : "start";
      })
      .attr("dx", (d) => {
        if (d.depth === 0) return 0;
        const a = ((d.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const r = d.depth === 1 ? 11 : 8;
        return a > Math.PI ? -(r + 6) : r + 6;
      })
      .attr("dy", (d) => (d.depth === 0 ? -22 : "0.32em"))
      .text((d) => tt(d.data.label));

    // K-004: etiketler ekranda >=11 px olsun; sar + viewBox'ı gerçek sınırlara oturt.
    const svgNode = svg.node();
    const refit = () => {
      if (!mount.isConnected || !mount.clientWidth) return;
      fitRadialLabels(svgNode, 11.5, 20);
      denseListFallback(mount, svgNode, treeData);
    };
    refit();
    if (window.ResizeObserver) {
      let lastW = mount.clientWidth;
      const ro = new ResizeObserver(() => {
        const w = mount.clientWidth;
        if (w && (Math.abs(w - lastW) > 2 || !svgNode.dataset.fit)) { lastW = w; refit(); }
      });
      ro.observe(mount);
    }
  }

  // K-004: radyal ağacın etiketlerini en çok `maxChar` karakterde satırlara böler
  // (bir kez), yazıyı `hedefPx / ölçek` kullanıcı birimine çıkarır ve viewBox'ı
  // düğüm+etiket sınırlarına oturtur (eski sabit ±220 pay etiketleri soldan
  // kırpıyordu). Ölçek viewBox'a bağlı olduğundan birkaç tur yakınsatılır.
  // Şeklin kendisi (düğüm konumları, kenarlar, daire/ışın düzeni) değişmez.
  function fitRadialLabels(svg, hedefPx, maxCharUst) {
    const NS = "http://www.w3.org/2000/svg";
    const texts = Array.from(svg.querySelectorAll("text.futuhat-tree__label"));
    const gen = svg.getBoundingClientRect().width;
    if (!texts.length || !gen) return;
    // Satır uzunluğu kap genişliğine göre: dar ekranda uzun satır, etiket payını
    // viewBox'a katıp ölçeği ~0,2'ye düşürüyordu (yakınsama: W = N / (1 - 23·a/w),
    // a = 0,55·karakter). ~27 px/karakter 390 px'te 12, 560 px'te 20 verir.
    const maxChar = Math.max(9, Math.min(maxCharUst, Math.floor(gen / 27)));
    texts.forEach((t) => {
      if (t.dataset.mc === String(maxChar)) return;
      if (!t.dataset.raw) {
        t.dataset.raw = t.textContent.trim();
        t.dataset.kok = t.getAttribute("dy") !== "0.32em" ? "1" : "";   // kök etiket düğümün üstünde
        t.dataset.dx = String(parseFloat(t.getAttribute("dx") || "0") || 0);
        t.removeAttribute("dx");
        t.removeAttribute("dy");
      }
      t.dataset.mc = String(maxChar);
      const kelimeler = t.dataset.raw.split(/\s+/);
      const satirlar = [];
      let cur = "";
      kelimeler.forEach((k) => {
        if (cur && (cur + " " + k).length > maxChar) { satirlar.push(cur); cur = k; }
        else cur = cur ? cur + " " + k : k;
      });
      if (cur) satirlar.push(cur);
      const kok = !!t.dataset.kok;
      t.__kok = kok;
      t.__satir = satirlar.length;
      t.textContent = "";
      // dx yalnız ilk harfe uygulanır; tüm satırlar aynı yatay kaymayı taşısın diye
      // her tspan'a mutlak x verilir.
      satirlar.forEach((satir, i) => {
        const ts = document.createElementNS(NS, "tspan");
        ts.setAttribute("x", t.dataset.dx);
        ts.setAttribute("dy", (i === 0 ? (kok ? 0 : 0.32 - (satirlar.length - 1) * 0.575) : 1.15) + "em");
        ts.textContent = satir;
        t.appendChild(ts);
      });
    });
    // Dar ekranda yakınsama yavaş (etiket payı viewBox'ı büyütüp ölçeği küçültüyor,
    // yazı birimi yine büyüyor): ekranda görünen boyut hedefe yaklaşana dek (en
    // çok 40 tur) sürer; kararlı sonuç ölçülen boyutun hedefin ±%1'i içinde olması.
    for (let tur = 0; tur < 40; tur++) {
      const olcek = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      if (!olcek) return;
      const fu = hedefPx / olcek;
      if (olcek < 0.2) break;   // yakınsamıyor: ölçek çok küçük, yoğun-diyagram yedeği devreye girer
      if (tur > 0 && Math.abs(parseFloat(texts[0].style.fontSize) * olcek - hedefPx) < hedefPx * 0.01) break;
      texts.forEach((t) => {
        t.style.fontSize = fu.toFixed(2) + "px";
        // Çok satırlı kök etiket yukarı doğru büyür (düğümün üstünde kalır).
        // (tspan'ların kendi dy'si metnin dy="-22"sini ezdiği için çok satırlıda -22 buraya katılır.)
        if (t.__kok) t.setAttribute("y", String(-22 - (t.__satir - 1) * 1.15 * fu));
      });
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      svg.querySelectorAll("g.futuhat-tree__node").forEach((g) => {
        const m = g.transform.baseVal.consolidate().matrix;
        const bb = g.getBBox();
        x0 = Math.min(x0, bb.x + m.e); x1 = Math.max(x1, bb.x + bb.width + m.e);
        y0 = Math.min(y0, bb.y + m.f); y1 = Math.max(y1, bb.y + bb.height + m.f);
      });
      const pad = 8 / olcek;
      svg.setAttribute("viewBox", `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`);
    }
    svg.dataset.fit = "1";
  }

  // K-004 YOĞUN DİYAGRAM YEDEĞİ: dar ekranda (<=480 px) 15 düğümlü bir ağacın 11 px
  // etiketleri radyal yerleşimde sığmıyorsa (çakışma ya da ölçek < 0,30), aynı
  // ağaç verisinden girintili bir liste gösterilir; "Çizimi büyüt" (lightbox)
  // radyal şemayı olduğu gibi gösterir. Çakışma ölçüsü: etiket kutularının
  // kesişimi (>1 x >1 px).
  function denseListFallback(mount, svg, treeData) {
    const dar = window.innerWidth <= 480;
    const olcek = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    let cakisma = 0;
    if (dar) {
      const boxes = Array.from(svg.querySelectorAll("text.futuhat-tree__label")).map((t) => t.getBoundingClientRect());
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1) cakisma++;
      }
    }
    const yogun = dar && (cakisma > 0 || olcek < 0.3);
    mount.classList.toggle("futuhat-tree--listmode", yogun);
    let list = mount.querySelector(".futuhat-tree-list");
    if (!yogun) { if (list) list.remove(); return; }
    if (!list) {
      const build = (node) => {
        const kids = node.children || node.nodes || [];
        return `<li><span>${escapeHtml(tt(node.label))}</span>${kids.length ? `<ul>${kids.map(build).join("")}</ul>` : ""}</li>`;
      };
      list = document.createElement("ul");
      list.className = "futuhat-tree-list";
      list.innerHTML = build(treeData);
      mount.insertBefore(list, svg);
    }
  }

  function showTip(d, event) {
    if (!tooltip || !d.data.note) return;
    showTipHTML(`<div class="node-hover-tip__title">${tt(d.data.label)}</div><p>${tt(d.data.note)}</p>`);
    moveTip(event);
  }

  function showTipHTML(html) {
    if (!tooltip) return;
    tooltip.innerHTML = html;
    tooltip.hidden = false;
  }

  function moveTip(event) {
    if (!tooltip || tooltip.hidden || !wrapEl) return;
    const rect = wrapEl.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    x = Math.max(90, Math.min(rect.width - 90, x));
    y = Math.max(40, y);
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function positionTipAtElement(el) {
    if (!tooltip || !wrapEl) return;
    const wrapRect = wrapEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    let x = elRect.left + elRect.width / 2 - wrapRect.left;
    let y = elRect.top - wrapRect.top;
    x = Math.max(90, Math.min(wrapRect.width - 90, x));
    y = Math.max(40, y);
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function hideTip() {
    if (tooltip) tooltip.hidden = true;
    activeTipNodeId = null;
  }

  // --- Wikipedia-style hover preview for cross-links inside article prose ---
  function showCrossLinkPreview(anchorEl, event) {
    const view = anchorEl.dataset.view;
    const id = anchorEl.dataset.id;
    const summary = window.__dostCrossLink && window.__dostCrossLink.getSummary
      ? window.__dostCrossLink.getSummary(view, id)
      : null;
    if (!summary) return;
    showTipHTML(`<div class="node-hover-tip__title">${anchorEl.textContent}</div><p>${summary}</p>`);
    if (event && typeof event.clientX === "number") moveTip(event);
    else positionTipAtElement(anchorEl);
  }

  function setupCrossLinkPreviews() {
    if (!articleEl) return;
    articleEl.addEventListener("mouseover", (event) => {
      const a = event.target.closest(".cross-link");
      if (a) showCrossLinkPreview(a, event);
    });
    articleEl.addEventListener("mousemove", (event) => {
      const a = event.target.closest(".cross-link");
      if (a && tooltip && !tooltip.hidden) moveTip(event);
    });
    articleEl.addEventListener("mouseout", (event) => {
      if (event.target.closest(".cross-link")) hideTip();
    });
    articleEl.addEventListener("focusin", (event) => {
      const a = event.target.closest(".cross-link");
      if (a) showCrossLinkPreview(a, event);
    });
    articleEl.addEventListener("focusout", (event) => {
      if (event.target.closest(".cross-link")) hideTip();
    });
    articleEl.addEventListener("mousedown", (event) => {
      if (event.target.closest(".cross-link")) hideTip();
    });
  }

  // Uzun notlar tek satırda merkezden taşıp SVG viewBox kenarından kırpılmasın
  // diye (özellikle uçtaki sol/sağ düğümlerde), metni birden çok tspan'a bölüyoruz.
  // Karakter sayısına göre bölüyoruz (piksel genişliği değil) çünkü
  // getComputedTextLength() ilk render anında özel yazı tipi (Source Sans
  // Dost) henüz yüklenmemişse yedek fontla ölçüp yanlışlıkla dar sonuç
  // verebiliyor -- bu da satır bölünmesinin hiç tetiklenmemesine yol açıyordu.
  function wrapSvgText(textSelection, maxChars) {
    textSelection.each(function () {
      const el = d3.select(this);
      const words = el.text().split(/\s+/).filter(Boolean);
      const x = el.attr("x") || 0;
      const y = el.attr("y");
      el.text(null);
      let line = [];
      let lineNumber = 0;
      const lineHeight = 1.15;
      let tspan = el.append("tspan").attr("x", x).attr("y", y);
      words.forEach((word) => {
        const candidate = line.concat(word).join(" ");
        if (line.length && candidate.length > maxChars) {
          tspan.text(line.join(" "));
          line = [word];
          lineNumber += 1;
          tspan = el.append("tspan").attr("x", x).attr("y", y).attr("dy", `${lineNumber * lineHeight}em`);
        } else {
          line.push(word);
        }
        tspan.text(line.join(" "));
      });
    });
  }

  // K-004: üçlü/ikili şemalarda (0,72-0,78 rem yazı, sabit 460x130 / 320x130
  // viewBox) etiket ekranda 8-10 px kalıyordu. Yazıyı `hedefPx / ölçek` kullanıcı
  // birimine çıkarır, not metnini komşu düğüme çarpmayacak karakter sayısında
  // yeniden sarar ve viewBox'ı, ORİJİNAL çizim alanını koruyarak, taşan içeriğe
  // genişletir (düğüm konumları ve daireler değişmez; ölçek hiçbir zaman
  // özgün ölçeğin üstüne çıkmaz).
  function fitTriadLabels(svg, hedefPx) {
    if (!svg.getBoundingClientRect().width) return;
    const labels = Array.from(svg.querySelectorAll("text.futuhat-triad__label"));
    const notes = Array.from(svg.querySelectorAll("text.futuhat-triad__note"));
    if (!svg.dataset.vb0) {
      const vb = svg.viewBox.baseVal;
      svg.dataset.vb0 = [vb.x, vb.y, vb.width, vb.height].join(" ");
      notes.forEach((t) => { t.dataset.raw = t.textContent; });
      labels.forEach((t) => { t.dataset.raw = t.textContent; });
    }
    const [bx, by, bw, bh] = svg.dataset.vb0.split(" ").map(Number);
    const xs = Array.from(svg.querySelectorAll("g.futuhat-triad__node")).map((g) => g.transform.baseVal.consolidate().matrix.e).sort((a, b) => a - b);
    const aralik = xs.length > 1 ? Math.min(...xs.slice(1).map((x, i) => x - xs[i])) : bw;
    for (let tur = 0; tur < 40; tur++) {
      const olcek = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      if (!olcek || olcek < 0.2) return;
      const fu = hedefPx / olcek;
      if (tur > 0 && Math.abs(parseFloat(labels[0] ? labels[0].style.fontSize : "0") * olcek - hedefPx) < hedefPx * 0.01) break;
      labels.concat(notes).forEach((t) => { t.style.fontSize = fu.toFixed(2) + "px"; });
      const maxChar = Math.max(8, Math.min(24, Math.floor((aralik - 8) / (fu * 0.52))));
      notes.forEach((t) => {
        const raw = t.dataset.raw;
        d3.select(t).text(raw).call(wrapSvgText, maxChar);
      });
      // Üstteki başlık etiketleri de komşuya çarpmasın: sarılır ve YUKARI doğru büyür.
      labels.forEach((t) => {
        const kel = t.dataset.raw.split(/\s+/).filter(Boolean);
        const sat = [];
        let cur = "";
        kel.forEach((k) => {
          if (cur && (cur + " " + k).length > maxChar) { sat.push(cur); cur = k; } else cur = cur ? cur + " " + k : k;
        });
        if (cur) sat.push(cur);
        t.textContent = "";
        sat.forEach((satir, i) => {
          const ts = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
          ts.setAttribute("x", "0");
          ts.setAttribute("dy", (i === 0 ? -(sat.length - 1) * 1.15 : 1.15) + "em");
          ts.textContent = satir;
          t.appendChild(ts);
        });
      });
      let x0 = bx, x1 = bx + bw, y0 = by, y1 = by + bh;
      svg.querySelectorAll("g.futuhat-triad__node").forEach((g) => {
        const m = g.transform.baseVal.consolidate().matrix;
        const bb = g.getBBox();
        x0 = Math.min(x0, bb.x + m.e - 4); x1 = Math.max(x1, bb.x + bb.width + m.e + 4);
        y0 = Math.min(y0, bb.y + m.f - 4); y1 = Math.max(y1, bb.y + bb.height + m.f + 4);
      });
      svg.setAttribute("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
    }
    svg.dataset.fit = "1";
  }
  function watchTriad(mount) {
    const svgNode = mount.querySelector("svg.futuhat-triad__svg");
    if (!svgNode) return;
    const refit = () => { if (mount.isConnected && mount.clientWidth) fitTriadLabels(svgNode, 11.5); };
    refit();
    if (window.ResizeObserver) {
      let lastW = mount.clientWidth;
      new ResizeObserver(() => {
        const w = mount.clientWidth;
        if (w && (Math.abs(w - lastW) > 2 || !svgNode.dataset.fit)) { lastW = w; refit(); }
      }).observe(mount);
    }
  }

  // --- Triad diagram (three-point comparison, e.g. Teorik / Hâl / Sır) ---
  function renderTriad(mount, triad) {
    const width = 460, height = 130, cy = 55;
    const positions = [70, 230, 390];
    const items = [triad.left, triad.middle, triad.right];
    const nodeIds = ["left", "middle", "right"];

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-triad__svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", tt(triad.middle.label));

    svg
      .append("line")
      .attr("class", "futuhat-triad__axis")
      .attr("x1", positions[0]).attr("y1", cy)
      .attr("x2", positions[2]).attr("y2", cy);

    const g = svg
      .selectAll("g.futuhat-triad__node")
      .data(items)
      .join("g")
      .attr("class", (d, i) => "futuhat-triad__node" + (i === 1 ? " futuhat-triad__node--accent" : ""))
      .attr("data-node-id", (d, i) => nodeIds[i])
      .attr("transform", (d, i) => `translate(${positions[i]},${cy})`);

    g.append("circle").attr("r", (d, i) => (i === 1 ? 15 : 12));
    g.append("circle").attr("class", "node-sheen").attr("r", (d, i) => (i === 1 ? 15 : 12));
    g.append("text")
      .attr("class", "futuhat-triad__label")
      .attr("text-anchor", "middle")
      .attr("y", -26)
      .text((d) => tt(d.label));
    g.append("text")
      .attr("class", "futuhat-triad__note")
      .attr("text-anchor", "middle")
      .attr("y", 32)
      .text((d) => tt(d.note))
      .call(wrapSvgText, 24);
  }

  // --- Pair diagram (two-way comparison, e.g. Makam / Hâl) ---
  function renderPair(mount, pair) {
    const width = 320, height = 130, cy = 55;
    const positions = [80, 240];
    const items = [pair.left, pair.right];
    const nodeIds = ["left", "right"];

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-triad__svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", tt(pair.left.label) + " / " + tt(pair.right.label));

    svg
      .append("line")
      .attr("class", "futuhat-triad__axis")
      .attr("x1", positions[0]).attr("y1", cy)
      .attr("x2", positions[1]).attr("y2", cy);

    const g = svg
      .selectAll("g.futuhat-triad__node")
      .data(items)
      .join("g")
      .attr("class", "futuhat-triad__node")
      .attr("data-node-id", (d, i) => nodeIds[i])
      .attr("transform", (d, i) => `translate(${positions[i]},${cy})`);

    g.append("circle").attr("r", 14);
    g.append("circle").attr("class", "node-sheen").attr("r", 14);
    g.append("text")
      .attr("class", "futuhat-triad__label")
      .attr("text-anchor", "middle")
      .attr("y", -25)
      .text((d) => tt(d.label));
    g.append("text")
      .attr("class", "futuhat-triad__note")
      .attr("text-anchor", "middle")
      .attr("y", 31)
      .text((d) => tt(d.note))
      .call(wrapSvgText, 24);
  }

  // --- Article rendering ---
  const CILT_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII"];

  function progressRingHtml(done, total) {
    const r = 9;
    const circumference = 2 * Math.PI * r;
    const fillLen = (done / total) * circumference;
    // K-027 Adım 6 (G-04): "12/14" neyi sayıyor, açıkça söylenir. Fiil "okundu":
    // burada yayımlanan değil, okuduğumuz kısımlar sayılıyor (CLAUDE.md).
    const label = tt({ tr: `${done}/${total} kısım okundu`, en: `${done} of ${total} parts read`, pt: `${done} de ${total} partes lidas` });
    // svg aria-hidden: halka dekoratif -- okunacak bilgi hem sarmalayıcının
    // aria-label'ında hem de yanındaki "12/14" etiketinde zaten var. Etiketsiz
    // bırakıldığında ekran okuyucuya 15 adet isimsiz grafik düşüyordu
    // (2026-07-28 denetimi).
    return `<span class="futuhat-parts__progress" role="img" title="${label}" aria-label="${label}">
      <svg viewBox="0 0 22 22" width="18" height="18" aria-hidden="true" focusable="false">
        <circle class="futuhat-parts__progress-track" cx="11" cy="11" r="${r}" fill="none" stroke-width="2.5"></circle>
        <circle class="futuhat-parts__progress-fill" cx="11" cy="11" r="${r}" fill="none" stroke-width="2.5"
          stroke-dasharray="${fillLen} ${circumference}" transform="rotate(-90 11 11)"></circle>
      </svg>
      <span class="futuhat-parts__progress-label">${done}/${total}</span>
    </span>`;
  }

  // Sifr × Cilt × Kısım iç içe halka haritası: üç bölümleme düzlemini
  // (bkz. TERM_EVOLUTION "sifr/bölüm/kısım") tek bir dairesel görselde
  // üst üste bindirip okuyucunun "neredeyim" sorusunu tek bakışta
  // cevaplamasını sağlıyor. Sifr V-X sınırları kaynak metindeki doğrudan
  // "bitmesiyle" ifadeleriyle (V-VII) ya da bir sonraki cildin
  // içindekiler listesinden dolaylı ama kesin biçimde (VIII-X, bkz.
  // OPEN_QUESTIONS #24) doğrulandı; Kısım 1-28 içindeki Sifr I-IV
  // alt-sınırları doğrulanamadığı için (OPEN_QUESTIONS #10) kendi
  // aritmetiğimizle icat edilmedi -- o aralık tek, ayrıştırılmamış bir
  // halka dilimi olarak dürüstçe gösteriliyor.
  const SIFR_SEGMENTS = [
    { label: { tr: "Sifr I–IV", en: "Sifr I–IV", pt: "Sifr I–IV" }, k0: 1, k1: 28 },
    { label: { tr: "Sifr V", en: "Sifr V", pt: "Sifr V" }, k0: 29, k1: 34 },
    { label: { tr: "Sifr VI", en: "Sifr VI", pt: "Sifr VI" }, k0: 35, k1: 40 },
    { label: { tr: "Sifr VII", en: "Sifr VII", pt: "Sifr VII" }, k0: 41, k1: 47 },
    { label: { tr: "Sifr VIII", en: "Sifr VIII", pt: "Sifr VIII" }, k0: 48, k1: 53 },
    { label: { tr: "Sifr IX", en: "Sifr IX", pt: "Sifr IX" }, k0: 54, k1: 60 },
    { label: { tr: "Sifr X", en: "Sifr X", pt: "Sifr X" }, k0: 61, k1: 69 },
  ];

  function arcWedgePath(cx, cy, r1, r2, a0, a1) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x1 = cx + r1 * Math.cos(a0), y1 = cy + r1 * Math.sin(a0);
    const x2 = cx + r2 * Math.cos(a0), y2 = cy + r2 * Math.sin(a0);
    const x3 = cx + r2 * Math.cos(a1), y3 = cy + r2 * Math.sin(a1);
    const x4 = cx + r1 * Math.cos(a1), y4 = cy + r1 * Math.sin(a1);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} A ${r2} ${r2} 0 ${large} 1 ${x3.toFixed(1)} ${y3.toFixed(1)} L ${x4.toFixed(1)} ${y4.toFixed(1)} A ${r1} ${r1} 0 ${large} 0 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
  }

  function renderMap() {
    if (!mapEl || !futuhatData) return;
    const cilts = futuhatData.book.cilts || [];
    if (!cilts.length) return;
    mapEl.hidden = false;
    const maxKisim = Math.max(...cilts.map((c) => c.kisimEnd));
    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const rCiltOuter = 96, rCiltInner = 80;
    const rSifrOuter = 78, rSifrInner = 62;
    const rKisimOuter = 60, rKisimInner = 40;

    function angleRange(k0, k1) {
      const a0 = ((k0 - 1) / maxKisim) * Math.PI * 2 - Math.PI / 2;
      const a1 = (k1 / maxKisim) * Math.PI * 2 - Math.PI / 2;
      return [a0, a1];
    }

    const ciltWedges = cilts
      .map((c, i) => {
        const [a0, a1] = angleRange(c.kisimStart, Math.min(c.kisimEnd, maxKisim));
        return `<path class="futuhat-map__cilt" style="--ring-hue:${(i * 90 + 40) % 360}" d="${arcWedgePath(cx, cy, rCiltInner, rCiltOuter, a0, a1)}"></path>`;
      })
      .join("");

    const sifrWedges = SIFR_SEGMENTS.filter((s) => s.k0 <= maxKisim)
      .map((s) => {
        const [a0, a1] = angleRange(s.k0, Math.min(s.k1, maxKisim));
        return `<path class="futuhat-map__sifr" d="${arcWedgePath(cx, cy, rSifrInner, rSifrOuter, a0, a1)}"><title>${tt(s.label)}</title></path>`;
      })
      .join("");

    const kisimWedges = [];
    for (let k = 1; k <= maxKisim; k++) {
      const cilt = cilts.find((c) => k >= c.kisimStart && k <= c.kisimEnd);
      if (!cilt) continue;
      const part = futuhatData.parts.find((p) => p.cilt === cilt.cilt && p.kisim === k);
      const [a0, a1] = angleRange(k, k);
      const published = !!part;
      const isCurrent = part && part.id === activePartId;
      kisimWedges.push(
        `<path class="futuhat-map__kisim${published ? " futuhat-map__kisim--published" : ""}${isCurrent ? " futuhat-map__kisim--current" : ""}" data-id="${part ? part.id : ""}" style="--ring-hue:${(cilts.indexOf(cilt) * 90 + 40) % 360}" d="${arcWedgePath(cx, cy, rKisimInner, rKisimOuter, a0, a1)}"><title>${tt({ tr: "Kısım " + roman(k), en: "Part " + roman(k), pt: "Parte " + roman(k) })}</title></path>`
      );
    }

    mapEl.innerHTML = `
      <p class="futuhat-map__label">${tt({ tr: "Neredeyim", en: "Where am I", pt: "Onde estou" })}</p>
      <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${tt({ tr: "Fütûhât'ın sifr, cilt ve kısım bölümlemesini gösteren iç içe halka haritası", en: "Nested-ring map of Futuhat's sifr, volume, and part divisions", pt: "Mapa de anéis aninhados das divisões de sifr, volume e parte do Futuhat" })}">
        ${ciltWedges}
        ${sifrWedges}
        ${kisimWedges.join("")}
      </svg>
    `;
    mapEl.querySelectorAll(".futuhat-map__kisim--published[data-id]").forEach((wedge) => {
      wedge.addEventListener("click", () => activatePart(wedge.dataset.id));
    });
  }

  function renderParts() {
    if (!partsEl) return;
    const cilts = futuhatData.book.cilts || [];
    // The list was one long unbroken scroll of every kısım chip in every
    // cilt at once -- collapsing each cilt into its own <details> (native,
    // so it's keyboard/screen-reader accessible for free, same pattern as
    // .insight elsewhere) keeps the whole book navigable without forcing
    // a wall of chips. The cilt holding the currently-open part starts
    // expanded; if none is open yet, the last cilt with any read parts is
    // (most likely to be where the reader left off).
    const currentPart = futuhatData.parts.find((p) => p.id === activePartId);
    const currentCilt = currentPart ? currentPart.cilt : null;
    let fallbackCilt = null;
    cilts.forEach((c) => {
      const hasAny = futuhatData.parts.some((p) => p.cilt === c.cilt);
      if (hasAny) fallbackCilt = c.cilt;
    });
    const openCilt = currentCilt !== null ? currentCilt : fallbackCilt;

    partsEl.innerHTML = cilts
      .map((c) => {
        const kisimlar = Array.from({ length: c.kisimEnd - c.kisimStart + 1 }, (_, i) => c.kisimStart + i);
        const doneCount = kisimlar.filter((no) => futuhatData.parts.some((p) => p.cilt === c.cilt && p.kisim === no)).length;
        const chips = kisimlar
          .map((no) => {
            const part = futuhatData.parts.find((p) => p.cilt === c.cilt && p.kisim === no);
            if (part) {
              return `<button class="futuhat-part-chip futuhat-part-chip--active" type="button" data-id="${part.id}">${tt({ tr: "Kısım " + roman(no), en: "Part " + roman(no), pt: "Parte " + roman(no) })}</button>`;
            }
            // G-04: yalnız Romen rakamı ("I", "II") değil, "Kısım I" + neden tıklanamadığı.
            return `<span class="futuhat-part-chip futuhat-part-chip--soon" aria-disabled="true" title="${tt({ tr: "Bu kısım henüz okunmadı; metni yok.", en: "This part has not been read yet; no text.", pt: "Esta parte ainda não foi lida; sem texto." })}">${tt({ tr: "Kısım " + roman(no), en: "Part " + roman(no), pt: "Parte " + roman(no) })}</span>`;
          })
          .join("");
        return `<details class="futuhat-cilt-group"${c.cilt === openCilt ? " open" : ""}>
          <summary class="futuhat-parts__cilt">${tt({ tr: "Cilt " + CILT_ROMAN[c.cilt], en: "Volume " + CILT_ROMAN[c.cilt], pt: "Volume " + CILT_ROMAN[c.cilt] })}${progressRingHtml(doneCount, kisimlar.length)}</summary>
          <div class="futuhat-cilt-group__chips">${chips}</div>
        </details>`;
      })
      .join("");
    // Son cildi hardcode etmek yerine hesapla -- her yeni cilt eklendiğinde
    // bu metnin bayat kalmasına yol açan, iki kez tekrarlanmış bir hataydı
    // (bkz. research/anlayis-evrimi/MISUNDERSTANDINGS.md #4).
    const lastCilt = cilts.length ? cilts[cilts.length - 1].cilt : 0;
    const TOTAL_CILT = 18;
    if (lastCilt < TOTAL_CILT) {
      const nextRoman = CILT_ROMAN[lastCilt + 1];
      const lastRoman = CILT_ROMAN[TOTAL_CILT];
      partsEl.innerHTML += `<span class="futuhat-parts__more">${tt({ tr: `Cilt ${nextRoman}–${lastRoman} yakında`, en: `Volumes ${nextRoman}–${lastRoman} coming soon`, pt: `Volumes ${nextRoman}–${lastRoman} em breve` })}</span>`;
    }
  }

  function roman(n) {
    const table = [
      [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
      [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
      [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
    ];
    let out = "";
    let rem = n;
    for (const [value, symbol] of table) {
      while (rem >= value) {
        out += symbol;
        rem -= value;
      }
    }
    return out || String(n);
  }

  function renderStats(part) {
    if (!statsEl) return;
    const stats = computeStats(part);
    const row = (key, labelDict, value) => `
      <button class="futuhat-stats__item" type="button" data-stat="${key}">
        <span class="futuhat-stats__label">${tt(labelDict)}</span>
        <span class="futuhat-stats__badge">${value}</span>
      </button>
    `;
    statsEl.innerHTML = `
      <p class="futuhat-stats__heading">${tt({ tr: "Bu kısımda", en: "In this part", pt: "Nesta parte" })}</p>
      ${row("concepts", { tr: "Kavram", en: "Concepts", pt: "Conceitos" }, stats.concepts)}
      ${row("diagrams", { tr: "Çizim", en: "Diagrams", pt: "Diagramas" }, stats.diagrams)}
      ${row("relations", { tr: "İlişki", en: "Relations", pt: "Relações" }, stats.relations)}
      ${row("sources", { tr: "Kaynak", en: "Sources", pt: "Fontes" }, stats.sources)}
    `;

    const bind = (key, handler) => {
      const btn = statsEl.querySelector(`[data-stat="${key}"]`);
      if (btn) btn.addEventListener("click", handler);
    };

    bind("concepts", () => {
      const items = collectConcepts(part);
      openPopup(
        tt({ tr: "Kavramlar", en: "Concepts", pt: "Conceitos" }),
        items,
        (it, i) => `
          <button class="futuhat-popup__row" type="button" data-popup-idx="${i}">
            <span class="futuhat-popup__row-title">${tt(it.label)}</span>
            ${it.note ? `<span class="futuhat-popup__row-note">${tt(it.note)}</span>` : ""}
          </button>
        `,
        (it) => navigateToDiagram(it.diagramId, it.nodeId)
      );
    });

    bind("diagrams", () => {
      const items = collectDiagramsList(part);
      openPopup(
        tt({ tr: "Çizimler", en: "Diagrams", pt: "Diagramas" }),
        items,
        (it, i) => `
          <button class="futuhat-popup__row" type="button" data-popup-idx="${i}">
            <span class="futuhat-popup__row-title">${tt(it.label)}</span>
            ${it.caption ? `<span class="futuhat-popup__row-note">${tt(it.caption)}</span>` : ""}
          </button>
        `,
        (it) => navigateToDiagram(it.diagramId, null)
      );
    });

    bind("relations", () => {
      const items = collectRelations(part);
      openPopup(
        tt({ tr: "İlişkiler", en: "Relations", pt: "Relações" }),
        items,
        (it, i) => `
          <button class="futuhat-popup__row" type="button" data-popup-idx="${i}">
            <span class="futuhat-popup__row-title">${tt(it.parentLabel)} → ${tt(it.childLabel)}</span>
            ${it.note ? `<span class="futuhat-popup__row-note">${tt(it.note)}</span>` : ""}
          </button>
        `,
        (it) => navigateToDiagram(it.diagramId, it.nodeId)
      );
    });

    bind("sources", () => {
      openPopup(
        tt({ tr: "Kaynaklar", en: "Sources", pt: "Fontes" }),
        part.sources,
        (s, i) => `
          <button class="futuhat-popup__row" type="button" data-popup-idx="${i}">
            <span class="futuhat-popup__row-title">${sourceLabel(s)}</span>
          </button>
        `,
        (s, i) => navigateToSource(i)
      );
    });
  }

  function updatePartMeta(part) {
    document.title = "Dost Arabî — " + tt(part.title);
    const canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonicalEl) canonicalEl.setAttribute("href", "https://dostarabi.com/futuhat/" + part.id);
    const descEl = document.querySelector('meta[name="description"]');
    // Yalın kısım listesinde hero yok; özet tam kısım gelince (renderPart) yazılır.
    if (descEl && part.hero && part.hero.summary) descEl.setAttribute("content", tt(part.hero.summary));
  }

  function firstPart() {
    return futuhatData && futuhatData.parts.length ? futuhatData.parts[0] : null;
  }

  function startHintHtml(part) {
    const first = firstPart();
    if (!isDefaultLanding || !first || first.id === part.id) return "";
    return `
      <div class="futuhat-start-hint">
        <p>${tt({
          tr: "Bu, okumanın en son ulaştığı yer — 18 ciltlik bir okumanın neredeyse sonu. Yeni geliyorsan, baştan başlamak isteyebilirsin.",
          en: "This is where the reading currently stands — near the end of an 18-volume reading. If you're new here, you may want to start from the beginning.",
          pt: "É aqui que a leitura chegou — perto do fim de uma leitura de 18 volumes. Se você é novo aqui, talvez queira começar do início.",
        })}</p>
        <button type="button" class="futuhat-start-hint__btn" data-start-id="${first.id}">${tt({
          tr: "Baştan başla", en: "Start from the beginning", pt: "Começar do início",
        })}</button>
        <button type="button" class="futuhat-start-hint__close" aria-label="${tt({ tr: "Kapat", en: "Close", pt: "Fechar" })}">×</button>
      </div>`;
  }

  // K-027 Adım 5: makale sonunda önceki/sonraki kısım (kısım numarası sırasıyla;
  // metni olan komşu kısımlar -- futuhat-kisimlar.json yalnız okunmuş kısımları taşır).
  function gezinHtml(part) {
    if (!futuhatData) return "";
    const list = futuhatData.parts.slice().sort((a, b) => a.kisim - b.kisim);
    const i = list.findIndex((p) => p.id === part.id);
    if (i < 0) return "";
    const base = (window.__dostRouteBase || "") + "/futuhat/";
    const box = (p, yon) => {
      if (!p) return `<span class="futuhat-gezin__bos" aria-hidden="true"></span>`;
      const etiket = yon < 0
        ? tt({ tr: "← Önceki kısım", en: "← Previous part", pt: "← Parte anterior" })
        : tt({ tr: "Sonraki kısım →", en: "Next part →", pt: "Parte seguinte →" });
      return `<a class="futuhat-gezin__kutu futuhat-gezin__kutu--${yon < 0 ? "onceki" : "sonraki"}" href="${base}${p.id}" data-gezin-id="${p.id}"><small>${etiket}</small><span>${escapeHtml(tt({ tr: "Kısım ", en: "Part ", pt: "Parte " }) + roman(p.kisim) + " · " + tt(p.title))}</span></a>`;
    };
    return `<nav class="futuhat-gezin" aria-label="${tt({ tr: "Kısımlar arası gezinti", en: "Navigate between parts", pt: "Navegar entre partes" })}">${box(list[i - 1], -1)}${box(list[i + 1], 1)}</nav>`;
  }

  // K-027: araç çubuğu (A−/A+/yazdır/paylaş) artık makale başlığının içinde
  // değil, metnin üstündeki "ust" satırında, "Kısımlar" düğmesinin karşısında.
  // Düğme kimlikleri aynı; setupToolbar() değişmedi.
  function placeToolbar() {
    const ust = document.getElementById("futuhat-ust");
    if (!ust) return;
    ust.querySelectorAll(".futuhat-toolbar").forEach((el) => el.remove());
    ust.insertAdjacentHTML("beforeend", `
        <div class="futuhat-toolbar">
        <button class="futuhat-toolbar__btn" id="futuhat-font-decrease" type="button" title="Yazı boyutunu küçült / Decrease font size / Diminuir tamanho da fonte" aria-label="A− / A- / A-">A−</button>
        <button class="futuhat-toolbar__btn" id="futuhat-font-increase" type="button" title="Yazı boyutunu büyült / Increase font size / Aumentar tamanho da fonte" aria-label="A+">A+</button>
        <button class="futuhat-toolbar__btn futuhat-toolbar__btn--icon" id="futuhat-print" type="button" title="Yazdır / Print / Imprimir" aria-label="Yazdır / Print / Imprimir">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="6" y="3" width="12" height="6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="9" width="16" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="7" y="14" width="10" height="7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
        </button>
        <button class="futuhat-toolbar__btn futuhat-toolbar__btn--icon" id="futuhat-share" type="button" title="Paylaş / Share / Compartilhar" aria-label="Paylaş / Share / Compartilhar">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="5.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="18.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="8.3" y1="10.8" x2="15.7" y2="6.7" stroke="currentColor" stroke-width="1.6"/><line x1="8.3" y1="13.2" x2="15.7" y2="17.3" stroke="currentColor" stroke-width="1.6"/></svg>
        </button>
      </div>
    `);
  }

  function renderPart(part) {
    updatePartMeta(part);
    placeToolbar();
    articleEl.innerHTML = `
      ${startHintHtml(part)}
      <header class="futuhat-hero">
        <p class="futuhat-hero__eyebrow">${tt({ tr: "Fütûhât-ı Mekkiyye", en: "al-Futuhat al-Makkiyya", pt: "al-Futuhat al-Makkiyya" })}</p>
        <h2 class="futuhat-hero__title">${tt(part.title)}</h2>
        ${kunyeHtml(part)}
        <p class="futuhat-hero__summary">${tt(part.hero.summary)}</p>
      </header>

      <section class="futuhat-maindiagram" data-diagram-id="main">
        <div class="futuhat-tree" id="futuhat-main-tree"></div>
        <p class="futuhat-diagram-source">${tt(part.mainDiagram.caption)}</p>
      </section>

      <div class="futuhat-sections" id="futuhat-sections"></div>

      <div id="futuhat-anlamsal"></div>

      <div id="futuhat-yakin-pasaj"></div>

      <section class="futuhat-sources">
        <p class="detail-eyebrow">${tt({ tr: "Kaynaklar", en: "Sources", pt: "Fontes" })}</p>
        <ul>
          ${part.sources.map((s, i) => `<li data-source-index="${i}">${sourceLabel(s)}</li>`).join("")}
        </ul>
      </section>

      ${gezinHtml(part)}
    `;

    // K-027 Adım 3: ilk boyama çapraz bağlantısız (düz metin); bağlantılar
    // aşağıda boşta, küçük dilimlerle eklenir (bkz. runLinkify).
    const linkTargets = [
      { el: articleEl.querySelector(".futuhat-hero__summary"), raw: part.hero.summary },
      { el: articleEl.querySelector(".futuhat-maindiagram .futuhat-diagram-source"), raw: part.mainDiagram.caption },
    ];

    const mainTreeEl = document.getElementById("futuhat-main-tree");
    renderRadialTree(mainTreeEl, part.mainDiagram.tree, {
      ariaLabel: part.title,
    });
    mainTreeEl.classList.add("futuhat-tree--clickable");
    mainTreeEl.tabIndex = 0;
    mainTreeEl.setAttribute("role", "button");
    mainTreeEl.setAttribute("aria-label", tt({ tr: "Çizimi büyüt", en: "Enlarge diagram", pt: "Ampliar diagrama" }));
    const mainCaption = tt(part.mainDiagram.caption);
    mainTreeEl.addEventListener("click", () => openDiagramLightbox(mainTreeEl, mainCaption));
    mainTreeEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDiagramLightbox(mainTreeEl, mainCaption);
      }
    });

    const sectionsEl = document.getElementById("futuhat-sections");
    // K-031: paragraf numarası = kısım içinde type:"p" blokların 1 tabanlı sırası
    // (bilmiyoruz etiketli olanlar dâhil; Füsûs ile AYNI kural).
    let parNo = 0;
    const parTexts = [];
    part.sections.forEach((section, si) => {
      const secEl = document.createElement("section");
      secEl.className = "futuhat-section";
      secEl.innerHTML = `<h3 class="futuhat-section__heading">${tt(section.heading)}</h3>`;
      section.blocks.forEach((block, bi) => {
        if (block.type === "p" && block.tag === "bilmiyoruz") {
          // B2: "neyi bulamadık" kutusu. Bu içerik başka bir yerden
          // (research/anlayis-evrimi'nden) çekilmiyor -- yazının kendisi
          // zaten paragraf olarak vardı, burada yalnız görsel olarak
          // ayrıştırılıyor (bkz. CLAUDE.md kökensel duruş: bulduğumuz
          // kadar bulamadığımızı da göstermek).
          const box = document.createElement("div");
          box.className = "futuhat-bilmiyoruz-box";
          parNo++;
          parTexts.push(block.text);
          box.innerHTML = `<p class="futuhat-bilmiyoruz-box__eyebrow">${tt({
            tr: "Bu kesitte bulamadığımız",
            en: "What we did not find in this section",
            pt: "O que não encontrámos nesta secção",
          })}</p><p class="futuhat-bilmiyoruz-box__text" id="p-${parNo}">${tt(block.text)}</p>`;
          secEl.appendChild(box);
          linkTargets.push({ el: box.querySelector(".futuhat-bilmiyoruz-box__text"), raw: block.text });
        } else if (block.type === "p") {
          const p = document.createElement("p");
          p.className = "futuhat-section__p";
          p.innerHTML = tt(block.text);
          linkTargets.push({ el: p, raw: block.text });
          parNo++;
          parTexts.push(block.text);
          p.id = "p-" + parNo;
          secEl.appendChild(p);
          if (window.DostParagraf) p.insertAdjacentHTML("afterend", window.DostParagraf.ekHtml(parNo));
        } else if (block.type === "diagram") {
          const dCard = document.createElement("div");
          dCard.className = "futuhat-inline-diagram";
          if (!block.useMainDiagram) dCard.dataset.diagramId = `s${si}-b${bi}`;
          const mount = document.createElement("div");
          mount.className = "futuhat-tree futuhat-tree--inline";
          dCard.appendChild(mount);
          if (block.caption) {
            const capP = document.createElement("p");
            capP.className = "futuhat-inline-diagram__caption";
            capP.innerHTML = tt(block.caption);
            linkTargets.push({ el: capP, raw: block.caption });
            dCard.appendChild(capP);
          }
          const srcP = document.createElement("p");
          srcP.className = "futuhat-diagram-source";
          srcP.textContent = tt(block.source);
          dCard.appendChild(srcP);
          secEl.appendChild(dCard);

          if (block.triad) {
            renderTriad(mount, block.triad);
            watchTriad(mount);
          } else if (block.pair) {
            renderPair(mount, block.pair);
            watchTriad(mount);
          } else if (block.useMainDiagram) {
            renderRadialTree(mount, part.mainDiagram.tree, { radius: 160, ariaLabel: part.title });
          } else if (block.tree) {
            renderRadialTree(mount, block.tree, { radius: 160, ariaLabel: section.heading });
          }

          mount.classList.add("futuhat-tree--clickable");
          mount.tabIndex = 0;
          mount.setAttribute("role", "button");
          mount.setAttribute("aria-label", tt({ tr: "Çizimi büyüt", en: "Enlarge diagram", pt: "Ampliar diagrama" }));
          const lightboxCaption = block.caption ? tt(block.caption) : tt(block.source);
          mount.addEventListener("click", () => openDiagramLightbox(mount, lightboxCaption));
          mount.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openDiagramLightbox(mount, lightboxCaption);
            }
          });
        }
      });
      sectionsEl.appendChild(secEl);
    });

    if (window.DostParagraf) {
      window.DostParagraf.attach({
        root: articleEl,
        paragraphs: parTexts,
        dosya: part.id,
        // Künye, kısım sayfasının başlığıyla (eyebrow + sayfa aralığı) aynı dizgeler.
        kunye: () => {
          const pg = pageRangeLabel(part.pageRange);
          return {
            ana: tt({ tr: "Fütûhât-ı Mekkiyye", en: "al-Futuhat al-Makkiyya", pt: "al-Futuhat al-Makkiyya" })
              + " · " + tt({ tr: "Cilt " + CILT_ROMAN[part.cilt], en: "Volume " + CILT_ROMAN[part.cilt], pt: "Volume " + CILT_ROMAN[part.cilt] })
              + " · " + tt({ tr: "Kısım " + roman(part.kisim), en: "Part " + roman(part.kisim), pt: "Parte " + roman(part.kisim) })
              + (pg ? " · " + pg : ""),
            baslik: tt(part.title),
          };
        },
        kaydir: !!(deepPar && deepPar.id === part.id && Date.now() < deepPar.until),
      });
    }

    articleEl.querySelectorAll("[data-gezin-id]").forEach((a) => {
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault();
        window.dostTrack && window.dostTrack("kitap_bolumu_acildi", { part: a.dataset.gezinId });
        activatePart(a.dataset.gezinId);
        window.scrollTo({ top: 0 });
      });
    });

    renderStats(part);
    setupToolbar(part);
    setupStartHint();
    renderMeasurementPanel(part);
    renderAnlamsalBaglantilar(part);
    renderYakinPasajlar(part);
    currentLinkTargets = linkTargets.filter((t) => t.el);
    runLinkify(currentLinkTargets);
    document.documentElement.removeAttribute("data-futuhat-bekle");
  }

  // K-027 Adım 3: çapraz bağlantı (linkify) ana iş parçacığını kilitliyordu
  // (CPU x4 altında ~1,8 sn; her paragraf için yüzlerce terimlik dev regex).
  // Sonuç AYNI (linkify(tt(ham)) -- ham metin bozulmaz), yalnız zamanlaması
  // değişti: ilk boyama düz metinle, bağlantılar boşta ~10 ms'lik dilimlerle.
  // Terimler sonradan gelirse (onReady) yalnız makale gövdesi yeniden
  // bağlanır; harita/liste/şemalar/istatistik yeniden ÇİZİLMEZ.
  let currentLinkTargets = [];
  let linkGen = 0;
  let relinkTimer = null;
  function whenIdle(fn) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 400 });
    else setTimeout(fn, 16);
  }
  function runLinkify(targets) {
    const gen = ++linkGen;
    let i = 0;
    const step = () => {
      if (gen !== linkGen) return;
      const t0 = performance.now();
      do {
        const t = targets[i++];
        if (t && t.el.isConnected) {
          const plain = tt(t.raw);
          const linked = linkify(plain);
          if (linked !== plain) t.el.innerHTML = linked;
        }
      } while (i < targets.length && performance.now() - t0 < 10);
      if (i < targets.length) whenIdle(step);
    };
    whenIdle(step);
  }
  function scheduleRelink() {
    clearTimeout(relinkTimer);
    relinkTimer = setTimeout(() => {
      if (currentLinkTargets.length) runLinkify(currentLinkTargets);
    }, 150);
  }

  // Embedding altyapısı: iki metin gömme (embedding) yakınlığıyla bulunmuş,
  // elle gözden geçirilip onaylanmış kısım çiftleri (research/anlamsal-
  // komsuluk-tr.json, 48 adaydan 14 onay). B4(a) şartı: bu Dost'un kendi
  // çapraz-referansı DEĞİL, bizim ölçümümüz -- o yüzden .futuhat-bilmiyoruz-box
  // ile aynı kesikli-çerçeve ailesinde ama ayrı bir eyebrow'la gösteriliyor.
  let anlamsalPromise = null;
  function fetchAnlamsalBaglantilar() {
    if (!anlamsalPromise) {
      anlamsalPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/anlamsal-baglantilar.json").catch(() => null);
    }
    return anlamsalPromise;
  }
  function renderAnlamsalBaglantilar(part) {
    const mount = document.getElementById("futuhat-anlamsal");
    if (!mount) return;
    fetchAnlamsalBaglantilar().then((data) => {
      const liste = data && data.dizin && data.dizin[part.id];
      if (!mount.isConnected || !liste || !liste.length) return;
      const box = document.createElement("div");
      box.className = "futuhat-anlamsal-box";
      box.innerHTML = `<p class="futuhat-anlamsal-box__eyebrow">${tt({
        tr: "Bu konuyu başka nerelerde görüyoruz?",
        en: "Where else do we see this?",
        pt: "Onde mais vemos isto?",
      })}</p>`;
      liste.forEach((baglanti) => {
        const item = document.createElement("a");
        item.className = "futuhat-anlamsal-box__item";
        item.href = window.__dostNav.href(baglanti.view, baglanti.id);
        item.innerHTML = `<span class="futuhat-anlamsal-box__title">${tt(baglanti.title)}</span><span class="futuhat-anlamsal-box__sebep">${tt(baglanti.sebep)}</span>`;
        item.addEventListener("click", (e) => {
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          window.__dostNav.goTo(baglanti.view, baglanti.id);
        });
        box.appendChild(item);
      });
      mount.appendChild(box);
    });
  }

  // FAZ 5: canlı, tarayıcıda hesaplanan anlamsal yakınlık -- yukarıdaki
  // anlamsal-baglantilar.json'un aksine bu sonuçlar HİÇ insan gözden
  // geçirmesinden geçmedi (elle onaylanmış 14 çiftle karıştırılmamalı).
  // Bu yüzden: (a) ayrı bir kutu, açıkça "deneysel" etiketli; (b) tembel
  // -- yalnız "Göster"e basılınca data/ibn-arabi/pasaj-vektorleri-<dil>
  // .bin (birkaç MB) iniyor, sayfa açılışına hiçbir maliyeti yok.
  function renderYakinPasajlar(part) {
    const mount = document.getElementById("futuhat-yakin-pasaj");
    if (!mount) return;
    mount.innerHTML = "";
    const box = document.createElement("div");
    box.className = "futuhat-anlamsal-box futuhat-anlamsal-box--deneysel";
    box.innerHTML =
      `<p class="futuhat-anlamsal-box__eyebrow">${tt({
        tr: "Anlamca yakın olabilecek pasajlar (deneysel)",
        en: "Passages that may be semantically close (experimental)",
        pt: "Passagens que podem ser semanticamente próximas (experimental)",
      })}</p>` +
      `<p class="futuhat-anlamsal-box__not">${tt({
        tr: "Bu bizim ölçümümüzdür, Dost'un çapraz-referansı değildir; embedding benzerliğine göre hesaplanmıştır ve hiçbir insan gözden geçirmesinden geçmemiştir.",
        en: "This is our own measurement, not Dost's cross-reference; computed from embedding similarity, and has not passed any human review.",
        pt: "Esta é a nossa própria medição, não uma referência cruzada de Dost; calculada por similaridade de embedding, e não passou por nenhuma revisão humana.",
      })}</p>` +
      `<button type="button" class="futuhat-anlamsal-box__gosterBtn">${tt({ tr: "Göster", en: "Show", pt: "Mostrar" })}</button>`;
    mount.appendChild(box);
    const btn = box.querySelector(".futuhat-anlamsal-box__gosterBtn");
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = tt({ tr: "Yükleniyor…", en: "Loading…", pt: "Carregando…" });
      const lang = I18n.getLang();
      window.DostAnlamsalYakin.bul(part.id, lang, 5).then((sonuclar) => {
        btn.remove();
        if (!sonuclar.length) {
          const bos = document.createElement("p");
          bos.className = "futuhat-anlamsal-box__not";
          bos.textContent = tt({ tr: "Bu kısım için yakın bir pasaj bulunamadı.", en: "No close passage found for this part.", pt: "Nenhuma passagem próxima encontrada para esta parte." });
          box.appendChild(bos);
          return;
        }
        sonuclar.forEach((s) => {
          const item = document.createElement("a");
          item.className = "futuhat-anlamsal-box__item";
          item.href = s.route;
          item.innerHTML = `<span class="futuhat-anlamsal-box__title">${escapeHtml(s.baslik)}</span><span class="futuhat-anlamsal-box__sebep">${escapeHtml(s.ozet)}</span>`;
          box.appendChild(item);
        });
      }).catch(() => {
        btn.textContent = tt({ tr: "Şu an kullanılamıyor", en: "Unavailable right now", pt: "Indisponível no momento" });
      });
    });
  }

  // D1: ölçüm panosu. Yalnız @revise kipinde görünür -- okuyucuya değil,
  // bize (kısmı denetlerken) hitap ediyor. Bu turda bilerek dar tutuldu:
  // araçların kendisi (dil-denetimi.py, ayet-dizini.json, hadis-dizini.json)
  // henüz istikrar kazanmıştı, üstlerine yeni bir ölçüm eklemek erken
  // olurdu. Üç satır: âyet/hadis künyesi (ve başka kaç kısımda daha
  // geçtikleri, zaten var olan ters dizinlerden), ve üç dildeki <em>
  // sayısının hizalı olup olmadığı (D3'ün elle kapattığı VURGU_DUSMUS
  // kontrolünün canlı, tek-kısımlık karşılığı).
  let ayetDizinPromise = null;
  let hadisDizinPromise = null;
  function fetchAyetDizin() {
    if (!ayetDizinPromise) {
      ayetDizinPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/ayet-dizini.json").catch(() => null);
    }
    return ayetDizinPromise;
  }
  function fetchHadisDizin() {
    if (!hadisDizinPromise) {
      hadisDizinPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/hadis-dizini.json").catch(() => null);
    }
    return hadisDizinPromise;
  }

  function emUyumu(part) {
    const toplam = { tr: 0, en: 0, pt: 0 };
    let uyumsuzBlok = 0;
    (part.sections || []).forEach((s) => {
      (s.blocks || []).forEach((b) => {
        if (b.type !== "p" || !b.text) return;
        const sayim = {};
        ["tr", "en", "pt"].forEach((l) => {
          sayim[l] = ((b.text[l] || "").match(/<em>/g) || []).length;
          toplam[l] += sayim[l];
        });
        const dolu = ["tr", "en", "pt"].filter((l) => (b.text[l] || "").trim());
        const emli = dolu.filter((l) => sayim[l] > 0);
        if (dolu.length > 1 && emli.length > 0 && emli.length < dolu.length) uyumsuzBlok++;
      });
    });
    return { toplam, uyumsuzBlok };
  }

  function renderMeasurementPanel(part) {
    const eski = document.getElementById("futuhat-olcum-panosu");
    if (eski) eski.remove();
    if (!document.body.classList.contains("dost-edit-mode")) return;

    const panel = document.createElement("section");
    panel.className = "futuhat-olcum-panosu";
    panel.id = "futuhat-olcum-panosu";
    panel.innerHTML = `<p class="futuhat-olcum-panosu__baslik">${tt({
      tr: "Ölçüm panosu", en: "Measurement panel", pt: "Painel de medição" })}
      <span class="futuhat-olcum-panosu__not">${tt({
        tr: "yalnız @revise kipinde görünür", en: "visible only in @revise mode", pt: "visível apenas no modo @revise" })}</span></p>
      <ul class="futuhat-olcum-panosu__list"><li>${tt({ tr: "yükleniyor…", en: "loading…", pt: "carregando…" })}</li></ul>`;
    articleEl.appendChild(panel);

    const ayetRefs = Array.from(new Set(
      Array.from(articleEl.querySelectorAll("[data-ayet]")).map((el) => el.dataset.ayet)
    ));
    const hadisRefs = Array.from(new Set(
      Array.from(articleEl.querySelectorAll("[data-hadis]")).map((el) => el.dataset.hadis)
    ));
    const { toplam, uyumsuzBlok } = emUyumu(part);

    Promise.all([fetchAyetDizin(), fetchHadisDizin()]).then(([ayetD, hadisD]) => {
      const digerYerSayisi = (dizin, ref) =>
        ((dizin && dizin.dizin && dizin.dizin[ref]) || []).filter((y) => y.id !== part.id).length;
      const refListesi = (refs, dizin) =>
        refs.map((r) => {
          const n = digerYerSayisi(dizin, r);
          return n ? `${r} (+${n})` : r;
        }).join(", ");

      const list = document.querySelector("#futuhat-olcum-panosu .futuhat-olcum-panosu__list");
      if (!list) return;
      list.innerHTML = `
        <li>${tt({ tr: "Âyet künyesi", en: "Verse citations", pt: "Citações de versículo" })}: <strong>${ayetRefs.length}</strong>${ayetRefs.length ? ` — ${refListesi(ayetRefs, ayetD)}` : ""}</li>
        <li>${tt({ tr: "Hadis künyesi", en: "Hadith citations", pt: "Citações de hadith" })}: <strong>${hadisRefs.length}</strong>${hadisRefs.length ? ` — ${refListesi(hadisRefs, hadisD)}` : ""}</li>
        <li>${tt({ tr: "Dil vurgusu (em)", en: "Language emphasis (em)", pt: "Ênfase de idioma (em)" })}: tr=${toplam.tr} en=${toplam.en} pt=${toplam.pt}${uyumsuzBlok ? ` — <strong>${uyumsuzBlok}</strong> ${tt({ tr: "blokta dil uyuşmazlığı", en: "block(s) with a language mismatch", pt: "bloco(s) com incompatibilidade de idioma" })}` : ` — ${tt({ tr: "uyumlu", en: "aligned", pt: "alinhado" })}`}</li>
      `;
    });
  }

  function setupStartHint() {
    const hint = articleEl && articleEl.querySelector(".futuhat-start-hint");
    if (!hint) return;
    const startBtn = hint.querySelector("[data-start-id]");
    const closeBtn = hint.querySelector(".futuhat-start-hint__close");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        window.dostTrack && window.dostTrack("futuhat_bastan_basla");
        isDefaultLanding = false;
        activatePart(startBtn.dataset.startId);
      });
    }
    if (closeBtn) closeBtn.addEventListener("click", () => hint.remove());
  }

  // --- Toolbar: font size, print, share ---
  function setupToolbar(part) {
    const printBtn = document.getElementById("futuhat-print");
    const shareBtn = document.getElementById("futuhat-share");

    window.DostFontScale.bindFontScaleButtons(
      document.getElementById("futuhat-font-decrease"),
      document.getElementById("futuhat-font-increase")
    );

    if (printBtn) {
      printBtn.addEventListener("click", () => window.print());
    }
    if (shareBtn) {
      shareBtn.addEventListener("click", () => sharePart(part));
    }
  }

  function sharePart(part) {
    const url = location.origin + (window.__dostRouteBase || "") + "/futuhat/" + part.id;
    const title = tt({ tr: "Dost Arabî", en: "Dost Arabi", pt: "Dost Arabi" }) + " — " + tt(part.title);
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast(
        tt({ tr: "Bağlantı kopyalandı", en: "Link copied", pt: "Link copiado" })
      ));
    }
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "futuhat-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("futuhat-toast--visible"));
    setTimeout(() => {
      toast.classList.remove("futuhat-toast--visible");
      setTimeout(() => toast.remove(), 300);
    }, 1800);
  }

  // K-031: derin bağlantı "#p-N" yönlendirici/SPA tarafından silinmesin.
  // Betik yüklenirken adres henüz bozulmamıştır (index.html'deki satır-içi
  // betik ?p= adresini deferred betiklerden önce geri koyar).
  const deepPar = (function () {
    const m = /^#p-(\d+)$/.exec(location.hash);
    const r = /\/futuhat\/(c\d+k\d+)\/?$/.exec(location.pathname);
    return m && r ? { id: r[1], n: +m[1], until: Date.now() + 4000 } : null;
  })();
  function parHashFor(id) {
    const m = /^#p-(\d+)$/.exec(location.hash);
    const r = /\/futuhat\/(c\d+k\d+)\/?$/.exec(location.pathname);
    if (m && r && r[1] === id) return location.hash;
    if (deepPar && deepPar.id === id && Date.now() < deepPar.until) return "#p-" + deepPar.n;
    return "";
  }

  function activatePart(id, otomatik) {
    const meta = partById(id);
    if (!meta) return;
    activePartId = id;
    saveLastPart(id);
    // K-025: karşılama ekranının "kaldığın yerden devam et" satırı için ORTAK son-yer kaydı. Yalnız
    // okuyucunun bilerek açtığı kısım yazılır (çip/harita tıklaması = otomatik değil; ya da adreste
    // açıkça verilen id). Menüden varsayılan iniş ve "son kısma dön" yolu YAZMAZ.
    if (window.DostSonYer && (!otomatik || explicitPartId === id)) {
      window.DostSonYer.kaydet("futuhat", id, {
        tr: "Fütûhât, Cilt " + CILT_ROMAN[meta.cilt] + " · Kısım " + roman(meta.kisim),
        en: "Futuhat, Volume " + CILT_ROMAN[meta.cilt] + " · Part " + roman(meta.kisim),
        pt: "Futuhat, Volume " + CILT_ROMAN[meta.cilt] + " · Parte " + roman(meta.kisim),
      });
    }
    markCurrent(id);
    if (window.__dostNav) window.__dostNav.setHash("futuhat", id, { replace: !!otomatik, hash: parHashFor(id) });
    // setHash az önce genel "futuhat" başlık/canonical/description'ını yazdı
    // (bkz. ontology.js updateMeta) -- bu kısma özel olanlarla en son biz
    // üzerine yazıyoruz ki kazanan bu olsun. Meta (title+summary) indekste
    // olduğu için anında; makale gövdesi ise tam kısım gelince render edilir.
    updatePartMeta(meta);
    // Zaten bir kısım görünüyorsa, yenisi yüklenene kadar onu bırak (boş
    // yanıp sönme olmasın); yalnızca ilk açılışta "yükleniyor" göster.
    const alreadyRendered = articleEl && articleEl.querySelector(".futuhat-hero");
    if (articleEl) articleEl.setAttribute("aria-busy", "true");
    if (!partCache.has(id) && !alreadyRendered && articleEl) {
      // K-027: dönen "Yükleniyor…" yerine gerçek düzenin yaklaşık yüksekliğini
      // tutan iskelet (altbilgi ve istatistiğin metin gelince itilmesini önler).
      articleEl.innerHTML = `
        <div class="futuhat-iskelet" role="status" aria-label="${tt({ tr: "Yükleniyor…", en: "Loading…", pt: "Carregando…" })}">
          <span class="isk--ust"></span><span class="isk--baslik"></span><span class="isk--baslik"></span><span class="isk--kunye"></span>
          <span class="isk--satir"></span><span class="isk--satir"></span><span class="isk--satir"></span><span class="isk--satir"></span><span class="isk--satir"></span><span class="isk--satir"></span>
        </div>`;
    }
    fetchPart(id).then((part) => {
      // Kullanıcı bu fetch dönmeden başka bir kısma geçtiyse eskiyi basma.
      if (activePartId !== id) return;
      if (!part) {
        if (articleEl) {
          articleEl.setAttribute("aria-busy", "false");
          document.documentElement.removeAttribute("data-futuhat-bekle");
          articleEl.innerHTML = `
            <div class="view-status view-status--error futuhat-part-loading">
              <div class="view-status__spinner" aria-hidden="true"></div>
              <p class="view-status__text">${tt({ tr: "Bu kısım yüklenemedi.", en: "This part could not be loaded.", pt: "Esta parte não pôde ser carregada." })}</p>
              <button type="button" class="view-status__retry futuhat-part-retry">${tt({ tr: "Tekrar dene", en: "Retry", pt: "Tentar novamente" })}</button>
            </div>`;
          const retry = articleEl.querySelector(".futuhat-part-retry");
          if (retry) retry.addEventListener("click", () => activatePart(id));
        }
        return;
      }
      renderPart(part);
      if (articleEl) articleEl.setAttribute("aria-busy", "false");
    });
  }

  // --- K-027: kısım rayı (Neredeyim halkası + cilt listesi) kapalı bir panel ---
  const sidebarEl = document.getElementById("futuhat-sidebar");
  const railToggle = document.getElementById("futuhat-rail-toggle");
  const RAIL_KEY = "dost-futuhat-kisim-rayi";
  let railBuilt = false;
  let railInit = false;
  const desktopMQ = window.matchMedia ? window.matchMedia("(min-width: 1100px)") : { matches: false };

  function markCurrent(id) {
    if (partsEl) {
      partsEl.querySelectorAll(".futuhat-part-chip").forEach((chip) => {
        chip.classList.toggle("futuhat-part-chip--current", chip.dataset.id === id);
      });
      const currentChip = partsEl.querySelector(`.futuhat-part-chip[data-id="${id}"]`);
      const containingGroup = currentChip && currentChip.closest("details.futuhat-cilt-group");
      if (containingGroup) containingGroup.open = true;
    }
    if (mapEl) {
      mapEl.querySelectorAll(".futuhat-map__kisim").forEach((wedge) => {
        wedge.classList.toggle("futuhat-map__kisim--current", wedge.dataset.id === id);
      });
    }
  }

  function buildRail() {
    if (!futuhatData) return;
    renderMap();
    renderParts();
    if (partsEl) {
      partsEl.querySelectorAll(".futuhat-part-chip[data-id]").forEach((chip) => {
        chip.addEventListener("click", () => {
          window.dostTrack && window.dostTrack("kitap_bolumu_acildi", { part: chip.dataset.id });
          if (!desktopMQ.matches) closeRail(false);
          activatePart(chip.dataset.id);
        });
      });
    }
    railBuilt = true;
    markCurrent(activePartId);
  }

  function railIsOpen() { return !!sidebarEl && !sidebarEl.hidden; }

  function openRail(opts) {
    if (!sidebarEl) return;
    if (!railBuilt) buildRail();
    sidebarEl.hidden = false;
    if (railToggle) railToggle.setAttribute("aria-expanded", "true");
    if (desktopMQ.matches) { try { localStorage.setItem(RAIL_KEY, "1"); } catch (_) {} }
    if (!opts || opts.focus !== false) {
      const cur = partsEl && partsEl.querySelector(".futuhat-part-chip--current");
      if (cur) {
        cur.focus({ preventScroll: true });
        cur.scrollIntoView({ block: "center" });
      }
    }
  }

  function closeRail(returnFocus) {
    if (!sidebarEl || sidebarEl.hidden) return;
    sidebarEl.hidden = true;
    if (railToggle) railToggle.setAttribute("aria-expanded", "false");
    if (desktopMQ.matches) { try { localStorage.setItem(RAIL_KEY, "0"); } catch (_) {} }
    if (returnFocus && railToggle) railToggle.focus();
  }

  function scheduleRailBuild() {
    const job = () => { if (!railBuilt && futuhatData) buildRail(); };
    if (window.requestIdleCallback) window.requestIdleCallback(job, { timeout: 1500 });
    else setTimeout(job, 200);
  }

  if (railToggle) {
    railToggle.addEventListener("click", () => (railIsOpen() ? closeRail(false) : openRail()));
  }
  const railClose = document.getElementById("futuhat-sidebar-close");
  if (railClose) railClose.addEventListener("click", () => closeRail(true));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && railIsOpen() && wrapEl && !wrapEl.hidden) {
      e.preventDefault();
      closeRail(true);
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!railIsOpen()) return;
    if (sidebarEl.contains(e.target) || (railToggle && railToggle.contains(e.target))) return;
    closeRail(false);
  });

  function render() {
    if (!futuhatData) return;
    railBuilt = false;
    if (railIsOpen()) buildRail();
    else scheduleRailBuild();
    if (!railInit) {
      railInit = true;
      let remembered = null;
      try { remembered = localStorage.getItem(RAIL_KEY); } catch (_) {}
      if (desktopMQ.matches && remembered === "1") openRail({ focus: false });
    }
    activatePart(activePartId, true);
  }

  setupCrossLinkPreviews();

  let subscribedToCrossLinkReady = false;

  window.__futuhatApp = {
    activate(id) {
      if (!subscribedToCrossLinkReady && window.__dostCrossLink && window.__dostCrossLink.onReady) {
        subscribedToCrossLinkReady = true;
        // Ontoloji/Esmâ/Hâl/Terimler each register their cross-linkable
        // terms as their own data arrives, which can be after our first
        // render; once more terms are available the article body is
        // re-linked (K-027: not the whole view) so links appear without the
        // reader needing to do anything.
        window.__dostCrossLink.onReady(() => { if (futuhatData) scheduleRelink(); });
      }
      fetchData().then((data) => {
        if (!data) return;
        explicitPartId = null;
        if (id && data.parts.some((p) => p.id === id)) {
          activePartId = id;
          explicitPartId = id;
          isDefaultLanding = false;
        } else {
          const last = loadLastPart();
          if (last && data.parts.some((p) => p.id === last)) {
            activePartId = last;
            isDefaultLanding = false;
          } else {
            isDefaultLanding = true;
          }
        }
        render();
      });
    },
    onLangChange() {
      render();
    },
  };
})();
