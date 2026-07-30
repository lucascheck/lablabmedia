import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CarouselData, SlideData, SlideType, AVAILABLE_FONTS, createDefaultSlide } from '@/types/carousel';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ChevronUp, ChevronDown, Upload, X, Star, Save, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { templates } from '@/utils/templates';
import { ensureRenderableImage, isHeic } from '@/lib/heic';

const ImageUploadField: React.FC<{
  imageUrl?: string;
  onChangeUrl: (url: string) => void;
}> = ({ imageUrl, onChangeUrl }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'upload' | 'url'>(imageUrl?.startsWith('data:') || !imageUrl ? 'upload' : 'url');

  const handleFile = useCallback(async (raw: File) => {
    if (!raw.type.startsWith('image/') && !isHeic(raw)) return;
    try {
      const file = await ensureRenderableImage(raw);
      const reader = new FileReader();
      reader.onload = (e) => {
        onChangeUrl(e.target?.result as string);
        setMode('upload');
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Falha ao carregar imagem');
    }
  }, [onChangeUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs">Imagem</Label>
        <div className="flex gap-1">
          <button
            onClick={() => setMode('upload')}
            className={`text-[10px] px-2 py-0.5 rounded ${mode === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
          >
            Upload
          </button>
          <button
            onClick={() => setMode('url')}
            className={`text-[10px] px-2 py-0.5 rounded ${mode === 'url' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
          >
            URL
          </button>
        </div>
      </div>

      {mode === 'upload' ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-md p-3 cursor-pointer transition-colors text-center ${
            isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'
          }`}
        >
          {imageUrl ? (
            <div className="relative">
              <img src={imageUrl} alt="" className="w-full h-24 object-cover rounded" />
              <button
                onClick={(e) => { e.stopPropagation(); onChangeUrl(''); }}
                className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-2 text-muted-foreground">
              <Upload className="h-5 w-5" />
              <span className="text-[11px]">Arraste uma imagem ou clique para selecionar</span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.dng,.heic,.heif"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Input
            value={imageUrl?.startsWith('data:') ? '' : imageUrl || ''}
            onChange={(e) => onChangeUrl(e.target.value)}
            placeholder="https://images.unsplash.com/..."
            className="bg-secondary border-border text-foreground text-xs flex-1"
          />
          {imageUrl && (
            <Button variant="ghost" size="sm" onClick={() => onChangeUrl('')} className="px-1.5">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {imageUrl && mode === 'url' && !imageUrl.startsWith('data:') && (
        <img src={imageUrl} alt="" className="w-full h-20 object-cover rounded border border-border" />
      )}
    </div>
  );
};

interface EditorSidebarProps {
  carousel: CarouselData;
  selectedSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onUpdateCarousel: (carousel: CarouselData) => void;
  onLoadTemplate: (template: CarouselData) => void;
}

const slideTypeLabels: Record<SlideType, string> = {
  'cover': 'Capa (centralizada)',
  'cover-bottom': 'Capa (texto embaixo)',
  'variant-a': 'Variante A (foto meio)',
  'variant-b': 'Variante B (foto base)',
  'variant-c': 'Variante C (foto topo)',
  'variant-d': 'Variante D (fundo roxo)',
  'cta': 'CTA (chamada ação)',
};

const getDefaultTitleSize = (type: SlideType): number => {
  switch (type) {
    case 'cover': case 'cover-bottom': return 54;
    case 'cta': return 52;
    default: return 38;
  }
};

const getDefaultTextSize = (type: SlideType): number => {
  switch (type) {
    case 'cover': case 'cover-bottom': return 22;
    case 'cta': return 24;
    default: return 28;
  }
};

const EditorSidebar: React.FC<EditorSidebarProps> = ({
  carousel, selectedSlideIndex, onSelectSlide, onUpdateCarousel, onLoadTemplate,
}) => {
  const currentSlide = carousel.slides[selectedSlideIndex];

  const [favoriteColors, setFavoriteColors] = useState<string[]>(() => {
    try { const s = localStorage.getItem('carousel-fav-colors'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [favoriteHighlights, setFavoriteHighlights] = useState<Array<{ color1: string; color2?: string; gradient: boolean }>>(() => {
    try { const s = localStorage.getItem('carousel-fav-highlights'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [stylePreset, setStylePreset] = useState<Partial<SlideData> | null>(() => {
    try { const s = localStorage.getItem('carousel-style-preset'); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  useEffect(() => { localStorage.setItem('carousel-fav-colors', JSON.stringify(favoriteColors)); }, [favoriteColors]);
  useEffect(() => { localStorage.setItem('carousel-fav-highlights', JSON.stringify(favoriteHighlights)); }, [favoriteHighlights]);
  useEffect(() => {
    if (stylePreset) localStorage.setItem('carousel-style-preset', JSON.stringify(stylePreset));
    else localStorage.removeItem('carousel-style-preset');
  }, [stylePreset]);

  const toggleFavoriteColor = (color: string) => {
    setFavoriteColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]);
  };

  const getCurrentHighlightKey = () => {
    const c1 = currentSlide?.highlightColor || '#B078FF';
    const isGrad = currentSlide?.highlightGradient ?? false;
    const c2 = isGrad ? (currentSlide?.highlightGradientColor2 || '#FF78B0') : undefined;
    return { color1: c1, color2: c2, gradient: isGrad };
  };

  const isHighlightFavorited = () => {
    const cur = getCurrentHighlightKey();
    return favoriteHighlights.some(f => f.color1 === cur.color1 && f.gradient === cur.gradient && f.color2 === cur.color2);
  };

  const toggleFavoriteHighlight = () => {
    const cur = getCurrentHighlightKey();
    if (isHighlightFavorited()) {
      setFavoriteHighlights(prev => prev.filter(f => !(f.color1 === cur.color1 && f.gradient === cur.gradient && f.color2 === cur.color2)));
    } else {
      setFavoriteHighlights(prev => [...prev, cur]);
    }
  };

  const updateSlide = (index: number, updates: Partial<SlideData>) => {
    const newSlides = [...carousel.slides];
    newSlides[index] = { ...newSlides[index], ...updates };
    onUpdateCarousel({ ...carousel, slides: newSlides });
  };

  const applyFavoriteHighlight = (fav: { color1: string; color2?: string; gradient: boolean }) => {
    updateSlide(selectedSlideIndex, {
      highlightColor: fav.color1,
      highlightGradient: fav.gradient,
      highlightGradientColor2: fav.color2 || '#FF78B0',
    });
  };

  const addSlide = () => {
    if (carousel.slides.length >= 10) return;
    const newSlide = createDefaultSlide('variant-a', carousel.slides.length);
    const slides = [...carousel.slides];
    slides.splice(carousel.slides.length - 1, 0, newSlide);
    onUpdateCarousel({ ...carousel, slides });
    onSelectSlide(carousel.slides.length - 1);
  };

  const removeSlide = (index: number) => {
    if (carousel.slides.length <= 3) return;
    const slides = carousel.slides.filter((_, i) => i !== index);
    onUpdateCarousel({ ...carousel, slides });
    if (selectedSlideIndex >= slides.length) onSelectSlide(slides.length - 1);
  };

  const moveSlide = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= carousel.slides.length) return;
    const slides = [...carousel.slides];
    [slides[index], slides[newIndex]] = [slides[newIndex], slides[index]];
    onUpdateCarousel({ ...carousel, slides });
    onSelectSlide(newIndex);
  };

  const PRESET_KEYS: (keyof SlideData)[] = [
    'paddingTop', 'paddingBottom', 'paddingSides',
  ];

  const saveStylePreset = () => {
    if (!currentSlide) return;
    const preset: Partial<SlideData> = {};
    for (const k of PRESET_KEYS) {
      const v = (currentSlide as any)[k];
      if (v !== undefined) (preset as any)[k] = v;
    }
    setStylePreset(preset);
    toast.success('Padrão salvo! Será usado como base para os próximos.');
  };

  const applyPresetToCurrent = () => {
    if (!stylePreset) return;
    updateSlide(selectedSlideIndex, stylePreset);
    toast.success('Padrão aplicado a este slide.');
  };

  const applyPresetToAll = () => {
    if (!stylePreset) return;
    const newSlides = carousel.slides.map(s => ({ ...s, ...stylePreset }));
    onUpdateCarousel({ ...carousel, slides: newSlides });
    toast.success('Padrão aplicado a todos os slides.');
  };

  const clearStylePreset = () => {
    setStylePreset(null);
    toast.info('Padrão removido.');
  };

  return (
    <div className="w-full h-full border-r border-border bg-card flex flex-col overflow-y-auto overflow-x-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground mb-3">Configurações</h2>
        <div className="space-y-3">
          <div>
            <Label className="text-muted-foreground text-xs mb-1 block">Logomarca</Label>
            <div className="flex items-center gap-2">
              <div className="w-14 h-14 rounded border border-border bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                {carousel.logoUrl ? (
                  <img src={carousel.logoUrl} alt="logo" className="max-w-full max-h-full object-contain" />
                ) : carousel.logoUrl === '' ? (
                  <span className="text-[9px] text-muted-foreground text-center px-1">Sem logo</span>
                ) : (
                  <span className="text-[9px] text-muted-foreground text-center px-1">Padrão</span>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,.dng,.heic,.heif"
                    className="hidden"
                    onChange={async (e) => {
                      const raw = e.target.files?.[0];
                      if (!raw) return;
                      try {
                        const file = await ensureRenderableImage(raw);
                        const reader = new FileReader();
                        reader.onload = (ev) => onUpdateCarousel({ ...carousel, logoUrl: ev.target?.result as string });
                        reader.readAsDataURL(file);
                      } catch { toast.error('Falha ao carregar logo'); }
                    }}
                  />
                  <span className="inline-flex items-center justify-center gap-1 text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full">
                    <Upload className="h-3 w-3" /> Enviar logo
                  </span>
                </label>
                {carousel.logoUrl !== '' && (
                  <button
                    onClick={() => onUpdateCarousel({ ...carousel, logoUrl: '' })}
                    className="text-[10px] text-muted-foreground hover:text-destructive flex items-center justify-center gap-1"
                  >
                    <X className="h-3 w-3" /> Remover
                  </button>
                )}
                {carousel.logoUrl === '' && (
                  <button
                    onClick={() => onUpdateCarousel({ ...carousel, logoUrl: undefined })}
                    className="text-[10px] text-muted-foreground hover:text-primary flex items-center justify-center gap-1"
                  >
                    Restaurar padrão
                  </button>
                )}
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-xs">Tamanho da logomarca</Label>
              <span className="text-xs text-muted-foreground">{carousel.logoSize ?? 40}px</span>
            </div>
            <Slider
              value={[carousel.logoSize ?? 40]}
              onValueChange={([v]) => onUpdateCarousel({ ...carousel, logoSize: v })}
              min={20} max={120} step={2}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-border">
        <Label className="text-muted-foreground text-xs mb-2 block">Templates</Label>
        <div className="flex gap-2 flex-wrap">
          {templates.map((t, i) => (
            <Button key={i} variant="outline" size="sm" onClick={() => onLoadTemplate(t.data)} className="text-xs">
              {t.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-4 border-b border-border">
        <div className="flex justify-between items-center mb-2">
          <Label className="text-muted-foreground text-xs">Slides ({carousel.slides.length}/10)</Label>
          <Button variant="ghost" size="sm" onClick={addSlide} disabled={carousel.slides.length >= 10}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {carousel.slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => onSelectSlide(i)}
              className={`w-10 h-12 rounded text-xs font-bold flex items-center justify-center transition-all ${
                i === selectedSlideIndex
                  ? 'ring-2 ring-primary bg-primary/20 text-primary'
                  : 'bg-secondary text-muted-foreground hover:bg-muted'
              }`}
            >
              {i === 0 ? '📸' : i === carousel.slides.length - 1 ? '📣' : i}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-shrink-0">
        {currentSlide && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Slide {selectedSlideIndex + 1}</h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => moveSlide(selectedSlideIndex, -1)} disabled={selectedSlideIndex === 0}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => moveSlide(selectedSlideIndex, 1)} disabled={selectedSlideIndex === carousel.slides.length - 1}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeSlide(selectedSlideIndex)} disabled={carousel.slides.length <= 3} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Tipo do slide</Label>
              <Select value={currentSlide.type} onValueChange={(val: SlideType) => updateSlide(selectedSlideIndex, { type: val })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(slideTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Fonte</Label>
              <Select value={currentSlide.fontFamily || "'Raleway', sans-serif"} onValueChange={(val) => updateSlide(selectedSlideIndex, { fontFamily: val })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVAILABLE_FONTS.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-border bg-secondary/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-xs font-semibold flex items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5 text-primary" />
                  Padrão de margens
                </Label>
                {stylePreset && (
                  <button
                    onClick={clearStylePreset}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                    title="Remover padrão salvo"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Salve as margens (topo, base e laterais) deste slide para reaproveitar nos demais.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveStylePreset}
                  className="h-7 text-[11px] px-2 gap-1"
                >
                  <Save className="h-3 w-3" />
                  Salvar padrão
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={applyPresetToCurrent}
                  disabled={!stylePreset}
                  className="h-7 text-[11px] px-2"
                >
                  Aplicar aqui
                </Button>
                <Button
                  size="sm"
                  onClick={applyPresetToAll}
                  disabled={!stylePreset}
                  className="h-7 text-[11px] px-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Aplicar a todos
                </Button>
              </div>
              {stylePreset && (
                <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 pt-1 border-t border-border/50">
                  {stylePreset.paddingTop !== undefined && <span>Topo {stylePreset.paddingTop}px</span>}
                  {stylePreset.paddingBottom !== undefined && <span>Base {stylePreset.paddingBottom}px</span>}
                  {stylePreset.paddingSides !== undefined && <span>Laterais {stylePreset.paddingSides}px</span>}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-xs">Tamanho título</Label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateSlide(selectedSlideIndex, { titleUppercase: !(currentSlide.titleUppercase ?? false) })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                      (currentSlide.titleUppercase ?? false)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-muted-foreground border-border'
                    }`}
                  >
                    AA
                  </button>
                  <span className="text-xs text-muted-foreground">{currentSlide.titleFontSize || getDefaultTitleSize(currentSlide.type)}px</span>
                </div>
              </div>
              <Slider
                value={[currentSlide.titleFontSize || getDefaultTitleSize(currentSlide.type)]}
                onValueChange={([v]) => updateSlide(selectedSlideIndex, { titleFontSize: v })}
                min={20} max={160} step={1}
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-xs">Tamanho texto</Label>
                <span className="text-xs text-muted-foreground">{currentSlide.textFontSize || getDefaultTextSize(currentSlide.type)}px</span>
              </div>
              <Slider
                value={[currentSlide.textFontSize || getDefaultTextSize(currentSlide.type)]}
                onValueChange={([v]) => updateSlide(selectedSlideIndex, { textFontSize: v })}
                min={14} max={50} step={1}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-xs">Altura linha (título)</Label>
                  <span className="text-xs text-muted-foreground">{(currentSlide.titleLineHeight ?? 1.2).toFixed(2)}</span>
                </div>
                <Slider
                  value={[currentSlide.titleLineHeight ?? 1.2]}
                  onValueChange={([v]) => updateSlide(selectedSlideIndex, { titleLineHeight: v })}
                  min={0.8} max={2.5} step={0.05}
                  className="mt-1"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-xs">Altura linha (texto)</Label>
                  <span className="text-xs text-muted-foreground">{(currentSlide.textLineHeight ?? 1.4).toFixed(2)}</span>
                </div>
                <Slider
                  value={[currentSlide.textLineHeight ?? 1.4]}
                  onValueChange={([v]) => updateSlide(selectedSlideIndex, { textLineHeight: v })}
                  min={0.8} max={2.5} step={0.05}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-muted-foreground text-xs">Peso título</Label>
                <Select
                  value={String(currentSlide.titleFontWeight ?? '')}
                  onValueChange={(v) => updateSlide(selectedSlideIndex, { titleFontWeight: v ? Number(v) : undefined })}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Padrão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="300">300 — Light</SelectItem>
                    <SelectItem value="400">400 — Regular</SelectItem>
                    <SelectItem value="500">500 — Medium</SelectItem>
                    <SelectItem value="600">600 — Semibold</SelectItem>
                    <SelectItem value="700">700 — Bold</SelectItem>
                    <SelectItem value="800">800 — Extrabold</SelectItem>
                    <SelectItem value="900">900 — Black</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Peso texto</Label>
                <Select
                  value={String(currentSlide.textFontWeight ?? '')}
                  onValueChange={(v) => updateSlide(selectedSlideIndex, { textFontWeight: v ? Number(v) : undefined })}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Padrão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="300">300 — Light</SelectItem>
                    <SelectItem value="400">400 — Regular</SelectItem>
                    <SelectItem value="500">500 — Medium</SelectItem>
                    <SelectItem value="600">600 — Semibold</SelectItem>
                    <SelectItem value="700">700 — Bold</SelectItem>
                    <SelectItem value="800">800 — Extrabold</SelectItem>
                    <SelectItem value="900">900 — Black</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Destaque (****)</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={currentSlide.highlightColor || '#B078FF'}
                  onChange={(e) => updateSlide(selectedSlideIndex, { highlightColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                />
                <Input
                  value={currentSlide.highlightColor || '#B078FF'}
                  onChange={(e) => updateSlide(selectedSlideIndex, { highlightColor: e.target.value })}
                  className="bg-secondary border-border text-foreground text-xs flex-1"
                  placeholder="#B078FF"
                />
                <button
                  onClick={() => updateSlide(selectedSlideIndex, { highlightBold: !(currentSlide.highlightBold ?? true) })}
                  className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${
                    (currentSlide.highlightBold ?? true)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border'
                  }`}
                >
                  B
                </button>
                <button
                  onClick={() => updateSlide(selectedSlideIndex, { highlightGradient: !(currentSlide.highlightGradient ?? false) })}
                  className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${
                    (currentSlide.highlightGradient ?? false)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border'
                  }`}
                  title="Gradiente no destaque"
                  style={(currentSlide.highlightGradient ?? false) ? {
                    background: `linear-gradient(135deg, ${currentSlide.highlightColor || '#B078FF'}, ${currentSlide.highlightGradientColor2 || '#FF78B0'})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  } : {}}
                >
                  G
                </button>
                <button
                  onClick={toggleFavoriteHighlight}
                  className={`p-1.5 rounded border transition-colors ${
                    isHighlightFavorited()
                      ? 'text-yellow-400 border-yellow-400'
                      : 'text-muted-foreground border-border hover:text-yellow-400'
                  }`}
                  title="Favoritar destaque"
                >
                  <Star className="w-4 h-4" fill={isHighlightFavorited() ? 'currentColor' : 'none'} />
                </button>
              </div>
              {(currentSlide.highlightGradient ?? false) && (
                <div className="flex items-center gap-2 mt-2">
                  <Label className="text-muted-foreground text-xs whitespace-nowrap">Cor 2</Label>
                  <input
                    type="color"
                    value={currentSlide.highlightGradientColor2 || '#FF78B0'}
                    onChange={(e) => updateSlide(selectedSlideIndex, { highlightGradientColor2: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                  />
                  <Input
                    value={currentSlide.highlightGradientColor2 || '#FF78B0'}
                    onChange={(e) => updateSlide(selectedSlideIndex, { highlightGradientColor2: e.target.value })}
                    className="bg-secondary border-border text-foreground text-xs flex-1"
                    placeholder="#FF78B0"
                  />
                </div>
              )}
              {favoriteHighlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {favoriteHighlights.map((fav, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyFavoriteHighlight(fav)}
                      className="w-6 h-6 rounded-full border-2 border-border transition-transform hover:scale-110"
                      style={fav.gradient
                        ? { background: `linear-gradient(135deg, ${fav.color1}, ${fav.color2 || '#FF78B0'})` }
                        : { backgroundColor: fav.color1 }
                      }
                      title={fav.gradient ? `${fav.color1} → ${fav.color2}` : fav.color1}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Cor de fundo</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={currentSlide.backgroundColor || '#292A25'}
                  onChange={(e) => updateSlide(selectedSlideIndex, { backgroundColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                />
                <Input
                  value={currentSlide.backgroundColor || '#292A25'}
                  onChange={(e) => updateSlide(selectedSlideIndex, { backgroundColor: e.target.value })}
                  className="bg-secondary border-border text-foreground text-xs flex-1"
                  placeholder="#292A25"
                />
                <button
                  onClick={() => toggleFavoriteColor(currentSlide.backgroundColor || '#292A25')}
                  className={`p-1.5 rounded border transition-colors ${
                    favoriteColors.includes(currentSlide.backgroundColor || '#292A25')
                      ? 'text-yellow-400 border-yellow-400'
                      : 'text-muted-foreground border-border hover:text-yellow-400'
                  }`}
                  title="Favoritar cor"
                >
                  <Star className="w-4 h-4" fill={favoriteColors.includes(currentSlide.backgroundColor || '#292A25') ? 'currentColor' : 'none'} />
                </button>
              </div>
              {favoriteColors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {favoriteColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateSlide(selectedSlideIndex, { backgroundColor: color })}
                      className="w-6 h-6 rounded-full border-2 border-border transition-transform hover:scale-110"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Cor do título</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={currentSlide.titleColor || '#ffffff'}
                  onChange={(e) => updateSlide(selectedSlideIndex, { titleColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                />
                <Input
                  value={currentSlide.titleColor || '#ffffff'}
                  onChange={(e) => updateSlide(selectedSlideIndex, { titleColor: e.target.value })}
                  className="bg-secondary border-border text-foreground text-xs flex-1"
                  placeholder="#ffffff"
                />
                <button
                  onClick={() => updateSlide(selectedSlideIndex, { titleColor: undefined })}
                  className="text-[10px] px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
                  title="Restaurar padrão"
                >
                  Padrão
                </button>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Cor do texto</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={currentSlide.textColor || '#ffffff'}
                  onChange={(e) => updateSlide(selectedSlideIndex, { textColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                />
                <Input
                  value={currentSlide.textColor || '#ffffff'}
                  onChange={(e) => updateSlide(selectedSlideIndex, { textColor: e.target.value })}
                  className="bg-secondary border-border text-foreground text-xs flex-1"
                  placeholder="#ffffff"
                />
                <button
                  onClick={() => updateSlide(selectedSlideIndex, { textColor: undefined })}
                  className="text-[10px] px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
                  title="Restaurar padrão"
                >
                  Padrão
                </button>
              </div>
            </div>

            {(currentSlide.type === 'cover' || currentSlide.type === 'cover-bottom' || currentSlide.type === 'cta') && (
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-xs">Sombra do título</Label>
                  <button
                    onClick={() => updateSlide(selectedSlideIndex, { titleShadowColor: currentSlide.titleShadowColor === '' ? undefined : '' })}
                    className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground"
                  >
                    {currentSlide.titleShadowColor === '' ? 'Ativar' : 'Desativar'}
                  </button>
                </div>
                {currentSlide.titleShadowColor !== '' && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={(currentSlide.titleShadowColor && currentSlide.titleShadowColor.startsWith('#')) ? currentSlide.titleShadowColor : '#000000'}
                      onChange={(e) => updateSlide(selectedSlideIndex, { titleShadowColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                    />
                    <Input
                      value={currentSlide.titleShadowColor || 'rgba(0,0,0,0.8)'}
                      onChange={(e) => updateSlide(selectedSlideIndex, { titleShadowColor: e.target.value })}
                      className="bg-secondary border-border text-foreground text-xs flex-1"
                      placeholder="rgba(0,0,0,0.8)"
                    />
                  </div>
                )}
                {currentSlide.titleShadowColor !== '' && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground text-[11px]">Opacidade da sombra</Label>
                      <span className="text-[11px] text-muted-foreground">{Math.round((currentSlide.titleShadowOpacity ?? 0.8) * 100)}%</span>
                    </div>
                    <Slider
                      value={[(currentSlide.titleShadowOpacity ?? 0.8) * 100]}
                      onValueChange={([v]) => updateSlide(selectedSlideIndex, { titleShadowOpacity: v / 100 })}
                      min={0} max={100} step={5}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            )}

            {(currentSlide.type === 'cover' || currentSlide.type === 'cover-bottom' || currentSlide.type === 'cta') && currentSlide.imageUrl && (
              <div>
                <Label className="text-muted-foreground text-xs">Cor da sombra da imagem</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={currentSlide.imageOverlayColor || '#000000'}
                    onChange={(e) => updateSlide(selectedSlideIndex, { imageOverlayColor: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                  />
                  <Input
                    value={currentSlide.imageOverlayColor || '#000000'}
                    onChange={(e) => updateSlide(selectedSlideIndex, { imageOverlayColor: e.target.value })}
                    className="bg-secondary border-border text-foreground text-xs flex-1"
                    placeholder="#000000"
                  />
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground text-[11px]">Opacidade da sombra</Label>
                    <span className="text-[11px] text-muted-foreground">{Math.round((currentSlide.imageOverlayOpacity ?? ((currentSlide.type === 'cover' || currentSlide.type === 'cover-bottom') ? 0 : 1)) * 100)}%</span>
                  </div>
                  <Slider
                    value={[(currentSlide.imageOverlayOpacity ?? ((currentSlide.type === 'cover' || currentSlide.type === 'cover-bottom') ? 0 : 1)) * 100]}
                    onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageOverlayOpacity: v / 100 })}
                    min={0} max={100} step={5}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {(() => {
              const defaults =
                currentSlide.type === 'cover' ? { top: 90, sides: 40, bottom: 60 } :
                currentSlide.type === 'cover-bottom' ? { top: 60, sides: 50, bottom: 120 } :
                currentSlide.type === 'cta' ? { top: 90, sides: 40, bottom: 60 } :
                currentSlide.type === 'variant-d' ? { top: 90, sides: 36, bottom: 60 } :
                { top: 80, sides: 36, bottom: 50 };
              const top = currentSlide.paddingTop ?? defaults.top;
              const bottom = currentSlide.paddingBottom ?? defaults.bottom;
              const sides = currentSlide.paddingSides ?? defaults.sides;
              return (
                <div className="space-y-3 p-3 rounded-md bg-secondary/50">
                  <Label className="text-muted-foreground text-xs font-semibold">Margens internas</Label>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground text-[11px]">Topo</Label>
                      <span className="text-[11px] text-muted-foreground">{top}px</span>
                    </div>
                    <Slider
                      value={[top]}
                      onValueChange={([v]) => updateSlide(selectedSlideIndex, { paddingTop: v })}
                      min={20} max={300} step={5}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground text-[11px]">Base</Label>
                      <span className="text-[11px] text-muted-foreground">{bottom}px</span>
                    </div>
                    <Slider
                      value={[bottom]}
                      onValueChange={([v]) => updateSlide(selectedSlideIndex, { paddingBottom: v })}
                      min={20} max={300} step={5}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground text-[11px]">Laterais</Label>
                      <span className="text-[11px] text-muted-foreground">{sides}px</span>
                    </div>
                    <Slider
                      value={[sides]}
                      onValueChange={([v]) => updateSlide(selectedSlideIndex, { paddingSides: v })}
                      min={20} max={200} step={5}
                      className="mt-1"
                    />
                  </div>
                </div>
              );
            })()}

            {currentSlide.type !== 'variant-d' && (
              <>
                <ImageUploadField
                  imageUrl={currentSlide.imageUrl}
                  onChangeUrl={(url) => updateSlide(selectedSlideIndex, { imageUrl: url })}
                />
                {currentSlide.imageUrl && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Posição da imagem</Label>
                    <div className="flex gap-1.5 mt-1">
                      {([
                        { value: 'top', label: '↑ Topo' },
                        { value: 'center', label: '⬤ Centro' },
                        { value: 'bottom', label: '↓ Base' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updateSlide(selectedSlideIndex, { imagePosition: opt.value })}
                          className={`flex-1 text-[11px] py-1.5 rounded transition-colors ${
                            (currentSlide.imagePosition || 'center') === opt.value
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {currentSlide.imageUrl && (
                  <div className="space-y-3 p-3 rounded-md bg-secondary/50">
                    <Label className="text-muted-foreground text-xs font-semibold">Ajustes da imagem</Label>

                    <div>
                      <Label className="text-muted-foreground text-[11px]">Ajuste</Label>
                      <div className="flex gap-1.5 mt-1">
                        {([
                          { value: 'cover', label: 'Preencher' },
                          { value: 'contain', label: 'Inteira' },
                        ] as const).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => updateSlide(selectedSlideIndex, { imageFit: opt.value })}
                            className={`flex-1 text-[11px] py-1.5 rounded transition-colors ${
                              (currentSlide.imageFit || 'cover') === opt.value
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground text-[11px]">Zoom</Label>
                        <span className="text-[11px] text-muted-foreground">{((currentSlide.imageZoom ?? 1) * 100).toFixed(0)}%</span>
                      </div>
                      <Slider
                        value={[(currentSlide.imageZoom ?? 1) * 100]}
                        onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageZoom: v / 100 })}
                        min={50} max={300} step={5}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground text-[11px]">Deslocar horizontal</Label>
                        <span className="text-[11px] text-muted-foreground">{currentSlide.imageOffsetX ?? 0}%</span>
                      </div>
                      <Slider
                        value={[currentSlide.imageOffsetX ?? 0]}
                        onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageOffsetX: v })}
                        min={-50} max={50} step={1}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground text-[11px]">Deslocar vertical</Label>
                        <span className="text-[11px] text-muted-foreground">{currentSlide.imageOffsetY ?? 0}%</span>
                      </div>
                      <Slider
                        value={[currentSlide.imageOffsetY ?? 0]}
                        onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageOffsetY: v })}
                        min={-50} max={50} step={1}
                        className="mt-1"
                      />
                    </div>

                    {(() => {
                      const defB = currentSlide.type === 'cover' ? 1
                        : currentSlide.type === 'cover-bottom' ? 1
                        : currentSlide.type === 'cta' ? 0.4
                        : 1;
                      const cur = currentSlide.imageBrightness ?? defB;
                      return (
                        <div>
                          <div className="flex items-center justify-between">
                            <Label className="text-muted-foreground text-[11px]">Brilho</Label>
                            <span className="text-[11px] text-muted-foreground">{Math.round(cur * 100)}%</span>
                          </div>
                          <Slider
                            value={[cur * 100]}
                            onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageBrightness: v / 100 })}
                            min={0} max={200} step={5}
                            className="mt-1"
                          />
                        </div>
                      );
                    })()}

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground text-[11px]">Contraste</Label>
                        <span className="text-[11px] text-muted-foreground">{Math.round((currentSlide.imageContrast ?? 1) * 100)}%</span>
                      </div>
                      <Slider
                        value={[(currentSlide.imageContrast ?? 1) * 100]}
                        onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageContrast: v / 100 })}
                        min={0} max={200} step={5}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground text-[11px]">Saturação</Label>
                        <span className="text-[11px] text-muted-foreground">{Math.round((currentSlide.imageSaturation ?? 1) * 100)}%</span>
                      </div>
                      <Slider
                        value={[(currentSlide.imageSaturation ?? 1) * 100]}
                        onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageSaturation: v / 100 })}
                        min={0} max={200} step={5}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground text-[11px]">Desfoque</Label>
                        <span className="text-[11px] text-muted-foreground">{currentSlide.imageBlur ?? 0}px</span>
                      </div>
                      <Slider
                        value={[currentSlide.imageBlur ?? 0]}
                        onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageBlur: v })}
                        min={0} max={20} step={1}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground text-[11px]">Rotação</Label>
                        <span className="text-[11px] text-muted-foreground">{currentSlide.imageRotation ?? 0}°</span>
                      </div>
                      <Slider
                        value={[currentSlide.imageRotation ?? 0]}
                        onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageRotation: v })}
                        min={-180} max={180} step={1}
                        className="mt-1"
                      />
                    </div>

                    {(() => {
                      const isVariant = currentSlide.type === 'variant-a' || currentSlide.type === 'variant-b' || currentSlide.type === 'variant-c';
                      const defH = isVariant ? 280 : 1350;
                      const maxH = isVariant ? 1200 : 1800;
                      const minH = isVariant ? 120 : 400;
                      const curH = currentSlide.imageHeight ?? defH;
                      return (
                        <div>
                          <div className="flex items-center justify-between">
                            <Label className="text-muted-foreground text-[11px]">Altura da imagem</Label>
                            <span className="text-[11px] text-muted-foreground">{curH}px</span>
                          </div>
                          <Slider
                            value={[curH]}
                            onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageHeight: v })}
                            min={minH} max={maxH} step={10}
                            className="mt-1"
                          />
                        </div>
                      );
                    })()}

                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground text-[11px]">Largura da imagem</Label>
                        <span className="text-[11px] text-muted-foreground">{currentSlide.imageWidth ?? 100}%</span>
                      </div>
                      <Slider
                        value={[currentSlide.imageWidth ?? 100]}
                        onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageWidth: v })}
                        min={20} max={150} step={1}
                        className="mt-1"
                      />
                    </div>

                    {(currentSlide.type === 'variant-a' || currentSlide.type === 'variant-b' || currentSlide.type === 'variant-c') && (
                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-muted-foreground text-[11px]">Bordas arredondadas</Label>
                          <span className="text-[11px] text-muted-foreground">{currentSlide.imageRadius ?? 8}px</span>
                        </div>
                        <Slider
                          value={[currentSlide.imageRadius ?? 8]}
                          onValueChange={([v]) => updateSlide(selectedSlideIndex, { imageRadius: v })}
                          min={0} max={80} step={1}
                          className="mt-1"
                        />
                      </div>
                    )}

                    <button
                      onClick={() => updateSlide(selectedSlideIndex, {
                        imageZoom: 1, imageOffsetX: 0, imageOffsetY: 0,
                        imageFit: 'cover', imageBrightness: undefined,
                        imageContrast: 1, imageSaturation: 1, imageBlur: 0,
                        imageRotation: 0, imageRadius: undefined, imageHeight: undefined, imageWidth: undefined,
                      })}
                      className="w-full text-[11px] py-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      Restaurar ajustes
                    </button>
                  </div>
                )}
              </>
            )}

            {(currentSlide.type === 'cover' || currentSlide.type === 'cover-bottom') && (
              <>
                <div>
                  <Label className="text-muted-foreground text-xs">Título (use **palavra** para destaque)</Label>
                  <Textarea
                    value={currentSlide.title || ''}
                    onChange={(e) => updateSlide(selectedSlideIndex, { title: e.target.value })}
                    className="bg-secondary border-border text-foreground min-h-[80px]"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Subtítulo</Label>
                  <Textarea
                    value={currentSlide.subtitle || ''}
                    onChange={(e) => updateSlide(selectedSlideIndex, { subtitle: e.target.value })}
                    className="bg-secondary border-border text-foreground min-h-[60px]"
                  />
                </div>
              </>
            )}

            {(currentSlide.type === 'variant-a' || currentSlide.type === 'variant-b' ||
              currentSlide.type === 'variant-c' || currentSlide.type === 'variant-d') && (
              <>
                <div>
                  <Label className="text-muted-foreground text-xs">Texto principal (use **palavra** para destaque)</Label>
                  <Textarea
                    value={currentSlide.mainText || ''}
                    onChange={(e) => updateSlide(selectedSlideIndex, { mainText: e.target.value })}
                    className="bg-secondary border-border text-foreground min-h-[100px]"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Texto secundário</Label>
                  <Textarea
                    value={currentSlide.secondaryText || ''}
                    onChange={(e) => updateSlide(selectedSlideIndex, { secondaryText: e.target.value })}
                    className="bg-secondary border-border text-foreground min-h-[60px]"
                  />
                </div>
              </>
            )}

            {currentSlide.type === 'cta' && (
              <>
                <div>
                  <Label className="text-muted-foreground text-xs">Título CTA</Label>
                  <Input
                    value={currentSlide.ctaTitle || ''}
                    onChange={(e) => updateSlide(selectedSlideIndex, { ctaTitle: e.target.value })}
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Subtítulo CTA</Label>
                  <Textarea
                    value={currentSlide.ctaSubtitle || ''}
                    onChange={(e) => updateSlide(selectedSlideIndex, { ctaSubtitle: e.target.value })}
                    className="bg-secondary border-border text-foreground min-h-[60px]"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorSidebar;
