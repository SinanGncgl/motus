// Common English function words that should NOT become vocabulary cards by
// default. Learners already know these; adding them floods the SRS deck with
// low-value cards. Toggle "include common words" in settings to override.
//
// This is intentionally conservative — only the highest-frequency, non-content
// words. Content words (nouns, verbs, adjectives) a learner wants to study are
// kept.

const RAW = `
a about above after again against all am an and any are aren't as at be because been before being below between both but by can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here hers herself him himself his how i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's will with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves
`;

const SET = new Set<string>(
  RAW.split(/\s+/).map((w) => w.trim().toLowerCase()).filter(Boolean),
);

export function isCommonWord(raw: string): boolean {
  const w = raw.trim().toLowerCase().replace(/[^a-z'-]/g, "");
  return SET.has(w);
}

export const COMMON_WORD_COUNT = SET.size;
