import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BlenderIconProps {
  name: string;
  className?: string;
  children: ReactNode;
}

/** Unreal-rendered icon with the existing loading/error fallback. */
export function BlenderIcon({ name, className, children }: BlenderIconProps) {
  const [readyName, setReadyName] = useState<string | null>(null);
  const [failedName, setFailedName] = useState<string | null>(null);
  const ready = readyName === name;
  const failed = failedName === name;
  return (
    <span className={cn("relative inline-flex items-center justify-center shrink-0", className)} aria-hidden="true">
      <span className="inline-flex items-center justify-center" style={{ visibility: ready && !failed ? "hidden" : "visible" }}>{children}</span>
      {!failed && <img
        src={`/images/unreal-icons/${name}.png`}
        alt=""
        draggable={false}
        width={192}
        height={192}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{ opacity: ready ? 1 : 0 }}
        onLoad={() => setReadyName(name)}
        onError={() => setFailedName(name)}
      />}
    </span>
  );
}
