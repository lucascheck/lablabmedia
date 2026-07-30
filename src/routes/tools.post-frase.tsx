import { ensureRenderableImage } from "@/lib/heic";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { uploadSlideImage } from "@/lib/storage";
import { renderHighlightedText } from "@/utils/textHighlight";
import verifiedBadge from "@/assets/verified-badge.svg";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, Upload, RotateCcw, Quote, Save, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useToolProject } from "@/lib/tool-projects";
import { idbGet, idbSet, migrateFromLocalStorage } from "@/lib/editor-storage";
import { AVAILABLE_FONTS } from "@/types/carousel";

export const Route = createFileRoute("/tools/post-frase")({
  component: PostFrasePage,
  head: () => ({
    meta: [
      { title: "Post Frase Creator — LabMedia" },
      { name: "description", content: "Crie posts de frase 1080×1350 com tipografia gigante e marca d'água." },
    ],
  }),
});

type State = {
  // Top header
  topLeftText: string;
  topRightText: string;

  // Background watermark
  showWatermark: boolean;
  watermarkText: string;
  watermarkColor: string;
  watermarkOpacity: number;
  watermarkSize: number;
  watermarkOffsetY: number;

  // Title
  titleText: string;
  titleFontFamily: string;
  titleFontSize: number;
  titleColor: string;
  titleLineHeight: number;
  titleWeight: number;
  titleAlign: "left" | "center" | "right";

  // Subtitle
  subtitleText: string;
  subtitleFontFamily: string;
  subtitleFontSize: number;
  subtitleColor: string;
  subtitleLineHeight: number;
  subtitleAlign: "left" | "center" | "right";

  // Highlight (for **text**)
  highlightColor: string;
  highlightBold: boolean;

  // Profile (footer)
  profileName: string;
  profileHandle: string;
  profilePhoto: string | null;
  profilePhotoSize: number;
  profilePhotoScale: number;
  profilePhotoOffsetX: number;
  profilePhotoOffsetY: number;
  showProfile: boolean;

  // Footer
  footerAlign: "left" | "center" | "right" | "between";

  // Background
  bgType: "color" | "image";
  bgColor: string;
  bgImage: string | null;
  bgImageOpacity: number;
  bgImageFit: "cover" | "contain";
  bgImageScale: number; // 50..300 %
  bgImageOffsetX: number; // 0..100 %
  bgImageOffsetY: number; // 0..100 %
  bgOverlayColor: string;
  bgOverlayOpacity: number;
  textColor: string; // header/footer color

  // Padding
  paddingSides: number;
  paddingTop: number;
  paddingBottom: number;

  // Vertical alignment of main content
  contentAlign: "top" | "center" | "bottom";
  contentOffsetY: number; // -200..200 px adjustment

  // Spacing
  spacingTitleSubtitle: number;

  // Tonalidade / Contraste (filtros sobre a imagem de fundo)
  bgBrightness: number;       // 0..200 (%)
  bgContrast: number;         // 0..200 (%)
  bgSaturation: number;       // 0..200 (%)
  bgBlur: number;             // 0..20 (px)
  // Vinheta (escurecimento nas bordas)
  vignetteEnabled: boolean;
  vignetteColor: string;
  vignetteIntensity: number;  // 0..1
  vignetteSize: number;       // 30..100 (% do raio onde começa)
  // Gradiente (overlay linear pra dar profundidade tipo a referência)
  gradientEnabled: boolean;
  gradientColor1: string;
  gradientColor2: string;
  gradientOpacity: number;    // 0..1
  gradientAngle: number;      // 0..360 deg
};

type TonePreset = {
  id: string;
  label: string;
  patch: Partial<State>;
};

