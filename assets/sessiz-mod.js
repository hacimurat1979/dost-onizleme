/* Sessiz Mod — dikkat dağıtmayan okuma görünümü. Üst menüyü, dil/tema
 * düğmelerini gizleyip yalnız okunan metni bırakan, tersine çevrilebilir
 * tek bir anahtar. Fütûhât/Füsûs kısımları için düşünüldü ama herhangi bir
 * görünümde çalışır -- kapsamı daraltmak yeni bir kısıt eklerdi, gerek yok.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "dost-sessiz-mod";
  var btn = null;
  var rozet = null;

  function isOn() {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch (e) { return false; }
  }

  // 2026-08-10 denetim bulgusu (G55): mod localStorage ile kalıcı ve açık
  // olduğunun tek işareti sağ alttaki küçük düğmeydi -- ertesi gün dönen
  // kullanıcı "menüm nereye gitti" yaşayabiliyordu (denetimin kendisini de
  // yanılttı). Mod açıkken silik bir rozet, ne olduğunu ve çıkışı söylüyor.
  function rozetMetni() {
    var lang = (window.I18n && typeof I18n.current === "function" && I18n.current()) ||
      document.documentElement.getAttribute("lang") || "tr";
    if (String(lang).indexOf("en") === 0) return "Silent mode — press Esc to leave";
    if (String(lang).indexOf("pt") === 0) return "Modo silencioso — Esc para sair";
    return "Sessiz mod — çıkmak için Esc";
  }

  function ensureRozet() {
    if (rozet) return rozet;
    rozet = document.createElement("div");
    rozet.className = "sessiz-mod-rozet";
    rozet.setAttribute("role", "status");
    document.body.appendChild(rozet);
    return rozet;
  }

  function setOn(on) {
    document.body.classList.toggle("sessiz-mod-on", on);
    if (btn) btn.setAttribute("aria-pressed", String(on));
    ensureRozet().textContent = on ? rozetMetni() : "";
    try { localStorage.setItem(STORAGE_KEY, on ? "1" : "0"); } catch (e) {}
  }

  function buildButton() {
    var b = document.createElement("button");
    b.type = "button";
    b.id = "sessiz-mod-toggle";
    b.className = "sessiz-mod-toggle";
    b.title = "Sessiz Mod: üst menüyü gizle — Silent Mode: hide the top menu — Modo Silencioso: ocultar o menu superior";
    b.setAttribute("aria-label", "Sessiz Mod / Silent Mode / Modo Silencioso");
    b.setAttribute("aria-pressed", "false");
    b.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<circle class="sessiz-mod-toggle__ring" cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
      '<circle class="sessiz-mod-toggle__dot" cx="12" cy="12" r="2.6" fill="currentColor"/>' +
      "</svg>";
    b.addEventListener("click", function () { setOn(!isOn()); });
    document.body.appendChild(b);
    return b;
  }

  function onKeydown(e) {
    if (e.key === "Escape" && isOn()) setOn(false);
  }

  function init() {
    btn = buildButton();
    setOn(isOn());
    document.addEventListener("keydown", onKeydown);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
