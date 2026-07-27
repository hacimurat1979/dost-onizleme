(function () {
  "use strict";

  const I18n = window.DostI18n;
  const grid = document.getElementById("terimler-list");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");
  if (!grid || !detailPanel || !detailContent) return;

  let glossaryData = null;
  let fetchPromise = null;

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function linkify(text, view, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, view, id) : text;
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
    fetchPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/felsefi-terimler.json")
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
    "firaset": "eye",
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
    "kutbiyet-hiyerarsisi": "steps",
    "ahval-makamat": "wave",
    "kurani-kozmoloji": "rays",
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

  // Bir terimin grubunun çizimi varsa, terim detayının içine (Benzetme'den
  // hemen sonra) gömülü olarak gösteriyoruz -- ayrı bir tıklama gerekmeden,
  // terime bakan herkes çizimi de görsün diye. Tıklanınca büyütme (lightbox)
  // aynı şekilde çalışıyor.
  function groupDiagramHtml(group) {
    const diagrams = group && group.diagram;
    if (!diagrams || !diagrams.length) return "";
    currentDiagrams = diagrams;
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
    return `
      <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Grup Çizimi", en: "Group Diagram", pt: "Diagrama do Grupo" })}</p>
      ${DIAGRAM_DEFS}
      <div class="term-diagram-row term-diagram-row--panel">${cards}</div>
    `;
  }

  // --- Büyütme (lightbox) ---
  function openDiagramLightbox(index) {
    const dg = currentDiagrams[index];
    if (!dg) return;
    const renderer = diagramRenderers[dg.type];
    if (!renderer) return;
    window.dostTrack && window.dostTrack("sema_acildi", { type: dg.type });
    window.DostLightbox.open({
      closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
      svgHtml: DIAGRAM_DEFS + renderer(dg),
      caption: tt(dg.note),
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

  // 68 terim düz bir ızgarada değil, kendi 22 ilişkisel grubuna göre
  // kümelenmiş gösteriliyor -- bir sözlük için tam bir kuvvet-yönlü graf
  // (68 düğüm) hem taramayı zorlaştırırdı hem de CLAUDE.md'nin kendi
  // uyarısına ("bir öğe doğası gereği dairesel değilse zorla daireye
  // sokma") aykırı düşerdi; bunun yerine her grup başlığına, o grubun
  // kendi rengiyle (GROUP_HUE) boyanmış küçük dairesel bir "küme" rozeti
  // eklendi -- ilişkiyi taramayı bozmadan görünür kılan, daha ölçülü bir
  // orta yol.
  // ---------------------------------------------------------------------
  // "Dönüş yoğunluğu" — ısı haritası yerine hâle
  //
  // Bir ısı haritası her zaman bir ŞEYİ ölçer, ve burada ölçebileceğimiz
  // tek dürüst şey bir terimin "önemi" DEĞİL: onu ölçmeye kalkmak, kendi
  // kararımızı sayıya çevirip veri gibi göstermek olurdu. Ölçebildiğimiz
  // şey kendi okumamız: bu terime kaç kere geri dönmek zorunda kaldık?
  //
  //   yoğunluk = kaydettiğimiz kaynak pasajı sayısı
  //            + başka terimlerin ona işaret etme sayısı (iç derece)
  //            + sitenin başka bölümlerine kurulmuş bağlantı sayısı
  //
  // Yani bu harita İbn Arabî'nin neye ağırlık verdiğini değil, BİZİM
  // neye tekrar tekrar döndüğümüzü gösteriyor. Sayfada da böyle yazılı.
  //
  // Biçim olarak dikdörtgen bir ısı ızgarası (treemap/matris) sitenin
  // diline yabancı düşerdi; onun yerine kartlar yerinde kalıyor ve her
  // biri kendi yoğunluğu kadar ışıyor -- renk değil, hâle. Kapalıyken
  // sayfa hiç değişmiyor.
  // Düğme kaldırıldı (2026-07-26): yoğunluk sekme açılışında zaten açık.
  // Bir seçenek olarak sunulunca çoğu ziyaretçi hiç açmıyordu; oysa bu
  // haritanın söylediği şey (nereye tekrar tekrar döndüğümüz) sayfanın
  // kendi içeriğinin bir parçası, isteğe bağlı bir katman değil.
  const heatOn = true;
  let heatByTerm = null;

  function computeHeat(terms) {
    const scores = new Map();
    const inDegree = new Map();
    Object.values(terms).forEach((t) => {
      (t.iliskili_kavramlar || []).forEach((r) => {
        const id = typeof r === "string" ? r : r && r.id;
        if (id) inDegree.set(id, (inDegree.get(id) || 0) + 1);
      });
    });
    Object.values(terms).forEach((t) => {
      const s =
        (t.kaynaklar || []).length +
        (inDegree.get(t.id) || 0) +
        (t.site_baglantilari || []).length;
      scores.set(t.id, s);
    });
    const vals = Array.from(scores.values());
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const norm = new Map();
    scores.forEach((v, k) => norm.set(k, hi === lo ? 0.5 : (v - lo) / (hi - lo)));
    return { raw: scores, norm: norm, lo: lo, hi: hi };
  }

  // Yoğunluk artık bir "ışıma" değil, bir ÖLÇEK. İlk tasarımda her kart
  // kendi yoğunluğu kadar ışıyordu; koyu zeminde çalışıyordu ama açık
  // zeminde hâle bir leke gibi okunuyordu (kullanıcı tespiti, 2026-07-27).
  // Yerine her terimin yanında küçük bir HALKA var: çemberin ne kadarının
  // çizildiği, o terime kaç kere geri döndüğümüz. İki zeminde de aynı
  // netlikte okunuyor, ve bir atmosfer değil bir ölçü olduğunu -- yani
  // iddiasının ne olduğunu -- biçimiyle söylüyor. Dairesel oluşu da
  // sitenin kendi diline ait (bkz. CLAUDE.md, "daire ve merkez").
  const GAUGE_R = 7.4;
  const GAUGE_C = 2 * Math.PI * GAUGE_R;

  function gaugeSvg(n, hue) {
    const frac = Math.max(0.06, Math.min(1, n));
    const off = GAUGE_C * (1 - frac);
    return `<svg class="terim-entry__gauge" viewBox="0 0 20 20" aria-hidden="true" style="--tag-hue:${hue}">
      <circle class="terim-entry__gauge-track" cx="10" cy="10" r="${GAUGE_R}"></circle>
      <circle class="terim-entry__gauge-arc" cx="10" cy="10" r="${GAUGE_R}"
        stroke-dasharray="${GAUGE_C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"></circle>
    </svg>`;
  }

  function heatKeyHtml() {
    return `<div class="terimler-heat">
      <p class="terimler-heat__title">
        <svg class="terim-entry__gauge terimler-heat__gauge" viewBox="0 0 20 20" aria-hidden="true">
          <circle class="terim-entry__gauge-track" cx="10" cy="10" r="${GAUGE_R}"></circle>
          <circle class="terim-entry__gauge-arc" cx="10" cy="10" r="${GAUGE_R}"
            stroke-dasharray="${GAUGE_C.toFixed(2)}" stroke-dashoffset="${(GAUGE_C * 0.32).toFixed(2)}"></circle>
        </svg>
        <span>${tt({ tr: "Dönüş yoğunluğu", en: "Return density", pt: "Densidade de retorno" })}</span>
      </p>
      <p class="terimler-heat__note">${tt({
        tr: "Her terimin yanındaki halka, ona kaç kere geri döndüğümüz kadar doluyor — kaydettiğimiz kaynak pasajları, başka terimlerin ona verdiği atıflar ve sitenin öbür bölümlerine kurduğumuz bağlar toplanarak. Bu, Dost'un neye ağırlık verdiğini değil, bizim okumamızın nerede yoğunlaştığını gösteriyor; yani bir ölçü değil, bir öz-portre.",
        en: "The ring beside each term fills in proportion to how often we have had to come back to it — the source passages we recorded, the references other terms make to it, and the links we built to other parts of the site, added together. This shows not what Dost emphasised but where our own reading has thickened; a self-portrait rather than a measurement.",
        pt: "O anel ao lado de cada termo preenche-se na proporção de quantas vezes tivemos de voltar a ele — as passagens-fonte que registámos, as referências que outros termos lhe fazem e os vínculos que construímos com outras partes do site, somados. Isto mostra não o que Dost enfatizou, mas onde a nossa própria leitura se adensou; um autorretrato, não uma medição.",
      })}</p>
    </div>`;
  }

  function renderList() {
    const terms = glossaryData.terms;
    if (!heatByTerm) heatByTerm = computeHeat(terms);
    const byGroup = new Map();
    Object.values(terms).forEach((t) => {
      if (!byGroup.has(t.group)) byGroup.set(t.group, []);
      byGroup.get(t.group).push(t);
    });
    const groups = (glossaryData.groups || []).filter((g) => (byGroup.get(g.id) || []).length);

    // Sol taraftaki "sırt": sözlüğün kendi omurgası. Grupları hem gezinti
    // hem içindekiler olarak taşıyor; sayfanın solunu doldurup terimleri
    // kalan bütün genişliğe yayıyor -- eski düzende terimler dar bir
    // sütuna sıkışıp sağ yarı boş kalıyordu (kullanıcı tespiti).
    const rail = `<nav class="terimler-rail" aria-label="${tt({ tr: "Sözlük bölümleri", en: "Glossary sections", pt: "Secções do glossário" })}">
      <label class="terimler-filter">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><line x1="15.8" y1="15.8" x2="20" y2="20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <input type="search" id="terimler-filter-input" autocomplete="off"
          placeholder="${tt({ tr: "Terim ara…", en: "Search terms…", pt: "Procurar termos…" })}"
          aria-label="${tt({ tr: "Terim ara", en: "Search terms", pt: "Procurar termos" })}">
      </label>
      <p class="terimler-rail__count" id="terimler-rail-count"></p>
      <ol class="terimler-rail__list">${groups
        .map((g) => {
          const n = (byGroup.get(g.id) || []).length;
          return `<li><a class="terimler-rail__item" href="#terim-grup-${g.id}" data-group="${g.id}" style="--tag-hue:${groupHue(g.id)}">
            <span class="terimler-rail__dot" aria-hidden="true"></span>
            <span class="terimler-rail__name">${tt(g.name)}</span>
            <span class="terimler-rail__n">${n}</span>
          </a></li>`;
        })
        .join("")}</ol>
    </nav>`;

    const body = groups
      .map((g) => {
        const groupTerms = byGroup.get(g.id) || [];
        const hue = groupHue(g.id);
        const entries = groupTerms
          .map((t) => {
            const tier = t.tier || 2;
            const n = heatByTerm.norm.get(t.id);
            const raw = heatByTerm.raw.get(t.id);
            const ozet = tt({ tr: t.ozet_tr, en: t.ozet_en, pt: t.ozet_pt });
            const gaugeTitle = tt({
              tr: "Dönüş yoğunluğu: " + raw,
              en: "Return density: " + raw,
              pt: "Densidade de retorno: " + raw,
            });
            return `<button class="terim-entry terim-entry--tier-${tier}" data-id="${t.id}"
                data-search="${(tt(t.title) + " " + ozet).toLowerCase().replace(/"/g, "")}"
                title="${gaugeTitle}">
              ${gaugeSvg(n == null ? 0 : n, hue)}
              <span class="terim-entry__text">
                <span class="terim-entry__title">${tt(t.title)}</span>
                <span class="terim-entry__ozet">${ozet}</span>
                ${relatedChipsInline(t)}
              </span>
            </button>`;
          })
          .join("");
        return `<section class="terimler-group" id="terim-grup-${g.id}" data-group="${g.id}">
          <header class="terimler-group__header">
            <span class="terimler-group__badge" style="--tag-hue:${hue}">${groupIconSvg(g.id)}</span>
            <div>
              <h2 class="terimler-group__title">${tt(g.name)}</h2>
              <p class="terimler-group__desc">${tt(g.description)}</p>
            </div>
          </header>
          <div class="terimler-group__entries">${entries}</div>
          <p class="terimler-group__empty" hidden>${tt({
            tr: "Bu bölümde eşleşen terim yok.",
            en: "No matching term in this section.",
            pt: "Nenhum termo correspondente nesta secção.",
          })}</p>
        </section>`;
      })
      .join("");

    grid.innerHTML = `<div class="terimler-shell">${rail}<div class="terimler-body">${heatKeyHtml()}${body}</div></div>`;

    grid.querySelectorAll(".terim-entry").forEach((el) => {
      el.addEventListener("click", () => showTermDetail(el.dataset.id));
    });
    wireRail();
    wireFilter();
  }

  // Sol sırttaki bağlantılar sayfayı gerçekten kaydırıyor; ayrıca hangi
  // bölümde olduğumuzu işaretliyor. IntersectionObserver kullanılıyor ki
  // kaydırma sırasında her karede hesap yapılmasın.
  function wireRail() {
    const items = Array.from(grid.querySelectorAll(".terimler-rail__item"));
    if (!items.length) return;
    items.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const sec = grid.querySelector("#terim-grup-" + CSS.escape(a.dataset.group));
        if (!sec) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        sec.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
    });
    if (!("IntersectionObserver" in window)) return;
    const seen = new Set();
    const obs = new IntersectionObserver(
      (recs) => {
        recs.forEach((r) => {
          const id = r.target.dataset.group;
          if (r.isIntersecting) seen.add(id);
          else seen.delete(id);
        });
        items.forEach((a) => a.classList.remove("is-current"));
        const first = items.find((a) => seen.has(a.dataset.group));
        if (first) {
          first.classList.add("is-current");
          keepRailVisible(first);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    grid.querySelectorAll(".terimler-group").forEach((sec) => obs.observe(sec));
  }

  // İşaretli bölüm bağlantısı, sırtın kendi kaydırma penceresinin dışına
  // düşebiliyor (masaüstünde dikey liste, dar ekranda yatay şerit). Sayfayı
  // değil SADECE sırtı kaydırıyoruz -- scrollIntoView burada sayfayı da
  // oynatıp okuma yerini kaybettirirdi.
  function keepRailVisible(item) {
    const list = item.closest(".terimler-rail__list");
    const rail = item.closest(".terimler-rail");
    const horiz = list && list.scrollWidth - list.clientWidth > 1 ? list : null;
    const vert = rail && rail.scrollHeight - rail.clientHeight > 1 ? rail : null;
    if (horiz) {
      const b = item.getBoundingClientRect();
      const c = horiz.getBoundingClientRect();
      if (b.left < c.left) horiz.scrollLeft += b.left - c.left - 8;
      else if (b.right > c.right) horiz.scrollLeft += b.right - c.right + 8;
    }
    if (vert) {
      const b = item.getBoundingClientRect();
      const c = vert.getBoundingClientRect();
      if (b.top < c.top) vert.scrollTop += b.top - c.top - 8;
      else if (b.bottom > c.bottom) vert.scrollTop += b.bottom - c.bottom + 8;
    }
  }

  function wireFilter() {
    const input = grid.querySelector("#terimler-filter-input");
    const countEl = grid.querySelector("#terimler-rail-count");
    if (!input) return;
    const entries = Array.from(grid.querySelectorAll(".terim-entry"));
    const total = entries.length;
    function setCount(n) {
      if (!countEl) return;
      countEl.textContent =
        n === total
          ? tt({ tr: total + " terim", en: total + " terms", pt: total + " termos" })
          : tt({ tr: n + " / " + total + " terim", en: n + " / " + total + " terms", pt: n + " / " + total + " termos" });
    }
    function apply() {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      entries.forEach((el) => {
        const hit = !q || el.dataset.search.indexOf(q) !== -1;
        el.hidden = !hit;
        if (hit) shown++;
      });
      grid.querySelectorAll(".terimler-group").forEach((sec) => {
        const any = sec.querySelector(".terim-entry:not([hidden])");
        sec.classList.toggle("is-empty", !any);
        const empty = sec.querySelector(".terimler-group__empty");
        if (empty) empty.hidden = !!any;
      });
      setCount(shown);
    }
    input.addEventListener("input", apply);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && input.value) {
        e.stopPropagation();
        input.value = "";
        apply();
      }
    });
    setCount(total);
  }

  function render() {
    if (!glossaryData) return;
    renderList();
  }

  function kaynaklarHtml(kaynaklar, id) {
    if (!kaynaklar || !kaynaklar.length) return "";
    return `<div class="insight-group">${kaynaklar
      .map(
        (k, i) => `<details class="insight" ${i === 0 ? "open" : ""}>
          <summary>${k.kaynak_adi ? k.kaynak_adi : tt({ tr: `Cilt ${k.cilt}`, en: `Volume ${k.cilt}`, pt: `Volume ${k.cilt}` })}</summary>
          <p>${linkify(k.alinti_tr, "terimler", id)}</p>
          ${k.not_tr ? `<cite>${linkify(k.not_tr, "terimler", id)}</cite>` : ""}
        </details>`
      )
      .join("")}</div>`;
  }

  // Her grup için elle seçilmiş, sabit bir ton -- index'e bağlı rastgele bir
  // gökkuşağı yerine, sitenin öbür yerlerindeki (Sırlar/Hâller/Sorular) muted
  // paletlerle aynı ruhta, kasıtlı olarak seçilmiş renkler.
  const GROUP_HUE = {
    "toz-nitelik": 35,
    "siniflandirma": 200,
    "sebep-sonuc": 15,
    "varlik-mertebesi": 265,
    "kozmik-hiyerarsi": 225,
    "kopru-kavram": 185,
    "itibar-edilmez": 350,
    "halvet-perdeleri": 300,
    "sahv-sekr": 20,
    "velayet-risalet": 45,
    "lafza-i-celal": 250,
    "ahad-vahid": 210,
    "nefsin-gucleri": 5,
    "mebde-mead": 330,
    "nubuvvetin-zarureti": 40,
    "vahyin-mertebeleri": 190,
    "hayir-ve-ser": 100,
    "tezkire-i-erbaa": 275,
    "firaset": 55,
    "kutbiyet-hiyerarsisi": 165,
    "ahval-makamat": 70,
    "kurani-kozmoloji": 235,
  };
  function groupHue(groupId) {
    return GROUP_HUE[groupId] !== undefined ? GROUP_HUE[groupId] : 40;
  }

  function relatedTermsHtml(t) {
    const related = (t.iliskili_kavramlar || [])
      .map((id) => glossaryData.terms[id])
      .filter(Boolean);
    if (!related.length) return "";
    const chips = related
      .map((r) => `<button class="bookmap-concept-tag bookmap-concept-tag--group" data-term="${r.id}" style="--tag-hue:${groupHue(r.group)}">${tt(r.title)}</button>`)
      .join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "İlişkili Terimler", en: "Related Terms", pt: "Termos Relacionados" })}</p>
      <div class="bookmap-concept-tags">${chips}</div>`;
  }

  function celisenYorumlarHtml(t) {
    const views = t.celisen_yorumlar || [];
    if (!views.length) return "";
    const cards = views
      .map(
        (v) => `<div class="divergent-view">
          <p class="divergent-view__kaynak">${v.kaynak}</p>
          <p>${linkify(tt(v.gorus), "terimler", t.id)}</p>
        </div>`
      )
      .join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Çelişen Yorumlar", en: "Differing Readings", pt: "Leituras Divergentes" })}</p>
      <div class="divergent-views">${cards}</div>
      ${t.celisen_yorumlar_not ? `<p class="divergent-views__not">${linkify(tt(t.celisen_yorumlar_not), "terimler", t.id)}</p>` : ""}`;
  }

  // Terim gruplarındaki GROUP_HUE'ya paralel, ama bölüm bazında: her görünüm
  // (ontoloji/esma/hal/...) kendi sabit tonuyla ayırt edilsin diye.
  const VIEW_HUE = {
    ontoloji: 40,
    esma: 200,
    hal: 265,
    terimler: 15,
    sorular: 225,
    futuhat: 340,
    sirlar: 100,
    cizimler: 185,
  };

  function siteLinksHtml(t) {
    const links = t.site_baglantilari || [];
    if (!links.length) return "";
    const VIEW_LABEL = {
      ontoloji: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
      esma: { tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" },
      hal: { tr: "Hâller", en: "States", pt: "Estados" },
      terimler: { tr: "Terimler", en: "Terms", pt: "Termos" },
      sorular: { tr: "Sorular", en: "Questions", pt: "Perguntas" },
      futuhat: { tr: "Fütûhât Atlası", en: "Futuhat Atlas", pt: "Atlas do Futuhat" },
      sirlar: { tr: "Sırlar", en: "Mysteries", pt: "Mistérios" },
      cizimler: { tr: "Çizimler", en: "Diagrams", pt: "Diagramas" },
    };
    const chips = links
      .map((l) => `<button class="bookmap-concept-tag bookmap-concept-tag--group" data-view="${l.view}" data-id="${l.id}" style="--tag-hue:${VIEW_HUE[l.view] !== undefined ? VIEW_HUE[l.view] : 40}">${tt(VIEW_LABEL[l.view] || {})} → ${l.id}</button>`)
      .join("");
    return `<p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Haritada Gör", en: "See on the Map", pt: "Ver no Mapa" })}</p>
      <div class="bookmap-concept-tags">${chips}</div>`;
  }

  function showTermDetail(id) {
    const t = glossaryData.terms[id];
    if (!t) return;
    window.dostTrack && window.dostTrack("kavram_sayfasi_goruntulendi", { id: t.id });
    const group = groupById(t.group);

    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(group.name)}</p>
      <h2 class="detail-title">${tt(t.title)}${t.arabic ? ` <span class="detail-title__arabic">${t.arabic}</span>` : ""}</h2>
      <div class="detail-block detail-block--ibnarabi">
        <h3>${tt({ tr: "Felsefi Tanım", en: "Philosophical Definition", pt: "Definição Filosófica" })}</h3>
        <p>${linkify(tt(t.felsefi_tanim), "terimler", t.id)}</p>
      </div>
      <div class="detail-block">
        <h3>${tt({ tr: "İbn Arabî'nin Yorumu", en: "Ibn Arabi's Interpretation", pt: "A Interpretação de Ibn Arabi" })}</h3>
        <p>${linkify(tt(t.ibn_arabi_yorumu), "terimler", t.id)}</p>
      </div>
      <div class="detail-analogy">
        <p class="detail-analogy__label">${tt({ tr: "Bir benzetmeyle", en: "In one analogy", pt: "Numa analogia" })}</p>
        <p>${linkify(tt(t.analogy), "terimler", t.id)}</p>
      </div>
      ${groupDiagramHtml(group)}
      ${kaynaklarHtml(t.kaynaklar, t.id)}
      ${celisenYorumlarHtml(t)}
      ${relatedTermsHtml(t)}
      ${siteLinksHtml(t)}
    `;

    detailContent.querySelectorAll(".bookmap-concept-tag[data-term]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.dostTrack && window.dostTrack("ilgili_kavram_secildi", { from: id, to: btn.dataset.term });
        showTermDetail(btn.dataset.term);
      });
    });
    detailContent.querySelectorAll(".bookmap-concept-tag[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.__dostNav && window.__dostNav.goTo(btn.dataset.view, btn.dataset.id);
      });
    });
    detailContent.querySelectorAll(".term-diagram-svg-wrap").forEach((el) => {
      el.addEventListener("click", () => openDiagramLightbox(Number(el.dataset.diagramIndex)));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDiagramLightbox(Number(el.dataset.diagramIndex));
        }
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
        render();
        if (id) showTermDetail(id);
      });
    },
    onLangChange() {
      if (!glossaryData) return;
      render();
    },
  };
})();
