# 黑客松技术设计：Nara Home Rescue

2026-10-25 · 作者 Brad（由 Claude 起草）· 第三稿：按 10-25 的审稿意见改过，Brad 已定；等 Nagisa 看过后定稿，定稿前不写代码

Nara 入选了 YC Haunted Hacks（2026-10-31，旧金山 YC 办公室，16:00 截止提交）。产品需求按 Nagisa 10-25 发在 Discord #engineering 的 PRD（"Nara Home Rescue"，下称 PRD）。本文定的是：PRD 里的 P0 功能分别落在 durable-actors、Agent Relay 和 Supabase 的哪一部分，前后端之间的接口，以及到 10-31 的排期。主办方已经同意 Brad 提前写代码。

## 1. 要拿的奖和由此来的约束

- 评委看两样：用 Terse 的 durable-actors，用 Agent Relay，两个都用有加分。另外有单项奖：durable-actors 用得最好的拿 iPhone，Agent Relay 用得最好的拿 Mac mini，Supabase 给"最可能扩展到百万用户"的项目 1000 美元 credits。三个单项奖都争。
- 所以三样东西都必须承担真实的工作，评委一问就能答上来它在干什么：
  - durable-actors：工单的状态、进度点、发件箱和防重复预约都在 actor 里。demo 里会把跑 actor 的进程杀掉，再让同一个 actor 从它的 SQLite 里回来。
  - Agent Relay：派单 agent 和维修商 agent 是两个独立的进程，只通过 Relay 上的消息往来。维修商是收到消息才行动的，不是被同一个程序按顺序调用的。
  - Supabase：Home Twin（home、设备、维修历史）放在 Postgres 里，跨工单的数据集中在这里。
- PRD 要求恢复过程显示的必须是后端真实发生的事件。所以进程是真的被杀掉、真的重启，界面上看到的每一步都来自 actor 里存下的事件，不放动画。
- Brad 不在现场，demo 由 Nagisa 在现场用她的 Mac 跑。所以整套东西要能在一台电脑上一条命令启动，出问题时有备用录屏。

## 2. 三个依赖里我们用到的事实

2026-10-25 读代码、跑实测得到的结论。版本都锁死，lockfile 提交，因为这几个库这个月都在频繁发版。

**durable-actors `0.12.2`**（npm `durable-actors`，MIT）

- actor 跑在 Bun（≥ 1.4.2）里，本地用 `bunx durable-actors dev`，监听 `127.0.0.1:7100`，每个 actor 一个 SQLite，不需要 Postgres。写代码时要确认 SQLite 落在一个固定的磁盘路径上，重启后还在，并把这个路径写进启动脚本。
- actor 是一个 class，公开的 async 方法就是可以远程调用的方法；用 `actors.ServiceCase.get(id)` 按 id 找到它。Next.js 的 route handler 和两个 runner 都通过生成的 client 走 HTTP 调用。
- 没加 `@Atomic` 的方法里，每次给 `@Persisted` 字段赋值都立刻落盘。数组和对象必须整个重新赋值，`push` 不会保存。文档说的是"方法成功返回后保存"，和代码不一致，以代码为准。
- **没有 step、checkpoint、workflow 这类功能。** 进程在方法执行中途崩溃时，调用方拿到 `outcome_unknown`，崩溃前写下的数据还在，但没做完的工作不会自动继续，要由我们自己重新驱动。
- 普通方法在 await 的整段时间里会占住这个 actor，其他调用（包括读状态）都要排队。所以 actor 的方法里不调 LLM，不调 Relay。
- 后台任务不会让 actor 保持活跃，空闲 10 秒就被回收。本地模式下 alarm 只存在内存里，进程重启就没了。所以不用 alarm。

**Agent Relay `@agent-relay/sdk 14.0.0`**（Node ≥ 22，只有 ESM）

