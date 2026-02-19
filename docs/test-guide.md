# Test Guide

This document provides a comprehensive guide to testing in the nano-agent project, including how to run tests and detailed explanations of all test suites.

## Running Tests

The project uses **Vitest** as the testing framework.

### Available Test Commands

```bash
# Run all tests in watch mode
npm test

# Run all tests once and exit
npm run test:run

# Type check without emitting files
npm run typecheck

# Lint the source code
npm run lint

# Run all preflight checks (build, test, lint)
npm run preflight
```

### Running Specific Tests

```bash
# Run a specific test file
npm test -- tests/server/integration.test.ts

# Run tests matching a pattern
npm test -- --grep "SSE Streaming"

# Run tests in a specific directory
npm test -- tests/server/
```

## Test Structure

All tests are located in the `tests/` directory:

```
tests/
├── server/
│   ├── integration.test.ts      # Server integration tests
│   ├── sse-writer.test.ts       # SSE writer unit tests
│   └── converters.test.ts       # Data converter unit tests
├── tools.test.ts                # File tools tests
├── tool-schema.test.ts          # Tool interface/schema tests
├── bash-tool.test.ts            # Bash command execution tests
└── llm-client.test.ts           # LLM API integration tests
```

---

## Server Tests

### 1. integration.test.ts - Server Integration Tests

**Test Method:**

- **Framework:** Vitest
- **Type:** End-to-end (E2E) integration testing
- **Approach:** Real HTTP server on port 3848
- **Tool:** `fetch` API for HTTP requests

**Test Setup (beforeAll/afterAll):**

- Loads `config.yaml` configuration file
- Initializes `LLMClient` instance
- Sets up OpenAI-compatible routes
- Initializes WebSocket service
- Starts HTTP server listening on `0.0.0.0:3848`

**Test Cases:**

#### SSE Streaming - Basic Chat (lines 56-107)

- **Purpose:** Verify SSE streaming response works correctly
- **Steps:**
  1. Send request with `stream: true` and simple message "Hello"
  2. Verify response status 200 and `text/event-stream` Content-Type
  3. Read and parse SSE data chunks
  4. Extract message content from chunks
  5. Verify `[DONE]` marker received
- **Assertions:**
  - Response status is 200
  - Content-Type contains `text/event-stream`
  - Content is non-empty
  - `[DONE]` marker present

#### SSE Streaming - With Thinking Content (lines 109-138)

- **Purpose:** Test streaming with reasoning/thinking content
- **Model:** Uses `deepseek-chat` model
- **Timeout:** 15 seconds
- **Steps:**
  1. Send streaming request with quantum explanation query
  2. Read all chunks from stream
  3. Verify stream completes without errors
- **Note:** Whether "thinking" content appears depends on model response

#### Non-Streaming Response (lines 140-161)

- **Purpose:** Verify non-streaming (standard) API response format
- **Steps:**
  1. Send request with `stream: false`
  2. Verify JSON response format
  3. Check response structure matches OpenAI API spec
- **Assertions:**
  - Response status is 200
  - Content-Type contains `application/json`
  - `data.object` is `chat.completion`
  - `choices` array is non-empty
  - `choices[0].message.content` exists

#### Error Handling - Invalid Request (lines 163-176)

- **Purpose:** Ensure server handles malformed requests gracefully
- **Steps:**
  1. Send request missing required fields (model, empty messages)
  2. Verify server doesn't crash
  3. Check response is returned
- **Note:** Server may return 200 with empty content, 500 error, or other status - important is it doesn't crash

---

### 2. sse-writer.test.ts - SSE Writer Unit Tests

**Test Method:**

- **Framework:** Vitest
- **Type:** Unit testing
- **Approach:** Mock objects for Express Response
- **Tool:** `vi.fn()` for spy functions

**Test Setup (beforeEach):**

- Creates mock Response object with spies:
  - `setHeader` - Track header setting
  - `write` - Track data writing
  - `end` - Track response ending
  - `flushHeaders`, `status`, `json` - Other Response methods

**Test Cases:**

#### should set correct headers on initialization (lines 23-38)

- **Purpose:** Verify SSE headers are set correctly on first write
- **Steps:**
  1. Create SSEWriter with mock Response
  2. Call `writer.write()` with a chunk
  3. Verify correct headers are set
