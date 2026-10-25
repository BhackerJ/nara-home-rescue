# 黑客松技术设计：Nara Home Rescue

2026-10-25 · 作者 Brad（由 Claude 起草）· 第二稿：§12 的五个问题 Brad 10-25 已定，等 Nagisa 看过后定稿，定稿前不写代码

Nara 入选了 YC Haunted Hacks（2026-10-31，旧金山 YC 办公室，16:00 截止提交）。产品需求按 Nagisa 10-25 发在 Discord #engineering 的 PRD（"Nara Home Rescue"，下称 PRD）。本文定的是：PRD 里的 P0 功能分别落在 durable-actors、Agent Relay 和 Supabase 的哪一部分，前后端之间的接口，以及到 10-31 的排期。主办方已经同意 Brad 提前写代码。

## 1. 要拿的奖和由此来的约束

- 评委看两样：用 Terse 的 durable-actors，用 Agent Relay，两个都用有加分。另外有单项奖：durable-actors 用得最好的拿 iPhone，Agent Relay 用得最好的拿 Mac mini，Supabase 给"最可能扩展到百万用户"的项目 1000 美元 credits。三个单项奖都争（Brad 10-25 定）。
- 所以三样东西都必须承担真实的工作，不能只是接上去摆样子。本设计里，工单的状态、进度点和防重复预约放在 durable-actors；agent 之间的每一条消息走 Agent Relay；Home Twin 和给浏览器的实时推送放在 Supabase。
- PRD 要求恢复过程显示的必须是后端真实发生的事件。所以 worker 是真的被杀掉、真的重启，界面上看到的每一步都来自 actor 里存下的事件，不放动画。
- Brad 不在现场，demo 由 Nagisa 在现场用她的 Mac 跑。所以整套东西要能在一台电脑上一条命令启动，出问题时有备用录屏。

## 2. 三个依赖里我们用到的事实

2026-10-25 读代码、跑实测得到的结论。版本都锁死，因为这几个库这个月都在频繁发版。

**durable-actors `0.12.2`**（npm `durable-actors`，MIT）

- actor 跑在 Bun（≥ 1.4.2）里，本地用 `bunx durable-actors dev`，监听 `127.0.0.1:7100`，每个 actor 一个 SQLite，不需要 Postgres。
- actor 是一个 class，公开的 async 方法就是可以远程调用的方法；用 `actors.ServiceCase.get(id)` 按 id 找到它。Next.js 的 route handler 和 runner 都通过生成的 client 走 HTTP 调用。
- 没加 `@Atomic` 的方法里，每次给 `@Persisted` 字段赋值都立刻落盘。数组和对象必须整个重新赋值，`push` 不会保存。文档说的是"方法成功返回后保存"，和代码不一致，以代码为准。
- **没有 step、checkpoint、workflow 这类功能。** 进程在方法执行中途崩溃时，调用方拿到 `outcome_unknown`，崩溃前写下的数据还在，但没做完的工作不会自动继续，要由我们自己重新驱动。
- 普通方法在 await 的整段时间里会占住这个 actor，其他调用（包括读状态）都要排队。所以 actor 的方法里不调 LLM。
- 后台任务不会让 actor 保持活跃，空闲 10 秒就被回收。本地模式下 alarm 只存在内存里，进程重启就没了。

**Agent Relay `@agent-relay/sdk 14.0.0`**（Node ≥ 22，只有 ESM）

- 用官方托管服务，不需要注册和 API key：`createWorkspace` 直接返回一个 workspace key。
- 它依赖的 `@relaycast/sdk` 写的是 `^8.0.7`，实测装到的是 8.16.0，行为已经和文档不一样（见下面最后一条）。所以 lockfile 必须提交，两个包都锁版本。
- 每个 agent 有一个身份，用 `sendMessage` 发消息到 channel 或者私信，用 `addListener` 经 WebSocket 收消息。消息会持久保存，可以用 `messages.list` 读回来；有一个只读的观察页，可以给评委看。
- 监听要一个一直运行的进程，Vercel 的 serverless 函数做不了。
- 发一条 channel 消息要 1.6–3.5 秒，私信 4.6–7 秒。一次性发太多会被限流（同时发 30 条，只成功 6 条）。所以消息要一条一条发，整个协商过程会多出十几到几十秒，demo 的讲解要把这段时间填上。
- 收到的事件里没有时间戳，时间由我们自己记。私信事件里没有收件人。所以消息都发在 channel 里，收件人写在消息内容里。
- **`idempotencyKey` 会去重**（10-25 实测）：同一个 key、同样的内容再发一次，返回同一个 message id，channel 里只有一条；换一个新进程用同一个 agent 发也一样。同一个 key、内容不同，直接报 409 `idempotency_key_reused`。所以恢复后不能重新调 LLM 生成一条新消息用老 key 发，必须原样重发崩溃前那一条（§4 的发件箱）。
- **同名 agent 不能重复注册**（10-25 实测）：文档说重复注册会接管原来的身份，但 8.16.0 里这个功能已经废弃，第二次注册直接报 409 `agent_already_exists`。所以 runner 第一次注册时把三个 agent 的 token 存下来，之后每次启动都用 `workspace.reconnect({ apiToken })` 接回原来的身份（实测可用）。

