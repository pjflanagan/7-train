import { useLayoutEffect, useRef, useState } from 'react';
import { snapToTileUnit } from '@/lib/constants';

/**
 * Rounds an element's height up to a whole number of tile units so the tiled
 * background continues unbroken into whatever is stacked below it.
 *
 * Measures a separate inner node rather than the element being sized: the
 * min-height we apply does not affect the inner node's own height, so the
 * ResizeObserver cannot feed back into itself.
 *
 * Runs as a layout effect so the height is settled before the planner's
 * scroll-anchoring reads scrollHeight after prepending a week.
 */
export function useTileGridHeight() {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const measure = () => {
      const natural = content.getBoundingClientRect().height;
      if (natural <= 0) return;
      const snapped = snapToTileUnit(natural);
      setMinHeight((current) => (current === snapped ? current : snapped));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return { contentRef, minHeight };
}
