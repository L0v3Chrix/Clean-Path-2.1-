import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { authBypassEnabled, bypassUser } from '@/lib/authBypass';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({
    name: 'ClearPath',
    public_settings: {
      auth_required: false,
    },
  });

  useEffect(() => {
    if (authBypassEnabled) {
      setUser(bypassUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setAuthError(null);
      setAuthChecked(true);
      return undefined;
    }

    checkAppState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setIsAuthenticated(Boolean(session?.user));
      setAuthError(session?.user ? null : {
        type: 'auth_required',
        message: 'Authentication required'
      });
      setAuthChecked(true);
      setIsLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAppState = async () => {
    if (authBypassEnabled) {
      setUser(bypassUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setAuthError(null);
      setAuthChecked(true);
      return;
    }

    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      await checkUserAuth();
      setIsLoadingPublicSettings(false);
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    if (authBypassEnabled) {
      setUser(bypassUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthError(null);
      setAuthChecked(true);
      return;
    }

    try {
      setIsLoadingAuth(true);
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setUser(data.session?.user || null);
      setIsAuthenticated(Boolean(data.session?.user));
      setAuthError(data.session?.user ? null : {
        type: 'auth_required',
        message: 'Authentication required'
      });
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = async () => {
    if (authBypassEnabled) {
      setUser(bypassUser);
      setIsAuthenticated(true);
      return;
    }

    setUser(null);
    setIsAuthenticated(false);
    await supabase.auth.signOut();
  };

  const navigateToLogin = () => {
    window.location.assign('/login');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
