export type SlideType = 'cover' | 'cover-bottom' | 'variant-a' | 'variant-b' | 'variant-c' | 'variant-d' | 'cta';

export const AVAILABLE_FONTS = [
  { value: "'Raleway', sans-serif", label: 'Raleway' },
  { value: "'Sora', sans-serif", label: 'Sora' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Cormorant Garamond', serif", label: 'Cormorant Garamond' },
  { value: "'DM Serif Display', serif", label: 'DM Serif Display' },
  { value: "'Bebas Neue', sans-serif", label: 'Bebas Neue' },
  { value: "'Oswald', sans-serif", label: 'Oswald' },
  { value: "'Lora', serif", label: 'Lora' },
  { value: "'Merriweather', serif", label: 'Merriweather' },
  { value: "'Libre Baskerville', serif", label: 'Libre Baskerville' },
  { value: "'Source Serif 4', serif", label: 'Source Serif 4' },
  { value: "'Crimson Text', serif", label: 'Crimson Text' },
] as const;

export interface SlideData {
  id: string;
  type: SlideType;
  fontFamily?: string;
  titleFontSize?: number;
  titleFontWeight?: number;
  titleLineHeight?: number;
  textFontSize?: number;
  textFontWeight?: number;
  textLineHeight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingSides?: number;
  title?: string;
  subtitle?: string;
  mainText?: string;
  secondaryText?: string;
  ctaTitle?: string;
  ctaSubtitle?: string;
  ctaFollowText?: string;
  backgroundColor?: string;
  titleColor?: string;
  textColor?: string;
  highlightColor?: string;
  highlightGradient?: boolean;
  highlightGradientColor2?: string;
  highlightBold?: boolean;
  titleUppercase?: boolean;
  titleShadowColor?: string;
  titleShadowOpacity?: number;
  imageOverlayColor?: string;
  imageOverlayOpacity?: number;
  imageUrl?: string;
  imagePosition?: 'top' | 'center' | 'bottom';
  imageZoom?: number;
  imageFit?: 'cover' | 'contain';
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageBrightness?: number;
  imageContrast?: number;
  imageSaturation?: number;
  imageBlur?: number;
  imageRotation?: number;
  imageRadius?: number;
  imageHeight?: number;
  imageWidth?: number;
}

export interface CarouselData {
  instagramHandle: string;
  monthYear: string;
  logoSize?: number;
  logoUrl?: string;
  slides: SlideData[];
}

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

export const COLORS = {
  accentPurple: '#B078FF',
  accentGreen: '#5197b5',
  accentYellow: '#db8e1a',
  highlightBlue: '#4877f0',
  highlightGreen: '#b4ff6e',
  bgGray: '#292A25',
  bgPurple: '#B078FF',
  subtitleRed: '#db7d7d',
  white: '#ffffff',
} as const;

export function createDefaultSlide(type: SlideType, index: number): SlideData {
  void index;
  const id = crypto.randomUUID();
  switch (type) {
    case 'cover':
      return {
        id, type,
        title: 'POR QUE A **IA** ESTÁ MUDANDO TUDO E NINGUÉM TE CONTA?',
        subtitle: 'Investigamos o impacto real da inteligência artificial no mercado de trabalho',
        imageUrl: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1080&q=80',
        imageOverlayOpacity: 0,
      };
    case 'cover-bottom':
      return {
        id, type,
        title: 'Um dos maiores mitos do **Instagram** acaba de ser enterrado',
        subtitle: 'Em vídeo recente, CEO do Instagram derrubou um dos mitos mais divulgados — Leia a legenda',
        imageUrl: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1080&q=80',
        imageOverlayOpacity: 0,
      };
    case 'variant-a':
      return {
        id, type,
        mainText: 'A inteligência artificial já está **transformando** a forma como trabalhamos. Empresas que ignoram essa revolução estão ficando para trás.',
        secondaryText: 'Mais de **40%** das tarefas repetitivas já podem ser automatizadas com ferramentas acessíveis.',
        imageUrl: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1080&q=80',
      };
    case 'variant-b':
      return {
        id, type,
        mainText: 'O mercado de trabalho nunca mais será o mesmo. As profissões que conhecemos estão sendo **redesenhadas** pela inteligência artificial.',
        secondaryText: 'Quem se adaptar primeiro terá **vantagem competitiva** por anos.',
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&q=80',
      };
    case 'variant-c':
      return {
        id, type,
        mainText: 'Ferramentas como ChatGPT, Claude e Gemini estão criando uma nova categoria de **profissionais híbridos** que dominam IA.',
        secondaryText: 'A pergunta não é se a IA vai mudar sua carreira, mas **quando**.',
        imageUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1080&q=80',
      };
    case 'variant-d':
      return {
        id, type,
        mainText: 'A escala da IA criou um ativo que nenhum concorrente consegue replicar rapidamente: **dados**, **velocidade** e uma relação de confiança com milhões de usuários.',
        secondaryText: 'Esse é o ponto que separa quem lidera de quem segue.',
      };
    case 'cta':
      return {
        id, type,
        ctaTitle: 'GOSTOU? SALVE ESTE POST!',
        ctaSubtitle: 'Compartilhe com alguém que precisa entender o impacto da IA',
        ctaFollowText: 'SIGA',
        imageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1080&q=80',
      };
  }
}
