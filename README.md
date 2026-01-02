[English](./README.md) | [中文](./README_CN.md)

# Mini-Agent (TypeScript) Quick Start Guide

This is an AI agent that runs in your terminal (command line). It can help you read/write files and execute system commands.

## 🛠️ Step 1: Install Node.js

Copy and run the corresponding command in your terminal (Terminal / PowerShell) based on your operating system:

- **Windows** (PowerShell):
  ```powershell
  winget install -e --id OpenJS.NodeJS.LTS
  ```
- **Mac** (requires Homebrew):
  ```bash
  brew install node
  ```
- **Linux** (Ubuntu/Debian):
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs
  ```

_(After installation, please close and reopen your terminal, then type `node -v`. If you see something like `v20.x.x`, the installation was successful.)_

## 📥 Step 2: Download the Code

Run the following commands in your terminal to clone the project locally:

```bash
# 1. Clone the repository
git clone https://github.com/YourUsername/Mini-Agent.git

# 2. Enter the project directory
cd Mini-Agent/Mini-Agent-TS
```

_(If you don't have Git installed, Windows users can run `winget install Git.Git`, Mac users can run `brew install git`)_

## ⚙️ Step 3: Install and Link

Run the following two commands in your terminal. This will register the `mini-agent-ts` command to your system:

```bash
# 1. Install dependencies
npm install

# 2. Build and link to system command
npm run build && npm link
```

## 🔑 Step 4: Configure API Key

You need to provide your API credentials.

1.  Navigate to the `config` directory in the project folder.
2.  Copy `config-example.yaml` and rename it to `config.yaml`:
    ```bash
    cp config/config-example.yaml config/config.yaml
    ```
3.  Open `config.yaml` with a text editor and modify the following key settings:

```yaml
# config/config.yaml

# Enter your API Key
api_key: "YOUR_API_KEY_HERE" # Replace with your MiniMax API Key

# API endpoint (choose based on your network environment)
api_base: "https://api.minimax.io/anthropic" # Global users
# api_base: "https://api.minimaxi.com"        # China users

# Model and provider
model: "MiniMax-M2"
provider: "anthropic"
```

## 🚀 Step 5: Run

All set! You can now run the following command from **anywhere** in your terminal.

### 1. Basic Usage

Start in the current directory:

```bash
mini-agent-ts
```

### 2. Specify a Workspace

You can have the Agent work in a specific directory, so all files it creates will be saved there, keeping your current folder clean:

```bash
# Windows
mini-agent-ts --workspace D:\MyProjects\TestAgent

# Mac / Linux
mini-agent-ts -w ./my-workspace
```

You will see the welcome screen `🤖 Mini Agent`. Now you can give it instructions just like chatting with a person, for example:

> "Please create a file named hello.txt in the current directory, and write a poem about programmers."

---

## 👨‍💻 Developer Guide

If you want to contribute or debug the code, you can use the following commands:

| Command         | Description                                                                                                                                     |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build` | **Build the project**: Compile TypeScript source code to JavaScript (output to `dist/` directory).                                              |
| `npm run dev`   | **Development mode**: Run source code directly using `tsx`, no manual compilation needed. Changes take effect immediately, ideal for debugging. |
| `npm run start` | **Production mode**: Run compiled code (requires build first).                                                                                  |
| `npm test`      | **Run tests**: Execute Vitest unit tests.                                                                                                       |
