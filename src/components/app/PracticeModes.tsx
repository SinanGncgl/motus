import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SpeakerButton } from "@/components/app/SpeakerButton";
import { LocalWord } from "@/lib/local-api";
import {
  answerMatches,
  buildClozeItems,
  buildDictationItems,
  type ClozeItem,
  type DictationItem,
} from "@/lib/study";
import { speak } from "@/lib/tts";
import { Check, Loader2, RotateCcw, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/* ---------------- Cloze (fill-in-the-blank) ---------------- */

export function ClozePractice({ words, onResult }: { words: LocalWord[]; onResult?: (correct: boolean) => void }) {
  const items = useMemo(() => buildClozeItems(words), [words]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<null | boolean>(null);
  const [done, setDone] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);

  const current: ClozeItem | undefined = items[idx];

  const reset = () => {
    setIdx(0);
    setAnswer("");
    setChecked(null);
    setDone(0);
    setCorrect(0);
    setIncorrect(0);
  };

  if (items.length === 0) {
    return (
      <p className="rounded-xl border bg-card/40 p-6 text-sm text-muted-foreground">
        No example sentences yet. Add example sentences to your saved words
        (open a word, edit it) to practice fill-in-the-blank.
      </p>
    );
  }

  if (!current) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        <Check className="mx-auto size-8 text-emerald-500" />
        <p className="mt-3 text-lg font-semibold">Session complete</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You completed {done} cloze {done === 1 ? "sentence" : "sentences"}.
        </p>
        {done > 0 && (correct > 0 || incorrect > 0) && (
          <p className="text-xs text-muted-foreground">
            {correct} correct · {incorrect} to revisit
          </p>
        )}
        <Button className="mt-4 cursor-pointer gap-2" onClick={reset}>
          <RotateCcw className="size-4" /> Start over
        </Button>
      </div>
    );
  }

  const submit = () => {
    const ok = answerMatches(answer, current.display);
    setChecked(ok);
    onResult?.(ok);
    if (ok) {
      setCorrect((c) => c + 1);
      toast.success("Correct!");
      setTimeout(() => {
        setIdx((i) => i + 1);
        setAnswer("");
        setChecked(null);
        setDone((d) => d + 1);
      }, 700);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Cloze {idx + 1} / {items.length}
        </span>
        <Badge variant="secondary">{done} done</Badge>
      </div>
      {(correct > 0 || incorrect > 0) && (
        <div className="-mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Check className="size-3 text-emerald-500" /> {correct}
          </span>
          <span className="flex items-center gap-1">
            <X className="size-3 text-destructive" /> {incorrect}
          </span>
        </div>
      )}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-lg leading-8">
          {current.sentence.split(" ____ ").map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <span className="mx-1 inline-flex min-w-28 items-center justify-center rounded-md border-2 border-dashed border-primary/40 px-2 align-baseline">
                  {checked === null ? (
                    ""
                  ) : checked ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {current.display}
                    </span>
                  ) : (
                    <span className="font-semibold text-destructive line-through">
                      {current.display}
                    </span>
                  )}
                </span>
              )}
            </span>
          ))}
        </p>
        <div className="mt-5 flex gap-2">
          <Input
            value={answer}
            autoFocus
            onChange={(e) => {
              setAnswer(e.target.value);
              setChecked(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && checked === null) submit();
            }}
            placeholder="Type the missing word"
            className="max-w-xs"
          />
          {checked === null ? (
            <Button className="cursor-pointer" onClick={submit}>
              Check
            </Button>
          ) : !checked ? (
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setIncorrect((c) => c + 1);
                setIdx((i) => i + 1);
                setAnswer("");
                setChecked(null);
                setDone((d) => d + 1);
              }}
            >
              Next
            </Button>
          ) : null}
        </div>
        {checked === false && (
          <p className="mt-2 text-sm text-destructive">
            Not quite — the answer was “{current.display}”.
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        className="w-fit cursor-pointer gap-2 text-muted-foreground"
        onClick={reset}
      >
        <RotateCcw className="size-4" /> Restart
      </Button>
    </div>
  );
}

/* ---------------- Dictation (listen & type) ---------------- */

export function DictationPractice({ words, onResult }: { words: LocalWord[]; onResult?: (correct: boolean) => void }) {
  const items = useMemo(() => buildDictationItems(words), [words]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);

  const current: DictationItem | undefined = items[idx];

  useEffect(() => {
    setAnswer("");
    setRevealed(false);
  }, [idx]);

  const reset = () => {
    setIdx(0);
    setAnswer("");
    setRevealed(false);
    setDone(0);
    setCorrect(0);
    setIncorrect(0);
  };

  if (items.length === 0) {
    return (
      <p className="rounded-xl border bg-card/40 p-6 text-sm text-muted-foreground">
        No example sentences to dictate yet. Add example sentences to your saved
        words to practice listening.
      </p>
    );
  }

  if (!current) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        <Check className="mx-auto size-8 text-emerald-500" />
        <p className="mt-3 text-lg font-semibold">Session complete</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You dictated {done} {done === 1 ? "sentence" : "sentences"}.
        </p>
        {done > 0 && (correct > 0 || incorrect > 0) && (
          <p className="text-xs text-muted-foreground">
            {correct} correct · {incorrect} to revisit
          </p>
        )}
        <Button className="mt-4 cursor-pointer gap-2" onClick={reset}>
          <RotateCcw className="size-4" /> Start over
        </Button>
      </div>
    );
  }

  const play = () => speak(current.sentence, undefined);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Dictation {idx + 1} / {items.length}
        </span>
        <Badge variant="secondary">{done} done</Badge>
      </div>
      {(correct > 0 || incorrect > 0) && (
        <div className="-mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Check className="size-3 text-emerald-500" /> {correct}
          </span>
          <span className="flex items-center gap-1">
            <X className="size-3 text-destructive" /> {incorrect}
          </span>
        </div>
      )}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            className="size-12 cursor-pointer rounded-full"
            onClick={play}
            aria-label="Play sentence"
          >
            <Volume2 className="size-5" />
          </Button>
          <p className="text-sm text-muted-foreground">
            Listen, then type what you heard.
          </p>
        </div>
        <Input
          value={answer}
          autoFocus
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const ok = answerMatches(answer, current.sentence);
              setRevealed(true);
              onResult?.(ok);
              if (ok) setCorrect((c) => c + 1);
              else setIncorrect((c) => c + 1);
            }
          }}
          placeholder="Type the sentence…"
          className="mt-4"
        />
        {revealed && (
          <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium text-foreground">{current.sentence}</p>
            <p className="mt-1 text-muted-foreground">
              {answerMatches(answer, current.sentence)
                ? "✓ Matches — nice listening!"
                : "Compare your typing above with the original."}
            </p>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => {
              const ok = answerMatches(answer, current.sentence);
              setRevealed(true);
              onResult?.(ok);
              if (ok) setCorrect((c) => c + 1);
              else setIncorrect((c) => c + 1);
            }}
          >
            Reveal
          </Button>
          <Button
            className="cursor-pointer"
            onClick={() => {
              setIdx((i) => i + 1);
              setDone((d) => d + 1);
            }}
          >
            Next
          </Button>
        </div>
      </div>
      <Button
        variant="ghost"
        className="w-fit cursor-pointer gap-2 text-muted-foreground"
        onClick={reset}
      >
        <RotateCcw className="size-4" /> Restart
      </Button>
    </div>
  );
}
