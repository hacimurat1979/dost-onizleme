/* Sahne yolu (sahneler.html) — K-030. Kaynak: lab/oneri-06/index.html betiği.
   Başlık, alt başlık ve altyazılar sahne dosyalarından AYNEN alındı
   (ayna-metaforu.html: LA.*.title/sub/st0/st2 · perde-zinciri.html: L.*.title/sub/st[0],st[3] ·
    iki-mertebe.html: LA.*.title/sub, VERSES['24:35'] etiketleri). Önizleme çizimleri sahnelerin
   çok sadeleştirilmiş, ELLE senkron tutulan halleridir (sahnenin kendisi değildir). */
(function(){
"use strict";

/* ---------- kaynak veri ---------- */
const SAHNE=[
 {id:"ayna",href:"ayna-metaforu.html",
  baslik:{tr:"Ayna Metaforu",en:"Mirror Metaphor",pt:"Metáfora do Espelho"},
  alinti:{tr:"Sûret ne bakandır ne ondan başka — ayna olmasaydı görüntü olmazdı, bakan olmasaydı ayna boş kalırdı",
          en:"The Form is neither the observer nor apart from it — without a mirror no image appears, without an observer the mirror stays empty",
          pt:"A Forma não é o observador nem está além dele — sem espelho não há imagem, sem observador o espelho fica vazio"},
  altyazi:[{tr:"Işık gidiyor. Ama dönmüyor — ortada görüntü yok.",en:"The light goes out. But it does not come back — there is no image.",pt:"A luz sai. Mas não volta — não há imagem alguma."},
           {tr:"Görüntü doğdu.",en:"The image is born.",pt:"A imagem nasceu."}]},
 {id:"perde",href:"perde-zinciri.html",
  baslik:{tr:"Perde Zinciri",en:"Chain of Veiling",pt:"Cadeia do Véu"},
  alinti:{tr:"Sıfatlar Zât'ı perdeler · Fiiller Sıfatları perdeler · Eserler Fiilleri perdeler",
          en:"Attributes veil the Essence · Actions veil Attributes · Effects veil Actions",
          pt:"Os Atributos velam a Essência · as Ações velam os Atributos · as Obras velam as Ações"},
  altyazi:[{tr:"Eserler perdesi önde. Işığın yalnız bir izini görüyoruz.",en:"The veil of Effects is in front. We see only a trace of the light.",pt:"O véu das Obras está à frente. Vemos apenas um rastro da luz."},
           {tr:"Sıfatlar inceliyor. Her şey aydınlandı — merkez hariç.",en:"Attributes are thinning. Everything has brightened — except the centre.",pt:"Os Atributos afinam. Tudo se iluminou — exceto o centro."}]},
 {id:"iki",href:"iki-mertebe.html",
  baslik:{tr:"Aynı Âyet, İki Mertebe",en:"The Same Verse, Two Levels",pt:"O Mesmo Versículo, Dois Graus"},
  alinti:{tr:"Bir âyet, okuduğumuz bölümlerin birden fazlasında geçiyor — ve her defasında farklı bir mertebeden okunuyor. Âyet hiç değişmiyor; değişen, ona nereden baktığımız.",
          en:"One verse comes up in more than one of the chapters we've read — and is read from a different level each time. The verse never changes; what changes is where we're looking from.",
          pt:"Um versículo aparece em mais de um dos capítulos que lemos — e é lido a partir de um grau diferente cada vez. O versículo nunca muda; o que muda é de onde olhamos para ele."},
  altyazi:[{tr:"Nûr 24:35 · Temsilin sınırı",en:"An-Nur 24:35 · The limit of the analogy",pt:"An-Nur 24:35 · O limite da analogia"},
           {tr:"Nûr 24:35 · Nur, kendi perdesi",en:"An-Nur 24:35 · Light, its own veil",pt:"An-Nur 24:35 · A luz, seu próprio véu"}]}
];

const UI={
 tr:{h1:"Sahne yolu",giris:"Üç küçük sahne. Her birinde bir şeyi sürükleyerek deneyip ne olduğuna bakıyoruz.",
     ac:"Sahneyi aç",yolAd:"Üç sahne",tema:"Tema",dilGrup:"Dil",
     adim:["1 / 3","2 / 3","3 / 3"],ana:"Dost Arabî ana sayfası",
     onizlemeAd:"Sahnenin iki durumu (sadeleştirilmiş çizim)",
     onizlemeNot:"Önizlemeler gerçek sahnelerin sadeleştirilmiş çizimleridir; sahnenin kendisi değildir."},
 en:{h1:"Scene path",giris:"Three small scenes. In each one we drag something and watch what happens.",
     ac:"Open the scene",yolAd:"Three scenes",tema:"Theme",dilGrup:"Language",
     adim:["1 / 3","2 / 3","3 / 3"],ana:"Dost Arabî home",
     onizlemeAd:"Two states of the scene (simplified drawing)",
     onizlemeNot:"The previews are simplified drawings of the real scenes, not the scenes themselves."},
 pt:{h1:"Caminho das cenas",giris:"Três pequenas cenas. Em cada uma arrastamos algo e observamos o que acontece.",
     ac:"Abrir a cena",yolAd:"Três cenas",tema:"Tema",dilGrup:"Idioma",
     adim:["1 / 3","2 / 3","3 / 3"],ana:"Página inicial do Dost Arabî",
     onizlemeAd:"Dois estados da cena (desenho simplificado)",
     onizlemeNot:"As pré-visualizações são desenhos simplificados das cenas reais, não as próprias cenas."}
};
/* "Meditasyon" özel addır (sayfanın kendi adı); açıklayıcı cümlesi çeviri beklediği için eklenmedi. */
const MED={href:"meditasyon.html",ad:"Meditasyon"};

/* ---------- önizleme çizimleri: sahnenin kendi mantığı, çok sadeleştirilmiş ---------- */
/* ---------- önizleme çizimleri: sahnenin kendi mantığı, çok sadeleştirilmiş ---------- */
let uid=0;
function svgSar(ic,ad){return '<svg viewBox="0 0 170 130" aria-hidden="true" focusable="false">'+ic+'</svg>'}

function aynaKare(hizali){
  const th=hizali?0:28, r=th*Math.PI/180, cx=122, cy=66;
  const rx=-Math.cos(2*r), ry=-Math.sin(2*r);        // sahnedeki yansıma formülü
  const v=hizali?1:0.06;
  const id="b"+(++uid);
  const mx=Math.sin(r)*30, my=Math.cos(r)*30;          // ayna yüzeyi
  const nx=Math.cos(r), ny=Math.sin(r);
  const ix=cx+nx*30, iy=cy+ny*30;
  return svgSar(
   '<defs><filter id="'+id+'" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="'+(hizali?0:5)+'"/></filter></defs>'+
   '<line x1="18" y1="66" x2="'+cx+'" y2="'+cy+'" class="s-murekkep" stroke-width="2"/>'+
   '<line x1="'+cx+'" y1="'+cy+'" x2="'+(cx+rx*100).toFixed(1)+'" y2="'+(cy+ry*100).toFixed(1)+'" class="s-vurgu" stroke-width="'+(hizali?3.5:2)+'" stroke-dasharray="'+(hizali?'0':'5 5')+'" opacity="'+(hizali?.9:.55)+'"/>'+
   '<line x1="'+(cx-mx).toFixed(1)+'" y1="'+(cy-my).toFixed(1)+'" x2="'+(cx+mx).toFixed(1)+'" y2="'+(cy+my).toFixed(1)+'" class="s-murekkep" stroke-width="5" stroke-linecap="round"/>'+
   '<circle cx="'+ix.toFixed(1)+'" cy="'+iy.toFixed(1)+'" r="'+(hizali?7:9)+'" class="f-vurgu" filter="url(#'+id+')" opacity="'+(hizali?1:.14)+'"/>'+
   '<circle cx="18" cy="66" r="4.5" class="f-murekkep"/>'
  ,"");
}

function perdeKare(acik){
  const id="p"+(++uid);
  // üç sis katmanı, kalınlıkları farklı; çekirdeğin bulanıklığı iki karede de AYNI
  const sis=acik?[.04,.06,.09]:[.22,.26,.3];
  const isik=acik?.42:.10;
  const f=(n,fr,seed)=>'<filter id="'+id+n+'" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="'+fr+'" numOctaves="4" seed="'+seed+'"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.5 -0.35" result="a"/><feFlood style="flood-color:var(--sis)"/><feComposite in2="a" operator="in"/></filter>';
  return svgSar(
   '<defs><radialGradient id="'+id+'g" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="var(--vurgu)" stop-opacity="0"/><stop offset=".55" stop-color="var(--vurgu)" stop-opacity="'+isik+'"/><stop offset="1" stop-color="var(--vurgu)" stop-opacity="'+(isik*.5)+'"/></radialGradient>'+
   f("1",.018,11)+f("2",.03,29)+f("3",.05,53)+
   '<filter id="'+id+'b" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter></defs>'+
   '<rect width="170" height="130" fill="url(#'+id+'g)"/>'+
   '<circle cx="85" cy="65" r="24" class="f-bosluk" opacity=".8" filter="url(#'+id+'b)"/>'+
   '<rect width="170" height="130" filter="url(#'+id+'3)" opacity="'+sis[2]+'"/>'+
   '<rect width="170" height="130" filter="url(#'+id+'2)" opacity="'+sis[1]+'"/>'+
   '<rect width="170" height="130" filter="url(#'+id+'1)" opacity="'+sis[0]+'"/>'
  ,"");
}

function ikiKare(sag){
  const id="i"+(++uid);
  const kutu=(x,keskin)=>'<g'+(keskin?'':' filter="url(#'+id+')" opacity=".5"')+'><rect x="'+x+'" y="82" width="76" height="40" rx="4" class="f-kagit" stroke="'+(keskin?'var(--vurgu)':'var(--cizgi)')+'" stroke-width="'+(keskin?2:1.5)+'"/>'+
     '<line x1="'+(x+8)+'" y1="94" x2="'+(x+68)+'" y2="94" class="s-murekkep" stroke-width="2.5" stroke-linecap="round"/><line x1="'+(x+8)+'" y1="103" x2="'+(x+60)+'" y2="103" class="s-murekkep" stroke-width="2.5" stroke-linecap="round"/><line x1="'+(x+8)+'" y1="112" x2="'+(x+48)+'" y2="112" class="s-murekkep" stroke-width="2.5" stroke-linecap="round"/></g>';
  const hx=sag?148:22;
  return svgSar(
   '<defs><filter id="'+id+'"><feGaussianBlur stdDeviation="1.8"/></filter></defs>'+
   '<rect x="6" y="8" width="158" height="36" rx="4" class="f-kagit2" stroke="var(--cizgi)"/>'+
   '<text x="85" y="33" text-anchor="middle" class="t-ar" font-size="13">ٱللَّهُ نُورُ ٱلسَّمَٰوَٰتِ</text>'+
   '<line x1="22" y1="62" x2="148" y2="62" class="s-cizgi" stroke-width="2"/>'+
   '<circle cx="22" cy="62" r="3.5" class="f-kagit" stroke="var(--cizgi)" stroke-width="1.5"/><circle cx="148" cy="62" r="3.5" class="f-kagit" stroke="var(--cizgi)" stroke-width="1.5"/>'+
   '<circle cx="'+hx+'" cy="62" r="8" class="f-vurgu"/>'+
   kutu(6,!sag)+kutu(88,sag)
  ,"");
}

const KARE={ayna:aynaKare,perde:perdeKare,iki:ikiKare};
const KARE_ARG=[[false,true],[false,true],[false,true]];

/* ---------- görünüm ---------- */
let dil=window.DostI18n.getLang();
const q=(s,r)=>(r||document).querySelector(s);

function kur(){
  const u=UI[dil];
  document.documentElement.lang=dil;
  document.title=u.h1+" — Dost Arabî";
  q("#h1").textContent=u.h1; q("#giris").textContent=u.giris;
  q("#yol").setAttribute("aria-label",u.yolAd);
  q("#tema").setAttribute("aria-label",u.tema);
  q("#dil").setAttribute("aria-label",u.dilGrup);
  q("#ana-link").setAttribute("aria-label",u.ana);
  q("#onizleme-not").textContent=u.onizlemeNot;
  q("#med-link").textContent=MED.ad;
  document.querySelectorAll("#dil button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.dil===dil?"true":"false"));
  uid=0;
  q("#yol").innerHTML='<svg class="hat" aria-hidden="true" focusable="false"><path class="taban"/><path class="ilerle" pathLength="1"/></svg>'+
   SAHNE.map((s,i)=>{
     const figs=s.altyazi.map((a,j)=>
        '<figure>'+KARE[s.id](KARE_ARG[i][j])+'<figcaption>'+a[dil]+'</figcaption></figure>').join("");
     return '<li class="bogum" id="b-'+s.id+'"><span class="dugum" aria-hidden="true"></span>'+
       '<div><p class="no">'+u.adim[i]+'</p><h2>'+s.baslik[dil]+'</h2>'+
       '<p class="ozet-satir" lang="'+dil+'">'+s.alinti[dil]+'</p>'+
       '<div class="eylem"><a class="dugme birincil" href="'+s.href+'">'+u.ac+' <span aria-hidden="true">→</span></a></div></div>'+
       '<div class="onizleme" role="group" aria-label="'+u.onizlemeAd+'">'+figs+'</div></li>';
   }).join("");
  hatCiz();
}

/* ---------- soldaki hat: sarmal hissi (hafif dalga), kaydırdıkça dolar ---------- */
/* ---------- soldaki hat: sarmal hissi (hafif dalga), kaydırdıkça dolar ---------- */
let hatPts=[];
function hatCiz(){
  const yol=q("#yol"), svg=q(".hat",yol), H=yol.offsetHeight, W=svg.getBoundingClientRect().width||48;
  const x0=W/2, yr=yol.getBoundingClientRect();
  hatPts=[...yol.querySelectorAll(".dugum")].map((e,i)=>{const r=e.getBoundingClientRect();return {y:r.top-yr.top+0.5,x:x0+(i%2?6:-6)}});
  let d="M"+x0+" 0 ";
  let px=x0,py=0;
  hatPts.forEach(p=>{const m=(p.y-py)/2;d+="C"+px+" "+(py+m)+" "+p.x+" "+(p.y-m)+" "+p.x+" "+p.y+" ";px=p.x;py=p.y;});
  const m=(H-py)/2; d+="C"+px+" "+(py+m)+" "+x0+" "+(H-m)+" "+x0+" "+H;
  svg.setAttribute("viewBox","0 0 "+W+" "+H);
  svg.querySelectorAll("path").forEach(p=>p.setAttribute("d",d));
  svg.querySelectorAll("circle").forEach(c=>c.remove());
  hatPts.forEach(p=>{const c=document.createElementNS("http://www.w3.org/2000/svg","circle");c.setAttribute("cx",p.x);c.setAttribute("cy",p.y);c.setAttribute("r",7);svg.appendChild(c);});
  ilerle();
}
function ilerle(){
  const yol=q("#yol"), r=yol.getBoundingClientRect(), H=yol.offsetHeight;
  const orta=innerHeight*0.45, y=orta-r.top;
  const p=Math.max(0,Math.min(1,y/H));
  q(".ilerle",yol).style.strokeDasharray="1";
  q(".ilerle",yol).style.strokeDashoffset=String(1-p);
  yol.querySelectorAll("circle").forEach((c,i)=>c.classList.toggle("aktif",hatPts[i]&&hatPts[i].y<=y+1));
}
addEventListener("scroll",ilerle,{passive:true});
addEventListener("resize",()=>{hatCiz()});
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(hatCiz);

/* ---------- dil + tema (ana sitenin anahtarlarıyla: dost-lang, dost-theme) ---------- */
q("#dil").addEventListener("click",e=>{const b=e.target.closest("button[data-dil]");if(!b)return;dil=b.dataset.dil;window.DostI18n.setLang(dil);kur();});
function temaBoya(){q("#tema").setAttribute("aria-pressed",window.DostSahne.curTheme()==="dark"?"true":"false");}
q("#tema").addEventListener("click",()=>{window.DostSahne.setTheme(window.DostSahne.curTheme()==="dark"?"light":"dark");temaBoya();});
temaBoya();
kur();
})();
