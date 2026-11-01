import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Port 5173 matches CORS_ORIGIN in the backend .env.
export default defineConfig({ plugins: [react()], server: { port: 5173, strictPort: true } });
