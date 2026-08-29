import { useCallback, useEffect, useState } from "react";
import { localApi, type LocalCard, type LocalSubtitle, type LocalWord } from "@/lib/local-api";
function useResource<T>(load: () => Promise<T>) { const [data,setData]=useState<T|undefined>(); const refresh=useCallback(async()=>setData(await load()),[load]); useEffect(()=>{void refresh();},[refresh]); return [data,refresh] as const; }
export function useLocalSubtitles(){return useResource<LocalSubtitle[]>(localApi.subtitles.list);}
export function useLocalWords(){return useResource<LocalWord[]>(localApi.words.list);}
export function useDueCards(){return useResource<LocalCard[]>(localApi.cards.due);}
export function useDueCount(){return useResource<number>(localApi.cards.dueCount);}
