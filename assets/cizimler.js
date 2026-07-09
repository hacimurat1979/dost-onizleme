(function () {
  "use strict";

  const I18n = window.DostI18n;
  const wrap = document.getElementById("cizimler-wrap");
  const listEl = document.getElementById("cizimler-list");
  if (!wrap || !listEl) return;

  let data = null;
  let fetchPromise = null;

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function fetchData() {
    if (data) return Promise.resolve(data);
    if (fetchPromise) return fetchPromise;
    fetchPromise = fetch("data/ibn-arabi/futuhat-cizimleri.json")
      .then((r) => r.json())
      .then((d) => {
        data = d;
        return d;
      })
      .catch((err) => {
        console.error("Fütûhât çizimleri yüklenemedi / Failed to load Futuhat diagrams", err);
        return null;
      });
    return fetchPromise;
  }

  // İbn Arabî'nin Fütûhât 371. bölüme kendi eliyle çizdiği şekillerin,
  // akademik tasvirlere dayanan özgün SVG yeniden çizimleri.
  const cizimRenderers = {
    "bulut-sureti": (d) => `
      <svg class="cizim-card__svg" viewBox="0 0 320 340" role="img" aria-label="${tt(d.outer)}">
        <circle class="term-diagram-node--dashed" cx="160" cy="175" r="150"/>
        <text class="term-diagram-label--small" x="160" y="20" text-anchor="middle">${tt(d.outer)}</text>
        <polygon class="term-diagram-node" points="160,58 132,112 188,112"/>
        <text class="term-diagram-label--small" x="160" y="98" text-anchor="middle">${tt(d.intellect)}</text>
        <rect class="term-diagram-node" x="105" y="122" width="110" height="52" rx="4"/>
        <text class="term-diagram-label--small" x="160" y="138" text-anchor="middle">${tt(d.soul)}</text>
        <circle class="term-diagram-node--faint term-diagram-node--sm" cx="130" cy="160" r="13"/>
        <text class="term-diagram-note" x="130" y="164" text-anchor="middle">${tt(d.faculty1)}</text>
        <circle class="term-diagram-node--faint term-diagram-node--sm" cx="190" cy="160" r="13"/>
        <text class="term-diagram-note" x="190" y="164" text-anchor="middle">${tt(d.faculty2)}</text>
        <rect class="term-diagram-node" x="115" y="192" width="90" height="90"/>
        <line class="term-diagram-tether" x1="115" y1="192" x2="205" y2="282"/>
        <line class="term-diagram-tether" x1="205" y1="192" x2="115" y2="282"/>
        <text class="term-diagram-note" x="160" y="204" text-anchor="middle">${tt(d.heat)}</text>
        <text class="term-diagram-note" x="160" y="278" text-anchor="middle">${tt(d.cold)}</text>
        <text class="term-diagram-note" x="122" y="242" text-anchor="middle">${tt(d.wet)}</text>
        <text class="term-diagram-note" x="198" y="242" text-anchor="middle">${tt(d.dry)}</text>
        <text class="term-diagram-label" x="160" y="235" text-anchor="middle">${tt(d.nature)}</text>
        <circle class="term-diagram-node--accent" cx="160" cy="292" r="26"/>
        <text class="term-diagram-label--small" x="160" y="297" text-anchor="middle">${tt(d.core)}</text>
      </svg>
    `,
    "ars-sureti": (d) => `
      <svg class="cizim-card__svg" viewBox="0 0 300 300" role="img" aria-label="${tt(d.throne)}">
        <circle class="term-diagram-node--dashed" cx="150" cy="150" r="135"/>
        <text class="term-diagram-label--small" x="150" y="24" text-anchor="middle">${tt(d.outer)}</text>
        <circle class="term-diagram-node" cx="150" cy="150" r="95"/>
        <text class="term-diagram-label" x="150" y="63" text-anchor="middle">${tt(d.pillar1)}</text>
        <text class="term-diagram-label" x="150" y="253" text-anchor="middle">${tt(d.pillar3)}</text>
        <text class="term-diagram-label" x="47" y="154" text-anchor="middle">${tt(d.pillar4)}</text>
        <text class="term-diagram-label" x="253" y="154" text-anchor="middle">${tt(d.pillar2)}</text>
        <circle class="term-diagram-node--sm" cx="130" cy="235" r="5"/>
        <circle class="term-diagram-node--sm" cx="170" cy="235" r="5"/>
        <circle class="term-diagram-node--accent" cx="150" cy="150" r="42"/>
        <text class="term-diagram-label--small" x="150" y="155" text-anchor="middle">${tt(d.core)}</text>
        <text class="term-diagram-note" x="150" y="218" text-anchor="middle">${tt(d.feet)}</text>
      </svg>
    `,
    "cadir-sureti": (d) => {
      const radii = [25, 45, 65, 85, 105, 125, 145];
      const cx = 160, baseY = 230;
      const arcs = radii.map((r) => `<path class="term-diagram-arrow" d="M${cx - r},${baseY} A${r},${r} 0 0,1 ${cx + r},${baseY}" fill="none"/>`).join("");
      const kingdoms = [d.kingdom1, d.kingdom2, d.kingdom3, d.kingdom4];
      const kx = [70, 130, 190, 250];
      const kNodes = kingdoms.map((k, i) => `
        <circle class="term-diagram-node--faint" cx="${kx[i]}" cy="278" r="23"/>
        <text class="term-diagram-note" x="${kx[i]}" y="282" text-anchor="middle">${tt(k)}</text>
      `).join("");
      return `
        <svg class="cizim-card__svg" viewBox="0 0 320 320" role="img" aria-label="${tt(d.pillar)}">
          ${arcs}
          <text class="term-diagram-note" x="160" y="200" text-anchor="middle">${tt(d.domes[0])}</text>
          <text class="term-diagram-note" x="160" y="80" text-anchor="middle">${tt(d.domes[6])}</text>
          <line class="term-diagram-arrow" x1="160" y1="228" x2="160" y2="20" marker-end="url(#cizimArrowEnd)"/>
          <text class="term-diagram-label--small" x="196" y="128" text-anchor="middle">${tt(d.pillar)}</text>
          ${kNodes}
        </svg>
      `;
    },
    "esma-hazretleri-sureti": (d) => {
      const pts = [
        [47.8, 134.5], [75.4, 179.2], [118.5, 209.4], [170.0, 220.0],
        [221.5, 209.4], [264.6, 179.2], [292.2, 134.5],
      ];
      const nodes = d.names.map((n, i) => `
        <line class="term-diagram-tether" x1="170" y1="90" x2="${pts[i][0]}" y2="${pts[i][1]}"/>
      `).join("") + d.names.map((n, i) => `
        <circle class="term-diagram-node${i === 0 ? " term-diagram-node--accent" : ""}" cx="${pts[i][0]}" cy="${pts[i][1]}" r="21"/>
        <text class="term-diagram-note" x="${pts[i][0]}" y="${pts[i][1] + 4}" text-anchor="middle">${tt(n)}</text>
      `).join("");
      return `
        <svg class="cizim-card__svg" viewBox="0 0 340 260" role="img" aria-label="${tt(d.center)}">
          <line class="term-diagram-tether" x1="110" y1="45" x2="170" y2="90"/>
          <line class="term-diagram-tether" x1="230" y1="45" x2="170" y2="90"/>
          <circle class="term-diagram-node--dashed term-diagram-node--sm" cx="110" cy="45" r="20"/>
          <text class="term-diagram-note" x="110" y="49" text-anchor="middle">${tt(d.parent1)}</text>
          <circle class="term-diagram-node--dashed term-diagram-node--sm" cx="230" cy="45" r="20"/>
          <text class="term-diagram-note" x="230" y="49" text-anchor="middle">${tt(d.parent2)}</text>
          ${nodes}
          <circle class="term-diagram-node--accent" cx="170" cy="90" r="30"/>
          <text class="term-diagram-label--small" x="170" y="95" text-anchor="middle">${tt(d.center)}</text>
        </svg>
      `;
    },
  };

  const CIZIM_DEFS = `
    <svg width="0" height="0" style="position:absolute">
      <defs>
        <marker id="cizimArrowEnd" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" class="term-diagram-arrowhead"/>
        </marker>
      </defs>
    </svg>
  `;

  function cardHtml(item) {
    const renderer = cizimRenderers[item.diagram.type];
    const svg = renderer ? renderer(item.diagram) : "";
    return `
      <article class="cizim-card">
        <p class="cizim-card__ref">${item.source_ref}</p>
        <h3 class="cizim-card__name">${tt(item.name)}</h3>
        <div class="cizim-card__svg-wrap">${svg}</div>
        <p class="cizim-card__desc">${tt(item.description)}</p>
      </article>
    `;
  }

  function render() {
    if (!data) return;
    const cards = data.diagrams.map(cardHtml).join("");
    const sources = (data.sources || []).map((s) => `<li>${s}</li>`).join("");
    listEl.innerHTML = `
      ${CIZIM_DEFS}
      <p class="cizimler-intro">${tt(data.intro)}</p>
      ${cards}
      <ul class="cizimler-sources">${sources}</ul>
    `;
  }

  window.__cizimlerApp = {
    activate() {
      fetchData().then(() => render());
    },
    onLangChange() {
      render();
    },
  };
})();