- 用官方托管服务，不需要注册和 API key：`createWorkspace` 直接返回一个 workspace key。
- 它依赖的 `@relaycast/sdk` 写的是 `^8.0.7`，实测装到的是 8.16.0，行为已经和文档不一样（见下面最后一条）。
- 每个 agent 有一个身份，用 `sendMessage` 发消息到 channel 或者私信，用 `addListener` 经 WebSocket 收消息。消息会持久保存，可以用 `messages.list` 读回来；有一个只读的观察页，可以给评委看。
- 监听要一个一直运行的进程，Vercel 的 serverless 函数做不了。
- 发一条 channel 消息要 1.6–3.5 秒，私信 4.6–7 秒。一次性发太多会被限流（同时发 30 条，只成功 6 条）。所以消息一条一条发，进程重启也不能太频繁地重连。
- 收到的事件里没有时间戳，时间由我们自己记。私信事件里没有收件人。所以消息都发在 channel 里，收件人写在消息内容里。
- **`idempotencyKey` 会去重**（10-25 实测）：同一个 key、同样的内容再发一次，返回同一个 message id，channel 里只有一条；换一个新进程用同一个 agent 发也一样。同一个 key、内容不同，直接报 409 `idempotency_key_reused`。所以重发必须原样重发崩溃前那一条（§4 的发件箱）。
- **同名 agent 不能重复注册**（10-25 实测）：文档说重复注册会接管原来的身份，但 8.16.0 里这个功能已经废弃，第二次注册直接报 409 `agent_already_exists`。所以第一次注册时把 agent 的 token 存下来，之后每次启动都用 `workspace.reconnect({ apiToken })` 接回原来的身份（实测可用）。

**Supabase**：用 Nara 现有的 `nara-preview` 项目（§6）。从 Brad 的 Mac 直连主机只有 IPv6，要走 session pooler（`aws-0-us-east-1.pooler.supabase.com:5432`，用户名 `<角色>.<project ref>`），pooler 的证书链是自签的，要设 `DATABASE_SSL=insecure`，和 Nara 正式产品的连法一样。Supabase 给新表自动开 RLS；我们的角色只在自己的 schema 里，表都由服务端读写，所以在这个 schema 里关掉 RLS。

## 3. 总体结构

一台电脑上跑四个进程，外加两个托管服务：

```
浏览器 ──每秒拉一次──▶ web（Next.js，Nagisa）
                         │  生成的 actor client（HTTP，带重试）
                         ▼
                   actors（Bun，durable-actors dev :7100；可被 demo 杀掉重启）
                   ├─ ServiceCase       每个工单一个：状态、进度点、发件箱、事件日志
                   └─ ProviderCalendar  维修商的排期：时段、按幂等 key 防重复预约、已处理的消息
                         ▲                      ▲
                         │                      │
      coordinator（Node 22，supervisor 重启）    provider（Node 22，supervisor 重启）
      ├─ diagnostic agent：调 OpenAI 诊断        └─ 收到 Relay 消息才行动：查排期、拒绝、确认
      └─ dispatch agent：请求时段、选时段               ▲
                │                                      │
                └────────── Agent Relay（托管）──────────┘
                              channel 里的每一条消息

      Supabase（托管）：home、equipment、service_history；case_summary（哪些工单没结束）
```

分工原则：

- **ServiceCase actor 是工单流程唯一的真相来源。** 走到哪一步、每一步的结果、每条 agent 消息，都以 actor 里存的为准。网页显示的也是它。
- **coordinator 和 provider 是执行者，自己不留任何不能从 actor 和 Relay 里重建的状态。** 被杀掉再起来，读一遍 actor、拉一遍 Relay 上的消息，就知道从哪里继续。唯一例外是 agent 的 Relay token，存在本地一个不提交的文件里。
- **两个 runner 之间只通过 Relay 说话，不共享内存、不互相调用。** 派单 agent 发出请求后就等，等到维修商的回复才往下走。
- 为什么不让 actor 自己去调 LLM、驱动流程：§2 说过，actor 在 await 时会锁住，崩溃后不会自动继续，后台任务也会被回收。这正是 PRD 第 5 节提醒的区别：工单记录持久保存了，不等于正在执行的流程能接着跑。所以执行和记录分开，进度点放在记录这一边。

