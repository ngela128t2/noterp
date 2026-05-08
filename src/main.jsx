import React from 'react';
import ReactDOM from 'react-dom/client';
import './storage-shim.js';
import NoterpApp from './NoterpApp.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NoterpApp />
  </React.StrictMode>
);
