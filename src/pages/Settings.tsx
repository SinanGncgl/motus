import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { settings } from "@/lib/settings";
import { COMMON_WORD_COUNT } from "@/lib/stopwords";
import { LANGUAGES } from "@/lib/tts";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const [includeCommon, setIncludeCommon] = useState(
    settings.get().includeCommonWords,
  );
  const [dailyGoal, setDailyGoal] = useState(settings.get().dailyGoal);
  const [autoPause, setAutoPause] = useState(settings.get().autoPausePerLine);
  const [autoTranslate, setAutoTranslate] = useState(
    settings.get().autoTranslateCaptions,
  );
  const [nativeLang, setNativeLang] = useState(settings.get().nativeLanguage);
  const [apiKey, setApiKey] = useState(settings.get().translationApiKey);
  const [endpoint, setEndpoint] = useState(settings.get().translationEndpoint);

  const save = () => {
    settings.update({
      includeCommonWords: includeCommon,
      dailyGoal: Math.max(1, Math.min(200, Math.round(dailyGoal) || 20)),
      autoPausePerLine: autoPause,
      autoTranslateCaptions: autoTranslate,
      nativeLanguage: nativeLang,
      translationApiKey: apiKey.trim(),
      translationEndpoint: endpoint.trim(),
    });
    toast.success("Settings saved");
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tuned for your study style. Everything stays on this device.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-fit cursor-pointer gap-2"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <SettingsIcon className="size-4 text-primary" /> Vocabulary
        </h2>
        <label className="flex items-start justify-between gap-4 rounded-xl border bg-card/60 p-3">
          <span>
            <span className="text-sm font-medium">Include common words</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Off by default — the {COMMON_WORD_COUNT} most frequent English
              words (the, and, is…) are skipped so your deck stays high-value.
              Turn on to save everything.
            </span>
          </span>
          <input
            type="checkbox"
            checked={includeCommon}
            onChange={(e) => setIncludeCommon(e.target.checked)}
            className="mt-1 size-4 accent-primary"
          />
        </label>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Study goals</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="goal">Daily review goal (cards/day)</Label>
          <Input
            id="goal"
            type="number"
            min={1}
            max={200}
            value={dailyGoal}
            onChange={(e) => setDailyGoal(Number(e.target.value))}
            className="w-32"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Watch &amp; listen</h2>
        <label className="flex items-start justify-between gap-4 rounded-xl border bg-card/60 p-3">
          <span>
            <span className="text-sm font-medium">
              Auto-pause after each line
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Pauses playback at the end of every caption so you can shadow or
              repeat the sentence. Great for speaking practice.
            </span>
          </span>
          <input
            type="checkbox"
            checked={autoPause}
            onChange={(e) => setAutoPause(e.target.checked)}
            className="mt-1 size-4 accent-primary"
          />
        </label>
        <label className="flex items-start justify-between gap-4 rounded-xl border bg-card/60 p-3">
          <span>
            <span className="text-sm font-medium">
              Auto-translate captions
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Show a translation under each caption as it plays. Needs a
              translation endpoint (below) to work.
            </span>
          </span>
          <input
            type="checkbox"
            checked={autoTranslate}
            onChange={(e) => setAutoTranslate(e.target.checked)}
            className="mt-1 size-4 accent-primary"
          />
        </label>
        <div className="flex flex-col gap-2 rounded-xl border bg-card/60 p-3">
          <Label htmlFor="nativelang">Translate into</Label>
          <Select value={nativeLang} onValueChange={setNativeLang}>
            <SelectTrigger id="nativelang" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code.split("-")[0]}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The language captions are translated into. Words in the Vocabulary
            page use the same target.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Online enhancements</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tkey">
            Translation / dictionary API key (optional)
          </Label>
          <Input
            id="tkey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Leave empty to stay fully offline"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Used only when you ask to translate a sentence or look up a rare
            word. Without it, the app works fully offline with the built-in
            starter dictionary.
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
          <Label htmlFor="tendpoint">Translation endpoint (optional)</Label>
          <Input
            id="tendpoint"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://your-libretranslate.example/translate"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Any LibreTranslate-compatible server. Leave both fields empty to
            stay fully offline. In the Watch page, click the languages icon on
            a caption to translate the line.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={save} className="cursor-pointer gap-2">
          Save settings
        </Button>
      </div>
    </div>
  );
}
