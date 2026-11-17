/* English Matura – Home Screen Web Push */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let data={};try{data=event.data?event.data.json():{}}catch{}
    const count=Math.max(0,Number(data.badge)||0);
    if('setAppBadge' in self.navigator){
      try{if(count)await self.navigator.setAppBadge(count);else await self.navigator.clearAppBadge()}catch{}
    }
    // Visible notification is required for reliable Web Push delivery on iOS.
    await self.registration.showNotification('Français Matura',{
      body:count===1?'Ein neuer Satz wartet auf dich.':count+' Tage warten auf dein Englischtraining.',
      icon:'icon.svg',badge:'icon.svg',tag:'francais-matura-daily',renotify:false,
      data:{url:self.registration.scope}
    });
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const url=self.registration.scope;
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const open=clients.find(client=>client.url.startsWith(url));
    if(open){await open.focus();return}
    await self.clients.openWindow(url);
  })());
});
