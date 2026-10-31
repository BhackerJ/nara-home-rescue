import { Actor, Persisted } from "durable-actors"

// Setup smoke test only; replaced by ServiceCase and ProviderCalendar.
export class Smoke extends Actor {
    @Persisted private count = 0

    async read() {
        return this.count
    }

    async bump() {
        return ++this.count
    }
}
