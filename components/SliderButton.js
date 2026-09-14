'use client';
// One wide control that replaces the separate toggle-switch + native
// <input type="range"> previously used for lights/dimmer/covers in Naprave.
//
//   kind="switch" — tap anywhere toggles. `value` is a boolean.
//   kind="dimmer" | "cover" — tap (no pointer movement) toggles between 0
//     and `lastValue` (falls back to 100); dragging sets an exact 0-100
//     value. `value`/`onChange` are integers 0-100.
//
// Deliberately commits only on pointerup, never mid-drag: Shelly's Cloud
// API is rate-limited to ~1 request/second per account (see
// providers/shelly/index.js), so firing a command per pixel of drag would
// throttle or drop commands. The fill tracks the finger instantly via
// local state; the parent's `value` only has to catch up once, after the
// optimistic patch + real command round-trip.
import { useRef, useState } from 'react';
import { cx } from '@/lib/utils';

export function SliderButton({
  kind = 'switch',
  value,
  lastValue,
  onChange,
  icon,
  label,
  valueText,
  disabled = false,
  className,
}) {
  const trackRef = useRef(null);
  const [dragValue, setDragValue] = useState(null);
  const movedRef = useRef(false);
  const startXRef = useRef(0);
  const pointerIdRef = useRef(null);

  const isSwitch = kind === 'switch';
  const numericValue = isSwitch ? (value ? 100 : 0) : (value ?? 0);
  const displayValue = dragValue != null ? dragValue : numericValue;
  const isDragging = dragValue != null;

  const commit = (v) => {
    if (isSwitch) {
      onChange(!!v);
    } else {
      onChange(Math.max(0, Math.min(100, Math.round(v))));
    }
  };

  const content = (
    <span className="relative z-1 flex h-full items-center justify-between gap-2.5 px-4.5">
      <span className="flex min-w-0 items-center gap-2.5 text-[13.5px] font-semibold text-stone-900 dark:text-stone-100">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-[13px] font-semibold whitespace-nowrap text-stone-900/65 tabular-nums dark:text-stone-100/70">
        {valueText ?? (isSwitch ? '' : `${displayValue}%`)}
      </span>
    </span>
  );

  const fill = (
    <span
      aria-hidden
      className={cx(
        'absolute inset-y-0 left-0 bg-orange-500/90',
        !isDragging && 'transition-[width] duration-150',
      )}
      style={{ width: `${displayValue}%` }}
    />
  );

  if (isSwitch) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => commit(!value)}
        className={cx(
          'relative h-14 w-full cursor-pointer overflow-hidden rounded-2xl border-none bg-stone-100 text-left disabled:cursor-default disabled:opacity-40 dark:bg-stone-800',
          className,
        )}
      >
        {fill}
        {content}
      </button>
    );
  }

  const onPointerDown = (e) => {
    if (disabled) return;
    movedRef.current = false;
    startXRef.current = e.clientX;
    pointerIdRef.current = e.pointerId;
    setDragValue(numericValue);
    trackRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (pointerIdRef.current !== e.pointerId || dragValue == null) return;
    if (Math.abs(e.clientX - startXRef.current) > 6) movedRef.current = true;
    if (movedRef.current && trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setDragValue(Math.max(0, Math.min(100, Math.round(pct))));
    }
  };
  const endDrag = (e) => {
    if (pointerIdRef.current !== e.pointerId || dragValue == null) return;
    if (!movedRef.current) {
      commit(numericValue > 0 ? 0 : lastValue || 100);
    } else {
      commit(dragValue);
    }
    setDragValue(null);
    pointerIdRef.current = null;
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cx(
        'relative h-14 w-full touch-pan-y overflow-hidden rounded-2xl bg-stone-100 select-none dark:bg-stone-800',
        disabled ? 'opacity-40' : 'cursor-pointer',
        className,
      )}
    >
      {fill}
      {content}
    </div>
  );
}
