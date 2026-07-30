import { ensureRenderableImage } from "@/lib/heic";
import { createFileRoute } from "@tanstack/react-router";
import verifiedBadge from "@/assets/verified-badge.avif";
import { renderHighlightedText } from "@/utils/textHighlight";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Download, Upload, RotateCcw, Type, Palette, Image as ImageLucide, Save, Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useToolProject } from "@/lib/tool-projects";
import { idbGet, idbSet, migrateFromLocalStorage } from "@/lib/editor-storage";
import { AVAILABLE_FONTS } from "@/types/carousel";

export const Route = createFileRoute("/tools/post-noticia")({
  component: PostNoticiaPage,
  head: () => ({
    meta: [
      { title: "Post Notícia Creator — LabMedia" },
      { name: "description", content: "Crie posts de notícia 1080x1350 com logo, texto e imagem." },
    ],
  }),
});

type State = {
  profileName: string;
  profileHandle: string;
  profilePhoto: string | null;
  profilePhotoSize: number;
  profilePhotoOffsetX: number;
  profilePhotoOffsetY: number;
  profilePhotoScale: number;

  bodyText: string;
  bodyFontFamily: string;
  bodyFontSize: number;
  bodyColor: string;
  bodyLineHeight: number;
  highlightColor: string;
  highlightBold: boolean;
  highlightGradient: boolean;
  highlightColor2: string;

  mainImage: string | null;
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  imageRadius: number;
  imageGap: number;

  bgColor: string;

  paddingSides: number;
  paddingTop: number;
  paddingBottom: number;
};

