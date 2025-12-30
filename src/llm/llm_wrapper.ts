import {
  LLMProvider,
  type LLMResponse,
  type LLMStreamChunk,
  type Message,
} from "../schema/schema.js";
import { LLMClientBase } from "./base.js";
import { OpenAIClient } from "./openai_client.js";
// 假设你有 AnthropicClient
// import { AnthropicClient } from "./anthropic_client.js";
import { RetryConfig } from "../config.js";

export class LLMClient {
  public apiKey: string;
  public apiBase: string;
  public provider: string;
  public model: string;
  public retryConfig: RetryConfig;

  // 内部 client 实例，设为私有以保持封装性
  private _client: LLMClientBase;

  constructor(
    apiKey: string,
    apiBase: string,
    provider: string,
    model: string,
    retryConfig: RetryConfig
  ) {
    this.apiKey = apiKey;
    this.provider = provider;
    this.model = model;
    this.retryConfig = retryConfig;

    let fullApiBase: string = "";

    switch (provider) {
      case LLMProvider.ANTHROPIC:
        fullApiBase = `${apiBase.replace(/\/+$/, "")}/anthropic`;
        this._client = new OpenAIClient(
          apiKey,
          fullApiBase,
          model,
          retryConfig
        );
        break;

      case LLMProvider.OPENAI:
        fullApiBase = `${apiBase.replace(/\/+$/, "")}/v1`;
        this._client = new OpenAIClient(
          apiKey,
          fullApiBase,
          model,
          retryConfig
        );
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    this.apiBase = fullApiBase;
  }

  /**
   * Set retry callback.
   */
  set retryCallback(value: (error: unknown, attempt: number) => void) {
    this._client.retryCallback = value;
  }

  async generate(
    messages: Message[],
    tools?: any[] | null
  ): Promise<LLMResponse> {
    return await this._client.generate(messages, tools);
  }

  async *generateStream(
    messages: Message[],
    tools?: any[] | null
  ): AsyncGenerator<LLMStreamChunk> {
    yield* this._client.generateStream(messages, tools);
  }
}
