/**
 * Avatar image processor using jimp.
 * Handles center-crop, resize to 256x256, and PNG conversion.
 */

import { Jimp } from 'jimp';
import type { Buffer } from 'node:buffer';

const AVATAR_SIZE = 256;

/**
 * Process an uploaded image into a square avatar.
 *
 * @param input - Image buffer (supports jpg, png, gif, bmp)
 * @returns PNG buffer of 256x256 centered avatar
 */
export async function processAvatar(input: Buffer): Promise<Buffer> {
  const image = await Jimp.read(input);

  const width = image.width;
  const height = image.height;

  if (!width || !height) {
    throw new Error('Invalid image: unable to read dimensions');
  }

  const size = Math.min(width, height);
  const left = Math.floor((width - size) / 2);
  const top = Math.floor((height - size) / 2);

  image.crop({ x: left, y: top, w: size, h: size });
  image.resize({ w: AVATAR_SIZE, h: AVATAR_SIZE });

  return image.getBuffer('image/png');
}
