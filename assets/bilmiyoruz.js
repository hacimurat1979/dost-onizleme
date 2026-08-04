// Bilmiyoruz — sitenin açıkça bilmediğini/tartışmalı olduğunu ilan ettiği
// maddelerin halkası (docs/icerik-yol-haritasi.md D20).
//
// NEDEN BU BİÇİM (GORSEL_DIL.md: "kavramı resmetme, davranışını resmet").
// acik-sorular.js'in aynı yay-boşluk idiomunu kullanıyor (CLAUDE.md'nin
// daire/merkez ilkesiyle tutarlı, sitede zaten kanıtlanmış bir dil) ama
// AYRI bir davranışı taşıyor: açık sorular kanıt biriktikçe çentiklenir,
// burada öyle bir "kanıt sayımı" yok -- bir maddenin boşluğu SADECE onun
// `durum`una göre sabit (tartismali en geniş, bizim_sinirimiz en dar),
// çünkü burada ölçülen şey bizim okuma kaydımızdaki iz sayısı değil,
// maddenin KENDİ doğasının ne kadar kapanabilir olduğu.
//
// ETKILESIM_DILI.md sözleşmesi: değinmek (hover) = ipucu; seçmek
// (tıklama) = panel; bir adım geri (ESC) = panelden halkaya. Bağlanmamış
// düğme yok -- #bilmiyoruz-recenter GU.wireRecenter ile gerçekten bağlı.
window.__bilmiyoruzApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const svg = d3.select("#bilmiyoruz-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("bilmiyoruz-wrap");
  const tooltip = document.getElementById("bilmiyoruz-tooltip");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");

  if (!svgNode || !wrapEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  function tt(dict) { return I18n.pick3(dict || {}); }

  // Boşluk açısı = maddenin durumuna göre sabit -- acik-sorular'daki gibi
  // "kanıt arttıkça daralan" değil, TÜRE bağlı: tartışmalı bir mesele
  // (alanın kendisi anlaşmamış) en geniş boşluğu, bizim sınırımız (ileride
  // araştırmayla kapanabilir) en dar boşluğu alıyor.
  const BOSLUK = { tartismali: 108, belirsiz: 76, bizim_sinirimiz: 48 };
  const DURUM_VAR = {
    tartismali: "--series-kemal",
    belirsiz: "--series-theme",
    bizim_sinirimiz: "--muted",
  };

  let data = null;
  let nodes = [];
  let zoom = null;
  let g = null;
  let focusId = null;

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(320, r.width), h: Math.max(320, r.height) };
  }

  function yayYolu(r, bosluk) {
    const yariAcik = (360 - bosluk) / 2;
    const a0 = (-90 + bosluk / 2) * Math.PI / 180;
    const a1 = (-90 + bosluk / 2 + yariAcik * 2) * Math.PI / 180;
    const x0 = r * Math.cos(a0), y0 = r * Math.sin(a0);
    const x1 = r * Math.cos(a1), y1 = r * Math.sin(a1);
    const buyuk = 360 - bosluk > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${buyuk} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  function yerlestir() {
    const { w, h } = boyut();
    const R = Math.min(w, h) * 0.36;
    const n = nodes.length;
    nodes.forEach((d, i) => {
      const a = (-Math.PI / 2) + (i / n) * Math.PI * 2;
      d.x = Math.cos(a) * R;
      d.y = Math.sin(a) * R;
    });
  }

  function ciz() {
    svg.selectAll("*").remove();
    const { w, h } = boyut();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    g = svg.append("g").attr("class", "bilmiyoruz-scene");
    const kok = g.append("g").attr("transform", `translate(${w / 2}, ${h / 2})`);

    // Merkez: bir cevap değil, bir sayı -- acik-sorular'daki aynı imge,
    // burada "kaç madde açık" yerine "kaç sınır işaretlendi".
    const merkez = kok.append("g").attr("class", "bilmiyoruz-merkez");
    merkez.append("circle").attr("r", 46).attr("class", "bilmiyoruz-merkez__halka");
    merkez.append("text").attr("class", "bilmiyoruz-merkez__sayi")
      .attr("text-anchor", "middle").attr("dy", "-0.05em").text(nodes.length);
    merkez.append("text").attr("class", "bilmiyoruz-merkez__etiket")
      .attr("text-anchor", "middle").attr("dy", "1.5em")
      .text(tt({ tr: "sınır işaretli", en: "limits marked", pt: "limites marcados" }));

    const sel = kok.selectAll("g.bilmiyoruz-madde").data(nodes, (d) => d.id).join("g")
      .attr("class", "bilmiyoruz-madde")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => tt(d.baslik));

    const R = 27;

    sel.append("circle")
      .attr("class", "bilmiyoruz-madde__vurus")
      .attr("r", R + 7)
      .attr("fill", "transparent");

    sel.append("path")
      .attr("class", (d) => "bilmiyoruz-madde__yay bilmiyoruz-madde__yay--" + d.durum)
      .attr("d", (d) => yayYolu(R, BOSLUK[d.durum] || 90))
      .attr("stroke", (d) => GU.getVar(DURUM_VAR[d.durum] || "--muted"));

    sel.append("text").attr("class", "bilmiyoruz-madde__ikon")
      .attr("text-anchor", "middle").attr("dy", "0.35em").text("?");

    sel.append("text").attr("class", "bilmiyoruz-madde__etiket")
      .attr("text-anchor", (d) => (d.x > 6 ? "start" : d.x < -6 ? "end" : "middle"))
      .attr("x", (d) => (d.x > 6 ? R + 8 : d.x < -6 ? -(R + 8) : 0))
      .attr("y", (d) => (Math.abs(d.x) > 6 ? 4 : (d.y >= 0 ? R + 16 : -(R + 10))))
      .text((d) => kisalt(tt(d.baslik), 30));

    sel.on("mouseenter", function (ev, d) { vurgula(d.id, true); ipucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function (ev, d) { vurgula(d.id, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgula(d.id, true); })
      .on("blur", function (ev, d) { vurgula(d.id, false); })
      .on("click", (ev, d) => panelGoster(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); panelGoster(d); }
      });

    zoom = GU.createZoomBehavior(svg, g, [0.5, 3]);
    ortala(false);
  }

  function kisalt(s, n) {
    if (!s) return "";
    if (s.length <= n) return s;
    const kes = s.slice(0, n);
    const i = kes.lastIndexOf(" ");
    return (i > 12 ? kes.slice(0, i) : kes) + "…";
  }

  function vurgula(id, on) {
    if (!g) return;
    g.selectAll("g.bilmiyoruz-madde").classed("bilmiyoruz-madde--deginiliyor", (d) => on && d.id === id);
  }

  function ipucu(ev, d) {
    const durum = data.durumlar[d.durum] || {};
    const kategori = data.kategoriler[d.kategori] || {};
    tooltip.innerHTML =
      `<strong>${tt(d.baslik)}</strong>` +
      `<span class="node-hover-tip__meta">${tt(kategori)} · ${tt(durum)}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function kaynaklarHtml(d) {
    if (!d.kaynaklar || !d.kaynaklar.length) return "";
    const rows = d.kaynaklar.map((k) => {
      const yil = k.yil ? ", " + k.yil : "";
      const not = k.not ? ` <span class="bilmiyoruz-madde__kaynak-not">— ${k.not}</span>` : "";
      return `<li class="bilmiyoruz-madde__kaynak">${k.yazar}, <em>${k.eser}</em>${yil}${not}</li>`;
    }).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Kaynaklar", en: "Sources", pt: "Fontes" })}</p>
            <ul class="bilmiyoruz-madde__kaynaklar">${rows}</ul>`;
  }

  function baglarHtml(d) {
    if (!d.baglar || !d.baglar.length) return "";
    const rows = d.baglar.map((b) =>
      `<a class="acik-soru__bag" href="#/${b.view}/${b.id}">${b.id.replace(/-/g, " ")}</a>`).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Nereye dokunuyor", en: "What it touches", pt: "O que toca" })}</p>
            <div class="acik-soru__baglar">${rows}</div>`;
  }

  function panelGoster(d) {
    focusId = d.id;
    const durum = data.durumlar[d.durum] || {};
    const kategori = data.kategoriler[d.kategori] || {};
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(kategori)}
        <span class="bilmiyoruz-madde__durum bilmiyoruz-madde__durum--${d.durum}">${tt(durum)}</span></p>
      <h2 class="detail-title">${tt(d.baslik)}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(d.aciklama)}</p></div>
      ${kaynaklarHtml(d)}
      ${baglarHtml(d)}`;
    detailPanel.hidden = false;
    vurgula(d.id, true);
  }

  function girisPaneli() {
    focusId = null;
    const satirlar = nodes.map((d) => {
      const durum = data.durumlar[d.durum] || {};
      return `<button class="acik-soru-satir" type="button" data-id="${d.id}">
         <span class="bilmiyoruz-madde__durum bilmiyoruz-madde__durum--${d.durum}">${tt(durum)}</span>
         <span>${tt(d.baslik)}</span>
       </button>`;
    }).join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Bilmiyoruz", en: "We Don't Know", pt: "Não Sabemos" })}</p>
      <h2 class="detail-title">${nodes.length} ${tt({ tr: "sınır işaretlendi", en: "limits marked", pt: "limites marcados" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>
      <div class="acik-soru-liste">${satirlar}</div>`;
    detailContent.querySelectorAll(".acik-soru-satir").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = nodes.find((x) => x.id === btn.dataset.id);
        if (d) panelGoster(d);
      });
    });
    detailPanel.hidden = false;
  }

  function ortala(animate) {
    if (!zoom) return;
    const hedef = animate && !reduceMotion
      ? svg.transition().duration(420)
      : svg;
    hedef.call(zoom.transform, d3.zoomIdentity);
  }

  let yuklendi = false;
  function yukle() {
    if (yuklendi) return Promise.resolve();
    const base = window.__dostRouteBase || "";
    const url = (base ? base + "/" : "") + "data/ibn-arabi/bilmiyoruz.json";
    return GU.fetchJson(url).then((d) => {
      data = d;
      nodes = (d.maddeler || []).map((s) => Object.assign({}, s));
      yuklendi = true;
      yerlestir();
      ciz();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("bilmiyoruz-recenter", () => ortala(true));
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("bilmiyoruz-wrap", () => {
      if (focusId) { girisPaneli(); return true; }
      return false;
    });
    window.addEventListener("resize", () => {
      if (!yuklendi || wrapEl.hidden) return;
      yerlestir(); ciz();
    });
  }

  return {
    activate() {
      baglaBirKez();
      yukle().then(() => {
        yerlestir(); ciz(); girisPaneli();
      }).catch(() => {
        const st = document.getElementById("bilmiyoruz-wrap-status");
        if (st) {
          st.hidden = false;
          st.querySelector(".view-status__text").textContent =
            tt({ tr: "Maddeler yüklenemedi.", en: "The items could not be loaded.", pt: "Os itens não puderam ser carregados." });
        }
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      ciz();
      if (focusId) {
        const d = nodes.find((x) => x.id === focusId);
        if (d) panelGoster(d); else girisPaneli();
      } else girisPaneli();
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = nodes.find((x) => x.id === id);
        if (d) panelGoster(d);
      });
    },
  };
})();
