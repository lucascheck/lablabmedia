import React from 'react';
import { SlideData, SLIDE_WIDTH, SLIDE_HEIGHT, COLORS } from '@/types/carousel';
import { renderHighlightedText } from '@/utils/textHighlight';
import { SlideFooter, SlideLogo } from './SlideHeaderFooter';

const hlOpts = (slide: SlideData, defaults: { color?: string; italic?: boolean } = {}) => ({
  highlightColor: slide.highlightColor || defaults.color || '#B078FF',
  bold: slide.highlightBold ?? true,
  italic: defaults.italic ?? false,
  gradient: slide.highlightGradient ?? false,
  gradientColor2: slide.highlightGradientColor2,
});

const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const imageOverlay = (slide: SlideData, stops: Array<[number, string]>): string => {
  const base = slide.imageOverlayColor || '#000000';
  const defaultOpacity = (slide.type === 'cover' || slide.type === 'cover-bottom') ? 0 : 1;
  const mult = slide.imageOverlayOpacity ?? defaultOpacity;
  const parts = stops.map(([pct, alpha]) => `${hexToRgba(base, Math.max(0, Math.min(1, parseFloat(alpha) * mult)))} ${pct}%`);
  return `linear-gradient(180deg, ${parts.join(', ')})`;
};

const buildImageFilter = (slide: SlideData, defaultBrightness: number): string => {
  const brightness = slide.imageBrightness ?? defaultBrightness;
  const contrast = slide.imageContrast ?? 1;
  const saturate = slide.imageSaturation ?? 1;
  const blur = slide.imageBlur ?? 0;
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) blur(${blur}px)`;
};

const bgImageStyle = (slide: SlideData, defaultBrightness: number): React.CSSProperties => {
  const zoom = slide.imageZoom ?? 1;
  const offX = slide.imageOffsetX ?? 0;
  const offY = slide.imageOffsetY ?? 0;
  const rot = slide.imageRotation ?? 0;
  const fit = slide.imageFit ?? 'cover';
  const objectPosition = slide.imagePosition === 'top' ? 'center top'
    : slide.imagePosition === 'bottom' ? 'center bottom'
    : 'center center';
  const customH = slide.imageHeight;
  const customW = slide.imageWidth;
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: customW ? `${customW}%` : '100%',
    height: customH ? `${customH}px` : '100%',
    objectFit: fit,
    objectPosition,
    transform: `translate(${offX}%, ${offY}%) scale(${zoom}) rotate(${rot}deg)`,
    transformOrigin: 'center center',
    filter: buildImageFilter(slide, defaultBrightness),
  };
};

const titleShadow = (slide: SlideData): string => {
  const c = slide.titleShadowColor;
  if (c === '') return 'none';
  const opacity = slide.titleShadowOpacity ?? 0.8;
  let color: string;
  if (!c) {
    color = `rgba(0, 0, 0, ${opacity})`;
  } else if (c.startsWith('#')) {
    color = hexToRgba(c, opacity);
  } else if (c.startsWith('rgb')) {
    const nums = c.match(/[\d.]+/g);
    if (nums && nums.length >= 3) {
      color = `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${opacity})`;
    } else {
      color = c;
    }
  } else {
    color = c;
  }
  return `2px 2px 8px ${color}`;
};

const titleColorOf = (slide: SlideData, fallback = '#ffffff'): string =>
  slide.titleColor || fallback;

const textColorOf = (slide: SlideData, fallbackAlpha = 0.85): string => {
  if (slide.textColor) {
    if (slide.textColor.startsWith('#')) return hexToRgba(slide.textColor, fallbackAlpha);
    return slide.textColor;
  }
  return `rgba(255,255,255,${fallbackAlpha})`;
};

const titleLH = (slide: SlideData, fallback: number): number => slide.titleLineHeight ?? fallback;
const textLH = (slide: SlideData, fallback: number): number => slide.textLineHeight ?? fallback;

const slidePadding = (
  slide: SlideData,
  defaults: { top: number; sides: number; bottom: number },
): string => {
  const top = slide.paddingTop ?? defaults.top;
  const sides = slide.paddingSides ?? defaults.sides;
  const bottom = slide.paddingBottom ?? defaults.bottom;
  return `${top}px ${sides}px ${bottom}px`;
};


interface SlideRendererProps {
  slide: SlideData;
  slideIndex: number;
  totalContentSlides: number;
  instagramHandle: string;
  monthYear: string;
  logoSize?: number;
  logoUrl?: string;
  scale?: number;
}

const CoverSlide: React.FC<SlideRendererProps> = ({ slide, instagramHandle, logoSize, logoUrl }) => (
  <div style={{
    width: SLIDE_WIDTH, height: SLIDE_HEIGHT, position: 'relative', overflow: 'hidden',
    fontFamily: slide.fontFamily || "'Sora', sans-serif",
  }}>
    {slide.imageUrl && (
      <img src={slide.imageUrl} alt="" style={bgImageStyle(slide, 1)} />
    )}
    <div style={{ position: 'absolute', inset: 0, background: imageOverlay(slide, [[0, '1'], [100, '1']]) }} />
    <div style={{
      position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center', height: '100%',
      padding: `${slide.paddingTop ?? 90}px ${slide.paddingSides ?? 40}px ${slide.paddingBottom ?? 60}px`,
      textAlign: 'center',
    }}>
      <div style={{ marginBottom: '40px' }}>
        <SlideLogo size={logoSize} src={logoUrl} />
      </div>

      <h1 style={{
        fontSize: `${slide.titleFontSize || 58}px`, fontWeight: slide.titleFontWeight ?? 900, color: titleColorOf(slide), lineHeight: titleLH(slide, 1.1),
        textTransform: (slide.titleUppercase ?? true) ? 'uppercase' as const : 'none' as const, textShadow: titleShadow(slide),
        marginBottom: '30px', maxWidth: '900px',
      }}>
        {renderHighlightedText(slide.title || '', hlOpts(slide, { color: COLORS.accentPurple }))}
      </h1>

      <p style={{
        fontSize: `${slide.textFontSize || 24}px`, fontWeight: slide.textFontWeight ?? 500, color: textColorOf(slide, 0.85),
        lineHeight: textLH(slide, 1.4), textShadow: titleShadow(slide), maxWidth: '800px',
      }}>
        {slide.subtitle}
      </p>
    </div>

    <SlideFooter instagramHandle={instagramHandle} />
  </div>
);

const CoverBottomSlide: React.FC<SlideRendererProps> = ({ slide, instagramHandle, logoSize, logoUrl }) => (
  <div style={{
    width: SLIDE_WIDTH, height: SLIDE_HEIGHT, position: 'relative', overflow: 'hidden',
    fontFamily: slide.fontFamily || "'Sora', sans-serif",
  }}>
    {slide.imageUrl && (
      <img src={slide.imageUrl} alt="" style={bgImageStyle(slide, 1)} />
    )}
    <div style={{ position: 'absolute', inset: 0, background: imageOverlay(slide, [[0, '1'], [70, '1'], [100, '1']]) }} />
    <div style={{
      position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end', height: '100%',
      padding: `${slide.paddingTop ?? 60}px ${slide.paddingSides ?? 50}px ${slide.paddingBottom ?? 120}px`,
    }}>
      <div style={{ marginBottom: '24px' }}>
        <SlideLogo size={logoSize} src={logoUrl} />
      </div>

      <h1 style={{
        fontSize: `${slide.titleFontSize || 54}px`, fontWeight: slide.titleFontWeight ?? 900, color: titleColorOf(slide), lineHeight: titleLH(slide, 1.1),
        textTransform: (slide.titleUppercase ?? false) ? 'uppercase' as const : 'none' as const, textShadow: titleShadow(slide),
        marginBottom: '20px', maxWidth: '950px',
      }}>
        {renderHighlightedText(slide.title || '', hlOpts(slide, { color: COLORS.accentPurple }))}
      </h1>

      <p style={{
        fontSize: `${slide.textFontSize || 22}px`, fontWeight: slide.textFontWeight ?? 400, color: textColorOf(slide, 0.75),
        lineHeight: textLH(slide, 1.4), textShadow: titleShadow(slide), maxWidth: '850px',
      }}>
        {slide.subtitle}
      </p>
    </div>
    <SlideFooter instagramHandle={instagramHandle} />
  </div>
);

const ContentImage: React.FC<{ slide: SlideData }> = ({ slide }) => {
  if (!slide.imageUrl) return null;
  const zoom = slide.imageZoom ?? 1;
  const offX = slide.imageOffsetX ?? 0;
  const offY = slide.imageOffsetY ?? 0;
  const rot = slide.imageRotation ?? 0;
  const fit = slide.imageFit ?? 'cover';
  const radius = slide.imageRadius ?? 8;
  const height = slide.imageHeight ?? 280;
  const objectPosition = slide.imagePosition === 'top' ? 'center top'
    : slide.imagePosition === 'bottom' ? 'center bottom'
    : 'center center';
  return (
    <div style={{ width: '100%', height: `${height}px`, overflow: 'hidden', borderRadius: `${radius}px` }}>
      <img src={slide.imageUrl} alt="" style={{
        width: '100%', height: '100%', objectFit: fit, objectPosition,
        transform: `translate(${offX}%, ${offY}%) scale(${zoom}) rotate(${rot}deg)`,
        transformOrigin: 'center center',
        filter: buildImageFilter(slide, 1),
      }} />
    </div>
  );
};

const VariantASlide: React.FC<SlideRendererProps> = ({ slide, slideIndex, totalContentSlides, instagramHandle, logoSize, logoUrl }) => (
  <div style={{
    width: SLIDE_WIDTH, height: SLIDE_HEIGHT, position: 'relative', overflow: 'hidden',
    backgroundColor: slide.backgroundColor || COLORS.bgGray, fontFamily: slide.fontFamily || "'Sora', sans-serif",
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: slidePadding(slide, { top: 80, sides: 36, bottom: 50 }), gap: '20px' }}>
      <div><SlideLogo size={logoSize} src={logoUrl} /></div>
      <p style={{ fontSize: `${slide.titleFontSize || 38}px`, fontWeight: slide.titleFontWeight ?? 500, color: titleColorOf(slide), lineHeight: titleLH(slide, 1.5) }}>
        {renderHighlightedText(slide.mainText || '', hlOpts(slide))}
      </p>
      <ContentImage slide={slide} />
      <p style={{ fontSize: `${slide.textFontSize || 28}px`, fontWeight: slide.textFontWeight ?? 400, color: textColorOf(slide, 0.85), lineHeight: textLH(slide, 1.5) }}>
        {renderHighlightedText(slide.secondaryText || '', hlOpts(slide))}
      </p>
    </div>
    <SlideFooter instagramHandle={instagramHandle} slideNumber={slideIndex} totalSlides={totalContentSlides} />
  </div>
);

const VariantBSlide: React.FC<SlideRendererProps> = ({ slide, slideIndex, totalContentSlides, instagramHandle, logoSize, logoUrl }) => (
  <div style={{
    width: SLIDE_WIDTH, height: SLIDE_HEIGHT, position: 'relative', overflow: 'hidden',
    backgroundColor: slide.backgroundColor || COLORS.bgGray, fontFamily: slide.fontFamily || "'Sora', sans-serif",
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: slidePadding(slide, { top: 80, sides: 36, bottom: 50 }), gap: '20px' }}>
      <div><SlideLogo size={logoSize} src={logoUrl} /></div>
      <div>
        <p style={{ fontSize: `${slide.titleFontSize || 38}px`, fontWeight: slide.titleFontWeight ?? 500, color: titleColorOf(slide), lineHeight: titleLH(slide, 1.5), marginBottom: '24px' }}>
          {renderHighlightedText(slide.mainText || '', hlOpts(slide))}
        </p>
        <p style={{ fontSize: `${slide.textFontSize || 28}px`, fontWeight: slide.textFontWeight ?? 700, color: textColorOf(slide, 0.85), lineHeight: textLH(slide, 1.5) }}>
          {renderHighlightedText(slide.secondaryText || '', hlOpts(slide))}
        </p>
      </div>
      <ContentImage slide={slide} />
    </div>
    <SlideFooter instagramHandle={instagramHandle} slideNumber={slideIndex} totalSlides={totalContentSlides} />
  </div>
);

const VariantCSlide: React.FC<SlideRendererProps> = ({ slide, slideIndex, totalContentSlides, instagramHandle, logoSize, logoUrl }) => (
  <div style={{
    width: SLIDE_WIDTH, height: SLIDE_HEIGHT, position: 'relative', overflow: 'hidden',
    backgroundColor: slide.backgroundColor || COLORS.bgGray, fontFamily: slide.fontFamily || "'Sora', sans-serif",
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: slidePadding(slide, { top: 80, sides: 36, bottom: 50 }), gap: '20px' }}>
      <div><SlideLogo size={logoSize} src={logoUrl} /></div>
      <ContentImage slide={slide} />
      <div>
        <p style={{ fontSize: `${slide.titleFontSize || 38}px`, fontWeight: slide.titleFontWeight ?? 500, color: titleColorOf(slide), lineHeight: titleLH(slide, 1.5), marginBottom: '24px' }}>
          {renderHighlightedText(slide.mainText || '', hlOpts(slide))}
        </p>
        <p style={{ fontSize: `${slide.textFontSize || 28}px`, fontWeight: slide.textFontWeight ?? 400, color: textColorOf(slide, 0.85), lineHeight: textLH(slide, 1.5) }}>
          {renderHighlightedText(slide.secondaryText || '', hlOpts(slide))}
        </p>
      </div>
    </div>
    <SlideFooter instagramHandle={instagramHandle} slideNumber={slideIndex} totalSlides={totalContentSlides} />
  </div>
);

const VariantDSlide: React.FC<SlideRendererProps> = ({ slide, slideIndex, totalContentSlides, instagramHandle, logoSize, logoUrl }) => (
  <div style={{
    width: SLIDE_WIDTH, height: SLIDE_HEIGHT, position: 'relative', overflow: 'hidden',
    backgroundColor: slide.backgroundColor || COLORS.bgPurple, fontFamily: slide.fontFamily || "'Sora', sans-serif",
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: slidePadding(slide, { top: 90, sides: 36, bottom: 60 }) }}>
      <div style={{ marginBottom: '20px' }}><SlideLogo size={logoSize} src={logoUrl} /></div>
      <p style={{ fontSize: `${slide.titleFontSize || 42}px`, fontWeight: slide.titleFontWeight ?? 600, color: titleColorOf(slide), lineHeight: titleLH(slide, 1.5), marginBottom: '30px' }}>
        {renderHighlightedText(slide.mainText || '', hlOpts(slide, { color: titleColorOf(slide), italic: true }))}
      </p>
      {slide.secondaryText && (
        <p style={{ fontSize: `${slide.textFontSize || 30}px`, fontWeight: slide.textFontWeight ?? 400, color: textColorOf(slide, 0.9), lineHeight: textLH(slide, 1.5) }}>
          {slide.secondaryText}
        </p>
      )}
    </div>
    <SlideFooter instagramHandle={instagramHandle} slideNumber={slideIndex} totalSlides={totalContentSlides} />
  </div>
);

const CTASlide: React.FC<SlideRendererProps> = ({ slide, slideIndex, totalContentSlides, instagramHandle, logoSize, logoUrl }) => (
  <div style={{
    width: SLIDE_WIDTH, height: SLIDE_HEIGHT, position: 'relative', overflow: 'hidden',
    fontFamily: slide.fontFamily || "'Sora', sans-serif",
  }}>
    {slide.imageUrl && (
      <img src={slide.imageUrl} alt="" style={bgImageStyle(slide, 0.4)} />
    )}
    <div style={{ position: 'absolute', inset: 0, background: imageOverlay(slide, [[0, '0.3'], [100, '0.7']]) }} />
    <div style={{
      position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center', height: '100%', padding: slidePadding(slide, { top: 90, sides: 40, bottom: 60 }),
      textAlign: 'center',
    }}>
      <div style={{ marginBottom: '30px' }}>
        <SlideLogo size={logoSize} src={logoUrl} />
      </div>

      <h2 style={{
        fontSize: `${slide.titleFontSize || 52}px`, fontWeight: slide.titleFontWeight ?? 900, color: titleColorOf(slide),
        textTransform: (slide.titleUppercase ?? true) ? 'uppercase' as const : 'none' as const,
        textShadow: titleShadow(slide), marginBottom: '20px', lineHeight: titleLH(slide, 1.15),
      }}>
        {slide.ctaTitle}
      </h2>

      <p style={{
        fontSize: `${slide.textFontSize || 24}px`, fontWeight: slide.textFontWeight ?? 500, color: textColorOf(slide, 0.85),
        textShadow: titleShadow(slide), marginBottom: '50px', maxWidth: '800px', lineHeight: textLH(slide, 1.4),
      }}>
        {slide.ctaSubtitle}
      </p>

      <div style={{ display: 'flex', gap: '40px', marginBottom: '50px' }}>
        {[
          { label: 'SALVAR', icon: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' },
          { label: 'ENVIAR', icon: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z' },
          { label: 'CURTIR', icon: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
        ].map((action) => (
          <div key={action.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={action.icon} />
            </svg>
            <span style={{ color: titleColorOf(slide), fontSize: '14px', fontWeight: 700, letterSpacing: '1px' }}>{action.label}</span>
          </div>
        ))}
      </div>
    </div>
    <SlideFooter instagramHandle={instagramHandle} slideNumber={slideIndex} totalSlides={totalContentSlides} />
  </div>
);

const SlideRenderer: React.FC<SlideRendererProps> = (props) => {
  switch (props.slide.type) {
    case 'cover': return <CoverSlide {...props} />;
    case 'cover-bottom': return <CoverBottomSlide {...props} />;
    case 'variant-a': return <VariantASlide {...props} />;
    case 'variant-b': return <VariantBSlide {...props} />;
    case 'variant-c': return <VariantCSlide {...props} />;
    case 'variant-d': return <VariantDSlide {...props} />;
    case 'cta': return <CTASlide {...props} />;
    default: return null;
  }
};

export default SlideRenderer;
