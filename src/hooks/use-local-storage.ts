"use client";
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Tiny localStorage-backed string state shared across components. */
export function useLocalStorage(key: string): [string | null, (v: string | null) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => read(key),
    () => null,
  );
  const set = useCallback(
    (v: string | null) => {
      try {
        if (v === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, v);
      } catch {
        /* storage full / private mode */
      }
      emit();
    },
    [key],
  );
  return [value, set];
}
