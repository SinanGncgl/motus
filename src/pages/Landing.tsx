import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookmarkCheck,
  Captions,
  GraduationCap,
  MousePointerClick,
  Quote,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link } from "react-router";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

const STEPS = [
  {
    number: "01",
    icon: Captions,
    title: "Load subtitles",
    body: "Paste an SRT file, a plain script, a YouTube link — or upload any video/audio file and it's transcribed automatically. It becomes a clean, readable transcript to watch along with.",
  },
  {
    number: "02",
    icon: MousePointerClick,
    title: "Tap words to save",
    body: "Click any word you don't know. A definition is fetched automatically and the sentence it came from is saved with it.",
  },
  {
    number: "03",
    icon: GraduationCap,
    title: "Review your cards",
    body: "Every saved word becomes an Anki card instantly. Practice with spaced repetition — cards reschedule themselves.",
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Transcribe & watch",
    body: "Paste a YouTube link to auto-fetch captions, or upload any video/audio file — open-source Whisper transcribes it in your browser, then the transcript syncs line by line.",
  },
  {
    icon: Sparkles,
    title: "Definitions in one click",
    body: "Auto-fetched definitions and dictionary example sentences fill the card for you. Anything can be edited by hand.",
  },
  {
    icon: BookmarkCheck,
    title: "Hear every word",
    body: "Native-sounding pronunciation for words and whole lines, powered by your browser — no extra setup, no audio files.",
  },
  {
    icon: ArrowRight,
    title: "Export to Anki",
    body: "Your whole deck downloads as an Anki-importable file — keep learning in the desktop app you already use.",
  },
];

const MOCK_LINES = [
  { text: "The old lighthouse stood on the rocky headland," },
  { text: "its beam cutting through the fog.", highlighted: ["beam"] },
  { text: "Every evening, she watched the tide roll in", highlighted: ["tide"] },
  { text: "and whispered words to the sea.", highlighted: ["whispered"] },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Quote className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Motus
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" className="cursor-pointer" asChild>
              <Link to="/dashboard">Open workspace</Link>
            </Button>
            <Button type="button" className="cursor-pointer gap-1.5" asChild>
              <Link to="/subtitles">
                Start learning
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(20,140,130,0.10),transparent_60%)]"
        />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pt-24">
          <motion.div {...fadeUp}>
            <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
              <Sparkles className="size-3.5 text-primary" />
              Learn from the subtitles you love
            </Badge>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Learn a language,
              <br />
              one subtitle line
              <br />
              at a time.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Turn the shows and films you watch into a personal vocabulary
              deck. Paste a YouTube link or upload any video — captions are
              generated automatically. Tap a word — get its definition, hear
              it spoken, and get an Anki card generated on the spot.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button type="button" size="lg" className="cursor-pointer gap-2" asChild>
                <Link to="/subtitles">
                  Start learning free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button type="button" size="lg" variant="outline" className="cursor-pointer" asChild>
                <Link to="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {[
                ["1 tap", "to save a word"],
                ["auto", "Anki card per word"],
                ["∞", "languages & shows"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-xl font-semibold tracking-tight">{value}</dt>
                  <dd className="mt-0.5 text-xs text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          {/* Product mock */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="relative mx-auto w-full max-w-lg"
          >
            <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-primary/5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold tracking-tight">
                  The Lighthouse — S01E02
                </p>
                <Badge variant="secondary" className="gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" />
                  12 saved here
                </Badge>
              </div>
              <div className="flex flex-col gap-3.5">
                {MOCK_LINES.map((line, i) => (
                  <p key={i} className="text-[15px] leading-7 text-foreground/85">
                    {line.text.split(" ").map((word, j) => {
                      const clean = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
                      const isHit = line.highlighted?.includes(clean) ?? false;
                      return (
                        <span
                          key={j}
                          className={
                            isHit
                              ? "mx-[1px] cursor-pointer rounded-md bg-primary/10 px-1 py-0.5 font-medium text-primary"
                              : "mx-[1px] cursor-pointer rounded-md px-1 py-0.5 transition-colors hover:bg-accent"
                          }
                        >
                          {word}
                        </span>
                      );
                    })}
                  </p>
                ))}
              </div>
            </div>

            {/* Floating saved chip */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="absolute -right-3 -top-5 flex items-center gap-2 rounded-xl border bg-background p-3 shadow-lg sm:-right-6"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookmarkCheck className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-none">beam</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Saved · Anki card generated
                </p>
              </div>
            </motion.div>

            {/* Floating card preview */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="absolute -bottom-6 -left-3 w-48 rounded-xl border bg-background p-4 shadow-lg sm:-left-6"
            >
              <p className="text-xs text-muted-foreground">Next review</p>
              <p className="mt-1.5 text-lg font-semibold tracking-tight">whispered</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                (verb) to speak very softly
              </p>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 rounded-full bg-primary" />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              From subtitle to flashcard in three taps
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              No decks to build, no cards to write. The pipeline does the work
              so you can focus on watching.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                {...fadeUp}
                transition={{ duration: 0.55, delay: i * 0.1, ease: "easeOut" }}
                className="relative rounded-2xl border bg-card p-7 shadow-sm"
              >
                <span className="absolute right-6 top-6 text-4xl font-semibold text-foreground/5">
                  {step.number}
                </span>
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">Why Motus</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for learners, not for card curation
          </h2>
        </motion.div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              {...fadeUp}
              transition={{ duration: 0.55, delay: i * 0.08, ease: "easeOut" }}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-7 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon className="size-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {feature.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <motion.div
          {...fadeUp}
          className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-12"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.14),transparent_55%)]"
          />
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Your next favorite word is one click away
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-primary-foreground/80 sm:text-base">
            Load your first subtitle and start building a deck that's entirely
            yours — no account, cloud, or setup beyond Motus.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="cursor-pointer gap-2"
              asChild
            >
              <Link to="/subtitles">
                Get started — it's free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Quote className="size-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Motus
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Learn from what you watch · Free for individual learners
          </p>
        </div>
      </footer>
    </div>
  );
}
