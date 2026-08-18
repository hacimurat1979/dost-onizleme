// Sahnelerin tema mirası -- TEK kaynak (KOD-6, uzman paneli denetimi
// 2026-08-17, Dalga 3.6). Bu blok eskiden 13 sahne sayfasına birebir
// kopyalanmıştı (9'unda md5'e kadar aynı); /sahne komutunun çözmeye
// çalıştığı kopyala-yapıştır sorunu kod tabanında yeniden üremişti.
//
// Ne yapar: sitenin ☰'den seçilen tema tercihini (localStorage
// "dost-theme") sahneye taşır. Bu sayfaların CSS'inde ":root[data-theme=
// light/dark]" kuralları en baştan vardı ama data-theme'i kimse
// yazmıyordu -- kullanıcı siteyi gündüz moduna alsa bile cihaz gece
// modundaysa sahne gece açılıyordu (2026-08-05 tablette bildirildi).
//
// Depoda bir şey YOKSA öznitelik bilerek yazılmaz: o zaman
// @media(prefers-color-scheme) devreye girer -- doğru varsayılan odur.
//
// KULLANIM: <head> içinde, defer'siz düz <script src> ile çağrılır --
// senkron kalmalı ki ilk boyamadan önce çalışsın, tema sıçraması olmasın
// (küçük ve önbelleklenebilir olduğu için render-blocking maliyeti
// ihmal edilebilir).
(function () {
  try {
    var s = localStorage.getItem("dost-theme");
    if (s === "light" || s === "dark") document.documentElement.setAttribute("data-theme", s);
  } catch (e) {}
})();
