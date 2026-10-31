"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadDispatchDashboard } from "@/data/dispatchGateway";
import {
  skillLabel,
  type PublishedOpening,
  type Technician,
} from "@/data/technicians";
import { getDemoInbound, setAssignment, type DemoInboundRequest } from "@/lib/assignment";
import { matchTechnicians, type MatchResult } from "@/lib/matching";
import { NaraMark } from "@/components/ui";
import { HomeownerPreview, PublishSheet } from "./HomeownerPreview";
import { WhyAlexPanel } from "./WhyAlexPanel";

const SUGGEST_REASONS = [
  { id: "schedule", label: "Schedule changed" },
  { id: "emergency", label: "Emergency job" },
  { id: "unavailable", label: "Technician unavailable" },
  { id: "fit", label: "Better internal fit" },
  { id: "other", label: "Other" },
] as const;

const {
  company: COMPANY,
  serviceRequest: SERVICE_REQUEST,
  roster: INITIAL_ROSTER,
} = loadDispatchDashboard();

type Flow =
  | { step: "idle" }
  | { step: "offered"; techId: string }
  | { step: "homeowner-selected"; techId: string }
  | { step: "suggest"; fromId: string }
  | { step: "suggested"; fromId: string; toId: string; reason: string }
  | { step: "confirmed"; techId: string };

