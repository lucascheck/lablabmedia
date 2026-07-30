import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { CarouselData } from "@/types/carousel";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Loader2, ChevronLeft, ChevronRight, Wand2, Sparkles, Trash2, Heart, MessageCircle, Send, Bookmark, MoreHorizontal,
} from "lucide-react";

// Motor de renderização isolado — o mesmo usado no Carrossel Creator, mas esta tela
// não compartilha nenhum estado ou lógica com o editor: é só um visualizador.
const SlideRenderer = lazy(() => import("@/components/carousel/SlideRenderer"));

export const Route = createFileRoute("/tools/carousel-creator-ia-preview")({
  component: CarouselIaPreviewPage,
  head: () => ({
    meta: [{ title: "Visualizar carrossel IA — LabMedia" }],
  }),
});

const DISPLAY_WIDTH = 320;
const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1350;
const SCALE = DISPLAY_WIDTH / SLIDE_WIDTH;

function CarouselIaPreviewPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { id?: string };

  const [carousel, setCarousel] = useState<CarouselData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!search.id) return;
    (async () => {
      setFetching(true);
      const { data, error } = await supabase
        .from("carousels")
        .select("project_data")
        .eq("id", search.id)
        .maybeSingle();
      if (error || !data?.project_data) {
        toast.error("Não foi possível carregar esse carrossel");
      } else {
        setCarousel(data.project_data as unknown as CarouselData);
      }
      setFetching(false);
    })();
  }, [search.id]);

  const handleDelete = async () => {
    if (!search.id) return;
    await supabase.from("carousels").delete().eq("id", search.id);
    toast.success("Carrossel descartado");
    navigate({ to: "/tools/carousel-creator-ia" });
  };

  if (loading || !user || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!carousel) {
    return (
      <div className="min-h-full flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Carrossel não encontrado.</p>
          <Button asChild variant="secondary">
            <Link to="/tools/carousel-creator-ia">Voltar</Link>
          </Button>
        </div>
      </div>
    );
  }

  const slides = carousel.slides;
  const total = slides.length;
  const contentSlides = slides.filter((s) => s.type !== "cover" && s.type !== "cover-bottom" && s.type !== "cta");
  const currentSlide = slides[index];
  const contentIndex = contentSlides.findIndex((s) => s.id === currentSlide?.id);

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-light bg-accent px-3 py-1 text-xs text-accent-foreground font-medium mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Gerado com IA — visualização
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.01em] text-brand-starbucks">Confira como ficou</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Isso é só uma prévia — nada foi exportado ainda. Edite livremente ou descarte.
          </p>
        </div>

        {/* Mockup isolado — usa o SlideRenderer puro, sem nenhum estado do editor */}
        <div
          className="mx-auto rounded-xl overflow-hidden shadow-2xl border bg-white text-neutral-900 select-none"
          style={{ width: DISPLAY_WIDTH }}
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-brand-starbucks to-brand-accent shrink-0">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-neutral-200" />
              </div>
              <span className="font-semibold text-sm truncate">{carousel.instagramHandle || "your_username"}</span>
            </div>
            <MoreHorizontal className="h-4 w-4 shrink-0" />
          </div>

          <div
            className="relative bg-neutral-100 overflow-hidden"
            style={{ width: DISPLAY_WIDTH, height: SLIDE_HEIGHT * SCALE }}
          >
            <div style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-muted" />}>
                {currentSlide && (
                  <SlideRenderer
                    slide={currentSlide}
                    slideIndex={contentIndex >= 0 ? contentIndex + 1 : 0}
                    totalContentSlides={contentSlides.length}
                    instagramHandle={carousel.instagramHandle}
                    monthYear={carousel.monthYear}
                    logoSize={carousel.logoSize}
                    logoUrl={carousel.logoUrl}
                  />
                )}
              </Suspense>
            </div>

            {total > 1 && (
              <div className="absolute top-2.5 right-2.5 bg-black/60 text-white text-xs font-medium rounded-full px-2 py-0.5 backdrop-blur">
                {index + 1}/{total}
              </div>
            )}
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {index < total - 1 && (
              <button
                onClick={() => setIndex((i) => i + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white"
                aria-label="Próximo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-3 pt-2.5">
            <div className="flex items-center gap-3.5 text-neutral-900">
              <Heart className="h-5 w-5" strokeWidth={1.8} />
              <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
              <Send className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="flex items-center gap-1">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Ir para slide ${i + 1}`}
                  className={`rounded-full transition-all ${i === index ? "w-1.5 h-1.5 bg-brand-accent" : "w-1.5 h-1.5 bg-neutral-300"}`}
                />
              ))}
            </div>
            <Bookmark className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="px-3 pt-2 pb-3 text-xs text-neutral-400 uppercase tracking-wide">
            {carousel.monthYear}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-8">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <Trash2 className="h-4 w-4" /> Descartar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Descartar esse carrossel?</AlertDialogTitle>
                <AlertDialogDescription>Essa ação remove o rascunho gerado. Não pode ser desfeito.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Descartar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="secondary" onClick={() => navigate({ to: "/tools/carousel-creator-ia" })}>
            Gerar outro
          </Button>
          <Button onClick={() => navigate({ to: "/tools/carousel-creator", search: { id: search.id } as never })}>
            <Wand2 className="h-4 w-4" /> Editar no Carrossel Creator
          </Button>
        </div>
      </div>
    </div>
  );
}
