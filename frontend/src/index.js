import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
    <Toaster position="top-right" toastOptions={{ style:{background:'#0d2137',color:'#fff',border:'1px solid rgba(255,255,255,.1)',fontSize:'14px',borderRadius:'12px'}, success:{iconTheme:{primary:'#00bfa5',secondary:'#fff'}}, error:{iconTheme:{primary:'#ff1744',secondary:'#fff'}} }} />
  </BrowserRouter>
);
