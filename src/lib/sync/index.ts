"use client";
import { api } from "@/lib/api/client";

export type MutationMethod = "POST" | "PATCH" | "DELETE";

export interface MutationOp {
  method: MutationMethod;
  path: string;
  body?: unknown;
  /** Human label for the outbox UI, e.g. "Add Greek yogurt". */
  label?: string;
}

/**
 * Sends a write to the API. All writes go through here so the offline outbox
 * (phase 7) can queue them transparently.
 */
export async function send<T>(op: MutationOp): Promise<T> {
  switch (op.method) {
    case "POST":
      return api.post<T>(op.path, op.body ?? {});
    case "PATCH":
      return api.patch<T>(op.path, op.body ?? {});
    case "DELETE":
      return api.del<T>(op.path);
  }
}