const TONE_PRESETS: TonePreset[] = [
  {
    id: "none",
    label: "Original",
    patch: {
      bgBrightness: 100, bgContrast: 100, bgSaturation: 100, bgBlur: 0,
      bgOverlayColor: "#000000", bgOverlayOpacity: 0,
      vignetteEnabled: false, vignetteIntensity: 0.5, vignetteSize: 60, vignetteColor: "#000000",
      gradientEnabled: false, gradientOpacity: 0,
    },
  },
  {
    id: "dark-moody",
    label: "Dark Moody",
    patch: {
      bgBrightness: 78, bgContrast: 115, bgSaturation: 75, bgBlur: 0,
      bgOverlayColor: "#000000", bgOverlayOpacity: 0.35,
      vignetteEnabled: true, vignetteColor: "#000000", vignetteIntensity: 0.65, vignetteSize: 45,
      gradientEnabled: true, gradientColor1: "#000000", gradientColor2: "#000000", gradientOpacity: 0.35, gradientAngle: 180,
      titleColor: "#ffffff", subtitleColor: "#e6e6e6", textColor: "#cfcfcf", highlightColor: "#ffffff",
    },
  },
  {
    id: "cinematic",
    label: "Cinemático",
    patch: {
      bgBrightness: 92, bgContrast: 125, bgSaturation: 88, bgBlur: 0,
      bgOverlayColor: "#0a1a2a", bgOverlayOpacity: 0.18,
      vignetteEnabled: true, vignetteColor: "#000000", vignetteIntensity: 0.55, vignetteSize: 55,
      gradientEnabled: true, gradientColor1: "#000814", gradientColor2: "#1a0a00", gradientOpacity: 0.3, gradientAngle: 200,
      titleColor: "#ffffff", subtitleColor: "#e8e8e8", textColor: "#d4d4d4", highlightColor: "#ffd27a",
    },
  },
  {
    id: "noir",
    label: "Preto & Branco",
    patch: {
      bgBrightness: 95, bgContrast: 130, bgSaturation: 0, bgBlur: 0,
      bgOverlayColor: "#000000", bgOverlayOpacity: 0.2,
      vignetteEnabled: true, vignetteColor: "#000000", vignetteIntensity: 0.6, vignetteSize: 50,
      gradientEnabled: false, gradientOpacity: 0,
      titleColor: "#ffffff", subtitleColor: "#dddddd", textColor: "#bdbdbd", highlightColor: "#ffffff",
    },
  },
  {
    id: "warm",
    label: "Quente",
    patch: {
      bgBrightness: 105, bgContrast: 108, bgSaturation: 115, bgBlur: 0,
      bgOverlayColor: "#a85a1a", bgOverlayOpacity: 0.18,
      vignetteEnabled: true, vignetteColor: "#3a1500", vignetteIntensity: 0.45, vignetteSize: 60,
      gradientEnabled: true, gradientColor1: "#ff8a3d", gradientColor2: "#3a1500", gradientOpacity: 0.25, gradientAngle: 160,
      titleColor: "#fff7e8", subtitleColor: "#f4dcc0", textColor: "#f0c89a", highlightColor: "#ffd27a",
    },
  },
  {
    id: "cold",
    label: "Frio",
    patch: {
      bgBrightness: 95, bgContrast: 110, bgSaturation: 95, bgBlur: 0,
      bgOverlayColor: "#0a2a4a", bgOverlayOpacity: 0.22,
      vignetteEnabled: true, vignetteColor: "#001a2a", vignetteIntensity: 0.5, vignetteSize: 55,
      gradientEnabled: true, gradientColor1: "#0a3a6a", gradientColor2: "#000510", gradientOpacity: 0.3, gradientAngle: 180,
      titleColor: "#eaf6ff", subtitleColor: "#cfe6f5", textColor: "#a8c8de", highlightColor: "#9ed4ff",
    },
  },
  {
    id: "faded",
    label: "Desbotado",
    patch: {
      bgBrightness: 110, bgContrast: 85, bgSaturation: 70, bgBlur: 0,
      bgOverlayColor: "#f5e8d8", bgOverlayOpacity: 0.18,
      vignetteEnabled: false, vignetteIntensity: 0.3, vignetteSize: 70,
      gradientEnabled: false, gradientOpacity: 0,
      titleColor: "#1a1a1a", subtitleColor: "#3a3a3a", textColor: "#5a5a5a",
    },
  },
  {
    id: "vintage",
    label: "Vintage",
    patch: {
      bgBrightness: 102, bgContrast: 95, bgSaturation: 80, bgBlur: 0,
      bgOverlayColor: "#c08a3e", bgOverlayOpacity: 0.18,
      vignetteEnabled: true, vignetteColor: "#2a1500", vignetteIntensity: 0.55, vignetteSize: 50,
      gradientEnabled: true, gradientColor1: "#d4a259", gradientColor2: "#1a0a00", gradientOpacity: 0.22, gradientAngle: 200,
      titleColor: "#fff2dc", subtitleColor: "#e8d2a8", textColor: "#c9a878", highlightColor: "#ffd27a",
    },
  },
  {
    id: "airy",
    label: "Etéreo (claro)",
    patch: {
      bgBrightness: 118, bgContrast: 92, bgSaturation: 90, bgBlur: 0,
      bgOverlayColor: "#ffffff", bgOverlayOpacity: 0.25,
      vignetteEnabled: false, vignetteIntensity: 0.2, vignetteSize: 75,
      gradientEnabled: true, gradientColor1: "#ffffff", gradientColor2: "#ffffff", gradientOpacity: 0.15, gradientAngle: 0,
      titleColor: "#0a0a0a", subtitleColor: "#1a1a1a", textColor: "#3a3a3a", highlightColor: "#0a0a0a",
    },
  },
  {
    id: "blur-soft",
    label: "Desfoque suave",
    patch: {
      bgBrightness: 90, bgContrast: 105, bgSaturation: 90, bgBlur: 8,
      bgOverlayColor: "#000000", bgOverlayOpacity: 0.25,
      vignetteEnabled: true, vignetteColor: "#000000", vignetteIntensity: 0.4, vignetteSize: 55,
      gradientEnabled: false, gradientOpacity: 0,
      titleColor: "#ffffff", subtitleColor: "#ececec", textColor: "#cfcfcf", highlightColor: "#ffffff",
    },
  },
];