- **Assertions:**
  - `Content-Type` is `text/event-stream`
  - `Cache-Control` is `no-cache`
  - `Connection` is `keep-alive`

#### should format data correctly (lines 41-48)

- **Purpose:** Verify SSE data format is correct
- **Steps:**
  1. Write a chunk object
  2. Verify it's formatted as `data: {json}\n\n`
- **Assertions:**
  - Data is JSON stringified
  - Format matches SSE spec with double newline

#### should write [DONE] on completion (lines 51-56)

- **Purpose:** Verify completion message is sent correctly
- **Steps:**
  1. Call `writer.done()`
  2. Verify `[DONE]` is written and response ended
- **Assertions:**
  - Writes `data: [DONE]\n\n`
  - Calls `response.end()`

---

### 3. converters.test.ts - Data Converter Unit Tests

**Test Method:**

- **Framework:** Vitest
- **Type:** Unit testing
- **Approach:** Pure function testing (no external dependencies)
- **Coverage:** Request/response format conversion

**Test Groups:**

#### convertOpenAIRequest Tests

##### should convert simple user message (lines 10-24)

- **Purpose:** Convert basic OpenAI chat request
- **Input:**
  - Model: `gpt-4`
  - Single user message: "Hello"
- **Assertions:**
  - `result.model` is `gpt-4`
  - `result.messages` has length 1
  - Message role is `user`, content is "Hello"

##### should convert system and assistant messages (lines 27-42)

- **Purpose:** Convert multiple message types
- **Input:** system, user, assistant messages
- **Assertions:**
  - All 3 messages preserved
  - Roles correctly assigned (system, user, assistant)

##### should extract options (lines 45-57)

- **Purpose:** Extract generation parameters
- **Input:** temperature: 0.7, max_tokens: 100
- **Assertions:**
  - `result.options.temperature` is 0.7
  - `result.options.maxTokens` is 100

#### convertStreamChunk Tests

##### should convert content chunk (lines 62-74)

- **Purpose:** Convert regular text content chunk
- **Input:**
  - done: false
  - content: "Hello"
- **Assertions:**
  - `result.id` matches provided request ID
  - `result.model` matches provided model
  - `result.choices[0].delta.content` is "Hello"
  - `result.choices[0].finish_reason` is null

##### should convert thinking chunk (lines 77-86)

- **Purpose:** Convert reasoning/thinking content
- **Input:**
  - done: false
  - thinking: "Hmm..."
- **Assertions:**
  - `result.choices[0].delta.reasoning_content` is "Hmm..."

##### should handle done chunk (lines 89-99)

- **Purpose:** Convert final completion chunk
- **Input:**
  - done: true
  - finish_reason: "stop"
- **Assertions:**
  - `result.choices[0].finish_reason` is "stop"
  - `result.choices[0].delta` is `{ role: 'assistant' }`

---

## Tool Tests

### 4. tools.test.ts - File Tools Tests

**Test Method:**

- **Framework:** Vitest
- **Type:** Integration testing with temporary filesystem
- **Approach:** Create temp directories, test operations, cleanup

**Test Tools:**

- `ReadTool` - Read files with line numbers
- `WriteTool` - Write files
- `EditTool` - Edit files with string replacement

**Test Cases:**

#### should read files with line numbers (lines 8-21)

- **Setup:** Create temp file with content "line1\nline2\nline3\n"
- **Steps:**
  1. Use ReadTool to read file
  2. Verify content includes line numbers
- **Assertions:**
  - `result.success` is true
  - Content contains formatted lines with numbers (e.g., " 1|line1")

#### should read files with offset and limit (lines 23-41)

- **Setup:** Create temp file with "a\nb\nc\nd\n"
- **Steps:**
  1. Read with offset=2, limit=2
  2. Verify only lines 2-3 are returned
- **Assertions:**
  - Contains " 2|b" and " 3|c"
  - Does NOT contain " 1|a"

#### should write files (lines 43-58)

- **Steps:**
  1. Use WriteTool to write "Test content"
  2. Verify file exists with correct content
- **Assertions:**
  - `result.success` is true
  - File content matches "Test content"

#### should edit files (lines 60-77)

