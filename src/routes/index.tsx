import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls, getSignedUrlsFrom, deleteFromBucket } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Instagram, Wand2, Loader2, ArrowRight, Sparkles, Plus,
  Trash2, Share2, Check, Copy, Globe, MessageCircle, Flame, Download, Newspaper, FileText, Quote, LayoutTemplate, FileEdit, KanbanSquare, FolderOpen, SplitSquareVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Dashboard — LabMedia" },
      { name: "description", content: "Gerencie e compartilhe seus carrosseis do Instagram." },
    ],
  }),
});

type ToolGroup = {
  label: string;
  accent: string;
  tools: {
    title: string;
    description: string;
    href: string;
    icon: typeof Wand2;
  }[];
};

const toolGroups: ToolGroup[] = [
  {
    label: "Carrossel",
    accent: "bg-brand-starbucks",
    tools: [
      {
        title: "Carrossel Creator",
        description: "Monte carrosseis com templates, fontes e exporte em PNG ou ZIP.",
        href: "/tools/carousel-creator",
        icon: Wand2,
      },
      {
        title: "Carrossel Creator IA",
        description: "Descreva um tema ou cole um link — a IA escreve o roteiro dos slides.",
        href: "/tools/carousel-creator-ia",
        icon: Sparkles,
      },
      {
        title: "Carrossel Creator 2",
        description: "Versão alternativa do editor de carrossel, layout livre.",
        href: "/tools/carousel-creator-2",
        icon: SplitSquareVertical,
      },
      {
        title: "Carrossel Preview",
        description: "Visualize seus carrosseis como ficariam no feed do Instagram.",
        href: "/tools/carousel-preview",
        icon: Instagram,
      },
    ],
  },
  {
    label: "Posts & Impressões",
    accent: "bg-brand-accent",
    tools: [
      {
        title: "Print WhatsApp",
        description: "Crie prints realistas de conversas do WhatsApp e baixe como imagem.",
        href: "/tools/whatsapp-print",
        icon: MessageCircle,
      },
      {
        title: "Print Viral",
        description: "Composição viral: logo, texto e duas imagens lado a lado em JPG.",
        href: "/tools/print-viral",
        icon: Flame,
      },
      {
        title: "Post Notícia",
        description: "Crie posts estilo tweet/notícia 1080×1350 com foto, texto e imagem.",
        href: "/tools/post-noticia",
        icon: Newspaper,
      },
      {
        title: "Post Simples",
        description: "Posts simples 1080×1350 com faixa de texto e imagem de fundo.",
        href: "/tools/post-simples",
        icon: FileText,
      },
      {
        title: "Post Frase",
        description: "Posts de frase 1080×1350 com tipografia gigante e marca d'água.",
        href: "/tools/post-frase",
        icon: Quote,
      },
    ],
  },
  {
    label: "Planejamento",
    accent: "bg-brand-house",
    tools: [
      {
        title: "Roteiros",
        description: "Crie, salve e compartilhe roteiros e ideias de texto via link público.",
        href: "/tools/roteiros",
        icon: FileEdit,
      },
      {
        title: "Copy's Títulos Vídeos",
        description: "Cole, salve e organize copies e títulos prontos para seus vídeos.",
        href: "/tools/copy-titulos-videos",
        icon: Copy,
      },
      {
        title: "Tarefas",
        description: "Quadro Kanban com arrastar e soltar para organizar seu fluxo.",
        href: "/tools/tarefas",
        icon: KanbanSquare,
      },
    ],
  },
  {
    label: "Utilitários",
    accent: "bg-brand-uplift",
    tools: [
      {
        title: "Wireframe",
        description: "Crie wireframes 1080×1920 para briefar criativos com o time de design.",
        href: "/tools/wireframe",
        icon: LayoutTemplate,
      },
      {
        title: "Google Drive",
        description: "Acesse e organize seus arquivos do Google Drive direto do LabMedia.",
        href: "/tools/google-drive",
        icon: FolderOpen,
      },
    ],
  },
];

