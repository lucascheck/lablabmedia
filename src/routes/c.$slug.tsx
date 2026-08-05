import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import { InstagramMockup } from "@/components/instagram-mockup";
import { useSlideSwipe } from "@/lib/use-slide-swipe";
import type { CarouselData } from "@/types/carousel";
import { Button } from "@/components/ui/button";
import {
  Loader2, Sun, Moon, ChevronLeft, ChevronRight, Heart, MessageCircle, Send, Bookmark, MoreHorizontal,
} from "lucide-react";

// Mesmo motor de renderização do editor por template (SlideRenderer), mas
// esta página é pública e só lê os dados — não compartilha estado com o
// editor.
const SlideRenderer = lazy(() => import("@/components/carousel/SlideRenderer"));

export const Route = createFileRoute("/c/$slug")({
  component: PublicCarouselPage,
  head: () => ({
    meta: [
      { title: "Prévia de carrossel — Instagram" },
      { name: "description", content: "Veja como este carrossel ficaria no feed do Instagram." },
      { property: "og:title", content: "Prévia de carrossel — Instagram" },
      { property: "og:description", content: "Veja como este carrossel ficaria no feed do Instagram." },
    ],
  }),
});

type CarouselRow = {
  id: string;
  title: string;
  username: string;
  avatar_url: string | null;
  caption: string | null;
  theme: string | null;
  project_data: unknown;
};

type ImageSlide = { id: string; image_path: string; position: number; url?: string };

const DISPLAY_WIDTH = 320;
const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1350;
const SCALE = DISPLAY_WIDTH / SLIDE_WIDTH;

function PublicCarouselPage() {
  const { slug } = Route.useParams();
  const [row, setRow] = useState<CarouselRow | null>(null);
  const [imageSlides, setImageSlides] = useState<ImageSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("carousels")
        .select("id, title, username, avatar_url, caption, theme, project_data")
        .eq("public_slug", slug)
        .eq("is_public", true)
        .maybeSingle();

      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRow(data);
      setTheme((data.theme === "dark" ? "dark" : "light") as "light" | "dark");

      const carouselData = data.project_data as CarouselData | null;
      const hasTemplateSlides = !!carouselData?.slides?.length;

      if (!hasTemplateSlides) {
        // Carrossel do editor de imagens (upload manual) — busca em carousel_slides.
        const { data: ss } = await supabase
          .from("carousel_slides")
          .select("id, image_path, position")
          .eq("carousel_id", data.id)
          .order("position", { ascending: true });
        const paths = (ss ?? []).map((s) => s.image_path);
        const urls = await getSignedUrls(paths);
        setImageSlides((ss ?? []).map((s) => ({ ...s, url: urls[s.image_path] })));
      }

      setLoading(false);
    })();
  }, [slug]);

  // Derivado antes dos retornos antecipados porque o hook de swipe abaixo não
  // pode ser chamado condicionalmente.
  const carousel = (row?.project_data ?? null) as CarouselData | null;
  const templateSlides = carousel?.slides ?? [];
  const hasTemplateSlides = templateSlides.length > 0;

  const swipe = useSlideSwipe({
    index,
    total: templateSlides.length,
    onIndexChange: setIndex,
    width: DISPLAY_WIDTH,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (notFound || !row) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">Carrossel não encontrado</h1>
        <p className="text-muted-foreground">Este link pode ter expirado ou foi tornado privado.</p>
        <Button asChild><Link to="/">Ir para o início</Link></Button>
      </div>
    );
  }

  if (!hasTemplateSlides) {
    const mockupSlides = imageSlides.filter((s) => s.url).map((s) => ({ id: s.id, url: s.url! }));
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-medium truncate flex-1">{row.title}</h1>
            <Button variant="outline" size="sm" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>
        <main className="max-w-md mx-auto px-4 py-6 sm:py-10">
          {mockupSlides.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">Esse carrossel ainda não tem slides.</p>
          ) : (
            <InstagramMockup
              slides={mockupSlides}
              username={row.username}
              avatarUrl={row.avatar_url}
              caption={row.caption ?? ""}
              theme={theme}
            />
          )}
          <p className="text-center text-xs text-muted-foreground mt-6">
            Crie seu próprio carrossel — <Link to="/" className="underline">comece aqui</Link>
          </p>
        </main>
      </div>
    );
  }

  const templateCarousel = carousel!;
  const total = templateSlides.length;
  const currentSlide = templateSlides[index];
  const contentSlides = templateSlides.filter((s) => s.type !== "cover" && s.type !== "cover-bottom" && s.type !== "cta");
  const contentIndex = contentSlides.findIndex((s) => s.id === currentSlide?.id);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-medium truncate flex-1">{row.title}</h1>
          <Button variant="outline" size="sm" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 sm:py-10">
        <div
          className={`mx-auto rounded-xl overflow-hidden shadow-2xl border select-none ${
            theme === "dark" ? "bg-neutral-950 text-white border-neutral-800" : "bg-white text-neutral-900"
          }`}
          style={{ width: DISPLAY_WIDTH }}
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-brand-starbucks to-brand-accent shrink-0">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-neutral-200">
                  {row.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.avatar_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
              <span className="font-semibold text-sm truncate">
                {templateCarousel.instagramHandle || row.username || "your_username"}
              </span>
            </div>
            <MoreHorizontal className="h-4 w-4 shrink-0" />
          </div>

          <div
            className="relative bg-neutral-100 overflow-hidden touch-pan-y"
            style={{ width: DISPLAY_WIDTH, height: SLIDE_HEIGHT * SCALE, touchAction: "pan-y" }}
            {...swipe.handlers}
          >
            <div
              style={{
                width: SLIDE_WIDTH,
                height: SLIDE_HEIGHT,
                transform: `scale(${SCALE}) translateX(${swipe.dragDx / SCALE}px)`,
                transformOrigin: "top left",
                transition: swipe.dragging ? "none" : "transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)",
              }}
            >
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-muted" />}>
                {currentSlide && (
                  <SlideRenderer
                    slide={currentSlide}
                    slideIndex={contentIndex >= 0 ? contentIndex + 1 : 0}
                    totalContentSlides={contentSlides.length}
                    instagramHandle={templateCarousel.instagramHandle}
                    monthYear={templateCarousel.monthYear}
                    logoSize={templateCarousel.logoSize}
                    logoUrl={templateCarousel.logoUrl}
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
            <div className="flex items-center gap-3.5">
              <Heart className="h-5 w-5" strokeWidth={1.8} />
              <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
              <Send className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="flex items-center gap-1">
              {templateSlides.map((s, i) => (
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
          {row.caption && (
            <div className="px-3 pt-2 pb-3 text-xs whitespace-pre-wrap">
              <span className="font-semibold mr-1">{templateCarousel.instagramHandle || row.username}</span>
              {row.caption}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Crie seu próprio carrossel — <Link to="/" className="underline">comece aqui</Link>
        </p>
      </main>
    </div>
  );
}
