import React, { useEffect } from 'react';
import { PharmaPulseDashboard } from './components/pharmapulse/PharmaPulseDashboard';
import { LoginPage } from './components/auth/LoginPage';
import { PharmacyService } from './services/pharmacyService';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    PharmacyService.initialize();
  }, []);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <PharmaPulseDashboard />;
}