const defaultState: State = {
  topLeftText: "Alguém está te ouvindo?",
  topRightText: "Página 04",

  watermarkText: "Rebranding",
  watermarkColor: "#000000",
  watermarkOpacity: 0.06,
  watermarkSize: 520,
  watermarkOffsetY: 0,
  showWatermark: true,

  titleText: "É o que fazemos sem obrigação que **nos define**.",
  titleFontFamily: "'Sora', sans-serif",
  titleFontSize: 110,
  titleColor: "#0a0a0a",
  titleLineHeight: 1.05,
  titleWeight: 800,
  titleAlign: "left",

  subtitleText: "",
  subtitleFontFamily: "'Sora', sans-serif",
  subtitleFontSize: 36,
  subtitleColor: "#1a1a1a",
  subtitleLineHeight: 1.35,
  subtitleAlign: "left",

  highlightColor: "#0a0a0a",
  highlightBold: true,

  profileName: "Gabriel de Souza",
  profileHandle: "@gabrieldesouzabr",
  profilePhoto: null,
  profilePhotoSize: 60,
  profilePhotoScale: 100,
  profilePhotoOffsetX: 50,
  profilePhotoOffsetY: 50,
  showProfile: true,

  footerAlign: "center",

  bgType: "color",
  bgColor: "#f1f1f1",
  bgImage: null,
  bgImageOpacity: 1,
  bgImageFit: "cover",
  bgImageScale: 100,
  bgImageOffsetX: 50,
  bgImageOffsetY: 50,
  bgOverlayColor: "#000000",
  bgOverlayOpacity: 0,
  textColor: "#222222",

  paddingSides: 72,
  paddingTop: 56,
  paddingBottom: 56,

  contentAlign: "center",
  contentOffsetY: 0,

  spacingTitleSubtitle: 32,

  bgBrightness: 100,
  bgContrast: 100,
  bgSaturation: 100,
  bgBlur: 0,
  vignetteEnabled: false,
  vignetteColor: "#000000",
  vignetteIntensity: 0.5,
  vignetteSize: 60,
  gradientEnabled: false,
  gradientColor1: "#000000",
  gradientColor2: "#000000",
  gradientOpacity: 0.3,
  gradientAngle: 180,
};

async function readAsDataURL(file: File): Promise<string> {
  const ready = await ensureRenderableImage(file);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(ready);
  });
}

