import { useLayoutEffect, type MutableRefObject } from "react";

/** Keeps a mutable ref aligned with the latest value without assigning during render. */
export function useSyncRef<T>(
  valueRef: MutableRefObject<T>,
  value: T,
): void {
  useLayoutEffect(() => {
    valueRef.current = value;
  });
}
