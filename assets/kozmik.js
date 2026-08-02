/**
 * FAZ A -- "Kozmik Animasyonlar" görünümünün orkestratörü. Beş sahnenin
 * hiçbirini bilmiyor -- yalnız `window.DostKozmikSahne.<id>.mount(el, opts)`
 * / `.destroy()` sözleşmesine güveniyor (bkz. her sahne dosyasının başındaki
 * yorum). Veri (başlık/açıklama/kaynak/karar metinleri) data/ibn-arabi/
 * kozmik.json'dan geliyor.
 */
(function () {
  "use strict";
  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;
  const KU = window.DostKozmikUtils;

  const wrapEl = document.getElementById("kozmik-wrap");
  const pickerEl = document.getElementById("kozmik-picker");
  const stageEl = document.getElementById("kozmik-stage");
  const hintEl = document.getElementById("kozmik-hint");
  const noteEl = document.getElementById("kozmik-note");

  function tt(dict) {
    return I18n ? I18n.pick3(dict || {}) : (dict && (dict.tr || dict.en || dict.pt)) || "";
  }

  let dataPromise = null;
  let scenes = [];
  let activeId = null;
  let activeHandle = null; // { destroy() } dönen sahne örneği

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("kozmik-wrap");
    dataPromise = GU.fetchJson("data/ibn-arabi/kozmik.json")
      .then((data) => {
        scenes = data.sahneler || [];
        if (window.DostViewStatus) window.DostViewStatus.hide("kozmik-wrap");
        return data;
      })
      .catch((err) => {
        console.error("kozmik.json yüklenemedi", err);
        dataPromise = null;
        if (window.DostViewStatus) {
          window.DostViewStatus.showError("kozmik-wrap", () => window.__kozmikApp.activate());
        }
      });
    return dataPromise;
  }

  function sahneModulu(id) {
    const ns = window.DostKozmikSahne || {};
    return ns[id] || null;
  }

  function renderPicker() {
    pickerEl.innerHTML = scenes
      .map(
        (s) =>
          `<button type="button" class="kozmik-picker__btn" role="tab" data-id="${s.id}" aria-selected="${s.id === activeId}">` +
          `<span class="kozmik-picker__dot" aria-hidden="true"></span>${tt(s.baslik)}</button>`
      )
      .join("");
    pickerEl.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => selectScene(btn.dataset.id));
    });
  }

  function renderNote(scene) {
    if (!scene) {
      noteEl.innerHTML = "";
      return;
    }
    const blocks = [
      ["aciklama", { tr: "Ne görüyorsun", en: "What you're seeing", pt: "O que você está vendo" }],
      ["kaynak", { tr: "Hangi metne dayanıyor", en: "What text this rests on", pt: "Em que texto se apoia" }],
      ["karar", { tr: "Hangi kararı neden verdik", en: "Which decision we made, and why", pt: "Qual decisão tomamos, e por quê" }],
    ];
    noteEl.innerHTML = blocks
      .map(
        ([key, label]) =>
          `<div class="kozmik-note__block"><span class="kozmik-note__label">${tt(label)}</span>` +
          `<p class="kozmik-note__text">${tt(scene[key])}</p></div>`
      )
      .join("");
  }

  function selectScene(id) {
    if (activeId === id && activeHandle) return;
    if (activeHandle) {
      try {
        activeHandle.destroy();
      } catch (e) {
        console.error("sahne destroy() hata verdi", e);
      }
      activeHandle = null;
    }
    activeId = id;
    stageEl.innerHTML = "";
    pickerEl.querySelectorAll("button[data-id]").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.id === id));
    });
    const scene = scenes.find((s) => s.id === id);
    renderNote(scene);

    const mod = sahneModulu(id);
    if (!mod) {
      stageEl.textContent = "";
      return;
    }
    const reducedMotion = KU.prefersReducedMotion();
    hintEl.textContent = reducedMotion
      ? tt({
          tr: "Hareket azaltma tercihine saygı: durağan alternatif gösteriliyor.",
          en: "Respecting your reduced-motion preference: showing the still alternative.",
          pt: "Respeitando sua preferência de movimento reduzido: mostrando a alternativa estática.",
        })
      : id === "nefes"
        ? tt({
            tr: "Basılı tut: sahne senin nefesinle genişler.",
            en: "Press and hold: the scene expands with your breath.",
            pt: "Pressione e segure: a cena se expande com sua respiração.",
          })
        : "";
    try {
      activeHandle = mod.mount(stageEl, {
        reducedMotion: reducedMotion,
        particleScale: KU.particleScale(),
        seed: KU.freshSeed(),
      }) || { destroy: function () {} };
    } catch (e) {
      console.error("sahne mount() hata verdi: " + id, e);
      activeHandle = { destroy: function () {} };
    }
  }

  function stopActive() {
    if (activeHandle) {
      try {
        activeHandle.destroy();
      } catch (e) {
        console.error(e);
      }
      activeHandle = null;
    }
    stageEl.innerHTML = "";
  }

  // Görünüm gizlenince (başka bir bölüme geçilince) sahneyi durdur --
  // sürekli döngü halindeki dekoratif animasyonlar arka planda boşuna
  // CPU/pil harcamasın. mount()/destroy() zaten bu iş için var.
  new MutationObserver(() => {
    if (wrapEl.hidden) stopActive();
  }).observe(wrapEl, { attributes: true, attributeFilter: ["hidden"] });

  window.__kozmikApp = {
    activate() {
      fetchData().then((data) => {
        if (!data) return;
        if (!pickerEl.children.length) renderPicker();
        if (!activeHandle) selectScene(activeId || scenes[0].id);
      });
    },
    goToNode(id) {
      fetchData().then((data) => {
        if (!data) return;
        if (!pickerEl.children.length) renderPicker();
        selectScene(id);
      });
    },
    onLangChange() {
      if (pickerEl.children.length) renderPicker();
      const scene = scenes.find((s) => s.id === activeId);
      renderNote(scene);
    },
  };
})();
