import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SSEWriter } from '../../src/server/streaming/sse-writer.js';
import type { Response } from 'express';

describe('SSEWriter', () => {
  let mockRes: Partial<Response>;
  let writer: SSEWriter;

  // Setup: Create a mock Express Response object before each test
  beforeEach(() => {
    mockRes = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    writer = new SSEWriter(mockRes as Response);
  });

  // Test that correct SSE headers are set when first data is written
  it('should set correct headers on initialization', () => {
    const chunk: any = {
      id: '1',
      object: 'chat.completion.chunk',
      created: 123,
      model: 'test',
      choices: [],
    };
    writer.write(chunk);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream'
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
  });

  // Test that data is formatted correctly as SSE format: "data: {json}\n\n"
  it('should format data correctly', () => {
    const chunk: any = { id: '1', choices: [] };
    writer.write(chunk);

    expect(mockRes.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify(chunk)}\n\n`
    );
  });

  // Test that the completion sends "[DONE]" and ends the response
  it('should write [DONE] on completion', () => {
    writer.done();

    expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(mockRes.end).toHaveBeenCalled();
  });
});
