import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SpeakerButton } from "@/components/app/SpeakerButton";
import { useDueCards, useLocalWords } from "@/hooks/use-local-data";
import { session, streak } from "@/lib/streak";
import { localApi, type LocalCard, type LocalWord } from "@/lib/local-api";
import { ClozePractice, DictationPractice } from "@/components/app/PracticeModes";
import { speak } from "@/lib/tts";
import type { PracticeMode } from "@/lib/study";
import { motion } from "framer-motion";
import {
  Check,
  Captions,
  GraduationCap,
  Loader2,
  PartyPopper,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEffect, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Card = LocalCard;

function formatNextDue(ms: number): string {
  const now = Date.now();
  const diff = ms - now;
  if (diff <= 0) return "now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

export default function Practice() {
  const [due, refreshDue] = useDueCards();
  const navigate = useNavigate();

  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [againQueue, setAgainQueue] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);

  const [mode, setMode] = useState<PracticeMode>("flashcard");
  const [allWords] = useLocalWords();
  const [nextReviewInfo, setNextReviewInfo] = useState<string | null>(null);

  const queue = useMemo(() => {
    const fresh = (due ?? []).filter((c) => !reviewed.has(c.id ?? c._id ?? ""));
    return [...fresh, ...againQueue];
  }, [due, reviewed, againQueue]);

  const newCount = useMemo(() => {
    return queue.filter((c) => c.box === 0).length;
  }, [queue]);

  const current = queue[0] ?? null;
  const reviewedCount = reviewed.size;
  const totalCount = reviewedCount + queue.length;

  // Fetch next due time when no cards are available
  useEffect(() => {
    if (due && due.length === 0 && againQueue.length === 0 && reviewed.size === 0) {
      localApi.cards.nextDue().then((r) => setNextReviewInfo(formatNextDue(r.nextDue))).catch(() => {});
    }
  }, [due, againQueue.length, reviewed.size]);

  const handleRate = useCallback(async (rating: "again" | "hard" | "good" | "easy") => {
    if (!current || isRating) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (rating === "again") setIncorrectCount((n) => n + 1);
    else setCorrectCount((n) => n + 1);
    setIsRating(true);
    try {
      const result = await localApi.cards.rate(current.id ?? current._id ?? "", rating);
      if (result.nextDue) {
        setNextReviewInfo(`Next review: ${formatNextDue(result.nextDue)}`);
      }
      await refreshDue();
      setReviewed((prev) => {
        const next = new Set(prev);
        next.add(current.id ?? current._id ?? "");
        return next;
      });
      const cid = current.id ?? current._id;
      if (rating === "again") {
        setAgainQueue((q) => [...q, current]);
      } else {
        setAgainQueue((q) => q.filter((c) => (c.id ?? c._id) !== cid));
      }
      setFlipped(false);
      streak.record(1);
    } catch (error) {
      console.error(error);
      toast.error("Could not record your answer.");
    } finally {
      setIsRating(false);
    }
  }, [current, isRating]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (isRating) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "1") {
        void handleRate("again");
      } else if (e.key === "2") {
        void handleRate("hard");
      } else if (e.key === "3") {
        void handleRate("good");
      } else if (e.key === "4") {
        void handleRate("easy");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleRate]);

  useEffect(() => {
    setNextReviewInfo(null);
    setFlipped(false);
  }, [current?.id]);

  // Auto-play pronunciation when a new card appears
  useEffect(() => {
    if (current && mode === "flashcard" && !flipped) {
      speak(current.front, current.language || "de");
    }
  }, [current?.id, mode, flipped]);

  const resetSession = () => {
    setReviewed(new Set());
    setAgainQueue([]);
    setFlipped(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setSessionRecorded(false);
  };

  const [sessionRecorded, setSessionRecorded] = useState(false);

  // Persist a session accuracy summary when the queue drains (session ends).
  useEffect(() => {
    if (reviewed.size > 0 && queue.length === 0 && !sessionRecorded) {
      session.record(reviewed.size, correctCount);
      setSessionRecorded(true);
    }
  }, [queue.length, reviewed.size, correctCount, sessionRecorded]);

  if (due === undefined) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (due.length === 0 && againQueue.length === 0 && reviewed.size === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review your Anki cards — no cards are due right now.
          </p>
        </header>
        <Empty className="min-h-[420px] rounded-2xl border bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PartyPopper className="size-6" />
            </EmptyMedia>
            <EmptyTitle>All caught up</EmptyTitle>
            <EmptyDescription>
              Every card is scheduled.{" "}
              {nextReviewInfo
                ? `${nextReviewInfo}. `
                : ""}
              Save more words from subtitles to grow your deck.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="cursor-pointer gap-2"
            >
              <Captions className="size-4" />
              Learn new words
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
        </header>
        <Empty className="min-h-[420px] rounded-2xl border bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GraduationCap className="size-6" />
            </EmptyMedia>
            <EmptyTitle>Session complete</EmptyTitle>
            <EmptyDescription>
              You reviewed {reviewedCount}{" "}
              {reviewedCount === 1 ? "card" : "cards"} this session.{" "}
              {correctCount > 0 || incorrectCount > 0
                ? `${correctCount} recalled, ${incorrectCount} to revisit.`
                : "Come back when the next ones are due."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={resetSession}
                className="cursor-pointer gap-2"
              >
                <RotateCcw className="size-4" />
                Start over
              </Button>
              <Button
                type="button"
                onClick={() => navigate("/words")}
                className="cursor-pointer gap-2"
              >
                <Sparkles className="size-4" />
                View words
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {queue.length} left · {reviewedCount} reviewed this session
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" />
          {reviewedCount}/{totalCount}
        </Badge>
      </header>
      <div className="flex flex-wrap gap-2">
        {(["flashcard", "cloze", "dictation"] as PracticeMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors ${mode === m ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}
          >
            {m}
          </button>
        ))}
      </div>


      <Progress value={(reviewedCount / Math.max(totalCount, 1)) * 100} />

      {(correctCount > 0 || incorrectCount > 0) && (
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            {correctCount} recalled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive" />
            {incorrectCount} to revisit
          </span>
          {newCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sky-500" />
              {newCount} new
            </span>
          )}
        </div>
      )}

      {mode === "flashcard" ? (
      <div className="mx-auto w-full max-w-xl">
        {/* Flashcard */}
        <div
          className="relative cursor-pointer select-none"
          style={{ perspective: "1200px" }}
          onClick={() => setFlipped((f) => !f)}
        >
          <motion.div
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            style={{ transformStyle: "preserve-3d" }}
            className="relative min-h-[340px] w-full"
          >
            {/* Front */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border bg-card p-10 shadow-lg"
              style={{ backfaceVisibility: "hidden" }}
            >
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                (current.cardType ?? "word") === "sentence" 
                  ? "bg-blue-500/10 text-blue-500" 
                  : "bg-purple-500/10 text-purple-500"
              }`}>
                {(current.cardType ?? "word") === "sentence" ? "Sentence" : "Word"}
              </span>
              {(current.cardType ?? "word") === "sentence" ? (
                <>
                  <Badge variant="outline" className="text-xs font-normal">
                    Fill in the blank
                  </Badge>
                  <p className="text-center text-2xl leading-8 text-foreground/90">
                    {current.front}
                  </p>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="text-xs font-normal">
                    Do you know this word?
                  </Badge>
                  <SpeakerButton
                    text={current.front}
                    lang={current.language || "de"}
                    label="Pronounce"
                  />
                  {current.screenshotUrl && (
                    <img
                      src={current.screenshotUrl}
                      alt=""
                      className="w-full max-h-32 rounded-lg object-cover"
                    />
                  )}
                  <p className="text-center text-4xl font-semibold tracking-tight">
                    {current.front}
                  </p>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Click to reveal the answer
              </p>
            </div>
            {/* Back */}
            <div
              className="absolute inset-0 flex flex-col justify-center gap-5 rounded-2xl border bg-card p-10 shadow-lg"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold tracking-tight">
                    {current.front}
                  </p>
                   {(current.cardType ?? "word") === "word" && (
                    <SpeakerButton
                      text={current.front}
                      lang={current.language || "de"}
                      label="Pronounce"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(current.leechCount ?? 0) >= 3 && (
                    <Badge variant="outline" className="border-amber-500 text-amber-600">
                      Leech
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    Box {current.box + 1}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col gap-4 overflow-y-auto">
                 {current.screenshotUrl && (current.cardType ?? "word") === "word" && (
                  <img
                    src={current.screenshotUrl}
                    alt=""
                    className="w-full max-h-48 rounded-lg object-cover"
                  />
                )}
                {current.back && (
                  <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">
                    {current.back}
                  </p>
                )}
              </div>
              {(current.leechCount ?? 0) >= 3 && (
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await localApi.cards.suspend(current.id ?? current._id ?? "");
                      await refreshDue();
                      toast.success("Card suspended");
                    }}
                  >
                    Suspend
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Rating controls */}
        <div className="mt-6 grid grid-cols-4 gap-3" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="outline"
            disabled={isRating}
            onClick={() => void handleRate("again")}
            className="cursor-pointer flex-col gap-1 py-3 text-destructive hover:text-destructive sm:flex-row"
          >
            <RotateCcw className="size-4" />
            <span>
              Again
              <kbd className="ml-1.5 rounded border px-1 font-mono text-[10px] text-muted-foreground">
                1
              </kbd>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isRating}
            onClick={() => void handleRate("hard")}
            className="cursor-pointer flex-col gap-1 py-3 sm:flex-row"
          >
            <span>
              Hard
              <kbd className="ml-1.5 rounded border px-1 font-mono text-[10px] text-muted-foreground">
                2
              </kbd>
            </span>
          </Button>
          <Button
            type="button"
            disabled={isRating}
            onClick={() => void handleRate("good")}
            className="cursor-pointer flex-col gap-1 py-3 sm:flex-row"
          >
            <Check className="size-4" />
            <span>
              Good
              <kbd className="ml-1.5 rounded bg-primary-foreground/20 px-1 font-mono text-[10px]">
                3
              </kbd>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isRating}
            onClick={() => void handleRate("easy")}
            className="cursor-pointer flex-col gap-1 py-3 sm:flex-row"
          >
            <TrendingUp className="size-4" />
            <span>
              Easy
              <kbd className="ml-1.5 rounded border px-1 font-mono text-[10px] text-muted-foreground">
                4
              </kbd>
            </span>
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Space flips the card · 1 / 2 / 3 / 4 rates it
        </p>
        {nextReviewInfo && (
          <p className="mt-2 text-center text-xs text-muted-foreground">{nextReviewInfo}</p>
        )}
      </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl">
          {mode === "cloze" ? (
            <ClozePractice
              words={(allWords ?? []) as LocalWord[]}
              cards={due ?? []}
              onResult={(ok) => {
                if (ok) setCorrectCount((c) => c + 1);
                else setIncorrectCount((c) => c + 1);
              }}
              onRate={async (cardId, rating) => {
                try {
                  await localApi.cards.rate(cardId, rating);
                  await refreshDue();
                  streak.record(1);
                } catch {
                  // SRS update is best-effort
                }
              }}
            />
          ) : (
            <DictationPractice
              words={(allWords ?? []) as LocalWord[]}
              cards={due ?? []}
              onResult={(ok) => {
                if (ok) setCorrectCount((c) => c + 1);
                else setIncorrectCount((c) => c + 1);
              }}
              onRate={async (cardId, rating) => {
                try {
                  await localApi.cards.rate(cardId, rating);
                  await refreshDue();
                  streak.record(1);
                } catch {
                  // SRS update is best-effort
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
