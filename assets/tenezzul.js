/* Tenezzül — sürekli-zoom pilotu (FAZ 3, 2026-08-03)
 *
 * NE OLDUĞU. Tek bir eksende (Zât → Allah → Esmâ → tek bir isim → o ismin
 * kendi metni) gerçek bir sürekli-zoom denemesi. Ayrı sayfalar arasında
 * geçiş yok: kullanıcı yaklaştıkça sahne KESİLMİYOR, ÇÖZÜNÜRLÜK
 * DEĞİŞTİRİYOR. Bu, planın "zoom-katman pilotu" maddesinin dar
 * uygulamasıdır; site bu bahse rehin verilmiyor — mevcut hiçbir görünüme
 * dokunmuyor, kendi rotasında ayrı bir deneme olarak yaşıyor.
 *
 * NEDEN BÖYLE. GORSEL_DIL.md: "kavramı resmetme, davranışını resmet."
 * Buradaki davranış TENEZZÜL'dür: yaklaştıkça Bir olan çokluğa ayrışır,
 * çokluk adlanır, ad da söze döner. O yüzden istasyonlar bir merdiven gibi
 * ayrı ayrı çizilmiyor; her biri bir öncekinin İÇİNDEN açılıyor.
 *
 * ZÂT'IN İSTİSNASI. GORSEL_DIL.md "Zât'ı parlak bir cisim gibi çizme"
 * diyor. Bu yüzden ilk istasyonun etiketi, kenarı, biçimi yok: yalnız bir
 * sis. Yaklaştıkça NETLEŞMİYOR — geriye açılıp daha da belirsizleşiyor.
 * Bakışı sıkılaştırarak Zât'a yaklaşılamaz; sahne bunu söylüyor.
 * (Aynı karar kaldırılmış Atlas görünümünde de verilmişti; oradan
 * devralınan tek şey bu, mekanizma değil.)
 *
 * TEKERLEK. Burada yalın tekerlek yakınlaştırır — sitenin genel
 * sözleşmesinden (ETKILESIM_DILI.md, birinci fiil) bir sapma değil,
 * Esmâ'nınkiyle AYNI istisnadır: orada da yalın tekerlek "bir kademe
 * derine in" demektir. Bu görünümün tek iddiası zaten iniştir; tekerleğin
 * başka bir anlamı olamaz. İstisna sözleşmede adıyla yazılıdır ve ipucu
 * düğmesi bunu kullanıcıya da söyler.
 */
