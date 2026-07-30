// Vite config used ONLY when building for Vercel via `vercel.json`'s buildCommand.
// Runs the real server (SSR + server functions) on Vercel's Node runtime via Nitro's
// "vercel" preset — NOT a static SPA. Server functions (Carrossel Creator IA, etc.)
// need a live backend to keep secrets (Gemini key, Supabase service role) off the client.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: { preset: "vercel" },
});
