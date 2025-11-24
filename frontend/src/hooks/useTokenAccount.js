import { useCallback, useEffect, useState } from 'react';
import { fetchTokenSummary } from '../api';

const TOKEN_SNAPSHOT_KEY = 'tokenAccountSnapshot';

const readSnapshot = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(TOKEN_SNAPSHOT_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Unable to parse token account snapshot from localStorage', error);
    return null;
  }
};

const persistSnapshot = (snapshot) => {
  if (typeof window === 'undefined') {
    return;
  }
  if (snapshot) {
    window.localStorage.setItem(TOKEN_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } else {
    window.localStorage.removeItem(TOKEN_SNAPSHOT_KEY);
  }
  window.dispatchEvent(new CustomEvent('token-account-updated', { detail: snapshot }));
};

const getUserEmail = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem('userInfo');
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed.email || parsed.username || null;
  } catch (error) {
    console.warn('Unable to parse user info while fetching token account', error);
    return null;
  }
};

const useTokenAccount = () => {
  const [tokenAccount, setTokenAccount] = useState(() => (typeof window !== 'undefined' ? readSnapshot() : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    const email = getUserEmail();
    if (!email) {
      setTokenAccount(null);
      persistSnapshot(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTokenSummary(email);
      const snapshot = response?.tokens || null;
      setTokenAccount(snapshot);
      persistSnapshot(snapshot);
    } catch (err) {
      console.error('Failed to refresh token account', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleUpdated = (event) => {
      setTokenAccount(event.detail ?? readSnapshot());
    };

    const handleStorage = (event) => {
      if (event.key === TOKEN_SNAPSHOT_KEY) {
        try {
          setTokenAccount(event.newValue ? JSON.parse(event.newValue) : null);
        } catch (error) {
          console.warn('Unable to parse token snapshot from storage event', error);
        }
      }
    };

    const handleUserLoggedIn = () => {
      // User just logged in, refresh token account immediately
      refresh();
    };

    window.addEventListener('token-account-updated', handleUpdated);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('user-logged-in', handleUserLoggedIn);

    if (!tokenAccount) {
      refresh();
    }

    return () => {
      window.removeEventListener('token-account-updated', handleUpdated);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('user-logged-in', handleUserLoggedIn);
    };
  }, [refresh, tokenAccount]);

  const featuresEnabled = tokenAccount?.features_enabled || {};
  const isUnlimited = tokenAccount?.tokens_balance === 'unlimited' || tokenAccount?.tokens_balance === null || tokenAccount?.tokens_total === null;

  return {
    tokenAccount,
    featuresEnabled,
    isUnlimited,
    loading,
    error,
    refresh,
  };
};

export default useTokenAccount;
