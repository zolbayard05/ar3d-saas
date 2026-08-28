interface ModelScaleControlProps {
  scale: number;
  onScaleChange: (value: number) => void;
  min?: number;
  max?: number;
}

/** Presentation only — see hooks/useModelScale.ts for the persistence logic. */
export function ModelScaleControl({ scale, onScaleChange, min = 0.1, max = 3 }: ModelScaleControlProps) {
  return (
    <label className="flex flex-col gap-2 text-small text-text-muted">
      <span>Хэмжээ ({scale.toFixed(2)}x)</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={scale}
        onChange={(event) => onScaleChange(Number(event.target.value))}
        className="accent-accent"
      />
    </label>
  );
}