**Supabase**：用法见 §6。

## 3. 总体结构

一台电脑上跑三个进程，外加两个托管服务：

```
浏览器 ──HTTP──▶ web（Next.js，Nagisa）
   ▲                │  生成的 actor client（HTTP）
   │                ▼
   │          actors（Bun，durable-actors dev :7100）
   │          ├─ ServiceCase       每个工单一个：状态、进度点、发件箱、事件日志
   │          └─ ProviderCalendar  模拟的维修商排期 API，按幂等 key 防重复预约
   │                ▲
   │                │  读进度、写进度
   │          runner（Node 22，一直运行，被 supervisor 重启）
   │          ├─ diagnostic / dispatch / provider 三个 agent
   │          ├─ 调 OpenAI；agent 之间互相发消息 ──▶ Agent Relay（托管）
   │          └─ 把 actor 里的事件同步过去 ──▶ Supabase（托管）
   │                                            ├─ Home Twin：home、设备、维修历史
   │                                            └─ case_summary、case_event（actor 的副本）
   └──────────── Realtime 推送 case_event ──────────┘
```

分工原则：

- **ServiceCase actor 是工单流程唯一的真相来源。** 走到哪一步、每一步的结果、每条 agent 消息，都以 actor 里存的为准。
- **runner 是执行者，自己不留任何不能从 actor 里重建的状态。** 它被杀掉再起来，读一遍 actor 就知道从哪里继续。唯一例外是三个 agent 的 Relay token，存在本地一个不提交的文件里（§2）。
- **Supabase 里的工单数据是 actor 的副本。** 两边对不上时以 actor 为准，由 runner 补齐（§6）。
- 为什么不让 actor 自己去调 LLM、驱动流程：§2 说过，actor 在 await 时会锁住，崩溃后不会自动继续，后台任务也会被回收。这正是 PRD 第 5 节提醒的区别：工单记录持久保存了，不等于正在执行的流程能接着跑。所以执行和记录分开，进度点放在记录这一边。

## 4. 流程和进度点

一个工单按顺序走下面这几步。每一步做完，先写进 ServiceCase，再往下走。

| # | 进度点 `checkpoint` | 谁做 | 做什么 | Relay 消息 | `status` |
|---|---|---|---|---|---|
| 0 | `created` | web | homeowner 提交报修，`ServiceCase.create` | 无 | `created` |
| 1 | `diagnosed` | diagnostic | 读 Supabase 里的设备和历史，加上症状，调 LLM 产出结构化的问题摘要 | diagnostic → dispatch：问题摘要 | `diagnosing` |
| 2 | `slot_requested` | dispatch | 按 homeowner 选的时间向维修商请求时段 | dispatch → provider：请求 | `dispatching` |
| 3 | `slot_rejected` | provider | 查 `ProviderCalendar`：请求的时段已被占（种子数据故意这样设），返回两个替代时段 | provider → dispatch：拒绝 + 替代时段 | `awaiting_provider` |
| 4 | `slot_accepted` | dispatch | 在替代时段里选一个 | dispatch → provider：接受 | `negotiating` |
| 5 | `booked` | provider | `ProviderCalendar.book(slot, key = "<caseId>:book")`，返回确认 | provider → dispatch：确认 | `negotiating` |
| 6 | `home_updated` | runner | 往 Supabase 的 `service_history` 写一条，`case_id` 唯一，同一个工单只写一次 | 无 | `confirmed` |

中断恢复期间 `status` 是 `recovering`，出错不可继续时是 `failed`。这些状态就是 PRD 第 6 节的 `CaseStatus`。

runner 执行每一步的固定顺序：

1. 读 ServiceCase。这一步已经完成，就跳过。
2. 发件箱里已经有这一步的消息（上次写好了，没来得及确认发出就崩了），跳到第 4 步，不再调 LLM。
3. 调 LLM 得到这一步的结果，连同要发的消息原文一起写进 `ServiceCase.stageStep({ step, expectedRevision, result, message })`。这就是发件箱。
4. 用 `idempotencyKey = "<caseId>:<step>"` 原样发出发件箱里的消息，拿到 `messageId`。
5. 调 `ServiceCase.completeStep({ step, relayMessageId })`，清掉发件箱。已经完成过的步骤直接返回之前存下的结果，不会写第二遍。
6. 把 actor 里新增的事件同步到 Supabase（§6）。
7. 如果这一步被设成了中断点，`process.exit(1)`。

