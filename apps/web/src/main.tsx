import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></StrictMode>
);