- **Setup:** Create file with "hello world"
- **Steps:**
  1. Use EditTool to replace "world" with "agent"
  2. Verify file content changed
- **Assertions:**
  - `result.success` is true
  - File content is "hello agent"

---

### 5. tool-schema.test.ts - Tool Interface Tests

**Test Method:**

- **Framework:** Vitest
- **Type:** Unit testing with mock tool implementations
- **Purpose:** Verify Tool interface compliance and schema handling

**Mock Tools:**

- `MockWeatherTool` - Simple tool with location parameter
- `MockSearchTool` - Tool with nested properties
- `MockEnumTool` - Tool with enum parameter

**Test Cases:**

#### should implement Tool interface correctly (lines 65-78)

- **Purpose:** Verify Tool interface properties
- **Assertions:**
  - `tool.name` is "get_weather"
  - `tool.description` matches expected
  - `tool.parameters` schema is correct
  - Required fields specified

#### should handle complex schemas (lines 80-84)

- **Purpose:** Test nested object properties
- **Assertions:**
  - `filters` property exists in schema
  - Complex structures preserved

#### should allow multiple tools (lines 86-94)

- **Purpose:** Test tool registration/management
- **Steps:**
  1. Create multiple tool instances
  2. Verify each tool has unique name
- **Assertions:**
  - Tools array has length 2
  - Tool names are unique ("get_weather", "search")

#### should preserve enum parameters (lines 96-102)

- **Purpose:** Verify enum constraints are maintained
- **Assertions:**
  - Enum values `['open', 'closed']` preserved
  - Type checking works correctly

#### should execute tool (lines 104-109)

- **Purpose:** Verify tool execution returns correct result
- **Steps:**
  1. Execute tool with parameters
  2. Verify result structure
- **Assertions:**
  - `result.success` is true
  - `result.content` is "Weather data"

---

### 6. bash-tool.test.ts - Bash Command Tests

**Test Method:**

- **Framework:** Vitest
- **Type:** Integration testing with real shell execution
- **Platform:** Skipped on Windows (`process.platform === 'win32'`)

**Test Tools:**

- `BashTool` - Execute bash commands
- `BashOutputTool` - Fetch output from background processes
- `BashKillTool` - Kill background processes

**Test Cases:**

#### should execute foreground commands (lines 11-20)

- **Purpose:** Test basic command execution
- **Steps:**
  1. Execute `echo 'Hello from foreground'`
  2. Verify output captured
- **Assertions:**
  - `result.success` is true
  - `result.stdout` contains "Hello from foreground"
  - `result.exit_code` is 0

#### should capture stdout and stderr (lines 22-31)

- **Purpose:** Verify both output streams captured
- **Steps:**
  1. Execute command writing to both stdout and stderr
  2. Verify both captured separately
- **Assertions:**
  - `stdout` contains "stdout message"
  - `stderr` contains "stderr message"

#### should report command failures (lines 33-42)

- **Purpose:** Test error handling for failed commands
- **Steps:**
  1. Execute command that will fail (nonexistent directory)
  2. Verify error reported
- **Assertions:**
  - `result.success` is false
  - `exit_code` is not 0
  - `error` property exists

#### should handle timeouts (lines 44-50)

- **Purpose:** Verify command timeout enforcement
- **Timeout:** 10 seconds
- **Steps:**
  1. Execute `sleep 5` with timeout of 1 second
  2. Verify command terminated
- **Assertions:**
  - `result.success` is false
  - Error message contains "timed out"

#### should run background commands and fetch output (lines 52-73)

- **Purpose:** Test background process management
- **Timeout:** 10 seconds
- **Steps:**
  1. Start background command with `run_in_background: true`
  2. Get `bash_id` from result
  3. Wait for process to produce output
  4. Use `BashOutputTool` to fetch output
  5. Kill background process
- **Assertions:**
  - `bash_id` is not empty
  - Output fetching succeeds
  - `stdout` contains expected output
  - Kill operation succeeds

#### should filter background output (lines 75-99)

- **Purpose:** Test output filtering with regex
- **Timeout:** 10 seconds
- **Steps:**
  1. Start background process generating multiple lines
  2. Wait for output accumulation
  3. Fetch output with `filter_str: 'Line [24]'`
  4. Verify only matching lines returned
