/* ============================================================
   Easy Pergola — contract intake engine
   ------------------------------------------------------------
   The v2 intake (services -> conditional trade pages -> scope
   table -> price -> review) is carried over as authored. What
   follows the review step is new: the finished agreement, an
   adjustments panel, the contractor countersignature, and
   delivery to the client for their signature.
   ============================================================ */

import {
  renderContract, normalize, paymentCheck as tplPaymentCheck, money as fmtMoney, esc as escape,
} from './pergola-template.js';
import { createSignaturePad } from './signature-pad.js';
import { contractNumber } from './contract-template.js';


const form=document.getElementById('intakeForm');
const allSteps=[...document.querySelectorAll('.step')];
let activeSteps=[];
let currentIndex=0;

const serviceValues=()=>[...document.querySelectorAll('#serviceGrid input:checked')].map(x=>x.value);
const hasService=v=>serviceValues().includes(v);

function recalcActiveSteps(){
  activeSteps=allSteps.filter(step=>{
    if(!step.classList.contains('conditional')) return true;
    const required=(step.dataset.services||'').split('|');
    return required.some(hasService);
  });
  const current=activeSteps[currentIndex] || activeSteps[0];
  renderSidebar();
  return current;
}

function renderSidebar(){
  const sideNav=document.getElementById('sideNav');
  sideNav.innerHTML='';
  activeSteps.filter(s=>s.dataset.id!=='complete').forEach((step,i)=>{
    const item=document.createElement('div');
    item.className='nav-item'+(i===currentIndex?' active':'')+(i<currentIndex?' done':'');
    item.innerHTML=`<div class="dot">${i+1}</div><div>${step.dataset.title}</div>`;
    sideNav.appendChild(item);
  });
}

function showStep(index){
  recalcActiveSteps();
  currentIndex=Math.max(0,Math.min(index,activeSteps.length-1));
  allSteps.forEach(s=>s.classList.remove('active'));
  activeSteps[currentIndex].classList.add('active');
  renderSidebar();

  const complete=activeSteps[currentIndex].dataset.id==='complete';
  const visibleCount=activeSteps.length-1;
  if(!complete){
    document.getElementById('progressText').textContent=`Step ${currentIndex+1} of ${visibleCount}`;
    document.getElementById('progressBar').style.width=`${((currentIndex+1)/visibleCount)*100}%`;
  }else{
    document.getElementById('progressText').textContent='Complete';
    document.getElementById('progressBar').style.width='100%';
  }
  document.getElementById('backBtn').style.visibility=currentIndex===0?'hidden':'visible';
  document.getElementById('backBtn').style.display=complete?'none':'inline-block';
  document.getElementById('nextBtn').style.display=complete?'none':'inline-block';
  const stepId=activeSteps[currentIndex].dataset.id;
  const nextBtn=document.getElementById('nextBtn');
  nextBtn.textContent={review:'Create the agreement',contract:'Looks right — sign it',sign:'Continue'}[stepId]||'Continue';
  nextBtn.style.display=(complete||stepId==='send')?'none':'inline-block';

  if(activeSteps[currentIndex].dataset.id==='screens') buildScreenWalls();
  if(activeSteps[currentIndex].dataset.id==='concrete') updateConcreteVisibility();
  if(activeSteps[currentIndex].dataset.id==='kitchenBathroom') updateKitchenBathroomVisibility();
  if(activeSteps[currentIndex].dataset.id==='scope') refreshScopeFromServices(false);
  if(activeSteps[currentIndex].dataset.id==='review') buildSummary();
  if(activeSteps[currentIndex].dataset.id==='contract') buildContractStep();
  if(activeSteps[currentIndex].dataset.id==='sign') buildSignStep();
  if(activeSteps[currentIndex].dataset.id==='send') buildSendStep();
  saveForm();
  window.scrollTo({top:0,behavior:'smooth'});
}

document.getElementById('nextBtn').addEventListener('click',()=>{
  const id=activeSteps[currentIndex].dataset.id;
  if(id==='price'){
    const msg=paymentCheck(getData());
    const w=document.getElementById('paymentWarning');
    w.style.display=msg?'block':'none';w.textContent=msg;
    if(msg) return;                    // the money has to balance before moving on
  }
  if(id==='review'){
    const issues=validationIssues(getData());
    if(issues.length){ buildSummary(); return; }   // buildSummary already lists them
    startContract();
  }
  if(id==='sign' && !captureSignature()) return;
  showStep(currentIndex+1);
});
document.getElementById('backBtn').addEventListener('click',()=>showStep(currentIndex-1));