export function DispatchApp() {
  const [roster, setRoster] = useState(INITIAL_ROSTER);
  const [flow, setFlow] = useState<Flow>({ step: "idle" });
  const [showWhy, setShowWhy] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [previewTechId, setPreviewTechId] = useState<string | null>(null);
  const [editTechId, setEditTechId] = useState<string | null>(null);
  const [suggestReason, setSuggestReason] = useState("schedule");

  const matches = matchTechnicians(SERVICE_REQUEST, roster);
  const available = matches.filter(
    (item) => item.status === "recommended" || item.status === "qualified",
  );
  const recommended = matches.find((item) => item.status === "recommended");
  const noCapacity = matches.filter((item) => item.status === "qualified-unavailable");

  function publishOpening(input: {
    technicianId: string;
    start: string;
    end: string;
    windowLabel: string;
    acceptedJobTypes: string[];
  }) {
    setRoster((current) =>
      current.map((tech) => {
        if (tech.id !== input.technicianId) return tech;
        const opening: PublishedOpening = {
          id: `${tech.id}-${Date.now()}`,
          date: "today",
          start: input.start,
          end: input.end,
          windowLabel: input.windowLabel,
          acceptedJobTypes: input.acceptedJobTypes,
          status: "published",
        };
        return {
          ...tech,
          availableToday: true,
          window: input.windowLabel,
          availabilityLabel: `Today · ${input.windowLabel}`,
          availabilityNote: `${input.windowLabel} open`,
          nextAvailableSlot: { start: input.start, end: input.end },
          publishedCapacity: [...tech.publishedCapacity, opening],
        };
      }),
    );
    setShowPublish(false);
  }

  function bookSlot(techId: string) {
    setRoster((current) =>
      current.map((tech) => {
        if (tech.id !== techId) return tech;
        return {
          ...tech,
          publishedCapacity: tech.publishedCapacity.map((opening) =>
            opening.status === "published" ? { ...opening, status: "booked" as const } : opening,
          ),
        };
      }),
    );
  }

  function offer(tech: Technician) {
    setFlow({ step: "offered", techId: tech.id });
    setPreviewTechId(tech.id);
    setAssignment({
      requestId: SERVICE_REQUEST.id,
      technicianId: tech.id,
      window: tech.availabilityLabel,
    });
  }

  function confirm(techId: string) {
    bookSlot(techId);
    setFlow({ step: "confirmed", techId });
    const tech = roster.find((item) => item.id === techId);
    if (tech) {
      setAssignment({
        requestId: SERVICE_REQUEST.id,
        technicianId: tech.id,
        window: tech.availabilityLabel,
      });
    }
  }

  return (
    <div className="min-h-dvh bg-sand text-ink">
      <header className="border-b border-line/80 bg-cream/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-8 py-4">
          <div className="flex items-center gap-6">
            <NaraMark />
            <div className="hidden h-8 w-px bg-line md:block" />
            <div>
              <p className="text-[16px] font-semibold">Nara Capacity</p>
              <p className="text-[12px] text-muted">
                Publish the openings you want Nara to fill · {COMPANY.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[13px]">
            <span className="rounded-full bg-sage-soft px-3 py-1 font-medium text-sage-deep">
              Today
            </span>
            <Link href="/" className="text-muted underline decoration-line underline-offset-4">
              Homeowner app
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-8 py-6">
        <ControlCard />
        <FlowBanner flow={flow} roster={roster} />

        <CapacitySection
          roster={roster}
          onPublish={() => setShowPublish(true)}
        />

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[300px_minmax(0,1fr)_400px]">
          <TechniciansSection
            roster={roster}
            onEdit={(id) => setEditTechId(id)}
          />
          <RequestSection />
          <MatchingSection
            available={available}
            recommended={recommended}
            noCapacity={noCapacity}
            flow={flow}
            onOffer={offer}
            onWhy={() => setShowWhy(true)}
            onPreview={(id) => setPreviewTechId(id)}
            onConfirm={() => {
              if (flow.step === "homeowner-selected") confirm(flow.techId);
            }}
            onSuggest={() => {
              if (flow.step === "homeowner-selected") {
                setFlow({ step: "suggest", fromId: flow.techId });
              }
            }}
          />
        </div>

        {flow.step === "suggest" ? (
          <SuggestPanel
            roster={roster}
            fromId={flow.fromId}
            reason={suggestReason}
            onReason={setSuggestReason}
            onCancel={() => setFlow({ step: "homeowner-selected", techId: flow.fromId })}
            onSubmit={(toId) => {
              setFlow({
                step: "suggested",
                fromId: flow.fromId,
                toId,
                reason: suggestReason,
              });
              setPreviewTechId(toId);
            }}
          />
        ) : null}

        <p className="mt-8 text-center text-[11px] text-muted">
          Prototype mock data — Nara never books unpublished capacity.
        </p>
      </main>

      {showWhy && recommended ? (
        <WhyAlexPanel match={recommended} onClose={() => setShowWhy(false)} />
      ) : null}
      {showPublish ? (
        <PublishSheet
          technicians={roster}
          onPublish={publishOpening}
          onClose={() => setShowPublish(false)}
        />
      ) : null}
      {previewTechId ? (
        <HomeownerPreview
          technician={roster.find((tech) => tech.id === previewTechId)!}
          assigned={flow.step === "confirmed"}
          offered={flow.step === "offered"}
          suggested={flow.step === "suggested"}
          onChoose={
            flow.step === "offered" || flow.step === "suggested"
              ? () => {
                  const id =
                    flow.step === "suggested" ? flow.toId : flow.techId;
                  setFlow({ step: "homeowner-selected", techId: id });
                  setPreviewTechId(null);
                }
              : undefined
          }
          onClose={() => setPreviewTechId(null)}
        />
      ) : null}
      {editTechId ? (
        <EditProfileSheet
          technician={roster.find((tech) => tech.id === editTechId)!}
          onClose={() => setEditTechId(null)}
        />
      ) : null}
    </div>
  );
}

function ControlCard() {
  return (
    <section className="mb-5 rounded-[24px] bg-cream p-5 ring-1 ring-line/70">
      <h2 className="nara-serif text-[24px]">You’re always in control</h2>
      <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink/80">
        Nara only matches customers to availability you choose to publish. Your
        internal dispatch schedule stays private.
      </p>
      <ul className="mt-4 grid gap-2 text-[13px] text-ink/75 sm:grid-cols-2">
        <li>Publish only the openings you want filled</li>
        <li>Keep existing ServiceTitan / FieldCamp / other workflows</li>
        <li>Nara never books unpublished capacity</li>
        <li>You can confirm or reject every assignment</li>
      </ul>
      <p className="mt-3 text-[12px] text-muted">
        Serves {COMPANY.serviceCities.join(", ")}
      </p>
    </section>
  );
}

function FlowBanner({ flow, roster }: { flow: Flow; roster: Technician[] }) {
  if (flow.step === "idle") return null;
  const tech = roster.find((item) => {
    if (flow.step === "suggested") return item.id === flow.toId;
    if ("techId" in flow) return item.id === flow.techId;
    return false;
  });
  const first = tech?.name.split(" ")[0] ?? "";

  const copy =
    flow.step === "offered"
      ? `${first} is being offered to the homeowner`
      : flow.step === "homeowner-selected"
        ? `Homeowner selected ${first} · shop confirmation required`
        : flow.step === "suggested"
          ? `Cool Air Mechanical suggested ${first} instead`
          : flow.step === "confirmed"
            ? `${first} confirmed · slot booked by Nara`
            : null;

  if (!copy) return null;
  return (
    <div
      role="status"
      className="mb-5 rounded-2xl bg-sage-soft px-5 py-3 text-[14px] font-semibold text-sage-deep"
    >
      {copy}
    </div>
  );
}

function CapacitySection({
  roster,
  onPublish,
}: {
  roster: Technician[];
  onPublish: () => void;
}) {
  return (
    <section className="rounded-[24px] bg-cream p-5 ring-1 ring-line/70">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
            Published capacity
          </p>
          <h2 className="nara-serif mt-1 text-[26px]">Capacity available to Nara</h2>
          <p className="mt-2 text-[14px] text-muted">
            Only the openings you publish here can be matched with Nara customers.
          </p>
        </div>
        <button
          type="button"
          onClick={onPublish}
          className="h-11 rounded-full bg-sage px-5 text-[14px] font-semibold text-cream"
        >
          Publish availability
        </button>
      </div>

      <p className="mt-5 text-[13px] font-semibold text-ink">Today</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {roster.map((tech) => {
          const opening = tech.publishedCapacity[0];
          const status = opening
            ? opening.status === "booked"
              ? "Booked by Nara"
              : "Published"
            : tech.id === "sam"
              ? "Unavailable"
              : "Not published";
          return (
            <article key={tech.id} className="rounded-[20px] bg-paper p-4 ring-1 ring-line/70">
              <p className="text-[15px] font-semibold">{tech.name}</p>
              <p className="mt-1 text-[13px] text-ink/80">
                {opening ? opening.windowLabel : tech.availabilityNote}
              </p>
              <p className="mt-1 text-[12px] text-muted">
                {tech.equipmentBrands.slice(0, 2).join(" · ")} ·{" "}
                {skillLabel(tech.skills[0] ?? "")}
              </p>
              <span
                className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  status === "Published"
                    ? "bg-sage-soft text-sage-deep"
                    : status === "Booked by Nara"
                      ? "bg-gold-soft text-ink"
                      : "bg-line/70 text-muted"
                }`}
              >
                {status}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TechniciansSection({
  roster,
  onEdit,
}: {
  roster: Technician[];
  onEdit: (id: string) => void;
}) {
  return (
    <section className="rounded-[24px] bg-cream p-5 ring-1 ring-line/70">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
        Technicians
      </p>
      <div className="mt-4 space-y-3">
        {roster.map((tech) => {
          const opening = tech.publishedCapacity.find((item) => item.status === "published");
          return (
            <article key={tech.id} className="rounded-2xl bg-paper p-3.5 ring-1 ring-line/70">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tech.portrait}
                  alt={tech.name}
                  className="h-11 w-11 rounded-full object-cover"
                />
                <div>
                  <p className="text-[14px] font-semibold">{tech.name}</p>
                  <p className="text-[12px] text-muted">{tech.company}</p>
                </div>
              </div>
              <dl className="mt-3 space-y-1.5 text-[12px] text-ink/80">
                <div>
                  <dt className="text-muted">Skills</dt>
                  <dd>{tech.skills.map(skillLabel).join(" · ")}</dd>
                </div>
                <div>
                  <dt className="text-muted">Equipment</dt>
                  <dd>{tech.equipmentBrands.join(" · ")}</dd>
                </div>
                <div>
                  <dt className="text-muted">Certifications</dt>
                  <dd>{tech.certifications.join(" · ").replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt className="text-muted">Nara service history</dt>
                  <dd>{tech.similarJobsCompleted} similar cooling jobs</dd>
                </div>
                <div>
                  <dt className="text-muted">Current Nara availability</dt>
                  <dd>{opening ? `Today · ${opening.windowLabel}` : "None published"}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => onEdit(tech.id)}
                className="mt-3 text-[12px] font-medium text-sage-deep underline decoration-sage/30 underline-offset-4"
              >
                Edit profile
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RequestSection() {
  const [inbound, setInbound] = useState<DemoInboundRequest | null>(null);
  useEffect(() => {
    // sessionStorage is only available after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInbound(getDemoInbound());
  }, []);

  if (inbound) {
    return (
      <section className="rounded-[24px] bg-cream p-5 ring-1 ring-sage/35">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage-deep">
          Incoming Nara request
        </p>
        <div className="mt-3 flex items-start justify-between gap-3">
          <h2 className="nara-serif text-[26px] leading-tight">Just arrived from the homeowner</h2>
          <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[11px] font-semibold text-sage-deep">
            AI Intake Complete
          </span>
        </div>
        <p className="nara-serif mt-4 text-[28px]">{inbound.problem}</p>
        <p className="mt-1 text-[16px] text-ink/70">Hayward · {inbound.zipCode}</p>
        {inbound.brand ? (
          <p className="mt-3 text-[18px] font-medium text-ink">
            {inbound.brand} {inbound.model}
          </p>
        ) : null}
        <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
          What Nara learned
        </p>
        <ul className="mt-2 space-y-1.5 text-[16px] text-ink/85">
          {inbound.facts.map((fact) => (
            <li key={fact}>✓ {fact}</li>
          ))}
        </ul>
        {inbound.sameDay ? (
          <span className="mt-4 inline-flex rounded-full bg-gold-soft px-3 py-1 text-[13px] font-semibold">
            Same-day service
          </span>
        ) : null}
        <p className="mt-5 text-[15px] text-ink">
          Recommended technician: <span className="font-semibold">{inbound.technicianName}</span>
        </p>
        <div className="mt-4 flex gap-2">
          {inbound.photos.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              className="h-20 w-20 rounded-xl object-cover ring-1 ring-line"
            />
          ))}
        </div>
      </section>
    );
  }

  const request = SERVICE_REQUEST;
  return (
    <section className="rounded-[24px] bg-cream p-5 ring-1 ring-line/70">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
        Incoming Nara requests
      </p>
      <div className="mt-3 flex items-start justify-between gap-3">
        <h2 className="nara-serif text-[26px] leading-tight">New Nara Service Request</h2>
        <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[11px] font-semibold text-sage-deep">
          AI Intake Complete
        </span>
      </div>
      <p className="nara-serif mt-4 text-[24px]">{request.problem}</p>
      <p className="mt-1 text-[14px] text-muted">
        {request.location.city}, {request.location.state}
      </p>
      <p className="mt-3 text-[14px] text-ink/80">
        {request.equipment.manufacturer} {request.equipment.model}
      </p>
      <p className="text-[13px] text-muted">
        {request.equipment.type} · Manufactured {request.equipment.year}
      </p>

      <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
        What Nara learned
      </p>
      <ul className="mt-2 space-y-1.5 text-[14px] text-ink/80">
        <li>✓ Indoor airflow present</li>
        <li>✓ Outdoor unit not running</li>
        <li>✓ Burning smell reported</li>
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-gold-soft px-3 py-1 text-[12px] font-semibold">
          Same-day service
        </span>
        <span className="rounded-full bg-paper px-3 py-1 text-[12px] ring-1 ring-line">
          Photos attached: {request.symptoms.photoCount}
        </span>
      </div>

      <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
        Technician requirements
      </p>
      <ul className="mt-2 space-y-1.5 text-[13px] text-ink/80">
        <li>Residential AC diagnostic</li>
        <li>Carrier experience preferred</li>
        <li>Appropriate EPA certification</li>
        <li>Same-day availability</li>
        <li>Service area includes Hayward</li>
      </ul>

      <div className="mt-4 flex gap-2">
        {request.symptoms.photos.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            className="h-14 w-14 rounded-xl object-cover ring-1 ring-line"
          />
        ))}
      </div>
    </section>
  );
}

function MatchingSection({
  available,
  recommended,
  noCapacity,
  flow,
  onOffer,
  onWhy,
  onPreview,
  onConfirm,
  onSuggest,
}: {
  available: MatchResult[];
  recommended?: MatchResult;
  noCapacity: MatchResult[];
  flow: Flow;
  onOffer: (tech: Technician) => void;
  onWhy: () => void;
  onPreview: (id: string) => void;
  onConfirm: () => void;
  onSuggest: () => void;
}) {
  return (
    <section className="rounded-[24px] bg-cream p-5 ring-1 ring-line/70">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
        Matching / assignment
      </p>
      <h2 className="nara-serif mt-2 text-[26px] leading-tight">
        Nara found {available.length} available {available.length === 1 ? "match" : "matches"}
      </h2>
      <p className="mt-2 text-[13px] text-muted">
        Ranked against published Nara capacity only.
      </p>

      <div className="mt-4 space-y-3">
        {available.map((item) => {
          const first = item.technician.name.split(" ")[0];
          const isTop = item.status === "recommended";
          return (
            <article
              key={item.technician.id}
              className={`rounded-[22px] bg-paper p-4 ring-1 ${
                isTop ? "ring-sage/35" : "ring-line/70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[16px] font-semibold">{item.technician.name}</p>
                  <p className="text-[12px] text-muted">
                    {isTop ? "Top recommendation" : "Also available"}
                  </p>
                </div>
                <span className="text-[12px] font-semibold text-sage-deep">
                  Today · {item.technician.window}
                </span>
              </div>
              <p className="mt-3 text-[12px] font-semibold text-muted">
                Why {first} fits
              </p>
              <ul className="mt-2 space-y-1 text-[13px] text-ink/80">
                {(isTop ? item.reasons : item.lowerReasons.length ? item.lowerReasons : item.reasons)
                  .slice(0, 6)
                  .map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOffer(item.technician)}
                  className="h-10 rounded-full bg-sage px-4 text-[13px] font-semibold text-cream"
                >
                  Offer {first}
                </button>
                {isTop ? (
                  <button
                    type="button"
                    onClick={onWhy}
                    className="text-[13px] font-medium text-sage-deep underline decoration-sage/30 underline-offset-4"
                  >
                    Why this ranking?
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {noCapacity.length > 0 ? (
        <div className="mt-5 border-t border-line/70 pt-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
            Other qualified technicians
          </p>
          {noCapacity.map((item) => (
            <p key={item.technician.id} className="mt-2 text-[13px] text-muted">
              {item.technician.name}
              <span className="mt-0.5 block">
                Qualified · no Nara capacity published today
              </span>
            </p>
          ))}
        </div>
      ) : null}

      {flow.step === "offered" || flow.step === "suggested" ? (
        <button
          type="button"
          onClick={() =>
            onPreview(flow.step === "suggested" ? flow.toId : flow.techId)
          }
          className="mt-5 w-full text-center text-[13px] font-medium text-muted underline decoration-line underline-offset-4"
        >
          Preview homeowner view
        </button>
      ) : null}

      {flow.step === "homeowner-selected" ? (
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 w-full rounded-full bg-sage text-[14px] font-semibold text-cream"
          >
            Confirm{" "}
            {available.find((item) => item.technician.id === flow.techId)?.technician.name.split(" ")[0] ??
              "assignment"}
          </button>
          <button
            type="button"
            onClick={onSuggest}
            className="h-11 w-full rounded-full text-[14px] font-medium text-ink ring-1 ring-line"
          >
            Suggest another technician
          </button>
        </div>
      ) : null}
    </section>
  );
}

function SuggestPanel({
  roster,
  fromId,
  reason,
  onReason,
  onCancel,
  onSubmit,
}: {
  roster: Technician[];
  fromId: string;
  reason: string;
  onReason: (value: string) => void;
  onCancel: () => void;
  onSubmit: (toId: string) => void;
}) {
  const others = roster.filter(
    (tech) => tech.id !== fromId && tech.publishedCapacity.some((item) => item.status === "published"),
  );
  const [toId, setToId] = useState(others[0]?.id ?? "maria");

  return (
    <section className="mt-5 rounded-[24px] bg-cream p-5 ring-1 ring-line/70">
      <h2 className="nara-serif text-[22px]">Suggest another technician</h2>
      <p className="mt-2 text-[14px] text-muted">
        The homeowner will see that Cool Air suggested a different person, with a
        short reason.
      </p>
      <label className="mt-4 block text-[12px] font-semibold text-muted">
        Technician
        <select
          value={toId}
          onChange={(event) => setToId(event.target.value)}
          className="mt-1 h-11 w-full rounded-2xl bg-paper px-3 text-[14px] ring-1 ring-line"
        >
          {others.map((tech) => (
            <option key={tech.id} value={tech.id}>
              {tech.name}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-4 text-[12px] font-semibold text-muted">Reason</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {SUGGEST_REASONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onReason(item.id)}
            className={`rounded-full px-3 py-2 text-[13px] font-medium ${
              reason === item.id ? "bg-sage text-cream" : "bg-paper ring-1 ring-line"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => onSubmit(toId)}
          className="h-11 flex-1 rounded-full bg-sage text-[14px] font-semibold text-cream"
        >
          Send to homeowner
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-full px-4 text-[14px] text-muted"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

function EditProfileSheet({
  technician,
  onClose,
}: {
  technician: Technician;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/25 p-4"
      onClick={onClose}
    >
      <div
        className="animate-rise w-full max-w-md rounded-[28px] bg-cream p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="nara-serif text-[24px]">{technician.name}</h3>
        <p className="mt-2 text-[14px] text-muted">
          Nara only stores matching fields — not payroll, reviews, or HR files.
        </p>
        <dl className="mt-4 space-y-2 text-[14px]">
          <div>
            <dt className="text-[12px] text-muted">Years of experience</dt>
            <dd>{technician.yearsExperience}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Service area</dt>
            <dd>{COMPANY.serviceCities.join(", ")}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Residential / commercial</dt>
            <dd>Residential HVAC</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-11 w-full rounded-full bg-sage text-[14px] font-semibold text-cream"
        >
          Done
        </button>
      </div>
    </div>
  );
}
