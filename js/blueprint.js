// js/blueprint.js
import { appState, parseNumber } from './store.js';
import { db, ROBO_ATIVO, collection, getDocs, setDoc, doc, query, orderBy, limit } from './firebase.js';
import { showToast } from './ui.js';

export function initBlueprintLogic() {
  document.querySelectorAll('.bp-cost-input').forEach(input => input.addEventListener('input', calcTotalCost));
  
  const btnSize = document.getElementById('btnSize');
  if(btnSize) btnSize.addEventListener('click', function() { this.classList.toggle('active-orange'); });
  
  const btnSaveBP = document.getElementById('btnSaveBlueprint');
  if(btnSaveBP) btnSaveBP.addEventListener('click', saveBlueprint);

  ['bp-drv', 'bp-sen', 'bp-mec1', 'bp-mec2', 'bp-sw'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', (e) => {
        const selectedOpt = e.target.options[e.target.selectedIndex];
        const costInput = document.getElementById(id + '-cost');
        if(selectedOpt && costInput) { costInput.value = selectedOpt.dataset.cost || ''; calcTotalCost(); }
    });
  });

  document.addEventListener('loadBlueprintData', () => {
    loadBlueprintOptions();
    autoSuggestVersionName(); 
  });
  document.addEventListener('renderCompareData', renderCompare);
  
  const compA = document.getElementById('compA');
  const compB = document.getElementById('compB');
  if(compA) compA.addEventListener('change', renderCompare);
  if(compB) compB.addEventListener('change', renderCompare);
}

function autoSuggestVersionName() {
  const verInput = document.getElementById('robotVersion');
  if(!verInput || verInput.value !== '') return; 

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');

  verInput.value = `v${year}.${month}.${day}-${hours}${mins}`;
}

export function updateCompareDropdowns() {
  const compA = document.getElementById('compA');
  const compB = document.getElementById('compB');
  if(!compA || !compB) return;
  
  const valA = compA.value; 
  const valB = compB.value;
  
  let options = '<option value="">Selecione uma Versão...</option>';
  appState.blueprintsData.forEach(bp => { 
    options += `<option value="${bp.id}">${bp.id}</option>`; 
  });
  
  compA.innerHTML = options; 
  compB.innerHTML = options;
  
  if(valA) compA.value = valA; 
  if(valB) compB.value = valB;
}

const calcTotalCost = () => {
  const drv = parseNumber(document.getElementById('bp-drv-cost')?.value);
  const sen = parseNumber(document.getElementById('bp-sen-cost')?.value);
  const mec1 = parseNumber(document.getElementById('bp-mec1-cost')?.value);
  const mec2 = parseNumber(document.getElementById('bp-mec2-cost')?.value);
  const totalEl = document.getElementById('bomTotal');
  if(totalEl) totalEl.innerText = (drv + sen + mec1 + mec2).toFixed(2);
};

async function saveBlueprint(e) {
  const btn = e.currentTarget; if (btn.disabled) return;

  const verInput = document.getElementById('robotVersion')?.value;
  if(!verInput) return;
  
  const ver = verInput.toUpperCase().replace(/\s+/g, ''); 
  if(!ver) { showToast('Preencha a Versão do Robô!', 'error'); return; }
  
  btn.disabled = true; 
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A gravar...'; 
  btn.classList.add('loading');

  const blueprintData = {
    drv: document.getElementById('bp-drv')?.value || '', 
    sen: document.getElementById('bp-sen')?.value || '',
    mec1: document.getElementById('bp-mec1')?.value || '', 
    mec2: document.getElementById('bp-mec2')?.value || '',
    sw: document.getElementById('bp-sw')?.value || '', 
    peso: parseNumber(document.getElementById('robotWeight')?.value),
    sizingAprovado: document.getElementById('btnSize')?.classList.contains('active-orange') || false,
    custoTotal: document.getElementById('bomTotal')?.innerText || '0.00', 
    timestamp: new Date()
  };

  try {
    await setDoc(doc(db, "robos", ROBO_ATIVO, "versoes", ver), blueprintData, { merge: true }); 
    showToast('Nova versão criada e ativada!', 'success');
    btn.innerHTML = '<i class="fas fa-check"></i> Criado!'; 
    btn.classList.remove('loading'); 
    btn.classList.add('success');
  } catch (err) {
    console.error(err); 
    showToast('Erro ao criar Versão.', 'error');
    btn.innerHTML = '<i class="fas fa-times"></i> Erro'; 
    btn.classList.remove('loading');
  } finally {
    // CORREÇÃO: Padrão consistente de limpeza de UI (sucesso ou falha)
    setTimeout(() => { 
      btn.innerHTML = originalText; 
      btn.classList.remove('success'); 
      btn.disabled = false; 
    }, 1500);
  }
}

