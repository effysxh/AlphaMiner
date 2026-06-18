---
name: AI-Powered Alpha Factor Mining
version: 1.2
author: TransQuant
description: 使用大语言模型（LLM）生成量化交易因子，并通过多维奖励机制（新颖性、冗余性、多样性、复杂性）进行筛选和优化。
---



# Skill: AI-Powered Alpha Factor Mining



## 1.Objective (目标)

利用 LLM 的创造力探索传统人工难以覆盖的非线性因子空间，结合严格的量化奖励函数，产出 高 IC、低相关、风格分散​ 的 Alpha 因子集合。



## 2.Inputs (输入)

必须将用户的自然语言请求转换为**标准化的因子生成场景**，为后续所有 Skill 提供统一上下文

- 必须在生成任何因子前完成场景抽取
- 若无法识别某一字段，使用默认值或置空，不得阻塞流程
- 抽取结果以 JSON 形式保存，供后续 Skill 直接引用

| **字段**            | **类型**     | **必填** | **说明**                              |
| :------------------ | :----------- | :------- | :------------------------------------ |
| `raw`               | string       | yes      | 原始请求                              |
| `market`            | enum         | yes      | equity / futures / crypto / fx        |
| `universe`          | list[string] | yes      | 标的列表                              |
| `frequency`         | string       | yes      | 如 5min / 1h / 1d                     |
| `horizon`           | int          | yes      | 预测窗口（bar 数）                    |
| `target`            | enum         | yes      | direction / ic / rank_ic / return     |
| `factor_type`       | enum         | yes      | single_asset_timing / cross_sectional |
| `fields`            | list[string] | yes      | 可用字段                              |
| `constraints`       | dict         | no       | 额外约束                              |
| `preferred_signals` | list[string] | no       | 偏好信号族                            |



## 3.Reward Mechanism (奖励机制)

所有生成的因子必须被评分并记录。

注：本节定义的奖励项由系统提供的计算工具（tools/functions）完成，
Agent 的职责是：请求计算、接收结果、用于筛选/反馈/改写因子。

### 3.1 Scoring Dimensions (评分维度)

| 维度 (Dimension)           | 权重(${w_i}$) | 分项                    | 计算逻辑 (Logic)                                            | 惩罚/奖励方向 |
| -------------------------- | ------------- | ----------------------- | ----------------------------------------------------------- | ------------- |
| Reward(反馈奖励)           | $w_{11}$      | DirectionAccuracyReward | (sign(factor) == sign(future_return)) 的准确率 - 0.5) × 200 | 正向          |
|                            | $w_{12}$      | ICReward                | 因子值与未来收益的 Pearson 相关系数                         | 正向          |
|                            | $w_{13}$      | RankICReward            | 因子值与未来收益的 Spearman 秩相关                          | 正向          |
|                            | $w_{14}$      | SignalReturnReward      | `sign(factor) × future_return` 的年化 Sharpe                | 正向          |
| Novelty (新颖性)           | $w_2$         | /                       | 与因子库中已有因子的语义/结构差异（Embedding Distance）     | 正向          |
| Redundancy (冗余性)        | $w_3$         | /                       | 与 Top 10 核心因子的 Pearson Correlation                    | 负向          |
| FamilyDiversity (族多样性) | $w_4$         | /                       | 跟踪结构族哈希，新族加分，过度集中低质量族扣分              | 正向          |
| Complexity (复杂性)        | $w_5$         | /                       | 复杂度惩罚，生成的因子嵌套过深则减分                        | 负向          |

总奖励公式：

$R_{total}=w_{11}*DirectionAccuracyReward+w_{12}*ICReward+w_{13}*RankICReward+w_{14}*SignalReturnReward
+w_2*Novelty
+w_3*Redundancy 
+w_4*FamilyDiversity 
+w_5*Complexity$



### 3.2 Reward

反馈奖励下分为四个小项：

#### 3.2.1 DirectionAccuracyReward

**目标**

鼓励因子在未来一段时间内的预测方向与价格变动方向一致。

**计算方式**

$DirectionAccuracy=\frac{1}{T}\sum_{t=1}^{T}1(sign(\hat{y}_t)=sign(y_t))$

$DirectionAccuracyReward=DirectionAccuracy-0.5$

其中：

- $\hat{y}_t$：因子在第 t期的预测值
- $y_t$：第 t期真实收益
- $1(⋅)$：指示函数，相等为 1，否则为 0

**说明**：

方向准确性大于0.5为奖励，小于0.5为惩罚



#### 3.2.2 ICReward

**目标**

衡量因子值与未来收益之间的线性相关强度。

**计算方式**

$IC=\frac{1}{T}\sum_{t=1}^T\rho(\hat{y}_t, y_t)$

$ICReward=|IC|$

**说明**：

使用绝对值 IC，避免正负方向影响奖励，较高的绝对值IC表示更强的线性预测能力



#### 3.2.3 RankICReward

**目标**

衡量因子在横截面上对股票的排序能力，更贴近实际选股场景。

**定义**

$RankIC=\frac{1}{T}\sum_{t=1}^Tρ(rank(\hat{y}_t),rank(y_t))$

$RankICReward=|RankIC|$

其中 $ρ$为 **Spearman 相关系数**。

