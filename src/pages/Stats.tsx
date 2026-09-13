import { useEffect, useState } from "react";
import { localApi } from "@/lib/local-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Brain, Target, TrendingUp, AlertTriangle } from "lucide-react";

const BOX_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];

export default function Stats() {
  const [overview, setOverview] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [hardWords, setHardWords] = useState<any[]>([]);
  const [maturity, setMaturity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      localApi.stats.overview(),
      localApi.stats.daily(),
      localApi.stats.hardWords(),
      localApi.stats.maturity(),
    ]).then(([o, d, h, m]) => {
      setOverview(o);
      setDaily(d.days ?? []);
      setHardWords(h.words ?? []);
      setMaturity(m.distribution ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading stats…</div>;
  }

  const dailyChartData = daily.map((d) => ({
    date: new Date(d.day_key * 86400000).toLocaleDateString("en", { month: "short", day: "numeric" }),
    correct: d.correct,
    incorrect: d.total - d.correct,
    accuracy: d.total ? Math.round((d.correct / d.total) * 100) : 0,
  }));

  const maturityData = [
    { name: "New", value: maturity.find((m) => m.box === 0)?.count ?? 0 },
    { name: "Learning", value: maturity.find((m) => m.box === 1)?.count ?? 0 },
    { name: "Young", value: maturity.find((m) => m.box === 2)?.count ?? 0 },
    { name: "Mature", value: maturity.find((m) => m.box === 3)?.count ?? 0 },
    { name: "Mastered", value: maturity.filter((m) => m.box >= 4).reduce((s, m) => s + m.count, 0) },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Review Statistics</h1>

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Brain} label="Total Words" value={overview?.totalWords ?? 0} />
        <StatCard icon={Target} label="Cards Due" value={overview?.cardsDue ?? 0} />
        <StatCard icon={TrendingUp} label="Weekly Accuracy" value={`${overview?.weeklyAccuracy ?? 0}%`} />
        <StatCard icon={AlertTriangle} label="Hard Words" value={hardWords.length} />
      </div>

      {/* Daily accuracy chart */}
      <Card>
        <CardHeader><CardTitle>Daily Accuracy (Last 30 Days)</CardTitle></CardHeader>
        <CardContent>
          {dailyChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet. Start practicing to see your progress!</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="correct" stackId="a" fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="incorrect" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Maturity distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Card Maturity</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={maturityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {maturityData.map((_, i) => <Cell key={i} fill={BOX_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hard words list */}
        <Card>
          <CardHeader><CardTitle>Most Difficult Words</CardTitle></CardHeader>
          <CardContent>
            {hardWords.length === 0 ? (
              <p className="text-sm text-muted-foreground">No difficult words yet. Keep practicing!</p>
            ) : (
              <div className="max-h-[200px] space-y-2 overflow-y-auto">
                {hardWords.map((w) => (
                  <div key={w.card_id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{w.display ?? w.word}</span>
                      <span className="ml-2 text-muted-foreground">×{w.again_count} again</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{w.review_count} reviews</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="size-5 text-muted-foreground" />
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
