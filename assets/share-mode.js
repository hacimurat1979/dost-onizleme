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

  function tt(d) { return d[shareLangId] || d.en || d.tr || ""; }
  function lang() { return shareLangId; }

  // --- veri ------------------------------------------------------------
  let indexData = null;
  const partCache = new Map();
  let sorularData = null;

  function loadIndex() {
    if (indexData) return Promise.resolve(indexData);
    return GU.fetchJson("data/ibn-arabi/futuhat-atlas-index.json").then((d) => (indexData = d));
  }
  function loadPart(id) {
    if (partCache.has(id)) return Promise.resolve(partCache.get(id));
    return GU.fetchJson("data/ibn-arabi/futuhat-parts/" + id + ".json").then((d) => {
      partCache.set(id, d);
      return d;
    });
  }
  function loadSorular() {
    if (sorularData) return Promise.resolve(sorularData);
    return GU.fetchJson("data/ibn-arabi/sorular.json").then((d) => (sorularData = d));
  }

  let sirlarData = null;
  function loadSirlar() {
    if (sirlarData) return Promise.resolve(sirlarData);
    return GU.fetchJson("data/ibn-arabi/sirlar.json").then((d) => (sirlarData = d));
  }

  let ontolojiData = null, esmaData = null, felsefiData = null, vahdetData = null;
  function loadOntoloji() {
    if (ontolojiData) return Promise.resolve(ontolojiData);
    return GU.fetchJson("data/ibn-arabi/ontology.json").then((d) => (ontolojiData = d));
  }
  function loadEsma() {
    if (esmaData) return Promise.resolve(esmaData);
    return GU.fetchJson("data/ibn-arabi/esma.json").then((d) => (esmaData = d));
  }
  function loadFelsefiTerimler() {
    if (felsefiData) return Promise.resolve(felsefiData);
    return GU.fetchJson("data/ibn-arabi/felsefi-terimler.json").then((d) => (felsefiData = d));
  }
  function loadVahdet() {
    if (vahdetData) return Promise.resolve(vahdetData);
    return GU.fetchJson("data/ibn-arabi/vahdet-elestiri.json")
      .then((d) => (vahdetData = d))
      .catch(() => (vahdetData = { maddeler: [] }));
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // Var olan bir metni, sahnenin taşıyabileceği uzunlukta kesip "…" ekler --
  // YENİ metin YAZMAZ (bkz. dosya başındaki KURAL), yalnız var olanı seçer.
  // Kelime sınırında keser ki bir kelime yarıda bölünmesin.
  function capText(raw, max) {
    raw = String(raw || "");
    max = max || 310;
    return raw.length > max ? raw.slice(0, raw.lastIndexOf(" ", max)) + "…" : raw;
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

  function pickPart(needPair) {
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
          if (!items.length) return step();
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

  function buildScene(tpl) {
    if (tpl === "soru") {
      return loadSorular().then((d) => {
        const cats = d.categories || [];
        const q = pick(pick(cats).questions);
        return {
          tpl: "soru",
          lines: [{ text: tt(q.question), kind: "soru" }],
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
          lines: [
            { text: tt(q.question), kind: "soru" },
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
        const raw = tt(entry.quote || {});
        if (!raw) return null;
        const text = raw.length > 310 ? raw.slice(0, raw.lastIndexOf(" ", 310)) + "…" : raw;
        return {
          tpl: "gunun",
          lines: [{ text: text, kind: "soz" }],
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
              { text: capText(tt(m.elestiri.ozet)), kind: "sol" },
              { text: capText(tt(m.dostunDedigi.ozet)), kind: "sag" },
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
                { text: tt(pr.left.label), kind: "sol" },
                { text: tt(pr.right.label), kind: "sag" },
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
            { text: tt(item.name), kind: "baslik" },
            { text: capText(tt(item.analogy)), kind: "soz" },
          ],
        };
      });
    }
    if (tpl === "ontoloji") {
      return loadOntoloji().then((d) => {
        const nodes = (d.nodes || []).filter((n) => n.insights && n.insights.length);
        if (!nodes.length) return null;
        const node = pick(nodes);
        const ins = pick(node.insights);
        const raw = ins && (typeof ins === "string" ? ins : tt(ins.text || {}));
        if (!raw || raw.length < 30) return null;
        const text = raw.length > 310 ? raw.slice(0, raw.lastIndexOf(" ", 310)) + "…" : raw;
        return {
          tpl: "ontoloji",
          lines: [
            { text: tt(node.name || {}), kind: "baslik" },
            { text: text, kind: "soz" },
          ],
        };
      });
    }
    if (tpl === "esma") {
      return loadEsma().then((d) => {
        const nodes = (d.nodes || []).filter((n) => n.insights && n.insights.length);
        if (!nodes.length) return null;
        const node = pick(nodes);
        const ins = pick(node.insights);
        const raw = ins && (typeof ins === "string" ? ins : tt(ins.text || {}));
        if (!raw || raw.length < 20) return null;
        const text = raw.length > 310 ? raw.slice(0, raw.lastIndexOf(" ", 310)) + "…" : raw;
        return {
          tpl: "esma",
          lines: [
            { text: tt(node.name || {}), kind: "baslik" },
            { text: text, kind: "soz" },
          ],
        };
      });
    }
    return pickPart(false).then((r) => {
      if (!r) return null;
      return {
        tpl: "soz",
        lines: [{ text: pick(r.items), kind: "soz" }],
      };
    });
  }

  // --- sahne çizimi ----------------------------------------------------
  let stageEl = null, rafId = 0, tilt = null, startTs = 0, chromeTimer = 0;
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
  };

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
  const READ_CAP = { hikaye: 28 };
  const TOTAL_CAP = { hikaye: 46 };
  function takePlan(s) {
    const fadeIn = 0.7, fadeOut = 1.2, lineIn = 1.15;
    const cues = [];
    let t = fadeIn + 0.2;
    s.lines.forEach(() => { cues.push(t); t += lineIn; });
    const ruleAt = s.tpl === "ikili" ? t : null;
    if (ruleAt != null) t += 0.9;
    const words = s.lines.reduce((n, l) => n + l.text.trim().split(/\s+/).filter(Boolean).length, 0);
    const read = Math.min(READ_CAP[s.tpl] || 11, Math.max(3.2, words / READ_WPS));
    return {
      fadeIn: fadeIn, fadeOut: fadeOut, lineIn: lineIn, cues: cues, ruleAt: ruleAt,
      // 8 sn'nin altı TikTok'ta göz kırpması gibi geçiyor, tavanın üstü
      // (şablona göre 22 ya da 40 sn) tek bir sahne için uzun.
      total: Math.min(TOTAL_CAP[s.tpl] || 22, Math.max(8, t + read + fadeOut)),
    };
  }

  let takeMode = false, takeStart = 0, plan = null;

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
    el.querySelectorAll(".share-line").forEach((node, i) => {
      const v = ease(clamp01((t - (plan.cues[i] != null ? plan.cues[i] : 0)) / plan.lineIn));
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
  function drawAmbient(g, w, h, ts) {
    const z = zemin();
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
    g.querySelector(".share-spiral").setAttribute("d", z.cizgisiz ? "" : d);
    const dots = g.querySelectorAll(".share-dot");
    dots.forEach((c, i) => {
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
      } else {
        c.style.fill = "";
      }
    });
    // Merkezdeki nefes alan halka: ontoloji/esmâ'daki Zât halosuyla aynı
    // 6 saniyelik ritim.
    const halo = g.querySelector(".share-halo");
    if (z.renk === "cift") halo.style.fill = renkGecis(RENK.celal, RENK.cemal, 0.5);
    else if (z.renk === "gecis") halo.style.fill = renkGecis(RENK.esikA, RENK.esikB, 0.5);
    else if (z.renk === "feyz") halo.style.fill = RENK.feyzA;
    else if (z.renk === "esma") halo.style.fill = RENK.esma[3]; // Kadîr -- merkezde
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
    const box = el.querySelector(".share-stage__frame");
    const svg = el.querySelector(".share-stage__svg");
    const w = box.clientWidth, h = box.clientHeight;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    if (tilt) tilt.step(ts, 16, true);
    drawAmbient(svg, w, h, ts);

    if (takeMode) { drawTake(el, ts); rafId = requestAnimationFrame(frame); return; }

    const cfg = TIMING[scene.tpl] || TIMING.soz;
    const t = ((ts - startTs) % cfg.loop) / cfg.loop;
    el.querySelectorAll(".share-line").forEach((node, i) => {
      const b = cfg.beats[i] || cfg.beats[cfg.beats.length - 1];
      const v = beat(t, b[0], b[1]);
      node.style.opacity = v.toFixed(3);
      node.style.transform = "translateY(" + ((1 - v) * 14).toFixed(1) + "px)";
    });
    const rule = el.querySelector(".share-rule");
    if (rule) {
      const v = beat(t, 0.30, 0.94);
      rule.style.opacity = (v * 0.55).toFixed(3);
      rule.style.transform = "scaleX(" + v.toFixed(3) + ")";
    }
    rafId = requestAnimationFrame(frame);
  }

  function stageMarkup(s) {
    const lines = s.lines.map((l) =>
      '<p class="share-line share-line--' + l.kind + '">' + escapeHtml(l.text) + "</p>"
    ).join(s.tpl === "ikili" ? '<span class="share-rule" aria-hidden="true"></span>' : "");
    return (
      '<div class="share-stage__frame share-stage__frame--' + s.tpl + '">' +
      '<svg class="share-stage__svg" aria-hidden="true">' +
      '<circle class="share-halo"></circle>' +
      '<path class="share-spiral" fill="none"></path>' +
      new Array(NODE_COUNT).fill('<circle class="share-dot"></circle>').join("") +
      "</svg>" +
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
    recording = true;
    stageEl.classList.add("is-recording");
    recStatus(tt(UI.recWait), true);

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();

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
    recording = true;
    stageEl.classList.add("is-recording");
    recStatus(tt(UI.recWait), true);

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // Akışın ilk karesi bazen bir önceki sekmenin görüntüsünü taşıyor --
    // küçük bir bekleme, yakalanan karenin gerçekten sahneye ait olmasını
    // garantiliyor (recordToFile'da bu sorun olmuyor çünkü orada zaten
    // saniyelerce çiziliyor).
    await new Promise((resolve) => setTimeout(resolve, 250));

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
    tarihEkle(s);
    closeStage();
    stageEl = document.createElement("div");
    stageEl.className = "share-stage" + (acikMod ? " share-stage--acik" : "") + (kareMod ? " share-stage--kare" : "");
    stageEl.innerHTML = stageMarkup(s);
    document.body.appendChild(stageEl);
    document.body.classList.add("share-stage-open");

    tilt = GU.createTilt ? GU.createTilt({ pitch: 0.20, spinRate: 0.000035 }) : null;
    if (tilt) tilt.set(1, true);
    startTs = 0;
    rafId = requestAnimationFrame(frame);

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
    stageEl.querySelector('[data-action="close"]').addEventListener("click", closeStage);
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
    if (stageEl) { stageEl.remove(); stageEl = null; }
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

  function refresh() {
    candidates = [];
    renderCandidateList();
    const N = 3;
    const tasks = [];
    for (let i = 0; i < N; i++) tasks.push(buildScene(currentTpl).catch(function () { return null; }));
    Promise.all(tasks).then(function (results) {
      if (!panel) return;
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

    const chips = Object.keys(UI.tpl).map(function (k) {
      return '<button type="button" class="share-panel__chip' + (k === currentTpl ? " is-on" : "") +
        '" data-tpl="' + k + '">' + escapeHtml(tt(UI.tpl[k])) + "</button>";
    }).join("");

    const dilChips = DIL_LANGS.map(function (l) {
      return '<button type="button" class="share-panel__chip share-panel__chip--sm' +
        (l === shareLangId ? " is-on" : "") + '" data-dil="' + l + '">' +
        escapeHtml(DIL_ETIKET[l] || l.toUpperCase()) + "</button>";
    }).join("");

    const zeminChips = ZEMIN.map(function (z) {
      return '<button type="button" class="share-panel__chip share-panel__chip--sm' +
        (z.id === zeminId ? " is-on" : "") + '" data-zemin="' + z.id + '">' +
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
          (o.id === kaynakId ? " is-on" : "") + '" data-kaynak="' + o.id + '">' +
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
      // Filtre (koşullu)
      (kaynak_chips
        ? '<p class="share-panel__label">' + escapeHtml(tt(UI.filter)) + "</p>" +
          '<div class="share-panel__chips share-panel__chips--zemin" id="share-kaynak-chips">' + kaynak_chips + "</div>"
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
        currentTpl = b.dataset.tpl;
        panel.querySelectorAll("[data-tpl]").forEach(function (x) { x.classList.toggle("is-on", x === b); });
        refresh();
      });
    });

    panel.querySelectorAll("[data-dil]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.dil === shareLangId) return;
        shareLangId = b.dataset.dil;
        safeSet(DIL_ANAHTAR, shareLangId);
        // Yalnız kartın içeriği değil, panelin kendi metni de seçilen dile geçsin.
        // buildPanel() modül düzeyindeki `panel` değişkenini YENİ bir düğümle
        // değiştiriyor; eskisini biz kaldırmazsak DOM'da iki panel üst üste kalırdı.
        const old = panel;
        buildPanel();
        if (old) old.remove();
      });
    });

    panel.querySelectorAll("[data-zemin]").forEach(function (b) {
      b.addEventListener("click", function () {
        zeminId = b.dataset.zemin;
        safeSet(ZEMIN_ANAHTAR, zeminId);
        panel.querySelectorAll("[data-zemin]").forEach(function (x) { x.classList.toggle("is-on", x === b); });
      });
    });

    const kaynakBox = panel.querySelector("#share-kaynak-chips");
    if (kaynakBox) {
      kaynakBox.querySelectorAll("[data-kaynak]").forEach(function (b) {
        b.addEventListener("click", function () {
          kaynakId = b.dataset.kaynak;
          safeSet(KAYNAK_ANAHTAR, kaynakId);
          kaynakBox.querySelectorAll("[data-kaynak]").forEach(function (x) { x.classList.toggle("is-on", x === b); });
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
    panel.querySelector('[data-action="quit"]').addEventListener("click", closePanel);

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
    if (e.key === "Escape" && stageEl) { closeStage(); return; }
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
