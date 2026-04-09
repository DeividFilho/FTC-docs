// js/match.js
import { appState, parseNumber } from './store.js';
import { db, ROBO_ATIVO, collection, addDoc, updateDoc, doc } from './firebase.js';
import { showToast } from './ui.js';

export function initMatchLogic() {
  document.getElementById('pontEsperada').addEventListener('input', calcMatchScore);
  
  document.querySelectorAll('.counter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target'); 
      const delta = Math.round(parseNumber(btn.getAttribute('data-delta')));
      const input = document.getElementById(targetId); 
      const display = document.getElementById('val-' + targetId);
      let val = Math.round(parseNumber(input.value)) || 0; 
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
        btn.classList.add('active-orange'); 
        appState.tagsProblemas = [btn.innerText]; 
        return; 
      }
      const btnLimpa = container.querySelector('.active-orange'); 
      if(btnLimpa) { btnLimpa.classList.remove('active-orange'); appState.tagsProblemas = []; }
      btn.classList.toggle('active'); 
      const val = btn.innerText;
      if(btn.classList.contains('active')) { 
        appState.tagsProblemas.push(val); 
      } else { 
        const idx = appState.tagsProblemas.indexOf(val); 
        if(idx > -1) appState.tagsProblemas.splice(idx, 1); 
      }
    });
  });

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-match-btn');
    if(btn) {
      const docId = btn.getAttribute('data-id');
      if(!confirm("Mover partida para a lixeira?")) return;
      try {
        await updateDoc(doc(db, "robos", ROBO_ATIVO, "versoes", appState.versaoAtiva, "partidas", docId), { apagado: true }); 
        showToast('Partida movida para lixeira.', 'success');
      } catch(err) { console.error(err); showToast('Erro ao excluir.', 'error'); }
    }
  });

  document.getElementById('btnSaveMatch').addEventListener('click', saveMatch);
  calcMatchScore();
}

export const calcMatchScore = () => {
  const getM = id => Math.round(parseNumber(document.getElementById(id).value)) || 0;
  const auto = getM('autoLeave') + (getM('autoClass') * 3) + (getM('autoOver') * 1) + (getM('autoPat') * 2);
  const tele = (getM('teleClass') * 3) + (getM('teleOver') * 1) + (getM('teleDepot') * 1) + (getM('telePat') * 2) + getM('teleBase') + getM('teleDouble');
  const fouls = (getM('foulMinor') * 10) + (getM('foulMajor') * 30);
  const total = auto + tele;

  document.getElementById('hudTotal').innerText = total; document.getElementById('hudAuto').innerText = auto;
  document.getElementById('hudTele').innerText = tele; document.getElementById('hudFouls').innerText = "-" + fouls;
  
  const max = parseNumber(document.getElementById('pontEsperada').value) || 100;
  const efic = max > 0 ? Math.round((total/max)*100) : 0;
  const elEfic = document.getElementById('hudEfic'); elEfic.innerText = efic + '%';
  if(efic >= 100) elEfic.style.color = 'var(--orange)'; else if(efic >= 50) elEfic.style.color = 'var(--text-main)'; else elEfic.style.color = 'var(--text-muted)';
};

async function saveMatch(e) {
  const btn = e.currentTarget;
  if (btn.disabled) return; 
  if(!appState.versaoAtiva) { showToast('Sem versão ativa configurada!', 'error'); return; }

  btn.disabled = true; 
  const originalHTML = btn.innerHTML; 
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gravando...'; 
  btn.classList.add('loading');

  const getM = id => Math.round(parseNumber(document.getElementById(id).value)) || 0;

  const matchData = {
    pilotos: document.getElementById('pilotos').value, 
    target: parseNumber(document.getElementById('pontEsperada').value),
    auto: Math.round(parseNumber(document.getElementById('hudAuto').innerText)), 
    tele: Math.round(parseNumber(document.getElementById('hudTele').innerText)), 
    total: Math.round(parseNumber(document.getElementById('hudTotal').innerText)), 
    fouls: (getM('foulMinor') * 10) + (getM('foulMajor') * 30),
    eficiencia: document.getElementById('hudEfic').innerText, 
    problemas: appState.tagsProblemas.length > 0 ? appState.tagsProblemas.join(', ') : 'Limpa', 
    timestamp: new Date(), 
    apagado: false
  };

  try {
    await addDoc(collection(db, "robos", ROBO_ATIVO, "versoes", appState.versaoAtiva, "partidas"), matchData);
    btn.innerHTML = '<i class="fas fa-check"></i> Gravado!'; 
    btn.classList.remove('loading'); btn.classList.add('success');
    showToast('Partida gravada na ' + appState.versaoAtiva, 'success');
    
    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizar Partida'; 
      btn.classList.remove('success');
      ['autoClass','autoOver','autoPat','teleClass','teleOver','teleDepot','telePat','foulMinor','foulMajor'].forEach(id => { document.getElementById(id).value = '0'; document.getElementById('val-'+id).innerText = '0'; });
      ['autoLeave','teleBase','teleDouble'].forEach(id => { const p = document.getElementById('sg-'+id); p.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active', 'active-orange')); p.querySelector('.seg-btn').classList.add('active'); document.getElementById(id).value = '0'; });
      appState.tagsProblemas = ['Partida Limpa']; document.querySelectorAll('#grp-problemas .tag').forEach(b => b.classList.remove('active', 'active-orange')); document.querySelector('#grp-problemas .tag[data-exclusive="true"]').classList.add('active-orange');
      calcMatchScore(); window.scrollTo(0,0); 
    }, 1500);

  } catch (err) { 
    console.error(err); showToast('Erro ao gravar.', 'error'); 
    btn.innerHTML = '<i class="fas fa-times"></i> Erro'; 
    btn.classList.remove('loading'); 
    setTimeout(() => { btn.innerHTML = originalHTML; }, 2000); 
  } finally {
    // Segurança Absoluta (Passo 2)
    btn.disabled = false; 
  }
}

export function renderMatchesTable() {
  const tbody = document.getElementById('matchesTableBody');
  if (!tbody) return;
  if (appState.matchesData.length === 0) { 
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 30px;">Nenhuma partida registada para <strong>${appState.versaoAtiva}</strong>.</td></tr>`; 
    return; 
  }
  
  let html = '';
  appState.matchesData.forEach(m => {
    const dataStr = m.timestamp ? new Date(m.timestamp.seconds * 1000).toLocaleDateString('pt-BR') : '-';
    html += `<tr><td>${dataStr}</td><td>${m.pilotos || '-'}</td><td>${m.auto || 0}</td><td>${m.tele || 0}</td>
      <td><strong>${m.total || 0}</strong></td><td style="color:var(--brand-red);">${m.fouls || 0}</td>
      <td>${m.eficiencia || '-'}</td><td>${m.problemas || 'Limpa'}</td>
      <td><button type="button" class="delete-match-btn" data-id="${m.docId}" title="Lixeira"><i class="fas fa-trash-alt"></i></button></td></tr>`;
  });
  
  if(appState.matchesData.length >= 100) {
      html += `<tr><td colspan="9" style="text-align:center; color: var(--text-muted); font-size: 11px; padding: 10px;">Mostrando as últimas 100 partidas.</td></tr>`;
  }
  tbody.innerHTML = html;
}