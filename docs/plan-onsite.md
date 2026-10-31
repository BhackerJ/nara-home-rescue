# 黑客松现场计划：Nara Home Rescue 演示版

2026-10-30 · 作者 Brad（由 Claude 起草）· 第一稿

> **已作废（2026-10-31 12:58）**：13:00 之后的安排以 [plan-1h.md](./plan-1h.md) 为准。本文保留作为背景；§2 的保留/砍掉清单和 §3 的时间表都已被 plan-1h §2、§4 替换。

Brad 10-30 定：Brad 明天去现场，代码全部在现场写（10-31 11:00–16:00），只做用来演示的版本。原设计 [design-hackathon.md](./design-hackathon.md) 排了 10-27 到 10-30 四天的工作，这些都没有做；本文从中挑出 5 个小时写得完、台上讲得清楚的部分，其余的砍掉。架构、接口和三个依赖的实测结论仍以原设计为准，本文只写改了什么、几点做到哪一步、做不到时砍什么。

## 1. 演示讲的故事（不变）

homeowner 报修"空调不制冷" → 诊断 agent 读 Home Twin（里面有 2023 年换过电容的记录），给出诊断 → 派单 agent 通过 Agent Relay 向维修商 agent 请求时段 → **拔电源**：派单进程和 actor 进程同时被杀掉 → 一秒后两个进程回来，同一个工单从 actor 的 SQLite 里原样回来，派单 agent 从 Relay 上补拉到断电期间维修商发来的"时段已被占" → 接着协商、确认预约 → Home Twin 多一条维修记录。

三个赞助商的东西各干一件真活：durable-actors 存工单的进度和预约，Agent Relay 承载两个 agent 之间所有的消息，Supabase 存 Home Twin。

## 2. 保留和砍掉

**保留（缺一样故事就讲不通）：**

- `ServiceCase` actor：工单的进度点、事件日志、发件箱（原设计 §4）。去掉 revision 校验，其余照原设计。
- `ProviderCalendar` actor：时段和按 key 防重复预约。
- coordinator 和 provider 两个独立的 Node 进程，只通过本地的 `@relaycast/engine` 说话；启动时用 `messages.list` 补拉消息。
- supervisor（`npm run demo`）：起五个进程（actors、relay、web、coordinator、provider），进程退出 1 秒后重启；`/pull-plug` 同时 `SIGKILL` coordinator 和 actors。
- 诊断调一次 OpenAI，结构化输出，用 Nara 的 key。
- Supabase 的 `home_rescue` schema 和 `home_rescue_app` 角色（原设计 §6），三张表：`home`、`equipment`、`service_history`。
- 网页三块：Home Twin、报修表单（带"拔电源"勾选框）、工单页（事件时间线 + Recovery Monitor 断电横幅）。

**砍掉：**

| 原设计里的 | 现场版 | 理由 |
|---|---|---|
| 诊断流式输出 | 一次调用，等 2–4 秒，页面显示"正在诊断" | 省掉 partial JSON 解析；开场讲 Home Twin 时诊断已经在跑，等待被讲解盖住 |
| Supabase 的 `case_summary` 表 | 没结束的工单 id 存在一个 `CaseIndex` actor 里 | 少一张表；coordinator 重启后从 actor 找回工单 |
| "Pull the plug" 按钮和 `/api/demo/pull-plug` | 只留表单上的勾选框，固定在发出时段请求后拔 | Relay 回复只要 20 毫秒，手按按钮赶不上这个时机 |
| 自检页 `/preflight` | 上台前手动跑一遍完整流程 | 有空再加（§5） |
| 退避重试（1、2、4 秒…）和 20 次后标 `failed` | 固定每 200 毫秒重试，30 秒后标 `failed` | 演示只断几秒 |
| 托管版 Relay 切换 | 只用本地版 | 现场不切 |
| 分四段的备用视频 | 15:15 录一遍完整的 | 时间只够录一遍 |
| 两个自动化测试 | 一张人工 smoke 清单（§6） | 时间 |

## 3. 现场时间表（10-31）