document.querySelectorAll('#serviceGrid .check-card').forEach(card=>{
  card.addEventListener('click',()=>{
    setTimeout(()=>{
      card.classList.toggle('selected',card.querySelector('input').checked);
      recalcActiveSteps();
      saveForm();
    },0);
  });
});

function setupChoiceGroup(containerId,fieldName,onChange){
  document.querySelectorAll(`#${containerId} .choice`).forEach(c=>{
    c.addEventListener('click',()=>{
      document.querySelectorAll(`#${containerId} .choice`).forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
      form.elements[fieldName].value=c.dataset.value;
      if(onChange)onChange(c.dataset.value);
      saveForm();
    });
  });
}
setupChoiceGroup('coOwnerChoice','hasCoOwner',v=>{
  document.getElementById('coOwnerFields').classList.toggle('hidden',v!=='Yes');
});
setupChoiceGroup('surveyChoice','surveyResponsibility');

const scopeCategories=[
 ['Pergola structure & roof'],
 ['Engineering / structural plans'],
 ['Permit / expeditor / city fee'],
 ['Concrete slab / footings'],
 ['Paver removal / reset'],
 ['Electrical / lights / fans'],
 ['Regular screens'],
 ['Motorized screens'],
 ['Outdoor kitchen / plumbing'],
 ['Outdoor bathroom'],
 ['Flooring / turf / landscaping'],
 ['Decorative wall / fence finish'],
 ['Other']
];
const statusOptions=['INCLUDED','EXCLUDED','HOMEOWNER RESPONSIBILITY','CONTRACTOR RESPONSIBILITY','BY OTHERS','ALLOWANCE','NOT APPLICABLE','NOT DECIDED'];
const scopeList=document.getElementById('scopeList');

function buildScope(){
  scopeList.innerHTML='';
  scopeCategories.forEach((row,i)=>{
    const div=document.createElement('div');
    div.className='scope-row';
    div.innerHTML=`<div class="scope-name">${row[0]}</div>
      <select name="scopeStatus_${i}">${statusOptions.map(s=>`<option${s==='NOT DECIDED'?' selected':''}>${s}</option>`).join('')}</select>
      <input name="scopeDetail_${i}" placeholder="Specific inclusion or limitation">`;
    scopeList.appendChild(div);
  });
}
buildScope();

function refreshScopeFromServices(force=true){
  const d=getData();
  const mappings=[
    ['Aluminum Pergola','Patio Cover'],
    [],
    [],
    ['Concrete Slab'],
    ['Pavers'],
    ['Electrical'],
    ['Regular Screens'],
    ['Motorized Screens'],
    ['Outdoor Kitchen'],
    ['Outdoor Bathroom'],
    ['Flooring / Turf / Landscaping'],
    ['Decorative Wall / Fence'],
    ['Other']
  ];
  const details=[
    'Furnish and install the structure and roof described in the project specifications.',
    d.engineeringResponsibility||'Confirm engineering responsibility.',
    d.permitResponsibility||'Confirm permit responsibility.',
    d.concreteSf?`Approximately ${d.concreteSf} sq ft; ${d.concreteType||''}; ${d.concreteThickness||''}.`:'No concrete work unless specifically listed.',
    d.paverSf?`Approximately ${d.paverSf} sq ft; ${d.paverType||''}.`:'No paver work unless specifically listed.',
    'Electrical work only as specifically described in the electrical section.',
    'Regular screen openings only as listed in the screen section.',
    'Motorized screen openings only as listed in the screen section.',
    'Outdoor kitchen work only as specifically described.',
    'Outdoor bathroom work only as specifically described.',
    'Flooring, turf, or landscaping only as specifically described.',
    'Decorative wall or fence work only as specifically described.',
    ''
  ];

  scopeCategories.forEach((_,i)=>{
    const status=form.querySelector(`[name="scopeStatus_${i}"]`);
    const detail=form.querySelector(`[name="scopeDetail_${i}"]`);
    if(!force && status.value && status.value!=='NOT DECIDED') return;
    if(i===1){
      status.value=d.engineeringResponsibility==='Homeowner responsibility'?'HOMEOWNER RESPONSIBILITY':
                   d.engineeringResponsibility?.includes('Contractor')?'INCLUDED':
                   d.engineeringResponsibility==='Not included'?'EXCLUDED':'NOT DECIDED';
    }else if(i===2){
      status.value=d.permitResponsibility==='Homeowner responsibility'?'HOMEOWNER RESPONSIBILITY':
                   d.permitResponsibility==='Contractor responsibility'?'INCLUDED':'NOT DECIDED';
    }else{
      const selected=mappings[i].some(hasService);
      status.value=selected?'INCLUDED':'EXCLUDED';
    }
    detail.value=details[i];
  });
}
document.getElementById('refreshScope').addEventListener('click',()=>refreshScopeFromServices(true));
document.getElementById('clearScope').addEventListener('click',()=>{
  scopeCategories.forEach((_,i)=>{
    form.querySelector(`[name="scopeStatus_${i}"]`).value='NOT DECIDED';
    form.querySelector(`[name="scopeDetail_${i}"]`).value='';
  });
});

