import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { uploadSlideImage, deleteSlideImage, getSignedUrls } from "@/lib/storage";
import { ensureRenderableImage, isHeic } from "@/lib/heic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InstagramMockup } from "@/components/instagram-mockup";
import {
  ArrowLeft, Upload, Trash2, GripVertical, Loader2, Sun, Moon, Maximize2, X, ChevronLeft, ChevronRight,
  Share2, Copy, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/carousel/$id")({
  component: EditorPage,
});

type SlideRow = {
  id: string;
  image_path: string;
  position: number;
  url?: string;
};

type Carousel = {
  id: string;
  title: string;
  username: string;
  avatar_url: string | null;
  caption: string;
  theme: string;
  is_public: boolean;
  public_slug: string | null;
};

function EditorPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [carousel, setCarousel] = useState<Carousel | null>(null);
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, id]);

  const load = async () => {
    setFetching(true);
    const { data: c, error } = await supabase
      .from("carousels")
      .select("id, title, username, avatar_url, caption, theme, is_public, public_slug")
      .eq("id", id)
      .maybeSingle();
    if (error || !c) {
      toast.error("Carrossel não encontrado");
      setFetching(false);
      return;
    }
    setCarousel(c);

    const { data: ss } = await supabase
      .from("carousel_slides")
      .select("id, image_path, position")
      .eq("carousel_id", id)
      .order("position", { ascending: true });

    const paths = (ss ?? []).map((s) => s.image_path);
    const urls = await getSignedUrls(paths);
    setSlides((ss ?? []).map((s) => ({ ...s, url: urls[s.image_path] })));
    setFetching(false);
  };

  const scheduleSave = useCallback((patch: Partial<Carousel>) => {
    setCarousel((prev) => (prev ? { ...prev, ...patch } : prev));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("carousels").update(patch).eq("id", id);
      if (error) toast.error("Erro ao salvar");
    }, 500);
  }, [id]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    try {
      const raw = Array.from(files).filter((f) => f.type.startsWith("image/") || isHeic(f));
      const arr = await Promise.all(raw.map((f) => ensureRenderableImage(f)));
      const startPos = slides.length;
      const created: SlideRow[] = [];
      for (let i = 0; i < arr.length; i++) {
        const path = await uploadSlideImage(user.id, id, arr[i]);
        const { data, error } = await supabase
          .from("carousel_slides")
          .insert({ carousel_id: id, user_id: user.id, image_path: path, position: startPos + i })
          .select("id, image_path, position")
          .single();
        if (error || !data) throw error ?? new Error("Falha ao salvar slide");
        const urls = await getSignedUrls([path]);
        created.push({ ...data, url: urls[path] });
      }
      setSlides((prev) => [...prev, ...created]);
      toast.success(`${arr.length} imagem(ns) adicionada(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeSlide = async (slide: SlideRow) => {
    setSlides((prev) => prev.filter((s) => s.id !== slide.id));
    await supabase.from("carousel_slides").delete().eq("id", slide.id);
    await deleteSlideImage(slide.image_path);
    setPreviewIdx((i) => Math.max(0, i - (slides.findIndex((s) => s.id === slide.id) <= i ? 1 : 0)));
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex((s) => s.id === active.id);
    const newIdx = slides.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(slides, oldIdx, newIdx);
    setSlides(reordered);
    // persist new positions
    await Promise.all(
      reordered.map((s, i) =>
        s.position !== i
          ? supabase.from("carousel_slides").update({ position: i }).eq("id", s.id)
          : Promise.resolve(),
      ),
    );
    setSlides(reordered.map((s, i) => ({ ...s, position: i })));
  };

  // Keyboard nav in presenting mode
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresenting(false);
      if (e.key === "ArrowRight") setPreviewIdx((i) => Math.min(slides.length - 1, i + 1));
      if (e.key === "ArrowLeft") setPreviewIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, slides.length]);

  if (loading || fetching || !carousel) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const theme = (carousel.theme === "dark" ? "dark" : "light") as "light" | "dark";
  const mockupSlides = slides.filter((s) => s.url).map((s) => ({ id: s.id, url: s.url! }));

  const publicUrl = carousel.public_slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/c/${carousel.public_slug}`
    : "";

  const togglePublic = async (next: boolean) => {
    let slug = carousel.public_slug;
    if (next && !slug) {
      slug = `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
    }
    setCarousel((p) => (p ? { ...p, is_public: next, public_slug: slug } : p));
    const { error } = await supabase
      .from("carousels")
      .update({ is_public: next, public_slug: slug })
      .eq("id", id);
    if (error) toast.error("Erro ao atualizar compartilhamento");
    else toast.success(next ? "Link público ativado" : "Link público desativado");
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="px-2 sm:px-3">
            <Link to="/"><ArrowLeft className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Voltar</span></Link>
          </Button>
          <Input
            value={carousel.title}
            onChange={(e) => scheduleSave({ title: e.target.value })}
            className="flex-1 min-w-0 sm:max-w-sm font-medium"
          />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => scheduleSave({ theme: theme === "dark" ? "light" : "dark" })}
              className="px-2 sm:px-3"
              title={theme === "dark" ? "Tema claro" : "Tema escuro"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="px-2 sm:px-3">
                  <Share2 className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Compartilhar</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Link público</div>
                      <p className="text-xs text-muted-foreground">Qualquer pessoa com o link pode visualizar.</p>
                    </div>
                    <Switch checked={carousel.is_public} onCheckedChange={togglePublic} />
                  </div>
                  {carousel.is_public && publicUrl && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input readOnly value={publicUrl} className="text-xs h-9" onFocus={(e) => e.currentTarget.select()} />
                        <Button size="icon" variant="secondary" onClick={copyLink} className="h-9 w-9 shrink-0">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <a
                        href={publicUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir prévia
                      </a>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Button size="sm" onClick={() => setPresenting(true)} disabled={mockupSlides.length === 0} className="px-2 sm:px-3">
              <Maximize2 className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Apresentar</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 grid lg:grid-cols-[380px_1fr] gap-4 sm:gap-6">
        {/* Left: editor */}
        <div className="space-y-5">
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Perfil exibido</h3>
            <div className="space-y-2">
              <Label htmlFor="username">@usuário</Label>
              <Input id="username" value={carousel.username} onChange={(e) => scheduleSave({ username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Foto de perfil</Label>
              <div className="flex items-center gap-3">
                {carousel.avatar_url ? (
                  <img src={carousel.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover border" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs">?</div>
                )}
                <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingAvatar ? "Enviando..." : "Enviar foto"}
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={async (e) => {
                      const raw = e.target.files?.[0];
                      if (!raw || !user) return;
                      setUploadingAvatar(true);
                      try {
                        const file = await ensureRenderableImage(raw);
                        const ext = file.name.split(".").pop() ?? "jpg";
                        const path = `${user.id}/avatar_${Date.now()}.${ext}`;
                        const { error: upErr } = await supabase.storage.from("carousel-images").upload(path, file, { upsert: true });
                        if (upErr) throw upErr;
                        const { data: signed } = await supabase.storage.from("carousel-images").createSignedUrl(path, 60 * 60 * 24 * 365);
                        if (signed?.signedUrl) {
                          scheduleSave({ avatar_url: signed.signedUrl });
                        }
                      } catch (err: any) {
                        toast.error("Erro ao enviar foto: " + (err.message ?? err));
                      } finally {
                        setUploadingAvatar(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                {carousel.avatar_url && (
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() => scheduleSave({ avatar_url: null })}
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="caption">Legenda</Label>
              <Textarea id="caption" rows={3} value={carousel.caption} onChange={(e) => scheduleSave({ caption: e.target.value })} />
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Slides ({slides.length})</h3>
            </div>
            <input
              ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              variant="outline" className="w-full border-dashed h-20"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><Upload className="h-5 w-5 mr-2" />Adicionar imagens</>)}
            </Button>

            {slides.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Suba imagens para começar.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {slides.map((s, i) => (
                      <SortableSlide
                        key={s.id} slide={s} index={i}
                        active={i === previewIdx}
                        onSelect={() => setPreviewIdx(i)}
                        onRemove={() => removeSlide(s)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </Card>
        </div>

        {/* Right: preview */}
        <div className="flex items-start justify-center pt-2">
          <div className="w-full">
            <div className="text-xs text-muted-foreground mb-3 text-center">Pré-visualização do feed</div>
            <InstagramMockup
              slides={mockupSlides}
              username={carousel.username}
              avatarUrl={carousel.avatar_url}
              caption={carousel.caption}
              theme={theme}
              currentIndex={previewIdx}
              onIndexChange={setPreviewIdx}
            />
          </div>
        </div>
      </div>

      {/* Presentation overlay */}
      {presenting && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6">
          <Button
            variant="ghost" size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={() => setPresenting(false)}
          >
            <X className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 h-12 w-12"
            onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}
            disabled={previewIdx === 0}
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 h-12 w-12"
            onClick={() => setPreviewIdx((i) => Math.min(mockupSlides.length - 1, i + 1))}
            disabled={previewIdx === mockupSlides.length - 1}
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
          <div className="w-full max-w-md">
            <InstagramMockup
              slides={mockupSlides}
              username={carousel.username}
              avatarUrl={carousel.avatar_url}
              caption={carousel.caption}
              theme={theme}
              currentIndex={previewIdx}
              onIndexChange={setPreviewIdx}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SortableSlide({
  slide, index, active, onSelect, onRemove,
}: {
  slide: SlideRow;
  index: number;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef} style={style}
      className={`flex items-center gap-2 rounded-lg border p-2 ${active ? "border-primary bg-accent" : "border-border"}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground p-1">
        <GripVertical className="h-4 w-4" />
      </button>
      <button onClick={onSelect} className="flex-1 flex items-center gap-3 text-left">
        <div className="w-12 h-15 aspect-[4/5] bg-muted rounded overflow-hidden flex-shrink-0">
          {slide.url && <img src={slide.url} alt="" className="w-full h-full object-cover" />}
        </div>
        <span className="text-sm font-medium">Slide {index + 1}</span>
      </button>
      <Button size="icon" variant="ghost" onClick={onRemove} className="h-8 w-8 text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
