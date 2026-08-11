// Hocalar — İbnü'l-Arabî'nin Rûhu'l-kuds'ta andığı 55 hocadan son ikisi,
// ikisi de kadın (docs/icerik-yol-haritasi.md D6).
//
// NEDEN BU BİÇİM. Basit bir liste-panel iskeleti, ama iki uzun PORTRE
// taşıyor -- her biri birden fazla doğrudan alıntı içeriyor (İbnü'l-Arabî'nin
// kendi sözleri, Austin'in çevirisinden). Bu yüzden panel bir "durum" değil
// bir "anlatı" gösteriyor; alıntılar sırayla, bağlamlarıyla birlikte.
window.__hocalarApp = (function () {
  "use strict";

  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;

  const wrapEl = document.getElementById("hocalar-wrap");
  const listEl = document.getElementById("hocalar-list");
  const digerEl = document.getElementById("hocalar-diger");
  const detailPanel = document.getElementById("detail-panel");
  const detailContent = document.getElementById("detail-content");

  if (!wrapEl || !listEl) return { activate() {}, onLangChange() {}, goToNode() {} };

  function tt(dict) { return I18n.pick3(dict || {}); }

  let data = null;
  let hocalar = [];
  let focusId = null;

  function alintiHtml(a) {
    const baglam = a.baglam ? `<p class="hoca-alinti__baglam">${tt(a.baglam)}</p>` : "";
    return `<blockquote class="hoca-alinti">
      <p class="hoca-alinti__metin">${tt(a.metin)}</p>
      ${baglam}
      <cite class="hoca-alinti__kaynak">${a.kaynak.eser}, s. ${a.kaynak.sayfa}</cite>
    </blockquote>`;
  }

  function kaynaklarHtml(list) {
    return list.map((k) => {
      const yil = k.yil ? ", " + k.yil : "";
      const not = k.not ? ` <span class="bilmiyoruz-madde__kaynak-not">— ${k.not}</span>` : "";
      return `<li class="bilmiyoruz-madde__kaynak">${k.yazar}, <em>${k.eser}</em>${yil}${not}</li>`;
    }).join("");
  }

  function panelGoster(d) {
    focusId = d.id;
    // 2026-08-09 kullanıcı geri bildirimi: başka bir akademik site "Şems
    // hakkında şunları biliyoruz" der, Dostarabi "Dost onu nasıl anlatıyor?"
    // diyebilmeli -- bu yüzden "Kendi ağzından" artık diğer bölümlerle aynı
    // ağırlıkta bir alt başlık değil, kendi görsel sınıfıyla (.hoca-sozler-
    // baslik) daha baskın; alıntılar da kendi sarmalayıcısında (.hoca-
    // sozler) daha ferah. Akademik kaynak listesi ise tam tersi yönde
    // sessizleşiyor -- eser-agi.js'teki aynı <details> deseni.
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt(d.konum)}
        <span class="hoca-sira-rozet">${d.sira}</span></p>
      <h2 class="detail-title">${tt(d.ad)}</h2>
      <p class="hoca-kimlik">${tt(d.kimlik)}</p>
      <div class="detail-block detail-block--soru"><p>${tt(d.ozet)}</p></div>
      <p class="hoca-sozler-baslik">${tt({ tr: "Kendi ağzından", en: "In his own words", pt: "Nas suas próprias palavras" })}</p>
      <div class="hoca-sozler">${d.alintilar.map(alintiHtml).join("")}</div>
      <details class="eser-agi-kaynak-detay hoca-kaynak-detay">
        <summary>${tt({ tr: "Kaynaklar", en: "Sources", pt: "Fontes" })}</summary>
        <ul class="bilmiyoruz-madde__kaynaklar">${kaynaklarHtml(d.kaynaklar)}</ul>
      </details>`;
    detailPanel.hidden = false;
  }

  function renderList() {
    // 2026-08-10 denetim bulgusu (G32): sayfa başlıksız, doğrudan "54/55"
    // numaralı kartla açılıyordu -- 55 hocadan neden yalnız ikisinin
    // portresi olduğu görünmüyordu. Gerekçe zaten veride yazılıydı
    // (hocalar.json "not" alanı, üç dilde, duruşa uygun: "okumadığımızı
    // söylemeyi tercih ettik") ama hiç ÇİZİLMİYORDU. Başlık + o not.
    const giris = `<div class="hocalar-giris">
        <h2 class="hocalar-giris__baslik">${tt({ tr: "Hocalar", en: "Teachers", pt: "Professores" })}</h2>
        <p class="hocalar-giris__not">${tt(data.not)}</p>
      </div>`;
    listEl.innerHTML = giris + hocalar.map((d) => `<button class="hoca-satir" type="button" data-id="${d.id}">
        <span class="hoca-satir__sira">${d.sira}</span>
        <span class="hoca-satir__govde">
          <span class="hoca-satir__ad">${tt(d.ad)}</span>
          <span class="hoca-satir__konum">${tt(d.konum)}</span>
        </span>
      </button>`).join("");
    listEl.querySelectorAll(".hoca-satir").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = hocalar.find((x) => x.id === btn.dataset.id);
        if (d) panelGoster(d);
      });
    });
  }

  // 2026-08-09 (kullanıcı isteği): altısının (Şems, Fâtıma + dört diğeri)
  // GERÇEK bağı -- hepsi Fütûhât'ın AYNI pasajında (s. 335), yıllar sonra,
  // tek tek anılıyor. GORSEL_DIL.md'nin "davranışı resmet" ilkesi: altı
  // nokta kendi başlarına durmuyor, hepsi o TEK kaynağa doğru yakınsıyor --
  // iç içe çemberler DEĞİL (GORSEL_DIL.md yasağı), her nokta merkeze kendi
  // çizgisiyle bağlanan bir yakınsama. Şems/Fâtıma'nın kendi portresi
  // olduğu için tıklanabilir; diğer dördünün yalnız adı/yeri var (veri
  // kendi notunda söylüyor: "her biri için ayrı bir kimlik/anlatı yok") --
  // o yüzden onlar tıklanamaz, yalnız etiketli.
  function vuslatSemasiHtml(dve) {
    if (!dve || !dve.kisiler || !dve.kisiler.length) return "";
    const kisiler = hocalar.slice(0, 2).concat(dve.kisiler);
    const n = kisiler.length;
    const cx = 160, cy = 148, r = 112;
    const noktalar = kisiler.map((k, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const a = Math.PI * (0.08 + t * 0.84);
      const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
      return { ad: tt(k.ad), id: k.id, x, y, tiklanabilir: i < 2 };
    });
    const cizgiler = noktalar.map((p) =>
      `<line class="hoca-vuslat__cizgi" x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${cx}" y2="${cy}" />`).join("");
    // 2026-08-09 UI denetimi bulgusu (pa11y): rolsüz bir <g>'ye aria-label
    // koymak axe'in aria-prohibited-attr kuralını ihliyor -- tıklanamayan
    // dört nokta için <title> kullanılıyor (SVG'nin kendi, her zaman geçerli
    // erişilebilir-ad yöntemi); yalnız GERÇEKTEN interaktif olan ikisi
    // role="button" TAŞIDIĞI için aria-label alabiliyor. Dış <svg>'nin
    // role="img" olması da "interaktif kontrol img içine yerleşmez" kuralını
    // ihliyordu (içeride iki gerçek düğme var) -- kaldırıldı, aria-label
    // SVG'nin kendi örtük rolüyle (graphics-document) zaten geçerli.
    const noktaEl = noktalar.map((p, i) => {
      const kisaAd = p.ad.length > 15 ? p.ad.slice(0, 14) + "…" : p.ad;
      // Komşu yaylardaki etiketler yatayda birbirine yakın düşebiliyor (6
      // nokta, dar bir yay) -- çift/tek indeksi iki farklı uzaklığa
      // ayırmak (eser-agi/seyahat-atlasi'nin kullandığı "iki sıraya diz"
      // ile aynı fikir) art arda gelen ikisinin üst üste binmesini önlüyor.
      const uzaklik = i % 2 === 0 ? 10 : 24;
      const etiketY = p.y < cy - 10 ? p.y - uzaklik : p.y + 18;
      const interaktif = p.tiklanabilir ? ` data-id="${p.id}" tabindex="0" role="button" aria-label="${p.ad}"` : "";
      const baslik = p.tiklanabilir ? "" : `<title>${p.ad}</title>`;
      return `<g class="hoca-vuslat__nokta${p.tiklanabilir ? " hoca-vuslat__nokta--tiklanabilir" : ""}"${interaktif}>
        ${baslik}<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5"></circle>
        <text x="${p.x.toFixed(1)}" y="${etiketY.toFixed(1)}" text-anchor="middle">${kisaAd}</text>
      </g>`;
    }).join("");
    return `<svg class="hoca-vuslat" viewBox="0 0 320 190" aria-label="${tt({
      tr: "Altısı da Fütûhât-ı Mekkiyye'nin aynı bölümünde (s. 335) bir arada anılıyor",
      en: "All six are named together in the same chapter of the Futuhat al-Makkiyya (p. 335)",
      pt: "Todos os seis são nomeados juntos no mesmo capítulo das Futuhat al-Makkiyya (p. 335)" })}">
      ${cizgiler}
      <circle class="hoca-vuslat__merkez" cx="${cx}" cy="${cy}" r="7"></circle>
      <text class="hoca-vuslat__merkez-etiket" x="${cx}" y="${cy + 24}" text-anchor="middle">${tt({ tr: "Fütûhât, s. 335", en: "Futuhat, p. 335", pt: "Futuhat, p. 335" })}</text>
      ${noktaEl}
    </svg>`;
  }

  function wireVuslatSemasi() {
    if (!digerEl) return;
    digerEl.querySelectorAll(".hoca-vuslat__nokta--tiklanabilir").forEach((el) => {
      const git = () => {
        const d = hocalar.find((x) => x.id === el.dataset.id);
        if (d) panelGoster(d);
      };
      el.addEventListener("click", git);
      el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); git(); } });
    });
  }

  // Fütûhât s.335'in Şems/Fâtıma'yla birlikte andığı dört kişi -- Rûhu'l-kuds'un
  // 55 hocalık listesinden değiller, o yüzden hoca-satir/panelGoster akışına
  // değil, sade ve tıklanamaz bir listeye giriyorlar (bkz. schema notu).
  function renderDiger() {
    if (!digerEl) return;
    let html = "";
    const dve = data.digerVeraEhli;
    if (dve) {
      const satirlar = dve.kisiler.map((k) =>
        `<li class="hocalar-diger__satir"><strong>${tt(k.ad)}</strong> — ${tt(k.konum)}</li>`).join("");
      html += `
        <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Fütûhât'ta da adı geçen diğerleri", en: "Others also named in the Futuhat", pt: "Outros também nomeados nas Futuhat" })}</p>
        <p class="hocalar-diger__not">${tt(dve.not)}</p>
        ${vuslatSemasiHtml(dve)}
        <ul class="hocalar-diger__liste">${satirlar}</ul>
        ${alintiHtml(dve.paylasilanNot)}`;
    }
    // Fütûhât'ın BAŞKA bölümlerinde tek cümlelik "üstad" izleri -- her biri
    // ayrı bir bölümden geldiği için digerVeraEhli'nin listesine karışmıyor.
    const dba = data.digerBolumlerdeAnilanlar;
    if (dba && dba.length) {
      const kartlar = dba.map((k) =>
        `<div class="hocalar-diger__satir">
           <strong>${tt(k.ad)}</strong>
           <p class="hoca-alinti__baglam">${tt(k.not)}</p>
           <cite class="hoca-alinti__kaynak">${k.kaynak.eser}, s. ${k.kaynak.sayfa}</cite>
         </div>`).join("");
      html += `
        <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Fütûhât'ın başka bölümlerinde geçen izler", en: "Traces in other chapters of the Futuhat", pt: "Vestígios noutros capítulos das Futuhat" })}</p>
        <div class="hocalar-diger__liste">${kartlar}</div>`;
    }
    // Nesebü'l-Hırka (Hırka Kitabı) silsile bağlantıları -- Rûhu'l-kuds
    // portresinden ayrı bir eksen: 'hoca-talebe' değil 'hırka veren-alan'
    // sözleşmesi (bkz. hocalar.schema.json hirkaSilsilesi tanımı).
    const hs = data.hirkaSilsilesi;
    if (hs && hs.kisiler && hs.kisiler.length) {
      const rolRozet = { "hirka-veren": { tr: "hırka veren", en: "gave the robe", pt: "deu o manto" },
                         "hirka-alan":  { tr: "hırka alan",  en: "received the robe", pt: "recebeu o manto" } };
      const kartlar = hs.kisiler.map((k) => {
        const rEt = rolRozet[k.rol] || rolRozet["hirka-veren"];
        const yilYer = (k.yil_hicri ? "h." + k.yil_hicri + ", " : "") + tt(k.yer);
        return `<div class="hocalar-diger__satir">
          <strong>${tt(k.ad)}</strong>
          <span class="hocalar-diger__rozet hocalar-diger__rozet--${k.rol}">${tt(rEt)}</span>
          <span class="hocalar-diger__meta"> — ${yilYer}</span>
          <p class="hoca-alinti__baglam">${tt(k.not)}</p>
          <cite class="hoca-alinti__kaynak">${k.kaynak.eser}, ${k.kaynak.sayfa}</cite>
        </div>`;
      }).join("");
      html += `
        <p class="detail-eyebrow detail-eyebrow--section">${tt({ tr: "Hırka silsilesi (Nesebü'l-Hırka'dan)", en: "Chain of the robe (from Nesebü'l-Hırka)", pt: "Cadeia do manto (do Nesebü'l-Hırka)" })}</p>
        <p class="hocalar-diger__not">${tt(hs.not)}</p>
        <div class="hocalar-diger__liste">${kartlar}</div>`;
    }
    digerEl.innerHTML = html;
    wireVuslatSemasi();
  }

  function girisPaneli() {
    focusId = null;
    detailContent.innerHTML = `
      <p class="detail-eyebrow">${tt({ tr: "Hocalar", en: "Teachers", pt: "Mestres" })}</p>
      <h2 class="detail-title">${tt({ tr: "Listenin sonundaki iki isim", en: "The last two names on the list", pt: "Os dois últimos nomes da lista" })}</h2>
      <div class="detail-block detail-block--soru"><p>${tt(data.not)}</p></div>`;
    detailPanel.hidden = false;
  }

  let yuklendi = false;
  function yukle() {
    if (yuklendi) return Promise.resolve();
    const base = window.__dostRouteBase || "";
    const url = (base ? base + "/" : "") + "data/ibn-arabi/hocalar.json";
    return GU.fetchJson(url).then((d) => {
      data = d;
      hocalar = d.hocalar || [];
      yuklendi = true;
      renderList();
      renderDiger();
    });
  }

  let baglandi = false;
  function baglaBirKez() {
    if (baglandi) return;
    baglandi = true;
    if (GU.setupDetailPanelFocus) GU.setupDetailPanelFocus();
    GU.registerStepBack("hocalar-wrap", () => {
      if (focusId) { girisPaneli(); return true; }
      return false;
    });
  }

  return {
    activate() {
      // 2026-08-06 kullanıcı bulgusu: görünüm ilk açıldığında detay paneli
      // otomatik açılıyordu (girisPaneli() burada çağrılıyordu) -- oysa
      // ETKILESIM_DILI.md'nin "bağlanmamış düğme" ilkesinin tersi bir
      // sorun bu: kullanıcı hiçbir şey seçmeden panel zaten açık geliyordu.
      // Artık veri sessizce yükleniyor, panel yalnız bir kayıt seçildiğinde
      // açılıyor.
      baglaBirKez();
      yukle().catch(() => {
        const st = document.getElementById("hocalar-wrap-status");
        if (st) {
          st.hidden = false;
          st.querySelector(".view-status__text").textContent =
            tt({ tr: "İçerik yüklenemedi.", en: "The content could not be loaded.", pt: "O conteúdo não pôde ser carregado." });
        }
      });
    },
    onLangChange() {
      if (!yuklendi) return;
      renderList();
      renderDiger();
      if (focusId) {
        const d = hocalar.find((x) => x.id === focusId);
        if (d) panelGoster(d); else if (!detailPanel.hidden) girisPaneli();
      } else if (!detailPanel.hidden) girisPaneli();
    },
    goToNode(id) {
      this.activate();
      yukle().then(() => {
        const d = hocalar.find((x) => x.id === id);
        if (d) panelGoster(d);
      });
    },
  };
})();
