"use client";
import { useEffect, useRef, useState } from "react";
import { Flashlight, FlashlightOff } from "lucide-react";
import { isValidGtin } from "@/lib/foods/barcode";
import { haptic } from "@/lib/utils";

type Controls = { stop: () => void; switchTorch?: (on: boolean) => Promise<void> };

/**
 * Camera barcode scanner using @zxing/browser (BarcodeDetector isn't available
 * in iOS Safari). This module is lazy-loaded so zxing never ships with the
 * main bundle.
 */
export default function Scanner({ onDetected, paused }: { onDetected: (code: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const lastRef = useRef<{ code: string; n: number }>({ code: "", n: 0 });
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null);
  const cbRef = useRef(onDetected);
  useEffect(() => {
    cbRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 400 });
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result) => {
            if (!result) return;
            const code = result.getText();
            if (!/^\d+$/.test(code)) return;
            // Require two identical consecutive reads (or a valid check digit) to avoid misreads.
            const last = lastRef.current;
            last.n = last.code === code ? last.n + 1 : 1;
            last.code = code;
            if (last.n >= 2 || (isValidGtin(code) && last.n >= 1)) {
              haptic(20);
              controlsRef.current?.stop();
              cbRef.current(code);
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setTorch(controls.switchTorch ? false : null);
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access was denied. Allow camera access for this app in Settings → Safari → Camera (or the app's settings), then try again."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "The camera couldn't start. You can type the barcode instead.",
        );
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [paused]);

  if (error) return <p role="alert" className="rounded-2xl bg-card p-4 text-sm ring-1 ring-border">{error}</p>;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-black">
      <video ref={videoRef} className="aspect-[3/4] w-full object-cover" muted playsInline autoPlay aria-label="Camera preview" />
      <div aria-hidden className="pointer-events-none absolute inset-x-10 top-1/2 h-32 -translate-y-1/2 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
      <p className="absolute inset-x-0 bottom-3 text-center text-sm font-medium text-white">Line up the barcode inside the frame</p>
      {torch != null ? (
        <button
          type="button"
          aria-label={torch ? "Turn off flashlight" : "Turn on flashlight"}
          aria-pressed={torch}
          onClick={async () => {
            await controlsRef.current?.switchTorch?.(!torch);
            setTorch(!torch);
          }}
          className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-black/50 text-white"
        >
          {torch ? <FlashlightOff className="size-5" aria-hidden /> : <Flashlight className="size-5" aria-hidden />}
        </button>
      ) : null}
    </div>
  );
}
