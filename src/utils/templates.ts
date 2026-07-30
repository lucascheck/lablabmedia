import { CarouselData, createDefaultSlide } from '@/types/carousel';

const currentDate = new Date();
const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const defaultMonthYear = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

export const templates: { name: string; description: string; data: CarouselData }[] = [
  {
    name: 'Template 1',
    description: 'Como a IA está transformando o mercado de trabalho',
    data: {
      instagramHandle: '@99hud',
      monthYear: defaultMonthYear,
      slides: [
        { ...createDefaultSlide('cover', 0) },
        { ...createDefaultSlide('variant-a', 1) },
        { ...createDefaultSlide('variant-c', 2) },
        { ...createDefaultSlide('variant-d', 3) },
        { ...createDefaultSlide('variant-b', 4) },
        { ...createDefaultSlide('variant-a', 5) },
        { ...createDefaultSlide('cta', 6) },
      ],
    },
  },
  {
    name: 'Template 2',
    description: '5 ferramentas de IA que você precisa conhecer',
    data: {
      instagramHandle: '@99hud',
      monthYear: defaultMonthYear,
      slides: [
        { ...createDefaultSlide('cover', 0), title: '5 FERRAMENTAS DE **IA** QUE VÃO MUDAR SUA VIDA EM 2026', subtitle: 'Testamos cada uma — e o resultado vai te surpreender' },
        { ...createDefaultSlide('variant-b', 1) },
        { ...createDefaultSlide('variant-a', 2) },
        { ...createDefaultSlide('variant-d', 3) },
        { ...createDefaultSlide('variant-c', 4) },
        { ...createDefaultSlide('cta', 5) },
      ],
    },
  },
  {
    name: 'Template 3',
    description: 'Previsões sobre IA',
    data: {
      instagramHandle: '@99hud',
      monthYear: defaultMonthYear,
      slides: [
        { ...createDefaultSlide('cover-bottom', 0), title: 'O QUE A **IA** VAI FAZER NOS PRÓXIMOS 5 ANOS VAI TE CHOCAR', subtitle: 'As previsões mais impactantes dos maiores especialistas do mundo' },
        { ...createDefaultSlide('variant-a', 1) },
        { ...createDefaultSlide('variant-b', 2) },
        { ...createDefaultSlide('variant-d', 3) },
        { ...createDefaultSlide('variant-c', 4) },
        { ...createDefaultSlide('cta', 5) },
      ],
    },
  },
];

export function createEmptyCarousel(): CarouselData {
  return {
    instagramHandle: '@99hud',
    monthYear: defaultMonthYear,
    slides: [
      createDefaultSlide('cover', 0),
      createDefaultSlide('variant-a', 1),
      createDefaultSlide('variant-b', 2),
      createDefaultSlide('variant-d', 3),
      createDefaultSlide('variant-c', 4),
      createDefaultSlide('variant-a', 5),
      createDefaultSlide('cta', 6),
    ],
  };
}
