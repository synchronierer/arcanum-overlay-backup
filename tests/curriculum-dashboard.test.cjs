const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../src/main/resources/js/user/build_dashboard.js'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'../src/main/resources/html/user/dashboard.html'),'utf8');
function fixture() {
 return {
  semesterId:12,
  centralTopics:[{id:17,name:'Central topic',number:1}],
  flexibleTopics:[{id:17,name:'Flexible topic'}],
  centralTasks:[{id:17,name:'Same name',tokens:70,niveau:1,topicId:17,topicName:'Central topic',completed:true}],
  flexibleTasks:[{id:17,name:'Same name',tokens:5,topicId:17,topicName:'Flexible topic',completed:false},
   {id:18,name:'Zero step',tokens:0,completed:true}],
  planned:{centralTokens:70,flexibleTokens:5,totalTokens:75,regularLimit:100,hardLimit:105},
  progress:{semesterId:12,centralTokens:70,flexibleTokens:0,totalTokens:70,completedCentralTasks:[],completedFlexibleTasks:[]}
 };
}
async function setup(response={ok:true,status:200,body:fixture()}) {
 const dom=new JSDOM(page,{url:'https://school.example.invalid/',runScripts:'outside-only'});
 await new Promise(resolve=>dom.window.document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 const calls=[];
 dom.window.fetch=async(url,options)=>{calls.push({url,...options});if(response.network)throw Error('private detail');return {ok:response.ok,status:response.status,json:async()=>{if(response.badJson)throw Error('private detail');return structuredClone(response.body);}};};
 dom.window.fetchMyCurrentTopic=async()=>null;
 require('node:vm').runInContext(source,dom.getInternalVMContext());
 return {dom,w:dom.window,calls};
}
test('catalog request uses numeric subject only and same-origin session',async()=>{
 const {dom,w,calls}=await setup();try {
  await w.fetchStudentCurriculumCatalog(3);
  assert.equal(calls[0].url,'/my-curriculum-catalog');assert.equal(calls[0].method,'POST');
  assert.equal(calls[0].credentials,'same-origin');assert.deepEqual(JSON.parse(calls[0].body),{subjectId:3});
  await assert.rejects(w.fetchStudentCurriculumCatalog('3'));assert.equal(calls.length,1);
 }finally{dom.window.close();}
});
test('model uses earned curriculum values and preserves separate task and topic namespaces',async()=>{
 const {dom,w}=await setup();try {
  const model=await w.createSubjectModel({id:3,name:'Math'},{completedTasks:[{tokens:999}],currentRequests:{}});
  assert.equal(model.coins,70);assert.equal(model.semesterId,12);assert.equal(model.completedTasks.length,2);
  const groups=w.groupTasksByTopic([...model.catalog.centralTasks,...model.catalog.flexibleTasks]);assert.equal(groups.length,3);
  const card=w.createSubjectCard(model);
  assert.equal(card.querySelectorAll('[data-task-key="central:17"]').length,1);
  assert.equal(card.querySelectorAll('[data-task-key="flexible:17"]').length,1);
  assert.match(card.textContent,/5 Münzen · Offen · erreichbar/);assert.match(card.textContent,/0 Münzen · Abgeschlossen · verdient/);
  assert.match(card.textContent,/Noch keinem Thema zugeordnet/);assert.doesNotMatch(card.textContent,/999/);
  assert.equal(card.querySelector('.arcanum-curriculum-plan [data-task-action]'),null);
 }finally{dom.window.close();}
});
test('model derives the current topic from the catalog without a current-topic request',async()=>{
 const data=fixture();data.activeStage={type:'CENTRAL',taskId:17,subjectId:3,semesterId:12,name:'Same name',niveau:1};
 const {dom,w,calls}=await setup({ok:true,status:200,body:data});try {
  w.fetchMyCurrentTopic=()=>{throw new Error('current-topic must not be used by the dashboard model');};
  const model=await w.createSubjectModel({id:3,name:'Math'},{});
  assert.equal(model.currentTopic.id,17);assert.equal(model.currentTopic.name,'Central topic');
  assert.deepEqual(calls.map(call=>call.url),['/my-curriculum-catalog']);
 }finally{dom.window.close();}
});
test('plan and current names are rendered as text, including empty topics',async()=>{
 const {dom,w}=await setup();try {
  const data=fixture();data.centralTasks[0].name='<img src=x onerror=alert(1)>';data.flexibleTopics.push({id:19,name:'Empty topic'});
  const plan=w.createCurriculumPlan(w.normalizeCurriculumCatalog(data));
  assert.equal(plan.querySelectorAll('img').length,0);assert.match(plan.textContent,/<img/);
  assert.match(plan.textContent,/Empty topic/);assert.match(plan.textContent,/Noch keine Etappen in diesem Thema/);
 }finally{dom.window.close();}
});
for(const [name,response,text] of [
 ['missing context',{ok:false,status:409,body:{error:'context_unassigned'}},/kein SOL-Kontext/],
 ['missing semester',{ok:false,status:409,body:{error:'current_semester_unavailable'}},/Halbjahr.*nicht konfiguriert/],
 ['unauthorized',{ok:false,status:401,badJson:true},/erneut anmelden/],
 ['forbidden',{ok:false,status:403,badJson:true},/Berechtigung/],
 ['server',{ok:false,status:500,body:{message:'SQL private detail'}},/nicht geladen/],
 ['invalid JSON',{ok:true,status:200,badJson:true},/nicht verarbeitet/],
 ['network',{network:true},/nicht geladen/]
])test(name+' never produces a zero score or grade',async()=>{
 const {dom,w}=await setup(response);try {
  const model=await w.createSubjectModel({id:3,name:'Math'},{});assert.equal(model.coins,null);assert.match(model.curriculumError,text);
  const card=w.createSubjectCard(model);assert.equal(card.querySelector('.arcanum-current-grade'),null);
  assert.doesNotMatch(card.textContent,/SQL|private detail|0 Münzen/);
  w.renderSummary([model]);assert.equal(w.document.querySelector('#total-coins').textContent,'Nicht verfügbar');
 }finally{dom.window.close();}
});
test('semester conflict and missing configured semester suppress all scores',async()=>{
 const {dom,w}=await setup();try {
  for(const second of [{semesterId:13,coins:4},{curriculumErrorCode:'current_semester_unavailable',curriculumError:'Missing',coins:null}]) {
   const models=[{semesterId:12,coins:70},second];w.reconcileCurriculumSemesters(models);
   assert.ok(models.every(m=>m.curriculumError&&m.coins===null));w.renderSummary(models);
   assert.equal(w.document.querySelector('#total-coins').textContent,'Nicht verfügbar');
  }
 }finally{dom.window.close();}
});
test('partial success is marked incomplete, complete totals sum the same semester',async()=>{
 const {dom,w}=await setup();try {
  const models=[{semesterId:12,coins:70},{coins:null,curriculumError:'Not assigned'}];w.reconcileCurriculumSemesters(models);w.renderSummary(models);
  assert.equal(w.document.querySelector('#total-coins').textContent,'70 · unvollständig');
  w.renderSummary([{semesterId:12,coins:70},{semesterId:12,coins:5}]);assert.equal(w.document.querySelector('#total-coins').textContent,'75');
 }finally{dom.window.close();}
});
test('105 earned coins keep 100 target and expose extra coins',async()=>{
 const data=fixture();data.flexibleTasks[0].tokens=35;data.flexibleTasks[0].completed=true;
 data.planned.flexibleTokens=35;data.planned.totalTokens=105;data.progress.flexibleTokens=35;data.progress.totalTokens=105;
 const {dom,w}=await setup({ok:true,status:200,body:data});try {
  const model=await w.createSubjectModel({id:3,name:'Math'},{});const card=w.createSubjectCard(model);
  assert.match(card.textContent,/105/);assert.match(card.textContent,/\+5 Zusatzmünzen/);assert.match(card.textContent,/Ziel: 100/);
  assert.equal(model.currentGrade.grade,1);
 }finally{dom.window.close();}
});
test('grade boundaries follow canonical coin pedagogy',async()=>{
 const {dom,w}=await setup();try {
  for(const [coins,grade] of [[19,6],[20,5],[39,5],[40,4],[59,4],[60,3],[74,3],[75,2],[89,2],[90,1],[100,1],[105,1]]) {
   assert.equal(w.calculateCurrentGrade(coins).grade,grade,`${coins} coins`);
  }
 }finally{dom.window.close();}
});
test('malformed successful responses cannot fabricate progress',async()=>{
 const {dom,w}=await setup();try {
  for(const mutate of [d=>d.progress.totalTokens=0,d=>d.semesterId=13,d=>d.flexibleTasks[0].completed=true,
   d=>d.flexibleTasks[0].topicId=999,d=>d.centralTasks[0].niveau=99,d=>d.planned.totalTokens=106,
   d=>d.centralTasks.push({...d.centralTasks[0]}),d=>d.centralTopics.push({...d.centralTopics[0]}),d=>d.flexibleTasks[0].tokens=-1]) {
   const data=fixture();mutate(data);assert.throws(()=>w.normalizeCurriculumCatalog(data),error=>error.code==='invalid_data');
  }
 }finally{dom.window.close();}
});
test('completion details retain zero values and label flexible tasks without invented level',async()=>{
 const {dom,w}=await setup();try {
  const data=w.normalizeCurriculumCatalog(fixture());
  const html=w.createTaskDetailRowHtml(data.flexibleTasks[1],'completed');
  assert.match(html,/Flexible Etappe/);assert.match(html,/0 Münzen/);assert.doesNotMatch(html,/Münzwert noch offen|Niveau offen/);
 }finally{dom.window.close();}
});
test('new load uses updated backend values without a progress cache',async()=>{
 const response={ok:true,status:200,body:fixture()};const {dom,w,calls}=await setup(response);try {
  await w.createSubjectModel({id:3,name:'Math'},{});
  response.body.centralTasks[0].tokens=60;response.body.planned.centralTokens=60;response.body.planned.totalTokens=65;
  response.body.progress.centralTokens=60;response.body.progress.totalTokens=60;
  const updated=await w.createSubjectModel({id:3,name:'Math'},{});assert.equal(updated.coins,60);assert.equal(calls.length,2);
  assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);
 }finally{dom.window.close();}
});

test('unreleased central planning remains accounted for without exposing tasks',async()=>{
 const {dom,w}=await setup();try {
  const data=fixture();data.centralTasks=[];data.centralTopics=[];data.planned.unreleasedCentralTokens=70;data.progress.centralTokens=0;data.progress.totalTokens=0;
  const catalog=w.normalizeCurriculumCatalog(data),plan=w.createCurriculumPlan(catalog);
  assert.match(plan.textContent,/70 geplante Münzen gehören zu noch nicht freigeschalteten/);
  assert.match(plan.textContent,/Noch keine zentralen Themen oder Etappen freigeschaltet/);
  assert.equal(plan.querySelector('[data-task-key="central:17"]'),null);
  data.planned.unreleasedCentralTokens=69;assert.throws(()=>w.normalizeCurriculumCatalog(data));
  data.planned.unreleasedCentralTokens=-1;assert.throws(()=>w.normalizeCurriculumCatalog(data));
 }finally{dom.window.close();}
});
