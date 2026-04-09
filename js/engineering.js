// js/engineering.js
import { appState, parseNumber } from './store.js';
import { db, ROBO_ATIVO, collection, addDoc, updateDoc, doc, query, orderBy, limit, getDocs, setDoc } from './firebase.js';
import { showToast } from './ui.js';

const drillProtocols = {
  'MEC_ELE': [
    { nome: 'Lançamento Curto (Alinhado)', aprovado: 'Acerta 5/5', parcial: 'Acerta 3/5', falhou: 'Erra maioria' },
    { nome: 'Lançamento Curto (Torto 30º)', aprovado: 'Compensa ângulo', parcial: 'Acerta borda', falhou: 'Erra total' },
    { nome: 'Velocidade Subida Elevador', aprovado: '< 1.5s', parcial: 'Vibração excessiva', falhou: 'Perde passos ou trava' }
  ],
  'MEC_INT': [
    { nome: 'Coleta de peça alinhada', aprovado: 'Engole em < 1s', parcial: 'Demora > 2s', falhou: 'Empurra a peça' },
    { nome: 'Teste de retenção (Impacto)', aprovado: 'Peça não cai', parcial: 'Escorrega um pouco', falhou: 'Cai facilmente' }
  ],
  'DRV': [
    { nome: 'Aceleração Sprint (2m reto)', aprovado: 'PID perfeito', parcial: 'Puxa pro lado', falhou: 'Desvia ou trava' },
    { nome: 'Strafe Lateral', aprovado: 'Desliza sem rodar', parcial: 'Drift leve', falhou: 'Motores arrastam' }
  ],
  'SEN': [
    { nome: 'Detecção Visual (Sombra)', aprovado: 'Tracking instantâneo', parcial: 'Perde tracking rápido', falhou: 'Cegueira' }
  ],
  'SW': [
    { nome: 'Autônomo Recuperação', aprovado: 'Volta a rota < 1s após empurrão', parcial: 'Demora recuperar', falhou: 'Odometria morre' }
  ],
  'STR': [
    { nome: 'Simulação de Ciclo', aprovado: 'Ciclo em < 10s', parcial: 'Ciclo em 15s', falhou: 'Ciclo inviável' }
  ]
};

export function initEngineeringLogic() {
  document.addEventListener('click', (e) => {
    const btnAction = e.target.closest('[data-action]');
    if (!btnAction) return;

    const action = btnAction.getAttribute('data-action');
    const sys = btnAction.getAttribute('data-sys');

    if (action === 'openEngForm') openEngForm(sys);
    if (action === 'openDrillForm') openDrillForm(sys);
    if (action === 'viewHistory') viewSubsystemHistory(sys);
  });

  const btnCloseEng = document.getElementById('btnCloseEngForm');
  if(btnCloseEng) btnCloseEng.addEventListener('click', () => { 
    document.getElementById('formEngenharia').style.display = 'none'; 
  });

  const btnCloseDrill = document.getElementById('btnCloseDrillForm');
  if(btnCloseDrill) btnCloseDrill.addEventListener('click', () => { 
    document.getElementById('formDrill').style.display = 'none'; 
  });

  const btnReset = document.getElementById('btnResetFeed');
  if(btnReset) {
    btnReset.addEventListener('click', () => {
      appState.isViewingGlobalHistory = false;
      const feedTitle = document.getElementById('feedTitle');
      if(feedTitle) feedTitle.innerHTML = `<i class="fas fa-list"></i> Linha do Tempo Unificada (${appState.versaoAtiva})`;
      btnReset.style.display = 'none';
      renderFilteredEngFeed(appState.engLogsData, false);
    });
  }

  const btnSaveEng = document.getElementById('btnSaveEng');
  if(btnSaveEng) btnSaveEng.addEventListener('click', saveEngineeringCommit);
  
  const btnSaveDrill = document.getElementById('btnSaveDrill');
  if(btnSaveDrill) btnSaveDrill.addEventListener('click', saveDrillTest);

  const calcDelta = () => {
    const oldV = parseNumber(document.getElementById('kpiOld')?.value);
    const newV = parseNumber(document.getElementById('kpiNew')?.value);
    const deltaInput = document.getElementById('kpiDelta');
    if (!deltaInput) return;
    
    if (oldV === 0 && newV === 0) { deltaInput.value = ''; deltaInput.className = 'tele-val'; return; }
    
    const delta = (newV - oldV).toFixed(2);
    deltaInput.value = delta > 0 ? `+${delta}` : delta;
    deltaInput.className = `tele-val ${parseFloat(delta) >= 0 ? 'delta-pos' : 'delta-neg'}`;
  };

  const kpiOld = document.getElementById('kpiOld');
  const kpiNew = document.getElementById('kpiNew');
  if(kpiOld) kpiOld.addEventListener('input', calcDelta);
  if(kpiNew) kpiNew.addEventListener('input', calcDelta);

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-eng-btn');
    if(btn) {
      const docId = btn.getAttribute('data-id');
      const versaoDoc = btn.getAttribute('data-origem');
      if(!confirm("Mover log para lixeira?")) return;
      try { 
        await updateDoc(doc(db, "robos", ROBO_ATIVO, "versoes", versaoDoc, "engenharia", docId), {apagado: true}); 
        showToast('Log removido.', 'success'); 
        if (appState.isViewingGlobalHistory) { 
          const currentSysName = document.getElementById('feedTitle')?.innerText.split(': ')[1]; 
          if (currentSysName) viewSubsystemHistory(currentSysName); 
        }
      } catch (err) { console.error(err); }
    }
  });
}

