import { Actor, Persisted } from "durable-actors"

// Contracts: docs/plan-1h.md §3. Every write reassigns the whole field; push() is not persisted.
// Types are concrete on purpose: the runtime builds a schema for every method result and rejects `unknown`.

export type Scalar = string | number | boolean | null
export type Payload = { [key: string]: Scalar | string[] }

export type CaseEvent = { id: string; caseId: string; timestamp: string; agent: string; type: string; payload: Payload }
export type CaseData = { id: string; issue: string; symptoms: string[]; preferredSlot: string; createdAt: string }
export type Outbox = { step: string; kind: string; text: string; idempotencyKey: string }
export type StepResult = { narrative?: string; alternatives?: string[]; slot?: string; relayMessageId?: string }
export type Results = { [step: string]: StepResult }
export type Worker = { bootId: string; pid: number }
export type Recovery = { previousPid: number | null; previousBootId: string | null; pid: number; bootId: string; fromCheckpoint: string; at: string }
export type CaseSnapshot = {
    data: CaseData | null
    status: string
    checkpoint: string
    events: CaseEvent[]
    draft: string
    outbox: Outbox | null
    results: Results
    worker: Worker | null
    recovery: Recovery | null
    lastRelayMessageId: string | null
}
export type EventInput = { type: string; payload: Payload }

function event(caseId: string, agent: string, type: string, payload: Payload): CaseEvent {
    return { id: `${caseId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`, caseId, timestamp: new Date().toISOString(), agent, type, payload }
}

export class ServiceCase extends Actor {
    @Persisted private data: CaseData | null = null
    @Persisted private status = "created"
    @Persisted private checkpoint = "created"
    @Persisted private events: CaseEvent[] = []
    @Persisted private draft = ""
    @Persisted private outbox: Outbox | null = null
    @Persisted private results: Results = {}
    @Persisted private worker: Worker | null = null
    @Persisted private recovery: Recovery | null = null
    @Persisted private lastRelayMessageId: string | null = null

    private async snapshot(): Promise<CaseSnapshot> {
        return {
            data: this.data, status: this.status, checkpoint: this.checkpoint, events: this.events, draft: this.draft,
            outbox: this.outbox, results: this.results, worker: this.worker, recovery: this.recovery, lastRelayMessageId: this.lastRelayMessageId,
        }
    }

    private async caseId(): Promise<string> {
        return this.data ? this.data.id : ""
    }

    async create(input: { id: string; issue: string; symptoms: string[]; preferredSlot: string }): Promise<CaseSnapshot> {
        if (this.data) return await this.snapshot()
        this.data = { id: input.id, issue: input.issue, symptoms: input.symptoms, preferredSlot: input.preferredSlot, createdAt: new Date().toISOString() }
        this.events = [...this.events, event(input.id, "web", "created", { issue: input.issue, preferredSlot: input.preferredSlot })]
        return await this.snapshot()
    }

    async get(): Promise<CaseSnapshot> {
        return await this.snapshot()
    }

    async setDraft(text: string): Promise<void> {
        this.draft = text
        if (this.status === "created" || this.status === "recovering") this.status = "diagnosing"
    }

    // Outbox: the message text and this step's result are written before the Relay send (design-hackathon §4).
    async stageStep(input: { step: string; kind: string; text: string; idempotencyKey: string; result?: StepResult }): Promise<Outbox> {
        if (this.outbox && this.outbox.step === input.step) return this.outbox
        const outbox: Outbox = { step: input.step, kind: input.kind, text: input.text, idempotencyKey: input.idempotencyKey }
        this.outbox = outbox
        if (input.result) this.results = { ...this.results, [input.step]: input.result }
        return outbox
    }

    async completeStep(input: { step: string; status: string; agent?: string; relayMessageId?: string; events?: EventInput[]; result?: StepResult }): Promise<CaseSnapshot> {
        if (this.checkpoint === input.step) return await this.snapshot()
        const caseId = await this.caseId()
        const agent = input.agent ?? "coordinator"
        const added = (input.events ?? []).map((e) => event(caseId, agent, e.type, e.payload))
        this.events = [...this.events, ...added, event(caseId, agent, "step_completed", { step: input.step })]
        if (input.result) this.results = { ...this.results, [input.step]: input.result }
        if (input.relayMessageId) this.lastRelayMessageId = input.relayMessageId
        this.checkpoint = input.step
        this.status = input.status
        this.outbox = null
        return await this.snapshot()
    }

    async addEvent(input: { type: string; payload: Payload; agent?: string }): Promise<void> {
        this.events = [...this.events, event(await this.caseId(), input.agent ?? "coordinator", input.type, input.payload)]
    }

    async setWorker(worker: Worker): Promise<void> {
        this.worker = worker
    }

