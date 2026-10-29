// LIGO: interface pública, com identidade por token aleatório de instalação.
// A chave service role fica exclusivamente no ambiente da Edge Function.
const BASE = Deno.env.get('SUPABASE_URL') || '';
const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const HEAD = {'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey,authorization,content-type','Cache-Control':'no-store'};
const dbHeaders = {apikey:SECRET, Authorization:'Bearer '+SECRET, 'Content-Type':'application/json'};
const DIFFICULTIES=['facil','medio','dificil'];
const isDifficulty=v=>typeof v==='string'&&DIFFICULTIES.includes(v);
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:HEAD});
async function db(path, options={}){
 const res=await fetch(BASE+'/rest/v1/'+path,{method:options.method||'GET',headers:{...dbHeaders,...(options.headers||{})},body:options.body?JSON.stringify(options.body):undefined,signal:AbortSignal.timeout(10000)});
 if(!res.ok){const t=await res.text();throw new Error('DB_'+res.status+':'+t.slice(0,220))}
 const t=await res.text();return t?JSON.parse(t):null;
}
const digest=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function playerFor(token){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/i.test(token))return null;
 const hash=await digest(token.toLowerCase());
 const rows=await db('players?select=id,nickname,created_at&token_hash=eq.'+hash+'&limit=1');
 return rows[0]||null;
}
function rand(seed){let s=seed>>>0||123456789;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296}}
function trace(p,states){
 let [x,y]=p.emitter,[dx,dy]=({right:[1,0],left:[-1,0],up:[0,-1],down:[0,1]})[p.direction];
 const visited=new Set();
 for(let i=0;i<95;i++){
  if(x===p.receiver[0]&&y===p.receiver[1])return true;
  const idx=p.mirrors.findIndex(m=>m[0]===x&&m[1]===y);
  if(idx>=0)[dx,dy]=states[idx]?[-dy,-dx]:[dy,dx];
  const k=[x,y,dx,dy].join(':');if(visited.has(k))break;visited.add(k);
  x+=dx;y+=dy;if(x<0||x>10||y<0||y>6)break;
 }
 return false;
}
function generate(stage,seed,difficulty){
 if(!isDifficulty(difficulty)||stage<1||stage>5)throw Error('DIFFICULTY_INVALID');
 const mirrorCounts={
  facil:[1,2,2,3,3],
  medio:[2,3,4,4,5],
  dificil:[4,4,5,5,6]
 };
 const rng=rand(seed),step=[[1,0],[0,1],[-1,0],[0,-1]],dirs=['right','down','left','up'],count=mirrorCounts[difficulty][stage-1];
 // Duas posições ópticas por espelho, independentemente da dificuldade.
 const minimumSegment=difficulty==='facil'?3:difficulty==='medio'?2:1;
 for(let attempt=0;attempt<85000;attempt++){
  let x=1+Math.floor(rng()*9),y=1+Math.floor(rng()*5),dir=Math.floor(rng()*4);
  const start=[x,y],initial=dir,seen=new Set([x+','+y]),mirrors=[],solution=[];let valid=true;
  for(let m=0;m<count;m++){
   const n=minimumSegment+Math.floor(rng()*3),[dx,dy]=step[dir];
   for(let j=0;j<n;j++){x+=dx;y+=dy;const k=x+','+y;if(x<0||x>10||y<0||y>6||seen.has(k)){valid=false;break}seen.add(k)}
   if(!valid)break;
   const next=(dir+(rng()<.5?1:3))%4;
   const slash=step[next][0]===-step[dir][1]&&step[next][1]===-step[dir][0];
   mirrors.push([x,y,rng()<.5]);solution.push(slash);dir=next;
  }
  if(!valid)continue;
  const n=1+Math.floor(rng()*3),[dx,dy]=step[dir];
  for(let j=0;j<n;j++){x+=dx;y+=dy;const k=x+','+y;if(x<0||x>10||y<0||y>6||seen.has(k)){valid=false;break}seen.add(k)}
  if(!valid)continue;
  const puzzle={title:'Circuito '+stage,emitter:start,receiver:[x,y],direction:dirs[initial],mirrors};
  let wins=0;
  for(let mask=0;mask<(1<<count);mask++)if(trace(puzzle,mirrors.map((_,i)=>Boolean(mask&(1<<i)))))wins++;
  if(wins===1&&!mirrors.every((m,i)=>m[2]===solution[i]))return {puzzle,solution};
 }
 throw Error('GENERATOR_FAILED');
}
function publicPuzzle(p){
 // Conserva sessões antigas: ângulos legados são convertidos em '/' e '\\'.
 const mirrors=p.mirrors.map(([x,y,value])=>[x,y,typeof value==='boolean'?value:((Number(value)||0)%180===90)]);
 return {title:p.title,emitter:p.emitter,receiver:p.receiver,direction:p.direction,mirrors};
}
async function getChallenge(run){
 const rows=await db('stage_challenges?select=stage,puzzle&run_id=eq.'+run.id+'&stage=eq.'+run.stage+'&limit=1');
 if(rows.length)return publicPuzzle(rows[0].puzzle);
 for(let i=0;i<12;i++){
  const seed=crypto.getRandomValues(new Uint32Array(1))[0],g=generate(run.stage,seed,run.difficulty);
  const fingerprint=await digest(JSON.stringify({emitter:g.puzzle.emitter,receiver:g.puzzle.receiver,direction:g.puzzle.direction,mirrors:g.puzzle.mirrors.map(m=>m.slice(0,2))}));
  try{
   const row=await db('stage_challenges',{method:'POST',headers:{Prefer:'return=representation'},body:{run_id:run.id,stage:run.stage,puzzle:g.puzzle,solution:g.solution,fingerprint}});
   return publicPuzzle(row[0].puzzle);
  }catch(e){if(!String(e).includes('DB_409'))throw e;
    const existing=await db('stage_challenges?select=puzzle&run_id=eq.'+run.id+'&stage=eq.'+run.stage+'&limit=1');
    if(existing.length)return publicPuzzle(existing[0].puzzle);
  }
 }
 throw Error('GENERATOR_CONFLICT');
}
async function getRun(playerId,runId){
 let q='game_runs?select=id,stage,difficulty,started_at,status,duration_ms&player_id=eq.'+playerId;
 if(runId)q+='&id=eq.'+encodeURIComponent(runId);
 else q+='&status=eq.playing&order=started_at.desc';
 const rows=await db(q+'&limit=1');return rows[0]||null;
}
async function start(player, fresh=false,difficulty='medio'){
 if(!isDifficulty(difficulty))return {error:'DIFICULDADE_INVALIDA'};
 // Em feira, uma nova entrada de nome inicia uma nova tentativa.
 // Uma tentativa anterior não concluída deste mesmo jogador fica abandonada.
 if(fresh){
   const previous=await getRun(player.id);
   if(previous)await db('game_runs?id=eq.'+previous.id+'&player_id=eq.'+player.id+'&status=eq.playing',{method:'PATCH',body:{status:'abandoned'}});
 }
 let run=await getRun(player.id);
 if(!run){
  // Limita abusos: no máximo dez novas tentativas por identidade em 60 minutos.
  const cutoff=new Date(Date.now()-3600000).toISOString();
  const history=await db('game_runs?select=id&player_id=eq.'+player.id+'&started_at=gte.'+encodeURIComponent(cutoff)+'&limit=11');
  if(history.length>=10)return {error:'LIMITE_TENTATIVAS',retry:'Tente novamente mais tarde.'};
  try{const rows=await db('game_runs',{method:'POST',headers:{Prefer:'return=representation'},body:{player_id:player.id,difficulty}});run=rows[0]}
  catch(e){if(!String(e).includes('DB_409'))throw e;run=await getRun(player.id)}
 }
 if(!run)return {error:'PARTIDA_NAO_ENCONTRADA'};
 const puzzle=await getChallenge(run);
 return {run_id:run.id,stage:run.stage,difficulty:run.difficulty,started_at:run.started_at,puzzle,server_now:new Date().toISOString()};
}
async function rank(p,difficulty){
 if(!isDifficulty(difficulty))return {error:'DIFICULDADE_INVALIDA'};
 const rows=await db('global_ranking?select=position,player_id,nickname,best_ms,record_at&difficulty=eq.'+difficulty+'&order=position.asc&limit=100');
 let mine=null;
 if(p){const rr=await db('global_ranking?select=position,best_ms,player_id&difficulty=eq.'+difficulty+'&player_id=eq.'+p.id+'&limit=1');mine=rr[0]||null}
 return {ranking:rows,me:mine,difficulty,updated_at:new Date().toISOString()};
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:HEAD});
 if(req.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
 if(!BASE||!SECRET)return reply({error:'SERVER_CONFIGURATION'},503);
 try{
  const raw=await req.text();if(raw.length>6000)return reply({error:'PAYLOAD_TOO_LARGE'},413);
  const data=JSON.parse(raw),action=data.action;
  if(action==='health')return reply({ok:true,service:'ligo-api',timestamp:new Date().toISOString()});
  if(action==='register'){
   if(!/^[a-f0-9]{64}$/i.test(data.token||''))return reply({error:'TOKEN_INVALIDO'},400);
   const first=String(data.first_name||'').normalize('NFC').trim().replace(/\s+/g,' ');
   const last=String(data.last_name||'').normalize('NFC').trim().replace(/\s+/g,' ');
   const namePattern=/^[\p{L}][\p{L}'-]*(?: [\p{L}][\p{L}'-]*)*$/u;
   const nickname=first+' '+last;
   if(first.length<2||first.length>35||last.length<2||last.length>45||
      nickname.length>80||!namePattern.test(first)||!namePattern.test(last)||
      /^(admin|administrador|sistema)$/i.test(first))
     return reply({error:'NOME_COMPLETO_INVALIDO'},400);
   const p=await playerFor(data.token);
   if(p){
     // Um token de outro participante nunca pode substituir o nome exibido.
     if(p.nickname.normalize('NFC').toLocaleLowerCase('pt-BR')!==nickname.toLocaleLowerCase('pt-BR'))
       return reply({error:'IDENTIDADE_NAO_CONFERE'},403);
     return reply({player:p,existing:true});
   }
   try{
    const ins=await db('players',{method:'POST',headers:{Prefer:'return=representation'},body:{nickname,token_hash:await digest(data.token.toLowerCase())}});
    return reply({player:{id:ins[0].id,nickname:ins[0].nickname},existing:false});
   }catch(e){if(String(e).includes('DB_409'))return reply({error:'NOME_JA_UTILIZADO'},409);throw e}
  }
  if(action==='ranking')return reply(await rank(await playerFor(data.token),data.difficulty));
  const player=await playerFor(data.token);
  if(!player)return reply({error:'JOGADOR_NAO_ENCONTRADO'},401);
  if(action==='profile')return reply({player,run:await getRun(player.id)});
  if(action==='start')return reply(await start(player,data.fresh===true,data.difficulty));
  if(action==='submit'){
   if(!/^[0-9a-f-]{36}$/i.test(String(data.run_id))||!Array.isArray(data.states)||data.states.length>8)
     return reply({error:'DADOS_INVALIDOS'},400);
   // O suporte pode dar uma volta completa; as diagonais válidas retornam
   // aos dois eixos ópticos equivalentes: 0º/180º e 90º/270º.
   const normalized=data.states.map(angle=>{
     if(typeof angle==='boolean')return angle; // compatibilidade com clientes anteriores
     if(typeof angle!=='number'||!Number.isInteger(angle)||angle<0||angle>=360||angle%45!==0)return null;
     if(angle%90!==0)return null; // a 45º/135º o laser não está alinhado à grade
     return angle%180===90;
   });
   if(normalized.includes(null))return reply({error:'SOLUCAO_INCORRETA'},400);
   const initial=await getRun(player.id,data.run_id);
   if(!initial||!isDifficulty(initial.difficulty))return reply({error:'PARTIDA_INVALIDA'},400);
   const out=await db('rpc/ligo_submit_stage',{method:'POST',body:{p_run_id:data.run_id,p_player_id:player.id,p_states:normalized}});
   if(!out?.ok)return reply({error:out?.error||'SOLUCAO_INVALIDA'},400);
   if(out.finished){return reply({finished:true,duration_ms:out.duration_ms,...await rank(player,initial.difficulty)})}
   const run=await getRun(player.id,data.run_id);
   if(!run)return reply({error:'PARTIDA_NAO_ENCONTRADA'},404);
   return reply({finished:false,stage:run.stage,difficulty:run.difficulty,puzzle:await getChallenge(run),started_at:run.started_at,run_id:run.id});
  }
  return reply({error:'ACAO_DESCONHECIDA'},404);
 }catch(e){const msg=String(e);return reply({error:msg.includes('DB_')?'FALHA_NO_BANCO':'ERRO_INTERNO',detail:msg.slice(0,95)},500)}
});
