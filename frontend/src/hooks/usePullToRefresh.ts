import { useEffect, useState } from "react";

export function usePullToRefresh(onRefresh: () => Promise<unknown> | void): { refreshing: boolean } {
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let startY = 0;
    let armed = false;

    function onStart(event: TouchEvent): void {
      if (window.scrollY > 8) return;
      startY = event.touches[0]?.clientY ?? 0;
      armed = true;
    }

    async function onEnd(event: TouchEvent): Promise<void> {
      if (!armed) return;
      const endY = event.changedTouches[0]?.clientY ?? 0;
      armed = false;
      if (endY - startY < 72 || refreshing) return;
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [onRefresh, refreshing]);

  return { refreshing };
}