**说明**：

对极端值和分布偏移更鲁棒，适合横截面因子。



#### 3.2.4 SignalReturnReward

**目标**

衡量因子在模拟交易中的实际盈利能力。

**计算方式**

$SignalReturn=\frac{1}{T}\sum_{t=1}^{T}\hat{y}_t⋅y_t$

$SignalReturnReward=tanh(\alpha*SignalReturn)$

建议参数：α=10（可根据收益尺度调节）

**说明**：

使用 $tanh$ 防止极端收益主导奖励，保持梯度稳定。



### 3.3 Novelty

Agent 在生成因子时，必须通过本机制判断是否”重复”，避免生成与因子库已有的因子在数学结构上等价或高度相似的内容。

**目标**

- 防止 Agent 生成”字面不同但数学等价”的因子（如换变量名、调整顺序、等价变形）
- 防止 Agent 生成”结构近似”的换皮因子（如 `ts_mean(close, W_1_5) + ts_std(volume, W_6_20)` vs `ts_mean(close, W_1_5) + ts_std(close, W_6_20)`）
- 保证因子库的语义多样性，而非仅哈希层面的去重

**计算方式**

采用**哈希硬去重 + 语义软评分**双层机制。哈希和 embedding 向量存储在 FactorPool 中每个因子的记录里（见第 5 节输出规范）。查询时从 FactorPool 读取所有因子的 `novelty_hash` 和 `embedding_path`，构建内存索引。

**Step 1 — 表达式规范化（Canonicalization）**

与 FamilyDiversity 共用同一套规范化管线：

- 数值常量归一化（如 `0.01` → `1e-2`，`1/20` → `0.05`）
- 交换律排序（如 `a + b` → 按变量名字典序排列）
- 运算符归一（如 `a - b` → `a + (-b)`，`a / b` → `a * (1/b)`）
- 函数名统一（如 `sma` → `mean`，`lag` → `shift`）

**Step 2 — 窗口分桶 + AST 序列化**

与 FamilyDiversity 的 3.5 节使用相同的分桶规则，将数值常量替换为桶标签（`W_1_5`, `W_6_20` 等），然后对分桶后的 AST 做 DFS 遍历，序列化为结构化字符串：

```
原始表达式:  ts_mean(close, 5) + ts_std(volume, 10)
分桶后:      ts_mean(close, W_1_5) + ts_std(volume, W_6_20)
序列化:      “(+ ts_mean(close W_1_5) ts_std(volume W_6_20))”
```

序列化规则：
- 二元运算：`(op left right)`，如 `(+ a b)`
- 函数调用：`(func arg1 arg2 ...)`，如 `(ts_mean close W_1_5)`
- 叶子节点直接输出 token

**Step 3 — 哈希硬去重**

对规范化+分桶后的表达式生成 SHA256 哈希，查询 FactorPool 中所有因子的 `novelty_hash`：

- 若 `hash ∈ FactorPool`，**Novelty = -1**（精确重复，硬惩罚），不再计算 embedding

**Step 4 — 语义软评分**

对新表达式调用 `text-embedding-3-small` 获取 embedding 向量，从 FactorPool 加载所有已有因子的 embedding，计算余弦相似度：

$$Novelty = 1 - \max_{i} \cos(\mathbf{e}_{new}, \mathbf{e}_i)$$

其中 $\mathbf{e}$ 为 text-embedding-3-small 输出的 1536 维向量。

映射效果：

| 场景 | max_sim | Novelty |
|---|---|---|
| 精确重复（哈希命中） | — | -1.0 |
| 语义近似（换皮因子） | ~0.9 | 0.1 |
| 部分重叠（同算子不同结构） | ~0.5 | 0.5 |
| 完全新颖 | ~0.1 | 0.9 |

**入库写入**：因子通过评分入库时，将 `novelty_hash` 和 `embedding_path` 一并写入 FactorPool 记录（见第 5 节）。



### 3.4 Redundancy 

**目标**

防止 Agent 生成**与现有 Top 10 核心因子高度相关**的新因子。

经验表明，高冗余因子：

- 无法带来边际收益
- 增加过拟合风险
- 在集成阶段被边缘化

**判定方式**

Agent 必须将新因子表达式与当前**Top 10 核心因子**（按历史表现或权重选出的前 10 个）分别计算 **Pearson 相关系数**，取最大值作为冗余度。

$Redundancy=-(\max_{i=1,2,...,10}|\rho(new_factor, top_i)|-\rho_{threshold})$

$\rho_{threshold}$表示相关性上限，默认为0.6



### 3.5 FamilyDiversity

**目标**

在保证预测质量的前提下，鼓励 Agent 探索**结构上不同的因子族**，避免长期停留在同一算子 + 不同窗口的“换皮因子”。

**计算方式**

Agent 生成的表达式必须经过以下处理：

1.解析 AST 并分桶

将表达式解析为 Python AST，所有 int/float 常量通过 `_window_bucket` 替换为桶标签

| **数值范围** | **桶标签**  |
| :----------- | :---------- |
| ≤ 5          | `W_1_5`     |
| 6–20         | `W_6_20`    |
| 21–60        | `W_21_60`   |
| 61–120       | `W_61_120`  |
| 121–240      | `W_121_240` |
| > 240        | `W_241_480` |

