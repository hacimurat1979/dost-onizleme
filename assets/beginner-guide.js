(function () {
  "use strict";

  const I18n = window.DostI18n;

  const guideBtn = document.getElementById("guide-btn");
  const guideModal = document.getElementById("guide-modal");
  const guideContent = document.getElementById("guide-content");
  const guideClose = document.querySelector(".guide-modal__close");
  const guideOverlay = document.querySelector(".guide-modal__overlay");

  const guideTopics = {
    tr: [
      {
        title: "Varlık Haritası Nedir?",
        text: "İbn Arabî'nin anlayışında varlık, Tanrı'nın sınırsız özünden (Zât) başlayarak görünen dünyaya iner, oradan da yine Tanrı'ya döner. Bu sitenin ana haritası bu yolculuğu gösterir: üstte Zât (Tanrı'nın özü), ortada ilahi sıfat ve esmâ (güzel isimler), altta ise insanlar ve makhlûkat (yaratılmışlar)."
      },
      {
        title: "Zât Nedir?",
        text: "Zât, Tanrı'nın sınırsız ve tavsif edilemeyen özüdür. İbn Arabî'ye göre Zât'ın ta kendisini tanımak imkânsızdır; ama O'nun esimleri ve sıfatları aracılığıyla biz O'nu tanırız. Harita üzerinde merkezdeki en üst düğümdür."
      },
      {
        title: "Esmâü'l-Hüsnâ Nedir?",
        text: "Esmâü'l-Hüsnâ, Tanrı'nın güzel isimleridir: El-Azîz (Yüce), El-Rahîm (Merhametli), El-Hakim (Hikmetli) gibi. Her isim, Tanrı'nın bir yönünü, bir sıfatını açığa çıkarır. Harita üzerinde Zât'tan aşağıya inen ayrışmalar bu isimlerdir."
      },
      {
        title: "Tecellî Nedir?",
        text: "Tecellî, 'tecelli etmek' demektir: Tanrı'nın sınırsız özü, kendi isim ve sıfatları aracılığıyla kendini açığa çıkarması, görünür hale gelmesidir. Bir işık kaynağı hakkında düşünün: ışık kaynağı ta kendisini görmek imkânsız ama o ışığın yayılması, bir duvarı aydınlatması, bir rengi açığa çıkarması gibi."
      },
      {
        title: "Âlem-i Ervâh Nedir?",
        text: "Ervâh, ruhlar anlamına gelir. Âlem-i Ervâh, Tanrı'nın doğrudan tecellisi olduğu, soyut ruhlar dünyasıdır — hissî madde olmayan, saymadan önceki ruhlar âlemi. Harita üzerinde ortanın sol tarafında bulunur."
      },
      {
        title: "Âlem-i Mithâl Nedir?",
        text: "Mithal, 'örnek / benzer' anlamına gelir. Âlem-i Mithâl (muhayyilât âlemi), ruh ile madde arasında berzah (ara perdeleri) adı verilen alandır: rüyalarda, hayallarda, hayal gücünde yaşayan âlem. Tanrı'nun tecellisinin bir derecesidir."
      },
      {
        title: "Âlem-i Ecsâm Nedir?",
        text: "Ecsâm, cisimler (cisimlerin çoğulu). Âlem-i Ecsâm, bizim duyu organlarımızla algılayabildiğimiz madde âlemidir: görülen, dokunulan, işitilen dünyadır. Harita üzerinde ortanın sağ tarafında bulunur."
      },
      {
        title: "İnsan-ı Kâmil Nedir?",
        text: "Kâmil 'mükemmel' demektir. İnsan-ı Kâmil, kalbinde Tanrı'nın bütün isimleri ve sıfatları tecelli etmiş, Tanrı'ya tam dönen müstakmel bir insandır. İbn Arabî'ye göre her yüzyılda bir İnsan-ı Kâmil yetişir, ve ona takarrub (yakınlaşma) aracılığıyla diğer insanlar yükselebilirler."
      },
      {
        title: "Fenâ ve Bekâ Nedir?",
        text: "Fenâ, 'yok olmak, eritilmek' demektir; Bekâ ise 'kalmak, devam etmek'. Sâlikin (yolculunun) iç yolculuğunda Fenâ, kendi benliğinin eritmesidir; sonrasında Bekâ'da kendi yokluğuna rağmen Tanrı'da kalıcılık bulur. 'Ben yok oldum, ancak Tanrı kaldı' denilir."
      },
      {
        title: "Hâller Haritası Nedir?",
        text: "Hâller Haritası, sâlikin (ruh yolcusunun) Nefsten (hakkani olmayan nefsin) Hakk'a doğru çıkış yolculuğunu gösterir. Tövbe'den başlayıp Zühd, Sabır, Rızâ gibi makamlardan geçerek Hayret'e (Tanrı'nın büyüklüğüne hayret etme durumuna) varır ve oradan Nefs'e döner. Daire şekli tesadüfi değildir: İbn Arabî'ye göre yol döndüğü yere döner."
      },
      {
        title: "Sırlar Nedir?",
        text: "Sırlar, İbn Arabî'nin yazılarında açıklamadığı, işaret ettiği ama perdelenmiş kalan fikirlerdir. Bu sitedeki 'Sırlar' bölümü, İbn Arabî'nin hangi kavramları perdeleyip açıklamadığını, neden açıklamadığını göstererek okuyucunun kendi keşif yolculuğunu başlatan ipuçlarıdır."
      }
    ],
    en: [
      {
        title: "What is the Map of Existence?",
        text: "In Ibn Arabi's understanding, existence flows from God's infinite and indescribable Essence (Dhat) down to the visible world, and then returns again to God. This site's main map shows this journey: at the top is Dhat (God's Essence), in the middle are Divine Attributes and Beautiful Names, and at the bottom are humans and creation."
      },
      {
        title: "What is Dhat (The Essence)?",
        text: "Dhat is God's infinite and transcendent Essence. According to Ibn Arabi, it is impossible to comprehend the Essence itself; we know God only through His Names and Attributes. On the map, it is the topmost node at the center."
      },
      {
        title: "What are the Beautiful Names (Asma)?",
        text: "The Beautiful Names (Asma al-Husna) are God's Attributes: The Mighty (Al-Aziz), The Merciful (Al-Rahim), The Wise (Al-Hakim), and others. Each Name reveals one facet of God's nature. On the map, these are the branches flowing downward from the Essence."
      },
      {
        title: "What is Tajalli (Self-Disclosure)?",
        text: "Tajalli means 'to shine forth' or 'to be revealed.' It is God's Essence manifesting itself through His Names and Attributes, becoming visible. Think of a light source: the source itself cannot be seen, but its radiance, illuminating a wall and revealing colors, is Tajalli."
      },
      {
        title: "What is the World of Spirits (Alem-i Ervah)?",
        text: "The World of Spirits is the realm of pure, abstract spirits where God's Tajalli is direct—no physical matter, only pure essence. It is the realm before number and distinction. On the map, it is located on the left side of the center."
      },
      {
        title: "What is the Imaginal Realm (Alem-i Mithal)?",
        text: "The Imaginal Realm is the world of forms and images—it exists between spirit and matter. This is where dreams, imagination, and visions occur. It is a degree of God's Tajalli. On the map, it is in the center."
      },
      {
        title: "What is the Physical World (Alem-i Ecsam)?",
        text: "The Physical World is the realm of bodies and matter we perceive with our senses: what we see, hear, and touch. On the map, it is located on the right side of the center."
      },
      {
        title: "What is the Perfect Human (Insan-i Kamil)?",
        text: "The Perfect Human is one in whom all of God's Names and Attributes are manifest in the heart, and who has returned completely to God. According to Ibn Arabi, each age has such a Perfect Human, and others can ascend through connection to him."
      },
      {
        title: "What are Fana and Baqa?",
        text: "Fana means 'annihilation'—the dissolution of the self. Baqa means 'subsistence'—remaining in God. In the seeker's inner journey, Fana is the dissolution of one's ego; in Baqa, despite the absence of self, one subsists in God. The saying is: 'I passed away, yet God remains.'"
      },
      {
        title: "What is the Map of States (Haal)?",
        text: "The Map of States traces the seeker's ascent from the Soul (Nafs) toward the Real (Haqq). Beginning with Repentance, passing through stations like Scrupulousness, Asceticism, and Patience, rising to Unity-Differentiation and Annihilation-Subsistence, and finally reaching Bewilderment (Hayra)—then returning to the Soul. The circle is no accident: Ibn Arabi teaches that the path returns to where it began."
      },
      {
        title: "What are the Mysteries (Sirrar)?",
        text: "The Mysteries are ideas Ibn Arabi hinted at but never fully explained—concepts he deliberately veiled. This site's 'Mysteries' section shows which concepts Ibn Arabi left concealed and why, offering clues to guide the reader's own discovery."
      }
    ],
    pt: [
      {
        title: "O que é o Mapa da Existência?",
        text: "Na compreensão de Ibn Arabi, a existência flui da Essência infinita e indescritível de Deus (Dhat) até o mundo visível, e então retorna novamente a Deus. O mapa principal deste site mostra essa jornada: no topo está Dhat (a Essência de Deus), no meio estão os Atributos Divinos e os Belos Nomes, e na parte inferior estão os humanos e a criação."
      },
      {
        title: "O que é Dhat (A Essência)?",
        text: "Dhat é a Essência infinita e transcendente de Deus. De acordo com Ibn Arabi, é impossível compreender a Essência em si; conhecemos Deus apenas através de Seus Nomes e Atributos. No mapa, é o nó no topo do centro."
      },
      {
        title: "O que são os Belos Nomes (Asma)?",
        text: "Os Belos Nomes (Asma al-Husna) são os Atributos de Deus: O Poderoso (Al-Aziz), O Misericordioso (Al-Rahim), O Sábio (Al-Hakim), e outros. Cada Nome revela uma faceta da natureza de Deus. No mapa, estes são os ramos fluindo para baixo da Essência."
      },
      {
        title: "O que é Tajalli (Autorrevelação)?",
        text: "Tajalli significa 'brilhar' ou 'ser revelado.' É a Essência de Deus se manifestando através de Seus Nomes e Atributos, tornando-se visível. Pense em uma fonte de luz: a própria fonte não pode ser vista, mas sua radiância, iluminando uma parede e revelando cores, é Tajalli."
      },
      {
        title: "O que é o Mundo dos Espíritos (Alem-i Ervah)?",
        text: "O Mundo dos Espíritos é o reino de espíritos puros e abstratos onde a Tajalli de Deus é direta—sem matéria física, apenas essência pura. É o reino anterior ao número e à distinção. No mapa, está localizado no lado esquerdo do centro."
      },
      {
        title: "O que é o Reino Imaginal (Alem-i Mithal)?",
        text: "O Reino Imaginal é o mundo de formas e imagens—existe entre espírito e matéria. É onde sonhos, imaginação e visões ocorrem. É um grau da Tajalli de Deus. No mapa, está no centro."
      },
      {
        title: "O que é o Mundo Físico (Alem-i Ecsam)?",
        text: "O Mundo Físico é o reino de corpos e matéria que percebemos com nossos sentidos: o que vemos, ouvimos e tocamos. No mapa, está localizado no lado direito do centro."
      },
      {
        title: "O que é o Humano Perfeito (Insan-i Kamil)?",
        text: "O Humano Perfeito é aquele em quem todos os Nomes e Atributos de Deus se manifestam no coração, e que retornou completamente a Deus. De acordo com Ibn Arabi, cada era tem tal Humano Perfeito, e outros podem ascender através da conexão com ele."
      },
      {
        title: "O que são Fana e Baqa?",
        text: "Fana significa 'aniquilação'—a dissolução do eu. Baqa significa 'subsistência'—permanecer em Deus. Na jornada interior do buscador, Fana é a dissolução do ego; em Baqa, apesar da ausência do eu, subsiste-se em Deus. O dito é: 'Eu passei, mas Deus permanece.'"
      },
      {
        title: "O que é o Mapa dos Estados (Haal)?",
        text: "O Mapa dos Estados traça a ascensão do buscador da Alma (Nafs) em direção ao Real (Haqq). Começando com o Arrependimento, passando por estações como Escrúpulo, Ascetismo e Paciência, subindo à Unidade-Diferenciação e Aniquilação-Subsistência, e finalmente alcançando o Espanto (Hayra)—então retornando à Alma. O círculo não é acaso: Ibn Arabi ensina que o caminho retorna a onde começou."
      },
      {
        title: "O que são os Mistérios (Sirrar)?",
        text: "Os Mistérios são ideias que Ibn Arabi aludiu mas nunca explicou completamente—conceitos que ele deliberadamente velou. A seção 'Mistérios' deste site mostra quais conceitos Ibn Arabi deixou ocultos e por quê, oferecendo pistas para guiar a própria descoberta do leitor."
      }
    ]
  };

  function getLang() {
    return I18n.getLang();
  }

  function renderGuide() {
    const lang = getLang();
    const topics = guideTopics[lang] || guideTopics.en;

    guideContent.innerHTML = topics.map((topic, idx) => `
      <div class="guide-topic">
        <h3>${topic.title}</h3>
        <p>${topic.text}</p>
      </div>
    `).join("");
  }

  function openGuide() {
    renderGuide();
    guideModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeGuide() {
    guideModal.hidden = true;
    document.body.style.overflow = "";
  }

  guideBtn.addEventListener("click", openGuide);
  guideClose.addEventListener("click", closeGuide);
  guideOverlay.addEventListener("click", closeGuide);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !guideModal.hidden) {
      closeGuide();
    }
  });

  // Re-render guide when language changes
  window.addEventListener("dost-lang-changed", () => {
    if (!guideModal.hidden) {
      renderGuide();
    }
  });

  window.__guideApp = { openGuide, closeGuide };
})();
