// Sign-in uses the same Firebase project as the PB dashboard.
// Config copied from the PB dashboard project (pegah-briefing).
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: 'AIzaSyB8PESAY2hQlqZaqcOoEjD3Bem1D7yWR-I',
  authDomain: 'pegah-briefing.firebaseapp.com',
  projectId: 'pegah-briefing',
  storageBucket: 'pegah-briefing.firebasestorage.app',
  messagingSenderId: '270388142674',
  appId: '1:270388142674:web:5798eac80648966f80f58b',
};

// Only these Google accounts can use the app
export const ALLOWED_EMAILS = ['pegah@originpoint.com', 'janie.houlgrave@compass.com', 'janiehoulgrave@gmail.com'];

// VITE_NO_AUTH=1 is only used for local testing and the shared preview; the live site always requires sign-in.
export const authEnabled = Boolean(firebaseConfig.apiKey) && !import.meta.env.VITE_NO_AUTH;

let auth = null;
export let app = null;
if (authEnabled) {
  app = initializeApp(firebaseConfig, 'pbflyers');
  auth = getAuth(app);
}

export const isAllowed = (user) => !!user && ALLOWED_EMAILS.includes((user.email || '').toLowerCase());
export const watchUser = (cb) => (auth ? onAuthStateChanged(auth, cb) : (cb(null), () => {}));
export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logOut = () => auth && signOut(auth);

// Short display name for "edited by" labels
export function whoIs(user) {
  const email = (user?.email || '').toLowerCase();
  if (email.startsWith('pegah')) return 'Pegah';
  if (email.startsWith('janie')) return 'Janie';
  return (user?.displayName || email || 'Someone').split(/[ @]/)[0];
}