type ProjectKind =
  | "carousel"
  | "print-viral"
  | "post-noticia"
  | "post-simples"
  | "post-frase"
  | "whatsapp-print";

type FeedItem = {
  id: string;
  kind: ProjectKind;
  title: string;
  date: string;
  imageUrl?: string;
  imagePath?: string;
  // carousel-only
  isPublic?: boolean;
  publicSlug?: string | null;
};

const KIND_META: Record<ProjectKind, { label: string; icon: typeof Wand2; editTo: string; downloadExt: string }> = {
  "carousel":       { label: "Carrossel",       icon: Wand2,         editTo: "/tools/carousel-creator", downloadExt: "png" },
  "print-viral":    { label: "Print Viral",     icon: Flame,         editTo: "/tools/print-viral",      downloadExt: "jpg" },
  "post-noticia":   { label: "Post Notícia",    icon: Newspaper,     editTo: "/tools/post-noticia",     downloadExt: "png" },
  "post-simples":   { label: "Post Simples",    icon: FileText,      editTo: "/tools/post-simples",     downloadExt: "png" },
  "post-frase":     { label: "Post Frase",      icon: Quote,         editTo: "/tools/post-frase",       downloadExt: "png" },
  "whatsapp-print": { label: "Print WhatsApp", icon: MessageCircle, editTo: "/tools/whatsapp-print",   downloadExt: "png" },
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "carrossel";
}

