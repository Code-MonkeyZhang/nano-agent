import type { Response } from 'express';
import type { ChatCompletionChunk } from './types/openai-types.js';

/**
 * SSE (Server-Sent Events) 响应写入器
 *
 * 用于管理 SSE 格式的流式响应，确保正确的 HTTP 头和 OpenAI 兼容的数据格式
 */
export class SSEWriter {
  private res: Response;
  // 标记流是否已开始写入数据
  private started = false;
  // 标记响应头是否已设置
  private headersSet = false;

  constructor(res: Response) {
    this.res = res;
  }

  /**
   * 设置 SSE 相关的 HTTP 响应头
   * 只在第一次调用时设置，避免重复设置
   */
  private sendHeaders(): void {
    if (!this.headersSet) {
      // 设置 Content-Type 为 text/event-stream，这是 SSE 的标准格式
      this.res.setHeader('Content-Type', 'text/event-stream');
      // 禁用缓存，确保实时传输
      this.res.setHeader('Cache-Control', 'no-cache');
      // 保持连接，支持长连接
      this.res.setHeader('Connection', 'keep-alive');
      this.headersSet = true;
    }
  }

  /**
   * 将数据块写入流
   *
   * 数据格式化为 `data: <json>\n\n`，符合 SSE 规范
   *
   * @param chunk - 要发送的数据块，通常是 OpenAI 格式的聊天完成片段
   */
  write(chunk: ChatCompletionChunk): void {
    this.sendHeaders();
    this.started = true;
    this.res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  /**
   * 发送流结束信号并关闭响应
   *
   * 发送 `data: [DONE]\n\n` 通知客户端流已结束，然后关闭连接
   */
  done(): void {
    this.sendHeaders();
    this.res.write('data: [DONE]\n\n');
    this.res.end();
  }

  /**
   * 处理流式传输中的错误
   *
   * 根据流的当前状态选择不同的错误处理方式：
   * - 如果流已经开始，直接关闭连接
   * - 如果已设置头但未开始，直接关闭连接
   * - 如果未设置头，返回 JSON 格式的错误信息
   *
   * @param err - 发生的错误对象
   */
  error(err: Error): void {
    if (this.started) {
      // 流已开始，只能关闭连接
      this.res.end();
    } else if (this.headersSet) {
      // 头已设置但未写入数据，直接关闭
      this.res.end();
    } else {
      // 未设置头，返回 JSON 错误
      this.res.status(500).json({
        error: {
          message: err.message,
          type: 'internal_server_error',
        },
      });
    }
  }
}
