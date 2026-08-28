(function () {
  "use strict";

  const I18n = window.DostI18n;

  let data = null;
  let fetchPromise = null;
  let initialized = false;
  let activeKaynak = null;
  let activeTema = null;

  const SOURCE_ICONS = {
    "tercuman-eshvak": "◈",
    "futuhat": "✦",
    "fusus": "◉",
    "evrad": "☽",
  };

  // Ayrı sahnesi olan şiirler (bkz. terimler.js TERIM_SAHNELERI,
  // sorular.js SORU_SAHNELERI -- aynı sözleşmenin üçüncü yeri).
  // 2026-08-15 @revise: "Kendi Şiirini Savunmak" (tercuman-esvak.html) ve
  // "Tavafta Bir Karşılaşma" (futuhat-dogusu.html) sahneleri kullanıcı
  // isteğiyle kaldırıldı; bu iki şiirin kendi metni sayfada kalıyor,
  // yalnız "Sahneyi aç" düğmeleri gitti.
  const SIIR_SAHNELERI = {};

  const tt = I18n.pick3;  // window.DostI18n.pick3 zaten (!obj) koruması yapıyor (2026-08-15: 26 dosyadaki tekrar buraya toplandı)

  function escHtml(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function poemLines(text) {
    // blank-line = stanza break (extra spacing), single newline = line break
    return escHtml(text || "")
      .replace(/\n\n/g, '<br class="siir-stanza-break">')
      .replace(/\n/g, "<br>");
  }

  function fetchData() {
    if (data) return Promise.resolve(data);
    if (fetchPromise) return fetchPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("siirler-panel");
    fetchPromise = window.DostGraphUtils.fetchJson("data/ibn-arabi/siirler.json")
      .then((d) => {
        data = d;
        if (window.DostViewStatus) window.DostViewStatus.hide("siirler-panel");
        return d;
      })
      .catch((err) => {
        console.error("siirler.json yüklenemedi / Failed to load", err);
        fetchPromise = null;
        // 2026-08-15: eskiden bu hata tamamen sessizdi -- console.error
        // dışında hiçbir görsel iz düşmüyordu (kardeşi vahdet.js gibi bir
        // .view-status elemanı da yoktu). Artık diğer 8 görünümün izlediği
        // DostViewStatus kalıbı burada da uygulanıyor.
        if (window.DostViewStatus) window.DostViewStatus.showError("siirler-panel", () => window.__siirlerApp.activate());
        return null;
      });
    return fetchPromise;
  }

  function render(d) {
    const panel = document.getElementById("siirler-content");
    if (!panel) return;

    const lang = I18n.getLang();
    const kaynaklarMap = {};
    d.kaynaklar.forEach((k) => { kaynaklarMap[k.id] = k; });
    const temalarMap = {};
    d.temalar.forEach((t) => { temalarMap[t.id] = t; });

    const poems = d.siirler.filter((p) => {
      if (activeKaynak && p.kaynak_id !== activeKaynak) return false;
      if (activeTema && !p.temalar.includes(activeTema)) return false;
      return true;
    });

    const LABELS = {
      desc_group_kaynak: { tr: "Kaynak", en: "Source", pt: "Fonte" },
      desc_group_tema:   { tr: "Tema", en: "Theme", pt: "Tema" },
      filter_all:        { tr: "Tümü", en: "All", pt: "Todos" },
      not_label:         { tr: "Okuma notu", en: "Reading note", pt: "Nota de leitura" },
      empty:             { tr: "Bu filtre için şiir bulunamadı.", en: "No poems found for this filter.", pt: "Nenhum poema encontrado para este filtro." },
      count:             { tr: `${poems.length} şiir`, en: `${poems.length} poem${poems.length !== 1 ? "s" : ""}`, pt: `${poems.length} poema${poems.length !== 1 ? "s" : ""}` },
      kisma_git:         { tr: "→ Okuduğumuz kısma git", en: "→ Go to the part we read this in", pt: "→ Ir para a parte em que lemos isto" },
    };
    const L = (key) => LABELS[key][lang] || LABELS[key].tr;

    // ── description ─────────────────────────────────────────────────────────
    let html = `<p class="siirler-desc">${escHtml(tt(d.meta.desc))}</p>`;

    // ── filter bar ──────────────────────────────────────────────────────────
    html += `<div class="siirler-filters">`;

    // Kaynak chips
    html += `<div class="siirler-filters__row" role="group" aria-label="${escHtml(L("desc_group_kaynak"))}">`;
    html += `<span class="siirler-filters__label">${escHtml(L("desc_group_kaynak"))}</span>`;
    d.kaynaklar.forEach((k) => {
      const icon = SOURCE_ICONS[k.id] || "•";
      const active = activeKaynak === k.id;
      html += `<button class="siirler-chip${active ? " siirler-chip--active" : ""}"
        type="button" data-ftype="kaynak" data-fid="${escHtml(k.id)}"
        aria-pressed="${active}">${escHtml(icon)} ${escHtml(tt(k.isim))}</button>`;
    });
    html += `</div>`;

    // Tema chips
    html += `<div class="siirler-filters__row" role="group" aria-label="${escHtml(L("desc_group_tema"))}">`;
    html += `<span class="siirler-filters__label">${escHtml(L("desc_group_tema"))}</span>`;
    d.temalar.forEach((t) => {
      const active = activeTema === t.id;
      html += `<button class="siirler-chip siirler-chip--tema${active ? " siirler-chip--active" : ""}"
        type="button" data-ftype="tema" data-fid="${escHtml(t.id)}"
        aria-pressed="${active}">${escHtml(tt(t.isim))}</button>`;
    });
    html += `</div>`;

    html += `</div>`; // siirler-filters

    // ── poem count ──────────────────────────────────────────────────────────
    html += `<p class="siirler-count">${escHtml(L("count"))}</p>`;

    // ── poem cards ──────────────────────────────────────────────────────────
    html += `<div class="siirler-list">`;

    if (poems.length === 0) {
      html += `<p class="siirler-empty">${escHtml(L("empty"))}</p>`;
    } else {
      poems.forEach((p) => {
        const kaynak = kaynaklarMap[p.kaynak_id];
        const kaynakIsim = kaynak ? tt(kaynak.isim) : p.kaynak_id;
        const kaynakRef = tt(p.kaynak_ref) || "";
        const metin = tt(p.metin) || "";
        const not = tt(p.not) || "";
        const kaynakBilgi = tt(p.kaynak_bilgisi) || "";
        const icon = SOURCE_ICONS[p.kaynak_id] || "•";

        html += `<article class="siir-card" id="siir-${escHtml(p.id)}">`;
        html += `<header class="siir-card__header">`;
        html += `<span class="siir-card__kaynak">${escHtml(icon)} ${escHtml(kaynakIsim)}</span>`;
        if (kaynakRef) {
          html += `<span class="siir-card__ref">${escHtml(kaynakRef)}</span>`;
        }
        html += `</header>`;

        // Tema chips (display only, not clickable — clicking the filter bar is the UX)
        if (p.temalar && p.temalar.length) {
          html += `<div class="siir-card__temalar">`;
          p.temalar.forEach((tid) => {
            const t = temalarMap[tid];
            html += `<span class="siir-card__tema">${escHtml(t ? tt(t.isim) : tid)}</span>`;
          });
          html += `</div>`;
        }

        html += `<blockquote class="siir-card__metin">${poemLines(metin)}</blockquote>`;

        if (not) {
          html += `<details class="siir-card__not-wrap">`;
          html += `<summary class="siir-card__not-toggle">${escHtml(L("not_label"))}</summary>`;
          html += `<p class="siir-card__not">${escHtml(not)}</p>`;
          html += `</details>`;
        }

        if (kaynakBilgi) {
          html += `<p class="siir-card__bilgi">${escHtml(kaynakBilgi)}</p>`;
        }

        if (p.futuhat_kisim_id) {
          html += `<a class="siir-card__kisim-link" href="${escHtml(window.__dostNav.href("futuhat", p.futuhat_kisim_id))}" data-kisim-id="${escHtml(p.futuhat_kisim_id)}">${escHtml(L("kisma_git"))}</a>`;
        }

        // Bazı şiirlerin ayrı, oynanabilir bir sahnesi var (terimler.js
        // TERIM_SAHNELERI / sorular.js SORU_SAHNELERI ile aynı sözleşme).
        // İlk örnek te-kalp: Tercümânü'l-Eşvâk'ın eleştirilmesi ve Dost'un
        // kendi şerhini yazması -- docs/icerik-yol-haritasi.md D15.
        const sahne = SIIR_SAHNELERI[p.id];
        if (sahne) {
          const base = window.__dostRouteBase || "";
          html += `<a class="siir-card__sahne-link" href="${escHtml(base + "/" + sahne.dosya)}">${escHtml(tt(sahne.dugme))} →</a>`;
        }

        html += `</article>`;
      });
    }

    html += `</div>`; // siirler-list

    panel.innerHTML = html;

    // Wire filter chips
    panel.querySelectorAll(".siirler-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.ftype;
        const id = btn.dataset.fid;
        if (type === "kaynak") {
          activeKaynak = activeKaynak === id ? null : id;
        } else if (type === "tema") {
          activeTema = activeTema === id ? null : id;
        }
        render(data);
      });
    });

    // Wire "kısma git" links (SPA navigation instead of full reload)
    panel.querySelectorAll(".siir-card__kisim-link").forEach((a) => {
      a.addEventListener("click", (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        window.__dostNav.goTo("futuhat", a.dataset.kisimId);
      });
    });
  }

  function activate() {
    fetchData().then((d) => {
      if (!d) return;
      initialized = true;
      render(d);
    });
  }

  function onLangChange() {
    if (data && initialized) render(data);
  }

  // ── sub-tab wiring ───────────────────────────────────────────────────────
  // Wire the Hakkında / Şiirleri / Eleştiriler tab buttons inside hakkinda-wrap.
  // Called once from ontology.js when the hakkında view is first activated,
  // and again on each subsequent activation (idempotent: button listener
  // is added only once via a guard flag on the element). Kept here (rather
  // than split per-tab) because it already owned the DOM wiring before the
  // third tab existed -- three tabs still doesn't justify a dedicated module.
  // switchTo, wireTabs()'in yerel bir kapanışı -- her "hakkında" aktivasyonunda
  // yeniden atanır. Modül dışından (elestiri-arkeolojisi.js'in vahdet köprüsü
  // gibi) çağrılabilmesi için son atanan sürüm burada tutulur (bkz. altta
  // window.__siirlerApp.switchTo).
  let switchToTab = null;

  function wireTabs() {
    const tabs = {
      hakkinda: { btn: document.getElementById("hakkinda-subtab-hakkinda"), panel: document.getElementById("hakkinda-content-panel") },
      siirler: { btn: document.getElementById("hakkinda-subtab-siirler"), panel: document.getElementById("siirler-panel") },
      vahdet: { btn: document.getElementById("hakkinda-subtab-vahdet"), panel: document.getElementById("vahdet-panel") },
      "okuma-yollari": { btn: document.getElementById("hakkinda-subtab-okuma-yollari"), panel: document.getElementById("okuma-yollari-panel") },
      "nereden-baslamali": { btn: document.getElementById("hakkinda-subtab-nereden-baslamali"), panel: document.getElementById("nereden-baslamali-panel") },
    };
    const keys = Object.keys(tabs);
    if (keys.some((k) => !tabs[k].btn || !tabs[k].panel)) return;

    function switchTo(which) {
      keys.forEach((k) => {
        const active = k === which;
        tabs[k].btn.classList.toggle("hakkinda-subtab--active", active);
        tabs[k].btn.setAttribute("aria-selected", String(active));
        tabs[k].panel.hidden = !active;
      });
      if (which === "siirler" && !initialized) activate();
      if (which === "vahdet") window.__vahdetApp && window.__vahdetApp.activate();
      if (which === "okuma-yollari") window.__okumaYollariApp && window.__okumaYollariApp.activate();
      if (which === "nereden-baslamali") window.__neredenBaslamaliApp && window.__neredenBaslamaliApp.activate();
    }
    switchToTab = switchTo;

    if (!tabs.hakkinda.btn.dataset.wired) {
      keys.forEach((k) => tabs[k].btn.addEventListener("click", () => switchTo(k)));
      tabs.hakkinda.btn.dataset.wired = "1";
    }
  }

  window.__siirlerApp = {
    activate, onLangChange, wireTabs,
    switchTo(which) { switchToTab && switchToTab(which); },
  };
})();
