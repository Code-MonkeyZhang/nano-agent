import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { processAvatar } from '../src/lib/avatar-processor.js';

/**
 * Generate a test image buffer with given dimensions.
 */
async function createTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 100, g: 150, b: 200, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe('Avatar Processor', () => {
  it('should process square image to 256x256', async () => {
    const input = await createTestImage(500, 500);
    const output = await processAvatar(input);

    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
    expect(metadata.format).toBe('png');
  });

  it('should center-crop landscape image', async () => {
    const input = await createTestImage(800, 400);
    const output = await processAvatar(input);

    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
  });

  it('should center-crop portrait image', async () => {
    const input = await createTestImage(300, 600);
    const output = await processAvatar(input);

    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
  });

  it('should upscale small image to 256x256', async () => {
    const input = await createTestImage(50, 50);
    const output = await processAvatar(input);

    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
  });

  it('should convert to PNG format', async () => {
    const input = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    const output = await processAvatar(input);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe('png');
  });
});
