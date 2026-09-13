export interface LocalUser {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  isAnonymous?: boolean;
}

export interface LocalLine {
  index: number;
  start?: number;
  end?: number;
  text: string;
}

export interface LocalSubtitle {
  _id: string;
  id?: string;
  title: string;
  sourceType: "srt" | "plain";
  videoId?: string;
  fileId?: string;
  fileName?: string;
  fileUrl?: string;
  language?: string;
  lines: LocalLine[];
  updatedAt: number;
  lastPosition?: number;
  collection?: string;
}

export interface LocalWord {
  _id: string;
  id?: string;
  word: string;
  display: string;
  definition: string;
  example: string;
  sourceTitle?: string;
  language?: string;
  translation?: string;
  screenshotUrl?: string;
  cardBox: number;
  cardDueAt: number | null;
}

export interface CardRateResult {
  ok: boolean;
  leech: boolean;
  nextDue: number;
  intervalMs: number;
}

export interface LocalCard {
  id: string;
  _id?: string;
  front: string;
  back: string;
  box: number;
  dueAt: number;
  screenshotUrl?: string;
  leechCount?: number;
  cardType?: "word" | "sentence";
  savedWordId?: string;
  language?: string;
  easeFactor?: number;
}
