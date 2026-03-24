/**
 * @fileoverview HTTP routes for chat operations.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SessionManagersMap } from './agent.js';
import { processChat } from '../services/chat-service.js';
import { Logger } from '../../util/logger.js';
import { getParam } from './utils.js';

export function createChatRouter(sessionManagers: SessionManagersMap): Router {
  const router = Router({ mergeParams: true });

  /**
   * POST /api/agents/:agentId/sessions/:sessionId/chat
   *
   * 接口输入:
   * - 路径参数 (URL):
   *   - agentId: Agent 标识符
   *   - sessionId: Session标识符
   *
   * - 请求体 (JSON):
   *   - content: 用户消息内容 (字符串)
   *
   * 示例:
   * - URL: POST /api/agents/my-agent/sessions/session-123/chat
   * - Body: { "content": "你好，请帮我写一段代码" }
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const agentId = getParam(req.params['agentId']);
      const sessionId = getParam(req.params['sessionId']);
      // 参数校验
      if (!agentId) {
        res.status(400).json({ success: false, error: 'Agent ID is required' });
        return;
      }

      if (!sessionId) {
        res
          .status(400)
          .json({ success: false, error: 'Session ID is required' });
        return;
      }

      const { content } = req.body as { content?: unknown };
      // 验证接受的信息是字符串 TODO: 如果要支持多模态, 这个东西必须改掉
      if (!content || typeof content !== 'string') {
        res.status(400).json({ success: false, error: 'Content is required' });
        return;
      }

      const sessionManager = sessionManagers.get(agentId);
      if (!sessionManager) {
        res.status(404).json({
          success: false,
          error: `Session manager not found for agent: ${agentId}`,
        });
        return;
      }

      Logger.log(
        'CHAT',
        `Processing chat for agent: ${agentId}, session: ${sessionId}`
      );

      const result = await processChat({
        agentId,
        sessionId,
        content,
        sessionManager,
      });

      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      Logger.log('CHAT', 'Error processing chat', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
