/**
 * Avatar image processor using sharp.
 * Handles center-crop, resize to 256x256, and PNG conversion.
 */

import sharp from 'sharp';
import type { Buffer } from 'node:buffer';

const AVATAR_SIZE = 256;

/**
 * Process an uploaded image into a square avatar.
 *
 * @param input - Image buffer (supports jpg, png, gif, webp)
 * @returns PNG buffer of 256x256 centered avatar
 */
export async function processAvatar(input: Buffer): Promise<Buffer> {
  const image = sharp(input);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image: unable to read dimensions');
  }

  const size = Math.min(metadata.width, metadata.height);
  const left = Math.floor((metadata.width - size) / 2);
  const top = Math.floor((metadata.height - size) / 2);

  return image
    .extract({ left, top, width: size, height: size })
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
    .png()
    .toBuffer();
}
