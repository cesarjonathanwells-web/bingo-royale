import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge tailwind classes using clsx + tailwind-merge.
 * Handles conditional classes and deduplication.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format milliseconds to a readable time string.
 * Examples: 65000 -> "1:05", 3600000 -> "1:00:00"
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Format a room code for display (uppercase, spaced for readability).
 * Example: "abc123" -> "ABC-123"
 */
export function generateRoomCode(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length <= 3) return upper;
  return `${upper.slice(0, 3)}-${upper.slice(3)}`;
}
