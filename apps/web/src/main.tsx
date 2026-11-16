import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import { App } from './App';
import { AuthGate } from './components/AuthGate';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <AuthGate>{({ role, onLogout }) => <App role={role} onLogout={onLogout} />}</AuthGate>
    </React.StrictMode>,
  );
}
