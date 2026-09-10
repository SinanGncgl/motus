# Add React.memo to TranscriptLine — Design Spec

## Problem

TranscriptLine is rendered for every line in the transcript. When parent state changes (active line, translations, saved words), all lines rerender unnecessarily, causing performance overhead.

## Goal

Wrap TranscriptLine with React.memo to prevent unnecessary rerenders. Memoize the `savedWordsSet` prop in Watch.tsx to maintain referential equality.

## Changes

### 1. Modify TranscriptLine.tsx

- Import React
- Wrap component with `React.memo`
- Keep same props interface

### 2. Modify Watch.tsx

- Add `useMemo` for `savedWordsSet` derived from `savedByWord.keys()`
- Pass memoized `savedWordsSet` as prop to TranscriptLine

## Verification

- Run `bun run build` to ensure no TypeScript/build errors
- Verify no performance regressions

## Scope

- Only memoize `savedWordsSet` as specified
- Other props (hiddenWords, translations) handled separately in future tasks