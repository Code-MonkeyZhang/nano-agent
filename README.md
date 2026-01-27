[English](./README.md) | [中文](./README_CN.md)

# Mini-Agent (TypeScript Edition) Quick Start Guide

> This project is a TypeScript implementation of Minimax's open-source [Mini-Agent](https://github.com/MiniMax-AI/Mini-Agent) project.

This is a terminal LLM Agent that supports extending capabilities through Agent Skills and MCP, compatible with both Anthropic and OpenAI protocols. Includes file operations and command execution features.

## Quick Start

Clone the project to your local machine:

```bash
# 1. Clone repository
https://github.com/Code-MonkeyZhang/Mini-Agent-TS.git
# 2. Enter project directory
cd Mini-Agent/Mini-Agent-TS
```

Run these two commands to register `mini-agent-ts` as a system command:

```bash
# 1. Install dependencies
npm install

# 2. Build and link to system commands
npm run build && npm link
```

### Configure Project

1. Navigate to the `config` folder in the project directory.
2. Copy `config-example.yaml` and rename it to `config.yaml`:
   ```bash
   cp config/config-example.yaml config/config.yaml
   ```
3. Open `config.yaml` with a text/code editor and modify these key configurations:

```yaml
# config/config.yaml

# Enter your API Key
api_key: "YOUR_API_KEY_HERE" # Replace with your LLM provider API Key
api_base: "https://api.minimax.io/anthropic" # Replace with your base url

# Model and provider SDK format
model: "MiniMax-M2"
provider: "anthropic" # "anthropic" or "openai"

# Logging configuration (optional)
enableLogging: false # Set to true to enable file logging (logs saved in logs/ folder at project root)
```

### Run

Ready to go! You can now launch it from anywhere in your terminal:

```bash
mini-agent-ts
```

### Specify Workspace (Workspace)

Have Agent work in a specific directory to keep generated files organized:

```bash
mini-agent-ts -workspace ./my-workspace
```

---

## MCP (Model Context Protocol) Support

Mini-Agent-TS supports the MCP protocol for connecting external tools via configuration.

### Configuration

Specify the MCP config file path in `config.yaml` (defaults to `mcp.json`):

```yaml
tools:
  mcpConfigPath: "mcp.json"
```

### Example

Copy the example config file:

```bash
cp config/mcp-example.json config/mcp.json
```

Then edit `config/mcp.json` to add your MCP servers:

```json
{
  "mcpServers": {
    "time-server": {
      "command": "uvx",
      "args": ["mcp-server-time"],
      "description": "A server that provides time tools"
    }
  }
}
```

---

## Agent Skill

Mini-Agent supports **Agent Skill** - extending Agent capabilities through specialized knowledge, workflows, and tools.

### Create Skills Directory

Create a `skills` directory in your project or anywhere you specify:

```bash
# Create skills directory
mkdir skills

### Example Skills

You can find example skills in the [`skills-example`](./skills-example/) directory.

---

### Enable Skills

Skills are enabled by default. If needed, you can configure them in `config.yaml`:

```yaml
tools:
  enableSkills: true
  skillsDir: "./skills" # Path to skills directory
```
