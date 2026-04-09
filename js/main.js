// js/main.js
import { db, ROBO_ATIVO, collection, onSnapshot, query, orderBy, limit } from './firebase.js';
import { initAuth } from './auth.js';
import { appState } from './store.js';
import { initUI, switchTab, showToast, hideGlobalSpinner, showGlobalSpinner } from './ui.js';
import { initMatchLogic, renderMatchesTable } from './match.js';
import { refreshCharts } from './charts.js';
import { initBlueprintLogic, updateCompareDropdowns } from './blueprint.js';
import { initEngineeringLogic, renderFilteredEngFeed, updateSubsystemsBadges } from './engineering.js';

let unsubscribePartidas = null;
let unsubscribeVersoes = null;
let unsubscribeEngenharia = null;

initUI();
initMatchLogic();
initEngineeringLogic();
initBlueprintLogic();
switchTab('match');
initAuth();

export function stopDatabaseListeners() {
    if(unsubscribeVersoes) unsubscribeVersoes();
    if(unsubscribePartidas) unsubscribePartidas();
    if(unsubscribeEngenharia) unsubscribeEngenharia();
}

export function initDatabaseListeners() {
  if (unsubscribeVersoes) unsubscribeVersoes(); 
  
  let isFirstLoad = (appState.versaoAtiva === "v1.0 - Base Build");
  
  unsubscribeVersoes = onSnapshot(collection(db, "robos", ROBO_ATIVO, "versoes"), (snapshot) => {
    const select = document.getElementById('globalVersionSelect');
    if(!select) return;

    const currentVal = select.value;
    select.innerHTML = ''; 
    appState.blueprintsData = []; 
    appState.robotVersionsArray = [];

    if (snapshot.empty) {
      const opt = document.createElement('option'); opt.value = "V1.0"; opt.text = "V1.0"; 
      select.appendChild(opt); 
      appState.robotVersionsArray.push("V1.0");
    } else {
      let versoesTemporarias = [];
      snapshot.forEach((docItem) => {
        versoesTemporarias.push({ id: docItem.id, ...docItem.data() });
      });

      versoesTemporarias.sort((a, b) => {
        const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
        return timeB - timeA; 
      });

      versoesTemporarias.forEach((data) => {
        appState.blueprintsData.push(data); 
        appState.robotVersionsArray.push(data.id);
        const option = document.createElement('option'); 
        option.value = data.id; 
        option.text = data.id; 
        select.appendChild(option);
      });
    }

    if (isFirstLoad && appState.robotVersionsArray.length > 0) {
        select.value = appState.robotVersionsArray[0];
        isFirstLoad = false; 
    } 
    else if (appState.robotVersionsArray.includes(currentVal)) {
        select.value = currentVal; 
    } 
    else if (select.options.length > 0) {
        select.value = select.options[0].value; 
    }
    
    appState.versaoAtiva = select.value; 
    const matchDropdown = document.getElementById('matchMec');
    if(matchDropdown) matchDropdown.innerHTML = `<option value="${appState.versaoAtiva}">${appState.versaoAtiva}</option>`;
    
    updateCompareDropdowns();
    iniciarEscutasDaVersao(); 
  });
}

const globalSelect = document.getElementById('globalVersionSelect');
if(globalSelect) {
  globalSelect.addEventListener('change', (e) => {
      showGlobalSpinner(); // Mostra spinner na mudança manual de versão
      appState.versaoAtiva = e.target.value; 
      showToast(`Contexto alterado: ${appState.versaoAtiva}`, 'success'); 
      
      const matchDropdown = document.getElementById('matchMec');
      if(matchDropdown) matchDropdown.innerHTML = `<option value="${appState.versaoAtiva}">${appState.versaoAtiva}</option>`;
      
      appState.isViewingGlobalHistory = false;
      const btnReset = document.getElementById('btnResetFeed');
      if (btnReset) btnReset.style.display = 'none';

      iniciarEscutasDaVersao();
  });
}

function iniciarEscutasDaVersao() {
  if(unsubscribePartidas) unsubscribePartidas();
  if(unsubscribeEngenharia) unsubscribeEngenharia();

  const feedTitle = document.getElementById('feedTitle');
  if(feedTitle) feedTitle.innerHTML = `<i class="fas fa-list"></i> Linha do Tempo Unificada (${appState.versaoAtiva})`;

  const pathPartidas = collection(db, "robos", ROBO_ATIVO, "versoes", appState.versaoAtiva, "partidas");
  unsubscribePartidas = onSnapshot(query(pathPartidas, orderBy("timestamp", "desc"), limit(100)), (snap) => {
    appState.matchesData = [];
    snap.forEach(docItem => {
      let data = docItem.data();
      if (!data.apagado) appState.matchesData.push({ docId: docItem.id, ...data }); 
    });
    renderMatchesTable();
    if(document.getElementById('sec-charts')?.classList.contains('active')) refreshCharts();
  });
  
  const pathEng = collection(db, "robos", ROBO_ATIVO, "versoes", appState.versaoAtiva, "engenharia");
  unsubscribeEngenharia = onSnapshot(query(pathEng, orderBy("timestamp", "desc")), (snap) => {
    appState.engLogsData = [];
    snap.forEach(docItem => {
      let data = docItem.data();
      if (!data.apagado) appState.engLogsData.push({ docId: docItem.id, ...data }); 
    });
    
    updateSubsystemsBadges(); 
    if(!appState.isViewingGlobalHistory) { renderFilteredEngFeed(appState.engLogsData, false); }
    
    // TUDO CARREGOU: Esconde o Spinner!
    setTimeout(hideGlobalSpinner, 800); 
  });
}