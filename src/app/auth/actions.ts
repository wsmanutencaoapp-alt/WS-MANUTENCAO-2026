'use server';

import { getSdks } from '@/firebase';
import {
  getAuth,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

// This is a temporary solution to initialize a server-side admin app.
// In a real application, you would use the Admin SDK and service accounts.
function getTempAdminApp() {
  if (getApps().some(app => app.name === 'temp-admin')) {
      return getSdks(getApps().find(app => app.name === 'temp-admin')!);
  }
  const app = initializeApp(firebaseConfig, 'temp-admin');
  return getSdks(app);
}


export async function handleSignUp(values: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const { auth, firestore } = getTempAdminApp();

  try {
    // 1. Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      values.email,
      values.password
    );
    const user = userCredential.user;

    // 2. Save additional user info to Firestore
    const userDocRef = doc(firestore, 'employees', user.uid);
    await setDoc(userDocRef, {
      id: user.uid,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: '', // Phone is optional in this form
    });
    
    return { success: true, userId: user.uid };
  } catch (error: any) {
    let errorMessage = 'An unexpected error occurred.';
    if (error.code) {
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email address is already in use.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'The email address is not valid.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email/password accounts are not enabled.';
          break;
        case 'auth/weak-password':
          errorMessage = 'The password is too weak.';
          break;
        default:
          errorMessage = error.message;
      }
    }
    return { success: false, error: errorMessage };
  }
}
