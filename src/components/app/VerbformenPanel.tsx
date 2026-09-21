import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { localApi } from "@/lib/local-api";
import { Loader2, ExternalLink, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";

interface ConjugationData {
  word: string;
  type: string;
  level: string | null;
  auxiliary: string | null;
  irregular: boolean;
  baseForm: string;
  pronunciation: string[];
  conjugation: Record<string, Record<string, string> | null>;
  examples: string[];
  translations: Record<string, string>;
  definitions: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: string;
}

export function VerbformenPanel({ open, onOpenChange, word }: Props) {
  const [data, setData] = useState<ConjugationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !word) return;
    setLoading(true);
    setError(false);
    setData(null);
    localApi
      .verbformen(word)
      .then((res) => {
        if (res) setData(res);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [open, word]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="size-4" />
            {data?.word ?? word}
          </SheetTitle>
          <SheetDescription>
            {data
              ? `${data.type.charAt(0).toUpperCase() + data.type.slice(1)}${data.level ? ` · ${data.level}` : ""}${data.irregular ? " · irregular" : ""}`
              : "Loading from verbformen.de…"}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>Could not load data from verbformen.de.</p>
            <a
              href={`https://www.verbformen.de/konjugation/${encodeURIComponent(word)}.htm`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open on verbformen.de <ExternalLink className="size-3" />
            </a>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-5 pb-6">
            {/* Pronunciation */}
            {data.pronunciation && data.pronunciation.length > 0 && (
              <Section title="Aussprache">
                <p className="text-sm text-muted-foreground">
                  {data.pronunciation.join(" · ")}
                </p>
              </Section>
            )}

            {/* Conjugation tables */}
            {data.conjugation && Object.keys(data.conjugation).length > 0 && (
              <Section title="Konjugation">
                {Object.entries(data.conjugation).map(([tense, forms]) =>
                  forms ? (
                    <div key={tense} className="mb-3">
                      <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {tenseLabel(tense)}
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        {Object.entries(forms).map(([pronoun, form]) => (
                          <div key={pronoun} className="contents">
                            <span className="text-muted-foreground">{pronoun}</span>
                            <span className="font-medium">{form}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </Section>
            )}

            {/* Definitions */}
            {data.definitions.length > 0 && (
              <Section title="Bedeutungen">
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {data.definitions.map((def, i) => (
                    <li key={i} className="text-foreground/90">{def}</li>
                  ))}
                </ol>
              </Section>
            )}

            {/* Examples */}
            {data.examples.length > 0 && (
              <Section title="Beispiele">
                <ul className="space-y-2 text-sm">
                  {data.examples.map((ex, i) => (
                    <li key={i} className="rounded-md bg-muted/50 px-3 py-2 italic text-foreground/80">
                      &ldquo;{ex}&rdquo;
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Translations */}
            {Object.keys(data.translations).length > 0 && (
              <Section title="Übersetzungen">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.translations).map(([lang, text]) => (
                    <Badge key={lang} variant="secondary" className="text-xs">
                      {lang}: {text}
                    </Badge>
                  ))}
                </div>
              </Section>
            )}

            {/* Link to full page */}
            <a
              href={`https://www.verbformen.de/${data.type === "verb" ? "konjugation" : data.type === "noun" ? "deklination/substantive" : "deklination/adjektive"}/${encodeURIComponent(data.baseForm)}.htm`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3" />
              View full details on verbformen.de
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function tenseLabel(tense: string): string {
  const labels: Record<string, string> = {
    present: "Präsens",
    past: "Präteritum",
    perfect: "Perfekt",
    plusquamperfekt: "Plusquamperfekt",
    futur1: "Futur I",
    futur2: "Futur II",
    konjunktiv1: "Konjunktiv I",
    konjunktiv2: "Konjunktiv II",
    imperative: "Imperativ",
    partizipI: "Partizip I",
    partizipII: "Partizip II",
    infinitivI: "Infinitiv I",
    infinitivII: "Infinitiv II",
  };
  return labels[tense] ?? tense.charAt(0).toUpperCase() + tense.slice(1);
}
