import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, initInstallPrompt } from "./lib/pwa";
import { installGlobalErrorHandlers } from "./lib/installGlobalErrorHandlers";

installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);

// Register SW only in production / non-iframe contexts
initInstallPrompt();
if (import.meta.env.PROD) {
  registerServiceWorker();
}
