(function () {
  "use strict";

  // Gizli paylaşım kipi: sayfada (metin kutusunda değilken) "@share" yazınca
  // açılır. Amacı, sitenin kendi metinlerinden TikTok/Reels için 9:16 dikey
  // bir "sahne" kurmak. Sahne canlı olarak oynar; kullanıcı telefonun kendi
  // ekran kaydıyla çeker. Bilerek video/canvas üretmiyoruz: SVG'yi canvas'a
  // aktarmak dış CSS'i düşürüyor, MediaRecorder'ın ürettiği webm'i de TikTok
  // çoğu zaman kabul etmiyor. Ekran kaydı hem sıfır bağımlılık hem tam
  // kalite.
  //
  // KURAL (2026-07-28, kullanıcıyla birlikte konuldu): Karttaki HER cümle
  // sitede zaten o hâliyle yazılı olan bir cümledir. Kart için yeni "vurucu"
  // metin YAZILMAZ. Bu, kısa-video biçiminin sitenin sesini geriye doğru
  // yeniden yazmasını (bkz. CLAUDE.md, "anlamaya çalışıyoruz, anlatmaya
  // değil") engelleyen tek koruma. Aşağıdaki bütün şablonlar bu yüzden
  // yalnızca var olan veriyi seçip diziyor; hiçbir yerde metin üretmiyor.
  const CODE = "@share";
  const GU = window.DostGraphUtils;
  const CILT_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII"];

  const UI = {
    title: { tr: "Paylaşım sahnesi", en: "Share stage", pt: "Palco de partilha" },
    hint: {
      tr: "Bir şablon seç, sahneyi aç, telefonun kendi ekran kaydıyla çek. Sahne döngüde oynar.",
      en: "Pick a template, open the stage, record with your phone's own screen recorder. The stage loops.",
      pt: "Escolhe um modelo, abre o palco e grava com o gravador de ecrã do telemóvel. O palco repete.",
    },
    shuffle: { tr: "Başkasını getir", en: "Bring another", pt: "Trazer outro" },
    open: { tr: "Sahneyi aç", en: "Open the stage", pt: "Abrir o palco" },
    close: { tr: "Kapat", en: "Close", pt: "Fechar" },
    guides: { tr: "Güvenli alan", en: "Safe area", pt: "Área segura" },
    rec: { tr: "⏺ Videoyu indir", en: "⏺ Download video", pt: "⏺ Descarregar vídeo" },
    recPick: {
      tr: "Açılan pencerede “Bu sekme”yi seç — gerisi kendiliğinden.",
      en: "In the dialog that opens, choose “This tab” — the rest is automatic.",
      pt: "Na janela que abrir, escolhe “Este separador” — o resto é automático.",
    },
    // Tablet/telefonda getDisplayMedia yok; düğüm sessizce kaybolunca
    // kullanıcı "bozuk mu?" diye kalıyordu (kullanıcı notu, 2026-07-28,
    // tabletten gelen ekran görüntüsü). Sebebi ve alternatifi yazıyoruz.
    recYok: {
      tr: "Bu cihazda doğrudan indirme yok — sahne zaten temiz, cihazın kendi ekran kaydıyla çekebilirsin. Bilgisayarda burada bir “videoyu indir” düğmesi çıkar.",
      en: "Direct download is not available on this device — the stage is already clean, so use your device's own screen recorder. On a computer a “download video” button appears here.",
      pt: "Descarga direta não está disponível neste dispositivo — o palco já está limpo, usa o gravador de ecrã do próprio aparelho. Num computador aparece aqui um botão “descarregar vídeo”.",
    },
    recWait: { tr: "Başlıyor…", en: "Starting…", pt: "A começar…" },
    recBusy: { tr: "Kaydediliyor", en: "Recording", pt: "A gravar" },
    recDone: { tr: "İndirildi", en: "Downloaded", pt: "Descarregado" },
    recFail: {
      tr: "Kayıt başlamadı. Ekran paylaşımına izin verilmedi ya da tarayıcı desteklemiyor.",
      en: "Recording did not start. Screen sharing was denied, or the browser does not support it.",
      pt: "A gravação não começou. A partilha de ecrã foi negada ou o navegador não a suporta.",
    },
    loading: { tr: "Aranıyor…", en: "Searching…", pt: "A procurar…" },
    none: {
      tr: "Bu şablona uygun bir kayıt bulunamadı — başkasını dene.",
      en: "No record fits this template — try another.",
      pt: "Nenhum registo serve para este modelo — tenta outro.",
    },
    zemin: { tr: "Zemin", en: "Backdrop", pt: "Fundo" },
    isik: { tr: "Açık zemin", en: "Light backdrop", pt: "Fundo claro" },
    kare: { tr: "Kare (1:1)", en: "Square (1:1)", pt: "Quadrado (1:1)" },
    kart: { tr: "🖼 Kart indir", en: "🖼 Download card", pt: "🖼 Descarregar cartão" },
    dil: { tr: "Dil", en: "Language", pt: "Idioma" },
    tpl: {
      soz: { tr: "Bir Cümle", en: "One Sentence", pt: "Uma Frase" },
      ikili: { tr: "İki Kutu", en: "Two Boxes", pt: "Duas Caixas" },
      soru:     { tr: "Bir Soru", en: "A Question",   pt: "Uma Pergunta" },
      hikaye:   { tr: "Hikâye",   en: "Story",        pt: "História" },
      ontoloji: { tr: "Ontoloji", en: "Ontology",     pt: "Ontologia" },
      esma:     { tr: "Esmâ",     en: "Divine Name",  pt: "Nome Divino" },
      gunun:    { tr: "Günün Sözü", en: "Word of the Day", pt: "Palavra do Dia" },
      benzetme: { tr: "Bir Benzetmeyle", en: "Through an Analogy", pt: "Através de uma Analogia" },
      fusus:    { tr: "Füsûs Halkası", en: "Fusus Ring", pt: "Anel dos Fusus" },
      dizi:     { tr: "Dizi", en: "Series", pt: "Série" },
      karsilastir: { tr: "Karşılaştır", en: "Compare", pt: "Comparar" },
      ozelgun:  { tr: "Özel Gün", en: "Special Day", pt: "Dia Especial" },
    },
    filter:      { tr: "Filtre",             en: "Filter",               pt: "Filtro" },
    filterAll:   { tr: "Tümü",              en: "All",                  pt: "Tudo" },
    filterCilt:  { tr: "Bu cilt",           en: "This volume",          pt: "Este volume" },
    filterKisim: { tr: "Bu kısım",          en: "This part",            pt: "Esta parte" },
    openThis:    { tr: "Aç",               en: "Open",                 pt: "Abrir" },
    favAdd:      { tr: "★",               en: "★",                    pt: "★" },
    favRemove:   { tr: "✕",               en: "✕",                    pt: "✕" },
    favList:     { tr: "Favoriler",         en: "Favourites",           pt: "Favoritos" },
    favEmpty:    { tr: "Henüz favori yok.", en: "No favourites yet.",   pt: "Sem favoritos ainda." },
    histList:    { tr: "Son kullanılanlar", en: "Recent",               pt: "Recentes" },
    ikiDilli:    { tr: "İki dilli kart", en: "Bilingual card", pt: "Cartão bilíngue" },
    ikinciDil:   { tr: "İkinci dil", en: "Second language", pt: "Segundo idioma" },
    karsilastirSol: { tr: "Sol", en: "Left", pt: "Esquerda" },
    karsilastirSag: { tr: "Sağ", en: "Right", pt: "Direita" },
    karsilastirAc:  { tr: "Bu ikisini aç", en: "Open these two", pt: "Abrir estes dois" },
  };

  // Sahnenin dili sitenin genel diline BAĞLI DEĞİL: kullanıcı Türkçe
  // gezinirken İngilizce ya da Portekizce bir kayıt çekebilsin diye ayrı,
  // yalnız bu panele özel bir seçim (kullanıcı isteği, 2026-07-30). Site
  // genelini değiştirmeden yalnız kartın/sahnenin metin dilini değiştirir.
  const DIL_ANAHTAR = "dost-share-lang";
  const DIL_LANGS = (window.DostI18n && window.DostI18n.LANGS) || ["tr", "en", "pt"];
  const DIL_ETIKET = { tr: "TR", en: "EN", pt: "PT" };
  function siteLang() { return (window.DostI18n && window.DostI18n.getLang()) || "tr"; }
  let shareLangId = safeGet(DIL_ANAHTAR);
  if (!DIL_LANGS.includes(shareLangId)) shareLangId = siteLang();

  function tt(d, l) { l = l || shareLangId; return d[l] || d.en || d.tr || ""; }
  function lang() { return shareLangId; }

  // "İki dilli kart" (kullanıcı önerisi, 2026-08-03): kartın aynı satırını
  // iki dilde ÜST ÜSTE göstermek -- uluslararası bir takipçisi olan biri
  // tek paylaşımda iki dile ulaşabilsin diye. Ayrı bir "ikinci dil" seçimi;
  // birincisiyle (shareLangId) çakışırsa mkBilingualLine ikinci satırı
  // sessizce atlıyor (aynı şeyi iki kez göstermek anlamsız olurdu).
  const IKIDILLI_ANAHTAR = "dost-share-ikidilli";
  const IKINCIDIL_ANAHTAR = "dost-share-ikincidil";
  let ikiDilliMod = safeGet(IKIDILLI_ANAHTAR) === "1";
  let ikinciDilId = safeGet(IKINCIDIL_ANAHTAR);
  if (!DIL_LANGS.includes(ikinciDilId)) ikinciDilId = DIL_LANGS.find((l) => l !== shareLangId) || DIL_LANGS[0];

  // Var olan bir çeviri sözlüğünden, isteğe bağlı ikinci bir satır üreten
  // ortak yardımcı -- kartın PRIMARY diliyle aynı kaynaktan, YENİ metin
  // yazmadan (bkz. dosya başındaki KURAL). capLen verilirse capText de
  // uygulanır.
  function mkBilingualLine(dict, kind, capLen) {
    const primary = capLen ? capText(tt(dict), capLen) : tt(dict);
    const line = { text: primary, kind: kind };
    if (ikiDilliMod && ikinciDilId !== shareLangId) {
      const secondary = capLen ? capText(tt(dict, ikinciDilId), capLen) : tt(dict, ikinciDilId);
      if (secondary && secondary !== primary) line.text2 = secondary;
    }
    return line;
  }

  // --- veri ------------------------------------------------------------
  const partCache = new Map();

  // Hem çözülmüş veriyi HEM DE devam eden isteği (in-flight promise) ayrı
  // önbelleklerde tutar. Önceki hâl yalnız çözülmüş veriyi önbelleğe
  // alıyordu -- refresh() panelin ilk açılışında (veri henüz hiç
  // çekilmemişken) her zaman 3 aday üretmek için buildScene()'i 3 kez
  // paralel çağırıyor; bu üçü de AYNI JSON'u ayrı ayrı indiriyordu (bkz.
  // teknik inceleme, bulgu #9). Tek bir istek artık üçü arasında paylaşılır.
  const dataCache = {};
  const dataPromises = {};
  function cachedFetch(key, url) {
    if (Object.prototype.hasOwnProperty.call(dataCache, key)) return Promise.resolve(dataCache[key]);
    if (dataPromises[key]) return dataPromises[key];
    const p = GU.fetchJson(url).then((d) => { dataCache[key] = d; delete dataPromises[key]; return d; },
      (e) => { delete dataPromises[key]; throw e; });
    dataPromises[key] = p;
    return p;
  }

  function loadIndex() { return cachedFetch("futuhat-index", "data/ibn-arabi/futuhat-atlas-index.json"); }
  function loadPart(id) {
    if (partCache.has(id)) return Promise.resolve(partCache.get(id));
    return cachedFetch("futuhat-part:" + id, "data/ibn-arabi/futuhat-parts/" + id + ".json").then((d) => {
      partCache.set(id, d);
      return d;
    });
  }
  function loadSorular() { return cachedFetch("sorular", "data/ibn-arabi/sorular.json"); }
  function loadSirlar() { return cachedFetch("sirlar", "data/ibn-arabi/sirlar.json"); }
  function loadOntoloji() { return cachedFetch("ontoloji", "data/ibn-arabi/ontology.json"); }
  function loadEsma() { return cachedFetch("esma", "data/ibn-arabi/esma.json"); }
  function loadFelsefiTerimler() { return cachedFetch("felsefi-terimler", "data/ibn-arabi/felsefi-terimler.json"); }
  function loadVahdet() {
    return cachedFetch("vahdet", "data/ibn-arabi/vahdet-elestiri.json").catch(() => ({ maddeler: [] }));
  }
  function loadFususAtlas() { return cachedFetch("fusus-atlas", "data/ibn-arabi/fusus-atlas.json"); }

  // "Karşılaştır" şablonu (kullanıcı önerisi, 2026-08-03): esma+ontoloji
  // havuzunu (benzetme şablonuyla aynı kaynak) düz bir listeye çeviriyor ki
  // panel iki <select> ile kullanıcının SEÇTİĞİ iki kavramı yan yana
  // koyabilsin -- rastgele eşleştirmenin aksine.
  let compareData = null;
  function loadCompareData() {
    if (compareData) return Promise.resolve(compareData);
    return Promise.all([loadEsma(), loadOntoloji()]).then(([esma, onto]) => {
      const list = [];
      (esma.nodes || []).forEach((n) => { if (n.insights && n.insights.length) list.push({ key: "esma:" + n.id, name: n.name, insights: n.insights }); });
      (onto.nodes || []).forEach((n) => { if (n.insights && n.insights.length) list.push({ key: "onto:" + n.id, name: n.name, insights: n.insights }); });
      compareData = { list: list };
      return compareData;
    });
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // Var olan bir metni, sahnenin taşıyabileceği uzunlukta kesip "…" ekler --
  // YENİ metin YAZMAZ (bkz. dosya başındaki KURAL), yalnız var olanı seçer.
  // Kelime sınırında keser ki bir kelime yarıda bölünmesin.
  function capText(raw, max) {
    raw = String(raw || "");
    max = max || 310;
    if (raw.length <= max) return raw;
    const cut = raw.lastIndexOf(" ", max);
    // Tek bir "kelime" max'tan uzunsa (hiç boşluk yoksa) lastIndexOf -1
    // döner -- slice(0,-1) o zaman TÜM metnin son harfini atıp geri kalanını
    // olduğu gibi bırakırdı, max'ı hiç uygulamamış olurdu.
    return cut > 0 ? raw.slice(0, cut) + "…" : raw.slice(0, max) + "…";
  }

  // Şablonlardan gelen metin bazen kaynak veride <em>/<strong> gibi
  // vurgu etiketleri taşıyor (ör. Fütûhât alıntıları, ontology.json
  // insight'ları) -- kart HTML'i bunu render ETMEZ, escapeHtml öncesi
  // düz metne indirgiyoruz ki "&lt;strong&gt;..." gibi literal etiket
  // hiçbir şablonda görünmesin (tespit: ontoloji/karşılaştır şablonları).
  function plainText(raw) {
    return String(raw || "").replace(/<[^>]*>/g, "");
  }

  // ontoloji.json/esma.json/felsefi-terimler'deki "insights" bir dizi olup
  // her öge ya düz bir dize ya da {text:{tr,en,pt}} biçiminde olabiliyor --
  // esma/ontoloji/karşılaştır şablonlarının üçü de aynı seçim+çözümleme
  // mantığını tekrarlıyordu, tek yerde topluyoruz. `dict` alanı (varsa)
  // mkBilingualLine'ın ikinci dili çözebilmesi için ham sözlüğü taşır.
  function pickInsight(node) {
    if (!node.insights || !node.insights.length) return null;
    const ins = pick(node.insights);
    if (typeof ins === "string") return { text: ins, dict: null };
    const dict = ins && ins.text;
    return { text: tt(dict || {}), dict: dict || null };
  }

  function partLabel(p) {
    const c = CILT_ROMAN[p.cilt] || p.cilt;
    return tt({
      tr: "Fütûhât-ı Mekkiyye · Cilt " + c + " · Kısım " + p.kisim,
      en: "Al-Futuhat al-Makkiyya · Vol. " + c + " · Part " + p.kisim,
      pt: "Al-Futuhat al-Makkiyya · Vol. " + c + " · Parte " + p.kisim,
    });
  }

  // Kısım metinlerindeki <em> alıntıları. Bunlar zaten Dost'un kendi
  // cümleleri (biz onları vurgulamak için <em> ile sarıyoruz), o yüzden
  // kart metni olarak doğrudan kullanılabiliyorlar.
  function quotesFromPart(p) {
    const out = [];
    const visit = (blocks) => {
      (blocks || []).forEach((b) => {
        if (b.type !== "p" || !b.text) return;
        const html = tt(b.text);
        const re = /<em>([\s\S]*?)<\/em>/g;
        let m;
        while ((m = re.exec(html))) {
          const s = m[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
          if (s.length >= 40 && s.length <= 190) out.push(s);
        }
      });
    };
    (p.sections || []).forEach((s) => visit(s.blocks));
    return out;
  }

  // Bir metni cümlelere ayırır (HTML etiketleri temizlenmiş, kısa parçalar
  // elenmiş). "Hikâye" şablonu Sorular'ın kendi cevabını tek parça değil,
  // cümle cümle sahneye taşımak için bunu kullanıyor -- yeni metin YAZMIYOR,
  // var olan cevabı yeniden hızlandırıyor (bkz. dosya başındaki KURAL).
  function splitSentences(raw) {
    const text = String(raw || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    const out = [];
    const re = /[^.!?]+[.!?]+(?:["'”’)]*)?/g;
    let m;
    while ((m = re.exec(text))) {
      const s = m[0].trim();
      if (s) out.push(s);
    }
    return out;
  }

  function pairsFromPart(p) {
    const out = [];
    const collect = (d) => {
      if (d && d.pair && d.pair.left && d.pair.right) out.push(d.pair);
    };
    collect(p.mainDiagram);
    (p.sections || []).forEach((s) => (s.blocks || []).forEach((b) => {
      if (b.type === "diagram") collect(b);
    }));
    return out;
  }

  // Şu an açık olan Fütûhât kısmı varsa onu tercih et; yoksa rastgele.
  function currentPartId() {
    const m = location.pathname.match(/\/futuhat\/(c\d+k\d+)/);
    return m ? m[1] : null;
  }
  function currentCilt() {
    const m = location.pathname.match(/\/futuhat\/c(\d+)k\d+/);
    return m ? parseInt(m[1]) : null;
  }

  function pickPart(needPair, minCount) {
    minCount = minCount || 1;
    return loadIndex().then((idx) => {
      let all = idx.parts.filter((p) => p.status === "active");
      if (kaynakId.startsWith("cilt:")) {
        const c = parseInt(kaynakId.slice(5));
        const f = all.filter((p) => p.cilt === c);
        if (f.length) all = f;
      } else if (kaynakId.startsWith("kisim:")) {
        const id = kaynakId.slice(6);
        const f = all.filter((p) => p.id === id);
        if (f.length) all = f;
      }
      const cur = currentPartId();
      const order = cur && kaynakId === "all"
        ? [all.find((p) => p.id === cur)].filter(Boolean).concat(shuffled(all))
        : shuffled(all);
      // Uygun kayıt bulana kadar sırayla dene (en çok 25 kısım): bazı
      // kısımlarda pair diyagramı ya da yeterince uzun alıntı olmayabilir.
      let i = 0;
      function step() {
        if (i >= Math.min(order.length, 25)) return null;
        const meta = order[i++];
        return loadPart(meta.id).then((p) => {
          const items = needPair ? pairsFromPart(p) : quotesFromPart(p);
          if (items.length < minCount) return step();
          return { part: p, items: items };
        });
      }
      return step();
    });
  }

  function shuffled(a) {
    const c = a.slice();
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = c[i]; c[i] = c[j]; c[j] = t;
    }
    return c;
  }

  // --- sahne içeriği ---------------------------------------------------
  // { lines: [{text, size}], source }  — sahnenin çizeceği tek biçim.
  let scene = null;

  function buildScene(tpl, opts) {
    opts = opts || {};
    if (tpl === "soru") {
      return loadSorular().then((d) => {
        const cats = d.categories || [];
        const q = pick(pick(cats).questions);
        return {
          tpl: "soru",
          lines: [mkBilingualLine(q.question, "soru")],
        };
      });
    }
    if (tpl === "hikaye") {
      // Daha uzun, TikTok'ta bir "hikâye" gibi izlenebilecek bir sahne:
      // Sorular'ın kendi cevabından iki cümle (kuruluş) + sonda sitenin
      // zaten sorduğu soru (kanca). Yeni cümle YAZILMIYOR -- KURAL gereği
      // yalnız var olan cevap ikiye bölünüp yeniden hızlandırılıyor.
      return loadSorular().then((d) => {
        const all = [];
        (d.categories || []).forEach((c) => (c.questions || []).forEach((q) => all.push(q)));
        const usable = all.filter((q) => {
          const s = splitSentences(tt(q.answer)).filter((x) => x.length >= 24 && x.length <= 200);
          return s.length >= 2;
        });
        if (!usable.length) return null;
        const q = pick(usable);
        const sents = splitSentences(tt(q.answer)).filter((x) => x.length >= 24 && x.length <= 200);
        return {
          tpl: "hikaye",
          // Kullanıcı notu (2026-08-02): "hikâye" şablonlarında önce soru
          // verilsin, ardından cevap cümleleri -- kancayı başa çekiyoruz.
          // İki dillilik yalnız soru satırında güvenli: cevap cümleleri
          // splitSentences() ile TEK bir dilin metninden bölünüyor, ikinci
          // dilde aynı sınırların düşeceği garanti değil (bkz. "dizi"
          // şablonundaki aynı çekince) -- yanlış hizalanmış bir çeviri
          // göstermektense hiç göstermiyoruz.
          lines: [
            mkBilingualLine(q.question, "soru"),
            { text: sents[0], kind: "soz" },
            { text: sents[1], kind: "soz" },
          ],
        };
      });
    }
    if (tpl === "gunun") {
      // "Bugünün parçası" (welcome.js) ile AYNI gün-endeksi formülü: gün
      // boyunca herkese aynı kayıt gösteriliyor -- rastgele değil, ortak
      // bir günlük ritim. Kaynak sirlar.json'un zaten kürasyonlu kayıtları.
      return loadSirlar().then((d) => {
        const entries = (d && d.entries) || [];
        if (!entries.length) return null;
        const dayIndex = Math.floor(Date.now() / 86400000);
        const entry = entries[dayIndex % entries.length];
        if (!tt(entry.quote || {})) return null;
        return {
          tpl: "gunun",
          lines: [mkBilingualLine(entry.quote || {}, "soz", 310)],
        };
      });
    }
    if (tpl === "ikili") {
      // Kullanıcı isteği (2026-08-02): Eleştiriler sekmesindeki "eleştiri /
      // Dost'un dediği" çiftleri de bu şablonun üçüncü bir kaynağı --
      // Fütûhât/Füsûs diyagram çiftleriyle aynı iki-satırlı biçimde,
      // ~30% ihtimalle seçiliyor (çeşitlilik için, tekele dönüşmesin diye).
      return loadVahdet().then((vahdet) => {
        const maddeler = (vahdet && vahdet.maddeler) || [];
        function vahdetScene() {
          if (!maddeler.length) return null;
          const m = pick(maddeler);
          return {
            tpl: "ikili",
            lines: [
              mkBilingualLine(m.elestiri.ozet, "sol", 310),
              mkBilingualLine(m.dostunDedigi.ozet, "sag", 310),
            ],
          };
        }
        if (maddeler.length && Math.random() < 0.3) {
          const s = vahdetScene();
          if (s) return s;
        }
        return pickPart(true).then((r) => {
          if (r) {
            const pr = pick(r.items);
            return {
              tpl: "ikili",
              lines: [
                mkBilingualLine(pr.left.label, "sol"),
                mkBilingualLine(pr.right.label, "sag"),
              ],
            };
          }
          return vahdetScene();
        });
      });
    }
    if (tpl === "benzetme") {
      // "Bir Benzetmeyle": esma.json/ontology.json/felsefi-terimler.json'un
      // zaten yazılmış `analogy` alanlarından -- kavram adı + günlük hayat
      // benzetmesi. Yeni metin yok, yalnız var olan benzetmeler bir araya
      // toplanıp seçiliyor (kullanıcı önerisi, 2026-08-02).
      return Promise.all([loadEsma(), loadOntoloji(), loadFelsefiTerimler()]).then(([esma, onto, felsefi]) => {
        const pool = [];
        (esma.nodes || []).forEach((n) => { if (n.analogy) pool.push({ name: n.name, analogy: n.analogy }); });
        (onto.nodes || []).forEach((n) => { if (n.analogy) pool.push({ name: n.name, analogy: n.analogy }); });
        Object.values(felsefi.terms || {}).forEach((t) => { if (t.analogy) pool.push({ name: t.title, analogy: t.analogy }); });
        if (!pool.length) return null;
        const item = pick(pool);
        return {
          tpl: "benzetme",
          lines: [
            mkBilingualLine(item.name, "baslik"),
            mkBilingualLine(item.analogy, "soz", 310),
          ],
        };
      });
    }
    if (tpl === "ontoloji") {
      return loadOntoloji().then((d) => {
        const nodes = (d.nodes || []).filter((n) => n.insights && n.insights.length);
        if (!nodes.length) return null;
        const node = pick(nodes);
        const picked = pickInsight(node);
        if (!picked || !picked.text || picked.text.length < 30) return null;
        return {
          tpl: "ontoloji",
          lines: [
            mkBilingualLine(node.name || {}, "baslik"),
            picked.dict ? mkBilingualLine(picked.dict, "soz", 310) : { text: capText(picked.text, 310), kind: "soz" },
          ],
        };
      });
    }
    if (tpl === "esma") {
      return loadEsma().then((d) => {
        const nodes = (d.nodes || []).filter((n) => n.insights && n.insights.length);
        if (!nodes.length) return null;
        const node = pick(nodes);
        const picked = pickInsight(node);
        if (!picked || !picked.text || picked.text.length < 20) return null;
        return {
          tpl: "esma",
          lines: [
            mkBilingualLine(node.name || {}, "baslik"),
            picked.dict ? mkBilingualLine(picked.dict, "soz", 310) : { text: capText(picked.text, 310), kind: "soz" },
          ],
        };
      });
    }
    if (tpl === "fusus") {
      // Füsûs bölümünün kendi 27-fass halkasını (kullanıcının paylaştığı
      // ekran görüntüsü) doğrudan ödünç alıyoruz -- yeni bir grafik yazmak
      // yerine, zaten sitede kanıtlanmış aynı DostHelix sahnesi (bkz.
      // assets/fusus.js renderMap). `accent` gerçek `status` alanından
      // geliyor ki sparse etiket modu sitedekiyle aynı görünsün.
      return loadFususAtlas().then((d) => {
        const all = d.fasses || [];
        const active = all.filter((f) => f.status === "active");
        if (!active.length) return null;
        const f = pick(active);
        const idx = all.findIndex((x) => x.id === f.id);
        const nameOf = (x) => ({
          tr: x.no + ". " + x.prophet.tr,
          en: x.no + ". " + x.prophet.en,
          pt: x.no + ". " + x.prophet.pt,
        });
        return {
          tpl: "fusus",
          helix: {
            nodes: all.map((x) => ({ id: x.id, label: nameOf(x), accent: x.status === "active" })),
            initialFocus: idx < 0 ? 0 : idx,
          },
          lines: [
            mkBilingualLine(nameOf(f), "baslik"),
            mkBilingualLine(f.title, "soz", 310),
          ],
        };
      });
    }
    if (tpl === "dizi") {
      // "Dizi" (kullanıcı önerisi, 2026-08-03): bir Fütûhât kısmının 3-4
      // alıntısını sırayla, tek bir kaynak başlığı altında gösteren daha
      // uzun bir sahne -- TikTok'ta bir "thread" gibi izlenebilsin diye.
      // Alıntılar tek bir dilde (o an seçili dilde) çıkarıldığı için
      // (bkz. quotesFromPart), iki dilli kart bu şablonda desteklenmiyor --
      // cümle sınırları diller arasında birebir eşleşmeyebilir.
      return pickPart(false, 3).then((r) => {
        if (!r) return null;
        const items = shuffled(r.items).slice(0, Math.min(4, r.items.length));
        const lines = [{ text: partLabel(r.part), kind: "baslik" }];
        items.forEach((t) => lines.push({ text: capText(t, 200), kind: "soz" }));
        return { tpl: "dizi", lines: lines };
      });
    }
    if (tpl === "karsilastir") {
      // "Karşılaştır" (kullanıcı önerisi, 2026-08-03): "İki Kutu"nun
      // rastgele eşleştirmesinin aksine, kullanıcının panelde SEÇTİĞİ iki
      // kavramı (esma+ontoloji havuzundan) yan yana koyar. opts.leftKey/
      // rightKey verilmezse (ilk önizleme, ya da "Başkasını getir")
      // rastgele iki farklı kavram seçilir.
      return loadCompareData().then((d) => {
        const list = d.list;
        if (list.length < 2) return null;
        const left = (opts.leftKey && list.find((x) => x.key === opts.leftKey)) || pick(list);
        const rightPool = list.filter((x) => x !== left);
        const right = (opts.rightKey && list.find((x) => x.key === opts.rightKey && x !== left)) || pick(rightPool.length ? rightPool : list);
        const leftPicked = pickInsight(left);
        const rightPicked = pickInsight(right);
        if (!leftPicked || !rightPicked) return null;
        function combine(nameDict, insightDict, insightText, l) {
          const name = tt(nameDict, l);
          const body = insightDict ? capText(tt(insightDict, l), 140) : capText(insightText, 140);
          return name + " — " + body;
        }
        const leftLine = { text: combine(left.name, leftPicked.dict, leftPicked.text, shareLangId), kind: "sol" };
        const rightLine = { text: combine(right.name, rightPicked.dict, rightPicked.text, shareLangId), kind: "sag" };
        if (ikiDilliMod && ikinciDilId !== shareLangId) {
          leftLine.text2 = combine(left.name, leftPicked.dict, leftPicked.text, ikinciDilId);
          rightLine.text2 = combine(right.name, rightPicked.dict, rightPicked.text, ikinciDilId);
        }
        return { tpl: "karsilastir", lines: [leftLine, rightLine] };
      });
    }
    if (tpl === "ozelgun") {
      // "Özel Gün" (kullanıcı önerisi, 2026-08-03): Hicri takvimle
      // bağlantılı günlerde (Miraç, Kurban Bayramı...) sitede GERÇEKTEN o
      // güne dair bulduğumuz bir kaydı öne çıkarır. Yalnız gerçekten
      // ilgili bir kayıt bulduğumuz iki gün destekleniyor -- geri kalan
      // kandiller için (Berat, Kadir, Mevlid...) sitede henüz doğrudan
      // ilgili bir kayıt yok; onlar için zayıf/rastgele bir eşleştirme
      // göstermek yerine bu şablon o günlerde hiç aday üretmiyor (bkz.
      // dosya başındaki KURAL -- yaptığımız işi olduğundan farklı
      // göstermeyiz). Tarih, tarayıcının Intl "islamic-umalqura"
      // takvimiyle (tablosal hesap) belirleniyor -- gerçek hilal
      // gözlemiyle 1-2 gün fark edebilir, kesin bir dinî tarih iddiası
      // değil, yaklaşık bir işarettir.
      const key = hicriBugun();
      const gun = key && OZEL_GUN[key];
      if (!gun) return Promise.resolve(null);
      return loadSirlar().then((d) => {
        const entries = (d && d.entries) || [];
        const pool = entries.filter((e) => gun.entryIds.includes(e.id));
        if (!pool.length) return null;
        const entry = pick(pool);
        if (!tt(entry.quote || {})) return null;
        return {
          tpl: "ozelgun",
          lines: [
            mkBilingualLine(gun.ad, "baslik"),
            mkBilingualLine(entry.quote || {}, "soz", 310),
          ],
        };
      });
    }
    // "Bir Cümle" (varsayılan/soz şablonu): quotesFromPart() bir kısmın
    // <em> alıntılarını TEK bir dilin HTML'inden regex ile kesiyor -- ikinci
    // dilin metninde aynı cümle sınırlarının aynı yerde düşeceği garanti
    // değil ("dizi" şablonundaki aynı çekince), bu yüzden bilinçli olarak
    // tek dilli kalıyor.
    return pickPart(false).then((r) => {
      if (!r) return null;
      return {
        tpl: "soz",
        lines: [{ text: pick(r.items), kind: "soz" }],
      };
    });
  }

  // Hicri (Kameri) takvimde bugünün ay/gün'ünü "ay-gün" biçiminde döndürür
  // (örn. "7-27" = 7. ay 27. gün) -- tarayıcının ICU "islamic-umalqura"
  // takvimiyle, tablosal/hesaplanmış bir tarih (gerçek hilal gözlemi
  // değil). Desteklenmeyen bir tarayıcıda sessizce null döner.
  function hicriBugun() {
    try {
      const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric" }).formatToParts(new Date());
      const day = parts.find((p) => p.type === "day");
      const month = parts.find((p) => p.type === "month");
      if (!day || !month) return null;
      return month.value + "-" + day.value;
    } catch (e) {
      return null;
    }
  }
  const OZEL_GUN = {
    "7-27": {
      ad: { tr: "Miraç Kandili", en: "Night of the Ascension (Mi'raj)", pt: "Noite da Ascensão (Miraj)" },
      entryIds: ["mirac-in-en-yakin-aninda-ne", "sarabi-icmedim-sirri-aciklamaktan-korktum"],
    },
    "12-10": {
      ad: { tr: "Kurban Bayramı", en: "Feast of Sacrifice (Eid al-Adha)", pt: "Festa do Sacrifício (Eid al-Adha)" },
      entryIds: ["yaratani-yaratilmis-yaratilmisi-yaratan-gormek-ibrahim"],
    },
  };

  // --- sahne çizimi ----------------------------------------------------
  let stageEl = null, rafId = 0, tilt = null, startTs = 0, chromeTimer = 0, helixHandle = null;
  // frame()/drawAmbient() saniyede 60 kez çalışıyor -- her karede aynı
  // düğümleri querySelector(All) ile yeniden aramak yerine, sahne AÇILIRKEN
  // (bir kez) önbelleğe alınıyor. DOM stageMarkup() tarafından yalnız
  // openStage()'de kuruluyor, döngü boyunca değişmiyor -- bu yüzden güvenli.
  let cacheFrame = null, cacheSvg = null, cacheSpiral = null, cacheHalo = null, cacheZatHalo = null, cacheDots = null, cacheLines = null, cacheRule = null;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Şablon başına döngü uzunluğu (ms) ve metin vuruşları. Vuruşlar
  // [giriş, çıkış] biçiminde, döngü içindeki oranlar.
  const TIMING = {
    soz:      { loop: 9000,  beats: [[0.09, 0.94]] },
    gunun:    { loop: 9000,  beats: [[0.09, 0.94]] },
    ikili:    { loop: 8500,  beats: [[0.09, 0.94], [0.22, 0.94]] },
    soru:     { loop: 8500,  beats: [[0.09, 0.94]] },
    // Üç vuruşlu, daha uzun bir döngü: soru en başta girip ekranda kalıyor
    // ("kanca" burada), iki cevap cümlesi ardından sırayla altına ekleniyor.
    // 15000 -> 20000 (2026-08-02 kullanıcı bildirimi): metin derin anlamlar
    // taşıyor ve okuyucu tam hazmetmeye başlarken kayboluyordu -- vuruş
    // ORANLARI aynı kaldı (sadece döngü uzadı), yani her satırın giriş/çıkış
    // sırası aynı hissi veriyor, sadece hepsi orantılı olarak yavaşladı.
    hikaye:   { loop: 20000, beats: [[0.04, 0.97], [0.24, 0.97], [0.52, 0.97]] },
    ontoloji: { loop: 9500,  beats: [[0.07, 0.75], [0.22, 0.94]] },
    esma:     { loop: 9500,  beats: [[0.07, 0.75], [0.22, 0.94]] },
    benzetme: { loop: 9500,  beats: [[0.07, 0.75], [0.22, 0.94]] },
    fusus:    { loop: 9500,  beats: [[0.07, 0.75], [0.22, 0.94]] },
    karsilastir: { loop: 8500, beats: [[0.09, 0.94], [0.22, 0.94]] },
    ozelgun:  { loop: 9500,  beats: [[0.07, 0.75], [0.22, 0.94]] },
  };

  // "Dizi" satır sayısı 4-5 arasında değişebildiği için (1 kaynak başlığı +
  // 3-4 alıntı) TIMING'deki sabit vuruş dizileri yetmiyor -- satır sayısına
  // göre kendi vuruşlarını üreten bir taban hesaplıyoruz: giriş zamanları
  // eşit aralıklarla yayılır, hepsi sona doğru birlikte söner.
  function diziBase(n) {
    const loop = 10600 + Math.max(0, n - 1) * 4700;
    const beats = [];
    for (let i = 0; i < n; i++) {
      const from = n > 1 ? 0.04 + i * (0.50 / (n - 1)) : 0.04;
      beats.push([from, 0.94]);
    }
    return { loop: loop, beats: beats };
  }

  // Bazı kayıtların cümlesi uzun olduğunda TIMING'deki sabit döngü kısa
  // kalıyor -- kullanıcı bildirimi (2026-08-03): "son cümlenin de görünür
  // olmasından sonra ekranda kalma süresi biraz kısa". Kelime sayısına göre
  // bir "ek tutma" payı hesaplayıp yalnız EKRANDA KALMA (sönmeye başlama)
  // anını öteliyoruz; belirme (fade-in) zamanlaması mutlak ms cinsinden
  // aynı kalıyor ki uzun metinde sahnenin girişi de yavaşlamış hissettirmesin.
  const HOLD_BASE_WORDS = 16;
  const HOLD_MS_PER_WORD = 140;
  const HOLD_MAX_MS = 7000;
  function wordCount(text) { return text.trim().split(/\s+/).filter(Boolean).length; }
  // "ikili"/"karsilastir" şablonlarındaki bölme çizgisinin (.share-rule)
  // sabit vuruşu -- frame()'in RULE_BEAT_DEFAULT'u kullanabilmesi için, ve
  // aşağıda extra süre eklendiğinde SATIRLARLA AYNI ORANDA rescale edilsin
  // diye burada tanımlı.
  const RULE_BEAT_DEFAULT = [0.30, 0.94];
  function computeTiming(s) {
    const base = s.tpl === "dizi" ? diziBase(s.lines.length) : (TIMING[s.tpl] || TIMING.soz);
    const words = s.lines.reduce((n, l) => n + wordCount(l.text) + (l.text2 ? wordCount(l.text2) : 0), 0);
    const extra = Math.min(HOLD_MAX_MS, Math.max(0, words - HOLD_BASE_WORDS) * HOLD_MS_PER_WORD);
    if (!extra) return Object.assign({ ruleBeat: RULE_BEAT_DEFAULT }, base);
    const loop = base.loop + extra;
    const beats = base.beats.map((b) => [(b[0] * base.loop) / loop, (b[1] * base.loop + extra) / loop]);
    // Çizgi de satırlarla aynı rescale'i alıyor -- aksi hâlde döngü uzarken
    // sabit 0.30 oranı çizgiyi ikinci satırdan giderek geç göstermeye
    // başlıyordu (bkz. teknik inceleme, bulgu #4).
    const ruleBeat = [(RULE_BEAT_DEFAULT[0] * base.loop) / loop, (RULE_BEAT_DEFAULT[1] * base.loop + extra) / loop];
    return { loop: loop, beats: beats, ruleBeat: ruleBeat };
  }

  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // --- ÇEKİM planı (kayıt kipi) -----------------------------------------
  // Sahne ekranda dönerken bir DÖNGÜ oynuyor: metin belirir, durur, söner,
  // baştan başlar. Bu, sayfada bakarken doğru; ama kaydedilen video için
  // yanlış -- kullanıcı notu (2026-07-28): "ekranda göründüğü haliyle değil,
  // en başından sonuna kadar rahatça her şeyin izlenebileceği bir kayıt".
  // Kayıtta bu yüzden ayrı bir zaman çizgisi kuruyoruz: karartıdan açılır,
  // satırlar sırayla girer, metin RAHATÇA OKUNACAK kadar durur, sonra
  // bütün kare karartıya kapanır. Süre metnin uzunluğundan hesaplanıyor --
  // sabit bir süre kısa alıntıda boş, uzun alıntıda yetersiz kalıyordu.
  const READ_WPS = 2.1;   // saniyede kelime; ekrandan rahat okuma hızı
  // "Hikâye" iki kuruluş cümlesi + bir soru taşıdığı için tek cümlelik
  // şablonlardan (soz/soru/ikili/ontoloji/esma) fazla kelime biriktiriyor;
  // onlara uygulanan 11 sn okuma / 22 sn toplam tavanı burada erken keserdi.
  // Ekrandaki döngü 15000 -> 20000ms'ye uzatıldığı için (2026-08-02),
  // kayıt tavanları da aynı oranda büyütüldü -- indirilen video ekranda
  // görülenden daha aceleci hissetmesin diye.
  const READ_CAP = { hikaye: 28, dizi: 34 };
  const TOTAL_CAP = { hikaye: 46, dizi: 52 };
  function takePlan(s) {
    const fadeIn = 0.7, fadeOut = 1.2, lineIn = 1.15;
    const cues = [];
    let t = fadeIn + 0.2;
    s.lines.forEach(() => { cues.push(t); t += lineIn; });
    const ruleAt = s.tpl === "ikili" || s.tpl === "karsilastir" ? t : null;
    if (ruleAt != null) t += 0.9;
    const words = s.lines.reduce((n, l) => n + wordCount(l.text) + (l.text2 ? wordCount(l.text2) : 0), 0);
    const read = Math.min(READ_CAP[s.tpl] || 11, Math.max(3.2, words / READ_WPS));
    return {
      fadeIn: fadeIn, fadeOut: fadeOut, lineIn: lineIn, cues: cues, ruleAt: ruleAt,
      // 8 sn'nin altı TikTok'ta göz kırpması gibi geçiyor, tavanın üstü
      // (şablona göre 22 ya da 40 sn) tek bir sahne için uzun.
      total: Math.min(TOTAL_CAP[s.tpl] || 22, Math.max(8, t + read + fadeOut)),
    };
  }

  let takeMode = false, takeStart = 0, plan = null;
  // Kart (PNG) yakalanırken frame()'in satır opaklığını üzerine yazmasını
  // durduran bayrak -- bkz. captureCardToFile.
  let cardCapturing = false;

  function drawTake(el, ts) {
    const t = (ts - takeStart) / 1000;
    const fade = el.querySelector(".share-stage__fade");
    let fv = 0;
    // t < 0: kayıt başlamadan önceki "siyahta bekleme" payı. getDisplayMedia
    // akışı sayfadan birkaç kare geride olduğu için bu pay olmadan videonun
    // ilk kareleri kararmayı hiç görmüyor, parlak başlıyordu (ölçüldü).
    if (t < 0) fv = 1;
    else if (t < plan.fadeIn) fv = 1 - ease(t / plan.fadeIn);
    else if (t > plan.total - plan.fadeOut) fv = ease(clamp01((t - (plan.total - plan.fadeOut)) / plan.fadeOut));
    fade.style.opacity = fv.toFixed(3);
    el.querySelectorAll(".share-line").forEach((node) => {
      // İki dilli kartta bir logic satır İKİ .share-line üretebiliyor
      // (primary+secondary) -- data-li, ikisinin de AYNI vuruşu paylaşmasını
      // sağlıyor (DOM sırasına göre indekslemek ikinci dilde kayardı).
      const li = parseInt(node.dataset.li, 10) || 0;
      const v = ease(clamp01((t - (plan.cues[li] != null ? plan.cues[li] : 0)) / plan.lineIn));
      node.style.opacity = v.toFixed(3);
      node.style.transform = "translateY(" + ((1 - v) * 16).toFixed(1) + "px)";
    });
    const rule = el.querySelector(".share-rule");
    if (rule) {
      const v = plan.ruleAt == null ? 0 : ease(clamp01((t - plan.ruleAt) / 0.9));
      rule.style.opacity = (v * 0.55).toFixed(3);
      rule.style.transform = "scaleX(" + v.toFixed(3) + ")";
    }
  }
  // Bir vuruşun o andaki görünürlüğü: kısa bir belirme, uzun bir duruş,
  // kısa bir sönme. Döngü başa sardığında sert bir kesme olmasın diye.
  function beat(t, from, to) {
    if (t < from || t > to) return 0;
    const span = to - from, p = (t - from) / span;
    const fade = Math.min(0.22, span * 0.35) / span;
    if (p < fade) return ease(p / fade);
    if (p > 1 - fade) return ease((1 - p) / fade);
    return 1;
  }

  // --- zeminler ---------------------------------------------------------
  // Paylaşım sahnesinin arka planı. Hepsi aynı biçimde: sakin dönen,
  // üç boyutlu, dairesel/sarmal bir form (bkz. CLAUDE.md "Dairenin üçüncü
  // boyutu: sarmal"). Tek motor, farklı ayarlar -- ayrı çizim kodları
  // yazmak yerine tek bir sarmal üreteci parametreleniyor, böylece yeni
  // bir zemin eklemek bir satırlık bir iş.
  //
  // `fusus` bilerek Füsûs bölümünün sol sütunundaki uzun sarmalın aynısı
  // (kullanıcı isteği, 2026-07-29): çok düğüm, iki buçuk tur, yüksek
  // yükseliş.
  const ZEMIN = [
    { id: "sarmal", ad: { tr: "Sarmal", en: "Spiral", pt: "Espiral" },
      n: 30, tur: 1, yari: 0.30, yuk: 2.1, ac: 0.34, nokta: 3.4, hale: 0.30, halka: 0 },
    { id: "fusus", ad: { tr: "Uzun sarmal", en: "Long coil", pt: "Espiral longa" },
      n: 27, tur: 2.4, yari: 0.26, yuk: 3.0, ac: 0.30, nokta: 3.0, hale: 0.16, halka: 0 },
    { id: "halka", ad: { tr: "İç içe halka", en: "Nested rings", pt: "Anéis concêntricos" },
      n: 34, tur: 1, yari: 0.32, yuk: 0.5, ac: 0.02, nokta: 3.2, hale: 0.24, halka: 3 },
    { id: "nefes", ad: { tr: "Nefes", en: "Breath", pt: "Sopro" },
      n: 22, tur: 1, yari: 0.28, yuk: 1.2, ac: 0.10, nokta: 4.2, hale: 0.52, halka: 0, nefes: true },
    { id: "sade", ad: { tr: "Sade", en: "Plain", pt: "Simples" },
      n: 14, tur: 1, yari: 0.34, yuk: 1.6, ac: 0.20, nokta: 2.6, hale: 0.20, halka: 0, cizgisiz: true },
    // Dört yeni zemin (kullanıcı isteği, 2026-07-30): "daha fazla arka plan
    // seçeneği, metafizik anlamı kuvvetli, düğümler farklı/canlı renklerle;
    // video gibi canlı hissi de olsun."  Süsleyici renk çarkı yerine hepsi
    // sitenin gerçek kavramlarını kodluyor:
    //  - "celalcemal": esmâ'nın celâl/cemâl ayrımı -- düğümler dönüşümlü.
    //  - "esik": iki uç arasındaki berzah/eşik -- renk sürekli kayıyor.
    //  - "feyz": nefes-i Rahmânî'nin feyz/taşması -- bir dalga sarmalı
    //    boyunca aşağı akar; "video-benzeri" canlı his tam burada.
    //  - "esma": yedi Ümmehât-ı Esmâ'nın yedi rengi -- Hayy/Alîm/Mürîd/
    //    Kadîr/Semî'/Basîr/Mütekellim, her düğüm kendi isminin renginde.
    { id: "celalcemal", ad: { tr: "Celâl-Cemâl", en: "Majesty-Beauty", pt: "Majestade-Beleza" },
      n: 28, tur: 1.6, yari: 0.30, yuk: 2.4, ac: 0.30, nokta: 3.6, hale: 0.28, halka: 0, renk: "cift" },
    { id: "esik", ad: { tr: "Eşik", en: "Threshold", pt: "Limiar" },
      n: 24, tur: 1.2, yari: 0.30, yuk: 2.0, ac: 0.26, nokta: 3.6, hale: 0.30, halka: 0, renk: "gecis" },
    { id: "feyz", ad: { tr: "Feyz", en: "Emanation", pt: "Emanação" },
      n: 36, tur: 1.8, yari: 0.29, yuk: 2.8, ac: 0.28, nokta: 3.0, hale: 0.36, halka: 0, renk: "feyz" },
    { id: "esma", ad: { tr: "Esmâ", en: "Divine Names", pt: "Nomes Divinos" },
      n: 35, tur: 2.0, yari: 0.28, yuk: 2.6, ac: 0.26, nokta: 3.2, hale: 0.22, halka: 0, renk: "esma" },
    // Dört yeni pastel zemin (kullanıcı isteği, 2026-08-03): "değişik pastel
    // renkli canlı tasavvufi manevi havası olan arka plan seçenekleri" --
    // yine sitenin kendi imgelerine bağlı, süsleyici değil:
    //  - "seher": seherin/teheccüdün sakin uyanışı -- lavanta'dan şeftaliye
    //    yumuşak bir geçiş, sarmal boyunca kayan.
    //  - "gul": gül bahçesi -- pembe/yeşil dönüşümlü (celâl-cemâl'in
    //    "cift" mekaniğiyle aynı, farklı bir imge/renk üzerinden).
    //  - "deniz": vahdet-i vücûd'un sık kullanılan okyanus metaforu --
    //    "feyz"le aynı dalga mekaniği, turkuaz-lacivert.
    //  - "ney": ney'in inlemesi -- sıcak bakır tek ton, az düğüm (ney'in
    //    az sayıdaki deliği gibi), sade ve durağan bir sıcaklık.
    { id: "seher", ad: { tr: "Seherin İlk Işığı", en: "First Light of Dawn", pt: "Primeira Luz da Alva" },
      n: 26, tur: 1.3, yari: 0.29, yuk: 1.8, ac: 0.24, nokta: 3.2, hale: 0.34, halka: 0, renk: "seher" },
    { id: "gul", ad: { tr: "Gül Bahçesi", en: "Rose Garden", pt: "Jardim de Rosas" },
      n: 24, tur: 1.4, yari: 0.30, yuk: 2.0, ac: 0.26, nokta: 3.6, hale: 0.26, halka: 0, renk: "gul" },
    { id: "deniz", ad: { tr: "Deniz-i Muhît", en: "Encompassing Ocean", pt: "Oceano Circundante" },
      n: 32, tur: 1.6, yari: 0.30, yuk: 2.2, ac: 0.28, nokta: 3.4, hale: 0.30, halka: 0, renk: "deniz" },
    { id: "ney", ad: { tr: "Ney İnlemesi", en: "The Reed's Lament", pt: "O Lamento do Ney" },
      n: 18, tur: 1, yari: 0.32, yuk: 1.4, ac: 0.18, nokta: 3.8, hale: 0.30, halka: 0, renk: "ney" },
  ];
  // "renk: cift" için iki sabit ton (celâl/cemâl); "renk: gecis" için
  // sarmal boyunca aralarında kayan iki uç. İkisi de hem koyu hem açık
  // zeminde okunaklı kalacak şekilde seçildi (dekoratif öğeler oldukları
  // için metin kontrastı ölçütü uygulanmıyor, ama yine de göz önünde
  // tutuldu).
  const RENK = {
    celal: "#e2632b", cemal: "#7c5cff",
    esikA: "#eda100", esikB: "#4b3f8f",
    // Feyz: sıcak altın (tepe) → derin turuncu (dip); hem koyu hem açık zeminde okunabilir.
    feyzA: "#fdb347", feyzB: "#c04a0f",
    // Yedi Ümmehât: Hayy·Alîm·Mürîd·Kadîr·Semî'·Basîr·Mütekellim sırasıyla.
    esma: ["#3fb87a", "#4a9eff", "#a855f7", "#e2632b", "#06b6d4", "#eab308", "#ec4899"],
    // Dört yeni pastel zemin (2026-08-03).
    seherA: "#d9c9ff", seherB: "#ffd2b3",
    gulPembe: "#f2a6c4", gulYesil: "#8fbf7f",
    denizA: "#3fd6c8", denizB: "#1a3f6b",
    ney: "#cf9a5c",
  };
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function renkGecis(a, b, t) {
    const A = hexRgb(a), B = hexRgb(b);
    const r = Math.round(A[0] + (B[0] - A[0]) * t);
    const g = Math.round(A[1] + (B[1] - A[1]) * t);
    const bl = Math.round(A[2] + (B[2] - A[2]) * t);
    return "rgb(" + r + "," + g + "," + bl + ")";
  }
  const ZEMIN_ANAHTAR  = "dost-share-zemin";
  const ISIK_ANAHTAR   = "dost-share-isik";
  const KARE_ANAHTAR   = "dost-share-kare";
  const FAV_ANAHTAR    = "dost-share-fav";
  const KAYNAK_ANAHTAR = "dost-share-kaynak";
  const TARIH_ANAHTAR  = "dost-share-tarih";
  const MAX_FAV = 20, MAX_TARIH = 5;
  let zeminId  = safeGet(ZEMIN_ANAHTAR) || "sarmal";
  let acikMod  = safeGet(ISIK_ANAHTAR) === "1";
  // Kullanıcı isteği (2026-08-02): kare (1:1) format seçeneği -- feed
  // paylaşımı için 9:16 dikey gereksiz uzun kalıyordu.
  let kareMod  = safeGet(KARE_ANAHTAR) === "1";
  let kaynakId = safeGet(KAYNAK_ANAHTAR) || "all";

  function safeGet(k) {
    // localStorage gizli kipte ya da üçüncü-taraf çerezleri kapalıyken
    // erişimde hata fırlatabiliyor; zemin tercihi uğruna sahne açılmasın
    // diye sarmalanıyor.
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function safeSet(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* yoksay */ }
  }
  function zemin() {
    return ZEMIN.find((z) => z.id === zeminId) || ZEMIN[0];
  }

  // En kalabalık zemin kadar düğüm önceden hazırlanıyor; zemin değişince
  // yalnız kaçının çizileceği değişiyor, DOM yeniden kurulmuyor.
  const NODE_COUNT = Math.max.apply(null, ZEMIN.map((z) => z.n));
  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({ phase: Math.random() * 6.28 });
  }

  // Sarmal: hal.js/menziller ile aynı motor (GU.createTilt'in project'i).
  // Kullanıcının isteği buydu -- sahne, sitenin kendi sakin dairesel
  // dönüşünden beslensin (bkz. CLAUDE.md "Dairenin üçüncü boyutu: sarmal").
  function drawAmbient(w, h, ts) {
    const z = zemin();
    // "Füsûs Halkası" İÇERİK şablonu (scene.tpl === "fusus" -- bu, aşağıdaki
    // BACKDROP seçeneklerinden biri olan "Uzun sarmal" zemininden [z.id ===
    // "fusus"] AYRI bir kimlik, ikisi de "fusus" adını taşıdığı için
    // karışıyor) bu genel prosedürel sarmal yerine kendi gerçek DostHelix
    // sahnesini taşıyor (bkz. .share-stage__frame--fusus CSS'i, share-spiral/
    // dot/halo'yu opacity:0 yapar) -- ama bu fonksiyon her karede KOŞULSUZ
    // çalışıp aynı elemanlara satır-içi style.opacity yazıyordu, ki satır-içi
    // stil her zaman sınıf kuralını eziyor. Sonuç: CSS'in gizlemeye çalıştığı
    // eski sarmal, gerçek Füsûs sarmalının arkasında sönük sönük nefes
    // alırken görünüyordu (2026-08-04 kullanıcı bildirimi). Bu şablonda hiç
    // çizmeden erken çıkıyoruz.
    if (scene && scene.tpl === "fusus") {
      if (cacheSpiral) cacheSpiral.setAttribute("d", "");
      if (cacheHalo) cacheHalo.style.opacity = "0";
      // display:none, opacity değil -- .share-zat-halo'nun CSS nefes
      // animasyonu opacity'yi her karede kendi yazıyor, satır-içi
      // opacity:0 onu geçici olarak eziyor ama animasyon devam ettiği
      // için bir sonraki karede yeniden görünür oluyordu.
      if (cacheZatHalo) cacheZatHalo.style.display = "none";
      if (cacheDots) cacheDots.forEach((c) => { c.style.opacity = "0"; });
      return;
    }
    const cx = w / 2, cy = h * 0.5;
    const R = Math.min(w, h) * z.yari;
    const H = R * z.yuk;
    // "nefes" zemininde halkanın kendisi de açılıp kapanıyor: nefes-i
    // Rahmânî'nin sitedeki karşılığı hep bu altı saniyelik ritim.
    const nfs = z.nefes && !reduceMotion
      ? 1 + 0.10 * Math.sin((ts / 6000) * 2 * Math.PI) : 1;
    let d = "";
    const pts = [];
    for (let i = 0; i < z.n; i++) {
      const n = nodes[i];
      const t = i / Math.max(1, z.n - 1);
      const a = -Math.PI / 2 + t * Math.PI * 2 * z.tur;
      // `halka` zemininde yarıçap sürekli açılmıyor, basamak basamak
      // sıçrıyor: iç içe duran ayrı halkalar çıkıyor (Sırlar'daki perde
      // halkasının sahnedeki karşılığı).
      const adim = z.halka ? Math.floor(t * z.halka) / Math.max(1, z.halka - 1) : t;
      const rr = R * (0.72 + z.ac * adim) * nfs;
      const px = rr * Math.cos(a), py = rr * Math.sin(a);
      const vert = -H / 2 + H * t;
      const p = tilt ? tilt.project(px, py, vert) : { x: px, y: py, depth: 1 };
      const X = cx + p.x, Y = cy + p.y;
      pts.push({ x: X, y: Y, depth: p.depth == null ? 1 : p.depth, phase: n.phase });
      d += (i === 0 ? "M" : "L") + X.toFixed(1) + "," + Y.toFixed(1);
    }
    cacheSpiral.setAttribute("d", z.cizgisiz ? "" : d);
    let zatPt = null;
    cacheDots.forEach((c, i) => {
      const p = pts[i];
      if (!p) { c.style.opacity = "0"; return; }
      const br = reduceMotion ? 1 : 1 + 0.14 * Math.sin(ts / 3400 + p.phase);
      c.setAttribute("cx", p.x.toFixed(1));
      c.setAttribute("cy", p.y.toFixed(1));
      c.setAttribute("r", (z.nokta * p.depth * br).toFixed(2));
      c.style.opacity = (0.30 + 0.42 * p.depth).toFixed(2);
      // Renkli zeminler: düğüm rengi CSS'teki tek tonun (--sahne-murekkep)
      // yerine geçiyor; öteki zeminlerde her karede boşaltılıyor ki
      // önceki bir renkli zeminden kalan satır-içi renk yapışık kalmasın.
      if (z.renk === "cift") {
        c.style.fill = i % 2 === 0 ? RENK.celal : RENK.cemal;
      } else if (z.renk === "gecis") {
        c.style.fill = renkGecis(RENK.esikA, RENK.esikB, i / Math.max(1, z.n - 1));
      } else if (z.renk === "feyz") {
        // Altın dalga sarmal boyunca aşağı akar -- feyz/taşma hareketi.
        const fPos = i / Math.max(1, z.n - 1);
        c.style.fill = renkGecis(RENK.feyzA, RENK.feyzB, fPos);
        if (!reduceMotion) {
          const wave = (1 - Math.cos(ts / 1200 - fPos * Math.PI * 4)) / 2;
          c.style.opacity = (0.05 + 0.88 * wave).toFixed(2);
        }
      } else if (z.renk === "esma") {
        // Her düğüm bir Ümmehât isminin rengi; 7'nin katı düğümde renk döner.
        c.style.fill = RENK.esma[i % RENK.esma.length];
      } else if (z.renk === "seher") {
        c.style.fill = renkGecis(RENK.seherA, RENK.seherB, i / Math.max(1, z.n - 1));
      } else if (z.renk === "gul") {
        c.style.fill = i % 2 === 0 ? RENK.gulPembe : RENK.gulYesil;
      } else if (z.renk === "deniz") {
        // Deniz-i Muhît: turkuazdan lacivert dibe, feyz'le aynı dalga
        // mekaniği ama okyanus imgesiyle.
        const dPos = i / Math.max(1, z.n - 1);
        c.style.fill = renkGecis(RENK.denizA, RENK.denizB, dPos);
        if (!reduceMotion) {
          const wave = (1 - Math.cos(ts / 1500 - dPos * Math.PI * 4)) / 2;
          c.style.opacity = (0.15 + 0.75 * wave).toFixed(2);
        }
      } else if (z.renk === "ney") {
        c.style.fill = RENK.ney;
      } else {
        c.style.fill = "";
      }
      // Sarmalın tepesi: "O'ndan geldik, O'na gidiyoruz" (CLAUDE.md).
      // ÖLÇÜLEN DÜZELTME (2026-08-04, kullanıcı bildirimi): önce i = n-1'i
      // "tepe" sandık, ama tilt.project()'in gerçek izdüşüm matematiğini
      // (yaw tam turda ekran-Y'yi vert ile aynı yönde taşımıyor) sayısal
      // olarak sınayınca i = n-1'in EKRANDA ALTA, i = 0'ın ÜSTE düştüğü
      // ortaya çıktı -- kullanıcının "düğüm altta" gözlemiyle birebir
      // örtüşüyor. Düğümün görünümü de artık ontoloji/esmâ'daki Zât
      // düğümünün BİREBİR AYNISI: bembeyaz gövde + altın, 6 saniyelik
      // nefes alan bir hâle (statik bir parıltı filtresi değil) -- bkz.
      // .node--root .node-halo (style.css), oran (34/13 ≈ 2.6) da oradan.
      if (i === 0) {
        c.style.fill = "#ffffff";
        c.style.filter = "";
        c.setAttribute("r", (z.nokta * p.depth * br * 2.6).toFixed(2));
        c.style.opacity = "1";
        zatPt = p;
      } else {
        c.style.filter = "";
      }
    });
    if (zatPt && cacheZatHalo) {
      cacheZatHalo.style.display = "";
      cacheZatHalo.setAttribute("cx", zatPt.x.toFixed(1));
      cacheZatHalo.setAttribute("cy", zatPt.y.toFixed(1));
      cacheZatHalo.setAttribute("r", (z.nokta * zatPt.depth * 2.6 * 1.4).toFixed(2));
    }
    // Merkezdeki nefes alan halka: ontoloji/esmâ'daki Zât halosuyla aynı
    // 6 saniyelik ritim.
    const halo = cacheHalo;
    if (z.renk === "cift") halo.style.fill = renkGecis(RENK.celal, RENK.cemal, 0.5);
    else if (z.renk === "gecis") halo.style.fill = renkGecis(RENK.esikA, RENK.esikB, 0.5);
    else if (z.renk === "feyz") halo.style.fill = RENK.feyzA;
    else if (z.renk === "esma") halo.style.fill = RENK.esma[3]; // Kadîr -- merkezde
    else if (z.renk === "seher") halo.style.fill = renkGecis(RENK.seherA, RENK.seherB, 0.5);
    else if (z.renk === "gul") halo.style.fill = RENK.gulPembe;
    else if (z.renk === "deniz") halo.style.fill = RENK.denizA;
    else if (z.renk === "ney") halo.style.fill = RENK.ney;
    else halo.style.fill = "";
    const ph = reduceMotion ? 0.5 : (1 - Math.cos((ts / 6000) * 2 * Math.PI)) / 2;
    halo.setAttribute("cx", cx); halo.setAttribute("cy", cy);
    halo.setAttribute("r", (R * z.hale * (1 + 0.4 * ph)).toFixed(1));
    halo.style.opacity = (0.14 + 0.20 * ph).toFixed(3);
  }

  function frame(ts) {
    if (!stageEl) return;
    if (!startTs) startTs = ts;
    const el = stageEl;
    const box = cacheFrame, svg = cacheSvg;
    const w = box.clientWidth, h = box.clientHeight;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    if (tilt) tilt.step(ts, 16, true);
    drawAmbient(w, h, ts);

    if (takeMode) { drawTake(el, ts); rafId = requestAnimationFrame(frame); return; }
    if (cardCapturing) { rafId = requestAnimationFrame(frame); return; }

    const cfg = scene._timing || TIMING[scene.tpl] || TIMING.soz;
    const t = ((ts - startTs) % cfg.loop) / cfg.loop;
    cacheLines.forEach((node) => {
      // bkz. drawTake'teki aynı not: data-li, iki dilli bir satırın iki
      // .share-line'ının da AYNI vuruşu paylaşmasını sağlıyor.
      const li = parseInt(node.dataset.li, 10) || 0;
      const b = cfg.beats[li] || cfg.beats[cfg.beats.length - 1];
      const v = beat(t, b[0], b[1]);
      node.style.opacity = v.toFixed(3);
      node.style.transform = "translateY(" + ((1 - v) * 14).toFixed(1) + "px)";
    });
    const rule = cacheRule;
    if (rule) {
      const rb = cfg.ruleBeat || RULE_BEAT_DEFAULT;
      const v = beat(t, rb[0], rb[1]);
      rule.style.opacity = (v * 0.55).toFixed(3);
      rule.style.transform = "scaleX(" + v.toFixed(3) + ")";
    }
    rafId = requestAnimationFrame(frame);
  }

  function stageMarkup(s) {
    const lines = s.lines.map((l, li) => {
      const primary = '<p class="share-line share-line--' + l.kind + '" data-li="' + li + '">' + escapeHtml(plainText(l.text)) + "</p>";
      const secondary = l.text2
        ? '<p class="share-line share-line--' + l.kind + ' share-line--secondary" data-li="' + li + '">' + escapeHtml(plainText(l.text2)) + "</p>"
        : "";
      // İki dilli kartta bir mantıksal satırın çevirisi hemen altında
      // duruyor -- flex gap'i mantıksal satırlar arasında (grup), çeviri
      // çifti arasında (grup içi, CSS'te daha dar) ayrı tutmak için sarma.
      return '<div class="share-line-group">' + primary + secondary + "</div>";
    }).join(s.tpl === "ikili" || s.tpl === "karsilastir" ? '<span class="share-rule" aria-hidden="true"></span>' : "");
    // "Füsûs Halkası" şablonu, ambient sarmal yerine Füsûs bölümünün kendi
    // 27-fass halkasını (DostHelix) taşıyor -- bkz. openStage/closeStage.
    const helixMarkup = s.tpl === "fusus" ? '<div class="share-stage__helix" aria-hidden="true"></div>' : "";
    return (
      '<div class="share-stage__frame share-stage__frame--' + s.tpl + '">' +
      '<svg class="share-stage__svg" aria-hidden="true">' +
      '<circle class="share-halo"></circle>' +
      '<path class="share-spiral" fill="none"></path>' +
      '<circle class="share-zat-halo"></circle>' +
      new Array(NODE_COUNT).fill('<circle class="share-dot"></circle>').join("") +
      "</svg>" +
      helixMarkup +
      '<div class="share-stage__text">' + lines + "</div>" +
      '<div class="share-stage__qr" aria-hidden="true">' + qrSvg() + "</div>" +
      '<div class="share-stage__guides" hidden></div>' +
      // Kayıt kipinde açılış/kapanış karartısı. Sahne döngüsünde hep saydam.
      '<div class="share-stage__fade" style="opacity:0"></div>' +
      "</div>" +
      // Krom ve kayıt göstergesi ÇERÇEVENİN DIŞINDA duruyor: masaüstünde
      // kayıt tam olarak çerçeveye kırpıldığı için, buradaki hiçbir şey
      // videoya girmiyor. (Telefonda çerçeve ekranı doldurduğu için krom
      // içeri düşüyor; orada da zaten ekran kaydı kullanılıyor ve krom
      // 2,2 saniye sonra soluyor.)
      '<div class="share-stage__chrome">' +
      (canRecord
        ? '<button type="button" data-action="rec">' + escapeHtml(tt(UI.rec)) + "</button>" +
          '<button type="button" data-action="kart">' + escapeHtml(tt(UI.kart)) + "</button>"
        : '<button type="button" data-action="recyok" aria-label="' + escapeHtml(tt(UI.recYok)) + '">?</button>') +
      '<button type="button" data-action="guides">' + escapeHtml(tt(UI.guides)) + "</button>" +
      '<button type="button" data-action="close">✕</button>' +
      "</div>" +
      '<p class="share-stage__rec" hidden></p>'
    );
  }

  // --- masaüstünde doğrudan video indirme --------------------------------
  // Telefonda ekran kaydı doğal yol; bilgisayarda değil (kullanıcı notu,
  // 2026-07-28). Burada sekmeyi getDisplayMedia ile yakalayıp SADECE 9:16
  // çerçeveyi bir tuvale kırpıyoruz, sonra MediaRecorder'a veriyoruz.
  // Kırpma sayesinde çıktı tam 1080x1920 oluyor ve masaüstündeki siyah
  // kenarlar ile arayüz düğmeleri videoya hiç girmiyor.
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia &&
    window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
  // mp4 önce denenir: TikTok webm'i çoğu zaman reddediyor. Chrome 130+ ve
  // Safari MediaRecorder'da mp4 üretebiliyor; üretemeyen tarayıcıda webm'e
  // düşüyoruz (o dosya da yüklenebiliyor ama garantisi yok).
  const MIMES = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  function pickMime() {
    for (const m of MIMES) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
    }
    return "";
  }

  function recStatus(text, busy) {
    const el = stageEl && stageEl.querySelector(".share-stage__rec");
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
    el.classList.toggle("is-busy", !!busy);
  }

  // `preferCurrentTab` yalnız tarayıcının kendi seçim ekranında "Bu sekme"yi
  // ÖN SEÇİLİ getirir -- kullanıcı yine de "Bütün ekran" ya da başka bir
  // pencere seçebilir. O durumda aşağıdaki sabit kırpma matematiği (sx/sy,
  // frameEl.getBoundingClientRect()) yanlış bölgeyi keser ve sessizce
  // bozuk bir görüntü/video iner. displaySurface "browser" değilse akışı
  // hemen durdurup recFail göstererek bu sessiz hatayı önlüyoruz.
  function yanlisYuzeySecildi(stream) {
    const track = stream.getVideoTracks()[0];
    const settings = track && track.getSettings && track.getSettings();
    const surface = settings && settings.displaySurface;
    return !!surface && surface !== "browser";
  }

  // getDisplayMedia'nın video()'su play() çözüldüğünde bazen HENÜZ
  // videoWidth/videoHeight=0 (ilk kare kararmamış) ya da bir önceki
  // sekmenin karesini taşıyor olabiliyor -- captureCardToFile bunun için
  // sabit bir 250ms bekleme ekliyordu (2026-08-03 notu, "akışın ilk
  // karesi bazen bir önceki sekmenin görüntüsünü taşıyor"), ama
  // recordToFile aynı riski taşıdığı hâlde HİÇ beklemiyordu -- crop
  // koordinatları (sx/sy/crop.w/crop.h) videoWidth henüz 0 iken
  // hesaplanınca crop.w/h de 0 çıkıyor, bu da bozuk/siyah bir video
  // indirmesine yol açıyordu (kullanıcı bildirimi, 2026-08-04: "video
  // kayıtta sorun var"). Boyut gerçekten hazır olana kadar bekleyip
  // ardından aynı 250ms'lik "önceki kare" payını her iki fonksiyonda da
  // ortaklaştırıyoruz.
  function videoHazirBekle(video) {
    return new Promise((resolve) => {
      function check() {
        if (video.videoWidth && video.videoHeight) resolve();
        else requestAnimationFrame(check);
      }
      check();
    }).then(() => new Promise((resolve) => setTimeout(resolve, 250)));
  }

  async function recordToFile() {
    if (!stageEl || recording) return;
    const frameEl = stageEl.querySelector(".share-stage__frame");
    recStatus(tt(UI.recPick), false);
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30, preferCurrentTab: true },
        preferCurrentTab: true,
        audio: false,
      });
    } catch (e) {
      recStatus(tt(UI.recFail), false);
      setTimeout(() => recStatus("", false), 4000);
      return;
    }
    if (yanlisYuzeySecildi(stream)) {
      stream.getTracks().forEach((t) => t.stop());
      recStatus(tt(UI.recFail), false);
      setTimeout(() => recStatus("", false), 4000);
      return;
    }
    recording = true;
    stageEl.classList.add("is-recording");
    recStatus(tt(UI.recWait), true);

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // bkz. videoHazirBekle -- crop hesabı videoWidth henüz 0 iken ya da
    // önceki sekmenin karesiyle yapılırsa bozuk bir video iner.
    await videoHazirBekle(video);

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = kareMod ? 1080 : 1920;
    const ctx = canvas.getContext("2d");

    // Yakalanan görüntü sekmenin görünen alanı; CSS pikselinden yakalama
    // pikseline ölçek buradan çıkıyor. Kullanıcı "bu sekme" yerine bütün
    // ekranı seçerse bu eşleme kayar -- düğmenin yanındaki metin bu yüzden
    // açıkça "Bu sekme"yi söylüyor.
    const sx = video.videoWidth / window.innerWidth;
    const sy = video.videoHeight / window.innerHeight;
    const r = frameEl.getBoundingClientRect();
    const crop = {
      x: Math.round(r.left * sx), y: Math.round(r.top * sy),
      w: Math.round(r.width * sx), h: Math.round(r.height * sy),
    };

    let drawing = true;
    (function drawLoop() {
      if (!drawing) return;
      ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(drawLoop);
    })();

    const mime = pickMime();
    const chunks = [];
    const rec = new MediaRecorder(canvas.captureStream(30), mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      drawing = false;
      // Çekim bitti: sahne kendi döngüsüne dönsün ki kullanıcı bir sonraki
      // kayıt için aynı yerden devam edebilsin.
      takeMode = false;
      startTs = 0;
      const fadeEl = stageEl && stageEl.querySelector(".share-stage__fade");
      if (fadeEl) fadeEl.style.opacity = "0";
      stream.getTracks().forEach((t) => t.stop());
      const ext = (mime || "video/webm").indexOf("mp4") !== -1 ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: mime || "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "dost-" + scene.tpl + "-" + new Date().toISOString().slice(0, 10) + "." + ext;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      recording = false;
      stageEl && stageEl.classList.remove("is-recording");
      recStatus(tt(UI.recDone) + " · " + ext, false);
      setTimeout(() => recStatus("", false), 4000);
    };
    // Döngüyü kesip ÇEKİM kipine geç: video karartıdan açılıp baştan sona
    // kendi başına izlenebilen bir parça oluyor (bkz. takePlan).
    plan = takePlan(scene);
    // LEAD: sahne siyaha kapanıp yakalama akışının onu görmesi için beklenen
    // süre. REC_AT: kaydın bu payın neresinde başlayacağı -- videonun ilk
    // ~0,25 sn'si siyah olsun, sonra açılış başlasın.
    const LEAD = 550, REC_AT = 300;
    takeMode = true;
    takeStart = performance.now() + LEAD;
    setTimeout(() => {
      if (!recording) return;
      rec.start();
      recStatus(tt(UI.recBusy) + " · " + plan.total.toFixed(1) + "s", true);
      // Kapanış karartısı tamamlansın diye küçük bir pay.
      setTimeout(() => { if (rec.state !== "inactive") rec.stop(); },
        (LEAD - REC_AT) + plan.total * 1000 + 250);
    }, REC_AT);
  }
  let recording = false;

  // --- statik kart (PNG) indirme -----------------------------------------
  // Kullanıcı isteği (2026-08-02): video her paylaşım için gerekli değil --
  // WhatsApp durumu/Instagram gönderisi gibi yerlerde tek bir kare yeterli
  // ve daha hafif. Aynı getDisplayMedia+kırpma mekanizmasını (recordToFile
  // ile aynı) kullanıyoruz ki ekrandakiyle piksel piksel aynı çıksın --
  // SVG+metni yeniden canvas'a çizmek ayrı, hataya açık bir yol olurdu.
  // Tek fark: MediaRecorder yok, videodan TEK bir kare yakalanıp hemen
  // PNG olarak indiriliyor.
  async function captureCardToFile() {
    if (!stageEl || recording) return;
    const frameEl = stageEl.querySelector(".share-stage__frame");
    recStatus(tt(UI.recPick), false);
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5, preferCurrentTab: true },
        preferCurrentTab: true,
        audio: false,
      });
    } catch (e) {
      recStatus(tt(UI.recFail), false);
      setTimeout(() => recStatus("", false), 4000);
      return;
    }
    if (yanlisYuzeySecildi(stream)) {
      stream.getTracks().forEach((t) => t.stop());
      recStatus(tt(UI.recFail), false);
      setTimeout(() => recStatus("", false), 4000);
      return;
    }
    recording = true;
    stageEl.classList.add("is-recording");
    recStatus(tt(UI.recWait), true);

    // Kart, tıklandığı an döngünün neresinde olursa olsun HER ZAMAN tüm
    // cümleler açılmış hâlde inmeli (kullanıcı isteği, 2026-08-03) -- önceden
    // ekrandaki o anki (bazen yarı sönük) kareyi yakalıyordu. Satırları
    // zorla tam görünür kılıp `cardCapturing` ile frame()'in bunun üstüne
    // yazmasını durduruyoruz; eski satır-içi stiller yakalama biter bitmez
    // (başarılı ya da başarısız her yoldan) geri yükleniyor.
    const lineEls = Array.from(frameEl.querySelectorAll(".share-line"));
    const ruleEl = frameEl.querySelector(".share-rule");
    const prevLineStyles = lineEls.map((n) => ({ opacity: n.style.opacity, transform: n.style.transform }));
    const prevRuleStyle = ruleEl ? { opacity: ruleEl.style.opacity, transform: ruleEl.style.transform } : null;
    cardCapturing = true;
    lineEls.forEach((n) => { n.style.opacity = "1"; n.style.transform = "translateY(0px)"; });
    if (ruleEl) { ruleEl.style.opacity = "0.55"; ruleEl.style.transform = "scaleX(1)"; }
    function restoreLines() {
      cardCapturing = false;
      lineEls.forEach((n, i) => { n.style.opacity = prevLineStyles[i].opacity; n.style.transform = prevLineStyles[i].transform; });
      if (ruleEl && prevRuleStyle) { ruleEl.style.opacity = prevRuleStyle.opacity; ruleEl.style.transform = prevRuleStyle.transform; }
    }

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // bkz. videoHazirBekle -- ayrıca yukarıdaki tam-görünür stil de bir
    // karenin boyanmasını bekliyor, bu bekleme onu da garantiliyor.
    await videoHazirBekle(video);

    const sx = video.videoWidth / window.innerWidth;
    const sy = video.videoHeight / window.innerHeight;
    const r = frameEl.getBoundingClientRect();
    const crop = {
      x: Math.round(r.left * sx), y: Math.round(r.top * sy),
      w: Math.round(r.width * sx), h: Math.round(r.height * sy),
    };

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = kareMod ? 1080 : 1920;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
    stream.getTracks().forEach((t) => t.stop());
    restoreLines();

    canvas.toBlob((blob) => {
      recording = false;
      stageEl && stageEl.classList.remove("is-recording");
      if (!blob) {
        recStatus(tt(UI.recFail), false);
        setTimeout(() => recStatus("", false), 4000);
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "dost-" + scene.tpl + "-" + new Date().toISOString().slice(0, 10) + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      recStatus(tt(UI.recDone) + " · png", false);
      setTimeout(() => recStatus("", false), 3000);
    }, "image/png");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
    ));
  }

  function openStage(s) {
    scene = s;
    scene._timing = computeTiming(s);
    tarihEkle(s);
    closeStage();
    stageEl = document.createElement("div");
    stageEl.className = "share-stage" + (acikMod ? " share-stage--acik" : "") + (kareMod ? " share-stage--kare" : "");
    stageEl.setAttribute("role", "dialog");
    stageEl.setAttribute("aria-modal", "true");
    stageEl.setAttribute("aria-label", tt(UI.title));
    stageEl.innerHTML = stageMarkup(s);
    document.body.appendChild(stageEl);
    document.body.classList.add("share-stage-open");
    cacheFrame = stageEl.querySelector(".share-stage__frame");
    cacheSvg = stageEl.querySelector(".share-stage__svg");
    cacheSpiral = cacheSvg.querySelector(".share-spiral");
    cacheHalo = cacheSvg.querySelector(".share-halo");
    cacheZatHalo = cacheSvg.querySelector(".share-zat-halo");
    cacheDots = cacheSvg.querySelectorAll(".share-dot");
    cacheLines = stageEl.querySelectorAll(".share-line");
    cacheRule = stageEl.querySelector(".share-rule");

    tilt = GU.createTilt ? GU.createTilt({ pitch: 0.20, spinRate: 0.000035 }) : null;
    if (tilt) tilt.set(1, true);
    startTs = 0;
    rafId = requestAnimationFrame(frame);

    if (s.tpl === "fusus" && s.helix && window.DostHelix) {
      const helixEl = stageEl.querySelector(".share-stage__helix");
      if (helixEl) {
        helixHandle = window.DostHelix.mount(helixEl, {
          id: "share-fusus",
          nodes: s.helix.nodes,
          turns: 2.4,
          closing: false,
          hRatio: 1.05,
          maxH: 620,
          numbered: false,
          labelMode: "sparse",
          initialFocus: s.helix.initialFocus,
          // Sahne yalnız dekoratif -- düğüme tıklamanın site sayfasındaki
          // gibi bir not paneli açmasını istemiyoruz (kayıt/kart yakalama
          // akışını bozmasın diye).
          onActivate: function () {},
        });
      }
    }

    const chrome = stageEl.querySelector(".share-stage__chrome");
    // Krom yalnızca ÇERÇEVENİN İÇİNE düştüğünde (telefon: çerçeve ekranı
    // dolduruyor) kendiliğinden soluyor -- orada ekran kaydı kullanılıyor ve
    // düğmelerin kayda girmemesi gerekiyor. Masaüstünde krom çerçevenin
    // dışında kalıyor, kayda zaten girmiyor; orada solmak sadece düğmeyi
    // bulunmaz kılıyordu (kullanıcı notu: "video indirme seçeneğini
    // göremedim"). O yüzden orada hep açık duruyor.
    const fr = stageEl.querySelector(".share-stage__frame").getBoundingClientRect();
    const cr = chrome.getBoundingClientRect();
    const kromCerceveninIcinde = cr.left < fr.right - 1 && cr.right > fr.left + 1;
    if (kromCerceveninIcinde) {
      const fade = () => chrome.classList.add("is-dim");
      chromeTimer = setTimeout(fade, 2600);
      stageEl.addEventListener("pointerdown", () => {
        chrome.classList.remove("is-dim");
        clearTimeout(chromeTimer);
        chromeTimer = setTimeout(fade, 2600);
      });
    }
    // role="dialog" bir yere odaklanmayı gerektirir -- kapat düğmesi hem en
    // güvenli hem de en beklenen ilk durak (klavye/ekran okuyucu kullanıcısı
    // için).
    const stageCloseBtn = stageEl.querySelector('[data-action="close"]');
    stageCloseBtn.addEventListener("click", closeStage);
    stageCloseBtn.focus();
    stageEl.querySelector('[data-action="guides"]').addEventListener("click", () => {
      const g = stageEl.querySelector(".share-stage__guides");
      g.hidden = !g.hidden;
    });
    const recBtn = stageEl.querySelector('[data-action="rec"]');
    if (recBtn) recBtn.addEventListener("click", recordToFile);
    const kartBtn = stageEl.querySelector('[data-action="kart"]');
    if (kartBtn) kartBtn.addEventListener("click", captureCardToFile);
    const recYokBtn = stageEl.querySelector('[data-action="recyok"]');
    if (recYokBtn) {
      recYokBtn.addEventListener("click", () => {
        const line = stageEl.querySelector(".share-stage__rec");
        line.hidden = false;
        line.textContent = tt(UI.recYok);
        stageEl.querySelector(".share-stage__chrome").classList.remove("is-dim");
        clearTimeout(chromeTimer);
      });
    }
  }

  function closeStage() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (chromeTimer) { clearTimeout(chromeTimer); chromeTimer = 0; }
    if (helixHandle) { helixHandle.destroy(); helixHandle = null; }
    if (stageEl) { stageEl.remove(); stageEl = null; }
    cacheFrame = cacheSvg = cacheSpiral = cacheHalo = cacheZatHalo = cacheDots = cacheLines = cacheRule = null;
    document.body.classList.remove("share-stage-open");
  }

  // --- QR kodu (dostarabi.com için önceden hesaplanmış, harici kütüphane yok) ---
  // Matris: version 2, ECC L, 25×25, encode("https://dostarabi.com")
  function qrSvg() {
    const M = ["1111111010011010101111111","1000001011101110101000001","1011101000111111101011101","1011101000100111001011101","1011101011110110001011101","1000001010010100001000001","1111111010101010101111111","0000000010111011000000000","1110011011100001111110011","0001100001100101101101011","0110101000010001000111101","0100110001000010011101000","1000101011011001101100001","0110010100001101111100011","1101011010001101111001101","0001100100011011011111000","1100111011100111111110010","0000000011100101100010001","1111111001110000101010001","1000001011100101100010010","1011101001011101111110001","1011101001101001010010110","1011101010001111100111011","1000001010011010110110000","1111111010000110111001001"];
    const cell = 4, dim = 25 * cell;
    let rects = "";
    M.forEach(function (row, y) {
      row.split("").forEach(function (b, x) {
        if (b === "1") rects += '<rect x="' + (x * cell) + '" y="' + (y * cell) + '" width="' + cell + '" height="' + cell + '"/>';
      });
    });
    return '<svg class="share-qr" viewBox="0 0 ' + dim + " " + dim + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="dostarabi.com"><rect width="' + dim + '" height="' + dim + '" fill="white"/><g fill="black">' + rects + "</g></svg>";
  }

  // --- favori ve geçmiş yardımcıları ---
  function favLoad() {
    try { return JSON.parse(localStorage.getItem(FAV_ANAHTAR) || "[]"); } catch (e) { return []; }
  }
  function favSave(list) { safeSet(FAV_ANAHTAR, JSON.stringify(list)); }
  function favAdd(scene) {
    const list = favLoad();
    // Aynı metni iki kez ekleme (ilk satır karşılaştırması).
    const key = scene.lines[0].text;
    if (list.some(function (s) { return s.lines[0].text === key; })) return;
    list.unshift(scene);
    if (list.length > MAX_FAV) list.length = MAX_FAV;
    favSave(list);
  }
  function favRemove(idx) {
    const list = favLoad();
    list.splice(idx, 1);
    favSave(list);
  }
  function tarihLoad() {
    try { return JSON.parse(localStorage.getItem(TARIH_ANAHTAR) || "[]"); } catch (e) { return []; }
  }
  function tarihEkle(scene) {
    const list = tarihLoad();
    const key = scene.lines[0].text;
    const i = list.findIndex(function (s) { return s.lines[0].text === key; });
    if (i !== -1) list.splice(i, 1);
    list.unshift(scene);
    if (list.length > MAX_TARIH) list.length = MAX_TARIH;
    safeSet(TARIH_ANAHTAR, JSON.stringify(list));
  }

  // --- panel -----------------------------------------------------------
  let panel = null, currentTpl = "soz", candidates = [];

  function candidateSnippet(s) {
    const first = s.lines[0].text;
    // "Hikâye"de artık soru başta (lines[0]); panelde soru→son cevap
    // cümlesi YAYINI gösteriyoruz ki tıklamadan önce nereye vardığı görülsün.
    const second = s.tpl === "hikaye" ? s.lines[s.lines.length - 1].text : (s.lines.length > 1 ? s.lines[1].text : "");
    const sep = s.tpl === "hikaye" ? "  →  " : "  ·  ";
    const full = second ? first + sep + second : first;
    return full.length > 100 ? full.slice(0, full.lastIndexOf(" ", 100)) + "…" : full;
  }

  function renderCandidateList() {
    if (!panel) return;
    const box = panel.querySelector(".share-panel__candidates");
    if (!box) return;
    if (!candidates.length) {
      box.innerHTML = '<p class="share-panel__cand-empty">' + escapeHtml(tt(UI.loading)) + "</p>";
      return;
    }
    box.innerHTML = candidates.map(function (s, i) {
      return (
        '<div class="share-panel__cand">' +
        '<span class="share-panel__cand-text">' + escapeHtml(candidateSnippet(s)) + "</span>" +
        '<div class="share-panel__cand-btns">' +
        '<button type="button" class="share-panel__cand-fav" data-action="fav-add" data-ci="' + i + '" title="' + escapeHtml(tt(UI.favAdd)) + '">' + escapeHtml(tt(UI.favAdd)) + "</button>" +
        '<button type="button" class="share-panel__go share-panel__cand-open" data-action="open-cand" data-ci="' + i + '">' + escapeHtml(tt(UI.openThis)) + "</button>" +
        "</div>" +
        "</div>"
      );
    }).join("");
    box.querySelectorAll("[data-action='fav-add']").forEach(function (b) {
      b.addEventListener("click", function () {
        const i = parseInt(b.dataset.ci);
        if (candidates[i]) { favAdd(candidates[i]); renderSavedLists(); }
      });
    });
    box.querySelectorAll("[data-action='open-cand']").forEach(function (b) {
      b.addEventListener("click", function () {
        const i = parseInt(b.dataset.ci);
        if (candidates[i]) openStage(candidates[i]);
      });
    });
  }

  function renderSavedLists() {
    if (!panel) return;
    // Favoriler
    const favBox = panel.querySelector(".share-panel__favlist");
    if (favBox) {
      const list = favLoad();
      if (!list.length) {
        favBox.innerHTML = '<p class="share-panel__cand-empty">' + escapeHtml(tt(UI.favEmpty)) + "</p>";
      } else {
        favBox.innerHTML = list.map(function (s, i) {
          return (
            '<div class="share-panel__cand">' +
            '<span class="share-panel__cand-text">' + escapeHtml(candidateSnippet(s)) + "</span>" +
            '<div class="share-panel__cand-btns">' +
            '<button type="button" class="share-panel__cand-fav" data-action="fav-rm" data-fi="' + i + '" title="' + escapeHtml(tt(UI.favRemove)) + '">' + escapeHtml(tt(UI.favRemove)) + "</button>" +
            '<button type="button" class="share-panel__go share-panel__cand-open" data-action="open-fav" data-fi="' + i + '">' + escapeHtml(tt(UI.openThis)) + "</button>" +
            "</div>" +
            "</div>"
          );
        }).join("");
        favBox.querySelectorAll("[data-action='fav-rm']").forEach(function (b) {
          b.addEventListener("click", function () {
            favRemove(parseInt(b.dataset.fi));
            renderSavedLists();
          });
        });
        favBox.querySelectorAll("[data-action='open-fav']").forEach(function (b) {
          b.addEventListener("click", function () {
            const s = favLoad()[parseInt(b.dataset.fi)];
            if (s) openStage(s);
          });
        });
      }
    }
    // Tarih
    const histBox = panel.querySelector(".share-panel__histlist");
    if (histBox) {
      const list = tarihLoad();
      if (!list.length) {
        histBox.innerHTML = "";
      } else {
        histBox.innerHTML = list.map(function (s, i) {
          return (
            '<div class="share-panel__cand">' +
            '<span class="share-panel__cand-text">' + escapeHtml(candidateSnippet(s)) + "</span>" +
            '<button type="button" class="share-panel__go share-panel__cand-open" data-action="open-hist" data-hi="' + i + '">' + escapeHtml(tt(UI.openThis)) + "</button>" +
            "</div>"
          );
        }).join("");
        histBox.querySelectorAll("[data-action='open-hist']").forEach(function (b) {
          b.addEventListener("click", function () {
            const s = tarihLoad()[parseInt(b.dataset.hi)];
            if (s) openStage(s);
          });
        });
      }
    }
  }

  // Panel açılışında, dil/şablon/filtre değişiminde her seferinde çağrılır --
  // önceki çağrının 3 aday üretme isteği henüz bitmeden yenisi başlarsa
  // (hızlı tıklama, ya da ilk açılışta veri hâlâ çekiliyorken şablon
  // değişimi), eski isteğin sonucu YANLIŞ şablonun/dilin altına sızabiliyordu
  // -- her çağrıya bir sıra numarası veriyoruz, yalnız hâlâ EN SON çağrı
  // olan sonucu uyguluyoruz.
  let refreshSeq = 0;
  function refresh() {
    candidates = [];
    renderCandidateList();
    const seq = ++refreshSeq;
    const N = 3;
    const tasks = [];
    for (let i = 0; i < N; i++) tasks.push(buildScene(currentTpl).catch(function () { return null; }));
    Promise.all(tasks).then(function (results) {
      if (!panel || seq !== refreshSeq) return;
      candidates = results.filter(Boolean);
      if (!candidates.length) {
        const box = panel.querySelector(".share-panel__candidates");
        if (box) box.innerHTML = '<p class="share-panel__cand-empty">' + escapeHtml(tt(UI.none)) + "</p>";
        return;
      }
      renderCandidateList();
    });
  }

  function buildPanel() {
    panel = document.createElement("div");
    panel.className = "share-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", tt(UI.title));

    const chips = Object.keys(UI.tpl).map(function (k) {
      return '<button type="button" class="share-panel__chip' + (k === currentTpl ? " is-on" : "") +
        '" data-tpl="' + k + '" aria-pressed="' + (k === currentTpl) + '">' + escapeHtml(tt(UI.tpl[k])) + "</button>";
    }).join("");

    const dilChips = DIL_LANGS.map(function (l) {
      return '<button type="button" class="share-panel__chip share-panel__chip--sm' +
        (l === shareLangId ? " is-on" : "") + '" data-dil="' + l + '" aria-pressed="' + (l === shareLangId) + '">' +
        escapeHtml(DIL_ETIKET[l] || l.toUpperCase()) + "</button>";
    }).join("");

    const ikinciDilChips = DIL_LANGS.map(function (l) {
      return '<button type="button" class="share-panel__chip share-panel__chip--sm' +
        (l === ikinciDilId ? " is-on" : "") + '" data-ikincidil="' + l + '" aria-pressed="' + (l === ikinciDilId) + '">' +
        escapeHtml(DIL_ETIKET[l] || l.toUpperCase()) + "</button>";
    }).join("");

    const zeminChips = ZEMIN.map(function (z) {
      return '<button type="button" class="share-panel__chip share-panel__chip--sm' +
        (z.id === zeminId ? " is-on" : "") + '" data-zemin="' + z.id + '" aria-pressed="' + (z.id === zeminId) + '">' +
        escapeHtml(tt(z.ad)) + "</button>";
    }).join("");

    // Filtre satırı yalnız Fütûhât kısmındayken gösterilir.
    const cilt = currentCilt(), kisimId = currentPartId();
    let kaynak_chips = "";
    if (cilt && kisimId) {
      const opts = [
        { id: "all",         label: tt(UI.filterAll) },
        { id: "cilt:" + cilt, label: tt(UI.filterCilt) },
        { id: "kisim:" + kisimId, label: tt(UI.filterKisim) },
      ];
      kaynak_chips = opts.map(function (o) {
        return '<button type="button" class="share-panel__chip share-panel__chip--sm' +
          (o.id === kaynakId ? " is-on" : "") + '" data-kaynak="' + o.id + '" aria-pressed="' + (o.id === kaynakId) + '">' +
          escapeHtml(o.label) + "</button>";
      }).join("");
    }

    const favs = favLoad();
    const tarih = tarihLoad();

    panel.innerHTML =
      '<div class="share-panel__head">' + escapeHtml(tt(UI.title)) +
      '<button type="button" data-action="quit" aria-label="' + escapeHtml(tt(UI.close)) + '">✕</button></div>' +
      '<p class="share-panel__hint">' + escapeHtml(tt(UI.hint)) + "</p>" +
      // Şablon seçici
      '<div class="share-panel__chips">' + chips + "</div>" +
      // Dil seçici
      '<p class="share-panel__label">' + escapeHtml(tt(UI.dil)) + "</p>" +
      '<div class="share-panel__chips share-panel__chips--zemin">' + dilChips + "</div>" +
      // Zemin seçici
      '<p class="share-panel__label">' + escapeHtml(tt(UI.zemin)) + "</p>" +
      '<div class="share-panel__chips share-panel__chips--zemin">' + zeminChips + "</div>" +
      // Açık zemin
      '<label class="share-panel__switch">' +
      '<input type="checkbox" data-action="isik"' + (acikMod ? " checked" : "") + ">" +
      "<span>" + escapeHtml(tt(UI.isik)) + "</span></label>" +
      // Kare format
      '<label class="share-panel__switch">' +
      '<input type="checkbox" data-action="kare"' + (kareMod ? " checked" : "") + ">" +
      "<span>" + escapeHtml(tt(UI.kare)) + "</span></label>" +
      // İki dilli kart (kullanıcı önerisi, 2026-08-03)
      '<label class="share-panel__switch">' +
      '<input type="checkbox" data-action="ikidilli"' + (ikiDilliMod ? " checked" : "") + ">" +
      "<span>" + escapeHtml(tt(UI.ikiDilli)) + "</span></label>" +
      (ikiDilliMod
        ? '<p class="share-panel__label">' + escapeHtml(tt(UI.ikinciDil)) + "</p>" +
          '<div class="share-panel__chips share-panel__chips--zemin">' + ikinciDilChips + "</div>"
        : "") +
      // Filtre (koşullu)
      (kaynak_chips
        ? '<p class="share-panel__label">' + escapeHtml(tt(UI.filter)) + "</p>" +
          '<div class="share-panel__chips share-panel__chips--zemin" id="share-kaynak-chips">' + kaynak_chips + "</div>"
        : "") +
      // "Karşılaştır" şablonu için özel seçici (kullanıcının kendi seçtiği
      // iki kavram, rastgele eşleştirmenin yanında/yerine).
      (currentTpl === "karsilastir"
        ? '<p class="share-panel__label">' + escapeHtml(tt(UI.karsilastirSol)) + '/' + escapeHtml(tt(UI.karsilastirSag)) + "</p>" +
          '<div class="share-panel__karsilastir" id="share-karsilastir-picker">' +
          '<select id="share-karsilastir-sol" aria-label="' + escapeHtml(tt(UI.karsilastirSol)) + '"></select>' +
          '<select id="share-karsilastir-sag" aria-label="' + escapeHtml(tt(UI.karsilastirSag)) + '"></select>' +
          '<button type="button" class="share-panel__go" data-action="karsilastir-ac">' + escapeHtml(tt(UI.karsilastirAc)) + "</button>" +
          "</div>"
        : "") +
      // Çoklu önizleme
      '<div class="share-panel__candidates"></div>' +
      // Başkasını getir
      '<div class="share-panel__actions">' +
      '<button type="button" data-action="shuffle">' + escapeHtml(tt(UI.shuffle)) + "</button>" +
      "</div>" +
      // Favoriler
      '<details class="share-panel__details"' + (favs.length ? " open" : "") + ">" +
      '<summary>' + escapeHtml(tt(UI.favList)) + (favs.length ? " (" + favs.length + ")" : "") + "</summary>" +
      '<div class="share-panel__favlist"></div>' +
      "</details>" +
      // Son kullanılanlar
      (tarih.length
        ? '<details class="share-panel__details"><summary>' + escapeHtml(tt(UI.histList)) + "</summary>" +
          '<div class="share-panel__histlist"></div></details>'
        : "");

    document.body.appendChild(panel);

    panel.querySelectorAll("[data-tpl]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.tpl === currentTpl) return;
        currentTpl = b.dataset.tpl;
        // "Karşılaştır" kendi seçici bloğunu gösterip candidates/shuffle
        // düzenini değiştiriyor -- panel gövdesi diğer şablonlardan farklı,
        // o yüzden dil değişimindeki gibi TAM YENİDEN kuruyoruz.
        const old = panel;
        buildPanel();
        if (old) old.remove();
      });
    });

    panel.querySelectorAll("[data-dil]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.dil === shareLangId) return;
        shareLangId = b.dataset.dil;
        safeSet(DIL_ANAHTAR, shareLangId);
        // İkinci dil birinciyle çakışırsa (kullanıcı ikinci dili birinci
        // yapmışsa) sessizce başka bir dile ötele -- iki dilli kart aynı
        // şeyi iki kez göstermesin diye.
        if (ikinciDilId === shareLangId) {
          ikinciDilId = DIL_LANGS.find((l) => l !== shareLangId) || ikinciDilId;
          safeSet(IKINCIDIL_ANAHTAR, ikinciDilId);
        }
        // Yalnız kartın içeriği değil, panelin kendi metni de seçilen dile geçsin.
        // buildPanel() modül düzeyindeki `panel` değişkenini YENİ bir düğümle
        // değiştiriyor; eskisini biz kaldırmazsak DOM'da iki panel üst üste kalırdı.
        const old = panel;
        buildPanel();
        if (old) old.remove();
      });
    });

    const ikidilliBox = panel.querySelector('[data-action="ikidilli"]');
    if (ikidilliBox) {
      ikidilliBox.addEventListener("change", function (e) {
        ikiDilliMod = e.target.checked;
        safeSet(IKIDILLI_ANAHTAR, ikiDilliMod ? "1" : "0");
        const old = panel;
        buildPanel();
        if (old) old.remove();
      });
    }

    panel.querySelectorAll("[data-ikincidil]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.ikincidil === ikinciDilId) return;
        ikinciDilId = b.dataset.ikincidil;
        safeSet(IKINCIDIL_ANAHTAR, ikinciDilId);
        panel.querySelectorAll("[data-ikincidil]").forEach(function (x) {
          x.classList.toggle("is-on", x === b);
          x.setAttribute("aria-pressed", String(x === b));
        });
        refresh();
      });
    });

    const karsilastirBox = panel.querySelector("#share-karsilastir-picker");
    if (karsilastirBox) {
      loadCompareData().then(function (d) {
        const solSel = karsilastirBox.querySelector("#share-karsilastir-sol");
        const sagSel = karsilastirBox.querySelector("#share-karsilastir-sag");
        if (!solSel || !sagSel) return;
        const optsHtml = d.list.map(function (item) {
          return '<option value="' + escapeHtml(item.key) + '">' + escapeHtml(tt(item.name)) + "</option>";
        }).join("");
        solSel.innerHTML = optsHtml;
        sagSel.innerHTML = optsHtml;
        if (d.list.length > 1) sagSel.selectedIndex = 1;
      }).catch(function () {});
      const acBtn = karsilastirBox.querySelector('[data-action="karsilastir-ac"]');
      if (acBtn) {
        acBtn.addEventListener("click", function () {
          const solSel = karsilastirBox.querySelector("#share-karsilastir-sol");
          const sagSel = karsilastirBox.querySelector("#share-karsilastir-sag");
          if (!solSel || !sagSel || !solSel.value || !sagSel.value) return;
          buildScene("karsilastir", { leftKey: solSel.value, rightKey: sagSel.value }).then(function (s) {
            if (s) openStage(s);
          }).catch(function () {});
        });
      }
    }

    panel.querySelectorAll("[data-zemin]").forEach(function (b) {
      b.addEventListener("click", function () {
        zeminId = b.dataset.zemin;
        safeSet(ZEMIN_ANAHTAR, zeminId);
        panel.querySelectorAll("[data-zemin]").forEach(function (x) {
          x.classList.toggle("is-on", x === b);
          x.setAttribute("aria-pressed", String(x === b));
        });
      });
    });

    const kaynakBox = panel.querySelector("#share-kaynak-chips");
    if (kaynakBox) {
      kaynakBox.querySelectorAll("[data-kaynak]").forEach(function (b) {
        b.addEventListener("click", function () {
          kaynakId = b.dataset.kaynak;
          safeSet(KAYNAK_ANAHTAR, kaynakId);
          kaynakBox.querySelectorAll("[data-kaynak]").forEach(function (x) {
            x.classList.toggle("is-on", x === b);
            x.setAttribute("aria-pressed", String(x === b));
          });
          refresh();
        });
      });
    }

    panel.querySelector('[data-action="isik"]').addEventListener("change", function (e) {
      acikMod = e.target.checked;
      safeSet(ISIK_ANAHTAR, acikMod ? "1" : "0");
      if (stageEl) stageEl.classList.toggle("share-stage--acik", acikMod);
    });

    panel.querySelector('[data-action="kare"]').addEventListener("change", function (e) {
      kareMod = e.target.checked;
      safeSet(KARE_ANAHTAR, kareMod ? "1" : "0");
      if (stageEl) stageEl.classList.toggle("share-stage--kare", kareMod);
    });

    panel.querySelector('[data-action="shuffle"]').addEventListener("click", refresh);
    const panelCloseBtn = panel.querySelector('[data-action="quit"]');
    panelCloseBtn.addEventListener("click", closePanel);
    // bkz. openStage'deki aynı not -- role="dialog" açıldığında odağı
    // içeri taşımak gerekir, en güvenli ilk durak kapat düğmesi.
    panelCloseBtn.focus();

    renderSavedLists();
    refresh();
  }

  function closePanel() {
    closeStage();
    if (panel) { panel.remove(); panel = null; }
  }

  function toggle() {
    if (panel) closePanel();
    else buildPanel();
  }

  window.__dostShare = { open: buildPanel, close: closePanel, toggle: toggle };

  // --- gizli kelime ----------------------------------------------------
  let buffer = "";
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (stageEl || panel)) {
      // Sahne panelin ÜSTÜNDE açılıyor (openStage panel'i kapatmıyor) --
      // Escape her zaman en üstteki katmanı kapatmalı: sahne açıksa önce o,
      // yoksa (yalnız ayar paneli açıksa) panel. Eskiden yalnız stageEl
      // kontrol ediliyordu, panel tek başına açıkken Escape hiçbir şey
      // yapmıyordu (bkz. teknik inceleme, bulgu #6).
      if (stageEl) closeStage(); else closePanel();
      return;
    }
    if (e.key.length !== 1) return;
    if (e.metaKey) return;
    // AltGr (Ctrl+Alt) Türkçe klavyede "@" üretiyor -- bkz. edit-mode.js.
    if ((e.ctrlKey || e.altKey) && !(e.ctrlKey && e.altKey)) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-CODE.length);
    if (buffer === CODE) { buffer = ""; toggle(); }
  });
})();
