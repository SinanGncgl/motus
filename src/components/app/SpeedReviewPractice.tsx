import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { localApi } from "@/lib/local-api";
import { buildSpeedReviewItems, type SpeedReviewItem } from "@/lib/study";
import type { LocalCard } from "@/types";
import { ThumbsUp, ThumbsDown, SkipForward, RotateCcw } from "lucide-react";

interface SpeedReviewPracticeProps {
  cards: LocalCard[];
  onComplete?: (stats: { reviewed: number; correct: number; incorrect: number }) => void;
}

export function SpeedReviewPractice({ cards, onComplete }: SpeedReviewPracticeProps) {
  const items = buildSpeedReviewItems(cards);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [done, setDone] = useState(false);

  const current: SpeedReviewItem | undefined = items[idx];

  const handleRate = useCallback(async (rating: "good" | "again") => {
    if (!current) return;
    const isCorrect = rating === "good";
    if (isCorrect) setCorrect((c) => c + 1);
    else setIncorrect((c) => c + 1);

    try {
      await localApi.cards.rate(current.cardId, rating);
    } catch { /* ignore */ }

    if (idx + 1 < items.length) {
      setIdx((i) => i + 1);
      setRevealed(false);
    } else {
      setDone(true);
      onComplete?.({ reviewed: items.length, correct: correct + (isCorrect ? 1 : 0), incorrect: incorrect + (isCorrect ? 0 : 1) });
    }
  }, [current, idx, items.length, correct, incorrect, onComplete]);

  const handleSkip = useCallback(() => {
    if (idx + 1 < items.length) {
      setIdx((i) => i + 1);
      setRevealed(false);
    } else {
      setDone(true);
    }
  }, [idx, items.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!revealed) setRevealed(true);
      }
      if (revealed) {
        if (e.key === "1" || e.key === "j") handleRate("again");
        if (e.key === "2" || e.key === "k") handleRate("good");
      }
      if (e.key === "s" || e.key === "n") handleSkip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [revealed, handleRate, handleSkip]);

  if (items.length === 0) {
    return <p className="text-muted-foreground">No cards to review. Save some words first!</p>;
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-lg font-semibold">Speed review complete!</p>
        <div className="flex gap-6 text-sm">
          <span className="text-green-500">{correct} correct</span>
          <span className="text-red-500">{incorrect} incorrect</span>
          <span className="text-muted-foreground">{items.length} reviewed</span>
        </div>
        <Button variant="outline" onClick={() => { setIdx(0); setCorrect(0); setIncorrect(0); setDone(false); setRevealed(false); }}>
          <RotateCcw className="mr-2 size-4" /> Review Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-xs text-muted-foreground">
        {idx + 1} / {items.length}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex w-full max-w-lg flex-col items-center gap-3 overflow-y-auto rounded-xl border bg-card p-8 shadow-sm"
        >
          {current?.screenshotUrl && (
            <img src={current.screenshotUrl} alt="" className="mb-2 w-full rounded-lg object-contain" />
          )}
          <p className="text-center text-2xl font-semibold">{current?.front}</p>

          {revealed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full space-y-2 border-t pt-3 text-sm text-muted-foreground"
            >
              {current?.back?.split("\n").map((line, i) => <p key={i}>{line}</p>)}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {!revealed ? (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setRevealed(true)} className="gap-2">
            Show Answer <span className="text-xs text-muted-foreground">Space</span>
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="gap-2">
            Skip <SkipForward className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          <Button variant="destructive" onClick={() => handleRate("again")} className="gap-2">
            <ThumbsDown className="size-4" /> Again <span className="text-xs opacity-70">1</span>
          </Button>
          <Button onClick={() => handleRate("good")} className="gap-2 bg-green-600 hover:bg-green-700">
            <ThumbsUp className="size-4" /> Good <span className="text-xs opacity-70">2</span>
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Space/Enter = reveal · 1 = again · 2 = good · S = skip
      </p>
    </div>
  );
}