在任何一处崩溃，恢复后都不会出现重复：第 3 步之前崩，LLM 重新调一次，因为什么都还没发出去；第 3 步之后崩，发件箱原样重发，Relay 按 key 返回原来那条消息；第 5 步之后崩，这一步已经完成，直接跳过。预约本身另由 `ProviderCalendar` 按 key 防重复。

## 5. 中断和恢复（PRD Screen 03）

- **触发：** 界面上的 "Interrupt worker" 按钮调 `POST /api/cases/:id/interrupt`，写入 `ServiceCase.armInterrupt(step)`。默认中断点是第 3 步之后：维修商已经拒绝，dispatch 还没回复。runner 做完这一步，在 actor 里记下 `interrupt_fired` 事件，然后真的退出进程。
- **重启：** `runner/supervise.sh` 发现进程退出后等 3 秒再拉起来。这 3 秒是故意留的，让观众看清 worker 确实断了。
- **恢复：** 新进程启动时生成一个 `bootId`，用存下的 token 接回三个 agent 的 Relay 身份，从 Supabase 的 `case_summary` 查出所有没结束的工单，逐个调用 `ServiceCase.beginRecovery(bootId)`。actor 记下 `recovery_started { fromCheckpoint, previousBootId }`，把 `status` 设成 `recovering`。runner 先把 actor 里还没同步到 Supabase 的事件补齐，再按 §4 的循环从第一个没完成的步骤继续。前面的诊断不会重做，intake 也不会重来。
- `case_summary` 本身也可能因为崩溃而落后。为此，`POST /api/cases` 在调 `ServiceCase.create` 之后、返回之前，先写好 `case_summary`。这样工单从一开始就能被找到，之后的状态以 actor 为准。
- **Recovery Monitor 显示的内容全部来自 actor 的事件：** 当前 worker 的 `bootId` 和 pid、最后一个进度点、中断事件、恢复事件，以及恢复后完成的第一步。
- P1：再加一种更狠的中断，把 durable-actors 的进程本身杀掉重启，展示 SQLite 里的状态还在。§2 说过本地模式的 alarm 只在内存里，所以这个场景不依赖 alarm。

## 6. Supabase

为了 Supabase 的"最可能扩展到百万用户"奖，也因为 Nara 正式产品本来就用 Supabase。分工：

- **Home Twin 放在 Supabase**：`home`、`equipment`、`service_history` 三张表。这类数据要跨工单查询，以后还要按 home 做权限，是 Postgres 擅长的事。每个工单的流程状态放在各自的 actor 里，互不影响，工单再多也只是多几个 actor。这就是 Devpost 上讲扩展性的说法：流程状态按工单分散在 actor 里，跨工单的数据集中在 Postgres，推送交给 Realtime。
- **工单数据在 Supabase 里有一份副本**：`case_summary`（每个工单一行：home、status、checkpoint）和 `case_event`（每个事件一行，`(case_id, seq)` 唯一）。runner 用 upsert 写入，重复写不会多出行。崩溃后 runner 比较 actor 和 Supabase 里各自最新的 `seq`，把缺的补上。
- **实时推送用 Supabase Realtime**：浏览器订阅 `case_event` 里本工单的新行。这比轮询省事，也让 Supabase 承担一件评委看得见的事。Realtime 断了就退回每秒拉一次 `GET /api/cases/:id`。
- **权限**：浏览器用 anon key，只能读 demo home 的数据；所有写入走服务端（runner 和 Next.js route handler），用 service role key。
- **项目**：新开一个 Supabase 项目，不碰 Nara 正式产品用的 `nara-preview`。现场每人有 25 美元 Supabase credits。开在谁的账号下见 §12。

## 7. 前后端接口（Nagisa 按这个写前端）

类型沿用 PRD 第 6 节的 `ServiceCase` 和 `CaseEvent`，`CaseEvent` 加一个 `seq`（从 1 递增），另加：

```ts
interface Home {
  id: string;
  label: string;                 // "Demo Home · Palo Alto"
  equipment: Equipment[];
  history: HistoryEntry[];       // 新工单确认后会多一条
}
interface Equipment { id: string; type: string; brand: string; model: string; installedYear: number }
interface HistoryEntry { date: string; summary: string; caseId?: string }

// CaseEvent.type 的取值和 payload：
//   "agent_message"    { from, to, kind, body, relayMessageId }   kind: summary | slot_request | reject | accept | confirm
//   "step_completed"   { step, revision }
//   "interrupt_fired"  { step, bootId, pid }
//   "recovery_started" { fromCheckpoint, previousBootId, bootId, pid }
//   "booking"          { providerId, slot, idempotencyKey }
//   "home_updated"     { historyEntry }
```

