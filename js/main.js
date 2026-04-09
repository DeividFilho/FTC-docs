// js/main.js
import { db, ROBO_ATIVO, collection, addDoc, setDoc, onSnapshot, deleteDoc, doc, query, orderBy, limit, getDocs } from './firebase.js';
import { initAuth } from './auth.js';

// Variáveis Globais
export let versaoAtiva = "v1.0 - Base Build";
let engLogsData = [];
let blueprintsData = []; 
let matchesData = []; 
let chartsInstances = {}; 
let tagsProblemas = ['Partida Limpa'];
let robotVersionsArray = [];
let formEngOpen = false;
let isViewingGlobalHistory = false;
let dbInitialized = false; 

// Variáveis de Inscrição do Firebase
let unsubscribePartidas = null;
let unsubscribeEngenharia = null;
let unsubscribeVersoes = null;

// --- FUNÇÕES UTILITÁRIAS ---
export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = 'check-circle';
  if (type === 'error') icon = 'exclamation-circle';
  else if (type === 'warning') icon = 'exclamation-triangle';
  toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// --- INICIA A AUTENTICAÇÃO E LIGA COM O BANCO ---
initAuth(
  (user) => {
    if(!dbInitialized) {
      initDatabaseListeners();
      dbInitialized = true;
      showToast(`Sessão iniciada como ${user.email.split('@')[0]}`, 'success');
    }
  },
  () => {
    if(dbInitialized) {
      stopDatabaseListeners();
      dbInitialized = false;
    }
  },
  showToast
);

// --- TEMA E NAVEGAÇÃO ---
document.getElementById('themeToggle').addEventListener('click', () => {
  document.documentElement.classList.toggle('dark-theme');
  document.body.classList.toggle('dark-theme');
  localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
  if(document.getElementById('sec-charts').classList.contains('active')) refreshCharts(); 
});

const switchTab = (tabId) => {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tabs .nav-tab').forEach(t => t.classList.remove('active'));
  
  const activeSection = document.getElementById('sec-' + tabId);
  if(activeSection) activeSection.classList.add('active');
  
  const activeTabBtn = document.querySelector(`.nav-tab[data-target-tab="${tabId}"]`);
  if(activeTabBtn) activeTabBtn.classList.add('active');

  document.getElementById('btnSaveMatch').style.display = 'none';
  document.getElementById('btnSaveBlueprint').style.display = 'none';

  if(tabId === 'match') {
      document.getElementById('btnSaveMatch').style.display = 'flex';
  } else if (tabId === 'robot') {
      document.getElementById('btnSaveBlueprint').style.display = 'flex';
      loadBlueprintOptions(); // Carrega as opções automaticamente
  } else if (tabId === 'charts') {
      setTimeout(refreshCharts, 100); 
  } else if (tabId === 'compare') {
      renderCompare();
  }
};

document.querySelectorAll('.nav-tab[data-target-tab]').forEach(btn => {
  btn.addEventListener('click', (e) => switchTab(e.currentTarget.getAttribute('data-target-tab')));
});

const updateMatchDropdown = () => {
  const select = document.getElementById('matchMec');
  if(select) {
    select.innerHTML = `<option value="${versaoAtiva}">${versaoAtiva}</option>`;
    select.value = versaoAtiva;
  }
};

const updateCompareDropdowns = () => {
  const compA = document.getElementById('compA');
  const compB = document.getElementById('compB');
  if(!compA || !compB) return;
  const valA = compA.value;
  const valB = compB.value;

  let options = '<option value="">Selecione uma Versão...</option>';
  blueprintsData.forEach(bp => { options += `<option value="${bp.id}">${bp.id}</option>`; });

  compA.innerHTML = options; compB.innerHTML = options;
  if(valA) compA.value = valA;
  if(valB) compB.value = valB;
};

// --- CONTROLE DE BANCO DE DADOS ---
export function stopDatabaseListeners() {
    if(unsubscribeVersoes) unsubscribeVersoes();
    if(unsubscribePartidas) unsubscribePartidas();
    if(unsubscribeEngenharia) unsubscribeEngenharia();
}

export function initDatabaseListeners() {
  unsubscribeVersoes = onSnapshot(collection(db, "robos", ROBO_ATIVO, "versoes"), (snapshot) => {
    const select = document.getElementById('globalVersionSelect');
    const currentVal = select.value;
    
    select.innerHTML = ''; 
    blueprintsData = [];
    robotVersionsArray = [];

    if (snapshot.empty) {
      const opt = document.createElement('option');
      opt.value = "v1.0 - Base Build"; opt.text = "v1.0 - Base Build";
      select.appendChild(opt);
      robotVersionsArray.push("v1.0 - Base Build");
    } else {
      snapshot.forEach((docItem) => {
        const data = docItem.data();
        blueprintsData.push({ id: docItem.id, ...data });
        robotVersionsArray.push(docItem.id);
        
        const option = document.createElement('option');
        option.value = docItem.id;
        option.text = docItem.id;
        select.appendChild(option);
      });
    }

    if(robotVersionsArray.includes(currentVal)) { select.value = currentVal; } 
    else if (select.options.length > 0) { select.value = select.options[0].value; }
    
    versaoAtiva = select.value;
    updateMatchDropdown();
    updateCompareDropdowns();
    iniciarEscutasDaVersao(); 
  });
}

