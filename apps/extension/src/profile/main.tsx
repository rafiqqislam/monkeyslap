import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Profile } from "./Profile";
import "../shared/theme.css";

document.body.className = "m-0 min-h-screen bg-sand font-sans text-ink antialiased";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Profile />
  </StrictMode>,
);
