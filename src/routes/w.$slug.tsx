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

export const Route = createFileRoute("/w/$slug")({
  component: SharedWireframePage,
  head: ({ params }) => ({
    meta: [
      { title: `Wireframe — ${params.slug}` },
      { name: "description", content: "Wireframe compartilhado para o time de design." },
    ],
  }),
});

function SharedWireframePage() {
  const { slug } = Route.useParams();
  const [name, setName] = useState<string>("");
  const [elements, setElements] = useState<El[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("shared_wireframes")
        .select("name, elements")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) { setError("Wireframe não encontrado."); return; }
      setName(data.name);
      setElements(data.elements as unknown as El[]);
    })();
  }, [slug]);

  useEffect(() => {
    const fit = () => {
      const padding = 80;
      const sx = (window.innerWidth - padding) / CANVAS_W;
      const sy = (window.innerHeight - 160) / CANVAS_H;
      setScale(Math.max(0.1, Math.min(sx, sy, 1)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{error}</div>;
  }
  if (!elements) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="px-6 py-4 border-b bg-card">
        <h1 className="text-lg font-semibold">{name}</h1>
        <p className="text-xs text-muted-foreground">Wireframe compartilhado · somente visualização</p>
      </header>
      <div className="flex items-center justify-center p-8">
        <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, flexShrink: 0 }}>
          <div
            style={{
              width: CANVAS_W, height: CANVAS_H,
              transform: `scale(${scale})`, transformOrigin: "top left",
              background: "#ffffff", position: "relative",
              boxShadow: "0 30px 80px rgba(15,23,42,0.18)",
            }}
          >
            {elements.map((el) => (
              <div key={el.id} style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z }}>
                <ElementView el={el} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ElementView({ el }: { el: El }) {
  if (el.type === "text") {
    return (
      <div className="w-full h-full flex"
        style={{
          alignItems: "center",
          justifyContent: el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center",
        }}>
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