function buildScreenWalls(){
  const count=Number(document.getElementById('screenWallCount').value||1);
  const container=document.getElementById('screenWalls');
  const existing={};
  container.querySelectorAll('.screen-wall').forEach((row,i)=>{
    existing[i]={
      label:row.querySelector('[data-f="label"]')?.value||'',
      width:row.querySelector('[data-f="width"]')?.value||'',
      height:row.querySelector('[data-f="height"]')?.value||'',
      type:row.querySelector('[data-f="type"]')?.value||'',
      jumbo:row.querySelector('[data-f="jumbo"]')?.value||''
    };
  });
  container.innerHTML='';
  for(let i=0;i<count;i++){
    const prev=existing[i]||{};
    const row=document.createElement('div');
    row.className='screen-wall';
    row.innerHTML=`
      <div class="field"><label>Opening</label><input data-f="label" name="screen_${i}_label" value="${prev.label||`Wall ${i+1}`}"></div>
      <div class="field"><label>Width (ft)</label><input data-f="width" name="screen_${i}_width" type="number" min="0" step=".1" value="${prev.width||''}"><div class="wall-warning">Over 16 ft — choose Jumbo or split opening.</div></div>
      <div class="field"><label>Height (ft)</label><input data-f="height" name="screen_${i}_height" type="number" min="0" step=".1" value="${prev.height||''}"></div>
      <div class="field"><label>Screen type</label><select data-f="type" name="screen_${i}_type">
        <option ${prev.type==='Regular screen'?'selected':''}>Regular screen</option>
        <option ${prev.type==='Motorized screen'?'selected':''}>Motorized screen</option>
      </select></div>
      <div class="field"><label>Size class</label><select data-f="jumbo" name="screen_${i}_jumbo">
        <option ${prev.jumbo==='Standard'?'selected':''}>Standard</option>
        <option ${prev.jumbo==='Jumbo'?'selected':''}>Jumbo</option>
        <option ${prev.jumbo==='Split into two'?'selected':''}>Split into two</option>
      </select></div>`;
    container.appendChild(row);
    const width=row.querySelector('[data-f="width"]');
    const warning=row.querySelector('.wall-warning');
    const jumbo=row.querySelector('[data-f="jumbo"]');
    const check=()=>{
      const over=Number(width.value)>16;
      warning.style.display=over?'block':'none';
      if(over && jumbo.value==='Standard') jumbo.value='Jumbo';
      saveForm();
    };
    width.addEventListener('input',check);
    jumbo.addEventListener('change',check);
    check();
  }
  document.getElementById('motorizedOptions').classList.toggle('hidden',!hasService('Motorized Screens'));
}
document.getElementById('screenWallCount').addEventListener('change',buildScreenWalls);

function updateConcreteVisibility(){
  document.getElementById('concreteFields').classList.toggle('hidden',!hasService('Concrete Slab'));
  document.getElementById('paverFields').classList.toggle('hidden',!hasService('Pavers'));
}
function updateKitchenBathroomVisibility(){
  document.getElementById('kitchenFields').classList.toggle('hidden',!hasService('Outdoor Kitchen'));
  document.getElementById('bathroomFields').classList.toggle('hidden',!hasService('Outdoor Bathroom'));
}

function getData(){
  const fd=new FormData(form);
  const d=Object.fromEntries(fd.entries());
  d.services=serviceValues();
  d.scope=scopeCategories.map((r,i)=>({
    category:r[0],
    status:form.querySelector(`[name="scopeStatus_${i}"]`).value,
    detail:form.querySelector(`[name="scopeDetail_${i}"]`).value
  }));
  d.files=[...document.getElementById('fileInput').files].map(f=>f.name);
  d.screens=[];
  const count=Number(d.screenWallCount||0);
  for(let i=0;i<count;i++){
    const label=form.querySelector(`[name="screen_${i}_label"]`);
    if(label){
      d.screens.push({
        label:label.value,
        width:form.querySelector(`[name="screen_${i}_width"]`).value,
        height:form.querySelector(`[name="screen_${i}_height"]`).value,
        type:form.querySelector(`[name="screen_${i}_type"]`).value,
        sizeClass:form.querySelector(`[name="screen_${i}_jumbo"]`).value
      });
    }
  }
  return d;
}

