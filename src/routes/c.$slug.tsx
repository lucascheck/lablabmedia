import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import { InstagramMockup } from "@/components/instagram-mockup";
import { Button } from "@/components/ui/button";
import { Loader2, Sun, Moon } from "lucide-react";

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

type Carousel = {
  id: string;
  title: string;
  username: string;
  avatar_url: string | null;
  caption: string;
  theme: string;
};

type Slide = { id: string; image_path: string; position: number; url?: string };

function PublicCarouselPage() {
  const { slug } = Route.useParams();
  const [carousel, setCarousel] = useState<Carousel | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    void (async () => {
      const { data: c } = await supabase
        .from("carousels")
        .select("id, title, username, avatar_url, caption, theme")
        .eq("public_slug", slug)
        .eq("is_public", true)
        .maybeSingle();

      if (!c) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCarousel(c);
      setTheme((c.theme === "dark" ? "dark" : "light") as "light" | "dark");

      const { data: ss } = await supabase
        .from("carousel_slides")
        .select("id, image_path, position")
        .eq("carousel_id", c.id)
        .order("position", { ascending: true });

      const paths = (ss ?? []).map((s) => s.image_path);
      const urls = await getSignedUrls(paths);
      setSlides((ss ?? []).map((s) => ({ ...s, url: urls[s.image_path] })));
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (notFound || !carousel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">Carrossel não encontrado</h1>
        <p className="text-muted-foreground">Este link pode ter expirado ou foi tornado privado.</p>
        <Button asChild><Link to="/">Ir para o início</Link></Button>
      </div>
    );
  }

  const mockupSlides = slides.filter((s) => s.url).map((s) => ({ id: s.id, url: s.url! }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-medium truncate flex-1">{carousel.title}</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 sm:py-10">
        <InstagramMockup
          slides={mockupSlides}
          username={carousel.username}
          avatarUrl={carousel.avatar_url}
          caption={carousel.caption}
          theme={theme}
        />
        <p className="text-center text-xs text-muted-foreground mt-6">
          Crie seu próprio carrossel — <Link to="/" className="underline">comece aqui</Link>
        </p>
      </main>
    </div>
  );
}
