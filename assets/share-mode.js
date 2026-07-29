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
    tpl: {
      soz: { tr: "Bir Cümle", en: "One Sentence", pt: "Uma Frase" },
      ikili: { tr: "İki Kutu", en: "Two Boxes", pt: "Duas Caixas" },
      soru: { tr: "Bir Soru", en: "A Question", pt: "Uma Pergunta" },
    },
  };

  function tt(d) { return (window.DostI18n && window.DostI18n.pick3(d)) || d.tr; }
  function lang() { return (window.DostI18n && window.DostI18n.getLang()) || "tr"; }

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

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

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
    const L = lang();
    const visit = (blocks) => {
      (blocks || []).forEach((b) => {
        if (b.type !== "p" || !b.text) return;
        const html = b.text[L] || b.text.tr || "";
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

  function pickPart(needPair) {
    return loadIndex().then((idx) => {
      const all = idx.parts.filter((p) => p.status === "active");
      const cur = currentPartId();
      const order = cur ? [all.find((p) => p.id === cur)].filter(Boolean).concat(shuffled(all)) : shuffled(all);
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
          source: tt({ tr: "Sorular · dostarabi.com", en: "Questions · dostarabi.com", pt: "Perguntas · dostarabi.com" }),
        };
      });
    }
    if (tpl === "ikili") {
      return pickPart(true).then((r) => {
        if (!r) return null;
        const pr = pick(r.items);
        return {
          tpl: "ikili",
          lines: [
            { text: tt(pr.left.label), kind: "sol" },
            { text: tt(pr.right.label), kind: "sag" },
          ],
          source: partLabel(r.part) + " · dostarabi.com",
        };
      });
    }
    return pickPart(false).then((r) => {
      if (!r) return null;
      return {
        tpl: "soz",
        lines: [{ text: pick(r.items), kind: "soz" }],
        source: partLabel(r.part) + " · dostarabi.com",
      };
    });
  }

  // --- sahne çizimi ----------------------------------------------------
  let stageEl = null, rafId = 0, tilt = null, startTs = 0, chromeTimer = 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Şablon başına döngü uzunluğu (ms) ve metin vuruşları. Vuruşlar
  // [giriş, çıkış] biçiminde, döngü içindeki oranlar.
  const TIMING = {
    soz:   { loop: 9000,  beats: [[0.09, 0.94]], source: [0.55, 0.97] },
    ikili: { loop: 8500,  beats: [[0.09, 0.94], [0.22, 0.94]], source: [0.55, 0.97] },
    soru:  { loop: 8500,  beats: [[0.09, 0.94]], source: [0.52, 0.97] },
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
  function takePlan(s) {
    const fadeIn = 0.7, fadeOut = 1.2, lineIn = 1.15;
    const cues = [];
    let t = fadeIn + 0.2;
    s.lines.forEach(() => { cues.push(t); t += lineIn; });
    const ruleAt = s.tpl === "ikili" ? t : null;
    if (ruleAt != null) t += 0.9;
    const words = s.lines.reduce((n, l) => n + l.text.trim().split(/\s+/).filter(Boolean).length, 0);
    const read = Math.min(11, Math.max(3.2, words / READ_WPS));
    return {
      fadeIn: fadeIn, fadeOut: fadeOut, lineIn: lineIn, cues: cues, ruleAt: ruleAt,
      sourceAt: t + read * 0.3,
      // 8 sn'nin altı TikTok'ta göz kırpması gibi geçiyor, 22 sn'nin üstü
      // tek bir cümle için uzun.
      total: Math.min(22, Math.max(8, t + read + fadeOut)),
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
    const src = el.querySelector(".share-stage__source");
    if (src) src.style.opacity = ease(clamp01((t - plan.sourceAt) / 0.9)).toFixed(3);
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
  ];
  const ZEMIN_ANAHTAR = "dost-share-zemin";
  const ISIK_ANAHTAR = "dost-share-isik";
  let zeminId = safeGet(ZEMIN_ANAHTAR) || "sarmal";
  let acikMod = safeGet(ISIK_ANAHTAR) === "1";

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
    });
    // Merkezdeki nefes alan halka: ontoloji/esmâ'daki Zât halosuyla aynı
    // 6 saniyelik ritim.
    const halo = g.querySelector(".share-halo");
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
    const src = el.querySelector(".share-stage__source");
    if (src) src.style.opacity = beat(t, cfg.source[0], cfg.source[1]).toFixed(3);
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
      '<p class="share-stage__source">' + escapeHtml(s.source) + "</p>" +
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
        ? '<button type="button" data-action="rec">' + escapeHtml(tt(UI.rec)) + "</button>"
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
    canvas.height = 1920;
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

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
    ));
  }

  function openStage(s) {
    scene = s;
    closeStage();
    stageEl = document.createElement("div");
    stageEl.className = "share-stage" + (acikMod ? " share-stage--acik" : "");
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

  // --- panel -----------------------------------------------------------
  let panel = null, currentTpl = "soz", pending = null;

  function refresh() {
    const status = panel.querySelector(".share-panel__status");
    status.textContent = tt(UI.loading);
    panel.querySelector('[data-action="open"]').disabled = true;
    buildScene(currentTpl).then((s) => {
      if (!panel) return;
      pending = s;
      if (!s) { status.textContent = tt(UI.none); return; }
      status.textContent = s.lines.map((l) => l.text).join("  ·  ");
      panel.querySelector('[data-action="open"]').disabled = false;
    }).catch(() => {
      if (panel) panel.querySelector(".share-panel__status").textContent = tt(UI.none);
    });
  }

  function buildPanel() {
    panel = document.createElement("div");
    panel.className = "share-panel";
    const chips = Object.keys(UI.tpl).map((k) =>
      '<button type="button" class="share-panel__chip' + (k === currentTpl ? " is-on" : "") +
      '" data-tpl="' + k + '">' + escapeHtml(tt(UI.tpl[k])) + "</button>"
    ).join("");
    const zeminChips = ZEMIN.map((z) =>
      '<button type="button" class="share-panel__chip share-panel__chip--sm'
      + (z.id === zeminId ? " is-on" : "") + '" data-zemin="' + z.id + '">'
      + escapeHtml(tt(z.ad)) + "</button>"
    ).join("");
    panel.innerHTML =
      '<div class="share-panel__head">' + escapeHtml(tt(UI.title)) +
      '<button type="button" data-action="quit" aria-label="' + escapeHtml(tt(UI.close)) + '">✕</button></div>' +
      '<p class="share-panel__hint">' + escapeHtml(tt(UI.hint)) + "</p>" +
      '<div class="share-panel__chips">' + chips + "</div>" +
      '<p class="share-panel__label">' + escapeHtml(tt(UI.zemin)) + "</p>" +
      '<div class="share-panel__chips share-panel__chips--zemin">' + zeminChips + "</div>" +
      '<label class="share-panel__switch">'
      + '<input type="checkbox" data-action="isik"' + (acikMod ? " checked" : "") + ">"
      + "<span>" + escapeHtml(tt(UI.isik)) + "</span></label>" +
      '<p class="share-panel__status"></p>' +
      '<div class="share-panel__actions">' +
      '<button type="button" data-action="shuffle">' + escapeHtml(tt(UI.shuffle)) + "</button>" +
      '<button type="button" data-action="open" class="share-panel__go">' + escapeHtml(tt(UI.open)) + "</button>" +
      "</div>";
    document.body.appendChild(panel);
    panel.querySelectorAll("[data-tpl]").forEach((b) => {
      b.addEventListener("click", () => {
        currentTpl = b.dataset.tpl;
        panel.querySelectorAll("[data-tpl]").forEach((x) => x.classList.toggle("is-on", x === b));
        refresh();
      });
    });
    panel.querySelectorAll("[data-zemin]").forEach((b) => {
      b.addEventListener("click", () => {
        zeminId = b.dataset.zemin;
        safeSet(ZEMIN_ANAHTAR, zeminId);
        panel.querySelectorAll("[data-zemin]").forEach((x) => x.classList.toggle("is-on", x === b));
      });
    });
    panel.querySelector('[data-action="isik"]').addEventListener("change", (e) => {
      acikMod = e.target.checked;
      safeSet(ISIK_ANAHTAR, acikMod ? "1" : "0");
      // Sahne açıksa anında uygula; kapalıysa bir sonraki açılışta geçerli.
      if (stageEl) stageEl.classList.toggle("share-stage--acik", acikMod);
    });
    panel.querySelector('[data-action="shuffle"]').addEventListener("click", refresh);
    panel.querySelector('[data-action="open"]').addEventListener("click", () => {
      if (pending) openStage(pending);
    });
    panel.querySelector('[data-action="quit"]').addEventListener("click", closePanel);
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
