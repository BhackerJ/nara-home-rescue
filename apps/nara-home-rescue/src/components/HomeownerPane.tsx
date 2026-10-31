"use client";

import { useState, type ReactNode } from "react";
import {
  CARRIER_CONDENSER,
  historicalServiceRecords,
  scheduledServiceRecord,
  serviceRecordsAt,
} from "@/data/serviceHistory";
import type { AppointmentView } from "@/demo/appointment";
import {
  firstName,
  matchReasons,
  qualificationLabel,
  type RosterTech,
  type TechId,
} from "@/demo/roster";
import type { DemoFrame, HomeownerScreen } from "@/demo/script";
import { NaraMark, PrimaryButton } from "./NaraMark";
import { ServiceHistory } from "./ServiceHistory";
import { CompletedScreen, EnRouteScreen, OnSiteScreen } from "./VisitScreens";

export function HomeownerPane({
  live,
  frame,
  view,
  onReport,
  onRequest,
  onAccept,
  onDecline,
  scheduled,
}: {
  live?: LiveBits;
  frame: DemoFrame;
  view: AppointmentView;
  onReport: () => void;
  onRequest: (id: TechId) => void;
  onAccept: () => void;
  onDecline: () => void;
  scheduled: { name: string; company: string; windowLabel: string } | null;
}) {
  return (
    <section aria-label="Homeowner" className="flex min-h-0 flex-col">
      <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
        Homeowner
      </p>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[390px] flex-col overflow-hidden rounded-[40px] bg-cream shadow-[0_30px_80px_rgba(30,26,22,0.18)] ring-1 ring-black/5">
        <div key={frame.homeowner} className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
            <Screen
          live={live}
              screen={frame.homeowner}
              roster={frame.roster}
              preference={frame.preference}
              view={view}
              onRequest={onRequest}
              onAccept={onAccept}
              onDecline={onDecline}
              scheduled={scheduled}
            />
          </div>
          {frame.homeowner === "twin" ? (
            <div className="shrink-0 bg-cream px-6 pt-2 pb-6">
              <PrimaryButton onClick={onReport}>Report a problem</PrimaryButton>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Screen({
  live,
  screen,
  roster,
  preference,
  view,
  onRequest,
  onAccept,
  onDecline,
  scheduled,
}: {
  live?: LiveBits;
  screen: HomeownerScreen;
  roster: RosterTech[];
  preference: RosterTech | null;
  view: AppointmentView;
  onRequest: (id: TechId) => void;
  onAccept: () => void;
  onDecline: () => void;
  scheduled: { name: string; company: string; windowLabel: string } | null;
}) {
  const tech = rosterTech(roster, view.technicianId) ?? preference;
  const windowLabel = view.windowLabel ?? tech?.availabilityLabel ?? "";
  if (view.phase === "waiting" && !tech) return <MatchScreen roster={roster} onRequest={onRequest} live={live} />;
  if (view.phase === "waiting" && tech) return <AuthorizedScreen tech={tech} windowLabel={windowLabel} />;
  if (view.phase === "counteroffer" && tech) {
    return (
      <CounterofferScreen
        tech={tech}
        requestedName={rosterTech(roster, view.requestedTechnicianId)?.name ?? null}
        windowLabel={windowLabel}
        reason={view.reason}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );
  }
  if (view.phase === "confirmed" && tech) return <ConfirmedScreen tech={tech} windowLabel={windowLabel} />;
  if (view.phase === "journey" && tech) {
    if (screen === "enroute") return <EnRouteScreen tech={tech} windowLabel={windowLabel} />;
    if (screen === "onsite") return <OnSiteScreen tech={tech} />;
    if (screen === "complete") return <CompletedScreen tech={tech} windowLabel={windowLabel} />;
    return <ConfirmedScreen tech={tech} windowLabel={windowLabel} />;
  }
  if (screen === "twin") return <TwinScreen scheduled={scheduled} />;
  if (screen === "report") return <ReportScreen />;
  if (screen === "context") return <ContextScreen />;
  if (screen === "assessment") return <AssessmentScreen live={live} />;
  if (screen === "matching") return <MatchScreen roster={roster} onRequest={onRequest} live={live} />;
  if (tech) return <ConfirmedScreen tech={tech} windowLabel={windowLabel} />;
  return <ReportScreen />;
}

function rosterTech(roster: RosterTech[], id: string | null) {
  if (!id) return null;
  return roster.find((tech) => tech.id === id) ?? null;
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col px-6 pb-8 pt-7">{children}</div>
  );
}

function TwinScreen({
  scheduled,
}: {
  scheduled: { name: string; company: string; windowLabel: string } | null;
}) {
  const records = scheduled
    ? serviceRecordsAt(true, scheduled, scheduled.windowLabel)
    : historicalServiceRecords();
  return (
    <Phone>
      <NaraMark className="animate-rise" />
      <p className="animate-rise delay-1 mt-8 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted">
        Hayward
      </p>
      <h1 className="nara-serif animate-rise delay-1 mt-2 text-[34px] leading-[1.12] font-medium tracking-tight">
        1847 Maple Street
      </h1>
      <p className="animate-rise delay-2 mt-3 max-w-[18rem] text-[15px] leading-relaxed text-muted">
        Nara already knows this home.
      </p>

      <EquipmentCard />
      <ServiceHistory records={records} remember />
    </Phone>
  );
}

function EquipmentCard() {
  return (
    <article className="animate-rise delay-3 mt-8 overflow-hidden rounded-[28px] bg-paper shadow-[0_16px_40px_rgba(30,26,22,0.08)] ring-1 ring-line/70">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={CARRIER_CONDENSER.photo}
        alt="2014 Carrier condenser outside the home"
        className="h-40 w-full object-cover"
      />
      <div className="px-5 py-5">
        <p className="nara-serif text-[26px] leading-none">{CARRIER_CONDENSER.manufacturer}</p>
        <p className="mt-2 text-[15px] text-ink/80">{CARRIER_CONDENSER.summary}</p>
      </div>
    </article>
  );
}

function ReportScreen() {
  return (
    <Phone>
      <NaraMark />
      <p className="mt-6 text-center text-[13px] font-medium text-muted">Listening to your home</p>
      <div className="mt-8 space-y-4">
        <p className="animate-rise text-[15px] leading-relaxed text-muted">My AC isn’t cooling.</p>
        <p className="nara-serif animate-rise delay-2 text-[30px] leading-[1.15] font-medium">
          I’ll take it from here.
        </p>
      </div>
      <div className="mt-auto pt-8">
        <div className="flex h-14 items-center rounded-full bg-paper px-5 text-[16px] text-muted/70 ring-1 ring-line/80">
          Ask Nara...
        </div>
      </div>
    </Phone>
  );
}

function ContextScreen() {
  return (
    <Phone>
      <p className="animate-rise text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
        From this home
      </p>
      <h1 className="nara-serif animate-rise delay-1 mt-4 text-[32px] leading-tight font-medium">
        I already know this system.
      </h1>
      <p className="animate-rise delay-2 mt-3 text-[15px] leading-relaxed text-muted">
        You don’t need to look up the model.
      </p>
      <article className="animate-rise delay-3 mt-8 overflow-hidden rounded-[28px] bg-paper shadow-[0_16px_40px_rgba(30,26,22,0.08)] ring-1 ring-line/70">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/photos/photo-outdoor-unit.jpg"
          alt="2014 Carrier condenser"
          className="h-36 w-full object-cover"
        />
        <div className="px-5 py-5">
          <p className="nara-serif text-[26px] leading-none">2014 Carrier</p>
          <p className="mt-2 text-[15px] text-ink/80">Condenser · 3-ton central air</p>
        </div>
      </article>
      <ServiceHistory records={historicalServiceRecords()} />
    </Phone>
  );
}

function AssessmentScreen({ live }: { live?: LiveBits }) {
  return (
    <Phone>
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-sage-deep">
        Nara’s read{live?.assessment ? " · OpenAI, from the Home Twin" : ""}
      </p>
      {live?.assessment ? (
        <p className="animate-rise mt-4 text-[17px] leading-relaxed text-ink">
          {live.assessment}
          {live.typing ? (
            <span
              aria-hidden
              className="ml-0.5 inline-block w-[2px] animate-pulse bg-sage-deep align-text-bottom"
              style={{ height: "1em" }}
            />
          ) : null}
        </p>
      ) : (
        <h1 className="nara-serif animate-rise mt-4 text-[32px] leading-tight font-medium">
          Air is moving inside. The outdoor unit is not running.
        </h1>
      )}
      <ServiceHistory records={historicalServiceRecords()} />
      <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
        Retrieved from this home. These completed records do not confirm the cause of today’s visit.
      </p>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        A service request is ready for Cool Air Mechanical.
      </p>
    </Phone>
  );
}

function MatchScreen({
  roster,
  onRequest,
  live,
}: {
  roster: RosterTech[];
  onRequest: (id: TechId) => void;
  live?: LiveBits;
}) {
  const [showOther, setShowOther] = useState(false);
  const [whyId, setWhyId] = useState<TechId | null>(null);
  const recommended = roster.find((tech) => tech.recommended) ?? roster[0];
  const others = roster.filter((tech) => tech.id !== recommended.id);

  return (
    <Phone>
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">Demo roster</p>
      <h1 className="nara-serif animate-rise mt-3 text-[30px] leading-tight font-medium">
        I found technicians for this home.
      </h1>
      {live?.technician && live.offerReason ? (
        <div className="animate-rise mt-3 rounded-2xl bg-gold-soft px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/70">
            Cool Air’s dispatcher · OpenAI decision
          </p>
          <p className="mt-1 text-[15px] leading-snug text-ink">
            <strong>{live.technician.name}</strong>, {live.technician.title}. {live.offerReason}
          </p>
        </div>
      ) : null}
      <p className="animate-rise delay-1 mt-3 text-[15px] leading-relaxed text-muted">
        For the 2014 Carrier, and a visit today. A fit for the visit, not a diagnosis.
      </p>
      <div className="mt-6 space-y-3">
        <TechCard
          tech={recommended}
          featured
          open={whyId === recommended.id}
          onWhy={() => setWhyId(whyId === recommended.id ? null : recommended.id)}
          onRequest={() => onRequest(recommended.id)}
        />
        {showOther
          ? others.map((tech) => (
              <TechCard
                key={tech.id}
                tech={tech}
                open={whyId === tech.id}
                onWhy={() => setWhyId(whyId === tech.id ? null : tech.id)}
                onRequest={() => onRequest(tech.id)}
              />
            ))
          : null}
      </div>
      {showOther ? null : (
        <button
          type="button"
          onClick={() => setShowOther(true)}
          className="mt-4 text-[14px] font-medium text-sage-deep underline decoration-sage/30 underline-offset-4"
        >
          See another option
        </button>
      )}
    </Phone>
  );
}

function TechCard({
  tech,
  featured,
  open,
  onWhy,
  onRequest,
}: {
  tech: RosterTech;
  featured?: boolean;
  open: boolean;
  onWhy: () => void;
  onRequest: () => void;
}) {
  const first = firstName(tech);
  return (
    <article
      className={`rounded-[26px] bg-paper p-4 ring-1 ${
        featured ? "shadow-[0_14px_32px_rgba(30,26,22,0.08)] ring-sage/35" : "ring-line/80"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sage-deep">
        {featured ? "Recommended" : "Also available"}
      </p>
      <div className="mt-3 flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tech.portrait}
          alt={tech.name}
          width={56}
          height={56}
          className="h-14 w-14 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="text-[17px] font-semibold">{tech.name}</p>
          <p className="text-[13px] text-muted">{tech.company}</p>
          <p className="mt-1 text-[13px] text-ink/75">
            {tech.expertise} · {tech.yearsExperience} years
          </p>
        </div>
      </div>
      <p className="mt-3 text-[14px] font-semibold text-sage-deep">{tech.availabilityLabel}</p>
      <p className="mt-1 text-[13px] text-ink/70">Fixture qualification · {qualificationLabel(tech)}</p>
      <ul className="mt-3 space-y-1.5 text-[14px] leading-snug text-ink/85">
        {matchReasons(tech).map((reason) => (
          <li key={reason} className="flex gap-2">
            <span className="text-sage" aria-hidden>
              ✓
            </span>
            {reason}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onWhy}
        className="mt-3 text-[13px] font-medium text-sage-deep underline decoration-sage/30 underline-offset-4"
      >
        {open ? "Hide details" : "Why this match?"}
      </button>
      {open ? (
        <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink/80">
          <p>This is a fit explanation, not a diagnosis.</p>
          <p>
            {first} is on the Cool Air roster for Hayward, {tech.miles} miles from this home.{" "}
            {historyForVisit()}
          </p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onRequest}
        className={`mt-4 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold ${
          featured ? "bg-sage text-cream" : "text-ink ring-1 ring-line"
        }`}
      >
        Request {first}
      </button>
    </article>
  );
}

function AuthorizedScreen({ tech, windowLabel }: { tech: RosterTech; windowLabel: string }) {
  const first = firstName(tech);
  return (
    <Phone>
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
        Request submitted
      </p>
      <h1 className="nara-serif animate-rise mt-3 text-[32px] leading-tight font-medium">
        Waiting for Cool Air Mechanical to confirm {first}.
      </h1>
      <div className="animate-rise delay-1 mt-6 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tech.portrait} alt={tech.name} className="h-14 w-14 rounded-full object-cover" />
        <div>
          <p className="text-[16px] font-semibold">{tech.name}</p>
          <p className="text-[13px] text-muted">{tech.company}</p>
        </div>
      </div>
      <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">Pending</p>
      <p className="nara-serif mt-1 text-[24px] leading-snug">{windowLabel}</p>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        This time is not confirmed. Cool Air still has to accept the visit.
      </p>
    </Phone>
  );
}

function CounterofferScreen({
  tech,
  requestedName,
  windowLabel,
  reason,
  onAccept,
  onDecline,
}: {
  tech: RosterTech;
  requestedName: string | null;
  windowLabel: string;
  reason: string | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const first = firstName(tech);
  const requestedFirst = requestedName?.split(" ")[0] ?? null;
  const differentTechnician = requestedName !== null && requestedName !== tech.name;
  return (
    <Phone>
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
        {tech.company}
      </p>
      <h1 className="nara-serif animate-rise mt-4 text-[32px] leading-tight font-medium">
        {differentTechnician
          ? `${requestedFirst} is unavailable. Cool Air can send ${tech.name}, ${windowLabel}.`
          : `${tech.name} can take this visit at ${windowLabel}.`}
      </h1>
      <p className="mt-4 text-[16px] font-semibold text-sage-deep">{windowLabel}</p>
      {reason ? <p className="mt-3 text-[15px] leading-relaxed text-ink/80">{reason}</p> : null}
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        This is not confirmed until you accept.
      </p>
      <button
        type="button"
        onClick={onAccept}
        className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-sage text-[16px] font-semibold text-cream"
      >
        Accept {first}
      </button>
      <button
        type="button"
        onClick={onDecline}
        className="mt-3 text-[14px] font-medium text-sage-deep underline decoration-sage/30 underline-offset-4"
      >
        Decline
      </button>
    </Phone>
  );
}

function ConfirmedScreen({ tech, windowLabel }: { tech: RosterTech | null; windowLabel: string }) {
  const person = tech?.name ?? "Your technician";
  const first = tech ? firstName(tech) : "They";
  return (
    <Phone>
      <h1 className="nara-serif animate-rise text-[30px] leading-tight font-medium">You’re booked.</h1>
      <div className="mt-3">
        <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[11px] font-semibold text-sage-deep">
          Appointment confirmed
        </span>
        <p className="mt-3 text-[16px] font-semibold text-ink">
          {person} · {windowLabel}
        </p>
        <p className="mt-1 text-[14px] text-sage-deep">{first} from {tech?.company ?? "Cool Air Mechanical"}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          We’ve shared your equipment information and issue summary with {first} so they can
          arrive prepared.
        </p>
      </div>
      {tech ? (
        <div className="animate-rise delay-1 mt-5 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tech.portrait} alt={tech.name} className="h-14 w-14 rounded-full object-cover" />
          <div>
            <p className="text-[16px] font-semibold">{person}</p>
            <p className="text-[13px] text-muted">{tech.company}</p>
            <p className="text-[12px] text-sage-deep">{tech.expertise}</p>
          </div>
        </div>
      ) : null}
      <div className="animate-rise delay-2 mt-5 rounded-[24px] bg-paper p-4 ring-1 ring-line/80">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
          Preliminary · not a confirmed fault
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/85">
          Air is moving inside. The outdoor unit is not running. {CARRIER_CONDENSER.label} and its
          service history go with the visit. {historyForVisit()}
        </p>
        <p className="mt-3 text-[14px] text-muted">Diagnostic visit · AC isn’t cooling</p>
      </div>
      <ServiceHistory
        records={[
          scheduledServiceRecord(
            tech ? { name: tech.name, company: tech.company } : null,
            windowLabel,
          ),
        ]}
      />
    </Phone>
  );
}

function historyForVisit() {
  const prior = historicalServiceRecords().find((record) => record.id === "svc-2023-capacitor");
  if (!prior) return "Completed service records are history. They are not a confirmed fault.";
  return `The ${prior.year} ${prior.title.toLowerCase()} is history for the visit. It is not a confirmed fault.`;
}

/** The live case's LLM output, from apps/nara-home-rescue/src/data/live.ts (DemoFrame.live). */
export type LiveBits = {
  assessment?: string;
  typing?: boolean;
  technician?: { name: string; title: string };
  offerReason?: string;
  acceptReason?: string;
};
