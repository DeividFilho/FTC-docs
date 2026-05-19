// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence, collection, addDoc, setDoc, onSnapshot, deleteDoc, updateDoc, doc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAXCGGFmWCwHFbwv4jwDAJlw7DwiiNuRcE",
  authDomain: "ghost-data-8e9ed.firebaseapp.com",
  projectId: "ghost-data-8e9ed",
  storageBucket: "ghost-data-8e9ed.firebasestorage.app",
  messagingSenderId: "156456827509",
  appId: "1:156456827509:web:47874feaa84bda57c4563c",
  measurementId: "G-PTT6FJHHW5"
};

// Inicializa o App
export const app = initializeApp(firebaseConfig);

// Inicializa e exporta o Banco de Dados (Firestore)
export const db = getFirestore(app);

// Ativa o Modo Offline (Sobrevivência em Arena)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn("Múltiplas abas abertas, persistência offline falhou.");
  } else if (err.code == 'unimplemented') {
    console.warn("Navegador não suporta persistência offline.");
  }
});

// Inicializa e exporta a Autenticação
export const auth = getAuth(app);

// Variável global para saber qual robô estamos gerindo
export const ROBO_ATIVO = "metal_lab_principal"; 

export {
  collection, addDoc, setDoc, onSnapshot, deleteDoc, updateDoc, doc, query, orderBy, limit, getDocs,
  signInWithEmailAndPassword, onAuthStateChanged, signOut
};