/**
 * three.js resmi olarak artık global/UMD derlemesi sunmuyor -- yalnız ESM
 * (`three.module.min.js`) ve CJS var. Bu proje ise (SRI'nin native olarak
 * yalnız <script> etiketinin KENDİSİNİ doğruladığını, iç içe `import`
 * grafiğini doğrulamadığını FAZ A denetiminde ölçtüğümüz için) sahne
 * dosyalarını düz global script olarak tutuyor. Bu köprü, ESM'i BİR KEZ
 * içe aktarıp `window.THREE`'ye bağlıyor; SRI koruması yalnız BU köprü
 * dosyasının ve `three.module.min.js`'nin ilk yüklenişindeki tarayıcı
 * doğrulamasıyla sınırlı -- ayrıntı için CLAUDE.md'deki FAZ A notuna bkz.
 */
import * as THREE from "./three.module.min.js";
window.THREE = THREE;
window.dispatchEvent(new Event("dost:three-ready"));
