(function () {
  "use strict";

  const I18n = window.DostI18n;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const svg = d3.select("#graph");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");
  const breadcrumbEl = document.getElementById("detail-breadcrumb");

  // Her görünümün detay şablonu ".detail-eyebrow" + ".detail-title" ile
  // başlıyor; bunları scroll sırasında yazı boyutu kontrollerinin hemen
  // altında sabit kalan tek bir başlık bloğuna sarıyoruz.
  function updateTypoHeightVar() {
    const controls = document.getElementById("typography-controls");
    if (!controls || !controls.offsetHeight) return;
    document.documentElement.style.setProperty("--typo-controls-height", controls.offsetHeight + "px");
  }

  function wrapStickyHead() {
    const eyebrow = detailContent.firstElementChild;
    if (!eyebrow || !eyebrow.classList.contains("detail-eyebrow")) return;
    const title = eyebrow.nextElementSibling;
    if (!title || !title.classList.contains("detail-title")) return;
    const head = document.createElement("div");
    head.className = "detail-sticky-head";
    detailContent.insertBefore(head, eyebrow);
    head.appendChild(eyebrow);
    head.appendChild(title);
    updateTypoHeightVar();
  }
  new MutationObserver(wrapStickyHead).observe(detailContent, { childList: true });
  const tooltip = document.getElementById("ontology-tooltip");
  const wrapEl = document.getElementById("ontology-wrap");

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)

  // B1: "ne kadar eminiz" katmanı. Etiketler research/anlayis-evrimi/
  // CONFIDENCE_MAP.md'nin sözlüğünden (Yüksek/Orta/Hipotez/Gelecekte-
  // doğrulanmalı/...); ontology.json'daki her kenarın kendi `nature`/
  // `insights` metninde YAZILI temkin diline göre atandı, elle ayrı bir
  // değerlendirme değil.
  const CONFIDENCE_LABEL = {
    "Yüksek": { tr: "Yüksek", en: "High", pt: "Alta" },
    "Orta": { tr: "Orta", en: "Medium", pt: "Média" },
    "Düşük": { tr: "Düşük", en: "Low", pt: "Baixa" },
    "Hipotez": { tr: "Hipotez", en: "Hypothesis", pt: "Hipótese" },
    "Bilinmiyor": { tr: "Bilinmiyor", en: "Unknown", pt: "Desconhecida" },
    "Gelecekte-doğrulanmalı": { tr: "Gelecekte doğrulanmalı", en: "To be confirmed later", pt: "A confirmar mais tarde" },
  };
  function confSlug(c) {
    return c === "Orta" ? "orta"
      : c === "Düşük" ? "dusuk"
      : c === "Hipotez" ? "hipotez"
      : c === "Bilinmiyor" ? "bilinmiyor"
      : c === "Gelecekte-doğrulanmalı" ? "gelecek"
      : "yuksek";
  }
  function confidenceNoteHtml(c) {
    if (!c || c === "Yüksek") return "";
    const label = CONFIDENCE_LABEL[c] || { tr: c, en: c, pt: c };
    return `<p class="detail-confidence detail-confidence--${confSlug(c)}">${tt({
      tr: "Güvenimiz: ", en: "Our confidence: ", pt: "Nossa confiança: " })}<strong>${tt(label)}</strong> — ${tt({
      tr: "kenarın kendi metni bu okumayı henüz kesinleşmiş saymıyor.",
      en: "the edge's own text does not yet treat this reading as settled.",
      pt: "o próprio texto da aresta ainda não trata esta leitura como definitiva." })}</p>`;
  }

  // "Ne kadar eminiz?" düğmesi yalnız kenarları soluklaştırıp kesikli
  // yapıyordu -- ne olduğunu açıklayan bir not yoktu (kullanıcı notu,
  // 2026-08-01: "görünen ilişki çok net anlaşılmıyor"). Esmâ'nın "saydığımız
  // bağlar" düğmesinde denenmiş aynı geçici altyazı deseni (.graph-toast)
  // burada da kullanılıyor; sayı somut olduğu için "birkaç bağlantı" değil
  // gerçek adet gösteriliyor.
  let confidenceFeedbackEl = null, confidenceFeedbackTimer = null;
  function showConfidenceFeedback(on, dimmedCount, totalCount) {
    if (!ontologyWrap) return;
    if (!confidenceFeedbackEl) {
      confidenceFeedbackEl = document.createElement("p");
      confidenceFeedbackEl.className = "graph-toast";
      ontologyWrap.appendChild(confidenceFeedbackEl);
    }
    confidenceFeedbackEl.textContent = tt(on
      ? { tr: `${dimmedCount}/${totalCount} bağlantı soluklaştırıldı — yalnız "Yüksek" güvenli olanlar tam görünür kalıyor.`,
          en: `${dimmedCount}/${totalCount} links faded — only "High"-confidence ones stay fully visible.`,
          pt: `${dimmedCount}/${totalCount} vínculos esmaecidos — apenas os de confiança "Alta" permanecem totalmente visíveis.` }
      : { tr: "Bütün bağlantılar tekrar tam görünür.", en: "All links are fully visible again.", pt: "Todos os vínculos estão totalmente visíveis novamente." });
    confidenceFeedbackEl.classList.add("is-visible");
    if (confidenceFeedbackTimer) clearTimeout(confidenceFeedbackTimer);
    confidenceFeedbackTimer = setTimeout(() => { confidenceFeedbackEl.classList.remove("is-visible"); }, 4200);
  }

  // İki kavram/ilişkinin salt metinle anlatıldığında soyut kalan bağını
  // tek bakışta gösteren küçük SVG şemalar (bkz. CLAUDE.md ikinci ilke).
  const entityDiagramRenderers = {
    "twin-truth": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 320 180" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node--venn" cx="125" cy="88" r="68"/>
        <circle class="term-diagram-node--venn" cx="195" cy="88" r="68"/>
        <text class="term-diagram-label" x="68" y="42" text-anchor="middle">${tt(d.left)}</text>
        <text class="term-diagram-note" x="68" y="150" text-anchor="middle">${tt(d.leftNote)}</text>
        <text class="term-diagram-label" x="252" y="42" text-anchor="middle">${tt(d.right)}</text>
        <text class="term-diagram-note" x="252" y="150" text-anchor="middle">${tt(d.rightNote)}</text>
        <text class="term-diagram-label term-diagram-note--accent" x="160" y="93" text-anchor="middle">${tt(d.center)}</text>
      </svg>
    `,
    // Perde = ardışık iki yaratılışın birbirine benzemesi (416). Üç
    // neredeyse özdeş daire: aralarındaki fark o kadar küçük ki
    // yenilenmeyi göremiyoruz -- görmediğimiz şeyin adı perde.
    "veil-likeness": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 320 190" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node--venn" cx="92" cy="88" r="52"/>
        <circle class="term-diagram-node--venn" cx="160" cy="88" r="52"/>
        <circle class="term-diagram-node--venn" cx="228" cy="88" r="52"/>
        <text class="term-diagram-label" x="92" y="30" text-anchor="middle">${tt(d.first)}</text>
        <text class="term-diagram-label" x="160" y="30" text-anchor="middle">${tt(d.second)}</text>
        <text class="term-diagram-label" x="228" y="30" text-anchor="middle">${tt(d.third)}</text>
        <text class="term-diagram-label term-diagram-note--accent" x="160" y="93" text-anchor="middle">${tt(d.overlap)}</text>
        <text class="term-diagram-note" x="160" y="168" text-anchor="middle">${tt(d.foot)}</text>
      </svg>
    `,
    "seed-fork": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 260 240" role="img" aria-label="${tt(d.note)}">
        <line class="term-diagram-tether" x1="114" y1="167" x2="73" y2="197"/>
        <line class="term-diagram-arrow" x1="130" y1="135" x2="130" y2="97" marker-end="url(#odArrowEnd)"/>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="112" y1="63" x2="73" y2="37" marker-end="url(#odArrowEnd)"/>
        <line class="term-diagram-arrow term-diagram-arrow--dashed" x1="148" y1="63" x2="187" y2="37" marker-end="url(#odArrowEnd)"/>
        <circle class="term-diagram-node" cx="130" cy="155" r="20"/>
        <text class="term-diagram-label--small" x="130" y="192" text-anchor="middle">${tt(d.seed)}</text>
        <circle class="term-diagram-node--dashed" cx="55" cy="210" r="22"/>
        <text class="term-diagram-label--small" x="55" y="215" text-anchor="middle">${tt(d.root)}</text>
        <circle class="term-diagram-node" cx="130" cy="75" r="22"/>
        <text class="term-diagram-label--small" x="130" y="80" text-anchor="middle">${tt(d.branch)}</text>
        <circle class="term-diagram-node--accent" cx="55" cy="25" r="22"/>
        <text class="term-diagram-label--small" x="55" y="30" text-anchor="middle">${tt(d.leftLeaf)}</text>
        <circle class="term-diagram-node--faint" cx="205" cy="25" r="22"/>
        <text class="term-diagram-label--small" x="205" y="30" text-anchor="middle">${tt(d.rightLeaf)}</text>
      </svg>
    `,
    // Nokta ve çevre. Cilt XIII'te (372. Bölüm) okuduğumuz cümlenin şekli:
    // "Hak kulunun kalbinde kendisine nazar eder ve dairenin NOKTASI
    // olduğunu görür... insan-ı kâmil dairenin ÇEVRESİ olduğunu görür."
    // Yarıçaplar bilerek eşit uzunlukta: çevrenin her yeri merkeze aynı
    // uzaklıkta, yani hiçbir nokta O'na daha yakın değil.
    "point-circle": (d) => {
      const cx = 150, cy = 96, R = 78;
      const spokes = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        return `<line class="term-diagram-tether" x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * R).toFixed(1)}" y2="${(cy + Math.sin(a) * R).toFixed(1)}"/>`;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 300 226" role="img" aria-label="${tt(d.note)}">
        ${spokes}
        <circle class="term-diagram-node--venn" cx="${cx}" cy="${cy}" r="${R}"/>
        <circle class="term-diagram-node--accent" cx="${cx}" cy="${cy}" r="13"/>
        <text class="term-diagram-label--small" x="${cx}" y="${cy + 4}" text-anchor="middle">${tt(d.center)}</text>
        <text class="term-diagram-label" x="${cx}" y="200" text-anchor="middle">${tt(d.rim)}</text>
        <text class="term-diagram-note" x="${cx}" y="220" text-anchor="middle">${tt(d.equidistant)}</text>
      </svg>
    `;
    },
    "cascade-seas": (d) => {
      const xs = [45, 145, 245, 345];
      const classes = ["term-diagram-node--accent", "term-diagram-node", "term-diagram-node", "term-diagram-node--faint"];
      const circles = d.stops.map((s, i) => `
        <circle class="${classes[i]}" cx="${xs[i]}" cy="55" r="26"/>
        <text class="term-diagram-label--small" x="${xs[i]}" y="60" text-anchor="middle">${tt(s)}</text>
      `).join("");
      const arrows = [0, 1, 2].map((i) => `
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="${xs[i] + 26}" y1="55" x2="${xs[i + 1] - 26}" y2="55" marker-end="url(#odArrowEnd)"/>
      `).join("");
      return `
        <svg class="term-diagram__svg" viewBox="0 0 390 110" role="img" aria-label="${tt(d.note)}">
          ${arrows}
          ${circles}
        </svg>
      `;
    },
  };

  const ODD_DIAGRAM_DEFS = `
    <svg width="0" height="0" style="position:absolute">
      <defs>
        <marker id="odArrowEnd" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" class="term-diagram-arrowhead"/>
        </marker>
      </defs>
    </svg>
  `;

  function entityDiagramHtml(obj) {
    const renderer = obj.diagram && entityDiagramRenderers[obj.diagram.type];
    if (!renderer) return "";
    return `<div class="term-diagram-row"><div class="term-diagram-card">
      ${ODD_DIAGRAM_DEFS}
      <div class="term-diagram-svg-wrap" data-entity-diagram="1" role="button" tabindex="0"
           aria-label="${tt({ tr: "Büyüt", en: "Enlarge", pt: "Ampliar" })}">${renderer(obj.diagram)}</div>
      <p class="term-diagram-caption">${tt(obj.diagram.note)}</p>
    </div></div>`;
  }

  // terimler.js'nin aynı adı taşıyan çizimleri (groupDiagramHtml) tıklayınca
  // büyüyor (DostLightbox); bu görünümdeki karşılığı (ör. perde düğümünün
  // "veil-likeness" şeması) aynı .term-diagram-card görselini paylaşıyor ama
  // hiçbir yerde büyütme bağlanmamıştı -- düğme görünüyor, tutmuyordu
  // (kullanıcı bildirimi, 2026-08-04). showNodeDetail/showEdgeDetail
  // innerHTML'i yazdıktan hemen sonra çağrılmalı.
  function wireEntityDiagram(obj) {
    if (!obj.diagram || !window.DostLightbox) return;
    const renderer = entityDiagramRenderers[obj.diagram.type];
    if (!renderer) return;
    const wrap = detailContent.querySelector('[data-entity-diagram="1"]');
    if (!wrap) return;
    const open = () => {
      window.dostTrack && window.dostTrack("sema_acildi", { type: obj.diagram.type });
      window.DostLightbox.open({
        closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
        svgHtml: ODD_DIAGRAM_DEFS + renderer(obj.diagram),
        caption: tt(obj.diagram.note),
      });
    };
    wrap.addEventListener("click", open);
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  }

  function sirlarGestureDiagramHtml() {
    return `<div class="term-diagram-row"><div class="term-diagram-card">
      ${ODD_DIAGRAM_DEFS}
      <svg class="term-diagram__svg" viewBox="0 0 300 150" role="img" aria-label="${tt({ tr: "İşaret eder, açıklamaz", en: "Points, but does not explain", pt: "Aponta, mas não explica" })}">
        <circle class="term-diagram-node--sm" cx="34" cy="75" r="7"/>
        <line class="term-diagram-arrow term-diagram-arrow--dashed" x1="48" y1="75" x2="196" y2="75" marker-end="url(#odArrowEnd)"/>
        <line class="term-diagram-mirror" x1="208" y1="35" x2="208" y2="115"/>
        <circle class="term-diagram-node--barrier" cx="256" cy="75" r="38"/>
        <text class="term-diagram-label" x="256" y="80" text-anchor="middle">?</text>
        <text class="term-diagram-note" x="120" y="100" text-anchor="middle">${tt({ tr: "işaret", en: "gesture", pt: "gesto" })}</text>
        <text class="term-diagram-note term-diagram-note--accent" x="256" y="132" text-anchor="middle">${tt({ tr: "açıklanmaz", en: "not explained", pt: "não explicado" })}</text>
      </svg>
      <p class="term-diagram-caption">${tt({
        tr: "İbn Arabî sırrın yönünü gösterir, ama eşikte durur - içeriğini açıklamaz.",
        en: "Ibn Arabi points toward the secret, but stops at the threshold - he does not disclose its content.",
        pt: "Ibn Arabi aponta a direção do segredo, mas para no limiar - não revela seu conteúdo.",
      })}</p>
    </div></div>`;
  }

  I18n.applyStatic();
  I18n.renderLangSwitcher(document.getElementById("lang-switch"), () => {
    render();
    if (currentMainView === "esma") window.__esmaApp && window.__esmaApp.onLangChange();
    else if (currentMainView === "hal") window.__halApp && window.__halApp.onLangChange();
    else if (currentMainView === "terimler") window.__terimlerApp && window.__terimlerApp.onLangChange();
    else if (currentMainView === "cizimler") window.__cizimlerApp && window.__cizimlerApp.onLangChange();
    else if (currentMainView === "sirlar") window.__sirlarGraphApp && window.__sirlarGraphApp.onLangChange();
    else if (currentMainView === "sorular") window.__sorularApp && window.__sorularApp.onLangChange();
    else if (currentMainView === "aciksorular") window.__acikSorularApp && window.__acikSorularApp.onLangChange();
    else if (currentMainView === "bilmiyoruz") window.__bilmiyoruzApp && window.__bilmiyoruzApp.onLangChange();
    else if (currentMainView === "elestiriArkeolojisi") window.__elestiriArkeolojisiApp && window.__elestiriArkeolojisiApp.onLangChange();
    else if (currentMainView === "hocalar") window.__hocalarApp && window.__hocalarApp.onLangChange();
    else if (currentMainView === "eserAgi") window.__eserAgiApp && window.__eserAgiApp.onLangChange();
    else if (currentMainView === "seyahatAtlasi") window.__seyahatAtlasiApp && window.__seyahatAtlasiApp.onLangChange();
    else if (currentMainView === "kuranDokusu") window.__kuranDokusuApp && window.__kuranDokusuApp.onLangChange();
    else if (currentMainView === "menziller") window.__menzillerApp && window.__menzillerApp.onLangChange();
    else if (currentMainView === "tasiyicilar") window.__tasiyicilarApp && window.__tasiyicilarApp.onLangChange();
    else if (currentMainView === "futuhat") window.__futuhatApp && window.__futuhatApp.onLangChange();
    else if (currentMainView === "fusus") window.__fususApp && window.__fususApp.onLangChange();
    else if (currentMainView === "miskat") window.__miskatApp && window.__miskatApp.onLangChange();
    else if (currentMainView === "hakkinda") {
      window.__siirlerApp && window.__siirlerApp.onLangChange();
      window.__vahdetApp && window.__vahdetApp.onLangChange();
      window.__okumaYollariApp && window.__okumaYollariApp.onLangChange();
    }
    else if (currentMainView === "kavram") window.__kavramApp && window.__kavramApp.onLangChange();
    else if (currentMainView === "ayethadis") window.__ayetHadisApp && window.__ayetHadisApp.onLangChange();
    // Ontoloji görünümündeki mobil alternatif liste (grafik ekrana sığmazsa).
    // Aynı sayfada yaşadığı için ontoloji dalı gibi else-if içine
    // sıkıştırılmıyor; render() zaten grafiği tazeliyor, mobil liste
    // kendi doldur()'ıyla tazelensin.
    window.__ontolojiMobilListeApp && window.__ontolojiMobilListeApp.onLangChange();
    updateHeaderHeightVar();
  });

  // Sabit (sticky) üst kısmın gerçek yüksekliğini ölçüp detail-panel'in
  // altında başlamasını sağlayan CSS değişkeni.
  function updateHeaderHeightVar() {
    const header = document.querySelector(".app-header");
    if (header) {
      document.documentElement.style.setProperty("--app-header-height", header.offsetHeight + "px");
    }
  }
  updateHeaderHeightVar();
  window.addEventListener("resize", updateHeaderHeightVar);
  window.addEventListener("resize", updateTypoHeightVar);

  detailClose.addEventListener("click", () => {
    detailPanel.hidden = true;
  });

  const detailPrint = document.getElementById("detail-print");
  if (detailPrint) {
    detailPrint.addEventListener("click", () => {
      detailContent.querySelectorAll("details:not([open])").forEach((d) => d.setAttribute("open", ""));
      window.print();
    });
  }

  // Yazdır düğmesinin yanına paylaş düğmesi (kullanıcı isteği, 2026-08-16):
  // futuhat.js'teki sharePart/showToast ile aynı desen. URL için location.href
  // yeterli -- updateHash() zaten her kavram açıldığında history.replaceState
  // ile pathname'i o kavrama göre güncelliyor (yukarıda, satır ~998).
  const detailShare = document.getElementById("detail-share");
  let detailShareToastEl = null, detailShareToastTimer = null;
  function showDetailShareToast(message) {
    if (!detailShareToastEl) {
      detailShareToastEl = document.createElement("div");
      detailShareToastEl.className = "futuhat-toast";
      detailShareToastEl.setAttribute("role", "status");
      detailShareToastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(detailShareToastEl);
    }
    detailShareToastEl.textContent = message;
    detailShareToastEl.classList.add("futuhat-toast--visible");
    if (detailShareToastTimer) clearTimeout(detailShareToastTimer);
    detailShareToastTimer = setTimeout(() => { detailShareToastEl.classList.remove("futuhat-toast--visible"); }, 2400);
  }
  if (detailShare) {
    detailShare.addEventListener("click", () => {
      const titleEl = detailContent.querySelector(".detail-title");
      const concept = titleEl ? titleEl.textContent.trim() : "";
      const title = I18n.pick3({ tr: "Dost Arabî", en: "Dost Arabi", pt: "Dost Arabi" }) + (concept ? " — " + concept : "");
      const url = location.href;
      if (navigator.share) {
        navigator.share({ title, url }).catch(() => {});
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => showDetailShareToast(
          I18n.pick3({ tr: "Bağlantı kopyalandı", en: "Link copied", pt: "Link copiado" })
        ));
      }
    });
  }

  // ESC ("bir adım geri") artık burada değil: ortak zincir graph-utils.js'te
  // (registerStepBack), açık panelin kapanması da onun genel son adımı.
  // Sırlar'ın tema odağını geri alan dal buradan KALDIRILDI ve kendi
  // dosyasına taşındı -- bir görünümün davranışı başka bir dosyada
  // yaşamamalı (bkz. ETKILESIM_DILI.md'nin son yasağı).

  // Lejant kutuları (Ontoloji/Esmâ/Hâller/Sırlar), özellikle dokunmatik/
  // tablet ekranlarda kısa viewport yüksekliğinde grafiğin üstüne düşüp
  // düğümleri kapatabiliyor -- varsayılan olarak kısık/dokunmatik
  // ekranlarda katlanmış başlasın, kullanıcı isterse açsın.
  // Etiket çakışması çözücüsü; ölçüm tabanlı, motor graph-utils.js'te.
  const deconflictLabels = window.DostGraphUtils.createLabelDeconflictor();
  window.DostGraphUtils.setupLegendToggles();
  window.DostGraphUtils.setupDetailPanelFocus();

  // Düzen: iniş yayı + çıkış yayı (kavs-i nüzûl / kavs-i urûc), merkezde kalp.
  //
  // Önceki düzen yukarıdan aşağıya düz bir merdivendi: Zât en üstte (y=0.09),
  // kalp en altta (y=0.90). 2026-07-25'te kullanıcının isteğiyle bu görünümü
  // Hâller Haritası'nda kullandığımız ölçütle -- "grafiğin ŞEKLİ ne iddia
  // ediyor ve verimiz bunu doğruluyor mu?" -- gözden geçirdik ve iki
  // uyuşmazlık bulduk:
  //
  //  1) Verinin kendisi bunun bir DAİRE olduğunu söylüyor: insan-i-kamil ->
  //     dhat kenarının notu "döngü buradan başladığı yere geri kapanır"
  //     diyor. Ama şekil bir sütundu; kapanış oku, dibe inen listenin en
  //     altından tepeye kadar geri uçmak zorundaydı. (Sitenin kurucu
  //     ilkesi de bu: "O'ndan geldik, O'na gidiyoruz" -- bkz. CLAUDE.md.)
  //  2) Daha ciddisi: kalp en ALTA, yani Zât'tan en UZAĞA çiziliyordu -- oysa
  //     kalp->dhat kenarının kendi notu "hiçbir aracıya ihtiyaç duymadan
  //     doğrudan Zât ile temas kurabilir... ağın en derin/en YAKIN noktası"
  //     diyor. Şekil, metnin tam tersini söylüyordu: derinliği uzaklık gibi
  //     gösteriyordu.
  //
  // Yeni düzen: Zât tepede; iniş yayı sağdan aşağı (Sıfat/Esmâ -> A'yân ->
  // Tecellî -> üç âlem), en yoğun nokta dipte; çıkış yayı soldan yukarı
  // (İnsan-ı Kâmil -> Zât). Kalp ise MERKEZDE: böylece Zât'a giden çizgisi
  // diyagramdaki en kısa çizgi, yani bir yarıçap oluyor. Bu bizim okumamız:
  // kalp merdivenin son basamağı değil, dairenin merkezi.
  const TARGET = {
    "dhat":          { x: 0.500, y: 0.160 },  // tepe (0°)
    "sifat-asma":    { x: 0.760, y: 0.289 },  // iniş yayı
    "ayan-sabite":   { x: 0.839, y: 0.551 },
    "tecelli":       { x: 0.740, y: 0.775 },
    "alem-ervah":    { x: 0.559, y: 0.875 },  // en yoğun bölge (dip)
    "alem-misal":    { x: 0.412, y: 0.868 },
    "alem-ecsam":    { x: 0.281, y: 0.796 },
    "insan-i-kamil": { x: 0.160, y: 0.520 },  // çıkış yayı
    "kalp":          { x: 0.500, y: 0.520 },  // MERKEZ
  };

  // /hakkinda'daki statik şemalar (şu an "Üç Sefer") de sitenin geri
  // kalanındaki çizimler gibi tıklanıp büyütülebilsin: aynı paylaşılan
  // lightbox, aynı ESC/odak-tuzağı davranışı.
  function wireHakkindaDiagrams() {
    if (!hakkindaWrap || !window.DostLightbox) return;
    hakkindaWrap.querySelectorAll(".hakkinda-diagram").forEach((svg) => {
      if (svg.dataset.wiredZoom) return;
      svg.dataset.wiredZoom = "1";
      svg.classList.add("hakkinda-diagram--zoomable");
      svg.setAttribute("tabindex", "0");
      svg.setAttribute("role", "button");
      const openIt = () => {
        const capEl = svg.parentElement && svg.parentElement.querySelector(".hakkinda-diagram__caption");
        const head = svg.closest(".hakkinda-content__section");
        window.DostLightbox.open({
          closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
          svgHtml: svg.outerHTML,
          name: head && head.querySelector("h3") ? head.querySelector("h3").textContent : "",
          caption: capEl ? capEl.textContent : "",
        });
      };
      svg.addEventListener("click", openIt);
      svg.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openIt(); }
      });
    });
  }

  // Sayfa başına dönme kısayolu (2026-08-06 kullanıcı bulgusu): /hakkinda
  // uzun bir sayfa, başa dönmek için çokça kaydırma gerekiyordu. Düğme
  // hakkindaWrap'ın İÇİNDE yaşıyor -- görünüm değişince section'ın kendi
  // `hidden`'ı düğmeyi de otomatik gizliyor, ayrı bir görünüm-kontrolüne
  // gerek yok.
  let hakkindaScrollTopWired = false;
  function wireHakkindaScrollTop() {
    const btn = document.getElementById("hakkinda-scroll-top");
    if (!btn || hakkindaScrollTopWired) return;
    hakkindaScrollTopWired = true;
    btn.hidden = false;
    const onScroll = () => {
      if (hakkindaWrap.hidden) return;
      btn.classList.toggle("is-visible", window.scrollY > 480);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
    onScroll();
  }

  function loadOntologyData() {
    if (window.DostViewStatus) window.DostViewStatus.showLoading("ontology-wrap");
    window.DostGraphUtils.fetchJson("data/ibn-arabi/ontology.json")
      .then((data) => {
        buildGraph(data);
        registerOntologyCrossLinks(data);
        parseHashAndGo();
        window.__dostAppReady = true;
        if (window.DostViewStatus) window.DostViewStatus.hide("ontology-wrap");
        // Doğuş (FAZ 1): yalnız gerçekten ana ekrandaysak — bir deep-link
        // başka görünüme ya da bir düğüme götürdüyse araya girmeyiz.
        // Karşılama ekranı hâlâ görünüyorsa onun sönüşünü bekler (welcome.js
        // sönüş başlarken "dost:welcome-left" yayar); daha önce görülmüşse
        // (aynı oturumda ikinci sayfa yüklemesi) kısa bir nefesle başlar.
        function maybeBirth() {
          if (!birthFn) return;
          if (currentMainView !== "ontology" || currentDetailNode || currentDetailEdge) { birthFn = null; return; }
          const f = birthFn;
          birthFn = null;
          f();
        }
        const welcomeEl = document.getElementById("welcome-screen");
        if (welcomeEl && !welcomeEl.hidden) {
          document.addEventListener("dost:welcome-left", maybeBirth, { once: true });
        } else {
          setTimeout(maybeBirth, 150);
        }
      })
      .catch((err) => {
        console.error("Ontoloji verisi yüklenemedi / Failed to load ontology data", err);
        if (window.DostViewStatus) window.DostViewStatus.showError("ontology-wrap", loadOntologyData);
      });
  }
  loadOntologyData();

  const deferFetch = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));

  // ÇAPRAZ-BAĞLANTI İNDEKSİ (2026-08-03). Buraya kadar esma.json (415KB),
  // hal.json (93KB) ve (terimler.js'te) felsefi-terimler.json (409KB)
  // AÇILIŞTA iniyordu -- yalnızca her kavramın ADINI ve KISA ÖZETİNİ almak
  // için. Yani 917KB indirip ~115KB'lık bir sözlük kuruyorduk, üstelik
  // sitenin HER sayfasında. Artık o sözlük derleme zamanında üretiliyor
  // (scripts/capraz-indeks-uret.py) ve tam dosyalar ancak o görünüm
  // gerçekten açıldığında geliyor.
  deferFetch(() => {
    window.DostGraphUtils.fetchJson("data/ibn-arabi/capraz-baglanti-indeksi.json")
      .then((data) => {
        (data.kayitlar || []).forEach((k) => {
          // Ontoloji kayıtları zaten ontology.json'dan kaydedildi; indeksten
          // tekrar kaydetmek zararsız ama gereksiz iş.
          if (k.view === "ontoloji") return;
          registerCrossLinkTerm(k.name, k.view, k.id, k.short);
        });
        notifyCrossLinkReady();
        render();
      })
      .catch((err) => console.error("Çapraz-bağlantı indeksi yüklenemedi / Failed to load cross-link index", err));
  });

  // Sırlar verisi (345KB) da açılışta iniyordu, oysa YALNIZ Sırlar görünümü
  // açıldığında gerekiyor (goToSirlar, showSirlarEntry, merkez paneli).
  // Artık talep üzerine; ortak fetchJson önbelleği sayesinde sirlar-graph.js
  // ile aynı indirmeyi paylaşıyor.
  let sirlarData = null;
  let sirlarPromise = null;
  function ensureSirlarData() {
    if (sirlarData) return Promise.resolve(sirlarData);
    if (sirlarPromise) return sirlarPromise;
    sirlarPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/sirlar.json")
      .then((data) => {
        sirlarData = data;
        render();
        return data;
      })
      .catch((err) => {
        sirlarPromise = null;
        console.error("Sırlar verisi yüklenemedi / Failed to load mysteries data", err);
        return null;
      });
    return sirlarPromise;
  }

  deferFetch(() => {
    window.DostGraphUtils.fetchJson("data/ibn-arabi/sozluk-ipuclari.json")
      .then((data) => {
        (data.terms || []).forEach((t) => registerGlossaryTerm(t.id, t.term, t.definition));
        render();
      })
      .catch((err) => console.error("Sözlük ipuçları yüklenemedi / Failed to load glossary hints", err));
  });

  let currentMainView = "ontology";
  const ontologyBtn = document.getElementById("ontology-btn");
  const esmaBtn = document.getElementById("esma-btn");
  const halBtn = document.getElementById("hal-btn");
  const terimlerBtn = document.getElementById("terimler-btn");
  const cizimlerBtn = document.getElementById("cizimler-btn");
  const sirlarBtn = document.getElementById("sirlar-btn");
  const sorularBtn = document.getElementById("sorular-btn");
  const acikSorularBtn = document.getElementById("acik-sorular-btn");
  const bilmiyoruzBtn = document.getElementById("bilmiyoruz-btn");
  const elestiriArkeolojisiBtn = document.getElementById("elestiri-arkeolojisi-btn");
  const hocalarBtn = document.getElementById("hocalar-btn");
  const eserAgiBtn = document.getElementById("eser-agi-btn");
  const seyahatAtlasiBtn = document.getElementById("seyahat-atlasi-btn");
  const kuranDokusuBtn = document.getElementById("kuran-dokusu-btn");
  const menzillerBtn = document.getElementById("menziller-btn");
  const tasiyicilarBtn = document.getElementById("tasiyicilar-btn");
  const futuhatBtn = document.getElementById("futuhat-btn");
  const fususBtn = document.getElementById("fusus-btn");
  const miskatBtn = document.getElementById("miskat-btn");
  const hakkindaBtn = document.getElementById("hakkinda-btn");
  const hakkindaSubSiirlerBtn = document.getElementById("hakkinda-sub-siirler-btn");
  const hakkindaSubVahdetBtn = document.getElementById("hakkinda-sub-vahdet-btn");
  const hakkindaSubOkumaYollariBtn = document.getElementById("hakkinda-sub-okuma-yollari-btn");
  const okumaYollariBtn = document.getElementById("okuma-yollari-btn");
  const kavramBtn = document.getElementById("kavram-btn");
  const ayethadisBtn = document.getElementById("ayethadis-btn");
  const sahnelerBtn = document.getElementById("sahneler-btn");
  const ontologyWrap = document.getElementById("ontology-wrap");
  const esmaWrap = document.getElementById("esma-wrap");
  const halWrap = document.getElementById("hal-wrap");
  const terimlerWrap = document.getElementById("terimler-wrap");
  const cizimlerWrap = document.getElementById("cizimler-wrap");
  const sirlarWrap = document.getElementById("sirlar-wrap");
  const sorularWrap = document.getElementById("sorular-wrap");
  const acikSorularWrap = document.getElementById("acik-sorular-wrap");
  const bilmiyoruzWrap = document.getElementById("bilmiyoruz-wrap");
  const elestiriArkeolojisiWrap = document.getElementById("elestiri-arkeolojisi-wrap");
  const hocalarWrap = document.getElementById("hocalar-wrap");
  const eserAgiWrap = document.getElementById("eser-agi-wrap");
  const seyahatAtlasiWrap = document.getElementById("seyahat-atlasi-wrap");
  const yolculukWrap = document.getElementById("yolculuk-wrap");
  const kuranDokusuWrap = document.getElementById("kuran-dokusu-wrap");
  const menzillerWrap = document.getElementById("menziller-wrap");
  const tasiyicilarWrap = document.getElementById("tasiyicilar-wrap");
  const futuhatWrap = document.getElementById("futuhat-wrap");
  const fususWrap = document.getElementById("fusus-wrap");
  const miskatWrap = document.getElementById("miskat-wrap");
  const hakkindaWrap = document.getElementById("hakkinda-wrap");
  const kavramWrap = document.getElementById("kavram-wrap");
  const ayethadisWrap = document.getElementById("ayethadis-wrap");
  const sahnelerWrap = document.getElementById("sahneler-wrap");

  // Görsel olarak aktif sekmeyi işaretlemek (.btn-ghost--active) ekran
  // okuyucuya hiçbir şey söylemiyordu -- dil seçicideki aria-pressed'in
  // aksine. aria-current="page", 9 sekmeden hangisinin şu an gösterildiğini
  // ekran okuyucuya da bildiriyor.
  function markActiveNavButton(btn, isActive) {
    if (!btn) return;
    btn.classList.toggle("btn-ghost--active", isActive);
    if (isActive) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  }

  // Yeni eklenen bölümlere (Kavramlar/Âyet-Hadis) nav'da küçük bir
  // rozet koyup, kullanıcı o bölümü bir kere ziyaret edince kaldırıyoruz
  // -- "kaldığın yer" özelliğindeki localStorage deseninin aynısı.
  //
  // 2026-08-05'te temizlendi: harita bir zamanlar on bir görünüm
  // taşıyordu (kuantum, elestiriArkeolojisi, hocalar, eserAgi,
  // seyahatAtlasi, kuranDokusu, futuhatMimarisi de dahil) -- yani
  // drawer'daki 22 girdinin YARISI "yeni" rozeti taşıyordu, ki bu
  // ayırt ediciliği sıfırlıyordu (11/22'nin hepsi "yeni" olamaz).
  // Nav konsolidasyonu (Fütûhât/Hayat/Bilinmeyenler akraba-sekmeleri)
  // o yedisini zaten gruplarken rozetsiz bıraktı; kuantum ayrıca
  // gerçekten eski bir dalgaydı (Dalga 2, D3) ve rozeti bilerek
  // kaldırıldı. Harita şimdi yalnız gerçekten güncel iki girdiyi
  // (Dalga 3'ün kendi dalgası: Kavramlar/D9, Âyet-Hadis) izliyor.
  const NAV_YENI_KEY = "dost-nav-yeni-gorulmus";
  function markNavYeniSeen(view) {
    const btn = { kavram: kavramBtn, ayethadis: ayethadisBtn, miskat: miskatBtn }[view];
    if (!btn || !btn.classList.contains("btn-ghost--yeni")) return;
    btn.classList.remove("btn-ghost--yeni");
    try {
      const seen = JSON.parse(localStorage.getItem(NAV_YENI_KEY) || "[]");
      if (!seen.includes(view)) {
        seen.push(view);
        localStorage.setItem(NAV_YENI_KEY, JSON.stringify(seen));
      }
    } catch (e) { /* localStorage kapalıysa sessizce geç */ }
  }
  try {
    const seenAtLoad = JSON.parse(localStorage.getItem(NAV_YENI_KEY) || "[]");
    seenAtLoad.forEach((v) => {
      const btn = { kavram: kavramBtn, ayethadis: ayethadisBtn, miskat: miskatBtn }[v];
      if (btn) btn.classList.remove("btn-ghost--yeni");
    });
  } catch (e) { /* yoksay */ }

  function setMainView(view) {
    if (currentMainView === view) return;
    if (view === "kavram" || view === "ayethadis" || view === "miskat") markNavYeniSeen(view);
    currentMainView = view;
    markActiveNavButton(ontologyBtn, view === "ontology");
    markActiveNavButton(esmaBtn, view === "esma");
    markActiveNavButton(halBtn, view === "hal");
    markActiveNavButton(terimlerBtn, view === "terimler");
    markActiveNavButton(cizimlerBtn, view === "cizimler");
    markActiveNavButton(sirlarBtn, view === "sirlar");
    markActiveNavButton(sorularBtn, view === "sorular");
    markActiveNavButton(acikSorularBtn, view === "aciksorular");
    markActiveNavButton(bilmiyoruzBtn, view === "bilmiyoruz");
    markActiveNavButton(elestiriArkeolojisiBtn, view === "elestiriArkeolojisi");
    markActiveNavButton(hocalarBtn, view === "hocalar");
    markActiveNavButton(eserAgiBtn, view === "eserAgi");
    markActiveNavButton(seyahatAtlasiBtn, view === "seyahatAtlasi");
    markActiveNavButton(kuranDokusuBtn, view === "kuranDokusu");
    markActiveNavButton(menzillerBtn, view === "menziller");
    markActiveNavButton(tasiyicilarBtn, view === "tasiyicilar");
    markActiveNavButton(futuhatBtn, view === "futuhat");
    markActiveNavButton(fususBtn, view === "fusus");
    markActiveNavButton(miskatBtn, view === "miskat");
    markActiveNavButton(hakkindaBtn, view === "hakkinda");
    markActiveNavButton(kavramBtn, view === "kavram");
    markActiveNavButton(ayethadisBtn, view === "ayethadis");
    markActiveNavButton(sahnelerBtn, view === "sahneler");
    if (ontologyWrap) ontologyWrap.hidden = view !== "ontology";
    if (esmaWrap) esmaWrap.hidden = view !== "esma";
    if (halWrap) halWrap.hidden = view !== "hal";
    if (terimlerWrap) terimlerWrap.hidden = view !== "terimler";
    if (cizimlerWrap) cizimlerWrap.hidden = view !== "cizimler";
    if (sirlarWrap) sirlarWrap.hidden = view !== "sirlar";
    if (sorularWrap) sorularWrap.hidden = view !== "sorular";
    if (acikSorularWrap) acikSorularWrap.hidden = view !== "aciksorular";
    if (bilmiyoruzWrap) bilmiyoruzWrap.hidden = view !== "bilmiyoruz";
    if (elestiriArkeolojisiWrap) elestiriArkeolojisiWrap.hidden = view !== "elestiriArkeolojisi";
    if (hocalarWrap) hocalarWrap.hidden = view !== "hocalar";
    if (eserAgiWrap) eserAgiWrap.hidden = view !== "eserAgi";
    if (seyahatAtlasiWrap) seyahatAtlasiWrap.hidden = view !== "seyahatAtlasi";
    if (yolculukWrap) yolculukWrap.hidden = view !== "yolculuk";
    if (kuranDokusuWrap) kuranDokusuWrap.hidden = view !== "kuranDokusu";
    if (menzillerWrap) menzillerWrap.hidden = view !== "menziller";
    if (tasiyicilarWrap) tasiyicilarWrap.hidden = view !== "tasiyicilar";
    if (futuhatWrap) futuhatWrap.hidden = view !== "futuhat";
    if (fususWrap) fususWrap.hidden = view !== "fusus";
    if (miskatWrap) miskatWrap.hidden = view !== "miskat";
    if (hakkindaWrap) hakkindaWrap.hidden = view !== "hakkinda";
    if (kavramWrap) kavramWrap.hidden = view !== "kavram";
    if (ayethadisWrap) ayethadisWrap.hidden = view !== "ayethadis";
    if (sahnelerWrap) sahnelerWrap.hidden = view !== "sahneler";
    if (view === "sahneler") wireSahnelerKartHref();
    if (view === "hakkinda") {
      wireHakkindaDiagrams();
      wireHakkindaScrollTop();
      window.__siirlerApp && window.__siirlerApp.wireTabs();
    }
    currentDetailNode = null;
    currentDetailEdge = null;
    detailPanel.hidden = true;
    if (view === "esma") {
      currentDetailView = "esma";
      window.__esmaApp && window.__esmaApp.activate();
    } else if (view === "hal") {
      currentDetailView = "hal";
      window.__halApp && window.__halApp.activate();
    } else if (view === "terimler") {
      currentDetailView = "terimler";
      window.__terimlerApp && window.__terimlerApp.activate();
    } else if (view === "cizimler") {
      currentDetailView = "cizimler";
      window.__cizimlerApp && window.__cizimlerApp.activate();
    } else if (view === "sirlar") {
      currentDetailView = null;
      currentDetailSirlarId = null;
      window.__sirlarGraphApp && window.__sirlarGraphApp.activate();
    } else if (view === "sorular") {
      currentDetailView = "sorular";
      window.__sorularApp && window.__sorularApp.activate();
    } else if (view === "aciksorular") {
      currentDetailView = null;
      window.__acikSorularApp && window.__acikSorularApp.activate();
    } else if (view === "bilmiyoruz") {
      currentDetailView = null;
      window.__bilmiyoruzApp && window.__bilmiyoruzApp.activate();
    } else if (view === "elestiriArkeolojisi") {
      currentDetailView = null;
      window.__elestiriArkeolojisiApp && window.__elestiriArkeolojisiApp.activate();
    } else if (view === "hocalar") {
      currentDetailView = null;
      window.__hocalarApp && window.__hocalarApp.activate();
    } else if (view === "eserAgi") {
      currentDetailView = null;
      window.__eserAgiApp && window.__eserAgiApp.activate();
    } else if (view === "seyahatAtlasi") {
      currentDetailView = null;
      window.__seyahatAtlasiApp && window.__seyahatAtlasiApp.activate();
    } else if (view === "yolculuk") {
      currentDetailView = null;
      window.__yolculukApp && window.__yolculukApp.activate();
    } else if (view === "kuranDokusu") {
      currentDetailView = null;
      window.__kuranDokusuApp && window.__kuranDokusuApp.activate();
    } else if (view === "menziller") {
      currentDetailView = "menziller";
      window.__menzillerApp && window.__menzillerApp.activate();
    } else if (view === "tasiyicilar") {
      currentDetailView = null;
      window.__tasiyicilarApp && window.__tasiyicilarApp.activate();
    } else if (view === "futuhat") {
      currentDetailView = null;
      window.__futuhatApp && window.__futuhatApp.activate();
    } else if (view === "fusus") {
      currentDetailView = null;
      window.__fususApp && window.__fususApp.activate();
    } else if (view === "miskat") {
      currentDetailView = null;
      window.__miskatApp && window.__miskatApp.activate();
    } else if (view === "kavram") {
      currentDetailView = "kavram";
      window.__kavramApp && window.__kavramApp.activate();
    } else if (view === "ayethadis") {
      currentDetailView = null;
      window.__ayetHadisApp && window.__ayetHadisApp.activate();
    } else {
      currentDetailView = null;
    }
  }

  if (sirlarBtn) {
    sirlarBtn.addEventListener("click", () => { goToSirlar(); updateHash("sirlar"); });
  }

  if (ontologyBtn) ontologyBtn.addEventListener("click", () => { setMainView("ontology"); updateHash("ontoloji"); });
  if (esmaBtn) esmaBtn.addEventListener("click", () => { setMainView("esma"); updateHash("esma"); });
  if (halBtn) halBtn.addEventListener("click", () => { setMainView("hal"); updateHash("hal"); });
  if (terimlerBtn) terimlerBtn.addEventListener("click", () => { setMainView("terimler"); updateHash("terimler"); });
  if (cizimlerBtn) cizimlerBtn.addEventListener("click", () => { setMainView("cizimler"); updateHash("cizimler"); });
  if (sorularBtn) sorularBtn.addEventListener("click", () => { setMainView("sorular"); updateHash("sorular"); });
  if (acikSorularBtn) acikSorularBtn.addEventListener("click", () => { setMainView("aciksorular"); updateHash("acik-sorular"); });
  if (bilmiyoruzBtn) bilmiyoruzBtn.addEventListener("click", () => { setMainView("bilmiyoruz"); updateHash("bilmiyoruz"); });
  if (elestiriArkeolojisiBtn) elestiriArkeolojisiBtn.addEventListener("click", () => { setMainView("elestiriArkeolojisi"); updateHash("elestiri-arkeolojisi"); });
  if (hocalarBtn) hocalarBtn.addEventListener("click", () => { setMainView("hocalar"); updateHash("hocalar"); });
  if (eserAgiBtn) eserAgiBtn.addEventListener("click", () => { setMainView("eserAgi"); updateHash("eser-agi"); });
  if (seyahatAtlasiBtn) seyahatAtlasiBtn.addEventListener("click", () => { setMainView("seyahatAtlasi"); updateHash("seyahat-atlasi"); });
  if (kuranDokusuBtn) kuranDokusuBtn.addEventListener("click", () => { setMainView("kuranDokusu"); updateHash("kuran-dokusu"); });
  if (menzillerBtn) menzillerBtn.addEventListener("click", () => { setMainView("menziller"); updateHash("menziller"); });
  if (tasiyicilarBtn) tasiyicilarBtn.addEventListener("click", () => { setMainView("tasiyicilar"); updateHash("tasiyicilar"); });
  if (futuhatBtn) futuhatBtn.addEventListener("click", () => { setMainView("futuhat"); updateHash("futuhat"); });
  if (fususBtn) fususBtn.addEventListener("click", () => { setMainView("fusus"); updateHash("fusus"); });
  if (miskatBtn) miskatBtn.addEventListener("click", () => { setMainView("miskat"); updateHash("miskat"); });
  if (hakkindaBtn) hakkindaBtn.addEventListener("click", () => { setMainView("hakkinda"); updateHash("hakkinda"); });
  // Okuma Yolları çekmece kapısı (2026-08-10, G50): görünümün kendisi
  // hakkinda'nın alt-sekmesi olarak kalıyor; buradan yalnız o sekmeye
  // gidiliyor ve URL derin-bağlantı olarak /hakkinda/okuma-yollari oluyor
  // (parseHashAndGo bu yolu zaten çözüyor).
  if (okumaYollariBtn) okumaYollariBtn.addEventListener("click", () => { goToHakkinda("okuma-yollari"); updateHash("hakkinda", "okuma-yollari"); });
  // 2026-08-15 @revise: tost menüdeki "Dost Arabî Hakkında" grubunun altına,
  // hakkinda-wrap'in kendi alt-sekmelerine (Şiirleri/Eleştiriler/Okuma
  // Yolları) doğrudan giden üç düğme -- aynı goToHakkinda(sub) sözleşmesi.
  if (hakkindaSubSiirlerBtn) hakkindaSubSiirlerBtn.addEventListener("click", () => { goToHakkinda("siirler"); updateHash("hakkinda", "siirler"); });
  if (hakkindaSubVahdetBtn) hakkindaSubVahdetBtn.addEventListener("click", () => { goToHakkinda("vahdet"); updateHash("hakkinda", "vahdet"); });
  if (hakkindaSubOkumaYollariBtn) hakkindaSubOkumaYollariBtn.addEventListener("click", () => { goToHakkinda("okuma-yollari"); updateHash("hakkinda", "okuma-yollari"); });
  if (kavramBtn) kavramBtn.addEventListener("click", () => { setMainView("kavram"); updateHash("kavram"); });
  if (ayethadisBtn) ayethadisBtn.addEventListener("click", () => { setMainView("ayethadis"); updateHash("ayethadis"); });
  if (sahnelerBtn) sahnelerBtn.addEventListener("click", () => { setMainView("sahneler"); updateHash("sahneler"); });

  // --- Deep linking & cross-view navigation ---
  let pendingSirlarId = null;

  // dostarabi.com'da site kökten servis ediliyor, ama önizleme kopyası
  // hacimurat1979.github.io/dost-onizleme/ altında bir alt path'te duruyor
  // (bkz. scripts/sync-to-preview.py, index.html <base>). Adres çubuğuna
  // yazdığımız/okuduğumuz her path bu kökü hesaba katmalı; <base>'in kendi
  // href'inden okuyoruz ki iki dağıtım da aynı kodu kullanabilsin.
  const ROUTE_BASE = (function () {
    const baseEl = document.querySelector("base");
    if (!baseEl) return "";
    try {
      const u = new URL(baseEl.getAttribute("href"), location.origin);
      return u.pathname.replace(/\/+$/, "");
    } catch (e) {
      return "";
    }
  })();
  window.__dostRouteBase = ROUTE_BASE;
  wireSahnelerKartHref();

  const VIEW_META = {
    ontoloji: {
      title: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
      desc: {
        tr: "Muhyiddîn İbnü'l-Arabî'nin varlık felsefesini (vahdet-i vücûd) anlatmaya değil, anlamaya çalışan mütevazı ve etkileşimli bir harita.",
        en: "A modest, interactive map that tries to understand — not explain — Ibn Arabi's philosophy of Being (wahdat al-wujud).",
        pt: "Um mapa modesto e interativo que tenta compreender — não explicar — a filosofia do Ser de Ibn Arabi (wahdat al-wujud).",
      },
    },
    esma: {
      title: { tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" },
      desc: {
        tr: "Allah'ın güzel isimlerinin İbn Arabî'deki hiyerarşisini ve isimler arası ilişkileri anlamaya çalışan bir harita.",
        en: "A map that tries to understand the hierarchy of, and relations between, God's Beautiful Names in Ibn Arabi's thought.",
        pt: "Um mapa que tenta compreender a hierarquia e as relações entre os Belos Nomes de Deus no pensamento de Ibn Arabi.",
      },
    },
    hal: {
      title: { tr: "Hâller", en: "States", pt: "Estados" },
      desc: {
        tr: "Tasavvuftaki hâl ve makamların (nefs, hayret, fenâ-bekâ...) İbn Arabî'deki seyrini izleyen bir harita.",
        en: "A map that follows the course of Sufi states and stations (the self, bewilderment, annihilation and subsistence...) in Ibn Arabi.",
        pt: "Um mapa que acompanha o percurso dos estados e estações sufis (o ego, o assombro, a aniquilação e subsistência...) em Ibn Arabi.",
      },
    },
    terimler: {
      title: { tr: "Terimler", en: "Terms", pt: "Termos" },
      desc: {
        tr: "İbn Arabî'nin temel terimlerinin (a'yân-ı sâbite, berzah, tecellî...) anlamını ve aralarındaki bağı arayan bir sözlük.",
        en: "A glossary that searches for the meaning of, and connections between, Ibn Arabi's core terms.",
        pt: "Um glossário que busca o sentido e as conexões entre os termos fundamentais de Ibn Arabi.",
      },
    },
    cizimler: {
      title: { tr: "Çizimler", en: "Diagrams", pt: "Diagramas" },
      desc: {
        tr: "İbn Arabî'nin kendi elinden çıkan şemaların bir araya toplandığı bölüm.",
        en: "A section gathering the diagrams Ibn Arabi himself drew.",
        pt: "Uma seção que reúne os diagramas que o próprio Ibn Arabi desenhou.",
      },
    },
    sirlar: {
      title: { tr: "Sırlar", en: "Mysteries", pt: "Mistérios" },
      desc: {
        tr: "İbn Arabî'nin işaret edip açıklamadığı yerlerin külliyat boyunca izini süren bir derleme.",
        en: "A compilation tracing, across the corpus, the places Ibn Arabi points to but leaves unexplained.",
        pt: "Uma coletânea que rastreia, por toda a obra, os lugares que Ibn Arabi aponta mas deixa sem explicação.",
      },
    },
    menziller: {
      title: { tr: "Menziller", en: "Mansions", pt: "Mansões" },
      desc: {
        tr: "Fütûhât'ın 198. Bölümü'ndeki yirmi sekiz faslı tek bir halkada toplayan harita: her menzilin harfi, ilahi ismi ve o menzilden zuhur eden mertebe.",
        en: "A map gathering the twenty-eight sections of Chapter 198 of the Futuhat into one ring: each mansion's letter, divine name, and the level that appears from it.",
        pt: "Um mapa que reúne as vinte e oito secções do Capítulo 198 das Futuhat num só anel: a letra de cada mansão, o nome divino e o grau que dela aparece.",
      },
    },
    tasiyicilar: {
      title: { tr: "Taşıyanlar", en: "The Bearers", pt: "Os Portadores" },
      desc: {
        tr: "Fütûhât'ın 13. ve 476. bölümlerini yan yana koyan bir şema: Arş'ı taşıyan dört esas ile kalbi taşıyan dört esas, iki iç içe sarmal olarak.",
        en: "A diagram placing Chapters 13 and 476 of the Futuhat side by side: the four supports that bear the Throne and the four that bear the heart, as two nested spirals.",
        pt: "Um diagrama que junta os Capítulos 13 e 476 das Futuhat: os quatro suportes que sustentam o Trono e os quatro que sustentam o coração, como duas espirais entrelaçadas.",
      },
    },
    "acik-sorular": {
      title: { tr: "Açık Sorular", en: "Open Questions", pt: "Perguntas em Aberto" },
      desc: {
        tr: "Okurken bize kalan, kapanmamış sorular — ve her biri için okuma kaydımızda ne bulduğumuz, ne bulamadığımız.",
        en: "Questions left with us while reading, still unclosed — and, for each, what we found and what we did not find in our reading record.",
        pt: "Perguntas que ficaram connosco ao ler, ainda por fechar — e, para cada uma, o que encontrámos e o que não encontrámos no nosso registo de leitura.",
      },
    },
    bilmiyoruz: {
      title: { tr: "Bilmiyoruz", en: "We Don't Know", pt: "Não Sabemos" },
      desc: {
        tr: "Sitenin açıkça bilmediğini ya da tartışmalı olduğunu ilan ettiği maddeler — nüsha tarihinden yorum mirasına, eser tasnifinden modern benzetmelere.",
        en: "Items the site openly declares unknown or contested — from manuscript history to a reading's inheritance, from classification of works to modern analogies.",
        pt: "Itens que o site declara abertamente desconhecidos ou contestados — da história do manuscrito à herança de uma leitura, da classificação das obras às analogias modernas.",
      },
    },
    "elestiri-arkeolojisi": {
      title: { tr: "Eleştiri Arkeolojisi", en: "Archaeology of Criticism", pt: "Arqueologia da Crítica" },
      desc: {
        tr: "Dost'a yöneltilen eleştiri ve savunmaları cevaplamadan önce haritalıyoruz: kim, ne zaman, hangi şehirde, kimin himayesinde, neyi okuyarak yazdı.",
        en: "We map the criticisms and defenses aimed at Dost before answering them: who wrote what, when, in which city, under whose patronage, reading what.",
        pt: "Mapeamos as críticas e defesas dirigidas a Dost antes de lhes responder: quem escreveu o quê, quando, em que cidade, sob que patrocínio, lendo o quê.",
      },
    },
    hocalar: {
      title: { tr: "Hocalar", en: "Teachers", pt: "Mestres" },
      desc: {
        tr: "Rûhu'l-kuds'ta andığı 55 hocadan son ikisi, ikisi de kadın — kendi ağzından iki portre.",
        en: "The last two of the 55 teachers named in the Ruh al-quds, both women — two portraits in his own words.",
        pt: "Os dois últimos dos 55 mestres nomeados no Ruh al-quds, ambas mulheres — dois retratos nas suas próprias palavras.",
      },
    },
    "eser-agi": {
      title: { tr: "Eser Ağı", en: "The Works Timeline", pt: "A Linha do Tempo das Obras" },
      desc: {
        tr: "Eserlerinin kronolojik zaman çizelgesi — en erken eser üstte, aşağıya doğru zaman; kenarlar aynı şehirde art arda yazılan eserleri bağlıyor.",
        en: "A chronological timeline of his works — the earliest at the top, time moving downward; connections link works written in the same city back to back.",
        pt: "Uma linha do tempo cronológica das suas obras — a mais antiga no topo, o tempo avançando para baixo; as ligações unem obras escritas na mesma cidade em sequência.",
      },
    },
    "seyahat-atlasi": {
      title: { tr: "Seyahat Atlası", en: "Travel Atlas", pt: "Atlas de Viagem" },
      desc: {
        tr: "Mürsiye'den Şam'a, her durakta yazdığı eserlerle birlikte.",
        en: "From Murcia to Damascus, together with the works he wrote at each stop.",
        pt: "De Múrcia a Damasco, juntamente com as obras que escreveu em cada paragem.",
      },
    },
    yolculuk: {
      title: { tr: "Yolculuk", en: "The Journey", pt: "A Jornada" },
      desc: {
        tr: "Eser Ağı ve Seyahat Atlası'nın birleşik atlas görünümü — her durak coğrafi konumunda, her eser o durakta yazıldığı için durağın yakınında.",
        en: "The combined atlas view of the Works Timeline and the Travel Atlas — each stop at its geographic position, each work next to the stop where it was written.",
        pt: "A vista atlas combinada da Linha do Tempo das Obras e do Atlas de Viagem — cada paragem na sua posição geográfica, cada obra ao lado da paragem onde foi escrita.",
      },
    },
    "kuran-dokusu": {
      title: { tr: "Kur'ân Dokusu", en: "The Qur'ânic Weave", pt: "A Trama Alcorânica" },
      desc: {
        tr: "Fütûhât ve Füsûs özetlerimizde işaretlediğimiz âyet atıflarının sûre↔bap grafı — kısmi bir iz, tam bir tarama değil.",
        en: "A sûrah↔chapter graph of the verse citations we've marked in our Futûhât and Fusûs summaries — a partial trace, not a full scan.",
        pt: "Um grafo surata↔capítulo das citações de versículos que marcámos nos nossos resumos das Futûhât e Fusûs — um traço parcial, não uma varredura completa.",
      },
    },
    sorular: {
      title: { tr: "Sorular", en: "Questions", pt: "Perguntas" },
      desc: {
        tr: "İbn Arabî'yi okurken biriken, henüz kapanmamış soruların toplandığı bölüm.",
        en: "A section gathering the still-open questions that accumulate while reading Ibn Arabi.",
        pt: "Uma seção que reúne as perguntas ainda em aberto que se acumulam ao ler Ibn Arabi.",
      },
    },
    futuhat: {
      title: { tr: "Fütûhât-ı Mekkiyye", en: "Futuhat al-Makkiyya", pt: "Futuhat al-Makkiyya" },
      desc: {
        tr: "Fütûhât-ı Mekkiyye'nin cilt cilt, kısım kısım okunup anlaşılmaya çalışıldığı bölüm.",
        en: "A section reading Futuhat al-Makkiyya volume by volume, part by part.",
        pt: "Uma seção que lê o Futuhat al-Makkiyya volume a volume, parte a parte.",
      },
    },
    fusus: {
      title: { tr: "Füsûsu'l-Hikem", en: "Fusus al-Hikam", pt: "Fusus al-Hikam" },
      desc: {
        tr: "İbn Arabî'nin Füsûsu'l-Hikem'ini (Ahmed Avni Konuk şerhi) fass fass okuma denemesi; her fassın kendi sarmal şemalarıyla.",
        en: "An attempt to read Ibn Arabi's Fusus al-Hikam (with Ahmed Avni Konuk's commentary) bezel by bezel, each with its own spiral diagrams.",
        pt: "Uma tentativa de ler os Fusus al-Hikam de Ibn Arabi (com o comentário de Ahmed Avni Konuk) engaste a engaste, cada um com os seus próprios esquemas em espiral.",
      },
    },
    miskat: {
      title: { tr: "Mişkâtü'l-Envâr", en: "Mishkat al-Anwar", pt: "Mishkat al-Anwar" },
      desc: {
        tr: "İbn Arabî'nin kendi seçip bir araya getirdiği 101 hadîs-i kudsînin, hadis hadis okunduğu bölüm.",
        en: "A section reading, hadith by hadith, the 101 hadith qudsi that Ibn Arabi himself selected and gathered.",
        pt: "Uma seção que lê, hadith a hadith, os 101 hadith qudsi que o próprio Ibn Arabi selecionou e reuniu.",
      },
    },
    hakkinda: {
      title: { tr: "Dost Arabî Hakkında", en: "About Dost Arabi", pt: "Sobre Dost Arabi" },
      desc: {
        tr: "Dost Arabî projesinin ve Muhyiddîn İbnü'l-Arabî'nin kısaca tanıtıldığı sayfa.",
        en: "A page briefly introducing the Dost Arabi project and Muhyiddin Ibn Arabi.",
        pt: "Uma página que apresenta brevemente o projeto Dost Arabi e Muhyiddin Ibn Arabi.",
      },
    },
    kavram: {
      title: { tr: "Kavramlar", en: "Concepts", pt: "Conceitos" },
      desc: {
        tr: "Her kavramın Fütûhât ve Füsûs boyunca izini süren, veriden türetilmiş bir hayat özeti.",
        en: "A data-derived life summary tracing each concept through the Futuhat and the Fusus.",
        pt: "Um resumo de vida derivado de dados que traça cada conceito através do Futuhat e do Fusus.",
      },
    },
    ayethadis: {
      title: { tr: "Âyet & Hadis İndeksi", en: "Verse & Hadith Index", pt: "Índice de Versículos e Hadith" },
      desc: {
        tr: "Sitede alıntılanan âyet ve hadislerin, en çok tekrarladıkları yerden başlayarak sıralandığı bir dizin.",
        en: "An index of the verses and hadiths quoted across the site, ordered by how often each recurs.",
        pt: "Um índice dos versículos e hadiths citados no site, ordenados por quantas vezes cada um recorre.",
      },
    },
    sahneler: {
      title: { tr: "Sahneler", en: "Scenes", pt: "Cenas" },
      desc: {
        tr: "Sitenin bağımsız, sürükleyerek/kaydırarak keşfedilen sahnelerinin galerisi.",
        en: "A gallery of the site's standalone, drag-or-scroll scenes.",
        pt: "Uma galeria das cenas independentes e exploráveis do site.",
      },
    },
  };

  function updateMeta(view) {
    const meta = VIEW_META[view];
    if (!meta) return;
    document.title = view === "ontoloji"
      ? "Dost Arabî — Muhyiddîn İbnü'l-Arabî'nin Varlık Haritası"
      : "Dost Arabî — " + I18n.pick3(meta.title);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://dostarabi.com/" + (view === "ontoloji" ? "" : view));
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute("content", I18n.pick3(meta.desc));
  }

  function updateHash(view, id) {
    const path = ROUTE_BASE + "/" + view + (id ? "/" + id : "");
    if (location.pathname !== path) history.replaceState(null, "", path);
    updateMeta(view);
    if (id) pushBreadcrumb(view, id);
  }

  let breadcrumbTrail = [];

  function pushBreadcrumb(view, id) {
    requestAnimationFrame(() => {
      const titleEl = detailContent.querySelector(".detail-title");
      let label = "";
      if (titleEl) {
        const clone = titleEl.cloneNode(true);
        clone.querySelectorAll(".pole-badge").forEach((b) => b.remove());
        label = clone.textContent.trim();
      }
      if (!label) return;
      const last = breadcrumbTrail[breadcrumbTrail.length - 1];
      if (last && last.view === view && last.id === id) {
        last.label = label;
        renderBreadcrumb();
        return;
      }
      if (!last || last.view !== view) breadcrumbTrail = [];
      breadcrumbTrail.push({ view, id, label });
      if (breadcrumbTrail.length > 4) breadcrumbTrail.shift();
      renderBreadcrumb();
    });
  }

  function renderBreadcrumb() {
    if (!breadcrumbEl) return;
    if (breadcrumbTrail.length < 2) {
      breadcrumbEl.hidden = true;
      breadcrumbEl.innerHTML = "";
      return;
    }
    breadcrumbEl.hidden = false;
    breadcrumbEl.innerHTML = breadcrumbTrail
      .map((c, i) => {
        if (i === breadcrumbTrail.length - 1) {
          return `<span class="detail-breadcrumb__item detail-breadcrumb__item--current">${c.label}</span>`;
        }
        return `<button type="button" class="detail-breadcrumb__item" data-view="${c.view}" data-id="${c.id}">${c.label}</button>`;
      })
      .join('<span class="detail-breadcrumb__sep">›</span>');
    breadcrumbEl.querySelectorAll("button.detail-breadcrumb__item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        const id = btn.dataset.id;
        const idx = breadcrumbTrail.findIndex((c) => c.view === view && c.id === id);
        if (idx !== -1) breadcrumbTrail = breadcrumbTrail.slice(0, idx + 1);
        window.__dostNav.goTo(view, id);
      });
    });
  }

  function goToOntologyNode(id) {
    setMainView("ontology");
    const d = nodeById && nodeById.get(id);
    if (d) onNodeClick(d);
  }

  function goToEsma(id) {
    setMainView("esma");
    if (id) window.__esmaApp && window.__esmaApp.goToNode(id);
  }

  function goToHal(id) {
    setMainView("hal");
    if (id) window.__halApp && window.__halApp.goToNode(id);
  }

  function goToTerimler(id) {
    setMainView("terimler");
    window.__terimlerApp && window.__terimlerApp.goToNode(id);
  }

  function goToCizimler() {
    setMainView("cizimler");
    window.__cizimlerApp && window.__cizimlerApp.activate();
  }

  function goToSirlar(id) {
    setMainView("sirlar");
    currentDetailNode = null;
    currentDetailEdge = null;
    if (!sirlarData) {
      // Veri artık talep üzerine geliyor; istenen kaydı bekletip veri
      // gelince açıyoruz (eskiden veri açılışta indiği için burada
      // yalnızca beklemek yetiyordu).
      pendingSirlarId = id || null;
      ensureSirlarData().then((d) => {
        if (!d || currentMainView !== "sirlar") return;
        const bekleyen = pendingSirlarId;
        pendingSirlarId = null;
        // 2026-08-06 kullanıcı bulgusu: id yoksa (yalnız nav'dan açılış)
        // showSirlarOverview() paneli otomatik açıyordu -- artık yalnız
        // bir kayıt seçildiğinde açılıyor (bkz. hocalar.js'teki aynı
        // düzeltme).
        if (bekleyen) showSirlarEntry(bekleyen);
      });
      return;
    }
    pendingSirlarId = null;
    if (!id) return;
    showSirlarEntry(id);
  }

  function goToMenziller(id) {
    setMainView("menziller");
    currentDetailNode = null;
    currentDetailEdge = null;
    window.__menzillerApp && window.__menzillerApp.goToNode(id);
  }

  function goToSorular(id) {
    setMainView("sorular");
    window.__sorularApp && window.__sorularApp.goToNode(id);
  }

  function goToAcikSorular(id) {
    setMainView("aciksorular");
    if (id) window.__acikSorularApp && window.__acikSorularApp.goToNode(id);
  }

  function goToBilmiyoruz(id) {
    setMainView("bilmiyoruz");
    if (id) window.__bilmiyoruzApp && window.__bilmiyoruzApp.goToNode(id);
  }

  function goToElestiriArkeolojisi(id) {
    setMainView("elestiriArkeolojisi");
    if (id) window.__elestiriArkeolojisiApp && window.__elestiriArkeolojisiApp.goToNode(id);
  }

  function goToHocalar(id) {
    setMainView("hocalar");
    if (id) window.__hocalarApp && window.__hocalarApp.goToNode(id);
  }

  function goToEserAgi(id) {
    setMainView("eserAgi");
    if (id) window.__eserAgiApp && window.__eserAgiApp.goToNode(id);
  }

  function goToSeyahatAtlasi(id) {
    setMainView("seyahatAtlasi");
    if (id) window.__seyahatAtlasiApp && window.__seyahatAtlasiApp.goToNode(id);
  }

  function goToYolculuk(id) {
    setMainView("yolculuk");
    if (id) window.__yolculukApp && window.__yolculukApp.goToNode(id);
  }

  function goToKuranDokusu(id) {
    setMainView("kuranDokusu");
    if (id) window.__kuranDokusuApp && window.__kuranDokusuApp.goToNode(id);
  }

  // Taşıyanlar tek bir şemadan ibaret; derin bağlantı için ayrı bir id'si
  // yok, o yüzden setMainView zaten sahneyi kuruyorsa ikinci kez
  // activate() çağırmaya gerek yok -- ama başka bir görünümden gelindiğinde
  // (setMainView erken dönerse) sahne kurulmamış olabiliyor.
  function goToTasiyicilar() {
    setMainView("tasiyicilar");
    window.__tasiyicilarApp && window.__tasiyicilarApp.activate();
  }

  function goToFutuhat(id) {
    setMainView("futuhat");
    // 2026-08 kod taraması: id yokken burada da activate() çağırmak,
    // setMainView'in kendi iç dalının (view değişince tetiklenen)
    // activate()'iyle art arda iki kez çalışıyordu -- ikinci çağrı,
    // BİRİNCİ çağrının render()->activatePart() içinde henüz yazdığı
    // "kaldığın yer" localStorage değerini geri okuyup ilk kez gelen bir
    // okuyucuyu yanlışlıkla "zaten bir yeri var" sanıyordu (bkz.
    // isDefaultLanding / futuhat-start-hint). Kavram'daki gibi yalnız id
    // doluyken tekrar çağırıyoruz.
    if (id) window.__futuhatApp && window.__futuhatApp.activate(id);
  }

  function goToFusus(id) {
    setMainView("fusus");
    if (id) window.__fususApp && window.__fususApp.activate(id);
  }

  function goToMiskat(id) {
    setMainView("miskat");
    if (id) window.__miskatApp && window.__miskatApp.activate(id);
  }

  function goToHakkinda(sub) {
    setMainView("hakkinda");
    // "hakkinda"nın kendi id'si yok (view içi üç alt-sekme var); goTo'nun
    // ikinci argümanı köprü bağlantılarının (2026-08-06, vahdet-elestiri
    // köprüsü) hangi alt-sekmeye açılacağını taşıması için kullanılıyor.
    if (sub) window.__siirlerApp && window.__siirlerApp.switchTo(sub);
  }

  // Sahneler galerisi (2026-08-05) + tost menünün Sahneler alt-menüsü
  // (2026-08-15 @revise): href'ler statik HTML'de YAZILMIYOR, çünkü
  // ROUTE_BASE (önizleme/canlı ayrımı) yalnız burada, çalışma zamanında
  // biliniyor (bkz. index.html'deki sahneler-wrap yorumu). Galeri kartları
  // yalnız "sahneler" görünümüne geçişte var olduğu için setMainView onları
  // her seferinde bağlıyor; alt-menü öğeleri her sayfada baştan DOM'da
  // olduğundan bir kez, sayfa açılışında bağlanması yeterli (aşağıda
  // ROUTE_BASE atandıktan hemen sonra çağrılıyor). Aynı fonksiyon ikisini de
  // kapsıyor -- a.href'i tekrar tekrar atamak zararsız.
  function wireSahnelerKartHref() {
    document.querySelectorAll("[data-scene-href]").forEach((a) => {
      a.href = ROUTE_BASE + "/" + a.dataset.sceneHref;
    });
  }

  function goToSahneler() {
    setMainView("sahneler");
  }

  function goToKavram(id) {
    setMainView("kavram");
    if (id) window.__kavramApp && window.__kavramApp.goToNode(id);
  }

  function goToAyetHadis() {
    setMainView("ayethadis");
  }

  function parseHashAndGo() {
    const rawPath = location.pathname.slice(ROUTE_BASE.length) || "/";
    const m = /^\/(ontoloji|esma|sirlar|hal|terimler|cizimler|sorular|acik-sorular|bilmiyoruz|elestiri-arkeolojisi|hocalar|eser-agi|seyahat-atlasi|yolculuk|kuran-dokusu|menziller|tasiyicilar|futuhat|fusus|miskat|hakkinda|kavram|ayethadis|sahneler)(\/.*)?$/.exec(rawPath);
    if (!m) return;
    const [, view, restRaw] = m;
    // id kısmı bir sonraki segment'e kadar bağıl-slaş içerebilir (örn.
    // "edge/nodeA-nodeB"), üstelik gerçek statik dosyalar (futuhat/c1k5/
    // index.html gibi) "/futuhat/c1k5/" biçiminde sondaki "/" ile de
    // istenebiliyor, hatta id'siz bir görünüm de ("/esma/") aynı şekilde
    // sondaki slaş'la gelebiliyor -- baştaki/sondaki slaş'ları ayıklayıp
    // geriye boş kalırsa id'yi undefined yap.
    let id = restRaw ? (restRaw.replace(/^\//, "").replace(/\/$/, "") || undefined) : undefined;
    // XSS-01/02 (uzman paneli denetimi, 2026-08-17): id buradan yaklaşık
    // kırk ayrı görünümün "data-id"/"data-view" içeren şablon dizesine
    // (escape'lenmeden) akıyor. Normalde bu veri dosyalarından (güvenilir)
    // geliyor, ama BURADAKİ id tarayıcı adres çubuğundan geliyor --
    // 404.html'in ?p= yeniden yazması + history.replaceState ile
    // saldırganın kurduğu bir bağlantı, gerçek bir veri kaydına hiç
    // uğramadan buraya rastgele metin taşıyabilir. Güven sınırı burası:
    // sitedeki gerçek id'lerin hepsi bu kalıba uyuyor (harf/rakam/tire/alt
    // çizgi, "edge/nodeA-nodeB" gibi tek düzey iç eğik çizgiyle) --
    // uymayan her şey (tırnak, açı ayracı, & vb. taşıyan) id'siz görünüm
    // durumuna düşürülüyor, hiçbir render fonksiyonuna ulaşmıyor.
    if (id && !/^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)?$/.test(id)) id = undefined;
    updateMeta(view);
    if (view === "ontoloji") goToOntologyNode(id);
    else if (view === "esma") goToEsma(id);
    else if (view === "sirlar") goToSirlar(id);
    else if (view === "hal") goToHal(id);
    else if (view === "terimler") goToTerimler(id);
    else if (view === "cizimler") goToCizimler();
    else if (view === "sorular") goToSorular(id);
    else if (view === "acik-sorular") goToAcikSorular(id);
    else if (view === "bilmiyoruz") goToBilmiyoruz(id);
    else if (view === "elestiri-arkeolojisi") goToElestiriArkeolojisi(id);
    else if (view === "hocalar") goToHocalar(id);
    else if (view === "eser-agi") goToEserAgi(id);
    else if (view === "seyahat-atlasi") goToSeyahatAtlasi(id);
    else if (view === "yolculuk") goToYolculuk(id);
    else if (view === "kuran-dokusu") goToKuranDokusu(id);
    else if (view === "menziller") goToMenziller(id);
    else if (view === "tasiyicilar") goToTasiyicilar();
    else if (view === "futuhat") goToFutuhat(id);
    else if (view === "fusus") goToFusus(id);
    else if (view === "miskat") goToMiskat(id);
    else if (view === "hakkinda") goToHakkinda(id);
    else if (view === "kavram") goToKavram(id);
    else if (view === "ayethadis") goToAyetHadis();
    else if (view === "sahneler") goToSahneler();
  }

  window.addEventListener("popstate", parseHashAndGo);

  // Site içi tüm gezinme #/view yerine gerçek /view yollarını kullanıyor
  // (bkz. 404.html) — bu yüzden linkify()'ın ürettiği <a class="cross-link">
  // etiketleri artık gerçek path'lere işaret ediyor. Tıklama tam sayfa
  // yenilemesi tetiklemesin diye burada yakalayıp SPA içi yönlendirmeye
  // çeviriyoruz; yeni sekmede aç / orta tık gibi tarayıcı varsayılanlarını
  // bozmamak için değiştirici tuş basılıysa dokunmuyoruz.
  // Seçici bilerek "a.cross-link" DEĞİL "a[data-view]": Sırlar↔Sorular
  // köprüsü gibi kart tarzı linkler (.sorular-sir) .cross-link'in kendi
  // stilini (noktalı alt çizgi/renk) İSTEMİYOR ama SPA yönlendirmesine
  // aynı şekilde ihtiyaç duyuyor -- yalnız .cross-link'e bakmak bu ikisini
  // birbirine bağlıyordu, sınıf eksikse tıklama sessizce tam sayfa
  // yenilemesine düşüyordu (2026-08-07 UI denetimi, 33 bağın tamamı).
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest("a[data-view]");
    if (!a) return;
    const view = a.dataset.view;
    if (!view) return;
    event.preventDefault();
    window.__dostNav.goTo(view, a.dataset.id || undefined);
  });

  window.__dostNav = {
    goTo(view, id) {
      if (view === "ontoloji") goToOntologyNode(id);
      else if (view === "esma") goToEsma(id);
      else if (view === "sirlar") goToSirlar(id);
      else if (view === "hal") goToHal(id);
      else if (view === "terimler") goToTerimler(id);
      else if (view === "cizimler") goToCizimler();
      else if (view === "sorular") goToSorular(id);
    else if (view === "acik-sorular") goToAcikSorular(id);
      else if (view === "bilmiyoruz") goToBilmiyoruz(id);
      else if (view === "elestiri-arkeolojisi") goToElestiriArkeolojisi(id);
      else if (view === "hocalar") goToHocalar(id);
      else if (view === "eser-agi") goToEserAgi(id);
      else if (view === "seyahat-atlasi") goToSeyahatAtlasi(id);
    else if (view === "yolculuk") goToYolculuk(id);
      else if (view === "kuran-dokusu") goToKuranDokusu(id);
      else if (view === "menziller") goToMenziller(id);
      else if (view === "tasiyicilar") goToTasiyicilar();
      else if (view === "futuhat") goToFutuhat(id);
      else if (view === "fusus") goToFusus(id);
      else if (view === "miskat") goToMiskat(id);
      else if (view === "hakkinda") goToHakkinda(id);
      else if (view === "kavram") goToKavram(id);
      else if (view === "ayethadis") goToAyetHadis();
      else if (view === "sahneler") goToSahneler();
      updateHash(view, id);
    },
    setHash: updateHash,
    // Modüller kendi <a class="cross-link"> etiketlerini kurarken gerçek
    // bir href'e ihtiyaç duyuyor (yeni sekmede aç / bağlantıyı kopyala
    // çalışsın diye); ROUTE_BASE burada olduğu için helper da burada.
    href(view, id) {
      return ROUTE_BASE + "/" + view + (id ? "/" + id : "");
    },
  };

  let simulation, nodeSel, pathSel, hitSel, labelSel, nodeById;
  // FAZ 1 (grafik-önce, 2026-08-03): buildGraph doğuş animasyonunu bu
  // değişkene bırakır; loadOntologyData rota çözüldükten sonra (yalnız
  // gerçekten ontoloji ana ekranındaysak) çağırır. Bkz. runBirth.
  let birthFn = null;

  function buildGraph(data) {
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;

    // --- 3B durumu (Hâller/Menziller ile aynı model) ---
    // pitch 0.26: Menziller'de yerleşen değer. Sarmalın okunur (monoton)
    // olması için gereken eşik dropH > 2π·tan(pitch)·r ≈ 1.67·r; aşağıda
    // 2.2·r veriyoruz, rahat payla geçiyor. FOCAL uzun tutuldu: dokuz
    // düğüm tek bir tura yayıldığı için güçlü perspektif etiketleri
    // birbirine bindiriyordu.
    const FOCAL3D = 2600;
    const TILT_DUR_3D = 1050;
    const cx3d = width / 2, cy3d = height * 0.52;
    const ringR3d = Math.max(120, Math.min(width, height) / 2 - 110);
    const dropH = ringR3d * 2.2;
    let tilt = 0, tiltTarget = 0, tiltFrom = 0, tiltAnimStart = 0;
    // Sahnenin yavaş salınımı (bkz. aşağıdaki spinFrame/SWAY_DEG) burada da
    // biliniyor olmalı: yerleşim hep salınımın ortasında (0°) hesaplanırsa,
    // ucunda sınırdaki etiket çiftleri yeniden çakışıyordu (2026-08-06
    // ölçüldü). cx3d/cy3d, spinFrame'in döndürdüğü aynı merkez (0.5·width,
    // 0.52·height) -- iki ayrı sabit tutmaya gerek yok.
    let swayRad = 0;
    function swayRotate(x, y) {
      if (!swayRad) return { x, y };
      const dx = x - cx3d, dy = y - cy3d;
      const c = Math.cos(swayRad), sn = Math.sin(swayRad);
      return { x: cx3d + dx * c - dy * sn, y: cy3d + dx * sn + dy * c };
    }
    let yaw = 0, pitch = 0.26, rotating = false;
    // spinFrame()'in 3B yaw-döngü kolunun kendi tazeleme eşiği için --
    // bkz. spinFrame içindeki kullanım ve aynı kusurun ölçüldüğü not.
    let yawPainted = 0;

    const defs = svg.append("defs");
    ["descent", "return", "paradox"].forEach((kind) => {
      defs.append("marker")
        .attr("id", "arrow-" + kind)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 9)
        .attr("refY", 0)
        .attr("markerWidth", 7)
        .attr("markerHeight", 7)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("class", "arrowhead arrowhead--" + kind);
    });

    const nodes = data.nodes.map((n) => Object.assign({}, n));
    nodeById = new Map(nodes.map((n) => [n.id, n]));

    const links = data.edges.map((e) => Object.assign({}, e));

    nodes.forEach((n) => {
      const t = TARGET[n.id] || { x: 0.5, y: 0.5 };
      n.tx = t.x * width;
      n.ty = t.y * height;
      n.x = n.tx;
      n.y = n.ty;
      // Kalp dairenin NOKTASI: kuvvet simülasyonunun onu birkaç piksel
      // kaydırması bile iddiayı yaklaşık hâle getiriyordu. Tam merkeze
      // sabitliyoruz ki "her yeri merkeze aynı uzaklıkta" doğru olsun.
      if (n.id === "kalp") { n.fx = n.tx; n.fy = n.ty; }
    });

    // ------------------------------------------------------------------
    // Mertebe ekseni (3B). Bu görünümün 2B hâli zaten "daire ve merkez"i
    // söylüyor: sekiz kavram bir elipsin üzerinde, Kalp tam ortada -- Cilt
    // XIII'te okuduğumuz "Hak kulunun kalbinde kendisine nazar eder ve
    // dairenin noktası olduğunu görür" cümlesinin şekle dökülmüş hâli.
    //
    // Ama veride ikinci bir iddia daha var ve 2B onu göstermiyor: her
    // düğümün bir `layer`ı (0-6) var, yani Zât'tan Kalp'e bir İNİŞ. 3B
    // eğim tam olarak bunu açıyor -- katmanlar dikeyde ayrışıyor, halka
    // her katmanda biraz dönerek alçalıyor, İnsan-ı Kâmil ve Kalp'ten
    // Zât'a giden dönüş kenarları da dipten tepeye yükselen kirişler
    // hâline geliyor. Yani 2B ve 3B aynı verinin iki okuması; ikisi de
    // metinde var, ikisi de kaybolmasın diye eğim bir düğmeye bağlı ve
    // varsayılan 2B (bu görünümün imzası daire-ve-merkez).
    //
    // Motor Hâller/Menziller ile birebir aynı (bkz. research/
    // GRAFIK-FELSEFESI.md): elle yazılmış yaw/pitch/perspektif, Three.js
    // yok. tilt=0'da konumlar force düzeninin BİREBİR aynısı kalır.
    const layers = Array.from(new Set(nodes.map((n) => n.layer))).sort((a, b) => a - b);
    const maxLayer = layers[layers.length - 1] || 1;
    const perLayer = new Map();
    layers.forEach((L) => perLayer.set(L, nodes.filter((n) => n.layer === L)));
    nodes.forEach((n) => {
      const peers = perLayer.get(n.layer);
      n.__li = peers.indexOf(n);
      n.__ln = peers.length;
    });

    // Bir katmandaki birden çok düğüm (4. katmanda üç âlem var) o katmanın
    // açı diliminde yan yana açılır -- üst üste binmesinler diye.
    const SPREAD = 0.62;
    function helixPoint(n) {
      const f = n.layer / maxLayer;                       // 0 (Zât) .. 1 (Kalp)
      const off = n.__ln > 1 ? (n.__li - (n.__ln - 1) / 2) * SPREAD : 0;
      const a = -Math.PI / 2 + f * Math.PI * 2 + off;
      const r = ringR3d * (0.72 + 0.28 * f);
      const flatY = r * Math.sin(a);
      return { x: r * Math.cos(a), y: flatY, z: 0, drop: -dropH / 2 + dropH * f };
    }
    // Hâller'deki projeksiyonun aynısı: yaw (Y ekseni) → pitch (X ekseni) →
    // perspektif bölme. Her ikisi de yalnız tilt ile devreye girer.
    function project3d(p) {
      const yy = yaw * tilt, pp = pitch * tilt;
      const cyw = Math.cos(yy), syw = Math.sin(yy);
      const x1 = p.x * cyw + p.z * syw;
      const z1 = -p.x * syw + p.z * cyw;
      const cpt = Math.cos(pp), spt = Math.sin(pp);
      const y2 = p.y * cpt - z1 * spt;
      const z2 = p.y * spt + z1 * cpt;
      const zc = Math.max(z2, -FOCAL3D * 0.85);
      const depth = FOCAL3D / (FOCAL3D + zc);
      return { x: x1 * depth, y: y2 * depth, depth: depth, z: z2 };
    }

    // Her karede ekran konumlarını tazeler. tilt=0 iken px/py force
    // simülasyonunun verdiği x/y'nin ta kendisidir -- 2B hiç bozulmaz.
    function positionNodes() {
      nodes.forEach((n) => {
        if (tilt < 0.001) {
          n.px = n.x; n.py = n.y; n.__depth = 1; n.__z = 0;
          return;
        }
        const h = helixPoint(n);
        // Katman yüksekliği dikeyde, halkanın kendi salınımı z'de: eğildikçe
        // düzlem yatar ve yükseklik görünür olur (Hâller'deki harman).
        const p = project3d({ x: h.x, y: h.y * (1 - tilt) + h.drop * tilt, z: h.y * tilt });
        n.px = n.x * (1 - tilt) + (cx3d + p.x) * tilt;
        n.py = n.y * (1 - tilt) + (cy3d + p.y) * tilt;
        n.__depth = 1 + (p.depth - 1) * tilt;
        n.__z = p.z * tilt;
      });
    }

    simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(120).strength(0.15))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("x", d3.forceX((d) => d.tx).strength(0.85))
      .force("y", d3.forceY((d) => d.ty).strength(0.85))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + 44));

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");

    const zoom = window.DostGraphUtils.createZoomBehavior(svg, zoomLayer, [0.5, 4], (event) => !event.target.closest(".node"));
    // `fit`: bütün haritayı çerçeveye sığdırır. Yayılma davranışları (#2)
    // buna ihtiyaç duyuyor -- ışığın Zât'tan bütün mertebelere gitmesi,
    // ancak bütün mertebeler ekrandayken görülebilir. Tıklamanın olağan
    // panToNode'u o sahneyi ekran dışında bırakıyordu (ölçüldü).
    window.__ontologyZoom = {
      svg, zoom,
      fit(animate) {
        const sel = (animate && !reduceMotion) ? svg.transition().duration(520) : svg;
        sel.call(zoom.transform, computeFitTransform());
      },
    };

    window.DostGraphUtils.wireRecenter("ontology-recenter", () => {
      // Seçim burada kamerayı taşımıyor (düğüme tıklamak yalnız paneli
      // açıyor), o yüzden yalnız çerçeve sıfırlanıyor -- seçili düğüm kalır.
      const sel = reduceMotion ? svg : svg.transition().duration(400);
      sel.call(zoom.transform, computeFitTransform());
    });

    // Etiket genişlikleri metne göre değişir (bkz. labelFor); ölçüm ucuz
    // olsun diye metin başına önbelleğe alınır.
    const fitLabelWidthCache = new Map();
    function labelHalfWidth(d) {
      const txt = labelFor(d);
      let w = fitLabelWidthCache.get(txt);
      if (w == null) {
        w = 0;
        if (labelSel) {
          const el = labelSel.filter((n) => n.id === d.id).node();
          if (el) { try { w = el.getComputedTextLength(); } catch (e) {} }
        }
        if (!w) w = txt.length * 6.4;
        fitLabelWidthCache.set(txt, w);
      }
      return w / 2;
    }
    function computeFitTransform() {
      const pad = 48;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      nodes.forEach((n) => {
        const r = radiusFor(n);
        // 3B'de sarmal düz halkadan belirgin biçimde uzun; sığdırma o
        // yüzden hedef (tx/ty) yerine güncel ekran konumuna bakmalı.
        const bx = tiltTarget > 0.5 && n.px != null ? n.px : n.tx;
        const by = tiltTarget > 0.5 && n.py != null ? n.py : n.ty;
        // Sığdırma yalnız düğüm DAİRESİNE bakıyordu, altındaki yazıya değil
        // -- uzun etiketler (ör. "Self-Disclosure and the Breath of the
        // All-Merciful") dairenin çok dışına taşıyor, dar (mobil) ekranda
        // iki kenardan birden kırpılıyordu (2026-08-06 ölçüldü). Yazı
        // düğümün altında ORTALANMIŞ ve YATAYDA yarı genişliği kadar
        // dışarı taşıyor; dikeyde de düğümün altına (baseY + satır
        // yüksekliği kadar) sarkıyor.
        const half = Math.max(r, labelHalfWidth(n));
        minX = Math.min(minX, bx - half);
        maxX = Math.max(maxX, bx + half);
        minY = Math.min(minY, by - r);
        maxY = Math.max(maxY, by + r + 14 + 16);
      });
      const bboxW = Math.max(maxX - minX, 1);
      const bboxH = Math.max(maxY - minY, 1);
      const scale = Math.min(
        4,
        Math.max(0.22, Math.min((width - pad * 2) / bboxW, (height - pad * 2) / bboxH))
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return d3.zoomIdentity
        .translate(width / 2 - scale * cx, height / 2 - scale * cy)
        .scale(scale);
    }

    // Sakin dönüş için ara grup: bütün sahne dairenin merkezi etrafında
    // yavaşça döner; etiketler ayrıca ters çevrilip dik ve yerinde tutulur.
    const spinGroup = zoomLayer.append("g").attr("class", "onto-spin");

    // Dairenin kendisi. TARGET düzeni sekiz kavramı bir elipsin üzerine,
    // Kalp'i tam merkezine koyuyordu -- ama daire yalnızca ima ediliyordu,
    // çizilmiyordu. Cilt XIII'ün "dairenin noktası / dairenin çevresi"
    // okumasından sonra onu görünür kılmamak eksiklik oldu. Yalnız 2B'de
    // görünür: 3B'de düzlem yattığı için anlamını yitiriyor.
    const ringLayer = spinGroup.append("g").attr("class", "onto-ring-layer");
    // Doğuş animasyonu (runBirth) halkayı da kademeli belirtir; animasyon
    // dışında hep 1 (paintPositions her karede kullanıyor).
    let birthRing = 1;
    const ringEl = ringLayer
      .append("ellipse")
      .attr("class", "onto-ring")
      .attr("cx", 0.5 * width)
      .attr("cy", 0.52 * height)
      .attr("rx", 0.339 * width)
      .attr("ry", 0.36 * height);

    const linkGroup = spinGroup.append("g").attr("class", "links");

    // GÖRÜNEN çizgi: yalnız çizim. 1,6px'lik bir çizgiyi fareyle tutturmak
    // zordu (kullanıcı notu 2026-08-03) -- etkileşim bu yüzden ayrı,
    // GÖRÜNMEZ ve kalın bir "isabet şeridine" taşındı (aşağıda). Şerit
    // çizginin altında duruyor ki okları/çizgiyi örtmesin; saydam olduğu
    // için görünüşe hiç karışmıyor.
    pathSel = linkGroup
      .selectAll("path.link")
      .data(links)
      .join("path")
      .attr("class", (d) => "link link--" + d.kind + " link--conf-" + confSlug(d.confidence))
      .attr("marker-end", (d) => "url(#arrow-" + (d.kind === "gather" ? "descent" : d.kind) + ")")
      .attr("fill", "none")
      .attr("pointer-events", "none");

    // İsabet şeridi: "değinmek" fiilinin gerçekten mümkün olması için
    // (#10 + ETKILESIM_DILI.md'nin dördüncü fiili). Klavye karşılığı da
    // burada -- odaklanabilir olan bu şerit, çünkü tıklanabilir olan da o.
    hitSel = linkGroup
      .selectAll("path.link-hit")
      .data(links)
      .join("path")
      .attr("class", "link-hit")
      .attr("fill", "none")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => edgeAriaLabel(d))
      .on("mouseenter", (event, d) => { highlightEdge(d); showEdgeTooltip(d, event); })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => { highlight(null); hideTooltip(); })
      .on("focus", (event, d) => { highlightEdge(d); showEdgeTooltip(d, event); })
      .on("blur", () => { highlight(null); hideTooltip(); })
      .on("keydown", (event, d) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onEdgeClick(d); } })
      .on("click", (event, d) => onEdgeClick(d));

    // Ok tuşuyla gezinme: verilen yön vektörüne (dx,dy) en çok hizalı VE en
    // yakın düğümü bulur -- yalnız açının 90°'den dar olduğu (aynı yarım
    // düzlemdeki) adaylar arasından, açı+mesafe birleşik bir skorla seçiyor
    // ki hem "sağdaki en yakın" hem "gerçekten sağda olan" tutarlı olsun.
    function nearestNodeInDirection(current, dx, dy) {
      let best = null, bestScore = Infinity;
      nodes.forEach((n) => {
        if (n.id === current.id) return;
        const vx = n.x - current.x, vy = n.y - current.y;
        const dist = Math.hypot(vx, vy);
        if (dist < 1) return;
        const dot = (vx * dx + vy * dy) / dist;
        if (dot <= 0.3) return; // ~72°'den geniş sapmaları ele
        const score = dist / dot;
        if (score < bestScore) { bestScore = score; best = n; }
      });
      return best;
    }

    const nodeGroup = spinGroup.append("g").attr("class", "nodes");

    nodeSel = nodeGroup
      .selectAll("g.node")
      .data(nodes)
      .join("g")
      .attr("class", "node ontology-node")
      .classed("node--root", (d) => d.id === "dhat")
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d) => labelFor(d))
      .call(drag(simulation))
      .on("click", (event, d) => onNodeClick(d))
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onNodeClick(d);
        } else if (event.key.startsWith("Arrow")) {
          // B2 "klavye-only graf gezintisi": bir düğüme Tab ile gelindikten
          // sonra ok tuşlarıyla en yakın komşu düğüme geçilebilir -- fare
          // olmadan da grafın gezilebilmesi için.
          const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
          if (!dir) return;
          const next = nearestNodeInDirection(d, dir[0], dir[1]);
          if (next) {
            event.preventDefault();
            const el = nodeSel.filter((n) => n.id === next.id).node();
            if (el) el.focus();
          }
        }
      })
      .on("mouseenter", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => { highlight(null); hideTooltip(); })
      .on("focus", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("blur", () => { highlight(null); hideTooltip(); });

    nodeSel
      .append("circle")
      .attr("class", "node-halo")
      .attr("r", (d) => radiusFor(d) * 1.4);

    nodeSel
      .append("circle")
      .attr("r", (d) => radiusFor(d))
      .attr("fill", (d) => colorFor(d));

    nodeSel
      .append("circle")
      .attr("class", "node-sheen")
      .attr("r", (d) => radiusFor(d));

    labelSel = nodeSel
      .append("text")
      .attr("class", "node-label")
      .attr("y", (d) => radiusFor(d) + 14)
      .attr("text-anchor", "middle")
      .text((d) => labelFor(d));

    // 3B derinlik eğiminde her düğüm kendi grubuna translate+scale(s)
    // alıyor -- s, düğümün dairesini VE altındaki etiketi birlikte
    // küçültüp büyütüyor. Hem çizim hem çakışma-önleme AYNI s'i kullanmalı.
    function nodeScale(d) {
      return Math.max(0.55, 1 + (d.__depth - 1) * tilt);
    }

    function paintPositions() {
      positionNodes();
      pathSel.attr("d", (d) => edgePath(d));
      // İsabet şeridi görünen çizgiyle AYNI yolu izlemeli, yoksa
      // kullanıcı gördüğü çizgiye değil başka bir yere değinir.
      if (hitSel) hitSel.attr("d", (d) => edgePath(d));
      // 3B'de uzaktakiler önce çizilsin ki örtüşme doğru olsun.
      if (tilt > 0.02) nodeSel.sort((a, b) => (b.__z || 0) - (a.__z || 0));
      nodeSel
        .attr("transform", (d) => `translate(${d.px},${d.py}) scale(${nodeScale(d).toFixed(3)})`)
        // Atmosfer: uzaktaki düğüm soluklaşır (Hâller'deki aynı ölçü).
        // __birth: doğuş animasyonu sırasında katman katman belirme çarpanı
        // (runBirth); animasyon bitince alan siliniyor, çarpan 1'e düşüyor.
        .style("opacity", (d) => {
          const base = tilt > 0.02 ? Math.max(0.62, Math.min(1, d.__depth * 1.02)) : 1;
          return d.__birth == null ? base : base * d.__birth;
        });
      ringEl.style("opacity", (1 - tilt) * birthRing);
      // Etiket çakışması: kuvvet düzeni düğümleri yaklaştırdığında yazılar
      // üst üste biniyordu (ölçüldü 2026-07-31: masaüstü 2, mobil 8).
      // Düğüm yerinde kalır, yalnız yazı dikeyde yer açar; motor
      // graph-utils.js'te ortak (aynısı /hal/ ve /sorular/'da da çalışıyor).
      const pend = [];
      labelSel.each(function (d) {
        const baseY = radiusFor(d) + 14;
        const s = nodeScale(d);
        // Etiket kendi grubu içinde ters döndürülüp dik tutuluyor (bkz.
        // spinFrame), yani salınımdan yalnız ANKRAJ noktası (px,py) etkileniyor
        // -- dikey ofset (baseY) hep ekranda düz aşağı iniyor.
        const anchor = swayRotate(d.px, d.py);
        pend.push({
          lbl: d3.select(this), txt: labelFor(d),
          x: anchor.x, y: anchor.y + baseY * s, baseY, scale: s,
          priority: d.id === "dhat" ? 2 : (d.kind === "hub" ? 1 : 0),
        });
      });
      // Etiketler yalnız birbirini değil, komşu düğümlerin DAİRELERİNİ de
      // engel saymalı -- bkz. graph-utils.js'teki not. Daireler de kendi
      // düğümünün s'iyle küçülüp büyüyor; dairenin kendisi dönse de
      // biçimi (çember) değişmediği için ankraj noktasını döndürmek yeter.
      const nodeObstacles = nodes.map((d) => {
        const s = nodeScale(d);
        const anchor = swayRotate(d.px, d.py);
        return { x: anchor.x, y: anchor.y, half: radiusFor(d) * s, h: radiusFor(d) * 2 * s };
      });
      // Ekstra pay: bu sahne yavaşça yaw ile dönüyor (varsayılan 3B eğim),
      // yani her karede biraz farklı bir projeksiyon -- tam sınırda kalan
      // çiftler bir sonraki karede yeniden çakışabiliyordu (2026-08-06
      // ölçüldü). Küçük bir tampon bunu azaltıyor (garanti değil, çünkü
      // sürekli dönen bir 3B sahnede HER açıda çakışmasızlık matematiksel
      // olarak garanti edilemez -- bkz. graph-utils.js'teki not).
      deconflictLabels(pend, nodeObstacles, { y: 10, x: 10 });
    }

    simulation.on("tick", paintPositions);

    // ------------------------------------------------------------------
    // Doğuş (FAZ 1, 2026-08-03). "O'ndan geldik"in grafiğe çevrilmiş hâli:
    // sahne Zât'ın noktasına kapalı başlar, oradan bütün haritaya açılır;
    // düğümler katman sırasına göre (tenezzül sırası: önce Zât, sonra
    // isimler, sonra âlemler...) belirir; halka ve kenarlar en sonda
    // bağlanır. Karşılama ekranının halkası sönerken tetiklenir (bkz.
    // welcome.js "dost:welcome-left"), reduced-motion'da hiç çalışmaz.
    birthFn = function runBirth() {
      if (reduceMotion) return;
      const dhat = nodeById.get("dhat");
      if (!dhat) return;
      // Görünüm açılışta 3B eğimli başlıyor (aşağıdaki "Açılışta doğrudan
      // mertebe eksenine eğ" bloğu) — Zât'ın gerçek EKRAN konumu bu yüzden
      // tx/ty değil, projeksiyondan gelen px/py. Bitişte de zoomIdentity
      // değil, sarmalı çerçeveye sığdıran dönüşüme oturuyoruz (2B/3B her
      // iki durumda da doğru olan tek hedef bu).
      const bx = dhat.px != null ? dhat.px : dhat.tx;
      const by = dhat.py != null ? dhat.py : dhat.ty;
      const startScale = 2.6;
      svg.call(zoom.transform, d3.zoomIdentity
        .translate(width / 2 - startScale * bx, height / 2 - startScale * by)
        .scale(startScale));
      svg.transition().duration(2600).ease(d3.easeCubicInOut).call(zoom.transform, computeFitTransform());

      nodes.forEach((n) => { n.__birth = 0; });
      birthRing = 0;
      const linksG = svg.select("g.links").attr("opacity", 0);
      linksG.transition().delay(1400).duration(900).attr("opacity", 1);

      const STAG = 300, DUR = 700, start = performance.now();
      function step(now) {
        const t = now - start;
        let done = true;
        nodes.forEach((n) => {
          const v = Math.max(0, Math.min(1, (t - n.layer * STAG) / DUR));
          n.__birth = v * v * (3 - 2 * v);
          if (v < 1) done = false;
        });
        birthRing = Math.max(0, Math.min(1, (t - 900) / 900));
        if (birthRing < 1) done = false;
        paintPositions();
        if (!done) {
          requestAnimationFrame(step);
        } else {
          nodes.forEach((n) => { delete n.__birth; });
          birthRing = 1;
          paintPositions();
        }
      }
      requestAnimationFrame(step);
    };

    // ---- Sakin, huzurlu salınım ----
    // Burada bilerek TAM DÖNÜŞ yapmıyoruz. Hâller ve Sırlar'da dönüş
    // zararsız: Sırlar merkezden ışıyan bir demet (yukarısı-aşağısı yok),
    // Hâller'de ise dönüş 3B'de dikey eksen etrafında olduğu için sarmal dik
    // kalıyor. Ontolojide ise DİKEY EKSEN ANLAM TAŞIYOR: Zât en üstte, en
    // yoğun mertebe (cisimler) en altta. Sahneyi tam döndürmek, bir dakika
    // sonra cisimler âlemini Zât'ın üstüne çıkarır -- yani şekil, anlattığı
    // metafiziğin tersini söylemeye başlar.
    //
    // Onun yerine çok yavaş, birkaç derecelik bir SALINIM: harita canlı ve
    // nefes alıyor gibi durur, ama "yukarısı" hep yukarıda kalır. Bir düğümün
    // detayı açıkken ve simülasyon hareketliyken (ilk yerleşme, sürükleme)
    // durur.
    const spinCenter = { x: cx3d, y: cy3d };
    let swayT = 0, spinRaf = null, spinLast = 0;
    const SWAY_PERIOD = 46000;   // bir gidiş-geliş ~46 sn
    const SWAY_DEG = 2.6;        // genlik: ±2.6 derece
    function spinFrame(ts) {
      spinRaf = null;
      if (!window.DostGraphUtils.isViewActive(ontologyWrap)) { spinLast = 0; return; }
      const dt = spinLast ? Math.min(64, ts - spinLast) : 16; spinLast = ts;

      // 2B ↔ 3B eğim animasyonu.
      if (tilt !== tiltTarget) {
        if (reduceMotion) tilt = tiltTarget;
        else {
          const p = Math.min(1, (ts - tiltAnimStart) / TILT_DUR_3D);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          tilt = tiltFrom + (tiltTarget - tiltFrom) * e;
          if (p >= 1) tilt = tiltTarget;
        }
        paintPositions();
      }
      // 3B'de sahne kendiliğinden çok yavaş döner. Dönüş DİKEY eksen
      // etrafında olduğu için "yukarısı" hep yukarıda kalır -- yani mertebe
      // iddiası bozulmaz (bu, aşağıdaki salınımın var oluş sebebiydi).
      if (tilt > 0.5) {
        if (!rotating && !reduceMotion && detailPanel.hidden) {
          yaw += dt * 0.00005;
          // Aynı kusur sway kolunda da vardı (bkz. aşağıdaki not): burada
          // hiç eşik YOKTU, paintPositions() (deconflictLabels dahil) her
          // karede koşulsuz çağrılıyordu -- sahnenin VARSAYILAN 3B açılış
          // durumunda, sonsuza dek. Tablette "sürekli titriyor" bildirimiyle
          // 2026-08-07'de ölçülüp yakalandı.
          if (Math.abs(yaw - yawPainted) > 0.3 * Math.PI / 180) {
            yawPainted = yaw;
            paintPositions();
          }
        }
        spinGroup.attr("transform", null);
        labelSel.attr("transform", null);
        spinRaf = requestAnimationFrame(spinFrame);
        return;
      }

      const busy = !detailPanel.hidden || (simulation && simulation.alpha() > 0.05);
      if (!reduceMotion && !busy) swayT += dt;
      const deg = reduceMotion ? 0 : SWAY_DEG * Math.sin((swayT / SWAY_PERIOD) * Math.PI * 2);
      spinGroup.attr("transform", `rotate(${deg.toFixed(3)},${spinCenter.x.toFixed(1)},${spinCenter.y.toFixed(1)})`);
      labelSel.attr("transform", function (d) {
        const ly = radiusFor(d) + 14;
        return `rotate(${(-deg).toFixed(3)},0,${ly.toFixed(1)})`;
      });
      // Etiket çakışma-önleme salınımın ORTASINDA (0°) hesaplanıyordu --
      // yerleşim ucunda sınırdaki çiftler yeniden çakışıyordu (2026-08-06
      // ölçüldü). swayRad'ı güncel açıya taşıyıp yerleşimi tazeliyoruz.
      // Eşik ÖNEMLİ: `deg` her karede sürekli değişen bir sinüs değeri,
      // yani "!==" neredeyse HER karede doğruydu -- paintPositions() (tüm
      // düğümler için deconflictLabels dahil) saniyede 60 kez çalışıyordu,
      // sürekli açık kalan görünümde sonsuza dek. Tablette "sürekli
      // titriyor" bildirimiyle 2026-08-07'de ölçülüp yakalandı. 0.3°'lik
      // eşik, yerleşimi hâlâ tazeliyor (yaklaşık 2,5 saniyede bir, salınımın
      // ~46 sn'lik yarı periyoduna göre) ama her kareyi tüketmiyor.
      if (Math.abs(deg - swayRad * 180 / Math.PI) > 0.3) {
        swayRad = deg * Math.PI / 180;
        paintPositions();
      }
      spinRaf = requestAnimationFrame(spinFrame);
    }
    function ensureSpin() { if (spinRaf == null) spinRaf = requestAnimationFrame(spinFrame); }
    ensureSpin();
    window.DostGraphUtils.onViewWake(ensureSpin);
    window.__ontologyEnsureSpin = ensureSpin;

    // ---- 2B ↔ 3B ----
    function setTilt(target) {
      tiltFrom = tilt; tiltTarget = target; tiltAnimStart = performance.now();
      if (target < 0.5) yaw = 0;
      // Eğim bitince çerçeveyi yeniden sığdır: sarmal düz elipsten uzun.
      setTimeout(() => {
        if (ontologyWrap.hidden) return;
        const sel = reduceMotion ? svg : svg.transition().duration(400);
        sel.call(zoom.transform, computeFitTransform());
      }, reduceMotion ? 30 : TILT_DUR_3D + 60);
      ensureSpin();
    }
    const tiltBtn = document.getElementById("ontology-3d-toggle");
    if (tiltBtn && !tiltBtn.dataset.wiredOnto3d) {
      tiltBtn.dataset.wiredOnto3d = "1";
      tiltBtn.setAttribute("aria-pressed", "false");
      tiltBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const to = tiltTarget > 0.5 ? 0 : 1;
        setTilt(to);
        tiltBtn.classList.toggle("is-on", to > 0.5);
        tiltBtn.setAttribute("aria-pressed", to > 0.5 ? "true" : "false");
      });
    }

    const confidenceBtn = document.getElementById("ontology-confidence-toggle");
    if (confidenceBtn && !confidenceBtn.dataset.wiredOntoConf) {
      confidenceBtn.dataset.wiredOntoConf = "1";
      // Varsayılan artık AÇIK (2026-08-14 karar): ilk bakışta yalnız
      // yüksek-güvenli bağlantılar tam görünür kalsın, düşükler kullanıcı
      // isterse açılsın -- index.html'deki ontology-wrap zaten
      // "confidence-on" sınıfıyla ve bu düğme "is-on"/aria-pressed=true
      // ile başlıyor, burada onu YANLIŞLIKLA sıfırlamıyoruz.
      confidenceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const on = !ontologyWrap.classList.contains("confidence-on");
        ontologyWrap.classList.toggle("confidence-on", on);
        confidenceBtn.classList.toggle("is-on", on);
        confidenceBtn.setAttribute("aria-pressed", on ? "true" : "false");
        const dimmed = links.filter((l) => l.confidence && l.confidence !== "Yüksek").length;
        showConfidenceFeedback(on, dimmed, links.length);
      });
    }

    // 3B'de boş alanı sürükleyerek döndürme (2B'de pan/zoom'a dokunmaz).
    (function wireRotateDrag() {
      const el = svg.node();
      let lastX = 0, lastY = 0;
      let dragRepaintQueued = false;
      el.addEventListener("pointerdown", (e) => {
        if (tiltTarget < 0.5) return;
        if (e.target.closest && e.target.closest(".node")) return;
        rotating = true; lastX = e.clientX; lastY = e.clientY;
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      });
      el.addEventListener("pointermove", (e) => {
        if (!rotating) return;
        yaw += (e.clientX - lastX) * 0.006;
        pitch = Math.max(0.02, Math.min(1.1, pitch + (e.clientY - lastY) * 0.004));
        lastX = e.clientX; lastY = e.clientY;
        // Aşağıdaki idle-spin kolunda (bkz. spinFrame, ~satır 1776) zaten
        // düzeltilmiş AYNI kusur -- paintPositions() (deconflictLabels
        // dahil) burada da koşulsuz çağrılıyordu. Touch'ta pointermove
        // fare hareketinden çok daha sık ve küçük artışlarla ateşleniyor;
        // her birinde çakışma-önleme yeniden koşunca eşik-yakını etiketler
        // sıçrıyordu (tablette "sürüklerken titriyor" bildirimi). rAF ile
        // tekilleştirip kare başına en fazla bir kez boyuyoruz.
        if (!dragRepaintQueued) {
          dragRepaintQueued = true;
          requestAnimationFrame(() => { dragRepaintQueued = false; paintPositions(); });
        }
      });
      const stop = (e) => {
        if (!rotating) return;
        rotating = false;
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      el.addEventListener("pointerup", stop);
      el.addEventListener("pointercancel", stop);
    })();

    paintPositions();
    svg.call(zoom.transform, computeFitTransform());

    // Açılışta doğrudan mertebe eksenine eğ (2026-07-26, kullanıcı isteği).
    // Not: bu görünümün 2B hâli daire-ve-merkez okumasını taşıyor ve
    // varsayılan 3B onu ilk bakışta gizliyor -- ama iniş de en az onun
    // kadar veride yazılı, ve tek tıkla 2B'ye dönülüyor.
    // Animasyonsuz (bkz. hal.js/esma.js/menziller.js'teki aynı not): eğim
    // morfu açılıştaki kuvvet yerleşmesiyle yarışıp ilk saniyeyi takıyor.
    if (tiltBtn) {
      tilt = 1; tiltFrom = 1; tiltTarget = 1;
      paintPositions();
      tiltBtn.classList.add("is-on");
      tiltBtn.setAttribute("aria-pressed", "true");
      setTimeout(() => {
        if (!ontologyWrap.hidden) svg.call(zoom.transform, computeFitTransform());
      }, 80);
      ensureSpin();
    }

    window.__ontologyApp = { nodes, links, nodeById, is3d: () => tiltTarget > 0.5 };

    // İlk boya @font-face yüklenmeden önce olabilir; deconflictLabels'ın
    // ölçüm önbelleği (graph-utils.js) fontlar hazır olunca kendini
    // temizliyor ama BURADA yeniden çizdirecek biri gerekiyor -- yukarıdaki
    // yaw/sway eşikleri (satır ~1775/1804) sürekli dönüşte gereksiz
    // tekrar-boyamayı önlemek için var, fakat varsayılan 3B açılışta
    // sonraki eşiği aşan kareye kadar (dakikalar sürebilir) etiketler eski
    // (fontsuz ölçülmüş) konumunda kalırdı (2026-08-07 UI denetimi: sayfa
    // ilk açıldığında hiç tıklamadan çakışan etiketler). Eşiği bir kere
    // bypass edip zorla tazeliyoruz.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => paintPositions());
    }
  }

  function pullBack(fromX, fromY, toX, toY, dist) {
    const dx = toX - fromX, dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: toX - (dx / len) * dist, y: toY - (dy / len) * dist };
  }

  // Kenarlar düğümlerin EKRAN konumunu (px/py) kullanır; 2B'de bu zaten
  // x/y'nin aynısıdır, 3B'de ise projeksiyondan gelir.
  function edgePath(d) {
    const s = d.source, t = d.target;
    const sx = s.px != null ? s.px : s.x, sy = s.py != null ? s.py : s.y;
    const txp = t.px != null ? t.px : t.x, typ = t.py != null ? t.py : t.y;
    const pad = radiusFor(t) + 2;
    if (d.kind === "descent" || d.kind === "gather") {
      const e = pullBack(sx, sy, txp, typ, pad);
      return `M${sx},${sy}L${e.x},${e.y}`;
    }
    // curved bow for "return" (bow right) and "paradox" (bow left)
    const dx = txp - sx, dy = typ - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / dist, ny = dx / dist;
    const bow = d.kind === "return" ? 90 : -70;
    const mx = (sx + txp) / 2 + nx * bow;
    const my = (sy + typ) / 2 + ny * bow;
    const e = pullBack(mx, my, txp, typ, pad);
    return `M${sx},${sy}Q${mx},${my} ${e.x},${e.y}`;
  }

  function render() {
    if (currentDetailView === "sirlar") {
      if (currentDetailSirlarId) showSirlarEntry(currentDetailSirlarId);
      else if (currentDetailSirlarMerkez) showSirlarMerkez();
      else showSirlarOverview();
    }
    if (!labelSel) return;
    labelSel.text((d) => labelFor(d));
    if (currentDetailNode) showNodeDetail(currentDetailNode);
    else if (currentDetailEdge) showEdgeDetail(currentDetailEdge);
  }

  function registerOntologyCrossLinks(data) {
    data.nodes.forEach((n) => {
      registerCrossLinkTerm(n.name, "ontoloji", n.id, n.short);
    });
    notifyCrossLinkReady();
  }

  // registerEsmaCrossLinks / registerHalCrossLinks kaldırıldı (2026-08-05):
  // hiçbir yerden çağrılmıyorlardı -- cross-link kaydı artık tümüyle
  // capraz-baglanti-indeksi.json'dan geliyor. Ölü hâlleri, kaydın hâlâ
  // görünüm verilerinden beslendiği izlenimini veriyordu.

  // --- Cross-linking between insights ---
  const crossLinkTermsByLang = { tr: [], en: [], pt: [] };
  const crossLinkSummaries = new Map();
  const crossLinkListeners = [];
  const registeredVariantKeys = new Set();

  // --- Inline glossary hints: general vocabulary (e.g. "Meşşâî") that has
  // no node of its own on the site's concept map, so it can't become a real
  // cross-link -- just a dotted-underline span with a short definition on
  // hover/focus. Data-driven (data/ibn-arabi/sozluk-ipuclari.json) so new
  // terms can be added without touching this code.
  const glossaryTermsByLang = { tr: [], en: [], pt: [] };

  function registerGlossaryTerm(id, termDict, defDict) {
    ["tr", "en", "pt"].forEach((lang) => {
      const term = termDict && termDict[lang];
      const def = defDict && defDict[lang];
      if (!term || !def) return;
      glossaryTermsByLang[lang].push({ id, term, def, folded: foldForLang(lang, term) });
    });
    invalidateGlossifyCache();
  }

  // glossify()/linkify() render on essentially every paragraph on the site
  // (see call sites in futuhat.js, and every detail-panel field elsewhere).
  // The term lists only grow over the project's lifetime ("biriken parçalar"
  // -- see CLAUDE.md), so rebuilding the sorted array + compiled regex + a
  // linear .find() per match on EVERY call would get measurably slower as
  // the corpus grows. Cache the compiled regex + a term-lookup Map per
  // language, invalidated only when new terms register or the language
  // changes (I18n.getLang() picks the current cache bucket).
  let glossifyCacheByLang = {};
  function invalidateGlossifyCache() {
    glossifyCacheByLang = {};
  }
  function buildGlossifyCache(lang) {
    const terms = glossaryTermsByLang[lang];
    if (!terms || !terms.length) return { regex: null, byFoldedLower: new Map() };
    const sorted = terms.slice().sort((a, b) => b.folded.length - a.folded.length);
    const byFoldedLower = new Map();
    sorted.forEach((t) => {
      const key = t.folded.toLowerCase();
      if (!byFoldedLower.has(key)) byFoldedLower.set(key, t);
    });
    const pattern = sorted.map((t) => `(?<![\\p{L}])${escapeRegExp(t.folded)}(?![\\p{L}])`).join("|");
    return { regex: new RegExp(pattern, "giu"), byFoldedLower };
  }
  function getGlossifyCache(lang) {
    if (!glossifyCacheByLang[lang]) glossifyCacheByLang[lang] = buildGlossifyCache(lang);
    return glossifyCacheByLang[lang];
  }

  function escapeHtmlAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Runs after linkify(), on its HTML output -- splits on existing tags so
  // it only ever touches plain-text segments, never a cross-link's own
  // content or attributes.
  function glossify(html) {
    if (!html) return html;
    const lang = I18n.getLang();
    const cache = getGlossifyCache(lang);
    if (!cache.regex) return html;
    const re = cache.regex;
    const parts = html.split(/(<[^>]+>)/);
    return parts
      .map((part) => {
        if (part.startsWith("<")) return part;
        const foldedPart = foldForLang(lang, part);
        let result = "";
        let lastIndex = 0;
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(foldedPart))) {
          const start = m.index;
          const end = start + m[0].length;
          const matchLower = m[0].toLowerCase();
          const hit = cache.byFoldedLower.get(matchLower);
          if (!hit) continue;
          const original = part.slice(start, end);
          result += part.slice(lastIndex, start);
          result += `<span class="glossary-hint" tabindex="0" data-glossary-def="${escapeHtmlAttr(hit.def)}">${original}</span>`;
          lastIndex = end;
        }
        result += part.slice(lastIndex);
        return result;
      })
      .join("");
  }

  function onCrossLinkReady(fn) {
    crossLinkListeners.push(fn);
  }

  // Registration happens across several independently-loading datasets
  // (ontoloji/esma/hal here, terimler in its own module); consumers like
  // the Fütûhât Atlas may render before all of them have arrived, so we
  // let them subscribe and re-linkify once more terms become available.
  function notifyCrossLinkReady() {
    crossLinkListeners.slice().forEach((fn) => {
      try { fn(); } catch (e) {}
    });
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Turkish sentence-case lowercases ordinary nouns ("velâyet", "akıl") even
  // when they name a registered concept ("Velâyet", "Akıl") — a plain
  // case-insensitive regex still misses these because JS's default (non-
  // Turkish-locale) casing folds İ/I to i/ı differently than Turkish does.
  // Fold both sides through the same Turkish-specific rule before matching.
  // EN/PT keep exact-case matching -- folding those too would turn ordinary
  // lowercase words (many registered term names are plain English/Portuguese
  // nouns, e.g. "Patience", "Certainty") into unwanted auto-links wherever
  // they appear in running prose, not just where they name the concept.
  function foldForLang(lang, s) {
    return lang === "tr"
      ? s.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
      : s;
  }

  // Now that linkify() matches case-insensitively (see below), a handful of
  // older glossary titles are themselves plain, everyday English/Portuguese
  // words/phrases used as a gloss ("Reason", "Cause", "Species", "The Heart",
  // "Certainty", "The Essence", "The First", "The Last") rather than a
  // distinctive technical name. Registered as-is, these would auto-link
  // every ordinary occurrence of that common word throughout running prose,
  // regardless of whether that occurrence has anything to do with the
  // concept.
  //
  // 2026-07-28: bunlar önce TAMAMEN kayıt dışı bırakılıyordu; o da ters
  // yönde bir kayıp üretiyordu -- Türkçede "Akıl"/"zât" çapraz-link olurken
  // İngilizce sayfada aynı yerde hiç link olmuyordu (kullanıcı notu:
  // "türkçede olan bir çapraz link ingilizce sayfada ... linki unutulmuş").
  // Artık kayıttan düşürmek yerine `strict` işaretleniyor: EN/PT'de bu
  // adlar YALNIZCA kayıtlı hâliyle birebir yazıldığında ("The Light")
  // linklenir, cümle içinde sıradan kelime olarak geçtiğinde ("the light
  // of faith") linklenmez. Böylece hem yanlış-pozitifler kalkıyor hem de
  // metin gerçekten kavramı adlandırdığında link geri geliyor.
  const GENERIC_VARIANT_BLOCKLIST = new Set([
    "reason", "cause", "causa", "razão", "species", "espécie",
    "the one", "o um", "a um", "o único",
    "the first", "o primeiro", "a primeira",
    "the last", "o último", "a última",
    "the heart", "o coração",
    "certainty", "certeza",
    "the essence", "a essência",
    "difference", "diferença",
    "effect", "efeito",
    "the soul", "a alma",
    "the visible", "o visível",
    "struggle", "esforço",
    "majesty", "majestade",
    // "The Outward (al-Zahir)" ailesi: burada parantez içi TERİMİN KENDİSİ
    // (transliterasyon), çıplak hâli ise sıradan İngilizce/Portekizce. Yani
    // aşağıdaki parantez kuralının tersi bir şekil; elle listelemek gerekti.
    // Ölçülen zarar: "he stands in the outward of a good work" → al-Zahir.
    "the outward", "o exterior",
    "the inward", "o interior",
    "the limit", "o limite",
    "the rising-place", "o lugar do nascer",
  ]);

  // Esmâ adlarının parantez içi açıklamaları ("er-Rahmân" → "Ar-Rahman (The
  // All-Merciful)") ayrı bir eşleşme varyantı olarak kaydediliyor ve bunlar
  // EN/PT'de artikelle başlayan sıradan ifadeler oluyor ("The Light",
  // "O Senhor", "The Living"). Ölçtüğümüz somut zarar: bir kısımda EN
  // cross-link'lerin TAMAMI bu türden yanlış-pozitifti -- "the light of
  // faith" en-Nûr'a, "the great" el-Kebîr'e linkleniyordu.
  //
  // Kural bilerek DAR tutuldu: yalnız *parantez içinden gelen* ve artikelle
  // başlayan varyantlar strict. Bütün artikelli adları strict yapmayı
  // denedik ve fazla geniş çıktı -- "the veil"/"o véu" gibi bu külliyatta
  // gerçekten kavramı adlandıran, istenen linkler de sustu (ölçüldü:
  // beş kısımda EN link sayısı 3→0'a düştü).
  const ARTICLE_PREFIX_RE = /^(the|os|as|um|uma|o|a) /i;
  function isStrictVariant(lang, v, fromParen) {
    if (lang === "tr") return false;
    if (GENERIC_VARIANT_BLOCKLIST.has(v.toLowerCase())) return true;
    return !!fromParen && ARTICLE_PREFIX_RE.test(v);
  }

  // The >=4-char rule below exists to keep short, ordinary words from
  // becoming accidental links (see GENERIC_VARIANT_BLOCKLIST above for the
  // opposite problem). A few short titles are genuinely distinctive
  // technical/religious terms with no everyday-word collision risk in any
  // of the three languages -- without this allowlist they'd be unlinkable
  // from prose no matter how often they're used (confirmed zero cross-links
  // for "Amâ"/"Arş" across all 22 Fütûhât parts despite heavy use). "Zât"
  // joins them for the same reason -- its EN/PT names ("The Essence"/"A
  // Essência") are already generic-blocked above, so only the TR form needs
  // the allowlist to become linkable.
  const SHORT_TERM_ALLOWLIST = new Set(["amâ", "arş", "zât"]);

  function registerCrossLinkTerm(nameDict, view, id, summaryDict) {
    if (!nameDict) return;
    ["tr", "en", "pt"].forEach((lang) => {
      const term = nameDict[lang];
      if (!term) return;
      const variants = new Set();
      const parenVariants = new Set();   // hangi varyant parantez içinden geldi (bkz. isStrictVariant)
      if (term.length >= 4 || SHORT_TERM_ALLOWLIST.has(term.toLowerCase())) variants.add(term);
      // Many titles carry a parenthetical gloss ("Vâcib (Vâcibü'l-Vücûd)",
      // "Bedel (Ebdal)") or an Arabic article prefix ("el-Kâdir", "es-Semî'");
      // register the bare form AND the parenthetical's own content as
      // separate variants, so ordinary running prose using either name
      // ("Vâcib" or "Vâcibü'l-Vücûd", "Bedel" or "Ebdal") still resolves to
      // the same concept.
      const parenMatch = term.match(/^(.*?)\s*\((.*)\)\s*$/);
      const noParen = (parenMatch ? parenMatch[1] : term).trim();
      if (noParen.length >= 4 || SHORT_TERM_ALLOWLIST.has(noParen.toLowerCase())) variants.add(noParen);
      if (parenMatch) {
        const parenContent = parenMatch[2].trim();
        if (parenContent.length >= 4) { variants.add(parenContent); parenVariants.add(parenContent); }
      }
      const noPrefix = noParen.replace(/^(el|er|es)-/i, "").trim();
      if (noPrefix.length >= 4 || SHORT_TERM_ALLOWLIST.has(noPrefix.toLowerCase())) variants.add(noPrefix);
      variants.forEach((v) => {
        const strict = isStrictVariant(lang, v, parenVariants.has(v));
        // The same concept sometimes exists as a near-identical entry in two
        // datasets (e.g. "Zât"/"The Essence" is both ontology.json's "dhat"
        // and esma.json's "zat"). Registering both under the same name
        // would silently make one shadow the other with no clear winner
        // documented anywhere; keep only the first registration for a given
        // name so the choice is explicit and doesn't grow the match list
        // with an entry that could never actually be reached.
        const dedupeKey = lang + ":" + v.toLowerCase();
        if (registeredVariantKeys.has(dedupeKey)) return;
        registeredVariantKeys.add(dedupeKey);
        crossLinkTermsByLang[lang].push({ term: v, view, id, strict });
      });
    });
    if (summaryDict) crossLinkSummaries.set(view + ":" + id, summaryDict);
    invalidateLinkifyCache();
  }

  // Same rationale/cache shape as glossify()'s cache above -- see comment there.
  let linkifyCacheByLang = {};
  function invalidateLinkifyCache() {
    linkifyCacheByLang = {};
  }
  function buildLinkifyCache(lang) {
    const terms = crossLinkTermsByLang[lang].map((t) => ({ ...t, folded: foldForLang(lang, t.term) }));
    terms.sort((a, b) => b.folded.length - a.folded.length);
    if (!terms.length) return { regex: null, byFoldedLower: new Map() };
    const byFoldedLower = new Map();
    terms.forEach((t) => {
      const key = t.folded.toLowerCase();
      if (!byFoldedLower.has(key)) byFoldedLower.set(key, t);
    });
    const pattern = terms.map((t) => `(?<![\\p{L}])${escapeRegExp(t.folded)}(?![\\p{L}])`).join("|");
    return { regex: new RegExp(pattern, "giu"), byFoldedLower };
  }
  function getLinkifyCache(lang) {
    if (!linkifyCacheByLang[lang]) linkifyCacheByLang[lang] = buildLinkifyCache(lang);
    return linkifyCacheByLang[lang];
  }

  function getCrossLinkSummary(view, id) {
    const dict = crossLinkSummaries.get(view + ":" + id);
    return dict ? I18n.pick3(dict) : null;
  }

  function linkify(text, excludeView, excludeId) {
    if (!text) return text;
    const lang = I18n.getLang();
    const cache = getLinkifyCache(lang);
    if (!cache.regex) return glossify(text);
    // Case-insensitive ("i" flag) for every language, not just Turkish's own
    // fold: English/Portuguese running prose commonly lowercases a technical
    // term mid-sentence ("the pole of the age") even though the glossary
    // registers it title-case ("Pole") for display -- without this, those
    // terms would only ever link when capitalized exactly as registered.
    const re = cache.regex;
    re.lastIndex = 0;
    const foldedText = foldForLang(lang, text);
    const seen = new Set();
    let result = "";
    let lastIndex = 0;
    let m;
    while ((m = re.exec(foldedText))) {
      const start = m.index;
      const end = start + m[0].length;
      const matchLower = m[0].toLowerCase();
      const hit = cache.byFoldedLower.get(matchLower);
      if (!hit) continue;
      const original = text.slice(start, end);
      // `strict` varyantlar (EN/PT'de artikelle başlayan ya da sıradan
      // kelime olan adlar) yalnız birebir yazıldığında linklenir --
      // "The Light" evet, "the light of faith" hayır. Bkz. isStrictVariant().
      if (hit.strict && original !== hit.term) {
        result += text.slice(lastIndex, start) + original;
        lastIndex = end;
        continue;
      }
      // excludeView/excludeId used to be filtered out of the term list
      // before building the regex (a node never links to its own detail
      // page); the shared cache now matches against ALL terms and skips
      // creating the link here instead. Equivalent in every case except one
      // rare corner: if the excluded term is itself a longer match that
      // fully contains a shorter, different registered term at the same
      // starting position, that inner term is no longer picked up (the
      // longer alternative wins and gets suppressed, rather than the
      // shorter one being tried) -- accepted as negligible given how rare a
      // self-referencing name containing another exact term is in practice.
      const isSelf = hit.view === excludeView && hit.id === excludeId;
      result += text.slice(lastIndex, start);
      if (isSelf) {
        result += original;
      } else {
        const key = hit.view + ":" + hit.id;
        if (seen.has(key)) {
          result += original;
        } else {
          seen.add(key);
          result += `<a href="${ROUTE_BASE}/${hit.view}/${hit.id}" class="cross-link" data-view="${hit.view}" data-id="${hit.id}">${original}</a>`;
        }
      }
      lastIndex = end;
    }
    result += text.slice(lastIndex);
    return glossify(result);
  }

  window.__dostCrossLink = {
    linkify,
    register: registerCrossLinkTerm,
    getSummary: getCrossLinkSummary,
    onReady: onCrossLinkReady,
    notifyReady: notifyCrossLinkReady,
  };

  const SIRLAR_THEME_LABELS = {
    "suskunluk": { tr: "Suskunluk ve Perdeleme", en: "Silence and Veiling", pt: "Silêncio e Velamento" },
    "peygamber-kissalari": { tr: "Peygamber Kıssalarındaki Sırlar", en: "Secrets in the Prophets' Stories", pt: "Segredos nas Histórias dos Profetas" },
    "kader-tevhid": { tr: "Kader, Tevhid, Tenzih-Teşbih", en: "Destiny, Divine Unity, Tanzih-Tashbih", pt: "Destino, Unidade Divina, Tanzih-Tashbih" },
    "dil-ve-kelime": { tr: "Dilde ve Kelimede Gizlenen Sırlar", en: "Secrets Hidden in Language and Words", pt: "Segredos Ocultos na Língua e nas Palavras" },
    "insan-i-kamil": { tr: "İnsan-ı Kâmil ve Velâyet", en: "The Perfect Human and Sainthood", pt: "O Ser Humano Perfeito e a Santidade" },
  };

  // Sırlar grafiğinin merkez düğümüne (kök) tıklanınca, tek bir sırra değil,
  // bölümün "işaret eder, açıklamaz" duruşuna dair bir genel bakış gösterilir
  // -- Sorular'ın kategori özetine, Terimler'in "Tümü" görünümüne benzer şekilde.
  function showSirlarOverview() {
    currentDetailView = "sirlar";
    currentDetailSirlarId = null;
    currentDetailSirlarMerkez = false;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "İşaret Edilen, Açıklanmayan", en: "Pointed To, Not Explained", pt: "Apontado, Não Explicado" })}</p>
      <h2 class="detail-title">${tt({ tr: "Sırlar", en: "Mysteries", pt: "Mistérios" })}</h2>
      <p class="detail-resonance">${sirlarData ? I18n.pick3(sirlarData.intro) : ""}</p>
      ${sirlarGestureDiagramHtml()}
    `;
    detailPanel.hidden = false;
  }
  window.__sirlarShowOverview = showSirlarOverview;

  // Bir sır düğümüne tıklanınca (grafikten veya deep-link'ten), diğer bütün
  // görünümlerle (Ontoloji/Esmâ/Hâller/Sorular) tutarlı şekilde tek, odaklı
  // bir kart gösterilir -- eski, bütün sırları tek accordion listesinde
  // döken görünüm yerine.
  // Bir sır kaydı, kısım-kısım okuma turlarımızın birinden çıktıysa, o
  // kısma geri götüren bir bağ veriyoruz -- kayıt böylece havada durmuyor,
  // hangi okumada karşımıza çıktığı görülebiliyor.
  function sirlarOkumaHtml(entry) {
    if (!entry.okuma || !entry.okuma.view || !entry.okuma.id) return "";
    const href = `${ROUTE_BASE}/${entry.okuma.view}/${entry.okuma.id}`;
    const label = tt({
      tr: "Bu satırları hangi okumada bulduk",
      en: "The reading round where we found these lines",
      pt: "A ronda de leitura em que encontrámos estas linhas",
    });
    return `<a class="cross-link" href="${href}" data-view="${entry.okuma.view}" data-id="${entry.okuma.id}">${label} →</a>`;
  }

  // "Bağımsız kaynak" rozeti (2026-08-02). `iliskiliKayitlar`, aynı motifin
  // başka kitaplarda bağımsız olarak tekrar ettiğini gösteren sirlar
  // kayıtlarının id'lerini taşır -- ilke 3'ün ("parçaları biriktir, bütüne
  // dair fikir üret") somut bir eşiği: iddia değil, SAYI (kaç bağımsız
  // kaynakta göründüğü). "Kanıtlandı" demiyoruz, yalnız kaç kez bağımsız
  // olarak karşımıza çıktığını gösteriyoruz.
  function bagimsizKaynakBadgeHtml(entry) {
    const ids = entry.iliskiliKayitlar;
    if (!ids || !ids.length || !sirlarData) return "";
    const siblings = ids.map((id) => sirlarData.entries.find((e) => e.id === id)).filter(Boolean);
    if (!siblings.length) return "";
    const total = siblings.length + 1;
    const title = tt({
      tr: `Bu motifi ${total} bağımsız kaynakta bağımsız olarak buluyoruz`,
      en: `We find this motif independently in ${total} independent sources`,
      pt: `Encontramos este motivo de forma independente em ${total} fontes independentes`,
    });
    const links = siblings.map((s) => {
      const href = `${ROUTE_BASE}/sirlar/${s.id}`;
      return `<a class="cross-link cross-link--kucuk" href="${href}" data-view="sirlar" data-id="${s.id}">${volumeLabel(s.volume)}</a>`;
    }).join("");
    return `<div class="detail-block detail-block--bagimsiz-kaynak">
      <p class="detail-eyebrow">${title}</p>
      <div class="bagimsiz-kaynak__list">${links}</div>
    </div>`;
  }

  // Sırlar grafiğinin merkezi artık bölümün adını değil, okumalarımızın
  // bizi getirdiği "sırların sırrı" önerisini taşıyor. Panelde bilerek bir
  // sonuç gibi değil, gerekçesi ve çekinceleriyle birlikte duruyor.
  // "Perde nedir?" halkası: merkez panelinin altında duran, üç iç içe
  // halkadan oluşan bir şema. Kayıtlar dıştan içe doğru okunur -- dışta
  // perde araya giren başka bir şey, ortada iki taraftan birinin kendisi,
  // merkezde örten ile örtülen aynı. Sıra bir zaman sırası DEĞİL; bunu
  // veri tarafındaki `caption`/`cekince` metinleri de açıkça söylüyor.
  //
  // Neden yalnız 16 kayıt: 2026-07-28 denetiminde (research/anlayis-evrimi/
  // PERDE_DENETIM.md) sayfadaki 30 perde kaydının üç ayrı soruya cevap
  // verdiği görüldü. Tek eksene dizilebilen yalnız "perde nedir" grubu.
  const HALKA_R = [148, 96, 46];   // dış / orta / merkez yarıçapları
  const HALKA_VB = 340;            // çizim alanının kenarı (kare)
  const HALKA_BUYUK = 1.85;        // lightbox'taki büyütme katsayısı
  // Etiket payı (2026-07-29). Dış halkanın etiketi merkezden 168 birim
  // uzağa yazılıyor; 340'lık kare viewBox'ta bu tam kenara denk geliyordu
  // ve en sağdaki etiket (`text-anchor:start`) kutunun DIŞINA taşıyordu.
  // Eskiden bu `overflow: visible` ile "çözülmüştü" -- yani etiket
  // kırpılmıyordu ama lightbox'ta yanındaki anahtar listesinin üstüne
  // biniyordu (kullanıcı bildirimi: 417 ile 418 iç içe girmiş görünüyor).
  // Doğru çözümü viewBox'a pay eklemek: etiketler kutunun İÇİNDE kalıyor,
  // hiçbir şeyin üstüne binemiyor.
  const HALKA_PAD_X = 46;
  const HALKA_PAD_Y = 12;

  // buyuk=true: lightbox sürümü. Yalnız ölçek değişiyor -- etiketler yine
  // sadece bölüm numarası. Kayıt adlarını halkanın üstüne radyal olarak
  // yazmayı denedik: TR/EN/PT'de uzunluklar çok farklı ve PT'de etiketler
  // komşu halkanın çizgisini kesiyordu. Onun yerine büyük sürümün altına
  // tam bir anahtar listesi konuyor (halkaLightbox).
  function halkaSvg(halka, buyuk) {
    const k = buyuk ? HALKA_BUYUK : 1;
    const VBW = (HALKA_VB + 2 * HALKA_PAD_X) * k;
    const VBH = (HALKA_VB + 2 * HALKA_PAD_Y) * k;
    const cx = VBW / 2;
    const cy = VBH / 2;
    const rings = halka.rings || [];
    let out = "";

    // Halkalar: dıştan içe, en dıştaki kesik çizgili (sınırı en belirsiz olan).
    rings.forEach((ring, ri) => {
      const cls = ri === 0 ? "sir-halka__ring sir-halka__ring--dashed" : "sir-halka__ring";
      out += `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${(HALKA_R[ri] * k).toFixed(1)}"/>`;
    });

    // Merkez dolgusu -- Zât/kök ile aynı ailede dursun diye vurgulu.
    out += `<circle class="sir-halka__core" cx="${cx}" cy="${cy}" r="${((HALKA_R[2] - 6) * k).toFixed(1)}"/>`;

    rings.forEach((ring, ri) => {
      const r = HALKA_R[ri] * k;
      const n = ring.entries.length;
      ring.entries.forEach((e, i) => {
        // -90°'den başlayıp saat yönünde: okuma üstten başlasın.
        const a = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        const label = I18n.pick3(e.label);
        const bolumAdi = tt({ tr: `${e.bolum}. Bölüm`, en: `Chapter ${e.bolum}`, pt: `Capítulo ${e.bolum}` });
        const title = `${bolumAdi} — ${label}\n${I18n.pick3(e.quote)}`;
        // Etiket, düğümün merkezden dışa doğru olan tarafına yazılır ki
        // iç halkaların etiketleri dış halkanın üstüne binmesin.
        const off = (ri === 0 ? 20 : 17) * k;
        const lx = cx + (r + off) * Math.cos(a);
        const ly = cy + (r + off) * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.25 ? "middle" : (Math.cos(a) > 0 ? "start" : "end");
        // Küçük sürüm bir <button> içinde duruyor; düğümleri de odaklanabilir
        // yapmak butonun içine etkileşimli içerik koymak olurdu (geçersiz HTML
        // ve klavyede tuzak). Orada odak butonun kendisinde, düğümler yalnız
        // ipucu taşıyor; büyük sürümde ise tek tek gezilebiliyorlar.
        out += `<g class="sir-halka__node sir-halka__node--r${ri}"${buyuk ? ' tabindex="0" role="listitem"' : ""}
                   aria-label="${escapeHtmlAttr(title.replace(/\n/g, " — "))}">
            <title>${escapeHtmlAttr(title)}</title>
            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${((ri === 2 ? 9 : 7) * k).toFixed(1)}"/>
            <text x="${lx.toFixed(1)}" y="${(ly + 3.5 * k).toFixed(1)}" text-anchor="${anchor}"
                  style="font-size:${(10 * k).toFixed(1)}px">${escapeHtmlAttr(e.bolum)}</text>
          </g>`;
      });
    });

    const merkezLabel = rings[2] ? I18n.pick3(rings[2].label) : "";
    return `<svg class="sir-halka__svg${buyuk ? " sir-halka__svg--buyuk" : ""}" viewBox="0 0 ${VBW} ${VBH}" role="list"
                 aria-label="${escapeHtmlAttr(merkezLabel)}">${out}</svg>`;
  }

  // Lightbox: büyük halka + altında tam anahtar listesi. Küçük sürümde
  // düğümlerin yanında yalnız bölüm numarası var; burada her numaranın
  // karşılığı ve alıntısı da okunabiliyor.
  function halkaLightboxHtml(halka) {
    const key = halka.rings.map((ring, ri) => `
      <div class="sir-halka__key-group sir-halka__key-group--r${ri}">
        <h4>${escapeHtmlAttr(I18n.pick3(ring.label))}
          <span class="sir-halka__legend-count">${ring.entries.length}</span></h4>
        <ul>${ring.entries.map((e) => `
          <li><span class="sir-halka__key-no">${escapeHtmlAttr(e.bolum)}</span>
            <span class="sir-halka__key-label">${escapeHtmlAttr(I18n.pick3(e.label))}</span>
            <em>${escapeHtmlAttr(I18n.pick3(e.quote))}</em></li>`).join("")}</ul>
      </div>`).join("");
    // Kendi sarmalayıcısı şart: `.cizim-lightbox__svg-wrap` bir flex SATIRI
    // ve iki kardeşi (svg + anahtar listesi) yan yana diziyordu -- tablet
    // genişliğinde liste sıkışıp metni kırpılıyordu (2026-07-29). Bu
    // sarmalayıcı onları tasarlandığı gibi alt alta koyuyor.
    return `<div class="sir-halka__lightbox">${halkaSvg(halka, true)}
        <div class="sir-halka__key">${key}</div></div>`;
  }

  function openHalkaLightbox() {
    const halka = sirlarData && sirlarData.merkez && sirlarData.merkez.halka;
    if (!halka || !window.DostLightbox) return;
    window.dostTrack && window.dostTrack("sema_acildi", { type: "perde-halkasi" });
    window.DostLightbox.open({
      closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
      name: tt({ tr: "Perde nedir? — on yedi kayıt", en: "What is the veil? — seventeen records", pt: "O que é o véu? — dezassete registos" }),
      svgHtml: halkaLightboxHtml(halka),
      caption: tt({
        tr: "Halkalar dıştan içe okunur. Sıra bir zaman sırası değil.",
        en: "The rings are read from the outside in. The order is not chronological.",
        pt: "Os anéis leem-se de fora para dentro. A ordem não é cronológica.",
      }),
    });
  }

  // Küçük halkaya tıklama/Enter: büyük sürümü aç. Düğümlerin kendi
  // odaklanabilirliği korunuyor -- oradan Enter da lightbox'ı açıyor,
  // çünkü asıl istenen şey büyük görüntü.
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest(".sir-halka__figure")) openHalkaLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const fig = e.target.closest && e.target.closest(".sir-halka__figure");
    if (!fig) return;
    e.preventDefault();
    openHalkaLightbox();
  });

  function halkaHtml(halka) {
    if (!halka || !halka.rings || halka.rings.length !== 3) return "";
    const legend = halka.rings.map((ring, ri) => `
      <li class="sir-halka__legend-item sir-halka__legend-item--r${ri}">
        <strong>${I18n.pick3(ring.label)}</strong>
        <span class="sir-halka__legend-count">${ring.entries.length}</span>
        <p>${linkify(I18n.pick3(ring.note), null, null)}</p>
      </li>`).join("");
    return `
      <div class="detail-block sir-halka">
        <p class="detail-eyebrow">${tt({ tr: "Perde nedir? — on yedi kaydın halkası", en: "What is the veil? — a ring of seventeen records", pt: "O que é o véu? — um anel de dezassete registos" })}</p>
        <p class="sir-halka__caption">${linkify(I18n.pick3(halka.caption), null, null)}</p>
        <button type="button" class="sir-halka__figure"
                aria-label="${escapeHtmlAttr(tt({ tr: "Halkayı büyüt", en: "Enlarge the ring", pt: "Ampliar o anel" }))}">
          ${halkaSvg(halka)}
          <span class="sir-halka__zoom-hint">${tt({ tr: "Büyütmek için dokun", en: "Tap to enlarge", pt: "Toque para ampliar" })}</span>
        </button>
        <ul class="sir-halka__legend">${legend}</ul>
        <p class="sir-halka__cekince">${linkify(I18n.pick3(halka.cekince), null, null)}</p>
      </div>`;
  }

  function showSirlarMerkez() {
    if (!sirlarData || !sirlarData.merkez) return;
    const m = sirlarData.merkez;
    currentDetailView = "sirlar";
    currentDetailSirlarId = null;
    currentDetailSirlarMerkez = true;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Sırların sırrı", en: "The secret of the secrets", pt: "O segredo dos segredos" })}</p>
      <h2 class="detail-title">${I18n.pick3(m.topic)}</h2>
      <div class="detail-block detail-block--sir">
        <blockquote>${I18n.pick3(m.quote)}</blockquote>
        <p>${linkify(I18n.pick3(m.note), null, null)}</p>
        <cite>${m.source}</cite>
      </div>
      ${halkaHtml(m.halka)}
    `;
    detailPanel.hidden = false;
  }
  window.__sirlarShowMerkez = showSirlarMerkez;

  function showSirlarEntry(id) {
    if (!sirlarData) return;
    const entry = sirlarData.entries.find((e) => e.id === id);
    if (!entry) return;
    currentDetailView = "sirlar";
    currentDetailSirlarId = id;
    currentDetailSirlarMerkez = false;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(SIRLAR_THEME_LABELS[entry.theme] || { tr: "Sırlar", en: "Mysteries", pt: "Mistérios" })}</p>
      <h2 class="detail-title">${volumeLabel(entry.volume)} — ${I18n.pick3(entry.topic)}</h2>
      <div class="detail-block detail-block--sir">
        <blockquote>${I18n.pick3(entry.quote)}</blockquote>
        <p>${linkify(I18n.pick3(entry.note), null, null)}</p>
        <cite>${entry.source}</cite>
      </div>
      ${bagimsizKaynakBadgeHtml(entry)}
      <div id="sir-derin-icerik"></div>
      ${sirlarSorularHtml(entry)}
      ${sirlarOkumaHtml(entry)}
    `;
    detailPanel.hidden = false;
    derinIcerikCiz(id);
    // Köprü verisi geç gelirse paneli tazele.
    if (!sirlarSorularVeri) sirlarSorularYukle().then((k) => {
      if (k && currentDetailSirlarId === id) showSirlarEntry(id);
    });
  }

  // KADEMELİ AÇILIM (G15). data/icerik/<id>.json bir sır kaydının DERİN
  // katmanı: aynı sırrın üç yoğunlukta yazılmış hâli (ozet/giris/govde).
  // Her sır için yok -- şu an yalnız üçünde var, gerisi elle yazılacak.
  //
  // Önce _index.json okunuyor: onsuz tek seçenek her sır tıklamasında bir
  // fetch deneyip 404 yutmak olurdu (99 kayıt, konsol dolusu 404).
  let derinIndeks = null;
  let derinIndeksSozu = null;
  const derinOnbellek = new Map();

  function derinIndeksYukle() {
    if (derinIndeks) return Promise.resolve(derinIndeks);
    if (!derinIndeksSozu) {
      derinIndeksSozu = window.DostGraphUtils.fetchJson("data/icerik/_index.json")
        .then((d) => { derinIndeks = new Set((d && d.idler) || []); return derinIndeks; })
        .catch(() => { derinIndeks = new Set(); return derinIndeks; });
    }
    return derinIndeksSozu;
  }

  function derinIcerikCiz(id) {
    derinIndeksYukle().then((indeks) => {
      if (!indeks.has(id) || currentDetailSirlarId !== id) return;
      const yerlestir = (kayit) => {
        // Panel bu arada başka bir kayda geçmiş olabilir.
        if (!kayit || currentDetailSirlarId !== id) return;
        const kap = document.getElementById("sir-derin-icerik");
        if (!kap || !window.__dostKademe) return;
        kap.innerHTML = `<p class="detail-eyebrow detail-eyebrow--section">${tt({
          tr: "Daha yakından", en: "A closer look", pt: "Mais de perto" })}</p>`;
        window.__dostKademe.kur(kap, { ozet: kayit.ozet, giris: kayit.giris, govde: kayit.govde });
      };
      if (derinOnbellek.has(id)) { yerlestir(derinOnbellek.get(id)); return; }
      window.DostGraphUtils.fetchJson(`data/icerik/${id}.json`)
        .then((kayit) => { derinOnbellek.set(id, kayit); yerlestir(kayit); })
        .catch(() => { /* kayıt okunamadıysa panel eskisi gibi kalsın */ });
    });
  }

  // SIRLAR -> SORULAR köprüsü (2026-08-03). sorular.js'teki aynı bağların
  // ters yönü: bir sır kaydının hangi açık soruya dokunduğu. Bağlar ELLE
  // kuruldu ve gerekçesiyle birlikte duruyor -- bkz.
  // data/ibn-arabi/sirlar-sorular.json'un `not` alanı.
  let sirlarSorularVeri = null;
  const soruBaslik = new Map();
  function sirlarSorularYukle() {
    if (sirlarSorularVeri) return Promise.resolve(sirlarSorularVeri);
    return Promise.all([
      window.DostGraphUtils.fetchJson("data/ibn-arabi/sirlar-sorular.json"),
      window.DostGraphUtils.fetchJson("data/ibn-arabi/sorular.json"),
    ]).then(([k, sor]) => {
      sirlarSorularVeri = k;
      (sor.categories || []).forEach((c) =>
        (c.questions || []).forEach((q) => soruBaslik.set(q.id, q.question)));
      return k;
    }).catch(() => null);
  }
  function sirlarSorularHtml(entry) {
    if (!sirlarSorularVeri) return "";
    const bag = (sirlarSorularVeri.baglar || []).filter((b) => b.sir === entry.id);
    if (!bag.length) return "";
    const base = window.__dostRouteBase || "";
    const satir = bag.map((b) => {
      const q = soruBaslik.get(b.soru);
      if (!q) return "";
      return `<a class="sorular-sir" href="${base}/sorular/${b.soru}" data-view="sorular" data-id="${b.soru}">
        <span class="sorular-sir__baslik">${I18n.pick3(q)}</span>
        <span class="sorular-sir__neden">${I18n.pick3(b.neden)}</span></a>`;
    }).join("");
    if (!satir) return "";
    return `<div class="sorular-sirlar">
      <p class="detail-eyebrow detail-eyebrow--section">${tt({
        tr: "Bu sırrın dokunduğu açık sorular",
        en: "Open questions this mystery touches",
        pt: "Perguntas abertas que este mistério toca" })}</p>
      <p class="sorular-sirlar__not">${tt({
        tr: "Bu bağları biz kurduk; sır soruyu cevaplamıyor, çoğu zaman onun neden açık kaldığını gösteriyor.",
        en: "We made these links ourselves; the mystery does not answer the question — more often it shows why it stays open.",
        pt: "Fizemos estes vínculos nós mesmos; o mistério não responde à pergunta — mais frequentemente mostra por que ela permanece aberta." })}</p>
      ${satir}</div>`;
  }

  const RADIUS_BY_ID = {
    // Bu grafiğin kendi otomatik-yakınlaştırma ölçeği (~0.96) esma.js'in
    // ölçeğinden (~0.61) farklı olduğu için, esma.js/esma-3d.js'teki Zât
    // düğümünün ham r değeri kasıtlı olarak burada değil (54/65) --
    // ekranda EŞİT piksel boyutu getBoundingClientRect ile ampirik olarak
    // eşitlendi, ham değerler eşit olduğu için değil (bkz. esma.js
    // radiusFor()'daki not).
    "dhat": 34,
    "sifat-asma": 15,
    "ayan-sabite": 14,
    "tecelli": 14,
    "insan-i-kamil": 18,
    "kalp": 16,
  };

  function radiusFor(d) {
    return RADIUS_BY_ID[d.id] || 13;
  }

  const LAYER_COLOR = window.DostGraphUtils.LAYER_COLOR;
  const LAYER_COLOR_DARK = window.DostGraphUtils.LAYER_COLOR_DARK;

  function isDark() {
    return window.DostGraphUtils.isDark();
  }

  function colorFor(d) {
    if (d.id === "dhat") return window.DostGraphUtils.ZAT_FILL;
    if (d.id === "insan-i-kamil") return getVar("--series-daphne");
    if (d.id === "kalp") return getVar("--series-theme");
    const ramp = isDark() ? LAYER_COLOR_DARK : LAYER_COLOR;
    return ramp[Math.min(d.layer, ramp.length - 1)];
  }

  function getVar(name) {
    return window.DostGraphUtils.getVar(name);
  }

  function labelFor(d) {
    return I18n.pick3(d.name);
  }

  function highlight(d) {
    if (!d) {
      pathSel.classed("link--highlight", false);
      nodeSel.style("opacity", 1);
      return;
    }
    const connected = new Set([d.id]);
    pathSel.each((l) => {
      if (l.source.id === d.id) connected.add(l.target.id);
      if (l.target.id === d.id) connected.add(l.source.id);
    });
    pathSel.classed("link--highlight", (l) => l.source.id === d.id || l.target.id === d.id);
    nodeSel.style("opacity", (n) => (connected.has(n.id) ? 1 : 0.3));
  }

  function highlightEdge(d) {
    pathSel.classed("link--highlight", (l) => l === d);
    nodeSel.style("opacity", (n) => (n.id === d.source.id || n.id === d.target.id ? 1 : 0.3));
  }

  function showTooltip(d, event) {
    if (!tooltip) return;
    const short = I18n.pick3(d.short);
    tooltip.innerHTML = `
      <div class="node-hover-tip__title">${I18n.pick3(d.name)}</div>
      ${short ? `<div class="node-hover-tip__short">${short}</div>` : ""}
    `;
    tooltip.hidden = false;
    moveTooltip(event);
  }

  // Kenar önizlemesi (#10): tıklamayla açılan kenar panelinin küçültülmüş
  // hâli -- ilişkinin adı, iki ucu, gerekçesinin ilk cümlesi ve (kesin
  // saymadığımız yerlerde) güven etiketimiz. Odakla da açılıyor.
  function edgeConfidenceText(c) {
    if (!c || c === "Yüksek") return "";
    const label = CONFIDENCE_LABEL[c] || { tr: c, en: c, pt: c };
    return tt({ tr: "Güvenimiz: ", en: "Our confidence: ", pt: "Nossa confiança: " }) + tt(label);
  }

  function showEdgeTooltip(l, event) {
    if (!tooltip) return;
    tooltip.innerHTML = window.DostGraphUtils.edgeReasonHtml({
      title: I18n.pick3(l.source.name) + " → " + I18n.pick3(l.target.name),
      kindLabel: I18n.pick3(l.relation),
      reason: I18n.pick3(l.nature),
      confidence: edgeConfidenceText(l.confidence),
    });
    tooltip.hidden = false;
    if (event && typeof event.clientX === "number") moveTooltip(event);
    else positionTooltipOnEdge(l);
  }

  // Klavyeyle gelindiğinde imleç konumu yok; ipucu kenarın orta noktasına
  // konuyor (SVG koordinatı -> ekran koordinatı, zoom/eğim dahil).
  function positionTooltipOnEdge(l) {
    const pathNode = pathSel && pathSel.nodes().find((n) => d3.select(n).datum() === l);
    if (!pathNode) return;
    const box = pathNode.getBoundingClientRect();
    moveTooltip({ clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 });
  }

  function edgeAriaLabel(l) {
    return I18n.pick3(l.source.name) + " → " + I18n.pick3(l.target.name)
      + " — " + I18n.pick3(l.relation);
  }

  function moveTooltip(event) {
    window.DostGraphUtils.moveTooltip(tooltip, wrapEl, event);
  }

  function hideTooltip() {
    window.DostGraphUtils.hideTooltip(tooltip);
  }

  let currentDetailNode = null;
  let currentDetailEdge = null;
  let currentDetailView = null;
  let currentDetailSirlarId = null;
  // Merkez paneli açıkken dil değişirse yeniden çizilebilsin diye.
  let currentDetailSirlarMerkez = false;

  // Esmâ/Hâller/Sorular/Sırlar'ın hepsi bir düğüme gidildiğinde ekranı
  // ona doğru yumuşakça kaydırıyor (reduceMotion'a duyarlı); Ontoloji --
  // sitenin en çok kullanılan görünümü -- bu tutarlılıktan yoksundu,
  // düğüme tıklamak sadece detay panelini açıyordu. Mevcut yakınlaştırma
  // seviyesini koruyarak sadece merkezi düğüme kaydırıyor (diğer
  // görünümlerin "bir kutuya sığdır" davranışının aksine, burada tek bir
  // nokta var, sığdırılacak bir kutu değil).
  function panToNode(d) {
    const oz = window.__ontologyZoom;
    if (!oz || typeof d.tx !== "number" || typeof d.ty !== "number") return;
    const svgEl = oz.svg.node();
    const width = svgEl.clientWidth || 800;
    const height = svgEl.clientHeight || 600;
    const currentScale = d3.zoomTransform(svgEl).k;
    // 3B'de düğüm hedef konumunda (tx/ty) değil, projeksiyonun verdiği
    // ekran konumundadır -- oraya odaklan.
    const in3d = window.__ontologyApp && window.__ontologyApp.is3d && window.__ontologyApp.is3d();
    const fx = in3d && typeof d.px === "number" ? d.px : d.tx;
    const fy = in3d && typeof d.py === "number" ? d.py : d.ty;
    const transform = d3.zoomIdentity
      .translate(width / 2 - currentScale * fx, height / 2 - currentScale * fy)
      .scale(currentScale);
    const sel = reduceMotion ? oz.svg : oz.svg.transition().duration(400);
    sel.call(oz.zoom.transform, transform);
  }

  function onNodeClick(d) {
    window.dostTrack && window.dostTrack("bilgi_grafi_node_tiklandi", { id: d.id });
    currentDetailNode = d;
    currentDetailEdge = null;
    currentDetailView = null;
    showNodeDetail(d);
    updateHash("ontoloji", d.id);
    panToNode(d);
    dugumDavranisi(d);
  }

  // ---------------------------------------------------------------------
  // ANLAM TAŞIYAN ANİMASYON (#2, 2026-08-03)
  //
  // GORSEL_DIL.md: "kavramı resmetme, onun davranışını resmet." Bu ilke
  // bugüne kadar tek tek sahnelerde (ayna, perde, iki mertebe) uygulanmıştı;
  // ana grafiğin KENDİ etkileşiminde uygulanmamıştı: her düğüme tıklamak
  // aynı şeyi yapıyordu (panel açılır, kamera kayar), oysa bu düğümlerin
  // hepsi FARKLI şeyler yapan kavramlar.
  //
  // Aşağıdaki beş davranışın hiçbiri süs değil; her biri o düğümün kendi
  // tanımından çıkıyor ve sitede zaten yazılı olan bir kenar/ilişki türünü
  // hareket olarak gösteriyor:
  //   dhat          -> tecellî: ışık Zât'tan bütün mertebelere yayılıyor
  //                   (descent kenarları, tenezzül sırasıyla)
  //   kalp          -> rücû: aynı yol TERS yönde, kalpten Zât'a
  //                   (ontology.json'daki `return` kenarı: kalp -> dhat)
  //   insan-i-kamil -> cem': üç âlemin ışığı onda toplanıyor
  //                   (üç `gather` kenarı)
  //   teceddud      -> halk-ı cedîd: bütün düğümler bir an sönüp yeniden
  //                   yanıyor -- âlem her an yeniden yaratılıyor
  //   perde         -> perdelenme: sahne bir an bulanıp açılıyor
  //
  // reduced-motion'da HİÇBİRİ çalışmaz (taklit de edilmez).
  const DUGUM_DAVRANISI = {
    dhat: "yayil",
    kalp: "rucu",
    "insan-i-kamil": "topla",
    teceddud: "teceddud",
    perde: "perde",
  };
  let davranisTimer = null;

  function dugumDavranisi(d) {
    if (reduceMotion || !pathSel || !nodeSel) return;
    const tur = DUGUM_DAVRANISI[d.id];
    if (!tur) return;
    if (davranisTimer) { clearTimeout(davranisTimer); davranisTimer = null; }
    if (tur === "teceddud") return teceddudEt();
    if (tur === "perde") return perdelen();
    // Yayılmanın görülebilmesi için bütün harita ekranda olmalı; tıklamanın
    // olağan yakınlaşması (panToNode) sahneyi ekran dışında bırakıyordu.
    // Kamera oturduktan SONRA ışık yola çıkıyor.
    if (window.__ontologyZoom && window.__ontologyZoom.fit) window.__ontologyZoom.fit(true);
    davranisTimer = setTimeout(() => yayilimEt(d.id, tur), reduceMotion ? 0 : 540);
  }

  // Kenar boyunca ilerleyen bir ışık. Yolun kendi geometrisini
  // (getPointAtLength) izliyor -- düz bir çizgi değil, kenarın gerçek yayı.
  function kivilcim(pathNode, gecikme, sure, ters) {
    const uzunluk = pathNode.getTotalLength ? pathNode.getTotalLength() : 0;
    if (!uzunluk) return;
    const parent = pathNode.parentNode;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("class", "onto-kivilcim");
    c.setAttribute("r", "4.5");
    c.setAttribute("opacity", "0");
    parent.appendChild(c);
    const bas = performance.now() + gecikme;
    function adim(t) {
      const p = (t - bas) / sure;
      if (p < 0) { requestAnimationFrame(adim); return; }
      if (p >= 1) { c.remove(); return; }
      const nokta = pathNode.getPointAtLength((ters ? 1 - p : p) * uzunluk);
      c.setAttribute("cx", nokta.x);
      c.setAttribute("cy", nokta.y);
      // Uçlarda sönük, ortada parlak: bir geçiş, bir varış değil.
      c.setAttribute("opacity", Math.sin(p * Math.PI).toFixed(3));
      requestAnimationFrame(adim);
    }
    requestAnimationFrame(adim);
  }

  function komsuluk() {
    const ileri = new Map(), geri = new Map();
    (window.__ontologyApp.links || []).forEach((l) => {
      const s = l.source.id, t = l.target.id;
      if (!ileri.has(s)) ileri.set(s, []);
      if (!geri.has(t)) geri.set(t, []);
      ileri.get(s).push(l);
      geri.get(t).push(l);
    });
    return { ileri, geri };
  }

  function pathFor(l) {
    return pathSel.nodes().find((n) => d3.select(n).datum() === l);
  }

  // Kaynaktan dalga dalga yayılma. `tur`:
  //   yayil -> kenarların kendi yönünde (tenezzül)
  //   rucu  -> ters yönde, kaynağa doğru (dönüş)
  //   topla -> kaynağa GİREN kenarlar boyunca içeri (cem')
  function yayilimEt(kaynakId, tur) {
    const { ileri, geri } = komsuluk();
    const ADIM = 320, SURE = 620;
    const gorulen = new Set([kaynakId]);
    let kat = [kaynakId], derinlik = 0;
    while (kat.length && derinlik < 8) {
      const sonraki = [];
      kat.forEach((id) => {
        const kenarlar = (tur === "yayil" ? (ileri.get(id) || []) : (geri.get(id) || []));
        kenarlar.forEach((l) => {
          const p = pathFor(l);
          if (p) kivilcim(p, derinlik * ADIM, SURE, tur !== "yayil");
          const oteki = tur === "yayil" ? l.target.id : l.source.id;
          if (!gorulen.has(oteki)) { gorulen.add(oteki); sonraki.push(oteki); }
        });
      });
      // "topla" tek adımlık: üç âlemin ışığı doğrudan İnsân-ı Kâmil'e girer,
      // zincirleme bir yayılma değil.
      if (tur === "topla") break;
      kat = sonraki;
      derinlik++;
    }
    // Işık geçerken düğümler sırayla parlıyor -- yalnız çizgi değil, varış
    // da görünsün.
    let i = 0;
    gorulen.forEach((id) => {
      const el = nodeSel.nodes().find((n) => d3.select(n).datum().id === id);
      if (!el) return;
      const gecikme = i * 90;
      i++;
      setTimeout(() => {
        el.classList.add("node--isik");
        setTimeout(() => el.classList.remove("node--isik"), 700);
      }, gecikme);
    });
  }

  // Halk-ı cedîd: âlem her an yeniden yaratılıyor. Bütün düğümler kısa bir
  // an sönüp yeniden yanıyor -- aynı düğümler, yeni bir yaratılışta.
  function teceddudEt() {
    nodeSel.nodes().forEach((el, i) => {
      setTimeout(() => {
        el.classList.add("node--teceddud");
        setTimeout(() => el.classList.remove("node--teceddud"), 620);
      }, (i % 6) * 70);
    });
  }

  // Perdelenme: sahne bir an bulanıp açılıyor. Perde bir halka değil, bir
  // süreçtir (GORSEL_DIL.md).
  function perdelen() {
    const kat = document.querySelector("#graph g.zoom-layer");
    if (!kat) return;
    kat.classList.add("onto-perdeli");
    davranisTimer = setTimeout(() => kat.classList.remove("onto-perdeli"), 1150);
  }

  function onEdgeClick(l) {
    currentDetailNode = null;
    currentDetailEdge = l;
    currentDetailView = null;
    showEdgeDetail(l);
    updateHash("ontoloji", "edge/" + l.source.id + "-" + l.target.id);
  }

  const VOLUME_LABEL_OVERRIDE = {
    "fusus-konuk": { tr: "Füsûsu'l-Hikem", en: "Fusus al-Hikam", pt: "Fusus al-Hikam" },
    "fukuk-konevi": { tr: "Fusûsu'l-Hikem'in Sırları (Konevî)", en: "The Secrets of the Fusus (Qunawi)", pt: "Os Segredos do Fusus (Qunawi)" },
    "izutsu-anahtar": { tr: "Anahtar-Kavramlar (İzutsu)", en: "Key Concepts (Izutsu)", pt: "Conceitos-Chave (Izutsu)" },
    "affifi-tasavvuf": { tr: "Tasavvuf Felsefesi (Affifi)", en: "The Mystical Philosophy (Affifi)", pt: "A Filosofia Mística (Affifi)" },
    "varlik-agaci": { tr: "Varlık Ağacı (Şeceretü'l-Kevn)", en: "The Tree of Being (Shajarat al-Kawn)", pt: "A Árvore do Ser (Shajarat al-Kawn)" },
    "ozun-ozu": { tr: "Özün Özü (Lübbü'l-Lübb)", en: "The Kernel of the Kernel (Lubb al-Lubb)", pt: "O Cerne do Cerne (Lubb al-Lubb)" },
    "tedbirat-konuk": { tr: "et-Tedbîrâtü'l-İlâhiyye (Konuk)", en: "et-Tadbirat al-Ilahiyya (Konuk)", pt: "et-Tadbirat al-Ilahiyya (Konuk)" },
    "risaleler-1": { tr: "İbn Arabî'nin Risaleleri, 1. Cild", en: "The Epistles of Ibn Arabi, Vol. 1", pt: "As Epístolas de Ibn Arabi, Vol. 1" },
    "risaleler-2": { tr: "İbn Arabî'nin Risaleleri, 2. Cild", en: "The Epistles of Ibn Arabi, Vol. 2", pt: "As Epístolas de Ibn Arabi, Vol. 2" },
    "el-bulga": { tr: "El-Bülga fi'l-Hikme", en: "Al-Bulgha fi'l-Hikma", pt: "Al-Bulgha fi'l-Hikma" },
  };

  function volumeLabel(n) {
    if (VOLUME_LABEL_OVERRIDE[n]) return tt(VOLUME_LABEL_OVERRIDE[n]);
    return tt({ tr: `Cilt ${n}`, en: `Volume ${n}`, pt: `Volume ${n}` });
  }

  const VOLUME_SOURCE_MATCH = {
    "fusus-konuk": "Fusûsu'l-Hikem Tercüme ve Şerhi (Ahmed Avni Konuk)",
    "fukuk-konevi": "El-Fükük fi Esrâr-ı Müstenidât-ı Hikemi'l-Fusûs (Sadreddin Konevî",
    "izutsu-anahtar": "İbn Arabî'nin Fusûsu'ndaki Anahtar-Kavramlar (Toshihiko İzutsu",
    "affifi-tasavvuf": "Muhyiddîn İbnü'l-Arabî'nin Tasavvuf Felsefesi (A. E. Affifi",
    "varlik-agaci": "Şeceretü'l-Kevn / Varlık Ağacı",
    "tedbirat-konuk": "et-Tedbîrâtü'l-İlâhiyye",
    "ozun-ozu": "Özün Özü / Lübbü'l-Lübb",
    "risaleler-1": "İbn Arabî'nin Risaleleri, 1. Cild",
    "risaleler-2": "İbn Arabî'nin Risaleleri, 2. Cild",
    "el-bulga": "El-Bülga fi'l-Hikme",
  };

  function sourcesForInsight(ins, sources) {
    // ins.source iki biçimde geliyor: düz metin ya da {tr,en,pt}. İkincisi
    // pick3'ten geçirilmezse kaynakça satırında "[object Object]" basıyordu
    // (2026-07-29'da sifat-asma düğümünde görüldü). Kenar içgörülerinde
    // `sources` dizisi hiç verilmediği için tek kaynak yolu burasıdır.
    if (ins.source) {
      return [typeof ins.source === "string" ? ins.source : I18n.pick3(ins.source)];
    }
    if (!sources || !sources.length) return [];
    const v = ins.volume;
    if (typeof v === "number") {
      const re = new RegExp(`Cilt ${v}\\b`);
      return sources.filter((s) => re.test(s));
    }
    if (VOLUME_SOURCE_MATCH[v]) {
      return sources.filter((s) => s.includes(VOLUME_SOURCE_MATCH[v]));
    }
    return [];
  }

  function insightsHtml(insights, sources, excludeView, excludeId) {
    if (!insights || !insights.length) return "";
    return `<div class="insight-group">${insights.map((ins, i) => {
      const cite = sourcesForInsight(ins, sources);
      return `
      <details class="insight" ${i === 0 ? "open" : ""}>
        <summary>${volumeLabel(ins.volume)}</summary>
        <p>${linkify(I18n.pick3(ins.text), excludeView, excludeId)}</p>
        ${cite.length ? `<cite>${cite.join(" · ")}</cite>` : ""}
      </details>
    `;
    }).join("")}</div>`;
  }

  // Ortak: graph-utils.js (dört görünümde kopyalanmıştı).
  const analogyHtml = (a) => window.DostGraphUtils.analogyHtml(a);

  function showNodeDetail(d) {
    const metadataHtml = window.__graphEnhancement
      ? (() => {
          const meta = window.__graphEnhancement.getMetadata(d.id);
          if (!meta) return "";
          return `<div class="detail-block detail-block--metadata">
            <p class="detail-metadata__category">${meta.category}</p>
            <p class="detail-metadata__meaning">${meta.meaning}</p>
          </div>`;
        })()
      : "";

    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Varlık Mertebesi", en: "Level of Being", pt: "Nível do Ser" })}</p>
      <h2 class="detail-title">${I18n.pick3(d.name)}</h2>
      ${metadataHtml}
      <div class="detail-block detail-block--ibnarabi">
        <h3>${I18n.pick3(d.short)}</h3>
        <p>${linkify(I18n.pick3(d.summary), "ontoloji", d.id)}</p>
      </div>
      ${analogyHtml(d.analogy)}
      ${entityDiagramHtml(d)}
      ${insightsHtml(d.insights, d.sources, "ontoloji", d.id)}
      ${gateHtml(d)}
      ${sahneHtml(d)}
      ${relatedEdgesHtml(d)}
    `;
    detailPanel.hidden = false;
    wireGate(d);
    wireEntityDiagram(d);
    if (nodeSel) nodeSel.classed("node--active", (n) => n.id === d.id);
  }

  // KAPILAR (FAZ 2b) — bkz. ETKILESIM_DILI.md: "geçiş dekor değil,
  // dönüşümdür." Ontoloji'nin bazı düğümlerinin sitede kendi haritası var;
  // "Esmâ-i Hüsnâ ve Sıfat" düğümü ile Esmâ görünümü aynı şeyin iki
  // çözünürlüğü. Tıklama sözleşme gereği yalnız paneli açıyor (habersiz
  // gezinme yok); geçiş buradaki ADI KONMUŞ kapıdan oluyor.
  const GATES = {
    "sifat-asma": {
      view: "esma",
      label: {
        tr: "Yüz bir ismin haritasına gir",
        en: "Enter the map of the hundred and one Names",
        pt: "Entre no mapa dos cento e um Nomes",
      },
      note: {
        tr: "Bu düğüm bir liste değil, bir kapı: aynı beliriş, orada tek tek isimler olarak açılıyor.",
        en: "This node is not a list but a door: the same self-determination opens there as the Names one by one.",
        pt: "Este nó não é uma lista, mas uma porta: a mesma autodeterminação se abre ali como os Nomes, um a um.",
      },
    },
  };

  function gateHtml(d) {
    const g = GATES[d.id];
    if (!g) return "";
    return `<div class="detail-gate">
      <p class="detail-gate__note">${tt(g.note)}</p>
      <button class="detail-gate__btn" type="button" data-gate="${d.id}">${tt(g.label)}
        <span class="detail-gate__arrow" aria-hidden="true">→</span></button>
    </div>`;
  }

  // Bazı düğümlerin, SPA rotalamasının DIŞINDA duran (docs/icerik-yol-
  // haritasi.md D1/D2/D5 gibi) bağımsız bir "sahne" sayfası var --
  // halk-i-cedid.html teceddüd'ün ta kendisi. 2026-08-04 taramasında bu tür
  // sayfaların hiçbirinin siteden gerçekten LİNKLENMEDİĞİ (yetim olduğu)
  // ölçüldü; burası düğümün kendi davranışıyla (teceddudEt()) zaten aynı
  // fikri taşıdığı için en doğru bağlama noktası. GATES'ten farklı: bu bir
  // SPA-içi dönüşüm değil, ayrı bir sayfaya düz bir bağlantı -- bu yüzden
  // aynı görsel dili (.detail-gate) taşıyan ama <a href> kullanan ayrı bir
  // fonksiyon.
  const SAHNELER = {
    teceddud: {
      href: "halk-i-cedid.html",
      label: {
        tr: "Sahneyi aç: Halk-ı Cedîd",
        en: "Open the scene: Perpetual Renewal",
        pt: "Abrir a cena: Renovação Perpétua",
      },
      note: {
        tr: "Bu düğümün tıklanınca yaptığı şey (bütün düğümlerin bir an sönüp yeniden yanması) burada tek başına, yavaşça sürüklenebilen bir sahneye açılıyor.",
        en: "What this node does when clicked (every node flickering out and relighting) opens here on its own, as a scene you can slowly drag through.",
        pt: "O que este nó faz ao ser clicado (todos os nós apagando e reacendendo por um instante) se abre aqui sozinho, como uma cena que você pode arrastar lentamente.",
      },
    },
  };
  function sahneHtml(d) {
    const s = SAHNELER[d.id];
    if (!s) return "";
    const base = window.__dostRouteBase || "";
    return `<div class="detail-gate detail-gate--sahne">
      <p class="detail-gate__note">${tt(s.note)}</p>
      <a class="detail-gate__btn" href="${base}/${s.href}">${tt(s.label)}
        <span class="detail-gate__arrow" aria-hidden="true">→</span></a>
    </div>`;
  }

  function wireGate(d) {
    const btn = detailContent.querySelector(".detail-gate__btn");
    if (!btn) return;
    const g = GATES[btn.dataset.gate];
    if (!g) return;
    btn.addEventListener("click", () => {
      // Kapı düğümünün ekrandaki dairesi: dönüşüm oradan başlıyor.
      let rect = null, renk = null;
      if (nodeSel) {
        const el = nodeSel.nodes().find((n) => d3.select(n).datum().id === d.id);
        const circle = el && el.querySelector("circle");
        if (circle) {
          rect = circle.getBoundingClientRect();
          renk = getComputedStyle(circle).fill;
        }
      }
      window.DostGraphUtils.gateTransition(
        { fromRect: rect, color: renk, targetEl: document.getElementById(g.view + "-wrap") },
        () => { setMainView(g.view); updateHash(g.view); }
      );
    });
  }

  function relatedEdgesHtml(d) {
    const outgoing = window.__ontologyApp.links.filter((l) => l.source.id === d.id);
    const incoming = window.__ontologyApp.links.filter((l) => l.target.id === d.id);
    const rows = [...outgoing.map((l) => ({ l, dir: "out" })), ...incoming.map((l) => ({ l, dir: "in" }))];
    if (!rows.length) return "";
    const items = rows.map(({ l, dir }) => {
      const other = dir === "out" ? l.target : l.source;
      const arrow = dir === "out" ? "→" : "←";
      return `<div class="detail-block detail-block--edge">
        <h3>${arrow} ${I18n.pick3(other.name)} — <em>${I18n.pick3(l.relation)}</em></h3>
        ${confidenceNoteHtml(l.confidence)}
        <p>${linkify(I18n.pick3(l.nature), null, null)}</p>
        ${insightsHtml(l.insights, null, null, null)}
      </div>`;
    }).join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlişkiler", en: "Relations", pt: "Relações" })}</p>${items}`;
  }

  function showEdgeDetail(l) {
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${I18n.pick3(l.relation)}</p>
      <h2 class="detail-title">${I18n.pick3(l.source.name)} → ${I18n.pick3(l.target.name)}</h2>
      ${confidenceNoteHtml(l.confidence)}
      ${entityDiagramHtml(l)}
      <div class="detail-block detail-block--ibnarabi">
        <p>${linkify(I18n.pick3(l.nature), null, null)}</p>
        ${insightsHtml(l.insights, null, null, null)}
      </div>
    `;
    detailPanel.hidden = false;
    wireEntityDiagram(l);
    if (nodeSel) nodeSel.classed("node--active", false);
  }

  function drag(sim) {
    return window.DostGraphUtils.createDragBehavior(sim);
  }
})();
