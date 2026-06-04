import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { V2App } from './v2/App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <V2App />
  </StrictMode>
);
