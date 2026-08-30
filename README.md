# Mosaic Dock

Mosaic Dock 是一个基于 pnpm + Turbo 的 Monorepo AI Agent 平台，支持多模型供应商接入、插件化工具调用、多渠道 Bot 网关、知识库检索增强（RAG）、定时任务调度等能力，提供 Web 聊天界面与 RESTful / SSE API。

## 架构概览

```
mosaic-dock/
├── apps/
│   ├── web          # React 19 + Tailwind CSS 4 + Rsbuild 前端
│   └── api          # NestJS 11 + Prisma 7 + SQLite 后端
├── packages/
│   ├── shared       # 框架无关的业务类型与工具函数
│   ├── api-client   # HTTP / SSE / Chat Stream 客户端
│   └── config       # 共享配置（tsconfig 等）
└── docs/
```

## 核心能力

- **多模型接入** — 通过 `llm-core` 统一适配 OpenAI、Anthropic、Google、DeepSeek、Azure OpenAI、阿里百炼、火山引擎、Moonshot、Groq、智谱、MiniMax、百度千帆、硅基流动等 15+ 供应商
- **插件系统** — 内置 Shell、文件操作、浏览器、记忆、图像识别、Todo、时间等插件，支持通过 Plugin API 扩展 Agent 工具链
- **Bot 网关** — 统一适配 Discord、飞书、企业微信 AI Bot、QQ Bot、微信个人号等多渠道消息接入
- **知识库（RAG）** — 支持 PDF / Word / Excel 等文件解析、文本分块、向量化嵌入（sqlite-vec）与 OCR，实现检索增强生成
- **MCP 服务** — 集成 Model Context Protocol，将外部工具以标准化方式接入 Agent 引擎
- **Skill 系统** — 基于 YAML 定义的可编排技能，支持插件化注册与工具调用
- **Sub-Agent** — 支持子 Agent 编排，实现多 Agent 协作
- **定时调度** — 内置 Cron 任务调度器，支持定时触发 Agent 执行
- **角色管理** — 可配置 AI 角色人设，绑定会话实现个性化对话
- **多端认证** — JWT + Passport 鉴权，支持用户与团队隔离

## 技术栈

| 层级   | 技术                                                                  |
| ------ | --------------------------------------------------------------------- |
| 前端   | React 19, React Router 7, Tailwind CSS 4, Zustand, Tiptap, Rsbuild    |
| 后端   | NestJS 11, Prisma 7, better-sqlite3, sqlite-vec, Winston              |
| AI/LLM | OpenAI SDK, Anthropic SDK, Google Generative AI, tiktoken, pdfjs-dist |
| 工具链 | pnpm 10, Turbo, TypeScript 6, Vitest, Jest                            |

## 快速开始

### 安装依赖

```bash
pnpm install
pnpm --filter @mosaic-dock/api exec prisma generate
```

### 启动开发服务

```bash
# 同时启动前后端
pnpm dev

# 或分别启动
pnpm dev:web   # 前端 → http://localhost:5173
pnpm dev:api   # 后端 → http://localhost:3000
```

前端默认将 `/api/v1`、`/static`、`/uploads` 代理到 `http://localhost:3000`，可通过环境变量覆盖：

```bash
MOSAIC_DOCK_API_TARGET=http://localhost:3000 pnpm dev:web
```

### 数据库初始化

```bash
pnpm --filter @mosaic-dock/api db:seed        # 初始化种子数据
pnpm --filter @mosaic-dock/api db:verify       # 验证数据库状态
```

## 常用命令

```bash
pnpm build        # 构建所有包（Turbo 自动处理依赖顺序）
pnpm test         # 运行测试
pnpm typecheck    # 全量类型检查
pnpm lint         # 代码检查
```

## 部署

最小部署产物：

- **Web**: `apps/web/dist` — 静态资源，可用 Nginx 等服务托管
- **API**: `apps/api/dist` + `apps/api/prisma` + `apps/api/static` + 运行时数据目录

Docker 部署建议：

```dockerfile
# 构建阶段
RUN corepack enable && pnpm fetch --production
RUN pnpm --filter @mosaic-dock/api exec prisma generate
RUN pnpm build

# 运行阶段
CMD ["node", "apps/api/dist/main"]
```

> **注意**: Docker 构建需确保安装 `better-sqlite3`、`sharp`、`sqlite-vec`、`@node-rs/jieba` 等原生依赖的对应平台二进制。

## 文档

- [工具调用流程](docs/tool-calling-flow.md) — Agent 工具调用的完整链路说明

## License

Private — 内部项目
