"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { packetHistoryLines, serviceRecordsAt } from "@/data/serviceHistory";
import { firstName, type RosterTech } from "@/demo/roster";
import { ServiceHistory } from "./ServiceHistory";

const STAGES = ["Booked", "On the way", "Arriving", "Service"] as const;

/**
 * Visuals taken from the original TrackingScreen.
 * The moving marker is an illustration on that route. Nothing here is live GPS or a field repair.
 */
export function EnRouteScreen({ tech, windowLabel }: { tech: RosterTech; windowLabel: string }) {
  const first = firstName(tech);
  return (
    <VisitChrome>
      <h1 className="nara-serif animate-rise text-[30px] leading-tight font-medium">
        {first} is on the way
      </h1>
      <p className="mt-2 text-[13px] font-medium text-muted">Illustrated status · not a live arrival</p>
      <p className="mt-1 text-[14px] font-semibold text-sage-deep">{windowLabel}</p>
      <TechRow tech={tech} />
      <RouteMap />
      <Progress active={1} />
      <RequestCard tech={tech} windowLabel={windowLabel} />
      <ContactRow first={first} />
    </VisitChrome>
  );
}

export function OnSiteScreen({ tech }: { tech: RosterTech }) {
  const first = firstName(tech);
  const [approved, setApproved] = useState(false);

  return (
    <VisitChrome>
      <h1 className="nara-serif animate-rise text-[30px] leading-tight font-medium">
        {first} is on site
      </h1>
      <p className="mt-2 text-[13px] font-medium text-muted">Simulated visit · not a real arrival</p>
      <TechRow tech={tech} />
      <Progress active={3} />
      <div className="animate-rise mt-5 rounded-[24px] bg-paper p-5 ring-1 ring-line/80">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">Repair quote</p>
          <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[11px] font-semibold text-sage-deep">
            Within typical range
          </span>
        </div>
        <p className="nara-serif mt-3 text-[22px] text-ink">Capacitor replacement</p>
        <div className="mt-4 space-y-2 text-[14px]">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Technician quote</span>
            <span className="font-semibold text-ink">$425</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Typical Nara range</span>
            <span className="font-semibold text-ink">$350–$500</span>
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          You’ll always see and approve the price before repair work begins.
        </p>
        <p className="mt-2 text-[11px] text-muted/80">
          Prototype sample. Nara does not guarantee pricing accuracy. This is not a confirmed
          fault and not a completed repair.
        </p>
        <button
          type="button"
          onClick={() => setApproved(true)}
          className={`mt-5 flex h-12 w-full items-center justify-center rounded-full text-[14px] font-semibold ${
            approved ? "bg-sage-soft text-sage-deep" : "bg-sage text-cream"
          }`}
        >
          {approved ? "Price approved" : "Approve $425"}
        </button>
      </div>
    </VisitChrome>
  );
}

export function CompletedScreen({
  tech,
  windowLabel,
}: {
  tech: RosterTech;
  windowLabel: string;
}) {
  return (
    <VisitChrome>
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">Home Passport</p>
      <h1 className="nara-serif mt-3 text-[32px] leading-tight font-medium">Saved on this home.</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Simulated visit for {tech.name}. The prototype quote was reviewed. No field repair was
        performed.
      </p>
      <ServiceHistory
        records={serviceRecordsAt(true, { name: tech.name, company: tech.company }, windowLabel)}
        remember
      />
    </VisitChrome>
  );
}

