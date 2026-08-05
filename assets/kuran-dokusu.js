// Kur'ân Dokusu — sûre↔bab atıf grafı (docs/icerik-yol-haritasi.md D10).
//
// KAPSAM (bkz. data/ibn-arabi/kuran-dokusu.json'un "not" alanı, aynı metin
// giriş panelinde de gösteriliyor): bu graf Fütûhât'ın orijinal Arapça
// metninin tam taramasından değil, sitenin kendi özet metinlerinde
// işaretlediğimiz âyet atıflarından üretildi -- Chodkiewicz'in tezinin bir
// kanıtı değil, okuma sürecimizin küçük bir izi.
//
// YERLEŞIM. CLAUDE.md'nin daire/merkez ilkesi + roadmap'in kendi isteği
// ("sûreler dış halka, bablar iç halka, kenarlar merkeze doğru").
//
// Sûre düğümleri KUR'ÂN SIRASINDA ama EŞİT ARALIKLA diziliyor. Önceki iki
// deneme de başarısızdı ve ikisi de aynı nedenden:
//   1) Düğümler gerçek Kur'ân açılarındaydı (no/114). Atıflar ilk yarıdaki
//      uzun sûrelerde toplandığı için 12 sûre çemberin tepesinde ~38
//      dereceye sıkışıyor, ETİKETLERİ birbirinin üstüne biniyordu:
//      "Fâtiha / …i İmrân / …âm / A'râf / fâl / Tevbe" okunmuyordu.
//   2) Buna 114 konumun tamamını soluk iz olarak çizerek cevap vermiştim.
//      Halka doldu ama asıl şikâyet -- okunmayan etiketler -- olduğu gibi
//      kaldı. Yanlış problemi çözmüştüm.
// Şimdi açı sıradan geliyor, aralık sabit. Kazanılan: 35 etiket de okunuyor.
// KAYBEDİLEN, açıkça söylenmeli: aralık artık bilgi taşımıyor. İki komşu
// düğüm arasındaki mesafe "aralarında kaç sûre var" demiyor; sıra doğru,
// ölçek değil. Bu yüzden 114 konumun soluk izleri de kaldırıldı -- düğüm
// kendi izinin üstünde durmadığı için o halka artık yanıltıcı olurdu.
// Kapsam (114'ün 35'i) grafiğin ipucu metninde yazıyor; bir sayı olarak
// söylemek, aralıktan göz kararı okutmaktan zaten daha dürüst.
//
// Etiketler yarıçap yönünde, düğümün açısına döndürülerek yazılıyor. Eşit
// aralıkla birlikte çakışmayı bitiren şey bu: teğet yönde ~70 piksel yer
// varken satır yüksekliği ~12 piksel.
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

  let data = null;
  let sureler = [];
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

  // Etiketler yarıçap yönünde uzadığı için halkanın yarıçapı tek başına
  // ekrana sığmaya yetmiyor: en uzun sûre adı dışarı taşıyor. İlk denemede
  // eski sabit 0.44 oranını bıraktım ve "The Night Journey" gibi uzun
  // adlar tepede/dipte kırpıldı. Onun yerine en uzun etiketi ÖLÇÜP halkayı
  // ona göre daraltıyoruz -- dil değişince de doğru kalsın diye (İngilizce
  // sûre adları Türkçelerden belirgin uzun).
  function enUzunEtiketGenisligi() {
    const olcu = svg.append("text")
      .attr("class", "kuran-dokusu-sure__etiket")
      .attr("visibility", "hidden");
    let en = 0;
    sureler.forEach((s) => {
      olcu.text(tt(s.ad));
      en = Math.max(en, olcu.node().getComputedTextLength() || 0);
    });
    olcu.remove();
    // Görünüm henüz gizliyken ölçüm 0 dönebiliyor; o durumda karakter
    // başına kaba bir tahmine düşüyoruz. Kırpılmaktansa fazladan daralsın.
    if (!en) en = sureler.reduce((a, s) => Math.max(a, tt(s.ad).length), 0) * 6;
    return en;
  }

  // Etikete kalan yatay yer (piksel). Dar ekranda halkayı sonsuza kadar
  // küçültemeyiz -- 0.22 tabanı var -- ve o tabanda uzun bir İngilizce ad
  // ekranı taşırıyor (390 pikselde "Those who set the Ranks" ölçüldü).
  // Taşmaktansa kısaltıyoruz; tam ad `aria-label`de ve ipucunda duruyor.
  let etiketAlani = Infinity;

  function yerlestir() {
    const { w, h } = boyut();
    const kucuk = Math.min(w, h);
    // pay = etiket genişliği + en büyük düğüm yarıçapı + etiket boşluğu + nefes
    const pay = enUzunEtiketGenisligi() + 12 + 7 + 10;
    const R_OUTER = Math.max(kucuk * 0.22, Math.min(kucuk * 0.44, kucuk / 2 - pay));
    const R_INNER = R_OUTER * 0.545;
    etiketAlani = kucuk / 2 - R_OUTER - 12 - 7 - 6;

    // Kur'ân sırasına göre, eşit aralıkla. Sıra veriden geldiği gibi
    // varsayılmıyor: dizilim yanlışsa graf sessizce yanlış olur.
    const sirali = sureler.slice().sort((a, b) => a.no - b.no);
    const maxSureAtif = Math.max(...sureler.map((s) => s.atifSayisi));
    sirali.forEach((s, i) => {
      const a = -Math.PI / 2 + (i / sirali.length) * 2 * Math.PI;
      s.aci = a;
      s.x = Math.cos(a) * R_OUTER;
      s.y = Math.sin(a) * R_OUTER;
      s.r = 4 + (s.atifSayisi / maxSureAtif) * 8;
    });

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
    // Tek bir gizli ölçüm düğümü: 35 etiketi tek tek düğüm yaratmadan
    // ölçüyoruz. getComputedTextLength görünmeyen bir SVG'de 0 döner --
    // o durumda kısaltma da yapmıyoruz (yanlış kısaltmaktansa kısaltmamak).
    const olcu = svg.append("text")
      .attr("class", "kuran-dokusu-sure__etiket").attr("visibility", "hidden");
    const genislik = (s) => { olcu.text(s); return olcu.node().getComputedTextLength() || 0; };
    function sigdir(metin) {
      const tam = genislik(metin);
      if (!tam || tam <= etiketAlani) return metin;
      let alt = 1, ust = metin.length;
      while (alt < ust) {
        const orta = Math.ceil((alt + ust) / 2);
        if (genislik(metin.slice(0, orta) + "…") <= etiketAlani) alt = orta; else ust = orta - 1;
      }
      return metin.slice(0, alt).trim() + "…";
    }

    // Etiket yarıçap yönünde. Sol yarıda metin ters duracağı için 180
    // derece çevirip sağa değil sola doğru yazıyoruz ("end" hizası) --
    // döndürmenin işareti değişiyor, etiketin dışa doğru gitmesi değişmiyor.
    sureSel.append("text").attr("class", "kuran-dokusu-sure__etiket")
      .attr("transform", (d) => {
        const derece = (d.aci * 180) / Math.PI;
        const uzaklik = d.r + 7;
        return Math.cos(d.aci) < 0
          ? `rotate(${derece + 180}) translate(${-uzaklik},0)`
          : `rotate(${derece}) translate(${uzaklik},0)`;
      })
      .attr("text-anchor", (d) => (Math.cos(d.aci) < 0 ? "end" : "start"))
      .attr("dy", "0.32em")
      .text((d) => sigdir(tt(d.ad)));
    olcu.remove();

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
