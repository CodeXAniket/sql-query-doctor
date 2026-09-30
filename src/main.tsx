import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Fonts (self-hosted via Fontsource so the app works offline).
import "@fontsource/anton/400.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";

import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/app.css";
import "./styles/features.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
