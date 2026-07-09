(function () {
  "use strict";

  const I18n = window.DostI18n;

  // Story journey path through the ontology
  const storyJourney = {
    tr: [
      {
        id: "start",
        title: "Yolculuğun Başlangıcı",
        subtitle: "The Journey Begins / O Começo da Jornada",
        text: "Ruh, Tanrı'dan çıkış yolculuğuna başlar. Henüz kendini bilmeyen, saf bir varlık olarak...",
        nodeId: null,
        duration: 4000
      },
      {
        id: "creation",
        title: "Yaratılış",
        subtitle: "Creation / Criação",
        text: "Tanrı'nın isimleri tecelli eder ve varlık âlemleri ortaya çıkar. İlkinde ruh âlemi, ortada tahayyül, sonunda madde.",
        nodeId: "tecelli",
        duration: 5000
      },
      {
        id: "multiplicity",
        title: "Çokluk",
        subtitle: "Multiplicity / Multiplicidade",
        text: "Ruh, kendisini üç âlemde — ruhlar, imajlar, cisimler — görmek için gözler açar. Teklik çokluğa bürünür.",
        nodeId: "alem-ecsam",
        duration: 5000
      },
      {
        id: "seeking",
        title: "Arayış",
        subtitle: "Seeking / Procura",
        text: "Ruh, kendisinin asıl kaynağını hatırlama yolculuğuna çıkar. Tanrı'ya dönüş arzusu, Aşk aracılığıyla başlar.",
        nodeId: "insan-i-kamil",
        duration: 5000
      },
      {
        id: "knowledge",
        title: "Bilgi",
        subtitle: "Knowledge / Conhecimento",
        text: "Arayış sırasında, ruh Tanrı'nın sıfatlarını ve isimleri öğrenmeye başlar. Her isim bir açı, bir ufuk.",
        nodeId: "sifat-asma",
        duration: 5000
      },
      {
        id: "love",
        title: "Aşk",
        subtitle: "Love / Amor",
        text: "Bilgi aşka dönüşür. Ruh, bildiklerini seviyor. Sevgi, yolcunun Tanrı'ya doğru çekilen bağıdır.",
        nodeId: "kalp",
        duration: 5000
      },
      {
        id: "fana",
        title: "Fenâ (Yok Olma)",
        subtitle: "Annihilation / Aniquilação",
        text: "Aşkın doruk noktasında, kendi benliğin eriyip gittiğini hissediyor. Ego ölüyor. 'Ben' kalmazken, Tanrı kalıyor.",
        nodeId: null,
        duration: 5000
      },
      {
        id: "baqa",
        title: "Bekâ (Devam Etme)",
        subtitle: "Subsistence / Subsistência",
        text: "Fenâ'dan sonra, yolcu Tanrı'da kalıcılığı bulur. Kendi yokluğuna rağmen, Tanrı'da var olmaya devam eder.",
        nodeId: null,
        duration: 5000
      },
      {
        id: "union",
        title: "Cem (Birleşme)",
        subtitle: "Union / União",
        text: "Yolcunun son mertebesine varmış olması anlamına gelir. Yaratıcı ve yaratılan'ın birliği, başı başına bir Hayret dünyasına girmek...",
        nodeId: "dhat",
        duration: 6000
      }
    ],
    en: [
      {
        id: "start",
        title: "The Journey Begins",
        subtitle: "Yolculuğun Başlangıcı / O Começo da Jornada",
        text: "The soul embarks on its journey from God. Not yet knowing itself, as pure existence...",
        nodeId: null,
        duration: 4000
      },
      {
        id: "creation",
        title: "Creation",
        subtitle: "Yaratılış / Criação",
        text: "God's Names manifest and the realms of existence appear. First the spiritual world, then the imaginal, then the physical.",
        nodeId: "tecelli",
        duration: 5000
      },
      {
        id: "multiplicity",
        title: "Multiplicity",
        subtitle: "Çokluk / Multiplicidade",
        text: "The soul opens its eyes to see itself in three worlds — spirits, images, bodies. Unity is clothed in multiplicity.",
        nodeId: "alem-ecsam",
        duration: 5000
      },
      {
        id: "seeking",
        title: "Seeking",
        subtitle: "Arayış / Procura",
        text: "The soul remembers its origin and seeks its way back to God. The journey of return begins through Love.",
        nodeId: "insan-i-kamil",
        duration: 5000
      },
      {
        id: "knowledge",
        title: "Knowledge",
        subtitle: "Bilgi / Conhecimento",
        text: "In seeking, the soul learns God's Attributes and Names. Each Name is an angle, a horizon of understanding.",
        nodeId: "sifat-asma",
        duration: 5000
      },
      {
        id: "love",
        title: "Love",
        subtitle: "Aşk / Amor",
        text: "Knowledge transforms into love. The soul loves what it knows. Love is the cord that draws the wayfarer toward God.",
        nodeId: "kalp",
        duration: 5000
      },
      {
        id: "fana",
        title: "Fana (Annihilation)",
        subtitle: "Fenâ (Yok Olma) / Aniquilação",
        text: "At love's peak, the self dissolves. The ego dies. As 'I' vanishes, God remains. Nothing exists but Him.",
        nodeId: null,
        duration: 5000
      },
      {
        id: "baqa",
        title: "Baqa (Subsistence)",
        subtitle: "Bekâ (Devam Etme) / Subsistência",
        text: "After Fana, the wayfarer finds permanence in God. Despite the absence of self, the soul subsists in God alone.",
        nodeId: null,
        duration: 5000
      },
      {
        id: "union",
        title: "Union",
        subtitle: "Cem (Birleşme) / União",
        text: "The wayfarer has reached the final station. In the Unity of Creator and creation lies a Bewilderment that transcends all understanding.",
        nodeId: "dhat",
        duration: 6000
      }
    ],
    pt: [
      {
        id: "start",
        title: "O Começo da Jornada",
        subtitle: "Yolculuğun Başlangıcı / The Journey Begins",
        text: "A alma começa sua jornada a partir de Deus. Ainda não conhecendo a si mesma, como existência pura...",
        nodeId: null,
        duration: 4000
      },
      {
        id: "creation",
        title: "Criação",
        subtitle: "Yaratılış / Creation",
        text: "Os Nomes de Deus se manifestam e os reinos da existência aparecem. Primeiro o mundo espiritual, depois o imaginal, depois o físico.",
        nodeId: "tecelli",
        duration: 5000
      },
      {
        id: "multiplicity",
        title: "Multiplicidade",
        subtitle: "Çokluk / Multiplicity",
        text: "A alma abre os olhos para se ver em três mundos — espíritos, imagens, corpos. A unidade se veste de multiplicidade.",
        nodeId: "alem-ecsam",
        duration: 5000
      },
      {
        id: "seeking",
        title: "Procura",
        subtitle: "Arayış / Seeking",
        text: "A alma lembra sua origem e procura seu caminho de volta a Deus. A jornada de retorno começa através do Amor.",
        nodeId: "insan-i-kamil",
        duration: 5000
      },
      {
        id: "knowledge",
        title: "Conhecimento",
        subtitle: "Bilgi / Knowledge",
        text: "Na procura, a alma aprende os Atributos e Nomes de Deus. Cada Nome é um ângulo, um horizonte de compreensão.",
        nodeId: "sifat-asma",
        duration: 5000
      },
      {
        id: "love",
        title: "Amor",
        subtitle: "Aşk / Love",
        text: "O conhecimento se transforma em amor. A alma ama o que conhece. O amor é a corda que atrai o peregrino em direção a Deus.",
        nodeId: "kalp",
        duration: 5000
      },
      {
        id: "fana",
        title: "Fana (Aniquilação)",
        subtitle: "Fenâ (Yok Olma) / Annihilation",
        text: "No auge do amor, o eu se dissolve. O ego morre. Enquanto 'Eu' desaparece, Deus permanece. Nada existe senão Ele.",
        nodeId: null,
        duration: 5000
      },
      {
        id: "baqa",
        title: "Baqa (Subsistência)",
        subtitle: "Bekâ (Devam Etme) / Subsistence",
        text: "Após Fana, o peregrino encontra permanência em Deus. Apesar da ausência do eu, a alma subsiste somente em Deus.",
        nodeId: null,
        duration: 5000
      },
      {
        id: "union",
        title: "União",
        subtitle: "Cem (Birleşme) / Union",
        text: "O peregrino chegou à estação final. Na Unidade do Criador e criação reside um Espanto que transcende toda compreensão.",
        nodeId: "dhat",
        duration: 6000
      }
    ]
  };

  function getLang() {
    return I18n.getLang();
  }

  function getJourney() {
    const lang = getLang();
    return storyJourney[lang] || storyJourney.en;
  }

  function createStoryModal() {
    if (document.getElementById("story-modal")) return;

    const modal = document.createElement("div");
    modal.id = "story-modal";
    modal.className = "story-modal";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "story-title");

    modal.innerHTML = `
      <div class="story-modal__overlay"></div>
      <div class="story-modal__content">
        <div class="story-modal__header">
          <h2 id="story-title" class="story-modal__title" data-tr="Ruhun Yolculuğu" data-en="Journey of the Soul" data-pt="Jornada da Alma">Ruhun Yolculuğu</h2>
          <button class="story-modal__close" type="button" aria-label="Kapat">×</button>
        </div>
        <div class="story-modal__body">
          <div class="story-frame" id="story-frame">
            <h3 class="story-frame__title" id="story-step-title"></h3>
            <p class="story-frame__subtitle" id="story-step-subtitle"></p>
            <p class="story-frame__text" id="story-step-text"></p>
          </div>
          <div class="story-controls">
            <button class="story-btn story-btn--prev" id="story-prev" type="button" aria-label="Önceki">←</button>
            <div class="story-progress" id="story-progress"></div>
            <button class="story-btn story-btn--next" id="story-next" type="button" aria-label="Sonraki">→</button>
          </div>
          <button class="story-btn-auto" id="story-auto-play" type="button" data-tr="Otomatik Oynat" data-en="Auto Play" data-pt="Reprodução Automática">Otomatik Oynat</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  let currentStep = 0;
  let autoPlaying = false;
  let autoPlayTimeout = null;

  function showStep(step) {
    const journey = getJourney();
    if (step < 0 || step >= journey.length) return;

    currentStep = step;
    const data = journey[step];

    document.getElementById("story-step-title").textContent = data.title;
    document.getElementById("story-step-subtitle").textContent = data.subtitle;
    document.getElementById("story-step-text").textContent = data.text;

    // Highlight node if specified
    const ontologyNodes = document.querySelectorAll("g.ontology-node");
    ontologyNodes.forEach((n) => n.classList.remove("story-node-highlight"));
    if (data.nodeId) {
      const nodeEl = document.querySelector(`g.ontology-node[id*="${data.nodeId}"]`);
      if (nodeEl) nodeEl.classList.add("story-node-highlight");
    }

    // Update progress
    updateProgress();
  }

  function updateProgress() {
    const journey = getJourney();
    const progressEl = document.getElementById("story-progress");
    const barWidth = ((currentStep + 1) / journey.length) * 100;
    progressEl.style.width = barWidth + "%";
  }

  function nextStep() {
    const journey = getJourney();
    if (currentStep < journey.length - 1) {
      showStep(currentStep + 1);
      scheduleAutoNext();
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      showStep(currentStep - 1);
      scheduleAutoNext();
    }
  }

  function scheduleAutoNext() {
    if (!autoPlaying) return;
    clearTimeout(autoPlayTimeout);
    const journey = getJourney();
    const data = journey[currentStep];
    autoPlayTimeout = setTimeout(nextStep, data.duration);
  }

  function toggleAutoPlay() {
    autoPlaying = !autoPlaying;
    const btn = document.getElementById("story-auto-play");
    if (autoPlaying) {
      btn.classList.add("story-btn-auto--playing");
      scheduleAutoNext();
    } else {
      btn.classList.remove("story-btn-auto--playing");
      clearTimeout(autoPlayTimeout);
    }
  }

  function openStory() {
    const modal = document.getElementById("story-modal") || createStoryModal();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    currentStep = 0;
    autoPlaying = false;
    showStep(0);
  }

  function closeStory() {
    const modal = document.getElementById("story-modal");
    if (modal) {
      modal.hidden = true;
      document.body.style.overflow = "";
      autoPlaying = false;
      clearTimeout(autoPlayTimeout);
    }
  }

  // Initialize modal and wire up events when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    // Create story button in header if not exists
    const headerControls = document.querySelector(".app-header__controls");
    if (headerControls && !document.getElementById("story-btn")) {
      const storyBtn = document.createElement("button");
      storyBtn.id = "story-btn";
      storyBtn.className = "btn-ghost";
      storyBtn.type = "button";
      storyBtn.setAttribute("data-tr", "Yolculuk");
      storyBtn.setAttribute("data-en", "Journey");
      storyBtn.setAttribute("data-pt", "Jornada");
      storyBtn.textContent = "Yolculuk";
      headerControls.insertBefore(storyBtn, document.getElementById("theme-toggle"));
      storyBtn.addEventListener("click", openStory);
    }

    // Create modal
    createStoryModal();
    const modal = document.getElementById("story-modal");
    const closeBtn = modal.querySelector(".story-modal__close");
    const overlay = modal.querySelector(".story-modal__overlay");
    const prevBtn = document.getElementById("story-prev");
    const nextBtn = document.getElementById("story-next");
    const autoPlayBtn = document.getElementById("story-auto-play");

    closeBtn.addEventListener("click", closeStory);
    overlay.addEventListener("click", closeStory);
    prevBtn.addEventListener("click", prevStep);
    nextBtn.addEventListener("click", nextStep);
    autoPlayBtn.addEventListener("click", toggleAutoPlay);

    document.addEventListener("keydown", (e) => {
      if (!modal.hidden) {
        if (e.key === "Escape") closeStory();
        if (e.key === "ArrowLeft") prevStep();
        if (e.key === "ArrowRight") nextStep();
      }
    });
  }

  window.__storyMode = { openStory, closeStory };
})();
