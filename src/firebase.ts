import { initializeApp } from 'firebase/app';
import {
  ConfirmationResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile } from './types/social';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function getAppContinueUrl(): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin && !origin.includes('localhost')) {
      return origin;
    }
  }
  return 'https://gen-lang-client-0363394582.web.app/';
}

export function isFirebaseUserVerified(user: FirebaseUser | null): boolean {
  if (!user) return false;
  return Boolean(user.emailVerified || user.phoneNumber);
}

export async function signInWithGooglePopup(): Promise<FirebaseUser> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function registerFirebaseEmailUser(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  await sendEmailVerification(cred.user, {
    url: getAppContinueUrl(),
    handleCodeInApp: false,
  });
  return cred.user;
}

export async function resendVerificationEmailForCurrentUser(): Promise<void> {
  if (!auth.currentUser) throw new Error('No active session.');
  await sendEmailVerification(auth.currentUser, {
    url: getAppContinueUrl(),
    handleCodeInApp: false,
  });
}

export async function refreshCurrentFirebaseUser(): Promise<FirebaseUser | null> {
  if (!auth.currentUser) return null;
  await reload(auth.currentUser);
  return auth.currentUser;
}

export async function signInFirebaseEmail(email: string, password: string): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function sendFirebasePasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email, { url: getAppContinueUrl() });
}

export function createPhoneRecaptcha(containerId: string): RecaptchaVerifier {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'normal',
  });
}

export async function sendFirebasePhoneOtp(
  phoneNumberE164: string,
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phoneNumberE164, verifier);
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function subscribeFirebaseAuth(cb: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function syncProfileToFirestore(profile: UserProfile): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !isFirebaseUserVerified(auth.currentUser)) return;

  const publicPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;

  try {
    const publicPayload: Record<string, unknown> = {
      uid,
      name: profile.name.slice(0, 100),
      handle: profile.handle.slice(0, 50),
      avatar: (profile.avatar || '').slice(0, 500),
      avatarColor: (profile.avatarColor || '#4F46E5').slice(0, 24),
      coverImage: (profile.coverImage || '').slice(0, 500),
      status: (profile.status || '').slice(0, 240),
      location: (profile.location || 'Labo, Philippines').slice(0, 120),
      country: (profile.country || 'Philippines').slice(0, 80),
      language: (profile.language || 'English').slice(0, 100),
      preferredLanguage: (profile.preferredLanguage || 'English').slice(0, 60),
      bio: (profile.bio || '').slice(0, 600),
      quote: (profile.quote || '').slice(0, 240),
      privacy: profile.privacy || 'public',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(doc(db, 'users', uid), {
        name: publicPayload.name,
        handle: publicPayload.handle,
        avatar: publicPayload.avatar,
        avatarColor: publicPayload.avatarColor,
        coverImage: publicPayload.coverImage,
        status: publicPayload.status,
        location: publicPayload.location,
        country: publicPayload.country,
        language: publicPayload.language,
        preferredLanguage: publicPayload.preferredLanguage,
        bio: publicPayload.bio,
        quote: publicPayload.quote,
        privacy: publicPayload.privacy,
        updatedAt: serverTimestamp(),
      });
    } catch {
      await setDoc(doc(db, 'users', uid), publicPayload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, publicPath);
  }

  try {
    await setDoc(
      doc(db, 'users', uid, 'private', 'info'),
      {
        uid,
        email: (profile.email || auth.currentUser?.email || '').slice(0, 200),
        mobile: (profile.mobile || auth.currentUser?.phoneNumber || '').slice(0, 32),
        birthday: (profile.birthday || '').slice(0, 20),
        gender: (profile.gender || '').slice(0, 40),
        autoTranslate: Boolean(profile.autoTranslate),
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, privatePath);
  }
}

export async function syncPostToFirestore(post: {
  id: string;
  content: string;
  location?: string;
  country?: string;
  privacy?: string;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !isFirebaseUserVerified(auth.currentUser)) return;
  const docId = post.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  const path = `posts/${docId}`;
  try {
    await setDoc(doc(db, 'posts', docId), {
      id: docId,
      authorId: uid,
      content: post.content.slice(0, 3000),
      location: (post.location || '').slice(0, 120),
      country: (post.country || '').slice(0, 80),
      privacy: post.privacy || 'public',
      sharesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function syncUserSecuritySettingsToFirestore(settings: {
  mfaEnabled: boolean;
  mfaMethod?: 'authenticator_code' | 'email_otp';
  recoveryEmailBackup?: string;
  securityNotificationsEnabled: boolean;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !isFirebaseUserVerified(auth.currentUser)) return;
  const path = `userSecuritySettings/${uid}`;
  try {
    await setDoc(doc(db, 'userSecuritySettings', uid), {
      uid,
      mfaEnabled: Boolean(settings.mfaEnabled),
      mfaMethod: settings.mfaMethod || 'authenticator_code',
      ...(settings.recoveryEmailBackup
        ? { recoveryEmailBackup: settings.recoveryEmailBackup.slice(0, 200) }
        : {}),
      securityNotificationsEnabled: Boolean(settings.securityNotificationsEnabled),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncRecoverySummaryToFirestore(summary: {
  id: string;
  referenceNumber: string;
  purpose: 'account_recovery' | 'hybrid_identity_verification';
  idType: string;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !isFirebaseUserVerified(auth.currentUser)) return;
  const docId = summary.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  const path = `recoveryRequests/${docId}`;
  try {
    await setDoc(doc(db, 'recoveryRequests', docId), {
      id: docId,
      referenceNumber: summary.referenceNumber.slice(0, 40),
      applicantUid: uid,
      purpose: summary.purpose,
      idType: summary.idType.slice(0, 60),
      status: 'pending_review',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

