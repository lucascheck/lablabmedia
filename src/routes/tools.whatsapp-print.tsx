import { ensureRenderableImage } from "@/lib/heic";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng, toJpeg } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone, Video, ChevronLeft, Plus, Camera, Mic, Smile, Paperclip,
  Check, CheckCheck, Trash2, Download, Upload, Save, RotateCcw,
  PhoneIncoming, PhoneMissed, PhoneOutgoing, Wifi, BatteryFull,
  Forward, MessageSquarePlus, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useToolProject } from "@/lib/tool-projects";
import { idbGet, idbSet, migrateFromLocalStorage } from "@/lib/editor-storage";

export const Route = createFileRoute("/tools/whatsapp-print")({
  component: WhatsAppPrintPage,
  head: () => ({
    meta: [
      { title: "Print WhatsApp — LabMedia" },
      { name: "description", content: "Crie prints realistas de conversas do WhatsApp." },
    ],
  }),
});

type Sender = "me" | "them";
type ReadStatus = "sent" | "delivered" | "read";
type CallType = "missed" | "incoming" | "outgoing";

type Message =
  | {
      id: string;
      kind: "text";
      sender: Sender;
      text: string;
      time: string;
      status: ReadStatus;
      forwarded?: boolean;
      authorName?: string;
    }
  | {
      id: string;
      kind: "image";
      sender: Sender;
      src: string;
      caption?: string;
      time: string;
      status: ReadStatus;
      authorName?: string;
    }
  | {
      id: string;
      kind: "sticker";
      sender: Sender;
      src: string;
      time: string;
      status: ReadStatus;
      authorName?: string;
    }
  | {
      id: string;
      kind: "audio";
      sender: Sender;
      durationSec: number;
      time: string;
      status: ReadStatus;
      authorName?: string;
    }
  | {
      id: string;
      kind: "call";
      callType: CallType;
      sender: Sender;
      time: string;
      isVideo?: boolean;
    };

type ChatState = {
  contactName: string;
  contactStatus: string;
  contactAvatar: string | null;
  headerColor: string;
  headerImage: string | null;
  systemTime: string;
  network: string;
  battery: number;
  dateLabel: string;
  isGroup: boolean;
  participants: { id: string; name: string; color: string }[];
  messages: Message[];
};

const HEADER_COLORS: { label: string; value: string }[] = [
  { label: "Verde WhatsApp", value: "#075E54" },
  { label: "Azul", value: "#1D4ED8" },
  { label: "Vermelho", value: "#B91C1C" },
  { label: "Laranja", value: "#C2410C" },
  { label: "Roxo", value: "#6D28D9" },
  { label: "Rosa", value: "#BE185D" },
  { label: "Verde-azulado", value: "#0F766E" },
  { label: "Amarelo", value: "#A16207" },
  { label: "Marrom", value: "#78350F" },
  { label: "Cinza", value: "#374151" },
];

const NAME_COLORS = [
  "#06CF9C", "#FF9500", "#7B61FF", "#FF2D55", "#5AC8FA", "#FFCC00", "#34C759", "#FF3B30",
];

const initialState: ChatState = {
  contactName: "João Silva",
  contactStatus: "online",
  contactAvatar: null,
  headerColor: "#075E54",
  headerImage: null,
  systemTime: "10:30",
  network: "4G",
  battery: 87,
  dateLabel: "HOJE",
  isGroup: false,
  participants: [
    { id: "p1", name: "João Silva", color: NAME_COLORS[0] },
  ],
  messages: [
    {
      id: "m1",
      kind: "text",
      sender: "them",
      text: "Oi! Tudo bem? 😊",
      time: "10:25",
      status: "read",
    },
    {
      id: "m2",
      kind: "text",
      sender: "me",
      text: "Oi! Tudo ótimo, e você?",
      time: "10:26",
      status: "read",
    },
    {
      id: "m3",
      kind: "text",
      sender: "them",
      text: "Tudo bem também! Vamos marcar aquele café?",
      time: "10:27",
      status: "read",
    },
  ],
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function fileToDataUrl(file: File): Promise<string> {
  const ready = await ensureRenderableImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(ready);
  });
}

