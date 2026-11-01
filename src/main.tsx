import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/josefin-sans/300.css";
import "@fontsource/josefin-sans/400.css";
import "@fontsource/josefin-sans/600.css";
import "@fontsource/roboto-mono/300.css";
import "@fontsource/roboto-mono/300-italic.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "./ui/styles.css";
import { App } from "./ui/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
