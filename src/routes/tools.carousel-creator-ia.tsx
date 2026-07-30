import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { generateCarouselContent } from "@/lib/ai-carousel.functions";
import { getAiConfigStatus, setAiApiKey } from "@/lib/ai-config.functions";
import { getAiUsageStats, setAiUsageLimits } from "@/lib/ai-usage.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles, Link2, Loader2, Wand2, AlertTriangle, X, Settings, KeyRound, Check,
  Gauge, BarChart3, CheckCircle2, XCircle, Zap,
} from "lucide-react";

export const Route = createFileRoute("/tools/carousel-creator-ia")({
  component: CarouselCreatorIaPage,
  head: () => ({
    meta: [
      { title: "Carrossel Creator IA — LabMedia" },
      { name: "description", content: "Gere o roteiro do seu carrossel com IA a partir de um tema ou de um link." },
    ],
  }),
});

type Mode = "topic" | "link";
type UsageRow = {
  id: string;
  created_at: string;
  mode: string;
  slide_count: number | null;
  success: boolean;
  tokens_input: number | null;
  tokens_output: number | null;
  error_message: string | null;
};
type UsageStats = {
  isAdmin: boolean;
  dailyLimit: number;
  monthlyLimit: number;
  dailyCount: number;
  monthlyCount: number;
  totalCount: number;
  successCount: number;
  tokensToday: number;
  recent: UsageRow[];
};

const NICHES = ["Tecnologia", "Inteligência Artificial", "Marketing", "Negócios", "Carreira", "Educação", "Saúde", "Outro"];
const OBJECTIVES = ["Educar", "Gerar debate", "Vender / converter", "Entretenimento e viral"];
const TONES = ["Direto e assertivo", "Provocativo", "Educativo", "Bem-humorado"];
const SLIDE_COUNTS = [5, 6, 7, 8, 9];

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function barColor(pct: number) {
  if (pct >= 90) return "bg-destructive";
  if (pct >= 70) return "bg-brand-gold";
  return "bg-brand-accent";
}

