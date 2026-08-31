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
  const [newCardsPerDay, setNewCardsPerDay] = useState(settings.get().newCardsPerDay);
  const [autoPause, setAutoPause] = useState(settings.get().autoPausePerLine);
  const [autoTranslate, setAutoTranslate] = useState(
    settings.get().autoTranslateCaptions,
  );
  const [sourceLang, setSourceLang] = useState(settings.get().sourceLanguage);
  const [nativeLang, setNativeLang] = useState(settings.get().nativeLanguage);
  const [apiKey, setApiKey] = useState(settings.get().translationApiKey);
  const [endpoint, setEndpoint] = useState(settings.get().translationEndpoint);
  const [translationSvc, setTranslationSvc] = useState(settings.get().translationService);

  const save = () => {
    settings.update({
      includeCommonWords: includeCommon,
      dailyGoal: Math.max(1, Math.min(200, Math.round(dailyGoal) || 20)),
      newCardsPerDay: Math.max(0, Math.min(50, Math.round(newCardsPerDay) || 10)),
      autoPausePerLine: autoPause,
      autoTranslateCaptions: autoTranslate,
      sourceLanguage: sourceLang,
      nativeLanguage: nativeLang,
      translationApiKey: apiKey.trim(),
      translationEndpoint: endpoint.trim(),
      translationService: translationSvc,
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="newCards">New cards per day</Label>
          <Input
            id="newCards"
            type="number"
            min={0}
            max={50}
            value={newCardsPerDay}
            onChange={(e) => setNewCardsPerDay(Number(e.target.value))}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            How many new words to introduce each day (0-50).
          </p>
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
          <Label htmlFor="sourcelang">Translate from</Label>
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger id="sourcelang" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code.split("-")[0]}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The language of the original captions. Set this to avoid
            mis-detection (e.g. German auto-detected as Indonesian).
          </p>
        </div>
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
        <h2 className="text-base font-semibold">Translation</h2>
        <div className="flex flex-col gap-2 rounded-xl border bg-card/60 p-3">
          <Label>Translation service</Label>
          <Select value={translationSvc} onValueChange={(v) => setTranslationSvc(v as "libretranslate" | "deepl")}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="libretranslate">LibreTranslate (local, free)</SelectItem>
              <SelectItem value="deepl">DeepL (higher quality)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            DeepL produces much better translations. Get a free API key at{" "}
            <a href="https://www.deepl.com/pro-api" target="_blank" rel="noreferrer" className="underline">deepl.com</a>{" "}
            (500k chars/month free). The API key field below is used for DeepL when selected.
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
            For DeepL: paste your free API key here. For LibreTranslate: leave empty (uses local instance). Get a DeepL key at{" "}
            <a href="https://www.deepl.com/pro-api" target="_blank" rel="noreferrer" className="underline">deepl.com</a>.
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
            Any LibreTranslate-compatible server (self-hosted or a managed one
            like libretranslate.com). Leave both fields empty to stay fully
            offline — translation then only works if the local server has{" "}
            <code className="rounded bg-muted px-1">LIBRETRANSLATE_URL</code> set.
            In the Watch page, hover a line and click the languages icon to
            translate that sentence, or use the 🇩🇪→🇬🇧 button.
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
