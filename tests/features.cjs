const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const {parse}=require('acorn');
const {chromium}=require('playwright');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const script=html.split('<script type="module">')[1].split('</script>')[0];
const ast=parse(script,{ecmaVersion:'latest',sourceType:'module'});
const names=['presentationRuntime','projectPresentationHTML','projectPosterHTML','canSelectDeptEngineers','mergeDeptEngineers','canEditDept','canEvaluate','deptCard','projectHasMe','projectAssignmentsHTML','reportEsc','sectionEngineerUsernames','saveProject'];
const funcs=ast.body.filter(n=>n.type==='FunctionDeclaration'&&names.includes(n.id.name)).map(n=>script.slice(n.start,n.end)).join('\n');
const ctx={console,Date,LOGO_DARK:'',RATE_FIELDS:[],ratingAvg:()=>0,canViewEval:()=>false,dmy:x=>x,deliveryBadge:()=>'',HEAD_TITLES:{architectural:'رئيس القسم المعماري',structural:'رئيس القسم الإنشائي',services:'رئيس قسم تصميم الخدمات'},DEPT_AR:{architectural:'المعماري',structural:'الإنشائي',services:'الخدمات'},DEPT_MAP:[['architectural'],['structural'],['services']],state:{appUser:{username:'head',jobTitle:'رئيس القسم المعماري'},users:[{username:'other',name:'مهندس إنشائي',jobTitle:'مهندس إنشائي',dept:'structural',role:'engineer'}]}};
vm.createContext(ctx);vm.runInContext(funcs,ctx);
async function main(){
  const original={engineers:[{username:'old',name:'السابق'}],engineer:'السابق',engineerUsername:'old',status:'مكتمل',startDate:'2026-10-01',endDate:'2026-10-02',actualDate:'2026-10-02',notes:'محفوظ',eval:{quality:5},endDateApproval:'pending',unknown:{keep:true}};
  const selection={engineers:[{username:'other',name:'مهندس إنشائي'}],engineer:'مهندس إنشائي',engineerUsername:'other'};
  for(const title of Object.values(ctx.HEAD_TITLES)){
    ctx.state.appUser={username:'head',jobTitle:title,dept:Object.keys(ctx.HEAD_TITLES).find(k=>ctx.HEAD_TITLES[k]===title)};
    for(const key of Object.keys(ctx.HEAD_TITLES)){
      assert.equal(ctx.canSelectDeptEngineers(key),true);
      const merged=ctx.mergeDeptEngineers(original,key,selection);
      assert.equal(merged.engineerUsername,'other');
      for(const field of ['status','startDate','endDate','actualDate','notes','eval','endDateApproval','unknown'])assert.deepEqual(merged[field],original[field]);
      if(key!==ctx.state.appUser.dept){assert.equal(ctx.canEditDept(key),false);assert.equal(ctx.canEvaluate(key),false);}
    }
  }
  for(const jobTitle of ['المدير العام','مدير عام مساعد','تنسيق ومتابعة','مهندس معماري']){
    ctx.state.appUser={username:'ordinary',jobTitle,dept:jobTitle==='مهندس معماري'?'architectural':''};
    assert.equal(ctx.canSelectDeptEngineers('structural'),false);
    assert.equal(JSON.stringify(ctx.mergeDeptEngineers(original,'structural',selection)),JSON.stringify(original));
  }
  ctx.state.appUser={username:'head',jobTitle:'رئيس القسم المعماري',dept:'architectural'};
  assert.equal(JSON.stringify(ctx.mergeDeptEngineers(original,'structural',null)),JSON.stringify(original));
  // Exercise the actual nested form serializers, then the actual save routine.
  const find=(node,id)=>{
    if(node&&node.type==='VariableDeclarator'&&node.id.name===id)return node.init;
    if(node&&typeof node==='object')for(const value of Object.values(node)){
      if(Array.isArray(value)){for(const child of value){const found=find(child,id);if(found)return found;}}
      else if(value&&typeof value==='object'){const found=find(value,id);if(found)return found;}
    }
  };
  ctx.data={structural:original};ctx.selection=selection;
  const serializer=find(ast,'sectionData');
  vm.runInContext('globalThis.serialized=('+script.slice(serializer.start,serializer.end)+")('str','structural',selection)",ctx);
  assert.equal(ctx.serialized.engineerUsername,'other');
  for(const field of ['status','startDate','endDate','actualDate','notes','eval','endDateApproval','unknown'])assert.deepEqual(ctx.serialized[field],original[field]);
  let persisted;
  Object.assign(ctx,{logActivity:()=>{},detectCompletions:()=>{},fireEndDateNotifs:()=>{},db:{},APP_ID:'test',FB:{doc:()=>({}),updateDoc:async(ref,payload)=>{persisted=payload;}}});
  await ctx.saveProject({structural:ctx.serialized},'project',{structural:original});
  assert.equal(persisted.structural.engineerUsername,'other');
  for(const field of ['status','actualDate','eval','endDateApproval','unknown'])assert.deepEqual(persisted.structural[field],original[field]);
  const card=ctx.deptCard('الإنشائي','structural',original);
  assert(!html.includes('act-assign'));assert(!html.includes('function openProjectAssignment'));
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'})});
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<form>'+card+'</form>');
  assert.equal(await page.locator('.eng-multi input:disabled').count(),0);
  assert.equal(await page.locator('select[name=str_status]').isDisabled(),true);
  assert.equal(await page.locator('textarea[name=str_notes]').isDisabled(),true);
  await page.locator('.eng-multi input').check();
  assert.equal(await page.locator('.eng-multi input').isChecked(),true);
  page.on('dialog',d=>d.accept('شريحة اختبار'));
  await page.setContent(ctx.projectPresentationHTML({name:'مشروع تجريبي',architectural:{}}));
  assert.equal(await page.locator('.page').count(),3);
  await page.locator('#addPresentationSlide').click();await page.locator('#addPresentationSlide').click();
  assert.equal(await page.locator('.page').count(),5);
  assert.equal(await page.locator('.page').last().locator('.visual-grid > .image-group').count(),2);
  await page.locator('.page').last().locator('.add-drawing').click();
  assert.equal(await page.locator('.page').last().locator('.visual-grid > .image-group').count(),3);
  await page.locator('.page').last().locator('.rename-drawing').first().click();
  assert.equal(await page.locator('.page').last().locator('.caption').first().textContent(),'شريحة اختبار');
  const captureSave=async()=>{await page.evaluate(()=>{URL.createObjectURL=blob=>{window.savedHtml=blob.text();return 'blob:test';};HTMLAnchorElement.prototype.click=function(){};});await page.locator('#savePresentation').click();return page.evaluate(()=>window.savedHtml);};
  const saved=await captureSave();
  await page.setContent(saved);assert.equal(await page.locator('.page').count(),5);
  await page.locator('#addPresentationSlide').click();assert.equal(await page.locator('.page').count(),6);
  let pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,6);
  await page.setContent(ctx.projectPosterHTML({name:'مشروع تجريبي'}));
  assert.equal(await page.locator('#posterSize').inputValue(),'A1');
  const checkPdf=async(w,h)=>{
    const geometry=await page.locator('.poster-sheet').evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight}));
    assert(Math.abs(geometry.w-w*96/25.4)<2);assert(Math.abs(geometry.h-h*96/25.4)<2);
    const bytes=await page.pdf({preferCSSPageSize:true,printBackground:true});
    const str=bytes.toString('latin1');assert.equal((str.match(/\/Type \/Page\b/g)||[]).length,1);
    const box=str.match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);assert(box);
    assert(Math.abs(Number(box[1])-w*72/25.4)<2);assert(Math.abs(Number(box[2])-h*72/25.4)<2);
  };
  await checkPdf(594,841);if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'poster-portrait.png'),fullPage:true});
  await page.locator('#posterDirection').selectOption('landscape');await checkPdf(841,594);if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'poster-landscape.png'),fullPage:true});
  await page.locator('#posterSize').selectOption('A3');await checkPdf(420,297);
  await page.locator('#posterSize').selectOption('custom');
  await page.locator('#posterWidth').fill('500');await page.locator('#posterHeight').fill('700');await page.locator('#posterHeight').dispatchEvent('change');await checkPdf(700,500);
  const posterSaved=await captureSave();await page.setContent(posterSaved);
  assert.equal(await page.locator('#posterSize').inputValue(),'custom');await checkPdf(700,500);
  await page.locator('#posterWidth').fill('0');await page.locator('#posterWidth').dispatchEvent('change');assert(await page.locator('#printPresentation').isDisabled());
  assert.deepEqual(errors,[]);await browser.close();
  console.log('PASS: syntax, all department heads selecting engineers across departments, unchanged non-head permissions, section field isolation, enabled engineer checkboxes with locked status/notes, removed separate assignment button, dynamic slides, editable save/reopen, six-page print, A1/A3/landscape/custom PDF geometry and saved settings. No production data accessed.');
}
main().catch(e=>{console.error(e);process.exit(1);});

