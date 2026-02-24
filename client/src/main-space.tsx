import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SpacePage from './pages/SpacePage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpacePage />
  </StrictMode>,
)
