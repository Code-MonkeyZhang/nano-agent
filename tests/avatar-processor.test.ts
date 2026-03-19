import { describe, it, expect } from 'vitest';
import { Jimp } from 'jimp';
import { processAvatar } from '../src/lib/avatar-processor.js';

/**
 * Generate a test image buffer with given dimensions.
 */
async function createTestImage(width: number, height: number): Promise<Buffer> {
  const image = new Jimp({ width, height, color: 0x6496C8FF });
  return image.getBuffer('image/png');
}

describe('Avatar Processor', () => {
  it('should process square image to 256x256', async () => {
    const input = await createTestImage(500, 500);
    const output = await processAvatar(input);

    const result = await Jimp.read(output);
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
  });

  it('should center-crop landscape image', async () => {
    const input = await createTestImage(800, 400);
    const output = await processAvatar(input);

    const result = await Jimp.read(output);
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
  });

  it('should center-crop portrait image', async () => {
    const input = await createTestImage(300, 600);
    const output = await processAvatar(input);

    const result = await Jimp.read(output);
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
  });

  it('should upscale small image to 256x256', async () => {
    const input = await createTestImage(50, 50);
    const output = await processAvatar(input);

    const result = await Jimp.read(output);
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
  });

  it('should convert to PNG format', async () => {
    const image = new Jimp({ width: 100, height: 100, color: 0xFF0000FF });
    const input = await image.getBuffer('image/jpeg');

    const output = await processAvatar(input);
    const result = await Jimp.read(output);
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
  });
});
