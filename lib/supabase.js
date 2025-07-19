import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, processLock } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../constants/index'

// Only import URL polyfill in non-web environments
if (typeof window === 'undefined' || Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
})
// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated. This should
// only be registered once.
if (Platform.OS !== 'web' && typeof AppState !== 'undefined') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
}

export async function signUpWithEmail(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signInWithEmail(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

const handleSignup = async () => {
  setError('');
  if (!fullName || !yearLevel || !block || !gender) {
    setError('Full Name, Year Level, Block, and Gender are required.');
    return;
  }
  if (!email || !password) {
    setError('Email and password are required.');
    return;
  }
  if (password !== confirmPassword) {
    setError('Passwords do not match.');
    return;
  }
  setLoading(true);
  const { data, error } = await signUpWithEmail(email, password);
  setLoading(false);
  if (error) {
    setError(error.message);
  } else {
    setError('Check your email to confirm your account before logging in.');
  }
};