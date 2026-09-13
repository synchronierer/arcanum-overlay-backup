const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=process.cwd(), resources=path.join(root,'src/main/resources');
const meta=JSON.parse(fs.readFileSync(path.join(resources,'meta/paths/get_paths.json'),'utf8'));
const fixture={semesterId:12,centralTopics:[{id:1,name:'Wortarten',number:1}],flexibleTopics:[{id:1,name:'Eigene Schreibwerkstatt'}],
 centralTasks:[{id:1,name:'Wortarten erkennen',tokens:10,niveau:1,topicId:1,topicName:'Wortarten',completed:true}],
 flexibleTasks:[{id:1,name:'Eine Geschichte überarbeiten',tokens:5,topicId:1,topicName:'Eigene Schreibwerkstatt',completed:false}],
 planned:{centralTokens:10,flexibleTokens:5,totalTokens:15,regularLimit:100,hardLimit:105},
 progress:{semesterId:12,centralTokens:10,flexibleTokens:0,totalTokens:10,completedCentralTasks:[{id:1,name:'Wortarten erkennen',tokens:10,niveau:1,topicId:1,topicName:'Wortarten'}],completedFlexibleTasks:[]}};
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results=[];
 try {
  for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['tablet',{width:1024,height:768}]]) {
   const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());const pathname=url.pathname;
    if(pathname==='/')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(resources,'html/user/dashboard.html'),'utf8')});
    if(pathname==='/student-database.js')return route.fulfill({contentType:'application/javascript',body:`async function fetchMyData(){return {id:999,firstName:'Test',lastName:'Lernende',schoolClass:{label:'5a'},graduationLevel:1,currentRequests:{},selectedTasks:[],lockedTasks:[]};} async function fetchMySubjects(){return [{id:3,name:'Deutsch'}];} async function fetchMyCurrentTopic(){return {id:1,name:'Wortarten'};}`});
    if(pathname==='/my-curriculum-catalog'){assert.deepEqual(JSON.parse(route.request().postData()),{subjectId:3});return route.fulfill({json:fixture});}
    const definition=meta[pathname];
    if(definition){const candidate=path.join(resources,definition.context||'html',...(definition.namespaces||[]),pathname.slice(1));if(fs.existsSync(candidate))return route.fulfill({path:candidate});}
    if(pathname==='/build_dashboard.js')return route.fulfill({path:path.join(resources,'js/user/build_dashboard.js')});
    return route.fulfill({status:404,body:''});
   });
   await page.goto('https://school.example.invalid/');
   await page.locator('.arcanum-curriculum-plan').waitFor();
   assert.equal(await page.locator('#total-coins').textContent(),'10');
   await page.locator('.arcanum-curriculum-plan > summary').click();
   for(const summary of await page.locator('.arcanum-curriculum-plan details > summary').all())await summary.click();
   assert.match(await page.locator('.arcanum-curriculum-plan').textContent(),/5 Münzen · Offen · erreichbar/);
   assert.match(await page.locator('.arcanum-curriculum-plan').textContent(),/10 Münzen · Abgeschlossen · verdient/);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false);
   assert.deepEqual(errors,[]);
   await page.locator('.arcanum-curriculum-plan').screenshot({path:path.join(root,`.gradle/browser-tools/${name}-plan.png`)});
   results.push({name,viewport,overflow,errors,score:10});await page.close();
  }
  fs.writeFileSync(path.join(root,'.gradle/browser-tools/result.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
