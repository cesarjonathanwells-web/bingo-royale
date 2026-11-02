import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BlenderIconProps {
  name: string;
  className?: string;
  children: ReactNode;
}

/** Enhances the existing icon while retaining it as a loading/error fallback. */
export function BlenderIcon({ name, className, children }: BlenderIconProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span className={cn("relative inline-flex items-center justify-center shrink-0", className)} aria-hidden="true">
      <span className="inline-flex items-center justify-center" style={{ visibility: ready && !failed ? "hidden" : "visible" }}>{children}</span>
      {!failed && <img
        src={`/images/blender-icons/${name}.png`}
        alt=""
        draggable={false}
        width={192}
        height={192}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{ opacity: ready ? 1 : 0 }}
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
      />}
    </span>
  );
}