2.数值常量分桶（Window Bucketing）

分桶后的 AST 通过 `ast.dump()` 序列化（不含字段名和属性），再 SHA1 哈希取前 16 位十六进制字符。两个表达式当且仅当分桶	后结构完全相同时，才属于同一族。

示例：

```python
ts_mean(close, 3)  → ts_mean(close, W_1_5)  → 同族
ts_mean(close, 5)  → ts_mean(close, W_1_5)  → 同族
ts_mean(close, 30)  → ts_mean(close, W_6_20) → 不同族
ts_std(close, 5)   → ts_std(close, W_1_5)  → 不同族（算子不同）
```

3.计算FamilyReward

```python
if family_count == 0 and reward_score >= family_good_new_threshold:
  bonus = +family_new_bonus           # 奖励高质量新族
elif family_count > family_free_quota and reward_score < low_quality_threshold (0.08):
  penalty = -family_repeat_penalty       # 抑制重复低质量族
else:
  pass               # 在配额内自由探索
```

| 参数 | 默认值 | 含义 |
|---|---|---|
| `family_count` | 0 | 该族之前出现过的表达式数量 |
| `family_free_quota` | 8 | 同族表达式允许出现的次数，超过后才可能触发惩罚 |
| `family_good_new_threshold` | 0.10 | 获得新族奖励所需的最低reward_score |
| `family_new_bonus` | 0.02 | 发现质量达标的新族时的奖励 |
| `family_repeat_penalty` | 0.02 | 超过配额后的低质量重复惩罚 |
| `family_low_quality_threshold` | 0.08 | 低于此分数的重复（且超过配额）才会被惩罚 |



### 3.6 Complexity

**目标**

防止因子表达式**过度嵌套**，避免不可读、难维护、易过拟合的结构。

**计算方式**

对生成的因子表达式进行 **AST 解析**，并计算**最大嵌套深度（Depth）**

Depth = 从 AST 根节点到最深叶子节点的最长路径长度

$Complexity=-(Depth-Depth_{safe})$

$Depth_{safe}$表示允许的最大深度默认为4



### 3.7 Weight Allocation (权重分配)

各维度的量纲和尺度差异巨大——IC 通常在 0.01~0.1，Novelty 是 ±1，FamilyDiversity 只有 ±0.02，直接加权没有意义。因此权重分配分两步：先归一化统一尺度，再按阶段确定权重。

#### 3.7.1 归一化

在对每个维度乘以权重之前，先将其映射到 [0, 1]（或 [-1, 1]）：

| 维度 | 原始范围 | 归一化方式 |
|---|---|---|
| DirectionAccuracyReward | [-0.5, 0.5] | `2x + 1` → [0, 1] |
| ICReward | [0, ~0.15] | `min(1, x / 0.10)` → [0, 1] |
| RankICReward | [0, ~0.15] | `min(1, x / 0.10)` → [0, 1] |
| SignalReturnReward | [-1, 1] (tanh后) | `(x + 1) / 2` → [0, 1] |
| Novelty | ±1 | 已在范围 |
| Redundancy | 连续值 | `sigmoid(x)` → [0, 1]，高冗余→接近1 |
| FamilyDiversity | ±0.02 | `min(1, x / 0.02)` → [0, 1] |
| Complexity | [0, ~0.05] | `min(1, x / 0.05)` → [0, 1] |

归一化后，权重才真正代表"重要性"，而不是在补偿尺度差异。



#### 3.7.2 阶段调度权重

核心逻辑：**先质后广再精**。初期高 Reward 权重保证基线质量，中期平衡探索，后期严格去冗余。

**初期（因子库为空，<50个因子）**：质量优先，IC 驱动

```
w11(DirectionAccuracy)=0.10, w12(IC)=0.3, w13(RankIC)=0.3, w14(SignalReturn)=0.10
w2(Novelty)=0.05
w3(Redundancy)=0.05
w4(Diversity)=0.05
w5(Complexity)=0.05
```

初期因子库为空，首要目标是筛选出预测力强的因子建立基线，Reward 维度合计 0.80（其中 IC+RankIC=0.6）；其余评分权重均接近于0。

**中期（50~200个因子）**：平衡质量与多样性

```
w11(DirectionAccuracy)=0.10, w12(IC)=0.20, w13(RankIC)=0.20, w14(SignalReturn)=0.10
w2(Novelty)=0.12
w3(Redundancy)=0.10
w4(Diversity)=0.10
w5(Complexity)=0.08
```

中期将 Reward 维度下降到 0.62，Novelty 降到 0.12。

**后期（>200个因子）**：质量优先，严格去冗余

```
w11(DirectionAccuracy)=0.05, w12(IC)=0.15, w13(RankIC)=0.15, w14(SignalReturn)=0.05
w2(Novelty)=0.15
w3(Redundancy)=0.15
w4(Diversity)=0.15
w5(Complexity)=0.15
```



#### 3.7.3 用户意图

用户在请求时往往带有取向性（如"帮我生成和之前都不大一样的因子"），应传导到奖励权重。在场景抽取阶段增加**意图→权重偏置**映射，作为对阶段基准权重的叠加调整。

在 `scenario.json` 中新增 `weight_bias` 字段：