| 时间 | Brad（后端） | Nagisa（前端） |
|---|---|---|
| 11:00–11:30 | 建 repo、装锁定版本的依赖、supervisor 起五个空进程；建 schema、角色、种子数据；**11:15 前给 Nagisa 一份 fixture JSON**（一个走完全程、中途拔过电源的工单） | 建页面骨架，按原设计 §7 的类型接 fixture |
| 11:30–13:00 | 正常流程：两个 actor、诊断、Relay 收发、预约、写回 `service_history` | Home Twin、报修表单、时间线（用 fixture） |
| **13:00 检查点一** | 不看前端，在终端里从报修到确认走通一遍 | 三块页面在 fixture 上能看 |
| 13:00–14:00 | 拔电源和恢复：`plug_pulled`、`recovery_started`、补拉、不重做已完成的步骤 | Recovery Monitor、断电横幅和计时 |
| **14:00 检查点二** | 拔电源后同一工单恢复并走完，预约只有一条 | 接上真接口 |
| 14:00–14:45 | 联调；修只在联调里暴露的问题 | 联调；视觉收尾 |
| 14:45–15:15 | 彩排三遍，只修让演示卡住的问题 | 同左，练讲稿 |
| 15:15–15:35 | 录一遍完整演示（备用视频） | 同左 |
| 15:35–15:50 | 写 Devpost，交 repo 链接和视频 | 同左 |
| 15:50 | **提交**。16:00 截止，留 10 分钟余量 | |

## 4. 检查点没过时砍什么

**13:00 正常流程没走通**，按顺序砍，砍到能走通为止：

1. 诊断换成固定文本，不调 OpenAI；
2. 不写回 `service_history`，Home Twin 不更新；
3. `ProviderCalendar` 改成 provider 进程里的内存变量（provider 不会被杀，不影响恢复）。

Relay 和 `ServiceCase` actor 不砍：砍了就没有赞助商的东西可讲。

**14:00 拔电源恢复没做通**：只杀 coordinator，不杀 actor。故事变成"派单 agent 死掉，从 actor 和 Relay 上接着干"，仍然讲得通，只是少了 actor 从 SQLite 回来那一段。

## 5. 有空再加（按顺序）

1. 自检页（原设计 §10）；
2. 诊断流式输出；
3. 同一个 key 预约两次只有一条的自动化测试。

## 6. smoke 清单（14:45 彩排时逐条过）

1. 打开 Home Twin，看得到 Carrier 室外机和两条历史记录。
2. 提交报修并勾上"拔电源"，诊断里提到电容。
3. 断电横幅出现、开始计时；一两秒后两个进程的 pid 都变了。
4. 恢复后时间线里出现维修商的"时段已被占"，诊断没有重做。
5. 确认预约；Home Twin 多一条记录；`ProviderCalendar` 里只有一条预约。
6. 连跑两个工单，第二个不受第一个影响。

## 7. 今晚要做的准备（都不是产品代码）

1. **升级 Bun**：本机是 1.3.11，durable-actors 要求 ≥ 1.4.2（`bun upgrade`）。Node 是 24，满足 Relay SDK 要的 ≥ 22。
2. **版本照原设计锁死**：durable-actors `0.12.2`、`@agent-relay/sdk 14.0.0`、`@relaycast/engine 11.0.0`。三个库 10-30、10-31 又发了新版（0.14.6、12.3.0），原设计 §2 的实测是在旧版本上做的，现场不升级。旧版本 10-30 查过仍可安装。
3. **和 Nagisa 对齐**，下面三件事她不点头，明天就会卡住：
   - 她的前端做到了哪一步；
   - 前端照原设计 §7 的接口写，去掉 `/api/preflight` 和 `/api/demo/pull-plug`；
   - repo 放在哪：Brad 的 GitHub 账号不能在 Nara-Labs 下建 repo，要她今晚建好 `Nara-Labs/nara-home-rescue` 并给 Brad 写权限。
4. **演示用 Brad 的 Mac**。原设计定在 Nagisa 的 Mac 上，是因为 Brad 不在现场；现在后端在 Brad 的电脑上写，就在这台上跑。
5. **明早出门前**打开一次 Supabase 的 `nara-preview`：10-30 发现它闲置一周后被自动暂停过。
6. 带手机热点，充好电。

## 8. 还没定的

- 3 分钟讲稿谁讲、谁操作电脑：Nagisa 10-27 说过讲解很重要。
- 现场如果另外发 OpenAI credits，要不要换用：原设计 §9 定的是留作备用，本文不变。
