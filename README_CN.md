<h1 align="center"> Nano Agent</h1>

<p align="center">
  <img src="https://img.shields.io/github/last-commit/Code-MonkeyZhang/nano-agent?color=ff69b4" alt="last commit">
  <img src="https://img.shields.io/badge/Language-TypeScript-blue.svg" alt="typescript">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="license">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README_CN.md">简体中文</a>
</p>

> 本项目是基于 MiniMax 开源的 [Mini-Agent](https://github.com/MiniMax-AI/Mini-Agent) 项目的 TypeScript 实现版本。

**Nano Agent** 是一个简单的终端 LLM Agent，支持通过 **Agent Skills** 和 **MCP (Model Context Protocol)** 扩展能力。它不仅兼容 Anthropic 和 OpenAI 协议，还具备原生文件操作与命令行执行的能力，是开发者在终端环境下的全能 AI 助手。

---

## ✨ 核心特性

- 🔄 **ReAct 模式**: 支持 ReAct 的 Agent 循环机制，能进行多步推理并循环调用多种工具完成复杂任务。
- 🧠 **交错思维链**: 使 Agent 的推理过程与工具调用紧密结合。
- 🔌 **MCP 协议支持**: 轻松连接外部工具生态，扩展 Agent 功能。
- 🛠️ **Agent Skills**: 支持通过专业知识库、工作流和工具集来自定义 Agent 技能，打造领域专家。
- 🌐 **自定义供应商**: 支持 Anthropic 和 OpenAI SDK，自由接入任何兼容协议的 LLM 供应商。

---

## 📂 项目结构

```
nano-agent/
├── src/
│   ├── agent.ts           # Agent 核心逻辑
│   ├── cli.ts             # 命令行入口
│   ├── config.ts          # 配置加载与解析
│   ├── llm-client/        # LLM 客户端适配器
│   ├── schema/            # 数据模型定义
│   ├── skills/            # 技能加载器
│   ├── server/            # HTTP/WebSocket 服务器
│   ├── tools/             # 内置工具集
│   └── util/
├── config/
│   ├── config.yaml        # 主配置文件
│   └── mcp.json           # MCP 服务器配置
├── skills/                # 用户自定义技能目录
├── tests/                 # 测试文件
└── logs/                  # 运行日志（启用日志时生成）
```

---

## 🛠️ 快速上手

### 1.克隆项目并安装依赖

在终端执行以下命令将项目部署到本地：

```bash
# 克隆仓库
git clone [https://github.com/Code-MonkeyZhang/nano-agent.git](https://github.com/Code-MonkeyZhang/nano-agent.git)

# 进入项目目录
cd nano-agent

# 安装依赖
npm install
```

### 2.安装项目并链接到系统全局命令

```bash
npm run build && npm link
```

## 项目配置

初始化配置文件以填入你的 API 信息：

```bash
# 复制示例配置
cp config/config-example.yaml config/config.yaml
```

```bash
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

## 🚀 使用方法

Nano Agent 支持两种运行模式：交互模式和服务器模式。

### 查看帮助

```bash
nano-agent --help      # 查看主帮助
nano-agent server --help # 查看 server 命令帮助
```

### 交互模式

在当前目录启动交互模式：

```bash
nano-agent
```

在交互模式下，Agent 会显示提示符等待你的输入，支持多轮对话，并根据你的需求调用工具完成任务。输入 `exit`、`quit` 或 `q` 可以退出。

### 服务器模式

服务器模式启动 HTTP 和 WebSocket 服务器，提供 OpenAI 兼容的 API，便于集成到其他应用中。

**启动服务器（默认启用公网访问）：**

```bash
nano-agent server
```

**仅本地访问（不启用公网 Tunnel）：**

```bash
nano-agent server --local
```

服务器启动后会自动选择可用端口并显示访问地址。如果配置文件中指定了端口且端口可用，将优先使用配置的端口；否则会自动在 3000-9999 范围内选择可用端口。


## 🔌 MCP 服务器

本项目支持通过 MCP 协议给 Agent 添加外部工具。下面示例展示如何添加一个 time server：
编辑 config/mcp.json：

```json
{
  "mcpServers": {
    "time-server": {
      "command": "uvx",
      "args": ["mcp-server-time"],
      "description": "提供当前时间查询工具"
    }
  }
}
```

## 🧠 Agent Skills

本项目支持 Agent Skills, 允许用户为 Agent 加入特定功能的“操作手册”。为了加入skill,你需要在项目根目录或指定位置创建 skills 目录。将Skill文件放入该目录。同时确保 config.yaml 中启用了正确的skill路径：

```bash
tools:
  skillsDir: "./skills"
```

---

## 🤝 贡献与反馈

欢迎提交 Issue 或 Pull Request 来完善这个项目。

### Made with ❤️ by Code-MonkeyZhang

---

## 📚 参考文档

本项目的实现参考了以下官方文档：

- [OpenAI API Reference](https://platform.openai.com/docs/api-reference/chat)
- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create)
- [Model Context Protocol Docs](https://modelcontextprotocol.io/docs/getting-started/intro)
- [Agent Skills Documentation](https://agentskills.io/home)
