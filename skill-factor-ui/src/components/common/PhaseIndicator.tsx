import type { Phase } from '../../types/reward';
import { PHASE_THRESHOLDS } from '../../types/reward';

export default function PhaseIndicator({ phase }: { phase: Phase }) {
  const config = PHASE_THRESHOLDS[phase];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: config.color + '15', color: config.color }}
    >
      {config.label} · {config.desc}
    </span>
  );
}
