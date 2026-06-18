import type { Factor } from '../../types/factor';
import FactorCard from './FactorCard';

export default function FactorStreamList({ factors }: { factors: Factor[] }) {
  if (factors.length === 0) return null;

  return (
    <div className="space-y-3">
      {factors.map((factor, i) => (
        <FactorCard key={factor.meta.factor_id} factor={factor} index={i} />
      ))}
    </div>
  );
}
