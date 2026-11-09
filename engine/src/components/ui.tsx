import React, { createContext, useContext } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Style } from "../types";

/* ---------------------------------------------------------------- layout */
// Canvas is always 1080×1920. Everything important stays 120px from the sides:
// phones crop / stretch 9:16 and the IG UI covers the edges.
export const W = 1080;
export const H = 1920;
export const SAFE_X = 120;
export const CARD_W = W - SAFE_X * 2; // 840
export const ZONE_TOP = 260; // default card position (upper third)
export const LOW_TOP = 1110; // use when the face is in the upper part of the frame

/* ---------------------------------------------------------------- theme */
export type Theme = {
  accent: string;
  accentSoft: string;
  font: string;
  mono: string;
  captionSize: number;
  captionTop: number;
  captionWeight: number;
};
const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const makeTheme = (s: Style = {}): Theme => {
  const accent = s.accent ?? "#2DD4BF";
  const [r, g, b] = hexToRgb(accent);
  return {
    accent,
    accentSoft: `rgba(${r},${g},${b},0.35)`,
    font: s.font ?? "Onest",
    mono: s.mono ?? "Martian Mono",
    captionSize: s.captionSize ?? 52,
    captionTop: s.captionTop ?? 1420,
    captionWeight: s.captionWeight ?? 600,
  };
};
export const ThemeCtx = createContext<Theme>(makeTheme());
export const useTheme = () => useContext(ThemeCtx);

export const RED = "#FF5A6E";
export const CARD_BG = "rgba(7,11,18,0.86)"; // no backdrop-blur in a transparent layer → denser bg
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* ---------------------------------------------------------------- time */
// Items are placed in <Sequence from=...>, so useCurrentFrame() is local.
// `at` values in edit.json are absolute seconds → convert with the item's start.
export const useLocal = (fromS: number) => {
  const { fps } = useVideoConfig();
  return (s: number | undefined, fallback = 0) => (s === undefined ? fallback : Math.max(0, Math.round((s - fromS) * fps)));
};

/* ---------------------------------------------------------------- motion */
// In: 0.33 s fade + rise. Out: 0.27 s fade + small lift. No bounces, no springs on text.
export const useCardMotion = (d: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inF = Math.round(fps * 0.33);
  const outF = Math.round(fps * 0.27);
  const inP = interpolate(f, [0, inF], [0, 1], { ...CLAMP, easing: EASE });
  const outP = interpolate(f, [d - outF, d], [0, 1], { ...CLAMP, easing: Easing.in(Easing.quad) });
  return { opacity: inP * (1 - outP), transform: `translateY(${(1 - inP) * 18 - outP * 10}px)` };
};
export const useReveal = (at: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(f, [at, at + Math.round(fps * 0.3)], [0, 1], { ...CLAMP, easing: EASE });
  return { p, style: { opacity: p, transform: `translateY(${(1 - p) * 10}px)` } as React.CSSProperties };
};

/* ---------------------------------------------------------------- primitives */
export const Zone: React.FC<{ top?: number; children: React.ReactNode }> = ({ top = ZONE_TOP, children }) => (
  <AbsoluteFill style={{ alignItems: "center" }}>
    <div style={{ position: "absolute", top }}>{children}</div>
  </AbsoluteFill>
);

export const Corners: React.FC = () => {
  const { accent } = useTheme();
  const c = (s: React.CSSProperties) => (
    <div style={{ position: "absolute", width: 22, height: 22, borderColor: accent, borderStyle: "solid", ...s }} />
  );
  return (
    <>
      {c({ left: -2, top: -2, borderWidth: "3px 0 0 3px", borderTopLeftRadius: 8 })}
      {c({ right: -2, top: -2, borderWidth: "3px 3px 0 0", borderTopRightRadius: 8 })}
      {c({ left: -2, bottom: -2, borderWidth: "0 0 3px 3px", borderBottomLeftRadius: 8 })}
      {c({ right: -2, bottom: -2, borderWidth: "0 3px 3px 0", borderBottomRightRadius: 8 })}
    </>
  );
};

export const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const t = useTheme();
  return (
    <div style={{ fontFamily: t.mono, fontWeight: 500, fontSize: 22, letterSpacing: 3, color: t.accent, textTransform: "uppercase" }}>
      ◆ {children}
    </div>
  );
};

export const Panel: React.FC<{ d: number; top?: number; children: React.ReactNode }> = ({ d, top, children }) => {
  const t = useTheme();
  const m = useCardMotion(d);
  return (
    <Zone top={top}>
      <div
        style={{
          ...m,
          position: "relative",
          width: CARD_W,
          background: CARD_BG,
          border: `1.5px solid ${t.accentSoft}`,
          borderRadius: 22,
          padding: "28px 34px 30px",
        }}
      >
        <Corners />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 18 }}>{children}</div>
      </div>
    </Zone>
  );
};

export const Check: React.FC<{ color: string }> = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24">
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Font size that keeps one line of `text` inside `maxW` px (Onest ≈ 0.56em per glyph).
export const fitSize = (text: string, maxW: number, max: number, perGlyph = 0.56) =>
  Math.max(28, Math.min(max, Math.floor(maxW / Math.max(1, text.length * perGlyph))));
