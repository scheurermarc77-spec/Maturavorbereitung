import { buildPushPayload } from '@block65/webcrypto-web-push';

// This Worker stores only per-device push subscriptions, no names or email addresses.
// Every device uses a random local id plus a separate random bearer token.
const daySwiss=(date=new Date())=>{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return parts.year+'-'+parts.month+'-'+parts.day;
};
const swissHourMinute=()=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
const toDayNumber=s=>Math.floor(Date.parse(s+'T00:00:00Z')/86400000);
const numberDue=(from,to)=>Math.max(0,toDayNumber(to)-toDayNumber(from));
const hash=async token=>{
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
};
const json=(payload,status=200,headers={})=>new Response(JSON.stringify(payload),{
  status,headers:{'content-type':'application/json','cache-control':'no-store',...headers}
});
const allowed=env=>({
  'access-control-allow-origin':env.ALLOWED_ORIGIN,
  'access-control-allow-methods':'POST, OPTIONS, GET',
  'access-control-allow-headers':'content-type, authorization',
  'vary':'Origin'
});
const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(s);
const validToken=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{32,160}$/.test(s);
async function auth(request,env,id){
  const bearer=request.headers.get('Authorization')||'';
  const token=bearer.startsWith('Bearer ')?bearer.slice(7):'';
  if(!validId(id)||!validToken(token))return null;
  const row=await env.DB.prepare('SELECT * FROM subscriptions WHERE id=?').bind(id).first();
  return row&&row.token_hash===await hash(token)?row:null;
}
async function sendPush(env,row,badge){
  const vapid={
    subject:env.VAPID_SUBJECT,
    publicKey:env.VAPID_PUBLIC_KEY,
    privateKey:env.VAPID_PRIVATE_KEY
  };
  const subscription=JSON.parse(row.subscription_json);
  const payload=await buildPushPayload({
    data:JSON.stringify({badge}),
    options:{ttl:3600,urgency:'high'}
  },subscription,vapid);
  const response=await fetch(subscription.endpoint,payload);
  if(response.status===404||response.status===410){
    await env.DB.prepare('DELETE FROM subscriptions WHERE id=?').bind(row.id).run();
  }else if(!response.ok){
    console.warn('Push delivery failed',row.id,response.status);
  }
}
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin');
    if(origin!==env.ALLOWED_ORIGIN)return json({error:'Origin not allowed'},403);
    const cors=allowed(env);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const url=new URL(request.url);
    if(url.pathname==='/public-key'&&request.method==='GET'){
      return json({publicKey:env.VAPID_PUBLIC_KEY},200,cors);
    }
    if(url.pathname==='/subscribe'&&request.method==='POST'){
      let body;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400,cors)}
      const {id,token,subscription}=body||{};
      const keys=subscription?.keys;
      if(!validId(id)||!validToken(token)||typeof subscription?.endpoint!=='string'
        ||!subscription.endpoint.startsWith('https://')
        ||!keys?.p256dh||!keys?.auth)return json({error:'Invalid subscription'},400,cors);
      const existing=await env.DB.prepare('SELECT * FROM subscriptions WHERE id=?').bind(id).first();
      if(existing&&existing.token_hash!==await hash(token))return json({error:'Unauthorized'},403,cors);
      const today=daySwiss();
      await env.DB.prepare(`INSERT INTO subscriptions (id,token_hash,subscription_json,started_day,completed_day)
        VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        subscription_json=excluded.subscription_json,updated_at=CURRENT_TIMESTAMP`)
        .bind(id,await hash(token),JSON.stringify(subscription),today,today).run();
      return json({ok:true},200,cors);
    }
    if(url.pathname==='/complete'&&request.method==='POST'){
      let body;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400,cors)}
      const row=await auth(request,env,body?.id);
      if(!row)return json({error:'Unauthorized'},401,cors);
      await env.DB.prepare('UPDATE subscriptions SET completed_day=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .bind(daySwiss(),row.id).run();
      return json({ok:true,badge:0},200,cors);
    }
    if(url.pathname==='/status'&&request.method==='POST'){
      let body;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400,cors)}
      const row=await auth(request,env,body?.id);
      if(!row)return json({error:'Unauthorized'},401,cors);
      return json({ok:true,badge:numberDue(row.completed_day,daySwiss())},200,cors);
    }
    if(url.pathname==='/unsubscribe'&&request.method==='POST'){
      let body;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400,cors)}
      const row=await auth(request,env,body?.id);
      if(!row)return json({error:'Unauthorized'},401,cors);
      await env.DB.prepare('DELETE FROM subscriptions WHERE id=?').bind(row.id).run();
      return json({ok:true},200,cors);
    }
    return json({error:'Not found'},404,cors);
  },
  async scheduled(controller,env,ctx){
    // Cron triggers run in UTC. Only the one matching 00:01 Zurich actually sends.
    // The pair of schedules automatically covers summer and winter time.
    if(swissHourMinute()!=='00:01')return;
    const today=daySwiss();
    let cursor=null;
    do{
      const query=env.DB.prepare('SELECT * FROM subscriptions WHERE completed_day < ? ORDER BY id LIMIT 100');
      const result=await query.bind(today).all();
      const rows=result.results||[];
      await Promise.all(rows.map(row=>sendPush(env,row,numberDue(row.completed_day,today))
        .catch(error=>console.error('Push failure',row.id,error))));
      // For the intended small personal deployment, the free tier will handle
      // the first 100 subscriptions. Expand to cursor pagination for larger groups.
      cursor=null;
    }while(cursor);
  }
};
