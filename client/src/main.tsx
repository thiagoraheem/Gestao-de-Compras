import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Conditionally load Eruda only in development environment
if (import.meta.env.DEV) {
  import('eruda').then((eruda) => eruda.default.init());
}

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
