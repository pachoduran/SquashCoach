import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const EXTERNAL_API = 'https://lev.jsb.mybluehost.me:8001';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('session_token'));
  const [loading, setLoading] = useState(true);

  const api = axios.create({
    baseURL: EXTERNAL_API,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add auth header to requests
  api.interceptors.request.use((config) => {
    const currentToken = localStorage.getItem('session_token');
    if (currentToken) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    }
    return config;
  });

  const fetchCurrentUser = useCallback(async () => {
    const storedToken = localStorage.getItem('session_token');
    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data);
      setToken(storedToken);
    } catch (error) {
      console.error('Error fetching user:', error);
      localStorage.removeItem('session_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { session_token, ...userData } = response.data;
      localStorage.setItem('session_token', session_token);
      setToken(session_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Error al iniciar sesión' 
      };
    }
  };

  const register = async (email, password, name, phone) => {
    try {
      const response = await api.post('/api/auth/register', { 
        email, 
        password, 
        name, 
        phone 
      });
      const { session_token, ...userData } = response.data;
      localStorage.setItem('session_token', session_token);
      setToken(session_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error('Register error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Error al registrarse' 
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('session_token');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      register, 
      logout,
      api,
      isAuthenticated: !!token 
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