document.getElementById('globalVersionSelect').addEventListener('change', (e) => {
    versaoAtiva = e.target.value;
    showToast(`Contexto alterado: visualizando ${versaoAtiva}`, 'success');
    updateMatchDropdown();
    iniciarEscutasDaVersao();
});

function iniciarEscutasDaVersao() {
  if(unsubscribePartidas) unsubscribePartidas();
  if(unsubscribeEngenharia) unsubscribeEngenharia();

  const pathPartidas = collection(db, "robos", ROBO_ATIVO, "versoes", versaoAtiva, "partidas");
  unsubscribePartidas = onSnapshot(query(pathPartidas, orderBy("timestamp", "desc"), limit(50)), (snap) => {
    matchesData = [];
    snap.forEach(docItem => matchesData.push({ docId: docItem.id, ...docItem.data() }));
    renderMatchesTable();
    if(document.getElementById('sec-charts').classList.contains('active')) refreshCharts();
  });

  const pathEng = collection(db, "robos", ROBO_ATIVO, "versoes", versaoAtiva, "engenharia");
  unsubscribeEngenharia = onSnapshot(query(pathEng, orderBy("timestamp", "desc")), (snap) => {
    engLogsData = [];
    snap.forEach(docItem => engLogsData.push({ docId: docItem.id, ...docItem.data() }));
    
    updateSubsystemsBadges(); 
    if(!isViewingGlobalHistory) { renderFilteredEngFeed(engLogsData, false); }
  });
}

// --- LÓGICA DE PARTIDA (MATCH TRACKER) ---
const calcMatchScore = () => {
  const getM = id => parseInt(document.getElementById(id).value) || 0;
  const auto = getM('autoLeave') + (getM('autoClass') * 3) + (getM('autoOver') * 1) + (getM('autoPat') * 2);
  const tele = (getM('teleClass') * 3) + (getM('teleOver') * 1) + (getM('teleDepot') * 1) + (getM('telePat') * 2) + getM('teleBase') + getM('teleDouble');
  const fouls = (getM('foulMinor') * 10) + (getM('foulMajor') * 30);
  const total = auto + tele;

  document.getElementById('hudTotal').innerText = total;
  document.getElementById('hudAuto').innerText = auto;
  document.getElementById('hudTele').innerText = tele;
  document.getElementById('hudFouls').innerText = "-" + fouls;
  
  const max = parseInt(document.getElementById('pontEsperada').value) || 100;
  const efic = max > 0 ? Math.round((total/max)*100) : 0;
  const elEfic = document.getElementById('hudEfic');
  elEfic.innerText = efic + '%';
  
  if(efic >= 100) elEfic.style.color = 'var(--orange)';
  else if(efic >= 50) elEfic.style.color = 'var(--text-main)';
  else elEfic.style.color = 'var(--text-muted)';
};

document.getElementById('pontEsperada').addEventListener('input', calcMatchScore);

document.querySelectorAll('.counter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    const delta = parseInt(btn.getAttribute('data-delta'));
    const input = document.getElementById(targetId);
    const display = document.getElementById('val-' + targetId);
    let val = parseInt(input.value) || 0; 
    val += delta; if(val < 0) val = 0; 
    input.value = val; display.innerText = val; 
    calcMatchScore();
  });
});

document.querySelectorAll('.seg-option').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const group = btn.parentElement;
    const targetId = btn.getAttribute('data-target');
    const val = btn.getAttribute('data-val');
    const isOrange = btn.getAttribute('data-orange') === 'true';

    document.getElementById(targetId).value = val; 
    group.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active', 'active-orange')); 
    if (isOrange && val > 0) btn.classList.add('active-orange'); else btn.classList.add('active'); 
    calcMatchScore();
  });
});

document.querySelectorAll('.tag-problem').forEach(btn => {
  btn.addEventListener('click', () => {
    const container = btn.parentElement;
    const isExclusive = btn.getAttribute('data-exclusive') === 'true';
    if(isExclusive) { 
      container.querySelectorAll('.tag').forEach(b => b.classList.remove('active', 'active-orange')); 
      btn.classList.add('active-orange'); tagsProblemas = [btn.innerText]; 
      return; 
    }
    const btnLimpa = container.querySelector('.active-orange');
    if(btnLimpa) { btnLimpa.classList.remove('active-orange'); tagsProblemas = []; }
    btn.classList.toggle('active'); const val = btn.innerText;
    if(btn.classList.contains('active')) { tagsProblemas.push(val); } 
    else { const idx = tagsProblemas.indexOf(val); if(idx > -1) tagsProblemas.splice(idx, 1); }
  });
});