接口（Next.js route handler，都在服务端调用）：

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/home/:id` | 首页：设备卡片和维修历史（读 Supabase） |
| POST | `/api/cases` | 报修：`{ homeId, issue, symptoms, preferredSlot }` → `{ caseId }` |
| GET | `/api/cases/:id` | 整个 `ServiceCase`，包含全部 `events`（读 actor，是准的那一份） |
| POST | `/api/cases/:id/interrupt` | 设中断点 |
| GET | `/api/relay/observer` | 返回 Relay 只读观察页的链接，评委可以点开看消息确实在 Relay 上 |

实时更新：页面第一次打开先拉一次完整的 `ServiceCase`，之后订阅 Supabase Realtime 的 `case_event`（§6）追加；Realtime 断了就每秒拉一次 `GET /api/cases/:id`。

前端可以先用一份 fixture JSON（一个走完全部步骤、包含一次中断恢复的工单）开发，不用等后端。这份 fixture 由 Brad 和本文一起提供。

## 8. Demo 数据

- 一个 home：`Demo Home · Palo Alto`，一台 2014 年装的 Carrier 室外机（用真实存在的型号），两条历史记录：2023 年换过电容，2025 年春天做过保养。
- 一个维修商：`Bay Comfort HVAC (simulated)`。排期里 homeowner 首选的时段已经被占，另有两个空时段。
- 报修内容："My AC isn't cooling."，症状：风扇在转，出风不冷，室外机不转。诊断应当提到电容，因为历史里换过。这一点用来展示 agent 确实读了 Home Twin。

## 9. LLM

- 用 OpenAI，结构化输出用 JSON schema 约束。三个 agent 各一个 system prompt。
- 开发和现场都用 Nara 现有的 OpenAI key（Brad 10-25 定），放进本 repo 不提交的 `.env`。现场发的 100 美元 credits 留作备用。
- 每一步只调一次 LLM。调用失败重试两次，还失败就把工单设成 `failed`，界面上显示出来，不假装成功。

## 10. 现场

- Nagisa 在现场用她的 Mac 跑：`npm run demo` 同时起 actors、runner（带 supervisor）、web 三个进程。事先装好 Bun 和 Node 22。
- Agent Relay 和 Supabase 都是托管服务，需要现场网络。备用方案：录一段完整的 demo 视频，网络不行就放视频。P1：本地跑 `@relaycast/engine`，Relay 部分不再依赖网络。
- Brad 11:00–16:00 远程在线，随时处理问题。

## 11. 排期

| 日期 | Brad | Nagisa |
|---|---|---|
| 10-26（日） | 和 Nagisa 一起定稿本文；交 fixture JSON | 定稿；建 repo 和 Supabase 项目；搭前端骨架 |
| 10-27 | actors：ServiceCase、ProviderCalendar；Supabase 表和种子数据；测试（防重复、revision、恢复） | 四个页面接 fixture |
| 10-28 | runner：三个 agent、Relay、prompt；正常流程跑通 | 继续页面，接 `GET /api/home`、`POST /api/cases` |
| 10-29 | 中断、supervisor、恢复、Supabase 副本补齐 | 接 Realtime 和 Recovery Monitor |
| 10-30 | 在 Nagisa 的电脑上完整彩排，录备用视频，写 Devpost 草稿 | 同左 |
| 10-31 | 远程在线 | 现场 demo |

10-29 Brad 可能有 Agentic AI Day 的 demo（如果申请通过），那天的工作会挪到 10-30 上午。

验收用 PRD 第 7 节的 10 条。其中前 9 条写成自动化测试，在 runner 和 actors 上跑；第 10 条（Devpost、录屏、repo）在 10-30 人工检查。

## 12. 已定和待定的问题

已定（Brad 10-25）：

1. 代码放在新 repo `Nara-Labs/nara-home-rescue`，不进 nara-agent。Brad 的 GitHub 账号没有在 Nara-Labs 下建 repo 的权限，要 Nagisa 建好后给 Brad 写权限。在那之前，本文在 Brad 本地的 `~/nara-home-rescue`。
2. 现场是 Nagisa，用她的 Mac。
3. OpenAI 用 Nara 现有的 key。
4. Relay 的 `idempotencyKey` 会去重，已实测，结论写在 §2，设计按它改成了发件箱（§4）。
5. 争 Supabase 的奖，设计见 §6。

待定：

1. Supabase 项目开在谁的账号下？建议开在 Nagisa 的账号下，和 repo 一样归 Nara 团队，Brad 作为成员。
