/**
 * FAZ B -- "Zoom'lanabilir Atlas": Zât'tan Nokta'ya 11 katmanlı zincirde TEK
 * bir sürekli ölçek ekseninde gezinme (Google Earth mantığı -- ayrı sayfalar
 * değil, kesintisiz bir odak kayması). Mekanizma, bu haritanın küçük bir
 * önizlemesi olan kozmik/mertebeler.js sahnesinden genellenmiştir (bkz. o
 * dosyanın başlık yorumu): d3.zoom'dan okunan ölçek (k), sürekli bir "odak"
 * (focus) değerine çevrilir; her katman kendi odağına olan uzaklığına göre
 * bulanıklık/saydamlık/ölçek alır -- sınır aşan bir KESME değil, ÇÖZÜNÜRLÜK
 * DEĞİŞEREK bir geçiş (görsel dil kuralı: bulanıklık=bilgisizlik).
 *
 * Veri: data/ibn-arabi/atlas-mertebeleri.json (11 katman) + data/ibn-arabi/
 * esma.json (İsim katmanının ~100 alt-düğümü, esma.js'ten bağımsız ayrı bir
 * okuma).
 *
 * İSTİSNA -- Zât katmanı: hiçbir zaman net bir şekle netleşmiyor VE hiçbir
 * zaman tam kaybolmuyor; odak ondan uzaklaştıkça (derinleştikçe) SİMETRİK
 * değil MONOTONİK olarak daha belirsizleşiyor (bkz. atlas-mertebeleri.json'un
 * "zat" girdisi ve GORSEL_DIL.md'nin "Zât'ı parlak bir cisim gibi çizme"
 * yasağı) -- bu yüzden kendi görseli (.atlas-haze) hiçbir etiket taşımıyor,
 * kimliği yalnız yandaki not panelinden okunuyor.
 *
 * Erişilebilirlik: fare tekerleği/kıstırma sürekli yakınlaşmayı sürüyor, ama
 * prefers-reduced-motion'da devre dışı -- yukarı/aşağı düğmeleri (ve ok
 * tuşları) HER İKİ modda da çalışan, durağan/anlık bir alternatif sağlıyor.
 *
 * Kullanıcı notu (2026-08-02): saf yakınlaşma sahnesi "anlamı yeterince iyi
 * vermiyor" bulundu -- kullanıcı yalnız bir katmanı görüyor, 11 katmanlık
 * ZİNCİRİN TAMAMINI hiçbir zaman göremiyordu (bir "atlas" adını taşıyan bir
 * görünümün tam da vermesi gereken genel bakış eksikti). Bunu gidermek için
 * `.atlas-spine`: sahnenin altında sabit duran, hafif kavisli (daire ilkesine
 * bir göz kırpma -- düz bir çizgi değil) tek bir yay üzerinde 11 katmanın
 * hepsi küçük noktalar olarak HER ZAMAN görünür; üzerinde kayan bir işaret
 * `focus` ile aynı anda, kesiksiz kayar (sahnenin kendisi gibi zıplamaz).
 * Uçlardaki iki isim (Zât / Nokta) hep okunur -- hangi iki kutup arasında
 * gezindiğini ilk bakışta anlat. Noktalara tıklamak/Enter ile de doğrudan o
 * katmana atlanabiliyor.
 */
