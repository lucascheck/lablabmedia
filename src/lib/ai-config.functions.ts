import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminAccessToken, isAiConfigured, writeGeminiApiKey } from "@/lib/ai-config.server";

export const getAiConfigStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: await isAiConfigured() };
});

const setKeyInput = z.object({
  accessToken: z.string(),
  apiKey: z.string().min(10),
});

export const setAiApiKey = createServerFn({ method: "POST" })
  .inputValidator(setKeyInput)
  .handler(async ({ data }) => {
    const isAdmin = await isAdminAccessToken(data.accessToken);
    if (!isAdmin) {
      return { ok: false as const, error: "Apenas administradores podem configurar a IA." };
    }
    try {
      await writeGeminiApiKey(data.apiKey.trim());
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Erro ao salvar a chave." };
    }
  });
