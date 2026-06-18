import type { Scenario, Market, Target, FactorType, IntentType } from '../../types/scenario';
import { MARKET_OPTIONS, TARGET_OPTIONS, FACTOR_TYPE_OPTIONS, FIELD_OPTIONS, FREQUENCY_OPTIONS, INTENT_CONFIG } from '../../types/scenario';
import { useTheme } from '../../contexts/ThemeContext';

interface ScenarioFormProps {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
}

export default function ScenarioForm({ scenario, onChange }: ScenarioFormProps) {
  const { isDark } = useTheme();

  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
    isDark ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
  }`;

  const labelCls = `block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`;

  const update = <K extends keyof Scenario>(key: K, value: Scenario[K]) => onChange({ ...scenario, [key]: value });

  return (
    <div className="space-y-5">
      {/* Raw input */}
      <div>
        <label className={labelCls}>自然语言描述</label>
        <textarea
          value={scenario.raw}
          onChange={e => update('raw', e.target.value)}
          placeholder="例如：寻找中证1000上的短期动量因子，5分钟频率，预测下一根K线方向"
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* Market + Frequency row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>市场</label>
          <select value={scenario.market} onChange={e => update('market', e.target.value as Market)} className={inputCls}>
            {MARKET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>频率</label>
          <div className="flex gap-1">
            {FREQUENCY_OPTIONS.map(f => (
              <button
                key={f}
                onClick={() => update('frequency', f)}
                className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                  scenario.frequency === f
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Universe */}
      <div>
        <label className={labelCls}>标的池</label>
        <div className="flex flex-wrap gap-2">
          {['hs300', 'zz500', 'zz1000', 'BTCUSDT', 'ETHUSDT'].map(u => {
            const active = scenario.universe.includes(u);
            return (
              <button
                key={u}
                onClick={() => update('universe', active ? scenario.universe.filter(x => x !== u) : [...scenario.universe, u])}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {u}
              </button>
            );
          })}
        </div>
      </div>

      {/* Horizon + Target + FactorType */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>预测窗口 (bar)</label>
          <input type="number" min={1} value={scenario.horizon} onChange={e => update('horizon', Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>目标</label>
          <select value={scenario.target} onChange={e => update('target', e.target.value as Target)} className={inputCls}>
            {TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>因子类型</label>
          <select value={scenario.factor_type} onChange={e => update('factor_type', e.target.value as FactorType)} className={inputCls}>
            {FACTOR_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Fields */}
      <div>
        <label className={labelCls}>可用字段</label>
        <div className="flex flex-wrap gap-2">
          {FIELD_OPTIONS.map(f => {
            const active = scenario.fields.includes(f);
            return (
              <button
                key={f}
                onClick={() => update('fields', active ? scenario.fields.filter(x => x !== f) : [...scenario.fields, f])}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : isDark ? 'border-gray-700 text-gray-400 hover:border-gray-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Intent Cards */}
      <div>
        <label className={labelCls}>生成意图（可选）</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(INTENT_CONFIG) as [IntentType, typeof INTENT_CONFIG[IntentType]][]).map(([key, cfg]) => {
            const active = scenario.intent === key;
            return (
              <button
                key={key}
                onClick={() => {
                  const newIntent = active ? undefined : key;
                  onChange({ ...scenario, intent: newIntent, weight_bias: newIntent ? cfg.bias : undefined });
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  active
                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                    : isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-xs font-medium ${active ? 'text-blue-400' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>{cfg.label}</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{cfg.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