## 4. 流程和进度点

一个工单按顺序走下面这几步。只有第 1 步用 LLM；第 2 到第 5 步是查排期和在两个时段里选一个，消息用模板生成。

| # | 进度点 `checkpoint` | 谁做 | 做什么 | Relay 消息 | 之后的 `status` |
|---|---|---|---|---|---|
| 0 | `created` | web | homeowner 提交报修，`ServiceCase.create`，写 `case_summary` | 无 | `created` |
| 1 | `diagnosed` | diagnostic | 读 Supabase 里的设备和历史，加上症状，调 LLM 产出结构化的问题摘要 | diagnostic → dispatch：问题摘要 | `diagnosing` → `dispatching` |
| 2 | `slot_requested` | dispatch | 带着问题摘要，按 homeowner 选的时间向维修商请求时段 | dispatch → provider：请求 | `awaiting_provider` |
| 3 | `slot_rejected` | provider，收到请求后 | 查 `ProviderCalendar`：请求的时段已被占（种子数据故意这样设），返回两个替代时段 | provider → dispatch：拒绝 + 替代时段 | `negotiating` |
| 4 | `slot_accepted` | dispatch，收到拒绝后 | 在替代时段里选一个 | dispatch → provider：接受 | `awaiting_provider` |
| 5 | `booked` | provider，收到接受后 | `ProviderCalendar.book(slot, key = "<caseId>:book")`，返回确认 | provider → dispatch：确认 | `negotiating` |
| 6 | `home_updated` | coordinator，收到确认后 | 往 Supabase 的 `service_history` 写一条，`case_id` 唯一 | 无 | `confirmed` |

中断恢复期间 `status` 是 `recovering`，出错不可继续时是 `failed`。这些状态就是 PRD 第 6 节的 `CaseStatus`。第 3 步和第 5 步的进度点由 coordinator 在收到维修商的消息时写入；维修商自己不写 ServiceCase，它的记录在 `ProviderCalendar` 里。

**coordinator 发一条消息的固定顺序**（第 1、2、4 步）：

1. 读 ServiceCase。这一步已经完成，就跳过。
2. 发件箱里已经有这一步的消息（上次写好了，没来得及确认发出就崩了），跳到第 4 步。
3. 算出这一步的结果（第 1 步调 LLM，其他步按模板），连同要发的消息原文一起写进 `ServiceCase.stageStep({ step, expectedRevision, result, message })`。这就是发件箱。
4. 用 `idempotencyKey = "<caseId>:<step>"` 原样发出发件箱里的消息，拿到 `messageId`。
5. 调 `ServiceCase.completeStep({ step, relayMessageId })`，清掉发件箱，`status` 改成"等维修商"。
6. 如果中断已经预设，`process.exit(1)`（§5）。

**coordinator 等一条回复**（第 3、5 步）：Relay 的 listener 收到 channel 里发给 dispatch、`caseId` 匹配、种类匹配的消息，就调 `ServiceCase.completeStep({ step, relayMessageId, received })`，然后继续下一步。启动时先用 `messages.list` 把 channel 里最后一个已记录的 `relayMessageId` 之后的消息拉一遍，补上死掉期间到达的回复，再开始监听。

**provider 处理一条消息**（第 3、5 步）：

1. listener 收到发给 provider 的消息。先调 `ProviderCalendar.claim(messageId)`：已经处理过，就直接返回，不再回复。
2. 查排期或者预约（`book` 按 key 防重复，key 重复时返回已有的预约并记一条"key 重复，返回已有预约"的事件，让防重复在界面上看得见）。
3. 按模板生成回复，用 `idempotencyKey = "<caseId>:provider:<kind>"` 发出。
4. 调 `ProviderCalendar.markReplied(messageId, replyMessageId)`。
5. 启动时同样先 `messages.list`，把死掉期间到达、还没回复的请求处理掉。

在任何一处崩溃，恢复后都不会出现重复：消息没发出去，重算一次；消息发出去了但没记录，原样重发，Relay 按 key 返回原来那条；已经记录的步骤直接跳过；预约本身另由 `ProviderCalendar` 按 key 防重复。

