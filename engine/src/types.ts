// edit.json — the single file the agent writes for each video.
// All times are in SECONDS of the source video. Layout is in a 1080×1920 canvas
// (scaled to the real video size at compositing time).

export type Caption = { startMs: number; endMs: number; text: string };

export type Chip = {
  text: string;
  at?: number; // when the chip appears (s). Default: together with the card
  on?: boolean; // filled accent chip — the "result"
  check?: boolean; // ✓ in front
  strikeAt?: number; // red strike-through at this time (s)
};

export type TermLine = { at: number; text: string; tone?: "cmd" | "ok" | "dim" };

type Base = { from: number; to: number; top?: number };

export type Item =
  | (Base & { type: "hook"; text: string })
  | (Base & { type: "card"; label?: string; title?: string; sub?: string; chips?: Chip[] })
  | (Base & { type: "big"; label?: string; value: string; size?: number })
  | (Base & { type: "terminal"; file?: string; lines: TermLine[] })
  | (Base & { type: "punch"; label?: string; a?: string; b: string; bSize?: number })
  | (Base & {
      type: "pop";
      widget: "ring" | "chart" | "progress" | "check" | "code";
      x: number; // center of the widget, px in 1080×1920
      y: number;
      label?: string;
      value?: string;
    })
  | { type: "badge"; text: string; from?: number; to?: number };

export type Style = {
  accent?: string; // default #2DD4BF (teal)
  captionSize?: number; // default 52
  captionTop?: number; // default 1420
  captionWeight?: number; // default 600
  font?: string; // default Onest
  mono?: string; // default Martian Mono
};

export type VideoInfo = {
  width: number; // real source size (after rotation)
  height: number;
  fps: number;
  durationInFrames: number;
};

export type Edit = {
  source: string;
  output?: string;
  video: VideoInfo;
  style?: Style;
  captions: Caption[];
  captionsOff?: [number, number][]; // seconds ranges with captions hidden
  items: Item[];
};
