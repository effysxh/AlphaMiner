import { useTheme } from '../../contexts/ThemeContext';

const DSL_OPS = new Set(['close', 'open', 'high', 'low', 'volume', 'returns', 'vwap', 'ts_mean', 'ts_std', 'ts_max', 'ts_min', 'ts_sum', 'ts_skew', 'ts_kurt', 'last', 'first', 'corr', 'cov', 'diff', 'log_arr', 'normalize', 'ema_arr', 'slice_arr', 'add_arr', 'sub_arr', 'mul_arr', 'div_arr', 'neg', 'abs_s', 'log_s', 'tanh_s', 'sign_s', 'add', 'sub', 'mul', 'div', 'zscore', 'rank']);

export default function ExpressionDisplay({ expression }: { expression: string }) {
  const { isDark } = useTheme();

  const tokens = expression.split(/([(),\s+\-*/])/).filter(Boolean);

  return (
    <code className="text-xs font-mono">
      {tokens.map((token, i) => {
        if (DSL_OPS.has(token)) {
          return <span key={i} className={isDark ? 'text-blue-400' : 'text-blue-600'}>{token}</span>;
        }
        if (/^\d+(\.\d+)?$/.test(token)) {
          return <span key={i} className={isDark ? 'text-amber-400' : 'text-amber-600'}>{token}</span>;
        }
        if (['(', ')'].includes(token)) {
          return <span key={i} className={isDark ? 'text-gray-500' : 'text-gray-400'}>{token}</span>;
        }
        return <span key={i}>{token}</span>;
      })}
    </code>
  );
}
