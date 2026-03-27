import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

if (import.meta.env.DEV) {
  const isLocalHost = LOCAL_HOSTNAMES.has(window.location.hostname.toLowerCase());
  if (isLocalHost) {
    import('eruda').then((eruda) => eruda.default.init());
  }
}

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
