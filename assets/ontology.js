(function () {
  "use strict";

  const I18n = window.DostI18n;

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

  function tt(dict) {
    return I18n.pick3(dict);
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
      ${renderer(obj.diagram)}
      <p class="term-diagram-caption">${tt(obj.diagram.note)}</p>
    </div></div>`;
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
    else if (currentMainView === "futuhat") window.__futuhatApp && window.__futuhatApp.onLangChange();
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

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    // Bir adım geri: önce açık detay panelini kapat; panel zaten kapalıysa
    // ve Sırlar grafiğinde bir tema odaklanmışsa (bkz. sirlar-graph.js
    // focusOnTheme), o odağı geri al -- "mevcut durumdan bir önceki duruma."
    if (!detailPanel.hidden) {
      detailPanel.hidden = true;
      return;
    }
    if (window.__sirlarGraphApp && window.__sirlarGraphApp.isFocused && window.__sirlarGraphApp.isFocused()) {
      window.__sirlarGraphApp.unfocusTheme();
    }
  });

  // Lejant kutuları (Ontoloji/Esmâ/Hâller/Sırlar), özellikle dokunmatik/
  // tablet ekranlarda kısa viewport yüksekliğinde grafiğin üstüne düşüp
  // düğümleri kapatabiliyor -- varsayılan olarak kısık/dokunmatik
  // ekranlarda katlanmış başlasın, kullanıcı isterse açsın.
  function setupLegendToggles() {
    const collapseByDefault = window.matchMedia("(max-height: 700px)").matches
      || window.matchMedia("(pointer: coarse)").matches;
    document.querySelectorAll(".legend").forEach((legend) => {
      const toggle = legend.querySelector(".legend__toggle");
      if (!toggle) return;
      if (collapseByDefault) {
        legend.classList.add("legend--collapsed");
        toggle.setAttribute("aria-expanded", "false");
      }
      toggle.addEventListener("click", () => {
        const collapsed = legend.classList.toggle("legend--collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
      });
    });
  }
  setupLegendToggles();

  const TARGET = {
    "dhat": { x: 0.5, y: 0.09 },
    "sifat-asma": { x: 0.5, y: 0.21 },
    "ayan-sabite": { x: 0.5, y: 0.33 },
    "tecelli": { x: 0.5, y: 0.45 },
    "alem-ervah": { x: 0.20, y: 0.60 },
    "alem-misal": { x: 0.5, y: 0.60 },
    "alem-ecsam": { x: 0.80, y: 0.60 },
    "insan-i-kamil": { x: 0.5, y: 0.75 },
    "kalp": { x: 0.5, y: 0.90 },
  };

  function loadOntologyData() {
    if (window.DostViewStatus) window.DostViewStatus.showLoading("ontology-wrap");
    fetch("data/ibn-arabi/ontology.json")
      .then((r) => r.json())
      .then((data) => {
        buildGraph(data);
        registerOntologyCrossLinks(data);
        parseHashAndGo();
        window.__dostAppReady = true;
        if (window.DostViewStatus) window.DostViewStatus.hide("ontology-wrap");
      })
      .catch((err) => {
        console.error("Ontoloji verisi yüklenemedi / Failed to load ontology data", err);
        if (window.DostViewStatus) window.DostViewStatus.showError("ontology-wrap", loadOntologyData);
      });
  }
  loadOntologyData();

  // Bu üç veri seti yalnızca cross-link kaydı için gerekli; kritik olan
  // ontoloji haritasının ilk boyanmasıyla bant genişliği için yarışmasınlar
  // diye ana iş parçacığı boşta kalınca (veya en geç kısa bir gecikmeyle)
  // çekiliyor.
  const deferFetch = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));

  let sirlarData = null;
  deferFetch(() => {
    fetch("data/ibn-arabi/sirlar.json")
      .then((r) => r.json())
      .then((data) => {
        sirlarData = data;
        if (pendingSirlarId) goToSirlar(pendingSirlarId);
        render();
      })
      .catch((err) => console.error("Sırlar verisi yüklenemedi / Failed to load mysteries data", err));
  });

  deferFetch(() => {
    fetch("data/ibn-arabi/esma.json")
      .then((r) => r.json())
      .then((data) => {
        registerEsmaCrossLinks(data);
        render();
      })
      .catch((err) => console.error("Esmâ verisi yüklenemedi / Failed to load Esma data", err));
  });

  deferFetch(() => {
    fetch("data/ibn-arabi/hal.json")
      .then((r) => r.json())
      .then((data) => {
        registerHalCrossLinks(data);
        render();
      })
      .catch((err) => console.error("Hâller verisi yüklenemedi / Failed to load States data", err));
  });

  let currentMainView = "ontology";
  const ontologyBtn = document.getElementById("ontology-btn");
  const esmaBtn = document.getElementById("esma-btn");
  const halBtn = document.getElementById("hal-btn");
  const terimlerBtn = document.getElementById("terimler-btn");
  const cizimlerBtn = document.getElementById("cizimler-btn");
  const sirlarBtn = document.getElementById("sirlar-btn");
  const sorularBtn = document.getElementById("sorular-btn");
  const futuhatBtn = document.getElementById("futuhat-btn");
  const hakkindaBtn = document.getElementById("hakkinda-btn");
  const ontologyWrap = document.getElementById("ontology-wrap");
  const esmaWrap = document.getElementById("esma-wrap");
  const halWrap = document.getElementById("hal-wrap");
  const terimlerWrap = document.getElementById("terimler-wrap");
  const cizimlerWrap = document.getElementById("cizimler-wrap");
  const sirlarWrap = document.getElementById("sirlar-wrap");
  const sorularWrap = document.getElementById("sorular-wrap");
  const futuhatWrap = document.getElementById("futuhat-wrap");
  const hakkindaWrap = document.getElementById("hakkinda-wrap");

  function setMainView(view) {
    if (currentMainView === view) return;
    currentMainView = view;
    if (ontologyBtn) ontologyBtn.classList.toggle("btn-ghost--active", view === "ontology");
    if (esmaBtn) esmaBtn.classList.toggle("btn-ghost--active", view === "esma");
    if (halBtn) halBtn.classList.toggle("btn-ghost--active", view === "hal");
    if (terimlerBtn) terimlerBtn.classList.toggle("btn-ghost--active", view === "terimler");
    if (cizimlerBtn) cizimlerBtn.classList.toggle("btn-ghost--active", view === "cizimler");
    if (sirlarBtn) sirlarBtn.classList.toggle("btn-ghost--active", view === "sirlar");
    if (sorularBtn) sorularBtn.classList.toggle("btn-ghost--active", view === "sorular");
    if (futuhatBtn) futuhatBtn.classList.toggle("btn-ghost--active", view === "futuhat");
    if (hakkindaBtn) hakkindaBtn.classList.toggle("btn-ghost--active", view === "hakkinda");
    if (ontologyWrap) ontologyWrap.hidden = view !== "ontology";
    if (esmaWrap) esmaWrap.hidden = view !== "esma";
    if (halWrap) halWrap.hidden = view !== "hal";
    if (terimlerWrap) terimlerWrap.hidden = view !== "terimler";
    if (cizimlerWrap) cizimlerWrap.hidden = view !== "cizimler";
    if (sirlarWrap) sirlarWrap.hidden = view !== "sirlar";
    if (sorularWrap) sorularWrap.hidden = view !== "sorular";
    if (futuhatWrap) futuhatWrap.hidden = view !== "futuhat";
    if (hakkindaWrap) hakkindaWrap.hidden = view !== "hakkinda";
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
    } else if (view === "futuhat") {
      currentDetailView = null;
      window.__futuhatApp && window.__futuhatApp.activate();
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
  if (futuhatBtn) futuhatBtn.addEventListener("click", () => { setMainView("futuhat"); updateHash("futuhat"); });
  if (hakkindaBtn) hakkindaBtn.addEventListener("click", () => { setMainView("hakkinda"); updateHash("hakkinda"); });

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
    hakkinda: {
      title: { tr: "Dost Arabî Hakkında", en: "About Dost Arabi", pt: "Sobre Dost Arabi" },
      desc: {
        tr: "Dost Arabî projesinin ve Muhyiddîn İbnü'l-Arabî'nin kısaca tanıtıldığı sayfa.",
        en: "A page briefly introducing the Dost Arabi project and Muhyiddin Ibn Arabi.",
        pt: "Uma página que apresenta brevemente o projeto Dost Arabi e Muhyiddin Ibn Arabi.",
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
      pendingSirlarId = id || null;
      return;
    }
    pendingSirlarId = null;
    if (!id) return;
    showSirlarEntry(id);
  }

  function goToSorular(id) {
    setMainView("sorular");
    window.__sorularApp && window.__sorularApp.goToNode(id);
  }

  function goToFutuhat(id) {
    setMainView("futuhat");
    window.__futuhatApp && window.__futuhatApp.activate(id);
  }

  function goToHakkinda() {
    setMainView("hakkinda");
  }

  function parseHashAndGo() {
    const rawPath = location.pathname.slice(ROUTE_BASE.length) || "/";
    const m = /^\/(ontoloji|esma|sirlar|hal|terimler|cizimler|sorular|futuhat|hakkinda)(?:\/(.+))?\/?$/.exec(rawPath);
    if (!m) return;
    const [, view, id] = m;
    updateMeta(view);
    if (view === "ontoloji") goToOntologyNode(id);
    else if (view === "esma") goToEsma(id);
    else if (view === "sirlar") goToSirlar(id);
    else if (view === "hal") goToHal(id);
    else if (view === "terimler") goToTerimler(id);
    else if (view === "cizimler") goToCizimler();
    else if (view === "sorular") goToSorular(id);
    else if (view === "futuhat") goToFutuhat(id);
    else if (view === "hakkinda") goToHakkinda();
  }

  window.addEventListener("popstate", parseHashAndGo);

  // Site içi tüm gezinme #/view yerine gerçek /view yollarını kullanıyor
  // (bkz. 404.html) — bu yüzden linkify()'ın ürettiği <a class="cross-link">
  // etiketleri artık gerçek path'lere işaret ediyor. Tıklama tam sayfa
  // yenilemesi tetiklemesin diye burada yakalayıp SPA içi yönlendirmeye
  // çeviriyoruz; yeni sekmede aç / orta tık gibi tarayıcı varsayılanlarını
  // bozmamak için değiştirici tuş basılıysa dokunmuyoruz.
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest("a.cross-link");
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
      else if (view === "futuhat") goToFutuhat(id);
      else if (view === "hakkinda") goToHakkinda();
      updateHash(view, id);
    },
    setHash: updateHash,
  };

  let simulation, nodeSel, pathSel, labelSel, nodeById;

  function buildGraph(data) {
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;

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
    });

    simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(120).strength(0.15))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("x", d3.forceX((d) => d.tx).strength(0.85))
      .force("y", d3.forceY((d) => d.ty).strength(0.85))
      .force("collide", d3.forceCollide().radius((d) => radiusFor(d) + 44));

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");

    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 4])
      .filter((event) => {
        if (event.type === "wheel") return event.ctrlKey || event.metaKey;
        if (event.touches) return event.touches.length > 1;
        return !event.target.closest(".node");
      })
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform));

    svg.call(zoom).on("dblclick.zoom", null);
    window.__ontologyZoom = { svg, zoom };

    const recenterBtn = document.getElementById("ontology-recenter");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", () => {
        svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
      });
    }

    const linkGroup = zoomLayer.append("g").attr("class", "links");

    pathSel = linkGroup
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", (d) => "link link--" + d.kind)
      .attr("marker-end", (d) => "url(#arrow-" + (d.kind === "gather" ? "descent" : d.kind) + ")")
      .attr("fill", "none")
      .on("mouseenter", (event, d) => highlightEdge(d))
      .on("mouseleave", () => highlight(null))
      .on("click", (event, d) => onEdgeClick(d));

    const nodeGroup = zoomLayer.append("g").attr("class", "nodes");

    nodeSel = nodeGroup
      .selectAll("g.node")
      .data(nodes)
      .join("g")
      .attr("class", "node ontology-node")
      .attr("tabindex", "0")
      .attr("role", "button")
      .attr("aria-label", (d) => labelFor(d))
      .call(drag(simulation))
      .on("click", (event, d) => onNodeClick(d))
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onNodeClick(d);
        }
      })
      .on("mouseenter", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", () => { highlight(null); hideTooltip(); })
      .on("focus", (event, d) => { highlight(d); showTooltip(d, event); })
      .on("blur", () => { highlight(null); hideTooltip(); });

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
      .attr("dy", (d) => radiusFor(d) + 14)
      .attr("text-anchor", "middle")
      .text((d) => labelFor(d));

    simulation.on("tick", () => {
      pathSel.attr("d", (d) => edgePath(d));
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    window.__ontologyApp = { nodes, links, nodeById };
  }

  function pullBack(fromX, fromY, toX, toY, dist) {
    const dx = toX - fromX, dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: toX - (dx / len) * dist, y: toY - (dy / len) * dist };
  }

  function edgePath(d) {
    const s = d.source, t = d.target;
    const pad = radiusFor(t) + 2;
    if (d.kind === "descent" || d.kind === "gather") {
      const e = pullBack(s.x, s.y, t.x, t.y, pad);
      return `M${s.x},${s.y}L${e.x},${e.y}`;
    }
    // curved bow for "return" (bow right) and "paradox" (bow left)
    const dx = t.x - s.x, dy = t.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / dist, ny = dx / dist;
    const bow = d.kind === "return" ? 90 : -70;
    const mx = (s.x + t.x) / 2 + nx * bow;
    const my = (s.y + t.y) / 2 + ny * bow;
    const e = pullBack(mx, my, t.x, t.y, pad);
    return `M${s.x},${s.y}Q${mx},${my} ${e.x},${e.y}`;
  }

  function render() {
    if (currentDetailView === "sirlar") {
      if (currentDetailSirlarId) showSirlarEntry(currentDetailSirlarId);
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

  function registerEsmaCrossLinks(data) {
    data.nodes.forEach((n) => {
      registerCrossLinkTerm(n.name, "esma", n.id, n.short);
    });
    notifyCrossLinkReady();
  }

  function registerHalCrossLinks(data) {
    data.nodes.forEach((n) => {
      registerCrossLinkTerm(n.name, "hal", n.id, n.short);
    });
    notifyCrossLinkReady();
  }

  // --- Cross-linking between insights ---
  const crossLinkTermsByLang = { tr: [], en: [], pt: [] };
  const crossLinkSummaries = new Map();
  const crossLinkListeners = [];

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

  function registerCrossLinkTerm(nameDict, view, id, summaryDict) {
    if (!nameDict) return;
    ["tr", "en", "pt"].forEach((lang) => {
      const term = nameDict[lang];
      if (!term) return;
      const variants = new Set();
      if (term.length >= 4) variants.add(term);
      // Many titles carry a parenthetical gloss ("Vâcib (Vâcibü'l-Vücûd)")
      // or an Arabic article prefix ("el-Kâdir", "es-Semî'"); register the
      // bare form too so ordinary running prose ("Vâcib", "Kâdir") can
      // still resolve to the same concept.
      const noParen = term.replace(/\s*\(.*\)\s*$/, "").trim();
      if (noParen.length >= 4) variants.add(noParen);
      const noPrefix = noParen.replace(/^(el|er|es)-/i, "").trim();
      if (noPrefix.length >= 4) variants.add(noPrefix);
      variants.forEach((v) => crossLinkTermsByLang[lang].push({ term: v, view, id }));
    });
    if (summaryDict) crossLinkSummaries.set(view + ":" + id, summaryDict);
  }

  function getCrossLinkSummary(view, id) {
    const dict = crossLinkSummaries.get(view + ":" + id);
    return dict ? I18n.pick3(dict) : null;
  }

  function linkify(text, excludeView, excludeId) {
    if (!text) return text;
    const lang = I18n.getLang();
    const terms = crossLinkTermsByLang[lang]
      .filter((t) => !(t.view === excludeView && t.id === excludeId))
      .map((t) => ({ ...t, folded: foldForLang(lang, t.term) }))
      .sort((a, b) => b.folded.length - a.folded.length);
    if (!terms.length) return text;
    const pattern = terms.map((t) => `(?<![\\p{L}])${escapeRegExp(t.folded)}(?![\\p{L}])`).join("|");
    const re = new RegExp(pattern, "gu");
    const foldedText = foldForLang(lang, text);
    const seen = new Set();
    let result = "";
    let lastIndex = 0;
    let m;
    while ((m = re.exec(foldedText))) {
      const start = m.index;
      const end = start + m[0].length;
      const hit = terms.find((t) => t.folded === m[0]);
      if (!hit) continue;
      const original = text.slice(start, end);
      result += text.slice(lastIndex, start);
      const key = hit.view + ":" + hit.id;
      if (seen.has(key)) {
        result += original;
      } else {
        seen.add(key);
        result += `<a href="${ROUTE_BASE}/${hit.view}/${hit.id}" class="cross-link" data-view="${hit.view}" data-id="${hit.id}">${original}</a>`;
      }
      lastIndex = end;
    }
    result += text.slice(lastIndex);
    return result;
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
  function showSirlarEntry(id) {
    if (!sirlarData) return;
    const entry = sirlarData.entries.find((e) => e.id === id);
    if (!entry) return;
    currentDetailView = "sirlar";
    currentDetailSirlarId = id;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(SIRLAR_THEME_LABELS[entry.theme] || { tr: "Sırlar", en: "Mysteries", pt: "Mistérios" })}</p>
      <h2 class="detail-title">${volumeLabel(entry.volume)} — ${I18n.pick3(entry.topic)}</h2>
      <div class="detail-block detail-block--sir">
        <blockquote>${I18n.pick3(entry.quote)}</blockquote>
        <p>${linkify(I18n.pick3(entry.note), null, null)}</p>
        <cite>${entry.source}</cite>
      </div>
    `;
    detailPanel.hidden = false;
  }

  const RADIUS_BY_ID = {
    "dhat": 22,
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

  function onNodeClick(d) {
    currentDetailNode = d;
    currentDetailEdge = null;
    currentDetailView = null;
    showNodeDetail(d);
    updateHash("ontoloji", d.id);
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
    if (ins.source) return [ins.source];
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

  function analogyHtml(analogy) {
    if (!analogy) return "";
    return `<div class="detail-analogy">
      <p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p>
      <p>${I18n.pick3(analogy)}</p>
    </div>`;
  }

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
      ${relatedEdgesHtml(d)}
    `;
    detailPanel.hidden = false;
    if (nodeSel) nodeSel.classed("node--active", (n) => n.id === d.id);
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
        <p>${linkify(I18n.pick3(l.nature), null, null)}</p>
        ${insightsHtml(l.insights, null, null, null)}
      </div>`;
    }).join("");
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "İlişkiler", en: "Relations", pt: "Relações" })}</p>${items}`;
  }

  function showEdgeDetail(l) {
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${I18n.pick3(l.relation)}</p>
      <h2 class="detail-title">${I18n.pick3(l.source.name)} → ${I18n.pick3(l.target.name)}</h2>
      ${entityDiagramHtml(l)}
      <div class="detail-block detail-block--ibnarabi">
        <p>${linkify(I18n.pick3(l.nature), null, null)}</p>
        ${insightsHtml(l.insights, null, null, null)}
      </div>
    `;
    detailPanel.hidden = false;
    if (nodeSel) nodeSel.classed("node--active", false);
  }

  function drag(sim) {
    function dragstarted(event, d) {
      if (!event.active) sim.alphaTarget(0.2).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event, d) {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
  }
})();
