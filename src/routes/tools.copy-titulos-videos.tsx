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
import { Loader2, Plus, Trash2, Save, FileEdit, ArrowLeft, Copy } from "lucide-react";

export const Route = createFileRoute("/tools/copy-titulos-videos")({
  component: CopyTitulosVideosPage,
  head: () => ({
    meta: [
      { title: "Copy's Títulos Vídeos — LabMedia" },
      { name: "description", content: "Salve e organize copies e títulos de vídeos." },
    ],
  }),
});

type Item = {
  id: string;
  title: string;
  content: string;
  updated_at: string;
};

function CopyTitulosVideosPage() {
  const { user, loading } = useAuth();
  const { profile } = useProfile();
  const isAdmin = !!profile?.isAdmin;
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) void load();
    else {
      setItems([]);
      setFetching(false);
    }
  }, [user?.id, isAdmin]);

  const load = async () => {
    if (!user) return;
    setFetching(true);
    let q = supabase
      .from("copy_titulos_videos")
      .select("id, title, content, updated_at")
      .order("updated_at", { ascending: false });
    if (!isAdmin) q = q.eq("user_id", user.id);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setFetching(false);
  };

  const newItem = () => {
    setEditing({ id: "", title: "", content: "", updated_at: "" });
    setTitle("Nova copy");
    setContent("");
  };

  const openEdit = (r: Item) => {
    setEditing(r);
    setTitle(r.title);
    setContent(r.content);
  };

  const closeEdit = () => {
    setEditing(null);
    setTitle("");
    setContent("");
  };

  const save = async () => {
    if (!editing) return;
    if (!user) {
      toast.error("Faça login para salvar", {
        action: { label: "Entrar", onClick: () => navigate({ to: "/auth" }) },
      });
      return;
    }
    if (!title.trim()) {
      toast.error("Dê um título à copy");
      return;
    }
    setSaving(true);
    if (editing.id) {
      const { error } = await supabase
        .from("copy_titulos_videos")
        .update({ title, content })
        .eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Copy atualizada");
    } else {
      const { error } = await supabase
        .from("copy_titulos_videos")
        .insert({ user_id: user.id, title, content });
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Copy salva");
    }
    setSaving(false);
    closeEdit();
    void load();
  };

  const remove = async (r: Item) => {
    if (!confirm(`Excluir "${r.title}"?`)) return;
    const { error } = await supabase.from("copy_titulos_videos").delete().eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Copy excluída");
    setItems((prev) => prev.filter((x) => x.id !== r.id));
    if (editing?.id === r.id) closeEdit();
  };

  const copyText = async (text: string) => {
    if (!text.trim()) {
      toast.error("Nada para copiar");
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Copiado!");
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
            <h1 className="text-3xl font-bold tracking-tight">Copy's Títulos Vídeos</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Cole, salve e organize copies e títulos prontos para seus vídeos.
            </p>
          </div>
          {!editing && (
            <Button onClick={newItem}>
              <Plus className="h-4 w-4 mr-2" />
              Nova copy
            </Button>
          )}
        </div>

        {!user && (
          <Card className="p-4 mb-6 bg-muted/40 border-dashed flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Você está navegando como visitante. Faça login para salvar e listar suas copies.
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
                <Button variant="outline" size="sm" onClick={() => copyText(content)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da copy"
              className="text-lg font-medium"
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Cole aqui seus títulos, copies e ideias de vídeo..."
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
              <Copy className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">Nenhuma copy ainda</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              Crie sua primeira copy para começar a organizar seus títulos de vídeo.
            </p>
            <Button onClick={newItem}>
              <Plus className="h-4 w-4 mr-2" />
              Nova copy
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
                  <Button variant="outline" size="sm" onClick={() => copyText(r.content)} title="Copiar">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => remove(r)} title="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
