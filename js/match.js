// js/match.js – Versão OBR 2026 Robótica de Resgate
// Multiplicadores corrigidos conforme manual: 4x (3 vítimas), 3x (2 vítimas), 2x (1 vítima), 1x (nenhuma)
import { appState, parseNumber } from './store.js';
import { db, ROBO_ATIVO, collection, addDoc, updateDoc, doc } from './firebase.js';
import { showToast } from './ui.js';

// Estado interno do módulo
let currentAttempt = 1;          // 1,2,3,4+
let totalTrajectoryPoints = 0;
let arrivalPoints = 0;
let rescueMultiplier = 1;
let surpriseMultiplier = 1;

// Elementos do DOM
let trajectoryPointsSpan, arrivalPointsSpan, totalBeforeMultiplierSpan;
let rescueMultSpan, surpriseMultSpan, finalScoreSpan;

export function initMatchLogic() {
  // Captura elementos
  trajectoryPointsSpan = document.getElementById('trajectoryPoints');
  arrivalPointsSpan = document.getElementById('arrivalPoints');
  totalBeforeMultiplierSpan = document.getElementById('totalBeforeMultiplier');
  rescueMultSpan = document.getElementById('rescueMultiplier');
  surpriseMultSpan = document.getElementById('surpriseMultiplier');
  finalScoreSpan = document.getElementById('finalScore');

  // Botões de perigos
  document.querySelectorAll('.danger-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = btn.dataset.type;
      const value = parseInt(btn.dataset.value, 10);
      addHazardPoints(type, value);
    });
  });

  // Botão de checkpoint (avançar)
  const btnCheckpoint = document.getElementById('btnCheckpoint');
  if (btnCheckpoint) btnCheckpoint.addEventListener('click', () => advanceCheckpoint());

  // Botão de registrar resgate
  const btnRescue = document.getElementById('btnRecordRescue');
  if (btnRescue) btnRescue.addEventListener('click', () => recordRescue());

  // Botão de chegada
  const btnArrival = document.getElementById('btnArrival');
  if (btnArrival) btnArrival.addEventListener('click', () => {
    if (arrivalPoints === 0) {
      setArrivalPoints();
      showToast(`Ladrilho de chegada! +${arrivalPoints} pontos`, 'success');
    } else {
      showToast('Chegada já registrada.', 'warning');
    }
  });

  // Checkbox de desafio surpresa
  const chkSurprise = document.getElementById('surpriseCompleted');
  if (chkSurprise) chkSurprise.addEventListener('change', (e) => {
    surpriseMultiplier = e.target.checked ? 1.5 : 1;
    surpriseMultSpan.innerText = surpriseMultiplier.toFixed(1);
    updateFinalScore();
  });

  // Botão de reset da rodada (nova tentativa)
  const btnResetRound = document.getElementById('btnResetRound');
  if (btnResetRound) btnResetRound.addEventListener('click', () => resetRound());

  // Gravar partida
  const btnSave = document.getElementById('btnSaveMatch');
  if (btnSave) btnSave.addEventListener('click', saveMatch);

  // Inicializar visor
  resetRound();
}

function addHazardPoints(type, points) {
  if (arrivalPoints > 0) {
    showToast('Rodada já terminou no ladrilho de chegada!', 'warning');
    return;
  }
  totalTrajectoryPoints += points;
  updateUI();
  showToast(`${type} superado! +${points} pts`, 'success');
}

function advanceCheckpoint() {
  if (arrivalPoints > 0) return;
  
  // Pontuação conforme a tentativa (1ª = 5, 2ª = 3, 3ª = 1, 4ª+ = 0)
  const pointsMap = {1:5, 2:3, 3:1};
  const checkpointPoints = pointsMap[currentAttempt] || 0;
  totalTrajectoryPoints += checkpointPoints;
  
  // Incrementa tentativa para o próximo checkpoint (máximo 4)
  if (currentAttempt < 4) currentAttempt++;
  
  updateUI();
  if (checkpointPoints > 0) {
    showToast(`Checkpoint atingido! +${checkpointPoints} pts (${currentAttempt-1}ª tentativa)`, 'info');
  } else {
    showToast(`Checkpoint atingido (sem pontos - 4ª+ tentativa)`, 'info');
  }
}

function recordRescue() {
  const liveCorrect = parseInt(document.getElementById('liveCorrect').value, 10) || 0;
  const deadCorrect = parseInt(document.getElementById('deadCorrect').value, 10) || 0;
  const totalVictims = liveCorrect + deadCorrect;
  
  // Multiplicador conforme manual OBR 2026 (pág. 43)
  // 4x: todas as 3 vítimas (2 vivas + 1 morta)
  // 3x: 2 vítimas (qualquer combinação)
  // 2x: 1 vítima (viva ou morta)
  // 1x: nenhuma
  let mult = 1;
  if (totalVictims === 3 && liveCorrect === 2 && deadCorrect === 1) {
    mult = 4.0;
  } else if (totalVictims === 2) {
    mult = 3.0;
  } else if (totalVictims === 1) {
    mult = 2.0;
  } else {
    mult = 1.0;
  }
  
  rescueMultiplier = mult;
  rescueMultSpan.innerText = rescueMultiplier.toFixed(1);
  updateFinalScore();
  showToast(`Resgate registado! Multiplicador = ${rescueMultiplier}x`, 'success');
}

