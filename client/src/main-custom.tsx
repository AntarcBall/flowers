import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import CustomPage from './pages/CustomPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomPage />
  </StrictMode>,
);
