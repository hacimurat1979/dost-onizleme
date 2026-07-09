(function () {
  "use strict";

  const I18n = window.DostI18n;

  // Available books for insight extraction
  const availableBooks = [
    {
      id: "futuhat",
      title: { tr: "Fütûhât-ı Mekkiyye", en: "Meccan Illuminations", pt: "Iluminações de Meca" },
      author: "İbn Arabî",
      volumes: 18,
      status: "loaded",
      description: { tr: "18 cilt", en: "18 volumes", pt: "18 volumes" }
    },
    {
      id: "fusus",
      title: { tr: "Füsûsu'l-Hikem", en: "Bezels of Wisdom", pt: "Engastes de Sabedoria" },
      author: "İbn Arabî",
      volumes: 2,
      status: "loaded",
      description: { tr: "Konuk şerhi", en: "Konuk commentary", pt: "comentário Konuk" }
    },
    {
      id: "tedbirat",
      title: { tr: "Tedbîrât-ı İlâhiyye", en: "Divine Governance", pt: "Governança Divina" },
      author: "İbn Arabî",
      status: "downloaded",
      description: { tr: "Konuk yorum", en: "Konuk commentary", pt: "comentário Konuk" }
    },
    {
      id: "risaleler",
      title: { tr: "Risâleleri", en: "Treatises", pt: "Tratados" },
      author: "İbn Arabî",
      status: "downloaded",
      description: { tr: "Seçme risaleler", en: "Selected treatises", pt: "tratados selecionados" }
    },
    {
      id: "varlik-agaci",
      title: { tr: "Varlık Ağacı", en: "Tree of Existence", pt: "Árvore da Existência" },
      author: "İbn Arabî",
      status: "downloaded",
      description: { tr: "Vücûd risalesi", en: "On Being", pt: "Sobre o Ser" }
    },
    {
      id: "ozun-ozu",
      title: { tr: "Özün Özü (Lübbü'l-Lübb)", en: "The Innermost Essence", pt: "A Essência Mais Íntima" },
      author: "İbn Arabî",
      status: "downloaded",
      description: { tr: "Kısa risale", en: "Short treatise", pt: "tratado curto" }
    },
    {
      id: "el-bulga",
      title: { tr: "El-Bulga Fi'l-Hikmeh", en: "Eloquence in Wisdom", pt: "Eloqüência na Sabedoria" },
      author: "İbn Arabî",
      status: "downloaded",
      description: { tr: "Hikmeler koleksiyonu", en: "Collection of wisdoms", pt: "coleção de sabedorias" }
    },
    {
      id: "mekarimul-ahlak",
      title: { tr: "Mekârimu'l-Ahlâk", en: "Noble Traits of Character", pt: "Traços Nobres do Caráter" },
      author: "İbn Arabî",
      status: "downloaded",
      description: { tr: "Ahlâk risalesi", en: "On ethics", pt: "sobre ética" }
    }
  ];

  function createBooksBrowser() {
    if (document.getElementById("books-panel")) return;

    const modal = document.createElement("div");
    modal.id = "books-panel";
    modal.className = "books-panel";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "books-title");

    modal.innerHTML = `
      <div class="books-panel__overlay"></div>
      <div class="books-panel__content">
        <div class="books-panel__header">
          <h2 id="books-title" class="books-panel__title" data-tr="Kaynaklar" data-en="Sources" data-pt="Fontes">Kaynaklar</h2>
          <button class="books-panel__close" type="button" aria-label="Kapat">×</button>
        </div>
        <div class="books-panel__body" id="books-list"></div>
      </div>
    `;

    document.body.appendChild(modal);

    // Populate books list
    const booksList = modal.querySelector("#books-list");
    booksList.innerHTML = availableBooks.map((book) => `
      <div class="book-item" data-book-id="${book.id}">
        <div class="book-item__header">
          <h3 class="book-item__title">${I18n.pick3(book.title)}</h3>
          <span class="book-item__status book-item__status--${book.status}">${book.status}</span>
        </div>
        <p class="book-item__author">${book.author}</p>
        <p class="book-item__desc">${I18n.pick3(book.description)}</p>
        <div class="book-item__actions">
          <button class="book-btn book-btn--browse" data-book-id="${book.id}"
                  data-tr="Gözat" data-en="Browse" data-pt="Procurar">Gözat</button>
          <button class="book-btn book-btn--extract" data-book-id="${book.id}"
                  data-tr="İçgörü Çıkart" data-en="Extract Insights" data-pt="Extrair Perspectivas">İçgörü Çıkart</button>
        </div>
      </div>
    `).join("");

    // Wire up close button
    const closeBtn = modal.querySelector(".books-panel__close");
    const overlay = modal.querySelector(".books-panel__overlay");
    closeBtn.addEventListener("click", closeBooksBrowser);
    overlay.addEventListener("click", closeBooksBrowser);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeBooksBrowser();
    });

    return modal;
  }

  function openBooksBrowser() {
    const modal = document.getElementById("books-panel") || createBooksBrowser();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeBooksBrowser() {
    const modal = document.getElementById("books-panel");
    if (modal) {
      modal.hidden = true;
      document.body.style.overflow = "";
    }
  }

  function addBooksButton() {
    const headerControls = document.querySelector(".app-header__controls");
    if (!headerControls || document.getElementById("books-btn")) return;

    const booksBtn = document.createElement("button");
    booksBtn.id = "books-btn";
    booksBtn.className = "btn-ghost";
    booksBtn.type = "button";
    booksBtn.setAttribute("data-tr", "Kaynaklar");
    booksBtn.setAttribute("data-en", "Sources");
    booksBtn.setAttribute("data-pt", "Fontes");
    booksBtn.textContent = "Kaynaklar";
    booksBtn.title = "Kitapları ve kaynakları gözat / Browse books and sources / Procurar livros e fontes";

    headerControls.insertBefore(booksBtn, document.getElementById("theme-toggle"));
    booksBtn.addEventListener("click", openBooksBrowser);
  }

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      addBooksButton();
      createBooksBrowser();
    });
  } else {
    addBooksButton();
    createBooksBrowser();
  }

  window.__bookInsights = {
    openBooksBrowser,
    closeBooksBrowser,
    availableBooks: () => availableBooks
  };
})();