function WhatsAppPrintPage() {
  const { user } = useAuth();
  const storageKey = useMemo(
    () => `wa-print:${user?.id ?? "anon"}`,
    [user?.id],
  );

  const [state, setState] = useState<ChatState>(initialState);
  const previewRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);
  const prevStorageKey = useRef<string | null>(null);

  useEffect(() => {
    if (prevStorageKey.current === storageKey) return;
    prevStorageKey.current = storageKey;
    hydrated.current = false;
    let cancelled = false;
    (async () => {
      const fromIdb = await idbGet<ChatState>(storageKey);
      const data = fromIdb ?? (await migrateFromLocalStorage<ChatState>(storageKey));
      if (cancelled) return;
      if (data && typeof data === "object") setState({ ...initialState, ...data });
      requestAnimationFrame(() => { hydrated.current = true; });
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // Persist to IndexedDB (no quota issues for image data URLs)
  useEffect(() => {
    if (!hydrated.current) return;
    const timer = setTimeout(() => { void idbSet(storageKey, state); }, 400);
    return () => clearTimeout(timer);
  }, [storageKey, state]);

  const update = (patch: Partial<ChatState>) =>
    setState((s) => ({ ...s, ...patch }));

  const addText = (sender: Sender) => {
    const id = uid();
    setState((s) => ({
      ...s,
      messages: [
        ...s.messages,
        {
          id,
          kind: "text",
          sender,
          text: "Nova mensagem",
          time: s.systemTime,
          status: "read",
        },
      ],
    }));
  };

  const addAudio = (sender: Sender) => {
    setState((s) => ({
      ...s,
      messages: [
        ...s.messages,
        { id: uid(), kind: "audio", sender, durationSec: 12, time: s.systemTime, status: "read" },
      ],
    }));
  };

  const addCall = () => {
    setState((s) => ({
      ...s,
      messages: [
        ...s.messages,
        { id: uid(), kind: "call", callType: "missed", sender: "them", time: s.systemTime, isVideo: false },
      ],
    }));
  };

  const addImageMsg = async (sender: Sender, file: File) => {
    const src = await fileToDataUrl(file);
    setState((s) => ({
      ...s,
      messages: [
        ...s.messages,
        { id: uid(), kind: "image", sender, src, time: s.systemTime, status: "read" },
      ],
    }));
  };

  const addSticker = (sender: Sender) => {
    const src = window.prompt("URL do sticker (.webp/.png):", "https://");
    if (!src) return;
    setState((s) => ({
      ...s,
      messages: [
        ...s.messages,
        { id: uid(), kind: "sticker", sender, src, time: s.systemTime, status: "read" },
      ],
    }));
  };

  const updateMessage = (id: string, patch: Partial<Message>) => {
    setState((s) => ({
      ...s,
      messages: s.messages.map((m) => (m.id === id ? ({ ...m, ...patch } as Message) : m)),
    }));
  };

  const removeMessage = (id: string) =>
    setState((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== id) }));

  const moveMessage = (id: string, dir: -1 | 1) =>
    setState((s) => {
      const idx = s.messages.findIndex((m) => m.id === id);
      if (idx < 0) return s;
      const j = idx + dir;
      if (j < 0 || j >= s.messages.length) return s;
      const next = [...s.messages];
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...s, messages: next };
    });

  const handleAvatarUpload = async (file: File) => {
    const src = await fileToDataUrl(file);
    update({ contactAvatar: src });
  };

  const handleHeaderImageUpload = async (file: File) => {
    const src = await fileToDataUrl(file);
    update({ headerImage: src });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "whatsapp-chat.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setState(parsed);
      toast.success("Chat importado");
    } catch {
      toast.error("JSON inválido");
    }
  };

  const resetChat = () => {
    if (window.confirm("Resetar a conversa?")) setState(initialState);
  };

  const generatePngDataUrl = useCallback(async (): Promise<string> => {
    if (!previewRef.current) throw new Error("preview missing");
    return await toPng(previewRef.current, {
      pixelRatio: 2, cacheBust: true, backgroundColor: "#ECE5DD",
    });
  }, []);

  const { save: handleSave, saving } = useToolProject<ChatState>({
    table: "whatsapp_prints",
    bucket: "whatsapp-prints",
    contentType: "image/png",
    ext: "png",
    state,
    setState: (s: ChatState) => setState(s),
    makeTitle: (s: ChatState) => `Conversa: ${s.contactName}`.slice(0, 60) || "Print WhatsApp",
    generateImage: generatePngDataUrl,
  }, user?.id);

  const downloadImage = async (format: "png" | "jpeg") => {
    if (!previewRef.current) return;
    try {
      const fn = format === "png" ? toPng : toJpeg;
      const dataUrl = await fn(previewRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ECE5DD",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `whatsapp-print.${format === "png" ? "png" : "jpg"}`;
      a.click();
      toast.success("Imagem baixada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar imagem");
    }
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Print WhatsApp</h1>
          <p className="text-muted-foreground mt-1">
            Crie prints realistas de conversas. Personalize tudo e baixe como imagem.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          {/* Editor */}
          <Card className="p-4 order-2 lg:order-1">
            <Tabs defaultValue="header">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="header">Cabeçalho</TabsTrigger>
                <TabsTrigger value="messages">Mensagens</TabsTrigger>
                <TabsTrigger value="export">Exportar</TabsTrigger>
              </TabsList>

              <TabsContent value="header" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome do contato/grupo</Label>
                    <Input
                      value={state.contactName}
                      onChange={(e) => update({ contactName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Input
                      value={state.contactStatus}
                      onChange={(e) => update({ contactStatus: e.target.value })}
                      placeholder="online, digitando..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Foto de perfil</Label>
                    <Input
                      type="file"
                      accept="image/*,.dng,.heic,.heif"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleAvatarUpload(f);
                      }}
                    />
                    {state.contactAvatar && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1"
                        onClick={() => update({ contactAvatar: null })}
                      >
                        Remover foto
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label>Imagem do cabeçalho (opcional)</Label>
                    <Input
                      type="file"
                      accept="image/*,.dng,.heic,.heif"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleHeaderImageUpload(f);
                      }}
                    />
                    {state.headerImage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1"
                        onClick={() => update({ headerImage: null })}
                      >
                        Remover imagem
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Cor do cabeçalho</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {HEADER_COLORS.map((c) => (
                      <button
                        key={c.value}
                        title={c.label}
                        onClick={() => update({ headerColor: c.value })}
                        className={`w-8 h-8 rounded-full border-2 ${
                          state.headerColor === c.value ? "border-foreground" : "border-transparent"
                        }`}
                        style={{ background: c.value }}
                      />
                    ))}
                    <Input
                      type="color"
                      value={state.headerColor}
                      onChange={(e) => update({ headerColor: e.target.value })}
                      className="w-12 h-8 p-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Hora do sistema</Label>
                    <Input
                      value={state.systemTime}
                      onChange={(e) => update({ systemTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Sinal de rede</Label>
                    <Select value={state.network} onValueChange={(v) => update({ network: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["5G", "4G", "3G", "Wi-Fi", "Sem sinal"].map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bateria (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={state.battery}
                      onChange={(e) => update({ battery: Math.min(100, Math.max(0, +e.target.value)) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Data exibida</Label>
                    <Input
                      value={state.dateLabel}
                      onChange={(e) => update({ dateLabel: e.target.value })}
                      placeholder="HOJE, ONTEM, 25/04..."
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Switch
                      checked={state.isGroup}
                      onCheckedChange={(v) => update({ isGroup: v })}
                      id="is-group"
                    />
                    <Label htmlFor="is-group">Modo grupo</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="messages" className="space-y-3 pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => addText("them")}>
                    <MessageSquarePlus className="h-4 w-4 mr-1" /> Texto (recebida)
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => addText("me")}>
                    <MessageSquarePlus className="h-4 w-4 mr-1" /> Texto (enviada)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addAudio("them")}>
                    <Mic className="h-4 w-4 mr-1" /> Áudio
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addSticker("them")}>
                    <Smile className="h-4 w-4 mr-1" /> Sticker
                  </Button>
                  <Button size="sm" variant="outline" onClick={addCall}>
                    <Phone className="h-4 w-4 mr-1" /> Chamada
                  </Button>
                  <label className="inline-flex">
                    <Button size="sm" variant="outline" asChild>
                      <span className="cursor-pointer">
                        <Camera className="h-4 w-4 mr-1" /> Imagem
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*,.dng,.heic,.heif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void addImageMsg("them", f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-2 max-h-[600px] overflow-auto pr-1">
                  {state.messages.map((m, i) => (
                    <Card key={m.id} className="p-3">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={m.kind === "call" ? "them" : m.sender}
                            onValueChange={(v) => updateMessage(m.id, { sender: v as Sender })}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="me">Eu (verde)</SelectItem>
                              <SelectItem value="them">Contato</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground capitalize">{m.kind}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveMessage(m.id, -1)} disabled={i === 0}>↑</Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveMessage(m.id, 1)} disabled={i === state.messages.length - 1}>↓</Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeMessage(m.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {m.kind === "text" && (
                        <>
                          <Textarea
                            value={m.text}
                            onChange={(e) => updateMessage(m.id, { text: e.target.value })}
                            rows={2}
                          />
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <Input
                              value={m.time}
                              onChange={(e) => updateMessage(m.id, { time: e.target.value })}
                              placeholder="hora"
                            />
                            {m.sender === "me" && (
                              <Select value={m.status} onValueChange={(v) => updateMessage(m.id, { status: v as ReadStatus })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sent">✓ Enviado</SelectItem>
                                  <SelectItem value="delivered">✓✓ Entregue</SelectItem>
                                  <SelectItem value="read">✓✓ Lido (azul)</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={!!m.forwarded}
                                onCheckedChange={(v) => updateMessage(m.id, { forwarded: v } as any)}
                              />
                              <span className="text-xs">Encaminhada</span>
                            </div>
                          </div>
                        </>
                      )}

                      {m.kind === "audio" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            value={m.durationSec}
                            onChange={(e) => updateMessage(m.id, { durationSec: +e.target.value } as any)}
                            placeholder="duração (s)"
                          />
                          <Input
                            value={m.time}
                            onChange={(e) => updateMessage(m.id, { time: e.target.value })}
                          />
                        </div>
                      )}

                      {m.kind === "sticker" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={m.src}
                            onChange={(e) => updateMessage(m.id, { src: e.target.value } as any)}
                            placeholder="URL"
                          />
                          <Input
                            value={m.time}
                            onChange={(e) => updateMessage(m.id, { time: e.target.value })}
                          />
                        </div>
                      )}

                      {m.kind === "image" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={m.caption ?? ""}
                            onChange={(e) => updateMessage(m.id, { caption: e.target.value } as any)}
                            placeholder="legenda"
                          />
                          <Input
                            value={m.time}
                            onChange={(e) => updateMessage(m.id, { time: e.target.value })}
                          />
                        </div>
                      )}

                      {m.kind === "call" && (
                        <div className="grid grid-cols-3 gap-2">
                          <Select value={m.callType} onValueChange={(v) => updateMessage(m.id, { callType: v as CallType } as any)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="missed">Perdida</SelectItem>
                              <SelectItem value="incoming">Recebida</SelectItem>
                              <SelectItem value="outgoing">Efetuada</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!!m.isVideo}
                              onCheckedChange={(v) => updateMessage(m.id, { isVideo: v } as any)}
                            />
                            <span className="text-xs">Vídeo</span>
                          </div>
                          <Input
                            value={m.time}
                            onChange={(e) => updateMessage(m.id, { time: e.target.value })}
                          />
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="export" className="space-y-3 pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSave} disabled={saving}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90 border-0">
                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    {saving ? "Salvando..." : "Salvar projeto"}
                  </Button>
                  <Button onClick={() => downloadImage("jpeg")}>
                    <Download className="h-4 w-4 mr-1" /> Baixar JPG
                  </Button>
                  <Button variant="secondary" onClick={() => downloadImage("png")}>
                    <Download className="h-4 w-4 mr-1" /> Baixar PNG
                  </Button>
                  <Button variant="outline" onClick={exportJson}>
                    <Save className="h-4 w-4 mr-1" /> Exportar JSON
                  </Button>
                  <label>
                    <Button variant="outline" asChild>
                      <span className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-1" /> Importar JSON
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void importJson(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <Button variant="ghost" onClick={resetChat}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Resetar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O rascunho é salvo automaticamente para sua conta neste navegador.
                </p>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Preview */}
          <div className="order-1 lg:order-2 flex justify-center">
            <PhonePreview state={state} previewRef={previewRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PhonePreview({
  state,
  previewRef,
}: {
  state: ChatState;
  previewRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={previewRef}
      className="w-[380px] rounded-[28px] overflow-hidden shadow-2xl border border-black/10 bg-white"
      style={{ fontFamily: "'Helvetica Neue', Roboto, system-ui, sans-serif" }}
    >
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-4 py-1 text-white text-xs"
        style={{ background: state.headerColor }}
      >
        <span>{state.systemTime}</span>
        <div className="flex items-center gap-1">
          <span>{state.network}</span>
          <Wifi className="h-3 w-3" />
          <span>{state.battery}%</span>
          <BatteryFull className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 py-2 text-white relative"
        style={{
          background: state.headerImage
            ? `url(${state.headerImage}) center/cover`
            : state.headerColor,
        }}
      >
        <ChevronLeft className="h-5 w-5" />
        <div className="w-9 h-9 rounded-full bg-white/30 overflow-hidden flex items-center justify-center text-xs">
          {state.contactAvatar ? (
            <img src={state.contactAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            (state.contactName || "?").charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{state.contactName}</div>
          <div className="text-[11px] opacity-90 truncate">{state.contactStatus}</div>
        </div>
        <Video className="h-5 w-5" />
        <Phone className="h-4 w-4" />
      </div>

      {/* Body */}
      <div
        className="px-3 py-3 min-h-[480px] max-h-[640px] overflow-hidden relative"
        style={{
          background:
            "#ECE5DD url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='2' cy='2' r='1' fill='%23d4ccbf' opacity='0.5'/></svg>\")",
        }}
      >
        <div className="flex justify-center mb-3">
          <span className="text-[10px] px-2 py-1 rounded bg-white/80 text-gray-600 font-medium shadow-sm">
            {state.dateLabel}
          </span>
        </div>

        <div className="space-y-1.5">
          {state.messages.map((m) => (
            <MessageBubble key={m.id} m={m} />
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-2 py-2 bg-[#F0F0F0]">
        <div className="flex-1 bg-white rounded-full flex items-center gap-2 px-3 py-1.5 shadow-sm">
          <Smile className="h-5 w-5 text-gray-500" />
          <span className="text-sm text-gray-400 flex-1">Mensagem</span>
          <Paperclip className="h-5 w-5 text-gray-500" />
          <Camera className="h-5 w-5 text-gray-500" />
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white"
          style={{ background: state.headerColor }}
        >
          <Mic className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function StatusTicks({ status }: { status: ReadStatus }) {
  if (status === "sent") return <Check className="h-3 w-3 text-gray-500 inline" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-gray-500 inline" />;
  return <CheckCheck className="h-3 w-3 text-[#34B7F1] inline" />;
}

function MessageBubble({ m }: { m: Message }) {
  if (m.kind === "call") {
    const Icon =
      m.callType === "missed" ? PhoneMissed :
      m.callType === "incoming" ? PhoneIncoming : PhoneOutgoing;
    const color = m.callType === "missed" ? "text-red-500" : "text-green-600";
    const label =
      m.callType === "missed" ? "Chamada perdida" :
      m.callType === "incoming" ? "Chamada recebida" : "Chamada efetuada";
    return (
      <div className="flex justify-center">
        <div className="bg-white rounded-lg px-3 py-2 shadow-sm flex items-center gap-2 text-xs text-gray-700">
          <Icon className={`h-4 w-4 ${color}`} />
          <span>{m.isVideo ? "Vídeo: " : ""}{label}</span>
          <span className="text-gray-500">{m.time}</span>
        </div>
      </div>
    );
  }

  const isMe = m.sender === "me";
  const bubbleBg = isMe ? "bg-[#DCF8C6]" : "bg-white";
  const align = isMe ? "justify-end" : "justify-start";
  const radius = isMe ? "rounded-[12px] rounded-tr-[2px]" : "rounded-[12px] rounded-tl-[2px]";

  return (
    <div className={`flex ${align}`}>
      <div className={`${bubbleBg} ${radius} px-2 py-1.5 max-w-[78%] shadow-sm relative`}>
        {m.kind === "text" && (
          <>
            {m.forwarded && (
              <div className="text-[10px] italic text-gray-500 flex items-center gap-1 mb-0.5">
                <Forward className="h-3 w-3" /> Encaminhada
              </div>
            )}
            <div className="text-[13px] text-gray-900 whitespace-pre-wrap break-words pr-12">
              {m.text}
            </div>
            <div className="text-[10px] text-gray-500 absolute bottom-1 right-2 flex items-center gap-0.5">
              <span>{m.time}</span>
              {isMe && <StatusTicks status={m.status} />}
            </div>
          </>
        )}

        {m.kind === "image" && (
          <div className="w-[220px]">
            <img src={m.src} alt="" className="rounded-md w-full object-cover" />
            {m.caption && <div className="text-[13px] text-gray-900 mt-1 pr-12">{m.caption}</div>}
            <div className="text-[10px] text-gray-500 text-right mt-0.5 flex justify-end items-center gap-0.5">
              <span>{m.time}</span>
              {isMe && <StatusTicks status={m.status} />}
            </div>
          </div>
        )}

        {m.kind === "sticker" && (
          <div className="w-[140px]">
            <img src={m.src} alt="" className="w-full" />
            <div className="text-[10px] text-gray-500 text-right flex justify-end items-center gap-0.5">
              <span>{m.time}</span>
              {isMe && <StatusTicks status={m.status} />}
            </div>
          </div>
        )}

        {m.kind === "audio" && (
          <div className="flex items-center gap-2 min-w-[180px] pr-10 relative">
            <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 h-1 bg-gray-300 rounded-full">
              <div className="h-1 w-1/3 bg-[#34B7F1] rounded-full" />
            </div>
            <span className="text-[10px] text-gray-600">
              {Math.floor(m.durationSec / 60)}:{String(m.durationSec % 60).padStart(2, "0")}
            </span>
            <div className="text-[10px] text-gray-500 absolute -bottom-0.5 right-1 flex items-center gap-0.5">
              <span>{m.time}</span>
              {isMe && <StatusTicks status={m.status} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
