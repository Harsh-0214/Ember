"use client";
import * as React from "react";
import { Drawer as Vaul } from "vaul";
import { cn } from "@/lib/utils";

/** Bottom sheet (thumb-friendly). */
export function Sheet({ open, onOpenChange, children, title, description, className }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  children: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <Vaul.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Vaul.Portal>
        <Vaul.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Vaul.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-lg flex-col rounded-t-3xl bg-background pb-safe outline-none",
            className,
          )}
          aria-describedby={description ? undefined : undefined}
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <div className="px-5 pt-3 pb-2">
            <Vaul.Title className="text-lg font-semibold">{title}</Vaul.Title>
            {description ? <Vaul.Description className="text-sm text-muted-foreground">{description}</Vaul.Description> : <Vaul.Description className="sr-only">{title}</Vaul.Description>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
}
