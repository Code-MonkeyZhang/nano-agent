<h1 align="center"> Mini-Agent-TS</h1>

<p align="center">
  <img src="https://img.shields.io/github/last-commit/Code-MonkeyZhang/Mini-Agent-TS?color=ff69b4" alt="last commit">
  <img src="https://img.shields.io/badge/Language-TypeScript-blue.svg" alt="typescript">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="license">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README_CN.md">简体中文</a>
</p>

> This project is a TypeScript implementation of MiniMax's open-source [Mini-Agent](https://github.com/MiniMax-AI/Mini-Agent) project.

**Mini-Agent-TS** is a terminal LLM Agent that supports extending capabilities through **Agent Skills** and **MCP (Model Context Protocol)**. It is compatible with both Anthropic and OpenAI protocols, featuring native file operations and command execution capabilities, making it an all-purpose AI assistant for developers in the terminal environment.

---

## ✨ Core Features

- 🔄 **ReAct Mode**: Supports ReAct Agent loop mechanism for multi-step reasoning and tool calling to complete complex tasks.
- 🧠 **Interleaved Chain of Thought**: Tightly integrates Agent's reasoning process with tool calls.
- 🔌 **MCP Protocol Support**: Easily connect to external tool ecosystems and extend Agent capabilities.
- 🛠️ **Agent Skills**: Customize Agent skills through professional knowledge bases, workflows, and toolsets to build domain experts.
- 🌐 **Custom Providers**: Supports Anthropic and OpenAI SDKs, with freedom to connect to any LLM provider compatible with these protocols.

---

## 📂 Project Structure

```
Mini-Agent-TS/
├── src/
│   ├── agent.ts           # Agent core logic
│   ├── cli.ts             # CLI entry point
│   ├── config.ts          # Configuration loading and parsing
│   ├── llm-client/        # LLM client adapters
│   ├── schema/            # Data model definitions
│   ├── skills/            # Skills loader
│   ├── tools/             # Built-in toolset
│   └── util/
├── config/
│   ├── config.yaml        # Main configuration file
│   └── mcp.json           # MCP server configuration
├── skills/                # User-defined skills directory
├── tests/                 # Test files
└── logs/                  # Runtime logs (generated when logging is enabled)
```

---

## 🛠️ Quick Start

### 1. Clone Project and Install Dependencies

Run the following commands to deploy the project locally:

```bash
# Clone repository
git clone [https://github.com/Code-MonkeyZhang/Mini-Agent-TS.git](https://github.com/Code-MonkeyZhang/Mini-Agent-TS.git)

# Enter project directory
cd Mini-Agent-TS

# Install dependencies
npm install
```

### 2. Build and Link to System Commands

```bash
npm run build && npm link
```

## Project Configuration

Initialize the configuration file with your API information:

```bash
# Copy example configuration
cp config/config-example.yaml config/config.yaml
```

```bash
# config/config.yaml

# Enter your API Key
api_key: "YOUR_API_KEY_HERE" # Replace with your LLM provider API Key
api_base: "https://api.minimax.io/anthropic" # Replace with your base url

# Model and provider SDK format
model: "MiniMax-M2"
provider: "anthropic" # "anthropic" or "openai"

# Logging configuration (optional)
enableLogging: false # Set to true to enable logging, logs saved in logs/ folder at project root
```

### Specify Workspace

If you want the Agent to operate only within a specific project directory (to prevent accidental deletion or modification of other files), use:

## 🔌 MCP Servers

This project supports adding external tools to the Agent via the MCP protocol. The following example shows how to add a time server:
Edit `config/mcp.json`:

```json
{
  "mcpServers": {
    "time-server": {
      "command": "uvx",
      "args": ["mcp-server-time"],
      "description": "Provides current time query tools"
    }
  }
}
```

## 🧠 Agent Skills

This project supports Agent Skills, allowing users to add "operation manuals" with specific functionality to the Agent. To add a skill, you need to create a skills directory in the project root or a specified location. Place your skill files in that directory. Also ensure the correct skills path is enabled in `config.yaml`:

```bash
tools:
  skillsDir: "./skills"
```

---

## 🤝 Contributing & Feedback

Issues and Pull Requests are welcome to improve this project.

### Made with ❤️ by Code-MonkeyZhang

---

## 📚 Reference Documentation

The implementation of this project references the following official documentation:

- [OpenAI API Reference](https://platform.openai.com/docs/api-reference/chat)
- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create)
- [Model Context Protocol Docs](https://modelcontextprotocol.io/docs/getting-started/intro)
- [Agent Skills Documentation](https://agentskills.io/home)