document.getElementById('btnSaveMatch').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return; 
  if(!versaoAtiva) { showToast('Sem versão ativa configurada!', 'error'); return; }

  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A sincronizar...'; btn.classList.add('loading');

  const details = {
    autoLeave: parseInt(document.getElementById('autoLeave').value) || 0,
    autoClass: parseInt(document.getElementById('autoClass').value) || 0,
    autoOver: parseInt(document.getElementById('autoOver').value) || 0,
    autoPat: parseInt(document.getElementById('autoPat').value) || 0,
    teleClass: parseInt(document.getElementById('teleClass').value) || 0,
    teleOver: parseInt(document.getElementById('teleOver').value) || 0,
    teleDepot: parseInt(document.getElementById('teleDepot').value) || 0,
    telePat: parseInt(document.getElementById('telePat').value) || 0,
    teleBase: parseInt(document.getElementById('teleBase').value) || 0,
    teleDouble: parseInt(document.getElementById('teleDouble').value) || 0,
    foulMinor: parseInt(document.getElementById('foulMinor').value) || 0,
    foulMajor: parseInt(document.getElementById('foulMajor').value) || 0
  };

  const matchData = {
    pilotos: document.getElementById('pilotos').value,
    target: Number(document.getElementById('pontEsperada').value),
    auto: Number(document.getElementById('hudAuto').innerText), tele: Number(document.getElementById('hudTele').innerText), 
    total: Number(document.getElementById('hudTotal').innerText),
    fouls: (details.foulMinor * 10) + (details.foulMajor * 30),
    eficiencia: document.getElementById('hudEfic').innerText, 
    problemas: tagsProblemas.length > 0 ? tagsProblemas.join(', ') : 'Limpa', 
    timestamp: new Date(), details: details
  };

  try {
    const pathPartidas = collection(db, "robos", ROBO_ATIVO, "versoes", versaoAtiva, "partidas");
    await addDoc(pathPartidas, matchData);
    
    btn.innerHTML = '<i class="fas fa-check"></i> Gravado!'; btn.classList.remove('loading'); btn.classList.add('success');
    showToast('Partida gravada na ' + versaoAtiva, 'success');
    
    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizar Partida'; btn.classList.remove('success');
      ['autoClass','autoOver','autoPat','teleClass','teleOver','teleDepot','telePat','foulMinor','foulMajor'].forEach(id => { 
        document.getElementById(id).value = '0'; document.getElementById('val-'+id).innerText = '0'; 
      });
      ['autoLeave','teleBase','teleDouble'].forEach(id => { 
        const p = document.getElementById('sg-'+id); 
        p.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active', 'active-orange')); 
        p.querySelector('.seg-btn').classList.add('active'); document.getElementById(id).value = '0'; 
      });
      tagsProblemas = ['Partida Limpa']; 
      document.querySelectorAll('#grp-problemas .tag').forEach(b => b.classList.remove('active', 'active-orange')); 
      document.querySelector('#grp-problemas .tag[data-exclusive="true"]').classList.add('active-orange');
      calcMatchScore(); window.scrollTo(0,0); btn.disabled = false;
    }, 1500);
  } catch (err) { console.error(err); showToast('Erro ao gravar na Nuvem.', 'error'); btn.innerHTML = '<i class="fas fa-times"></i> Erro'; btn.classList.remove('loading'); btn.disabled = false; }
});

window.deleteMatch = async (docId) => {
  if(!confirm("Excluir esta partida permanentemente?")) return;
  try {
    await deleteDoc(doc(db, "robos", ROBO_ATIVO, "versoes", versaoAtiva, "partidas", docId));
    showToast('Partida excluída.', 'success');
  } catch(e) { console.error(e); showToast('Erro ao excluir.', 'error'); }
};

// --- LÓGICA DEVOPS (ENGENHARIA) ---
window.openEngForm = (sysId) => {
    document.getElementById('engSys').value = sysId;
    document.getElementById('formEngenharia').style.display = 'block';
    formEngOpen = true;
    document.getElementById('formEngenharia').scrollIntoView({behavior: 'smooth', block: 'start'});
};

document.getElementById('btnCloseEngForm').addEventListener('click', () => {
    document.getElementById('formEngenharia').style.display = 'none';
    formEngOpen = false;
});

window.updateSubsystemsBadges = async () => {
    let latest = { 'DRV': 'v?', 'SEN': 'v?', 'MEC_INT': 'v?', 'MEC_ELE': 'v?', 'SW': 'v?', 'STR': 'v?' };
    let latestTime = { 'DRV': 0, 'SEN': 0, 'MEC_INT': 0, 'MEC_ELE': 0, 'SW': 0, 'STR': 0 };
    try {
        for (let v of robotVersionsArray) {
            const snap = await getDocs(collection(db, "robos", ROBO_ATIVO, "versoes", v, "engenharia"));
            snap.forEach(d => {
                let data = d.data(); let sys = data.sys;
                if (sys && latestTime[sys] !== undefined) {
                    let ts = data.timestamp ? data.timestamp.toMillis() : 0;
                    if (ts > latestTime[sys]) { latestTime[sys] = ts; latest[sys] = data.versao || 'v?'; }
                }
            });
        }
        for (let sys in latest) {
            const badge = document.getElementById('badge-' + sys);
            if (badge) {
                badge.innerText = latest[sys] !== 'v?' ? latest[sys] : 'Sem dados';
                if (latest[sys] !== 'v?') { badge.style.background = 'var(--orange)'; badge.style.color = '#000'; } 
                else { badge.style.background = 'var(--text-muted)'; badge.style.color = '#fff'; }
            }
        }
    } catch (error) { console.error("Erro badges:", error); }
};

window.viewSubsystemHistory = async (sysId) => {
    isViewingGlobalHistory = true;
    document.getElementById('feedTitle').innerHTML = `<i class="fas fa-history"></i> Histórico Global: ${sysId}`;
    document.getElementById('btnResetFeed').style.display = 'flex';
    document.getElementById('engFeed').innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x" style="color: var(--orange);"></i><p style="margin-top:10px; color:var(--text-muted)">Buscando em todo o banco...</p></div>';
    document.getElementById('feedPanel').scrollIntoView({behavior: 'smooth', block: 'start'});

    let globalLogs = [];
    try {
        for (let v of robotVersionsArray) {
            const snap = await getDocs(collection(db, "robos", ROBO_ATIVO, "versoes", v, "engenharia"));
            snap.forEach(d => {
                let data = d.data();
                if (data.sys === sysId) { globalLogs.push({docId: d.id, versaoOrigem: v, ...data}); }
            });
        }
        globalLogs.sort((a,b) => b.timestamp - a.timestamp);
        renderFilteredEngFeed(globalLogs, true); 
    } catch(e) { console.error(e); document.getElementById('engFeed').innerHTML = '<p style="text-align:center; color:var(--brand-red);">Erro ao carregar histórico global.</p>'; }
};

