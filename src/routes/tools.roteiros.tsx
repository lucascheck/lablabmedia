import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, Share2, FileEdit, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/tools/roteiros")({
  component: RoteirosPage,
  head: () => ({
    meta: [
      { title: "Roteiros — LabMedia" },
      { name: "description", content: "Crie, salve e compartilhe roteiros e ideias de texto." },
    ],
  }),
});

type Roteiro = {
  id: string;
  title: string;
  content: string;
  updated_at: string;
};

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "roteiro"
  );
}

const DRAFT_KEY = "roteiros:draft:v1";

type Draft = { id: string; title: string; content: string; savedAt: number };

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(d: Draft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore quota */
  }
}

function RoteirosPage() {
  const { user, loading } = useAuth();
  const { profile } = useProfile();
  const isAdmin = !!profile?.isAdmin;
  const navigate = useNavigate();
  const [items, setItems] = useState<Roteiro[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState<Roteiro | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (user) void load();
    else {
      setItems([]);
      setFetching(false);
    }
  }, [user?.id, isAdmin]);

  // Restore draft on mount (once)
  useEffect(() => {
    if (draftRestored) return;
    const d = readDraft();
    if (d && (d.title || d.content)) {
      setEditing({ id: d.id, title: d.title, content: d.content, updated_at: "" });
      setTitle(d.title);
      setContent(d.content);
      toast.info("Rascunho recuperado", {
        description: "Recuperamos o texto que você estava escrevendo.",
      });
    }
    setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave draft while editing
  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => {
      writeDraft({ id: editing.id, title, content, savedAt: Date.now() });
    }, 400);
    return () => clearTimeout(t);
  }, [editing, title, content]);

  // Warn on tab close if there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!editing) return;
      if (title !== editing.title || content !== editing.content) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editing, title, content]);

  const load = async () => {
    if (!user) return;
    setFetching(true);
    let q = supabase
      .from("roteiros")
      .select("id, title, content, updated_at")
      .order("updated_at", { ascending: false });
    if (!isAdmin) q = q.eq("user_id", user.id);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setFetching(false);
  };

  const requireLogin = (msg: string) => {
    toast.error(msg, {
      action: { label: "Entrar", onClick: () => navigate({ to: "/auth" }) },
    });
  };

  const newRoteiro = () => {
    setEditing({ id: "", title: "", content: "", updated_at: "" });
    setTitle("Novo roteiro");
    setContent("");
  };

  const openEdit = (r: Roteiro) => {
    setEditing(r);
    setTitle(r.title);
    setContent(r.content);
  };

  const closeEdit = () => {
    if (editing) {
      const changed = title !== editing.title || content !== editing.content;
      if (changed && !confirm("Descartar as alterações não salvas?")) return;
    }
    writeDraft(null);
    setEditing(null);
    setTitle("");
    setContent("");
  };

  const save = async () => {
    if (!editing) return;
    if (!user) {
      requireLogin("Faça login para salvar o roteiro");
      return;
    }
    if (!title.trim()) {
      toast.error("Dê um título ao roteiro");
      return;
    }
    setSaving(true);
    if (editing.id) {
      const { error } = await supabase
        .from("roteiros")
        .update({ title, content })
        .eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Roteiro atualizado");
    } else {
      const { data, error } = await supabase
        .from("roteiros")
        .insert({ user_id: user.id, title, content })
        .select("id, title, content, updated_at")
        .single();
      if (error || !data) {
        toast.error(error?.message ?? "Erro ao salvar");
        setSaving(false);
        return;
      }
      toast.success("Roteiro salvo");
    }
    setSaving(false);
    writeDraft(null);
    setEditing(null);
    setTitle("");
    setContent("");
    void load();
  };

  const remove = async (r: Roteiro) => {
    if (!confirm(`Excluir "${r.title}"?`)) return;
    const { error } = await supabase.from("roteiros").delete().eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Roteiro excluído");
    setItems((prev) => prev.filter((x) => x.id !== r.id));
    if (editing?.id === r.id) closeEdit();
  };

  const share = async (r: Roteiro) => {
    if (!r.title.trim() && !r.content.trim()) {
      toast.error("Escreva algo antes de compartilhar");
      return;
    }
    const slug = `${slugify(r.title || "roteiro")}-${(r.id || crypto.randomUUID()).slice(0, 6)}`;
    const { error } = await supabase
      .from("shared_roteiros")
      .insert({ slug, title: r.title || "Roteiro", content: r.content });
    if (error) {
      toast.error(error.message);
      return;
    }
    const url = `${window.location.origin}/r/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link público copiado!", { description: url });
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Roteiros</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Organize ideias e textos. Salve, edite e compartilhe via link público.
            </p>
          </div>
          {!editing && (
            <Button onClick={newRoteiro}>
              <Plus className="h-4 w-4 mr-2" />
              Novo roteiro
            </Button>
          )}
        </div>

        {!user && (
          <Card className="p-4 mb-6 bg-muted/40 border-dashed flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Você está navegando como visitante. Faça login para salvar e listar seus roteiros.
            </p>
            <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
              Entrar
            </Button>
          </Card>
        )}
        {editing ? (
          <Card className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={closeEdit}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex gap-2">
                {(editing.id || !user) && (
                  <Button variant="outline" size="sm" onClick={() => share({ ...editing, title, content })}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartilhar
                  </Button>
                )}
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do roteiro"
              className="text-lg font-medium"
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva seu roteiro, ideias, anotações..."
              className="min-h-[60vh] font-mono text-sm leading-relaxed"
            />
            <div className="text-xs text-muted-foreground">
              {content.length} caracteres · {content.split(/\s+/).filter(Boolean).length} palavras
            </div>
          </Card>
        ) : fetching ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileEdit className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">Nenhum roteiro ainda</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              Crie seu primeiro roteiro para começar a organizar suas ideias.
            </p>
            <Button onClick={newRoteiro}>
              <Plus className="h-4 w-4 mr-2" />
              Novo roteiro
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((r) => (
              <Card key={r.id} className="p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
                <button onClick={() => openEdit(r)} className="text-left flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{r.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(r.updated_at).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-4 whitespace-pre-wrap break-words">
                    {r.content || "(vazio)"}
                  </p>
                </button>
                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(r)}>
                    <FileEdit className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => share(r)} title="Compartilhar">
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => remove(r)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
