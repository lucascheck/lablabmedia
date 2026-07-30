import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureRenderableImage } from "@/lib/heic";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Download, Upload, RotateCcw, Type, Image as ImageLucide, SplitSquareVertical,
  Plus, Copy, Trash2, ChevronLeft, ChevronRight, Images,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { AVAILABLE_FONTS } from "@/types/carousel";
import { idbGet, idbSet } from "@/lib/editor-storage";

export const Route = createFileRoute("/tools/carousel-creator-2")({
  component: CarouselCreator2Page,
  head: () => ({
    meta: [
      { title: "Carrossel Creator 2 — LabMedia" },
      { name: "description", content: "Crie carrosséis de memes split com várias páginas." },
    ],
  }),
});

type Slide = {
  id: string;
  topImage: string | null;
  bottomImage: string | null;
  splitRatio: number;
  topOffsetX: number;
  topOffsetY: number;
  topScale: number;
  bottomOffsetX: number;
  bottomOffsetY: number;
  bottomScale: number;

  topText: string;
  bottomText: string;
  centerText: string;
  textMode: "split" | "center";

  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  textStroke: boolean;
  strokeColor: string;
  strokeWidth: number;
  textShadow: boolean;
  uppercase: boolean;
  textAlign: "left" | "center" | "right";

  topTextY: number;
  bottomTextY: number;
  textPaddingX: number;

  centerBgColor: string;
  centerBgOpacity: number;
  centerPaddingY: number;
};

type Doc = {
  slides: Slide[];
  activeIndex: number;
};

function createSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    id: crypto.randomUUID(),
    topImage: null,
    bottomImage: null,
    splitRatio: 50,
    topOffsetX: 50,
    topOffsetY: 50,
    topScale: 100,
    bottomOffsetX: 50,
    bottomOffsetY: 50,
    bottomScale: 100,
    topText: "Para pobres, você vende:",
    bottomText: "Preço.",
    centerText: "Seu texto aqui",
    textMode: "split",
    fontFamily: "'Sora', sans-serif",
    fontSize: 64,
    fontWeight: 800,
    textColor: "#ffffff",
    textStroke: true,
    strokeColor: "#000000",
    strokeWidth: 3,
    textShadow: true,
    uppercase: false,
    textAlign: "center",
    topTextY: 85,
    bottomTextY: 45,
    textPaddingX: 60,
    centerBgColor: "#ffffff",
    centerBgOpacity: 100,
    centerPaddingY: 32,
    ...overrides,
  };
}

const defaultDoc: Doc = { slides: [createSlide()], activeIndex: 0 };

async function readAsDataURL(file: File): Promise<string> {
  const ready = await ensureRenderableImage(file);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(ready);
  });
}

