import type { StaticCheckResult, FutureLeakDetail } from '../../types/staticCheck';
import StatusDot from '../common/StatusDot';
import { useTheme } from '../../contexts/ThemeContext';

export default function StaticCheckPanel({ check }: { check: StaticCheckResult }) {
  const { isDark } = useTheme();

  const steps = [
    { label: '语法检查', passed: check.syntax_valid, detail: !check.syntax_valid ? '表达式语法错误' : undefined },
    { label: '未来数据泄露', passed: !check.future_leak, detail: check.future_leak ? formatLeakDetails(check.future_leak_details) : undefined },
    { label: '未知算子', passed: check.unknown_ops.length === 0, detail: check.unknown_ops.length > 0 ? `未知算子: ${check.unknown_ops.join(', ')}` : undefined },
  ];

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2">
          <StatusDot status={step.passed ? 'passed' : 'failed'} />
          <div className="flex-1 min-w-0">
            <span className={`text-xs font-medium ${step.passed ? (isDark ? 'text-gray-300' : 'text-gray-700') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
              {step.label}
            </span>
            {step.detail && (
              <p className={`text-xs mt-0.5 ${isDark ? 'text-red-400/80' : 'text-red-500'}`}>{step.detail}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatLeakDetails(details: FutureLeakDetail[] | null): string {
  if (!details || details.length === 0) return '检测到未来数据泄露';
  return details.map(d => d.message).join('; ');
}