function setArrivalPoints() {
  let attemptsUsed = Math.min(currentAttempt - 1, 3); // 0,1,2,3
  arrivalPoints = Math.max(0, 60 - 5 * attemptsUsed);
  arrivalPointsSpan.innerText = arrivalPoints;
  updateFinalScore();
}

function updateUI() {
  trajectoryPointsSpan.innerText = totalTrajectoryPoints;
  arrivalPointsSpan.innerText = arrivalPoints;
  const subtotal = totalTrajectoryPoints + arrivalPoints;
  totalBeforeMultiplierSpan.innerText = subtotal;
  updateFinalScore();
}

function updateFinalScore() {
  const subtotal = totalTrajectoryPoints + arrivalPoints;
  const final = Math.ceil(subtotal * rescueMultiplier * surpriseMultiplier);
  finalScoreSpan.innerText = final;
}

function resetRound() {
  currentAttempt = 1;
  totalTrajectoryPoints = 0;
  arrivalPoints = 0;
  rescueMultiplier = 1;
  surpriseMultiplier = document.getElementById('surpriseCompleted')?.checked ? 1.5 : 1;
  
  // Resetar UI
  if (document.getElementById('liveCorrect')) {
    document.getElementById('liveCorrect').value = 0;
    document.getElementById('deadCorrect').value = 0;
  }
  if (document.getElementById('surpriseCompleted')) {
    document.getElementById('surpriseCompleted').checked = (surpriseMultiplier === 1.5);
  }
  
  rescueMultSpan.innerText = rescueMultiplier.toFixed(1);
  surpriseMultSpan.innerText = surpriseMultiplier.toFixed(1);
  arrivalPointsSpan.innerText = '0';
  trajectoryPointsSpan.innerText = '0';
  totalBeforeMultiplierSpan.innerText = '0';
  finalScoreSpan.innerText = '0';
  showToast('Rodada reiniciada. Nova tentativa.', 'info');
}

async function saveMatch(e) {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  if (!appState.versaoAtiva) {
    showToast('Sem versão ativa configurada!', 'error');
    return;
  }
  
  const subtotal = totalTrajectoryPoints + arrivalPoints;
  const final = parseInt(finalScoreSpan.innerText, 10);
  
  const matchData = {
    pilotos: document.getElementById('pilotos').value.trim() || 'Equipe OBR',
    timestamp: new Date(),
    trajetoriaPontos: totalTrajectoryPoints,
    chegadaPontos: arrivalPoints,
    subtotal: subtotal,
    multiplicadorResgate: rescueMultiplier,
    multiplicadorSurpresa: surpriseMultiplier,
    pontuacaoFinal: final,
    vidasVivasSalvas: parseInt(document.getElementById('liveCorrect')?.value || 0, 10),
    vidasMortasSalvas: parseInt(document.getElementById('deadCorrect')?.value || 0, 10),
    tentativasCheckpoint: currentAttempt - 1,
    apagado: false
  };
  
  btn.disabled = true;
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gravando...';
  
  try {
    await addDoc(collection(db, "robos", ROBO_ATIVO, "versoes", appState.versaoAtiva, "partidas"), matchData);
    showToast(`Partida OBR registada! Pontuação final: ${final}`, 'success');
    btn.innerHTML = '<i class="fas fa-check"></i> Gravado!';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      resetRound();
    }, 1500);
  } catch (err) {
    console.error(err);
    showToast('Erro ao gravar partida.', 'error');
    btn.innerHTML = '<i class="fas fa-times"></i> Erro';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }, 2000);
  }
}

export function renderMatchesTable() {
  const tbody = document.getElementById('matchesTableBody');
  if (!tbody) return;
  if (appState.matchesData.length === 0) { 
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px;">Nenhuma partida registada para <strong>${appState.versaoAtiva}</strong>.</td></tr>`; 
    return; 
  }
  
  let html = '';
  appState.matchesData.forEach(m => {
    const dataStr = m.timestamp ? new Date(m.timestamp.seconds * 1000).toLocaleDateString('pt-BR') : '-';
    html += `<tr>
      <td>${dataStr}</td>
      <td>${m.pilotos || '-'}</td>
      <td>${m.trajetoriaPontos || 0}</td>
      <td>${m.chegadaPontos || 0}</td>
      <td><strong>${m.pontuacaoFinal || 0}</strong></td>
      <td>${m.multiplicadorResgate || 1}x / ${m.multiplicadorSurpresa || 1}x</td>
      <td><button type="button" class="delete-match-btn" data-id="${m.docId}" title="Lixeira"><i class="fas fa-trash-alt"></i></button></td>
    </tr>`;
  });
  tbody.innerHTML = html;
}