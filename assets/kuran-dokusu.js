// Kur'ân Dokusu — sûre↔bab atıf grafı (docs/icerik-yol-haritasi.md D10).
//
// KAPSAM (bkz. data/ibn-arabi/kuran-dokusu.json'un "not" alanı, aynı metin
// giriş panelinde de gösteriliyor): bu graf Fütûhât'ın orijinal Arapça
// metninin tam taramasından değil, sitenin kendi özet metinlerinde
// işaretlediğimiz âyet atıflarından üretildi -- Chodkiewicz'in tezinin bir
// kanıtı değil, okuma sürecimizin küçük bir izi.
//
// YERLEŞIM. CLAUDE.md'nin daire/merkez ilkesi + roadmap'in kendi isteği
// ("sûreler dış halka, bablar iç halka, kenarlar merkeze doğru"): sûre
// düğümleri KUR'ÂN SIRASINDAKİ açılarında duruyor (114 sûrelik tam daire
// üzerinde, no'ya göre) -- bu bilerek BOŞLUKLARI da görünür kılıyor, çünkü
// 114'ün yalnız 35'i şu an atıflı; boşluğun kendisi de bir dürüstlük.
window.__kuranDokusuApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const svg = d3.select("#kuran-dokusu-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("kuran-dokusu-wrap");
  const tooltip = document.getElementById("kuran-dokusu-tooltip");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");

  if (!svgNode || !wrapEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  function tt(dict) { return I18n.pick3(dict || {}); }

  const SURE_TOTAL = 114;

  let data = null;
  let sureler = [];
  let atifsizSureler = [];   // atıf bulunmayan sûrelerin halka üzerindeki izleri
  let bablar = [];
  let kenarlar = [];
  let sureByNo = new Map();
  let babById = new Map();
  let zoom = null;
  let g = null;
  let focusSureNo = null;
  let focusBabId = null;

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(360, r.width), h: Math.max(360, r.height) };
  }

  function yerlestir() {
    const { w, h } = boyut();
    const R_OUTER = Math.min(w, h) * 0.44;
    const R_INNER = Math.min(w, h) * 0.24;

    const maxSureAtif = Math.max(...sureler.map((s) => s.atifSayisi));
    sureler.forEach((s) => {
      const a = -Math.PI / 2 + ((s.no - 1) / SURE_TOTAL) * 2 * Math.PI;
      s.x = Math.cos(a) * R_OUTER;
      s.y = Math.sin(a) * R_OUTER;
      s.r = 4 + (s.atifSayisi / maxSureAtif) * 8;
    });

    // ATIFSIZ SÛRELER (2026-08-05 bildirimi: "mavi düğümler çemberin sadece
    // belirli kısımlarına kümelenmiş"). Ölçüldü: 35 düğüm ve aralarında tek
    // bir 145 DERECELİK boşluk -- çemberin neredeyse yarısı bomboştu.
    // Sebep gerçek: atıflar Kur'ân'ın ilk yarısındaki uzun sûrelerde
    // yoğunlaşıyor, son yarıdaki kısa sûrelerde neredeyse hiç yok.
    //
    // Düğümleri eşit aralıkla dağıtmak bu bilgiyi SİLERDİ: sûrenin açısı
    // Kur'ân sırasını taşıyor ve boşluk "burada atıf bulamadık" demek
    // (dosyanın başındaki yerleşim notu). Onun yerine 114 konumun TAMAMI
    // çiziliyor -- atıflı 35'i normal düğüm, atıfsız 79'u soluk birer iz.
    // Halka artık dolu görünüyor AMA eksiklik kaybolmuyor; görünmez bir
    // boşluk olmaktan çıkıp görünür bir ize dönüşüyor.
    const atifliNolar = new Set(sureler.map((s) => s.no));
    atifsizSureler = [];
    for (let no = 1; no <= SURE_TOTAL; no++) {
      if (atifliNolar.has(no)) continue;
      const a = -Math.PI / 2 + ((no - 1) / SURE_TOTAL) * 2 * Math.PI;
      atifsizSureler.push({ no: no, x: Math.cos(a) * R_OUTER, y: Math.sin(a) * R_OUTER });
    }

    const maxBabAtif = Math.max(...bablar.map((b) => b.atifSayisi));
    bablar.forEach((b, i) => {
      const a = -Math.PI / 2 + (i / bablar.length) * 2 * Math.PI;
      b.x = Math.cos(a) * R_INNER;
      b.y = Math.sin(a) * R_INNER;
      b.r = 2.5 + (b.atifSayisi / maxBabAtif) * 4;
    });

    return { w, h, R_OUTER, R_INNER };
  }

  // Kenar, merkeze doğru çekilmiş bir kontrol noktasıyla eğiliyor --
  // roadmap'in "kenarlar merkeze doğru" isteği, "her şey merkeze bakıyor"
  // ilkesinin bu graftaki karşılığı.
  function kenarYolu(d) {
    const s = sureByNo.get(d.sureNo), b = babById.get(d.view + "/" + d.id);
    if (!s || !b) return "";
    const mx = (s.x + b.x) / 2, my = (s.y + b.y) / 2;
    const cx = mx * 0.35, cy = my * 0.35;
    return `M${s.x.toFixed(1)},${s.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }

  function ciz() {
    const { w, h, R_OUTER, R_INNER } = yerlestir();
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    g = svg.append("g").attr("class", "kuran-dokusu-scene");
    const kok = g.append("g").attr("transform", `translate(${w / 2}, ${h / 2})`);

    kok.append("circle").attr("class", "kuran-dokusu-halka").attr("r", R_OUTER).attr("fill", "none");
    kok.append("circle").attr("class", "kuran-dokusu-halka").attr("r", R_INNER).attr("fill", "none");

    const kenarG = kok.append("g").attr("class", "kuran-dokusu-kenarler");
    const kenarSel = kenarG.selectAll("path.kuran-dokusu-kenar").data(kenarlar, (d) => d.sureNo + "|" + d.view + "|" + d.id).join("path")
      .attr("class", "kuran-dokusu-kenar")
      .attr("d", kenarYolu)
      .attr("fill", "none")
      .attr("stroke-width", (d) => 1 + d.agirlik * 0.6);

    kenarSel.on("mouseenter", function (ev, d) { vurgula(d.sureNo, d.view + "/" + d.id, true); kenarIpucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgula(null, null, false); GU.hideTooltip(tooltip); });

    // Atıfsız sûre izleri: sûre düğümlerinden ÖNCE çiziliyor ki gerçek
    // düğümler üstte kalsın. Etkileşimsiz ve ekran okuyucuya görünmez --
    // burada yeni bir bilgi yok, yalnız halkanın Kur'ân'ın tamamı olduğu
    // ve bu konumlarda atıf bulunmadığı görünür duruyor.
    kok.append("g").attr("class", "kuran-dokusu-atifsizlar")
      .attr("aria-hidden", "true")
      .selectAll("circle").data(atifsizSureler, (d) => d.no).join("circle")
      .attr("class", "kuran-dokusu-atifsiz")
      .attr("cx", (d) => d.x).attr("cy", (d) => d.y).attr("r", 1.6);

    // Sûre düğümleri (dış halka)
    const sureG = kok.append("g").attr("class", "kuran-dokusu-sureler");
    const sureSel = sureG.selectAll("g.kuran-dokusu-sure").data(sureler, (d) => d.no).join("g")
      .attr("class", "kuran-dokusu-sure")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => tt(d.ad));
    sureSel.append("circle").attr("class", "kuran-dokusu-sure__vurus").attr("r", 14).attr("fill", "transparent");
    sureSel.append("circle").attr("class", "kuran-dokusu-sure__nokta").attr("r", (d) => d.r);
    sureSel.append("text").attr("class", "kuran-dokusu-sure__etiket")
      .attr("text-anchor", (d) => (d.x > 8 ? "start" : d.x < -8 ? "end" : "middle"))
      .attr("x", (d) => (d.x > 8 ? d.r + 6 : d.x < -8 ? -(d.r + 6) : 0))
      .attr("y", (d) => (Math.abs(d.x) > 8 ? 4 : (d.y >= 0 ? d.r + 13 : -(d.r + 7))))
      .text((d) => tt(d.ad));

    sureSel.on("mouseenter", function (ev, d) { vurgula(d.no, null, true); sureIpucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgula(null, null, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgula(d.no, null, true); })
      .on("blur", function () { vurgula(null, null, false); })
      .on("click", (ev, d) => surePaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); surePaneli(d); }
      });

    // Bab düğümleri (iç halka)
    const babG = kok.append("g").attr("class", "kuran-dokusu-bablar");
    const babSel = babG.selectAll("g.kuran-dokusu-bab").data(bablar, (d) => d.view + "/" + d.id).join("g")
      .attr("class", "kuran-dokusu-bab")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => tt(d.title));
    babSel.append("circle").attr("class", "kuran-dokusu-bab__vurus").attr("r", 10).attr("fill", "transparent");
    babSel.append("circle").attr("class", "kuran-dokusu-bab__nokta").attr("r", (d) => d.r);

    babSel.on("mouseenter", function (ev, d) { vurgula(null, d.view + "/" + d.id, true); babIpucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgula(null, null, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgula(null, d.view + "/" + d.id, true); })
      .on("blur", function () { vurgula(null, null, false); })
      .on("click", (ev, d) => babPaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); babPaneli(d); }
      });

    zoom = GU.createZoomBehavior(svg, g, [0.6, 3.5]);
    ortala(false);
  }

  function vurgula(sureNo, babKey, on) {
    if (!g) return;
    g.selectAll("path.kuran-dokusu-kenar").classed("kuran-dokusu-kenar--deginiliyor", (d) =>
      on && ((sureNo != null && d.sureNo === sureNo) || (babKey != null && d.view + "/" + d.id === babKey)));
    g.selectAll("g.kuran-dokusu-sure").classed("kuran-dokusu-sure--deginiliyor", (d) => on && sureNo != null && d.no === sureNo);
    g.selectAll("g.kuran-dokusu-bab").classed("kuran-dokusu-bab--deginiliyor", (d) => on && babKey != null && d.view + "/" + d.id === babKey);
  }

  function ayetListHtml(ayetler) {
    return ayetler.map((a) => `<span class="ayet-ref" data-ayet="${a}" tabindex="0">${a}</span>`).join(" ");
  }

  function sureIpucu(ev, d) {
    tooltip.innerHTML = `<strong>${tt(d.ad)}</strong><span class="node-hover-tip__meta">${d.atifSayisi} ${tt({ tr: "atıf", en: "citation", pt: "citação" })}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }
  function babIpucu(ev, d) {
    tooltip.innerHTML = `<strong>${tt(d.title)}</strong><span class="node-hover-tip__meta">${d.atifSayisi} ${tt({ tr: "atıf", en: "citation", pt: "citação" })}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }
  function kenarIpucu(ev, d) {
    const s = sureByNo.get(d.sureNo), b = babById.get(d.view + "/" + d.id);
    tooltip.innerHTML = GU.edgeReasonHtml({
      title: (s ? tt(s.ad) : d.sureNo) + " → " + (b ? tt(b.title) : d.id),
      kindLabel: tt({ tr: "âyet atfı", en: "verse citation", pt: "citação de versículo" }),
      reason: ayetListHtml(d.ayetler),
    });
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function nav(view, id) {
    window.__dostNav && window.__dostNav.goTo(view, id);
  }

  function surePaneli(d) {
    focusSureNo = d.no;
    focusBabId = null;
    const ilgiliKenarlar = kenarlar.filter((k) => k.sureNo === d.no);
    const satirlar = ilgiliKenarlar.map((k) => {
      const b = babById.get(k.view + "/" + k.id);
      return `<button type="button" class="kuran-dokusu-satir" data-view="${k.view}" data-id="${k.id}">
        <span class="kuran-dokusu-satir__baslik">${b ? tt(b.title) : k.id}</span>
        <span class="kuran-dokusu-satir__ayet">${ayetListHtml(k.ayetler)}</span>
      </button>`;
    }).join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Sûre", en: "Sûrah", pt: "Surata" })} ${d.no}</p>
      <h2 class="detail-title">${tt(d.ad)}</h2>
      <p class="eser-agi-kimlik">${d.atifSayisi} ${tt({ tr: "atıf, ", en: "citations, ", pt: "citações, " })}${ilgiliKenarlar.length} ${tt({ tr: "bapta", en: "chapters", pt: "capítulos" })}</p>
      <div class="kuran-dokusu-satirlar">${satirlar}</div>`;
    detailPanel.hidden = false;
    detailContent.querySelectorAll(".kuran-dokusu-satir").forEach((btn) => {
      btn.addEventListener("click", () => nav(btn.dataset.view, btn.dataset.id));
    });
    vurgula(d.no, null, true);
  }

  function babPaneli(d) {
    focusBabId = d.view + "/" + d.id;
    focusSureNo = null;
    const ilgiliKenarlar = kenarlar.filter((k) => k.view === d.view && k.id === d.id);
    const satirlar = ilgiliKenarlar.map((k) => {
      const s = sureByNo.get(k.sureNo);
      return `<div class="kuran-dokusu-satir kuran-dokusu-satir--statik">
        <span class="kuran-dokusu-satir__baslik">${s ? tt(s.ad) : k.sureNo}</span>
        <span class="kuran-dokusu-satir__ayet">${ayetListHtml(k.ayetler)}</span>
      </div>`;
    }).join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${d.view === "futuhat" ? tt({ tr: "Fütûhât", en: "Futûhât", pt: "Futûhât" }) : tt({ tr: "Füsûs", en: "Fusûs", pt: "Fusûs" })}</p>
      <h2 class="detail-title">${tt(d.title)}</h2>
      <div class="kuran-dokusu-satirlar">${satirlar}</div>
      <button type="button" class="kuran-dokusu-git">${tt({ tr: "Bu bölüme git →", en: "Go to this part →", pt: "Ir para esta parte →" })}</button>`;
    detailPanel.hidden = false;
    detailContent.querySelector(".kuran-dokusu-git").addEventListener("click", () => nav(d.view, d.id));
    vurgula(null, focusBabId, true);
  }

  // Bu grafiğin gösterdiği fikrin (aynı âyet birden fazla bapta, her
  // seferinde farklı bir mertebeden okunuyor) ayrı, sürüklenebilir bir
  // sahnesi var (iki-mertebe.html) ama hiçbir yerden linklenmiyordu
  // (2026-08-04 taramasında ölçüldü). Giriş paneli en doğru yer.
  function ikiMertebeSahneHtml() {
    const base = window.__dostRouteBase || "";
    return `<div class="detail-gate detail-gate--sahne kuran-dokusu-sahne">
      <p class="detail-gate__note">${tt({
        tr: "Bu grafik hangi âyetin hangi bapta geçtiğini gösteriyor. Ayrı bir sahne, aynı âyetin iki bapta nasıl FARKLI mertebelerden okunduğunu yan yana koyuyor.",
        en: "This graph shows which verse appears in which chapter. A separate scene places side by side how the same verse is read from two DIFFERENT ranks across two chapters.",
        pt: "Este grafo mostra em qual capítulo cada versículo aparece. Uma cena separada coloca lado a lado como o mesmo versículo é lido a partir de duas categorias DIFERENTES em dois capítulos.",
      })}</p>
      <a class="detail-gate__btn" href="${base}/iki-mertebe.html">${tt({
        tr: "Sahneyi aç: Aynı Âyet, İki Mertebe",
        en: "Open the scene: Same Verse, Two Ranks",
        pt: "Abrir a cena: Mesmo Versículo, Duas Categorias",
      })}<span class="detail-gate__arrow" aria-hidden="true">→</span></a>
    </div>`;
  }

  function girisPaneli() {
    focusSureNo = null;
    focusBabId = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Kur'ân Dokusu", en: "The Qur'ânic Weave", pt: "A Trama Alcorânica" })}</p>
      <h2 class="detail-title">${sureler.length} ${tt({ tr: "sûre", en: "sûrahs", pt: "suratas" })}, ${bablar.length} ${tt({ tr: "bap", en: "chapters", pt: "capítulos" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>
      ${ikiMertebeSahneHtml()}`;
    detailPanel.hidden = false;
  }

  function ortala(animate) {
    if (!zoom) return;
    const hedef = animate && !reduceMotion ? svg.transition().duration(420) : svg;
    hedef.call(zoom.transform, d3.zoomIdentity);
  }

  let yuklendi = false;
  function yukle() {
    if (yuklendi) return Promise.resolve();
    const base = window.__dostRouteBase || "";
    const url = (base ? base + "/" : "") + "data/ibn-arabi/kuran-dokusu.json";
    return GU.fetchJson(url).then((d) => {
      data = d;
      sureler = (d.sureler || []).map((s) => Object.assign({}, s));
      bablar = (d.bablar || []).map((b) => Object.assign({}, b));
      kenarlar = d.kenarlar || [];
      sureByNo = new Map(sureler.map((s) => [s.no, s]));
      babById = new Map(bablar.map((b) => [b.view + "/" + b.id, b]));
      yuklendi = true;
      ciz();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("kuran-dokusu-recenter", () => ortala(true));
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("kuran-dokusu-wrap", () => {
      if (focusSureNo != null || focusBabId != null) { girisPaneli(); return true; }
      return false;
    });
    window.addEventListener("resize", () => {
      if (!yuklendi || wrapEl.hidden) return;
      ciz();
    });
  }

  return {
    activate() {
      baglaBirKez();
      yukle().then(() => { ciz(); girisPaneli(); }).catch(() => {
        const st = document.getElementById("kuran-dokusu-wrap-status");
        if (st) {
          st.hidden = false;
          st.querySelector(".view-status__text").textContent =
            tt({ tr: "Graf yüklenemedi.", en: "The graph could not be loaded.", pt: "O grafo não pôde ser carregado." });
        }
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      ciz();
      if (focusSureNo != null) {
        const d = sureByNo.get(focusSureNo);
        if (d) surePaneli(d); else girisPaneli();
      } else if (focusBabId != null) {
        const d = babById.get(focusBabId);
        if (d) babPaneli(d); else girisPaneli();
      } else girisPaneli();
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = sureByNo.get(parseInt(id, 10));
        if (d) surePaneli(d);
      });
    },
  };
})();