```json
{
  "weight_bias": {
    "novelty": +0.15,
    "redundancy": 0,
    "complexity": -0.05
  }
}
```

实际权重 = 阶段基准权重 + weight_bias，再重新归一化到 $\sum w_i = 1$。

**意图识别规则**：

| 用户表达模式 | 识别意图 | weight_bias 调整 |
|---|---|---|
| "和之前不一样的"、"新颖的"、"创新的" | novelty_boost | novelty +0.15 |
| "和已有因子低相关"、"互补的" | redundancy_strict | redundancy +0.10 |
| "简单的"、"可解释的" | simplicity | complexity +0.10 |
| "只要预测准的"、"效果好的" | quality_first | w11~w14 各 +0.05, novelty -0.10 |
| "多探索几种结构"、"不同类型的" | diversity_boost | diversity +0.10 |
| "精细优化"、"改进现有因子" | refinement | novelty -0.10, redundancy -0.05 |

核心思路：**阶段调度定基调，用户意图做微调**，两层互不冲突。



## 4.Workflow (执行流程)

### 4.1 Scenario Extraction（场景抽取）

Agent 解析用户输入并生成标准化的 `scenario.json`， 若无法解析关键字段（如 `market`或 `target`），立即终止流程并报错。



### 4.2 Generation (生成)

调用 LLM生成因子表达式（json）及 Python 计算代码。

生成前须将 `DSL算子参考.md` 中的完整算子清单、类型约束和表达式示例作为上下文注入 LLM prompt，确保生成端与校验端使用同一份算子定义。



### 4.3 Static Check (静态校验)

在不接触数据的前提下，通过多层静态检查过滤掉不合法的表达式。

#### 4.3.1 语法检查

- 调用 Python 标准库AST的 ast.parse(expr, mode="eval")检查表达式是否符合 Python 表达式语法
- 若 `SyntaxError`，标记 `status="invalid_syntax"`，后续检查不再执行

#### 4.3.2 未知算子检查

- 遍历 AST，收集所有 `Call` 节点（函数名）和 `BinOp` 节点
- 函数名不在 `DSL算子参考.md` 定义的 `ALL_OPS` 中的，标记 `unknown_ops`
- 额外校验类型约束：字段访问器参数必须为整数常量、Array/Scalar 类型匹配等，违反约束的表达式标记为 `type_violation`

#### 4.3.3 未来数据泄露检查

遍历 AST，检测所有可能导致使用未来数据的模式，违反任一项即标记 `future_leak=True`：

| 检测规则 | 说明 | 示例违规 |
|---|---|---|
| 窗口参数为负数 | `shift(-1)`、`ts_mean(close, -5)` 等负窗口参数访问未来数据 | `shift(close, -1)` |
| 非法负数字面量 | AST 中 `UnaryOp(USub, Constant(n))` 产生的负数，出现在窗口参数位置 | `ts_sum(close, -10)` |
| 未来数据关键字 | 表达式中出现 `future`、`lookahead`、`peek` 等保留字 | `future_return(close)` |
| 算子参数方向校验 | DSL 算子中 shift/rolling 类算子的窗口参数必须 ≥ 1，编译时校验 | `ts_mean(close, 0)` |

**检测时机**：在 4.3.1 语法检查通过后、4.3.2 未知算子检查之前执行。若 `future_leak=True`，标记 `status="future_leak"`，后续检查不再执行。



### 4.4 Reward Calculation (奖励计算)

计算 Section 3 中的五维分数



### 4.5 Selection & DAG Evolution (筛选与 DAG 进化)

#### 4.5.1 入选判定

根据 $R_{total}$ 排序，按以下规则分流：

| 条件 | 状态 | 后续动作 |
|---|---|---|
| $R_{total}$ ≥ 0.7 | Candidate | 入库，可作为进化父节点 |
| $R_{total}$ < 0.7 且静态校验通过 | LowScore | 进入进化候选池，可被检索器选中进化 |
| 静态校验失败 | Rejected | 终止，不可继续进化 |

#### 4.5.2 DAG 进化知识图谱

因子之间的进化关系以 **有向无环图（DAG）** 组织，每个因子是图中的一个节点，每条有向边表示一次进化衍生关系（parent → child）。

**数据结构**

```
EvolutionDAG:
  nodes: Map<factor_id, {
    parent_id: string | null     # 父因子 ID，根节点为 null
    children_ids: string[]       # 子因子 ID 列表
    depth: int                   # 进化深度（根节点 depth=0）
    exploration_count: int       # 被选中进化的次数
    improved: bool | null        # 相对父因子是否改善，根节点为 null
  }>
  edges: {from: factor_id, to: factor_id, improved: bool}[]
```

**终止规则**

- Rejected 节点不可继续衍生子节点
- 深度达到 `depth_limit`（默认 7）的节点不再被选为进化候选
- 连续 `explore_limit`（默认 3）次进化均未改善的节点不再被选为进化候选

**插入时机**

新因子通过 4.3 静态校验和 4.4 奖励计算后，入库时自动插入 DAG 节点。若该因子是由某个父因子进化而来，同时插入一条进化边。

#### 4.5.3 贝叶斯进化检索器