function money(v){
  if(v===''||v==null)return'Not entered';
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));
}
function esc(s=''){
  return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function paymentCheck(d){
  const price=Number(d.contractPrice||0),dep=Number(d.deposit||0),bal=Number(d.balance||0);
  if(price && dep+bal!==price)return`Deposit plus balance is ${money(dep+bal)}, not ${money(price)}.`;
  return'';
}
function validationIssues(d){
  const issues=[];
  if(!d.clientName)issues.push('Homeowner legal name is missing.');
  if(!d.clientEmail)issues.push('Client email is missing.');
  if(!d.address||!d.city||!d.zip)issues.push('Project address is incomplete.');
  if(!d.services.length)issues.push('No service is selected.');
  if(!d.contractPrice)issues.push('Contract price is missing.');
  if(!d.permitResponsibility)issues.push('Permit responsibility is not selected.');
  if(!d.engineeringResponsibility)issues.push('Engineering responsibility is not selected.');
  if(!d.hoaResponsibility)issues.push('HOA responsibility is not selected.');
  if(d.scope.some(x=>x.status==='NOT DECIDED'))issues.push('One or more scope categories are still NOT DECIDED.');
  if(d.hasCoOwner==='Yes'&&(!d.coOwnerName||!d.coOwnerEmail))issues.push('Co-owner information is incomplete.');
  if((hasService('Regular Screens')||hasService('Motorized Screens'))&&d.screens.some(x=>Number(x.width)>16&&x.sizeClass==='Standard'))issues.push('A screen opening over 16 ft is still marked Standard.');
  const p=paymentCheck(d);if(p)issues.push(p);
  return issues;
}

function buildSummary(){
  const d=getData();
  const screenHtml=d.screens.length?d.screens.map(x=>`<p><b>${esc(x.label)}:</b> ${esc(x.width||'?')} ft × ${esc(x.height||'?')} ft · ${esc(x.type)} · ${esc(x.sizeClass)}</p>`).join(''):'<p>No screens selected.</p>';
  const scopeHtml=d.scope.map(x=>`<p><b>${esc(x.category)}:</b> ${esc(x.status)}${x.detail?` — ${esc(x.detail)}`:''}</p>`).join('');
  let serviceDetails='';
  if(hasService('Concrete Slab'))serviceDetails+=`<p><b>Concrete:</b> ${esc(d.concreteSf||'?')} sq ft · ${esc(d.concreteThickness||'')} · ${esc(d.concreteType||'')} · Preparation: ${esc(d.fieldPreparation||'')} · Attach to existing: ${esc(d.attachExistingSlab||'')}</p>`;
  if(hasService('Pavers'))serviceDetails+=`<p><b>Pavers:</b> ${esc(d.paverSf||'?')} sq ft · ${esc(d.paverType||'')} · ${esc(d.paverMatch||'')}</p>`;
  if(hasService('Electrical'))serviceDetails+=`<p><b>Electrical:</b> Fans ${esc(d.electricalFans||'0')} · Lights ${esc(d.electricalLights||'0')} · ${esc(d.switchSetup||'No switch details')} · ${esc(d.electricalOutlets||'No outlet details')}</p>`;
  if(hasService('Outdoor Kitchen'))serviceDetails+=`<p><b>Kitchen:</b> ${esc(d.kitchenLayout||'')} · Countertop: ${esc(d.countertop||'')} · Appliances: ${esc(d.appliances||'')}</p>`;
  if(hasService('Outdoor Bathroom'))serviceDetails+=`<p><b>Bathroom:</b> ${esc(d.bathroomSize||'')} · ${esc(d.bathroomFixtures||'')} · ${esc(d.wasteConnection||'')}</p>`;

  document.getElementById('summary').innerHTML=`
    <div class="summary-section"><h3>Client</h3>
      <p><b>${esc(d.clientName||'Not entered')}</b></p>
      <p>${esc(d.clientPhone||'No phone')} · ${esc(d.clientEmail||'No email')}</p>
      ${d.hasCoOwner==='Yes'?`<p>Co-owner: ${esc(d.coOwnerName||'Not entered')} · ${esc(d.coOwnerEmail||'No email')}</p>`:''}
    </div>
    <div class="summary-section"><h3>Property</h3>
      <p>${esc(d.address||'Not entered')}, ${esc(d.city||'')}, ${esc(d.state||'FL')} ${esc(d.zip||'')}</p>
      <p>Project ID: ${esc(d.projectId||'Not entered')} · Sales rep: ${esc(d.salesRep||'Not entered')}</p>
    </div>
    <div class="summary-section"><h3>Services</h3>
      <p><b>${esc(d.services.join(', ')||'None selected')}</b></p>
      <p>${esc(d.projectSummary||'No project summary')}</p>
      ${hasService('Aluminum Pergola')||hasService('Patio Cover')?`<p>${esc(d.width||'?')} × ${esc(d.depth||'?')} · ${esc(d.attachment||'')} · ${esc(d.frameColor||'')} · ${esc(d.roofSystem||'')}</p>`:''}
      ${serviceDetails}
    </div>
    <div class="summary-section"><h3>Screens</h3>${screenHtml}</div>
    <div class="summary-section"><h3>Approvals</h3>
      <p>Permit: ${esc(d.permitResponsibility||'Not selected')}</p>
      <p>Engineering: ${esc(d.engineeringResponsibility||'Not selected')}</p>
      <p>HOA: ${esc(d.hoaResponsibility||'Not selected')}</p>
      <p>Survey/property lines: ${esc(d.surveyResponsibility||'')}</p>
    </div>
    <div class="summary-section"><h3>Scope Table</h3>${scopeHtml}</div>
    <div class="summary-section"><h3>Financial</h3>
      <p>Contract price: <b>${money(d.contractPrice)}</b></p>
      <p>Deposit: ${money(d.deposit)} · Balance: ${money(d.balance)}</p>
      <p>${esc(d.paymentTerms||'No payment terms')}</p>
    </div>
    <div class="summary-section"><h3>Schedule & Attachments</h3>
      <p>Start: ${esc(d.estimatedStart||'Not entered')}</p>
      <p>Completion: ${esc(d.estimatedCompletion||'Not entered')}</p>
      <p>Attachments: ${esc(d.files.join(', ')||'None')}</p>
      <p>Clarifications: ${esc(d.clarifications||'None')}</p>
    </div>`;
  const issues=validationIssues(d),warning=document.getElementById('reviewWarning');
  warning.style.display='block';
  if(issues.length){
    warning.style.background='#fff3f0';warning.style.color='var(--red)';
    warning.innerHTML=`<b>Please review:</b><br>${issues.map(x=>`• ${esc(x)}`).join('<br>')}`;
  }else{
    warning.style.background='#edf7f2';warning.style.color='var(--green)';
    warning.innerHTML='Everything needed for the agreement is filled in. Continue to create it.';
  }
}

document.getElementById('fileInput').addEventListener('change',e=>{
  const files=[...e.target.files].map(f=>f.name);
  document.getElementById('fileList').textContent=files.length?files.join(', '):'No files selected.';
});

document.getElementById('downloadJson').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(getData(),null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='easy-pergola-contract-intake-v2.json';a.click();URL.revokeObjectURL(a.href);
});
document.getElementById('printSummary').addEventListener('click',()=>window.print());
document.getElementById('restartBtn').addEventListener('click',()=>{
  localStorage.removeItem('easyPergolaIntakeV2');
  localStorage.removeItem(CONTRACT_KEY);
  location.reload();
});

