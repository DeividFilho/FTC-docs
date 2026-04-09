// js/charts.js
import { appState } from './store.js';

function updateOrCreateChart(chartKey, canvasId, type, data, options) {
    if (appState.chartsInstances[chartKey]) {
        appState.chartsInstances[chartKey].data = data;
        appState.chartsInstances[chartKey].options = options;
        appState.chartsInstances[chartKey].update();
    } else {
        const ctx = document.getElementById(canvasId);
        if(ctx) appState.chartsInstances[chartKey] = new Chart(ctx, { type, data, options });
    }
}

export const refreshCharts = () => {
  const isDark = document.body.classList.contains('dark-theme');
  const textColor = isDark ? '#ffffff' : '#111827'; 
  const gridColor = isDark ? '#333333' : '#e5e7eb';
  const orange = '#FF5E00'; const green = '#10b981'; const blue = '#3b82f6'; const bgOrange = 'rgba(255, 94, 0, 0.2)';

  const sysCounts = { 'MEC_INT': 0, 'MEC_ELE': 0, 'DRV': 0, 'SEN': 0, 'SW': 0, 'STR': 0 };
  appState.engLogsData.forEach(log => { let s = log.ticket ? log.ticket.split('-')[0] : log.sys; if (s === 'MEC') s = 'MEC_INT'; if(sysCounts[s] !== undefined && log.tipo !== 'QA_DRILL') sysCounts[s]++; });

  updateOrCreateChart('polar', 'devOpsEffortChart', 'polarArea', 
    { labels: ['Intake', 'Elevador', 'Chassi', 'Sensores', 'Código', 'Estratégia'], datasets: [{ data: [sysCounts.MEC_INT, sysCounts.MEC_ELE, sysCounts.DRV, sysCounts.SEN, sysCounts.SW, sysCounts.STR], backgroundColor: [ orange, '#f59e0b', blue, '#8b5cf6', green, '#ef4444' ], borderWidth: 1, borderColor: isDark ? '#121212' : '#fff' }] },
    { maintainAspectRatio: false, scales: { r: { grid: { color: gridColor }, ticks: { display: false } } }, plugins: { legend: { display: true, position: 'right', labels: { color: textColor } } } }
  );

  const qaTotal = { 'DRV': 0, 'SEN': 0, 'MEC_INT': 0, 'MEC_ELE': 0, 'SW': 0, 'STR': 0 };
  const qaCount = { 'DRV': 0, 'SEN': 0, 'MEC_INT': 0, 'MEC_ELE': 0, 'SW': 0, 'STR': 0 };

  appState.engLogsData.forEach(log => {
    if (log.tipo === 'QA_DRILL' && log.sys && !log.apagado) {
      qaTotal[log.sys] += (log.eficienciaQA || 0);
      qaCount[log.sys] += 1;
    }
  });

  const radarDataQA = [
    qaCount['DRV'] > 0 ? Math.round(qaTotal['DRV'] / qaCount['DRV']) : 0,
    qaCount['SEN'] > 0 ? Math.round(qaTotal['SEN'] / qaCount['SEN']) : 0,
    qaCount['MEC_INT'] > 0 ? Math.round(qaTotal['MEC_INT'] / qaCount['MEC_INT']) : 0,
    qaCount['MEC_ELE'] > 0 ? Math.round(qaTotal['MEC_ELE'] / qaCount['MEC_ELE']) : 0,
    qaCount['SW'] > 0 ? Math.round(qaTotal['SW'] / qaCount['SW']) : 0,
    qaCount['STR'] > 0 ? Math.round(qaTotal['STR'] / qaCount['STR']) : 0
  ];

  // Passo 5: Tooltips no Gráfico de Radar
  updateOrCreateChart('radar', 'robotProfileRadarChart', 'radar', 
    { 
      labels: ['Chassi (DRV)', 'Sensores (SEN)', 'Intake (MEC)', 'Elevador (MEC)', 'Software (SW)', 'Estratégia (STR)'], 
      datasets: [{ label: 'Eficiência nos Testes (%)', data: radarDataQA, backgroundColor: bgOrange, borderColor: orange, pointBackgroundColor: orange }] 
    },
    { 
      maintainAspectRatio: false, 
      plugins: { 
        legend: { labels: { color: textColor } },
        tooltip: {
            callbacks: {
                label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) label += ': ';
                    if (context.parsed.r !== null) label += context.parsed.r + '%';
                    return label;
                },
                afterBody: function(tooltipItems) {
                    const item = tooltipItems[0].label;
                    if(item === 'Consistência' || item === 'Estratégia (STR)') return '\n(Mede a estabilidade e eficiência estratégica)';
                    if(item === 'Fiabilidade' || item === 'Sensores (SEN)') return '\n(Taxa de sucesso sem falhas mecânicas/leitura)';
                    return '';
                }
            }
        }
      }, 
      scales: { r: { angleLines: { color: gridColor }, grid: { color: gridColor }, pointLabels: { color: textColor, font: {size: 11} }, ticks: { display: false, min: 0, max: 100 } } } 
    }
  );

  if(appState.matchesData.length === 0) {
    document.getElementById('avgTotal').innerText = '0'; document.getElementById('bestMatch').innerText = '0';
    document.getElementById('consistencyCV').innerText = '--%'; document.getElementById('reliabilityRate').innerText = '--%';
    document.getElementById('failuresWrapper').innerHTML = `<p style="text-align:center; padding:30px; color:var(--text-muted);">Sem partidas em ${appState.versaoAtiva}</p>`;
    Object.keys(appState.chartsInstances).forEach(k => { 
        if(k !== 'polar' && k !== 'radar' && k !== 'compareRadar' && appState.chartsInstances[k]) { 
            appState.chartsInstances[k].destroy(); delete appState.chartsInstances[k]; 
        } 
    });
    return;
  }

  let labels = []; let totals = []; let autos = []; let teles = []; let efficiencySum = 0; let cleanMatches = 0; let count = 0; let foulsTotal = 0;
  let problemasCount = {}; let sumDetails = { autoLeave: 0, autoClass: 0, autoOver: 0, autoPat: 0, teleClass: 0, teleOver: 0, teleDepot: 0, telePat: 0, teleBase: 0, teleDouble: 0 };
  const sortedMatches = [...appState.matchesData].reverse();

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
  
  updateOrCreateChart('history', 'scoreHistoryChart', 'line', 
    { labels: labels, datasets: [ { label: 'Pts Totais', data: totals, borderColor: orange, backgroundColor: bgOrange, fill: true, tension: 0.3, borderWidth: 3, pointRadius: 4, pointBackgroundColor: orange }, { label: 'Média Móvel (3)', data: movingAvg, borderColor: blue, borderDash: [5,5], pointRadius: 0, fill: false, borderWidth: 2 } ] },
    { maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } }, scales: { y: { grid: {color: gridColor}, ticks: { color: textColor } }, x: { grid: {display:false}, ticks: { color: textColor } } } }
  );

  const avgAuto = autos.reduce((a,b)=>a+b, 0)/count; const avgTele = teles.reduce((a,b)=>a+b, 0)/count;
  updateOrCreateChart('avg', 'avgDistributionChart', 'bar', 
    { labels: ['Autônomo', 'Tele-Op'], datasets: [{ label: 'Pontuação Média', data: [avgAuto, avgTele], backgroundColor: [blue, green], borderRadius: 6 }] },
    { maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } }, scales: { y: { grid: {color: gridColor}, ticks: { color: textColor } }, x: { grid: {display: false}, ticks: { color: textColor } } } }
  );

  const finalEff = Math.round(efficiencySum / count);
  updateOrCreateChart('eff', 'efficiencyGaugeChart', 'doughnut', 
    { labels: ['Eficiência Média', 'Perda'], datasets: [{ data: [finalEff, 100 - finalEff > 0 ? 100 - finalEff : 0], backgroundColor: [orange, isDark ? '#242424' : '#e5e7eb'], borderWidth: 0 }] },
    { maintainAspectRatio: false, cutout: '75%', plugins: { legend: { labels: { color: textColor } } } }
  );

  const failuresWrapper = document.getElementById('failuresWrapper');
  if (Object.keys(problemasCount).length === 0) {
    failuresWrapper.innerHTML = `<div style="text-align:center; color:${green}; display:flex; flex-direction:column; align-items:center;"><i class="fas fa-check-circle" style="font-size:40px; margin-bottom:10px;"></i><span style="font-weight:700;">Tudo Limpo!</span><span style="font-size:12px; color:var(--text-muted);">Nenhum problema registado.</span><canvas id="failuresChart" style="display:none;"></canvas></div>`;
    if(appState.chartsInstances.failures) { appState.chartsInstances.failures.destroy(); delete appState.chartsInstances.failures; }
  } else {
    if(!document.getElementById('failuresChart')) failuresWrapper.innerHTML = '<canvas id="failuresChart"></canvas>';
    updateOrCreateChart('failures', 'failuresChart', 'pie', 
        { labels: Object.keys(problemasCount), datasets: [{ data: Object.values(problemasCount), backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#64748b'], borderWidth: 2, borderColor: isDark ? '#121212' : '#fff' }] }, 
        { maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } } }
    );
  }

  const scatterData = sortedMatches.map(m => ({ x: m.auto || 0, y: m.total || 0 }));
  updateOrCreateChart('scatter', 'scatterAutoTotalChart', 'scatter', 
    { datasets: [{ label: 'Partidas', data: scatterData, backgroundColor: orange, pointRadius: 6 }] },
    { maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'Pontos Autônomo', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } }, y: { title: { display: true, text: 'Pontos Totais', color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } } }, plugins: { legend: { labels: { color: textColor } } } }
  );

  const contribLabels = ['Leave Auto', 'Classified Auto', 'Overflow Auto', 'Pattern Auto', 'Classified Tele', 'Overflow Tele', 'Depot Tele', 'Pattern Tele', 'Base', 'Double Base'];
  const contribData = [ sumDetails.autoLeave / count, sumDetails.autoClass / count, sumDetails.autoOver / count, sumDetails.autoPat / count, sumDetails.teleClass / count, sumDetails.teleOver / count, sumDetails.teleDepot / count, sumDetails.telePat / count, sumDetails.teleBase / count, sumDetails.teleDouble / count ];
  const filteredLabels = contribLabels.filter((_, i) => contribData[i] > 0); const filteredData = contribData.filter(v => v > 0);
  
  updateOrCreateChart('contribution', 'contributionPieChart', 'pie', 
    { labels: filteredLabels.length ? filteredLabels : ['Sem dados'], datasets: [{ data: filteredData.length ? filteredData : [1], backgroundColor: ['#FF5E00','#F59E0B','#3B82F6','#10B981','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#A855F7'] }] },
    { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor } } } }
  );
};