import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "../types";
import { CARD_W, CLAMP, RED, useTheme } from "./ui";

// Phrase-by-phrase captions (~2 s each): white, thick soft outline + shadow,
// readable on any background, no bouncing words.
// Markup inside text: *word* → accent color, ~word~ → red (e.g. your own slip of the tongue).
const renderText = (text: string, accent: string): React.ReactNode[] =>
  text.split(/(\*[^*]+\*|~[^~]+~)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*")) return <span key={i} style={{ color: accent }}>{part.slice(1, -1)}</span>;
    if (part.startsWith("~") && part.endsWith("~")) return <span key={i} style={{ color: RED }}>{part.slice(1, -1)}</span>;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });

const Page: React.FC<{ text: string; dur: number }> = ({ text, dur }) => {
  const t = useTheme();
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [0, 3], [0, 1], CLAMP), interpolate(f, [dur - 3, dur], [1, 0], CLAMP));
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div
        style={{
          position: "absolute", top: t.captionTop, maxWidth: CARD_W, textAlign: "center", opacity: o,
          fontFamily: t.font, fontWeight: t.captionWeight, fontSize: t.captionSize, lineHeight: 1.25, color: "white",
          WebkitTextStroke: "6px rgba(0,0,0,0.55)", paintOrder: "stroke fill",
          textShadow: "0 3px 14px rgba(0,0,0,0.75)",
        }}
      >
        {renderText(text, t.accent)}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{ captions: Caption[]; off: [number, number][] }> = ({ captions, off }) => {
  const { fps } = useVideoConfig();
  const t = useTheme();
  const hidden = (s: number) => off.some(([a, b]) => s >= a && s < b);
  return (
    <AbsoluteFill>
      {captions.map((c, i) => {
        const mid = (c.startMs + c.endMs) / 2000;
        if (!c.text.trim() || hidden(mid)) return null;
        const from = Math.round((c.startMs / 1000) * fps);
        const next = captions[i + 1];
        const endMs = next ? Math.min(c.endMs, next.startMs) : c.endMs;
        const dur = Math.round((endMs / 1000) * fps) - from;
        if (dur <= 0) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <Page text={c.text} dur={dur} />
          </Sequence>
        );
      })}
      {/* keep theme referenced so font loads even before the first caption */}
      <span style={{ fontFamily: t.font, opacity: 0, position: "absolute" }}>.</span>
    </AbsoluteFill>
  );
};
