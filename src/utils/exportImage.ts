const REMOTE_IMAGE_URL_PATTERN = /^https?:\/\//i;
const PROXY_HOSTS = new Set(['images.weserv.nl', 'wsrv.nl']);

export const getExportSafeImageUrl = (src: string) => {
  if (!src || src.startsWith('data:') || src.startsWith('blob:') || !REMOTE_IMAGE_URL_PATTERN.test(src)) {
    return src;
  }

  try {
    const url = new URL(src);
    if (PROXY_HOSTS.has(url.hostname)) return src;

    return `https://images.weserv.nl/?url=${encodeURIComponent(`${url.host}${url.pathname}${url.search}`)}`;
  } catch {
    return src;
  }
};

const waitForImageLoad = (img: HTMLImageElement) => new Promise<void>((resolve, reject) => {
  if (img.complete && img.naturalWidth > 0) {
    resolve();
    return;
  }

  const handleLoad = () => { cleanup(); resolve(); };
  const handleError = () => { cleanup(); reject(new Error('Image failed to load for export')); };
  const cleanup = () => {
    img.removeEventListener('load', handleLoad);
    img.removeEventListener('error', handleError);
  };

  img.addEventListener('load', handleLoad);
  img.addEventListener('error', handleError);
});

const loadImageForExport = async (img: HTMLImageElement, src: string) => {
  img.crossOrigin = 'anonymous';
  img.referrerPolicy = 'no-referrer';
  img.decoding = 'sync';

  if (img.getAttribute('src') !== src) {
    img.setAttribute('src', src);
  }

  await waitForImageLoad(img);
  if (typeof img.decode === 'function') {
    await img.decode().catch(() => undefined);
  }
};

const extractColorFromGradient = (bgImage: string): string | null => {
  const hexMatch = bgImage.match(/#[0-9a-fA-F]{3,8}/);
  if (hexMatch) return hexMatch[0];
  const rgbMatch = bgImage.match(/rgba?\([^)]+\)/);
  if (rgbMatch) return rgbMatch[0];
  return null;
};

const fixGradientTextForExport = (container: HTMLElement) => {
  const allElements = container.querySelectorAll('*') as NodeListOf<HTMLElement>;
  allElements.forEach((el) => {
    const style = el.style;
    if (style.webkitTextFillColor === 'transparent' || style.backgroundClip === 'text') {
      const bgImage = style.backgroundImage;
      const extracted = bgImage ? extractColorFromGradient(bgImage) : null;
      const fallbackColor = extracted || (style.color && style.color !== 'transparent' ? style.color : '#B078FF');

      style.backgroundImage = 'none';
      style.webkitBackgroundClip = 'initial';
      style.backgroundClip = 'initial';
      style.webkitTextFillColor = fallbackColor;
      style.color = fallbackColor;
    }
  });
};

export const createExportNode = async (source: HTMLElement) => {
  const wrapper = document.createElement('div');
  const clone = source.cloneNode(true) as HTMLElement;

  Object.assign(wrapper.style, {
    position: 'fixed',
    left: '-20000px',
    top: '0',
    width: '1080px',
    height: '1350px',
    overflow: 'hidden',
    pointerEvents: 'none',
    opacity: '1',
    zIndex: '-1',
  });

  Object.assign(clone.style, {
    width: '1080px',
    height: '1350px',
    transform: 'none',
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  const images = Array.from(clone.querySelectorAll('img'));

  await Promise.all(images.map(async (img) => {
    const originalSrc = img.getAttribute('src') || img.currentSrc || img.src;
    if (!originalSrc) return;

    const safeSrc = getExportSafeImageUrl(originalSrc);

    try {
      await loadImageForExport(img, safeSrc);
    } catch {
      if (safeSrc !== originalSrc) {
        await loadImageForExport(img, originalSrc).catch(() => undefined);
      }
    }
  }));

  if ('fonts' in document) {
    await document.fonts.ready;
  }

  fixGradientTextForExport(clone);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  return {
    node: clone,
    cleanup: () => wrapper.remove(),
  };
};