function openEngForm(sysId) {
  const formDrill = document.getElementById('formDrill');
  const formEng = document.getElementById('formEngenharia');
  const engSys = document.getElementById('engSys');

  if(formDrill) formDrill.style.display = 'none'; 
  if(engSys) engSys.value = sysId; 
  if(formEng) {
    formEng.style.display = 'block'; 
    formEng.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
}

function openDrillForm(sysId) {
  const formEng = document.getElementById('formEngenharia');
  if(formEng) formEng.style.display = 'none'; 

  const form = document.getElementById('formDrill');
  const checklist = document.getElementById('drillChecklist');
  const hiddenSys = document.getElementById('drillSysHidden');
  const sysLabel = document.getElementById('drillSysLabel');
  
  if(!form || !checklist) return;

  if(hiddenSys) hiddenSys.value = sysId;
  if(sysLabel) sysLabel.innerText = sysId;
  checklist.innerHTML = '';
  
  if(drillProtocols[sysId]) {
    drillProtocols[sysId].forEach((test) => {
      checklist.innerHTML += `
        <div class="drill-item" data-test="${test.nome}" style="background: var(--bg-surface); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light); box-shadow: var(--shadow-sm);">
          <div style="font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text-main);"><i class="fas fa-vial text-muted"></i> ${test.nome}</div>
          <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 12px; display: flex; flex-direction: column; gap: 2px;">
            <div><span style="color: #10b981;">[A]:</span> ${test.aprovado}</div>
            <div><span style="color: #f59e0b;">[P]:</span> ${test.parcial}</div>
            <div><span style="color: #ef4444;">[F]:</span> ${test.falhou}</div>
          </div>
          <div class="segmented drill-seg-group">
            <button type="button" class="seg-btn drill-btn" data-val="0" style="color: #ef4444;">Falhou</button>
            <button type="button" class="seg-btn drill-btn" data-val="0.5" style="color: #f59e0b;">Parcial</button>
            <button type="button" class="seg-btn drill-btn active" data-val="1" style="color: #10b981; background: var(--bg-input); box-shadow: var(--shadow-sm); border: 1px solid var(--border-light);">Aprovado</button>
          </div>
        </div>
      `;
    });

    document.querySelectorAll('.drill-seg-group').forEach(group => {
      group.querySelectorAll('.drill-btn').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          group.querySelectorAll('.drill-btn').forEach(b => { b.classList.remove('active'); b.style.background = 'transparent'; b.style.boxShadow = 'none'; b.style.border = 'none'; });
          const clicked = ev.currentTarget;
          clicked.classList.add('active'); clicked.style.background = 'var(--bg-input)'; clicked.style.boxShadow = 'var(--shadow-sm)'; clicked.style.border = '1px solid var(--border-light)';
        });
      });
    });
  } else {
    checklist.innerHTML = `<p style="color: var(--text-muted); padding: 20px;">Nenhum protocolo de teste definido para este subsistema.</p>`;
  }

  form.style.display = 'block';
  form.scrollIntoView({behavior: 'smooth', block: 'start'});
}

