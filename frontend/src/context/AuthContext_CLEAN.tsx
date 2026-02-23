import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
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
    checkExistingSession();
    
    if (Platform.OS !== 'web') {
      Linking.getInitialURL().then((url) => {
        if (url) {
          handleAuthRedirect(url);
        }
      });
    } else {
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
    let match = urlOrHash.match(/[#?&]session_id=([^&]+)/);
    if (match) return match[1];
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
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId,
          'Content-Type': 'application/json'
        }
      });
      
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
      const redirectUrl = Platform.OS === 'web'
        ? `${window.location.origin}/`
        : Linking.createURL('/');
      
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      
      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
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
    const url = `${BACKEND_URL}/api/auth/login`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
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
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      return { success: false, error: `Error de red: ${errorMessage}` };
    }
  };

  const register = async (email: string, password: string, name: string, phone?: string): Promise<{ success: boolean; error?: string }> => {
    const url = `${BACKEND_URL}/api/auth/register`;
    
    // DEBUG 1: Mostrar URL
    Alert.alert('DEBUG 1', `URL: ${url}`);
    
    try {
      const bodyData = { email, password, name, phone: phone || null };
      
      // DEBUG 2: Antes del fetch
      Alert.alert('DEBUG 2', 'Iniciando fetch...');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(bodyData)
      });

      // DEBUG 3: Después del fetch
      Alert.alert('DEBUG 3', `Status: ${response.status}`);
      
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
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || 'Error desconocido';
      // DEBUG ERROR: Mostrar error capturado
      Alert.alert('DEBUG ERROR', `Catch: ${errorMsg}`);
      return { success: false, error: `Red: ${errorMsg}` };
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

      setUser(prev => prev ? { ...prev, ...responseData } : null);

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
