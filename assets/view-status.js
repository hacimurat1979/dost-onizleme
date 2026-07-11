window.DostViewStatus = (function () {
  "use strict";

  function node(wrapId) {
    return document.getElementById(wrapId + "-status");
  }

  function pick3(dict) {
    return window.DostI18n ? window.DostI18n.pick3(dict) : (dict && (dict.tr || dict.en || dict.pt)) || "";
  }

  function showLoading(wrapId) {
    const el = node(wrapId);
    if (!el) return;
    el.hidden = false;
    el.classList.remove("view-status--error");
    const text = el.querySelector(".view-status__text");
    if (text) text.textContent = pick3({ tr: "Yükleniyor…", en: "Loading…", pt: "Carregando…" });
    const retry = el.querySelector(".view-status__retry");
    if (retry) retry.hidden = true;
  }

  function showError(wrapId, onRetry) {
    const el = node(wrapId);
    if (!el) return;
    el.hidden = false;
    el.classList.add("view-status--error");
    const text = el.querySelector(".view-status__text");
    if (text) {
      text.textContent = pick3({
        tr: "Veri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.",
        en: "Couldn't load the data. Check your connection and try again.",
        pt: "Não foi possível carregar os dados. Verifique sua conexão e tente novamente.",
      });
    }
    const retry = el.querySelector(".view-status__retry");
    if (retry) {
      retry.hidden = false;
      retry.textContent = pick3({ tr: "Tekrar dene", en: "Retry", pt: "Tentar novamente" });
      retry.onclick = onRetry;
    }
  }

  function hide(wrapId) {
    const el = node(wrapId);
    if (el) el.hidden = true;
  }

  return { showLoading, showError, hide };
})();
