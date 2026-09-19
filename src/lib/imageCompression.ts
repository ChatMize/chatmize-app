/**
 * Client side image compression. Loaded lazily (dynamic import) so it never
 * lands in the initial page bundle. Keeps uploads fast and storage cheap.
 */

export interface CompressedImage {
  blob: Blob;
  extension: string;
  width: number;
  height: number;
}

/** Longest edge after compression. Big enough for retina displays, small enough to stay cheap. */
export const MAX_EDGE_PX = 1600;
/** Quality for lossy output. 0.8 is visually near lossless for photos. */
export const OUTPUT_QUALITY = 0.8;
/** Raw file cap before compression. Rejects absurd files early. */
export const MAX_RAW_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/** Returns a plain English error, or null when the file is fine. */
export function validateImageFile(file: File): string | null {
  const typeOk = ACCEPTED_IMAGE_TYPES.includes(file.type);
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!typeOk && !ACCEPTED_EXTENSIONS.includes(ext)) {
    return 'That file is not an image. Please choose a JPG, PNG, GIF or WebP file.';
  }
  if (file.size > MAX_RAW_BYTES) {
    return 'That image is too large. Please choose a file under 10 MB.';
  }
  return null;
}

function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}

/**
 * Compress an image file. GIFs pass through untouched so animation survives.
 * Everything else is downscaled to MAX_EDGE_PX and re-encoded as WebP
 * (JPEG fallback on very old browsers).
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (file.type === 'image/gif') {
    const dims = await readDimensions(file);
    return { blob: file, extension: 'gif', width: dims.width, height: dims.height };
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Could not read that image. Please try a different file.');
  });
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Image processing is not available in this browser.');
    }

    const toBlob = (type: string, quality: number): Promise<Blob | null> =>
      new Promise((resolve) => canvas.toBlob(resolve, type, quality));

    // Draw once. Prefer WebP (keeps transparency, smallest files).
    ctx.drawImage(bitmap, 0, 0, width, height);
    let blob = await toBlob('image/webp', OUTPUT_QUALITY);
    let extension = 'webp';
    if (!blob) {
      // Very old browsers: JPEG fallback. White background so transparent
      // PNGs do not come out black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await toBlob('image/jpeg', OUTPUT_QUALITY);
      extension = 'jpg';
    }
    if (!blob) {
      throw new Error('Could not process that image. Please try a different file.');
    }
    return { blob, extension, width, height };
  } finally {
    bitmap.close();
  }
}