function saveForm(){
  try{
    const d=getData();
    localStorage.setItem('easyPergolaIntakeV2',JSON.stringify(d));
  }catch(e){}
}
function restoreForm(){
  try{
    const raw=localStorage.getItem('easyPergolaIntakeV2');if(!raw)return;
    const d=JSON.parse(raw);
    Object.entries(d).forEach(([k,v])=>{
      if(['services','scope','files','screens'].includes(k))return;
      const el=form.elements[k];
      if(!el)return;
      if(el.type==='checkbox')el.checked=!!v;else el.value=v??'';
    });
    (d.services||[]).forEach(v=>{
      const input=[...document.querySelectorAll('#serviceGrid input')].find(x=>x.value===v);
      if(input){input.checked=true;input.closest('.check-card').classList.add('selected')}
    });
    if(d.hasCoOwner==='Yes'){
      document.querySelectorAll('#coOwnerChoice .choice').forEach(x=>x.classList.toggle('selected',x.dataset.value==='Yes'));
      document.getElementById('coOwnerFields').classList.remove('hidden');
    }
    (d.scope||[]).forEach((x,i)=>{
      const s=form.querySelector(`[name="scopeStatus_${i}"]`),t=form.querySelector(`[name="scopeDetail_${i}"]`);
      if(s)s.value=x.status;if(t)t.value=x.detail;
    });
    if(d.surveyResponsibility){
      document.querySelectorAll('#surveyChoice .choice').forEach(x=>x.classList.toggle('selected',x.dataset.value===d.surveyResponsibility));
    }
    recalcActiveSteps();
    if((d.services||[]).some(x=>['Regular Screens','Motorized Screens'].includes(x))){
      setTimeout(()=>{
        buildScreenWalls();
        (d.screens||[]).forEach((x,i)=>{
          const set=(n,v)=>{const e=form.querySelector(`[name="screen_${i}_${n}"]`);if(e)e.value=v??''};
          set('label',x.label);set('width',x.width);set('height',x.height);set('type',x.type);set('jumbo',x.sizeClass);
        });
      },0);
    }
  }catch(e){}
}