**出错的统一处理**：两个 runner 每个工单一个循环。调 actor 拿到 `outcome_unknown`、revision 不匹配、`stageStep` 抛错、Relay 发送失败，一律重新读一遍 actor，从第 1 条重新进循环；连续失败 5 次就把工单设成 `failed`，界面上显示出来，不假装成功。actor 进程被杀掉重启那几秒里的连接拒绝，也走这条路。

**新工单怎么被发现**：coordinator 每秒查一次 Supabase 的 `case_summary`，`status` 不是 `confirmed`、`failed` 的工单都接手；每个工单在内存里只跑一个循环。`POST /api/cases` 在 `ServiceCase.create` 之后、返回之前写 `case_summary`，所以工单一建好就能被发现。

## 5. 中断和恢复（PRD Screen 03）

两种中断，都是 P0，demo 里两种都演：

**杀 runner。** "Interrupt worker" 按钮调 `POST /api/cases/:id/interrupt`，写入 `ServiceCase.armInterrupt()`。它的含义是"coordinator 做完下一步就退出"，不绑定具体哪一步，这样 Nagisa 讲到哪里按都有效；报修表单上另有一个预设中断的勾选框，勾上就固定在第 2 步（发出时段请求）之后退出，正好落在下面说的中断点上。预期的中断点是第 2 步之后、等维修商回复的时候：runner 死的时候维修商的拒绝到达 Relay，重启后 coordinator 从 Relay 上补拉到这条拒绝，直接做第 4 步，前面的诊断不重做，intake 不重来。这一段是整个 demo 的核心。

- coordinator 退出前在 actor 里记下 `interrupt_fired { step, bootId, pid }`。
- `supervise.sh` 发现进程退出后重新拉起，等待时间 3 秒起、每次翻倍、最多 30 秒；带 pidfile，防止两个 coordinator 同时跑。3 秒是故意留的，让观众看清 worker 确实断了。
- 新进程生成一个 `bootId`，用存下的 token 接回 Relay 身份（token 文件不在或者 `reconnect` 失败，就重新 `createWorkspace` 注册，不退出），从 `case_summary` 查出没结束的工单，逐个调用 `ServiceCase.beginRecovery(bootId)`。actor 记下 `recovery_started { fromCheckpoint, previousBootId, bootId, pid }`，`status` 设成 `recovering`。然后按 §4 的顺序：补拉 Relay 消息，从第一个没完成的步骤继续。

**杀 actor 进程。** "Kill actor host" 按钮调 `POST /api/demo/kill-actors`，supervisor 把 `durable-actors dev` 杀掉再拉起。这几秒里 runner 和网页调 actor 都失败，按 §4 的统一处理重试；进程回来后，同一个 id 的 ServiceCase 从 SQLite 里原样回来，事件日志一条不少，流程继续。这一段是给 durable-actors 评委看的：真相在 actor 里，不在任何一个进程的内存里。

**Recovery Monitor 显示的内容全部来自 actor 的事件**：当前 coordinator 的 `bootId` 和 pid、是否预设了中断、最后一个进度点、中断事件、恢复事件、恢复后完成的第一步，以及 actor 进程最近一次重启的时间。等待期间每秒要有东西在变（bootId、pid、"waiting for provider"的计时），否则观众以为卡住了。

## 6. Supabase

为了 Supabase 的"最可能扩展到百万用户"奖，也因为 Nara 正式产品本来就用 Supabase。