在因子进化 DAG 中，从**进化候选池**中筛选出最具进化潜力的父因子，供 LLM 进行针对性改写。检索器采用贝叶斯建模思想，将父因子的进化优先级视为其产生高质量子因子的后验概率：
$$
\underset{F \in \mathcal{F}}{\arg\max} \, \mathbb{E}[\text{Qual}(F_{\text{new}}) \mid \text{parent}(F_{\text{new}}) = F, \mathcal{D}] 
\propto \frac{P(F_{\text{new}}) P(\mathcal{D} \mid F_{\text{new}})}{P(\mathcal{D})} \propto P(F_{\text{new}}) P(\mathcal{D} \mid F_{\text{new}})
$$
其中$P(F_{new})$为先验：




$$
P(F) = \underbrace{\sigma\left( \frac{\text{Qual}(F) - \mu_{\text{Qual}(\mathcal{F})}}{\varsigma_{\text{Qual}(\mathcal{F})}} \right)}_{\text{Normalized Quality}} \cdot \underbrace{(1 - \gamma)^{\text{depth}(F)}}_{\text{Depth Penalty}} \cdot \underbrace{(1 - \omega)^{k(F)}}_{\text{Retrieval Penalty}}
$$
$Qual(F)$表示因子的$IC$，其在因子池 $\mathcal{F}$中进行归一化；$\sigma$为 $Sigmoid$ 映射函数；$\mu_{Qual(\mathcal{F})}$和 $\varsigma_{Qual(\mathcal{F})}$分别为 $Qual(\cdot)$在 $\mathcal{F}$上的均值与标准差；$depth(F)$为因子$F$在图$\mathcal{G}$中的深度；$k(F)$表示 $F$在检索阶段被检索的次数。该质量得分由深度惩罚和检索惩罚两个惩罚项进行调节。

$P(\mathcal{D} \mid F_{\text{new}})$表示似然项，它本质上评估了新因子是否提升了整个因子集合的质量，而不仅仅是为了其自身的单独表现，根据当前节点是否为叶节点，似然项的计算方式有所不同：

叶节点：**尚未产生任何成功子代的因子**，代表了**未探索的优化路径**
$$
\text{ValDiv}(F, \mathcal{F}) \cdot \text{SemDiv}(F, \mathcal{F}) \cdot \text{SynDiv}(F, \mathcal{F})
$$

- $\text{ValDiv}$ **(Value Diversity)**：衡量因子数值输出的新颖性，通过计算其与 $\mathcal{F}$ 中其他因子的平均皮尔逊相关系数实现：

$$
1 - \left\| \frac{1}{|\mathcal{F}|} \sum_{f \in \mathcal{F}} \text{Corr}(F, f) \right\|
$$

- $\text{SemDiv}$ **(Semantic Diversity)**：衡量因子底层金融逻辑的新颖性，通过其 LLM 生成解释的嵌入向量的余弦相似度 ($\text{CosSim}$) 实现：

$$
\sigma(1 - \text{CosSim}(F, \mathcal{F}))
$$

- $\text{SynDiv}$ **(Syntactic Diversity)**：衡量因子数学结构的新颖性，通过其与其它因子的归一化编辑距离 ($ED$) 实现：

$$
\frac{1}{|\mathcal{F}|} \sum_{f \in \mathcal{F}} \frac{ED(F, f)}{\text{len}(F) + \text{len}(f)}
$$

非叶节点：**已成功产生出至少一个子代的因子**，代表了具有经过验证的**生成潜力历史**，一类父因子产生的子因子“略优但相似”，另一类父因子则“衍生出大量多样化的子代
$$
P(\mathcal{D} \mid F_{\text{new}}) \approx \bar{\text{PG}}(\mathcal{C}(F)) \cdot \text{Spar}(\mathcal{C}(F))
\tag{10}
$$

这里，$\bar{\text{PG}}$ 衡量从父因子到其现有子代的**平均质量增益（百分比）**。$\mathcal{C}(\cdot)$ 表示当前因子的子代集合。$\text{Spar}$ 项体现了子代“稀疏性”的关键权衡：我们奖励那些子代不仅与父因子“垂直多样”（区别于父代），而且子代之间也“水平多样”（相互区别）的父因子。这鼓励发现能解锁**多个独立优化路径**的父因子。我们将此形式化为**两个不同稀疏性度量的乘积**：

$$
\text{Spar}(\mathcal{C}(F)) = \text{Spar}_{\text{p-c}}(F) \cdot \text{Spar}_{\text{c-c}}(F)
\tag{11}
$$

$\text{Spar}_{\text{p-c}}$ 是**父子稀疏性**，衡量子代与父代的偏离程度：

$$
1 - \frac{1}{|\mathcal{C}(F)|} \sum_{f \in \mathcal{C}(F)} \text{Corr}(F, f)
\tag{12}
$$

$\text{Spar}_{\text{c-c}}$ 是**子代间稀疏性**，衡量子代之间的偏离程度。对于仅有**单个子代**的因子，我们设 $\text{Spar}_{\text{c-c}}(F) = 1$。否则，其定义为：

$$
1 - \frac{1}{\binom{|\mathcal{C}(F)|}{2}} \sum_{\substack{f_i, f_j \in \mathcal{C}(F) \\ i < j}} \text{Corr}(f_i, f_j)
\tag{13}
$$