async function loadBlueprintOptions() {
  try {
    // CORREÇÃO: Limita a pesquisa às 5 versões mais recentes para evitar lentidão e excesso de leituras O(N)
    const recentVersions = appState.robotVersionsArray.slice(0, 5);
    
    const promises = recentVersions.map(v => getDocs(query(collection(db, "robos", ROBO_ATIVO, "versoes", v, "engenharia"), orderBy("timestamp", "desc"), limit(15))));
    const snapshots = await Promise.all(promises);
    
    let globalLogs = [];
    snapshots.forEach((snap, index) => {
        let v = recentVersions[index];
        snap.forEach(d => { if(!d.data().apagado && d.data().tipo !== 'QA_DRILL') globalLogs.push({...d.data()}) });
    });
    
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
      const selectEl = document.getElementById(mapSys[sys]); 
      const costEl = document.getElementById(mapSys[sys] + '-cost');
      if(!selectEl) continue;
      
      selectEl.innerHTML = '';
      if(sysData[sys].length === 0) {
        selectEl.innerHTML = '<option value="">Sem Dados</option>'; 
        if(costEl) costEl.value = '';
      } else {
        sysData[sys].forEach(item => {
            let opt = document.createElement('option'); opt.value = item.v; opt.text = item.v; opt.dataset.cost = item.c; selectEl.appendChild(opt);
        });
        selectEl.selectedIndex = 0; 
        if(costEl && sysData[sys][0]) costEl.value = sysData[sys][0].c;
      }
    }
    calcTotalCost(); 
  } catch(err) { 
    console.error(err); 
    showToast('Erro de conexão ao carregar componentes.', 'error'); 
  } 
}

