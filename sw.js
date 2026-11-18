/* Français Matura – daily Home Screen push badge (independent of GO Eschenbach). */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let data={};try{data=event.data?event.data.json():{}}catch{}
  const badge=Math.max(0,Number(data.badge)||0);
  if(self.navigator&&typeof self.navigator.setAppBadge==='function'){
   try{if(badge)await self.navigator.setAppBadge(1);else await self.navigator.clearAppBadge()}catch{}
  }
  await self.registration.showNotification('Français Matura',{
   body:'Dein französischer Satz des Tages wartet auf dich.',
   icon:'./icon.svg',tag:'francais-matura-daily',renotify:false,
   data:{url:self.registration.scope}
  });
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  if(self.navigator&&typeof self.navigator.clearAppBadge==='function'){
   try{await self.navigator.clearAppBadge()}catch{}
  }
  const home=self.registration.scope;
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const open=clients.find(c=>c.url.startsWith(home));
  if(open){await open.focus();return}
  if(self.clients.openWindow)await self.clients.openWindow(home);
 })());
});