最后，我们计算每个因子的**总分**。基于各自的分数对叶节点和非叶节点排序，选择**全局前 $k$ 名候选**传递给因子生成器，从而完成循环。



#### 4.5.4 进化 Trace 构建

对检索器选出的候选因子，沿 DAG 回溯到根节点，构建完整的进化路径（Trace），作为 LLM 改写的上下文。

**Trace 内容**

```
EvolutionTrace:
  - factor_id: “F_REV_004”
    expression: “ts_mean(close, 3) - ts_mean(close, 10)”
    total_reward: 0.42
    status: “LowScore”
    reject_reason: “total_reward=0.42 < 0.7; high redundancy (0.82) with F_MOM_001”
    llm_feedback: “建议加入量价交互项以降低冗余度”

  - factor_id: “F_REV_004_R1”
    expression: “corr(returns(10), log_arr(volume(10))) * sub(ts_mean(close, 3), ts_mean(close, 10))”
    total_reward: 0.68
    status: “LowScore”
    reject_reason: “total_reward=0.68 < 0.7; complexity惩罚较大”
    llm_feedback: “建议简化结构，移除一层嵌套”
    improved: true
```

**注入方式**

将 Trace 作为结构化上下文注入 LLM 的 System Prompt，格式为：

```
你正在优化一个 Alpha 因子。以下是该因子的进化历史：

[Trace 内容]

当前因子：{expression}
当前得分：{total_reward}
失败原因：{reject_reason}
优化建议：{llm_feedback}

请基于进化历史，生成 {generate_num} 个改进因子。要求：
1. 不要重复历史中已尝试的方向
2. 针对失败原因做出针对性修改
3. 保持与进化方向的一致性
```

#### 4.5.5 进化生成与验证

**迭代流程**

1. **检索**：贝叶斯检索器选出 top_k 个候选因子
2. **Trace 构建**：对每个候选回溯 DAG，构建进化路径
3. **生成**：LLM 基于 Trace + reject_reason + llm_feedback，为每个候选生成 `generate_num`（默认 5）个新因子
4. **验证**：新因子走完整的 4.3（静态校验）→ 4.4（奖励计算）流程
5. **入库**：
   - Candidate 因子入库，插入 DAG 节点，记录进化边
   - LowScore 因子入库，进入下一轮候选池
   - Rejected 因子入库，插入 DAG 节点但标记为终止节点
6. **循环**：重复 `search_time`（默认 20）轮



## 5.Output Specification (输出规范)

每个因子以 YAML 文件存储，包含以下模块：

| 模块 | 必填 | 说明 |
|---|---|---|
| `meta` | 是 | 因子元信息（ID、版本、生成时间、模型） |
| `scenario` | 是 | 场景参数（市场、标的、频率等，来自 Section 2） |
| `definition` | 是 | 因子定义（名称、表达式、计算代码、使用的 DSL 算子） |
| `static_check` | 是 | 静态校验结果（Section 4.3） |
| `reward_scores_raw` | 条件 | 奖励原始分数（静态校验通过时必填，否则为 null） |
| `weight_config` | 条件 | 权重配置（静态校验通过时必填，否则为 null） |
| `performance` | 条件 | 回测指标（静态校验通过时必填，否则为 null） |
| `archives` | 条件 | 归档信息（静态校验通过时必填，否则为 null） |
| `evolution` | 是 | DAG 进化信息（parent_id、children_ids、depth、improved、exploration_count、trace） |
| `status` | 是 | 因子状态：Candidate / Rejected / LowScore |
| `reject_reason` | 条件 | 失败原因（非 Candidate 时必填） |
| `notes` | 否 | 备注 |

下面按三种状态分别给出完整 YAML 示例。

### 5.1 Candidate（$R_{total}$ ≥ 0.7）

```yaml
# ------------------------------------------
# Factor 1: High Quality Candidate
# Status: Passed all checks, ready for archive
# ------------------------------------------
meta:
    factor_id: "F_MOM_001"
    version: "1.0"
    generated_at: "2026-05-25T14:30:00Z"
    generator_model: "gpt-4o"

scenario:
    market: "stock"
    universe: ["zz1000"]
    frequency: "5min"
    horizon: 1
    target: "direction"
    factor_type: "single_asset_timing"

definition:
    name: "ShortTermVolumeMomentum"
    description: "捕捉价格在放量情况下的短期动量延续"
    expression: "(close - open) * volume"
    code: "df['f_mom_001'] = (df['close'] - df['open']) * df['volume']"
    dsl_ops_used: ["close", "open", "volume", "mul", "sub"]
    data_path: "factors/F_MOM_001.parquet"

static_check:
    syntax_valid: true
    unknown_ops: []
    depth: 3
    depth_safe_limit: 4
    future_leak: false
    future_leak_details: null
    field_compliant: true
    passed: true

reward_scores_raw:
    direction_accuracy: 0.08
    ic: 0.045
    rank_ic: 0.12
    signal_return: 0.15
    novelty: 0.9
    redundancy: -0.15
    family_diversity: 0.02
    complexity: -0.01
    total_reward: 0.84

weight_config:
    phase: "early"
    base_weights: {w11: 0.10, w12: 0.3, w13: 0.3, w14: 0.10, w2: 0.05, w3: 0.05, w4: 0.05, w5: 0.05}
    weight_bias: {}

performance:
    ic_ir: 1.8
    win_rate: 0.54
    turnover: 0.25
    max_drawdown: 0.08

archives:
    novelty_hash: "a1b2c3d4e5f6..."
    embedding_path: "embeddings/F_MOM_001.npy"
    novelty_max_sim: 0.12
    novelty_most_similar_factor: "F_MOM_003"
    redundancy_top_factor: "F_MOM_008"
    redundancy_max_corr: 0.45
    family_hash: "f9e8d7c6b5a4..."
    family_count: 1
    is_new_family: true

evolution:
    parent_id: null
    children_ids: ["F_MOM_001_R1"]
    depth: 0
    improved: null
    exploration_count: 0
    trace: []

status: "Candidate"
notes: "Strong directional accuracy. Low redundancy with existing core factors."
```

