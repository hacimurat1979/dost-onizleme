(function () {
  "use strict";

  // Gizli düzenleme modu: düz metin içinde "revise" yazınca açılır/kapanır.
  // Sadece elle yazılmış düz yazıyı (kısım metinleri, terim/hâl/sır
  // açıklamaları, hakkında sayfası) contenteditable yapar; hiçbir şeyi
  // doğrudan siteye yazmaz -- her değişiklik yalnızca bu tarayıcıda
  // (localStorage) tutulur, "Dışa Aktar" ile bir JSON dosyası olarak
  // indirilip bir sonraki oturumda Claude'a verilir. Bu yüzden kombinasyon
  // "gizli" olsa da güvenlik açığı değildir -- kimse siteyi doğrudan
  // değiştiremez. "revise" nadir bir kelime olduğu için (eski "uyan"ın
  // aksine) düz yazı içinde geçen sıradan kelimelerle çakışmıyor.
  const CODE = "revise";
  const QUEUE_KEY = "dost-edit-queue";
  let buffer = "";
  let editModeOn = false;
  let panel = null;
  let observer = null;
  const originalTexts = new WeakMap();

  const PROSE_SELECTOR = [
    "#detail-content p:not(.detail-eyebrow):not(.detail-metadata__category):not(.detail-metadata__meaning)",
    "#detail-content li",
    "#detail-content blockquote",
    "#futuhat-article p:not(.futuhat-hero__eyebrow):not(.futuhat-stats__heading)",
    "#futuhat-article blockquote",
    ".hakkinda-content__subtitle",
    ".hakkinda-content__section p",
    ".hakkinda-poem",
  ].join(", ");

  // Ekran görüntüsü yakalama: Screen Capture API'nin kendisini kullanır (yeni
  // bir kütüphane eklemeden) -- "preferCurrentTab" ipucu destekleyen
  // tarayıcılarda (Chrome/Edge) seçim penceresini atlayıp doğrudan bu
  // sekmeyi paylaşır. Tek kare alınıp iz hemen durdurulur; paylaşım göstergesi
  // tarayıcıda kalıcı olarak asılı kalmaz.
  const SCREENSHOT_MIME = "image/jpeg";
  const SCREENSHOT_MAX_WIDTH = 1600;

  function recordScreenshot(dataUrl, note) {
    const queue = getQueue();
    queue.push({
      type: "screenshot",
      url: location.pathname,
      lang: (window.DostI18n && window.DostI18n.getLang()) || "tr",
      note: note,
      image: dataUrl,
      timestamp: new Date().toISOString(),
    });
    setQueue(queue);
  }

  function buildScreenshotModal(dataUrl) {
    const modal = document.createElement("div");
    modal.className = "dost-shot-modal";
    modal.innerHTML =
      '<div class="dost-shot-modal__backdrop"></div>' +
      '<div class="dost-shot-modal__card" role="dialog" aria-modal="true">' +
      `<img class="dost-shot-modal__preview" src="${dataUrl}" alt="">` +
      '<label class="dost-shot-modal__label" for="dost-shot-note">Bu görüntüde ne var, ne düzeltilmeli?</label>' +
      '<textarea id="dost-shot-note" class="dost-shot-modal__note" rows="3" placeholder="Örn: bu kartın kenarı taşıyor / bu renk çok koyu…"></textarea>' +
      '<div class="dost-shot-modal__actions">' +
      '<button type="button" data-action="cancel">Vazgeç</button>' +
      '<button type="button" data-action="save" class="dost-shot-modal__save">Kaydet</button>' +
      "</div></div>";
    document.body.appendChild(modal);
    const textarea = modal.querySelector("textarea");
    textarea.focus();
    function close() { modal.remove(); }
    modal.querySelector(".dost-shot-modal__backdrop").addEventListener("click", close);
    modal.querySelector('[data-action="cancel"]').addEventListener("click", close);
    modal.querySelector('[data-action="save"]').addEventListener("click", () => {
      recordScreenshot(dataUrl, textarea.value.trim());
      close();
    });
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  async function captureScreenshot() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert("Bu tarayıcı ekran görüntüsü almayı desteklemiyor.");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { preferCurrentTab: true },
        preferCurrentTab: true,
      });
    } catch (e) {
      return; // kullanıcı izni vermedi/iptal etti
    }
    try {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      // Karenin gerçekten çizildiğinden emin olmak için bir sonraki
      // animasyon karesine kadar bekle.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const scale = Math.min(1, SCREENSHOT_MAX_WIDTH / (video.videoWidth || SCREENSHOT_MAX_WIDTH));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL(SCREENSHOT_MIME, 0.85);
      buildScreenshotModal(dataUrl);
    } finally {
      stream.getTracks().forEach((t) => t.stop());
    }
  }

  function getQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function setQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) {}
    updateBadge();
  }

  function nearestHeading(el) {
    let node = el.previousElementSibling;
    while (node) {
      if (/^H[1-4]$/.test(node.tagName)) return node.textContent.trim();
      node = node.previousElementSibling;
    }
    let parent = el.parentElement;
    while (parent) {
      const h = parent.querySelector("h1, h2, h3");
      if (h) return h.textContent.trim();
      parent = parent.parentElement;
    }
    return "";
  }

  function recordEdit(el, before, after) {
    if (before === after) return;
    const queue = getQueue();
    const entry = {
      url: location.pathname,
      lang: (window.DostI18n && window.DostI18n.getLang()) || "tr",
      heading: nearestHeading(el),
      before: before,
      after: after,
      timestamp: new Date().toISOString(),
    };
    const idx = el.dataset.dostEditIdx;
    if (idx !== undefined && queue[Number(idx)]) {
      entry.before = queue[Number(idx)].before; // ilk orijinal metni koru
      queue[Number(idx)] = entry;
      setQueue(queue);
      return;
    }
    queue.push(entry);
    el.dataset.dostEditIdx = String(queue.length - 1);
    setQueue(queue);
  }

  function makeEditable(el) {
    if (el.dataset.dostEditable) return;
    el.dataset.dostEditable = "1";
    el.setAttribute("contenteditable", "true");
    el.spellcheck = false;
    originalTexts.set(el, el.textContent);
    el.addEventListener("blur", () => {
      recordEdit(el, originalTexts.get(el), el.textContent);
    });
  }

  function scanAndMakeEditable() {
    document.querySelectorAll(PROSE_SELECTOR).forEach(makeEditable);
  }

  function updateBadge() {
    if (!panel) return;
    const badge = panel.querySelector(".dost-edit-panel__count");
    if (badge) badge.textContent = String(getQueue().length);
  }

  function exportQueue() {
    const queue = getQueue();
    const blob = new Blob([JSON.stringify(queue, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dost-duzenlemeler-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function clearQueue() {
    if (!confirm("Bekleyen tüm düzenlemeler silinsin mi? / Clear all pending edits?")) return;
    try { localStorage.removeItem(QUEUE_KEY); } catch (e) {}
    document.querySelectorAll("[data-dost-edit-idx]").forEach((el) => delete el.dataset.dostEditIdx);
    updateBadge();
  }

  function buildPanel() {
    panel = document.createElement("div");
    panel.className = "dost-edit-panel";
    panel.innerHTML =
      '<button type="button" class="dost-edit-panel__toggle" aria-label="Düzenleme paneli / Edit panel">' +
      '<span class="dost-edit-panel__icon">✎</span>' +
      '<span class="dost-edit-panel__count">' + getQueue().length + "</span>" +
      "</button>" +
      '<div class="dost-edit-panel__menu" hidden>' +
      '<p class="dost-edit-panel__hint">Düzenleme modu açık — düz yazı metinlere tıklayıp değiştirebilir, ya da bir ekran görüntüsü alıp not düşebilirsin.</p>' +
      '<button type="button" data-action="screenshot">📷 Ekran Görüntüsü Al</button>' +
      '<button type="button" data-action="export">Dışa Aktar</button>' +
      '<button type="button" data-action="clear">Temizle</button>' +
      '<button type="button" data-action="exit">Düzenleme Modunu Kapat</button>' +
      "</div>";
    document.body.appendChild(panel);
    const toggle = panel.querySelector(".dost-edit-panel__toggle");
    const menu = panel.querySelector(".dost-edit-panel__menu");
    toggle.addEventListener("click", () => { menu.hidden = !menu.hidden; });
    panel.querySelector('[data-action="screenshot"]').addEventListener("click", () => {
      menu.hidden = true;
      captureScreenshot();
    });
    panel.querySelector('[data-action="export"]').addEventListener("click", exportQueue);
    panel.querySelector('[data-action="clear"]').addEventListener("click", clearQueue);
    panel.querySelector('[data-action="exit"]').addEventListener("click", disableEditMode);
  }

  function enableEditMode() {
    editModeOn = true;
    document.body.classList.add("dost-edit-mode");
    scanAndMakeEditable();
    observer = new MutationObserver(scanAndMakeEditable);
    observer.observe(document.body, { childList: true, subtree: true });
    buildPanel();
  }

  function disableEditMode() {
    editModeOn = false;
    document.body.classList.remove("dost-edit-mode");
    document.querySelectorAll('[data-dost-editable]').forEach((el) => {
      el.removeAttribute("contenteditable");
      delete el.dataset.dostEditable;
    });
    if (observer) { observer.disconnect(); observer = null; }
    if (panel) { panel.remove(); panel = null; }
  }

  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-CODE.length);
    if (buffer === CODE) {
      buffer = "";
      if (editModeOn) disableEditMode();
      else enableEditMode();
    }
  });
})();
