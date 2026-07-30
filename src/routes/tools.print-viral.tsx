import { ensureRenderableImage } from "@/lib/heic";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Download, Upload, Save, RotateCcw, BadgeCheck, ImageIcon, Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useToolProject } from "@/lib/tool-projects";
import { idbGet, idbSet, migrateFromLocalStorage } from "@/lib/editor-storage";

export const Route = createFileRoute("/tools/print-viral")({
  component: PrintViralPage,
  head: () => ({
    meta: [
      { title: "Print Viral — LabMedia" },
      { name: "description", content: "Crie composições virais com logo, texto e duas imagens lado a lado." },
    ],
  }),
});

type ImageBlock = {
  src: string | null;
  scale: number;
  offsetX: number;
  offsetY: number;
  brightness: number;
  contrast: number;
  saturation: number;
  radius: number;
  border: number;
  borderColor: string;
  shadow: boolean;
};

type State = {
  // Cabeçalho
  logo: string | null;
  logoSize: number;
  logoOpacity: number;
  companyName: string;
  verified: boolean;
  subtitle: string;
  headerFontFamily: string;
  headerTitleColor: string;
  headerSubtitleColor: string;
  headerTitleSize: number;
  headerSubtitleSize: number;
  headerAlign: "left" | "center" | "right";

  // Texto central
  bodyText: string;
  bodyFontFamily: string;
  bodyFontSize: number;
  bodyColor: string;
  bodyAlign: "left" | "center" | "right";
  bodyLineHeight: number;
  bodyBg: string;
  bodyBgTransparent: boolean;
  bodyPadding: number;
  bodyRadius: number;

  // Background da composição
  bgColor: string;
  bgImage: string | null;

  // Colunas
  left: ImageBlock;
  right: ImageBlock;
};

const defaultImage = (): ImageBlock => ({
  src: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  radius: 16,
  border: 0,
  borderColor: "#ffffff",
  shadow: true,
});

const defaultState: State = {
  logo: null,
  logoSize: 56,
  logoOpacity: 100,
  companyName: "Sua Empresa",
  verified: true,
  subtitle: "Resultados que falam por si",
  headerFontFamily: "'Sora', sans-serif",
  headerTitleColor: "#000000",
  headerSubtitleColor: "#444444",
  headerTitleSize: 28,
  headerSubtitleSize: 14,
  headerAlign: "left",

  bodyText: "Mais um cliente satisfeito com nosso atendimento! 🚀\nVeja o resultado abaixo.",
  bodyFontFamily: "'Sora', sans-serif",
  bodyFontSize: 28,
  bodyColor: "#000000",
  bodyAlign: "center",
  bodyLineHeight: 1.35,
  bodyBg: "#ffffff",
  bodyBgTransparent: false,
  bodyPadding: 24,
  bodyRadius: 16,

  bgColor: "#ffffff",
  bgImage: null,

  left: defaultImage(),
  right: defaultImage(),
};

const FONTS = [
  "'Sora', sans-serif",
  "'Inter', sans-serif",
  "'Poppins', sans-serif",
  "'Montserrat', sans-serif",
  "'Raleway', sans-serif",
  "'Playfair Display', serif",
  "'Bebas Neue', sans-serif",
  "'Oswald', sans-serif",
  "'Lora', serif",
  "'Merriweather', serif",
  "Arial, sans-serif",
  "Georgia, serif",
  "'Times New Roman', serif",
  "'Courier New', monospace",
];

async function readAsDataURL(file: File): Promise<string> {
  const ready = await ensureRenderableImage(file);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(ready);
  });
}

