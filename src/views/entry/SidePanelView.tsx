import React from 'react';
import { createRoot } from 'react-dom/client';
import { VulnerabilitiesProvider } from '../context/VulnerabilitiesContext';
import VulnerabilitiesApp from '../components/VulnerabilitiesApp/VulnerabilitiesApp';

// Global styles
import '../styles/global.css';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Root container not found');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <VulnerabilitiesProvider>
      <VulnerabilitiesApp />
    </VulnerabilitiesProvider>
  </React.StrictMode>
);