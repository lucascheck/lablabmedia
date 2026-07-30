import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Type, Image as ImageIcon, MousePointerClick, Copy, Trash2,
  ArrowUp, ArrowDown, Save, Plus, Undo2, Redo2, Download, Share2,
  Layers, SlidersHorizontal,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tools/wireframe")({
  component: WireframePage,
  head: () => ({
    meta: [
      { title: "Wireframe — LabMedia" },
      { name: "description", content: "Crie wireframes simples de criativos para redes sociais." },
    ],
  }),
});

const CANVAS_W = 1080;
const CANVAS_H = 1920;

type ElType = "text" | "image" | "cta";
type ElBase = { id: string; type: ElType; x: number; y: number; w: number; h: number; z: number; notes?: string };
type ElText = ElBase & { type: "text"; text: string; fontSize: number; fontWeight: number; align: "left" | "center" | "right"; color: string; uppercase: boolean };
type ElImage = ElBase & { type: "image"; label: string };
type ElCta = ElBase & { type: "cta"; text: string; bg: string; color: string; radius: number };
type El = ElText | ElImage | ElCta;
type Wire = { id: string; name: string; elements: El[] };

const STORAGE = "wireframe-projects-v1";
const uid = () => Math.random().toString(36).slice(2, 10);

function loadAll(): Wire[] {
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(STORAGE); return raw ? (JSON.parse(raw) as Wire[]) : []; } catch { return []; }
}
function saveAll(w: Wire[]) { localStorage.setItem(STORAGE, JSON.stringify(w)); }

function newText(z: number): ElText {
  return { id: uid(), type: "text", x: 100, y: 100, w: 600, h: 160, z, text: "Seu texto aqui", fontSize: 64, fontWeight: 700, align: "left", color: "#0f172a", uppercase: false };
}
function newImage(z: number): ElImage {
  return { id: uid(), type: "image", x: 140, y: 400, w: 800, h: 800, z, label: "Imagem" };
}
function newCta(z: number): ElCta {
  return { id: uid(), type: "cta", x: 200, y: 1500, w: 680, h: 160, z, text: "Saiba mais", bg: "#0f172a", color: "#ffffff", radius: 80 };
}

