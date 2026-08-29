import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useLocalWords, useDueCount, useLocalSubtitles } from "@/hooks/use-local-data";
import { settings } from "@/lib/settings";
import { session, streak } from "@/lib/streak";
import {
  ArrowRight,
  Bookmark,
  BarChart3,
  Clapperboard,
  Captions,
  Flame,
  GraduationCap,
  Library,
  Sparkles,
  Target,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { user } = useAuth();
  const [words] = useLocalWords();
  const [dueCount] = useDueCount();
  const navigate = useNavigate();

  const goal = settings.get().dailyGoal;
  const reviewedToday = streak.reviewedToday();
  const currentStreak = streak.current();
  const bestStreak = streak.best();
  const last14 = useMemo(() => streak.lastDays(14), [words, reviewedToday]);
  const lastSession = useMemo(() => session.last(), [words, reviewedToday]);

  const mastered = (words ?? []).filter((w) => w.cardBox >= 3).length;
  const goalPct = Math.min(100, Math.round((reviewedToday / goal) * 100));

  const stats = [
    {
      label: "Words saved",
      value: words?.length ?? 0,
      icon: Bookmark,
      to: "/words",
      accent: "bg-primary/10 text-primary",
    },
    {
      label: "Cards due now",
      value: dueCount ?? 0,
      icon: GraduationCap,
      to: "/practice",
      accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Mastered",
      value: mastered,
      icon: Sparkles,
      to: "/words",
      accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
  ];

  const recent = (words ?? []).slice(0, 5);
  const [subs] = useLocalSubtitles();
  const recentSubs = (subs ?? []).slice(0, 6);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Your vocabulary studio
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Learn from subtitles, save words, and practice automatically generated
          cards — entirely on this computer.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Button type="button" className="cursor-pointer gap-2" onClick={() => navigate("/subtitles")}>
          <Captions className="size-4" /> New subtitle
        </Button>
        <Button type="button" variant="outline" className="cursor-pointer gap-2" onClick={() => navigate("/practice")}>
          <GraduationCap className="size-4" /> Start reviewing
        </Button>
        <Button type="button" variant="outline" className="cursor-pointer gap-2" onClick={() => navigate("/words")}>
          <Library className="size-4" /> My words
        </Button>
        <Button type="button" variant="ghost" className="cursor-pointer gap-2" onClick={() => navigate("/stats")}>
          <BarChart3 className="size-4" /> Stats
        </Button>
      </div>

      {/* Daily goal + streak */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-5 text-primary" /> Daily goal
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {reviewedToday} / {goal} reviewed
            </span>
          </CardHeader>
          <CardContent>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {goalPct >= 100
                ? "Goal reached — nice work today!"
                : `${goal - reviewedToday} more cards to hit your daily goal.`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="size-5 text-orange-500" /> Streak
            </CardTitle>
            {lastSession && lastSession.reviewed > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                Last session {lastSession.accuracy}%
              </span>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{currentStreak}</p>
            <p className="text-sm text-muted-foreground">
              day streak · best {bestStreak}
            </p>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {last14.map((n, i) => {
                const max = Math.max(1, ...last14);
                const intensity = n === 0 ? 0 : 0.25 + (n / max) * 0.75;
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className="h-7 w-full rounded-md"
                      style={{
                        backgroundColor:
                          n === 0
                            ? "var(--muted)"
                            : `color-mix(in oklch, var(--primary) ${Math.round(intensity * 100)}%, transparent)`,
                      }}
                      title={`${n} reviewed`}
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {i === 0 ? "now" : i === 7 ? "1w" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {recentSubs.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Continue watching</h2>
            <Button type="button" variant="ghost" size="sm" className="cursor-pointer gap-1.5" onClick={() => navigate("/subtitles")}>
              All subtitles
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentSubs.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => navigate(`/watch/${s._id}`)}
                className="group flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {s.videoId ? (
                  <img src={`https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg`} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted/60"><Clapperboard className="size-6 text-muted-foreground" /></span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{s.lines.length} lines{s.collection ? ` · ${s.collection}` : ""}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => navigate(stat.to)}
            className="group rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex size-10 items-center justify-center rounded-lg ${stat.accent}`}
              >
                <stat.icon className="size-5" />
              </span>
              <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </div>
            <p className="mt-4 text-3xl font-semibold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <Captions className="size-5 text-primary" />
            <CardTitle className="text-base">Learn new words</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm leading-6 text-muted-foreground">
              Load subtitles from YouTube, paste an SRT, or upload a video — it's
              transcribed on your device and becomes a studyable transcript.
            </p>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer gap-2"
              onClick={() => navigate("/subtitles")}
            >
              <Captions className="size-4" /> Open subtitles
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <GraduationCap className="size-5 text-primary" />
            <CardTitle className="text-base">Practice</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm leading-6 text-muted-foreground">
              Review due cards with flashcards, fill-in-the-blank, and
              listen-and-type dictation. Your streak grows every day you review.
            </p>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer gap-2"
              onClick={() => navigate("/practice")}
            >
              <GraduationCap className="size-4" /> Start reviewing
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Library className="size-5 text-primary" />
            <CardTitle className="text-base">Your words</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                No words yet. Tap any word in a transcript to save it.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((w) => (
                  <li
                    key={w._id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Badge variant="secondary" className="font-normal">
                      {w.display}
                    </Badge>
                    <span className="truncate text-muted-foreground">
                      {w.definition || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {dueCount === 0 && (words?.length ?? 0) > 0 && (
        <Empty className="rounded-2xl border bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sparkles className="size-6" />
            </EmptyMedia>
            <EmptyTitle>All caught up</EmptyTitle>
            <EmptyDescription>
              No cards are due right now. Come back later, or open a subtitle to
              save more words.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              onClick={() => navigate("/subtitles")}
              className="cursor-pointer gap-2"
            >
              <Captions className="size-4" /> Learn new words
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}