const defaultState: State = {
  profileName: "Gabriel de Souza",
  profileHandle: "@gabrieldesouzabr",
  profilePhoto: null,
  profilePhotoSize: 80,
  profilePhotoOffsetX: 50,
  profilePhotoOffsetY: 50,
  profilePhotoScale: 100,

  bodyText:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\nUt enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  bodyFontFamily: "'Sora', sans-serif",
  bodyFontSize: 38,
  bodyColor: "#000000",
  bodyLineHeight: 1.45,
  highlightColor: "#B078FF",
  highlightBold: true,
  highlightGradient: false,
  highlightColor2: "#FF78B0",

  mainImage: null,
  imageScale: 100,
  imageOffsetX: 50,
  imageOffsetY: 50,
  imageRadius: 0,
  imageGap: 32,

  bgColor: "#ffffff",

  paddingSides: 56,
  paddingTop: 56,
  paddingBottom: 56,
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

function PostNoticiaPage() {
  const { user } = useAuth();
  const storageKey = `post-noticia:${user?.id ?? "anon"}`;
  const [state, setState] = useState<State>(defaultState);
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const hydrated = useRef(false);
  const prevKey = useRef<string | null>(null);

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
    table: "post_noticias",
    bucket: "post-noticias",
    contentType: "image/png",
    ext: "png",
    state,
    setState: (s: State) => setState(s),
    makeTitle: (s: State) => s.bodyText.slice(0, 60) || "Post notícia",
    generateImage: generatePngDataUrl,
  }, user?.id);

  const handleDownload = useCallback(async () => {
    try {
      const dataUrl = await generatePngDataUrl();
      const link = document.createElement("a");
      link.download = "post-noticia.png";
      link.href = dataUrl;
      link.click();
      toast.success("Post exportado!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erro ao exportar");
    }
  }, [generatePngDataUrl]);

  const handleReset = () => { setState(defaultState); toast.info("Resetado para o padrão"); };

  // ── Padrão de tipografia & margens ──
  type TypoPreset = {
    name: string;
    bodyFontFamily: string;
    bodyFontSize: number;
    bodyLineHeight: number;
    bodyColor: string;
    paddingSides: number;
    paddingTop: number;
    paddingBottom: number;
  };

  const presetsKey = `post-noticia-presets:${user?.id ?? "anon"}`;
  const [typoPresets, setTypoPresets] = useState<TypoPreset[]>(() => {
    try {
      const raw = localStorage.getItem(presetsKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [presetName, setPresetName] = useState("");

  const saveTypoPreset = () => {
    const name = presetName.trim() || `Padrão ${typoPresets.length + 1}`;
    const preset: TypoPreset = {
      name,
      bodyFontFamily: state.bodyFontFamily,
      bodyFontSize: state.bodyFontSize,
      bodyLineHeight: state.bodyLineHeight,
      bodyColor: state.bodyColor,
      paddingSides: state.paddingSides,
      paddingTop: state.paddingTop,
      paddingBottom: state.paddingBottom,
    };
    const updated = [...typoPresets, preset];
    setTypoPresets(updated);
    localStorage.setItem(presetsKey, JSON.stringify(updated));
    setPresetName("");
    toast.success(`Padrão "${name}" salvo!`);
  };

  const applyTypoPreset = (preset: TypoPreset) => {
    const { name, ...values } = preset;
    setState((s) => ({ ...s, ...values }));
    toast.success(`Padrão "${name}" aplicado!`);
  };

  const deleteTypoPreset = (index: number) => {
    const updated = typoPresets.filter((_, i) => i !== index);
    setTypoPresets(updated);
    localStorage.setItem(presetsKey, JSON.stringify(updated));
    toast.info("Padrão removido");
  };

  const s = state;

  const sidebarContent = (
    <Accordion type="multiple" className="px-3">
      {/* Perfil / Header */}
      <AccordionItem value="perfil">
        <AccordionTrigger className="text-xs font-semibold">Perfil / Header</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
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
                <Label className="text-[11px]">Tamanho da foto ({s.profilePhotoSize}px)</Label>
                <Slider min={40} max={160} step={2} value={[s.profilePhotoSize]}
                  onValueChange={([v]) => update("profilePhotoSize", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Zoom da foto ({s.profilePhotoScale}%)</Label>
                <Slider min={100} max={300} step={5} value={[s.profilePhotoScale]}
                  onValueChange={([v]) => update("profilePhotoScale", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Posição X ({s.profilePhotoOffsetX}%)</Label>
                <Slider min={0} max={100} step={1} value={[s.profilePhotoOffsetX]}
                  onValueChange={([v]) => update("profilePhotoOffsetX", v)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px]">Posição Y ({s.profilePhotoOffsetY}%)</Label>
                <Slider min={0} max={100} step={1} value={[s.profilePhotoOffsetY]}
                  onValueChange={([v]) => update("profilePhotoOffsetY", v)} className="mt-1" />
              </div>
            </>
          )}
          <div>
            <Label className="text-[11px]">Nome</Label>
            <Input value={s.profileName} onChange={(e) => update("profileName", e.target.value)}
              className="h-8 text-xs mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">@handle</Label>
            <Input value={s.profileHandle} onChange={(e) => update("profileHandle", e.target.value)}
              className="h-8 text-xs mt-1" />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Texto */}
      <AccordionItem value="texto">
        <AccordionTrigger className="text-xs font-semibold">Texto</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div>
            <Label className="text-[11px]">Conteúdo</Label>
            <Textarea value={s.bodyText} onChange={(e) => update("bodyText", e.target.value)}
              className="text-xs mt-1 min-h-[120px]" />
            <p className="text-[10px] text-muted-foreground mt-1">Use **texto** para destacar palavras</p>
          </div>
          <div>
            <Label className="text-[11px]">Cor do destaque</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={s.highlightColor}
                onChange={(e) => update("highlightColor", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={s.highlightColor} onChange={(e) => update("highlightColor", e.target.value)}
                className="h-8 text-xs flex-1" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={s.highlightBold}
              onChange={(e) => update("highlightBold", e.target.checked)}
              className="rounded" id="hl-bold" />
            <Label htmlFor="hl-bold" className="text-[11px]">Destaque em negrito</Label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={s.highlightGradient}
              onChange={(e) => update("highlightGradient", e.target.checked)}
              className="rounded" id="hl-gradient" />
            <Label htmlFor="hl-gradient" className="text-[11px]">Gradiente no destaque</Label>
          </div>
          {s.highlightGradient && (
            <div>
              <Label className="text-[11px]">2ª cor do gradiente</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={s.highlightColor2}
                  onChange={(e) => update("highlightColor2", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={s.highlightColor2} onChange={(e) => update("highlightColor2", e.target.value)}
                  className="h-8 text-xs flex-1" />
              </div>
            </div>
          )}
          <div>
            <Label className="text-[11px]">Fonte</Label>
            <Select value={s.bodyFontFamily} onValueChange={(v) => update("bodyFontFamily", v)}>
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
            <Label className="text-[11px]">Tamanho ({s.bodyFontSize}px)</Label>
            <Slider min={20} max={64} step={1} value={[s.bodyFontSize]}
              onValueChange={([v]) => update("bodyFontSize", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Altura da linha ({s.bodyLineHeight.toFixed(2)})</Label>
            <Slider min={1} max={2.5} step={0.05} value={[s.bodyLineHeight]}
              onValueChange={([v]) => update("bodyLineHeight", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Cor do texto</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={s.bodyColor}
                onChange={(e) => update("bodyColor", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={s.bodyColor} onChange={(e) => update("bodyColor", e.target.value)}
                className="h-8 text-xs flex-1" />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Imagem */}
      <AccordionItem value="imagem">
        <AccordionTrigger className="text-xs font-semibold">Imagem</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div>
            <Label className="text-[11px]">Imagem principal</Label>
            <label className="mt-1 flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-border
              bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors">
              {s.mainImage ? (
                <img src={s.mainImage} className="h-full object-contain rounded" />
              ) : (
                <div className="text-center">
                  <ImageLucide className="h-5 w-5 mx-auto text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Upload imagem</span>
                </div>
              )}
              <input type="file" accept="image/*,.dng,.heic,.heif" className="hidden"
                onChange={(e) => onUpload(e.target.files?.[0], (url) => update("mainImage", url))} />
            </label>
            {s.mainImage && (
              <Button variant="ghost" size="sm" className="text-[10px] mt-1 h-6 text-destructive"
                onClick={() => update("mainImage", null)}>Remover imagem</Button>
            )}
          </div>
          <div>
            <Label className="text-[11px]">Zoom ({s.imageScale}%)</Label>
            <Slider min={50} max={200} step={1} value={[s.imageScale]}
              onValueChange={([v]) => update("imageScale", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Posição X ({s.imageOffsetX}%)</Label>
            <Slider min={0} max={100} step={1} value={[s.imageOffsetX]}
              onValueChange={([v]) => update("imageOffsetX", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Posição Y ({s.imageOffsetY}%)</Label>
            <Slider min={0} max={100} step={1} value={[s.imageOffsetY]}
              onValueChange={([v]) => update("imageOffsetY", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Borda arredondada ({s.imageRadius}px)</Label>
            <Slider min={0} max={60} step={1} value={[s.imageRadius]}
              onValueChange={([v]) => update("imageRadius", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Espaço antes da imagem ({s.imageGap}px)</Label>
            <Slider min={0} max={80} step={2} value={[s.imageGap]}
              onValueChange={([v]) => update("imageGap", v)} className="mt-1" />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Fundo & Margens */}
      <AccordionItem value="fundo">
        <AccordionTrigger className="text-xs font-semibold">Fundo & Margens</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div>
            <Label className="text-[11px]">Cor de fundo</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={s.bgColor}
                onChange={(e) => update("bgColor", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={s.bgColor} onChange={(e) => update("bgColor", e.target.value)}
                className="h-8 text-xs flex-1" />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Margem lateral ({s.paddingSides}px)</Label>
            <Slider min={16} max={120} step={2} value={[s.paddingSides]}
              onValueChange={([v]) => update("paddingSides", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Margem topo ({s.paddingTop}px)</Label>
            <Slider min={16} max={120} step={2} value={[s.paddingTop]}
              onValueChange={([v]) => update("paddingTop", v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px]">Margem inferior ({s.paddingBottom}px)</Label>
            <Slider min={16} max={120} step={2} value={[s.paddingBottom]}
              onValueChange={([v]) => update("paddingBottom", v)} className="mt-1" />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Padrão de Tipografia & Margens */}
      <AccordionItem value="presets">
        <AccordionTrigger className="text-xs font-semibold">
          <span className="flex items-center gap-2"><Bookmark className="h-3.5 w-3.5" /> Padrão de Tipografia & Margens</span>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div>
            <Label className="text-[11px] font-semibold">Salvar configuração atual</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Nome do padrão..."
                className="h-8 text-xs flex-1"
              />
              <Button size="sm" onClick={saveTypoPreset} className="h-8 text-xs">
                <Save className="h-3.5 w-3.5 mr-1" /> Salvar
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Salva: fonte, tamanho, entrelinhas, cor do texto e margens.
            </p>
          </div>

          {typoPresets.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold">Padrões salvos</Label>
              {typoPresets.map((preset, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 transition-colors">
                  <span className="text-[11px] flex-1 font-medium">{preset.name}</span>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                    onClick={() => applyTypoPreset(preset)}>
                    Aplicar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                    onClick={() => deleteTypoPreset(i)}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-[360px] min-w-[360px] border-r border-border bg-card overflow-y-auto hidden md:block">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" />
            Post Notícia Creator
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">Crie posts no estilo tweet/notícia 1080×1350</p>
        </div>

        {sidebarContent}

        <div className="p-3 border-t border-border flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="text-xs flex-1">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Resetar
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving} className="text-xs flex-1">
            <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Salvando..." : "Salvar"}
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
          <span className="text-sm font-bold text-foreground">Post Notícia</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={handleReset} className="text-xs px-2 h-8">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving} className="text-xs px-2 h-8">
              <Save className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={handleDownload}
              className="text-xs px-2 h-8 bg-primary text-primary-foreground hover:bg-primary/90">
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
                padding: `${s.paddingTop}px ${s.paddingSides}px ${s.paddingBottom}px`,
                display: "flex",
                flexDirection: "column",
                fontFamily: s.bodyFontFamily,
                overflow: "hidden",
                position: "relative",
                boxSizing: "border-box",
              }}
            >
              {/* Header: foto de perfil + nome + handle */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, flexShrink: 0 }}>
                <div
                  style={{
                    width: s.profilePhotoSize,
                    height: s.profilePhotoSize,
                    borderRadius: "50%",
                    overflow: "hidden",
                    backgroundColor: "#e5e5e5",
                    flexShrink: 0,
                    backgroundImage: s.profilePhoto ? `url(${s.profilePhoto})` : undefined,
                    backgroundSize: `${s.profilePhotoScale}%`,
                    backgroundPosition: `${s.profilePhotoOffsetX}% ${s.profilePhotoOffsetY}%`,
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 30, color: s.bodyColor, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 8 }}>
                    {s.profileName}
                    <img src={verifiedBadge} alt="Verificado" style={{ width: 28, height: 28, flexShrink: 0 }} />
                  </div>
                  <div style={{ fontSize: 24, color: "#888888", marginTop: 2 }}>
                    {s.profileHandle}
                  </div>
                </div>
              </div>

              {/* Body text */}
              <div
                style={{
                  fontSize: s.bodyFontSize,
                  color: s.bodyColor,
                  lineHeight: s.bodyLineHeight,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  flex: s.mainImage ? "0 0 auto" : "1 1 auto",
                }}
              >
                {renderHighlightedText(s.bodyText, { highlightColor: s.highlightColor, bold: s.highlightBold, italic: false, gradient: s.highlightGradient, gradientColor2: s.highlightColor2 })}
              </div>

              {/* Main image */}
              {s.mainImage && (
                <div
                  style={{
                    marginTop: s.imageGap,
                    flex: "1 1 0",
                    minHeight: 0,
                    borderRadius: s.imageRadius,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundImage: `url(${s.mainImage})`,
                      backgroundSize: s.imageScale <= 100 ? "cover" : `${s.imageScale}%`,
                      backgroundPosition: `${s.imageOffsetX}% ${s.imageOffsetY}%`,
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
