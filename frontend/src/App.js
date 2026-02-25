import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Matches from './pages/Matches';
import MatchDetail from './pages/MatchDetail';
import Players from './pages/Players';
import Analysis from './pages/Analysis';
import SharedMatches from './pages/SharedMatches';
import SharedMatchDetail from './pages/SharedMatchDetail';
import { LoadingSpinner } from './components/LoadingSpinner';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <LoadingSpinner message="Verificando sesión..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <LoadingSpinner message="Cargando..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      />
      <Route 
        path="/register" 
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } 
      />

      {/* Protected Routes */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/matches" 
        element={
          <ProtectedRoute>
            <Matches />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/matches/:matchId" 
        element={
          <ProtectedRoute>
            <MatchDetail />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/players" 
        element={
          <ProtectedRoute>
            <Players />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/analysis" 
        element={
          <ProtectedRoute>
            <Analysis />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/shared" 
        element={
          <ProtectedRoute>
            <SharedMatches />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/shared/:userId/matches/:matchId" 
        element={
          <ProtectedRoute>
            <SharedMatchDetail />
          </ProtectedRoute>
        } 
      />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster 
          position="top-center" 
          richColors 
          theme="dark"
          toastOptions={{
            style: {
              background: '#121212',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