- **Home Twin 放在 Supabase**：`home`、`equipment`、`service_history` 三张表。这类数据要跨工单查询，以后还要按 home 做权限，是 Postgres 擅长的事。每个工单的流程状态放在各自的 actor 里，互不影响，工单再多也只是多几个 actor。这就是 Devpost 上讲扩展性的说法：流程状态按工单分散在 actor 里，跨工单的数据集中在 Postgres。
- **`case_summary`**：每个工单一行（id、home_id、status、checkpoint、updated_at），由 web 创建、coordinator 更新。它只是一个索引，用来发现没结束的工单；状态以 actor 为准。
- **项目**：用 Nara 现有的 `nara-preview`（Brad 10-25 定），不新开项目。
- **单独的 schema**：所有表建在 `home_rescue` 这个 schema 里，不碰 `public`。`public` 里有 Nara 正式产品的 `home`、`equipment`、`booking`、`provider` 等表，和这里的表重名；分开放，名字不会撞，黑客松结束后整个 schema 删掉就干净了。
- **单独的数据库角色**：建一个 `home_rescue_app`，只有 `home_rescue` 这个 schema 的读写权限，碰不到 `public`。`nara-preview` 里有真实 homeowner 的数据，而黑客松的代码和 `.env` 要放到 Nagisa 的电脑上去现场跑，所以不能用 `postgres` 或 `nara_app` 的连接串。
- **浏览器不直接连 Supabase**：所有读写都在服务端（两个 runner 和 Next.js route handler），用 `pg` 通过 pooler 连接，连接串 `HOME_RESCUE_DATABASE_URL` 放在不提交的 `.env` 里。所以不需要 anon key，也不需要 RLS 策略。
- P1：工单事件的副本和 Realtime 推送。第二稿里是 P0，审稿后撤下：代码最多、demo 里最看不见，而且网页每秒拉一次 actor 已经够用。10-30 有空再加。

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

// ServiceCase 另加：
//   interruptArmed: boolean
//   worker: { bootId, pid, since } | null        当前 coordinator
//   actorHostRestartedAt?: string                actor 进程最近一次重启

// CaseEvent.type 的取值和 payload：
//   "agent_message"    { from, to, kind, body, relayMessageId, direction: "sent" | "received" }
//                      kind: summary | slot_request | reject | accept | confirm
//   "step_completed"   { step, revision }
//   "interrupt_armed"  { by: "button" | "form" }
//   "interrupt_fired"  { step, bootId, pid }
//   "recovery_started" { fromCheckpoint, previousBootId, bootId, pid }
//   "booking"          { providerId, slot, idempotencyKey, reused: boolean }
//   "home_updated"     { historyEntry }
//   "error"            { attempt, message }
```

接口（Next.js route handler，都在服务端调用）：

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/home/:id` | 首页：设备卡片和维修历史（读 Supabase） |
| POST | `/api/cases` | 报修：`{ homeId, issue, symptoms, preferredSlot, armInterrupt }` → `{ caseId }` |
| GET | `/api/cases/:id` | 整个 `ServiceCase`，包含全部 `events`（读 actor） |
| POST | `/api/cases/:id/interrupt` | 预设中断：coordinator 做完下一步就退出 |
| POST | `/api/demo/kill-actors` | 杀掉 actor 进程，supervisor 会重启它 |

实时更新：页面每秒拉一次 `GET /api/cases/:id`，按 `seq` 追加新事件。actor 进程重启的那几秒这个接口会失败，页面显示"actor host restarting"，不清空已有内容。

Relay 的只读观察页链接放在环境变量 `NEXT_PUBLIC_RELAY_OBSERVER_URL` 里，页面上放一个链接，评委可以点开看消息确实在 Relay 上。

前端可以先用一份 fixture JSON（一个走完全部步骤、包含一次 runner 中断和一次 actor 重启的工单）开发，不用等后端。这份 fixture 由 Brad 10-26 提供。

## 8. Demo 数据

- 一个 home：`Demo Home · Palo Alto`，一台 2014 年装的 Carrier 室外机（用真实存在的型号），两条历史记录：2023 年换过电容，2025 年春天做过保养。
- 一个维修商：`Bay Comfort HVAC (simulated)`。排期里 homeowner 首选的时段已经被占，另有两个空时段。
- 报修内容："My AC isn't cooling."，症状：风扇在转，出风不冷，室外机不转。诊断应当提到电容，因为历史里换过。这一点用来展示 agent 确实读了 Home Twin。
- 工单 id 用随机串，这样 `<caseId>:<step>` 这些 key 在多次演练之间不会撞上。

## 9. LLM

