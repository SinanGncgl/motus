import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocalWords } from "@/hooks/use-local-data";
import { saveWord } from "@/lib/study";
import { localApi } from "@/lib/local-api";
import { speak } from "@/lib/tts";
import { settings } from "@/lib/settings";
import { translateLine } from "@/lib/translate";
import {
  Bookmark,
  Captions,
  CheckSquare,
  Download,
  Languages,
  Library,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { buildAnkiTsv, downloadFile } from "@/lib/subtitles";

interface SavedWord {
  _id: string;
  word: string;
  display: string;
  definition: string;
  example: string;
  sourceTitle?: string;
  cardBox: number;
  cardDueAt: number | null;
}

function statusFor(box: number) {
  if (box <= 0) return { label: "New", tone: "secondary" as const };
  if (box <= 2) return { label: "Learning", tone: "outline" as const };
  return { label: "Mastered", tone: "default" as const };
}

export default function Words() {
  const [words, refreshWords] = useLocalWords();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SavedWord | null>(null);
  const [editDisplay, setEditDisplay] = useState("");
  const [editDefinition, setEditDefinition] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "learning" | "mastered">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addDisplay, setAddDisplay] = useState("");
  const [addDefinition, setAddDefinition] = useState("");
  const [addExample, setAddExample] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const filtered = useMemo(() => {
    if (!words) return undefined;
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      if (statusFilter === "new" && w.cardBox > 0) return false;
      if (statusFilter === "learning" && (w.cardBox <= 0 || w.cardBox > 2)) return false;
      if (statusFilter === "mastered" && w.cardBox <= 2) return false;
      if (!q) return true;
      return [w.display, w.word, w.definition, w.example, w.sourceTitle ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [words, query, statusFilter]);

  const handleExport = () => {
    if (!words || words.length === 0) return;
    const rows = words.map((w) => ({
      front: w.display,
      back: [w.definition, w.example].filter(Boolean).join("\n\n"),
    }));
    const tsv = buildAnkiTsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`motus-anki-${stamp}.tsv`, tsv);
    toast.success(`Exported ${rows.length} cards — import the TSV in Anki`);
  };

  const handleExportCsv = () => {
    if (!words || words.length === 0) return;
    const header = ["word", "definition", "example", "source", "box"];
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = words.map((w) =>
      [w.display, w.definition, w.example, w.sourceTitle ?? "", String(w.cardBox)].map(esc).join(","),
    );
    const csv = [header.map(esc).join(","), ...lines].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`motus-vocabulary-${stamp}.csv`, csv, "text/csv");
    toast.success(`Exported ${words.length} words to CSV`);
  };

  const openEdit = (word: SavedWord) => {
    setEditing(word);
    setEditDisplay(word.display);
    setEditDefinition(word.definition);
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setIsSaving(true);
    try {
      await localApi.words.update(editing._id, { display: editDisplay, definition: editDefinition });
      await refreshWords();
      toast.success("Word updated");
      setEditing(null);
    } catch (error) {
      console.error(error);
      toast.error("Could not update the word.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (word: SavedWord) => {
    try {
      await localApi.words.remove(word._id);
      setSelected((prev) => { const n = new Set(prev); n.delete(word._id); return n; });
      await refreshWords();
      toast.success(`Removed “${word.display}”`);
    } catch (error) {
      console.error(error);
      toast.error("Could not remove the word.");
    }
  };

  const handleReset = async (word: SavedWord) => {
    try {
      await localApi.words.update(word._id, { resetCard: true });
      await refreshWords();
      toast.success(`Reset “${word.display}” to New`);
    } catch (error) {
      console.error(error);
      toast.error("Could not reset progress.");
    }
  };

  const handleAdd = async () => {
    if (!addDisplay.trim()) { toast.error("Word is required"); return; }
    setIsAdding(true);
    try {
      await saveWord({ word: addDisplay.trim().toLowerCase(), display: addDisplay.trim(), definition: addDefinition.trim(), example: addExample.trim() });
      await refreshWords();
      toast.success("Word added — Anki card generated");
      setAddOpen(false);
      setAddDisplay(""); setAddDefinition(""); setAddExample("");
    } catch (error) {
      console.error(error);
      toast.error("Could not add the word.");
    } finally {
      setIsAdding(false);
    }
  };

  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  const handleTranslate = async (word: SavedWord) => {
    if (!settings.get().translationEndpoint) {
      toast.info("Add a translation endpoint in Settings to translate words.");
      return;
    }
    setTranslatingId(word._id);
    try {
      const r = await translateLine(word.display, settings.get().translationEndpoint ? "en" : "en");
      if (r.ok && r.text) {
        setTranslations((prev) => ({ ...prev, [word._id]: r.text! }));
      } else {
        toast.error("Translation failed — check your endpoint in Settings.");
      }
    } catch {
      toast.error("Translation failed — check your endpoint in Settings.");
    } finally {
      setTranslatingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    try {
      await Promise.all([...selected].map((id) => localApi.words.remove(id)));
      await refreshWords();
      toast.success(`Deleted ${selected.size} word(s)`);
      setSelected(new Set());
    } catch (error) {
      console.error(error);
      toast.error("Could not delete selected words.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Words</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your saved vocabulary — every word has an Anki card.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search words…"
              className="w-52 pl-9 sm:w-64"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={!words || words.length === 0}
            className="cursor-pointer gap-2"
          >
            <Download className="size-4" />
            Export to Anki
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={!words || words.length === 0}
            className="cursor-pointer gap-2"
          >
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button
            type="button"
            onClick={() => setAddOpen(true)}
            className="cursor-pointer gap-2"
          >
            <Plus className="size-4" />
            Add word
          </Button>
        </div>
      </header>

      {words && words.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ["all", "All"],
            ["new", "New"],
            ["learning", "Learning"],
            ["mastered", "Mastered"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
          {selected.size > 0 && (
            <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              {selected.size} selected
              <Button type="button" variant="destructive" size="sm" className="cursor-pointer gap-1.5" onClick={handleBulkDelete}>
                <Trash2 className="size-3.5" /> Delete
              </Button>
              <Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </span>
          )}
        </div>
      )}

      {words === undefined ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : words.length === 0 ? (
        <Empty className="min-h-[420px] rounded-2xl border bg-card/40">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Library className="size-6" />
            </EmptyMedia>
            <EmptyTitle>No saved words yet</EmptyTitle>
            <EmptyDescription>
              Open a subtitle and tap the words you want to learn. Each one is
              saved here with an Anki card, ready to review.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              onClick={() => navigate("/subtitles")}
              className="cursor-pointer gap-2"
            >
              <Captions className="size-4" />
              Open subtitles
            </Button>
          </EmptyContent>
        </Empty>
      ) : filtered && filtered.length === 0 ? (
        <Empty className="min-h-[320px] rounded-2xl border bg-card/40">
          <EmptyHeader>
            <EmptyTitle>No matches for “{query}”</EmptyTitle>
            <EmptyDescription>Try a different search.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered?.map((word) => {
            const status = statusFor(word.cardBox);
            return (
              <div
                key={word._id}
                className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSelect(word._id)}
                    className="mt-1 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={selected.has(word._id) ? `Deselect ${word.display}` : `Select ${word.display}`}
                  >
                    {selected.has(word._id) ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                  </button>
                  <div className="flex flex-1 items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bookmark className="size-4" />
                    </span>
                    <div>
                      <p className="text-base font-semibold tracking-tight">
                        {word.display}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge variant={status.tone}>{status.label}</Badge>
                        {word.sourceTitle && (
                          <span className="truncate text-xs text-muted-foreground">
                            {word.sourceTitle}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Pronounce ${word.display}`}
                      className="size-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        speak(word.display, word.language);
                      }}
                    >
                      <Volume2 className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Translate ${word.display}`}
                      className="size-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleTranslate(word);
                      }}
                    >
                      {translatingId === word._id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Languages className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${word.display}`}
                      className="size-8 text-muted-foreground"
                      onClick={() => openEdit(word)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Reset progress for ${word.display}`}
                      className="size-8 text-muted-foreground hover:text-primary"
                      onClick={() => void handleReset(word)}
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${word.display}`}
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => void handleRemove(word)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm leading-6 text-foreground/90">
                    {word.definition || (
                      <span className="italic text-muted-foreground">
                        No definition yet — edit to add one.
                      </span>
                    )}
                  </p>
                  {word.example && (
                    <p className="text-sm leading-6 text-muted-foreground">
                      “{word.example}”
                    </p>
                  )}
                  {translations[word._id] && (
                    <p className="flex items-start gap-1.5 text-sm leading-6 text-muted-foreground">
                      <Languages className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{translations[word._id]}</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit word</DialogTitle>
            <DialogDescription>
              Changes stay in sync with the generated Anki card.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-display">Word</Label>
              <Input
                id="edit-display"
                value={editDisplay}
                onChange={(e) => setEditDisplay(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-definition">Definition</Label>
              <Textarea
                id="edit-definition"
                value={editDefinition}
                onChange={(e) => setEditDefinition(e.target.value)}
                className="min-h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(null)}
              disabled={isSaving}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpdate}
              disabled={isSaving}
              className="cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add word dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a word</DialogTitle>
            <DialogDescription>
              Creates a vocabulary entry and an Anki card immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-display">Word</Label>
              <Input
                id="add-display"
                value={addDisplay}
                onChange={(e) => setAddDisplay(e.target.value)}
                placeholder="e.g. serendipity"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-definition">Definition</Label>
              <Textarea
                id="add-definition"
                value={addDefinition}
                onChange={(e) => setAddDefinition(e.target.value)}
                className="min-h-20 resize-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-example">Example sentence</Label>
              <Textarea
                id="add-example"
                value={addExample}
                onChange={(e) => setAddExample(e.target.value)}
                className="min-h-16 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddOpen(false)}
              disabled={isAdding}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleAdd()}
              disabled={isAdding || !addDisplay.trim()}
              className="cursor-pointer gap-2"
            >
              {isAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add word
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
