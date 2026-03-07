/** Lightweight classname joiner — no extra deps needed */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
