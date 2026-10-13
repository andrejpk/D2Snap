import { createRoot } from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { App } from "./App.tsx";
import { createClawpilotTheme } from "./theme.ts";
import "./styles.css";

const requestedTheme = new URLSearchParams(window.location.search).get("clawpilotTheme");
const dark = requestedTheme === "dark" ||
  (requestedTheme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.dataset.theme = dark ? "dark" : "light";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <FluentProvider theme={createClawpilotTheme(dark)}>
    <App />
  </FluentProvider>,
);
