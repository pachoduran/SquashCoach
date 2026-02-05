import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

interface User {
  user_id: string;
  email: string;
  name: string;
  phone?: string;
  picture?: string;
  auth_type?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
  sessionToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Get backend URL - HARDCODED para APK
const getBackendUrl = () => {
  return 'https://lev.jsb.mybluehost.me:8001';
};

const BACKEND_URL = getBackendUrl();
const AUTH_STORAGE_KEY = '@squash_coach_auth';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    checkExistingSession();
    
    // Handle deep links for mobile
    if (Platform.OS !== 'web') {
      // Cold start - check initial URL
      Linking.getInitialURL().then((url) => {
        if (url) {
          handleAuthRedirect(url);
        }
      });
    } else {
      // Web - check hash
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash;
        if (hash.includes('session_id=')) {
          const sessionId = extractSessionId(hash);
          if (sessionId) {
            exchangeSessionId(sessionId);
          }
        }
      }
    }
  }, []);

  const extractSessionId = (urlOrHash: string): string | null => {
    // Try hash format: #session_id=xxx
    let match = urlOrHash.match(/[#?&]session_id=([^&]+)/);
    if (match) return match[1];
    
    // Try query format: ?session_id=xxx
    match = urlOrHash.match(/session_id=([^&]+)/);
    return match ? match[1] : null;
  };

  const handleAuthRedirect = async (url: string) => {
    const sessionId = extractSessionId(url);
    if (sessionId) {
      await exchangeSessionId(sessionId);
    }
  };

  const checkExistingSession = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        
        // Verify session is still valid
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${data.sessionToken}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setSessionToken(data.sessionToken);
        } else {
          // Session expired, clear storage
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.log('Error checking session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exchangeSessionId = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const url = `${BACKEND_URL}/api/auth/session`;
      console.log('[AUTH] Exchanging session at:', url);
      console.log('[AUTH] BACKEND_URL:', BACKEND_URL);
      console.log('[AUTH] Session ID:', sessionId?.substring(0, 10) + '...');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[AUTH] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        
        setUser({
          user_id: data.user_id,
          email: data.email,
          name: data.name,
          phone: data.phone,
          picture: data.picture,
          auth_type: 'google'
        });
        setSessionToken(data.session_token);
        
        // Store session
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
          user: {
            user_id: data.user_id,
            email: data.email,
            name: data.name,
            phone: data.phone,
            picture: data.picture,
            auth_type: 'google'
          },
          sessionToken: data.session_token
        }));
        
        // Clean URL on web
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } catch (error) {
      console.error('Error exchanging session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    try {
      // Create redirect URL based on platform
      const redirectUrl = Platform.OS === 'web'
        ? `${window.location.origin}/`
        : Linking.createURL('/');
      
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      
      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        // Mobile - use WebBrowser
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          await handleAuthRedirect(result.url);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.detail || 'Error al iniciar sesión' };
      }

      setUser({
        user_id: data.user_id,
        email: data.email,
        name: data.name,
        phone: data.phone,
        picture: data.picture,
        auth_type: 'email'
      });
      setSessionToken(data.session_token);

      // Store session
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        user: {
          user_id: data.user_id,
          email: data.email,
          name: data.name,
          phone: data.phone,
          picture: data.picture,
          auth_type: 'email'
        },
        sessionToken: data.session_token
      }));

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const register = async (email: string, password: string, name: string, phone?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, name, phone: phone || null })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.detail || 'Error al registrarse' };
      }

      setUser({
        user_id: data.user_id,
        email: data.email,
        name: data.name,
        phone: data.phone,
        auth_type: 'email'
      });
      setSessionToken(data.session_token);

      // Store session
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        user: {
          user_id: data.user_id,
          email: data.email,
          name: data.name,
          phone: data.phone,
          auth_type: 'email'
        },
        sessionToken: data.session_token
      }));

      return { success: true };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const updateProfile = async (data: { name?: string; phone?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!sessionToken) {
      return { success: false, error: 'No autenticado' };
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(data)
      });

      const responseData = await response.json();

      if (!response.ok) {
        return { success: false, error: responseData.detail || 'Error al actualizar perfil' };
      }

      // Update local user
      setUser(prev => prev ? { ...prev, ...responseData } : null);

      // Update stored session
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const storedData = JSON.parse(stored);
        storedData.user = { ...storedData.user, ...responseData };
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(storedData));
      }

      return { success: true };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const logout = async () => {
    try {
      if (sessionToken) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setSessionToken(null);
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithEmail,
        register,
        logout,
        updateProfile,
        sessionToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