document.getElementById('btnResetFeed').addEventListener('click', () => {
    isViewingGlobalHistory = false;
    document.getElementById('feedTitle').innerHTML = `<i class="fas fa-list"></i> Histórico Recente (${versaoAtiva})`;
    document.getElementById('btnResetFeed').style.display = 'none';
    renderFilteredEngFeed(engLogsData, false);
});

const calcDelta = () => {
  const oldV = parseFloat(document.getElementById('kpiOld').value) || 0; 
  const newV = parseFloat(document.getElementById('kpiNew').value) || 0; 
  const deltaInput = document.getElementById('kpiDelta');
  if (oldV === 0 && newV === 0) { deltaInput.value = ''; deltaInput.className = 'tele-val'; return; }
  const delta = (newV - oldV).toFixed(2); 
  deltaInput.value = delta > 0 ? `+${delta}` : delta;
  if (delta >= 0) { deltaInput.className = 'tele-val delta-pos'; } else { deltaInput.className = 'tele-val delta-neg'; }
};
document.querySelectorAll('.kpi-input').forEach(input => input.addEventListener('input', calcDelta));

document.getElementById('btnSaveEng').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  
  const sys = document.getElementById('engSys').value; const ver = document.getElementById('engVer').value.trim(); const title = document.getElementById('engTitulo').value.trim();
  if(!ver || !title) { showToast('Versão da Peça e Título são obrigatórios!', 'error'); return; }

  btn.disabled = true; const originalText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO...';

  const entry = {
    ticket: `${sys}-${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`,
    sys: sys, versao: ver, titulo: title, kpiNome: document.getElementById('kpiName').value || 'KPI', 
    kpiOld: document.getElementById('kpiOld').value, kpiNew: document.getElementById('kpiNew').value, kpiDelta: document.getElementById('kpiDelta').value, 
    hipotese: document.getElementById('engHyp').value.trim(), tradeoff: document.getElementById('engTrade').value.trim(), 
    rca: document.getElementById('engRca').value.trim(), link: document.getElementById('engLink').value.trim(), 
    custo: document.getElementById('engCost').value, timestamp: new Date(), dataStr: new Date().toLocaleDateString('pt-BR')
  };

  try {
    const pathEng = collection(db, "robos", ROBO_ATIVO, "versoes", versaoAtiva, "engenharia");
    await addDoc(pathEng, entry);
    showToast('Commit registado em ' + versaoAtiva, 'success');
    ['engVer','engTitulo','kpiOld','kpiNew','kpiDelta','engHyp','engTrade','engRca','engLink','engCost'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('kpiDelta').className = 'tele-val'; document.getElementById('formEngenharia').style.display = 'none'; formEngOpen = false;
    if(isViewingGlobalHistory && document.getElementById('feedTitle').innerText.includes(sys)) { viewSubsystemHistory(sys); }
  } catch (err) { console.error(err); showToast('Erro ao gravar.', 'error'); } finally { btn.disabled = false; btn.innerHTML = originalText; }
});

const deleteEng = async (docId, versaoDoc) => {
  if(!confirm("Deletar este ticket permanentemente?")) return;
  try { 
    await deleteDoc(doc(db, "robos", ROBO_ATIVO, "versoes", versaoDoc, "engenharia", docId)); showToast('Ticket removido.', 'success'); 
    if (isViewingGlobalHistory) { const currentSysName = document.getElementById('feedTitle').innerText.split(': ')[1]; if (currentSysName) viewSubsystemHistory(currentSysName); }
  } catch (e) { console.error(e); }
};

document.getElementById('engFeed').addEventListener('click', (e) => {
  const btn = e.target.closest('.delete-eng-btn');
  if(btn) deleteEng(btn.getAttribute('data-id'), btn.getAttribute('data-origem'));
});

