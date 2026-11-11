const V='maxcontrol-v2-1';
const FILES=['./','index.html','style.css?v=2','app.js?v=2','logo.png','manifest.json','icons/icon-192.png','icons/icon-512.png','fonts/inter-400.woff','fonts/inter-500.woff','fonts/inter-600.woff','fonts/inter-700.woff','fonts/inter-800.woff'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res}).catch(()=>caches.match(r,{ignoreSearch:false}).then(m=>m||caches.match('index.html'))));
});
