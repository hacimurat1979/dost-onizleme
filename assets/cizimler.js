(function () {
  "use strict";

  const I18n = window.DostI18n;
  const wrap = document.getElementById("cizimler-wrap");
  const listEl = document.getElementById("cizimler-list");
  if (!wrap || !listEl) return;

  let data = null;
  let fetchPromise = null;

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)

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
    <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
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
        <h2 class="cizim-card__name">${tt(item.name)}</h2>
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
    // CIZIM_DEFS'i burada TEKRAR eklemiyoruz: render()'ın zaten listEl'e
    // yazdığı tek kopya, id="cizimArrowEnd" SVG belge genelinde çözüldüğü
    // için (url(#...) referansı DOM'daki herhangi bir yerden çalışır) burada
    // da geçerli. İkinci bir kopya yalnız aynı id'yi mükerrer basardı --
    // görünürde belirti yoktu ama geçersiz HTML'di (UI denetimi bulgusu).
    window.DostLightbox.open({
      closeLabel: tt({ tr: "Kapat", en: "Close", pt: "Fechar" }),
      svgHtml: svg,
      ref: item.source_ref,
      name: tt(item.name),
    });
  }

  // 371. bab'ın dokuz haritası (2026-08-21 kullanıcı isteği): eskiden ayrı,
  // bağımsız bir "sahne" sayfasıydı (futuhat-371.html); kullanıcı tüm
  // sahne sistemini kaldırıp bu haritayı "en uygun olduğunu düşündüğün
  // yere" taşımamızı istedi. Yukarıdaki statik kartların zaten aynı 371.
  // bab'ın çizimlerini tek tek gösterdiği bu görünüm en doğal ev --
  // sahnenin kendi metni de zaten "bu dokuz harita, Çizimler görünümündeki
  // öteki tarihî şemalarla birlikte duruyor" diyordu. Çizim geometrisi
  // (drawShared/drawUnique) FACSİMİLE'dir, aynen taşındı; yalnız renkler
  // sahnenin kendi --gold/--liminal/--text değişkenlerinden bu sayfanın
  // --series-theme/--text-primary token'larına çevrildi.
  const NS = 'http://www.w3.org/2000/svg';
  const BIRLESIK_STEPS = [
    { id: 'ama', shortLabel: { tr: 'Bulut', en: 'The Cloud', pt: 'A Nuvem' },
      label: { tr: 'Bulut (Amâ)', en: 'The Cloud (al-ʿamāʾ)', pt: 'A Nuvem (al-ʿamāʾ)' },
      gloss: { tr: 'Dizinin başlangıcı: varlığın ilk mertebeleri, "merhametli bir buhar" olan Bulut\'ta açılıyor. "Dünyanın sûreti bütünüyle küresel bir dairedir" -- Şeyh\'in kendi sözü.',
        en: 'The start of the sequence: the first levels of being unfold within the Cloud, "a merciful vapor." "The form of the world in its entirety is a spherical circle" — in the Shaykh\'s own words.',
        pt: 'O início da sequência: os primeiros níveis do ser desdobram-se na Nuvem, "um vapor misericordioso." "A forma do mundo na sua totalidade é um círculo esférico" — nas palavras do próprio Xeique.' },
      cite: 'Fütûhât, 9.316 (Tyser 2023, böl. 4.1; TİEM/Evkaf Müzesi 1870, vr. 90a)' },
    { id: 'ars-kursi', shortLabel: { tr: 'Arş – Kürsî', en: 'Throne – Footstool', pt: 'Trono – Escabelo' },
      label: { tr: 'Arş-ı İstivâ, Kürsî, İki Ayak, Su, Hava, Karanlık', en: 'The Throne of Sitting, Footstool, Two Feet, Water, Air, Darkness', pt: 'O Trono de Assento, Escabelo, Dois Pés, Água, Ar, Escuridão' },
      gloss: { tr: 'Bir önceki haritanın en iç dairesine iniliyor. Arş dört unsura (ateş, hava, su, toprak) dayanıyor. Metindeki "iki ayak" imgesi, cismi teşbihe düşürmeden okunur -- biri cennette, biri cehennemde, ikisi de Kürsî\'nin üstünde.',
        en: 'Descends into the innermost circle of the previous map. The Throne rests on four elements (fire, air, water, earth). The text\'s image of "two feet" is read without lapsing into anthropomorphism — one set in Paradise, the other in Hell, both resting on the Footstool.',
        pt: 'Desce para o círculo mais interior do mapa anterior. O Trono assenta em quatro elementos (fogo, ar, água, terra). A imagem dos "dois pés" no texto é lida sem cair no antropomorfismo — um no Paraíso, o outro no Inferno, ambos sobre o Escabelo.' },
      cite: 'Tyser 2023, böl. 4.2; TİEM/Evkaf Müzesi 1870, vr. 90b' },
    { id: 'atlas', shortLabel: { tr: 'Atlas Feleği', en: 'Sphere of Atlas', pt: 'Esfera de Atlas' },
      label: { tr: 'Atlas Feleği, Cennetler, Sabit Yıldızlar Küresi, Tûbâ Ağacı', en: 'The Sphere of Atlas, the Gardens, the Root of the Starry Sphere, the Tree of Ṭūbā', pt: 'A Esfera de Atlas, os Jardins, a Raiz da Esfera Estelar, a Árvore de Ṭūbā' },
      gloss: { tr: 'İniş sürüyor. Atlas feleği ile sabit yıldızlar küresi arasında sekiz cennet konağı sıralanıyor -- her biri, Şeriat\'a tâbi bir organa (göz, kulak, dil, el, mide, üreme organı, ayak, kalp) karşılık geliyor.',
        en: 'The descent continues. Between the sphere of Atlas and the sphere of the fixed stars, eight paradisal abodes are arrayed — each corresponding to a bodily member subject to the Law (eye, ear, tongue, hand, stomach, reproductive organ, leg, heart).',
        pt: 'A descida continua. Entre a esfera de Atlas e a esfera das estrelas fixas, alinham-se oito moradas paradisíacas — cada uma correspondendo a um membro do corpo sujeito à Lei (olho, ouvido, língua, mão, estômago, órgão reprodutor, perna, coração).' },
      cite: 'Tyser 2023, böl. 4.3; TİEM/Evkaf Müzesi 1870, vr. 91a' },
    { id: 'sabit-yildizlar-insan', shortLabel: { tr: 'Sabit Yıldızlar', en: 'Fixed Stars', pt: 'Estrelas Fixas' },
      label: { tr: 'Sabit Yıldızlar Küresi, Gökkubbeler, Yer, Dört Mertebe ve İnsan', en: 'The Sphere of the Fixed Stars, the Domes of the Heavens, the Earth, the Four Realms, and Man', pt: 'A Esfera das Estrelas Fixas, as Cúpulas dos Céus, a Terra, os Quatro Reinos e o Homem' },
      gloss: { tr: 'Bir çadır biçiminde: dünyanın üstünde yedi gök, yedi gezegen. Bütün küreleri dikey bir "direk" kesiyor -- Kur\'an\'daki görünmez direğe (13:2) işaret eden bu çizgi, İbn Arabî\'ye göre İnsân-ı Kâmil\'dir; gökleri yeryüzüne düşmekten O tutuyor.',
        en: 'In the shape of a tent: seven heavens above the earth, seven planets. A vertical "pillar" crosses all the spheres — this line, pointing to the invisible pillar of the Qur\'an (13:2), is, for Ibn al-ʿArabī, the Perfect Man; through him God holds the heavens from falling upon the earth.',
        pt: 'Em forma de tenda: sete céus acima da terra, sete planetas. Um "pilar" vertical atravessa todas as esferas — esta linha, apontando para o pilar invisível do Alcorão (13:2), é, para Ibn al-ʿArabī, o Homem Perfeito; é através dele que Deus impede os céus de caírem sobre a terra.' },
      cite: 'Fütûhât, 9.313 (Tyser 2023, böl. 4.4; TİEM/Evkaf Müzesi 1870, vr. 91b)' },
    { id: 'arz-i-hasr', shortLabel: { tr: 'Haşir Yeri', en: 'Gathering', pt: 'Reunião' },
      label: { tr: 'Haşir Yeri, Ayrım ve Hüküm Arşı, Melek Safları', en: 'The Land of Gathering, the Throne of Separation and Judgement, the Rows of Angels', pt: 'A Terra da Reunião, o Trono de Separação e Julgamento, as Fileiras de Anjos' },
      gloss: { tr: 'Kıldan ince, kılıçtan keskin sırât köprüsü cehennemin üstünde gerili. Ölümün kesilişini simgeleyen bir daire, cenneti cehennemden ayıran a\'râf çizgisiyle kesişiyor. Yedi melek safı ve sekiz sütun üzerindeki Hüküm Arşı, sahneyi yukarıdan kuşatıyor.',
        en: 'The bridge of the path (ṣirāṭ), thinner than a hair and sharper than a sword, stretches over hell. A circle symbolizing the slaughter of death intersects the line of the "heights" (al-aʿrāf) separating paradise from hell. Seven rows of angels and the Throne of Judgement, resting on eight pillars, frame the scene from above.',
        pt: 'A ponte do caminho (ṣirāṭ), mais fina que um cabelo e mais afiada que uma espada, estende-se sobre o inferno. Um círculo simbolizando o abate da morte intersecta a linha das "alturas" (al-aʿrāf) que separa o paraíso do inferno. Sete fileiras de anjos e o Trono do Julgamento, apoiado em oito pilares, emolduram a cena vista do alto.' },
      cite: 'Tyser 2023, böl. 4.5; TİEM/Evkaf Müzesi 1870, vr. 92a' },
    { id: 'cehennem-kapilari', shortLabel: { tr: 'Cehennem Kapıları', en: 'Gates of Hell', pt: 'Portões do Inferno' },
      label: { tr: 'Cehennemin Kapıları, Konakları ve İnen Dereceleri', en: 'The Gates of Hell, Its Abodes, and Its Descending Levels', pt: 'Os Portões do Inferno, as suas Moradas e Níveis Descendentes' },
      gloss: { tr: 'Cehennemin yedi kapısı, insanın Şeriat\'a tâbi yedi organına karşılık geliyor. Şemanın tam merkezinde, kalbi örten bir kapı duruyor -- insanın içindeki "gayb"ın yeri. "İnsanın dünyadaki bâtını, ahirette zâhir olur."',
        en: 'Hell\'s seven gates correspond to the seven bodily members subject to the Law. At the very center of the diagram stands a door veiling the heart — the place of the unseen within man. "What is interior in man in this world becomes exterior in the hereafter."',
        pt: 'Os sete portões do inferno correspondem aos sete membros do corpo sujeitos à Lei. No centro exato do diagrama ergue-se uma porta que vela o coração — o lugar do invisível dentro do homem. "O que é interior no homem neste mundo torna-se exterior no além."' },
      cite: 'Fütûhât, 9.356 (Tyser 2023, böl. 4.6; TİEM/Evkaf Müzesi 1870, vr. 92b)' },
    { id: 'esma-hazretleri', shortLabel: { tr: 'İlahî İsimler', en: 'Divine Names', pt: 'Nomes Divinos' },
      label: { tr: 'İlahî İsimler Huzuru, Alt Dünya, Ahiret, Berzah', en: 'The Presence of the Divine Names, the Lowest World, the Hereafter, the Intermediary World', pt: 'A Presença dos Nomes Divinos, o Mundo Inferior, o Além, o Mundo Intermédio' },
      gloss: { tr: 'İlahî isimlerin de kendi aralarında bir düzeni var: "öncüler" ve "hizmetkârlar." Varlığın sebebi olan yedi ana isim -- Hayy, Alîm, Mürîd, Kâdir, Kâil, Cevvâd, Muksit -- bu dünya, ahiret ve ikisi arasındaki berzahın kesiştiği yerde beliriyor.',
        en: 'The divine names, too, have their own order: "chiefs" and "servants." Seven principal names — the Living, the Knower, the One who wills, the One who is able, the One who speaks, the Most-Generous, the Equitable — appear at the point where this world, the hereafter, and the barzakh between them meet.',
        pt: 'Também os nomes divinos têm a sua própria ordem: "chefes" e "servos." Sete nomes principais — o Vivo, o Sabedor, Aquele que quer, Aquele que pode, Aquele que fala, o Generosíssimo, o Equânime — aparecem no ponto onde este mundo, o além, e o barzakh entre eles se encontram.' },
      cite: 'Tyser 2023, böl. 4.7; TİEM/Evkaf Müzesi 1870, vr. 93a' },
    { id: 'ruyet', shortLabel: { tr: 'Rü\'yet Tepesi', en: 'Dune of Vision', pt: 'Duna da Visão' },
      label: { tr: 'Rü\'yet Kum Tepesi — Allah\'ın yüzünün açıldığı an', en: 'The Dune of Vision — the moment God\'s face is unveiled', pt: 'A Duna da Visão — o momento em que o rosto de Deus se revela' },
      gloss: { tr: 'Cennette, halkın Allah\'ın yüzünü gördüğü belirli bir an ve yer — "beyaz misktendir."',
        en: 'A specific moment and place in paradise where the people see God\'s face — "made of white musk."',
        pt: 'Um momento e lugar específicos no paraíso onde o povo vê o rosto de Deus — "feito de almíscar branco."' },
      cite: 'Tyser 2023, böl. 4.8; TİEM/Evkaf Müzesi 1870, vr. 93b' },
    { id: 'kozmos', shortLabel: { tr: 'Kozmosun Tamamı', en: 'The Whole Cosmos', pt: 'Todo o Cosmos' },
      label: { tr: 'Kozmosun tamamı — sekiz haritanın sentezi', en: 'The entirety of the cosmos — a synthesis of eight maps', pt: 'A totalidade do cosmos — uma síntese de oito mapas' },
      gloss: { tr: 'Şeklinin merkezi, Rü\'yet Kum Tepesi\'yle aynı biçimi taşıyor -- ahiret, dünyanın tam merkezinde duruyor. İbn Arabî\'nin kendi ifadesiyle: "dünya, Bulut ile Allah\'ın bakışı arasında beliriyor."',
        en: 'The shape of its center matches that of the Dune of Vision — the hereafter sits at the very core of the world. In Ibn al-ʿArabī\'s own words: "the world appears between the Cloud and the glance of God."',
        pt: 'A forma do seu centro corresponde à da Duna da Visão — o além situa-se no próprio núcleo do mundo. Nas palavras do próprio Ibn al-ʿArabī: "o mundo aparece entre a Nuvem e o olhar de Deus."' },
      cite: 'Fütûhât, 9.461 (Tyser 2023, böl. 4.9; TİEM/Evkaf Müzesi 1870, vr. 93b-94a)' },
  ];

  // Paylaşılan taban + tekil çizgisel öğe -- futuhat-371.html'den DEĞİŞMEDEN
  // taşındı (facsimile). GORSEL_DIL.md gereği 9. haritadaki iç içe İKİ
  // eşmerkezli daire burada da yasak -- yerine merkezden dışa dört kısa
  // çizgi (bir "yıldız" işareti).
  function drawSharedBirlesik(g) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', 0); c.setAttribute('cy', 0); c.setAttribute('r', 90);
    c.setAttribute('fill', 'none'); c.setAttribute('stroke', 'var(--text-primary)');
    c.setAttribute('stroke-width', 1.4);
    c.setAttribute('opacity', 0.6);
    g.appendChild(c);
  }
  function drawUniqueBirlesik(g, idx) {
    const el = document.createElementNS(NS, 'g');
    el.setAttribute('stroke', 'var(--text-primary)');
    el.setAttribute('stroke-width', 1.6);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke-linecap', 'round');
    const addLine = (x1, y1, x2, y2) => {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      el.appendChild(l);
    };
    const addCircle = (cx, cy, r, filled) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
      if (filled) c.setAttribute('fill', 'var(--text-primary)');
      el.appendChild(c);
    };
    switch (idx) {
      case 0: addLine(-110, 0, 110, 0); break;
      case 1: addLine(0, -110, 0, 110); break;
      case 2: addLine(-78, -78, 78, 78); break;
      case 3: addLine(-78, 78, 78, -78); break;
      case 4: for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; addCircle(Math.cos(a) * 90, Math.sin(a) * 90, 4, true); } break;
      case 5: for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; addCircle(Math.cos(a) * 55, Math.sin(a) * 55, 3, true); } break;
      case 6: {
        const pts = [];
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 - Math.PI / 2; pts.push([Math.cos(a) * 88, Math.sin(a) * 88]); }
        const p = document.createElementNS(NS, 'polygon');
        p.setAttribute('points', pts.map((pt) => pt.join(',')).join(' '));
        p.setAttribute('fill', 'none');
        el.appendChild(p);
        break;
      }
      case 7: {
        const s = 88;
        const p = document.createElementNS(NS, 'polygon');
        p.setAttribute('points', `0,${-s} ${s},0 0,${s} ${-s},0`);
        el.appendChild(p);
        break;
      }
      case 8: {
        addCircle(0, 0, 4, true);
        [0, 90, 180, 270].forEach((deg) => {
          const rad = deg * Math.PI / 180;
          addLine(Math.cos(rad) * 22, Math.sin(rad) * 22, Math.cos(rad) * 40, Math.sin(rad) * 40);
        });
        break;
      }
    }
    g.appendChild(el);
  }

  const BIRLESIK_GRID_CX = [300, 800, 1300, 300, 800, 1300, 300, 800, 1300];
  const BIRLESIK_GRID_CY = [250, 250, 250, 500, 500, 500, 750, 750, 750];
  const BIRLESIK_GRID_SCALE = 0.65;
  const BIRLESIK_MERGE_SCALE_MAX = 2.0;
  const birlesikEase = (p) => p * p * (3 - 2 * p);
  let birlesikMergeVal = 0;
  let birlesikMapEls = null;

  function birlesikOpenPopup(idx) {
    const s = BIRLESIK_STEPS[idx];
    const g = document.createElementNS(NS, 'g');
    drawSharedBirlesik(g);
    drawUniqueBirlesik(g, idx);
    const svg = `<svg viewBox="-150 -150 300 300" class="cizim-card__svg" role="img" aria-label="${tt(s.label)}">${g.innerHTML}</svg>`;
    window.DostLightbox.open({
      closeLabel: tt({ tr: 'Kapat', en: 'Close', pt: 'Fechar' }),
      svgHtml: svg,
      ref: (idx + 1) + ' / ' + BIRLESIK_STEPS.length + ' — ' + s.cite,
      name: tt(s.label),
      caption: tt(s.gloss),
    });
  }

  function birlesikUpdateStage(mergeVal) {
    if (!birlesikMapEls) return;
    const t = birlesikEase(mergeVal / 100);
    for (let i = 0; i < BIRLESIK_STEPS.length; i++) {
      const gx = BIRLESIK_GRID_CX[i], gy = BIRLESIK_GRID_CY[i];
      const cx = gx + (800 - gx) * t;
      const cy = gy + (500 - gy) * t;
      const sc = BIRLESIK_GRID_SCALE + (BIRLESIK_MERGE_SCALE_MAX - BIRLESIK_GRID_SCALE) * t;
      const op = 1 - t * 0.30;
      birlesikMapEls[i].g.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${sc.toFixed(3)})`);
      birlesikMapEls[i].g.setAttribute('opacity', op.toFixed(3));
      birlesikMapEls[i].num.setAttribute('opacity', (1 - t * 0.9).toFixed(3));
      birlesikMapEls[i].labelEl.setAttribute('opacity', (0.85 * (1 - t * 0.9)).toFixed(3));
    }
  }

  function renderBirlesikStage() {
    const mapsG = document.getElementById('birlesikMapsG');
    if (!mapsG) return;
    mapsG.innerHTML = '';
    birlesikMapEls = [];
    const enlargeLabel = tt({ tr: 'Büyüt: ', en: 'Enlarge: ', pt: 'Ampliar: ' });
    BIRLESIK_STEPS.forEach((s, i) => {
      const g = document.createElementNS(NS, 'g');
      const hit = document.createElementNS(NS, 'circle');
      hit.setAttribute('cx', 0); hit.setAttribute('cy', 0); hit.setAttribute('r', 112);
      hit.setAttribute('class', 'birlesik-map__hit');
      hit.setAttribute('pointer-events', 'fill');
      g.appendChild(hit);

      const num = document.createElementNS(NS, 'text');
      num.setAttribute('x', -110); num.setAttribute('y', -100);
      num.setAttribute('class', 'birlesik-map__no');
      num.textContent = String(i + 1);
      g.appendChild(num);

      const labelEl = document.createElementNS(NS, 'text');
      labelEl.setAttribute('x', -110); labelEl.setAttribute('y', -78);
      labelEl.setAttribute('class', 'birlesik-map__label');
      labelEl.textContent = tt(s.shortLabel);
      g.appendChild(labelEl);

      drawSharedBirlesik(g);
      drawUniqueBirlesik(g, i);
      g.setAttribute('class', 'birlesik-map');
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', enlargeLabel + tt(s.label));
      g.addEventListener('click', () => birlesikOpenPopup(i));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); birlesikOpenPopup(i); }
      });
      mapsG.appendChild(g);
      birlesikMapEls.push({ g, num, labelEl });
    });
    birlesikUpdateStage(birlesikMergeVal);

    const slider = document.getElementById('birlesikSlider');
    slider.addEventListener('input', (e) => {
      birlesikMergeVal = +e.target.value;
      birlesikUpdateStage(birlesikMergeVal);
    });
    document.getElementById('birlesikMergeBtn').addEventListener('click', () => {
      birlesikMergeVal = 100; slider.value = 100; birlesikUpdateStage(100);
    });
    document.getElementById('birlesikResetBtn').addEventListener('click', () => {
      birlesikMergeVal = 0; slider.value = 0; birlesikUpdateStage(0);
    });
  }

  function birlesikHaritaHtml() {
    return `<article class="cizim-card cizim-card--birlesik">
      <p class="cizim-card__ref">Fütûhât, 9.316–9.461 — 371. Bab</p>
      <h2 class="cizim-card__name">${tt({ tr: '371. Bab: Dokuz Harita', en: 'Chapter 371: Nine Maps', pt: 'Capítulo 371: Nove Mapas' })}</h2>
      <p class="cizim-card__desc">${tt({
        tr: 'İbn Arabî\'nin, Fütûhât\'ın ikinci telifine kendi eliyle çizdiği dokuz harita — kendi ifadesiyle "tek bir kompozisyon" olarak görülmesini istediği bir dizi. Ayrıyken dokuz çizim, sürgüyü kaydırınca tek bir kompozisyon. Her haritaya ayrı ayrı tıklayıp büyütebilirsin.',
        en: 'Nine maps Ibn al-ʿArabī drew with his own hand into the second recension of the Futuhat — meant, in his own words, to be seen as a single composition. Nine drawings when apart; one composition when the slider merges them. Click any map on its own to enlarge it.',
        pt: 'Nove mapas que Ibn al-ʿArabī desenhou com a própria mão na segunda recensão das Futuhat — pensados, nas suas palavras, para serem vistos como uma única composição. Nove desenhos quando separados; uma só composição quando o controle os reúne. Clique em qualquer mapa para o ampliar.',
      })}</p>
      <div class="cizim-birlesik">
        <svg class="cizim-birlesik__svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid meet"
             aria-label="${tt({ tr: 'Dokuz harita: ayrı çizimler ve merkezde birleşen tek bir kompozisyon', en: 'Nine maps: separate drawings and a single composition merging at the center', pt: 'Nove mapas: desenhos separados e uma única composição a fundir-se no centro' })}">
          <g id="birlesikMapsG"></g>
        </svg>
        <div class="cizim-birlesik__controls">
          <div class="cizim-birlesik__quick">
            <button type="button" class="cizim-birlesik__btn" id="birlesikMergeBtn">${tt({ tr: 'Tek Haritada Birleştir', en: 'Merge into One Map', pt: 'Fundir num Só Mapa' })}</button>
            <button type="button" class="cizim-birlesik__btn cizim-birlesik__btn--ghost" id="birlesikResetBtn">${tt({ tr: 'Başa Dön', en: 'Return to Start', pt: 'Voltar ao Início' })}</button>
          </div>
          <div class="cizim-birlesik__slider-row">
            <span>${tt({ tr: 'Ayrık', en: 'Apart', pt: 'Separados' })}</span>
            <input type="range" id="birlesikSlider" min="0" max="100" value="${birlesikMergeVal}" aria-label="${tt({ tr: 'Ayrık / Birleşik', en: 'Apart / Together', pt: 'Separados / Reunidos' })}">
            <span>${tt({ tr: 'Birleşik', en: 'Together', pt: 'Reunidos' })}</span>
          </div>
        </div>
      </div>
    </article>`;
  }

  function render() {
    if (!data) return;
    const cards = data.diagrams.map(cardHtml).join("");
    const sources = (data.sources || []).map((s) => `<li>${s}</li>`).join("");
    listEl.innerHTML = `
      ${CIZIM_DEFS}
      <p class="cizimler-intro">${linkify(tt(data.intro), null)}</p>
      ${birlesikHaritaHtml()}
      ${cards}
      <ul class="cizimler-sources">${sources}</ul>
    `;
    renderBirlesikStage();
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