function renderFilteredEngFeed(logsArray, isGlobal) {
  const feed = document.getElementById('engFeed');
  if (logsArray.length === 0) {
    feed.innerHTML = `<div class="panel" style="text-align: center; padding: 60px 20px; background: transparent; border: 2px dashed var(--border-light); box-shadow: none;"><i class="fas fa-folder-open" style="font-size: 40px; margin-bottom: 16px; color: var(--border-focus);"></i><p style="color: var(--text-muted); font-size: 14px;">Nenhum commit encontrado para esta visualização.</p></div>`; return;
  }
  let html = '';
  logsArray.forEach((e) => {
    const vOrigem = isGlobal ? e.versaoOrigem : versaoAtiva; const safeTicket = e.ticket || 'SYS-000'; const safeDataStr = e.dataStr || 'Data Desconhecida';
    html += `<div class="ticket-entry" style="border-left-color: var(--orange)">
      <div class="ticket-header">
        <div>
          <span class="ticket-id"><i class="fas fa-ticket-alt"></i> ${safeTicket}</span>
          ${isGlobal ? `<span class="badge-decode" style="margin-left:10px; background:var(--text-muted); color:#fff; font-size:10px;"><i class="fas fa-globe"></i> ${vOrigem}</span>` : ''}
          <span style="font-family: 'JetBrains Mono'; font-weight:700; font-size:12px; margin-left: 10px; color: var(--orange);">${e.versao || 'v?'}</span>
          <h3 class="ticket-title">${e.titulo || 'Sem Título'}</h3>
          <div class="ticket-meta"><i class="far fa-clock"></i> ${safeDataStr} ${e.custo ? `| <i class="fas fa-coins" style="margin-left:8px;"></i> R$ ${e.custo}` : ''}</div>
        </div>
        <button class="delete-eng-btn" data-id="${e.docId}" data-origem="${vOrigem}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size: 16px; transition: color 0.2s;"><i class="fas fa-trash"></i></button>
      </div>
      ${e.kpiOld || e.kpiNew ? `<div style="display:flex; gap:16px; margin-bottom:16px; overflow-x: auto; padding-bottom: 5px;">
        <div style="background:var(--bg-input); padding:8px 16px; border-radius:var(--radius-sm); border:1px solid var(--border-light); flex:1; min-width: 120px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">${e.kpiNome || 'KPI'} (Antes)</span><span style="font-family:'JetBrains Mono'; font-weight:700; font-size:16px;">${e.kpiOld || '0'}</span>
        </div>
        <div style="background:var(--bg-input); padding:8px 16px; border-radius:var(--radius-sm); border:1px solid var(--border-light); flex:1; min-width: 120px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">${e.kpiNome || 'KPI'} (Depois)</span><span style="font-family:'JetBrains Mono'; font-weight:700; font-size:16px;">${e.kpiNew || '0'}</span>
        </div>
        <div style="background:var(--bg-input); padding:8px 16px; border-radius:var(--radius-sm); border:1px solid var(--border-light); flex:1; min-width: 120px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Evolução (Δ)</span><span style="font-family:'JetBrains Mono'; font-weight:700; font-size:16px;" class="${parseFloat(e.kpiDelta) >= 0 ? 'delta-pos' : 'delta-neg'}">${e.kpiDelta || '0'}</span>
        </div>
      </div>` : ''}
      <div class="data-grid">
        ${e.hipotese ? `<div class="data-block full"><h4><i class="fas fa-flask"></i> Hipótese / Problema</h4><p>${e.hipotese}</p></div>` : ''}
        ${e.tradeoff ? `<div class="data-block"><h4><i class="fas fa-balance-scale"></i> Solução / Trade-off</h4><p>${e.tradeoff}</p></div>` : ''}
        ${e.rca ? `<div class="data-block"><h4><i class="fas fa-search-plus"></i> RCA / Resultados</h4><p>${e.rca}</p></div>` : ''}
        ${e.link ? `<div class="data-block full" style="padding: 12px 16px;"><a href="${e.link}" target="_blank" style="color:var(--brand-blue); text-decoration:none; font-size:13px; font-weight:600; display:flex; align-items:center; gap:8px;"><i class="fas fa-external-link-alt"></i> Acessar Repositório / Dados Externos</a></div>` : ''}
      </div>
    </div>`;
  });
  feed.innerHTML = html;
}

// --- LÓGICA DE BLUEPRINT INTELIGENTE (AUTO-PREENCHIMENTO) ---
const calcTotalCost = () => {
  const drv = parseFloat(document.getElementById('bp-drv-cost').value) || 0;
  const sen = parseFloat(document.getElementById('bp-sen-cost').value) || 0;
  const mec1 = parseFloat(document.getElementById('bp-mec1-cost').value) || 0;
  const mec2 = parseFloat(document.getElementById('bp-mec2-cost').value) || 0;
  document.getElementById('bomTotal').innerText = (drv + sen + mec1 + mec2).toFixed(2);
};

['bp-drv', 'bp-sen', 'bp-mec1', 'bp-mec2', 'bp-sw'].forEach(id => {
  const el = document.getElementById(id);
  if(el) {
    el.addEventListener('change', (e) => {
      const selectedOpt = e.target.options[e.target.selectedIndex];
      const costInput = document.getElementById(id + '-cost');
      if(selectedOpt && costInput) { costInput.value = selectedOpt.dataset.cost || ''; calcTotalCost(); }
    });
  }
});

document.querySelectorAll('.bp-cost-input').forEach(input => input.addEventListener('input', calcTotalCost));
document.getElementById('btnSize').addEventListener('click', function() { this.classList.toggle('active-orange'); });

document.getElementById('btnSaveBlueprint').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;

  const nome = document.getElementById('robotName').value.trim();
  const ver = document.getElementById('robotVersion').value.trim();
  if(!nome || !ver) { showToast('Preencha o Nome e a Versão do Robô!', 'error'); return; }
  
  const global = `${nome} - ${ver}`;
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A gravar na árvore...'; btn.classList.add('loading');

  const blueprintData = {
    drv: document.getElementById('bp-drv').value, sen: document.getElementById('bp-sen').value,
    mec1: document.getElementById('bp-mec1').value, mec2: document.getElementById('bp-mec2').value,
    sw: document.getElementById('bp-sw').value, peso: document.getElementById('robotWeight').value,
    sizingAprovado: document.getElementById('btnSize').classList.contains('active-orange'),
    custoTotal: document.getElementById('bomTotal').innerText, timestamp: new Date()
  };

  try {
    await setDoc(doc(db, "robos", ROBO_ATIVO, "versoes", global), blueprintData); 
    showToast('Nova versão criada e ativada!', 'success');
    btn.innerHTML = '<i class="fas fa-check"></i> Criado!'; btn.classList.remove('loading'); btn.classList.add('success');
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-save"></i> Gravar Nova Versão'; btn.classList.remove('success'); btn.disabled = false; }, 1500);
  } catch (err) { console.error(err); showToast('Erro ao criar Versão.', 'error'); btn.innerHTML = '<i class="fas fa-times"></i> Erro'; btn.classList.remove('loading'); btn.disabled = false; }
});

