// HEIC/HEIF -> JPEG conversion helper.
// Browsers don't natively decode HEIC, so we convert to a JPEG File before
// passing it to FileReader / canvas / uploads.

const HEIC_EXT = /\.(heic|heif)$/i;
const HEIC_MIME = /image\/(heic|heif)/i;

export function isHeic(file: File): boolean {
  return HEIC_MIME.test(file.type) || HEIC_EXT.test(file.name);
}

export async function ensureRenderableImage(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(out) ? out[0] : out;
  const newName = file.name.replace(HEIC_EXT, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
}
