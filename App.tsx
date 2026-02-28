import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/auth-context';
import { ThemeProvider } from './contexts/theme-context';
import Auth from './components/Auth';
import Home from './pages/Home';
import HangoutDetail from './pages/HangoutDetail';
import Onboarding from './pages/Onboarding';
import Chats from './pages/Chats';
import ProfilePage from './pages/Profile';
import NotificationsPage from './pages/Notifications';
import UserProfile from './pages/UserProfile';
import AdminPage from './pages/Admin';
import NotificationManager from './components/NotificationManager';
import { isConfigured } from './lib/supabase';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg text-mid font-sans">Loading...</div>;
  if (!session) return <Auth />;
  return <>{children}</>;
};

const AppContent = () => {
  return (
    <Router>
      <NotificationManager />
      <Routes>
        <Route path="/"               element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/chats"          element={<ProtectedRoute><Chats /></ProtectedRoute>} />
        <Route path="/profile"        element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/notifications"  element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/hangout/:id"    element={<ProtectedRoute><HangoutDetail /></ProtectedRoute>} />
        <Route path="/onboarding"     element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        {/* New: public user profiles */}
        <Route path="/user/:id"       element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        {/* New: admin dashboard (admin-only, self-guards inside) */}
        <Route path="/admin"          element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="*"               element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

const App = () => {
  if (!isConfigured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50 text-gray-800 font-sans">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Supabase Not Configured</h1>
        <p className="mb-4 max-w-md">This application requires a connection to a Supabase project.</p>
        <div className="bg-white p-6 rounded-lg shadow-md text-left max-w-lg w-full border border-gray-200">
          <h2 className="font-bold mb-2">How to fix:</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Create a project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">supabase.com</a></li>
            <li>Go to Project Settings → API</li>
            <li>Copy the <strong>Project URL</strong> and <strong>anon public key</strong></li>
            <li>Add them to your <code>.env</code> file as <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
