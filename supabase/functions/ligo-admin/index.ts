// LIGO admin-dashboard: server-side JWT validation and allowlist.
const BASE=Deno.env.get('SUPABASE_URL')||'';
const SECRET=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey,authorization,content-type','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:CORS});
async function rest(path,opts={}){
 const r=await fetch(BASE+'/rest/v1/'+path,{method:opts.method||'GET',headers:{apikey:SECRET,Authorization:'Bearer '+SECRET,'Content-Type':'application/json',...(opts.headers||{})},body:opts.body===undefined?undefined:JSON.stringify(opts.body),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw new Error('DATABASE_'+r.status);
 const raw=await r.text();return raw?JSON.parse(raw):null;
}
async function adminFromToken(token){
 if(typeof token!=='string'||token.length<100||token.length>8000)return null;
 const r=await fetch(BASE+'/auth/v1/user',{headers:{apikey:SECRET,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
 if(!r.ok)return null;
 const user=await r.json();
 if(!user?.id||!user?.email||!user?.email_confirmed_at)return null;
 const email=String(user.email).toLowerCase().trim();
 const whitelisted=await rest('ligo_admin_allowlist?select=email&email=eq.'+encodeURIComponent(email)+'&limit=1');
 if(whitelisted.length!==1)return null;
 return {id:user.id,email};
}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(request.method!=='POST')return respond({error:'METHOD_NOT_ALLOWED'},405);
 if(!BASE||!SECRET)return respond({error:'SERVER_UNAVAILABLE'},503);
 try{
  const bearer=request.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return respond({error:'LOGIN_REQUIRED'},401);
  const admin=await adminFromToken(bearer.slice(7));
  if(!admin)return respond({error:'NOT_AUTHORIZED'},403);
  const raw=await request.text();
  if(raw.length>1200)return respond({error:'INVALID_PAYLOAD'},413);
  const input=JSON.parse(raw),action=input.action;
  if(action==='whoami')return respond({ok:true,email:admin.email,actor_id:admin.id});
  if(action==='snapshot'){
   const snapshot=await rest('rpc/ligo_admin_snapshot',{method:'POST',body:{}});
   return respond({ok:true,snapshot});
  }
  if(action==='remove_player'){
   const p=input.player_id,d=input.difficulty;
   if(typeof p!=='string'||!/^[0-9a-f-]{36}$/i.test(p)||!['facil','medio','dificil'].includes(d))return respond({error:'INVALID_TARGET'},400);
   const count=await rest('rpc/ligo_admin_remove_ranking',{method:'POST',body:{p_actor:admin.id,p_email:admin.email,p_player:p,p_difficulty:d}});
   return respond({ok:true,deleted_runs:count});
  }
  if(action==='clear'){
   const d=input.difficulty;
   if(!['facil','medio','dificil','todos'].includes(d))return respond({error:'INVALID_TARGET'},400);
   const count=await rest('rpc/ligo_admin_clear_ranking',{method:'POST',body:{p_actor:admin.id,p_email:admin.email,p_difficulty:d}});
   return respond({ok:true,deleted_runs:count});
  }
  return respond({error:'UNKNOWN_ACTION'},404);
 }catch(e){
  console.error('LIGO_ADMIN',e instanceof Error?e.message:'UNKNOWN');
  return respond({error:'SERVICE_ERROR'},500);
 }
});
