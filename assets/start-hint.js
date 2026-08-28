(function () {
  "use strict";

  const SEEN_KEY = "dost-start-hint-seen";
  const hint = document.getElementById("start-hint");
  const goBtn = document.getElementById("start-hint-go");
  const goKalpBtn = document.getElementById("start-hint-go-kalp");
  const closeBtn = document.getElementById("start-hint-close");
  if (!hint || !goBtn || !closeBtn) return;

  // Kart, ontoloji grafiğinin ÜSTÜNE biniyor ve tam da sahnenin en
  // kalabalık yerini (alt orta) kapatıyor. Grafik bunu bilmek zorunda:
  // 2026-08-28'de ölçüldü, kartın altında yer kalmayınca aşağı itilen iki
  // etiket ("Halîfe", "Allah Katında Bilinen, Âlemde Bilinmeyen") çerçeveden
  // taşıyordu. Ontoloji bu olayı dinleyip kendini kartın üstündeki alana
  // yeniden sığdırıyor (bkz. ontology.js, altPay/computeFitTransform).
  function haberVer(acik) {
    document.dispatchEvent(new CustomEvent("dost:start-hint", { detail: { acik: acik } }));
  }

  function dismiss() {
    hint.hidden = true;
    haberVer(false);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (e) {}
  }

  let seen = false;
  try { seen = !!localStorage.getItem(SEEN_KEY); } catch (e) {}
  if (seen) return;

  setTimeout(() => {
    if (!hint.hidden) return;
    const wrap = document.getElementById("ontology-wrap");
    if (!wrap || wrap.hidden) return;
    hint.hidden = false;
    haberVer(true);
  }, 3200);

  goBtn.addEventListener("click", () => {
    dismiss();
    if (window.__dostNav) window.__dostNav.goTo("ontoloji", "dhat");
  });
  // 2026-08-10 denetim (G7 + rapor EK A.3): ikinci başlangıç noktası olarak
  // Kalp -- "bize en yakın uç, dönüşün başladığı yer".
  if (goKalpBtn) goKalpBtn.addEventListener("click", () => {
    dismiss();
    if (window.__dostNav) window.__dostNav.goTo("ontoloji", "kalp");
  });
  closeBtn.addEventListener("click", dismiss);
})();