function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [fetching, setFetching] = useState(true);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<FeedItem | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    void loadAll();
  }, [user?.id]);

  const loadAll = async () => {
    if (!user) return;
    setFetching(true);

    const [carousels, virals, noticias, simples, frases, whatsapps] = await Promise.all([
      supabase.from("carousels").select("id, title, updated_at, is_public, public_slug").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(24),
      supabase.from("print_virals").select("id, title, image_path, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(24),
      supabase.from("post_noticias").select("id, title, image_path, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(24),
      supabase.from("post_simples").select("id, title, image_path, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(24),
      supabase.from("post_frases").select("id, title, image_path, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(24),
      supabase.from("whatsapp_prints").select("id, title, image_path, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(24),
    ]);

    // Carousel covers
    const carouselRows = carousels.data ?? [];
    const carouselIds = carouselRows.map((c) => c.id);
    const coverByCarousel: Record<string, string> = {};
    let carouselCoverUrls: Record<string, string> = {};
    if (carouselIds.length > 0) {
      const { data: slides } = await supabase
        .from("carousel_slides")
        .select("carousel_id, image_path, position")
        .in("carousel_id", carouselIds)
        .order("position", { ascending: true });
      const seen = new Set<string>();
      const paths: string[] = [];
      (slides ?? []).forEach((s) => {
        if (!seen.has(s.carousel_id)) {
          seen.add(s.carousel_id);
          coverByCarousel[s.carousel_id] = s.image_path;
          paths.push(s.image_path);
        }
      });
      carouselCoverUrls = await getSignedUrls(paths);
    }

    const [viralUrls, noticiaUrls, simplesUrls, fraseUrls, whatsappUrls] = await Promise.all([
      getSignedUrlsFrom("print-virals", (virals.data ?? []).map((r) => r.image_path)),
      getSignedUrlsFrom("post-noticias", (noticias.data ?? []).map((r) => r.image_path)),
      getSignedUrlsFrom("post-simples", (simples.data ?? []).map((r) => r.image_path)),
      getSignedUrlsFrom("post-frases", (frases.data ?? []).map((r) => r.image_path)),
      getSignedUrlsFrom("whatsapp-prints", (whatsapps.data ?? []).map((r) => r.image_path)),
    ]);

    const feed: FeedItem[] = [
      ...carouselRows.map((c): FeedItem => ({
        id: c.id, kind: "carousel", title: c.title, date: c.updated_at,
        imageUrl: coverByCarousel[c.id] ? carouselCoverUrls[coverByCarousel[c.id]] : undefined,
        isPublic: c.is_public, publicSlug: c.public_slug,
      })),
      ...(virals.data ?? []).map((v): FeedItem => ({
        id: v.id, kind: "print-viral", title: v.title, date: v.created_at,
        imageUrl: viralUrls[v.image_path], imagePath: v.image_path,
      })),
      ...(noticias.data ?? []).map((v): FeedItem => ({
        id: v.id, kind: "post-noticia", title: v.title, date: v.created_at,
        imageUrl: noticiaUrls[v.image_path], imagePath: v.image_path,
      })),
      ...(simples.data ?? []).map((v): FeedItem => ({
        id: v.id, kind: "post-simples", title: v.title, date: v.created_at,
        imageUrl: simplesUrls[v.image_path], imagePath: v.image_path,
      })),
      ...(frases.data ?? []).map((v): FeedItem => ({
        id: v.id, kind: "post-frase", title: v.title, date: v.created_at,
        imageUrl: fraseUrls[v.image_path], imagePath: v.image_path,
      })),
      ...(whatsapps.data ?? []).map((v): FeedItem => ({
        id: v.id, kind: "whatsapp-print", title: v.title, date: v.created_at,
        imageUrl: whatsappUrls[v.image_path], imagePath: v.image_path,
      })),
    ];

    feed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(feed);
    setFetching(false);
  };

  const deleteItem = async (item: FeedItem) => {
    const tableByKind: Record<ProjectKind, "carousels" | "print_virals" | "post_noticias" | "post_simples" | "post_frases" | "whatsapp_prints"> = {
      "carousel": "carousels",
      "print-viral": "print_virals",
      "post-noticia": "post_noticias",
      "post-simples": "post_simples",
      "post-frase": "post_frases",
      "whatsapp-print": "whatsapp_prints",
    };
    const bucketByKind: Partial<Record<ProjectKind, string>> = {
      "print-viral": "print-virals",
      "post-noticia": "post-noticias",
      "post-simples": "post-simples",
      "post-frase": "post-frases",
      "whatsapp-print": "whatsapp-prints",
    };
    const { error } = await supabase.from(tableByKind[item.kind]).delete().eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    const bucket = bucketByKind[item.kind];
    if (bucket && item.imagePath) void deleteFromBucket(bucket, item.imagePath);
    toast.success("Projeto excluído");
    setItems((prev) => prev.filter((p) => !(p.id === item.id && p.kind === item.kind)));
  };

  const downloadItem = (item: FeedItem) => {
    if (!item.imageUrl) return;
    const a = document.createElement("a");
    a.href = item.imageUrl;
    a.download = `${item.title || item.kind}.${KIND_META[item.kind].downloadExt}`;
    a.target = "_blank";
    a.click();
  };

  const createCarousel = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("carousels")
      .insert({ user_id: user.id, title: "Novo carrossel" })
      .select("id")
      .single();
    if (error || !data) { toast.error(error?.message ?? "Erro ao criar"); return; }
    navigate({ to: "/carousel/$id", params: { id: data.id } });
  };

  const openShare = (item: FeedItem) => {
    setShareTarget(item);
    setCopied(false);
    setShareOpen(true);
  };

  const publicUrl = (slug: string | null | undefined) =>
    slug ? `${window.location.origin}/c/${slug}` : "";

  const togglePublic = async (next: boolean) => {
    if (!shareTarget || !user) return;
    setShareBusy(true);
    let slug = shareTarget.publicSlug;
    if (next && !slug) {
      slug = `${slugify(shareTarget.title)}-${shareTarget.id.slice(0, 6)}`;
    }
    const { error } = await supabase
      .from("carousels")
      .update({ is_public: next, public_slug: next ? slug : shareTarget.publicSlug })
      .eq("id", shareTarget.id);
    setShareBusy(false);
    if (error) { toast.error(error.message); return; }
    const updated = { ...shareTarget, isPublic: next, publicSlug: slug };
    setShareTarget(updated);
    setItems((prev) => prev.map((p) => (p.id === updated.id && p.kind === "carousel" ? updated : p)));
    toast.success(next ? "Carrossel público" : "Carrossel privado");
  };

  const copyLink = async () => {
    if (!shareTarget?.publicSlug) return;
    await navigator.clipboard.writeText(publicUrl(shareTarget.publicSlug));
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !user) {
    return (
      <div className="min-h-full flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <main className="max-w-6xl mx-auto px-6 py-12 pb-32">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-light bg-accent px-3 py-1 text-xs text-accent-foreground font-medium mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Bem-vindo de volta
          </div>
          <h1 className="text-4xl font-bold tracking-[-0.01em] text-brand-starbucks">Olá! 👋</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Suas ferramentas e criações em um só lugar.
          </p>
        </div>

        {toolGroups.map((group) => (
          <section key={group.label} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className={`h-2 w-2 rounded-full ${group.accent}`} />
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.label}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.tools.map((tool) => (
                <Link key={tool.href} to={tool.href} className="group">
                  <Card className="p-5 h-full transition-all hover:-translate-y-0.5 hover:shadow-lift">
                    <div className="flex items-start gap-4">
                      <div className={`w-11 h-11 rounded-lg ${group.accent} flex items-center justify-center flex-shrink-0`}>
                        <tool.icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold">{tool.title}</h3>
                          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 shrink-0" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <div className="flex items-center justify-between mb-6 mt-14 pt-8 border-t border-border">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.01em]">Últimas criações</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Todos os seus projetos salvos, ordenados pelos mais recentes.
            </p>
          </div>
        </div>

        {fetching ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Instagram className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">Nenhuma criação ainda</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">
              Use uma das ferramentas acima e salve para ver aqui.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {items.map((item) => {
              const meta = KIND_META[item.kind];
              const Icon = meta.icon;
              const body = (
                <>
                  <div className="aspect-[4/5] bg-muted relative overflow-hidden">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                        Sem preview
                      </div>
                    )}
                    <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-brand-house text-white text-[10px] px-2 py-0.5 shadow">
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </div>
                    {item.kind === "carousel" && item.isPublic && (
                      <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 text-white text-[10px] px-2 py-0.5">
                        <Globe className="h-3 w-3" />
                        Público
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-sm truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(item.date).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </>
              );
              return (
                <Card key={`${item.kind}-${item.id}`} className="overflow-hidden group relative">
                  {item.kind === "carousel" ? (
                    <Link to="/carousel/$id" params={{ id: item.id }}>{body}</Link>
                  ) : (
                    <Link to={meta.editTo} search={{ id: item.id } as never}>{body}</Link>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Link
                      to={meta.editTo}
                      search={{ id: item.id } as never}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button size="icon" variant="secondary" className="h-8 w-8" title={`Editar em ${meta.label}`}>
                        <Wand2 className="h-4 w-4" />
                      </Button>
                    </Link>

                    {item.kind === "carousel" ? (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openShare(item); }}
                        title="Compartilhar"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadItem(item); }}
                        title="Baixar"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação removerá "{item.title}". Não pode ser desfeito.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteItem(item)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating create action — signature circular CTA */}
      <button
        onClick={createCarousel}
        title="Novo carrossel"
        className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full bg-brand-accent text-white flex items-center justify-center shadow-[0_0_6px_rgba(0,0,0,0.24),0_8px_12px_rgba(0,0,0,0.14)] transition-transform active:scale-95 hover:brightness-105"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar carrossel</DialogTitle>
            <DialogDescription>
              Ao publicar, qualquer pessoa com o link poderá visualizar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Link público</div>
              <div className="text-xs text-muted-foreground">
                {shareTarget?.isPublic ? "Visível para qualquer pessoa" : "Apenas você pode ver"}
              </div>
            </div>
            <Switch
              checked={!!shareTarget?.isPublic}
              disabled={shareBusy}
              onCheckedChange={togglePublic}
            />
          </div>

          {shareTarget?.isPublic && shareTarget.publicSlug && (
            <div className="flex gap-2">
              <Input readOnly value={publicUrl(shareTarget.publicSlug)} />
              <Button onClick={copyLink} variant="secondary">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