form.addEventListener('input',saveForm);
form.addEventListener('change',saveForm);

restoreForm();
recalcActiveSteps();
showStep(0);

/* ============================================================
   Contract stages
   ============================================================ */

const CONTRACT_KEY = 'easyPergolaContract';
const CFG_KEY = 'easyPergolaConfig';
const $ = (id) => document.getElementById(id);

const cfg = Object.assign(
  { endpoint: '', token: '', myEmail: '', company: {} },
  (() => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null') || {}; } catch { return {}; } })()
);

/** The intake answers plus everything the agreement adds on top. */
let contract = normalize(Object.assign(
  {},
  (() => { try { return JSON.parse(localStorage.getItem(CONTRACT_KEY) || 'null') || {}; } catch { return {}; } })()
));

let pad = null;
let busy = false;

function saveContract() {
  try { localStorage.setItem(CONTRACT_KEY, JSON.stringify(contract)); } catch { /* quota */ }
}

function saveCfg() {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* quota */ }
}

/** Fold the current intake answers into the contract, keeping signatures. */
function syncContract() {
  const intake = getData();
  contract = normalize(Object.assign({}, contract, intake, {
    company: Object.assign({}, contract.company, cfg.company),
    contractNo: contract.contractNo || contractNumber('EP'),
  }));
  saveContract();
  return contract;
}

function startContract() {
  contract.contractNo = contract.contractNo || contractNumber('EP');
  syncContract();
}

/* ---------------- Step: the finished agreement ---------------- */

const ADJUST_FIELDS = [
  ['contractPrice', 'Contract price ($)', 'number'],
  ['deposit', 'Deposit ($)', 'number'],
  ['balance', 'Balance ($)', 'number'],
  ['estimatedStart', 'Estimated start', 'text'],
  ['estimatedCompletion', 'Estimated completion', 'text'],
  ['agreementDate', 'Agreement date', 'date'],
  ['clientName', 'Client name', 'text'],
  ['clientEmail', 'Client email', 'email'],
  ['clientPhone', 'Client phone', 'tel'],
  ['address', 'Property address', 'text'],
  ['city', 'City', 'text'],
  ['zip', 'ZIP', 'text'],
  ['companyRep', 'Company representative', 'text'],
];

const ADJUST_LONG = [
  ['projectSummary', 'Project summary'],
  ['paymentTerms', 'Payment terms'],
  ['clarifications', 'Additional exclusions / clarifications'],
];

