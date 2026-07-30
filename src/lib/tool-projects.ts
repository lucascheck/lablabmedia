import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ToolTable = "post_frases" | "post_noticias" | "post_simples" | "print_virals" | "whatsapp_prints";

type Cfg<S> = {
  table: ToolTable;
  bucket: string;
  contentType: string;
  ext: string;
  state: S;
  setState: (s: S) => void;
  makeTitle: (s: S) => string;
  generateImage: () => Promise<string>; // returns data URL
};

export function useToolProject<S extends object>(cfg: Cfg<S>, userId?: string) {
  const search = useSearch({ strict: false }) as { id?: string };
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<string | null>(search.id ?? null);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    const id = search.id;
    if (!id || !userId || loadedRef.current === id) return;
    loadedRef.current = id;
    (async () => {
      const { data, error } = await supabase
        .from(cfg.table)
        .select("project_data")
        .eq("id", id)
        .maybeSingle();
      if (error || !data?.project_data) return;
      cfg.setState({ ...(cfg.state as object), ...(data.project_data as object) } as S);
      setProjectId(id);
      toast.info("Projeto carregado");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.id, userId]);

  const save = async () => {
    if (!userId) {
      toast.error("Faça login para salvar");
      return;
    }
    setSaving(true);
    try {
      const dataUrl = await cfg.generateImage();
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${userId}/${crypto.randomUUID()}.${cfg.ext}`;
      const { error: upErr } = await supabase.storage
        .from(cfg.bucket)
        .upload(path, blob, { contentType: cfg.contentType, upsert: false });
      if (upErr) throw upErr;
      const title = (cfg.makeTitle(cfg.state) || "Projeto").slice(0, 80);

      if (projectId) {
        const { error } = await supabase
          .from(cfg.table)
          .update({
            title,
            image_path: path,
            project_data: cfg.state as never,
          })
          .eq("id", projectId);
        if (error) throw error;
        toast.success("Projeto atualizado");
      } else {
        const { data, error } = await supabase
          .from(cfg.table)
          .insert({
            user_id: userId,
            title,
            image_path: path,
            project_data: cfg.state as never,
          })
          .select("id")
          .single();
        if (error) throw error;
        setProjectId(data.id);
        navigate({ search: { id: data.id } as never, replace: true });
        toast.success("Projeto salvo");
      }
    } catch (e) {
      console.error("save error:", e);
      toast.error("Erro ao salvar projeto");
    } finally {
      setSaving(false);
    }
  };

  return { projectId, save, saving };
}
