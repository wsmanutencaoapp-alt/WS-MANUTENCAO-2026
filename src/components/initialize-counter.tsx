'use client';

import { useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect } from 'react';

/**
 * An invisible component that ensures the employee counter document exists in Firestore.
 */
export function InitializeCounter() {
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;

    const counterRef = doc(firestore, 'counters', 'employees');

    const initialize = async () => {
      const docSnap = await getDoc(counterRef);
      if (!docSnap.exists()) {
        // Initialize the counter if it doesn't exist.
        // Set to 1000 so the first user gets 1001.
        await setDoc(counterRef, { lastId: 1000 });
        console.log('Contador de funcionários inicializado em 1000.');
      }
    };

    initialize().catch(console.error);
  }, [firestore]);

  // This component renders nothing.
  return null;
}