const renderCompare = async () => {
  const compA = document.getElementById('compA');
  const compB = document.getElementById('compB');
  const res = document.getElementById('compareResults');
  
  if(!compA || !compB || !res) return;

  const valA = compA.value; 
  const valB = compB.value;
  
  if(!valA || !valB) { 
    res.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size: 14px; padding: 40px 0;">Selecione duas versões acima para comparar a evolução mecânica e de desempenho.</p>'; 
    return; 
  }

  const bpA = appState.blueprintsData.find(b => b.id === valA); 
  const bpB = appState.blueprintsData.find(b => b.id === valB);
  if(!bpA || !bpB) return;

  res.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x" style="color: var(--orange);"></i><p style="margin-top:10px; color:var(--text-muted)">A cruzar dados de engenharia e telemetria...</p></div>';

  try {
    const [snapA, snapB] = await Promise.all([
      getDocs(query(collection(db, "robos", ROBO_ATIVO, "versoes", valA, "partidas"))),
      getDocs(query(collection(db, "robos", ROBO_ATIVO, "versoes", valB, "partidas")))
    ]);

    const calcStats = (snapshot, costTotal) => {
      let totals = []; let autoPts = 0; let cleanCount = 0;
      snapshot.forEach(doc => {
        let d = doc.data();
        if(!d.apagado) {
          totals.push(d.total || 0); autoPts += (d.auto || 0);
          if(d.problemas && d.problemas.includes('Partida Limpa')) cleanCount++;
        }
      });
      let count = totals.length;
      let totalSum = totals.reduce((a,b) => a+b, 0);
      let mediaTotal = count > 0 ? Math.round(totalSum / count) : 0;
      
      let cv = 0;
      if (count > 1 && mediaTotal > 0) {
          let variance = totals.reduce((a,b) => a + Math.pow(b - mediaTotal, 2), 0) / count;
          cv = Math.round((Math.sqrt(variance) / mediaTotal) * 100);
      }

      return {
        partidas: count,
        mediaTotal: mediaTotal,
        mediaAuto: count > 0 ? Math.round(autoPts / count) : 0,
        fiabilidade: count > 0 ? Math.round((cleanCount / count) * 100) : 0,
        consistencia: cv,
        custoPonto: mediaTotal > 0 ? (costTotal / mediaTotal).toFixed(2) : 0
      };
    };

    const costA = parseFloat(bpA.custoTotal) || 0;
    const costB = parseFloat(bpB.custoTotal) || 0;
    
    const statsA = calcStats(snapA, costA);
    const statsB = calcStats(snapB, costB);

    let vereditoHTML = "";
    if (statsA.partidas === 0 || statsB.partidas === 0) {
      vereditoHTML = `<div style="color: var(--brand-warn);"><i class="fas fa-exclamation-triangle"></i> Dados insuficientes. É necessário jogar com ambas as versões para gerar o veredito.</div>`;
    } else {
      let diffPts = statsB.mediaTotal - statsA.mediaTotal;
      let isB_Better = diffPts >= 0;
      let custoDiff = costB - costA;
      
      vereditoHTML = `<div style="font-size: 15px; font-weight: 700; color: ${isB_Better ? 'var(--brand-tele)' : 'var(--brand-red)'}">
        ${isB_Better ? `<i class="fas fa-trophy"></i> A versão ${bpB.id} provou ser superior!` : `<i class="fas fa-times-circle"></i> A versão ${bpA.id} (Antiga) ainda tem melhor desempenho.`}
      </div>
      <div style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">
        A ${bpB.id} garante <strong>${diffPts >= 0 ? '+'+diffPts : diffPts} pontos</strong> em média. 
        ${custoDiff > 0 ? `Apesar de ser R$ ${custoDiff.toFixed(2)} mais cara, ` : custoDiff < 0 ? `E além disso é R$ ${Math.abs(custoDiff).toFixed(2)} mais barata, ` : 'O custo manteve-se, mas '}
        a sua taxa de fiabilidade é de <strong>${statsB.fiabilidade}%</strong> (vs ${statsA.fiabilidade}% da anterior).
      </div>`;
    }

    const compareRow = (label, valDataA, valDataB, isNumeric = false, invertLogic = false, suffix = '') => {
      let a = valDataA; let b = valDataB;
      if (typeof a === 'boolean') a = a ? 'Sim' : 'Não';
      if (typeof b === 'boolean') b = b ? 'Sim' : 'Não';
      if (a === undefined || a === '') a = '-'; if (b === undefined || b === '') b = '-';
      
      let classA = ''; let classB = '';
      if(a !== b && a !== '-' && b !== '-') {
          classA = 'comp-diff'; classB = 'comp-diff';
          if(isNumeric) {
              let numA = parseFloat(a) || 0; let numB = parseFloat(b) || 0;
              if(numA < numB) { classA = invertLogic ? 'comp-better' : 'comp-worse'; classB = invertLogic ? 'comp-worse' : 'comp-better'; } 
              else if (numB < numA) { classB = invertLogic ? 'comp-better' : 'comp-worse'; classA = invertLogic ? 'comp-worse' : 'comp-better'; }
          }
      }
      return `<tr><th>${label}</th><td class="${classA}">${a !== '-' ? a + suffix : a}</td><td class="${classB}">${b !== '-' ? b + suffix : b}</td></tr>`;
    };

    res.innerHTML = `
      <div style="background: var(--bg-input); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-light); margin-bottom: 24px; text-align: center; box-shadow: var(--shadow-sm);">
        <h4 style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 1px;"><i class="fas fa-brain"></i> Análise de Decisão do MetalLab</h4>
        ${vereditoHTML}
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 24px;">
        <div style="flex: 1; min-width: 300px; background: var(--bg-surface); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-light); display: ${statsA.partidas > 0 && statsB.partidas > 0 ? 'block' : 'none'};">
           <h4 style="text-align:center; font-size:12px; color:var(--text-muted); text-transform:uppercase; margin-bottom: 15px;">Duelo de Performance Visual</h4>
           <div style="position: relative; height: 250px; width: 100%;">
              <canvas id="compareRadarChart"></canvas>
           </div>
        </div>
      </div>

      <table class="comp-table">
        <thead>
          <tr>
            <th style="width: 34%;">Métrica / Subsistema</th>
            <th style="width: 33%; font-size: 14px; color: var(--text-muted);"><i class="fas fa-history"></i> ${bpA.id}</th>
            <th style="width: 33%; font-size: 14px; color: var(--orange);"><i class="fas fa-star"></i> ${bpB.id}</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: rgba(0,0,0,0.03);"><td colspan="3" style="text-align: left; font-size: 10px; color: var(--text-muted); font-weight: bold; letter-spacing: 1px;">📊 TELEMETRIA E PERFORMANCE</td></tr>
          ${compareRow('Partidas de Teste Jogadas', statsA.partidas, statsB.partidas, true, false)}
          ${compareRow('Média de Pontos Totais', statsA.mediaTotal, statsB.mediaTotal, true, false)}
          ${compareRow('Média em Modo Autônomo', statsA.mediaAuto, statsB.mediaAuto, true, false)}
          ${compareRow('Fiabilidade (Sem Falhas)', statsA.fiabilidade, statsB.fiabilidade, true, false, '%')}
          ${compareRow('Inconsistência de Partida (Menor é Melhor)', statsA.consistencia, statsB.consistencia, true, true, '%')}
          ${compareRow('Custo por Ponto Feito (ROI)', statsA.custoPonto, statsB.custoPonto, true, true, ' R$')}
          
          <tr style="background: rgba(0,0,0,0.03);"><td colspan="3" style="text-align: left; font-size: 10px; color: var(--text-muted); font-weight: bold; letter-spacing: 1px; margin-top: 10px;">⚙️ HARDWARE E BLUEPRINT</td></tr>
          ${compareRow('Chassi (DRV)', bpA.drv, bpB.drv)} 
          ${compareRow('Sensores (SEN)', bpA.sen, bpB.sen)}
          ${compareRow('Intake (MEC1)', bpA.mec1, bpB.mec1)} 
          ${compareRow('Elevador (MEC2)', bpA.mec2, bpB.mec2)}
          ${compareRow('Software (SW)', bpA.sw, bpB.sw)} 
          ${compareRow('Peso Total', bpA.peso, bpB.peso, true, true, ' kg')}
          ${compareRow('Custo de Produção', bpA.custoTotal, bpB.custoTotal, true, true, ' R$')}
          ${compareRow('Aprovado no Sizing', bpA.sizingAprovado, bpB.sizingAprovado)}
        </tbody>
      </table>
    `;

    if (statsA.partidas > 0 && statsB.partidas > 0) {
      setTimeout(() => {
        const ctx = document.getElementById('compareRadarChart');
        if(!ctx) return;
        
        if (appState.chartsInstances.compareRadar) {
            appState.chartsInstances.compareRadar.destroy();
        }

        const maxPts = Math.max(statsA.mediaTotal, statsB.mediaTotal, 1);
        const maxAuto = Math.max(statsA.mediaAuto, statsB.mediaAuto, 1);
        
        const dataA = [ (statsA.mediaTotal/maxPts)*100, (statsA.mediaAuto/maxAuto)*100, statsA.fiabilidade, 100 - statsA.consistencia ];
        const dataB = [ (statsB.mediaTotal/maxPts)*100, (statsB.mediaAuto/maxAuto)*100, statsB.fiabilidade, 100 - statsB.consistencia ];

        const isDark = document.body.classList.contains('dark-theme');
        const textColor = isDark ? '#ffffff' : '#111827';
        const gridColor = isDark ? '#333333' : '#e5e7eb';

        appState.chartsInstances.compareRadar = new Chart(ctx, {
          type: 'radar',
          data: {
            labels: ['Força Total', 'Eficácia Auto', 'Fiabilidade', 'Consistência'],
            datasets: [
              { label: bpA.id || 'Versão A', data: dataA, backgroundColor: 'rgba(107, 114, 128, 0.2)', borderColor: '#6b7280', borderWidth: 2, pointBackgroundColor: '#6b7280' },
              { label: bpB.id || 'Versão B', data: dataB, backgroundColor: 'rgba(255, 94, 0, 0.4)', borderColor: '#FF5E00', borderWidth: 3, pointBackgroundColor: '#FF5E00' }
            ]
          },
          options: {
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: textColor } } },
            scales: { r: { angleLines: { color: gridColor }, grid: { color: gridColor }, pointLabels: { color: textColor, font: {size: 11} }, ticks: { display: false, min: 0, max: 100 } } }
          }
        });
      }, 50); 
    }

  } catch (error) {
    console.error(error);
    if(res) res.innerHTML = '<p style="text-align:center; color:var(--brand-red);">Erro ao processar as métricas cruzadas. Verifique a conexão.</p>';
  }
};