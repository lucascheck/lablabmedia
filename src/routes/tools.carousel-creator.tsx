import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import React, { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
import { CarouselData, SlideData } from '@/types/carousel';
import { createEmptyCarousel } from '@/utils/templates';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Download, ChevronLeft, ChevronRight, FileText, Menu, X, Loader2, Send, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { uploadSlideImage } from "@/lib/storage";

// Lazy-loaded heavy components — keep route bundle small for fast navigation
const SlideRenderer = lazy(() => import('@/components/carousel/SlideRenderer'));
const EditorSidebar = lazy(() => import('@/components/carousel/EditorSidebar'));

export const Route = createFileRoute("/tools/carousel-creator")({
  component: CarouselCreatorPage,
  head: () => ({
    meta: [
      { title: "Carrossel Creator — LabMedia" },
      { name: "description", content: "Crie carrosséis profissionais com templates, fontes e exportação em PNG ou ZIP." },
    ],
  }),
});

const storageKeyFor = (userId?: string) =>
  userId ? `carousel-editor-data:${userId}` : 'carousel-editor-data';
const selectedKeyFor = (userId?: string) =>
  userId ? `carousel-selected-slide:${userId}` : 'carousel-selected-slide';

const loadSavedCarousel = (userId?: string): CarouselData => {
  try {
    if (typeof window === 'undefined') return createEmptyCarousel();
    const saved = localStorage.getItem(storageKeyFor(userId));
    if (saved) return JSON.parse(saved);
  } catch {}
  return createEmptyCarousel();
};

const loadSelectedSlide = (userId?: string): number => {
  try {
    if (typeof window === 'undefined') return 0;
    const saved = localStorage.getItem(selectedKeyFor(userId));
    if (saved) return parseInt(saved, 10) || 0;
  } catch {}
  return 0;
};

function CarouselCreatorPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const [carousel, setCarousel] = useState<CarouselData>(() => loadSavedCarousel(user?.id));
  const [selectedSlide, setSelectedSlide] = useState(() => loadSelectedSlide(user?.id));
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<CarouselData | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const userLoadedRef = useRef(false);
  const userDirtyRef = useRef(false);
  const lastUserIdRef = useRef<string | undefined>(user?.id);

  const search = useSearch({ strict: false }) as { id?: string };
  const [projectId, setProjectId] = useState<string | null>(search.id ?? null);
  const loadedProjectRef = useRef<string | null>(null);

  // Wrapper que marca como "dirty" quando o usuário edita algo
  const setCarouselWithDirty = useCallback((updater: CarouselData | ((prev: CarouselData) => CarouselData)) => {
    userDirtyRef.current = true;
    setCarousel(updater);
  }, []);

  // Carrega projeto salvo do banco quando ?id= está na URL
  useEffect(() => {
    const id = search.id;
    if (!id || !user?.id || loadedProjectRef.current === id) return;
    loadedProjectRef.current = id;
    // Marca o usuário como "carregado" para esse id, evitando que o efeito
    // do localStorage sobrescreva o projeto vindo do banco.
    lastUserIdRef.current = user.id;
    (async () => {
      const { data, error } = await supabase
        .from("carousels")
        .select("project_data")
        .eq("id", id)
        .maybeSingle();
      if (error || !data?.project_data) {
        toast.error("Não foi possível carregar o projeto");
        return;
      }
      setCarousel(data.project_data as unknown as CarouselData);
      setSelectedSlide(0);
      setProjectId(id);
      userDirtyRef.current = false;
      // Habilita o autosave do localStorage só depois do estado aplicado
      requestAnimationFrame(() => { userLoadedRef.current = true; });
      toast.info("Projeto carregado");
    })();
  }, [search.id, user?.id]);

  // Quando o usuário logar, recarrega o rascunho da conta dele (só se não houve edições
  // e não estamos abrindo um projeto existente via ?id=)
  useEffect(() => {
    if (user?.id && user.id !== lastUserIdRef.current) {
      lastUserIdRef.current = user.id;
      // Se há um id na URL, o outro efeito é responsável por carregar do banco.
      if (search.id) return;
      if (!userDirtyRef.current) {
        setCarousel(loadSavedCarousel(user.id));
        setSelectedSlide(loadSelectedSlide(user.id));
      }
      requestAnimationFrame(() => { userLoadedRef.current = true; });
    } else if (user?.id && !userLoadedRef.current && !search.id) {
      requestAnimationFrame(() => { userLoadedRef.current = true; });
    }
  }, [user?.id, search.id]);

  // Salva carrossel no localStorage (só depois que os dados do usuário foram carregados)
  useEffect(() => {
    if (!userLoadedRef.current) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(storageKeyFor(user?.id), JSON.stringify(carousel)); } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [carousel, user?.id]);

  useEffect(() => {
    if (!userLoadedRef.current) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(selectedKeyFor(user?.id), String(selectedSlide)); } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedSlide, user?.id]);

  const totalContentSlides = carousel.slides.length - 1;

  const getSlideNumber = (index: number) => (index === 0 ? undefined : index);

  useEffect(() => {
    const updateScale = () => {
      if (!canvasRef.current) return;
      const { clientWidth, clientHeight } = canvasRef.current;
      const padding = clientWidth < 768 ? 16 : 64;
      const availW = clientWidth - padding;
      const availH = clientHeight - padding;
      const scaleW = availW / 1080;
      const scaleH = availH / 1350;
      setScale(Math.min(scaleW, scaleH, 1));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    const observer = new ResizeObserver(updateScale);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => { window.removeEventListener('resize', updateScale); observer.disconnect(); };
  }, []);

  const handleSelectSlide = (index: number) => {
    setSelectedSlide(index);
    setSidebarOpen(false);
  };

  const captureSlide = useCallback(async () => {
    if (!slideRef.current) return null;
    const [{ toBlob }, { createExportNode }] = await Promise.all([
      import('html-to-image'),
      import('@/utils/exportImage'),
    ]);
    for (let attempt = 0; attempt < 3; attempt++) {
      let cleanup: (() => void) | undefined;
      try {
        const preparedNode = await createExportNode(slideRef.current);
        cleanup = preparedNode.cleanup;
        const blob = await toBlob(preparedNode.node, {
          width: 1080, height: 1350, pixelRatio: 1, cacheBust: true, skipAutoScale: true, includeQueryParams: true,
        });
        if (blob) return blob;
      } catch (err) {
        console.error(`Capture attempt ${attempt + 1} error:`, err);
      } finally {
        cleanup?.();
      }
      await new Promise(r => setTimeout(r, 300));
    }
    return null;
  }, []);

  const exportAllSlides = useCallback(async () => {
    setExporting(true);
    setSidebarOpen(false);
    toast.info('Exportando slides...');
    const originalSlide = selectedSlide;
    try {
      const [{ default: JSZip }, fileSaverMod] = await Promise.all([
        import('jszip'),
        import('file-saver'),
      ]);
      const saveAs = (fileSaverMod as any).default?.saveAs ?? (fileSaverMod as any).saveAs;
      const zip = new JSZip();
      for (let i = 0; i < carousel.slides.length; i++) {
        setSelectedSlide(i);
        await new Promise(r => setTimeout(r, 350));
        const blob = await captureSlide();
        if (!blob) throw new Error(`Failed to capture slide ${i + 1}`);
        const num = String(i + 1).padStart(2, '0');
        zip.file(`slide_${num}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'carrossel-instagram.zip');
      toast.success('Carrossel exportado com sucesso!');
    } catch (err) {
      console.error('Export all error:', err);
      toast.error('Erro ao exportar ZIP');
    } finally {
      setSelectedSlide(originalSlide);
      setExporting(false);
    }
  }, [carousel, selectedSlide, captureSlide]);

  const exportCurrentSlide = useCallback(async () => {
    if (!slideRef.current) return;
    setExporting(true);
    try {
      const blob = await captureSlide();
      if (!blob) throw new Error('Failed to capture');
      const fileSaverMod = await import('file-saver');
      const saveAs = (fileSaverMod as any).default?.saveAs ?? (fileSaverMod as any).saveAs;
      const num = String(selectedSlide + 1).padStart(2, '0');
      saveAs(blob, `slide_${num}.png`);
      toast.success('Slide exportado!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Erro ao exportar slide');
    } finally {
      setExporting(false);
    }
  }, [selectedSlide, captureSlide]);

  const sendToPreview = useCallback(async () => {
    if (!user) return;
    setExporting(true);
    setSidebarOpen(false);
    toast.info('Preparando carrossel para o preview...');
    const originalSlide = selectedSlide;
    try {
      // Cria carrossel novo
      const { data: created, error: createErr } = await supabase
        .from('carousels')
        .insert({
          user_id: user.id,
          title: `Carrossel ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        })
        .select('id')
        .single();
      if (createErr || !created) throw createErr ?? new Error('Falha ao criar carrossel');

      // Captura cada slide -> upload -> insere
      for (let i = 0; i < carousel.slides.length; i++) {
        setSelectedSlide(i);
        await new Promise(r => setTimeout(r, 350));
        const blob = await captureSlide();
        if (!blob) throw new Error(`Falha ao capturar slide ${i + 1}`);
        const file = new File([blob], `slide_${String(i + 1).padStart(2, '0')}.png`, { type: 'image/png' });
        const path = await uploadSlideImage(user.id, created.id, file);
        const { error: insErr } = await supabase
          .from('carousel_slides')
          .insert({ carousel_id: created.id, user_id: user.id, image_path: path, position: i });
        if (insErr) throw insErr;
      }

      toast.success('Carrossel enviado para o Preview!');
      navigate({ to: '/carousel/$id', params: { id: created.id } });
    } catch (err) {
      console.error('Send to preview error:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar para preview');
    } finally {
      setSelectedSlide(originalSlide);
      setExporting(false);
    }
  }, [user, carousel, selectedSlide, captureSlide, navigate]);

  // Salvar projeto: persiste estado completo do editor + capturas de TODOS os slides
  const handleSave = useCallback(async () => {
    if (!user) { toast.error("Faça login para salvar"); return; }
    setSaving(true);
    const originalSlide = selectedSlide;
    try {
      const title = (carousel.slides[1]?.title || carousel.slides[0]?.title || "Carrossel").slice(0, 80);
      let id = projectId;

      if (!id) {
        const { data, error } = await supabase
          .from("carousels")
          .insert({
            user_id: user.id,
            title,
            project_data: carousel as never,
            username: carousel.instagramHandle || "your_username",
          })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("Erro ao criar projeto");
        id = data.id;
      } else {
        const { error } = await supabase
          .from("carousels")
          .update({ title, project_data: carousel as never })
          .eq("id", id);
        if (error) throw error;
      }

      // Remove TODOS os slides antigos (imagens + registros)
      const { data: oldSlides } = await supabase
        .from("carousel_slides")
        .select("id, image_path")
        .eq("carousel_id", id);
      if (oldSlides && oldSlides.length > 0) {
        await supabase.from("carousel_slides").delete().in("id", oldSlides.map(s => s.id));
        await supabase.storage.from("carousel-images").remove(oldSlides.map(s => s.image_path));
      }

      // Captura cada slide e salva
      for (let i = 0; i < carousel.slides.length; i++) {
        setSelectedSlide(i);
        await new Promise(r => setTimeout(r, 350));
        const blob = await captureSlide();
        if (!blob) throw new Error(`Falha ao capturar slide ${i + 1}`);
        const file = new File([blob], `slide_${String(i + 1).padStart(2, '0')}.png`, { type: "image/png" });
        const path = await uploadSlideImage(user.id, id, file);
        const { error: insErr } = await supabase.from("carousel_slides").insert({
          carousel_id: id, user_id: user.id, image_path: path, position: i,
        });
        if (insErr) throw insErr;
      }

      if (!projectId) {
        setProjectId(id);
        navigate({ search: { id } as never, replace: true });
      }
      toast.success("Projeto salvo com todos os slides");
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSelectedSlide(originalSlide);
      setSaving(false);
    }
  }, [user, carousel, projectId, captureSlide, navigate, selectedSlide]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const currentSlide = carousel.slides[selectedSlide];
  const slideNumber = getSlideNumber(selectedSlide);

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50 w-[320px] transform transition-transform duration-300 ease-in-out
        md:relative md:z-auto md:w-[380px] md:min-w-[380px] md:transform-none md:transition-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {sidebarOpen && (
          <Button
            variant="ghost" size="sm"
            className="absolute top-3 right-3 z-50 text-muted-foreground md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
        <Suspense fallback={
          <div className="h-full w-full bg-card border-r border-border flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        }>
          <EditorSidebar
            carousel={carousel}
            selectedSlideIndex={selectedSlide}
            onSelectSlide={handleSelectSlide}
            onUpdateCarousel={setCarouselWithDirty}
            onLoadTemplate={(data) => { setPendingTemplate(data); }}
          />
        </Suspense>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b border-border flex items-center justify-between px-3 md:px-6 bg-card shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)} className="p-1.5 md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-sm font-bold text-primary">◆</span>
            <span className="text-sm font-bold text-foreground hidden sm:inline">Gerador de Carrosséis</span>
            <span className="text-xs text-muted-foreground ml-1">
              {selectedSlide + 1}/{carousel.slides.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={handleSave} disabled={saving || exporting}
              className="text-xs px-2 md:px-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90 border-0">
              {saving ? <Loader2 className="h-4 w-4 md:mr-1 animate-spin" /> : <Save className="h-4 w-4 md:mr-1" />}
              <span className="hidden md:inline">{saving ? "Salvando..." : "Salvar"}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={exportCurrentSlide} disabled={exporting} className="text-xs px-2 md:px-3">
              <Download className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">Exportar Slide</span>
            </Button>
            <Button size="sm" onClick={exportAllSlides} disabled={exporting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-2 md:px-3">
              <FileText className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">Exportar ZIP</span>
            </Button>
            <Button size="sm" onClick={sendToPreview} disabled={exporting}
              className="text-xs px-2 md:px-3 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white hover:opacity-90 shadow-md border-0">
              {exporting ? <Loader2 className="h-4 w-4 md:mr-1 animate-spin" /> : <Send className="h-4 w-4 md:mr-1" />}
              <span className="hidden md:inline">Enviar para Preview</span>
            </Button>
          </div>
        </div>

        <div className="border-b border-border bg-card/60 px-3 py-2 flex items-center justify-center gap-2 shrink-0 overflow-x-auto">
          <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">
            Slides ({selectedSlide + 1}/{carousel.slides.length})
          </span>
          <div className="flex items-center gap-1.5">
            {carousel.slides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => setSelectedSlide(i)}
                className={`min-w-[34px] h-9 px-2 rounded-md text-xs font-bold flex items-center justify-center transition-all border ${
                  i === selectedSlide
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-105'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                }`}
                title={`Slide ${i + 1}`}
              >
                {i === 0 ? '📸' : i === carousel.slides.length - 1 ? '📣' : i}
              </button>
            ))}
          </div>
        </div>

        <div ref={canvasRef} className="flex-1 flex items-center justify-center bg-background relative overflow-hidden p-2 md:p-8">
          <Button
            variant="ghost" size="sm"
            className="absolute left-1 md:left-4 top-1/2 -translate-y-1/2 z-10 p-1.5"
            onClick={() => setSelectedSlide(Math.max(0, selectedSlide - 1))}
            disabled={selectedSlide === 0}
          >
            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
          </Button>

          <div
            style={{
              width: 1080,
              height: 1350,
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              flexShrink: 0,
            }}
          >
            <div ref={slideRef} style={{ width: 1080, height: 1350 }}>
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              }>
                <SlideRenderer
                  slide={currentSlide}
                  slideIndex={slideNumber ?? 0}
                  totalContentSlides={totalContentSlides}
                  instagramHandle={carousel.instagramHandle}
                  monthYear={carousel.monthYear}
                  logoSize={carousel.logoSize}
                  logoUrl={carousel.logoUrl}
                />
              </Suspense>
            </div>
          </div>

          <Button
            variant="ghost" size="sm"
            className="absolute right-1 md:right-4 top-1/2 -translate-y-1/2 z-10 p-1.5"
            onClick={() => setSelectedSlide(Math.min(carousel.slides.length - 1, selectedSlide + 1))}
            disabled={selectedSlide === carousel.slides.length - 1}
          >
            <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
        </div>
      </div>

      <AlertDialog open={!!pendingTemplate} onOpenChange={(open) => { if (!open) setPendingTemplate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar este template?</AlertDialogTitle>
            <AlertDialogDescription>
              O visual (cores, fontes, imagens, layout) será substituído pelo template.
              Os textos que você já digitou serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTemplate) {
                  // Preserva os textos do carrossel atual ao aplicar template
                  const TEXT_KEYS: (keyof SlideData)[] = [
                    'title', 'subtitle', 'mainText', 'secondaryText',
                    'ctaTitle', 'ctaSubtitle', 'ctaFollowText',
                  ];
                  const mergedSlides = pendingTemplate.slides.map((tplSlide, i) => {
                    const currentSlideData = carousel.slides[i];
                    if (!currentSlideData) return tplSlide;
                    const preserved: Partial<SlideData> = {};
                    for (const key of TEXT_KEYS) {
                      const val = currentSlideData[key];
                      if (val !== undefined && val !== '') {
                        (preserved as any)[key] = val;
                      }
                    }
                    return { ...tplSlide, ...preserved };
                  });
                  setCarouselWithDirty({ ...pendingTemplate, slides: mergedSlides });
                  setSelectedSlide(0);
                  setSidebarOpen(false);
                }
                setPendingTemplate(null);
              }}
            >
              Aplicar template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
