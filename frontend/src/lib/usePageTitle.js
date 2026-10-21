import { useEffect } from "react";

const BASE = "Table — Dine · Earn · Return";

// Sets document.title for the current page and restores the default on unmount.
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Table` : BASE;
    return () => {
      document.title = BASE;
    };
  }, [title]);
}
