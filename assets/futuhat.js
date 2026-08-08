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

  // Diyagramı büyüten AYRI bir <button> -- diyagramın kendisini
  // sarmalayan bir role="button" değil, çünkü ağaç tipi diyagramların
  // içindeki düğümler de kendi başlarına klavyeyle odaklanabilir/
  // etkileşimli (bkz. renderRadialTree); bir düğmenin içinde başka
  // düğmeler olması axe'in "Interactive controls must not be nested"
  // kuralını ihlal ediyordu (2026-08-04, pa11y-ci'yi kontrol.py'ye
  // bağlarken bulundu). container SIBLING olarak eklenir, mount'u SARMALAMAZ.
  function addEnlargeButton(container, mount, captionText) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "futuhat-diagram-enlarge-btn";
    btn.setAttribute("aria-label", tt({ tr: "Çizimi büyüt", en: "Enlarge diagram", pt: "Ampliar diagrama" }));
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="14.6" y1="14.6" x2="20" y2="20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDiagramLightbox(mount, captionText);
    });
    container.appendChild(btn);
  }

  // --- Diagram lightbox (click a diagram to see it enlarged) ---
  function openDiagramLightbox(mount, captionText) {
    window.DostLightbox.open({
      closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
      svgHtml: mount.innerHTML,
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
    dataPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/futuhat-atlas-index.json")
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

    // Etiket punto boyu SABİT bir CSS değeriyle (.futuhat-tree__label,
    // eskiden 0.74rem) VERİLEMEZ: viewBox her ağacın kendi düğüm
    // sınırlarına göre otomatik boyutlanıyor (yukarıda), yani aynı SVG
    // kullanıcı-alanı punto boyu, dallı bir ağaçta (geniş viewBox) daha
    // KÜÇÜK render ediyor. Ölçüldü (2026-08-05, Playwright): 0.74rem'lik
    // sabit değer bazı bölümlerde ekranda 11px'e kadar düşüyordu (G13
    // hedefi: 14px taban). Bunun yerine viewBox genişliğini SVG'nin CSS
    // max-width'ine (inline diyagram: 480px, ana diyagram: 560px --
    // .futuhat-tree__svg / .futuhat-tree--inline kuralları) oranlayıp
    // punto boyunu tersine ölçekliyoruz; ekranda GERÇEKTEN kaç piksel
    // göründüğü, ağacın dallılığından bağımsız olarak sabit kalır.
    const referansGenislik = mount.classList.contains("futuhat-tree--inline") ? 480 : 560;
    const viewBoxGenislik = x1 - x0;
    const etiketPunto = (14 * viewBoxGenislik) / referansGenislik;

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-tree__svg")
      .attr("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`)
      // role="img" (diğer diyagram tiplerinde olduğu gibi statik/tek parça)
      // burada YANLIŞ: bu SVG'nin içinde tek tek klavyeyle odaklanabilen,
      // role="button" taşıyan gerçek düğümler var (aşağıda). "img" rolü
      // ARIA'da "içeriği tek bir bütün olarak sun, altındakileri gizle"
      // demek -- axe bunu haklı olarak "düğmenin içinde düğme" gibi
      // işaretliyordu (nested-interactive, 2026-08-04). "group" bir
      // kapsayıcıdır, etkileşimli torunları gizlemez.
      .attr("role", "group")
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
      .attr("role", "button")
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

    const labelSel = nodeSel
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
      .style("font-size", etiketPunto.toFixed(2) + "px")
      .text((d) => tt(d.data.label));

    // Sabit 220px pay yalnız TAHMİNDİ -- uzun düğüm adlarında (bkz. yukarıdaki
    // etiketPunto yorumu) gerçek metin genişliğini aşıp kırpılıyordu, büyüteç
    // (lightbox) de aynı viewBox'ı kullandığı için düzeltmiyordu (UI denetimi
    // bulgusu). graph-utils.js'in createLabelDeconflictor'ındaki aynı ders:
    // tahmin değil ÖLÇÜM tutuyor -- her etiket gerçekten çizildikten SONRA
    // getBBox() ile ölçülüp viewBox gerekirse genişletiliyor.
    labelSel.each(function (d) {
      let bb;
      try { bb = this.getBBox(); } catch (e) { return; }
      if (!bb || (!bb.width && !bb.height)) return;
      x0 = Math.min(x0, d.px + bb.x);
      x1 = Math.max(x1, d.px + bb.x + bb.width);
      y0 = Math.min(y0, d.py + bb.y);
      y1 = Math.max(y1, d.py + bb.y + bb.height);
    });
    svg.attr("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
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

  // --- Nöbet halkası: "Fâtiha'nın nöbeti" (c14k163, 2026-08-04) --
  // yukarıdaki .pair diyagramının (kisim-c14k163-pair-nobet) alıntılarını
  // TAŞIYAN ayrı bir bilgi bloğu değil, aynı içeriğin DAİRESEL bir okuma
  // eşlik eder -- iki yarım tur, aynı iki nöbet etiketi (VISUALIZATION_
  // IDEAS.md #29: "aynı şema DAİRESEL olarak da kurulabilir... sitenin
  // daire ilkesine pair'den daha iyi oturur"). GORSEL_DIL.md'nin
  // "kavramı resmetme, davranışını resmet" kuralı burada da geçerli: bir
  // nokta halka boyunca durmadan dönüyor (nöbetin KENDİSİ hiç bitmiyor),
  // ve nokta hangi yarımın üstündeyse o yarım aydınlanıp öbürü soluyor --
  // metnin kendi cümlesi böyle (14256-68): sıra değişince zâhir/bâtın da
  // yer değiştiriyor, sabit bir taraf yok.
  function renderNobet(mount, nobet) {
    // İlk yazımda halka (r=78), 220 genişlik dar bir viewBox'ta kenara
    // neredeyse dayanıyordu -- yan etiketler sarılınca kart kenarından
    // taşıp kırpılıyordu (Puppeteer'la ölçüldü). pair/triad'ın kendi
    // marjı (~80-90px, wrap 24 karakter) örnek alınarak viewBox
    // genişletildi, halka küçültüldü, sarma daha dar tutuldu.
    const width = 320, height = 220, cx = 160, cy = 110, r = 66;

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-nobet__svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", tt(nobet.a) + " / " + tt(nobet.b));

    function arcPath(a0, a1) {
      const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
      const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      return `M${p0[0].toFixed(1)},${p0[1].toFixed(1)} A${r},${r} 0 0 1 ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
    }
    const TOP = -Math.PI / 2, BOTTOM = Math.PI / 2;

    const arcA = svg.append("path").attr("class", "futuhat-nobet__arc futuhat-nobet__arc--a").attr("d", arcPath(TOP, BOTTOM));
    const arcB = svg.append("path").attr("class", "futuhat-nobet__arc futuhat-nobet__arc--b").attr("d", arcPath(BOTTOM, TOP + Math.PI * 2));

    svg.append("text").attr("class", "futuhat-nobet__label futuhat-nobet__label--a")
      .attr("x", cx - r - 8).attr("y", cy).attr("text-anchor", "end")
      .text(tt(nobet.a)).call(wrapSvgText, 13);
    svg.append("text").attr("class", "futuhat-nobet__label futuhat-nobet__label--b")
      .attr("x", cx + r + 8).attr("y", cy).attr("text-anchor", "start")
      .text(tt(nobet.b)).call(wrapSvgText, 13);

    // Dönen nokta: bir devir ne "a" ne "b"de durur, ikisinin arasında
    // sürekli geçiyor -- bkz. yukarıdaki yorum.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const orbit = svg.append("g").attr("class", "futuhat-nobet__orbit-anchor");
    const marker = orbit.append("circle").attr("class", "futuhat-nobet__marker").attr("r", 6).attr("cx", cx).attr("cy", cy - r);
    if (!reduceMotion) {
      const anim = document.createElementNS("http://www.w3.org/2000/svg", "animateTransform");
      anim.setAttribute("attributeName", "transform");
      anim.setAttribute("type", "rotate");
      anim.setAttribute("from", `0 ${cx} ${cy}`);
      anim.setAttribute("to", `360 ${cx} ${cy}`);
      anim.setAttribute("dur", "12s");
      anim.setAttribute("repeatCount", "indefinite");
      orbit.node().appendChild(anim);
      // Nokta hangi yarımdaysa o yay aydınlanıyor -- iki yayı da eşit
      // sürede (6s) dönüşümlü olarak vurgulayan bir CSS animasyonu,
      // yukarıdaki SMIL dönüşle AYNI 12s'lik döngüye kilitli (bkz. style.css
      // futuhat-nobet__arc--glow keyframes).
      arcA.classed("futuhat-nobet__arc--glow", true);
      arcB.classed("futuhat-nobet__arc--glow", true).style("animation-delay", "6s");
    } else {
      // Hareket kısıtlıyken dönüş taklit edilmiyor (GORSEL_DIL.md) --
      // nokta "a" yarımında sabit durup o yayı durağan aydınlık gösteriyor.
      arcA.classed("futuhat-nobet__arc--static-a", true);
    }
  }

  // --- Karşılıklı akış (münâcât) diyagramı: kul-satırı/Hak-cevabı iki
  // sütun (c3k37 "İkiye böldüm" hadisi, 2026-08-04). Önceki hâli tek yönlü
  // bir ağaçtı (fatiha-munacat-tree) -- ama kaynak metin kul ile Hakkın
  // karşılıklı konuştuğu bir münâcât anlatıyor, tek kökten dallanan bir
  // hiyerarşi değil. Sol ve sağ sütunu birleştiren çizgi soyut bir ok değil
  // (GORSEL_DIL.md bunu yasaklıyor) -- .futuhat-triad__axis'in aynısı,
  // kaynaktaki gerçek eşleşmeyi (bu ayete bu cevap) gösteriyor.
  function renderAkis(mount, akis) {
    const rowH = 92, padTop = 34, colKul = 150, colHak = 210, width = 420;
    const n = akis.adimlar.length;
    const height = padTop + n * rowH + 14;

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-akis__svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", tt(akis.label));

    svg.append("text")
      .attr("class", "futuhat-akis__col-head")
      .attr("x", colKul).attr("y", 16).attr("text-anchor", "end")
      .text(tt(akis.kulBasligi));
    svg.append("text")
      .attr("class", "futuhat-akis__col-head")
      .attr("x", colHak).attr("y", 16).attr("text-anchor", "start")
      .text(tt(akis.hakBasligi));

    const rows = svg
      .selectAll("g.futuhat-akis__row")
      .data(akis.adimlar)
      .join("g")
      .attr("class", "futuhat-akis__row")
      .attr("data-node-id", (d) => d.id)
      .attr("transform", (d, i) => `translate(0,${padTop + i * rowH + rowH / 2})`);

    rows.append("line")
      .attr("class", "futuhat-akis__link")
      .attr("x1", colKul + 6).attr("x2", colHak - 6);

    rows.append("circle").attr("class", "futuhat-akis__dot futuhat-akis__dot--kul").attr("cx", colKul + 6).attr("r", 4);
    rows.append("circle").attr("class", "futuhat-akis__dot futuhat-akis__dot--hak").attr("cx", colHak - 6).attr("r", 4);

    rows.append("text")
      .attr("class", "futuhat-akis__kul")
      .attr("x", colKul).attr("y", 4).attr("text-anchor", "end")
      .text((d) => tt(d.kul))
      .call(wrapSvgText, 20);

    rows.append("text")
      .attr("class", "futuhat-akis__hak")
      .attr("x", colHak).attr("y", -8).attr("text-anchor", "start")
      .text((d) => tt(d.hak))
      .call(wrapSvgText, 26);
  }

  // --- Radyal (merkez + kollar) diyagramı: Amâ'nın dört bağlamı (c6k83,
  // 2026-08-04). Kollar KESİKLİ çizgiyle bağlanıyor -- kaynak metin dört
  // bağlamın aynı kavramın farklı yüzleri mi yoksa gerilimli iki ayrı
  // kullanım mı olduğunu ÇÖZMÜYOR (OPEN_QUESTIONS #37); kesikli çizgi bu
  // kararsızlığı, sağlam bir çizgi verirdiği kesinliği vermeden taşıyor.
  function renderRadyal(mount, radyal) {
    const cx = 150, cy = 150, hostR = 34, satR = 26, orbit = 100;
    const n = radyal.kollar.length;

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-radyal__svg")
      .attr("viewBox", "0 0 300 300")
      .attr("role", "img")
      .attr("aria-label", tt(radyal.merkez));

    const kollar = svg
      .selectAll("g.futuhat-radyal__kol")
      .data(radyal.kollar)
      .join("g")
      .attr("class", "futuhat-radyal__kol")
      .attr("data-node-id", (d) => d.id);

    kollar.each(function (d, i) {
      const deg = -90 + (360 / n) * i;
      const rad = (deg * Math.PI) / 180;
      const sx = cx + orbit * Math.cos(rad), sy = cy + orbit * Math.sin(rad);
      const g = d3.select(this);
      g.append("line")
        .attr("class", "futuhat-radyal__tether")
        .attr("x1", cx).attr("y1", cy).attr("x2", sx).attr("y2", sy);
      g.append("circle")
        .attr("class", "futuhat-radyal__dot")
        .attr("cx", sx).attr("cy", sy).attr("r", satR);
      g.append("text")
        .attr("class", "futuhat-radyal__label")
        .attr("x", sx).attr("y", sy - 2).attr("text-anchor", "middle")
        .text(tt(d.label))
        .call(wrapSvgText, 15);
      g.append("text")
        .attr("class", "futuhat-radyal__not")
        .attr("x", sx).attr("y", sy + orbit * 0.34).attr("text-anchor", "middle")
        .text(tt(d.not))
        .call(wrapSvgText, 20);
    });

    svg.append("circle").attr("class", "futuhat-radyal__merkez-dot").attr("cx", cx).attr("cy", cy).attr("r", hostR);
    svg.append("text")
      .attr("class", "futuhat-radyal__merkez-label")
      .attr("x", cx).attr("y", cy + 5).attr("text-anchor", "middle")
      .text(tt(radyal.merkez));
  }

  // --- "Perde nerede?" (c14k162, 2026-08-04): kaynak kesintisiz ışık
  // yayıyor, ışınlar perdeye kadar sönmeden gidiyor -- perde kaynakta değil
  // gözün önünde. GORSEL_DIL.md'nin ışık=zuhûr/matlık=perdelenme grameri
  // burada birebir: kaynak dolu-parlak, perde yarı saydam+bulanık (keskin
  // konturlu bir halka değil), göz perdenin ARKASINDA soluk kalıyor.
  let perdeBlurSeq = 0;
  function renderPerdeGoz(mount, pg) {
    const width = 360, height = 150, cy = 75;
    const kaynakX = 55, perdeX = 248, gozX = 312;
    const blurId = "futuhat-perde-blur-" + ++perdeBlurSeq;

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-perdegoz__svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", tt(pg.kaynakEtiket) + " / " + tt(pg.gozEtiket));

    const defs = svg.append("defs");
    const blur = defs.append("filter").attr("id", blurId).attr("x", "-60%").attr("y", "-60%").attr("width", "220%").attr("height", "220%");
    blur.append("feGaussianBlur").attr("stdDeviation", "4.2");

    // Işınlar: kaynaktan perdeye kadar SÖNMEDEN giden birkaç ince çizgi --
    // perdede aniden duruyorlar, giderek soluklaşmıyorlar (metin: ışık
    // zayıflamıyor, perde onu durduruyor).
    const rayYs = [cy - 10, cy - 3, cy + 4, cy + 11];
    svg.selectAll("line.futuhat-perdegoz__ray")
      .data(rayYs)
      .join("line")
      .attr("class", "futuhat-perdegoz__ray")
      .attr("x1", kaynakX + 30).attr("y1", (d) => d)
      .attr("x2", perdeX - 4).attr("y2", (d) => d);

    svg.append("circle").attr("class", "futuhat-perdegoz__kaynak-hale").attr("cx", kaynakX).attr("cy", cy).attr("r", 34);
    svg.append("circle").attr("class", "futuhat-perdegoz__kaynak").attr("cx", kaynakX).attr("cy", cy).attr("r", 24);

    svg.append("rect")
      .attr("class", "futuhat-perdegoz__perde")
      .attr("x", perdeX).attr("y", 8).attr("width", 26).attr("height", height - 16)
      .attr("filter", `url(#${blurId})`);

    svg.append("circle").attr("class", "futuhat-perdegoz__goz").attr("cx", gozX).attr("cy", cy).attr("r", 20);

    svg.append("text").attr("class", "futuhat-perdegoz__label").attr("x", kaynakX).attr("y", cy + 48).attr("text-anchor", "middle")
      .text(tt(pg.kaynakEtiket)).call(wrapSvgText, 16);
    svg.append("text").attr("class", "futuhat-perdegoz__note").attr("x", kaynakX).attr("y", cy - 42).attr("text-anchor", "middle")
      .text(tt(pg.kaynakNot)).call(wrapSvgText, 16);

    svg.append("text").attr("class", "futuhat-perdegoz__label").attr("x", perdeX + 13).attr("y", cy + 48).attr("text-anchor", "middle")
      .text(tt(pg.perdeEtiket)).call(wrapSvgText, 12);

    svg.append("text").attr("class", "futuhat-perdegoz__label").attr("x", gozX).attr("y", cy + 48).attr("text-anchor", "middle")
      .text(tt(pg.gozEtiket)).call(wrapSvgText, 14);
    svg.append("text").attr("class", "futuhat-perdegoz__note").attr("x", gozX).attr("y", cy - 42).attr("text-anchor", "middle")
      .text(tt(pg.gozNot)).call(wrapSvgText, 16);
  }

  // --- Nested-circles diagram (c13k150, "sonsuz iç içe daireler") ---
  // GORSEL_DIL.md keskin konturlu iç içe halka çizmeyi yasaklıyor ("Perde
  // çizilecekse yarı saydam perde çizilir... keskin konturlu bir halka bir
  // sınır verir"). İlk denemede beş ayrı, aynı renkte, üst üste dolgulu
  // daire kullanılmıştı -- ama SVG'de üst üste binen yarı saydam aynı renk
  // dolgular TOPLANIR: merkezde en çok katman üst üste bindiği için merkez
  // en KOYU çıktı, dış kenar en soluk -- yani anlam tam TERSİNE dönmüştü
  // (metin "merkez gizli/soluk, dış ortaya çıkan/net" diyor). Tek bir radyal
  // gradyan bu sorunu ortadan kaldırıyor: kompozisyon tek bir katman, merkez
  // gerçekten en soluk, dış kenar gerçekten en dolu -- hem doğru yönde hem
  // GORSEL_DIL.md'nin istediği yarı saydam/kademeli katman, sert kontur değil.
  let nestedGradSeq = 0;
  function renderNested(mount) {
    const width = 240, height = 200, cx = 120, cy = 100, r = 84;
    const gradId = "futuhat-nested-grad-" + ++nestedGradSeq;

    const svg = d3
      .select(mount)
      .append("svg")
      .attr("class", "futuhat-nested__svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr(
        "aria-label",
        tt({
          tr: "Sonsuz sayıda iç içe daire; dış kenar ortaya çıkan daire, merkeze doğru giderek soluklaşan derinlik kendinden önceki daireleri gizli taşıyor",
          en: "Endless circles nested within one another; the outer edge is the circle that appears, the depth fading toward the centre hides the ones that generated it",
          pt: "Círculos infinitos aninhados uns nos outros; a borda externa é o círculo que aparece, a profundidade que se dissolve para o centro oculta os que o geraram",
        })
      );

    const grad = svg.append("defs").append("radialGradient").attr("id", gradId).attr("class", "futuhat-nested__grad");
    grad.append("stop").attr("offset", "0%").attr("class", "futuhat-nested__stop").style("stop-opacity", 0.02);
    grad.append("stop").attr("offset", "38%").attr("class", "futuhat-nested__stop").style("stop-opacity", 0.14);
    grad.append("stop").attr("offset", "68%").attr("class", "futuhat-nested__stop").style("stop-opacity", 0.42);
    grad.append("stop").attr("offset", "100%").attr("class", "futuhat-nested__stop").style("stop-opacity", 0.88);

    svg
      .append("circle")
      .attr("class", "futuhat-nested__field")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", r)
      .attr("fill", `url(#${gradId})`);
  }

  // --- Article rendering ---
  const CILT_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII"];

  function progressRingHtml(done, total) {
    const r = 9;
    const circumference = 2 * Math.PI * r;
    const fillLen = (done / total) * circumference;
    const label = tt({ tr: `${done}/${total} kısım işlendi`, en: `${done}/${total} parts read`, pt: `${done}/${total} partes lidas` });
    // svg aria-hidden: halka dekoratif -- okunacak bilgi hem sarmalayıcının
    // aria-label'ında hem de yanındaki "12/14" etiketinde zaten var. Etiketsiz
    // bırakıldığında ekran okuyucuya 15 adet isimsiz grafik düşüyordu
    // (2026-07-28 denetimi).
    return `<span class="futuhat-parts__progress" title="${label}" aria-label="${label}">
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
            return `<span class="futuhat-part-chip futuhat-part-chip--soon" title="${tt({ tr: "Yakında", en: "Coming soon", pt: "Em breve" })}">${roman(no)}</span>`;
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
    if (descEl) descEl.setAttribute("content", tt(part.hero.summary));
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
          tr: "Bu, okumanın en son ulaştığı yer -- 18 ciltlik bir okumanın neredeyse sonu. Yeni geliyorsan, baştan başlamak isteyebilirsin.",
          en: "This is where the reading currently stands -- near the end of an 18-volume reading. If you're new here, you may want to start from the beginning.",
          pt: "É aqui que a leitura chegou -- perto do fim de uma leitura de 18 volumes. Se você é novo aqui, talvez queira começar do início.",
        })}</p>
        <button type="button" class="futuhat-start-hint__btn" data-start-id="${first.id}">${tt({
          tr: "Baştan başla", en: "Start from the beginning", pt: "Começar do início",
        })}</button>
        <button type="button" class="futuhat-start-hint__close" aria-label="${tt({ tr: "Kapat", en: "Close", pt: "Fechar" })}">×</button>
      </div>`;
  }

  function renderPart(part) {
    articleEl.innerHTML = `
      ${startHintHtml(part)}
      <header class="futuhat-hero">
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
        <p class="futuhat-hero__eyebrow">${tt({ tr: "Fütûhât-ı Mekkiyye", en: "al-Futuhat al-Makkiyya", pt: "al-Futuhat al-Makkiyya" })} · ${tt({ tr: "Cilt " + CILT_ROMAN[part.cilt], en: "Volume " + CILT_ROMAN[part.cilt], pt: "Volume " + CILT_ROMAN[part.cilt] })} · ${tt({ tr: "Kısım " + roman(part.kisim), en: "Part " + roman(part.kisim), pt: "Parte " + roman(part.kisim) })}</p>
        <h2 class="futuhat-hero__title">${tt(part.title)}</h2>
        ${pageRangeLabel(part.pageRange) ? `<p class="futuhat-hero__pages">${pageRangeLabel(part.pageRange)}</p>` : ""}
        <p class="futuhat-hero__summary">${linkify(tt(part.hero.summary))}</p>
      </header>

      <section class="futuhat-maindiagram" data-diagram-id="main">
        <div class="futuhat-tree" id="futuhat-main-tree"></div>
        <p class="futuhat-diagram-source">${linkify(tt(part.mainDiagram.caption))}</p>
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
    `;

    const mainTreeEl = document.getElementById("futuhat-main-tree");
    renderRadialTree(mainTreeEl, part.mainDiagram.tree, {
      ariaLabel: part.title,
    });
    mainTreeEl.classList.add("futuhat-tree--clickable");
    const mainCaption = tt(part.mainDiagram.caption);
    mainTreeEl.addEventListener("click", () => openDiagramLightbox(mainTreeEl, mainCaption));
    addEnlargeButton(mainTreeEl.parentElement, mainTreeEl, mainCaption);

    const sectionsEl = document.getElementById("futuhat-sections");
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
          box.innerHTML = `<p class="futuhat-bilmiyoruz-box__eyebrow">${tt({
            tr: "Bu kesitte bulamadığımız",
            en: "What we did not find in this section",
            pt: "O que não encontrámos nesta secção",
          })}</p><p class="futuhat-bilmiyoruz-box__text">${linkify(tt(block.text))}</p>`;
          secEl.appendChild(box);
        } else if (block.type === "p") {
          const p = document.createElement("p");
          p.className = "futuhat-section__p";
          p.innerHTML = linkify(tt(block.text));
          secEl.appendChild(p);
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
            capP.innerHTML = linkify(tt(block.caption));
            dCard.appendChild(capP);
          }
          const srcP = document.createElement("p");
          srcP.className = "futuhat-diagram-source";
          srcP.textContent = tt(block.source);
          dCard.appendChild(srcP);
          secEl.appendChild(dCard);

          if (block.triad) {
            renderTriad(mount, block.triad);
          } else if (block.pair) {
            renderPair(mount, block.pair);
          } else if (block.nobet) {
            renderNobet(mount, block.nobet);
          } else if (block.akis) {
            renderAkis(mount, block.akis);
          } else if (block.radyal) {
            renderRadyal(mount, block.radyal);
          } else if (block.perdeGoz) {
            renderPerdeGoz(mount, block.perdeGoz);
          } else if (block.nested) {
            renderNested(mount);
          } else if (block.useMainDiagram) {
            renderRadialTree(mount, part.mainDiagram.tree, { radius: 160, ariaLabel: part.title });
          } else if (block.tree) {
            renderRadialTree(mount, block.tree, { radius: 160, ariaLabel: section.heading });
          }

          mount.classList.add("futuhat-tree--clickable");
          const lightboxCaption = block.caption ? tt(block.caption) : tt(block.source);
          mount.addEventListener("click", () => openDiagramLightbox(mount, lightboxCaption));
          addEnlargeButton(dCard, mount, lightboxCaption);
        }
      });
      sectionsEl.appendChild(secEl);
    });

    renderStats(part);
    setupToolbar(part);
    setupStartHint();
    renderMeasurementPanel(part);
    renderAnlamsalBaglantilar(part);
    renderYakinPasajlar(part);
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
          // pasaj-vektorleri-*.json'daki route kök-göreli üretildi ("/futuhat/...")
          // -- canlıda (base="/") sorun çıkarmıyordu ama önizlemede (base=
          // "/dost-onizleme/") kökten çözüldüğü için 404 veriyordu (2026-08-04
          // kullanıcı bildirimi). Baştaki "/" atılınca <base> etiketine göre
          // doğru çözülüyor -- sitede zaten kurulu olan aynı düzeltme.
          item.href = s.route.replace(/^\//, "");
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

  function activatePart(id) {
    const meta = partById(id);
    if (!meta) return;
    activePartId = id;
    saveLastPart(id);
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
    if (window.__dostNav) window.__dostNav.setHash("futuhat", id);
    // setHash az önce genel "futuhat" başlık/canonical/description'ını yazdı
    // (bkz. ontology.js updateMeta) -- bu kısma özel olanlarla en son biz
    // üzerine yazıyoruz ki kazanan bu olsun. Meta (title+summary) indekste
    // olduğu için anında; makale gövdesi ise tam kısım gelince render edilir.
    updatePartMeta(meta);
    // Zaten bir kısım görünüyorsa, yenisi yüklenene kadar onu bırak (boş
    // yanıp sönme olmasın); yalnızca ilk açılışta "yükleniyor" göster.
    const alreadyRendered = articleEl && articleEl.querySelector(".futuhat-hero");
    if (!partCache.has(id) && !alreadyRendered && articleEl) {
      articleEl.innerHTML = `
        <div class="view-status futuhat-part-loading">
          <div class="view-status__spinner" aria-hidden="true"></div>
          <p class="view-status__text">${tt({ tr: "Yükleniyor…", en: "Loading…", pt: "Carregando…" })}</p>
        </div>`;
    }
    fetchPart(id).then((part) => {
      // Kullanıcı bu fetch dönmeden başka bir kısma geçtiyse eskiyi basma.
      if (activePartId !== id) return;
      if (!part) {
        if (articleEl) {
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
    });
  }

  function render() {
    if (!futuhatData) return;
    renderMap();
    renderParts();
    if (partsEl) {
      partsEl.querySelectorAll(".futuhat-part-chip[data-id]").forEach((chip) => {
        chip.addEventListener("click", () => {
          window.dostTrack && window.dostTrack("kitap_bolumu_acildi", { part: chip.dataset.id });
          activatePart(chip.dataset.id);
        });
      });
    }
    activatePart(activePartId);
  }

  setupCrossLinkPreviews();

  let subscribedToCrossLinkReady = false;

  window.__futuhatApp = {
    activate(id) {
      if (!subscribedToCrossLinkReady && window.__dostCrossLink && window.__dostCrossLink.onReady) {
        subscribedToCrossLinkReady = true;
        // Ontoloji/Esmâ/Hâl/Terimler each register their cross-linkable
        // terms as their own data arrives, which can be after our first
        // render; re-render once more terms are available so links appear
        // without the reader needing to do anything.
        // Görünürlük bekçisi şart: bu abonelik BAŞKA görünümlerin verisi
        // hazır olduğunda da tetikleniyor (Terimler ilk kez açılınca
        // notifyReady buraya da düşer). Bekçisiz hâli, Fütûhât görünmezken
        // tam re-render yapıp URL'yi /terimler'den /futuhat/<id>'ye,
        // title/canonical'ı da kısım metasına geri yazıyordu. Kullanıcı
        // Fütûhât'a dönünce activate() zaten render() çağırıyor.
        window.__dostCrossLink.onReady(() => {
          if (futuhatData && window.DostGraphUtils.isViewActive(wrapEl)) render();
        });
      }
      fetchData().then((data) => {
        if (!data) return;
        // Yavaş ağ bekçisi: veri gelene kadar kullanıcı başka görünüme
        // geçmiş olabilir. Geç gelen .then bekçisiz render+setHash yapıp
        // URL'yi ve başlığı artık bakılmayan görünüme yazıyordu.
        if (!window.DostGraphUtils.isViewActive(wrapEl)) return;
        if (id && data.parts.some((p) => p.id === id)) {
          activePartId = id;
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
