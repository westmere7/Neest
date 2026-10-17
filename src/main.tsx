import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { useProjectStore } from './state/projectStore';
import { useEditorStore } from './state/editorStore';
import './styles/base.css';

// Development-only hook for debugging and end-to-end tests (not included in production builds).
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__NEEST__ = { project: useProjectStore, editor: useEditorStore };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
