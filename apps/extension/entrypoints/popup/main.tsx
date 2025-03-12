import 'uno.css';

import App from './App';
import React from 'react';
import { createRoot } from 'react-dom/client';

const root = document.createElement('div');
root.id = 'root';
document.body.appendChild(root);

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
