[English](./README.md) | [中文](./README_CN.md)

# Mini-Agent (TypeScript 版) 快速启动指南

> 本项目是 Minimax 开源的[Mini-Agent](https://github.com/MiniMax-AI/Mini-Agent) 项目的 TypeScript 实现版本。

这是一个终端 LLM Agent，支持通过 Agent Skills 和 MCP 扩展能力，兼容 Anthropic 和 OpenAI 协议. 包含基础的文件操作和命令行执行的功能.

## Quick Start

在终端中执行以下命令将项目克隆到本地：

```bash
# 1. 克隆仓库
https://github.com/Code-MonkeyZhang/Mini-Agent-TS.git
# 2. 进入项目目录
cd Mini-Agent/Mini-Agent-TS
```

在终端中依次执行以下两条命令，这会将 `mini-agent-ts` 命令注册到你的系统中：

```bash
# 1. 安装依赖
npm install

# 2. 编译并链接到系统命令
npm run build && npm link
```

### 配置项目

1. 进入项目文件夹下的 `config` 目录。
2. 将 `config-example.yaml` 复制一份并重命名为 `config.yaml`：
   ```bash
   cp config/config-example.yaml config/config.yaml
   ```
3. 用记事本或代码编辑器打开 `config.yaml`，修改以下关键配置：

```yaml
# config/config.yaml

# 填入你的 API Key
api_key: "YOUR_API_KEY_HERE" # 替换为你的 LLM provider API Key
api_base: "https://api.minimax.io/anthropic" # 替换为你的base url

# 模型和提供商SDK的形式
model: "MiniMax-M2"
provider: "anthropic" # "anthropic" 或 "openai"

# 日志配置（可选）
enableLogging: false # 设置为 true 以启用日志记录功能，日志将保存在项目根目录的 logs/ 文件夹下
```

### 运行

一切就绪！现在你可以在终端的**任何位置**直接输入命令来启动。

```bash
mini-agent-ts
```

### 2. 指定工作空间 (Workspace)

你可以让 Agent 在特定目录下工作，这样它创建的文件都会保存在那里，不会弄乱你的当前文件夹：

```bash
mini-agent-ts -workspace ./my-workspace
```

---

## MCP (Model Context Protocol) 支持

Mini-Agent-TS 支持 MCP 协议，通过配置文件连接外部工具。

### 配置

在 `config.yaml` 中指定 MCP 配置文件路径（默认为 `mcp.json`）：

```yaml
tools:
  mcpConfigPath: "mcp.json"
```

### 示例

复制示例配置文件：

```bash
cp config/mcp-example.json config/mcp.json
```

然后编辑 `config/mcp.json` 添加你的 MCP 服务器：

```json
{
  "mcpServers": {
    "time-server": {
      "command": "uvx",
      "args": ["mcp-server-time"],
      "description": "提供时间工具的服务器"
    }
  }
}
```

---

## Agent Skill

Mini-Agent 支持 **Agent Skill** - 通过专业知识、工作流程和工具扩展 Agent 的能力。

### 创建技能目录

在你的项目中或指定位置创建一个 `skills` 目录：

````bash
# 创建 skills 目录
mkdir skills

### 示例技能

你可以在 [`skills-example`](./skills-example/) 目录中找到示例技能。

---

### 启用技能

技能默认已启用。如有需要，你可以在 `config.yaml` 中配置：

```yaml
tools:
  enableSkills: true
  skillsDir: "./skills" # skill文件保存的路径
````
