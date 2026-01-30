import eruda from 'eruda';

if (import.meta.env.MODE === 'development' || window.location.href.includes('debug=true')) {
  eruda.init();
}

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
