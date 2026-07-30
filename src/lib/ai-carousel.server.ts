import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getGeminiApiKey } from "@/lib/ai-config.server";
import type { CarouselData, SlideData, SlideType } from "@/types/carousel";

export const GEMINI_MODEL = "gemini-3.6-flash";

export type AiCarouselMode = "topic" | "link";

export type AiCarouselInput = {
  mode: AiCarouselMode;
  topic?: string;
  link?: string;
  niche?: string;
  objective?: string;
  tone?: string;
  slideCount: number;
  instagramHandle?: string;
};

const SLIDE_TYPES = ["cover", "cover-bottom", "variant-a", "variant-b", "variant-c", "variant-d", "cta"] as const;

const SlideSchema = z.object({
  type: z.enum(SLIDE_TYPES),
  title: z.string(),
  subtitle: z.string(),
  mainText: z.string(),
  secondaryText: z.string(),
  ctaTitle: z.string(),
  ctaSubtitle: z.string(),
  ctaFollowText: z.string(),
});

const CarouselSchema = z.object({
  instagramHandle: z.string(),
  slides: z.array(SlideSchema),
});

type RawCarousel = z.infer<typeof CarouselSchema>;

const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    instagramHandle: { type: "string" },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: SLIDE_TYPES as unknown as string[] },
          title: { type: "string" },
          subtitle: { type: "string" },
          mainText: { type: "string" },
          secondaryText: { type: "string" },
          ctaTitle: { type: "string" },
          ctaSubtitle: { type: "string" },
          ctaFollowText: { type: "string" },
        },
        required: ["type", "title", "subtitle", "mainText", "secondaryText", "ctaTitle", "ctaSubtitle", "ctaFollowText"],
      },
    },
  },
  required: ["instagramHandle", "slides"],
};

function slidePattern(count: number): SlideType[] {
  const middleTypes: SlideType[] = ["variant-a", "variant-c", "variant-d", "variant-b"];
  const pattern: SlideType[] = ["cover"];
  const middleCount = Math.max(0, count - 2);
  for (let i = 0; i < middleCount; i++) {
    pattern.push(middleTypes[i % middleTypes.length]);
  }
  if (count > 1) pattern.push("cta");
  return pattern;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchLinkContent(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Link inválido.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Link inválido.");
  }

  const res = await fetch(parsed.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LabMediaBot/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Não foi possível acessar o link (HTTP ${res.status}).`);
  const html = await res.text();
  const text = stripHtml(html);
  return text.slice(0, 8000);
}

function buildPrompt(input: AiCarouselInput, linkContent: string | null, pattern: SlideType[]): string {
  const lines: string[] = [];
  lines.push(
    "Você é um estrategista de conteúdo para Instagram. Gere o TEXTO de um carrossel para os slides descritos, em português do Brasil, com um gancho forte no primeiro slide e um fechamento com chamada para ação no último.",
  );
  lines.push("");
  lines.push(`Sequência de slides (${pattern.length} no total): ${pattern.join(", ")}.`);
  lines.push("");
  lines.push("Regras por tipo de slide:");
  lines.push("- cover / cover-bottom: preencha apenas `title` (gancho curto e forte, pode usar **negrito** com asteriscos duplos em 1-2 termos) e `subtitle` (uma linha de contexto).");
  lines.push("- variant-a / variant-b / variant-c / variant-d: preencha apenas `mainText` (parágrafo curto, 1-3 frases) e `secondaryText` (uma frase complementar ou dado). Pode usar **negrito** em termos-chave.");
  lines.push("- cta: preencha apenas `ctaTitle` (chamada direta, ex: 'GOSTOU? SALVE ESTE POST!'), `ctaSubtitle` (uma linha) e `ctaFollowText` (uma palavra curta, ex: 'SIGA').");
  lines.push("- Deixe os campos que não se aplicam ao tipo como string vazia.");
  lines.push("- Nunca invente estatísticas ou fatos específicos que não estejam na fonte fornecida.");
  lines.push("");

  if (input.niche) lines.push(`Nicho/área: ${input.niche}`);
  if (input.objective) lines.push(`Objetivo do post: ${input.objective}`);
  if (input.tone) lines.push(`Tom de voz: ${input.tone}`);

  if (input.mode === "topic" && input.topic) {
    lines.push("");
    lines.push(`Tema/assunto para o carrossel: ${input.topic}`);
  }

  if (input.mode === "link" && linkContent) {
    lines.push("");
    lines.push("Conteúdo extraído do link fornecido pelo usuário (use como base factual):");
    lines.push("---");
    lines.push(linkContent);
    lines.push("---");
  }

  lines.push("");
  lines.push(`Retorne exatamente ${pattern.length} slides, na mesma ordem da sequência acima, cada um com o campo "type" correspondente.`);
  lines.push(`O campo instagramHandle deve ser "${input.instagramHandle || "@seu_perfil"}".`);

  return lines.join("\n");
}

export type AiUsage = { inputTokens: number | null; outputTokens: number | null };
export type AiCarouselResult = { carousel: CarouselData; usage: AiUsage };

export async function generateCarouselWithAi(input: AiCarouselInput): Promise<AiCarouselResult> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const slideCount = Math.min(9, Math.max(3, input.slideCount || 7));
  const pattern = slidePattern(slideCount);

  let linkContent: string | null = null;
  if (input.mode === "link") {
    if (!input.link) throw new Error("Informe um link para analisar.");
    linkContent = await fetchLinkContent(input.link);
    if (!linkContent) throw new Error("Não foi possível extrair conteúdo desse link.");
  } else if (!input.topic) {
    throw new Error("Descreva um tema para gerar o carrossel.");
  }

  const prompt = buildPrompt(input, linkContent, pattern);

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("A IA não retornou conteúdo válido.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new Error("A IA retornou um formato inesperado.");
  }

  const validated = CarouselSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error("A IA retornou um conteúdo em formato inesperado. Tente novamente.");
  }
  const raw: RawCarousel = validated.data;
  const usage: AiUsage = {
    inputTokens: response.usageMetadata?.promptTokenCount ?? null,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
  };

  const slides: SlideData[] = raw.slides.slice(0, pattern.length).map((s, i) => {
    const type = pattern[i] ?? s.type;
    const base: SlideData = { id: crypto.randomUUID(), type };
    if (type === "cover" || type === "cover-bottom") {
      base.title = s.title || undefined;
      base.subtitle = s.subtitle || undefined;
    } else if (type === "cta") {
      base.ctaTitle = s.ctaTitle || undefined;
      base.ctaSubtitle = s.ctaSubtitle || undefined;
      base.ctaFollowText = s.ctaFollowText || undefined;
    } else {
      base.mainText = s.mainText || undefined;
      base.secondaryText = s.secondaryText || undefined;
    }
    return base;
  });

  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const now = new Date();

  return {
    carousel: {
      instagramHandle: input.instagramHandle || raw.instagramHandle || "@seu_perfil",
      monthYear: `${months[now.getMonth()]} ${now.getFullYear()}`,
      slides,
    },
    usage,
  };
}