function buildContractStep() {
  syncContract();

  $('adjustPanel').innerHTML = `
    <div class="grid-3">
      ${ADJUST_FIELDS.map(([k, label, type]) => `
        <div class="field">
          <label for="adj_${k}">${escape(label)}</label>
          <input id="adj_${k}" data-adj="${k}" type="${type}"
                 value="${escape(contract[k] == null ? '' : contract[k])}"
                 ${type === 'number' ? 'min="0" step="0.01"' : ''}>
        </div>`).join('')}
    </div>
    ${ADJUST_LONG.map(([k, label]) => `
      <div class="field" style="margin-top:14px">
        <label for="adj_${k}">${escape(label)}</label>
        <textarea id="adj_${k}" data-adj="${k}" style="min-height:80px">${escape(contract[k] || '')}</textarea>
      </div>`).join('')}
    <h2>Scope table</h2>
    <div class="scope-list">
      ${(contract.scope || []).map((s, i) => `
        <div class="scope-row">
          <div class="scope-name">${escape(s.category)}</div>
          <select data-scope-status="${i}">
            ${['INCLUDED', 'EXCLUDED', 'HOMEOWNER RESPONSIBILITY', 'CONTRACTOR RESPONSIBILITY',
               'BY OTHERS', 'ALLOWANCE', 'NOT APPLICABLE', 'NOT DECIDED']
              .map((o) => `<option${s.status === o ? ' selected' : ''}>${o}</option>`).join('')}
          </select>
          <input data-scope-detail="${i}" value="${escape(s.detail || '')}">
        </div>`).join('')}
    </div>`;

  $('adjustPanel').querySelectorAll('[data-adj]').forEach((el) => {
    el.addEventListener('input', () => {
      contract[el.dataset.adj] = el.value;
      const mirror = form.elements[el.dataset.adj];
      if (mirror) mirror.value = el.value;
      contract = normalize(contract);
      saveContract();
      paintContract();
    });
  });

  $('adjustPanel').querySelectorAll('[data-scope-status]').forEach((el) => {
    el.addEventListener('change', () => {
      contract.scope[Number(el.dataset.scopeStatus)].status = el.value;
      const live = form.querySelector(`[name="scopeStatus_${el.dataset.scopeStatus}"]`);
      if (live) live.value = el.value;
      saveContract();
      paintContract();
    });
  });

  $('adjustPanel').querySelectorAll('[data-scope-detail]').forEach((el) => {
    el.addEventListener('input', () => {
      contract.scope[Number(el.dataset.scopeDetail)].detail = el.value;
      const live = form.querySelector(`[name="scopeDetail_${el.dataset.scopeDetail}"]`);
      if (live) live.value = el.value;
      saveContract();
      paintContract();
    });
  });

  paintContract();
}

function paintContract() {
  $('contractBox').innerHTML = renderContract(contract);
  const warn = $('contractWarning');
  const msg = tplPaymentCheck(contract);
  warn.style.display = msg ? 'block' : 'none';
  warn.textContent = msg;
}

/* ---------------- Step: contractor countersignature ---------------- */

function buildSignStep() {
  syncContract();
  if (!pad) {
    pad = createSignaturePad($('epPad'), { color: '#202020' });
    $('epClear').addEventListener('click', () => pad.clear());
  }
  $('signerName').value = contract.contractorName || contract.companyRep
    || cfg.company.legal || 'Easy Pergola LLC';
}

/** Returns false (and explains why) when the signature step is incomplete. */
function captureSignature() {
  const warn = $('signWarning');
  const name = $('signerName').value.trim();
  if (name.length < 2) {
    warn.style.display = 'block';
    warn.textContent = 'Enter the name of the person signing.';
    return false;
  }
  if (!pad || !pad.hasInk) {
    warn.style.display = 'block';
    warn.textContent = 'Draw your signature above.';
    return false;
  }
  warn.style.display = 'none';
  contract.contractorSignature = pad.toDataURL();
  contract.contractorName = name;
  contract.contractorSignedAt = new Date().toISOString().slice(0, 10);
  saveContract();
  return true;
}

/* ---------------- Step: send to the client ---------------- */

function buildSendStep() {
  syncContract();
  const co = contract.hasCoOwner === 'Yes' && contract.coOwnerName
    ? ` Then ${escape(contract.coOwnerName)} signs as co-owner.` : '';
  $('sendSummary').innerHTML = `<b>${escape(contract.clientName)}</b> &middot;
    ${escape(contract.clientEmail)}<br>
    ${escape((contract.services || []).join(', ') || 'No services listed')} &middot;
    <b>${fmtMoney(contract.contractPrice)}</b> &middot;
    ${contract.contractorSignature ? 'signed by you' : 'not signed by you'}.${co}`;
  $('sendPreview').innerHTML = renderContract(contract);
}

/* ---------------- Delivery ---------------- */

function configured() { return !!(cfg.endpoint && cfg.token); }

