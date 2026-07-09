(function () {
  "use strict";

  const I18n = window.DostI18n;
  const grid = document.getElementById("bookmap-grid");
  const detail = document.getElementById("bookmap-detail");
  if (!grid || !detail) return;

  let booksData = null;
  let fetchPromise = null;
  let activeBookId = null;
  let activeTab = "overview";

  function tt(dict) {
    return I18n.pick3(dict);
  }

  function fetchData() {
    if (booksData) return Promise.resolve(booksData);
    if (fetchPromise) return fetchPromise;
    fetchPromise = fetch("data/ibn-arabi/book-map.json")
      .then((r) => r.json())
      .then((data) => {
        booksData = data;
        return data;
      })
      .catch((err) => {
        console.error("Kitap Haritası verisi yüklenemedi / Failed to load Book Map data", err);
        return null;
      });
    return fetchPromise;
  }

  function renderGrid() {
    if (!booksData) return;
    grid.innerHTML = "";
    booksData.books.forEach((book) => {
      const card = document.createElement("div");
      card.className = "bookmap-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");

      const period = book.year_written ? `${book.year_written.start}–${book.year_written.end}` : "";

      card.innerHTML = `
        <div class="bookmap-card__badge">${book.volumes}</div>
        <h3>${tt(book.title)}</h3>
        <p class="bookmap-author">${book.author}</p>
        <p class="bookmap-preview">${tt(book.overview)}</p>
        <div class="bookmap-meta">
          <span>${period}</span>
        </div>
      `;
      card.addEventListener("click", () => openBook(book.id));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBook(book.id); }
      });
      grid.appendChild(card);
    });
  }

  function findBook(id) {
    return booksData && booksData.books.find((b) => b.id === id);
  }

  function openBook(id, tab) {
    activeBookId = id;
    activeTab = tab || "overview";
    renderDetail();
    detail.hidden = false;
    detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function closeDetail() {
    activeBookId = null;
    detail.hidden = true;
  }

  const TABS = [
    { id: "overview", tr: "Genel Bakış", en: "Overview", pt: "Visão Geral" },
    { id: "concepts", tr: "Kavramlar", en: "Concepts", pt: "Conceitos" },
    { id: "structure", tr: "Yapı", en: "Structure", pt: "Estrutura" },
    { id: "sources", tr: "Kaynaklar", en: "Sources", pt: "Fontes" },
  ];

  function tabLabel(t) {
    const lang = I18n.getLang();
    return t[lang] || t.en;
  }

  function renderDetail() {
    const book = findBook(activeBookId);
    if (!book) return;

    const period = book.year_written ? `${book.year_written.start}–${book.year_written.end}` : "";

    const tabsHtml = TABS.map(
      (t) => `<button class="bookmap-tab${t.id === activeTab ? " bookmap-tab--active" : ""}" data-tab="${t.id}">${tabLabel(t)}</button>`
    ).join("");

    detail.innerHTML = `
      <div class="bookmap-detail__header">
        <div>
          <h2>${tt(book.title)}</h2>
          <p class="bookmap-author">${book.author}</p>
        </div>
        <button class="bookmap-detail__close" type="button" aria-label="Kapat">&times;</button>
      </div>
      <div class="bookmap-tabs">${tabsHtml}</div>
      <div class="bookmap-tab-content" id="bookmap-tab-content"></div>
    `;

    detail.querySelector(".bookmap-detail__close").addEventListener("click", closeDetail);
    detail.querySelectorAll(".bookmap-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        renderDetail();
      });
    });

    const content = detail.querySelector("#bookmap-tab-content");
    if (activeTab === "overview") {
      content.innerHTML = `
        <p>${tt(book.overview)}</p>
        <div class="bookmap-tab-panel__grid">
          <div class="bookmap-stat"><span class="label" data-tr="Cilt" data-en="Volumes" data-pt="Volumes">Cilt</span><span class="value">${book.volumes}</span></div>
          <div class="bookmap-stat"><span class="label" data-tr="Dönem" data-en="Period" data-pt="Período">Dönem</span><span class="value">${period}</span></div>
          <div class="bookmap-stat"><span class="label" data-tr="Yer" data-en="Place" data-pt="Local">Yer</span><span class="value">${tt(book.place_written)}</span></div>
        </div>
      `;
      I18n.applyStatic(content);
    } else if (activeTab === "concepts") {
      const tags = (book.key_concepts || [])
        .map((c) => `<button class="bookmap-concept-tag" data-concept="${c}">${c}</button>`)
        .join("");
      content.innerHTML = `<div class="bookmap-concept-tags">${tags}</div>`;
      content.querySelectorAll(".bookmap-concept-tag").forEach((tag) => {
        tag.addEventListener("click", () => {
          window.__dostNav && window.__dostNav.goTo("ontoloji", tag.dataset.concept);
        });
      });
    } else if (activeTab === "structure") {
      const sections = book.major_sections
        ? book.major_sections
            .map(
              (s) => `<div class="bookmap-list-item"><strong>${tt(s.title)}</strong><div class="sub">${s.focus}</div><div class="range">${s.chapters}</div></div>`
            )
            .join("")
        : book.structure
        ? `<p>${tt(book.structure)}</p>`
        : "";
      const themes = (book.key_themes || [])
        .map(
          (t) => `<div class="bookmap-list-item"><strong>${tt(t.name)}</strong><div class="range">${t.chapters_range}</div></div>`
        )
        .join("");
      const prophets = (book.key_prophets || [])
        .map((p) => {
          const chapters = Array.isArray(p.chapters) ? p.chapters.join(", ") : p.chapter || "";
          return `<div class="bookmap-list-item"><strong>${tt(p.name)}</strong><div class="sub">${p.theme}</div><div class="range">${chapters}</div></div>`;
        })
        .join("");
      content.innerHTML = `
        <div class="bookmap-list">${sections}</div>
        ${themes ? `<h3 class="bookmap-section-title" data-tr="Ana Temalar" data-en="Key Themes" data-pt="Temas Principais">Ana Temalar</h3><div class="bookmap-list">${themes}</div>` : ""}
        ${prophets ? `<h3 class="bookmap-section-title" data-tr="Öne Çıkan Peygamberler" data-en="Featured Prophets" data-pt="Profetas em Destaque">Öne Çıkan Peygamberler</h3><div class="bookmap-list">${prophets}</div>` : ""}
      `;
      I18n.applyStatic(content);
    } else if (activeTab === "sources") {
      const commentaries = (book.commentaries || [])
        .map((c) => {
          const note = c.note ? `<div class="sub">${tt(c.note)}</div>` : "";
          return `<div class="bookmap-list-item"><strong>${c.author}</strong><div class="range">${c.year} • ${c.language} • ${c.volumes} ${c.volumes === 1 ? "vol." : "vols."}</div>${note}</div>`;
        })
        .join("");
      content.innerHTML = `<div class="bookmap-list">${commentaries}</div>`;
    }
  }

  window.__bookmapApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        renderGrid();
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        renderGrid();
        if (id) openBook(id);
      });
    },
    onLangChange() {
      if (booksData) {
        renderGrid();
        if (activeBookId && !detail.hidden) renderDetail();
      }
    },
  };
})();
