import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CANVAS_W = 1080;
const CANVAS_H = 1920;

type ElType = "text" | "image" | "cta";
type ElBase = { id: string; type: ElType; x: number; y: number; w: number; h: number; z: number; notes?: string };
type ElText = ElBase & { type: "text"; text: string; fontSize: number; fontWeight: number; align: "left" | "center" | "right"; color: string; uppercase: boolean };
type ElImage = ElBase & { type: "image"; label: string };
type ElCta = ElBase & { type: "cta"; text: string; bg: string; color: string; radius: number };
type El = ElText | ElImage | ElCta;
type Wire = { id: string; name: string; elements: El[] };

export const Route = createFileRoute("/p/$slug")({
  component: SharedPanelPage,
  head: ({ params }) => ({
    meta: [
      { title: `Painel de wireframes — ${params.slug}` },
      { name: "description", content: "Painel de wireframes compartilhado." },
    ],
  }),
});

function SharedPanelPage() {
  const { slug } = Route.useParams();
  const [name, setName] = useState<string>("");
  const [wires, setWires] = useState<Wire[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("shared_wireframe_panels")
        .select("name, wires")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) { setError("Painel não encontrado."); return; }
      setName(data.name);
      setWires(data.wires as unknown as Wire[]);
    })();
  }, [slug]);

  if (error) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{error}</div>;
  if (!wires) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="px-4 sm:px-6 py-4 border-b bg-card">
        <h1 className="text-lg font-semibold">{name}</h1>
        <p className="text-xs text-muted-foreground">
          Painel compartilhado · {wires.length} {wires.length === 1 ? "wireframe" : "wireframes"} · somente visualização
        </p>
      </header>

      <div className="px-4 sm:px-6 py-6">
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {wires.map((w) => (
            <WireCard key={w.id} wire={w} />
          ))}
        </div>
      </div>
    </div>
  );
}

function WireCard({ wire }: { wire: Wire }) {
  // Card width-driven scale; max thumb width 360
  const [thumbW, setThumbW] = useState(280);
  useEffect(() => {
    const update = () => {
      const w = Math.min(360, Math.max(220, window.innerWidth - 64));
      setThumbW(w);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const scale = thumbW / CANVAS_W;
  const thumbH = CANVAS_H * scale;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div style={{ width: "100%", height: thumbH, background: "#ffffff", position: "relative", overflow: "hidden" }}>
        <div style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative" }}>
          {wire.elements.map((el) => (
            <div key={el.id} style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z }}>
              <ElementView el={el} />
            </div>
          ))}
        </div>
      </div>
      <div className="px-3 py-2 border-t">
        <div className="text-sm font-medium truncate">{wire.name}</div>
        <div className="text-[11px] text-muted-foreground">{wire.elements.length} elementos</div>
      </div>
    </div>
  );
}

function ElementView({ el }: { el: El }) {
  if (el.type === "text") {
    return (
      <div className="w-full h-full flex"
        style={{ alignItems: "center", justifyContent: el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center" }}>
        <div style={{
          color: el.color, fontSize: el.fontSize, fontWeight: el.fontWeight,
          textAlign: el.align, textTransform: el.uppercase ? "uppercase" : "none",
          lineHeight: 1.05, width: "100%", padding: 8, wordBreak: "break-word",
        }}>{el.text}</div>
      </div>
    );
  }
  if (el.type === "image") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center"
        style={{ border: "4px dashed rgba(15,23,42,0.35)", color: "rgba(15,23,42,0.55)", background: "rgba(15,23,42,0.04)" }}>
        <div style={{ fontSize: 36, fontWeight: 600 }}>{el.label}</div>
      </div>
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center"
      style={{ background: el.bg, color: el.color, borderRadius: el.radius, fontSize: 44, fontWeight: 700, padding: 16 }}>
      {el.text}
    </div>
  );
}