function VisitChrome({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full flex-col px-6 pb-8 pt-7">{children}</div>;
}

function TechRow({ tech }: { tech: RosterTech }) {
  return (
    <div className="animate-rise delay-1 mt-5 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tech.portrait} alt={tech.name} className="h-14 w-14 rounded-full object-cover" />
      <div>
        <p className="text-[16px] font-semibold">{tech.name}</p>
        <p className="text-[13px] text-muted">{tech.company}</p>
        <p className="text-[12px] text-sage-deep">{tech.expertise}</p>
      </div>
    </div>
  );
}

const ROUTE_PATH = "M48 132 C 90 132, 110 88, 168 78 S 250 70, 308 42";
const ROUTE_LOOP_MS = 16000;

function RouteMap() {
  const pathRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    const marker = markerRef.current;
    if (!path || !marker) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const length = path.getTotalLength();
    let frame = 0;

    const place = (progress: number) => {
      const point = path.getPointAtLength(length * progress);
      marker.setAttribute("cx", point.x.toFixed(2));
      marker.setAttribute("cy", point.y.toFixed(2));
    };

    const stop = () => cancelAnimationFrame(frame);

    const start = () => {
      stop();
      if (media.matches || document.hidden) {
        place(0);
        path.style.animation = "none";
        return;
      }
      path.style.animation = "route-dash 1.2s linear infinite";
      const started = performance.now();
      const tick = (now: number) => {
        const turn = ((now - started) % ROUTE_LOOP_MS) / ROUTE_LOOP_MS;
        const forward = turn < 0.5 ? turn * 2 : (1 - turn) * 2;
        const eased = forward * forward * (3 - 2 * forward);
        place(eased * 0.88);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    start();
    media.addEventListener("change", start);
    document.addEventListener("visibilitychange", start);
    return () => {
      stop();
      media.removeEventListener("change", start);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);

  return (
    <div className="animate-rise delay-2 relative mt-5 h-44 overflow-hidden rounded-[24px] bg-[#dfe8dc] ring-1 ring-line/60">
      <svg viewBox="0 0 360 176" className="h-full w-full" aria-hidden>
        <rect width="360" height="176" fill="#d9e4d4" />
        <g stroke="#c3d0bc" strokeWidth="8" fill="none">
          <path d="M0 48h360" />
          <path d="M0 112h360" />
          <path d="M72 0v176" />
          <path d="M188 0v176" />
          <path d="M292 0v176" />
        </g>
        <path
          ref={pathRef}
          d={ROUTE_PATH}
          fill="none"
          stroke="#3f5c4a"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="6 8"
          className="route-dash"
        />
        <circle ref={markerRef} cx="48" cy="132" r="7" fill="#3f5c4a" />
        <circle cx="308" cy="42" r="10" fill="#b08958" />
        <circle cx="308" cy="42" r="4" fill="#fffcf7" />
      </svg>
      <div className="absolute bottom-3 left-3 rounded-full bg-paper/95 px-3 py-1.5 text-[12px] font-semibold text-ink shadow-sm">
        Illustrated route · not live tracking
      </div>
    </div>
  );
}

function Progress({ active }: { active: number }) {
  return (
    <div className="animate-rise delay-3 mt-5 grid grid-cols-4 gap-1">
      {STAGES.map((label, i) => (
        <div key={label} className="text-center">
          <div className={`mx-auto h-1 rounded-full ${i <= active ? "bg-sage" : "bg-line"}`} />
          <p className={`mt-2 text-[11px] font-medium ${i === active ? "text-ink" : "text-muted"}`}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

function RequestCard({ tech, windowLabel }: { tech: RosterTech; windowLabel: string }) {
  const first = firstName(tech);
  return (
    <div className="animate-rise delay-4 mt-5 rounded-[24px] bg-paper p-4 ring-1 ring-line/80">
      <p className="text-[14px] font-semibold text-ink">{first} already has your service request</p>
      <ul className="mt-3 space-y-1.5 text-[13px] text-muted">
        <li>2014 Carrier condenser</li>
        <li>My AC isn’t cooling.</li>
        {packetHistoryLines().map((line) => (
          <li key={line}>{line}</li>
        ))}
        <li>{windowLabel}</li>
      </ul>
    </div>
  );
}

function ContactRow({ first }: { first: string }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setNote(`Message sent — ${first} will reply shortly. Simulated.`)}
          className="h-12 rounded-full bg-paper text-[14px] font-semibold ring-1 ring-line"
        >
          Message
        </button>
        <button
          type="button"
          onClick={() => setNote("Calling is simulated in this prototype.")}
          className="h-12 rounded-full bg-paper text-[14px] font-semibold ring-1 ring-line"
        >
          Call
        </button>
      </div>
      {note ? <p className="mt-3 text-center text-[13px] text-sage-deep">{note}</p> : null}
    </>
  );
}
