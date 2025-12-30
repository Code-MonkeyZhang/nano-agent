import { describe, it, expect, vi, beforeEach } from 'vitest';
import { asyncRetry, RetryConfig, RetryExhaustedError } from '../src/retry';

describe('Retry Mechanism', () => {
  // 每次测试前重置所有的 mock
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return result immediately if function succeeds first time', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    const config = new RetryConfig({ maxRetries: 3 });

    const result = await asyncRetry(async () => mockFn(), config);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    // 配置较短的延迟以便测试运行更快
    const config = new RetryConfig({ 
      maxRetries: 3, 
      initialDelay: 0.01 // 10ms
    });

    const result = await asyncRetry(async () => mockFn(), config);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3); // 1次初始 + 2次重试
  });

  it('should throw RetryExhaustedError when max retries reached', async () => {
    const error = new Error('persistent fail');
    const mockFn = vi.fn().mockRejectedValue(error);
    
    const config = new RetryConfig({ 
      maxRetries: 2,
      initialDelay: 0.01
    });

    // 验证是否抛出了特定类型的错误
    await expect(asyncRetry(async () => mockFn(), config)).rejects.toThrow(RetryExhaustedError);
    
    // 验证调用次数：1次初始 + 2次重试 = 3次总调用
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should trigger onRetry callback', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('fail'));
    const onRetry = vi.fn();
    
    const config = new RetryConfig({ 
      maxRetries: 2,
      initialDelay: 0.01
    });

    try {
      await asyncRetry(async () => mockFn(), config, onRetry);
    } catch (e) {
      // 忽略最终的错误
    }

    // 验证回调是否被调用了2次
    expect(onRetry).toHaveBeenCalledTimes(2);
    // 验证回调参数：第一次重试是 attempt 1
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1);
    // 第二次重试是 attempt 2
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2);
  });

  // 注意：enabled 标志的检查应该在调用方（如 OpenAIClient.generate()）中进行，
  // 而不是在 asyncRetry 函数内部。asyncRetry 假设被调用时就需要重试。
});