- **Assertions:**
  - Output contains only "Line 2" or "Line 4"
  - Filter regex applied correctly

#### should handle non-existent bash ids (lines 101-115)

- **Purpose:** Verify graceful error handling for invalid IDs
- **Steps:**
  1. Try to kill nonexistent bash ID
  2. Try to fetch output from nonexistent bash ID
- **Assertions:**
  - Both operations fail gracefully
  - Error message contains "not found"

---

### 7. llm-client.test.ts - LLM API Integration Tests

**Test Method:**

- **Framework:** Vitest
- **Type:** Integration testing with real LLM API calls
- **Condition:** Requires valid `config.yaml` file

**Test Setup:**

- Checks if `config.yaml` exists and is valid
- Skips all tests if configuration not found
- Logs skip reason if tests are skipped

**Test Cases:**

#### should stream a response from the configured LLM API (lines 39-73)

- **Purpose:** Verify streaming LLM API calls work end-to-end
- **Timeout:** 30 seconds
- **Prerequisites:**
  - Valid `config.yaml` with API credentials
  - Network access to LLM API
- **Steps:**
  1. Create `LLMClient` from config
  2. Send user message: "Reply with exactly: pong"
  3. Iterate through stream chunks
  4. Accumulate content
  5. Verify completion marker
- **Assertions:**
  - `sawDone` is true (stream completed)
  - Content is non-empty
  - Content matches /pong/i (case-insensitive)

---

## Testing Best Practices

### Running Tests

1. **Before committing:**

   ```bash
   npm run preflight
   ```

   This runs build, tests, and linting.

2. **Watch mode during development:**

   ```bash
   npm test
   ```

3. **Quick feedback:**
   ```bash
   npm run typecheck && npm run test:run
   ```

### Writing Tests

1. **Use descriptive test names** that explain what is being tested
2. **Follow the pattern:**
   - Setup (create fixtures, mocks)
   - Execute (call the function/method)
   - Assert (verify expected outcome)
   - Cleanup (remove temporary files, etc.)

3. **Keep tests independent** - each test should work in isolation

4. **Mock external dependencies** to avoid slow or unreliable tests

5. **Test both success and failure cases**

6. **Use `beforeEach` for test setup** when multiple tests share the same setup

7. **Clean up resources** in `afterEach` or `afterAll` (temp files, servers, etc.)

### Test Organization

- **Unit tests** - Test individual functions/classes in isolation
- **Integration tests** - Test multiple components working together
- **End-to-end tests** - Test complete workflows with real HTTP/external services

### Skipping Tests

Use `describe.skip` or `it.skip` to temporarily skip tests:

```typescript
describe.skip('On Windows only', () => {
  // Tests that only run on Windows
});

it.skip('Flaky test - fix needed', () => {
  // Test to skip
});
```

---

## Test Coverage

The current test suite covers:

- ✓ Server HTTP endpoints (streaming and non-streaming)
- ✓ SSE (Server-Sent Events) formatting
- ✓ Request/response data conversion
- ✓ File operations (read, write, edit)
- ✓ Tool interface and schema validation
- ✓ Bash command execution (foreground, background, timeout)
- ✓ LLM API streaming integration
- ✓ Error handling and edge cases

### Areas for Future Testing

- WebSocket communication
- Config validation
- Schema conversion (OpenAI ↔ NanoAgent formats)
- More complex bash scenarios
- Concurrent request handling
- Rate limiting
- Authentication (if implemented)

---

## Troubleshooting

### Tests failing with "config.yaml not found"

Ensure `config.yaml` exists in the correct location:

- From project root: `./config/config.yaml`
- Or set up test-specific config

### Integration tests timing out

Integration tests have longer timeouts (10-30s). If they timeout:

1. Check network connectivity to LLM API
2. Verify API credentials in config.yaml
3. Check if API service is available

### Port conflicts

Integration test uses port 3848. If already in use:

1. Change `PORT` constant in `tests/server/integration.test.ts`
2. Or kill process using the port

### Windows-specific tests skipped

Bash tool tests are skipped on Windows. To run them:

- Use WSL (Windows Subsystem for Linux)
- Or test on Unix-like system (macOS, Linux)