async function saveEngineeringCommit(e) {
  const btn = e.currentTarget; if (btn.disabled) return;
  
  const sys = document.getElementById('engSys')?.value; 
  const ver = document.getElementById('engVer')?.value.trim(); 
  const title = document.getElementById('engTitulo')?.value.trim();
  
  if(!ver || !title) { showToast('Versão e Título são obrigatórios!', 'error'); return; }

  btn.disabled = true; 
  const originalText = btn.innerHTML; 
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO...';

  const entry = {
    ticket: `${sys}-${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`,
    sys: sys, versao: ver, titulo: title, 
    kpiNome: document.getElementById('kpiName')?.value || 'KPI', 
    kpiOld: document.getElementById('kpiOld')?.value || '', 
    kpiNew: document.getElementById('kpiNew')?.value || '', 
    kpiDelta: document.getElementById('kpiDelta')?.value || '', 
    hipotese: document.getElementById('engHyp')?.value.trim() || '', 
    tradeoff: document.getElementById('engTrade')?.value.trim() || '', 
    rca: document.getElementById('engRca')?.value.trim() || '', 
    link: document.getElementById('engLink')?.value.trim() || '', 
    custo: parseNumber(document.getElementById('engCost')?.value), 
    timestamp: new Date(), 
    dataStr: new Date().toLocaleDateString('pt-BR'), 
    apagado: false
  };

  try {
    await addDoc(collection(db, "robos", ROBO_ATIVO, "versoes", appState.versaoAtiva, "engenharia"), entry);
    await setDoc(doc(db, "robos", ROBO_ATIVO, "metadata", "subsystems"), { [sys]: { versao: ver, timestamp: new Date() } }, { merge: true });

    showToast('Commit registado!', 'success');
    btn.innerHTML = '<i class="fas fa-check"></i> Criado!';
    btn.classList.add('success');
    
    ['engVer','engTitulo','kpiOld','kpiNew','kpiDelta','engHyp','engTrade','engRca','engLink','engCost'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
    
    const deltaEl = document.getElementById('kpiDelta');
    if(deltaEl) deltaEl.className = 'tele-val'; 
    
    setTimeout(() => {
        btn.classList.remove('success'); 
        btn.innerHTML = originalText;
        const formEng = document.getElementById('formEngenharia');
        if(formEng) formEng.style.display = 'none';
    }, 1500);
    
    if(appState.isViewingGlobalHistory && document.getElementById('feedTitle')?.innerText.includes(sys)) { 
      viewSubsystemHistory(sys); 
    }
  } catch (err) { 
    console.error(err); 
    showToast('Erro ao gravar commit.', 'error'); 
    btn.innerHTML = '<i class="fas fa-times"></i> Erro';
    setTimeout(() => { btn.innerHTML = originalText; }, 1500);
  } finally { 
    btn.disabled = false; // Passo 2: Seguro IMEDIATAMENTE
  }
}

async function saveDrillTest(e) {
  const btn = e.currentTarget; if (btn.disabled) return;
  const sys = document.getElementById('drillSysHidden')?.value;
  const tester = document.getElementById('drillTester')?.value.trim();
  const notes = document.getElementById('drillNotes')?.value.trim();

  if (!tester) { showToast('Informe quem é o avaliador!', 'error'); return; }

  btn.disabled = true; 
  const originalText = btn.innerHTML; 
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> REGISTRANDO...';

  let testResults = []; let scoreTotal = 0; let maxScore = 0;
  document.querySelectorAll('.drill-item').forEach(item => {
    const testName = item.getAttribute('data-test');
    const activeBtn = item.querySelector('.drill-btn.active');
    if(activeBtn) {
      const resultValue = parseFloat(activeBtn.getAttribute('data-val'));
      let statusText = resultValue === 1 ? 'Aprovado' : resultValue === 0.5 ? 'Parcial' : 'Falhou';
      testResults.push({ teste: testName, valor: resultValue, status: statusText });
      scoreTotal += resultValue; maxScore += 1;
    }
  });

  const efficiency = maxScore > 0 ? Math.round((scoreTotal / maxScore) * 100) : 0;

  const entry = {
    tipo: 'QA_DRILL', sys: sys, avaliador: tester, notas: notes, resultados: testResults,
    eficienciaQA: efficiency, timestamp: new Date(), dataStr: new Date().toLocaleDateString('pt-BR'), apagado: false
  };

  try {
    await addDoc(collection(db, "robos", ROBO_ATIVO, "versoes", appState.versaoAtiva, "engenharia"), entry);
    showToast(`Teste QA Gravado! Score: ${efficiency}%`, 'success');
    btn.innerHTML = '<i class="fas fa-check"></i> Gravado!';
    btn.classList.add('success');
    
    setTimeout(() => {
        btn.classList.remove('success'); 
        btn.innerHTML = originalText;
        const notesEl = document.getElementById('drillNotes');
        if(notesEl) notesEl.value = '';
        const formDrill = document.getElementById('formDrill');
        if(formDrill) formDrill.style.display = 'none';
    }, 1500);

    if(appState.isViewingGlobalHistory && document.getElementById('feedTitle')?.innerText.includes(sys)) { 
      viewSubsystemHistory(sys); 
    }
  } catch (err) { 
    console.error(err); 
    showToast('Erro ao gravar teste.', 'error'); 
    btn.innerHTML = '<i class="fas fa-times"></i> Erro';
    setTimeout(() => { btn.innerHTML = originalText; }, 1500);
  } finally { 
    btn.disabled = false; // Seguro IMEDIATAMENTE
  }
}

export async function updateSubsystemsBadges() {
  try {
      const metaDoc = await getDocs(query(collection(db, "robos", ROBO_ATIVO, "metadata")));
      let latest = { 'DRV': 'v?', 'SEN': 'v?', 'MEC_INT': 'v?', 'MEC_ELE': 'v?', 'SW': 'v?', 'STR': 'v?' };

      metaDoc.forEach(docItem => {
        if (docItem.id === 'subsystems') {
           const data = docItem.data();
           for (let sys in latest) { if (data[sys]) latest[sys] = data[sys].versao || 'v?'; }
        }
      });

      for (let sys in latest) {
          const badge = document.getElementById('badge-' + sys);
          if (badge) {
              badge.innerText = latest[sys] !== 'v?' ? latest[sys] : 'Sem dados';
              if (latest[sys] !== 'v?') { 
                badge.style.background = 'var(--orange)'; 
                badge.style.color = '#000'; 
              } else { 
                badge.style.background = 'var(--text-muted)'; 
                badge.style.color = '#fff'; 
              }
          }
      }
  } catch (error) { 
    console.error("Erro ao atualizar badges rápidos:", error); 
  }
}

async function viewSubsystemHistory(sysId) {
  appState.isViewingGlobalHistory = true;
  const feedTitle = document.getElementById('feedTitle');
  const btnReset = document.getElementById('btnResetFeed');
  const engFeed = document.getElementById('engFeed');
  const feedPanel = document.getElementById('feedPanel');

  if(feedTitle) feedTitle.innerHTML = `<i class="fas fa-history"></i> Histórico Global: ${sysId}`;
  if(btnReset) btnReset.style.display = 'flex';
  if(engFeed) engFeed.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x" style="color: var(--orange);"></i><p style="margin-top:10px; color:var(--text-muted)">Buscando em todo o banco...</p></div>';
  if(feedPanel) feedPanel.scrollIntoView({behavior: 'smooth', block: 'start'});

  let globalLogs = [];
  try {
      const promises = appState.robotVersionsArray.map(v => getDocs(query(collection(db, "robos", ROBO_ATIVO, "versoes", v, "engenharia"), orderBy("timestamp", "desc"), limit(20))));
      const snapshots = await Promise.all(promises);
      
      snapshots.forEach((snap, index) => {
          let v = appState.robotVersionsArray[index];
          snap.forEach(d => {
              let data = d.data();
              if (!data.apagado && data.sys === sysId) { globalLogs.push({docId: d.id, versaoOrigem: v, ...data}); }
          });
      });

      globalLogs.sort((a,b) => b.timestamp - a.timestamp);
      renderFilteredEngFeed(globalLogs, true); 
  } catch(e) { 
    console.error(e); 
    if(engFeed) engFeed.innerHTML = '<p style="text-align:center; color:var(--brand-red);">Erro ao carregar histórico global.</p>'; 
  }
}

export function renderFilteredEngFeed(logsArray, isGlobal) {
  const feed = document.getElementById('engFeed');
  if(!feed) return;

  if (logsArray.length === 0) {
    feed.innerHTML = `<div class="panel" style="text-align: center; padding: 60px 20px; background: transparent; border: 2px dashed var(--border-light); box-shadow: none;"><i class="fas fa-folder-open" style="font-size: 40px; margin-bottom: 16px; color: var(--border-focus);"></i><p style="color: var(--text-muted); font-size: 14px;">Nenhuma atividade recente.</p></div>`; 
    return;
  }
  let html = '';
  logsArray.forEach((e) => {
    const vOrigem = isGlobal ? e.versaoOrigem : appState.versaoAtiva; 
    const safeDataStr = e.dataStr || 'Data Desconhecida';

    if (e.tipo === 'QA_DRILL') {
      let badgeQA = e.eficienciaQA >= 80 ? '#10b981' : e.eficienciaQA >= 50 ? '#f59e0b' : '#ef4444';
      let resultsHtml = '';
      if(e.resultados && e.resultados.length > 0) {
          resultsHtml = `<div style="background:var(--bg-input); border-radius:var(--radius-sm); border:1px solid var(--border-light); padding: 12px; margin-top: 12px;">`;
          e.resultados.forEach(r => {
             let rColor = r.valor === 1 ? '#10b981' : r.valor === 0.5 ? '#f59e0b' : '#ef4444';
             let rIcon = r.valor === 1 ? 'fa-check-circle' : r.valor === 0.5 ? 'fa-minus-circle' : 'fa-times-circle';
             resultsHtml += `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-light); padding:6px 0; font-size:12px;">
                <span style="color:var(--text-main);">${r.teste}</span>
                <span style="color:${rColor}; font-weight:700;"><i class="fas ${rIcon}"></i> ${r.status}</span>
             </div>`;
          });
          resultsHtml += `</div>`;
      }

      html += `<div class="ticket-entry" style="border-left-color: #3b82f6; background: linear-gradient(90deg, rgba(59, 130, 246, 0.05) 0%, var(--bg-surface) 100%);">
        <div class="ticket-header">
          <div>
            <span class="ticket-id" style="background: #3b82f6; color: #fff;"><i class="fas fa-vial"></i> QA TEST</span>
            <span style="font-family: 'JetBrains Mono'; font-weight:700; font-size:12px; margin-left: 10px; color: #3b82f6;">${e.sys}</span>
            <h3 class="ticket-title" style="color: #3b82f6;">Relatório de Qualidade do Subsistema</h3>
            <div class="ticket-meta"><i class="far fa-clock"></i> ${safeDataStr} | Avaliador: ${e.avaliador || 'N/A'}</div>
          </div>
          <button type="button" class="delete-eng-btn" data-id="${e.docId}" data-origem="${vOrigem}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size: 16px;"><i class="fas fa-trash"></i></button>
        </div>
        <div style="font-size: 14px; margin-bottom: 8px;"><strong>Score de Qualidade:</strong> <span style="color:${badgeQA}; font-weight:700; font-size: 16px;">${e.eficienciaQA}%</span></div>
        ${e.notas ? `<p style="font-size: 13px; color: var(--text-muted); font-style: italic;">"${e.notas}"</p>` : ''}
        ${resultsHtml}
      </div>`;
    } else {
      const safeTicket = e.ticket || 'SYS-000';
      html += `<div class="ticket-entry" style="border-left-color: var(--orange)">
        <div class="ticket-header">
          <div>
            <span class="ticket-id"><i class="fas fa-code-commit"></i> ${safeTicket}</span>
            ${isGlobal ? `<span class="badge-decode" style="margin-left:10px; background:var(--text-muted); color:#fff; font-size:10px;"><i class="fas fa-globe"></i> ${vOrigem}</span>` : ''}
            <span style="font-family: 'JetBrains Mono'; font-weight:700; font-size:12px; margin-left: 10px; color: var(--orange);">${e.versao || 'v?'}</span>
            <h3 class="ticket-title">${e.titulo || 'Sem Título'}</h3>
            <div class="ticket-meta"><i class="far fa-clock"></i> ${safeDataStr} ${e.custo ? `| <i class="fas fa-coins" style="margin-left:8px;"></i> R$ ${e.custo}` : ''}</div>
          </div>
          <button type="button" class="delete-eng-btn" data-id="${e.docId}" data-origem="${vOrigem}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size: 16px;"><i class="fas fa-trash"></i></button>
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
    }
  });
  feed.innerHTML = html;
}