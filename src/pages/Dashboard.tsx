import { NewSubtitleDialog } from "@/components/app/NewSubtitleDialog";
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
import { languageLabel } from "@/lib/tts";
import { localApi } from "@/lib/local-api";
import {
  BarChart3,
  CalendarDays,
  Captions,
  Clapperboard,
  Flame,
  GraduationCap,
  Library,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const BOX_LABELS = ["New", "Learning", "Young", "Mature", "Mastered"];
const BOX_COLORS = [
  "bg-slate-400",
  "bg-amber-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-primary",
];

function daysUntil(ts: number | null): number | null {
  if (ts === null) return null;
  const now = Date.now();
  return Math.ceil((ts - now) / 86_400_000);
}

export default function Dashboard() {
  const { user } = useAuth();
  const [words, refreshWords] = useLocalWords();
  const [dueCount] = useDueCount();
  const [subtitles, refreshSubtitles] = useLocalSubtitles();
  const navigate = useNavigate();
  const [newSubOpen, setNewSubOpen] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);

  const goal = settings.get().dailyGoal;
  const reviewedToday = streak.reviewedToday();
  const currentStreak = streak.current();
  const bestStreak = streak.best();
  const last14 = useMemo(() => streak.lastDays(14), [words, reviewedToday]);
  const lastSession = useMemo(() => session.last(), [words, reviewedToday]);

  const mastered = (words ?? []).filter((w) => w.cardBox >= 3).length;
  const goalPct = Math.min(100, Math.round((reviewedToday / goal) * 100));

  const collections = useMemo(() => {
    const set = new Set<string>();
    for (const s of subtitles ?? []) {
      if (s.collection) set.add(s.collection);
    }
    return [...set].sort();
  }, [subtitles]);

  const filteredSubs = useMemo(() => {
    const list = subtitles ?? [];
    if (!collectionFilter) return list;
    return list.filter((s) => s.collection === collectionFilter);
  }, [subtitles, collectionFilter]);

  const recent = (words ?? []).slice(0, 5);

  const srsStats = useMemo(() => {
    const list = words ?? [];
    const total = list.length;
    const byBox = [0, 0, 0, 0, 0];
    const dueByDay: number[] = new Array(14).fill(0);
    for (const w of list) {
      const box = Math.max(0, Math.min(4, w.cardBox));
      byBox[box]++;
      const d = daysUntil(w.cardDueAt);
      if (d !== null && d >= 0 && d < 14) dueByDay[d]++;
    }
    return { total, byBox, dueByDay };
  }, [words]);

  const handleDeleteSub = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    await localApi.subtitles.remove(id);
    await refreshSubtitles();
    toast.success("Subtitle deleted");
  };

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
        <Button type="button" className="cursor-pointer gap-2" onClick={() => setNewSubOpen(true)}>
          <Plus className="size-4" /> New subtitle
        </Button>
        <Button type="button" variant="outline" className="cursor-pointer gap-2" onClick={() => navigate("/practice")}>
          <GraduationCap className="size-4" /> Start reviewing
        </Button>
        <Button type="button" variant="outline" className="cursor-pointer gap-2" onClick={() => navigate("/words")}>
          <Library className="size-4" /> My words
        </Button>
      </div>

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

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Library className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{words?.length ?? 0}</p>
          <p className="text-sm text-muted-foreground">Words saved</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <GraduationCap className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{dueCount ?? 0}</p>
          <p className="text-sm text-muted-foreground">Cards due</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{mastered}</p>
          <p className="text-sm text-muted-foreground">Mastered</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Captions className="size-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold">{subtitles?.length ?? 0}</p>
          <p className="text-sm text-muted-foreground">Subtitles</p>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Your subtitles</h2>
          <Button type="button" size="sm" className="cursor-pointer gap-1.5" onClick={() => setNewSubOpen(true)}>
            <Plus className="size-3.5" /> New
          </Button>
        </div>
        {collections.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCollectionFilter(null)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                !collectionFilter
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              All
            </button>
            {collections.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCollectionFilter(c)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  collectionFilter === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {filteredSubs.length === 0 ? (
          <Empty className="rounded-2xl border bg-card/40">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Captions className="size-6" />
              </EmptyMedia>
              <EmptyTitle>No subtitles yet</EmptyTitle>
              <EmptyDescription>
                Add a YouTube link, upload a video, or paste an SRT to get started.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" className="cursor-pointer gap-2" onClick={() => setNewSubOpen(true)}>
                <Plus className="size-4" /> Add subtitles
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSubs.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => navigate(`/watch/${s._id}`)}
                className="group flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {s.videoId ? (
                  <img src={`https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg`} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                ) : s.fileId ? (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted/60"><Video className="size-6 text-muted-foreground" /></span>
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted/60"><Clapperboard className="size-6 text-muted-foreground" /></span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {s.lines.length} lines · {languageLabel(s.language)}
                    {s.collection && <><span className="text-border">·</span>{s.collection}</>}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${s.title}`}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteSub(s._id, s.title);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>

      {srsStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-primary" /> Card maturity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {srsStats.byBox.map((count, i) => (
                <div
                  key={i}
                  className={`${BOX_COLORS[i]} h-full`}
                  style={{ width: `${srsStats.total ? (count / srsStats.total) * 100 : 0}%` }}
                  title={`${BOX_LABELS[i]}: ${count}`}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {BOX_LABELS.map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-1 rounded-lg border bg-muted/40 p-3">
                  <span className={`size-2.5 rounded-full ${BOX_COLORS[i]}`} />
                  <span className="text-lg font-semibold">{srsStats.byBox[i]}</span>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {srsStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" /> Reviews due (next 14 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5" style={{ height: 120 }}>
              {srsStats.dueByDay.map((n, i) => {
                const max = Math.max(1, ...srsStats.dueByDay);
                const h = Math.max(6, Math.round((n / max) * 110));
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{n || ""}</span>
                    <div
                      className="w-full rounded-t-md bg-primary/70"
                      style={{ height: h }}
                      title={`Day +${i}: ${n} due`}
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {i === 0 ? "now" : `+${i}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Library className="size-4 text-primary" /> Recent words
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {recent.map((w) => (
                <li key={w._id} className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="font-normal">{w.display}</Badge>
                  <span className="truncate text-muted-foreground">{w.definition || "—"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {dueCount === 0 && (words?.length ?? 0) > 0 && (
        <Empty className="rounded-2xl border bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sparkles className="size-6" />
            </EmptyMedia>
            <EmptyTitle>All caught up</EmptyTitle>
            <EmptyDescription>
              No cards are due right now. Add a subtitle to save more words.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => setNewSubOpen(true)} className="cursor-pointer gap-2">
              <Plus className="size-4" /> Add subtitles
            </Button>
          </EmptyContent>
        </Empty>
      )}

      <NewSubtitleDialog
        open={newSubOpen}
        onOpenChange={setNewSubOpen}
        onCreated={() => { void refreshSubtitles(); void refreshWords(); }}
      />
    </div>
  );
}
