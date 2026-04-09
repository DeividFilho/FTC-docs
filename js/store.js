// js/store.js

// 1. Estado Centralizado (Single Source of Truth)
export const appState = {
  versaoAtiva: "v1.0 - Base Build",
  engLogsData: [],
  blueprintsData: [], 
  matchesData: [], 
  chartsInstances: {}, 
  tagsProblemas: ['Partida Limpa'],
  robotVersionsArray: [],
  isViewingGlobalHistory: false,
  dbInitialized: false 
};

// 2. Constantes Globais
export const SUBSYSTEMS = [
  { id: 'DRV', name: 'Chassi', icon: 'fa-truck-monster' },
  { id: 'SEN', name: 'Sensores', icon: 'fa-satellite-dish' },
  { id: 'MEC_INT', name: 'Intake', icon: 'fa-claw-marks' },
  { id: 'MEC_ELE', name: 'Elevador', icon: 'fa-arrows-alt-v' },
  { id: 'SW', name: 'Software', icon: 'fa-laptop-code' },
  { id: 'STR', name: 'Estratégia', icon: 'fa-chess-knight' }
];

// 3. Utilitários Globais
export const parseNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  return parseFloat(val.toString().replace(',', '.')) || 0;
};