function PostFrasePage() {
  const { user } = useAuth();
  const storageKey = `post-frase:${user?.id ?? "anon"}`;
  const presetsKey = `post-frase-presets:${user?.id ?? "anon"}`;
  const [state, setState] = useState<State>(defaultState);
  const [customPresets, setCustomPresets] = useState<{ id: string; label: string; patch: Partial<State> }[]>([]);
  const [newPresetName, setNewPresetName] = useState("");

  useEffect(() => {
    (async () => {
      const data = await idbGet<{ id: string; label: string; patch: Partial<State> }[]>(presetsKey);
      if (Array.isArray(data)) setCustomPresets(data);
      else setCustomPresets([]);
    })();
  }, [presetsKey]);

  const TONE_KEYS: (keyof State)[] = [
    "bgBrightness","bgContrast","bgSaturation","bgBlur",
    "bgOverlayColor","bgOverlayOpacity",
    "vignetteEnabled","vignetteColor","vignetteIntensity","vignetteSize",
    "gradientEnabled","gradientColor1","gradientColor2","gradientOpacity","gradientAngle",
    "titleColor","subtitleColor","textColor","highlightColor",
  ];

  const saveCurrentAsPreset = () => {
    const label = newPresetName.trim();
    if (!label) { toast.error("Dê um nome ao preset"); return; }
    const patch: Partial<State> = {};
    for (const k of TONE_KEYS) (patch as Record<string, unknown>)[k as string] = state[k];
    const next = [...customPresets, { id: crypto.randomUUID(), label, patch }];
    setCustomPresets(next);
    void idbSet(presetsKey, next);
    setNewPresetName("");
    toast.success("Preset salvo");
  };

  const deletePreset = (id: string) => {
    const next = customPresets.filter((p) => p.id !== id);
    setCustomPresets(next);
    void idbSet(presetsKey, next);
  };
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const hydrated = useRef(false);
  const prevKey = useRef<string | null>(null);

  // Load from IndexedDB on key change (with one-time localStorage migration)
  useEffect(() => {
    if (prevKey.current === storageKey) return;
    prevKey.current = storageKey;
    hydrated.current = false;
    let cancelled = false;
    (async () => {
      const fromIdb = await idbGet<Partial<State>>(storageKey);
      const data = fromIdb ?? (await migrateFromLocalStorage<Partial<State>>(storageKey));
      if (cancelled) return;
      if (data && typeof data === "object") setState({ ...defaultState, ...data });
      requestAnimationFrame(() => { hydrated.current = true; });
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // Persist to IndexedDB (no quota issues)
  useEffect(() => {
    if (!hydrated.current) return;
    const timer = setTimeout(() => { void idbSet(storageKey, state); }, 400);
    return () => clearTimeout(timer);
  }, [state, storageKey]);

  useEffect(() => {
    const updateScale = () => {
      if (!canvasRef.current) return;
      const { clientWidth, clientHeight } = canvasRef.current;
      const padding = clientWidth < 768 ? 16 : 64;
      const availW = clientWidth - padding;
      const availH = clientHeight - padding;
      setScale(Math.min(availW / 1080, availH / 1350, 1));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    const observer = new ResizeObserver(updateScale);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => { window.removeEventListener("resize", updateScale); observer.disconnect(); };
  }, []);

  const update = <K extends keyof State>(k: K, v: State[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const onUpload = async (file: File | undefined, cb: (url: string) => void) => {
    if (!file) return;
    try { cb(await readAsDataURL(file)); } catch { toast.error("Falha ao carregar imagem"); }
  };

  const generatePngDataUrl = useCallback(async (): Promise<string> => {
    if (!previewRef.current) throw new Error("preview missing");
    const { toPng } = await import("html-to-image");
    const { createExportNode } = await import("@/utils/exportImage");
    const prepared = await createExportNode(previewRef.current);
    try {
      return await toPng(prepared.node, {
        width: 1080, height: 1350, pixelRatio: 1,
        cacheBust: true, skipAutoScale: true, includeQueryParams: true,
      });
    } finally { prepared.cleanup(); }
  }, []);

  const { save: handleSave, saving } = useToolProject<State>({
    table: "post_frases",
    bucket: "post-frases",
    contentType: "image/png",
    ext: "png",
    state,
    setState: (s: State) => setState(s),
    makeTitle: (s: State) => s.titleText.replace(/\*\*/g, "").slice(0, 60) || "Post frase",
    generateImage: generatePngDataUrl,
  }, user?.id);

  const handleDownload = useCallback(async () => {
    try {
      const dataUrl = await generatePngDataUrl();
      const link = document.createElement("a");
      link.download = "post-frase.png";
      link.href = dataUrl;
      link.click();
      toast.success("Post exportado!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erro ao exportar");
    }
  }, [generatePngDataUrl]);

  const handleReset = () => { setState(defaultState); toast.info("Resetado para o padrão"); };

  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const sendToPreview = useCallback(async () => {
    if (!user) { toast.error("Faça login para enviar ao preview"); return; }
    setSending(true);
    toast.info("Preparando para o preview...");
    try {
      const dataUrl = await generatePngDataUrl();
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "post-frase.png", { type: "image/png" });

      const { data: created, error: createErr } = await supabase
        .from("carousels")
        .insert({
          user_id: user.id,
          title: `Post Frase ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        })
        .select("id")
        .single();
      if (createErr || !created) throw createErr ?? new Error("Falha ao criar carrossel");

      const path = await uploadSlideImage(user.id, created.id, file);
      const { error: insErr } = await supabase
        .from("carousel_slides")
        .insert({ carousel_id: created.id, user_id: user.id, image_path: path, position: 0 });
      if (insErr) throw insErr;

      toast.success("Enviado para o Preview!");
      navigate({ to: "/carousel/$id", params: { id: created.id } });
    } catch (err) {
      console.error("Send to preview error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao enviar para preview");
    } finally {
      setSending(false);
    }
  }, [user, generatePngDataUrl, navigate]);

  const s = state;

  const sidebarContent = (
    <Accordion type="multiple" className="px-3">
      {/* Header (top bar) removido */}
      {/* Title */}
      <AccordionItem value="title">
        <AccordionTrigger className="text-xs font-semibold">Título</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div>
            <Label className="text-[11px]">Texto do título</Label>
            <Textarea value={s.titleText} onChange={(e) => update("titleText", e.target.value)}
              className="text-xs mt-1 min-h-[80px]" />
            <p className="text-[10px] text-muted-foreground mt-1">Use **texto** para destacar palavras</p>
          </div>
          <div>
            <Label className="text-[11px]">Fonte</Label>
            <Select value={s.titleFontFamily} onValueChange={(v) => update("titleFontFamily", v)}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AVAILABLE_FONTS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <span style={{ fontFamily: f.value }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Tamanho ({Number(s.titleFontSize) || 0}px)</Label>
            <Slider min={20} max={240} step={1} value={[Number(s.titleFontSize) || 110]}
              onValueChange={([v]) => update("titleFontSize", Number(v))} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Peso ({s.titleWeight})</Label>
            <Slider min={200} max={900} step={100} value={[Number(s.titleWeight) || 800]}
              onValueChange={([v]) => update("titleWeight", Number(v))} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Altura da linha ({(Number(s.titleLineHeight) || 1).toFixed(2)})</Label>
            <Slider min={0.8} max={2} step={0.01} value={[Number(s.titleLineHeight) || 1.05]}
              onValueChange={([v]) => update("titleLineHeight", Number(v))} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Alinhamento</Label>
            <Select value={s.titleAlign} onValueChange={(v) => update("titleAlign", v as State["titleAlign"])}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Esquerda</SelectItem>
                <SelectItem value="center">Centro</SelectItem>
                <SelectItem value="right">Direita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Cor do título</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={s.titleColor} onChange={(e) => update("titleColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={s.titleColor} onChange={(e) => update("titleColor", e.target.value)} className="h-8 text-xs flex-1" />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Cor do destaque (**texto**)</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={s.highlightColor} onChange={(e) => update("highlightColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={s.highlightColor} onChange={(e) => update("highlightColor", e.target.value)} className="h-8 text-xs flex-1" />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Subtitle */}
      <AccordionItem value="subtitle">
        <AccordionTrigger className="text-xs font-semibold">Subtítulo</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div>
            <Label className="text-[11px]">Texto do subtítulo</Label>
            <Textarea value={s.subtitleText} onChange={(e) => update("subtitleText", e.target.value)}
              className="text-xs mt-1 min-h-[100px]" />
            <p className="text-[10px] text-muted-foreground mt-1">Use **texto** para destacar palavras</p>
          </div>
          <div>
            <Label className="text-[11px]">Fonte</Label>
            <Select value={s.subtitleFontFamily} onValueChange={(v) => update("subtitleFontFamily", v)}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AVAILABLE_FONTS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <span style={{ fontFamily: f.value }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Tamanho ({s.subtitleFontSize}px)</Label>
            <Slider min={18} max={64} step={1} value={[s.subtitleFontSize]}
              onValueChange={([v]) => update("subtitleFontSize", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Altura da linha ({s.subtitleLineHeight.toFixed(2)})</Label>
            <Slider min={1} max={2} step={0.05} value={[s.subtitleLineHeight]}
              onValueChange={([v]) => update("subtitleLineHeight", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Alinhamento</Label>
            <Select value={s.subtitleAlign} onValueChange={(v) => update("subtitleAlign", v as State["subtitleAlign"])}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Esquerda</SelectItem>
                <SelectItem value="center">Centro</SelectItem>
                <SelectItem value="right">Direita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Cor do subtítulo</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={s.subtitleColor} onChange={(e) => update("subtitleColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={s.subtitleColor} onChange={(e) => update("subtitleColor", e.target.value)} className="h-8 text-xs flex-1" />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Watermark */}
      <AccordionItem value="watermark">
        <AccordionTrigger className="text-xs font-semibold">Marca d'água (texto de fundo)</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={s.showWatermark} onChange={(e) => update("showWatermark", e.target.checked)} id="wm-show" className="rounded" />
            <Label htmlFor="wm-show" className="text-[11px]">Exibir marca d'água</Label>
          </div>
          {s.showWatermark && (
            <>
              <div>
                <Label className="text-[11px]">Texto</Label>
                <Input value={s.watermarkText} onChange={(e) => update("watermarkText", e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Tamanho ({s.watermarkSize}px)</Label>
                <Slider min={200} max={900} step={10} value={[s.watermarkSize]} onValueChange={([v]) => update("watermarkSize", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Opacidade ({s.watermarkOpacity.toFixed(2)})</Label>
                <Slider min={0.02} max={0.4} step={0.01} value={[s.watermarkOpacity]} onValueChange={([v]) => update("watermarkOpacity", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Deslocamento vertical ({s.watermarkOffsetY}px)</Label>
                <Slider min={-300} max={300} step={5} value={[s.watermarkOffsetY]} onValueChange={([v]) => update("watermarkOffsetY", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Cor</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={s.watermarkColor} onChange={(e) => update("watermarkColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={s.watermarkColor} onChange={(e) => update("watermarkColor", e.target.value)} className="h-8 text-xs flex-1" />
                </div>
              </div>
            </>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Profile / Footer */}
      <AccordionItem value="profile">
        <AccordionTrigger className="text-xs font-semibold">Perfil & Rodapé</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={s.showProfile} onChange={(e) => update("showProfile", e.target.checked)} id="prof-show" className="rounded" />
            <Label htmlFor="prof-show" className="text-[11px]">Exibir perfil no rodapé</Label>
          </div>
          {s.showProfile && (
            <>
              <div>
                <Label className="text-[11px]">Foto de perfil</Label>
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                    {s.profilePhoto ? (
                      <img src={s.profilePhoto} className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">Clique para enviar</span>
                  <input type="file" accept="image/*,.dng,.heic,.heif" className="hidden"
                    onChange={(e) => onUpload(e.target.files?.[0], (url) => update("profilePhoto", url))} />
                </label>
                {s.profilePhoto && (
                  <Button variant="ghost" size="sm" className="text-[10px] mt-1 h-6 text-destructive"
                    onClick={() => update("profilePhoto", null)}>Remover foto</Button>
                )}
              </div>
              {s.profilePhoto && (
                <>
                  <div>
                    <Label className="text-[11px]">Tamanho ({s.profilePhotoSize}px)</Label>
                    <Slider min={32} max={120} step={2} value={[s.profilePhotoSize]} onValueChange={([v]) => update("profilePhotoSize", v)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Zoom ({s.profilePhotoScale}%)</Label>
                    <Slider min={100} max={300} step={5} value={[s.profilePhotoScale]} onValueChange={([v]) => update("profilePhotoScale", v)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Posição X ({s.profilePhotoOffsetX}%)</Label>
                    <Slider min={0} max={100} step={1} value={[s.profilePhotoOffsetX]} onValueChange={([v]) => update("profilePhotoOffsetX", v)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Posição Y ({s.profilePhotoOffsetY}%)</Label>
                    <Slider min={0} max={100} step={1} value={[s.profilePhotoOffsetY]} onValueChange={([v]) => update("profilePhotoOffsetY", v)} className="mt-1" />
                  </div>
                </>
              )}
              <div>
                <Label className="text-[11px]">Nome (não exibido, só para referência)</Label>
                <Input value={s.profileName} onChange={(e) => update("profileName", e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">@handle</Label>
                <Input value={s.profileHandle} onChange={(e) => update("profileHandle", e.target.value)} className="h-8 text-xs mt-1" />
              </div>
            </>
          )}
          <div>
            <Label className="text-[11px]">Alinhamento do rodapé</Label>
            <Select value={s.footerAlign} onValueChange={(v) => update("footerAlign", v as State["footerAlign"])}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Esquerda</SelectItem>
                <SelectItem value="center">Centro</SelectItem>
                <SelectItem value="right">Direita</SelectItem>
                <SelectItem value="between">Espaço entre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Background */}
      <AccordionItem value="bg">
        <AccordionTrigger className="text-xs font-semibold">Fundo, cores & margens</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div>
            <Label className="text-[11px]">Tipo de fundo</Label>
            <Select value={s.bgType} onValueChange={(v) => update("bgType", v as State["bgType"])}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="color">Cor sólida</SelectItem>
                <SelectItem value="image">Imagem</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {s.bgType === "color" && (
            <div>
              <Label className="text-[11px]">Cor de fundo</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={s.bgColor} onChange={(e) => update("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={s.bgColor} onChange={(e) => update("bgColor", e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>
          )}
          {s.bgType === "image" && (
            <div>
              <Label className="text-[11px]">Imagem de fundo</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="file"
                  accept="image/*,.heic,.heif"
                  onChange={(e) => onUpload(e.target.files?.[0], (url) => update("bgImage", url))}
                  className="h-8 text-xs flex-1"
                />
                {s.bgImage && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => update("bgImage", null)}>
                    Remover
                  </Button>
                )}
              </div>
              {s.bgImage && (
                <div className="mt-2 rounded-md border border-border overflow-hidden bg-muted/30">
                  <img src={s.bgImage} alt="preview" className="w-full h-24 object-cover" />
                </div>
              )}
            </div>
          )}
          {s.bgType === "image" && (
            <>
              <div>
                <Label className="text-[11px]">Opacidade da imagem ({s.bgImageOpacity.toFixed(2)})</Label>
                <Slider min={0} max={1} step={0.01} value={[s.bgImageOpacity]} onValueChange={([v]) => update("bgImageOpacity", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Cor da opacidade</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={s.bgOverlayColor} onChange={(e) => update("bgOverlayColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={s.bgOverlayColor} onChange={(e) => update("bgOverlayColor", e.target.value)} className="h-8 text-xs flex-1" />
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Intensidade da cor ({s.bgOverlayOpacity.toFixed(2)})</Label>
                <Slider min={0} max={1} step={0.01} value={[s.bgOverlayOpacity]} onValueChange={([v]) => update("bgOverlayOpacity", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Ajuste (encaixe)</Label>
                <Select value={s.bgImageFit} onValueChange={(v) => update("bgImageFit", v as State["bgImageFit"])}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Preencher (cover)</SelectItem>
                    <SelectItem value="contain">Conter (contain)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Zoom ({s.bgImageScale}%)</Label>
                <Slider min={50} max={300} step={1} value={[s.bgImageScale]} onValueChange={([v]) => update("bgImageScale", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Posição horizontal ({s.bgImageOffsetX}%)</Label>
                <Slider min={0} max={100} step={1} value={[s.bgImageOffsetX]} onValueChange={([v]) => update("bgImageOffsetX", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Posição vertical ({s.bgImageOffsetY}%)</Label>
                <Slider min={0} max={100} step={1} value={[s.bgImageOffsetY]} onValueChange={([v]) => update("bgImageOffsetY", v)} className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-[10px] h-7 flex-1"
                  onClick={() => { update("bgImageScale", 100); update("bgImageOffsetX", 50); update("bgImageOffsetY", 50); }}>
                  Centralizar
                </Button>
              </div>
            </>
          )}
          <div>
            <Label className="text-[11px]">Cor do header e rodapé</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={s.textColor} onChange={(e) => update("textColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={s.textColor} onChange={(e) => update("textColor", e.target.value)} className="h-8 text-xs flex-1" />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Alinhamento vertical do conteúdo</Label>
            <Select value={s.contentAlign} onValueChange={(v) => update("contentAlign", v as State["contentAlign"])}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Topo</SelectItem>
                <SelectItem value="center">Centro</SelectItem>
                <SelectItem value="bottom">Base</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Ajuste vertical fino ({s.contentOffsetY}px)</Label>
            <Slider min={-200} max={200} step={2} value={[s.contentOffsetY]} onValueChange={([v]) => update("contentOffsetY", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Margem lateral ({s.paddingSides}px)</Label>
            <Slider min={0} max={400} step={2} value={[s.paddingSides]} onValueChange={([v]) => update("paddingSides", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Margem topo ({s.paddingTop}px)</Label>
            <Slider min={24} max={140} step={2} value={[s.paddingTop]} onValueChange={([v]) => update("paddingTop", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Margem inferior ({s.paddingBottom}px)</Label>
            <Slider min={24} max={140} step={2} value={[s.paddingBottom]} onValueChange={([v]) => update("paddingBottom", v)} className="mt-1" />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Tonalidade & Contraste */}
      <AccordionItem value="tone">
        <AccordionTrigger className="text-xs font-semibold">Tonalidade & Contraste</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div>
            <Label className="text-[11px]">Presets de tonalidade</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {TONE_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 justify-start"
                  onClick={() => setState((prev) => ({ ...prev, ...p.patch }))}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Os presets aplicam filtros + vinheta + gradiente + cores de texto. Ajuste depois.
            </p>
          </div>

          <div className="pt-2 border-t border-border space-y-2">
            <Label className="text-[11px] font-semibold">Meus presets salvos</Label>
            <div className="flex gap-1.5">
              <Input
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Nome do preset"
                className="h-7 text-xs"
              />
              <Button size="sm" className="h-7 text-[10px] px-2" onClick={saveCurrentAsPreset}>
                <Save className="h-3 w-3 mr-1" /> Salvar
              </Button>
            </div>
            {customPresets.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">Nenhum preset salvo ainda.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {customPresets.map((p) => (
                  <div key={p.id} className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 justify-start flex-1"
                      onClick={() => setState((prev) => ({ ...prev, ...p.patch }))}
                    >
                      {p.label}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-7 px-2 text-destructive"
                      onClick={() => deletePreset(p.id)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-border">
            <Label className="text-[11px] font-semibold">Filtros (sobre a imagem de fundo)</Label>
          </div>
          <div>
            <Label className="text-[11px]">Brilho ({s.bgBrightness}%)</Label>
            <Slider min={0} max={200} step={1} value={[s.bgBrightness]} onValueChange={([v]) => update("bgBrightness", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Contraste ({s.bgContrast}%)</Label>
            <Slider min={0} max={200} step={1} value={[s.bgContrast]} onValueChange={([v]) => update("bgContrast", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Saturação ({s.bgSaturation}%)</Label>
            <Slider min={0} max={200} step={1} value={[s.bgSaturation]} onValueChange={([v]) => update("bgSaturation", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Desfoque ({s.bgBlur}px)</Label>
            <Slider min={0} max={20} step={0.5} value={[s.bgBlur]} onValueChange={([v]) => update("bgBlur", v)} className="mt-1" />
          </div>

          <div className="pt-2 border-t border-border flex items-center gap-2">
            <input type="checkbox" checked={s.vignetteEnabled} onChange={(e) => update("vignetteEnabled", e.target.checked)} id="vig-on" className="rounded" />
            <Label htmlFor="vig-on" className="text-[11px] font-semibold">Vinheta (escurecimento das bordas)</Label>
          </div>
          {s.vignetteEnabled && (
            <>
              <div>
                <Label className="text-[11px]">Cor da vinheta</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={s.vignetteColor} onChange={(e) => update("vignetteColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={s.vignetteColor} onChange={(e) => update("vignetteColor", e.target.value)} className="h-8 text-xs flex-1" />
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Intensidade ({s.vignetteIntensity.toFixed(2)})</Label>
                <Slider min={0} max={1} step={0.01} value={[s.vignetteIntensity]} onValueChange={([v]) => update("vignetteIntensity", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Tamanho do centro claro ({s.vignetteSize}%)</Label>
                <Slider min={20} max={95} step={1} value={[s.vignetteSize]} onValueChange={([v]) => update("vignetteSize", v)} className="mt-1" />
              </div>
            </>
          )}

          <div className="pt-2 border-t border-border flex items-center gap-2">
            <input type="checkbox" checked={s.gradientEnabled} onChange={(e) => update("gradientEnabled", e.target.checked)} id="grad-on" className="rounded" />
            <Label htmlFor="grad-on" className="text-[11px] font-semibold">Gradiente (overlay linear)</Label>
          </div>
          {s.gradientEnabled && (
            <>
              <div>
                <Label className="text-[11px]">Cor 1</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={s.gradientColor1} onChange={(e) => update("gradientColor1", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={s.gradientColor1} onChange={(e) => update("gradientColor1", e.target.value)} className="h-8 text-xs flex-1" />
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Cor 2</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={s.gradientColor2} onChange={(e) => update("gradientColor2", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={s.gradientColor2} onChange={(e) => update("gradientColor2", e.target.value)} className="h-8 text-xs flex-1" />
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Opacidade ({s.gradientOpacity.toFixed(2)})</Label>
                <Slider min={0} max={1} step={0.01} value={[s.gradientOpacity]} onValueChange={([v]) => update("gradientOpacity", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Ângulo ({s.gradientAngle}°)</Label>
                <Slider min={0} max={360} step={1} value={[s.gradientAngle]} onValueChange={([v]) => update("gradientAngle", v)} className="mt-1" />
              </div>
            </>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  const justifyContent =
    s.contentAlign === "top" ? "flex-start" : s.contentAlign === "bottom" ? "flex-end" : "center";

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-[360px] min-w-[360px] border-r border-border bg-card overflow-y-auto hidden md:block">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Quote className="h-4 w-4 text-primary" />
            Post Frase Creator
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">Posts de frase 1080×1350 com tipografia gigante</p>
        </div>

        {sidebarContent}

        <div className="p-3 border-t border-border flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="text-xs flex-1">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Resetar
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving} className="text-xs flex-1">
            <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button size="sm" onClick={sendToPreview} disabled={sending}
            className="text-xs flex-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white hover:opacity-90 shadow-md border-0">
            {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />} Preview
          </Button>
          <Button size="sm" onClick={handleDownload}
            className="text-xs flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar PNG
          </Button>
        </div>
      </div>

      {/* Canvas / Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile toolbar */}
        <div className="md:hidden h-12 border-b border-border flex items-center justify-between px-3 bg-card shrink-0">
          <span className="text-sm font-bold text-foreground">Post Frase</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={handleReset} className="text-xs px-2 h-8">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving} className="text-xs px-2 h-8">
              <Save className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={sendToPreview} disabled={sending}
              className="text-xs px-2 h-8 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white hover:opacity-90 border-0">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" onClick={handleDownload} className="text-xs px-2 h-8 bg-primary text-primary-foreground hover:bg-primary/90">
              <Download className="h-3.5 w-3.5 mr-1" /> PNG
            </Button>
          </div>
        </div>

        {/* Mobile editor */}
        <div className="md:hidden overflow-y-auto max-h-[40vh] border-b border-border bg-card">
          {sidebarContent}
        </div>

        <div ref={canvasRef} className="flex-1 flex items-center justify-center bg-muted/30 relative overflow-hidden p-2 md:p-8">
          <div
            style={{
              width: 1080, height: 1350,
              transform: `scale(${scale})`,
              transformOrigin: "center center",
              flexShrink: 0,
            }}
          >
            <div
              ref={previewRef}
              style={{
                width: 1080, height: 1350,
                backgroundColor: s.bgColor,
                position: "relative",
                overflow: "hidden",
                boxSizing: "border-box",
                fontFamily: s.titleFontFamily,
              }}
            >
              {/* Background image + overlay */}
              {s.bgType === "image" && s.bgImage && (
                <img
                  src={s.bgImage}
                  alt=""
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: s.bgImageFit,
                    objectPosition: `${s.bgImageOffsetX}% ${s.bgImageOffsetY}%`,
                    transform: `scale(${s.bgImageScale / 100})`,
                    transformOrigin: `${s.bgImageOffsetX}% ${s.bgImageOffsetY}%`,
                    opacity: s.bgImageOpacity,
                    filter: `brightness(${s.bgBrightness}%) contrast(${s.bgContrast}%) saturate(${s.bgSaturation}%) blur(${s.bgBlur}px)`,
                    zIndex: 0,
                  }}
                />
              )}
              {s.bgType === "image" && s.bgOverlayOpacity > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: s.bgOverlayColor,
                    opacity: s.bgOverlayOpacity,
                    zIndex: 0,
                  }}
                />
              )}
              {s.gradientEnabled && s.gradientOpacity > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(${s.gradientAngle}deg, ${s.gradientColor1}, ${s.gradientColor2})`,
                    opacity: s.gradientOpacity,
                    zIndex: 0,
                    pointerEvents: "none",
                  }}
                />
              )}
              {s.vignetteEnabled && s.vignetteIntensity > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(ellipse at center, transparent ${s.vignetteSize}%, ${s.vignetteColor} 130%)`,
                    opacity: s.vignetteIntensity,
                    zIndex: 0,
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* Watermark - giant background text */}
              {s.showWatermark && s.watermarkText && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    overflow: "hidden",
                    transform: `translateY(${s.watermarkOffsetY}px)`,
                  }}
                >
                  <div
                    style={{
                      fontSize: s.watermarkSize,
                      fontWeight: 800,
                      lineHeight: 0.85,
                      color: s.watermarkColor,
                      opacity: s.watermarkOpacity,
                      whiteSpace: "nowrap",
                      letterSpacing: "-0.04em",
                      fontFamily: s.titleFontFamily,
                      userSelect: "none",
                    }}
                  >
                    {s.watermarkText}
                  </div>
                </div>
              )}

              {/* Top header removido */}
              {/* Main content area */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  paddingTop: s.paddingTop + 80,
                  paddingBottom: s.paddingBottom + 100,
                  paddingLeft: s.paddingSides,
                  paddingRight: s.paddingSides,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent,
                  zIndex: 1,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ transform: `translateY(${s.contentOffsetY}px)` }}>
                  {/* Title */}
                  <div
                    style={{
                      fontFamily: s.titleFontFamily,
                      fontSize: s.titleFontSize,
                      color: s.titleColor,
                      lineHeight: s.titleLineHeight,
                      fontWeight: s.titleWeight,
                      textAlign: s.titleAlign,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {renderHighlightedText(s.titleText, {
                      highlightColor: s.highlightColor,
                      bold: s.highlightBold,
                      italic: false,
                    })}
                  </div>

                  {/* Subtitle */}
                  {s.subtitleText && (
                    <div
                      style={{
                        marginTop: s.spacingTitleSubtitle,
                        fontFamily: s.subtitleFontFamily,
                        fontSize: s.subtitleFontSize,
                        color: s.subtitleColor,
                        lineHeight: s.subtitleLineHeight,
                        textAlign: s.subtitleAlign,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {renderHighlightedText(s.subtitleText, {
                        highlightColor: s.subtitleColor,
                        bold: true,
                        italic: false,
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  position: "absolute",
                  bottom: s.paddingBottom,
                  left: s.paddingSides,
                  right: s.paddingSides,
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    s.footerAlign === "left" ? "flex-start" :
                    s.footerAlign === "center" ? "center" :
                    s.footerAlign === "right" ? "flex-end" : "space-between",
                  gap: 16,
                  zIndex: 2,
                }}
              >
                {s.showProfile && (
                  <span style={{ fontSize: 22, color: s.textColor, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {s.profileHandle.replace(/^@/, "")}
                    <img src={verifiedBadge} alt="Verificado" style={{ width: 22, height: 22, flexShrink: 0 }} />
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
