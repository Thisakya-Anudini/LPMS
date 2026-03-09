import './index.css';
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ToastProvider } from './contexts/ToastContext';

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
