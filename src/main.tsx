import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./app/App";
import { Capture } from "./features/capture/Capture";
import { initTheme } from "./lib/theme";

initTheme();

// The quick-capture window loads the same bundle with ?w=capture.
const isCapture = new URLSearchParams(location.search).get("w") === "capture";

// Plain browser during `bun run dev`: fake the backend so the UI can be exercised.
if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
  const { installMock } = await import("./dev/mock");
  installMock();
}

createRoot(document.getElementById("root")!).render(<StrictMode>{isCapture ? <Capture /> : <App />}</StrictMode>);
