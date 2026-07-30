import React from 'react';

interface SlideHeaderProps {
  instagramHandle: string;
  monthYear: string;
}

export const SlideHeader: React.FC<SlideHeaderProps> = () => null;

interface SlideFooterProps {
  instagramHandle: string;
  slideNumber?: number;
  totalSlides?: number;
}

export const SlideFooter: React.FC<SlideFooterProps> = () => null;

export const SlideLogo: React.FC<{ size?: number; src?: string }> = ({ size = 40, src }) => {
  if (!src) return null;
  return <img src={src} alt="Logo" style={{ width: `${size}px`, height: 'auto', opacity: 0.9 }} />;
};

