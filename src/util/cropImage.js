/**
 * Turns a user's crop selection into a new image file, ready to be uploaded.
 *
 * The crop rectangle comes from react-easy-crop in *source image* pixels, so the
 * work here is a single canvas draw: copy that rectangle out of the original and
 * export it as a new file.
 */

// Anything larger than this on the longest edge gets scaled down on the way out.
// Phone cameras produce 4000px+ images, and the listing variants are a fraction
// of that - keeping the full resolution only costs the seller upload time.
const MAX_OUTPUT_DIMENSION = 2400;

// PNG is kept as PNG so transparency survives; everything else becomes JPEG,
// which is what the source almost always is anyway.
const PNG_MIME = 'image/png';
const JPEG_MIME = 'image/jpeg';
const JPEG_QUALITY = 0.9;

const outputMimeType = file => (file?.type === PNG_MIME ? PNG_MIME : JPEG_MIME);

// Swaps the extension so the name still matches the bytes (photo.heic -> photo.jpg).
const outputFileName = (file, mimeType) => {
  const name = file?.name || 'image';
  const base = name.replace(/\.[^.]+$/, '');
  const extension = mimeType === PNG_MIME ? 'png' : 'jpg';
  return `${base}.${extension}`;
};

/**
 * Loads a File into an <img>. Modern browsers apply EXIF orientation while
 * decoding, so what's drawn to the canvas matches what the user cropped.
 *
 * @param {File} file
 * @returns {Promise<{image: HTMLImageElement, revoke: Function}>}
 */
export const loadImageFromFile = file =>
  new Promise((resolve, reject) => {
    const objectUrl = window.URL.createObjectURL(file);
    const revoke = () => window.URL.revokeObjectURL(objectUrl);
    const image = new window.Image();

    image.onload = () => resolve({ image, revoke });
    image.onerror = () => {
      revoke();
      reject(new Error(`Could not read image: ${file?.name}`));
    };
    image.src = objectUrl;
  });

/**
 * Crops a file to the given rectangle and returns it as a new File.
 *
 * @param {File} file the originally selected file
 * @param {Object} cropArea {x, y, width, height} in source image pixels
 * @returns {Promise<File>} the cropped file, named after the original
 */
export const getCroppedFile = (file, cropArea) => {
  if (!cropArea || !(cropArea.width > 0) || !(cropArea.height > 0)) {
    return Promise.reject(new Error('Invalid crop area'));
  }

  return loadImageFromFile(file).then(({ image, revoke }) => {
    try {
      // react-easy-crop can hand back a rectangle that pokes a pixel or two outside
      // the source, which would draw transparent edges. Clamp it to the image.
      const sourceX = Math.max(0, Math.round(cropArea.x));
      const sourceY = Math.max(0, Math.round(cropArea.y));
      const sourceWidth = Math.min(Math.round(cropArea.width), image.naturalWidth - sourceX);
      const sourceHeight = Math.min(Math.round(cropArea.height), image.naturalHeight - sourceY);

      if (sourceWidth <= 0 || sourceHeight <= 0) {
        throw new Error('Crop area falls outside the image');
      }

      // Only ever scale down - upscaling a crop adds bytes without adding detail.
      const scale = Math.min(1, MAX_OUTPUT_DIMENSION / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get a 2d canvas context');
      }

      // JPEG has no alpha, so anything transparent would render black without this.
      const mimeType = outputMimeType(file);
      if (mimeType === JPEG_MIME) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          blob => {
            revoke();
            if (!blob) {
              reject(new Error('Could not encode the cropped image'));
              return;
            }
            resolve(
              new File([blob], outputFileName(file, mimeType), {
                type: mimeType,
                lastModified: Date.now(),
              })
            );
          },
          mimeType,
          mimeType === JPEG_MIME ? JPEG_QUALITY : undefined
        );
      });
    } catch (e) {
      revoke();
      throw e;
    }
  });
};
