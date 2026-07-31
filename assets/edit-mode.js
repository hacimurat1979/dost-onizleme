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
  const CODE = "@revise";
  const QUEUE_KEY = "dost-edit-queue";
  // Benzetmelerin görünürlüğü de bu moda bağlı (2026-07-27): ayrı bir
  // "benzetme" kelimesi vardı, kullanıcı isteğiyle buraya katıldı --
  // revize kipi zaten "yazıları gözden geçirdiğim kip" olduğu için
  // gizlenmiş "Bir benzetmeyle" blokları da orada açılıyor. Bayrak
  // localStorage'da: benzetmeler render sırasında okunuyor, o yüzden
  // kipi açıp kapatmak sayfayı yeniden çizdiriyor (aşağıya bak).
  const ANALOGY_KEY = "dost-analogy-visible";
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

  // Görsel not: bu sayfa için bir metin notu ("burada şu değişmeli"),
  // istenirse bir ekran görüntüsüyle birlikte. Görüntü ZORUNLU değil --
  // sadece metinle de bir görsel revize isteği bırakılabilir. Görüntü
  // eklemenin iki yolu var: Screen Capture API ile canlı yakalama (yeni bir
  // kütüphane eklemeden; "preferCurrentTab" ipucu destekleyen tarayıcılarda
  // seçim penceresini atlar) -- ki bu mobil/tablet tarayıcılarda (iPadOS
  // Safari, Android Chrome) hiç desteklenmiyor -- ya da cihazın kendi ekran
  // görüntüsünü (OS'in kendi tuş/hareket kombinasyonuyla alınmış) galeriden
  // seçip yükleme. İkisi de aynı modaldeki aynı önizlemeye, aynı kuyruğa çıkıyor.
  const SCREENSHOT_MIME = "image/jpeg";
  const SCREENSHOT_MAX_WIDTH = 1600;
  const supportsCapture = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  let fileInputEl = null;

  function drawToCanvas(source, srcWidth, srcHeight) {
    const scale = Math.min(1, SCREENSHOT_MAX_WIDTH / (srcWidth || SCREENSHOT_MAX_WIDTH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(srcWidth * scale));
    canvas.height = Math.max(1, Math.round(srcHeight * scale));
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(SCREENSHOT_MIME, 0.85);
  }

  function ensureFileInput() {
    if (fileInputEl) return fileInputEl;
    fileInputEl = document.createElement("input");
    fileInputEl.type = "file";
    fileInputEl.accept = "image/*";
    fileInputEl.style.display = "none";
    document.body.appendChild(fileInputEl);
    return fileInputEl;
  }

  // Dosya seçiciyi tıklatıp seçilen görüntüyü (varsa) sıkıştırılmış bir
  // data URL olarak döndürür; vazgeçilirse null döner.
  function pickImageFileToDataUrl() {
    return new Promise((resolve) => {
      const input = ensureFileInput();
      input.onchange = async () => {
        const file = input.files && input.files[0];
        input.value = "";
        if (!file) { resolve(null); return; }
        const bitmap = await createImageBitmap(file);
        resolve(drawToCanvas(bitmap, bitmap.width, bitmap.height));
      };
      input.click();
    });
  }

  // Tek karelik canlı ekran yakalama; desteklenmiyorsa ya da kullanıcı izni
  // iptal ederse null döner (modal bunu sessizce görmezden gelir).
  async function captureScreenshotToDataUrl() {
    if (!supportsCapture) return null;
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { preferCurrentTab: true },
        preferCurrentTab: true,
      });
    } catch (e) {
      return null; // kullanıcı izni vermedi/iptal etti
    }
    try {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      // Karenin gerçekten çizildiğinden emin olmak için bir sonraki
      // animasyon karesine kadar bekle.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return drawToCanvas(video, video.videoWidth, video.videoHeight);
    } finally {
      stream.getTracks().forEach((t) => t.stop());
    }
  }

  function recordVisualNote(note, dataUrl) {
    const queue = getQueue();
    queue.push({
      type: "visual-note",
      url: location.pathname,
      lang: (window.DostI18n && window.DostI18n.getLang()) || "tr",
      note: note,
      image: dataUrl || null,
      timestamp: new Date().toISOString(),
    });
    setQueue(queue);
  }

  function buildVisualNoteModal() {
    const modal = document.createElement("div");
    modal.className = "dost-shot-modal";
    modal.innerHTML =
      '<div class="dost-shot-modal__backdrop"></div>' +
      '<div class="dost-shot-modal__card" role="dialog" aria-modal="true">' +
      '<div class="dost-shot-modal__attach">' +
      (supportsCapture ? '<button type="button" data-action="capture">📷 Ekran Görüntüsü Al</button>' : "") +
      '<button type="button" data-action="pick">🖼️ Galeriden Seç</button>' +
      '<button type="button" data-action="remove-image" class="dost-shot-modal__remove" hidden>Görüntüyü kaldır</button>' +
      "</div>" +
      '<img class="dost-shot-modal__preview" alt="" hidden ' +
      // src\'siz <img> kırık görsel kutusu olarak yüklenir; görüntü seçilene
      // kadar şeffaf 1x1 piksel tutuyoruz (impeccable A9)
      'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">' +
      '<label class="dost-shot-modal__label" for="dost-shot-note">Bu sayfada ne değişmeli?</label>' +
      '<textarea id="dost-shot-note" class="dost-shot-modal__note" rows="3" placeholder="İstersen yukarıdan bir ekran görüntüsü ekle, istersen sadece burada anlat…"></textarea>' +
      '<div class="dost-shot-modal__actions">' +
      '<button type="button" data-action="cancel">Vazgeç</button>' +
      '<button type="button" data-action="save" class="dost-shot-modal__save">Kaydet</button>' +
      "</div></div>";
    document.body.appendChild(modal);

    let currentImage = null;
    const preview = modal.querySelector(".dost-shot-modal__preview");
    const removeBtn = modal.querySelector('[data-action="remove-image"]');
    const textarea = modal.querySelector("textarea");
    textarea.focus();

    function setImage(dataUrl) {
      currentImage = dataUrl;
      preview.src = dataUrl || "";
      preview.hidden = !dataUrl;
      removeBtn.hidden = !dataUrl;
    }
    function close() { modal.remove(); }

    modal.querySelector(".dost-shot-modal__backdrop").addEventListener("click", close);
    modal.querySelector('[data-action="cancel"]').addEventListener("click", close);
    removeBtn.addEventListener("click", () => setImage(null));
    const captureBtn = modal.querySelector('[data-action="capture"]');
    if (captureBtn) {
      captureBtn.addEventListener("click", async () => {
        const dataUrl = await captureScreenshotToDataUrl();
        if (dataUrl) setImage(dataUrl);
      });
    }
    modal.querySelector('[data-action="pick"]').addEventListener("click", async () => {
      const dataUrl = await pickImageFileToDataUrl();
      if (dataUrl) setImage(dataUrl);
    });
    modal.querySelector('[data-action="save"]').addEventListener("click", () => {
      const note = textarea.value.trim();
      if (!note && !currentImage) { textarea.focus(); return; }
      recordVisualNote(note, currentImage);
      close();
    });
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
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

  // --- Biriken notların listesi: görüntüle / düzenle / sil ---------------
  // Önce yalnızca "kaydet ve unut" vardı; kullanıcı bir notu kaydettikten
  // sonra ona bir daha ulaşamadığını bildirdi (2026-07-25). Artık panelden
  // bütün kuyruk açılıp tek tek düzeltilebiliyor ya da silinebiliyor.
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
    ));
  }

  function entryTitle(e, i) {
    const where = (e.url || "").replace(/^.*\/(?=[^/]*$)/, "") || "/";
    if (e.type === "visual-note") return `${i + 1}. 🖌️ görsel not · ${escapeHtml(where)}`;
    return `${i + 1}. ✎ metin · ${escapeHtml(e.heading || where)}`;
  }

  function deleteEntry(idx) {
    const q = getQueue();
    if (!q[idx]) return;
    if (!confirm("Bu not silinsin mi? / Delete this note?")) return;
    q.splice(idx, 1);
    setQueue(q);
    // Metin düzenlemeleri kuyruk indeksini eleman üzerinde tutuyor; bir kayıt
    // silinince sonrakilerin indeksi kayar, o yüzden hepsini tazeliyoruz.
    document.querySelectorAll("[data-dost-edit-idx]").forEach((el) => {
      const v = Number(el.dataset.dostEditIdx);
      if (v === idx) delete el.dataset.dostEditIdx;
      else if (v > idx) el.dataset.dostEditIdx = String(v - 1);
    });
    renderNoteList();
  }

  function saveEntryText(idx, value) {
    const q = getQueue();
    if (!q[idx]) return;
    if (q[idx].type === "visual-note") q[idx].note = value;
    else q[idx].after = value;
    q[idx].editedAt = new Date().toISOString();
    setQueue(q);
  }

  let listModal = null;
  function renderNoteList() {
    if (!listModal) return;
    const body = listModal.querySelector(".dost-notes__body");
    const q = getQueue();
    if (!q.length) {
      body.innerHTML = '<p class="dost-notes__empty">Henüz kayıtlı not yok.</p>';
      return;
    }
    body.innerHTML = q.map((e, i) => `
      <div class="dost-notes__item" data-idx="${i}">
        <div class="dost-notes__head">
          <span class="dost-notes__title">${entryTitle(e, i)}</span>
          <button type="button" class="dost-notes__del" data-del="${i}">Sil</button>
        </div>
        ${e.type !== "visual-note" && e.before ? `<p class="dost-notes__before">${escapeHtml(e.before)}</p>` : ""}
        ${e.image ? `<img class="dost-notes__thumb" src="${e.image}" alt="">` : ""}
        <textarea class="dost-notes__text" data-text="${i}" rows="3">${escapeHtml(e.type === "visual-note" ? e.note : e.after)}</textarea>
      </div>`).join("");
    body.querySelectorAll("[data-del]").forEach((b) => {
      b.addEventListener("click", () => deleteEntry(Number(b.dataset.del)));
    });
    body.querySelectorAll("[data-text]").forEach((t) => {
      t.addEventListener("input", () => saveEntryText(Number(t.dataset.text), t.value));
    });
  }

  function openNoteList() {
    listModal = document.createElement("div");
    listModal.className = "dost-shot-modal dost-notes";
    listModal.innerHTML =
      '<div class="dost-shot-modal__backdrop"></div>' +
      '<div class="dost-shot-modal__card dost-notes__card" role="dialog" aria-modal="true">' +
      '<p class="dost-shot-modal__label">Kayıtlı notlar — düzenleyebilir ya da silebilirsin</p>' +
      '<div class="dost-notes__body"></div>' +
      '<div class="dost-shot-modal__actions">' +
      '<button type="button" data-action="close" class="dost-shot-modal__save">Kapat</button>' +
      "</div></div>";
    document.body.appendChild(listModal);
    const close = () => { listModal.remove(); listModal = null; };
    listModal.querySelector(".dost-shot-modal__backdrop").addEventListener("click", close);
    listModal.querySelector('[data-action="close"]').addEventListener("click", close);
    listModal.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    renderNoteList();
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
      '<p class="dost-edit-panel__hint">Düzenleme modu açık — düz yazı metinlere tıklayıp değiştirebilir, ya da bu sayfa için bir görsel not bırakabilirsin (ekran görüntüsüyle ya da görüntü olmadan).</p>' +
      '<button type="button" data-action="visual-note">🖌️ Bu Sayfa İçin Görsel Not</button>' +
      '<button type="button" data-action="notes">📋 Kayıtlı Notlar</button>' +
      '<button type="button" data-action="export">Dışa Aktar</button>' +
      '<button type="button" data-action="clear">Temizle</button>' +
      '<button type="button" data-action="minimize">Küçült ↑</button>' +
      '<button type="button" data-action="exit">Düzenleme Modunu Kapat</button>' +
      "</div>";
    document.body.appendChild(panel);
    const toggle = panel.querySelector(".dost-edit-panel__toggle");
    const menu = panel.querySelector(".dost-edit-panel__menu");
    // Drag-or-click on toggle: drag moves panel, click without movement toggles menu
    let dragStartX = 0, dragStartY = 0, panelStartL = 0, panelStartB = 0, hasDragged = false;
    toggle.addEventListener("mousedown", (e) => {
      dragStartX = e.clientX; dragStartY = e.clientY; hasDragged = false;
      const r = panel.getBoundingClientRect();
      panelStartL = r.left; panelStartB = window.innerHeight - r.bottom;
      const onMove = (me) => {
        const dx = me.clientX - dragStartX, dy = me.clientY - dragStartY;
        if (!hasDragged && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        if (!hasDragged) {
          hasDragged = true;
          // Keep bottom anchoring: the menu opens upward from the toggle,
          // so pinning `top` would push it off the bottom of the viewport.
          panel.style.right = "auto"; panel.style.top = "auto";
        }
        panel.style.left   = Math.max(0, Math.min(window.innerWidth - r.width, panelStartL + dx)) + "px";
        panel.style.bottom = Math.max(0, Math.min(window.innerHeight - r.height, panelStartB - dy)) + "px";
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        if (!hasDragged) menu.hidden = !menu.hidden;
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    panel.querySelector('[data-action="visual-note"]').addEventListener("click", () => {
      menu.hidden = true;
      buildVisualNoteModal();
    });
    panel.querySelector('[data-action="notes"]').addEventListener("click", () => {
      menu.hidden = true;
      openNoteList();
    });
    panel.querySelector('[data-action="export"]').addEventListener("click", exportQueue);
    panel.querySelector('[data-action="clear"]').addEventListener("click", clearQueue);
    panel.querySelector('[data-action="minimize"]').addEventListener("click", () => { menu.hidden = true; });
    panel.querySelector('[data-action="exit"]').addEventListener("click", disableEditMode);
  }

  function enableEditMode() {
    editModeOn = true;
    setAnalogyVisible(true);
    document.body.classList.add("dost-edit-mode");
    scanAndMakeEditable();
    observer = new MutationObserver(scanAndMakeEditable);
    observer.observe(document.body, { childList: true, subtree: true });
    buildPanel();
  }

  function disableEditMode() {
    editModeOn = false;
    setAnalogyVisible(false);
    document.body.classList.remove("dost-edit-mode");
    document.querySelectorAll('[data-dost-editable]').forEach((el) => {
      el.removeAttribute("contenteditable");
      delete el.dataset.dostEditable;
    });
    if (observer) { observer.disconnect(); observer = null; }
    if (panel) { panel.remove(); panel = null; }
  }

  // Bayrak yalnız değiştiğinde sayfa yenileniyor: benzetme blokları
  // render sırasında okunduğu için, açık bir detay panelinin kendiliğinden
  // güncellenmesinin başka yolu yok. Yenilemeden sonra kip geri açılsın
  // diye "editModeOn" da saklanıyor.
  function setAnalogyVisible(on) {
    let cur = false;
    try { cur = localStorage.getItem(ANALOGY_KEY) === "1"; } catch (e) {}
    if (cur === on) return;
    try {
      localStorage.setItem(ANALOGY_KEY, on ? "1" : "0");
      localStorage.setItem(MODE_KEY, on ? "1" : "0");
    } catch (e) {}
    location.reload();
  }
  const MODE_KEY = "dost-edit-mode-on";

  // Beş görünüm modülü (esma/hal/ontology/sorular/terimler) benzetme
  // bloklarını çizmeden önce buna bakıyor. Eskiden ayrı bir dosyadaydı
  // (assets/analogy-toggle.js); kip birleşince buraya taşındı.
  window.DostAnalogy = {
    visible: function () {
      try { return localStorage.getItem(ANALOGY_KEY) === "1"; } catch (e) { return false; }
    },
  };

  // Sayfa yenilendikten sonra kipi geri aç.
  try {
    if (localStorage.getItem(MODE_KEY) === "1") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", enableEditMode);
      } else enableEditMode();
    }
  } catch (e) {}

  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    // AltGr (Ctrl+Alt) Türkçe klavyede "@" üretiyor; bu bileşimi
    // engellemiyoruz, yoksa kelime hiç yazılamaz. Tek başına Ctrl/Alt
    // ya da Meta ise kısayoldur, geçilir.
    if (e.metaKey) return;
    if ((e.ctrlKey || e.altKey) && !(e.ctrlKey && e.altKey)) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-CODE.length);
    if (buffer === CODE) {
      buffer = "";
      if (editModeOn) disableEditMode();
      else enableEditMode();
    }
  });
})();
