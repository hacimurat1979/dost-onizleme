(function () {
  "use strict";

  const I18n = window.DostI18n;

  // Enriched metadata for nodes to display on hover/click
  const nodeMetadata = {
    tr: {
      "dhat": {
        meaning: "Tanrı'nın sınırsız özü",
        opposite: "Mahlukat (yaratılmışlar)",
        relatedConcepts: ["Zât", "Vahdet (birlik)"],
        category: "Öz"
      },
      "sifat-asma": {
        meaning: "Tanrı'nın sıfatları ve güzel isimleri",
        opposite: "Mahlûkat sıfatları",
        relatedConcepts: ["Esmâü'l-Hüsnâ", "Tecellî"],
        category: "İlahi Sıfatlar"
      },
      "ayan-sabite": {
        meaning: "Varlık olarak görülmemiş, ilmî olarak var olan hakikatler",
        opposite: "Varlık bulan şeyler",
        relatedConcepts: ["İlim-i İlâhî", "Varlık"],
        category: "Akledilir Âlem"
      },
      "tecelli": {
        meaning: "Tanrı'nın isimleri ve sıfatları aracılığıyla kendini açığa çıkarması",
        opposite: "Gizlilik (ketm)",
        relatedConcepts: ["Zâtî tecellî", "Sıfatî tecellî", "Fiilî tecellî"],
        category: "İlahi Tecellî"
      },
      "alem-ervah": {
        meaning: "Soyut ruhlar âlemi, Tanrı'nın doğrudan tecellisi",
        opposite: "Âlem-i ecsâm (madde âlemi)",
        relatedConcepts: ["Ervâh", "Nûr", "İlahi nurlar"],
        category: "Ruhlar Âlemi"
      },
      "alem-misal": {
        meaning: "Ruh ve madde arasında berzah, hayallı âlem",
        opposite: "Alem-i Ervâh ile Alem-i Ecsâm",
        relatedConcepts: ["Muhayyilât", "Berzah", "Rüyâ"],
        category: "Hayal Âlemi"
      },
      "alem-ecsam": {
        meaning: "Duyu organlarıyla algılanan madde âlemi",
        opposite: "Alem-i Ervâh (ruhlar âlemi)",
        relatedConcepts: ["Cism", "Madde", "İnsan hisler"],
        category: "Cisimler Âlemi"
      },
      "insan-i-kamil": {
        meaning: "Tanrı'nın bütün isimleri tecelli etmiş mükemmel insan",
        opposite: "Nefs-i ammâre (hakkani olmayan nefs)",
        relatedConcepts: ["Hilâl", "İnsân-ı Kâmil", "Kutup"],
        category: "İnsân-ı Kâmil"
      },
      "kalp": {
        meaning: "Ruh ile madde âlemleri arasında berzah, ilahi isimlerin aynası",
        opposite: "Cism (beden)",
        relatedConcepts: ["Kalp", "Ayna", "Zikr"],
        category: "Kalp"
      }
    },
    en: {
      "dhat": {
        meaning: "God's infinite and indescribable Essence",
        opposite: "Creation (Makhlûkat)",
        relatedConcepts: ["Essence", "Unity (Wahda)"],
        category: "Essence"
      },
      "sifat-asma": {
        meaning: "God's Attributes and Beautiful Names",
        opposite: "Attributes of creation",
        relatedConcepts: ["Beautiful Names", "Tajalli"],
        category: "Divine Attributes"
      },
      "ayan-sabite": {
        meaning: "Intelligible essences existing in knowledge but not actualized in being",
        opposite: "Actualized beings",
        relatedConcepts: ["Divine Knowledge", "Being"],
        category: "Intelligible World"
      },
      "tecelli": {
        meaning: "God's self-manifestation through His Names and Attributes",
        opposite: "Concealment (Ketm)",
        relatedConcepts: ["Essential Tajalli", "Attributive Tajalli", "Active Tajalli"],
        category: "Divine Manifestation"
      },
      "alem-ervah": {
        meaning: "The world of abstract spirits, God's direct manifestation",
        opposite: "Physical world",
        relatedConcepts: ["Spirits", "Divine light", "Spiritual essences"],
        category: "Spiritual World"
      },
      "alem-misal": {
        meaning: "The imaginal realm between spirit and matter, realm of dreams and visions",
        opposite: "Pure spirit and pure matter",
        relatedConcepts: ["Imagination", "Barzakh", "Dreams"],
        category: "Imaginal World"
      },
      "alem-ecsam": {
        meaning: "The physical world perceived by the senses",
        opposite: "World of spirits",
        relatedConcepts: ["Matter", "Body", "Physical senses"],
        category: "Physical World"
      },
      "insan-i-kamil": {
        meaning: "Perfect Human in whom all God's Names are manifested",
        opposite: "Enslaved soul (Nafs al-Ammâra)",
        relatedConcepts: ["Perfection", "Manifestation", "Spiritual pole"],
        category: "Perfect Human"
      },
      "kalp": {
        meaning: "The heart as barzakh between physical and spiritual, mirror of Divine Names",
        opposite: "Body (Jism)",
        relatedConcepts: ["Heart", "Mirror", "Remembrance"],
        category: "Heart"
      }
    },
    pt: {
      "dhat": {
        meaning: "A Essência infinita e indescritível de Deus",
        opposite: "Criação (Makhlûkat)",
        relatedConcepts: ["Essência", "Unidade (Wahda)"],
        category: "Essência"
      },
      "sifat-asma": {
        meaning: "Os Atributos de Deus e os Belos Nomes",
        opposite: "Atributos da criação",
        relatedConcepts: ["Belos Nomes", "Tajalli"],
        category: "Atributos Divinos"
      },
      "ayan-sabite": {
        meaning: "Essências inteligíveis existindo no conhecimento mas não atualizadas no ser",
        opposite: "Seres atualizados",
        relatedConcepts: ["Conhecimento Divino", "Ser"],
        category: "Mundo Inteligível"
      },
      "tecelli": {
        meaning: "A autorrevelação de Deus através de Seus Nomes e Atributos",
        opposite: "Ocultação (Ketm)",
        relatedConcepts: ["Tajalli Essencial", "Tajalli Atributivo", "Tajalli Ativo"],
        category: "Autorrevelação Divina"
      },
      "alem-ervah": {
        meaning: "O mundo dos espíritos abstratos, manifestação direta de Deus",
        opposite: "Mundo físico",
        relatedConcepts: ["Espíritos", "Luz divina", "Essências espirituais"],
        category: "Mundo Espiritual"
      },
      "alem-misal": {
        meaning: "O reino imaginal entre espírito e matéria, reino dos sonhos e visões",
        opposite: "Espírito puro e matéria pura",
        relatedConcepts: ["Imaginação", "Barzakh", "Sonhos"],
        category: "Mundo Imaginal"
      },
      "alem-ecsam": {
        meaning: "O mundo físico percebido pelos sentidos",
        opposite: "Mundo dos espíritos",
        relatedConcepts: ["Matéria", "Corpo", "Sentidos físicos"],
        category: "Mundo Físico"
      },
      "insan-i-kamil": {
        meaning: "Humano Perfeito em quem todos os Nomes de Deus se manifestam",
        opposite: "Alma escravizada (Nafs al-Ammâra)",
        relatedConcepts: ["Perfeição", "Manifestação", "Polo espiritual"],
        category: "Humano Perfeito"
      },
      "kalp": {
        meaning: "O coração como barzakh entre o físico e o espiritual, espelho dos Nomes Divinos",
        opposite: "Corpo (Jism)",
        relatedConcepts: ["Coração", "Espelho", "Lembrança"],
        category: "Coração"
      }
    }
  };

  function getLang() {
    return I18n.getLang();
  }

  function getMetadata(nodeId) {
    const lang = getLang();
    const data = nodeMetadata[lang] || nodeMetadata.en;
    return data[nodeId] || null;
  }

  function formatMetadataHtml(nodeId, label) {
    const meta = getMetadata(nodeId);
    if (!meta) return null;

    return `
      <div class="node-tooltip">
        <div class="node-tooltip__label">${label}</div>
        <div class="node-tooltip__meaning">${meta.meaning}</div>
        <div class="node-tooltip__category">${meta.category}</div>
      </div>
    `;
  }

  window.__graphEnhancement = {
    getMetadata,
    formatMetadataHtml,
    nodeMetadata
  };
})();
