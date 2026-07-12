(function () {
  "use strict";

  const I18n = window.DostI18n;
  const grid = document.getElementById("terimler-list");
  const chipsWrap = document.getElementById("terimler-chips");
  const diagramWrap = document.getElementById("terimler-diagram");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  if (!grid || !chipsWrap || !diagramWrap || !detailPanel || !detailContent) return;

  let glossaryData = null;
  let fetchPromise = null;
  let activeGroup = "all";

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function truncate(str, max) {
    if (!str) return "";
    if (str.length <= max) return str;
    const cut = str.slice(0, max);
    return cut.slice(0, cut.lastIndexOf(" ")) + "…";
  }

  function registerTerimlerCrossLinks(data) {
    if (!window.__dostCrossLink || !window.__dostCrossLink.register) return;
    Object.values(data.terms).forEach((t) => {
      const def = t.felsefi_tanim || {};
      const summary = {
        tr: truncate(def.tr, 160),
        en: truncate(def.en, 160),
        pt: truncate(def.pt, 160),
      };
      window.__dostCrossLink.register(t.title, "terimler", t.id, summary);
    });
    if (window.__dostCrossLink.notifyReady) window.__dostCrossLink.notifyReady();
  }

  function fetchData() {
    if (glossaryData) return Promise.resolve(glossaryData);
    if (fetchPromise) return fetchPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("terimler-wrap");
    fetchPromise = fetch("data/ibn-arabi/felsefi-terimler.json")
      .then((r) => r.json())
      .then((data) => {
        glossaryData = data;
        registerTerimlerCrossLinks(data);
        if (window.DostViewStatus) window.DostViewStatus.hide("terimler-wrap");
        return data;
      })
      .catch((err) => {
        console.error("Terimler sözlüğü yüklenemedi / Failed to load glossary", err);
        fetchPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("terimler-wrap", () => window.__terimlerApp.activate());
        return null;
      });
    return fetchPromise;
  }

  // Diğer görünümlerdeki metinler (örn. Fütûhât Atlası) terimlere bağlantı
  // verebilsin diye, kullanıcı Terimler sekmesini hiç açmasa da veriyi
  // erkenden (ana iş parçacığı boştayken) çekip kaydediyoruz.
  const deferFetch = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
  deferFetch(() => { fetchData(); });

  function groupById(id) {
    return glossaryData.groups.find((g) => g.id === id);
  }

  function termsInGroup(groupId) {
    return Object.values(glossaryData.terms).filter((t) => groupId === "all" || t.group === groupId);
  }

  // Grup başına küçük, elle çizilmiş bir sembol -- emoji değil, sitenin
  // ince-çizgi/altın diliyle uyumlu, tek renkli (currentColor) SVG'ler.
  const ICON_PATHS = {
    rings: '<circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="2.6"/>',
    branch: '<path d="M10 3v6M10 9l-5 8M10 9l5 8"/><circle cx="10" cy="3" r="1.6"/><circle cx="5" cy="17" r="1.6"/><circle cx="15" cy="17" r="1.6"/>',
    bolt: '<path d="M11 2 4 12h5l-1 6 7-10h-5l1-6z"/>',
    steps: '<path d="M3 17h4v-4h4V9h4V5h2"/>',
    rays: '<circle cx="10" cy="10" r="2.2"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.5 4.5l2 2M13.5 13.5l2 2M4.5 15.5l2-2M13.5 6.5l2-2"/>',
    eye: '<path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.4"/>',
    flame: '<path d="M10 2c1 3-3 4-3 7.5a3 3 0 0 0 6 0C13 6.5 10.5 7 10 2z"/><path d="M7.5 12a2.5 4 0 0 0 5 0"/>',
    "dot-circle": '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="1.6"/>',
    stroke: '<path d="M10 2v11"/><circle cx="10" cy="16" r="1.8"/>',
    star: '<path d="M10 2l1.9 5.8h6.1l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8-4.9-3.6h6.1z"/>',
    wave: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 4 0"/><path d="M2 7c2-3 4-3 6 0"/>',
    "veil-x": '<path d="M3 4c3 8 11 8 14 0" /><path d="M7 15l6-6M13 15L7 9"/>',
    veil: '<path d="M3 5c2 2 2 4 0 6M8 4c2 2 2 8 0 10M13 4c2 2 2 8 0 10M18 5c-2 2-2 4 0 6"/>',
    cycle: '<path d="M15.5 6.5A6 6 0 1 0 16 11"/><path d="M15.5 3v4h-4"/>',
    lamp: '<path d="M10 2a5 5 0 0 0-3 9c0 1 0 2 1 2h4c1 0 1-1 1-2a5 5 0 0 0-3-9z"/><path d="M8.5 16h3M9 18.5h2"/>',
    beam: '<path d="M10 2v4"/><path d="M6 8l8 0-2 10H8L6 8z"/>',
    scale: '<path d="M10 2v15M5 6h10M5 6l-2.5 6h5L5 6zM15 6l-2.5 6h5L15 6z"/>',
    compass: '<circle cx="10" cy="10" r="2"/><circle cx="10" cy="4" r="1.4"/><circle cx="16" cy="10" r="1.4"/><circle cx="10" cy="16" r="1.4"/><circle cx="4" cy="10" r="1.4"/><path d="M10 6v2M14 10h-2M10 14v-2M6 10h2"/>',
  };
  const GROUP_ICON = {
    "toz-nitelik": "rings",
    "siniflandirma": "branch",
    "sebep-sonuc": "bolt",
    "varlik-mertebesi": "steps",
    "kozmik-hiyerarsi": "rays",
    "kopru-kavram": "eye",
    "nefsin-gucleri": "flame",
    "ahad-vahid": "dot-circle",
    "lafza-i-celal": "stroke",
    "velayet-risalet": "star",
    "sahv-sekr": "wave",
    "itibar-edilmez": "veil-x",
    "halvet-perdeleri": "veil",
    "mebde-mead": "cycle",
    "nubuvvetin-zarureti": "lamp",
    "vahyin-mertebeleri": "beam",
    "hayir-ve-ser": "scale",
    "tezkire-i-erbaa": "compass",
  };
  function groupIconSvg(groupId) {
    const key = GROUP_ICON[groupId] || "dot-circle";
    return `<svg class="terim-card__icon-svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[key]}</svg>`;
  }

  // İki (veya daha fazla) kavram arasındaki ilişkiyi tek bakışta gösteren
  // küçük SVG şemalar. Her grubun "diagram" alanındaki tipe göre seçilir.
  const diagramRenderers = {
    "mutual-vs-oneway": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 340 150" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node" cx="60" cy="34" r="24"/>
        <text class="term-diagram-label" x="60" y="39" text-anchor="middle">${tt(d.left)}</text>
        <circle class="term-diagram-node" cx="280" cy="34" r="24"/>
        <text class="term-diagram-label" x="280" y="39" text-anchor="middle">${tt(d.right)}</text>
        <line class="term-diagram-arrow term-diagram-arrow--mutual" x1="86" y1="34" x2="254" y2="34" marker-start="url(#tdArrowStart)" marker-end="url(#tdArrowEnd)"/>
        <text class="term-diagram-note" x="170" y="20" text-anchor="middle">${tt(d.mutualLabel)}</text>

        <circle class="term-diagram-node term-diagram-node--accent" cx="60" cy="116" r="24"/>
        <text class="term-diagram-label" x="60" y="121" text-anchor="middle">${tt(d.oneWayFrom)}</text>
        <circle class="term-diagram-node" cx="280" cy="116" r="24"/>
        <text class="term-diagram-label" x="280" y="121" text-anchor="middle">${tt(d.oneWayTo)}</text>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="86" y1="116" x2="254" y2="116" marker-end="url(#tdArrowEnd)"/>
        <text class="term-diagram-note term-diagram-note--accent" x="170" y="145" text-anchor="middle">${tt(d.oneWayLabel)}</text>
      </svg>
    `,
    "host-satellite": (d) => {
      const cx = 150, cy = 85, hostR = 32, satR = 15, orbit = 62;
      const angles = [-90, 30, 150];
      const sats = angles.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const sx = cx + orbit * Math.cos(rad);
        const sy = cy + orbit * Math.sin(rad);
        return `
          <line class="term-diagram-tether" x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}"/>
          <circle class="term-diagram-node term-diagram-node--dashed" cx="${sx}" cy="${sy}" r="${satR}"/>
        `;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 300 170" role="img" aria-label="${tt(d.note)}">
        ${sats}
        <circle class="term-diagram-node term-diagram-node--accent" cx="${cx}" cy="${cy}" r="${hostR}"/>
        <text class="term-diagram-label term-diagram-label--host" x="${cx}" y="${cy + 5}" text-anchor="middle">${tt(d.host)}</text>
        <text class="term-diagram-label term-diagram-label--small" x="${cx}" y="${cy - orbit - 20}" text-anchor="middle">${tt(d.satellite)}</text>
      </svg>
    `;
    },
    "formula-merge": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 340 100" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node" cx="55" cy="50" r="30"/>
        <text class="term-diagram-label" x="55" y="55" text-anchor="middle">${tt(d.a)}</text>
        <text class="term-diagram-op" x="120" y="58" text-anchor="middle">+</text>
        <circle class="term-diagram-node" cx="185" cy="50" r="30"/>
        <text class="term-diagram-label" x="185" y="55" text-anchor="middle">${tt(d.b)}</text>
        <text class="term-diagram-op" x="245" y="58" text-anchor="middle">=</text>
        <circle class="term-diagram-node term-diagram-node--accent" cx="290" cy="50" r="34"/>
        <text class="term-diagram-label" x="290" y="55" text-anchor="middle">${tt(d.result)}</text>
      </svg>
    `,
    spectrum: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 340 120" role="img" aria-label="${tt(d.note)}">
        <line class="term-diagram-axis" x1="30" y1="55" x2="310" y2="55" marker-end="url(#tdArrowEnd)"/>
        <circle class="term-diagram-node term-diagram-node--sm" cx="80" cy="55" r="16"/>
        <circle class="term-diagram-node term-diagram-node--accent term-diagram-node--sm" cx="270" cy="55" r="16"/>
        <text class="term-diagram-note" x="80" y="90" text-anchor="middle">${tt(d.leftMarker)}</text>
        <text class="term-diagram-note" x="270" y="90" text-anchor="middle">${tt(d.rightMarker)}</text>
        <text class="term-diagram-label" x="30" y="20" text-anchor="start">${tt(d.leftLabel)}</text>
        <text class="term-diagram-label--small" x="30" y="35" text-anchor="start">${tt(d.leftNote)}</text>
        <text class="term-diagram-label" x="310" y="20" text-anchor="end">${tt(d.rightLabel)}</text>
        <text class="term-diagram-label--small" x="310" y="35" text-anchor="end">${tt(d.rightNote)}</text>
      </svg>
    `,
    cascade: (d) => {
      const n = d.steps.length;
      const gap = 300 / (n - 1);
      const circles = d.steps.map((s, i) => {
        const x = 30 + i * gap;
        return `
          <circle class="term-diagram-node${i === 0 ? " term-diagram-node--accent" : ""}" cx="${x}" cy="60" r="28"/>
          <text class="term-diagram-label term-diagram-label--small" x="${x}" y="65" text-anchor="middle">${tt(s)}</text>
        `;
      }).join("");
      const arrows = d.steps.slice(1).map((s, i) => {
        const x1 = 30 + i * gap + 30;
        const x2 = 30 + (i + 1) * gap - 30;
        return `<line class="term-diagram-arrow term-diagram-arrow--oneway" x1="${x1}" y1="60" x2="${x2}" y2="60" marker-end="url(#tdArrowEnd)"/>`;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 340 110" role="img" aria-label="${tt(d.note)}">
        ${arrows}${circles}
        <text class="term-diagram-note" x="170" y="100" text-anchor="middle">${tt(d.relationLabel)}</text>
      </svg>
    `;
    },
    mirror: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 300 120" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node term-diagram-node--accent" cx="55" cy="55" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="55" y="60" text-anchor="middle">${tt(d.source)}</text>
        <line class="term-diagram-mirror" x1="160" y1="15" x2="140" y2="95"/>
        <line class="term-diagram-arrow term-diagram-arrow--dashed" x1="83" y1="55" x2="215" y2="55" marker-end="url(#tdArrowEnd)"/>
        <circle class="term-diagram-node term-diagram-node--faint" cx="245" cy="55" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="245" y="60" text-anchor="middle">${tt(d.target)}</text>
      </svg>
    `,
    "seal-wax": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 300 130" role="img" aria-label="${tt(d.note)}">
        <ellipse class="term-diagram-node term-diagram-node--faint" cx="150" cy="90" rx="90" ry="30"/>
        <text class="term-diagram-label term-diagram-label--small" x="150" y="95" text-anchor="middle">${tt(d.wax)}</text>
        <rect class="term-diagram-node term-diagram-node--accent" x="120" y="15" width="60" height="40" rx="8"/>
        <text class="term-diagram-label term-diagram-label--small" x="150" y="40" text-anchor="middle">${tt(d.seal)}</text>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="150" y1="58" x2="150" y2="68" marker-end="url(#tdArrowEnd)"/>
      </svg>
    `,
    "potential-actual": (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 300 100" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node term-diagram-node--dashed" cx="60" cy="50" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="60" y="55" text-anchor="middle">${tt(d.potential)}</text>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="90" y1="50" x2="210" y2="50" marker-end="url(#tdArrowEnd)"/>
        <circle class="term-diagram-node term-diagram-node--accent" cx="240" cy="50" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="240" y="55" text-anchor="middle">${tt(d.actual)}</text>
      </svg>
    `,
    reins: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 300 200" role="img" aria-label="${tt(d.note)}">
        <circle class="term-diagram-node term-diagram-node--accent" cx="150" cy="42" r="32"/>
        <text class="term-diagram-label term-diagram-label--small" x="150" y="47" text-anchor="middle">${tt(d.ruler)}</text>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="126" y1="66" x2="82" y2="132" marker-end="url(#tdArrowEnd)"/>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="174" y1="66" x2="218" y2="132" marker-end="url(#tdArrowEnd)"/>
        <circle class="term-diagram-node term-diagram-node--dashed" cx="70" cy="158" r="28"/>
        <text class="term-diagram-label term-diagram-label--small" x="70" y="163" text-anchor="middle">${tt(d.left)}</text>
        <circle class="term-diagram-node term-diagram-node--dashed" cx="230" cy="158" r="28"/>
        <text class="term-diagram-label term-diagram-label--small" x="230" y="163" text-anchor="middle">${tt(d.right)}</text>
        <text class="term-diagram-note" x="150" y="105" text-anchor="middle">${tt(d.rulesLabel)}</text>
      </svg>
    `,
    eclipse: (d) => `
      <svg class="term-diagram__svg" viewBox="0 0 340 160" role="img" aria-label="${tt(d.note)}">
        <line class="term-diagram-mirror" x1="170" y1="10" x2="170" y2="150"/>

        <circle class="term-diagram-node term-diagram-node--accent" cx="85" cy="48" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="85" y="53" text-anchor="middle">${tt(d.sunLabel)}</text>
        <circle class="term-diagram-node term-diagram-node--dashed" cx="85" cy="112" r="18"/>
        <text class="term-diagram-label--small" x="85" y="116" text-anchor="middle" style="font-size:8px">${tt(d.moonLabel)}</text>
        <text class="term-diagram-note" x="85" y="145" text-anchor="middle">${tt(d.presentCaption)}</text>

        <circle class="term-diagram-node term-diagram-node--faint" cx="255" cy="48" r="26"/>
        <text class="term-diagram-label term-diagram-label--small" x="255" y="53" text-anchor="middle">${tt(d.sunLabel)}</text>
        <circle class="term-diagram-node term-diagram-node--accent" cx="255" cy="112" r="18"/>
        <text class="term-diagram-label--small" x="255" y="116" text-anchor="middle" style="font-size:8px">${tt(d.moonLabel)}</text>
        <text class="term-diagram-note" x="255" y="145" text-anchor="middle">${tt(d.absentCaption)}</text>
      </svg>
    `,
    "letter-sequence": (d) => {
      const n = d.letters.length;
      const gap = 400 / (n - 1);
      const items = d.letters.map((it, i) => {
        const x = 20 + i * gap;
        const nodeClass = it.hidden ? "term-diagram-node--dashed" : i === 0 ? "term-diagram-node--accent" : "term-diagram-node";
        return `
          <circle class="term-diagram-node ${nodeClass}" cx="${x}" cy="50" r="21"/>
          <text class="term-diagram-label" x="${x}" y="55" text-anchor="middle">${tt(it.harf)}</text>
          <text class="term-diagram-label--small" x="${x}" y="93" text-anchor="middle" style="font-size:8px">${tt(it.anlam)}</text>
        `;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 440 115" role="img" aria-label="${tt(d.note)}">
        ${items}
      </svg>
    `;
    },
    "heart-visitors": (d) => {
      const cx = 170, cy = 170, hostR = 34, satR = 26, orbit = 112;
      const n = d.visitors.length;
      const items = d.visitors.map((v, i) => {
        const deg = -90 + (360 / n) * i;
        const rad = (deg * Math.PI) / 180;
        const sx = cx + orbit * Math.cos(rad);
        const sy = cy + orbit * Math.sin(rad);
        const nodeClass = v.accent ? "term-diagram-node--accent" : "term-diagram-node--dashed";
        return `
          <line class="term-diagram-tether" x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}"/>
          <circle class="term-diagram-node ${nodeClass}" cx="${sx}" cy="${sy}" r="${satR}"/>
          <text class="term-diagram-label--small" x="${sx}" y="${sy + 4}" text-anchor="middle">${tt(v.label)}</text>
        `;
      }).join("");
      return `
      <svg class="term-diagram__svg" viewBox="0 0 340 340" role="img" aria-label="${tt(d.note)}">
        ${items}
        <circle class="term-diagram-node term-diagram-node--faint" cx="${cx}" cy="${cy}" r="${hostR}"/>
        <text class="term-diagram-label" x="${cx}" y="${cy + 5}" text-anchor="middle">${tt(d.center)}</text>
      </svg>
    `;
    },
  };

  const DIAGRAM_DEFS = `
    <svg width="0" height="0" style="position:absolute">
      <defs>
        <marker id="tdArrowEnd" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" class="term-diagram-arrowhead"/>
        </marker>
        <marker id="tdArrowStart" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
          <path d="M8,0 L0,4 L8,8 Z" class="term-diagram-arrowhead"/>
        </marker>
        <filter id="tdSketchy" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="tdNoise"/>
          <feDisplacementMap in="SourceGraphic" in2="tdNoise" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>
  `;

  let currentDiagrams = [];

  function renderDiagrams() {
    if (activeGroup === "all") {
      diagramWrap.innerHTML = "";
      diagramWrap.hidden = true;
      currentDiagrams = [];
      return;
    }
    const group = groupById(activeGroup);
    const diagrams = group && group.diagram;
    if (!diagrams || !diagrams.length) {
      diagramWrap.innerHTML = "";
      diagramWrap.hidden = true;
      currentDiagrams = [];
      return;
    }
    currentDiagrams = diagrams;
    diagramWrap.hidden = false;
    const cards = diagrams
      .map((dg, i) => {
        const renderer = diagramRenderers[dg.type];
        if (!renderer) return "";
        return `<div class="term-diagram-card">
          <div class="term-diagram-svg-wrap" data-diagram-index="${i}" role="button" tabindex="0"
               aria-label="${tt({ tr: "Büyüt", en: "Enlarge", pt: "Ampliar" })}">${renderer(dg)}</div>
          <p class="term-diagram-caption">${tt(dg.note)}</p>
        </div>`;
      })
      .join("");
    diagramWrap.innerHTML = DIAGRAM_DEFS + `<div class="term-diagram-row">${cards}</div>`;
    diagramWrap.querySelectorAll(".term-diagram-svg-wrap").forEach((el) => {
      el.addEventListener("click", () => openDiagramLightbox(Number(el.dataset.diagramIndex)));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDiagramLightbox(Number(el.dataset.diagramIndex));
        }
      });
    });
  }

  // --- Büyütme (lightbox) ---
  let lightboxEl = null;

  function ensureLightbox() {
    if (lightboxEl) return lightboxEl;
    lightboxEl = document.createElement("div");
    lightboxEl.className = "cizim-lightbox";
    lightboxEl.hidden = true;
    lightboxEl.innerHTML = `
      <div class="cizim-lightbox__backdrop"></div>
      <div class="cizim-lightbox__panel" role="dialog" aria-modal="true">
        <button class="cizim-lightbox__close" type="button" aria-label="${tt({ tr: "Kapat", en: "Close", pt: "Fechar" })}">×</button>
        <div class="cizim-lightbox__svg-wrap"></div>
        <p class="cizim-lightbox__caption"></p>
      </div>
    `;
    document.body.appendChild(lightboxEl);
    lightboxEl.querySelector(".cizim-lightbox__backdrop").addEventListener("click", closeLightbox);
    lightboxEl.querySelector(".cizim-lightbox__close").addEventListener("click", closeLightbox);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !lightboxEl.hidden) closeLightbox();
    });
    return lightboxEl;
  }

  function openDiagramLightbox(index) {
    const dg = currentDiagrams[index];
    if (!dg) return;
    const renderer = diagramRenderers[dg.type];
    if (!renderer) return;
    const el = ensureLightbox();
    el.querySelector(".cizim-lightbox__svg-wrap").innerHTML = DIAGRAM_DEFS + renderer(dg);
    el.querySelector(".cizim-lightbox__caption").textContent = tt(dg.note);
    el.hidden = false;
    document.body.classList.add("cizim-lightbox-open");
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.hidden = true;
    document.body.classList.remove("cizim-lightbox-open");
  }

  function renderChips() {
    const allChip = `<button class="theme-chip${activeGroup === "all" ? " theme-chip--active" : ""}" data-group="all">${tt({ tr: "Tümü", en: "All", pt: "Todos" })} <span class="theme-chip__count">${Object.keys(glossaryData.terms).length}</span></button>`;
    const groupChips = glossaryData.groups
      .map((g) => {
        const count = termsInGroup(g.id).length;
        return `<button class="theme-chip${activeGroup === g.id ? " theme-chip--active" : ""}" data-group="${g.id}">${tt(g.name)} <span class="theme-chip__count">${count}</span></button>`;
      })
      .join("");
    chipsWrap.innerHTML = allChip + groupChips;
    chipsWrap.querySelectorAll(".theme-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        activeGroup = chip.dataset.group;
        render();
      });
    });
  }

  function relatedChipsInline(t) {
    const related = (t.iliskili_kavramlar || [])
      .map((id) => glossaryData.terms[id])
      .filter(Boolean)
      .slice(0, 3);
    if (!related.length) return "";
    return `<span class="terim-card__related">${related.map((r) => tt(r.title)).join(" · ")}</span>`;
  }

  function renderList() {
    const terms = termsInGroup(activeGroup);
    grid.innerHTML = terms
      .map((t) => {
        const tier = t.tier || 2;
        return `<button class="terim-card terim-card--tier-${tier}" data-id="${t.id}">
          <span class="terim-card__icon">${groupIconSvg(t.group)}</span>
          <span class="terim-card__title">${tt(t.title)}</span>
          <span class="terim-card__ozet">${t.ozet_tr || ""}</span>
          ${relatedChipsInline(t)}
        </button>`;
      })
      .join("");
    grid.querySelectorAll(".terim-card").forEach((card) => {
      card.addEventListener("click", () => showTermDetail(card.dataset.id));
    });
  }

  function render() {
    if (!glossaryData) return;
    renderChips();
    renderDiagrams();
    renderList();
  }

  function kaynaklarHtml(kaynaklar) {
    if (!kaynaklar || !kaynaklar.length) return "";
    return `<div class="insight-group">${kaynaklar
      .map(
        (k, i) => `<details class="insight" ${i === 0 ? "open" : ""}>
          <summary>${k.kaynak_adi ? k.kaynak_adi : tt({ tr: `Cilt ${k.cilt}`, en: `Volume ${k.cilt}`, pt: `Volume ${k.cilt}` })}</summary>
          <p>${k.alinti_tr}</p>
          ${k.not_tr ? `<cite>${k.not_tr}</cite>` : ""}
        </details>`
      )
      .join("")}</div>`;
  }

  function groupHue(groupId) {
    const idx = (glossaryData.groups || []).findIndex((g) => g.id === groupId);
    const i = idx === -1 ? 0 : idx;
    return Math.round((i * 137.508) % 360);
  }

  function relatedTermsHtml(t) {
    const related = (t.iliskili_kavramlar || [])
      .map((id) => glossaryData.terms[id])
      .filter(Boolean);
    if (!related.length) return "";
    const chips = related
      .map((r) => `<button class="bookmap-concept-tag bookmap-concept-tag--group" data-term="${r.id}" style="--tag-hue:${groupHue(r.group)}">${tt(r.title)}</button>`)
      .join("");
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "İlişkili Terimler", en: "Related Terms", pt: "Termos Relacionados" })}</p>
      <div class="bookmap-concept-tags">${chips}</div>`;
  }

  function celisenYorumlarHtml(t) {
    const views = t.celisen_yorumlar || [];
    if (!views.length) return "";
    const cards = views
      .map(
        (v) => `<div class="divergent-view">
          <p class="divergent-view__kaynak">${v.kaynak}</p>
          <p>${tt(v.gorus)}</p>
        </div>`
      )
      .join("");
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "Çelişen Yorumlar", en: "Differing Readings", pt: "Leituras Divergentes" })}</p>
      <div class="divergent-views">${cards}</div>
      ${t.celisen_yorumlar_not ? `<p class="divergent-views__not">${tt(t.celisen_yorumlar_not)}</p>` : ""}`;
  }

  function siteLinksHtml(t) {
    const links = t.site_baglantilari || [];
    if (!links.length) return "";
    const VIEW_LABEL = {
      ontoloji: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
      esma: { tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" },
      hal: { tr: "Hâller", en: "States", pt: "Estados" },
    };
    const chips = links
      .map((l) => `<button class="bookmap-concept-tag" data-view="${l.view}" data-id="${l.id}">${tt(VIEW_LABEL[l.view] || {})} → ${l.id}</button>`)
      .join("");
    return `<p class="detail-eyebrow" style="margin-top:18px;">${tt({ tr: "Haritada Gör", en: "See on the Map", pt: "Ver no Mapa" })}</p>
      <div class="bookmap-concept-tags">${chips}</div>`;
  }

  function showTermDetail(id) {
    const t = glossaryData.terms[id];
    if (!t) return;
    const group = groupById(t.group);

    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(group.name)}</p>
      <h2 class="detail-title">${tt(t.title)}${t.arabic ? ` <span class="detail-title__arabic">${t.arabic}</span>` : ""}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${tt({ tr: "Felsefi Tanım", en: "Philosophical Definition", pt: "Definição Filosófica" })}</h3>
        <p>${tt(t.felsefi_tanim)}</p>
      </div>
      <div class="detail-block">
        <h3>${tt({ tr: "İbn Arabî'nin Yorumu", en: "Ibn Arabi's Interpretation", pt: "A Interpretação de Ibn Arabi" })}</h3>
        <p>${tt(t.ibn_arabi_yorumu)}</p>
      </div>
      <div class="detail-analogy">
        <p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p>
        <p>${tt(t.analogy)}</p>
      </div>
      ${kaynaklarHtml(t.kaynaklar)}
      ${celisenYorumlarHtml(t)}
      ${relatedTermsHtml(t)}
      ${siteLinksHtml(t)}
    `;

    detailContent.querySelectorAll(".bookmap-concept-tag[data-term]").forEach((btn) => {
      btn.addEventListener("click", () => showTermDetail(btn.dataset.term));
    });
    detailContent.querySelectorAll(".bookmap-concept-tag[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.__dostNav && window.__dostNav.goTo(btn.dataset.view, btn.dataset.id);
      });
    });

    detailPanel.hidden = false;
  }

  window.__terimlerApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        render();
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        // Bir terime doğrudan bağlantıyla gelindiğinde, o terimin grubunu
        // seçili hale getir -- aksi halde grup diyagramı (varsa) hiç
        // görünmez, çünkü diyagramlar "activeGroup" filtresine bağlıdır.
        const term = id && data.terms[id];
        if (term && term.group) activeGroup = term.group;
        render();
        if (id) showTermDetail(id);
      });
    },
    onLangChange() {
      if (glossaryData) render();
    },
  };
})();
