/* Ontoloji mobil alternatif liste (2026-08-10, denetim raporu 16-A).
 * Grafik mobilde okunmuyor (G57 CONFIRMED); bu liste veriyi aynı sırada
 * gösterir ve her satır düğüm paneline gider. Grafiği açma seçeneği
 * korunuyor -- "Bu bir kimlik değil, bir kolaylık" duruşu: harita
 * sitenin görsel kimliği ama okunmayan kimlik yüktür (EK A.2).
 * Masaüstünde liste hep gizli (CSS media query); JS yalnız içeriği doldurur.
 */
(function () {
  "use strict";

  const I18n = window.DostI18n;
  const wrap = document.getElementById("ontology-wrap");
  const listeEl = document.getElementById("ontoloji-mobil-liste");
  if (!wrap || !listeEl) return;

  // Aşağıdaki sıra ontology.json'daki iniş omurgasını izliyor:
  // Zât → Esmâ → A'yân → Tecellî → 3 âlem → İnsan-ı Kâmil → Kalp → Zât'a dönüş.
  // Halîfe/Velî/Perde/Kazâ/Teceddüd/Bilinen-Bilinmeyen "yan" kavramlar; ana
  // omurga altında ayrı bir grupta.
  const OMURGA = [
    "dhat", "sifat-asma", "ayan-sabite", "tecelli",
    "alem-ervah", "alem-misal", "alem-ecsam",
    "insan-i-kamil", "kalp",
  ];
  const YAN = [
    "kaza-kader", "perde", "teceddud",
    "veli", "halife", "bilinen-bilinmeyen",
  ];

  function pipCls(id) {
    if (id === "dhat") return "ontoloji-mobil-liste__pip--zat";
    if (id === "kalp") return "ontoloji-mobil-liste__pip--return";
    if (id === "teceddud") return "ontoloji-mobil-liste__pip--paradox";
    return "";
  }

  function tt(v) {
    if (I18n && typeof I18n.pick3 === "function") return I18n.pick3(v || {});
    return (v && (v.tr || v.en || v.pt)) || "";
  }

  function goToNode(id) {
    if (window.__dostNav && typeof window.__dostNav.goTo === "function") {
      window.__dostNav.goTo("ontoloji", id);
    } else {
      // Fallback: URL'yi değiştir, tarayıcının history'sini kullan.
      const base = window.__dostRouteBase || "";
      history.pushState(null, "", base + "/ontoloji/" + id);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }

  function satirHtml(node) {
    const ad = tt(node.name);
    const ozet = tt(node.short);
    return `<li><button class="ontoloji-mobil-liste__satir" type="button" data-id="${node.id}">
      <span class="ontoloji-mobil-liste__pip ${pipCls(node.id)}"></span>
      <span class="ontoloji-mobil-liste__govde">
        <span class="ontoloji-mobil-liste__ad">${ad}</span>
        ${ozet ? `<span class="ontoloji-mobil-liste__ozet">${ozet}</span>` : ""}
      </span>
    </button></li>`;
  }

  let sonNodes = null;

  function doldur(nodes) {
    sonNodes = nodes;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const omurga = OMURGA.map((id) => byId.get(id)).filter(Boolean);
    const yan = YAN.map((id) => byId.get(id)).filter(Boolean);
    // Beklenmedik yeni bir düğüm eklendiyse (dördüncü ilke: graf büyüyor),
    // OMURGA/YAN listelerinde olmayanları sonda göster -- sessizce düşme.
    const bilinenler = new Set([...OMURGA, ...YAN]);
    const kalanlar = nodes.filter((n) => !bilinenler.has(n.id));

    listeEl.innerHTML = `
      <h2 class="ontoloji-mobil-liste__baslik">${tt({
        tr: "Varlık Mertebeleri",
        en: "The Ranks of Being",
        pt: "As Hierarquias do Ser",
      })}</h2>
      <p class="ontoloji-mobil-liste__not">${tt({
        tr: "Grafiği okumak için ekran dar geldi — mertebeler burada iniş sırasıyla, listede. Bir başlığa dokun, paneli oku.",
        en: "The graph does not fit this narrow screen — the ranks are here as a list, in order of descent. Tap a title to read its panel.",
        pt: "O gráfico não cabe neste ecrã estreito — as hierarquias estão aqui como lista, na ordem da descida. Toque num título para ler o painel.",
      })}</p>
      <ul class="ontoloji-mobil-liste__ul">${omurga.map(satirHtml).join("")}</ul>
      ${yan.length ? `<h3 class="ontoloji-mobil-liste__baslik" style="font-size:0.95rem;margin-top:18px">${tt({
        tr: "Yan Kavramlar",
        en: "Adjacent Concepts",
        pt: "Conceitos Adjacentes",
      })}</h3><ul class="ontoloji-mobil-liste__ul">${yan.map(satirHtml).join("")}</ul>` : ""}
      ${kalanlar.length ? `<ul class="ontoloji-mobil-liste__ul">${kalanlar.map(satirHtml).join("")}</ul>` : ""}
      <button class="ontoloji-mobil-liste__grafik-btn" type="button" id="ontoloji-mobil-grafik-btn">${tt({
        tr: "Haritayı aç (grafiği göster)",
        en: "Open the map (show the graph)",
        pt: "Abrir o mapa (mostrar o grafo)",
      })}</button>
    `;

    listeEl.querySelectorAll(".ontoloji-mobil-liste__satir").forEach((btn) => {
      btn.addEventListener("click", () => goToNode(btn.dataset.id));
    });
    const grafikBtn = document.getElementById("ontoloji-mobil-grafik-btn");
    if (grafikBtn) {
      grafikBtn.addEventListener("click", () => {
        wrap.classList.add("ontoloji-grafik-acik");
        // Grafik açıldığında layout değişince ontology.js'in resize hesabı
        // yeniden tetiklenmeli, aksi hâlde SVG önceki (sıfır yüksekliğe
        // düşmüş) ölçüde kalır. Layout'ın uygulanması için bir frame bekle.
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
        });
      });
    }
  }

  // Ontoloji veri yükleme: ontology.js kendi verisini bir CustomEvent ile
  // duyurmuyor; en güvenli yol veriyi doğrudan almak. Ama window.__dostGraf
  // gibi bir API yok. Basit yaklaşım: kendimiz fetch edelim.
  function yukle() {
    const base = (document.querySelector("base") && document.querySelector("base").getAttribute("href")) || "/";
    const url = base.replace(/\/+$/, "") + "/data/ibn-arabi/ontology.json";
    fetch(url).then((r) => r.json()).then((d) => doldur(d.nodes || [])).catch(() => {
      // Sessizce başarısız ol: mobil olmayan görünümlerde liste zaten
      // hiç gösterilmez, bir hata mesajıyla kullanıcıyı korkutmayalım.
    });
  }

  // Yalnız mobilde ihtiyaç var; genişlik değişince tekrar bakalım.
  function mobilMi() { return window.matchMedia("(max-width: 640px)").matches; }
  if (mobilMi()) {
    yukle();
  } else {
    // Küçültüldüğünde yükle -- yalnız bir kez.
    const mq = window.matchMedia("(max-width: 640px)");
    const kez = () => { if (mq.matches) { yukle(); mq.removeEventListener("change", kez); } };
    mq.addEventListener("change", kez);
  }

  // Dil değişince liste tazelensin. I18n olay yaymıyor; onun yerine
  // ontology.js kendi dispatch zincirinde (renderLangSwitcher'ın onChange
  // callback'i) sitedeki her görünüm için `window.__<view>App.onLangChange()`
  // çağırıyor. Aynı desene uyup kendi kancamızı açıyoruz.
  window.__ontolojiMobilListeApp = {
    onLangChange: () => { if (sonNodes) doldur(sonNodes); },
  };
})();
