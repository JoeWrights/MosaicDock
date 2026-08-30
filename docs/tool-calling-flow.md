# 工具调用流程说明

本文说明 Mosaic Dock 中“用户提问如何触发工具调用”的整体链路。以用户输入“今天星期几”为例，系统并不是在后端硬编码匹配这句话，而是由模型基于工具描述自行决定是否调用工具。

## 核心机制

1. 前端只发送用户消息，例如“今天星期几”。
2. 后端根据当前会话、角色和插件配置，筛选当前可用的 tools。
3. 后端把可用工具的 `name`、`parameters/schema`、`description` 作为 `tools` 参数传给模型。
4. 模型根据用户问题和工具描述，决定是否发起 tool call。
5. 后端收到模型返回的工具名和参数后，在当前 `ToolRuntime` 中按工具名查找并执行对应 handler。
6. 工具执行结果会回灌给模型，模型再基于结果生成最终自然语言回复。

## 示例：当前时间工具

当用户问“今天星期几”时，模型会看到当前会话可用工具中包含 `get_current_time`。该工具由新插件体系注册：

```ts
// apps/api/src/modules/plugins/builtins/time.plugin.ts
api.registerTool({
  name: "get_current_time",
  description:
    "获取当前详细时间信息，包括日期、星期、时间、时区等。当用户询问当前时间、日期、星期几或时区信息时使用此工具。",
  // ...
});
```

因为 description 明确提到“日期、星期几、时间”，模型可能返回如下 tool call：

```json
{
  "name": "get_current_time",
  "arguments": {
    "format": "full"
  }
}
```

后端再根据 `name` 找到 `get_current_time` 的 handler 执行，拿到当前日期、星期、时间等信息，并把结果返回给模型继续生成回答。

## 工具并不覆盖所有问题

后端提供的 tools/plugins 只是模型的“可选外部能力”，不是所有回答的知识来源。对于模型自身已经具备的通用知识、编程概念或普通推理问题，模型可以直接回答，不需要调用工具。

例如用户问“指数退避重试”：

```text
用户：指数退避重试
```

这个问题通常不会触发 tool call，因为它属于通用编程知识。请求链路仍然会把当前可用 tools 一并传给模型，但模型会判断没有必要调用外部工具，直接基于自身知识和当前上下文生成解释。

可以把问题分为三类：

1. **模型自己能回答的问题**：概念解释、通用编程知识、普通推理。例如“指数退避重试是什么”。
2. **需要实时或外部状态的问题**：当前时间、日期、文件内容、命令执行结果、网页信息等。例如“今天星期几”。
3. **需要业务数据的问题**：项目文件、知识库、插件、定时任务、MCP 服务、会话状态等。

因此，工具的作用是补足模型“不知道实时状态、不能直接访问本地资源、不能执行外部动作”的部分。模型能直接回答的问题，不会也不应该强制使用工具。

## 当前使用的是新插件

当前运行链路使用的是新插件 `TimePlugin`：

```ts
// apps/api/src/modules/plugins/plugins.module.ts
await this.pluginManager.registerPlugin(this.moduleRef.get(TimePlugin));
```

旧文件 `apps/api/src/modules/tools/providers/time-tool.provider.ts` 仍然存在，但当前没有看到它被注册为 legacy provider：

```ts
// 只有出现类似调用时，旧 Provider 才会参与运行
pluginManager.registerLegacyProvider(timeToolProvider);
```

因此当前 `get_current_time` 的主要执行来源是：

```text
TimePlugin -> PluginApi.registerTool -> PluginManager -> ToolOrchestrator -> AgentEngine -> LLM tool call -> handler execute
```

## 异常场景：文本模型上传图片

当当前聊天模型不支持图片输入时，例如 `DeepSeek-V3.2` 被配置为纯文本模型，上传图片不会直接让模型“看到”图片。后端在构建消息上下文时会根据模型配置判断 `inputCapabilities` 是否包含 `image`：

1. 如果模型支持图片输入，图片文件会被读取并转成 `image_url` 多模态消息，直接传给模型。
2. 如果模型不支持图片输入，图片会降级成文本占位符，例如 `[图片ID：xxx]`。

在第二种情况下，模型只能根据图片 ID 尝试调用 `image_recognize` 工具。该工具会读取上传文件，并再调用系统配置的视觉辅助模型 `defaultVisualAssistantModelId` 来完成真正的图片识别。

常见现象：

- 聊天界面里出现多次“已识别图片”，但模型最后仍回复“无法调用图像识别”或要求用户提供图片路径。
- 模型知道应该调用 `image_recognize`，但工具参数格式、图片 ID 注入、工具启用状态或视觉辅助模型配置不正确。
- 当前聊天模型是 `DeepSeek-V3.2` 等文本模型时，上传图片本身只提供文件引用，不等价于模型具备视觉能力。

排查点：

1. 当前会话是否启用了 `image_recognition` 工具。
2. 系统设置中是否配置了 `defaultVisualAssistantModelId`。
3. 视觉辅助模型本身是否支持图片输入，例如 `gpt-4o`、Gemini 视觉模型、Qwen-VL 等。
4. 上传图片对应的文件记录是否为 `fileType = "image"`，并且物理文件仍存在。

## 关键代码位置

- 新时间插件：`apps/api/src/modules/plugins/builtins/time.plugin.ts`
- 图像识别插件：`apps/api/src/modules/plugins/builtins/image-recognition.plugin.ts`
- 图片消息降级/多模态转换：`apps/api/src/modules/chat/message-store.service.ts`
- 插件注册：`apps/api/src/modules/plugins/plugins.module.ts`
- 工具运行时构建：`apps/api/src/modules/tools/tool-orchestrator.service.ts`
- 工具上下文：`apps/api/src/modules/tools/tool-context.ts`
- LLM 调用传入 tools：`apps/api/src/modules/chat/agent-engine.service.ts`
- 会话上下文构建工具运行时：`apps/api/src/modules/chat/persistent-session-context.ts`

