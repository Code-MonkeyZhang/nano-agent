/**
 * Test script to verify thinking vs content through agent.runStream()
 * Usage: npx tsx tests/thinking-test.ts
 */

import { stream, getModel } from '@mariozechner/pi-ai'

async function testPiAi() {
  const provider = 'zai'
  const modelId = 'glm-4.6'
  const apiKey = 'c8c8f2e0918d4ab8acc8768ebb03cae2.t5Jz5KXBxR8sPd3H'

  const model = getModel(provider, modelId as any)
  if (!model) {
    console.error(`Model not found: ${provider}/${modelId}`)
    return
  }

  console.log('=== Test 1: Direct pi-ai stream ===')
  console.log(`Model: ${model.id} (${model.provider})`)
  console.log('Message: "你好，请简短回复"')
  console.log('---')

  const context = {
    messages: [
      { role: 'system', content: '你是一个友好的助手，请简短回复。' },
      { role: 'user', content: '你好，请简短回复' },
    ],
    tools: [],
  }

  const eventStream = stream(model, context, { apiKey })

  let thinkingContent = ''
  let textContent = ''

  for await (const event of eventStream) {
    if (event.type === 'thinking_delta') {
      thinkingContent += event.delta
    } else if (event.type === 'text_delta') {
      textContent += event.delta
    }
  }

  console.log('=== Result ===')
  console.log(`Thinking length: ${thinkingContent.length}`)
  console.log(`Text length: ${textContent.length}`)
  console.log('\nThinking:')
  console.log(thinkingContent || '(empty)')
  console.log('\nText:')
  console.log(textContent || '(empty)')
  console.log('\n')
}

async function testAgent() {
  console.log('=== Test 2: Through AgentCore.runStream() ===')

  // Dynamic import to use the compiled agent
  const { AgentCore } = await import('../dist/src/agent.js')
  const { getModel } = await import('@mariozechner/pi-ai')

  const model = getModel('zai', 'glm-4.6' as any)
  const apiKey = 'c8c8f2e0918d4ab8acc8768ebb03cae2.t5Jz5KXBxR8sPd3H'

  const runConfig = {
    agentName: 'test',
    provider: 'zai',
    modelId: 'glm-4.6',
    model: model!,
    apiKey,
    baseSystemPrompt: '你是一个友好的助手，请简短回复。',
    skills: [],
    mcpServerNames: [],
    maxSteps: 1,
    tools: [],
    retry: { maxRetries: 0, baseDelayMs: 1000 },
  }

  const agent = new AgentCore(runConfig, process.cwd())
  agent.addUserMessage('你好，请简短回复')

  let thinkingContent = ''
  let textContent = ''

  for await (const event of agent.runStream()) {
    if (event.type === 'thinking') {
      thinkingContent += event.content
    } else if (event.type === 'content') {
      textContent += event.content
    } else {
      console.log(`[Event: ${event.type}]`)
    }
  }

  console.log('=== Result ===')
  console.log(`Thinking length: ${thinkingContent.length}`)
  console.log(`Text length: ${textContent.length}`)
  console.log('\nThinking:')
  console.log(thinkingContent || '(empty)')
  console.log('\nText:')
  console.log(textContent || '(empty)')
}

async function main() {
  await testPiAi()
  // await testAgent() // Need to build first
}

main().catch(console.error)
