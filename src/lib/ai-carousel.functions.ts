import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateCarouselWithAi } from "@/lib/ai-carousel.server";
import { logAiUsage } from "@/lib/ai-usage.server";

const inputSchema = z.object({
  accessToken: z.string(),
  mode: z.enum(["topic", "link"]),
  topic: z.string().optional(),
  link: z.string().optional(),
  niche: z.string().optional(),
  objective: z.string().optional(),
  tone: z.string().optional(),
  slideCount: z.number().int().min(3).max(9),
  instagramHandle: z.string().optional(),
});

export const generateCarouselContent = createServerFn({ method: "POST" })
  .inputValidator(inputSchema)
  .handler(async ({ data }) => {
    try {
      const { carousel, usage } = await generateCarouselWithAi(data);
      void logAiUsage({
        accessToken: data.accessToken,
        mode: data.mode,
        slideCount: data.slideCount,
        success: true,
        tokensInput: usage.inputTokens,
        tokensOutput: usage.outputTokens,
      });
      return { ok: true as const, carousel };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao gerar conteúdo com IA.";
      if (message !== "AI_NOT_CONFIGURED") {
        void logAiUsage({
          accessToken: data.accessToken,
          mode: data.mode,
          slideCount: data.slideCount,
          success: false,
          errorMessage: message,
        });
      }
      return { ok: false as const, error: message };
    }
  });
