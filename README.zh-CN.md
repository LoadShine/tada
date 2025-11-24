# Tada - 现代、离线优先的智能任务管理应用

<div align="center">

[🇨🇳 中文](./README_ZH.md) | [🇬🇧 English](./README.md)

<br />

<img src="./logo.svg" alt="Tada Logo" width="180" />

<br />

### 匠心打造的本地优先 AI 任务管理器

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://reactjs.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange)](https://tauri.app/)

</div>

> [!IMPORTANT]
> **⚠️ macOS 用户安装必读**
>
> 由于本项目是开源项目，未购买 Apple 开发者签名证书（需年费 $99），安装后 macOS 可能会提示 **“Tada.app 已损坏，无法打开，你应该将它移到废纸篓”**。
>
> 这并非应用真的损坏，而是系统安全机制的拦截。**请在将应用拖入“应用程序”文件夹后，打开终端 (Terminal) 运行以下命令修复：**
>
> ```bash
> sudo xattr -r -d com.apple.quarantine /Applications/Tada.app
> ```
>
> *(输入密码时不会显示字符，输入完成后按回车即可。)*

-----

## 📖 项目概述

**Tada** 不仅仅是一个待办事项清单，它是为追求极致效率和数据隐私的用户量身打造的“第二大脑”。Tada 融合了传统的任务管理（GTD）与最前沿的生成式 AI 技术，旨在提供一种无缝、智能且安全的工作流体验。

无论您是在浏览器中快速记录，还是在桌面上进行深度工作，Tada 均采用 **“本地优先 (Local-First)”** 的架构设计。这意味着您的数据永远属于您，存储在您的设备上，而非云端。

核心亮点包括自研的 **Moondown** 编辑器——一个功能强大的 Markdown 写作环境，支持 AI 续写、Slash 命令和所见即所得的表格编辑。

-----

## 📷 应用截图

<div align="center">

<br />

<img src="./Screenshot.zh-CN.png" alt="应用截图" />

<br />

</div>

-----

## ✨ 核心特性

### 🔒 极致隐私与数据主权

* **零数据收集：** 我们没有任何后台服务器，不收集任何用户行为数据。
* **自适应持久化架构：**
    * **Web 端：** 使用 `LocalStorage` 和 `IndexedDB`，保证轻量级和即时响应。
    * **桌面端：** 基于 `SQLite` 的高性能本地数据库，支持海量数据存储与全文检索。
* **BYOK (自带密钥) 模式：** AI 请求直接从您的设备发送至服务商（如 OpenAI），中间不经过任何中转服务器。

### 🧠 AI 深度赋能

Tada 将 LLM（大语言模型）深度集成到应用逻辑中，而非简单的聊天机器人。

* **智能语义解析：** 向 AI 描述您的计划（例如“下周五之前帮我策划一个营销方案，优先级高”），Tada 会自动解析出标题、截止日期、优先级、标签和子任务结构。
* **幽灵写作 (Ghost Writer)：** 在任务详情页中，AI 是您的写作助手。它可以根据上下文自动续写内容、润色文案或生成大纲。
* **智能周报：** 基于您的任务完成情况，一键生成结构化的 Markdown 工作总结。

### 📝 Moondown 编辑器

基于 CodeMirror 6 深度定制的 Markdown 编辑体验：

* **所见即所得 (WYSIWYG)：** Markdown 语法在非编辑状态下自动隐藏，保持界面整洁。
* **高级组件：** 支持拖拽上传图片、交互式表格编辑、任务列表和代码高亮。
* **Slash 命令系统：** 输入 `/` 即可唤起命令菜单，快速插入组件或调用 AI。

### 🎨 现代化的交互设计

* **日历视图：** 支持拖拽任务以重新安排日程。
* **多维度筛选：** 支持按标签、列表、优先级和日期范围进行过滤。
* **主题系统：** 内置多套精心调配的配色方案（珊瑚红、深海蓝、森林绿等），完美适配深色模式。
* **平滑动画：** 全局采用 `framer-motion`，操作反馈细腻流畅。

-----

## 🏗 技术架构

Tada 采用企业级 Monorepo 架构（基于 `pnpm workspaces`），实现了核心逻辑与运行平台的解耦。

* **`packages/core` (核心层):** 包含应用的所有业务逻辑、UI 组件库、Jotai 状态管理、i18n 国际化配置以及 Moondown 编辑器内核。
* **`packages/web` (Web 适配层):** 浏览器的入口点。实现了基于浏览器的存储策略 (`LocalStorageService`)。
* **`packages/desktop` (桌面适配层):** 基于 Tauri (Rust) 的桌面入口。实现了基于文件系统的存储策略 (`SqliteStorageService`)，提供原生系统能力。

-----

## 🛠 技术栈

| 领域 | 技术选型 |
| :--- | :--- |
| **核心框架** | React 18, TypeScript 5.7 |
| **构建工具** | Vite 6, pnpm |
| **状态管理** | Jotai (原子化状态管理) |
| **UI 系统** | Tailwind CSS v3, Radix UI (无头组件), Lucide Icons |
| **编辑器引擎** | CodeMirror 6 (自研 Moondown 扩展) |
| **桌面运行时** | Tauri v2, Rust, SQLite |
| **AI 交互** | Native Fetch Streaming (流式传输) |

-----

## 🚀 快速开始

### 环境要求

* **Node.js**: v18.0.0 或更高版本。
* **pnpm**: v9.0.0+ (推荐)。
* **Rust**: (仅编译桌面端需要) [安装 Rust 环境](https://www.rust-lang.org/tools/install)。

### 安装指南

1.  **克隆代码仓库：**

    ```bash
    git clone https://github.com/your-org/tada.git
    cd tada
    ```

2.  **安装依赖：**

    ```bash
    pnpm install
    ```

### 启动开发环境

**Web 模式：**
启动浏览器开发服务器，适合快速开发 UI 和逻辑。

```bash
pnpm dev
# 访问地址: http://localhost:5173/tada/
```

**桌面模式 (Tauri)：**
启动原生应用程序窗口，调试 SQLite 和原生交互。

```bash
pnpm dev:desktop
```

-----

## 🔌 AI 配置说明

Tada 支持多种主流 AI 模型提供商。请在 **设置 > AI 设置** 中进行配置：

1.  **云端模型：** 支持 OpenAI, Anthropic (Claude), Google (Gemini) 等。填入您的 API Key 即可。
2.  **本地模型 (Ollama)：**
    * 确保本地已安装并运行 Ollama。
    * 在 Tada 设置中选择 **Ollama** 或 **自定义服务**。
    * 设置 Base URL 为 `http://localhost:11434`。

-----

## 📦 构建与部署

**构建 Web 版本：**
生成静态资源文件，可部署至 Netlify, Vercel 等平台。

```bash
pnpm build
# 产物目录: packages/web/dist
```

**构建桌面版本：**
通过 Tauri 编译生成各平台的安装包 (`.dmg`, `.exe`, `.deb`)。

```bash
pnpm build:desktop
```

-----

## 🤝 贡献代码

我们非常欢迎社区的贡献。如果您有好的想法或发现了 Bug：

1.  Fork 本仓库。
2.  创建您的特性分支 (`git checkout -b feature/NewFeature`)。
3.  提交您的更改 (`git commit -m 'Add NewFeature'`)。
4.  推送到分支。
5.  提交 Pull Request。

在提交之前，请确保通过代码规范检查：

```bash
pnpm lint
```

-----

## 📄 许可证

本项目采用 **Apache 2.0 许可证**。详情请参阅 [LICENSE](./LICENSE) 文件。