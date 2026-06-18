import type { CheckStatus } from '../../types/staticCheck';

const dotColors: Record<CheckStatus, string> = {
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  pending: 'bg-gray-400',
  skipped: 'bg-gray-300',
};

export default function StatusDot({ status }: { status: CheckStatus }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${dotColors[status]}`} />
  );
}