async function loadBlueprintOptions() {
  try {
    let globalLogs = [];
    for (let v of robotVersionsArray) {
        const snap = await getDocs(collection(db, "robos", ROBO_ATIVO, "versoes", v, "engenharia"));
        snap.forEach(d => globalLogs.push({...d.data()}));
    }
    globalLogs.sort((a,b) => b.timestamp - a.timestamp);

    const mapSys = { 'DRV': 'bp-drv', 'SEN': 'bp-sen', 'MEC_INT': 'bp-mec1', 'MEC_ELE': 'bp-mec2', 'SW': 'bp-sw' };
    let sysData = { 'DRV': [], 'SEN': [], 'MEC_INT': [], 'MEC_ELE': [], 'SW': [] };
    
    for (let log of globalLogs) {
      let sys = log.ticket ? log.ticket.split('-')[0] : (log.sys || '');
      if (sys === 'MEC') sys = 'MEC_INT'; 
      if (sysData[sys] !== undefined && log.versao) { 
        if (!sysData[sys].find(item => item.v === log.versao)) { sysData[sys].push({ v: log.versao, c: log.custo || '' }); }
      }
    }

    for (let sys in mapSys) {
      const selectEl = document.getElementById(mapSys[sys]); const costEl = document.getElementById(mapSys[sys] + '-cost');
      if(!selectEl) continue;
      selectEl.innerHTML = '';
      if(sysData[sys].length === 0) {
        selectEl.innerHTML = '<option value="">Sem Dados</option>'; if(costEl) costEl.value = '';
      } else {
        sysData[sys].forEach(item => {
            let opt = document.createElement('option'); opt.value = item.v; opt.text = item.v; opt.dataset.cost = item.c; selectEl.appendChild(opt);
        });
        selectEl.selectedIndex = 0; if(costEl) costEl.value = sysData[sys][0].c;
      }
    }
    calcTotalCost(); 
  } catch(err) { console.error(err); showToast('Erro ao carregar peças.', 'error'); } 
}

