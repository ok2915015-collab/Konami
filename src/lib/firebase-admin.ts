import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

const app = getApps().length === 0 ? initializeApp({
  projectId: firebaseConfig.projectId,
}) : getApps()[0];

export const adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const adminAuth = getAuth(app);
