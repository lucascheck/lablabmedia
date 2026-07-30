import { ensureRenderableImage } from "@/lib/heic";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { renderHighlightedText } from "@/utils/textHighlight";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Download, Upload, RotateCcw, Type, Palette, Image as ImageLucide,
  Plus, Trash2, ChevronLeft, ChevronRight, Copy, Save, FolderOpen, X, Send, Loader2,
} from "lucide-react";
import { uploadSlideImage } from "@/lib/storage";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useToolProject } from "@/lib/tool-projects";
import { AVAILABLE_FONTS } from "@/types/carousel";
import { idbGet, idbSet, migrateFromLocalStorage } from "@/lib/editor-storage";

export const Route = createFileRoute("/tools/post-simples")({
  component: PostSimplesPage,
  head: () => ({
    meta: [
      { title: "Post Simples — LabMedia" },
      { name: "description", content: "Crie posts simples com imagem de fundo e faixa de texto." },
    ],
  }),
});

type SlideState = {
  bodyText: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  textColor: string;
  textAlign: "left" | "center" | "right";
  highlightColor: string;
  highlightBold: boolean;

  bannerColor: string;
  bannerOpacity: number;
  bannerPaddingX: number;
  bannerPaddingY: number;
  bannerPositionY: number;
  bannerRadius: number;
  bannerMarginX: number;

  bgImage: string | null;
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  imageBrightness: number;
  imageBlur: number;
};

const defaultSlide: SlideState = {
  bodyText: "Aqui eu tinha 18 anos e me criticavam pelas amizades que eu tinha e pela forma como eu me comportava.",
  fontFamily: "'Sora', sans-serif",
  fontSize: 36,
  fontWeight: 400,
  lineHeight: 1.55,
  textColor: "#000000",
  textAlign: "left",
  highlightColor: "#B078FF",
  highlightBold: true,

  bannerColor: "#ffffff",
  bannerOpacity: 100,
  bannerPaddingX: 40,
  bannerPaddingY: 40,
  bannerPositionY: 70,
  bannerRadius: 0,
  bannerMarginX: 0,

  bgImage: null,
  imageScale: 100,
  imageOffsetX: 50,
  imageOffsetY: 50,
  imageBrightness: 100,
  imageBlur: 0,
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
type Preset = {
  name: string;
  config: Omit<SlideState, "bodyText" | "bgImage">;
};

function normalizeSlides(parsed: any): SlideState[] {
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed.map((s: any) => ({ ...defaultSlide, ...s }));
  }
  if (parsed && typeof parsed === "object") {
    return [{ ...defaultSlide, ...parsed }];
  }
  return [{ ...defaultSlide }];
}

function PostSimplesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const storageKey = `post-simples:${user?.id ?? "anon"}`;
  const presetsKey = `post-simples-presets:${user?.id ?? "anon"}`;
  const [slides, setSlides] = useState<SlideState[]>(() => [{ ...defaultSlide }]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [exporting, setExporting] = useState(false);
  const hydrated = useRef(false);
  const prevStorageKey = useRef<string | null>(null);

  // Load from IndexedDB (with one-time migration from localStorage) when key changes
  useEffect(() => {
    if (prevStorageKey.current === storageKey) return;
    prevStorageKey.current = storageKey;
    hydrated.current = false;
    let cancelled = false;
    (async () => {
      const fromIdb = await idbGet<any>(storageKey);
      const slidesData = fromIdb ?? (await migrateFromLocalStorage<any>(storageKey));
      const presetsFromIdb = await idbGet<Preset[]>(presetsKey);
      const presetsData = presetsFromIdb ?? (await migrateFromLocalStorage<Preset[]>(presetsKey));
      if (cancelled) return;
      setSlides(normalizeSlides(slidesData));
      setPresets(Array.isArray(presetsData) ? presetsData : []);
      requestAnimationFrame(() => { hydrated.current = true; });
    })();
    return () => { cancelled = true; };
  }, [storageKey, presetsKey]);

  // Persist slides to IndexedDB (no quota issues for image data URLs)
  useEffect(() => {
    if (!hydrated.current) return;
    const timer = setTimeout(() => { void idbSet(storageKey, slides); }, 400);
    return () => clearTimeout(timer);
  }, [slides, storageKey]);

  // Persist presets to IDB
  useEffect(() => {
    if (!hydrated.current) return;
    void idbSet(presetsKey, presets);
  }, [presets, presetsKey]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") { setCurrentIndex((i) => Math.max(0, i - 1)); }
      if (e.key === "ArrowRight") { setCurrentIndex((i) => Math.min(slides.length - 1, i + 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  const s = slides[currentIndex] ?? defaultSlide;
  const update = <K extends keyof SlideState>(k: K, v: SlideState[K]) =>
    setSlides((prev) => prev.map((sl, i) => i === currentIndex ? { ...sl, [k]: v } : sl));

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    try { update("bgImage", await readAsDataURL(file)); } catch { toast.error("Falha ao carregar imagem"); }
  };

  const addSlide = () => {
    const newSlide = { ...s, bodyText: "", bgImage: null };
    setSlides((prev) => [...prev, newSlide]);
    setCurrentIndex(slides.length);
    toast.success("Slide adicionado");
  };

  const duplicateSlide = () => {
    setSlides((prev) => [...prev.slice(0, currentIndex + 1), { ...s }, ...prev.slice(currentIndex + 1)]);
    setCurrentIndex(currentIndex + 1);
    toast.success("Slide duplicado");
  };

  const removeSlide = () => {
    if (slides.length <= 1) { toast.error("Precisa ter pelo menos 1 slide"); return; }
    setSlides((prev) => prev.filter((_, i) => i !== currentIndex));
    setCurrentIndex(Math.min(currentIndex, slides.length - 2));
    toast.success("Slide removido");
  };

  const goTo = (idx: number) => setCurrentIndex(Math.max(0, Math.min(idx, slides.length - 1)));

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) { toast.error("Digite um nome para o preset"); return; }
    const { bodyText, bgImage, ...config } = s;
    setPresets((prev) => {
      const exists = prev.findIndex((p) => p.name === name);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = { name, config };
        return updated;
      }
      return [...prev, { name, config }];
    });
    setPresetName("");
    toast.success(`Preset "${name}" salvo!`);
  };

  const loadPreset = (preset: Preset) => {
    setSlides((prev) => prev.map((sl, i) => i === currentIndex ? { ...sl, ...preset.config } : sl));
    toast.success(`Preset "${preset.name}" aplicado`);
  };

  const applyPresetToAll = (preset: Preset) => {
    setSlides((prev) => prev.map((sl) => ({ ...sl, ...preset.config })));
    toast.success(`Preset "${preset.name}" aplicado em todos os slides`);
  };

  const deletePreset = (name: string) => {
    setPresets((prev) => prev.filter((p) => p.name !== name));
    toast.success("Preset removido");
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

  type ProjectShape = { slides: SlideState[]; currentIndex: number };
  const projectState: ProjectShape = { slides, currentIndex };
  const { save: handleSave, saving } = useToolProject<ProjectShape>({
    table: "post_simples",
    bucket: "post-simples",
    contentType: "image/png",
    ext: "png",
    state: projectState,
    setState: (p: ProjectShape) => {
      if (Array.isArray(p?.slides) && p.slides.length > 0) setSlides(p.slides);
      if (typeof p?.currentIndex === "number") setCurrentIndex(p.currentIndex);
    },
    makeTitle: (p: ProjectShape) => p.slides[0]?.bodyText?.slice(0, 60) || "Post simples",
    generateImage: generatePngDataUrl,
  }, user?.id);

  const handleDownload = useCallback(async () => {
    try {
      const dataUrl = await generatePngDataUrl();
      const link = document.createElement("a");
      link.download = `post-simples-${currentIndex + 1}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Post exportado!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erro ao exportar");
    }
  }, [generatePngDataUrl, currentIndex]);

  const handleExportAll = useCallback(async () => {
    if (!previewRef.current) return;
    toast.info(`Exportando ${slides.length} slides...`);
    const { toPng } = await import("html-to-image");
    const { createExportNode } = await import("@/utils/exportImage");
    for (let i = 0; i < slides.length; i++) {
      setCurrentIndex(i);
      await new Promise((r) => setTimeout(r, 200));
      if (!previewRef.current) continue;
      const prepared = await createExportNode(previewRef.current);
      try {
        const dataUrl = await toPng(prepared.node, {
          width: 1080, height: 1350, pixelRatio: 1,
          cacheBust: true, skipAutoScale: true, includeQueryParams: true,
        });
        const link = document.createElement("a");
        link.download = `post-simples-${i + 1}.png`;
        link.href = dataUrl;
        link.click();
      } finally { prepared.cleanup(); }
    }
    toast.success("Todos os slides exportados!");
  }, [slides.length]);

  const handleReset = () => { setSlides([{ ...defaultSlide }]); setCurrentIndex(0); toast.info("Resetado para o padrão"); };

  const sendToPreview = useCallback(async () => {
    if (!user) { toast.error("Faça login para enviar ao preview"); return; }
    if (!previewRef.current) return;
    setExporting(true);
    toast.info("Preparando slides para o preview...");
    const originalIndex = currentIndex;
    try {
      const { toPng } = await import("html-to-image");
      const { createExportNode } = await import("@/utils/exportImage");

      const { data: created, error: createErr } = await supabase
        .from("carousels")
        .insert({
          user_id: user.id,
          title: `Post Simples ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        })
        .select("id")
        .single();
      if (createErr || !created) throw createErr ?? new Error("Falha ao criar carrossel");

      for (let i = 0; i < slides.length; i++) {
        setCurrentIndex(i);
        await new Promise((r) => setTimeout(r, 350));
        if (!previewRef.current) throw new Error(`Preview ref lost at slide ${i + 1}`);
        const prepared = await createExportNode(previewRef.current);
        try {
          const dataUrl = await toPng(prepared.node, {
            width: 1080, height: 1350, pixelRatio: 1,
            cacheBust: true, skipAutoScale: true, includeQueryParams: true,
          });
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], `slide_${String(i + 1).padStart(2, "0")}.png`, { type: "image/png" });
          const path = await uploadSlideImage(user.id, created.id, file);
          const { error: insErr } = await supabase
            .from("carousel_slides")
            .insert({ carousel_id: created.id, user_id: user.id, image_path: path, position: i });
          if (insErr) throw insErr;
        } finally { prepared.cleanup(); }
      }

      toast.success("Enviado para o Preview!");
      navigate({ to: "/carousel/$id", params: { id: created.id } });
    } catch (err) {
      console.error("Send to preview error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao enviar para preview");
    } finally {
      setCurrentIndex(originalIndex);
      setExporting(false);
    }
  }, [user, slides, currentIndex, navigate]);

  const bannerTopPercent = s.bannerPositionY;

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-[340px] min-w-[340px] border-r border-border bg-card overflow-y-auto hidden md:block">
        <div className="p-3 border-b border-border flex flex-col gap-2">
          <h2 className="font-bold text-sm">Post Simples</h2>
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleReset} className="text-xs h-8 px-2">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving} className="text-xs h-8 px-2">
              <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "..." : "Salvar"}
            </Button>
            <Button size="sm" onClick={handleDownload} className="text-xs h-8 px-2 bg-primary text-primary-foreground">
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar
            </Button>
          </div>
        </div>

        {/* Slide management */}
        <div className="px-3 py-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Slides ({slides.length})</span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={addSlide} title="Adicionar slide">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={duplicateSlide} title="Duplicar slide">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={removeSlide} title="Remover slide" disabled={slides.length <= 1}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-8 min-w-[32px] px-2 rounded text-xs font-medium transition-colors ${
                  i === currentIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div className="px-3 py-3 border-b border-border space-y-2">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Save className="h-3 w-3" /> Presets
          </span>
          <div className="flex gap-1.5">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nome do preset..."
              className="h-7 text-xs flex-1"
              onKeyDown={(e) => e.key === "Enter" && savePreset()}
            />
            <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={savePreset}>
              <Save className="h-3 w-3 mr-1" /> Salvar
            </Button>
          </div>
          {presets.length > 0 && (
            <div className="space-y-1 max-h-[160px] overflow-y-auto">
              {presets.map((p) => (
                <div key={p.name} className="flex items-center gap-1 group">
                  <button
                    onClick={() => loadPreset(p)}
                    className="flex-1 text-left text-xs px-2 py-1.5 rounded bg-muted/50 hover:bg-muted transition truncate"
                    title={`Aplicar "${p.name}" neste slide`}
                  >
                    <FolderOpen className="h-3 w-3 inline mr-1.5 text-muted-foreground" />
                    {p.name}
                  </button>
                  {slides.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => applyPresetToAll(p)}
                      title="Aplicar em todos os slides"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => deletePreset(p.name)}
                    title="Remover preset"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {presets.length === 0 && (
            <p className="text-[10px] text-muted-foreground">Salve as configurações atuais como preset para reutilizar.</p>
          )}
        </div>

        <Accordion type="multiple" className="px-3 pb-6">
          {/* ── Imagem de Fundo ── */}
          <AccordionItem value="image">
            <AccordionTrigger className="text-xs font-bold gap-2">
              <ImageLucide className="h-3.5 w-3.5" /> Imagem de Fundo
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <Label className="text-[11px]">Upload de imagem</Label>
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg p-3 hover:bg-muted/50 transition">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Escolher imagem</span>
                <input type="file" accept="image/*,.dng,.heic,.heif" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
              </label>

              <div>
                <Label className="text-[11px]">Zoom ({s.imageScale}%)</Label>
                <Slider min={100} max={300} step={1} value={[s.imageScale]} onValueChange={([v]) => update("imageScale", v)} />
              </div>
              <div>
                <Label className="text-[11px]">Posição X ({s.imageOffsetX}%)</Label>
                <Slider min={0} max={100} step={1} value={[s.imageOffsetX]} onValueChange={([v]) => update("imageOffsetX", v)} />
              </div>
              <div>
                <Label className="text-[11px]">Posição Y ({s.imageOffsetY}%)</Label>
                <Slider min={0} max={100} step={1} value={[s.imageOffsetY]} onValueChange={([v]) => update("imageOffsetY", v)} />
              </div>
              <div>
                <Label className="text-[11px]">Brilho ({s.imageBrightness}%)</Label>
                <Slider min={30} max={150} step={1} value={[s.imageBrightness]} onValueChange={([v]) => update("imageBrightness", v)} />
              </div>
              <div>
                <Label className="text-[11px]">Desfoque ({s.imageBlur}px)</Label>
                <Slider min={0} max={20} step={1} value={[s.imageBlur]} onValueChange={([v]) => update("imageBlur", v)} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── Texto ── */}
          <AccordionItem value="text">
            <AccordionTrigger className="text-xs font-bold gap-2">
              <Type className="h-3.5 w-3.5" /> Texto
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div>
                <Label className="text-[11px]">Conteúdo</Label>
                <Textarea
                  value={s.bodyText}
                  onChange={(e) => update("bodyText", e.target.value)}
                  rows={5}
                  className="text-xs mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Use **texto** para destacar palavras</p>
              </div>

              <div>
                <Label className="text-[11px]">Fonte</Label>
                <Select value={s.fontFamily} onValueChange={(v) => update("fontFamily", v)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_FONTS.map((f) => (
                      <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px]">Tamanho ({s.fontSize}px)</Label>
                <Slider min={16} max={80} step={1} value={[s.fontSize]} onValueChange={([v]) => update("fontSize", v)} />
              </div>
              <div>
                <Label className="text-[11px]">Peso ({s.fontWeight})</Label>
                <Slider min={300} max={900} step={100} value={[s.fontWeight]} onValueChange={([v]) => update("fontWeight", v)} />
              </div>
              <div>
                <Label className="text-[11px]">Espaçamento entre linhas ({s.lineHeight})</Label>
                <Slider min={1} max={2.5} step={0.05} value={[s.lineHeight]} onValueChange={([v]) => update("lineHeight", v)} />
              </div>

              <div>
                <Label className="text-[11px]">Alinhamento</Label>
                <Select value={s.textAlign} onValueChange={(v) => update("textAlign", v as SlideState["textAlign"])}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Esquerda</SelectItem>
                    <SelectItem value="center">Centro</SelectItem>
                    <SelectItem value="right">Direita</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-[11px]">Cor do texto</Label>
                  <input type="color" value={s.textColor} onChange={(e) => update("textColor", e.target.value)} className="w-full h-8 rounded cursor-pointer mt-1" />
                </div>
                <div className="flex-1">
                  <Label className="text-[11px]">Cor destaque</Label>
                  <input type="color" value={s.highlightColor} onChange={(e) => update("highlightColor", e.target.value)} className="w-full h-8 rounded cursor-pointer mt-1" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── Faixa / Banner ── */}
          <AccordionItem value="banner">
            <AccordionTrigger className="text-xs font-bold gap-2">
              <Palette className="h-3.5 w-3.5" /> Faixa de Texto
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-[11px]">Cor da faixa</Label>
                  <input type="color" value={s.bannerColor} onChange={(e) => update("bannerColor", e.target.value)} className="w-full h-8 rounded cursor-pointer mt-1" />
                </div>
                <div className="flex-1">
                  <Label className="text-[11px]">Opacidade ({s.bannerOpacity}%)</Label>
                  <Slider min={0} max={100} step={1} value={[s.bannerOpacity]} onValueChange={([v]) => update("bannerOpacity", v)} className="mt-3" />
                </div>
              </div>

              <div>
                <Label className="text-[11px]">Posição vertical ({s.bannerPositionY}%)</Label>
                <Slider min={10} max={95} step={1} value={[s.bannerPositionY]} onValueChange={([v]) => update("bannerPositionY", v)} />
              </div>

              <div>
                <Label className="text-[11px]">Padding horizontal ({s.bannerPaddingX}px)</Label>
                <Slider min={10} max={100} step={1} value={[s.bannerPaddingX]} onValueChange={([v]) => update("bannerPaddingX", v)} />
              </div>
              <div>
                <Label className="text-[11px]">Padding vertical ({s.bannerPaddingY}px)</Label>
                <Slider min={10} max={100} step={1} value={[s.bannerPaddingY]} onValueChange={([v]) => update("bannerPaddingY", v)} />
              </div>
              <div>
                <Label className="text-[11px]">Margem lateral ({s.bannerMarginX}px)</Label>
                <Slider min={0} max={100} step={1} value={[s.bannerMarginX]} onValueChange={([v]) => update("bannerMarginX", v)} />
              </div>
              <div>
                <Label className="text-[11px]">Borda arredondada ({s.bannerRadius}px)</Label>
                <Slider min={0} max={40} step={1} value={[s.bannerRadius]} onValueChange={([v]) => update("bannerRadius", v)} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </aside>

      {/* Canvas area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
          <span className="text-sm font-bold text-foreground">Post Simples</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={handleReset} className="text-xs md:hidden">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            {slides.length > 1 && (
              <Button variant="outline" size="sm" onClick={handleExportAll} className="text-xs">
                <Download className="h-3.5 w-3.5 mr-1" /> Exportar Todos
              </Button>
            )}
            <Button size="sm" onClick={sendToPreview} disabled={exporting}
              className="text-xs px-2 md:px-3 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white hover:opacity-90 shadow-md border-0">
              {exporting ? <Loader2 className="h-4 w-4 md:mr-1 animate-spin" /> : <Send className="h-4 w-4 md:mr-1" />}
              <span className="hidden md:inline">Enviar para Preview</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving} className="text-xs">
              <Save className="h-3.5 w-3.5 md:mr-1" /> <span className="hidden md:inline">{saving ? "Salvando..." : "Salvar"}</span>
            </Button>
            <Button size="sm" onClick={handleDownload} className="text-xs bg-primary text-primary-foreground">
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar PNG
            </Button>
          </div>
        </div>

        <div ref={canvasRef} className="flex-1 flex items-center justify-center bg-background overflow-hidden p-2 md:p-8 relative"
          onWheel={(e) => {
            if (slides.length <= 1) return;
            e.preventDefault();
            if (e.deltaY > 0 || e.deltaX > 0) setCurrentIndex((i) => Math.min(slides.length - 1, i + 1));
            else if (e.deltaY < 0 || e.deltaX < 0) setCurrentIndex((i) => Math.max(0, i - 1));
          }}
        >
          <div style={{ width: Math.floor(1080 * scale), height: Math.floor(1350 * scale), flexShrink: 0, position: "relative" }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
              <div
                ref={previewRef}
                style={{
                  width: 1080,
                  height: 1350,
                  position: "relative",
                  overflow: "hidden",
                  backgroundColor: "#111",
                }}
              >
                {/* Background image */}
                {s.bgImage && (
                  <img
                    src={s.bgImage}
                    alt=""
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: `${s.imageOffsetX}% ${s.imageOffsetY}%`,
                      transform: `scale(${s.imageScale / 100})`,
                      transformOrigin: "center center",
                      filter: `brightness(${s.imageBrightness / 100}) blur(${s.imageBlur}px)`,
                    }}
                  />
                )}

                {!s.bgImage && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 28, fontFamily: "sans-serif" }}>
                      Faça upload de uma imagem
                    </span>
                  </div>
                )}

                {/* White banner / text box */}
                <div
                  style={{
                    position: "absolute",
                    left: s.bannerMarginX,
                    right: s.bannerMarginX,
                    top: `${bannerTopPercent}%`,
                    transform: "translateY(-50%)",
                    backgroundColor: (() => {
                      const hex = s.bannerColor.replace("#", "");
                      const r = parseInt(hex.substring(0, 2), 16);
                      const g = parseInt(hex.substring(2, 4), 16);
                      const b = parseInt(hex.substring(4, 6), 16);
                      return `rgba(${r},${g},${b},${s.bannerOpacity / 100})`;
                    })(),
                    borderRadius: s.bannerRadius,
                    padding: `${s.bannerPaddingY}px ${s.bannerPaddingX}px`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: s.fontFamily,
                      fontSize: s.fontSize,
                      fontWeight: s.fontWeight,
                      lineHeight: s.lineHeight,
                      color: s.textColor,
                      textAlign: s.textAlign,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {renderHighlightedText(s.bodyText, {
                      highlightColor: s.highlightColor,
                      bold: s.highlightBold,
                      italic: false,
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation arrows overlay */}
          {slides.length > 1 && (
            <>
              <button
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-card/80 backdrop-blur border border-border flex items-center justify-center hover:bg-card transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => goTo(currentIndex + 1)}
                disabled={currentIndex === slides.length - 1}
                className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-card/80 backdrop-blur border border-border flex items-center justify-center hover:bg-card transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Dots indicator */}
              <div className="absolute bottom-3 md:bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-card/80 backdrop-blur rounded-full px-3 py-1.5 border border-border">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      i === currentIndex ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