const renderCompare = () => {
  const valA = document.getElementById('compA').value; const valB = document.getElementById('compB').value;
  const res = document.getElementById('compareResults');
  if(!valA || !valB) { res.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size: 14px; padding: 40px 0;">Selecione duas versões acima para comparar a evolução do robô.</p>'; return; }

  const bpA = blueprintsData.find(b => b.id === valA); const bpB = blueprintsData.find(b => b.id === valB);
  if(!bpA || !bpB) return;

  const compareRow = (label, key, isNumeric = false) => {
    let valDataA = bpA[key]; let valDataB = bpB[key];
    if (typeof valDataA === 'boolean') valDataA = valDataA ? 'Sim' : 'Não';
    if (typeof valDataB === 'boolean') valDataB = valDataB ? 'Sim' : 'Não';
    let a = valDataA || '-'; let b = valDataB || '-';
    let classA = ''; let classB = '';

    if(a !== b) {
        classA = 'comp-diff'; classB = 'comp-diff';
        if(isNumeric) {
            let numA = parseFloat(a) || 0; let numB = parseFloat(b) || 0;
            if(numA < numB) { classA = 'comp-better'; classB = 'comp-worse'; } else if (numB < numA) { classB = 'comp-better'; classA = 'comp-worse'; }
        }
    }
    return `<tr><th>${label}</th><td class="${classA}">${isNumeric && a !== '-' && key === 'custoTotal' ? 'R$ '+a : a}</td><td class="${classB}">${isNumeric && b !== '-' && key === 'custoTotal' ? 'R$ '+b : b}</td></tr>`;
  };

  res.innerHTML = `<table class="comp-table"><thead><tr><th>Atributo</th><th>${bpA.id}</th><th>${bpB.id}</th></tr></thead><tbody>
        ${compareRow('Chassi (DRV)', 'drv')} ${compareRow('Sensores (SEN)', 'sen')}
        ${compareRow('Intake (MEC1)', 'mec1')} ${compareRow('Elevador (MEC2)', 'mec2')}
        ${compareRow('Software (SW)', 'sw')} ${compareRow('Peso (kg)', 'peso', true)}
        ${compareRow('Custo Total', 'custoTotal', true)} ${compareRow('Sizing (18x18)', 'sizingAprovado')}
      </tbody></table>`;
};

document.getElementById('compA').addEventListener('change', renderCompare);
document.getElementById('compB').addEventListener('change', renderCompare);

// --- LÓGICA DE CHARTS E RENDERIZAÇÃO DE TABELAS ---
function renderMatchesTable() {
  const tbody = document.getElementById('matchesTableBody');
  if (!tbody) return;
  if (matchesData.length === 0) { tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 30px;">Nenhuma partida registada para <strong>${versaoAtiva}</strong>.</td></tr>`; return; }
  let html = '';
  matchesData.forEach(m => {
    const dataStr = m.timestamp ? new Date(m.timestamp.seconds * 1000).toLocaleDateString('pt-BR') : '-';
    html += `<tr><td>${dataStr}</td><td>${m.pilotos || '-'}</td><td>${m.auto || 0}</td><td>${m.tele || 0}</td>
      <td><strong>${m.total || 0}</strong></td><td style="color:var(--brand-red);">${m.fouls || 0}</td>
      <td>${m.eficiencia || '-'}</td><td>${m.problemas || 'Limpa'}</td>
      <td><button class="delete-match-btn" onclick="deleteMatch('${m.docId}')" title="Excluir partida"><i class="fas fa-trash-alt"></i></button></td></tr>`;
  });
  tbody.innerHTML = html;
}

const refreshCharts = () => {
  const isDark = document.body.classList.contains('dark-theme');
  const textColor = isDark ? '#ffffff' : '#111827'; const gridColor = isDark ? '#333333' : '#e5e7eb';
  const orange = '#FF5E00'; const green = '#10b981'; const blue = '#3b82f6'; const bgOrange = 'rgba(255, 94, 0, 0.2)';

  Object.keys(chartsInstances).forEach(key => { if(chartsInstances[key]) chartsInstances[key].destroy(); });

  const sysCounts = { 'MEC_INT': 0, 'MEC_ELE': 0, 'DRV': 0, 'SEN': 0, 'SW': 0, 'STR': 0 };
  engLogsData.forEach(log => { let s = log.ticket ? log.ticket.split('-')[0] : log.sys; if (s === 'MEC') s = 'MEC_INT'; if(sysCounts[s] !== undefined) sysCounts[s]++; });

  chartsInstances.polar = new Chart(document.getElementById('devOpsEffortChart'), {
    type: 'polarArea', data: { labels: ['Intake', 'Elevador', 'Chassi', 'Sensores', 'Código', 'Estratégia'], datasets: [{ data: [sysCounts.MEC_INT, sysCounts.MEC_ELE, sysCounts.DRV, sysCounts.SEN, sysCounts.SW, sysCounts.STR], backgroundColor: [ orange, '#f59e0b', blue, '#8b5cf6', green, '#ef4444' ], borderWidth: 1, borderColor: isDark ? '#121212' : '#fff' }] },
    options: { maintainAspectRatio: false, scales: { r: { grid: { color: gridColor }, ticks: { display: false } } }, plugins: { legend: { display: true, position: 'right', labels: { color: textColor } } } }
  });

  if(matchesData.length === 0) {
    document.getElementById('avgTotal').innerText = '0'; document.getElementById('bestMatch').innerText = '0';
    document.getElementById('consistencyCV').innerText = '--%'; document.getElementById('reliabilityRate').innerText = '--%';
    document.getElementById('failuresWrapper').innerHTML = `<p style="text-align:center; padding:30px; color:var(--text-muted);">Sem partidas em ${versaoAtiva}</p>`;
    return;
  }

  let labels = []; let totals = []; let autos = []; let teles = []; let efficiencySum = 0; let cleanMatches = 0; let count = 0; let foulsTotal = 0;
  let problemasCount = {}; let sumDetails = { autoLeave: 0, autoClass: 0, autoOver: 0, autoPat: 0, teleClass: 0, teleOver: 0, teleDepot: 0, telePat: 0, teleBase: 0, teleDouble: 0 };
  const sortedMatches = [...matchesData].reverse();

  sortedMatches.forEach((d, index) => {
    labels.push(`P${index + 1}`); totals.push(d.total || 0); autos.push(d.auto || 0); teles.push(d.tele || 0);
    if(d.target && d.target > 0) efficiencySum += ((d.total || 0) / d.target) * 100;
    if(d.problemas && d.problemas.includes('Partida Limpa')) cleanMatches++;
    if(d.fouls) foulsTotal += d.fouls;
    if(d.problemas && d.problemas !== 'Limpa' && !d.problemas.includes('Partida Limpa')) { d.problemas.split(', ').forEach(p => { problemasCount[p] = (problemasCount[p] || 0) + 1; }); }
    if(d.details) { for(let key in sumDetails) { sumDetails[key] += (d.details[key] || 0); } }
    count++;
  });

  const avgTotal = totals.reduce((a,b)=>a+b,0)/count; const bestMatch = Math.max(...totals); const mean = avgTotal;
  const variance = totals.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / count; const stdDev = Math.sqrt(variance); const cv = mean > 0 ? (stdDev / mean) * 100 : 0;
  const reliability = Math.round((cleanMatches / count) * 100);
  document.getElementById('avgTotal').innerText = avgTotal.toFixed(0); document.getElementById('bestMatch').innerText = bestMatch;
  document.getElementById('consistencyCV').innerText = cv.toFixed(1) + '%'; document.getElementById('reliabilityRate').innerText = reliability + '%';

  const movingAvg = []; const windowSize = 3;
  for (let i = 0; i < totals.length; i++) { if (i < windowSize - 1) movingAvg.push(null); else { const sum = totals.slice(i - windowSize + 1, i + 1).reduce((a,b) => a + b, 0); movingAvg.push(sum / windowSize); } }
  chartsInstances.history = new Chart(document.getElementById('scoreHistoryChart'), {
    type: 'line', data: { labels: labels, datasets: [ { label: 'Pts Totais', data: totals, borderColor: orange, backgroundColor: bgOrange, fill: true, tension: 0.3, borderWidth: 3, pointRadius: 4, pointBackgroundColor: orange }, { label: 'Média Móvel (3)', data: movingAvg, borderColor: blue, borderDash: [5,5], pointRadius: 0, fill: false, borderWidth: 2 } ] },
    options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } }, scales: { y: { grid: {color: gridColor}, ticks: { color: textColor } }, x: { grid: {display:false}, ticks: { color: textColor } } } }
  });

  const avgAuto = autos.reduce((a,b)=>a+b, 0)/count; const avgTele = teles.reduce((a,b)=>a+b, 0)/count;
  chartsInstances.avg = new Chart(document.getElementById('avgDistributionChart'), {
    type: 'bar', data: { labels: ['Autônomo', 'Tele-Op'], datasets: [{ label: 'Pontuação Média', data: [avgAuto, avgTele], backgroundColor: [blue, green], borderRadius: 6 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } }, scales: { y: { grid: {color: gridColor}, ticks: { color: textColor } }, x: { grid: {display: false}, ticks: { color: textColor } } } }
  });

  const finalEff = Math.round(efficiencySum / count);
  chartsInstances.eff = new Chart(document.getElementById('efficiencyGaugeChart'), {
    type: 'doughnut', data: { labels: ['Eficiência Média', 'Perda'], datasets: [{ data: [finalEff, 100 - finalEff > 0 ? 100 - finalEff : 0], backgroundColor: [orange, isDark ? '#242424' : '#e5e7eb'], borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: '75%', plugins: { legend: { labels: { color: textColor } } } }
  });

  const failuresWrapper = document.getElementById('failuresWrapper');
  if (Object.keys(problemasCount).length === 0) {
    failuresWrapper.innerHTML = `<div style="text-align:center; color:${green}; display:flex; flex-direction:column; align-items:center;"><i class="fas fa-check-circle" style="font-size:40px; margin-bottom:10px;"></i><span style="font-weight:700;">Tudo Limpo!</span><span style="font-size:12px; color:var(--text-muted);">Nenhum problema registado.</span><canvas id="failuresChart" style="display:none;"></canvas></div>`;
  } else {
    if(!document.getElementById('failuresChart')) failuresWrapper.innerHTML = '<canvas id="failuresChart"></canvas>';
    chartsInstances.failures = new Chart(document.getElementById('failuresChart'), { type: 'pie', data: { labels: Object.keys(problemasCount), datasets: [{ data: Object.values(problemasCount), backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#64748b'], borderWidth: 2, borderColor: isDark ? '#121212' : '#fff' }] }, options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } } } });
  }

  const maxAuto = Math.max(...autos, 1); const maxTele = Math.max(...teles, 1);
  const normAuto = (avgAuto / maxAuto) * 100; const normTele = (avgTele / maxTele) * 100;
  const foulPenaltyImpact = Math.max(0, 100 - (foulsTotal / count)); 
  chartsInstances.radar = new Chart(document.getElementById('robotProfileRadarChart'), {
    type: 'radar', data: { labels: ['Força Auto', 'Força Tele', 'Eficiência', 'Fiabilidade', 'Disciplina'], datasets: [{ data: [normAuto, normTele, finalEff, reliability, foulPenaltyImpact], backgroundColor: bgOrange, borderColor: orange, pointBackgroundColor: orange, }] },
    options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } }, scales: { r: { angleLines: { color: gridColor }, grid: { color: gridColor }, pointLabels: { color: textColor }, ticks: { display: false, min: 0, max: 100 } } } }
  });

  const scatterData = sortedMatches.map(m => ({ x: m.auto || 0, y: m.total || 0 }));
  chartsInstances.scatter = new Chart(document.getElementById('scatterAutoTotalChart'), {
    type: 'scatter', data: { datasets: [{ label: 'Partidas', data: scatterData, backgroundColor: orange, pointRadius: 6 }] },
    options: { maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'Pontos Autônomo', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } }, y: { title: { display: true, text: 'Pontos Totais', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } } }, plugins: { legend: { labels: { color: textColor } } } }
  });

  const contribLabels = ['Leave Auto', 'Classified Auto', 'Overflow Auto', 'Pattern Auto', 'Classified Tele', 'Overflow Tele', 'Depot Tele', 'Pattern Tele', 'Base', 'Double Base'];
  const contribData = [ sumDetails.autoLeave / count, sumDetails.autoClass / count, sumDetails.autoOver / count, sumDetails.autoPat / count, sumDetails.teleClass / count, sumDetails.teleOver / count, sumDetails.teleDepot / count, sumDetails.telePat / count, sumDetails.teleBase / count, sumDetails.teleDouble / count ];
  const filteredLabels = contribLabels.filter((_, i) => contribData[i] > 0); const filteredData = contribData.filter(v => v > 0);
  
  chartsInstances.contribution = new Chart(document.getElementById('contributionPieChart'), {
    type: 'pie', data: { labels: filteredLabels.length ? filteredLabels : ['Sem dados'], datasets: [{ data: filteredData.length ? filteredData : [1], backgroundColor: ['#FF5E00','#F59E0B','#3B82F6','#10B981','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#A855F7'] }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor } } } }
  });
};
document.getElementById('btnRefreshCharts').addEventListener('click', refreshCharts);

// --- INICIALIZAÇÃO GERAL DA APLICAÇÃO ---
calcMatchScore();
switchTab('match');