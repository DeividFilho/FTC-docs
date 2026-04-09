// js/ui.js
import { appState, SUBSYSTEMS } from './store.js';
import { refreshCharts } from './charts.js';

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

// SPINNER GLOBAL FUNÇÕES
export function showGlobalSpinner() {
  const spinner = document.getElementById('global-spinner');
  if (spinner) spinner.classList.remove('hidden');
}

export function hideGlobalSpinner() {
  const spinner = document.getElementById('global-spinner');
  if (spinner) spinner.classList.add('hidden');
}

export function initUI() {
  document.getElementById('themeToggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark-theme');
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    if(document.getElementById('sec-charts').classList.contains('active')) refreshCharts(); 
  });

  document.querySelectorAll('.nav-tab[data-target-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => switchTab(e.currentTarget.getAttribute('data-target-tab')));
  });

  renderSubsystemCards();
}

export const switchTab = (tabId) => {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tabs .nav-tab').forEach(t => t.classList.remove('active'));
  
  const activeSection = document.getElementById('sec-' + tabId);
  if(activeSection) activeSection.classList.add('active');
  
  const activeTabBtn = document.querySelector(`.nav-tab[data-target-tab="${tabId}"]`);
  if(activeTabBtn) activeTabBtn.classList.add('active');

  document.getElementById('btnSaveMatch').style.display = 'none';
  document.getElementById('btnSaveBlueprint').style.display = 'none';

  if(tabId === 'match') { document.getElementById('btnSaveMatch').style.display = 'flex'; } 
  else if (tabId === 'robot') { 
    document.getElementById('btnSaveBlueprint').style.display = 'flex'; 
    document.dispatchEvent(new CustomEvent('loadBlueprintData')); 
  } 
  else if (tabId === 'charts') { setTimeout(refreshCharts, 100); } 
  else if (tabId === 'compare') { document.dispatchEvent(new CustomEvent('renderCompareData')); }
};

function renderSubsystemCards() {
  const grid = document.getElementById('subsystems-grid');
  if(!grid) return;
  
  grid.innerHTML = SUBSYSTEMS.map(sys => `
    <div class="panel" style="padding: 20px; margin-bottom: 0;">
       <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
          <span class="panel-title" style="margin:0; font-size:13px;"><i class="fas ${sys.icon}"></i> ${sys.id} - ${sys.name}</span>
          <span class="badge-decode" id="badge-${sys.id}" style="background:var(--text-muted); color:#fff;">Sem dados</span>
       </div>
       <div style="display:flex; gap:6px; margin-top: 16px;">
          <button type="button" class="nav-tab active" data-action="openEngForm" data-sys="${sys.id}" style="flex:1; justify-content:center; padding: 8px 0; font-size: 11px;" title="Novo Commit"><i class="fas fa-plus"></i> Commit</button>
          <button type="button" class="nav-tab" data-action="openDrillForm" data-sys="${sys.id}" style="flex:1; justify-content:center; background:#3b82f6; color:#fff; border:none; padding: 8px 0; font-size: 11px; box-shadow: var(--shadow-sm);" title="Rodar Teste de Qualidade"><i class="fas fa-vial"></i> Testar</button>
          <button type="button" class="nav-tab" data-action="viewHistory" data-sys="${sys.id}" style="flex:1; justify-content:center; background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-light); padding: 8px 0; font-size: 11px;" title="Ver Histórico"><i class="fas fa-history"></i> Ver</button>
       </div>
    </div>
  `).join('');
}