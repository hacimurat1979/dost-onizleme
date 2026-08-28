(function () {
  "use strict";

  // Bağlar Haritası (2026-08-28). Taradığımız yazıların her birinde
  // Dost'un hangi kavramına dokunduğunu ELLE işaretlemiştik ve her bağın
  // yanında gerekçesi + türü (örtüşme / fark / açık soru) duruyordu. Ama
  // bu bağlar YALNIZ tek tek yazıların altında görünüyordu: biriken şey
  // veride vardı, hiçbir yerde bir arada durmuyordu. Bu sekme o birikimi
  // gösteriyor.
  //
  // Ne söylediğine dikkat: bu bir SAYIM, bir yorum değil. "Şu kavram
  // Daphne için merkezî" demiyoruz; "şu kavrama şu kadar yazıda dönülmüş"
  // diyoruz. (CLAUDE.md üçüncü ilke: parçaları biriktir, erken sentez
  // yapma.) Bu yüzden merkeze yakınlık ağırlığın kendisi -- türetilmiş bir
  // puan değil, yazı sayısı.
  //
  // Biçim: merkezden dışa açılan bir dizilim, Ontoloji'nin 2B düzeniyle
  // aynı gramerde -- orada yarıçap "Zât'tan uzaklık"tı, burada "en çok
  // dönülenden uzaklık". Yarıçap ölçülmüş bir şeyi söylüyor, süs değil.
  //
  // Dizilim ALTIN AÇI ile (ayçiçeği dizilimi). Az dönüşlü okunur bir
  // sarmal denendi ve ölçüldü: yetmiş düğümü çakışmadan yerleştirmek için
  // gereken açı adımı (en içteki düğümler 20-22 birim yarıçapında) beş
  // turdan fazlasını gerektiriyor, o zaman da turlar birbirine giriyor.
  // Altın açı bunu çözen dizilim -- ama gözle izlenebilen tek bir iplik
  // vermiyor, o yüzden burada bir iplik ÇİZMİYORUZ: olmayan bir sarmalı
  // çizmek, olmayan bir şeyi iddia etmek olurdu.

  const I18n = window.DostI18n;
  const svg = d3.select("#baglar-graph");
  if (!svg.node()) return;

  const tt = I18n.pick3;
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const olcuEl = document.getElementById("baglar-olcu");

  const BAG_TURU = {
    ortusme: { tr: "örtüşme", en: "overlap", pt: "sobreposição" },
    fark: { tr: "fark", en: "difference", pt: "diferença" },
    soru: { tr: "açık soru", en: "open question", pt: "pergunta aberta" },
  };
  const DOST_GORUNUM = {
    ontoloji: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
    terimler: { tr: "Terimler", en: "Terms", pt: "Termos" },
    futuhat: { tr: "Fütûhât", en: "Futuhat", pt: "Futuhat" },
    esma: { tr: "Esmâ", en: "The Names", pt: "Os Nomes" },
    hal: { tr: "Hâller", en: "States", pt: "Estados" },
    sirlar: { tr: "Sırlar", en: "Mysteries", pt: "Mistérios" },
    sorular: { tr: "Sorular", en: "Questions", pt: "Perguntas" },
  };

  let pageData = null;
  let adlar = null;          // "view:id" -> i18n3 ad
  let nodes = [], links = [];
  let nodeSel, linkSel, labelSel, zoomBehavior, simulation;
  let secili = null;

  // ------------------------------------------------------------------
  // Veri
  // ------------------------------------------------------------------
  // Bağ kaydı yalnız {view, id} taşıyor, adı taşımıyor -- ad kavramın
  // kendi dosyasında. Üç dosyayı da çekiyoruz ki düğümde "terimler ›
  // nefs-i-natika" değil "Nefs-i Nâtıka" yazsın. Ad bulunamazsa id
  // gösteriliyor: eksik bir adı gizlemek, olmayan bir bağı varmış gibi
  // göstermekten daha kötü olmaz ama sessiz de kalmaz (konsola uyarı).
  function adlariTopla(ontoloji, terimler) {
    const m = new Map();
    (ontoloji.nodes || []).forEach((n) => m.set("ontoloji:" + n.id, n.name));
    Object.keys(terimler.terms || {}).forEach((k) => {
      const t = terimler.terms[k];
      m.set("terimler:" + t.id, t.title);
    });
    return m;
  }

  function adFor(view, id) {
    const a = adlar && adlar.get(view + ":" + id);
    return a ? tt(a) : id;
  }

  function verilerdenKur(data) {
    const say = new Map();          // "view:id" -> {view,id,yazilar:[],tur:{}}
    (data.articles || []).forEach((a) => {
      (a.dost || []).forEach((b) => {
        const k = b.view + ":" + b.id;
        let e = say.get(k);
        if (!e) { e = { key: k, view: b.view, id: b.id, yazilar: [], tur: {} }; say.set(k, e); }
        e.yazilar.push({ yazi: a, bag: b });
        e.tur[b.tur || "ortusme"] = (e.tur[b.tur || "ortusme"] || 0) + 1;
      });
    });
    // Ağırlığa göre azalan; eşitlikte ada göre, ki sıra karadan karaya
    // aynı kalsın (yoksa Map sırası veriye bağlı olarak kayardı).
    return Array.from(say.values()).sort(
      (x, y) => y.yazilar.length - x.yazilar.length || adFor(x.view, x.id).localeCompare(adFor(y.view, y.id))
    );
  }

  // Bir kavramın baskın bağ türü. Beraberlikte örtüşme değil, DAHA GÜÇLÜ
  // OLAN kayıt kazanıyor: bir fark ile bir örtüşme eşitse çizim farkı
  // göstersin -- farkı örtüşme gibi göstermemek bu sayfanın kendi kuralı
  // (bkz. daphne-profil.js'teki aynı not).
  function baskinTur(e) {
    if (e.tur.fark && e.tur.fark >= (e.tur.ortusme || 0)) return "fark";
    if (e.tur.soru && e.tur.soru > (e.tur.ortusme || 0)) return "soru";
    return e.tur.ortusme ? "ortusme" : (e.tur.soru ? "soru" : "fark");
  }

  // ------------------------------------------------------------------
  // Yükleme / ölçü (daphne-profil.js ile aynı kalıp: bölüm gizliyken
  // svg genişliği 0, o hâlde graf kurulmaz -- bkz. oradaki tablet notu)
  // ------------------------------------------------------------------
  function loadData() {
    if (window.DostViewStatus) window.DostViewStatus.showLoading("baglar-wrap");
    Promise.all([
      window.DostGraphUtils.fetchJson("data/daphne-profile.json"),
      window.DostGraphUtils.fetchJson("data/ibn-arabi/ontology.json"),
      window.DostGraphUtils.fetchJson("data/ibn-arabi/felsefi-terimler.json"),
    ])
      .then(([daphne, ontoloji, terimler]) => {
        pageData = daphne;
        adlar = adlariTopla(ontoloji, terimler);
        if (window.DostViewStatus) window.DostViewStatus.hide("baglar-wrap");
        olcuyuYaz();
        grafiKur();
      })
      .catch((err) => {
        console.error("Bağlar haritası verisi yüklenemedi / Failed to load links map data", err);
        if (window.DostViewStatus) window.DostViewStatus.showError("baglar-wrap", loadData);
      });
  }

  // Kapsam cümlesi ELLE değil, veriden yazılıyor: sayılar veri büyüdükçe
  // kendiliğinden güncellensin, statik metinde eskimesin (CLAUDE.md,
  // "yaptığımız işi olduğundan farklı göstermemek" -- eskimiş bir sayı da
  // yanlış bir sayıdır).
  function olcuyuYaz() {
    if (!olcuEl || !pageData) return;
    const yazi = (pageData.articles || []).length;
    let bag = 0;
    const hedef = new Set();
    (pageData.articles || []).forEach((a) => (a.dost || []).forEach((b) => {
      bag += 1; hedef.add(b.view + ":" + b.id);
    }));
    olcuEl.textContent = tt({
      tr: `Şimdiye kadar: ${yazi} yazı, ${bag} bağ, ${hedef.size} ayrı kavram.`,
      en: `So far: ${yazi} pieces, ${bag} links, ${hedef.size} distinct concepts.`,
      pt: `Até agora: ${yazi} textos, ${bag} vínculos, ${hedef.size} conceitos distintos.`,
    });
  }

  let started = false, grafKuruldu = false, sonGenislik = 0, gozlemci = null;

  function kurulabilirMi() {
    const s = svg.node();
    return !!(s && s.clientWidth > 0 && s.clientHeight > 0);
  }
  function grafiKur() {
    if (grafKuruldu || !pageData || !kurulabilirMi()) return;
    grafKuruldu = true;
    sonGenislik = svg.node().clientWidth;
    buildGraph();
  }
  function yenidenKur() {
    if (!grafKuruldu || !pageData || !kurulabilirMi()) return;
    const g = svg.node().clientWidth;
    if (Math.abs(g - sonGenislik) < 24) return;
    sonGenislik = g;
    svg.selectAll("*").remove();
    buildGraph();
  }
  function olcuyuIzle() {
    if (gozlemci || typeof ResizeObserver === "undefined" || !svg.node()) return;
    gozlemci = new ResizeObserver(() => { if (!grafKuruldu) grafiKur(); else yenidenKur(); });
    gozlemci.observe(svg.node());
  }

  window.__dostDaphneBaglarApp = {
    activate: function () {
      olcuyuIzle();
      if (started) { grafiKur(); return; }
      started = true;
      loadData();
    },
    render: function () {
      olcuyuYaz();
      if (!grafKuruldu) return;
      // Dil değişince adlar değişiyor, sıra da (ada göre eşitlik bozucu):
      // en temizi baştan kurmak.
      svg.selectAll("*").remove();
      buildGraph();
      if (secili) detayAc(secili);
    },
  };

  window.addEventListener("resize", window.DostGraphUtils.debounceResize(yenidenKur, 200));
  window.addEventListener("orientationchange", window.DostGraphUtils.debounceResize(yenidenKur, 300));

  // ------------------------------------------------------------------
  // Çizim
  // ------------------------------------------------------------------
  function getVar(n) { return window.DostGraphUtils.getVar(n); }

  function radiusFor(d) {
    if (d.type === "hub") return 22;
    // Yarıçap yazı sayısının KAREKÖKÜYLE büyüyor: alan sayıyla orantılı
    // olsun diye (yarıçapla orantılı olsaydı 12 yazılık düğüm 1 yazılık
    // olanın 144 katı alan kaplardı, yani sayıyı on kat abartırdı).
    return 6 + Math.sqrt(d.entry.yazilar.length) * 4.6;
  }

  function colorFor(d) {
    if (d.type === "hub") return getVar("--series-daphne");
    if (d.entry.view === "ontoloji") return getVar("--series-ibnarabi");
    if (d.entry.view === "terimler") return getVar("--series-theme");
    return getVar("--text-muted");
  }

  function labelFor(d) {
    return d.type === "hub" ? "Daphne" : adFor(d.entry.view, d.entry.id);
  }

  // Terim başlıklarının bazısı çok uzun ("The Mashi'a / Creative Will
  // Distinction and the Two Kinds of Command", 63 karakter): grafikte
  // kısaltılıyor, tam adı hem aria-label'da hem panelin başlığında duruyor.
  // Kısaltma bir bilgi kaybı değil, yalnız bu ölçekte okunmayan bir şeyin
  // yerini açıyor.
  const ETIKET_UZUNLUK = 26;
  function kisaEtiket(d) {
    const s = labelFor(d);
    return s.length > ETIKET_UZUNLUK ? s.slice(0, ETIKET_UZUNLUK - 1).trimEnd() + "\u2026" : s;
  }

  // Etiket eşiği, iki ölçümden sonra: eşik 2 iken 36 ad açıktı ve çakışma
  // çözücüsünün itme zinciri onları kutunun dışına taşıyordu; eşik 3'te
  // 21 ad kutuya sığdı ama adların çoğu kendi düğümünden 200 birimden
  // uzağa itilmişti, yani hangi adın hangi noktaya ait olduğu okunmuyordu.
  // Eşik 4: on üç ad. Kalanların adı değinince/odaklanınca beliriyor, ve
  // itilen adın düğümüne ince bir kılavuz çizgi gidiyor (aşağıda).
  const ETIKET_ESIGI = 4;
  function etiketAcikMi(d) {
    return d.type === "hub" || d.entry.yazilar.length >= ETIKET_ESIGI;
  }

  function buildGraph() {
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;
    const cx = width / 2, cy = height / 2;
    const entries = verilerdenKur(pageData);
    if (!entries.length) return;

    // Sarmal: ilk (en çok dönülen) kavram merkeze en yakın, sonuncusu en
    // dışta. Açı sabit adımla ilerliyor; adım altın açıya yakın seçildi
    // (137.5°) çünkü ardışık düğümler o zaman aynı ışına düşmüyor -- bir
    // sarmalın üstündeki noktaları birbirinden en iyi ayıran açı budur.
    const ADIM = 137.508;
    const R0 = 62;
    const R1 = Math.max(R0 + 40, Math.min(width, height) * 0.46);
    const n = entries.length;

    nodes = [{ id: "hub", type: "hub", fx: cx, fy: cy }];
    links = [];
    entries.forEach((e, i) => {
      const a = ((-90 + ADIM * i) * Math.PI) / 180;
      const t = n > 1 ? i / (n - 1) : 0;
      // Karekök: yarıçap doğrusal artınca dış halkalar seyrek, iç halkalar
      // tıkış tıkış çıkıyordu (alan yarıçapın karesiyle büyüdüğü için).
      const r = R0 + (R1 - R0) * Math.sqrt(t);
      nodes.push({
        id: e.key, type: "hedef", entry: e,
        tx: cx + r * Math.cos(a), ty: cy + r * Math.sin(a),
        aci: a, tur: baskinTur(e),
      });
      links.push({ source: nodes[0], target: nodes[nodes.length - 1], tur: baskinTur(e) });
    });
    // Kaynak/hedef DÜĞÜM NESNESİ olarak tutuluyor, id metni olarak değil:
    // bu grafta d3.forceLink yok (konumlar zaten tabloda, kuvvete gerek
    // kalmıyor), dolayısıyla id'leri nesneye çeviren o adım da yok --
    // metin bıraksaydık l.source.x tanımsız kalır, ışık yolları hiç
    // çizilmezdi (ölçüldü: hover'da açılan yol sayısı sıfır).

    simulation = d3
      .forceSimulation(nodes)
      .force("x", d3.forceX((d) => (d.type === "hub" ? cx : d.tx)).strength(0.75))
      .force("y", d3.forceY((d) => (d.type === "hub" ? cy : d.ty)).strength(0.75))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + 6))
      // Konumlar zaten tabloda: simülasyon yalnız çakışmaları açıyor.
      // Varsayılan sönümle ~300 kare (5 sn) sürüyor ve sığdırma o kadar
      // gecikiyordu; daha hızlı sönüyor.
      .alphaDecay(0.06)
      .alpha(0.9);

    const zoomLayer = svg.append("g").attr("class", "compare-zoom-layer");

    // Işık yolu: merkezden kavrama uzanan çizgi. HEPSİ birden çizilmiyor
    // -- yetmiş ışın bir yumak veriyordu (tarayıcıda bakıldı) ve zaten
    // hepsi aynı şeyi söylüyor: "bu da Daphne'ye bağlı". Yol yalnız
    // değinilen ya da seçilen düğüm için beliriyor; yani bir hareketin
    // görünür sonucu oluyor (ETKILESIM_DILI, dördüncü fiil "değinmek").
    // Uç yok: soyut ok yasak (GORSEL_DIL.md).
    linkSel = zoomLayer
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", (d) => "baglar-isik baglar-isik--" + d.tur);

    const nodeGroup = zoomLayer.append("g").attr("class", "nodes");
    nodeSel = nodeGroup
      .selectAll("g.node")
      .data(nodes)
      .join("g")
      .attr("class", (d) => "node" + (d.type === "hub" ? " node--root" : ""))
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d) => (d.type === "hub" ? "Daphne" : etiketVeSayi(d)))
      .on("click", (event, d) => tiklandi(d))
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); tiklandi(d); }
      })
      .on("mouseenter", (event, d) => degin(d))
      .on("mouseleave", () => degin(null))
      .on("focus", (event, d) => degin(d))
      .on("blur", () => degin(null));

    nodeSel.filter((d) => d.type === "hub").append("circle")
      .attr("class", "node-halo").attr("r", radiusFor(nodes[0]) * 1.5);
    // Dolgu hangi bölüme ait olduğunu söylüyor (Ontoloji / Terimler).
    nodeSel.append("circle")
      .attr("class", (d) => (d.type === "hub" ? "" : "baglar-dugum"))
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    // Baskın bağ türü. Işık yolları hep açık olmadığı için türün kalıcı
    // bir taşıyıcısı gerekiyor. Renk tek başına yetmiyordu: "açık soru"nun
    // rengi (kemâl) ile Terim düğümlerinin dolgusu (theme) ikisi de altın,
    // yani soru işareti terim dolgusunun içinde kayboluyordu (koyu temada
    // ölçüldü). Kesik KONTUR da yetmedi: 10-22 birim yarıçapta kesik bir
    // çember daireyi dişli bir çarka çeviriyor.
    //
    // Şimdi tür bir BİÇİM: "açık soru" kapanmamış bir yay (dairenin açık
    // hâli), "fark" ise düğümü kesen bir kiriş. İkisi de eşmerkezli halka
    // DEĞİL (GORSEL_DIL yasağı) -- biri açık bir eğri, öteki bir kesik.
    nodeSel.filter((d) => d.type === "hedef" && d.tur === "soru")
      .append("path")
      .attr("class", "baglar-soru-yay")
      .attr("d", (d) => acikYay(radiusFor(d) + 3.5));
    nodeSel.filter((d) => d.type === "hedef" && d.tur === "fark")
      .append("line")
      .attr("class", "baglar-fark-kiris")
      .attr("x1", (d) => -radiusFor(d) * 0.92).attr("y1", (d) => radiusFor(d) * 0.55)
      .attr("x2", (d) => radiusFor(d) * 0.92).attr("y2", (d) => -radiusFor(d) * 0.55);

    // Etiket yalnız iki yazıdan fazlasında dönülen kavramlarda AÇIK
    // duruyor: yetmişinin adını birden yazmak okunmaz bir yığın veriyordu
    // (ölçüldü). Kalanların adı değinince/odaklanınca beliriyor --
    // ETKILESIM_DILI'nin dördüncü fiili ("değinmek: hover'ın gösterdiği,
    // tıklamanın küçültülmüş hâlidir"), klavye karşılığıyla birlikte.
    labelSel = nodeSel
      .append("text")
      .attr("class", (d) => "node-label" + (d.type === "hub" ? " node-label--hub" : ""))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => radiusFor(d) + 14)
      .classed("baglar-etiket--sessiz", (d) => !etiketAcikMi(d))
      .text((d) => kisaEtiket(d));

    // Etiketler DİSKİN İÇİNE değil, ÇEVRESİNE yazılıyor. Önce içeriye
    // yazmayı denedik ve ölçtük: yetmiş dairenin hepsi çakışma çözücüsü
    // için birer engel olduğundan, diskin içine konan her ad bir daireye
    // çarpıp itiliyor, itile itile diskin dışına çıkıyordu -- yani sonuç
    // yine dışarısıydı ama rastgele bir yerde, kilometrelerce kılavuz
    // çizgiyle. Adı baştan kendi düğümünün ışını üzerinde, çemberin
    // dışında bir yere koymak hem daha kısa çizgi hem okunur bir çelenk
    // veriyor.
    const deconflictLabels = window.DostGraphUtils.createLabelDeconflictor();
    function etiketleriYerlestir() {
      let enUzak = 0;
      nodes.forEach((d) => {
        if (d.type === "hub") return;
        enUzak = Math.max(enUzak, Math.hypot(d.x - cx, d.y - cy) + radiusFor(d));
      });
      const cember = enUzak + 26;
      const pend = [];
      labelSel.each(function (d) {
        const sel = d3.select(this);
        if (d.type === "hub") {
          // Merkezin adı merkezin altında; onun "dışarısı" yok.
          sel.attr("x", 0).attr("y", radiusFor(d) + 14).attr("text-anchor", "middle");
          return;
        }
        if (!etiketAcikMi(d)) return;
        const a = Math.atan2(d.y - cy, d.x - cx);
        const gx = cx + cember * Math.cos(a), gy = cy + cember * Math.sin(a);
        const yatay = Math.cos(a);
        const anchor = Math.abs(yatay) < 0.25 ? "middle" : (yatay > 0 ? "start" : "end");
        sel.attr("x", gx - d.x).attr("text-anchor", anchor);
        pend.push({
          lbl: sel, txt: kisaEtiket(d),
          x: gx, y: gy, baseY: gy - d.y,
          // Üst yarıdaki ad yukarı, alt yarıdaki aşağı kaçsın: tek yönlü
          // (hep aşağı) kaçış üsttekileri diskin üstünden geçiriyordu.
          dir: Math.sin(a) >= 0 ? 1 : -1,
          priority: d.entry.yazilar.length,
        });
      });
      // Engel listesi BOŞ: adlar zaten diskin dışında, düğümlerle
      // çakışmıyorlar; onları engel saymak yukarıdaki eski kusurun ta
      // kendisiydi.
      deconflictLabels(pend, [], { y: 3, x: 8 });
      // Kılavuz çizgi her ad için: ad kendi düğümünden hep uzakta
      // (çemberin üstünde), o yüzden eşik 0. Bu bir OK değil -- yönü
      // olmayan, uçsuz, saç teli inceliğinde bir bağ (GORSEL_DIL.md).
      window.DostGraphUtils.attachLeaderLines(pend, {
        className: "baglar-etiket__kilavuz", threshold: 0, gap: 5,
      });
    }

    let kare = 0;
    simulation.on("tick", () => {
      kare += 1;
      linkSel
        .attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
      etiketleriYerlestir();
      // Erken bir sığdırma: kullanıcı simülasyonun durmasını beklemeden
      // haritanın tamamını görsün.
      if (kare === 40) sigdir(false);
    });
    simulation.on("end", () => {
      const bitir = () => { etiketleriYerlestir(); sigdir(false); };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(bitir);
      else bitir();
    });

    zoomBehavior = window.DostGraphUtils.createZoomBehavior(svg, zoomLayer, [0.35, 4]);

    // Çerçeveye sığdırma. Sarmalın yarıçapı kutuya sığıyordu ama uzun
    // adlar sığmıyordu: ölçüldü, 21 açık etiketin 15'i kutunun yanından
    // taşıyordu. Sığdırma ETİKETLERİ DE sayan bir kutuya (getBBox) göre
    // yapılıyor, yani "düğümler sığdı" ile yetinmiyor.
    let sigdirma = d3.zoomIdentity;
    function sigdir(animasyon) {
      const g = zoomLayer.node();
      if (!g) return;
      let bb;
      try { bb = g.getBBox(); } catch (e) { return; }
      if (!bb.width || !bb.height) return;
      const pay = 16;
      const s = Math.min(1.6, (width - pay * 2) / bb.width, (height - pay * 2) / bb.height);
      sigdirma = d3.zoomIdentity
        .translate(width / 2 - s * (bb.x + bb.width / 2), height / 2 - s * (bb.y + bb.height / 2))
        .scale(s);
      (animasyon ? svg.transition().duration(420) : svg).call(zoomBehavior.transform, sigdirma);
    }

    window.DostGraphUtils.wireRecenter("baglar-recenter", () => sigdir(true));
  }

  // Kapanmayan yay: 300 derece, tepede 60 derecelik bir açıklık. Soru
  // işaretini bir simge olarak eklemek yerine dairenin KENDİSİNİ açık
  // bırakıyoruz -- açık soru, kapanmamış daire.
  function acikYay(r) {
    const bas = (-60 * Math.PI) / 180, son = (240 * Math.PI) / 180;
    return `M ${(r * Math.cos(bas)).toFixed(1)} ${(r * Math.sin(bas)).toFixed(1)} ` +
      `A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(r * Math.cos(son)).toFixed(1)} ${(r * Math.sin(son)).toFixed(1)}`;
  }

  function etiketVeSayi(d) {
    const n = d.entry.yazilar.length;
    return labelFor(d) + " — " + tt({
      tr: n + " yazı", en: n + (n === 1 ? " piece" : " pieces"), pt: n + (n === 1 ? " texto" : " textos"),
    });
  }

  // "Değinmek": adı olmayan düğümün adı beliriyor, bağı vurgulanıyor.
  // Söz vermeden gösterme kuralı gereği gösterdiği şey, tıklamanın
  // açacağı panelin başlığının ta kendisi.
  function degin(d) {
    if (!nodeSel) return;
    // Seçili bir düğüm varken hover bırakılınca onun yolu sönmesin:
    // tıklamanın sonucu, fareyi çekmekle geri alınmamalı.
    const hedef = d || (secili ? { id: secili.key } : null);
    nodeSel.classed("node--degin", (x) => !!hedef && x.id === hedef.id);
    labelSel.classed("baglar-etiket--belir", (x) => !!hedef && x.id === hedef.id);
    linkSel.classed("baglar-isik--acik", (l) => !!hedef && l.target.id === hedef.id);
  }

  function tiklandi(d) {
    if (d.type === "hub") { detailPanel.hidden = true; secili = null; degin(null); return; }
    secili = d.entry;
    degin(d);
    detayAc(d.entry);
  }

  function detayAc(entry) {
    const base = window.__dostRouteBase || "";
    const gorunum = DOST_GORUNUM[entry.view] ? tt(DOST_GORUNUM[entry.view]) : entry.view;
    const n = entry.yazilar.length;
    const satirlar = entry.yazilar
      .slice()
      .sort((a, b) => (b.yazi.date || "").localeCompare(a.yazi.date || ""))
      .map((y) => {
        const tur = BAG_TURU[y.bag.tur] ? tt(BAG_TURU[y.bag.tur]) : "";
        return `<li class="daphne-bag daphne-bag--dost daphne-bag--${y.bag.tur || "ortusme"}">
          <a class="daphne-bag__ad" href="${y.yazi.url}" target="_blank" rel="noopener">${y.yazi.title}</a>
          ${tur ? `<span class="daphne-bag__tur">${tur}</span>` : ""}
          <span class="daphne-bag__neden">${tt(y.bag.neden)}</span></li>`;
      })
      .join("");
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${gorunum}</p>
      <h2 class="detail-title">${adFor(entry.view, entry.id)}</h2>
      <p class="daphne-baglar__not">${tt({
        tr: `Şimdiye kadar ${n} yazı bu kavrama dokundu. Bağları biz kurduk; bir örtüşme ile bir fark aynı şey değil, o yüzden her birinin türü yazılı.`,
        en: `${n} ${n === 1 ? "piece has" : "pieces have"} touched this concept so far. We made these links ourselves; an overlap and a difference are not the same thing, so each one is named.`,
        pt: `${n} ${n === 1 ? "texto tocou" : "textos tocaram"} este conceito até agora. Fizemos nós estes vínculos; uma sobreposição e uma diferença não são a mesma coisa, por isso cada um é nomeado.`,
      })}</p>
      <p><a class="bookmap-concept-tag bookmap-concept-tag--group" href="${base}/${entry.view}/${entry.id}">${tt({
        tr: "Dost'ta bu kavrama git", en: "Go to this concept in Dost", pt: "Ir a este conceito em Dost",
      })}</a></p>
      <p class="detail-eyebrow detail-eyebrow--section">${tt({
        tr: "Bu kavrama dokunan yazılar", en: "Pieces that touch this concept", pt: "Textos que tocam este conceito",
      })}</p>
      <ul class="daphne-bag-liste">${satirlar}</ul>
    `;
    detailPanel.hidden = false;
  }
})();