- 只有诊断用 LLM：OpenAI，结构化输出用 JSON schema 约束，选支持结构化输出里最快的型号，写代码时定。
- 开发和现场都用 Nara 现有的 OpenAI key，放进本 repo 不提交的 `.env`。现场发的 100 美元 credits 留作备用。
- 调用失败重试两次，还失败按 §4 的统一处理。

## 10. 现场

- Nagisa 在现场用她的 Mac 跑：`npm run demo` 同时起 actors、coordinator、provider、web 四个进程，每个都带 supervisor。事先装好 Bun 和 Node 22。Relay 的 token 文件和 workspace 在 10-30 彩排时在她的电脑上生成，之后不删。
- Agent Relay 和 Supabase 都是托管服务，需要现场网络。带手机热点做第二条网络。备用方案：录一段完整的 demo 视频，网络不行就放视频。
- 一次完整的流程有 60–90 秒是在等（五条 Relay 消息、一次 LLM、两次重启）。Nagisa 的讲稿要把每一段等待填上：等维修商回复时讲 Relay 上的消息，重启时讲 Recovery Monitor 上的事件。
- PRD 第 3 节的流程图是"中断 → 恢复 → 维修商拒绝 → 重新协商"，本设计是在等维修商回复时中断，恢复后拿到拒绝再协商。请 Nagisa 把 PRD 的图和讲稿改成一致。
- Brad 11:00–16:00 远程在线，随时处理问题。

## 11. 排期

| 日期 | Brad | Nagisa |
|---|---|---|
| 10-26（日） | 和 Nagisa 一起定稿本文；交 fixture JSON | 定稿；建 repo；搭前端骨架 |
| 10-27 | actors：ServiceCase、ProviderCalendar；在 `nara-preview` 里建 `home_rescue` schema、`home_rescue_app` 角色、四张表和种子数据；两个自动化测试 | 四个页面接 fixture |
| 10-28 | coordinator 和 provider：Relay 收发、补拉、诊断 prompt、模板消息；正常流程跑通 | 继续页面，接 `GET /api/home`、`POST /api/cases`、`GET /api/cases/:id` |
| 10-29 | 两种中断、supervisor、出错的统一处理、新工单轮询 | Recovery Monitor、两个中断按钮 |
| 10-30 | 在 Nagisa 的电脑上完整彩排，录备用视频，写 Devpost 草稿 | 同左 |
| 10-31 | 远程在线 | 现场 demo |

10-29 Brad 可能有 Agentic AI Day 的 demo（如果申请通过），那天的工作会挪到 10-30 上午；10-30 下午必须留给彩排。排期里没有余量，§6 的 P1 和其他任何新想法都不在 10-30 之前加。

验收：两个自动化测试，一是同一个 key 预约两次只有一条预约，二是从任一进度点重启后不重做已完成的步骤；PRD 第 7 节其余各条写成一份人工执行的 smoke 清单，10-30 彩排时逐条过。

## 12. 已定的问题（Brad 10-25）

1. 代码放在新 repo `Nara-Labs/nara-home-rescue`，不进 nara-agent。Brad 的 GitHub 账号没有在 Nara-Labs 下建 repo 的权限，要 Nagisa 建好后给 Brad 写权限。在那之前，本文在 Brad 本地的 `~/nara-home-rescue`。
2. 现场是 Nagisa，用她的 Mac。
3. OpenAI 用 Nara 现有的 key。
4. Relay 的 `idempotencyKey` 会去重，已实测，结论写在 §2，设计按它用了发件箱（§4）。
5. 争 Supabase 的奖，设计见 §6。
6. Supabase 用 Nara 现有的 `nara-preview`，表放在单独的 `home_rescue` schema 里，用只能访问这个 schema 的 `home_rescue_app` 角色连接（§6）。
7. 审稿后的四项改动都采纳：维修商 agent 独立成进程、通过 Relay 被动响应（§3、§4）；杀 actor 进程提到 P0（§5）；撤下工单事件副本和 Realtime，网页每秒拉 actor（§6、§7）；只有诊断用 LLM（§4、§9）。