function CarouselCreator2Page() {
  const { user } = useAuth();
  const storageKey = `carousel-creator-2:${user?.id ?? "anon"}`;
  const [doc, setDoc] = useState<Doc>(defaultDoc);
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      const data = await idbGet<Doc | Slide>(storageKey);
      if (data) {
        // Migrate single-slide legacy state
        if ((data as Doc).slides && Array.isArray((data as Doc).slides)) {
          const d = data as Doc;
          setDoc({
            slides: d.slides.length ? d.slides.map((s) => ({ ...createSlide(), ...s })) : [createSlide()],
            activeIndex: Math.min(d.activeIndex ?? 0, (d.slides?.length ?? 1) - 1),
          });
        } else {
          setDoc({ slides: [{ ...createSlide(), ...(data as Slide) }], activeIndex: 0 });
        }
      }
      requestAnimationFrame(() => { hydrated.current = true; });
    })();
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => { void idbSet(storageKey, doc); }, 400);
    return () => clearTimeout(t);
  }, [doc, storageKey]);

  useEffect(() => {
    const updateScale = () => {
      if (!canvasRef.current) return;
      const { clientWidth, clientHeight } = canvasRef.current;
      const padding = clientWidth < 768 ? 16 : 64;
      setScale(Math.min((clientWidth - padding) / 1080, (clientHeight - padding) / 1350, 1));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    const obs = new ResizeObserver(updateScale);
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => { window.removeEventListener("resize", updateScale); obs.disconnect(); };
  }, []);

  const activeIndex = Math.min(doc.activeIndex, doc.slides.length - 1);
  const s = doc.slides[activeIndex] ?? doc.slides[0];

  const updateSlide = <K extends keyof Slide>(k: K, v: Slide[K]) =>
    setDoc((prev) => {
      const slides = prev.slides.slice();
      slides[activeIndex] = { ...slides[activeIndex], [k]: v };
      return { ...prev, slides };
    });

  const setActive = (i: number) => setDoc((p) => ({ ...p, activeIndex: i }));

  const addSlide = () => setDoc((p) => {
    const base = p.slides[p.activeIndex];
    // New blank slide but inherit typography for consistency
    const next = createSlide({
      fontFamily: base.fontFamily, fontSize: base.fontSize, fontWeight: base.fontWeight,
      textColor: base.textColor, textStroke: base.textStroke, strokeColor: base.strokeColor,
      strokeWidth: base.strokeWidth, textShadow: base.textShadow, uppercase: base.uppercase,
      textAlign: base.textAlign, textPaddingX: base.textPaddingX,
      topText: "", bottomText: "", centerText: "",
    });
    const slides = [...p.slides, next];
    return { slides, activeIndex: slides.length - 1 };
  });

  const duplicateSlide = (i: number) => setDoc((p) => {
    const copy: Slide = { ...p.slides[i], id: crypto.randomUUID() };
    const slides = [...p.slides.slice(0, i + 1), copy, ...p.slides.slice(i + 1)];
    return { slides, activeIndex: i + 1 };
  });

  const deleteSlide = (i: number) => setDoc((p) => {
    if (p.slides.length <= 1) {
      toast.info("Mantenha pelo menos um slide");
      return p;
    }
    const slides = p.slides.filter((_, idx) => idx !== i);
    return { slides, activeIndex: Math.max(0, Math.min(p.activeIndex, slides.length - 1)) };
  });

  const moveSlide = (i: number, dir: -1 | 1) => setDoc((p) => {
    const j = i + dir;
    if (j < 0 || j >= p.slides.length) return p;
    const slides = p.slides.slice();
    [slides[i], slides[j]] = [slides[j], slides[i]];
    return { slides, activeIndex: j };
  });

  const onUpload = async (which: "top" | "bottom", file: File | undefined) => {
    if (!file) return;
    try {
      const url = await readAsDataURL(file);
      updateSlide(which === "top" ? "topImage" : "bottomImage", url);
    } catch {
      toast.error("Falha ao carregar imagem");
    }
  };

  const exportNode = useCallback(async (node: HTMLElement, filename: string) => {
    const { toPng } = await import("html-to-image");
    const { createExportNode } = await import("@/utils/exportImage");
    const prepared = await createExportNode(node);
    try {
      const dataUrl = await toPng(prepared.node, {
        width: 1080, height: 1350, pixelRatio: 1,
        cacheBust: true, skipAutoScale: true, includeQueryParams: true,
      });
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } finally { prepared.cleanup(); }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!previewRef.current) return;
    try {
      await exportNode(previewRef.current, `meme-split-${activeIndex + 1}-${Date.now()}.png`);
      toast.success("Imagem exportada!");
    } catch (err) {
      console.error(err); toast.error("Erro ao exportar");
    }
  }, [exportNode, activeIndex]);

  const handleDownloadAll = useCallback(async () => {
    const originalIndex = activeIndex;
    try {
      for (let i = 0; i < doc.slides.length; i++) {
        setDoc((p) => ({ ...p, activeIndex: i }));
        await new Promise((r) => setTimeout(r, 250));
        if (!previewRef.current) continue;
        await exportNode(previewRef.current, `meme-split-${String(i + 1).padStart(2, "0")}.png`);
        await new Promise((r) => setTimeout(r, 120));
      }
      toast.success(`${doc.slides.length} imagens exportadas!`);
    } catch (err) {
      console.error(err); toast.error("Erro ao exportar todos");
    } finally {
      setDoc((p) => ({ ...p, activeIndex: originalIndex }));
    }
  }, [doc.slides.length, activeIndex, exportNode]);

  const handleReset = () => { setDoc(defaultDoc); toast.info("Resetado"); };

  const textStyleBase: React.CSSProperties = useMemo(() => ({
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    color: s.textColor,
    textAlign: s.textAlign,
    textTransform: s.uppercase ? "uppercase" : "none",
    lineHeight: 1.1,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    WebkitTextStroke: s.textStroke ? `${s.strokeWidth}px ${s.strokeColor}` : undefined,
    textShadow: s.textShadow ? "0 4px 16px rgba(0,0,0,0.65)" : undefined,
    padding: `0 ${s.textPaddingX}px`,
    width: "100%",
  }), [s]);

  const centerBgRgba = (() => {
    const hex = s.centerBgColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${s.centerBgOpacity / 100})`;
  })();

  const topHeight = (1350 * s.splitRatio) / 100;
  const bottomHeight = 1350 - topHeight;

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden bg-background">
      <aside className="w-[340px] min-w-[340px] border-r border-border bg-card overflow-y-auto hidden md:block">
        <div className="p-3 border-b border-border flex flex-col gap-2">
          <h2 className="font-bold text-sm flex items-center gap-1.5">
            <SplitSquareVertical className="h-4 w-4" /> Carrossel Creator 2
          </h2>
          <p className="text-[11px] text-muted-foreground">Memes split em vários slides.</p>
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleReset} className="text-xs h-8 px-2">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
            <Button size="sm" onClick={handleDownload} className="text-xs h-8 px-2 bg-primary text-primary-foreground">
              <Download className="h-3.5 w-3.5 mr-1" /> PNG
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDownloadAll} className="text-xs h-8 px-2">
              <Images className="h-3.5 w-3.5 mr-1" /> Todos ({doc.slides.length})
            </Button>
          </div>
        </div>

        <Accordion type="multiple" defaultValue={["images", "text", "style"]} className="px-3 py-2">
          <AccordionItem value="images">
            <AccordionTrigger className="text-xs font-bold gap-2">
              <ImageLucide className="h-3.5 w-3.5" /> Imagens
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div>
                <Label className="text-[11px]">Divisão (cima: {s.splitRatio}%)</Label>
                <Slider min={20} max={80} step={1} value={[s.splitRatio]} onValueChange={([v]) => updateSlide("splitRatio", v)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold">Imagem de cima</Label>
                <label className="flex items-center justify-center h-9 border border-dashed border-border rounded cursor-pointer text-xs hover:bg-muted">
                  <Upload className="h-3.5 w-3.5 mr-1" /> {s.topImage ? "Trocar" : "Upload"}
                  <input type="file" accept="image/*,.heic,.heif" className="hidden"
                    onChange={(e) => onUpload("top", e.target.files?.[0])} />
                </label>
                {s.topImage && (
                  <>
                    <Label className="text-[11px]">Zoom ({s.topScale}%)</Label>
                    <Slider min={50} max={250} step={1} value={[s.topScale]} onValueChange={([v]) => updateSlide("topScale", v)} />
                    <Label className="text-[11px]">Posição X ({s.topOffsetX}%)</Label>
                    <Slider min={0} max={100} step={1} value={[s.topOffsetX]} onValueChange={([v]) => updateSlide("topOffsetX", v)} />
                    <Label className="text-[11px]">Posição Y ({s.topOffsetY}%)</Label>
                    <Slider min={0} max={100} step={1} value={[s.topOffsetY]} onValueChange={([v]) => updateSlide("topOffsetY", v)} />
                    <Button variant="outline" size="sm" className="text-xs h-7 w-full"
                      onClick={() => updateSlide("topImage", null)}>Remover</Button>
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold">Imagem de baixo</Label>
                <label className="flex items-center justify-center h-9 border border-dashed border-border rounded cursor-pointer text-xs hover:bg-muted">
                  <Upload className="h-3.5 w-3.5 mr-1" /> {s.bottomImage ? "Trocar" : "Upload"}
                  <input type="file" accept="image/*,.heic,.heif" className="hidden"
                    onChange={(e) => onUpload("bottom", e.target.files?.[0])} />
                </label>
                {s.bottomImage && (
                  <>
                    <Label className="text-[11px]">Zoom ({s.bottomScale}%)</Label>
                    <Slider min={50} max={250} step={1} value={[s.bottomScale]} onValueChange={([v]) => updateSlide("bottomScale", v)} />
                    <Label className="text-[11px]">Posição X ({s.bottomOffsetX}%)</Label>
                    <Slider min={0} max={100} step={1} value={[s.bottomOffsetX]} onValueChange={([v]) => updateSlide("bottomOffsetX", v)} />
                    <Label className="text-[11px]">Posição Y ({s.bottomOffsetY}%)</Label>
                    <Slider min={0} max={100} step={1} value={[s.bottomOffsetY]} onValueChange={([v]) => updateSlide("bottomOffsetY", v)} />
                    <Button variant="outline" size="sm" className="text-xs h-7 w-full"
                      onClick={() => updateSlide("bottomImage", null)}>Remover</Button>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="text">
            <AccordionTrigger className="text-xs font-bold gap-2">
              <Type className="h-3.5 w-3.5" /> Textos
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div>
                <Label className="text-[11px]">Modo</Label>
                <Select value={s.textMode} onValueChange={(v) => updateSlide("textMode", v as Slide["textMode"])}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="split">Texto em cima e embaixo</SelectItem>
                    <SelectItem value="center">Texto centralizado no meio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {s.textMode === "split" ? (
                <>
                  <div>
                    <Label className="text-[11px]">Texto de cima</Label>
                    <Textarea value={s.topText} onChange={(e) => updateSlide("topText", e.target.value)}
                      className="text-xs mt-1" rows={2} />
                    <Label className="text-[11px] mt-2 block">Posição vertical ({s.topTextY}%)</Label>
                    <Slider min={5} max={95} step={1} value={[s.topTextY]} onValueChange={([v]) => updateSlide("topTextY", v)} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Texto de baixo</Label>
                    <Textarea value={s.bottomText} onChange={(e) => updateSlide("bottomText", e.target.value)}
                      className="text-xs mt-1" rows={2} />
                    <Label className="text-[11px] mt-2 block">Posição vertical ({s.bottomTextY}%)</Label>
                    <Slider min={5} max={95} step={1} value={[s.bottomTextY]} onValueChange={([v]) => updateSlide("bottomTextY", v)} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-[11px]">Texto central</Label>
                    <Textarea value={s.centerText} onChange={(e) => updateSlide("centerText", e.target.value)}
                      className="text-xs mt-1" rows={3} />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-[11px]">Cor de fundo</Label>
                      <input type="color" value={s.centerBgColor} onChange={(e) => updateSlide("centerBgColor", e.target.value)}
                        className="w-full h-8 rounded cursor-pointer mt-1" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-[11px]">Opacidade ({s.centerBgOpacity}%)</Label>
                      <Slider min={0} max={100} step={1} value={[s.centerBgOpacity]} onValueChange={([v]) => updateSlide("centerBgOpacity", v)} className="mt-3" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px]">Padding vertical ({s.centerPaddingY}px)</Label>
                    <Slider min={0} max={100} step={1} value={[s.centerPaddingY]} onValueChange={([v]) => updateSlide("centerPaddingY", v)} />
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="style">
            <AccordionTrigger className="text-xs font-bold gap-2">
              <Type className="h-3.5 w-3.5" /> Tipografia
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div>
                <Label className="text-[11px]">Fonte</Label>
                <Select value={s.fontFamily} onValueChange={(v) => updateSlide("fontFamily", v)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_FONTS.map((f) => (
                      <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Tamanho ({s.fontSize}px)</Label>
                <Slider min={20} max={140} step={1} value={[s.fontSize]} onValueChange={([v]) => updateSlide("fontSize", v)} />
              </div>
              <div>
                <Label className="text-[11px]">Peso ({s.fontWeight})</Label>
                <Slider min={300} max={900} step={100} value={[s.fontWeight]} onValueChange={([v]) => updateSlide("fontWeight", v)} />
              </div>
              <div>
                <Label className="text-[11px]">Alinhamento</Label>
                <Select value={s.textAlign} onValueChange={(v) => updateSlide("textAlign", v as Slide["textAlign"])}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Esquerda</SelectItem>
                    <SelectItem value="center">Centro</SelectItem>
                    <SelectItem value="right">Direita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Padding lateral ({s.textPaddingX}px)</Label>
                <Slider min={0} max={200} step={1} value={[s.textPaddingX]} onValueChange={([v]) => updateSlide("textPaddingX", v)} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-[11px]">Cor do texto</Label>
                  <input type="color" value={s.textColor} onChange={(e) => updateSlide("textColor", e.target.value)}
                    className="w-full h-8 rounded cursor-pointer mt-1" />
                </div>
                <div className="flex-1">
                  <Label className="text-[11px]">Cor do contorno</Label>
                  <input type="color" value={s.strokeColor} onChange={(e) => updateSlide("strokeColor", e.target.value)}
                    className="w-full h-8 rounded cursor-pointer mt-1" />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <Label className="text-[11px]">Contorno</Label>
                <input type="checkbox" checked={s.textStroke} onChange={(e) => updateSlide("textStroke", e.target.checked)} />
              </div>
              {s.textStroke && (
                <div>
                  <Label className="text-[11px]">Espessura ({s.strokeWidth}px)</Label>
                  <Slider min={1} max={10} step={1} value={[s.strokeWidth]} onValueChange={([v]) => updateSlide("strokeWidth", v)} />
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <Label className="text-[11px]">Sombra no texto</Label>
                <input type="checkbox" checked={s.textShadow} onChange={(e) => updateSlide("textShadow", e.target.checked)} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <Label className="text-[11px]">MAIÚSCULAS</Label>
                <input type="checkbox" checked={s.uppercase} onChange={(e) => updateSlide("uppercase", e.target.checked)} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </aside>

      {/* Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-card shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold truncate">Carrossel Creator 2</span>
            <span className="text-xs text-muted-foreground">
              Slide {activeIndex + 1} / {doc.slides.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setActive(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setActive(Math.min(doc.slides.length - 1, activeIndex + 1))}
              disabled={activeIndex === doc.slides.length - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handleDownload} className="text-xs bg-primary text-primary-foreground">
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar
            </Button>
          </div>
        </div>

        <div ref={canvasRef} className="flex-1 flex items-center justify-center bg-background overflow-hidden p-2 md:p-8 relative">
          <div style={{ width: Math.floor(1080 * scale), height: Math.floor(1350 * scale), flexShrink: 0, position: "relative" }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
              <div ref={previewRef} style={{ width: 1080, height: 1350, position: "relative", overflow: "hidden", background: "#111" }}>
                {/* Top half */}
                <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: topHeight, overflow: "hidden", background: "#222" }}>
                  {s.topImage ? (
                    <img src={s.topImage} alt="" style={{
                      position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                      objectPosition: `${s.topOffsetX}% ${s.topOffsetY}%`,
                      transform: `scale(${s.topScale / 100})`, transformOrigin: "center center",
                    }} />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 24 }}>
                      Imagem de cima
                    </div>
                  )}
                  {s.textMode === "split" && s.topText && (
                    <div style={{ position: "absolute", left: 0, right: 0, top: `${s.topTextY}%`, transform: "translateY(-50%)" }}>
                      <div style={textStyleBase}>{s.topText}</div>
                    </div>
                  )}
                </div>

                {/* Bottom half */}
                <div style={{ position: "absolute", left: 0, top: topHeight, width: 1080, height: bottomHeight, overflow: "hidden", background: "#222" }}>
                  {s.bottomImage ? (
                    <img src={s.bottomImage} alt="" style={{
                      position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                      objectPosition: `${s.bottomOffsetX}% ${s.bottomOffsetY}%`,
                      transform: `scale(${s.bottomScale / 100})`, transformOrigin: "center center",
                    }} />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 24 }}>
                      Imagem de baixo
                    </div>
                  )}
                  {s.textMode === "split" && s.bottomText && (
                    <div style={{ position: "absolute", left: 0, right: 0, top: `${s.bottomTextY}%`, transform: "translateY(-50%)" }}>
                      <div style={textStyleBase}>{s.bottomText}</div>
                    </div>
                  )}
                </div>

                {s.textMode === "center" && s.centerText && (
                  <div style={{
                    position: "absolute", left: 0, right: 0,
                    top: topHeight, transform: "translateY(-50%)",
                    background: centerBgRgba,
                    padding: `${s.centerPaddingY}px 0`,
                  }}>
                    <div style={textStyleBase}>{s.centerText}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Slide strip */}
        <div className="border-t border-border bg-card shrink-0 p-2 flex items-center gap-2 overflow-x-auto">
          {doc.slides.map((sl, i) => {
            const isActive = i === activeIndex;
            return (
              <div key={sl.id} className={`group relative shrink-0 rounded border-2 transition ${isActive ? "border-primary" : "border-border hover:border-muted-foreground"}`}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className="block w-[72px] h-[90px] overflow-hidden rounded bg-black relative"
                  title={`Slide ${i + 1}`}
                >
                  {/* mini preview */}
                  <div style={{ position: "absolute", inset: 0 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: `${sl.splitRatio}%`, background: "#222", overflow: "hidden" }}>
                      {sl.topImage && <img src={sl.topImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${sl.topOffsetX}% ${sl.topOffsetY}%` }} />}
                    </div>
                    <div style={{ position: "absolute", left: 0, bottom: 0, right: 0, height: `${100 - sl.splitRatio}%`, background: "#222", overflow: "hidden" }}>
                      {sl.bottomImage && <img src={sl.bottomImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${sl.bottomOffsetX}% ${sl.bottomOffsetY}%` }} />}
                    </div>
                  </div>
                  <span className="absolute top-0.5 left-1 text-[10px] font-bold text-white drop-shadow">{i + 1}</span>
                </button>
                <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5 bg-card border border-border rounded shadow-sm p-0.5">
                  <button type="button" title="Mover ←" onClick={() => moveSlide(i, -1)} className="p-0.5 hover:bg-muted rounded">
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <button type="button" title="Duplicar" onClick={() => duplicateSlide(i)} className="p-0.5 hover:bg-muted rounded">
                    <Copy className="h-3 w-3" />
                  </button>
                  <button type="button" title="Excluir" onClick={() => deleteSlide(i)} className="p-0.5 hover:bg-destructive/20 rounded text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <button type="button" title="Mover →" onClick={() => moveSlide(i, 1)} className="p-0.5 hover:bg-muted rounded">
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={addSlide} className="shrink-0 h-[90px] w-[72px] flex-col gap-1 text-[10px]">
            <Plus className="h-4 w-4" />
            Slide
          </Button>
        </div>
      </div>
    </div>
  );
}
