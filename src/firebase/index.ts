'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

let services: { firebaseApp: FirebaseApp; auth: Auth; firestore: Firestore; storage: FirebaseStorage; } | null = null;
let persistenceEnabled = false;

/**
 * Inicializa os serviços do Firebase.
 * Configurado para utilizar a instância de banco de dados 'operation-manager'.
 */
export function initializeFirebase() {
  if (services) {
    return services;
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  
  // CRITICAL: Conectando especificamente à instância 'operation-manager' conforme estrutura do projeto.
  const firestore = getFirestore(app, 'operation-manager');

  // Habilita persistência offline (apenas no cliente)
  if (typeof window !== 'undefined' && !persistenceEnabled) {
    persistenceEnabled = true;
    enableIndexedDbPersistence(firestore).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence could not be enabled: Multiple tabs open or a previous session did not shut down cleanly.');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence is not supported in this browser.');
      } else {
        console.error("Error enabling Firestore persistence:", err);
      }
    });
  }

  services = {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: firestore,
    storage: getStorage(app),
  };

  return services;
}


export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
