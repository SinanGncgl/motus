import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocalWords, useDueCount, useLocalSubtitles } from "@/hooks/use-local-data";
import { streak } from "@/lib/streak";
import {
  BarChart3,
  CalendarDays,
  Flame,
  GraduationCap,
  Library,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";

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

export default function Stats() {
  const [words] = useLocalWords();
  const [dueCount] = useDueCount();
  const [subs] = useLocalSubtitles();

  const stats = useMemo(() => {
    const list = words ?? [];
    const total = list.length;
    const byBox = [0, 0, 0, 0, 0];
    let dueToday = 0;
    const dueByDay: number[] = new Array(14).fill(0);
    for (const w of list) {
      const box = Math.max(0, Math.min(4, w.cardBox));
      byBox[box]++;
      const d = daysUntil(w.cardDueAt);
      if (d !== null && d <= 0) dueToday++;
      else if (d !== null && d >= 0 && d < 14) dueByDay[d]++;
    }
    const mastered = byBox[4];
    const newWords = byBox[0];
    return { total, byBox, dueToday, dueByDay, mastered, newWords };
  }, [words]);

  const reviewedToday = streak.reviewedToday();
  const currentStreak = streak.current();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Your progress</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Statistics</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          A clear picture of your vocabulary growth and what's coming up in your
          review schedule.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Library className="size-4" />
            </span>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total words
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{stats.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.newWords} new · {stats.mastered} mastered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <GraduationCap className="size-4" />
            </span>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Due now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{dueCount ?? stats.dueToday}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              cards ready to review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
              <Flame className="size-4" />
            </span>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{currentStreak}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {reviewedToday} reviewed today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="size-4" />
            </span>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{subs?.length ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              subtitles saved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SRS distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-primary" /> Card maturity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {stats.byBox.map((count, i) => (
              <div
                key={i}
                className={`${BOX_COLORS[i]} h-full`}
                style={{ width: `${stats.total ? (count / stats.total) * 100 : 0}%` }}
                title={`${BOX_LABELS[i]}: ${count}`}
              />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {BOX_LABELS.map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-1 rounded-lg border bg-muted/40 p-3">
                <span className={`size-2.5 rounded-full ${BOX_COLORS[i]}`} />
                <span className="text-lg font-semibold">{stats.byBox[i]}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming reviews (due calendar) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" /> Reviews due (next 14 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.total === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              No words yet — save some from a subtitle and your review forecast
              will appear here.
            </p>
          ) : (
            <div className="flex items-end gap-1.5" style={{ height: 120 }}>
              {stats.dueByDay.map((n, i) => {
                const max = Math.max(1, ...stats.dueByDay);
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
