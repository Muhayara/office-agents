import React from 'react';

interface TickProps {
  used: number;
  cap: number;
  fillColor?: string;
  label?: string;
}

export function Tick({ used, cap, fillColor = 'var(--data)', label }: TickProps) {
  const segments = 20;
  if (cap === 0) {
    return (
      <div className="tick-bar" title={label ?? 'Kursi manual (tanpa batas)'}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          manual
        </span>
      </div>
    );
  }

  const ratio = Math.min(1, Math.max(0, used / cap));
  const filledCount = Math.round(ratio * segments);
  const remainingRatio = 1 - ratio;

  let activeColor = fillColor;
  if (used >= cap) {
    activeColor = 'var(--danger)';
  } else if (remainingRatio <= 0.2) {
    activeColor = 'var(--warn)';
  }

  return (
    <div
      className="tick-bar"
      role="meter"
      aria-valuenow={used}
      aria-valuemin={0}
      aria-valuemax={cap}
      aria-label={label ?? `Kuota ${used} dari ${cap}`}
    >
      <div className="tick-segments" aria-hidden="true">
        {Array.from({ length: segments }).map((_, idx) => (
          <span
            key={idx}
            className="tick-seg"
            style={{
              backgroundColor: idx < filledCount ? activeColor : 'var(--rule)',
            }}
          />
        ))}
      </div>
      <span
        className="mono"
        style={{
          fontSize: 12,
          color: used >= cap ? 'var(--danger)' : 'var(--text-muted)',
        }}
      >
        {used}/{cap}
      </span>
    </div>
  );
}
