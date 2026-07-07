export type SalesFunnelStageInput = {
  name: string;
  count: number;
};

export type SalesFunnelEngineInput = {
  stages: SalesFunnelStageInput[];
  aov?: number;
  repeatRate?: number;
};

export type StageTransitionMetrics = {
  fromIndex: number;
  toIndex: number;
  fromName: string;
  toName: string;
  conversionRate: number;
  dropOffCount: number;
  dropOffPercent: number;
};

export type SalesFunnelBottleneck = {
  transitionIndex: number;
  fromIndex: number;
  toIndex: number;
  fromName: string;
  toName: string;
  dropOffPercent: number;
};

export type RevenueProjection = {
  customers: number;
  aov: number;
  repeatRate: number;
  monthly: number;
  annual: number;
};

export type SalesFunnelAnalysis = {
  stages: SalesFunnelStageInput[];
  transitions: StageTransitionMetrics[];
  overallConversionRate: number;
  bottleneck: SalesFunnelBottleneck | null;
  revenue: RevenueProjection | null;
};

export type GoalSeekResult = {
  requiredStages: SalesFunnelStageInput[];
  overallConversionRate: number;
};

const MAX_CONVERSION_RATE = 1;
const DEFAULT_REPEAT_RATE = 1;

function roundRate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isValidMetric(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isValidCount(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function clampConversion(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), MAX_CONVERSION_RATE);
}

function validateStages(stages: SalesFunnelStageInput[] | null | undefined): SalesFunnelStageInput[] | null {
  if (!stages || stages.length === 0) return null;

  for (const stage of stages) {
    if (!stage.name.trim() || !isValidCount(stage.count)) {
      return null;
    }
  }

  return stages.map((stage) => ({
    name: stage.name,
    count: stage.count,
  }));
}

function conversionBetween(fromCount: number, toCount: number): number {
  if (fromCount <= 0) return 0;
  return clampConversion(toCount / fromCount);
}

function buildTransitions(stages: SalesFunnelStageInput[]): StageTransitionMetrics[] {
  const transitions: StageTransitionMetrics[] = [];

  for (let index = 0; index < stages.length - 1; index += 1) {
    const from = stages[index];
    const to = stages[index + 1];
    const conversionRate = conversionBetween(from.count, to.count);
    const dropOffCount = from.count - to.count;
    const dropOffPercent =
      from.count > 0 ? roundRate(dropOffCount / from.count) : 0;

    transitions.push({
      fromIndex: index,
      toIndex: index + 1,
      fromName: from.name,
      toName: to.name,
      conversionRate: roundRate(conversionRate),
      dropOffCount: roundMoney(dropOffCount),
      dropOffPercent,
    });
  }

  return transitions;
}

function identifyBottleneck(
  transitions: StageTransitionMetrics[],
): SalesFunnelBottleneck | null {
  if (transitions.length === 0) return null;

  let bottleneck = transitions[0];
  for (const transition of transitions) {
    if (transition.dropOffPercent >= bottleneck.dropOffPercent) {
      bottleneck = transition;
    }
  }

  return {
    transitionIndex: bottleneck.fromIndex,
    fromIndex: bottleneck.fromIndex,
    toIndex: bottleneck.toIndex,
    fromName: bottleneck.fromName,
    toName: bottleneck.toName,
    dropOffPercent: bottleneck.dropOffPercent,
  };
}

function overallConversion(stages: SalesFunnelStageInput[]): number {
  if (stages.length === 0) return 0;
  if (stages.length === 1) return MAX_CONVERSION_RATE;

  const top = stages[0].count;
  const bottom = stages[stages.length - 1].count;
  return roundRate(conversionBetween(top, bottom));
}

function projectRevenue(
  stages: SalesFunnelStageInput[],
  aov: number | undefined,
  repeatRate: number | undefined,
): RevenueProjection | null {
  if (!isValidMetric(aov)) return null;

  const repeat = repeatRate ?? DEFAULT_REPEAT_RATE;
  if (!isValidMetric(repeat)) return null;

  const customers = stages[stages.length - 1]?.count ?? 0;
  const monthly = roundMoney(customers * aov * repeat);

  return {
    customers,
    aov,
    repeatRate: repeat,
    monthly,
    annual: roundMoney(monthly * 12),
  };
}

/**
 * Pure sales-funnel engine.
 * Computes conversion, drop-off, bottleneck, and optional revenue from ordered stage counts.
 */
export function computeSalesFunnel(
  input: SalesFunnelEngineInput | null | undefined,
): SalesFunnelAnalysis | null {
  const stages = validateStages(input?.stages);
  if (!stages) return null;

  const transitions = buildTransitions(stages);

  return {
    stages,
    transitions,
    overallConversionRate: overallConversion(stages),
    bottleneck: identifyBottleneck(transitions),
    revenue: projectRevenue(stages, input?.aov, input?.repeatRate),
  };
}

/**
 * Back-solves required stage counts to reach a target customer count,
 * holding current step conversion rates constant.
 */
export function goalSeek(
  input: SalesFunnelEngineInput | null | undefined,
  targetCustomers: number,
): GoalSeekResult | null {
  const stages = validateStages(input?.stages);
  if (!stages || stages.length < 2) return null;
  if (!isValidMetric(targetCustomers)) return null;

  const transitions = buildTransitions(stages);
  const requiredCounts = new Array<number>(stages.length).fill(0);
  requiredCounts[stages.length - 1] = targetCustomers;

  for (let index = stages.length - 2; index >= 0; index -= 1) {
    const conversionRate = transitions[index]?.conversionRate ?? 0;
    if (conversionRate <= 0) return null;
    requiredCounts[index] = requiredCounts[index + 1] / conversionRate;
  }

  const requiredStages = stages.map((stage, index) => ({
    name: stage.name,
    count: Math.round(requiredCounts[index]),
  }));

  return {
    requiredStages,
    overallConversionRate: overallConversion(requiredStages),
  };
}

/**
 * Applies a conversion delta at one transition and propagates downstream
 * using the unchanged conversion rates of later transitions.
 */
export function whatIf(
  input: SalesFunnelEngineInput | null | undefined,
  stageIndex: number,
  deltaConversion: number,
): SalesFunnelAnalysis | null {
  const stages = validateStages(input?.stages);
  if (!stages || stages.length < 2) return null;
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= stages.length - 1) {
    return null;
  }
  if (!Number.isFinite(deltaConversion)) return null;

  const transitions = buildTransitions(stages);
  const adjustedStages = stages.map((stage) => ({ ...stage }));
  const adjustedConversion = clampConversion(
    transitions[stageIndex].conversionRate + deltaConversion,
  );

  adjustedStages[stageIndex + 1] = {
    ...adjustedStages[stageIndex + 1],
    count: adjustedStages[stageIndex].count * adjustedConversion,
  };

  for (let index = stageIndex + 1; index < stages.length - 1; index += 1) {
    const downstreamConversion = transitions[index].conversionRate;
    adjustedStages[index + 1] = {
      ...adjustedStages[index + 1],
      count: adjustedStages[index].count * downstreamConversion,
    };
  }

  return computeSalesFunnel({
    stages: adjustedStages.map((stage) => ({
      name: stage.name,
      count: roundMoney(stage.count),
    })),
    aov: input?.aov,
    repeatRate: input?.repeatRate,
  });
}