    async beginRecovery(worker: Worker): Promise<CaseSnapshot> {
        const previous = this.worker
        const recovery: Recovery = {
            previousPid: previous ? previous.pid : null, previousBootId: previous ? previous.bootId : null,
            pid: worker.pid, bootId: worker.bootId, fromCheckpoint: this.checkpoint, at: new Date().toISOString(),
        }
        this.recovery = recovery
        this.worker = worker
        this.status = "recovering"
        this.events = [...this.events, event(await this.caseId(), "coordinator", "recovery_started", { previousPid: recovery.previousPid, pid: recovery.pid, fromCheckpoint: recovery.fromCheckpoint, at: recovery.at })]
        return await this.snapshot()
    }

    async fail(message: string): Promise<void> {
        this.status = "failed"
        this.events = [...this.events, event(await this.caseId(), "coordinator", "error", { message })]
    }
}

export type Booking = { slot: string; caseId: string; at: string }
export type BookingResult = { slot: string; caseId: string; at: string; key: string; reused: boolean }
export type Offer = { caseId: string; requestedSlot: string; requestedTaken: boolean; alternatives: string[] }
export type Calendar = { slots: string[]; bookings: { [key: string]: Booking }; approved: { [caseId: string]: string } }

const SEED_SLOTS = [
    "Tue 9:00", "Tue 13:00", "Wed 9:00", "Wed 14:00", "Thu 9:00", "Thu 13:00",
    "Fri 9:00", "Fri 13:00", "Mon 9:00", "Mon 13:00", "Tue 15:00", "Wed 16:00", "Thu 16:00",
]
const PREFERRED_TAKEN = "Tue 9:00"

export class ProviderCalendar extends Actor {
    @Persisted private slots: string[] = []
    @Persisted private bookings: { [key: string]: Booking } = {}
    @Persisted private approved: { [caseId: string]: string } = {}
    @Persisted private handled: { [messageId: string]: string } = {}

    private async seed(): Promise<void> {
        if (this.slots.length) return
        this.slots = SEED_SLOTS
        this.bookings = { "seed:preferred": { slot: PREFERRED_TAKEN, caseId: "seed", at: new Date().toISOString() } }
    }

    // The homeowner's preferred slot is always taken; offer the first two open ones.
    async offer(caseId: string, requestedSlot: string): Promise<Offer> {
        await this.seed()
        const taken = Object.values(this.bookings).map((b) => b.slot)
        const alternatives = this.slots.filter((s) => !taken.includes(s) && s !== requestedSlot).slice(0, 2)
        return { caseId, requestedSlot, requestedTaken: true, alternatives }
    }

    async approve(caseId: string): Promise<void> {
        this.approved = { ...this.approved, [caseId]: new Date().toISOString() }
    }

    async isApproved(caseId: string): Promise<boolean> {
        return Boolean(this.approved[caseId])
    }

    async book(input: { slot: string; key: string; caseId: string }): Promise<BookingResult> {
        await this.seed()
        const existing = this.bookings[input.key]
        if (existing) return { slot: existing.slot, caseId: existing.caseId, at: existing.at, key: input.key, reused: true }
        const booking: Booking = { slot: input.slot, caseId: input.caseId, at: new Date().toISOString() }
        this.bookings = { ...this.bookings, [input.key]: booking }
        return { slot: booking.slot, caseId: booking.caseId, at: booking.at, key: input.key, reused: false }
    }

    // True when this message has not been handled before.
    async claim(messageId: string): Promise<boolean> {
        if (this.handled[messageId]) return false
        this.handled = { ...this.handled, [messageId]: "claimed" }
        return true
    }

    async markReplied(messageId: string, replyMessageId: string): Promise<void> {
        this.handled = { ...this.handled, [messageId]: replyMessageId }
    }

    async get(): Promise<Calendar> {
        await this.seed()
        return { slots: this.slots, bookings: this.bookings, approved: this.approved }
    }

    // Rehearsal helper: drop every booking except the seeded one. `handled` is kept so the provider
    // does not re-answer old Relay messages at its next boot.
    async reset(): Promise<void> {
        this.slots = SEED_SLOTS
        this.bookings = { "seed:preferred": { slot: PREFERRED_TAKEN, caseId: "seed", at: new Date().toISOString() } }
        this.approved = {}
    }
}

export class CaseIndex extends Actor {
    @Persisted private ids: string[] = []

    async add(id: string): Promise<void> {
        if (!this.ids.includes(id)) this.ids = [...this.ids, id]
    }

    async list(): Promise<string[]> {
        return this.ids
    }

    async remove(id: string): Promise<void> {
        this.ids = this.ids.filter((x) => x !== id)
    }
}