### 5.2 Rejected（静态校验失败）

```yaml
# ------------------------------------------
# Factor 2: Rejected by Static Check
# Status: Failed at structural level (No calculation performed)
# ------------------------------------------
meta:
    factor_id: "F_VOL_002"
    version: "1.0"
    generated_at: "2026-05-25T14:31:00Z"
    generator_model: "gpt-4o"

scenario:
    market: "stock"
    universe: ["zz1000"]
    frequency: "5min"
    horizon: 1
    target: "direction"
    factor_type: "single_asset_timing"

definition:
    name: "InvalidVolatilityAttempt"
    description: "尝试使用非法算子计算波动率"
    expression: "custom_vol(close, 20)"
    code: "df['f_vol_002'] = custom_vol(df['close'], 20)"
    dsl_ops_used: ["close", "custom_vol"]
    data_path: null

static_check:
    syntax_valid: true
    unknown_ops:
    - "custom_vol"
    depth: 2
    depth_safe_limit: 4
    future_leak: false
    future_leak_details: null
    field_compliant: true
    passed: false

reward_scores_raw: null
weight_config: null
performance: null
archives: null

evolution:
    parent_id: "F_MOM_001"
    children_ids: []
    depth: 1
    improved: false
    exploration_count: 0
    trace:
      - factor_id: "F_MOM_001"
        expression: "(close - open) * volume"
        total_reward: 0.84
        reject_reason: null
        llm_feedback: null

status: "Rejected"
reject_reason: "unknown_ops: custom_vol"
notes: null
```

### 5.3 LowScore（静态校验通过但 $R_{total}$ < 0.7）

```yaml
# ------------------------------------------
# Factor 3: Low Score
# Status: Passed static check but below selection threshold
# ------------------------------------------
meta:
    factor_id: "F_REV_003_R2"
    version: "1.0"
    generated_at: "2026-05-25T15:15:00Z"
    generator_model: "gpt-4o"

scenario:
    market: "stock"
    universe: ["zz1000"]
    frequency: "5min"
    horizon: 1
    target: "direction"
    factor_type: "single_asset_timing"

definition:
    name: "SimplifiedReversalMomentum"
    description: "基于进化路径简化结构，将corr替换为ts_mean(returns)降低嵌套深度"
    expression: "mul(ts_mean(returns(10)), sub(last(close(3)), ts_mean(close(10))))"
    code: "df['f_rev_003_r2'] = df['returns'].rolling(10).mean() * (df['close'].shift(2) - df['close'].rolling(10).mean())"
    dsl_ops_used: ["returns", "close", "ts_mean", "mul", "sub", "last"]
    data_path: "factors/F_REV_003_R2.parquet"

static_check:
    syntax_valid: true
    unknown_ops: []
    depth: 4
    depth_safe_limit: 4
    future_leak: false
    future_leak_details: null
    field_compliant: true
    passed: true

reward_scores_raw:
    direction_accuracy: 0.06
    ic: 0.035
    rank_ic: 0.09
    signal_return: 0.12
    novelty: 0.7
    redundancy: -0.08
    family_diversity: 0.0
    complexity: 0.0
    total_reward: 0.68

weight_config:
    phase: "early"
    base_weights: {w11: 0.10, w12: 0.3, w13: 0.3, w14: 0.10, w2: 0.05, w3: 0.05, w4: 0.05, w5: 0.05}
    weight_bias: {novelty: -0.10, redundancy: -0.05}

performance:
    ic_ir: 1.5
    win_rate: 0.53
    turnover: 0.30
    max_drawdown: 0.10

archives:
    novelty_hash: "b3c4d5e6f7a8..."
    embedding_path: "embeddings/F_REV_003_R2.npy"
    novelty_max_sim: 0.55
    novelty_most_similar_factor: "F_REV_003_R1"
    redundancy_top_factor: "F_MOM_001"
    redundancy_max_corr: 0.45
    family_hash: "a1b2c3d4e5f6..."
    family_count: 3
    is_new_family: false

evolution:
    parent_id: "F_REV_003_R1"
    children_ids: []
    depth: 2
    improved: true
    exploration_count: 0
    trace:
      - factor_id: "F_REV_003"
        expression: "ts_mean(close, 3) - ts_mean(close, 10)"
        total_reward: 0.42
        reject_reason: "total_reward=0.42 < 0.7; high redundancy (0.82) with F_MOM_001"
        llm_feedback: "建议加入量价交互项以降低冗余度"
      - factor_id: "F_REV_003_R1"
        expression: "corr(returns(10), log_arr(volume(10))) * sub(ts_mean(close, 3), ts_mean(close, 10))"
        total_reward: 0.68
        reject_reason: "total_reward=0.68 < 0.7; complexity惩罚较大"
        llm_feedback: "建议简化结构，移除一层嵌套"
        improved: true

status: "LowScore"
reject_reason: "total_reward=0.68 < threshold=0.7; complexity惩罚较大"
notes: "Improved from parent (0.68 vs 0.42), but still below threshold. Complexity resolved, need to boost IC."
```



