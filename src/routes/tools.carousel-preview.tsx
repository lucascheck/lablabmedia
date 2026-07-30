import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Instagram, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/tools/carousel-preview")({
  component: CarouselPreviewPage,
  head: () => ({
    meta: [
      { title: "Carrossel Preview — LabMedia" },
      { name: "description", content: "Visualize seus carrosseis como ficariam no feed do Instagram." },
    ],
  }),
});

type CarouselRow = {
  id: string;
  title: string;
  updated_at: string;
  cover_path: string | null;
};

function CarouselPreviewPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [carousels, setCarousels] = useState<CarouselRow[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) {
      setCarousels([]);
      setCovers({});
      return;
    }
    void loadCarousels();
  }, [user?.id]);

  const loadCarousels = async () => {
    if (!user) return;
    setFetching(true);
    const { data: cs, error } = await supabase
      .from("carousels")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setFetching(false);
      return;
    }
    const ids = (cs ?? []).map((c) => c.id);
    let coverByCarousel: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: slides } = await supabase
        .from("carousel_slides")
        .select("carousel_id, image_path, position")
        .in("carousel_id", ids)
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
      const urls = await getSignedUrls(paths);
      const mapped: Record<string, string> = {};
      Object.entries(coverByCarousel).forEach(([cid, path]) => {
        if (urls[path]) mapped[cid] = urls[path];
      });
      setCovers(mapped);
    }
    setCarousels((cs ?? []).map((c) => ({ ...c, cover_path: coverByCarousel[c.id] ?? null })));
    setFetching(false);
  };

  const createCarousel = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("carousels")
      .insert({ user_id: user.id, title: "Novo carrossel" })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error(error?.message ?? "Erro ao criar");
      return;
    }
    navigate({ to: "/carousel/$id", params: { id: data.id } });
  };

  const deleteCarousel = async (id: string) => {
    const { error } = await supabase.from("carousels").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Carrossel excluído");
      void loadCarousels();
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-full bg-background">
      <main className="max-w-6xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Meus carrosséis</h1>
            <p className="text-muted-foreground mt-1">Crie e visualize como seus posts ficariam no Instagram.</p>
          </div>
          <Button onClick={createCarousel} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Novo carrossel
          </Button>
        </div>

        {fetching ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : carousels.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Instagram className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">Nenhum carrossel ainda</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">Crie seu primeiro projeto para começar.</p>
            <Button onClick={createCarousel}><Plus className="h-4 w-4 mr-2" />Criar carrossel</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {carousels.map((c) => (
              <Card key={c.id} className="overflow-hidden group relative">
                <Link to="/carousel/$id" params={{ id: c.id }}>
                  <div className="aspect-[4/5] bg-muted relative overflow-hidden">
                    {covers[c.id] ? (
                      <img src={covers[c.id]} alt={c.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Sem imagens</div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-sm truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(c.updated_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon" variant="secondary"
                      className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir carrossel?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Essa ação removerá "{c.title}" e todas as suas imagens. Não pode ser desfeito.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteCarousel(c.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
