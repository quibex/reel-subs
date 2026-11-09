import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Chip as ChipT, Item, TermLine } from "../types";
import {
  CARD_BG, CARD_W, CLAMP, EASE, RED, SAFE_X, ZONE_TOP,
  Check, Label, Panel, Zone, fitSize, useCardMotion, useLocal, useReveal, useTheme,
} from "./ui";

/* ================================================================ hook */
// First seconds of the reel: the point of the video in one punchy line.
// White bold text on a black plate, low in the frame (top ≈ 1230) so the face stays clear.
export const Hook: React.FC<{ d: number; text: string; top?: number }> = ({ d, text, top = 1230 }) => {
  const t = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(f, [0, Math.round(fps * 0.2)], [0, 1], { ...CLAMP, easing: EASE });
  const out = interpolate(f, [d - Math.round(fps * 0.2), d], [1, 0], CLAMP);
  return (
    <Zone top={top}>
      <div style={{ opacity: Math.min(p, out), transform: `translateY(${(1 - p) * 14}px)`, maxWidth: CARD_W, textAlign: "center" }}>
        <span
          style={{
            fontFamily: t.font, fontWeight: 700, fontSize: 54, lineHeight: 1.42, color: "white",
            background: "rgba(0,0,0,0.92)", padding: "6px 18px", borderRadius: 10,
            boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
          }}
        >
          {text}
        </span>
      </div>
    </Zone>
  );
};

/* ================================================================ card */
const ChipView: React.FC<{ c: ChipT; from: number }> = ({ c, from }) => {
  const t = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLocal(from);
  const r = useReveal(L(c.at, Math.round(fps * 0.15)));
  const sAt = c.strikeAt === undefined ? undefined : L(c.strikeAt);
  const s = sAt === undefined ? 0 : interpolate(f, [sAt, sAt + Math.round(fps * 0.27)], [0, 1], { ...CLAMP, easing: EASE });
  return (
    <span
      style={{
        ...r.style, position: "relative", display: "inline-flex", alignItems: "center", gap: 10, whiteSpace: "nowrap",
        fontFamily: t.mono, fontWeight: 500, fontSize: 25, padding: "11px 16px", borderRadius: 12,
        color: c.on ? "#03201C" : "rgba(255,255,255,0.9)",
        background: c.on ? t.accent : "rgba(255,255,255,0.05)",
        border: `1.5px solid ${c.on ? t.accent : "rgba(255,255,255,0.22)"}`,
      }}
    >
      {c.check ? <Check color={c.on ? "#03201C" : t.accent} /> : null}
      <span style={{ opacity: 1 - s * 0.45 }}>{c.text}</span>
      {sAt !== undefined ? (
        <span style={{ position: "absolute", left: 12, top: "52%", height: 3, borderRadius: 2, background: RED, width: `calc(${s * 100}% - 24px)` }} />
      ) : null}
    </span>
  );
};

export const CardItem: React.FC<{ d: number; it: Extract<Item, { type: "card" }> }> = ({ d, it }) => {
  const t = useTheme();
  return (
    <Panel d={d} top={it.top}>
      {it.label ? <Label>{it.label}</Label> : null}
      {it.title ? (
        <div style={{ fontFamily: t.font, fontWeight: 600, fontSize: 52, lineHeight: 1.12, color: "white" }}>{it.title}</div>
      ) : null}
      {it.sub ? (
        <div style={{ fontFamily: t.font, fontWeight: 500, fontSize: 31, lineHeight: 1.3, color: "rgba(255,255,255,0.72)" }}>{it.sub}</div>
      ) : null}
      {it.chips?.length ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {it.chips.map((c, i) => <ChipView key={i} c={c} from={it.from} />)}
        </div>
      ) : null}
    </Panel>
  );
};

