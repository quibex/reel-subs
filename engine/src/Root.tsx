import React from "react";
import { Composition } from "remotion";
import { Overlay } from "./Overlay";
import type { Edit } from "./types";

// A tiny example so `npm run studio` shows something. Real renders pass edit.json as inputProps.
const sample: Edit = {
  source: "",
  video: { width: 1080, height: 1920, fps: 30, durationInFrames: 240 },
  captions: [
    { startMs: 2600, endMs: 4600, text: "Субтитры и анимации" },
    { startMs: 4600, endMs: 7000, text: "пишутся *кодом*, рендер локально" },
  ],
  items: [
    { type: "hook", from: 0, to: 2.5, text: "Как я делаю анимации для рилсов" },
    { type: "badge", text: "#demo", from: 0 },
    {
      type: "card", from: 2.6, to: 7.6, label: "пайплайн", title: "Речь → код → ролик",
      chips: [{ text: "ASR", at: 3.0 }, { text: "Remotion", at: 3.6 }, { text: "MP4", at: 4.4, on: true }],
    },
  ],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Overlay"
    component={Overlay as unknown as React.FC<Record<string, unknown>>}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={240}
    defaultProps={sample as unknown as Record<string, unknown>}
    calculateMetadata={({ props }) => {
      const e = props as unknown as Edit;
      return { fps: e.video.fps, durationInFrames: e.video.durationInFrames };
    }}
  />
);
