// خدمة العمل: تتيح تشغيل تلويناتي بدون إنترنت. غيّر رقم النسخة عند كل تحديث للملفات.
const CACHE="talwinati-v2";
const CORE=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","icon-maskable-512.png","apple-touch-icon.png"];
const FONT_HOSTS=["fonts.googleapis.com","fonts.gstatic.com"];
// نفس رابط الخط في index.html تمامًا: نحفظه مع ملفاته وقت التثبيت ليظهر الخط بلا إنترنت من أول زيارة
const FONT_CSS="https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@500;700&display=swap";

// أفضل جهد: فشل الخط أو بطؤه (أكثر من 6 ثوانٍ) لا يمنع التثبيت، والصفحة تعمل بخط النظام حينها
function cacheFonts(c){
  const job=fetch(FONT_CSS).then(r=>{
    if(!r.ok)return;
    const copy=r.clone();
    return c.put(FONT_CSS,r).then(()=>copy.text()).then(css=>{
      const urls=[...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m=>m[1].replace(/["']/g,"")))];
      return Promise.all(urls.map(u=>fetch(u).then(x=>x.ok&&c.put(u,x)).catch(()=>{})));
    });
  }).catch(()=>{});
  return Promise.race([job,new Promise(ok=>setTimeout(ok,6000))]);
}

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).then(()=>cacheFonts(c))).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  // الصفحة: الشبكة أولاً لتصلك التحديثات، وإن انقطع الإنترنت تُفتح النسخة المحفوظة
  if(req.mode==="navigate"){
    e.respondWith(fetch(req).then(res=>{
      const copy=res.clone();caches.open(CACHE).then(c=>c.put("index.html",copy));return res;
    }).catch(()=>caches.match("index.html")));
    return;
  }
  // خط Google: يُحفظ عند أول تحميل
  if(FONT_HOSTS.includes(url.hostname)){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
      const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res;
    })));
    return;
  }
  // ملفات الموقع نفسه: من الذاكرة فوراً ثم تحديثها بصمت
  if(url.origin===location.origin){
    e.respondWith(caches.match(req).then(hit=>{
      const net=fetch(req).then(res=>{
        if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
        return res;
      }).catch(()=>hit);
      return hit||net;
    }));
  }
});
