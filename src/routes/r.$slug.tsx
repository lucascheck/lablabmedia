import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileEdit, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/r/$slug")({
  component: SharedRoteiroPage,
  head: () => ({
    meta: [
      { title: "Roteiro compartilhado — LabMedia" },
      { name: "description", content: "Roteiro compartilhado publicamente." },
    ],
  }),
});

function SharedRoteiroPage() {
  const { slug } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ title: string; content: string; created_at: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("shared_roteiros")
        .select("title, content, created_at")
        .eq("slug", slug)
        .maybeSingle();
      setData(data ?? null);
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

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <FileEdit className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Roteiro não encontrado</h1>
        <Button asChild variant="outline">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" /> Início
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Card className="p-6 sm:p-8">
          <header className="mb-6 pb-6 border-b">
            <h1 className="text-3xl font-bold tracking-tight">{data.title}</h1>
            <p className="text-xs text-muted-foreground mt-2">
              Compartilhado em {new Date(data.created_at).toLocaleString("pt-BR")}
            </p>
          </header>
          <article className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
            {data.content || "(roteiro vazio)"}
          </article>
        </Card>
      </main>
    </div>
  );
}
