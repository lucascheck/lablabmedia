import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminAccessToken } from "@/lib/ai-config.server";
import { getUsageStats, setUsageLimits } from "@/lib/ai-usage.server";

const statsInput = z.object({ accessToken: z.string() });

export const getAiUsageStats = createServerFn({ method: "POST" })
  .inputValidator(statsInput)
  .handler(async ({ data }) => {
    const stats = await getUsageStats(data.accessToken);
    if (!stats) return { ok: false as const, error: "Sessão inválida." };
    return { ok: true as const, stats };
  });

const limitsInput = z.object({
  accessToken: z.string(),
  dailyLimit: z.number().int().min(1).max(1_000_000),
  monthlyLimit: z.number().int().min(1).max(10_000_000),
});

export const setAiUsageLimits = createServerFn({ method: "POST" })
  .inputValidator(limitsInput)
  .handler(async ({ data }) => {
    const isAdmin = await isAdminAccessToken(data.accessToken);
    if (!isAdmin) return { ok: false as const, error: "Apenas administradores podem ajustar os limites." };
    await setUsageLimits(data.dailyLimit, data.monthlyLimit);
    return { ok: true as const };
  });
