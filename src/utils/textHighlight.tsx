import React from 'react';

interface HighlightOptions {
  highlightColor?: string;
  gradient?: boolean;
  gradientColor2?: string;
  bold?: boolean;
  italic?: boolean;
}

export function renderHighlightedText(
  text: string,
  options: HighlightOptions = {}
): React.ReactNode[] {
  const { highlightColor = '#B078FF', bold = true, italic = true, gradient = false, gradientColor2 } = options;

  const lines = text.split('\n');

  return lines.flatMap((line, lineIndex) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);

    const lineNodes: React.ReactNode[] = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        const gradientStyle: React.CSSProperties = gradient ? {
          backgroundImage: `linear-gradient(90deg, ${highlightColor}, ${gradientColor2 || '#FF78B0'})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          color: 'transparent',
          display: 'inline-block',
          textShadow: 'none',
        } : {};
        return (
          <span
            key={`${lineIndex}-${i}`}
            style={{
              ...(gradient ? {} : { color: highlightColor }),
              fontWeight: bold ? 700 : undefined,
              fontStyle: italic ? 'italic' : undefined,
              ...gradientStyle,
            }}
          >
            {inner}
          </span>
        );
      }
      return <React.Fragment key={`${lineIndex}-${i}`}>{part}</React.Fragment>;
    });

    if (lineIndex < lines.length - 1) {
      lineNodes.push(<br key={`br-${lineIndex}`} />);
    }

    return lineNodes;
  });
}
