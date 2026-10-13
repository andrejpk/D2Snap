import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("The application root is missing.");

createRoot(root, {
  onUncaughtError(error) {
    console.error(error);
    const alert = document.getElementById("client-error");
    if (alert) {
      alert.hidden = false;
      alert.textContent = `The workspace could not render. ${error instanceof Error ? error.message : String(error)}`;
    }
  },
}).render(<StrictMode><App /></StrictMode>);
