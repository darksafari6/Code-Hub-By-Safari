import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '../../lib/utils';

interface SplitterProps {
  /** `vertical` splits left/right (drag horizontally). */
  orientation: 'vertical' | 'horizontal';
  onResize: (delta: number) => void;
  label: string;
}

export function Splitter({ orientation, onResize, label }: SplitterProps) {
  const [dragging, setDragging] = useState(false);
  const lastPosition = useRef(0);
  const isVertical = orientation === 'vertical';

  const read = (event: ReactPointerEvent<HTMLDivElement>): number =>
    isVertical ? event.clientX : event.clientY;

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      onPointerDown={(event) => {
        event.preventDefault();
        lastPosition.current = read(event);
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragging) return;
        const current = read(event);
        const delta = current - lastPosition.current;
        if (delta === 0) return;
        lastPosition.current = current;
        onResize(delta);
      }}
      onPointerUp={(event) => {
        setDragging(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => setDragging(false)}
      className={cn(
        'group relative z-20 shrink-0 touch-none',
        isVertical ? 'w-[5px] cursor-col-resize' : 'h-[5px] cursor-row-resize',
        dragging && 'bg-accent/40',
      )}
    >
      <div
        className={cn(
          'absolute bg-line transition-colors group-hover:bg-accent/70',
          isVertical ? 'inset-y-0 left-[2px] w-px' : 'inset-x-0 top-[2px] h-px',
          dragging && 'bg-accent',
        )}
      />
    </div>
  );
}