## 6.Factor Pool（因子库）

### 6.1 存储结构

```
factor_pool/
├── factors/                  # 因子记录 YAML（Section 5 定义的完整输出）
│   ├── F_MOM_001.yaml
│   ├── F_VOL_002.yaml
│   └── ...
├── data/                     # 因子值时间序列（parquet，列：datetime, factor_value）
│   ├── F_MOM_001.parquet
│   ├── F_REV_003.parquet
│   └── ...
└── embeddings/               # 语义嵌入向量（text-embedding-3-small 输出）
    ├── F_MOM_001.npy
    └── ...
```

每个因子自包含一个 YAML 文件，YAML 中的 `data_path` 和 `embedding_path` 分别指向 `data/` 和 `embeddings/` 下的文件。

### 6.2 索引

启动时扫描 `factors/*.yaml` 构建内存索引，避免每次查询都遍历文件。索引在 `add()` 时增量更新，不需要每次重建。

| 索引 | 结构 | 用途 |
|---|---|---|
| `_by_id` | `dict[factor_id → yaml_dict]` | 按 ID 直接查找 |
| `_novelty_hash_index` | `dict[hash → factor_id]` | Novelty 哈希硬去重（3.3 Step 3） |
| `_family_count_index` | `dict[family_hash → int]` | FamilyDiversity 族计数（3.5） |
| `_top10_cache` | `list[factor_id]` | Redundancy 用，按 `total_reward` 降序取前 10 |
| `_embedding_cache` | `dict[factor_id → ndarray]` | Novelty 语义相似度计算（3.3 Step 4） |
| `_evolution_dag` | `dict[factor_id → {parent_id, children_ids, depth, exploration_count, improved}]` | DAG 进化图谱（4.5.2） |
| `_exploration_count` | `dict[factor_id → int]` | 记录每个因子被选中进化的次数（4.5.3） |
| `_leaf_nodes` | `set[factor_id]` | 当前叶子节点集合（无子节点的 LowScore 因子，4.5.3） |

### 6.3 Top 10 核心因子选取

Redundancy（3.4）需要与 Top 10 核心因子计算相关系数，选取逻辑：

1. 从 `_by_id` 中筛选 `status="Candidate"` 的因子
2. 按 `total_reward` 降序排列，取前 10
3. 缓存到 `_top10_cache`，每次有新 Candidate 入库时刷新

因子库不足 10 个时，用全部 Candidate。

### 6.4 核心操作

| 操作 | 输入 | 输出 | 说明 |
|---|---|---|---|
| `add(record)` | 完整 YAML dict | — | 写 YAML + parquet + npy，增量更新所有索引 |
| `query_novelty(hash)` | `novelty_hash` | `factor_id or None` | 哈希精确匹配，命中返回对应 factor_id |
| `query_novelty_embedding(vec)` | 新因子的 embedding 向量 | `(max_sim, most_similar_id)` | 遍历 `_embedding_cache` 计算余弦相似度 |
| `query_family(hash)` | `family_hash` | `count` | 返回该族已有因子数量 |
| `query_redundancy(new_values)` | 新因子值 Series | `(max_corr, top_factor_id)` | 与 Top 10 的 parquet 数据逐个计算 Pearson 相关系数 |
| `list_status(status)` | status 字符串 | `list[factor_id]` | 按状态筛选因子 |
| `get_top10()` | — | `list[factor_id]` | 返回当前 Top 10 核心因子 |
| `build_evolution_trace(factor_id)` | factor_id | `list[trace_node]` | 沿 DAG 回溯到根节点，构建完整进化路径（4.5.4） |
| `select_evolution_candidates(top_k)` | top_k | `list[factor_id]` | 贝叶斯检索器选出最优进化候选（4.5.3） |
| `record_evolution(parent_id, child_id, improved)` | 父子 ID, 是否改善 | — | 插入 DAG 边，更新 `_evolution_dag` 和 `_leaf_nodes` 索引 |



## 7.Anti-patterns (禁忌模式)

- 禁止直接复制 Barra 风格因子（低 Novelty）。
- 禁止生成无法解释的黑盒公式（除非 Diversity 极高且 Complementarity 极强）。
- 禁止对 Rejected 因子继续进化（DAG 终止规则，见 4.5.2）。
- 禁止对超过 `depth_limit`（默认 7）的因子继续进化。
- 禁止对同一因子连续进化超过 `explore_limit`（默认 3）次而不改善。
- 禁止在进化 Trace 中忽略历史失败方向（必须参考 Trace 避免重复尝试）。