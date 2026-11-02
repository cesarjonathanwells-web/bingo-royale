import React from "react";
import ReactDOM from "react-dom/client";
import "./app.css";
import "./i18n";
import App from "./App";
import { initializePwa } from "./pwa/install-store";

initializePwa();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