function WireframePage() {
  const [wires, setWires] = useState<Wire[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [elements, setElements] = useState<El[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const [scale, setScale] = useState(0.4);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  useEffect(() => {
    if (isMobile && selectedId) setRightOpen(true);
  }, [selectedId, isMobile]);

  // History
  const historyRef = useRef<{ past: El[][]; future: El[][] }>({ past: [], future: [] });
  const skipHistoryRef = useRef(false);
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    const all = loadAll();
    if (all.length === 0) {
      const w: Wire = { id: uid(), name: "Wireframe 1", elements: [] };
      setWires([w]); setCurrentId(w.id); setElements([]); saveAll([w]);
    } else {
      setWires(all); setCurrentId(all[0].id); setElements(all[0].elements);
    }
  }, []);

  useEffect(() => {
    const fit = () => {
      const el = canvasRef.current?.parentElement;
      if (!el) return;
      const padding = 60;
      const sx = (el.clientWidth - padding) / CANVAS_W;
      const sy = (el.clientHeight - padding) / CANVAS_H;
      setScale(Math.max(0.1, Math.min(sx, sy, 1)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const selected = useMemo(() => elements.find((e) => e.id === selectedId) ?? null, [elements, selectedId]);
  const maxZ = useMemo(() => elements.reduce((m, e) => Math.max(m, e.z), 0), [elements]);

  const persist = useCallback((next: El[]) => {
    if (!skipHistoryRef.current) {
      historyRef.current.past.push(elements);
      if (historyRef.current.past.length > 100) historyRef.current.past.shift();
      historyRef.current.future = [];
      setHistoryTick((t) => t + 1);
    }
    skipHistoryRef.current = false;
    setElements(next);
    setWires((prev) => {
      const updated = prev.map((w) => (w.id === currentId ? { ...w, elements: next } : w));
      saveAll(updated);
      return updated;
    });
  }, [elements, currentId]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past.pop()!;
    h.future.push(elements);
    skipHistoryRef.current = true;
    persist(prev);
    setHistoryTick((t) => t + 1);
  }, [elements, persist]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.pop()!;
    h.past.push(elements);
    skipHistoryRef.current = true;
    persist(next);
    setHistoryTick((t) => t + 1);
  }, [elements, persist]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const addEl = (t: ElType) => {
    const z = maxZ + 1;
    const el: El = t === "text" ? newText(z) : t === "image" ? newImage(z) : newCta(z);
    persist([...elements, el]);
    setSelectedId(el.id);
  };
  const update = (id: string, patch: Partial<El>) => {
    persist(elements.map((e) => (e.id === id ? ({ ...e, ...patch } as El) : e)));
  };
  const remove = (id: string) => {
    persist(elements.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const duplicate = (id: string) => {
    const e = elements.find((x) => x.id === id);
    if (!e) return;
    const copy: El = { ...e, id: uid(), x: e.x + 30, y: e.y + 30, z: maxZ + 1 } as El;
    persist([...elements, copy]);
    setSelectedId(copy.id);
  };
  const bringForward = (id: string) => update(id, { z: maxZ + 1 });
  const sendBackward = (id: string) => {
    const minZ = elements.reduce((m, e) => Math.min(m, e.z), maxZ);
    update(id, { z: minZ - 1 });
  };

  const saveWire = () => {
    const updated = wires.map((w) => (w.id === currentId ? { ...w, elements } : w));
    saveAll(updated); setWires(updated); toast.success("Wireframe salvo");
  };
  const newWire = () => {
    const w: Wire = { id: uid(), name: `Wireframe ${wires.length + 1}`, elements: [] };
    const next = [...wires, w]; saveAll(next); setWires(next);
    setCurrentId(w.id); setElements([]); setSelectedId(null);
    historyRef.current = { past: [], future: [] }; setHistoryTick((t) => t + 1);
  };
  const duplicateWire = () => {
    const cur = wires.find((w) => w.id === currentId); if (!cur) return;
    const w: Wire = { id: uid(), name: `${cur.name} (cópia)`, elements: cur.elements };
    const next = [...wires, w]; saveAll(next); setWires(next);
    setCurrentId(w.id); setElements(w.elements); toast.success("Wireframe duplicado");
    historyRef.current = { past: [], future: [] }; setHistoryTick((t) => t + 1);
  };
  const deleteWire = () => {
    if (wires.length <= 1) { toast.error("Mantenha ao menos um wireframe"); return; }
    const next = wires.filter((w) => w.id !== currentId);
    saveAll(next); setWires(next);
    setCurrentId(next[0].id); setElements(next[0].elements); setSelectedId(null);
    historyRef.current = { past: [], future: [] }; setHistoryTick((t) => t + 1);
  };
  const switchWire = (id: string) => {
    const w = wires.find((x) => x.id === id); if (!w) return;
    setCurrentId(id); setElements(w.elements); setSelectedId(null);
    historyRef.current = { past: [], future: [] }; setHistoryTick((t) => t + 1);
  };
  const renameWire = (name: string) => {
    const next = wires.map((w) => (w.id === currentId ? { ...w, name } : w));
    setWires(next); saveAll(next);
  };

  const exportImage = async (format: "png" | "pdf") => {
    const node = canvasRef.current; if (!node) return;
    const prevSelected = selectedId; setSelectedId(null);
    await new Promise((r) => setTimeout(r, 50));
    try {
      const dataUrl = await toPng(node, {
        width: CANVAS_W, height: CANVAS_H, pixelRatio: 1,
        style: { transform: "scale(1)", transformOrigin: "top left", width: `${CANVAS_W}px`, height: `${CANVAS_H}px` },
      });
      const name = (cur?.name || "wireframe").replace(/[^a-z0-9-_]+/gi, "-");
      if (format === "png") {
        const a = document.createElement("a"); a.href = dataUrl; a.download = `${name}.png`; a.click();
      } else {
        const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [CANVAS_W, CANVAS_H] });
        pdf.addImage(dataUrl, "PNG", 0, 0, CANVAS_W, CANVAS_H);
        pdf.save(`${name}.pdf`);
      }
      toast.success(`Exportado como ${format.toUpperCase()}`);
    } catch (e) {
      toast.error("Falha ao exportar");
      console.error(e);
    } finally {
      setSelectedId(prevSelected);
    }
  };

  const shareWire = async (w: Wire) => {
    try {
      const slug = `${w.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "wireframe"}-${uid()}`;
      const { error } = await supabase.from("shared_wireframes").insert([{
        slug, name: w.name, elements: JSON.parse(JSON.stringify(w.elements)),
      }]);
      if (error) throw error;
      const url = `${window.location.origin}/w/${slug}`;
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      toast.success("Link copiado!", { description: url });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao compartilhar");
    }
  };

  const sharePanel = async () => {
    try {
      if (wires.length === 0) { toast.error("Nenhum wireframe para compartilhar"); return; }
      const base = `painel-${uid()}`;
      const { error } = await supabase.from("shared_wireframe_panels").insert([{
        slug: base,
        name: `Painel de wireframes (${wires.length})`,
        wires: JSON.parse(JSON.stringify(wires)),
      }]);
      if (error) throw error;
      const url = `${window.location.origin}/p/${base}`;
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      toast.success("Link do painel copiado!", { description: url });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao compartilhar painel");
    }
  };

  const cur = wires.find((w) => w.id === currentId);
  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;
  void historyTick;

  const leftPanel = (
    <>
      <div className="p-4 border-b">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Wireframe</div>
        <Input value={cur?.name ?? ""} onChange={(e) => renameWire(e.target.value)} />
      </div>

      <div className="p-4 space-y-2 border-b">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Adicionar</div>
        <Button
          onClick={() => { addEl("text"); if (isMobile) setLeftOpen(false); }}
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("application/x-wireframe-el", "text"); e.dataTransfer.effectAllowed = "copy"; }}
          className="w-full justify-start cursor-grab active:cursor-grabbing"
          variant="secondary"
          title="Toque para adicionar"
        >
          <Type className="h-4 w-4" /> Text Block
        </Button>
        <p className="text-[10px] text-muted-foreground">Toque para adicionar (no desktop você também pode arrastar até o canvas).</p>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Camadas</div>
        <div className="space-y-1">
          {[...elements].sort((a, b) => b.z - a.z).map((e) => (
            <button
              key={e.id}
              onClick={() => { setSelectedId(e.id); if (isMobile) setLeftOpen(false); }}
              className={`w-full text-left text-xs px-2 py-1.5 rounded border ${
                selectedId === e.id ? "bg-accent border-accent-foreground/20" : "bg-background hover:bg-accent/50"
              }`}
            >
              {e.type === "text" ? "T" : e.type === "image" ? "I" : "C"} ·{" "}
              {e.type === "text" ? (e as ElText).text.slice(0, 18) : e.type === "cta" ? (e as ElCta).text.slice(0, 18) : "Imagem"}
            </button>
          ))}
          {elements.length === 0 && <div className="text-xs text-muted-foreground">Sem elementos ainda.</div>}
        </div>
      </div>

      <div className="p-4 border-t space-y-2">
        <Button onClick={saveWire} className="w-full"><Save className="h-4 w-4" /> Salvar</Button>
        <Button onClick={duplicateWire} variant="secondary" className="w-full">
          <Copy className="h-4 w-4" /> Duplicar
        </Button>
        <Button onClick={deleteWire} variant="destructive" className="w-full">
          <Trash2 className="h-4 w-4" /> Excluir
        </Button>
      </div>
    </>
  );

  const rightPanel = !selected ? (
    <div className="p-4 text-sm text-muted-foreground">
      Selecione um elemento para editar suas propriedades.
    </div>
  ) : (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {selected.type === "text" ? "Texto" : selected.type === "image" ? "Imagem" : "CTA"}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => bringForward(selected.id)} title="Trazer à frente">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => sendBackward(selected.id)} title="Enviar para trás">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => duplicate(selected.id)} title="Duplicar">
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => remove(selected.id)} title="Excluir">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="X"><Input type="number" inputMode="numeric" value={selected.x} onChange={(e) => update(selected.id, { x: Number(e.target.value) })} /></Field>
        <Field label="Y"><Input type="number" inputMode="numeric" value={selected.y} onChange={(e) => update(selected.id, { y: Number(e.target.value) })} /></Field>
        <Field label="L"><Input type="number" inputMode="numeric" value={selected.w} onChange={(e) => update(selected.id, { w: Number(e.target.value) })} /></Field>
        <Field label="A"><Input type="number" inputMode="numeric" value={selected.h} onChange={(e) => update(selected.id, { h: Number(e.target.value) })} /></Field>
      </div>

      {selected.type === "text" && <TextProps el={selected} update={(p) => update(selected.id, p)} />}
      {selected.type === "cta" && <CtaProps el={selected} update={(p) => update(selected.id, p)} />}
      {selected.type === "image" && (
        <Field label="Rótulo">
          <Input value={selected.label} onChange={(e) => update(selected.id, { label: e.target.value })} />
        </Field>
      )}

      <Field label="Observações internas">
        <Textarea
          value={selected.notes ?? ""}
          onChange={(e) => update(selected.id, { notes: e.target.value })}
          className="min-h-[80px]"
          placeholder="Anotações para o time de design..."
        />
      </Field>
    </div>
  );

  return (
    <div className="flex flex-col bg-background text-foreground">
    <div className="h-[calc(100vh-3rem)] flex">
      {/* Left panel — desktop */}
      <aside className="hidden md:flex w-64 border-r bg-card flex-col">
        {leftPanel}
      </aside>

      {/* Mobile sheets */}
      <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-0 flex flex-col">
          <SheetHeader className="p-4 border-b"><SheetTitle>Wireframe</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto flex flex-col">{leftPanel}</div>
        </SheetContent>
      </Sheet>
      <Sheet open={rightOpen} onOpenChange={setRightOpen}>
        <SheetContent side="right" className="w-[85vw] max-w-sm p-0 overflow-y-auto">
          <SheetHeader className="p-4 border-b"><SheetTitle>Propriedades</SheetTitle></SheetHeader>
          {rightPanel}
        </SheetContent>
      </Sheet>

      {/* Center */}
      <section className="flex-1 flex flex-col min-w-0">
        <div className="border-b bg-card flex flex-wrap items-center justify-between px-2 sm:px-4 py-2 gap-2">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto flex-1 min-w-0">
            <Button size="icon" variant="ghost" className="md:hidden shrink-0" onClick={() => setLeftOpen(true)} title="Camadas">
              <Layers className="h-4 w-4" />
            </Button>
            {wires.map((w) => (
              <button
                key={w.id}
                onClick={() => switchWire(w.id)}
                className={`text-xs px-3 py-1 rounded border whitespace-nowrap shrink-0 ${
                  w.id === currentId ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                }`}
              >
                {w.name}
              </button>
            ))}
            <button onClick={newWire} className="text-xs px-2 py-1 rounded border hover:bg-accent shrink-0">
              <Plus className="h-3 w-3 inline" />
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={undo} disabled={!canUndo} title="Desfazer">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={redo} disabled={!canRedo} title="Refazer">
              <Redo2 className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportImage("png")}>PNG</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportImage("pdf")}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setRightOpen(true)} title="Propriedades">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">{CANVAS_W}×{CANVAS_H} · {Math.round(scale * 100)}%</span>
          </div>
        </div>

        <div
          className="flex-1 overflow-auto flex items-center justify-center p-3 sm:p-8 bg-muted/40"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, flexShrink: 0 }}>
            <div
              ref={canvasRef}
              style={{
                width: CANVAS_W, height: CANVAS_H,
                transform: `scale(${scale})`, transformOrigin: "top left",
                background: "#ffffff", position: "relative",
                boxShadow: "0 30px 80px rgba(15,23,42,0.18)",
              }}
              onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/x-wireframe-el")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }
              }}
              onDrop={(e) => {
                const kind = e.dataTransfer.getData("application/x-wireframe-el");
                if (kind !== "text") return;
                e.preventDefault();
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const x = Math.round((e.clientX - rect.left) / scale);
                const y = Math.round((e.clientY - rect.top) / scale);
                const z = maxZ + 1;
                const base = newText(z);
                const el: ElText = { ...base, x: Math.max(0, x - base.w / 2), y: Math.max(0, y - base.h / 2) };
                persist([...elements, el]);
                setSelectedId(el.id);
              }}
            >
              {elements.map((el) => {
                const isEditing = editingTextId === el.id && el.type === "text";
                return (
                <Rnd
                  key={el.id}
                  size={{ width: el.w, height: el.h }}
                  position={{ x: el.x, y: el.y }}
                  scale={scale}
                  bounds="parent"
                  disableDragging={isEditing}
                  enableResizing={!isEditing}
                  onDragStop={(_, d) => update(el.id, { x: Math.round(d.x), y: Math.round(d.y) })}
                  onResizeStop={(_, __, ref, ___, pos) =>
                    update(el.id, {
                      w: parseInt(ref.style.width), h: parseInt(ref.style.height),
                      x: Math.round(pos.x), y: Math.round(pos.y),
                    })
                  }
                  onMouseDown={() => setSelectedId(el.id)}
                  onDoubleClick={() => { if (el.type === "text") setEditingTextId(el.id); }}
                  style={{ zIndex: el.z }}
                >
                  <ElementView
                    el={el}
                    selected={selectedId === el.id}
                    editing={isEditing}
                    onChangeText={(text) => update(el.id, { text } as Partial<El>)}
                    onFinishEdit={() => setEditingTextId(null)}
                  />
                </Rnd>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Right panel — desktop */}
      <aside className="hidden md:block w-72 border-l bg-card overflow-y-auto">
        {rightPanel}
      </aside>
    </div>

    {/* Gallery: saved wireframes */}
    <section className="border-t bg-muted/30 px-3 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold">Wireframes salvos</h2>
          <span className="text-xs text-muted-foreground">{wires.length} {wires.length === 1 ? "wireframe" : "wireframes"}</span>
        </div>
        <Button size="sm" variant="outline" onClick={sharePanel} disabled={wires.length === 0}>
          <Share2 className="h-4 w-4" /> Compartilhar painel
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {wires.map((w) => {
          const isCurrent = w.id === currentId;
          const thumbW = 200;
          const thumbScale = thumbW / CANVAS_W;
          const thumbH = CANVAS_H * thumbScale;
          return (
            <div
              key={w.id}
              className={`group rounded-lg border overflow-hidden bg-card transition ${isCurrent ? "ring-2 ring-primary" : "hover:border-foreground/30"}`}
            >
              <button
                onClick={() => switchWire(w.id)}
                className="block w-full"
                style={{ height: thumbH }}
                title="Abrir wireframe"
              >
                <div style={{ width: thumbW, height: thumbH, background: "#ffffff", position: "relative", overflow: "hidden" }}>
                  <div style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${thumbScale})`, transformOrigin: "top left", position: "relative" }}>
                    {w.elements.map((el) => (
                      <div key={el.id} style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z }}>
                        <ElementView el={el} selected={false} />
                      </div>
                    ))}
                  </div>
                </div>
              </button>
              <div className="px-3 py-2 border-t flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{w.name}</div>
                  <div className="text-[10px] text-muted-foreground">{w.elements.length} elem.</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Compartilhar link público"
                    onClick={(e) => { e.stopPropagation(); shareWire(w); }}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    title="Excluir"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (wires.length <= 1) { toast.error("Mantenha ao menos um wireframe"); return; }
                      const next = wires.filter((x) => x.id !== w.id);
                      saveAll(next); setWires(next);
                      if (isCurrent) {
                        setCurrentId(next[0].id); setElements(next[0].elements); setSelectedId(null);
                        historyRef.current = { past: [], future: [] }; setHistoryTick((t) => t + 1);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function TextProps({ el, update }: { el: ElText; update: (p: Partial<ElText>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Texto"><Textarea value={el.text} onChange={(e) => update({ text: e.target.value })} /></Field>
      <Field label={`Tamanho: ${el.fontSize}px`}>
        <Slider value={[el.fontSize]} min={16} max={300} step={2} onValueChange={([v]) => update({ fontSize: v })} />
      </Field>
      <Field label={`Peso: ${el.fontWeight}`}>
        <Slider value={[el.fontWeight]} min={100} max={900} step={100} onValueChange={([v]) => update({ fontWeight: v })} />
      </Field>
      <Field label="Alinhamento">
        <Select value={el.align} onValueChange={(v) => update({ align: v as ElText["align"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Esquerda</SelectItem>
            <SelectItem value="center">Centro</SelectItem>
            <SelectItem value="right">Direita</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Cor">
        <Input type="color" value={el.color} onChange={(e) => update({ color: e.target.value })} className="h-9 p-1" />
      </Field>
      <div className="flex items-center justify-between">
        <Label>UPPERCASE</Label>
        <Switch checked={el.uppercase} onCheckedChange={(v) => update({ uppercase: v })} />
      </div>
    </div>
  );
}

function CtaProps({ el, update }: { el: ElCta; update: (p: Partial<ElCta>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Texto"><Input value={el.text} onChange={(e) => update({ text: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Fundo"><Input type="color" value={el.bg} onChange={(e) => update({ bg: e.target.value })} className="h-9 p-1" /></Field>
        <Field label="Texto"><Input type="color" value={el.color} onChange={(e) => update({ color: e.target.value })} className="h-9 p-1" /></Field>
      </div>
      <Field label={`Borda arredondada: ${el.radius}px`}>
        <Slider value={[el.radius]} min={0} max={200} step={2} onValueChange={([v]) => update({ radius: v })} />
      </Field>
    </div>
  );
}

function ElementView({ el, selected, editing = false, onChangeText, onFinishEdit }: {
  el: El;
  selected: boolean;
  editing?: boolean;
  onChangeText?: (text: string) => void;
  onFinishEdit?: () => void;
}) {
  const ring = selected ? "outline outline-2 outline-sky-500" : "";
  if (el.type === "text") {
    if (editing) {
      return (
        <textarea
          autoFocus
          value={el.text}
          onChange={(e) => onChangeText?.(e.target.value)}
          onBlur={() => onFinishEdit?.()}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onFinishEdit?.(); }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={(e) => { const v = e.currentTarget.value; e.currentTarget.setSelectionRange(v.length, v.length); }}
          className={`w-full h-full ${ring}`}
          style={{
            color: el.color, fontSize: el.fontSize, fontWeight: el.fontWeight,
            textAlign: el.align, textTransform: el.uppercase ? "uppercase" : "none",
            lineHeight: 1.05, padding: 8, background: "transparent",
            border: "none", outline: "2px solid #0ea5e9", resize: "none",
            wordBreak: "break-word", fontFamily: "inherit",
          }}
        />
      );
    }
    return (
      <div className={`w-full h-full flex ${ring}`}
        style={{
          alignItems: "center",
          justifyContent: el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center",
        }}>
        <div style={{
          color: el.color, fontSize: el.fontSize, fontWeight: el.fontWeight,
          textAlign: el.align, textTransform: el.uppercase ? "uppercase" : "none",
          lineHeight: 1.05, width: "100%", padding: 8, wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}>{el.text}</div>
      </div>
    );
  }
  if (el.type === "image") {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center ${ring}`}
        style={{
          border: "4px dashed rgba(15,23,42,0.35)",
          color: "rgba(15,23,42,0.55)",
          background: "rgba(15,23,42,0.04)",
        }}>
        <ImageIcon style={{ width: 96, height: 96, opacity: 0.7 }} />
        <div style={{ marginTop: 16, fontSize: 36, fontWeight: 600 }}>{el.label}</div>
      </div>
    );
  }
  return (
    <div className={`w-full h-full flex items-center justify-center ${ring}`}
      style={{ background: el.bg, color: el.color, borderRadius: el.radius, fontSize: 44, fontWeight: 700, padding: 16 }}>
      {el.text}
    </div>
  );
}
