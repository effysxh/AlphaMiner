import type { Scenario } from '../types/scenario';

export const mockScenarios: Scenario[] = [
  {
    raw: '寻找中证1000上的短期动量因子，5分钟频率，预测下一根K线方向',
    market: 'equity',
    universe: ['zz1000'],
    frequency: '5min',
    horizon: 1,
    target: 'direction',
    factor_type: 'single_asset_timing',
    fields: ['close', 'open', 'high', 'low', 'volume', 'returns', 'vwap'],
    constraints: { max_depth: '4' },
    preferred_signals: ['momentum', 'volume_price'],
  },
  {
    raw: '生成和已有因子低相关的横截面因子，日频，预测5日收益排名',
    market: 'equity',
    universe: ['hs300', 'zz500'],
    frequency: '1d',
    horizon: 5,
    target: 'rank_ic',
    factor_type: 'cross_sectional',
    fields: ['close', 'volume', 'returns', 'vwap'],
    weight_bias: { redundancy: 0.10 },
    intent: 'redundancy_strict',
  },
  {
    raw: '探索加密货币的波动率因子，1小时频率，简单可解释的结构',
    market: 'crypto',
    universe: ['BTCUSDT', 'ETHUSDT'],
    frequency: '1h',
    horizon: 1,
    target: 'ic',
    factor_type: 'single_asset_timing',
    fields: ['close', 'high', 'low', 'volume', 'returns'],
    weight_bias: { complexity: 0.10 },
    intent: 'simplicity',
  },
];

export const defaultScenario: Scenario = {
  raw: '',
  market: 'equity',
  universe: ['zz1000'],
  frequency: '5min',
  horizon: 1,
  target: 'direction',
  factor_type: 'single_asset_timing',
  fields: ['close', 'open', 'high', 'low', 'volume', 'returns', 'vwap'],
};
