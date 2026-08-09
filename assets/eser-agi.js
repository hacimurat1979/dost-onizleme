// Eser Ağı — Dost'un eserlerinin kronolojik zaman çizelgesi (docs/icerik-
// yol-haritasi.md D7). Roadmap'in "gerçek kenarları olan ilk graf" isteği:
// düğümler (eserler) MIAS'ın kendi tarih/şehir verisinden, kenarlar (aynı
// şehirde art arda yazılan eserler) yine o veriden -- hiçbiri uydurma değil.
//
// NEDEN ZAMAN ÇİZELGESİ (2026-08-06, kullanıcı bulgusu -- sarmal karışık
// görünüyordu). Görünüm bir sarmaldı: yarıçap = yıl, açı = sıra. CLAUDE.md'nin
// daire/merkez ilkesine uyuyordu ama 28 eserlik seyrek, kümelenmiş bir
// veride (dört yılda üçer eser birden var) okunması zorlaşıyordu. Kullanıcı
// doğrudan "modern bir timeline" istedi -- CLAUDE.md'nin kendisi de
// "bir öğe doğası gereği dairesel değilse zorla daireye sokma" diyor, ve
// bir kronoloji doğası gereği DOĞRUSAL. Tek dikey bir omurga, sırayla
// eşit aralıklı 28 satır (yıla ORANTILI değil, SIRAYA göre -- kümelenmiş
// yılların üst üste binmesini önler), her satırda yıl solda, eser adı
// sağda. Kenarlar (aynı şehir zinciri) omurga üzerinde renkli bir parça
// olarak kalıyor -- görsel olarak hâlâ "ardışık" okunuyor, şimdi konum
// sarmaldaki açı değil, listedeki sıra.
window.__eserAgiApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const svg = d3.select("#eser-agi-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("eser-agi-wrap");
  const tooltip = document.getElementById("eser-agi-tooltip");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");

  if (!svgNode || !wrapEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  function tt(dict) { return I18n.pick3(dict || {}); }

  // Satır aralığı SIRAYA göre eşit -- yıla orantılı olsaydı 1203/1205/1229
  // gibi aynı yılda üç eser birden yazılan kümeler üst üste binerdi.
  const ROW_H = 58;
  const TOP_PAD = 36;
  const BOTTOM_PAD = 36;

  let data = null;
  let eserler = [];
  let baglar = [];
  let eserById = new Map();
  let zoom = null;
  let g = null;
  let focusId = null;
  let focusEdge = null;
  let spineX = 90;
  let contentH = 0;
  let contentW = 0;
  let contentX0 = 0;

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(360, r.width), h: Math.max(360, r.height) };
  }

  function yerlestir() {
    const { w, h } = boyut();
    spineX = Math.max(56, Math.min(140, w * 0.22));
    eserler.forEach((d, i) => {
      d.x = spineX;
      d.y = TOP_PAD + i * ROW_H;
      d.yilYeni = i === 0 || d.yil.miladi !== eserler[i - 1].yil.miladi;
    });
    contentH = TOP_PAD + Math.max(0, eserler.length - 1) * ROW_H + BOTTOM_PAD;
    return { w, h };
  }

  function omurgaYolu() {
    if (!eserler.length) return "";
    const ilk = eserler[0], son = eserler[eserler.length - 1];
    return `M${spineX},${ilk.y} L${spineX},${son.y}`;
  }

  function ciz() {
    const { w, h } = yerlestir();
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    g = svg.append("g").attr("class", "eser-agi-scene");
    const kok = g.append("g");

    kok.append("path").attr("class", "eser-agi-omurga").attr("d", omurgaYolu()).attr("fill", "none");

    // Kenarlar (aynı şehir zinciri) -- omurganın kendi çizgisi üzerinde,
    // kaynaktan hedefe kısa DİKEY bir parça. Ardışıklık artık sarmaldaki
    // açı değil, listedeki sıradır.
    const kenarG = kok.append("g").attr("class", "eser-agi-kenarler");
    const kenarSel = kenarG.selectAll("line.eser-agi-kenar").data(baglar, (d, i) => d.kaynak_id + "|" + i).join("line")
      .attr("class", "eser-agi-kenar")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => edgeAriaLabel(d))
      .attr("x1", (d) => eserById.get(d.kaynak_id).x).attr("y1", (d) => eserById.get(d.kaynak_id).y)
      .attr("x2", (d) => eserById.get(d.hedef_id).x).attr("y2", (d) => eserById.get(d.hedef_id).y);

    kenarSel.on("mouseenter", function (ev, d) { vurgulaKenar(d, true); kenarIpucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgulaKenar(null, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgulaKenar(d, true); })
      .on("blur", function () { vurgulaKenar(null, false); })
      .on("click", (ev, d) => kenarPaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); kenarPaneli(d); }
      });

    const dugumG = kok.append("g").attr("class", "eser-agi-dugumler");
    const sel = dugumG.selectAll("g.eser-agi-eser").data(eserler, (d) => d.id).join("g")
      .attr("class", (d) => "eser-agi-eser" + (d.ozel === "katalog" ? " eser-agi-eser--katalog" : ""))
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => d.eser);

    const R = 7;
    sel.append("circle").attr("class", "eser-agi-eser__vurus").attr("r", R + 9).attr("fill", "transparent");

    sel.each(function (d) {
      const node = d3.select(this);
      if (d.ozel === "katalog") {
        node.append("path").attr("class", "eser-agi-eser__sekil")
          .attr("d", `M0,${-R * 1.2} L${R * 1.2},0 L0,${R * 1.2} L${-R * 1.2},0 Z`);
      } else {
        node.append("circle").attr("class", "eser-agi-eser__sekil").attr("r", R);
      }
    });

    // Yıl yalnız bir önceki satırdan farklıysa yazılıyor -- aynı yılda
    // yazılmış üç eserin yılı üç kez tekrarlanmasın diye.
    sel.filter((d) => d.yilYeni).append("text").attr("class", "eser-agi-eser__yil")
      .attr("text-anchor", "end")
      .attr("x", -(R + 9))
      .attr("y", 4)
      .text((d) => (d.yil.hicri ? d.yil.hicri + "/" : "") + d.yil.miladi);

    sel.append("text").attr("class", "eser-agi-eser__etiket")
      .attr("text-anchor", "start")
      // x, "vurus" görünmez tıklama dairesinin (r=R+9) yarıçapını AŞMIYOR --
      // eskiden R+12 idi, R+9'luk daireden 3 birim dışarıda kalıyordu ve
      // fare o dar şeritte ne daireye ne yazının kendi mürekkebine değiyordu
      // (UI denetimi bulgusu, ~1-2px tıklanamayan boşluk).
      .attr("x", R + 9)
      .attr("y", 4)
      .text((d) => kisalt(d.eser, 34));

    sel.on("mouseenter", function (ev, d) { vurgulaEser(d.id, true); ipucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function () { vurgulaEser(null, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgulaEser(d.id, true); })
      .on("blur", function () { vurgulaEser(null, false); })
      .on("click", (ev, d) => eserPaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); eserPaneli(d); }
      });

    // Etiketlerin gerçek genişliği (yıl sütunu solda, eser adı sağda) ölçmeden
    // önce bilinmiyor -- futuhat.js'in radyal ağacındaki aynı yöntem: tahmin
    // etmek yerine getBBox() ile ölç. ortala()'nın eskiden yalnız YÜKSEKLİĞE
    // göre sığdırması, geniş+kısa bir kapsayıcıda dar+uzun içeriği sola
    // sıkışmış minik bir sütun bırakıyordu (UI denetimi bulgusu).
    try {
      const bb = kok.node().getBBox();
      contentW = bb.width;
      contentX0 = bb.x;
    } catch (e) {
      contentW = spineX + 260;
      contentX0 = -(spineX);
    }

    // 2026-08-09 kullanıcı bulgusu: "sadece 5 düğüm görünüyor, sayfaya
    // sığmıyor". Kök neden küçüklük değildi -- ortala() zaten yalnız
    // GENİŞLİĞE göre sığdırıyor (küçültmüyor), ama 28 satırlık omurga
    // (~1600px) kapsayıcıdan (~500-700px) çok daha uzun ve GU'nun paylaşılan
    // zoom filtresi düz tekerleği bilerek yakalamıyor (sayfanın kendi
    // kaydırması için serbest bırakılıyor) -- ama bu görünüm `overflow:
    // hidden` bir kutunun içinde, "sayfa" diye bir şey yok. Tek yol
    // sürükleyerek kaydırmaktı ve keşfedilebilir değildi. Aşağıdaki
    // wheel dinleyicisi düz tekerleği bu görünüme özel bir dikey kaydırmaya
    // çeviriyor; translateExtent de sürüklemeyi (ve yeni kaydırmayı)
    // içerik sınırlarında tutuyor (eskiden sınırsızdı, kullanıcı içeriği
    // sürükleyip kaybedebilirdi).
    zoom = GU.createZoomBehavior(svg, g, [0.25, 3.5], null, { allowSingleTouchPan: true });
    const pad = 48;
    zoom.translateExtent([
      [contentX0 - pad, -pad],
      [contentX0 + contentW + pad, contentH + pad],
    ]);
    ortala(false);
  }

  // Düz tekerlek = bu listede dikey kaydırma (esma.js'teki "düz tekerlek =
  // anlamlı bir hareket, Ctrl+tekerlek = klasik yakınlaştırma" kuralıyla
  // aynı ayrım). Ctrl/Cmd basılıyken GU'nun kendi "wheel.zoom" dinleyicisi
  // zaten devrede; burada erken çıkılıp ona karışılmıyor.
  function tekerlekleKaydir(e) {
    if (e.ctrlKey || e.metaKey) return;
    if (!zoom) return;
    e.preventDefault();
    const t = d3.zoomTransform(svgNode);
    zoom.translateBy(svg, 0, -e.deltaY / t.k);
  }

  function kisalt(s, n) {
    if (!s) return "";
    if (s.length <= n) return s;
    const kes = s.slice(0, n);
    const i = kes.lastIndexOf(" ");
    return (i > 8 ? kes.slice(0, i) : kes) + "…";
  }

  function vurgulaEser(id, on) {
    if (!g) return;
    g.selectAll("g.eser-agi-eser").classed("eser-agi-eser--deginiliyor", (d) => on && d.id === id);
  }
  function vurgulaKenar(d, on) {
    if (!g) return;
    g.selectAll("line.eser-agi-kenar").classed("eser-agi-kenar--deginiliyor", (l) => on && l === d);
  }

  function ipucu(ev, d) {
    tooltip.innerHTML =
      `<strong>${d.eser}</strong>` +
      `<span class="node-hover-tip__meta">${tt(d.sehir)} · ${d.yil.hicri ? d.yil.hicri + "/" : ""}${d.yil.miladi}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function edgeAriaLabel(d) {
    const a = eserById.get(d.kaynak_id), b = eserById.get(d.hedef_id);
    return (a ? a.eser : d.kaynak_id) + " → " + (b ? b.eser : d.hedef_id) + " — " + tt({ tr: "aynı şehir", en: "same city", pt: "mesma cidade" });
  }

  function kenarIpucu(ev, d) {
    const a = eserById.get(d.kaynak_id), b = eserById.get(d.hedef_id);
    tooltip.innerHTML = GU.edgeReasonHtml({
      title: (a ? a.eser : d.kaynak_id) + " → " + (b ? b.eser : d.hedef_id),
      kindLabel: tt({ tr: "aynı şehir", en: "same city", pt: "mesma cidade" }),
      reason: tt(d.neden),
    });
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function eserPaneli(d) {
    focusId = d.id;
    focusEdge = null;
    const katalogRozet = d.ozel === "katalog"
      ? `<span class="eser-agi-rozet">${tt({ tr: "katalog", en: "catalogue", pt: "catálogo" })}</span>` : "";
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(d.sehir)}${katalogRozet}</p>
      <h2 class="detail-title">${d.eser}</h2>
      <p class="eser-agi-kimlik">${d.yil.hicri ? d.yil.hicri + "/" : ""}${d.yil.miladi}${d.yil.kesin ? "" : " " + tt({ tr: "(yaklaşık)", en: "(approximate)", pt: "(aproximado)" })}</p>
      <div class="detail-block detail-block--soru"><p>${tt(d.aciklama)}</p></div>
      <p class="elestiri-kaynak-satiri">${data.kaynak.yazar}, <em>${data.kaynak.eser}</em></p>`;
    detailPanel.hidden = false;
    vurgulaEser(d.id, true);
  }

  function kenarPaneli(b) {
    focusEdge = b;
    focusId = null;
    const a = eserById.get(b.kaynak_id), h = eserById.get(b.hedef_id);
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Bağ", en: "Connection", pt: "Ligação" })}
        <span class="eser-agi-rozet">${tt({ tr: "aynı şehir", en: "same city", pt: "mesma cidade" })}</span></p>
      <h2 class="detail-title">${a ? a.eser : b.kaynak_id} → ${h ? h.eser : b.hedef_id}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(b.neden)}</p></div>`;
    detailPanel.hidden = false;
    vurgulaKenar(b, true);
  }

  function girisPaneli() {
    focusId = null;
    focusEdge = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Eser Ağı", en: "The Works Timeline", pt: "A Linha do Tempo das Obras" })}</p>
      <h2 class="detail-title">${eserler.length} ${tt({ tr: "eser", en: "works", pt: "obras" })}, ${baglar.length} ${tt({ tr: "bağ", en: "connections", pt: "ligações" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>
      <p class="elestiri-kaynak-satiri elestiri-kaynak-satiri--omurga">${data.kaynak.yazar}, <em>${data.kaynak.eser}</em></p>`;
    detailPanel.hidden = false;
  }

  // Kimlik dönüşümü (d3.zoomIdentity) sarmalda işe yarıyordu çünkü sahne
  // zaten container'a sığacak şekilde ölçeklenmişti (R_MAX = min(w,h)*.42).
  // Dikey listede içerik SADECE yüksekliğe göre sığdırılınca (eski kod),
  // kapsayıcı geniş+kısa olduğunda ölçek küçülüyor ve zaten dar olan içerik
  // (bir omurga + tek satır etiket) sola sıkışmış minik bir sütuna dönüyordu
  // (UI denetimi bulgusu, foto: "eser ağı grafiği solda çok küçük"). Asıl
  // ölçü artık GENİŞLİK -- içerik kapsayıcının kullanılabilir genişliğinin
  // çoğunu kaplasın ve YATAYDA ortalansın; 28 satırın hepsi tek ekranda
  // sığmayabilir ama zaten sürüklenerek dikey gezinme var.
  // 68px üst boşluk bilerek sabit: recenter+hint düğmeleri sol üstte
  // top:12/left:12-108 bandını kaplıyor (bkz. style.css .graph-recenter/
  // .graph-hint) -- ilk satır oraya denk gelirse tıklanamaz hâle geliyordu
  // (Playwright'ta ölçüldü, 2026-08-06).
  function ortala(animate) {
    if (!zoom) return;
    const { w, h } = boyut();
    const availW = Math.max(120, w - 48);
    const k = Math.max(0.6, Math.min(1.8, availW / Math.max(1, contentW)));
    const tx = Math.max(24, (w - contentW * k) / 2 - contentX0 * k);
    const ty = Math.max(68, (h - contentH * k) / 2);
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);
    const hedef = animate && !reduceMotion ? svg.transition().duration(420) : svg;
    hedef.call(zoom.transform, t);
  }

  let yuklendi = false;
  function yukle() {
    if (yuklendi) return Promise.resolve();
    const base = window.__dostRouteBase || "";
    const url = (base ? base + "/" : "") + "data/ibn-arabi/eser-agi.json";
    return GU.fetchJson(url).then((d) => {
      data = d;
      // Satır sırası doğrudan yıla dayanıyor artık (bkz. yerlestir()) --
      // veri zaten kronolojik ama sırayı veriye bırakmak yerine burada
      // garanti ediyoruz.
      eserler = (d.eserler || []).map((e) => Object.assign({}, e))
        .sort((a, b) => a.yil.miladi - b.yil.miladi);
      baglar = d.baglar || [];
      eserById = new Map(eserler.map((e) => [e.id, e]));
      yuklendi = true;
      ciz();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("eser-agi-recenter", () => ortala(true));
    svgNode.addEventListener("wheel", tekerlekleKaydir, { passive: false });
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("eser-agi-wrap", () => {
      if (focusId || focusEdge) { girisPaneli(); return true; }
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
      // her açılışta otomatik gösteriliyordu -- artık yalnız bir eser/bağ
      // seçildiğinde açılıyor (bkz. hocalar.js'teki aynı düzeltme).
      baglaBirKez();
      yukle().then(() => { ciz(); }).catch(() => {
        const st = document.getElementById("eser-agi-wrap-status");
        if (st) {
          st.hidden = false;
          st.querySelector(".view-status__text").textContent =
            tt({ tr: "Ağ yüklenemedi.", en: "The network could not be loaded.", pt: "A rede não pôde ser carregada." });
        }
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      ciz();
      if (focusId) {
        const d = eserById.get(focusId);
        if (d) eserPaneli(d); else if (!detailPanel.hidden) girisPaneli();
      } else if (focusEdge) {
        kenarPaneli(focusEdge);
      } else if (!detailPanel.hidden) girisPaneli();
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = eserById.get(id);
        if (d) eserPaneli(d);
      });
    },
  };
})();