function PrintViralPage() {
  const { user } = useAuth();
  const storageKey = `print-viral:${user?.id ?? "anon"}`;
  const [state, setState] = useState<State>(defaultState);
  const previewRef = useRef<HTMLDivElement>(null);
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

  const update = <K extends keyof State>(k: K, v: State[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const updateBlock = (which: "left" | "right", patch: Partial<ImageBlock>) =>
    setState((s) => ({ ...s, [which]: { ...s[which], ...patch } }));

  const onUpload = async (file: File | undefined, cb: (dataUrl: string) => void) => {
    if (!file) return;
    try {
      const url = await readAsDataURL(file);
      cb(url);
    } catch {
      toast.error("Falha ao carregar imagem");
    }
  };

  const generateJpgDataUrl = async (): Promise<string> => {
    if (!previewRef.current) throw new Error("preview missing");
    const node = previewRef.current;
    const rect = node.getBoundingClientRect();
    const targetW = 1080;
    const targetH = 1350;
    const pixelRatio = targetW / rect.width;
    return await toJpeg(node, {
      quality: 0.95,
      pixelRatio,
      width: rect.width,
      height: rect.height,
      canvasWidth: targetW,
      canvasHeight: targetH,
      backgroundColor: state.bgColor,
      cacheBust: true,
    });
  };

  const { save: handleSave, saving } = useToolProject<State>({
    table: "print_virals",
    bucket: "print-virals",
    contentType: "image/jpeg",
    ext: "jpg",
    state,
    setState: (s: State) => setState(s),
    makeTitle: (s: State) =>
      (s.companyName?.trim() || s.bodyText?.trim().split("\n")[0] || "Print viral").slice(0, 80),
    generateImage: generateJpgDataUrl,
  }, user?.id);

  const handleDownload = async () => {
    try {
      const dataUrl = await generateJpgDataUrl();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `print-viral-${Date.now()}.jpg`;
      a.click();
      toast.success("Imagem 1080x1350 baixada!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar imagem");
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `print-viral-${Date.now()}.json`;
    a.click();
  };

  const importJSON = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setState({ ...defaultState, ...parsed });
      toast.success("Composição importada");
    } catch {
      toast.error("JSON inválido");
    }
  };
  // ── Padrão de tipografia & margens ──
  type TypoPreset = {
    name: string;
    headerFontFamily: string;
    headerTitleSize: number;
    headerSubtitleSize: number;
    headerTitleColor: string;
    headerSubtitleColor: string;
    bodyFontFamily: string;
    bodyFontSize: number;
    bodyLineHeight: number;
    bodyColor: string;
    bodyPadding: number;
    bodyRadius: number;
  };

  const presetsKey = `print-viral-presets:${user?.id ?? "anon"}`;
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
      headerFontFamily: state.headerFontFamily,
      headerTitleSize: state.headerTitleSize,
      headerSubtitleSize: state.headerSubtitleSize,
      headerTitleColor: state.headerTitleColor,
      headerSubtitleColor: state.headerSubtitleColor,
      bodyFontFamily: state.bodyFontFamily,
      bodyFontSize: state.bodyFontSize,
      bodyLineHeight: state.bodyLineHeight,
      bodyColor: state.bodyColor,
      bodyPadding: state.bodyPadding,
      bodyRadius: state.bodyRadius,
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
  const resetAll = () => {
    if (!confirm("Resetar toda a composição?")) return;
    setState(defaultState);
  };

  const ImageColumn = ({ which, label }: { which: "left" | "right"; label: string }) => {
    const b = state[which];
    return (
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-semibold">{label}</Label>
          {b.src && (
            <Button size="sm" variant="ghost" onClick={() => updateBlock(which, defaultImage())}>
              Limpar
            </Button>
          )}
        </div>
        <Input
          type="file"
          accept="image/*,.dng,.heic,.heif"
          onChange={(e) => onUpload(e.target.files?.[0], (url) => updateBlock(which, { src: url }))}
        />
        <div>
          <Label className="text-xs">Zoom: {b.scale.toFixed(2)}x</Label>
          <Slider value={[b.scale]} min={0.5} max={3} step={0.05}
            onValueChange={([v]) => updateBlock(which, { scale: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Pos X: {b.offsetX}%</Label>
            <Slider value={[b.offsetX]} min={-50} max={50} step={1}
              onValueChange={([v]) => updateBlock(which, { offsetX: v })} />
          </div>
          <div>
            <Label className="text-xs">Pos Y: {b.offsetY}%</Label>
            <Slider value={[b.offsetY]} min={-50} max={50} step={1}
              onValueChange={([v]) => updateBlock(which, { offsetY: v })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Brilho: {b.brightness}</Label>
            <Slider value={[b.brightness]} min={50} max={150} step={1}
              onValueChange={([v]) => updateBlock(which, { brightness: v })} />
          </div>
          <div>
            <Label className="text-xs">Contraste: {b.contrast}</Label>
            <Slider value={[b.contrast]} min={50} max={150} step={1}
              onValueChange={([v]) => updateBlock(which, { contrast: v })} />
          </div>
          <div>
            <Label className="text-xs">Saturação: {b.saturation}</Label>
            <Slider value={[b.saturation]} min={0} max={200} step={1}
              onValueChange={([v]) => updateBlock(which, { saturation: v })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Raio: {b.radius}px</Label>
            <Slider value={[b.radius]} min={0} max={48} step={1}
              onValueChange={([v]) => updateBlock(which, { radius: v })} />
          </div>
          <div>
            <Label className="text-xs">Borda: {b.border}px</Label>
            <Slider value={[b.border]} min={0} max={12} step={1}
              onValueChange={([v]) => updateBlock(which, { border: v })} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Cor borda</Label>
          <input type="color" value={b.borderColor}
            onChange={(e) => updateBlock(which, { borderColor: e.target.value })}
            className="h-8 w-10 rounded border" />
          <div className="flex items-center gap-1 ml-auto">
            <Label className="text-xs">Sombra</Label>
            <Switch checked={b.shadow} onCheckedChange={(v) => updateBlock(which, { shadow: v })} />
          </div>
        </div>
      </Card>
    );
  };

  const renderImage = (b: ImageBlock) => {
    const wrapperStyle: React.CSSProperties = {
      borderRadius: b.radius,
      border: b.border ? `${b.border}px solid ${b.borderColor}` : undefined,
      boxShadow: b.shadow ? "0 20px 50px rgba(0,0,0,0.35)" : undefined,
      overflow: "hidden",
      width: "100%",
      height: "100%",
      background: "#0b1220",
      position: "relative",
    };
    if (!b.src) {
      return (
        <div style={wrapperStyle} className="flex flex-col items-center justify-center text-slate-400 text-sm">
          <ImageIcon className="h-8 w-8 mb-2 opacity-60" />
          Envie uma imagem
        </div>
      );
    }
    const posX = 50 + b.offsetX;
    const posY = 50 + b.offsetY;
    const sizePercent = 100 * b.scale;
    return (
      <div
        style={{
          ...wrapperStyle,
          backgroundImage: `url(${b.src})`,
          backgroundSize: `${sizePercent}%`,
          backgroundPosition: `${posX}% ${posY}%`,
          backgroundRepeat: "no-repeat",
          filter: `brightness(${b.brightness}%) contrast(${b.contrast}%) saturate(${b.saturation}%)`,
        }}
      />
    );
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Print Viral</h1>
            <p className="text-sm text-muted-foreground">Crie composições com logo, texto e imagens lado a lado.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex">
              <input type="file" accept="application/json" hidden
                onChange={(e) => importJSON(e.target.files?.[0])} />
              <span className="inline-flex items-center gap-1 px-3 h-9 rounded-md border text-sm cursor-pointer hover:bg-accent">
                <Upload className="h-4 w-4" /> Importar
              </span>
            </label>
            <Button variant="outline" size="sm" onClick={exportJSON}>
              <Save className="h-4 w-4 mr-1" /> Exportar JSON
            </Button>
            <Button variant="outline" size="sm" onClick={resetAll}>
              <RotateCcw className="h-4 w-4 mr-1" /> Resetar
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" /> Baixar JPG
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          {/* Sidebar de edição */}
          <div className="space-y-4">
            <Accordion type="multiple" defaultValue={["header"]} className="space-y-2">
              <AccordionItem value="header" className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 hover:no-underline">Topo (Logo & Título)</AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-3">
                <Card className="p-4 space-y-3">
                  <Label className="font-semibold">Logo</Label>
                  <Input type="file" accept="image/*,.dng,.heic,.heif"
                    onChange={(e) => onUpload(e.target.files?.[0], (url) => update("logo", url))} />
                  {state.logo && (
                    <Button size="sm" variant="ghost" onClick={() => update("logo", null)}>Remover logo</Button>
                  )}
                  <div>
                    <Label className="text-xs">Tamanho: {state.logoSize}px</Label>
                    <Slider value={[state.logoSize]} min={24} max={140} step={1}
                      onValueChange={([v]) => update("logoSize", v)} />
                  </div>
                  <div>
                    <Label className="text-xs">Opacidade: {state.logoOpacity}%</Label>
                    <Slider value={[state.logoOpacity]} min={10} max={100} step={1}
                      onValueChange={([v]) => update("logoOpacity", v)} />
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <div>
                    <Label>Nome / Título</Label>
                    <Input value={state.companyName}
                      onChange={(e) => update("companyName", e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Verificado (check azul)</Label>
                    <Switch checked={state.verified} onCheckedChange={(v) => update("verified", v)} />
                  </div>
                  <div>
                    <Label>Subtítulo / Slogan</Label>
                    <Input value={state.subtitle}
                      onChange={(e) => update("subtitle", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Fonte</Label>
                    <Select value={state.headerFontFamily} onValueChange={(v) => update("headerFontFamily", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONTS.map((f) => <SelectItem key={f} value={f}>{f.split(",")[0]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Tam. título: {state.headerTitleSize}px</Label>
                      <Slider value={[state.headerTitleSize]} min={14} max={72} step={1}
                        onValueChange={([v]) => update("headerTitleSize", v)} />
                    </div>
                    <div>
                      <Label className="text-xs">Tam. subtítulo: {state.headerSubtitleSize}px</Label>
                      <Slider value={[state.headerSubtitleSize]} min={10} max={40} step={1}
                        onValueChange={([v]) => update("headerSubtitleSize", v)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Cor título</Label>
                      <input type="color" value={state.headerTitleColor}
                        onChange={(e) => update("headerTitleColor", e.target.value)}
                        className="h-9 w-full rounded border" />
                    </div>
                    <div>
                      <Label className="text-xs">Cor subtítulo</Label>
                      <input type="color" value={state.headerSubtitleColor}
                        onChange={(e) => update("headerSubtitleColor", e.target.value)}
                        className="h-9 w-full rounded border" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Alinhamento</Label>
                    <Select value={state.headerAlign} onValueChange={(v) => update("headerAlign", v as State["headerAlign"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Esquerda</SelectItem>
                        <SelectItem value="center">Centro</SelectItem>
                        <SelectItem value="right">Direita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="text" className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 hover:no-underline">Texto Principal</AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-3">
                <Card className="p-4 space-y-3">
                  <Label>Texto principal</Label>
                  <Textarea value={state.bodyText} rows={5}
                    onChange={(e) => update("bodyText", e.target.value)} />
                  <div>
                    <Label className="text-xs">Fonte</Label>
                    <Select value={state.bodyFontFamily} onValueChange={(v) => update("bodyFontFamily", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONTS.map((f) => <SelectItem key={f} value={f}>{f.split(",")[0]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Tamanho: {state.bodyFontSize}px</Label>
                      <Slider value={[state.bodyFontSize]} min={14} max={64} step={1}
                        onValueChange={([v]) => update("bodyFontSize", v)} />
                    </div>
                    <div>
                      <Label className="text-xs">Entrelinhas: {state.bodyLineHeight.toFixed(2)}</Label>
                      <Slider value={[state.bodyLineHeight]} min={1} max={2} step={0.05}
                        onValueChange={([v]) => update("bodyLineHeight", v)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Cor texto</Label>
                      <input type="color" value={state.bodyColor}
                        onChange={(e) => update("bodyColor", e.target.value)}
                        className="h-9 w-full rounded border" />
                    </div>
                    <div>
                      <Label className="text-xs">Alinhamento</Label>
                      <Select value={state.bodyAlign} onValueChange={(v) => update("bodyAlign", v as State["bodyAlign"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Esquerda</SelectItem>
                          <SelectItem value="center">Centro</SelectItem>
                          <SelectItem value="right">Direita</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Fundo transparente</Label>
                    <Switch checked={state.bodyBgTransparent}
                      onCheckedChange={(v) => update("bodyBgTransparent", v)} />
                  </div>
                  {!state.bodyBgTransparent && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Cor fundo bloco</Label>
                      <input type="color" value={state.bodyBg}
                        onChange={(e) => update("bodyBg", e.target.value)}
                        className="h-9 w-12 rounded border" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Padding: {state.bodyPadding}px</Label>
                      <Slider value={[state.bodyPadding]} min={0} max={64} step={2}
                        onValueChange={([v]) => update("bodyPadding", v)} />
                    </div>
                    <div>
                      <Label className="text-xs">Raio: {state.bodyRadius}px</Label>
                      <Slider value={[state.bodyRadius]} min={0} max={32} step={1}
                        onValueChange={([v]) => update("bodyRadius", v)} />
                    </div>
                  </div>
                </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="images" className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 hover:no-underline">Imagens (Esquerda & Direita)</AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-3">
                  <ImageColumn which="left" label="Coluna esquerda" />
                  <ImageColumn which="right" label="Coluna direita" />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="bg" className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 hover:no-underline">Fundo da Composição</AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-3">
                <Card className="p-4 space-y-3">
                  <Label className="font-semibold">Fundo da composição</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Cor</Label>
                    <input type="color" value={state.bgColor}
                      onChange={(e) => update("bgColor", e.target.value)}
                      className="h-9 w-12 rounded border" />
                  </div>
                  <Label className="text-xs">Imagem de fundo (opcional)</Label>
                  <Input type="file" accept="image/*,.dng,.heic,.heif"
                    onChange={(e) => onUpload(e.target.files?.[0], (url) => update("bgImage", url))} />
                  {state.bgImage && (
                    <Button size="sm" variant="ghost" onClick={() => update("bgImage", null)}>
                      Remover imagem
                    </Button>
                  )}
                </Card>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="presets" className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <span className="flex items-center gap-2"><Bookmark className="h-4 w-4" /> Padrão de Tipografia & Margens</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-3">
                  <Card className="p-4 space-y-3">
                    <Label className="font-semibold text-xs">Salvar configuração atual como padrão</Label>
                    <div className="flex gap-2">
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
                    <div className="text-[10px] text-muted-foreground">
                      Salva: fontes, tamanhos, cores de texto, entrelinhas, padding e raio do bloco de texto.
                    </div>
                  </Card>

                  {typoPresets.length > 0 && (
                    <Card className="p-4 space-y-2">
                      <Label className="font-semibold text-xs">Padrões salvos</Label>
                      {typoPresets.map((preset, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 transition-colors">
                          <span className="text-xs flex-1 font-medium">{preset.name}</span>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2"
                            onClick={() => applyTypoPreset(preset)}>
                            Aplicar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 text-destructive hover:text-destructive"
                            onClick={() => deleteTypoPreset(i)}>
                            ✕
                          </Button>
                        </div>
                      ))}
                    </Card>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Preview */}
          <div className="flex justify-center">
            <div className="w-full max-w-[1080px]">
              <div
                ref={previewRef}
                style={{
                  width: "100%",
                  aspectRatio: "4 / 5",
                  background: state.bgImage
                    ? `url(${state.bgImage}) center/cover no-repeat, ${state.bgColor}`
                    : state.bgColor,
                  padding: 40,
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                  fontFamily: state.bodyFontFamily,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    justifyContent:
                      state.headerAlign === "center" ? "center" :
                      state.headerAlign === "right" ? "flex-end" : "flex-start",
                  }}
                >
                  {state.logo && (
                    <img
                      src={state.logo}
                      alt="logo"
                      style={{
                        width: state.logoSize,
                        height: state.logoSize,
                        objectFit: "contain",
                        opacity: state.logoOpacity / 100,
                        borderRadius: 8,
                      }}
                    />
                  )}
                  <div style={{ textAlign: state.headerAlign, fontFamily: state.headerFontFamily }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      justifyContent:
                        state.headerAlign === "center" ? "center" :
                        state.headerAlign === "right" ? "flex-end" : "flex-start",
                      color: state.headerTitleColor,
                      fontSize: state.headerTitleSize, fontWeight: 700, lineHeight: 1.1,
                    }}>
                      <span>{state.companyName}</span>
                      {state.verified && (
                        <BadgeCheck style={{ width: 22, height: 22, color: "#1d9bf0" }} fill="#1d9bf0" stroke="#fff" />
                      )}
                    </div>
                    {state.subtitle && (
                      <div style={{
                        color: state.headerSubtitleColor,
                        fontSize: state.headerSubtitleSize, marginTop: 2,
                      }}>
                        {state.subtitle}
                      </div>
                    )}
                  </div>
                </div>

                {/* Texto */}
                {state.bodyText && (
                  <div
                    style={{
                      background: state.bodyBgTransparent ? "transparent" : state.bodyBg,
                      color: state.bodyColor,
                      textAlign: state.bodyAlign,
                      fontSize: state.bodyFontSize,
                      lineHeight: state.bodyLineHeight,
                      padding: state.bodyPadding,
                      borderRadius: state.bodyRadius,
                      whiteSpace: "pre-wrap",
                      fontFamily: state.bodyFontFamily,
                      fontWeight: 600,
                    }}
                  >
                    {state.bodyText}
                  </div>
                )}

                {/* Duas colunas */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                  flex: 1,
                  minHeight: 0,
                }}>
                  {renderImage(state.left)}
                  {renderImage(state.right)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