(function () {
  "use strict";

  const GU = window.DostGraphUtils;
  const I18n = window.DostI18n;
  const tt = (o) => I18n.pick3(o);

  const wrapEl = document.getElementById("tenezzul-wrap");
  if (!wrapEl) return;
  const svgNode = document.getElementById("tenezzul-graph");
  const svg = d3.select(svgNode);

  let data = null, built = false, names = [];
  let zatNode = null, allahNode = null;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Eksen ---------------------------------------------------------------
  // `k` (d3.zoom ölçeği) tek başına eksen. İstasyonlar k'nın ikinin kuvvetleri
  // olan noktalarına oturuyor; aradaki her yer GEÇERLİ bir konum -- yani
  // istasyonlar durak değil, ÖLÇÜ. focus = log2(k) sürekli bir sayı.
  const STATIONS = [
    { id: "zat",   label: { tr: "Zât", en: "The Essence", pt: "A Essência" } },
    { id: "allah", label: { tr: "Allah", en: "Allah", pt: "Allah" } },
    { id: "esma",  label: { tr: "Esmâ", en: "The Names", pt: "Os Nomes" } },
    { id: "isim",  label: { tr: "Bir isim", en: "One Name", pt: "Um Nome" } },
    { id: "metin", label: { tr: "Metin", en: "The text", pt: "O texto" } },
  ];
  const K_MIN = 1, K_MAX = Math.pow(2, STATIONS.length - 1);   // 1 .. 16
  let focus = 0;              // 0..4 arası sürekli derinlik
  let target = 0;             // düğme/klavye hedefi
  let zoomBehavior = null;

  // Hangi isme iniyoruz: kullanıcı sürükleyerek yön veriyor, en yakın isim
  // kazanıyor. Bu, "sürekli zoom" fikrinin ta kendisi -- ayrı bir seçim
  // adımı yok, inişin kendisi seçim.
  let steerX = 0, steerY = 0;   // -1..1 arası yön
  let chosenId = null;

  // --- Ölçüler -------------------------------------------------------------
  function size() {
    const r = svgNode.getBoundingClientRect();
    return { w: Math.max(320, r.width || 900), h: Math.max(320, r.height || 620) };
  }

  // İstasyonun görünürlüğü: kendi noktasına ne kadar yakınsak o kadar açık.
  // Üçgen bir crossfade -- kesme değil geçiş.
  function bandOpacity(i, width) {
    const d = Math.abs(focus - i);
    return Math.max(0, 1 - d / (width || 1));
  }

  // --- Kurulum -------------------------------------------------------------
  function build() {
    built = true;
    const { w, h } = size();
    svg.attr("viewBox", `${-w / 2} ${-h / 2} ${w} ${h}`);

    const defs = svg.append("defs");
    const sisGrad = defs.append("radialGradient").attr("id", "tenezzul-sis");
    sisGrad.append("stop").attr("offset", "0%").attr("stop-color", "currentColor").attr("stop-opacity", 0.30);
    sisGrad.append("stop").attr("offset", "55%").attr("stop-color", "currentColor").attr("stop-opacity", 0.14);
    sisGrad.append("stop").attr("offset", "100%").attr("stop-color", "currentColor").attr("stop-opacity", 0);

    const blur = defs.append("filter").attr("id", "tenezzul-blur")
      .attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    blur.append("feGaussianBlur").attr("stdDeviation", 18);

    layers.sis = svg.append("g").attr("class", "tnz-sis");
    layers.sis.append("circle").attr("r", 1).attr("fill", "url(#tenezzul-sis)").attr("filter", "url(#tenezzul-blur)");

    layers.allah = svg.append("g").attr("class", "tnz-allah");
    layers.allah.append("circle").attr("class", "tnz-allah__disc");
    layers.allah.append("text").attr("class", "tnz-allah__label").attr("text-anchor", "middle");

    layers.esma = svg.append("g").attr("class", "tnz-esma");
    layers.isim = svg.append("g").attr("class", "tnz-isim");
    layers.metin = svg.append("g").attr("class", "tnz-metin");

    buildEsma();
    buildIsim();
    wire();
    render();
  }

  const layers = {};
  let esmaSel = null;

  function buildEsma() {
    // İsimler Allah'ın çevresinde, KUTUPLARINA göre üç yaya ayrılıyor
    // (celâl / cemâl / kemâl). İlk denemede altın açılı bir Fermat spirali
    // kullanılmıştı; ekran görüntüsünde ölçüldü ve yapısız bir serpinti gibi
    // okundu -- oysa buradaki iddia "Bir olan çokluğa AYRIŞIR"dır, ayrışma
    // rastgele değil ailelere göredir. Üç yay o aileyi görünür kılıyor.
    // Her yayın içinde isimler ikinci bir sarmal üzerinde açılıyor: iki
    // boyutlu halka ile sarmal arasında seçim varken sarmal (CLAUDE.md,
    // 2026-07-27). Üçüncü boyut KULLANILMIYOR, çünkü bu görünümde derinlik
    // zaten eksenin kendisi; ikisi yarışırsa ikisi de okunmaz olur.
    const { w, h } = size();
    const R = Math.min(w, h) * 0.42;
    const POLES = ["cemal", "kemal", "celal"];
    const gruplar = {};
    POLES.forEach((p) => { gruplar[p] = []; });
    gruplar.neutral = [];
    names.forEach((n) => (gruplar[n.pole] || gruplar.neutral).push(n));
    const sirali = POLES.concat(["neutral"]).filter((p) => gruplar[p].length);
    // Yaylar arasında küçük bir boşluk: aileler birbirine karışmasın.
    const BOSLUK = 0.16;
    const toplam = names.length;
    let acc = 0, gecen = 0;
    sirali.forEach((p) => {
      const grup = gruplar[p];
      const pay = (grup.length / toplam) * (Math.PI * 2) - BOSLUK;
      const bas = acc + BOSLUK / 2;
      grup.forEach((n, j) => {
        const t = grup.length === 1 ? 0.5 : j / (grup.length - 1);
        const a = bas + pay * t;
        // Sarmalın yarıçapı GRUP İÇİ değil, bütün tur boyunca ilerliyor.
        // Grup içi olsaydı üç kişilik bir küme küçücük bir açıda bütün
        // yarıçapı tarar ve halkanın içine dik bir çizgi gibi düşerdi --
        // ilk çizimde "neutral" kümesi tam öyle göründü (ölçüldü).
        const kure = (gecen + j) / Math.max(1, toplam - 1);
        const r = R * (0.66 + 0.34 * kure);
        n.x = Math.cos(a) * r;
        n.y = Math.sin(a) * r;
      });
      acc += pay + BOSLUK;
      gecen += grup.length;
    });
    esmaSel = layers.esma.selectAll("g.tnz-name").data(names, (d) => d.id)
      .join("g").attr("class", "tnz-name")
      .attr("transform", (d) => `translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`);
    esmaSel.append("circle").attr("class", (d) => "tnz-name__dot tnz-name__dot--" + (d.pole || "neutral")).attr("r", 4.5);
    esmaSel.append("title").text((d) => tt(d.name));
  }

  function buildIsim() {
    layers.isim.append("circle").attr("class", "tnz-isim__disc");
    layers.isim.append("text").attr("class", "tnz-isim__name").attr("text-anchor", "middle");
    layers.isim.append("text").attr("class", "tnz-isim__short").attr("text-anchor", "middle");
  }

  // --- Çizim ---------------------------------------------------------------
  function chooseName() {
    // Sürükleyerek verilen yöne en yakın isim. Yön verilmemişse merkeze en
    // yakın olan -- yani hiçbir şey yapmayan kullanıcı da bir yere iner.
    const { w, h } = size();
    const px = steerX * w * 0.32, py = steerY * h * 0.32;
    let best = null, bestD = Infinity;
    names.forEach((n) => {
      const d = Math.hypot(n.x - px, n.y - py);
      if (d < bestD) { bestD = d; best = n; }
    });
    return best;
  }

  function render() {
    if (!built) return;
    const { w, h } = size();

    // 0) Zât: yaklaştıkça NETLEŞMEZ, geriye açılır ve seyrelir.
    const sisScale = 0.30 * Math.min(w, h) * (1 + focus * 0.55);
    const sisOp = Math.max(0.10, 1 - focus * 0.20);
    layers.sis.attr("transform", `scale(${sisScale.toFixed(2)})`).attr("opacity", sisOp.toFixed(3));

    // 1) Allah: sisin İÇİNDEN beliriyor. İlk istasyonda HİÇ görünmemeli --
    //    ilk yazımda bandı geniş tuttuğum için Zât istasyonunda "Allah"
    //    etiketi zaten okunuyordu (ekran görüntüsünde ölçüldü) ve bu, o
    //    istasyonun bütün iddiasını (adlandırılamayan) çürütüyordu.
    const allahOp = focus < 0.25 ? 0 : bandOpacity(1, 1.15);
    // Esmâ'ya inerken KÜÇÜLÜYOR: isimler onun payından çıkıyor, o da
    // kendini veriyor. Tenezzülün kendisi bu.
    const verme = Math.max(0, Math.min(1, focus - 1));
    const allahR = Math.min(w, h) * (0.16 - 0.09 * verme);
    layers.allah.attr("opacity", allahOp.toFixed(3));
    layers.allah.select(".tnz-allah__disc").attr("r", allahR.toFixed(1));
    layers.allah.select(".tnz-allah__label")
      .attr("y", 6).text(allahOp > 0.05 ? tt(STATIONS[1].label) : "")
      .attr("font-size", Math.max(11, allahR * 0.30).toFixed(1))
      .attr("opacity", (1 - verme * 0.75).toFixed(3));

    // 2) Esmâ: isimler merkezden dışarı doğru AÇILIYOR (yerlerine gitmiyor,
    //    merkezden çıkıyorlar) -- ayrışmanın kendisi görünsün.
    const esmaOp = bandOpacity(2, 1.45);
    const acilma = Math.max(0, Math.min(1, focus - 1));
    layers.esma.attr("opacity", esmaOp.toFixed(3));
    if (esmaSel) esmaSel.attr("transform", (d) =>
      `translate(${(d.x * acilma).toFixed(1)},${(d.y * acilma).toFixed(1)})`);

    // 3) Tek isim: seçilen büyür, ötekiler sönmez ama geri çekilir -- hâlâ
    //    oradalar, yalnız artık bakılan onlar değil.
    const isimOp = bandOpacity(3, 1.5);
    const secili = focus > 2.15 ? chooseName() : null;
    chosenId = secili ? secili.id : null;
    if (esmaSel) esmaSel.classed("is-chosen", (d) => secili && d.id === secili.id)
      .attr("opacity", (d) => (secili && d.id !== secili.id ? Math.max(0.12, 1 - (focus - 2) * 0.8) : 1));

    layers.isim.attr("opacity", isimOp.toFixed(3));
    if (secili && isimOp > 0.01) {
      // Son istasyonda metin paneli sağ alta oturuyor; ad ve özet onun
      // altında kalmasın diye sahne sola çekiliyor ve ölçüler küçülüyor.
      // (İlk yazımda bu yoktu: ad panelin altına giriyordu, ekran
      //  görüntüsünde görüldü.)
      const metne = Math.max(0, Math.min(1, focus - 3));
      const yaklas = Math.max(0, Math.min(1, focus - 2.4));
      const r = Math.min(w, h) * (0.13 + 0.07 * yaklas - 0.05 * metne);
      // Dar ekranda metin paneli SAĞA değil ALTA oturuyor (bkz. style.css'in
      // 720px kuralı), o yüzden sahne sola değil YUKARI çekiliyor. İlk
      // yazımda tek bir sola-kayma vardı ve 375px'te ad hem eksen
      // düğmelerinin hem panelin altında kalıyordu (ekran görüntüsüyle
      // ölçüldü).
      const dar = w < 720;
      const kayma = dar ? 0 : -w * 0.16 * metne;
      const dikey = dar ? -h * 0.16 * metne : 0;
      layers.isim.attr("transform",
        `translate(${(secili.x * (1 - yaklas) + kayma).toFixed(1)},${(secili.y * (1 - yaklas) + dikey).toFixed(1)})`);
      layers.isim.select(".tnz-isim__disc").attr("r", r.toFixed(1))
        .attr("class", "tnz-isim__disc tnz-isim__disc--" + (secili.pole || "neutral"));
      // Dar ekranda metin panelinde ad zaten yazıyor; SVG'deki adı susturuyoruz
      // ki aynı cümle iki kere ve üst üste görünmesin.
      layers.isim.select(".tnz-isim__name").attr("y", -4)
        .attr("opacity", (dar ? 1 - metne : 1).toFixed(3))
        .text(dar && metne > 0.85 ? "" : tt(secili.name))
        .attr("font-size", Math.max(13, Math.min(dar ? 20 : 30, r * 0.22)).toFixed(1));
      // Özet metin panelinde zaten var; burada yalnız metne inmeden önce
      // gösteriliyor, sonra susuyor -- aynı cümle iki yerde durmasın.
      layers.isim.select(".tnz-isim__short")
        .attr("y", Math.max(18, r * 0.30))
        .attr("opacity", (1 - metne).toFixed(3))
        .text(metne > 0.9 ? "" : (tt(secili.short) || ""))
        .attr("font-size", Math.max(11, Math.min(15, r * 0.11)).toFixed(1));
    } else {
      layers.isim.select(".tnz-isim__name").text("");
      layers.isim.select(".tnz-isim__short").text("");
    }

    // 4) Metin: ismin kendi sözü. Eksenin sonu bir başlık değil, OKUNACAK
    //    bir şey olmalı -- pilotun bütün bahsi burada.
    const metinOp = bandOpacity(4, 1.2);
    renderMetin(secili, metinOp);

    updateChrome();
  }

  let metinEl = null;
  function renderMetin(n, op) {
    if (!metinEl) metinEl = document.getElementById("tenezzul-metin");
    if (!metinEl) return;
    if (!n || op < 0.02) { metinEl.hidden = true; metinEl.innerHTML = ""; metinEl.dataset.id = ""; return; }
    metinEl.hidden = false;
    metinEl.style.opacity = op.toFixed(3);
    if (metinEl.dataset.id === n.id && metinEl.dataset.lang === I18n.getLang()) return;
    metinEl.dataset.id = n.id;
    metinEl.dataset.lang = I18n.getLang();
    const ins = (n.insights || [])[0];
    const kaynak = (n.sources || [])[0];
    metinEl.innerHTML =
      `<p class="tnz-metin__eyebrow">${tt(n.name)}</p>`
      + `<p class="tnz-metin__body">${tt(n.summary) || ""}</p>`
      + (ins ? `<blockquote class="tnz-metin__quote">${tt(ins.text)}</blockquote>` : "")
      + (kaynak ? `<p class="tnz-metin__source">${kaynak}</p>` : "")
      + `<p class="tnz-metin__more"><a class="cross-link" href="${window.__dostNav.href("esma", n.id)}" data-view="esma" data-id="${n.id}">${tt({
          tr: "Bu ismi Esmâ haritasında aç", en: "Open this Name on the map of Names", pt: "Abra este Nome no mapa dos Nomes" })}</a></p>`;
  }

  // --- Kabuk (istasyon göstergesi, düğmeler) --------------------------------
  function updateChrome() {
    const dots = document.getElementById("tenezzul-stations");
    if (!dots) return;
    [...dots.children].forEach((el, i) => {
      const yakin = Math.max(0, 1 - Math.abs(focus - i));
      el.classList.toggle("is-active", yakin > 0.5);
      el.style.opacity = (0.35 + 0.65 * yakin).toFixed(2);
    });
    const lbl = document.getElementById("tenezzul-station-label");
    if (lbl) lbl.textContent = tt(STATIONS[Math.round(Math.max(0, Math.min(STATIONS.length - 1, focus)))].label);
    const up = document.getElementById("tenezzul-up"), down = document.getElementById("tenezzul-down");
    if (up) up.disabled = focus <= 0.01;
    if (down) down.disabled = focus >= STATIONS.length - 1.01;
  }

  // --- Etkileşim -----------------------------------------------------------
  function setFocus(f, animate) {
    target = Math.max(0, Math.min(STATIONS.length - 1, f));
    const k = Math.pow(2, target);
    const sel = (animate && !reduceMotion) ? svg.transition().duration(520).ease(d3.easeCubicInOut) : svg;
    sel.call(zoomBehavior.transform, d3.zoomIdentity.scale(k));
  }

  function wire() {
    zoomBehavior = d3.zoom()
      .scaleExtent([K_MIN, K_MAX])
      // KASITLI İSTİSNA: yalın tekerlek burada yakınlaştırır (bkz. dosya
      // başındaki not ve ETKILESIM_DILI.md). reduced-motion'da tekerlek
      // devre dışı; düğmeler ve ok tuşları her iki kipte de çalışır.
      .filter((event) => {
        if (event.type === "wheel") return !reduceMotion;
        if (event.type === "dblclick") return false;
        return true;
      })
      .on("zoom", (event) => {
        focus = Math.log(event.transform.k) / Math.LN2;
        render();
      });
    svg.call(zoomBehavior).on("dblclick.zoom", null);

    // Yön verme: boş alanı sürüklemek hangi isme ineceğini belirler.
    // (d3.zoom'un kendi pan'ini kullanmıyoruz; burada "kaydırma" bir konum
    // değil bir NİYET -- sahne kaymıyor, hedef değişiyor.)
    let dragging = false, sx = 0, sy = 0, bx = 0, by = 0;
    svgNode.addEventListener("pointerdown", (e) => {
      dragging = true; sx = e.clientX; sy = e.clientY; bx = steerX; by = steerY;
      svgNode.setPointerCapture && svgNode.setPointerCapture(e.pointerId);
    });
    svgNode.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const { w, h } = size();
      steerX = Math.max(-1, Math.min(1, bx - (e.clientX - sx) / (w * 0.5)));
      steerY = Math.max(-1, Math.min(1, by - (e.clientY - sy) / (h * 0.5)));
      render();
    });
    const bitir = () => { dragging = false; };
    svgNode.addEventListener("pointerup", bitir);
    svgNode.addEventListener("pointercancel", bitir);

    const up = document.getElementById("tenezzul-up");
    const down = document.getElementById("tenezzul-down");
    if (up) up.addEventListener("click", () => setFocus(Math.round(target) - 1, true));
    if (down) down.addEventListener("click", () => setFocus(Math.round(target) + 1, true));

    svgNode.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); setFocus(Math.round(target) + 1, true); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); setFocus(Math.round(target) - 1, true); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); steerX = Math.max(-1, steerX - 0.18); render(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); steerX = Math.min(1, steerX + 0.18); render(); }
    });

    // "Geri çekilmek": kaymış YÖN sıfırlanır, inilen derinlik korunur --
    // derinlik kullanıcının bilerek seçtiği kip (bkz. ETKILESIM_DILI.md).
    GU.wireRecenter("tenezzul-recenter", () => { steerX = 0; steerY = 0; render(); });

    // "Bir adım geri": bir istasyon yukarı.
    GU.registerStepBack("tenezzul-wrap", () => {
      if (target <= 0.01) return false;
      setFocus(Math.round(target) - 1, true);
      return true;
    });

    window.addEventListener("resize", () => { if (built && !wrapEl.hidden) { const { w, h } = size();
      svg.attr("viewBox", `${-w / 2} ${-h / 2} ${w} ${h}`); buildEsma(); render(); } });
  }

  // --- Veri ----------------------------------------------------------------
  function fetchData() {
    if (data) return Promise.resolve(data);
    return GU.fetchJson("data/ibn-arabi/esma.json").then((d) => {
      data = d;
      zatNode = d.nodes.find((n) => n.id === "zat");
      allahNode = d.nodes.find((n) => n.id === "allah");
      // Pilot dar tutuluyor: yalnız Allah'ın doğrudan altındaki isimler.
      // Daha derin dallar (depth >= 3) ekseni bulanıklaştırırdı; genişletme
      // ayrı bir karar (bkz. planın "önce dar bir prototip" ilkesi).
      names = d.nodes.filter((n) => n.depth === 2);
      // Metni olan isimler önce gelsin: pilotun sonu gerçekten okunacak bir
      // şeye çıksın, boş bir başlığa değil.
      names.sort((a, b) => ((b.insights || []).length ? 1 : 0) - ((a.insights || []).length ? 1 : 0));
      return d;
    }).catch(() => null);
  }

  window.__tenezzulApp = {
    activate() {
      fetchData().then((d) => { if (!d) return; if (!built) build(); else render(); });
    },
    onLangChange() {
      if (!built) return;
      if (metinEl) metinEl.dataset.id = "";
      render();
      const hint = document.getElementById("tenezzul-station-label");
      if (hint) updateChrome();
    },
  };
})();
