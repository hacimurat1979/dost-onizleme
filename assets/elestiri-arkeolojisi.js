// Eleştiri Arkeolojisi — Dost'a yöneltilen eleştiri/savunmaları cevaplamadan
// önce haritalıyoruz (docs/icerik-yol-haritasi.md D4). Omurga: Alexander D.
// Knysh, "Ibn 'Arabi in the Later Islamic Tradition" (1999).
//
// NEDEN BU BİÇİM. Diğer yeni görünümlerden (Bilmiyoruz'un yay-halkası)
// FARKLI: burada asıl anlatılan şey bir "ne kadar biliyoruz" ölçüsü değil,
// KİŞİLER ARASI BİR AĞ -- kim kimin öğrencisiydi,
// kim kime cevap yazdı, kim kimin himayesindeydi. GORSEL_DIL.md'nin "davranışı
// resmet" kuralı burada şöyle okunuyor: eksen SÜSLİ bir düzen değil, gerçek
// bir zaman çizelgesi (x = ölüm yılı) ve gerçek bir coğrafya (y = bölge) --
// yani düğümlerin YERİ bile kaynaktan geliyor, rastgele bir graf-düzeni değil.
//
// ETKILESIM_DILI.md sözleşmesi diğer graf görünümleriyle birebir aynı:
// değinmek (hover) = ipucu (düğüm İÇİN kısa özet, kenar İÇİN gerekçenin ilk
// cümlesi -- bkz. GU.edgeReasonHtml, ontology.js'teki aynı desen); seçmek
// (tıklama) = panel; bir adım geri (ESC) = panelden ağa. Bağlanmamış düğme
// yok -- #elestiri-arkeolojisi-recenter GU.wireRecenter ile gerçekten bağlı.
window.__elestiriArkeolojisiApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  // yerlestir()'in satır ataması aynı banttaki DÜĞÜMLERİN üst üste
  // binmesini önlüyor (ölüm yılına göre), ama ETİKETLERİN kendisi hâlâ
  // çakışabiliyordu -- beş kişinin bir on yılda öldüğü Yemen bandında
  // ölçüldü. Ortak motor (Hâller/Ontoloji/Sorular/Seyahat Atlası'nda
  // zaten kanıtlanmış) burada da çakışan etiketi kaydırıyor.
  const deconflictLabels = GU.createLabelDeconflictor();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const svg = d3.select("#elestiri-arkeolojisi-graph");
  const svgNode = svg.node();
  const wrapEl = document.getElementById("elestiri-arkeolojisi-wrap");
  const tooltip = document.getElementById("elestiri-arkeolojisi-tooltip");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");

  if (!svgNode || !wrapEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  function tt(dict) { return I18n.pick3(dict || {}); }

  const ROL_VAR = {
    elestirmen: "--series-celal",
    savunmaci: "--series-cemal",
    hakem: "--text-muted",
    "kaynak-tarihci": "--series-ibnarabi",
    kurban: "--series-celal",
    hukumdar: "--series-theme",
    // Celâl (eleştirmen) ve cemâl (savunmacı) rengini bilerek karıştırmıyoruz --
    // --series-kemal zaten "ikisini birleştiren isimler" için ayrılmış bir
    // renk (bkz. style.css tanımı); "benimseyen eleştirmen" tam o karışımın
    // kişi karşılığı.
    "benimseyen-elestirmen": "--series-kemal",
  };
  const BOLGE_SIRA = ["sam-kahire", "horasan-maveraunnehir", "endulus-magrib", "yemen"];
  const MIN_YEAR_GAP_PX = 46;

  let data = null;
  let kisiler = [];
  let baglar = [];
  let kisiById = new Map();
  let zoom = null;
  let g = null;
  let focusId = null;
  let focusEdge = null;

  function boyut() {
    const r = wrapEl.getBoundingClientRect();
    return { w: Math.max(360, r.width), h: Math.max(320, r.height) };
  }

  // Birincil rolü şekil belirler (kurban = elmas, hükümdar = kare, diğerleri
  // = daire); bu bir süs değil, kaynaktaki rolün türünü ayırt ediyor.
  function birincilRol(d) { return d.rol[0]; }

  function yerlestir() {
    const { w, h } = boyut();
    const PAD_X = 64, PAD_TOP = 46, LANE_H = (h - PAD_TOP - 40) / BOLGE_SIRA.length;
    const years = kisiler.map((d) => d.olum.miladi);
    const minY = Math.min(...years) - 8, maxY = Math.max(...years) + 8;
    const x = d3.scaleLinear().domain([minY, maxY]).range([PAD_X, w - PAD_X]);

    // Çakışma önleme: aynı banttaki kişiler birbirine MIN_YEAR_GAP_PX'ten
    // yakınsa (örn. Mısır'da aynı on yılda üç kişi birden), aç gözlü bir
    // satır ataması yapılıyor -- her satırdaki SON konulan noktadan yeterince
    // uzaksa o satıra, değilse bir sonraki satıra. Sabit iki satır (yalnız
    // komşuya bakan alternatif) üç veya daha fazla birbirine yakın kişide
    // (Barsbay/el-Bisâtî/el-Buhârî, üçü de 1437-38) çakışıyordu.
    const ROW_OFFSETS = [-16, 16, -40, 40, -64, 64];
    BOLGE_SIRA.forEach((bolge, laneIdx) => {
      const inLane = kisiler.filter((d) => d.bolge === bolge).sort((a, b) => a.olum.miladi - b.olum.miladi);
      const laneY = PAD_TOP + laneIdx * LANE_H + LANE_H / 2;
      const rowLastX = [];
      inLane.forEach((d) => {
        const px = x(d.olum.miladi);
        let row = 0;
        while (row < ROW_OFFSETS.length - 1 && rowLastX[row] !== undefined && px - rowLastX[row] < MIN_YEAR_GAP_PX) row++;
        rowLastX[row] = px;
        d.x = px;
        d.y = laneY + ROW_OFFSETS[row];
      });
    });
    kisiler.forEach((d) => { d.laneY = PAD_TOP + BOLGE_SIRA.indexOf(d.bolge) * LANE_H + LANE_H / 2; });
    return { w, h, x, PAD_TOP, LANE_H };
  }

  function ciz() {
    const { w, h, x, PAD_TOP, LANE_H } = yerlestir();
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    g = svg.append("g").attr("class", "elestiri-scene");

    // Bölge bantları ve etiketleri — zaman çizelgesinin coğrafi ekseni.
    const bantlar = g.append("g").attr("class", "elestiri-bantlar");
    BOLGE_SIRA.forEach((bolge, i) => {
      const yTop = PAD_TOP + i * LANE_H;
      bantlar.append("line")
        .attr("class", "elestiri-bant-cizgi")
        .attr("x1", 20).attr("x2", w - 20)
        .attr("y1", yTop + LANE_H / 2).attr("y2", yTop + LANE_H / 2);
      bantlar.append("text")
        .attr("class", "elestiri-bant-etiket")
        .attr("x", 22).attr("y", yTop + 14)
        .text(tt(data.bolgeler[bolge]));
    });

    // Yıl ekseni ipucu çizgileri (yüzyıl işaretleri).
    const yearsAll = kisiler.map((d) => d.olum.miladi);
    const minY = Math.min(...yearsAll) - 8, maxY = Math.max(...yearsAll) + 8;
    const ticks = d3.range(Math.ceil(minY / 50) * 50, maxY, 50);
    const eksen = g.append("g").attr("class", "elestiri-eksen");
    ticks.forEach((yr) => {
      eksen.append("line")
        .attr("class", "elestiri-eksen-cizgi")
        .attr("x1", x(yr)).attr("x2", x(yr))
        .attr("y1", PAD_TOP - 10).attr("y2", h - 24);
      eksen.append("text")
        .attr("class", "elestiri-eksen-etiket")
        .attr("x", x(yr)).attr("y", h - 8)
        .attr("text-anchor", "middle")
        .text(yr);
    });

    // Bağlar (kenarlar) — hafif kavisli, iki ucu düğüm merkezlerine sabit.
    const kenarG = g.append("g").attr("class", "elestiri-kenarler");
    const kenarSel = kenarG.selectAll("path.elestiri-kenar").data(baglar, (d, i) => d.kaynak_id + "|" + d.hedef_id + "|" + i).join("path")
      .attr("class", "elestiri-kenar")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => edgeAriaLabel(d))
      .attr("d", (d, i) => kenarYolu(d, i))
      .attr("fill", "none");

    kenarSel.on("mouseenter", function (ev, d) { vurgulaKenar(d, true); kenarIpucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function (ev, d) { vurgulaKenar(d, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgulaKenar(d, true); })
      .on("blur", function () { vurgulaKenar(null, false); })
      .on("click", (ev, d) => kenarPaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); kenarPaneli(d); }
      });

    // Düğümler (kişiler).
    const dugumG = g.append("g").attr("class", "elestiri-dugumler");
    const sel = dugumG.selectAll("g.elestiri-kisi").data(kisiler, (d) => d.id).join("g")
      .attr("class", (d) => "elestiri-kisi elestiri-kisi--" + birincilRol(d))
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => tt(d.ad));

    const R = 9;
    sel.append("circle").attr("class", "elestiri-kisi__vurus").attr("r", R + 9).attr("fill", "transparent");

    sel.each(function (d) {
      const node = d3.select(this);
      const rol = birincilRol(d);
      const renk = GU.getVar(ROL_VAR[rol] || "--text-muted");
      if (rol === "kurban") {
        node.append("path").attr("class", "elestiri-kisi__sekil")
          .attr("d", `M0,${-R} L${R},0 L0,${R} L${-R},0 Z`).attr("fill", renk);
      } else if (rol === "hukumdar") {
        node.append("rect").attr("class", "elestiri-kisi__sekil")
          .attr("x", -R * 0.82).attr("y", -R * 0.82).attr("width", R * 1.64).attr("height", R * 1.64)
          .attr("fill", renk);
      } else {
        node.append("circle").attr("class", "elestiri-kisi__sekil").attr("r", R).attr("fill", renk);
      }
    });

    // Alt konumdaki etiketin taban çizgisi (R+14), görünmez tıklama
    // dairesinin (r=R+9) 5 birim dışında başlıyordu -- fare o dar şeritte
    // ne daireye ne yazının mürekkebine değiyordu (UI denetimi bulgusu,
    // eser-agi.js'teki aynı düzeltmeyle tutarlı). R+9'a çekildi.
    // Kılavuz çizgi (leader-line): deconflictor bir etiketi kendi baseY'sinden
    // uzağa ittiğinde -- 1400-1450 Şam-Kahire yoğunluğunda etiketler tek bir
    // sütuna yığılıyordu (G37); leader-line eklenmeden hangi noktaya ait
    // olduğu okunmuyordu. Her düğüm grubuna ÖNCE line, sonra text ekleniyor
    // (line SVG'de daha altta çizilsin diye). Uzunluk deconflict sonrası
    // hesaplanacak.
    sel.append("line").attr("class", "elestiri-kisi__leader")
      .attr("x1", 0).attr("x2", 0)
      .attr("y1", 0).attr("y2", 0)
      .style("opacity", 0);
    const etiketSel = sel.append("text").attr("class", "elestiri-kisi__etiket")
      .attr("text-anchor", "middle")
      .attr("y", (d) => (d.y > d.laneY ? R + 9 : -(R + 8)))
      .text((d) => kisalt(tt(d.ad), 20));

    // Satır ataması düğümleri ayırıyordu ama etiketler hâlâ çakışabiliyordu
    // (bir on yılda ölen beşinci kişide ölçüldü, Yemen bandı) -- çakışan
    // aşağı kaydırılıyor, düğümlerin kendisi birer engel sayılıyor.
    const pendingLabels = [];
    etiketSel.each(function (d) {
      const baseY = d.y > d.laneY ? R + 9 : -(R + 8);
      pendingLabels.push({ lbl: d3.select(this), txt: kisalt(tt(d.ad), 20), x: d.x, y: d.y + baseY, baseY });
    });
    const obstacles = kisiler.map((d) => ({ x: d.x, y: d.y, half: R, h: R * 2 }));
    deconflictLabels(pendingLabels, obstacles);

    // Deconflictor bittikten sonra hangi etiket kendi baseY'sinden çok
    // uzaklaştıysa (>= 4 birim), o düğümün leader-line'ını görünür kıl.
    // Etiket ile düğüm arasındaki dikey boşluk ölçülüp line'ın uçları
    // ayarlanıyor. 4 birim eşiği: ufak salınımlarda çizgi görünmesin diye
    // -- bir on yılda tek kişi olduğunda etiket zaten yerinde duruyor.
    sel.each(function (d) {
      const g = d3.select(this);
      const etiket = g.select(".elestiri-kisi__etiket");
      const yFinal = +etiket.attr("y");
      const baseY = d.y > d.laneY ? R + 9 : -(R + 8);
      const kaydi = yFinal - baseY;
      if (Math.abs(kaydi) < 4) return;
      const yStart = kaydi > 0 ? R : -R;
      const yEnd = kaydi > 0 ? yFinal - 10 : yFinal + 3;
      g.select(".elestiri-kisi__leader")
        .attr("y1", yStart).attr("y2", yEnd)
        .style("opacity", 0.55);
    });

    sel.on("mouseenter", function (ev, d) { vurgulaKisi(d.id, true); ipucu(ev, d); })
      .on("mousemove", (ev) => GU.moveTooltip(tooltip, wrapEl, ev))
      .on("mouseleave", function (ev, d) { vurgulaKisi(d.id, false); GU.hideTooltip(tooltip); })
      .on("focus", function (ev, d) { vurgulaKisi(d.id, true); })
      .on("blur", function () { vurgulaKisi(null, false); })
      .on("click", (ev, d) => kisiPaneli(d))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); kisiPaneli(d); }
      });

    zoom = GU.createZoomBehavior(svg, g, [0.6, 3.2]);
    ortala(false);
  }

  function kenarYolu(d, i) {
    const a = kisiById.get(d.kaynak_id), b = kisiById.get(d.hedef_id);
    if (!a || !b) return "";
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // Aynı banttaki (dy küçük) bağlar düz çizgi gibi görünmesin diye,
    // kenar sırasına göre dönüşümlü yönde hafif bir kavis uyguluyoruz.
    const bend = (i % 2 === 0 ? 1 : -1) * Math.min(28, len * 0.14);
    const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
    return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
  }

  function kisalt(s, n) {
    if (!s) return "";
    if (s.length <= n) return s;
    const kes = s.slice(0, n);
    const i = kes.lastIndexOf(" ");
    return (i > 8 ? kes.slice(0, i) : kes) + "…";
  }

  function vurgulaKisi(id, on) {
    if (!g) return;
    g.selectAll("g.elestiri-kisi").classed("elestiri-kisi--deginiliyor", (d) => on && d.id === id);
  }
  function vurgulaKenar(d, on) {
    if (!g) return;
    g.selectAll("path.elestiri-kenar").classed("elestiri-kenar--deginiliyor", (l) => on && l === d);
  }

  function ipucu(ev, d) {
    const rol = data.roller[birincilRol(d)] || {};
    tooltip.innerHTML =
      `<strong>${tt(d.ad)}</strong>` +
      `<span class="node-hover-tip__meta">${tt(rol)} · ${tt(d.sehir)} · ö. ${d.olum.hicri ? d.olum.hicri + "/" : ""}${d.olum.miladi}</span>`;
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  function edgeAriaLabel(d) {
    const a = kisiById.get(d.kaynak_id), b = kisiById.get(d.hedef_id);
    const turEtiket = TUR_ETIKET[d.tur] || {};
    return (a ? tt(a.ad) : d.kaynak_id) + " → " + (b ? tt(b.ad) : d.hedef_id) + " — " + tt(turEtiket);
  }

  const TUR_ETIKET = {
    okudu: { tr: "okudu", en: "read", pt: "leu" },
    "cevap-yazdi": { tr: "cevap yazdı", en: "wrote in response", pt: "escreveu em resposta" },
    talebesiydi: { tr: "talebesiydi", en: "was a student of", pt: "foi discípulo de" },
    himayesindeydi: { tr: "himayesindeydi", en: "was under the patronage of", pt: "esteve sob o patrocínio de" },
    rakibiydi: { tr: "rakibiydi", en: "was a rival of", pt: "foi rival de" },
    halefiydi: { tr: "halefiydi", en: "succeeded", pt: "sucedeu a" },
    "ayni-stratejiyi-kullandi": { tr: "aynı stratejiyi kullandı", en: "used the same strategy", pt: "usou a mesma estratégia" },
    "hakemlik-yapti": { tr: "hakemlik yaptı", en: "arbitrated for", pt: "arbitrou para" },
  };

  function kenarIpucu(ev, d) {
    const a = kisiById.get(d.kaynak_id), b = kisiById.get(d.hedef_id);
    tooltip.innerHTML = GU.edgeReasonHtml({
      title: (a ? tt(a.ad) : d.kaynak_id) + " → " + (b ? tt(b.ad) : d.hedef_id),
      kindLabel: tt(TUR_ETIKET[d.tur] || {}),
      reason: tt(d.neden),
    });
    tooltip.hidden = false;
    GU.moveTooltip(tooltip, wrapEl, ev);
  }

  // İki ayrı kaynak biçimi var: (a) omurga -- {sayfa} -- Knysh'in kendi
  // kitabına bir sayfa referansı; (b) ikinci araştırma turu -- {eser, not} --
  // Knysh DIŞI bir kaynak, kendi atfıyla ve dürüstlük notuyla birlikte. İlkini
  // her zaman Knysh'e bağlamak (sayfa yoksa "s. undefined" yazdırarak) yanlış
  // atıf olurdu -- bu ayrım olmadan öyle oluyordu.
  function kaynakSatiri(kaynakRef) {
    if (!kaynakRef) return "";
    if (kaynakRef.sayfa !== undefined) {
      return `<p class="elestiri-kaynak-satiri">${data.kaynak.yazar}, <em>${data.kaynak.eser}</em> (${data.kaynak.yil}), s. ${kaynakRef.sayfa}</p>`;
    }
    const not = kaynakRef.not ? ` <span class="elestiri-kaynak-satiri__not">— ${kaynakRef.not}</span>` : "";
    return `<p class="elestiri-kaynak-satiri">${kaynakRef.eser}${not}</p>`;
  }

  // Vahdet-i Vücûd Eleştirileri köprüsü (2026-08-06) -- vahdet.js'teki aynı
  // bağların ters yönü: bir kişinin Eleştiri Arkeolojisi dışında hangi
  // vahdet-elestiri maddesinde de geçtiği. Bkz.
  // data/ibn-arabi/vahdet-elestiri-kopru.json'un `not` alanı (bağlar ELLE
  // kuruldu, gerekçesiyle).
  let vahdetKopru = null;
  const vahdetBaslik = new Map();
  function vahdetKopruYukle() {
    if (vahdetKopru) return Promise.resolve(vahdetKopru);
    const base = window.__dostRouteBase || "";
    const pre = base ? base + "/" : "";
    return Promise.all([
      GU.fetchJson(pre + "data/ibn-arabi/vahdet-elestiri-kopru.json"),
      GU.fetchJson(pre + "data/ibn-arabi/vahdet-elestiri.json"),
    ]).then(([k, ve]) => {
      vahdetKopru = k;
      (ve.maddeler || []).forEach((m) => vahdetBaslik.set(m.id, m.baslik));
      return k;
    }).catch(() => null);
  }
  function vahdetKopruHtml(kisiId) {
    if (!vahdetKopru) return "";
    const bag = (vahdetKopru.baglar || []).filter((b) => b.kisi === kisiId);
    if (!bag.length) return "";
    const satir = bag.map((b) => {
      const baslik = vahdetBaslik.get(b.madde);
      if (!baslik) return "";
      return `<button class="elestiri-vahdet-baglar__satir" type="button">
        <span class="elestiri-vahdet-baglar__baslik">${tt(baslik)}</span>
        <span class="elestiri-vahdet-baglar__neden">${tt(b.neden)}</span></button>`;
    }).join("");
    if (!satir) return "";
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({
      tr: "Vahdet-i Vücûd Eleştirileri'nde de geçiyor",
      en: "Also appears in Wahdat al-Wujud Criticisms",
      pt: "Também aparece nas Críticas ao Wahdat al-Wujud" })}</p>
      <div class="elestiri-vahdet-baglar">${satir}</div>`;
  }
  function wireVahdetBaglar() {
    detailContent.querySelectorAll(".elestiri-vahdet-baglar__satir").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.__dostNav && window.__dostNav.goTo("hakkinda", "vahdet");
      });
    });
  }

  function iliskiliBaglarHtml(kisiId) {
    const ilgili = baglar.filter((b) => b.kaynak_id === kisiId || b.hedef_id === kisiId);
    if (!ilgili.length) return "";
    const rows = ilgili.map((b) => {
      const diger = kisiById.get(b.kaynak_id === kisiId ? b.hedef_id : b.kaynak_id);
      const yon = b.kaynak_id === kisiId ? "→" : "←";
      return `<button class="elestiri-bag-satiri" type="button" data-idx="${baglar.indexOf(b)}">
        <span class="elestiri-bag-satiri__tur">${tt(TUR_ETIKET[b.tur] || {})}</span>
        <span>${yon} ${diger ? tt(diger.ad) : b.hedef_id}</span>
      </button>`;
    }).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Bağlar", en: "Connections", pt: "Ligações" })}</p>
            <div class="elestiri-bag-listesi">${rows}</div>`;
  }

  function kisiPaneli(d) {
    focusId = d.id;
    focusEdge = null;
    const rol = data.roller[birincilRol(d)] || {};
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(data.bolgeler[d.bolge])}
        <span class="elestiri-rol-rozet elestiri-rol-rozet--${birincilRol(d)}">${tt(rol)}</span></p>
      <h2 class="detail-title">${tt(d.ad)}</h2>
      <p class="elestiri-kimlik">${tt(d.sehir)} — ö. ${d.olum.hicri ? d.olum.hicri + "/" : ""}${d.olum.miladi}${d.olum.kesin ? "" : " " + tt({ tr: "(kesin değil)", en: "(uncertain)", pt: "(incerto)" })}</p>
      <div class="detail-block detail-block--soru"><p>${tt(d.ozet)}</p></div>
      ${kaynakSatiri(d.kaynak)}
      ${iliskiliBaglarHtml(d.id)}
      ${vahdetKopruHtml(d.id)}`;
    wireBagSatirlari();
    wireVahdetBaglar();
    detailPanel.hidden = false;
    vurgulaKisi(d.id, true);
    // Köprü verisi geç gelirse paneli tazele -- sirlar/sorular köprüsüyle
    // aynı desen (bkz. o dosyadaki yorum).
    if (!vahdetKopru) vahdetKopruYukle().then((k) => { if (k && focusId === d.id) kisiPaneli(d); });
  }

  function kenarPaneli(b) {
    focusEdge = b;
    focusId = null;
    const a = kisiById.get(b.kaynak_id), h = kisiById.get(b.hedef_id);
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Bağ", en: "Connection", pt: "Ligação" })}
        <span class="elestiri-rol-rozet">${tt(TUR_ETIKET[b.tur] || {})}</span></p>
      <h2 class="detail-title">${a ? tt(a.ad) : b.kaynak_id} → ${h ? tt(h.ad) : b.hedef_id}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(b.neden)}</p></div>
      ${kaynakSatiri(b.kaynak)}`;
    detailPanel.hidden = false;
    vurgulaKenar(b, true);
  }

  function wireBagSatirlari() {
    detailContent.querySelectorAll(".elestiri-bag-satiri").forEach((btn) => {
      btn.addEventListener("click", () => {
        const b = baglar[Number(btn.dataset.idx)];
        if (b) kenarPaneli(b);
      });
    });
  }

  function girisPaneli() {
    focusId = null;
    focusEdge = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Eleştiri Arkeolojisi", en: "Archaeology of Criticism", pt: "Arqueologia da Crítica" })}</p>
      <h2 class="detail-title">${kisiler.length} ${tt({ tr: "kişi", en: "people", pt: "pessoas" })}, ${baglar.length} ${tt({ tr: "bağ", en: "connections", pt: "ligações" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>
      <p class="elestiri-kaynak-satiri elestiri-kaynak-satiri--omurga">${data.kaynak.yazar}, <em>${data.kaynak.eser}</em>, ${data.kaynak.yayinevi}, ${data.kaynak.yil}.</p>`;
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
    const url = (base ? base + "/" : "") + "data/ibn-arabi/elestiri-arkeolojisi.json";
    return GU.fetchJson(url).then((d) => {
      data = d;
      kisiler = (d.kisiler || []).map((k) => Object.assign({}, k));
      baglar = d.baglar || [];
      kisiById = new Map(kisiler.map((k) => [k.id, k]));
      yuklendi = true;
      ciz();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    GU.wireRecenter("elestiri-arkeolojisi-recenter", () => ortala(true));
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("elestiri-arkeolojisi-wrap", () => {
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
      // her açılışta otomatik gösteriliyordu -- artık yalnız bir kişi/bağ
      // seçildiğinde açılıyor (bkz. hocalar.js'teki aynı düzeltme).
      baglaBirKez();
      yukle().then(() => { ciz(); }).catch(() => {
        const st = document.getElementById("elestiri-arkeolojisi-wrap-status");
        if (st) {
          st.hidden = false;
          st.querySelector(".view-status__text").textContent =
            tt({ tr: "Harita yüklenemedi.", en: "The map could not be loaded.", pt: "O mapa não pôde ser carregado." });
        }
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      ciz();
      if (focusId) {
        const d = kisiById.get(focusId);
        if (d) kisiPaneli(d); else if (!detailPanel.hidden) girisPaneli();
      } else if (focusEdge) {
        kenarPaneli(focusEdge);
      } else if (!detailPanel.hidden) girisPaneli();
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = kisiById.get(id);
        if (d) kisiPaneli(d);
      });
    },
  };
})();