/* ================================================================ big number / word */
export const Big: React.FC<{ d: number; it: Extract<Item, { type: "big" }> }> = ({ d, it }) => {
  const t = useTheme();
  const m = useCardMotion(d);
  const size = it.size ?? fitSize(it.value, CARD_W, 230, 0.6);
  return (
    <Zone top={it.top ?? 300}>
      <div style={{ ...m, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: CARD_W }}>
        {it.label ? <Label>{it.label}</Label> : null}
        <div
          style={{
            fontFamily: t.font, fontWeight: 600, fontSize: size, lineHeight: 1, color: "white", whiteSpace: "nowrap",
            textShadow: `0 0 40px ${t.accentSoft}, 0 6px 30px rgba(0,0,0,0.6)`,
          }}
        >
          {it.value}
        </div>
      </div>
    </Zone>
  );
};

/* ================================================================ terminal */
export const Terminal: React.FC<{ d: number; it: Extract<Item, { type: "terminal" }> }> = ({ d, it }) => {
  const t = useTheme();
  const m = useCardMotion(d);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLocal(it.from);
  const lines = it.lines.map((l: TermLine) => ({ ...l, f0: L(l.at) }));
  return (
    <Zone top={it.top}>
      <div style={{ ...m, width: CARD_W, background: "rgba(5,8,8,0.9)", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: 18, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
          <span style={{ marginLeft: 12, fontFamily: t.mono, fontSize: 19, color: "rgba(255,255,255,0.45)" }}>{it.file ?? "terminal"}</span>
        </div>
        <div style={{ padding: "22px 28px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
          {lines.map((l, i) => {
            if (f < l.f0) return null;
            const n = Math.floor(interpolate(f, [l.f0, l.f0 + Math.round(fps * 0.45)], [0, l.text.length], CLAMP));
            const color = l.tone === "ok" ? t.accent : l.tone === "dim" ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.9)";
            const last = i === lines.length - 1 || f < lines[i + 1].f0;
            return (
              <div key={i} style={{ fontFamily: t.mono, fontWeight: 400, fontSize: 24, color, whiteSpace: "pre-wrap" }}>
                {l.tone === "cmd" ? <span style={{ color: t.accent }}>{"> "}</span> : null}
                {l.text.slice(0, n)}
                {last && Math.floor(f / (fps / 2)) % 2 === 0 ? (
                  <span style={{ display: "inline-block", width: 13, height: 25, marginLeft: 4, background: t.accent, verticalAlign: "-4px" }} />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </Zone>
  );
};

/* ================================================================ punch (self-irony) */
// `a` appears and gets crossed out, then the punchline `b` lands big.
export const Punch: React.FC<{ d: number; it: Extract<Item, { type: "punch" }> }> = ({ d, it }) => {
  const t = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = useCardMotion(d);
  const hasA = !!it.a;
  const strike = interpolate(f, [fps * 0.5, fps * 0.8], [0, 1], { ...CLAMP, easing: EASE });
  const bAt = hasA ? fps * 0.85 : 0;
  const bp = interpolate(f, [bAt, bAt + 6], [0, 1], { ...CLAMP, easing: EASE });
  const bSize = it.bSize ?? fitSize(it.b, CARD_W, 96, 0.58);
  return (
    <Zone top={it.top ?? ZONE_TOP}>
      <div style={{ ...m, width: CARD_W, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center" }}>
        {it.label ? <Label>{it.label}</Label> : null}
        {hasA ? (
          <div style={{ position: "relative", fontFamily: t.font, fontWeight: 500, fontSize: 40, color: "rgba(255,255,255,0.8)", textShadow: "0 3px 18px rgba(0,0,0,0.8)" }}>
            {it.a}
            <span style={{ position: "absolute", left: 0, top: "54%", height: 4, borderRadius: 2, background: RED, width: `${strike * 100}%` }} />
          </div>
        ) : null}
        <div
          style={{
            opacity: bp, transform: `scale(${0.9 + bp * 0.1})`,
            fontFamily: t.font, fontWeight: 700, fontSize: bSize, lineHeight: 1.05, color: "white",
            textShadow: `0 0 30px ${t.accentSoft}, 0 6px 26px rgba(0,0,0,0.75)`,
          }}
        >
          {it.b}
        </div>
      </div>
    </Zone>
  );
};

/* ================================================================ pop: HUD widgets */
// For moments like "and then these animations go chik-chik": small widgets snap in
// (2 frames) next to the hands. Place them ~0.3 s BEFORE the word — ASR timings lag.
export const Pop: React.FC<{ d: number; it: Extract<Item, { type: "pop" }> }> = ({ d, it }) => {
  const t = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = interpolate(f, [0, 2], [0, 1], CLAMP);
  const out = interpolate(f, [d - Math.round(fps * 0.2), d], [1, 0], CLAMP);
  const sp = spring({ frame: f, fps, config: { damping: 14, mass: 0.6 } });
  const box: React.CSSProperties = {
    position: "absolute", left: it.x, top: it.y, transform: `translate(-50%,-50%) scale(${0.7 + inP * 0.3})`,
    opacity: inP * out, background: CARD_BG, border: `1.5px solid ${t.accentSoft}`, borderRadius: 18,
    padding: "16px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    boxShadow: `0 0 24px ${t.accentSoft}`,
  };
  const label = it.label ? (
    <div style={{ fontFamily: t.mono, fontSize: 18, letterSpacing: 2, color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>{it.label}</div>
  ) : null;
  let body: React.ReactNode = null;
  if (it.widget === "ring") {
    const R = 46, C = 2 * Math.PI * R;
    body = (
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={R} stroke="rgba(255,255,255,0.12)" strokeWidth="10" fill="none" />
        <circle cx="60" cy="60" r={R} stroke={t.accent} strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - 0.78 * sp)} transform="rotate(-90 60 60)" />
        <text x="60" y="68" textAnchor="middle" fill="white" fontFamily={t.mono} fontSize="24">{it.value ?? `${Math.round(78 * sp)}%`}</text>
      </svg>
    );
  } else if (it.widget === "chart") {
    const bars = [0.35, 0.55, 0.45, 0.75, 0.95];
    body = (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
        {bars.map((b, i) => {
          const p = spring({ frame: f - i * 2, fps, config: { damping: 15, mass: 0.5 } });
          return <div key={i} style={{ width: 18, height: 100 * b * p, borderRadius: 4, background: i === bars.length - 1 ? t.accent : "rgba(255,255,255,0.35)" }} />;
        })}
      </div>
    );
  } else if (it.widget === "progress") {
    const p = interpolate(f, [0, d * 0.8], [0.1, 1], { ...CLAMP, easing: EASE });
    body = (
      <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.12)" }}>
          <div style={{ width: `${p * 100}%`, height: 10, borderRadius: 5, background: t.accent }} />
        </div>
        <div style={{ fontFamily: t.mono, fontSize: 20, color: t.accent, textAlign: "right" }}>{it.value ?? `${Math.round(p * 100)}%`}</div>
      </div>
    );
  } else if (it.widget === "check") {
    body = (
      <div style={{ width: 84, height: 84, borderRadius: 42, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${sp})` }}>
        <svg width="46" height="46" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#03201C" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    );
  } else if (it.widget === "code") {
    body = <div style={{ fontFamily: t.mono, fontSize: 30, color: t.accent, whiteSpace: "nowrap" }}>{it.value ?? "<Motion />"}</div>;
  }
  return (
    <AbsoluteFill>
      <div style={box}>{body}{label}</div>
    </AbsoluteFill>
  );
};

/* ================================================================ badge */
export const Badge: React.FC<{ text: string }> = ({ text }) => {
  const t = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(f, [4, 4 + Math.round(fps * 0.4)], [0, 1], { ...CLAMP, easing: EASE });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute", left: SAFE_X, top: 150, opacity: p, transform: `translateX(${(1 - p) * -16}px)`,
          display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRadius: 12,
          background: "rgba(7,11,18,0.72)", border: `1.5px solid ${t.accent}`,
          fontFamily: t.mono, fontWeight: 500, fontSize: 25, color: t.accent, letterSpacing: 1,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 5, background: t.accent, boxShadow: `0 0 10px ${t.accent}`, opacity: 0.55 + 0.45 * Math.abs(Math.sin(f / 18)) }} />
        {text}
      </div>
    </AbsoluteFill>
  );
};