function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value} / {max}</span>
      </div>
      <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CarouselCreatorIaPage() {
  const { user, loading } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const generate = useServerFn(generateCarouselContent);
  const checkAiConfig = useServerFn(getAiConfigStatus);
  const saveAiKey = useServerFn(setAiApiKey);
  const fetchUsageStats = useServerFn(getAiUsageStats);
  const saveUsageLimits = useServerFn(setAiUsageLimits);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const [mode, setMode] = useState<Mode>("topic");
  const [topic, setTopic] = useState("");
  const [link, setLink] = useState("");
  const [niche, setNiche] = useState("");
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState("");
  const [slideCount, setSlideCount] = useState(7);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [dailyLimitInput, setDailyLimitInput] = useState("");
  const [monthlyLimitInput, setMonthlyLimitInput] = useState("");
  const [savingLimits, setSavingLimits] = useState(false);

  useEffect(() => {
    checkAiConfig().then((r) => setAiConfigured(r.configured));
  }, []);

  const loadUsage = async () => {
    setLoadingUsage(true);
    const accessToken = await getAccessToken();
    const result = await fetchUsageStats({ data: { accessToken } });
    setLoadingUsage(false);
    if (result.ok) {
      setUsage(result.stats);
      setDailyLimitInput(String(result.stats.dailyLimit));
      setMonthlyLimitInput(String(result.stats.monthlyLimit));
    }
  };

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    const accessToken = await getAccessToken();
    const result = await saveAiKey({ data: { accessToken, apiKey: apiKeyInput.trim() } });
    setSavingKey(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Chave da IA salva! Já pode gerar carrosséis.");
    setAiConfigured(true);
    setShowConfigForm(false);
    setApiKeyInput("");
  };

  const handleSaveLimits = async () => {
    const dailyLimit = parseInt(dailyLimitInput, 10);
    const monthlyLimit = parseInt(monthlyLimitInput, 10);
    if (!dailyLimit || !monthlyLimit) return;
    setSavingLimits(true);
    const accessToken = await getAccessToken();
    const result = await saveUsageLimits({ data: { accessToken, dailyLimit, monthlyLimit } });
    setSavingLimits(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Limites atualizados");
    void loadUsage();
  };

  const canGenerate = (mode === "topic" ? topic.trim().length > 4 : link.trim().length > 4) && !busy;

  const runGeneration = async () => {
    if (!user || !canGenerate) return;
    setBusy(true);
    setErrorMsg("");
    const accessToken = await getAccessToken();
    const result = await generate({
      data: {
        accessToken,
        mode,
        topic: mode === "topic" ? topic.trim() : undefined,
        link: mode === "link" ? link.trim() : undefined,
        niche: niche || undefined,
        objective: objective || undefined,
        tone: tone || undefined,
        slideCount,
        instagramHandle: instagramHandle.trim() || undefined,
      },
    });

    if (!result.ok) {
      if (result.error === "AI_NOT_CONFIGURED") {
        setAiConfigured(false);
        setShowConfigForm(true);
        setErrorMsg("");
        setBusy(false);
        return;
      }
      setErrorMsg(result.error);
      setBusy(false);
      void loadUsage();
      return;
    }

    try {
      const title = (result.carousel.slides[0]?.title || topic || "Carrossel IA").slice(0, 80);
      const { data, error } = await supabase
        .from("carousels")
        .insert({
          user_id: user.id,
          title,
          username: result.carousel.instagramHandle || "your_username",
          project_data: result.carousel as never,
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("Erro ao salvar o carrossel gerado");
      toast.success("Carrossel gerado!");
      navigate({ to: "/tools/carousel-creator-ia-preview", search: { id: data.id } as never });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao salvar o carrossel gerado");
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-light bg-accent px-3 py-1 text-xs text-accent-foreground font-medium mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Carrossel Creator IA
          </div>
          <h1 className="text-3xl font-bold tracking-[-0.01em] text-brand-starbucks">Crie um carrossel com IA</h1>
          <p className="text-muted-foreground mt-2">
            Escolha um tópico, ajuste as opções e clique em gerar — a IA escreve o roteiro dos slides e te leva direto pro editor.
          </p>
        </div>

        <Tabs defaultValue="gerar" onValueChange={(v) => { if (v === "uso") void loadUsage(); }}>
          <TabsList className="mb-6">
            <TabsTrigger value="gerar"><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Gerar</TabsTrigger>
            <TabsTrigger value="uso"><Gauge className="h-3.5 w-3.5 mr-1.5" /> Uso &amp; Limites</TabsTrigger>
          </TabsList>

          <TabsContent value="gerar" className="space-y-0">
            {aiConfigured === true && !showConfigForm && profile?.isAdmin && (
              <button
                onClick={() => setShowConfigForm(true)}
                className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Check className="h-3.5 w-3.5 text-brand-accent" /> IA configurada (Gemini)
                <span className="underline">reconfigurar</span>
              </button>
            )}

            {aiConfigured === false && !profile?.isAdmin && (
              <Card className="p-4 mb-6 flex items-start gap-3 border-brand-gold/40 bg-brand-gold-lightest">
                <AlertTriangle className="h-4 w-4 text-brand-gold mt-0.5 shrink-0" />
                <p className="text-sm text-foreground">
                  A geração por IA ainda não foi configurada por um administrador. Peça pra alguém do time com acesso de admin configurar aqui mesmo nesta página, ou use o Carrossel Creator manual por enquanto.
                </p>
              </Card>
            )}

            {(showConfigForm || (aiConfigured === false && profile?.isAdmin)) && (
              <Card className="p-6 mb-6 space-y-4 border-brand-light">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-brand-uplift flex items-center justify-center shrink-0">
                    <KeyRound className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Configurar IA (Google Gemini)</h3>
                    <p className="text-xs text-muted-foreground">
                      Crie uma chave gratuita em{" "}
                      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline text-brand-accent">
                        aistudio.google.com/apikey
                      </a>{" "}
                      e cole abaixo. Fica salva só no servidor.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Cole sua GEMINI_API_KEY aqui"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    disabled={savingKey}
                  />
                  <Button onClick={handleSaveKey} disabled={savingKey || !apiKeyInput.trim()}>
                    {savingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                    Salvar
                  </Button>
                  {aiConfigured === true && (
                    <Button variant="ghost" onClick={() => setShowConfigForm(false)}>Cancelar</Button>
                  )}
                </div>
              </Card>
            )}

            <Card className="p-6 space-y-5">
              {/* Fonte do conteúdo — alternância inline, sem trocar de tela */}
              <div className="flex rounded-full bg-secondary p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setMode("topic")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    mode === "topic" ? "bg-brand-starbucks text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Tópico
                </button>
                <button
                  type="button"
                  onClick={() => setMode("link")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    mode === "link" ? "bg-brand-accent text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Link2 className="h-3.5 w-3.5" /> Link
                </button>
              </div>

              {mode === "topic" ? (
                <div className="space-y-2">
                  <Label htmlFor="topic">Sobre o que é o post?</Label>
                  <Textarea
                    id="topic"
                    placeholder="Ex: Como a IA está mudando o mercado de trabalho em 2026"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    rows={3}
                    disabled={busy}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="link">Link da notícia ou artigo</Label>
                  <Input
                    id="link"
                    type="url"
                    placeholder="https://..."
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    disabled={busy}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nicho</Label>
                  <Select value={niche} onValueChange={setNiche} disabled={busy}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {NICHES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Select value={objective} onValueChange={setObjective} disabled={busy}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {OBJECTIVES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tom de voz</Label>
                  <Select value={tone} onValueChange={setTone} disabled={busy}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-6">
                <div className="space-y-2">
                  <Label>Quantidade de slides</Label>
                  <div className="flex gap-2">
                    {SLIDE_COUNTS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={busy}
                        onClick={() => setSlideCount(n)}
                        className={`h-9 w-9 rounded-full text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                          slideCount === n
                            ? "bg-brand-accent text-white"
                            : "bg-secondary text-secondary-foreground hover:bg-accent"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label htmlFor="handle">Perfil do Instagram (opcional)</Label>
                  <Input
                    id="handle"
                    placeholder="@seuperfil"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    disabled={busy}
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{errorMsg}</p>
                    <Button
                      variant="link"
                      className="h-auto p-0 mt-1 text-sm"
                      onClick={() => navigate({ to: "/tools/carousel-creator" })}
                    >
                      <Wand2 className="h-3.5 w-3.5" /> Usar editor manual
                    </Button>
                  </div>
                  <button onClick={() => setErrorMsg("")} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <Button onClick={runGeneration} disabled={!canGenerate} className="w-full" size="lg">
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {mode === "link" ? "Analisando o link e gerando..." : "Gerando com IA..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Gerar com IA
                  </>
                )}
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="uso" className="space-y-5">
            {loadingUsage && !usage ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !usage ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                Não foi possível carregar as estatísticas de uso.
              </Card>
            ) : (
              <>
                <Card className="p-6 space-y-5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-brand-starbucks flex items-center justify-center shrink-0">
                      <Gauge className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {usage.isAdmin ? "Consumo do time (todos os usuários)" : "Seu consumo"}
                      </h3>
                      <p className="text-xs text-muted-foreground">Baseado no plano gratuito do Gemini — ajuste os limites conforme sua cota real.</p>
                    </div>
                  </div>
                  <ProgressBar label="Hoje" value={usage.dailyCount} max={usage.dailyLimit} />
                  <ProgressBar label="Este mês" value={usage.monthlyCount} max={usage.monthlyLimit} />
                </Card>

                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-4 text-center">
                    <BarChart3 className="h-4 w-4 text-brand-accent mx-auto mb-1.5" />
                    <div className="text-xl font-bold">{usage.totalCount}</div>
                    <div className="text-xs text-muted-foreground">Gerações totais</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <CheckCircle2 className="h-4 w-4 text-brand-accent mx-auto mb-1.5" />
                    <div className="text-xl font-bold">
                      {usage.totalCount > 0 ? Math.round((usage.successCount / usage.totalCount) * 100) : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Taxa de sucesso</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <Zap className="h-4 w-4 text-brand-gold mx-auto mb-1.5" />
                    <div className="text-xl font-bold">{usage.tokensToday.toLocaleString("pt-BR")}</div>
                    <div className="text-xs text-muted-foreground">Tokens hoje</div>
                  </Card>
                </div>

                {usage.isAdmin && (
                  <Card className="p-6 space-y-3 border-brand-light">
                    <h3 className="font-semibold text-sm">Ajustar limites (admin)</h3>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="dailyLimit" className="text-xs">Limite diário</Label>
                        <Input
                          id="dailyLimit"
                          type="number"
                          className="w-32"
                          value={dailyLimitInput}
                          onChange={(e) => setDailyLimitInput(e.target.value)}
                          disabled={savingLimits}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="monthlyLimit" className="text-xs">Limite mensal</Label>
                        <Input
                          id="monthlyLimit"
                          type="number"
                          className="w-32"
                          value={monthlyLimitInput}
                          onChange={(e) => setMonthlyLimitInput(e.target.value)}
                          disabled={savingLimits}
                        />
                      </div>
                      <Button onClick={handleSaveLimits} disabled={savingLimits}>
                        {savingLimits ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                        Salvar limites
                      </Button>
                    </div>
                  </Card>
                )}

                <Card className="p-6">
                  <h3 className="font-semibold text-sm mb-3">Atividade recente</h3>
                  {usage.recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma geração ainda.</p>
                  ) : (
                    <ul className="space-y-2">
                      {usage.recent.map((r) => (
                        <li key={r.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-border last:border-0">
                          {r.success ? (
                            <CheckCircle2 className="h-4 w-4 text-brand-accent shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          )}
                          <span className="flex-1 truncate">
                            {r.mode === "link" ? "Link" : "Tópico"}
                            {r.slide_count ? ` · ${r.slide_count} slides` : ""}
                            {!r.success && r.error_message ? ` · ${r.error_message}` : ""}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