async function post(path, body) {
  const res = await fetch(`${cfg.endpoint.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) throw new Error(out.error || `Error ${res.status}`);
  return out;
}

async function withBusy(btn, label, fn) {
  if (busy) return;
  busy = true;
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span>${label}`;
  try {
    await fn();
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = original;
    alert(`That didn't go through: ${err.message}`);
  } finally {
    busy = false;
  }
}

function finish(title, text, link) {
  $('doneTitle').textContent = title;
  $('doneText').innerHTML = escape(text)
    + (link ? `<br><br><a href="${escape(link)}" target="_blank" rel="noopener">Open the signing link</a>` : '');
  showStep(activeSteps.length - 1);
}

$('sendMeBtn').addEventListener('click', () => {
  syncContract();
  const to = cfg.myEmail || cfg.company.email;
  if (!to) { openSettings(); return; }
  if (!configured()) {
    window.print();
    window.location.href = `mailto:${encodeURIComponent(to)}`
      + `?subject=${encodeURIComponent(`Agreement ${contract.contractNo} — ${contract.clientName}`)}`
      + `&body=${encodeURIComponent(`Agreement ${contract.contractNo}\n${contract.clientName} — `
        + `${contract.address}, ${contract.city}\n${fmtMoney(contract.contractPrice)}\n\n`
        + `Save the PDF and attach it.`)}`;
    return;
  }
  withBusy($('sendMeBtn'), 'Sending…', async () => {
    await post('/api/send-contract', { contract, recipient: 'me' });
    $('sendMeBtn').innerHTML = 'Sent to you';
  });
});

$('sendClientBtn').addEventListener('click', () => {
  syncContract();
  if (!configured()) {
    window.print();
    window.location.href = `mailto:${encodeURIComponent(contract.clientEmail)}`
      + `?subject=${encodeURIComponent(`Your Easy Pergola Agreement — ${contract.contractNo}`)}`
      + `&body=${encodeURIComponent(`Hi ${(contract.clientName || '').split(' ')[0]},\n\n`
        + `Your agreement (${contract.contractNo}) for ${contract.address} is attached.\n`
        + `Total: ${fmtMoney(contract.contractPrice)}\n\nPlease review, sign, and send it back.\n\n`
        + `${cfg.company.name || 'Easy Pergola'}`)}`;
    finish('Prepared for the client',
      'Save the PDF and attach it to the email that just opened. Set up one-click sending under Company settings to skip this step.');
    return;
  }
  withBusy($('sendClientBtn'), 'Sending…', async () => {
    const out = await post('/api/send-contract', { contract, recipient: 'client' });
    finish('Agreement sent',
      `${contract.clientName} received agreement ${contract.contractNo} at ${contract.clientEmail} with a link to sign it.`
      + (contract.hasCoOwner === 'Yes' ? ` ${contract.coOwnerName || 'The co-owner'} is asked to sign right after.` : '')
      + ' The executed copy lands in your inbox as soon as it is signed.',
      out.signUrl);
  });
});

$('downloadBtn').addEventListener('click', () => { syncContract(); window.print(); });

$('copyBtn').addEventListener('click', async () => {
  syncContract();
  const html = renderContract(contract);
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([$('contractBox').innerText], { type: 'text/plain' }),
    })]);
    $('copyBtn').textContent = 'Copied';
    setTimeout(() => { $('copyBtn').textContent = 'Copy for email'; }, 2500);
  } catch {
    await navigator.clipboard.writeText($('contractBox').innerText).catch(() => {});
    $('copyBtn').textContent = 'Copied as text';
  }
});

/* ---------------- Settings ---------------- */

const SET_FIELDS = {
  setName: 'name', setLegal: 'legal', setLicense: 'license', setPhone: 'phone',
  setEmail: 'email', setAddress: 'address', setCity: 'city', setZip: 'zip',
};

function openSettings() {
  const base = normalize({}).company;
  $('setMyEmail').value = cfg.myEmail || '';
  $('setEndpoint').value = cfg.endpoint || '';
  $('setToken').value = cfg.token || '';
  Object.entries(SET_FIELDS).forEach(([id, key]) => {
    $(id).value = (cfg.company && cfg.company[key]) || base[key] || '';
  });
  $('settings').hidden = false;
}

$('gearBtn').addEventListener('click', openSettings);
$('setCancel').addEventListener('click', () => { $('settings').hidden = true; });
$('settings').addEventListener('click', (e) => {
  if (e.target === $('settings')) $('settings').hidden = true;
});
$('setSave').addEventListener('click', () => {
  cfg.myEmail = $('setMyEmail').value.trim();
  cfg.endpoint = $('setEndpoint').value.trim().replace(/\/$/, '');
  cfg.token = $('setToken').value.trim();
  cfg.company = cfg.company || {};
  Object.entries(SET_FIELDS).forEach(([id, key]) => { cfg.company[key] = $(id).value.trim(); });
  saveCfg();
  $('settings').hidden = true;
  contract = normalize(Object.assign(contract, { company: Object.assign({}, contract.company, cfg.company) }));
  saveContract();
  const id = activeSteps[currentIndex] && activeSteps[currentIndex].dataset.id;
  if (id === 'contract') paintContract();
  if (id === 'send') buildSendStep();
});
