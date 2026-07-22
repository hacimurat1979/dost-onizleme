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

  function linkify(text, id) {
    return window.__dostCrossLink ? window.__dostCrossLink.linkify(text, "cizimler", id) : text;
  }

  function fetchData() {
    if (data) return Promise.resolve(data);
    if (fetchPromise) return fetchPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("cizimler-wrap");
    fetchPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/futuhat-cizimleri.json")
      .then((d) => {
        data = d;
        if (window.DostViewStatus) window.DostViewStatus.hide("cizimler-wrap");
        return d;
      })
      .catch((err) => {
        console.error("Fütûhât çizimleri yüklenemedi / Failed to load Futuhat diagrams", err);
        fetchPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("cizimler-wrap", () => window.__cizimlerApp.activate());
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
    "iki-yol-sureti": (d) => `
      <svg class="cizim-card__svg" viewBox="0 0 320 170" role="img" aria-label="${tt(d.straight)}">
        <circle class="term-diagram-node--sm" cx="30" cy="85" r="8"/>
        <text class="term-diagram-note" x="30" y="115" text-anchor="middle">${tt(d.start)}</text>
        <circle class="term-diagram-node--accent term-diagram-node--sm" cx="290" cy="85" r="8"/>
        <text class="term-diagram-note" x="290" y="115" text-anchor="middle">${tt(d.end)}</text>
        <line class="term-diagram-arrow term-diagram-arrow--oneway" x1="40" y1="85" x2="278" y2="85" marker-end="url(#cizimArrowEnd)"/>
        <text class="term-diagram-label--small" x="160" y="65" text-anchor="middle">${tt(d.straight)}</text>
        <path class="term-diagram-arrow term-diagram-arrow--dashed" d="M40,85 Q90,35 160,85 Q230,135 278,85" fill="none"/>
        <text class="term-diagram-label--small" x="160" y="150" text-anchor="middle">${tt(d.crooked)}</text>
      </svg>
    `,
    "nokta-muhit-sureti": (d) => `
      <svg class="cizim-card__svg" viewBox="0 0 320 320" role="img" aria-label="${tt(d.point)}">
        <circle class="term-diagram-node--dashed" cx="160" cy="170" r="140"/>
        <text class="term-diagram-note" x="245" y="90" text-anchor="middle">${tt(d.circumference)}</text>
        <line class="term-diagram-tether" x1="160" y1="30" x2="60" y2="220"/>
        <line class="term-diagram-tether" x1="160" y1="30" x2="90" y2="260"/>
        <line class="term-diagram-tether" x1="160" y1="30" x2="160" y2="290"/>
        <line class="term-diagram-tether" x1="160" y1="30" x2="230" y2="260"/>
        <line class="term-diagram-tether" x1="160" y1="30" x2="260" y2="220"/>
        <circle class="term-diagram-node--accent term-diagram-node--sm" cx="160" cy="30" r="9"/>
        <text class="term-diagram-label--small" x="160" y="18" text-anchor="middle">${tt(d.point)}</text>
        <text class="term-diagram-note" x="160" y="235" text-anchor="middle">${tt(d.gap)}</text>
      </svg>
    `,
    "insan-i-kamil-yakinsama": (d) => `
      <svg class="cizim-card__svg" viewBox="0 0 320 200" role="img" aria-label="${tt(d.center)}">
        <line class="term-diagram-arrow" x1="55" y1="50" x2="222" y2="95" marker-end="url(#cizimArrowEnd)"/>
        <line class="term-diagram-arrow" x1="55" y1="100" x2="218" y2="100" marker-end="url(#cizimArrowEnd)"/>
        <line class="term-diagram-arrow" x1="55" y1="150" x2="222" y2="105" marker-end="url(#cizimArrowEnd)"/>
        <circle class="term-diagram-node--sm" cx="40" cy="50" r="14"/>
        <text class="term-diagram-note" x="40" y="30" text-anchor="middle">${tt(d.source1)}</text>
        <circle class="term-diagram-node--sm" cx="40" cy="100" r="14"/>
        <text class="term-diagram-note" x="40" y="80" text-anchor="middle">${tt(d.source2)}</text>
        <circle class="term-diagram-node--sm" cx="40" cy="150" r="14"/>
        <text class="term-diagram-note" x="40" y="130" text-anchor="middle">${tt(d.source3)}</text>
        <path class="term-diagram-mirror" d="M245,65 A50,50 0 0,1 245,135" fill="none"/>
        <text class="term-diagram-note" x="272" y="104" text-anchor="middle">${tt(d.shadow)}</text>
        <circle class="term-diagram-node--accent" cx="240" cy="100" r="28"/>
        <text class="term-diagram-label--small" x="240" y="105" text-anchor="middle">${tt(d.center)}</text>
      </svg>
    `,
    "uc-mertebe-cicegi": (d) => `
      <svg class="cizim-card__svg" viewBox="0 0 340 340" role="img" aria-label="${tt(d.center)}">
        <circle class="term-diagram-node--faint" cx="170" cy="55" r="58"/>
        <circle class="term-diagram-node--faint" cx="55" cy="170" r="58"/>
        <circle class="term-diagram-node--faint" cx="285" cy="170" r="58"/>
        <circle class="term-diagram-node--faint" cx="170" cy="285" r="58"/>
        <text class="term-diagram-note" x="170" y="28" text-anchor="middle">${tt(d.fire)}</text>
        <text class="term-diagram-note" x="28" y="170" text-anchor="middle">${tt(d.air)}</text>
        <text class="term-diagram-note" x="312" y="170" text-anchor="middle">${tt(d.earth)}</text>
        <text class="term-diagram-note" x="170" y="317" text-anchor="middle">${tt(d.water)}</text>
        <text class="term-diagram-note" x="103" y="103" text-anchor="middle">${tt(d.soul)}</text>
        <text class="term-diagram-note" x="237" y="103" text-anchor="middle">${tt(d.intellect)}</text>
        <text class="term-diagram-note" x="237" y="242" text-anchor="middle">${tt(d.nature)}</text>
        <text class="term-diagram-note" x="103" y="242" text-anchor="middle">${tt(d.particles)}</text>
        <circle class="term-diagram-node" cx="170" cy="115" r="30"/>
        <circle class="term-diagram-node" cx="115" cy="170" r="30"/>
        <circle class="term-diagram-node" cx="225" cy="170" r="30"/>
        <circle class="term-diagram-node" cx="170" cy="225" r="30"/>
        <text class="term-diagram-label--small" x="170" y="120" text-anchor="middle">${tt(d.life)}</text>
        <text class="term-diagram-label--small" x="119" y="174" text-anchor="middle">${tt(d.power)}</text>
        <text class="term-diagram-label--small" x="221" y="174" text-anchor="middle">${tt(d.knowledge)}</text>
        <text class="term-diagram-label--small" x="170" y="230" text-anchor="middle">${tt(d.will)}</text>
        <circle class="term-diagram-node--accent" cx="170" cy="170" r="32"/>
        <text class="term-diagram-label--small" x="170" y="175" text-anchor="middle">${tt(d.center)}</text>
      </svg>
    `,
    "dort-makam-sureti": (d) => `
      <svg class="cizim-card__svg" viewBox="0 0 260 260" role="img" aria-label="${tt(d.q1)}">
        <circle class="term-diagram-node--dashed" cx="130" cy="130" r="108"/>
        <line class="term-diagram-axis" x1="130" y1="24" x2="130" y2="236"/>
        <line class="term-diagram-axis" x1="24" y1="130" x2="236" y2="130"/>
        <text class="term-diagram-label--small" x="130" y="75" text-anchor="middle">${tt(d.q1)}</text>
        <text class="term-diagram-label--small" x="185" y="135" text-anchor="middle">${tt(d.q2)}</text>
        <text class="term-diagram-label--small" x="130" y="195" text-anchor="middle">${tt(d.q3)}</text>
        <text class="term-diagram-label--small" x="75" y="135" text-anchor="middle">${tt(d.q4)}</text>
      </svg>
    `,
    "arz-i-hasr-sureti": (d) => `
      <svg class="cizim-card__svg" viewBox="0 0 300 390" role="img" aria-label="${tt(d.throne)}">
        <polygon class="term-diagram-node--accent" points="150,20 190,55 150,90 110,55"/>
        <text class="term-diagram-label--small" x="150" y="60" text-anchor="middle">${tt(d.throne)}</text>
        <line class="term-diagram-tether" x1="150" y1="90" x2="150" y2="112"/>
        <circle class="term-diagram-node" cx="150" cy="135" r="23"/>
        <text class="term-diagram-note" x="150" y="139" text-anchor="middle">${tt(d.spirit)}</text>
        <circle class="term-diagram-node--faint" cx="75" cy="200" r="30"/>
        <text class="term-diagram-note" x="75" y="204" text-anchor="middle">${tt(d.bookRight)}</text>
        <circle class="term-diagram-node--faint" cx="225" cy="200" r="30"/>
        <text class="term-diagram-note" x="225" y="204" text-anchor="middle">${tt(d.bookLeft)}</text>
        <circle class="term-diagram-node--dashed term-diagram-node--sm" cx="150" cy="255" r="16"/>
        <text class="term-diagram-note" x="150" y="285" text-anchor="middle">${tt(d.death)}</text>
        <line class="term-diagram-arrow" x1="150" y1="255" x2="212" y2="308" marker-end="url(#cizimArrowEnd)"/>
        <text class="term-diagram-note" x="195" y="298" text-anchor="middle">${tt(d.sirat)}</text>
        <path class="term-diagram-node--faint" d="M175,340 A45,45 0 0,1 265,340 Z"/>
        <text class="term-diagram-note" x="220" y="335" text-anchor="middle">${tt(d.hell)}</text>
        <circle class="term-diagram-node--accent" cx="80" cy="330" r="48"/>
        <text class="term-diagram-label--small" x="80" y="334" text-anchor="middle">${tt(d.paradiseMeadow)}</text>
      </svg>
    `,
    "kesib-ur-ruya-sureti": (d) => `
      <svg class="cizim-card__svg" viewBox="0 0 300 300" role="img" aria-label="${tt(d.center)}">
        <line class="term-diagram-tether" x1="150" y1="150" x2="150" y2="80"/>
        <line class="term-diagram-tether" x1="150" y1="150" x2="75" y2="150"/>
        <line class="term-diagram-tether" x1="150" y1="150" x2="225" y2="150"/>
        <line class="term-diagram-tether" x1="150" y1="150" x2="150" y2="220"/>
        <circle class="term-diagram-node--dashed" cx="150" cy="65" r="28"/>
        <text class="term-diagram-note" x="150" y="69" text-anchor="middle">${tt(d.prophets)}</text>
        <circle class="term-diagram-node--dashed" cx="55" cy="150" r="28"/>
        <text class="term-diagram-note" x="55" y="154" text-anchor="middle">${tt(d.saints)}</text>
        <circle class="term-diagram-node--dashed" cx="245" cy="150" r="28"/>
        <text class="term-diagram-note" x="245" y="154" text-anchor="middle">${tt(d.messengers)}</text>
        <circle class="term-diagram-node--dashed" cx="150" cy="235" r="28"/>
        <text class="term-diagram-note" x="150" y="239" text-anchor="middle">${tt(d.believers)}</text>
        <circle class="term-diagram-node--accent" cx="150" cy="150" r="40"/>
        <text class="term-diagram-label--small" x="150" y="155" text-anchor="middle">${tt(d.center)}</text>
      </svg>
    `,
    "suretud-dirah": (d) => `
      <svg class="cizim-card__svg" viewBox="0 0 200 200" role="img" aria-label="${tt(d.label)}">
        <path class="term-diagram-node--accent" d="M55,30 L145,30 L145,140 A45,45 0 0 1 55,140 Z"/>
        <text class="term-diagram-label--small" x="100" y="90" text-anchor="middle">${tt(d.label)}</text>
      </svg>
    `,
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
        <div class="cizim-card__svg-wrap" data-cizim-id="${item.id}" role="button" tabindex="0"
             aria-label="${tt({ tr: "Büyüt", en: "Enlarge", pt: "Ampliar" })}">${svg}</div>
        <p class="cizim-card__desc">${linkify(tt(item.description), item.id)}</p>
      </article>
    `;
  }

  // --- Büyütme (lightbox) ---
  function openLightbox(itemId) {
    if (!data) return;
    const item = data.diagrams.find((x) => x.id === itemId);
    if (!item) return;
    const renderer = cizimRenderers[item.diagram.type];
    const svg = renderer ? renderer(item.diagram) : "";
    window.DostLightbox.open({
      closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
      svgHtml: CIZIM_DEFS + svg,
      ref: item.source_ref,
      name: tt(item.name),
    });
  }

  function render() {
    if (!data) return;
    const cards = data.diagrams.map(cardHtml).join("");
    const sources = (data.sources || []).map((s) => `<li>${s}</li>`).join("");
    listEl.innerHTML = `
      ${CIZIM_DEFS}
      <p class="cizimler-intro">${linkify(tt(data.intro), null)}</p>
      ${cards}
      <ul class="cizimler-sources">${sources}</ul>
    `;
    listEl.querySelectorAll(".cizim-card__svg-wrap").forEach((el) => {
      el.addEventListener("click", () => openLightbox(el.dataset.cizimId));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(el.dataset.cizimId);
        }
      });
    });
    // Sadece bu görünüm gerçekten açıkken kapat -- paylaşılan lightbox artık
    // tüm görünümler arasında tek bir örnek olduğu için, arka planda (görünür
    // değilken) bir dil değişimi başka bir görünümün açık lightbox'ını
    // yanlışlıkla kapatmasın.
    if (!wrap.hidden) window.DostLightbox.close();
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
