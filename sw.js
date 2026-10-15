/* Paranchi's Documents - service worker (offline support)
   Bump VERSION when you want every phone to refresh its cached files. */
const VERSION='v2';
const CACHE='paranchi-docs-'+VERSION;
const CORE=['./','index.html','manifest.json','favicon.ico','favicon-32x32.png','apple-touch-icon.png',
  'icon-72x72.png','icon-96x96.png','icon-128x128.png','icon-144x144.png','icon-152x152.png',
  'icon-192x192.png','icon-384x384.png','icon-512x512.png'];
const CDN=[
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    // Each file is cached on its own, so one failure never blocks installation
    await Promise.allSettled(CORE.map(u=>c.add(new Request(u,{cache:'reload'}))));
    await Promise.allSettled(CDN.map(u=>c.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('paranchi-docs-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirstPage(req){
  const c=await caches.open(CACHE);
  try{
    const ctl=new AbortController();
    const t=setTimeout(()=>ctl.abort(),4000);          // slow network: fall back to the saved copy
    const r=await fetch(req,{signal:ctl.signal});
    clearTimeout(t);
    if(r&&r.ok){ c.put('index.html',r.clone()); return r; }
    throw new Error('bad response');
  }catch(err){
    return (await c.match('index.html'))||(await c.match('./'))||Response.error();
  }
}

async function cacheFirst(req){
  const c=await caches.open(CACHE);
  const hit=await c.match(req,{ignoreSearch:true});
  if(hit) return hit;
  try{
    const r=await fetch(req);
    if(r&&(r.ok||r.type==='opaque')) c.put(req,r.clone());
    return r;
  }catch(err){
    return Response.error();
  }
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(req.mode==='navigate'){ e.respondWith(networkFirstPage(req)); return; }
  if(url.origin===self.location.origin || url.hostname==='cdnjs.cloudflare.com'){
    e.respondWith(cacheFirst(req));
  }
});
