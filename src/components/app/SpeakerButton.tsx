import { Button } from "@/components/ui/button";
import { isSpeechAvailable, speak } from "@/lib/tts";
import { Volume2 } from "lucide-react";

interface SpeakerButtonProps {
  text: string;
  lang?: string | null;
  label?: string;
  className?: string;
  size?: "icon" | "icon-sm" | "icon-lg";
}

/** Pronounce `text` with the browser's TTS. Disabled when speech is unavailable. */
export function SpeakerButton({
  text,
  lang,
  label = "Pronounce",
  className,
  size = "icon-sm",
}: SpeakerButtonProps) {
  const available = isSpeechAvailable();
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      aria-label={label}
      disabled={!available || !text.trim()}
      onClick={(e) => {
        e.stopPropagation();
        speak(text, lang ?? "en-US");
      }}
      className={className}
    >
      <Volume2 className="size-4" />
    </Button>
  );
}