window.__atlasApp = (function () {
  "use strict";
  const I18n = window.DostI18n;
  const GU = window.DostGraphUtils;

  const wrapEl = document.getElementById("atlas-wrap");
  const stageEl = document.getElementById("atlas-stage");
  const hintEl = document.getElementById("atlas-hint");
  const noteEl = document.getElementById("atlas-note");
  const upBtn = document.getElementById("atlas-up");
  const downBtn = document.getElementById("atlas-down");
  const navLabelEl = document.getElementById("atlas-nav-label");
  const spineEl = document.getElementById("atlas-spine");

  const SCALE_STEP = 2; // katman başına ölçek ikiye katlanır (k = 2^derinlik)

  // Yayın üç kontrol noktası -- hafif kavisli tek bir eğri (bkz. dosya başı
  // yorumu). Sabit; hem düğümlerin hem kayan işaretin konumu bundan türer.
  const SPINE_P0 = { x: 34, y: 86 };
  const SPINE_C = { x: 320, y: 12 };
  const SPINE_P1 = { x: 606, y: 86 };
  function spineArcPoint(t) {
    const mt = 1 - t;
    return {
      x: mt * mt * SPINE_P0.x + 2 * mt * t * SPINE_C.x + t * t * SPINE_P1.x,
      y: mt * mt * SPINE_P0.y + 2 * mt * t * SPINE_C.y + t * t * SPINE_P1.y,
    };
  }

  function tt(dict) {
    return I18n ? I18n.pick3(dict || {}) : (dict && (dict.tr || dict.en || dict.pt)) || "";
  }

  let dataPromise = null;
  let layers = [];
  let esmaNodes = [];
  let built = false;
  let focus = 0;
  let target = 0;
  let rafId = null;
  let zoomBehavior = null;
  let zoomSel = null;
  let reducedMotion = false;
  let lastAnnounced = -1;
  let spineDots = [];
  let spineMarker = null;

  // --- 3B sarmal iniş (kullanıcı kararı, 2026-08-02: "gerçek 3B sarmal
  // iniş", donus.js'teki motorun aynısı) --------------------------------
  // Kamera merkez eksene yakın, alçalan bir çizgide iniyor; 11 katman
  // kendi sarmal konumlarında (kameradan biraz uzakta) dönerek geçiyor --
  // bir sarmal merdivenin ortasından aşağı bakmak gibi. Zât ve İsim
  // katmanları 3B nesne DEĞİL (bkz. buildEsmaRing/`.atlas-haze`): ikisi de
  // zaten kanıtlanmış, erişilebilirliği elle doğrulanmış 2B kaplamalar --
  // Zât'ı "parlak bir cisim" olarak çizmeme yasağı ve İsim halkasının 100
  // düğümlük klavye/işaretçi erişilebilirliği üç boyutlu ışın-izleme
  // (raycasting) ile yeniden inşa edilseydi bu turun kapsamını aşardı.
  const HELIX_TURNS = 2.6, HELIX_HEIGHT = 6.4, NODE_R = 2.15, CAM_R = 0.85;
  function helixPoint(i, n, radius) {
    const t = n > 1 ? i / (n - 1) : 0;
    const angle = t * HELIX_TURNS * Math.PI * 2;
    const y = HELIX_HEIGHT / 2 - t * HELIX_HEIGHT;
    return { x: Math.cos(angle) * radius, y: y, z: Math.sin(angle) * radius, angle: angle, t: t };
  }
  let three3d = null; // { renderer, scene, camera, canvas, nodes:[{mesh,glow,layerIdx}] }
  let groupSpin = 0; // yavaş, sürekli dönüş -- sahneye ambiyans katan tek serbest değişken
  let zatOverlayEl = null, isimOverlayEl = null;

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (window.DostViewStatus) window.DostViewStatus.showLoading("atlas-wrap");
    dataPromise = Promise.all([
      GU.fetchJson("data/ibn-arabi/atlas-mertebeleri.json"),
      GU.fetchJson("data/ibn-arabi/esma.json"),
    ])
      .then(([atlas, esma]) => {
        layers = (atlas.katmanlar || []).slice().sort((a, b) => a.sira - b.sira);
        esmaNodes = (esma.nodes || []).filter((n) => (n.depth || 0) >= 1);
        if (window.DostViewStatus) window.DostViewStatus.hide("atlas-wrap");
        return true;
      })
      .catch((err) => {
        console.error("atlas verisi yüklenemedi", err);
        dataPromise = null;
        if (window.DostViewStatus) window.DostViewStatus.showError("atlas-wrap", () => window.__atlasApp.activate());
        return false;
      });
    return dataPromise;
  }

  function hueFor(i) {
    return 226 + i * 11; // derin mavi (Zât'a en yakın) -> ısınan bir yay
  }

  function crossLinkLabel() {
    return tt({ tr: "İlgili görünüme git ↗", en: "Go to the related view ↗", pt: "Ir para a visão relacionada ↗" });
  }

  // İsim katmanı: esma.json'dan ~100 düğüm, derinliğe göre halka halka
  // dışa açılan bir yerleşim.
  function buildEsmaRing() {
    const holder = document.createElement("div");
    holder.className = "atlas-isim-ring";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "-260 -260 520 520");
    svg.setAttribute("class", "atlas-isim-svg");
    holder.appendChild(svg);

    // Yüz düğüm aynı halkada -- hepsinin etiketini her zaman açık bırakmak
    // (ilk denemede olduğu gibi) okunaksız bir yığın üretiyordu; esma.js'in
    // kendi grafiğinin çözümünü izleyerek etiketler varsayılan gizli, yalnız
    // odaklanan/üstüne gelinen düğümünki görünür (bkz. style.css). Bu yüzden
    // burada createLabelDeconflictor'a gerek yok -- çakışma zaten oluşmuyor.
    const maxDepth = esmaNodes.reduce((m, n) => Math.max(m, n.depth || 1), 1);
    const nodeEls = [];
    esmaNodes.forEach((n, idx) => {
      const depth = n.depth || 1;
      const radius = 55 + (depth / maxDepth) * 175;
      const angle = (idx / esmaNodes.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const label = tt(n.name);
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("class", "atlas-isim-node");
      g.setAttribute("transform", "translate(" + x.toFixed(1) + "," + y.toFixed(1) + ")");
      g.setAttribute("tabindex", "-1");
      g.setAttribute("role", "link");
      g.setAttribute("aria-label", label);
      const title = document.createElementNS(svgNS, "title");
      title.textContent = label;
      g.appendChild(title);
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("r", "5");
      g.appendChild(circle);
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", "7");
      text.setAttribute("y", "3");
      text.textContent = label;
      g.appendChild(text);
      svg.appendChild(g);
      function go() {
        window.__dostNav && window.__dostNav.goTo("esma", n.id);
      }
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
      nodeEls.push(g);
    });
    // Yalnız katman odaktayken bu ~100 düğüm klavye ile TAB sırasına girsin --
    // aksi hâlde uzak/bulanık haldeyken bile klavye odağı görünmez düğümlere kayar.
    holder.__setInteractive = function (on) {
      nodeEls.forEach((g) => g.setAttribute("tabindex", on ? "0" : "-1"));
    };
    return holder;
  }

  // Paylaşılan tek bir yumuşak-parlama dokusu -- her düğümün glow sprite'ı
  // bunu kendi rengiyle tint ediyor (Sprite material color çarpımı), ayrı
  // ayrı canvas üretmeye gerek yok.
  let glowTexture = null;
  function makeGlowTexture(THREE) {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const cx = c.getContext("2d");
    const g = cx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.4, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = g;
    cx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  // 3B sahneyi kurar: Zât ve İsim kendi 2B kaplamalarını korur (bkz. dosya
  // başlığı), geri kalan 9 katman sarmal üzerinde bir çekirdek+parlama
  // çifti olarak yer alır. build() sayfa ömrü boyunca yalnız BİR kez
  // çağrılıyor (activate() bunu `built` ile koruyor), o yüzden burada ekstra
  // bir yarış-koşulu koruması gerekmiyor.
  function setup3D() {
    window.DostKozmikLoader.loadThree().then(function (THREE) {
      const canvas = document.createElement("canvas");
      canvas.className = "atlas-canvas";
      stageEl.insertBefore(canvas, stageEl.firstChild);
      const r = stageEl.getBoundingClientRect();
      const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(r.width, r.height, false);

      // donus.js'teki gibi arka plan BİLEREK sabitlenmiyor -- şeffaf canvas,
      // .atlas-stage'in kendi tema-duyarlı gradyanının üzerinde duruyor
      // (koyu/açık modda otomatik uyum). "Yaklaştıkça netleşme" hissi burada
      // sise değil (tema rengiyle çakışırdı), doğrudan düğüm materyaline
      // (emissiveIntensity/glow) bağlı -- bkz. updateCamera().
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(52, r.width / Math.max(1, r.height), 0.05, 30);

      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const dl = new THREE.DirectionalLight(0xfff3d8, 0.7);
      dl.position.set(2, 3, 2);
      scene.add(dl);

      glowTexture = makeGlowTexture(THREE);

      const n = layers.length;
      const nodes = layers.map(function (layer, i) {
        if (layer.id === "zat" || layer.id === "isim") return null;
        const p = helixPoint(i, n, NODE_R);
        const hue = hueFor(i);
        const color = new THREE.Color("hsl(" + hue + ",62%,62%)");
        const geo = new THREE.SphereGeometry(0.055, 20, 16);
        const mat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5, roughness: 0.4 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.x, p.y, p.z);
        scene.add(mesh);
        const glowMat = new THREE.SpriteMaterial({ map: glowTexture, color: color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(0.85, 0.85, 1);
        glow.position.copy(mesh.position);
        scene.add(glow);
        return { mesh: mesh, glow: glow, mat: mat, glowMat: glowMat, layerIdx: i, basePos: p };
      });

      three3d = { renderer: renderer, scene: scene, camera: camera, canvas: canvas, nodes: nodes };

      const ro = new ResizeObserver(function () {
        if (!three3d) return;
        const rr = stageEl.getBoundingClientRect();
        renderer.setSize(rr.width, rr.height, false);
        camera.aspect = rr.width / Math.max(1, rr.height);
        camera.updateProjectionMatrix();
      });
      ro.observe(stageEl);
      three3d.ro = ro;

      renderThree();
      if (!reducedMotion) startLoop();
    });
  }

  // Kamera merkez eksene yakın bir düşey çizgide iner (kavs-i nüzûl gibi),
  // `groupSpin` ile yavaşça dönerek -- katmanlar sarmal üzerinde geçip
  // gidiyor, "sarmal merdivenin ortasından aşağı bakmak" hissi.
  function updateCamera() {
    if (!three3d) return;
    const n = layers.length;
    const t = n > 1 ? Math.max(0, Math.min(1, focus / (n - 1))) : 0;
    const y = HELIX_HEIGHT / 2 - t * HELIX_HEIGHT;
    const angle = t * HELIX_TURNS * Math.PI * 2 + groupSpin;
    three3d.camera.position.set(Math.cos(angle) * CAM_R, y, Math.sin(angle) * CAM_R);
    // Bakış açısı odaklanılan katmandan çok ileriye kaymasın diye ufak
    // tutuluyor -- büyük bir kayma, tam o an odakta olan düğümü kadrajın
    // kenarına/köşesine itip orada kırpılmış görünmesine yol açıyordu
    // (elle test edilip yakalandı).
    const lookAngle = angle + 0.15;
    three3d.camera.lookAt(Math.cos(lookAngle) * CAM_R * 0.4, y - 0.7, Math.sin(lookAngle) * CAM_R * 0.4);
    three3d.nodes.forEach(function (nd) {
      if (!nd) return;
      const p = helixPoint(nd.layerIdx, n, NODE_R);
      const a = p.angle + groupSpin;
      const rr = Math.sqrt(p.x * p.x + p.z * p.z);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      nd.mesh.position.set(x, p.y, z);
      nd.glow.position.set(x, p.y, z);
      const dist = Math.abs(nd.layerIdx - focus);
      const closeness = Math.max(0, 1 - dist * 0.55);
      nd.mat.emissiveIntensity = 0.35 + closeness * 1.1;
      // Kamera odaklanılan düğüme çok yaklaşıyor (~1.3 birim) -- glow'un
      // DÜNYA boyutunu mesafeyle birlikte büyütmek, zaten perspektifin
      // kendiliğinden büyüttüğü bir nesneyi katlayarak kadrajı dolduran
      // devasa bir lekeye dönüştürüyordu (elle test edilip yakalandı).
      // Bu yüzden "yakınlık" artık ölçekte değil, neredeyse SABİT küçük bir
      // ölçekte yalnız PARLAKLIK/OPAKLIKTA taşınıyor -- büyümeyi tamamen
      // perspektife bırakıyoruz.
      const glowScale = 0.09 + closeness * 0.05;
      nd.glow.scale.set(glowScale, glowScale, 1);
      nd.glowMat.opacity = 0.25 + closeness * 0.55;
    });
  }

  function startLoop() {
    if (rafId != null) return;
    function tick() {
      rafId = null;
      if (!GU.isViewActive(wrapEl) || !three3d) return;
      focus += (target - focus) * 0.09;
      groupSpin += 0.0009;
      renderThree();
      render();
      rafId = requestAnimationFrame(tick);
    }
    tick();
  }
  GU.onViewWake(function () {
    if (built && !wrapEl.hidden && !reducedMotion && rafId == null) startLoop();
  });

  // Sahnenin altında sabit duran genel bakış: 11 katmanın hepsi her zaman
  // görünür, üzerinde kayan bir işaret `focus`u kesiksiz izler -- sahnenin
  // kendisi tek bir katmana odaklanırken bu şerit zincirin TAMAMINI gösterir.
  function buildSpine() {
    if (!spineEl) return;
    const svgNS = "http://www.w3.org/2000/svg";
    spineEl.innerHTML = "";
    const n = layers.length;

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("class", "atlas-spine__path");
    path.setAttribute(
      "d",
      "M " + SPINE_P0.x + " " + SPINE_P0.y + " Q " + SPINE_C.x + " " + SPINE_C.y + " " + SPINE_P1.x + " " + SPINE_P1.y
    );
    spineEl.appendChild(path);

    spineDots = layers.map((layer, i) => {
      const t = n > 1 ? i / (n - 1) : 0;
      const pt = spineArcPoint(t);
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("class", "atlas-spine__dot");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      const label = tt(layer.isim);
      g.setAttribute("aria-label", label);
      const title = document.createElementNS(svgNS, "title");
      title.textContent = label;
      g.appendChild(title);
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("r", "5.5");
      g.appendChild(circle);
      function go() {
        setTargetLayer(i);
      }
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
      spineEl.appendChild(g);
      return { el: g, pt };
    });

    // Uçlardaki iki isim (Zât / Nokta) hep okunur -- hangi iki kutup
    // arasında gezindiğini ilk bakışta anlat.
    [
      { pt: SPINE_P0, layer: layers[0], anchor: "start" },
      { pt: SPINE_P1, layer: layers[n - 1], anchor: "end" },
    ].forEach(({ pt, layer, anchor }) => {
      const t = document.createElementNS(svgNS, "text");
      t.setAttribute("class", "atlas-spine__end-label");
      t.setAttribute("x", pt.x);
      t.setAttribute("y", pt.y + 24);
      t.setAttribute("text-anchor", anchor === "start" ? "start" : "end");
      t.textContent = tt(layer.isim);
      spineEl.appendChild(t);
    });

    spineMarker = document.createElementNS(svgNS, "circle");
    spineMarker.setAttribute("class", "atlas-spine__marker");
    spineMarker.setAttribute("r", "7.5");
    spineEl.appendChild(spineMarker);
  }

  function updateSpine() {
    if (!spineDots.length) return;
    spineDots.forEach((d, i) => {
      const dist = Math.abs(i - focus);
      const s = Math.max(0.6, 1 - dist * 0.16);
      const op = Math.max(0.4, 1 - dist * 0.22);
      d.el.setAttribute(
        "transform",
        "translate(" + d.pt.x.toFixed(1) + "," + d.pt.y.toFixed(1) + ") scale(" + s.toFixed(2) + ")"
      );
      d.el.style.opacity = op.toFixed(2);
      d.el.classList.toggle("atlas-spine__dot--active", dist < 0.5);
    });
    if (spineMarker) {
      const n = layers.length;
      const t = n > 1 ? Math.max(0, Math.min(1, focus / (n - 1))) : 0;
      const pt = spineArcPoint(t);
      spineMarker.setAttribute("cx", pt.x.toFixed(1));
      spineMarker.setAttribute("cy", pt.y.toFixed(1));
    }
  }

  function setTargetLayer(idx) {
    target = idx;
    if (zoomBehavior && zoomSel) zoomSel.call(zoomBehavior.scaleTo, Math.pow(SCALE_STEP, idx));
    if (reducedMotion) {
      focus = idx;
      renderThree();
      render();
    }
    // Normal kipte döngü (startLoop) zaten sürekli çalışıyor -- yeni hedefe
    // kendiliğinden yakınsar, burada ayrıca tetiklemeye gerek yok.
  }

  let isimIdx = -1;

  function build() {
    stageEl.innerHTML = "";
    isimIdx = layers.findIndex((l) => l.id === "isim");

    zatOverlayEl = document.createElement("div");
    zatOverlayEl.className = "atlas-overlay atlas-overlay--zat";
    const haze = document.createElement("div");
    haze.className = "atlas-haze";
    haze.setAttribute("aria-hidden", "true");
    zatOverlayEl.appendChild(haze);
    stageEl.appendChild(zatOverlayEl);

    isimOverlayEl = document.createElement("div");
    isimOverlayEl.className = "atlas-overlay atlas-overlay--isim";
    isimOverlayEl.appendChild(buildEsmaRing());
    stageEl.appendChild(isimOverlayEl);

    buildSpine();
    reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    hintEl.textContent = reducedMotion
      ? tt({
          tr: "Hareket azaltma tercihine saygı: yakınlaşma fare tekerleğiyle değil, yukarı/aşağı düğmeleriyle.",
          en: "Respecting your reduced-motion preference: move with the up/down buttons rather than scroll-zoom.",
          pt: "Respeitando sua preferência de movimento reduzido: navegue com os botões acima/abaixo, não com o zoom da roda do mouse.",
        })
      : tt({
          tr: "Fare tekerleği ya da kıstırma hareketiyle yakınlaş; yukarı/aşağı düğmeleri katman katman gezdirir.",
          en: "Scroll or pinch to zoom in; the up/down buttons move layer by layer.",
          pt: "Role ou belisque para ampliar; os botões acima/abaixo movem camada por camada.",
        });

    // NOT: sitedeki diğer graflar (bkz. GU.createZoomBehavior) tekerleği
    // sayfa kaydırmaya bırakıp yalnız Ctrl/Cmd+tekerlek ile yakınlaştırıyor --
    // burada KASITLI ters: bu bir "harita", tekerlek doğrudan birincil
    // yakınlaşma hareketi (plan: "Google Earth mantığı"). İsim halkasındaki
    // bir düğüme tıklama/klavye ile etkileşim d3.zoom'un kendi sürükleme
    // algılamasıyla çakışmasın diye filtre o düğümleri hariç tutuyor (bkz.
    // GU.createZoomBehavior'daki extraFilter'ın aynı amaçla kullanıldığı yorum).
    zoomSel = d3.select(stageEl);
    zoomBehavior = d3
      .zoom()
      .scaleExtent([1, Math.pow(SCALE_STEP, layers.length - 1)])
      .filter((event) => !reducedMotion && !event.button && !(event.target.closest && event.target.closest(".atlas-isim-node")))
      .on("zoom", (event) => {
        const depth = Math.log(event.transform.k) / Math.log(SCALE_STEP);
        target = Math.max(0, Math.min(layers.length - 1, depth));
        // Normal kipte startLoop() döngüsü zaten sürekli çalışıyor, yeni
        // hedefi kendiliğinden yakalar.
      })
      // Bir tekerlek/kıstırma hareketi bittiğinde en yakın tam katmana
      // "yapış" -- aksi hâlde tekerleğin bıraktığı kesirli hedef, hemen
      // ardından basılan yukarı/aşağı düğmesinin nereden saydığını
      // belirsizleştirir (bkz. jump()'ın Math.round(target) kullanımı).
      .on("end", () => {
        if (!reducedMotion) target = Math.round(target);
      });
    zoomSel.call(zoomBehavior);

    if (upBtn) upBtn.addEventListener("click", () => jump(-1));
    if (downBtn) downBtn.addEventListener("click", () => jump(1));
    stageEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        jump(-1);
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        jump(1);
      }
    });

    setup3D();
    renderThree();
    render();
    built = true;
  }

  function jump(delta) {
    // target'tan say -- zoom'un "end" olayı onu zaten en yakın tam katmana
    // yapıştırıyor, o yüzden burada güvenle tam sayı. Odaklanan (focus)
    // henüz yakınsamamış olsa bile art arda basılan düğmeler bu sayede
    // birbirini yemeden art arda bir sonraki katmana ilerler.
    const cur = Math.round(target);
    const next = Math.max(0, Math.min(layers.length - 1, cur + delta));
    setTargetLayer(next);
  }

  function renderThree() {
    updateCamera();
    if (three3d) three3d.renderer.render(three3d.scene, three3d.camera);
  }

  // Zât ve İsim'in 2B kaplamaları: davranışları 3B'ye geçmeden ÖNCEKİ
  // haliyle birebir aynı -- Zât'ın "asla tam netleşmeyen, asla tam
  // kaybolmayan" kuralı `focus`un mutlak değerine bağlı (simetrik uzaklığa
  // değil), İsim'inki diğer katmanlarla aynı simetrik uzaklık formülü.
  function updateOverlays() {
    if (zatOverlayEl) {
      const blur = Math.min(70, 10 + focus * 6);
      const opacity = Math.max(0.05, 0.55 - focus * 0.045);
      zatOverlayEl.style.filter = "blur(" + blur.toFixed(1) + "px)";
      zatOverlayEl.style.opacity = opacity.toFixed(3);
    }
    if (isimOverlayEl && isimIdx >= 0) {
      const dist = Math.abs(isimIdx - focus);
      const opacity = Math.max(0.04, 1 - dist * 0.55);
      const scale = Math.max(0.4, 1 - dist * 0.1);
      const interactive = dist < 0.55;
      isimOverlayEl.style.opacity = opacity.toFixed(3);
      isimOverlayEl.style.transform = "scale(" + scale.toFixed(3) + ")";
      isimOverlayEl.classList.toggle("atlas-overlay--interactive", interactive);
      const ring = isimOverlayEl.querySelector(".atlas-isim-ring");
      if (ring && ring.__setInteractive) ring.__setInteractive(interactive);
    }
  }

  function render() {
    updateOverlays();
    updateSpine();
    updateNoteAndNav();
  }

  function updateNoteAndNav() {
    const idx = Math.max(0, Math.min(layers.length - 1, Math.round(focus)));
    if (upBtn) upBtn.disabled = idx === 0;
    if (downBtn) downBtn.disabled = idx === layers.length - 1;
    if (idx === lastAnnounced) return;
    lastAnnounced = idx;
    const layer = layers[idx];
    if (navLabelEl) navLabelEl.textContent = idx + 1 + " / " + layers.length + " — " + tt(layer.isim);
    if (noteEl) {
      let html = '<p class="atlas-note__ozet">' + tt(layer.ozet) + "</p>";
      if (layer.capraz) {
        html +=
          '<button type="button" class="atlas-crosslink" data-view="' +
          layer.capraz.view +
          '"' +
          (layer.capraz.id ? ' data-id="' + layer.capraz.id + '"' : "") +
          ">" +
          crossLinkLabel() +
          "</button>";
      }
      noteEl.innerHTML = html;
      const btn = noteEl.querySelector(".atlas-crosslink");
      if (btn) {
        btn.addEventListener("click", () => {
          window.__dostNav && window.__dostNav.goTo(btn.dataset.view, btn.dataset.id || undefined);
        });
      }
    }
  }

  // Dil değişince İsim halkasının ~100 etiketini tek tek güncellemek yerine
  // (pahalı ve deconfliction'ı bozar) o kaplamayı yeniden inşa ediyoruz.
  // 3B katmanların sahne içinde metni yok (bkz. dosya başlığı: kimlik nav
  // etiketi/not panelinden okunuyor), o yüzden onlar için hiçbir şey
  // yapmaya gerek yok.
  function rerenderLabels() {
    if (isimOverlayEl) {
      isimOverlayEl.innerHTML = "";
      isimOverlayEl.appendChild(buildEsmaRing());
    }
    buildSpine();
    lastAnnounced = -1;
    render();
  }

  return {
    activate() {
      fetchData().then((ok) => {
        if (!ok) return;
        if (!built) build();
        else if (!reducedMotion && rafId == null) startLoop();
        else render();
      });
    },
    goToNode(id) {
      fetchData().then((ok) => {
        if (!ok) return;
        if (!built) build();
        const idx = layers.findIndex((l) => l.id === id);
        if (idx < 0) return;
        setTargetLayer(idx);
      });
    },
    onLangChange() {
      if (built) rerenderLabels();
    },
  };
})();
