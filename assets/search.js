(function () {
  "use strict";

  const I18n = window.DostI18n;
  const headerControls = document.querySelector(".app-header__controls");
  if (!headerControls) return;

  const CATEGORY_LABEL = {
    ontoloji: { tr: "Ontoloji", en: "Ontology", pt: "Ontologia" },
    esma: { tr: "Esmâü'l-Hüsnâ", en: "The Beautiful Names", pt: "Os Belos Nomes" },
    hal: { tr: "Hâller Haritası", en: "Map of States", pt: "Mapa dos Estados" },
    sirlar: { tr: "Sırlar", en: "Mysteries", pt: "Mistérios" },
    terimler: { tr: "Felsefi Terimler", en: "Philosophical Terms", pt: "Termos Filosóficos" },
    cizimler: { tr: "Çizimler", en: "Diagrams", pt: "Diagramas" },
    sorular: { tr: "Sorular", en: "Questions", pt: "Perguntas" },
    futuhat: { tr: "Fütûhât Atlası", en: "Futuhat Atlas", pt: "Atlas do Futuhat" },
  };

  // Sonuç gruplarının başında, hangi görünüme ait olduğunu tek bakışta
  // ayırt etsin diye küçük bir renk noktası -- her görünümün kendi
  // sayfasında zaten kullandığı bir vurgu rengine bağlanıyor.
  const CATEGORY_DOT_VAR = {
    ontoloji: "--series-ibnarabi",
    esma: "--series-kemal",
    hal: "--series-hal-hayret",
    sirlar: "--series-sir-kader",
    terimler: "--series-sir-dil",
    cizimler: "--series-theme",
    sorular: "--series-sorular-en-temel",
    futuhat: "--series-hal-muameleler",
  };

  let index = [];
  let indexLoaded = false;

  function allLangText(dict) {
    if (!dict) return "";
    if (typeof dict === "string") return dict;
    return [dict.tr, dict.en, dict.pt].filter(Boolean).join(" ␟ ");
  }

  function buildIndex() {
    const sources = [
      fetch("data/ibn-arabi/ontology.json").then((r) => r.json()).then((d) => {
        (d.nodes || []).forEach((n) => {
          index.push({ view: "ontoloji", id: n.id, label: n.name, sub: n.short, searchText: allLangText(n.name) + " " + allLangText(n.short) });
        });
      }),
      fetch("data/ibn-arabi/esma.json").then((r) => r.json()).then((d) => {
        (d.nodes || []).forEach((n) => {
          index.push({ view: "esma", id: n.id, label: n.name, sub: n.short, searchText: allLangText(n.name) + " " + allLangText(n.short) });
        });
      }),
      fetch("data/ibn-arabi/hal.json").then((r) => r.json()).then((d) => {
        (d.nodes || []).forEach((n) => {
          index.push({ view: "hal", id: n.id, label: n.name, sub: n.short, searchText: allLangText(n.name) + " " + allLangText(n.short) });
        });
      }),
      fetch("data/ibn-arabi/sirlar.json").then((r) => r.json()).then((d) => {
        (d.entries || []).forEach((e) => {
          index.push({ view: "sirlar", id: e.id, label: e.topic, sub: null, searchText: allLangText(e.topic) + " " + (e.theme || "") });
        });
      }),
      fetch("data/ibn-arabi/felsefi-terimler.json").then((r) => r.json()).then((d) => {
        const terms = d.terms || {};
        Object.keys(terms).forEach((key) => {
          const t = terms[key];
          index.push({ view: "terimler", id: t.id, label: t.title, sub: t.felsefi_tanim, searchText: allLangText(t.title) + " " + allLangText(t.felsefi_tanim) + " " + (t.arabic || "") });
        });
      }),
      fetch("data/ibn-arabi/futuhat-cizimleri.json").then((r) => r.json()).then((d) => {
        (d.diagrams || []).forEach((c) => {
          index.push({ view: "cizimler", id: c.id, label: c.name, sub: c.description, searchText: allLangText(c.name) + " " + allLangText(c.description) });
        });
      }),
      fetch("data/ibn-arabi/sorular.json").then((r) => r.json()).then((d) => {
        (d.categories || []).forEach((c) => {
          (c.questions || []).forEach((q) => {
            index.push({ view: "sorular", id: q.id, label: q.question, sub: c.name, searchText: allLangText(q.question) + " " + allLangText(q.answer) });
          });
        });
      }),
      fetch("data/ibn-arabi/futuhat-atlas.json").then((r) => r.json()).then((d) => {
        // Gezinme yalnızca kısım (part) düzeyinde çalıştığı için, sonuç
        // olarak o kısmı gösteriyoruz -- ama bölüm başlıklarını da arama
        // metnine katıyoruz ki içindeki bir konu/harf aranınca da bulunsun.
        (d.parts || []).forEach((p) => {
          const sectionHeadings = (p.sections || []).map((s) => allLangText(s.heading)).join(" ");
          index.push({
            view: "futuhat",
            id: p.id,
            label: p.title,
            sub: p.hero && p.hero.summary,
            searchText: allLangText(p.title) + " " + allLangText(p.hero && p.hero.summary) + " " + sectionHeadings,
          });
        });
      }),
    ];
    return Promise.allSettled(sources).then((results) => {
      results.forEach((r) => {
        if (r.status === "rejected") console.error("Arama kaynağı yüklenemedi / Search source failed to load", r.reason);
      });
      // Normalize + tokenize once here, at index-build time, rather than on
      // every keystroke -- with a few hundred entries the fuzzy pass below
      // touches every word of every entry per search() call.
      index.forEach((item) => {
        item.normText = normalize(item.searchText);
        item.words = item.normText.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      });
      indexLoaded = true;
    });
  }

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function normalize(s) {
    return (s || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  // Basit bir yazım hatasını (örn. "hayet" yerine "hayret") tolere etmek için
  // Levenshtein mesafesi -- yeni bir kütüphane eklemeden, tek kelimelik
  // yaklaşık eşleşme için yeterli.
  function levenshtein(a, b) {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (!al) return bl;
    if (!bl) return al;
    let prev = new Array(bl + 1);
    let curr = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) prev[j] = j;
    for (let i = 1; i <= al; i++) {
      curr[0] = i;
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }
    return prev[bl];
  }

  // Kısa sorgularda (2-3 harf) bulanık eşleşme çok fazla alakasız sonuç
  // getirir; sorgu uzadıkça bir-iki harflik hataya izin ver.
  function fuzzyThreshold(len) {
    if (len <= 3) return 0;
    if (len <= 5) return 1;
    return 2;
  }

  function search(query) {
    const q = normalize(query);
    if (!q) return [];
    const threshold = fuzzyThreshold(q.length);
    const scored = [];
    index.forEach((item) => {
      if (item.normText.includes(q)) {
        scored.push({ item, score: 0 });
        return;
      }
      if (!threshold) return;
      let best = Infinity;
      for (const w of item.words) {
        if (Math.abs(w.length - q.length) > threshold) continue;
        const d = levenshtein(q, w);
        if (d < best) best = d;
        if (!best) break;
      }
      if (best <= threshold) scored.push({ item, score: best + 1 });
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, 30).map((s) => s.item);
  }

  // --- UI ---
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "search-toggle";
  toggleBtn.type = "button";
  toggleBtn.id = "search-toggle";
  toggleBtn.setAttribute("aria-label", "Ara / Search / Buscar");
  toggleBtn.title = "Ara / Search / Buscar";
  toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="15.3" y1="15.3" x2="21" y2="21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  const themeToggle = document.getElementById("theme-toggle");
  headerControls.insertBefore(toggleBtn, themeToggle);

  const panel = document.createElement("div");
  panel.className = "search-panel";
  panel.id = "search-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="search-panel__box">
      <input type="search" class="search-panel__input" id="search-input" placeholder="..." autocomplete="off">
      <div class="search-panel__results" id="search-results"></div>
    </div>
  `;
  document.body.appendChild(panel);

  const input = panel.querySelector("#search-input");
  const results = panel.querySelector("#search-results");

  function placeholder() {
    const lang = I18n.getLang();
    return { tr: "Kavram, isim, hâl veya terim ara…", en: "Search concepts, names, states, or terms…", pt: "Buscar conceitos, nomes, estados ou termos…" }[lang];
  }

  function openPanel() {
    panel.hidden = false;
    input.value = "";
    input.placeholder = placeholder();
    results.innerHTML = "";
    requestAnimationFrame(() => input.focus());
    if (!indexLoaded) buildIndex();
  }

  function closePanel() {
    panel.hidden = true;
  }

  toggleBtn.addEventListener("click", () => {
    panel.hidden ? openPanel() : closePanel();
  });

  panel.addEventListener("click", (e) => {
    if (e.target === panel) closePanel();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) closePanel();
    if (e.key === "/" && panel.hidden && document.activeElement.tagName !== "INPUT") {
      e.preventDefault();
      openPanel();
    }
  });

  function renderResults(items) {
    if (!items.length) {
      results.innerHTML = input.value
        ? `<div class="search-panel__empty" data-tr="Sonuç bulunamadı" data-en="No results" data-pt="Nenhum resultado">...</div>`
        : "";
      if (input.value) I18n.applyStatic(results);
      return;
    }
    const byView = {};
    items.forEach((it) => {
      (byView[it.view] = byView[it.view] || []).push(it);
    });
    results.innerHTML = Object.keys(byView)
      .map((view) => {
        const rows = byView[view]
          .map(
            (it) => `<button class="search-result" data-view="${it.view}" data-id="${it.id}">
              <span class="search-result__label">${tt(it.label)}</span>
              ${it.sub ? `<span class="search-result__sub">${tt(it.sub)}</span>` : ""}
            </button>`
          )
          .join("");
        const dotVar = CATEGORY_DOT_VAR[view];
        return `<div class="search-panel__group">
          <div class="search-panel__group-label">${dotVar ? `<span class="search-panel__group-dot" style="background:var(${dotVar})"></span>` : ""}${tt(CATEGORY_LABEL[view])}</div>
          ${rows}
        </div>`;
      })
      .join("");

    results.querySelectorAll(".search-result").forEach((btn) => {
      btn.addEventListener("click", () => {
        closePanel();
        window.__dostNav && window.__dostNav.goTo(btn.dataset.view, btn.dataset.id);
      });
    });
  }

  input.addEventListener("input", () => {
    renderResults(search(input.value));
  });
})();
