// Accounts and saved plans. Uses Firebase (email + password) when config.js has keys,
// otherwise a demo mode that keeps one profile in this browser.
import { CONFIG } from "./settings.js";

export const DEMO = !CONFIG.firebase?.apiKey;
const FB = "https://www.gstatic.com/firebasejs/10.12.2";
let auth, db, fa, fs;

const demoGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const demoSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

export async function initStore(onUser) {
  if (DEMO) { onUser(demoGet("fe-demo-user")); return; }
  const [app, a, f] = await Promise.all([import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-firestore.js`)]);
  fa = a; fs = f;
  const fbApp = app.initializeApp(CONFIG.firebase);
  auth = a.getAuth(fbApp);
  db = f.getFirestore(fbApp);
  a.onAuthStateChanged(auth, (u) => onUser(u ? { uid: u.uid, email: u.email } : null));
}

const friendly = (e) => ({
  "auth/invalid-email": "That email address doesn’t look right.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "No account with this email. Create one first.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
}[e.code] || e.message);

export async function signUp(email, password) {
  if (DEMO) { const u = { uid: "demo", email }; demoSet("fe-demo-user", u); return u; }
  try { await fa.createUserWithEmailAndPassword(auth, email, password); } catch (e) { throw new Error(friendly(e)); }
}

export async function signIn(email, password) {
  if (DEMO) return signUp(email, password);
  try { await fa.signInWithEmailAndPassword(auth, email, password); } catch (e) { throw new Error(friendly(e)); }
}

export async function resetPassword(email) {
  if (DEMO) throw new Error("Password reset works once the site is connected to Firebase.");
  try { await fa.sendPasswordResetEmail(auth, email); } catch (e) { throw new Error(friendly(e)); }
}

export async function signOut() {
  if (DEMO) { localStorage.removeItem("fe-demo-user"); return; }
  await fa.signOut(auth);
}

export async function loadProfile(uid) {
  if (DEMO) return demoGet("fe-demo-profile");
  const snap = await fs.getDoc(fs.doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveProfile(uid, profile) {
  if (DEMO) { demoSet("fe-demo-profile", profile); return; }
  await fs.setDoc(fs.doc(db, "users", uid), { ...profile, updatedAt: Date.now() });
}
