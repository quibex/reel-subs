import React, { useEffect, useState } from "react";
import { AbsoluteFill, Sequence, continueRender, delayRender, useVideoConfig } from "remotion";
import "@fontsource/onest/400.css";
import "@fontsource/onest/500.css";
import "@fontsource/onest/600.css";
import "@fontsource/onest/700.css";
import "@fontsource/martian-mono/400.css";
import "@fontsource/martian-mono/500.css";
import type { Edit, Item } from "./types";
import { ThemeCtx, makeTheme } from "./components/ui";
import { Captions } from "./components/Captions";
import { Badge, Big, CardItem, Hook, Pop, Punch, Terminal } from "./components/items";

// Transparent 1080×1920 layer: graphics only, no video. ffmpeg puts it on top of the
// untouched source later — that is what keeps skin tones exactly as they were.

const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const fams = ["400 40px Onest", "500 40px Onest", "600 40px Onest", "700 40px Onest", "400 40px 'Martian Mono'", "500 40px 'Martian Mono'"];
    Promise.all(fams.flatMap((f) => [document.fonts.load(f, "Аа Aa 0"), document.fonts.load(f, "Hello")]))
      .catch(() => undefined)
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle));
  }, [handle]);
};

const renderItem = (it: Item, d: number) => {
  switch (it.type) {
    case "hook": return <Hook d={d} text={it.text} top={it.top} />;
    case "card": return <CardItem d={d} it={it} />;
    case "big": return <Big d={d} it={it} />;
    case "terminal": return <Terminal d={d} it={it} />;
    case "punch": return <Punch d={d} it={it} />;
    case "pop": return <Pop d={d} it={it} />;
    case "badge": return <Badge text={it.text} />;
    default: return null;
  }
};

export const Overlay: React.FC<Edit> = (edit) => {
  useFonts();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = makeTheme(edit.style);
  const fr = (s: number) => Math.round(s * fps);
  // Captions are hidden automatically while a hook or punch is on screen.
  const autoOff: [number, number][] = (edit.items ?? [])
    .filter((i): i is Extract<Item, { type: "hook" | "punch" }> => i.type === "hook" || i.type === "punch")
    .map((i) => [i.from, i.to]);
  return (
    <ThemeCtx.Provider value={theme}>
      <AbsoluteFill>
        {(edit.items ?? []).map((it, i) => {
          const fromS = "from" in it && it.from !== undefined ? it.from : 0;
          const toS = "to" in it && it.to !== undefined ? it.to : durationInFrames / fps;
          const from = fr(fromS);
          const d = Math.min(durationInFrames, fr(toS)) - from;
          if (d <= 0) return null;
          return (
            <Sequence key={i} from={from} durationInFrames={d} layout="none">
              {renderItem(it, d)}
            </Sequence>
          );
        })}
        <Captions captions={edit.captions ?? []} off={[...autoOff, ...(edit.captionsOff ?? [])]} />
      </AbsoluteFill>
    </ThemeCtx.Provider>
  );
};
