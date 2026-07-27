(function () {
  "use strict";
  // "Bir benzetmeyle" bölümleri 2026-07-27'de kullanıcı kararıyla sitenin
  // görünen yüzünden kaldırıldı: şimdilik Dost'un kendi kitaplarının
  // anlaşılır ve görsel olarak hissedilebilir özetlerine odaklanıyoruz;
  // benzetmeler bütün cilt okumaları bittikten sonra "nereden nereye
  // geldik" penceresinden yeniden yazılacak.
  //
  // Metinler SİLİNMEDİ, sadece gösterilmiyor -- yazarın onları ara ara
  // okuyup revize edebilmesi gerekiyordu. Bunun için gizli bir anahtar
  // kelime görünürlüğü açıp kapatıyor: sayfada (bir metin kutusunda
  // değilken) "benzetme" yazmak yeter. Aynı kalıp compare.html'in gizli
  // görünümünde de kullanılıyor (bkz. assets/daphne-profil-nav.js).
  const KEY = "dost-analogy-visible";
  const CODE = "benzetme";
  let buffer = "";

  function visible() {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  window.DostAnalogy = { visible: visible };

  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-CODE.length);
    if (buffer !== CODE) return;
    buffer = "";
    const next = !visible();
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch (e2) {}
    // Görünürlük render sırasında okunuyor; en basit ve en güvenilir
    // uygulama, açık olan görünümü baştan çizdirmek.
    location.reload();
  });
})();
