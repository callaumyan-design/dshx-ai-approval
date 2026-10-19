# dshx-ai-approval

> Adds an "AI approval" permission preset to DeepSeek Harness: one-time sandbox escalations are first reviewed by an LLM; only the ones it rejects reach you.

给 DSH 增加一个 **「由 AI 审批」** 权限预设：工作区内照常操作，越权操作（一次性沙箱提权）先交给一个 AI 审核模型判断。

- AI 回答 **ALLOW** → 直接放行；
- AI 回答 **DENY**、超时或出错 → 照常弹给你人工审批，不会因为 AI 出问题而自动放行。

沙箱、权限策略和审批记录仍由 DSH 自己负责，插件只在 DSH 现有的审批通道前面加一层自动审核。

## 用法

1. 安装后重启，新会话默认使用「由 AI 审批」预设（在设置里另选默认权限时以你的选择为准）；
2. 在 **设置 → AI 审批** 里选择审核用的 provider / model，可再配置一个备用审核模型（主模型报错、冷却或答非所问时使用），并可一键测试连通性；
3. 每次审核记录在 `~/.dsh/dshx-ai-approval.log`（设 `DSHX_AI_APPROVAL_NO_LOG=1` 关闭）。

## 配置（`cordis.patch.yml`）

| 字段 | 默认 | 说明 |
|---|---|---|
| `provider` / `model` | 空（用默认模型） | 审核模型 |
| `fallbackProvider` / `fallbackModel` | 空 | 备用审核模型 |
| `systemPrompt` | 空（用内置规则） | 自定义审核规则 |

> 注意：本插件的 patch 会重写 `permission` 行的预设列表（保留内置三档并新增 `ai-approval`）。如果你自己也改过权限预设，请安装后检查。

## 安装

```sh
# Web profile
dsh plugin --profile web add github:callaumyan-design/dshx-ai-approval
# Desktop（用 DSH Desktop 自带的 dsh 命令，先从托盘完全退出 Desktop）
dsh plugin --profile desktop add github:callaumyan-design/dshx-ai-approval
```

安装后重启 DSH。卸载：`dsh plugin --profile <profile> remove dshx-ai-approval`。

## 兼容性

在 DeepSeek Harness 0.2.0-rc.2（desktop / web profile）上开发和使用。纯 JavaScript，无构建步骤，无安装脚本。

## License

MIT
