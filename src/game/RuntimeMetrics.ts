import {
  cloneOutcomeMetrics,
  createOutcomeMetrics,
  firstOutcomeCompletionTimes,
  recordOutcomeMetric,
  type OutcomeKind,
  type OutcomeMetrics,
  type OutcomeStatus,
} from '../sim/outcomes';

export type RuntimeMetricsSnapshot = {
  sessionStartedAt: number;
  actions: number;
  actionKinds: Record<string, number>;
  outcomes: OutcomeMetrics;
  saleTransactions: number;
  duckettesEarned: number;
  upgrades: number;
  firstUpgradeInGameSeconds: number | null;
  buildingsPlaced: number;
  cropsPlanted: number;
  cropsHarvested: number;
  treesFelled: number;
  foxesFelled: number;
  daysReached: number;
  sessionSeconds: number;
  inGameSeconds: number;
  day: number;
  timeToFirst: Record<OutcomeKind, number | null>;
};

type RuntimeMetricState = Omit<RuntimeMetricsSnapshot, 'sessionSeconds' | 'inGameSeconds' | 'day' | 'timeToFirst'>;

/** Owns local-only runtime/economy counters without becoming save state. */
export class RuntimeMetrics {
  private readonly state: RuntimeMetricState;

  constructor(sessionStartedAt: number) {
    this.state = {
      sessionStartedAt,
      actions: 0,
      actionKinds: {},
      outcomes: createOutcomeMetrics(),
      saleTransactions: 0,
      duckettesEarned: 0,
      upgrades: 0,
      firstUpgradeInGameSeconds: null,
      buildingsPlaced: 0,
      cropsPlanted: 0,
      cropsHarvested: 0,
      treesFelled: 0,
      foxesFelled: 0,
      daysReached: 1,
    };
  }

  recordAction(kind: string): void {
    this.state.actions++;
    this.state.actionKinds[kind] = (this.state.actionKinds[kind] ?? 0) + 1;
  }

  recordOutcome(
    kind: OutcomeKind,
    status: OutcomeStatus,
    inGameSeconds: number,
    legacyActionKind: string = kind,
  ): void {
    recordOutcomeMetric(this.state.outcomes, kind, status, inGameSeconds);
    if (status === 'completed') this.recordAction(legacyActionKind);
  }

  hasCompleted(kind: OutcomeKind): boolean {
    return this.state.outcomes[kind].completed > 0;
  }

  recordSale(earned: number): void {
    this.state.saleTransactions++;
    this.state.duckettesEarned += earned;
  }

  recordUpgrade(inGameSeconds: number): void {
    this.recordAction('upgrade');
    this.state.upgrades++;
    if (this.state.firstUpgradeInGameSeconds === null) {
      this.state.firstUpgradeInGameSeconds = inGameSeconds;
    }
  }

  recordBuildingPlaced(): void {
    this.state.buildingsPlaced++;
  }

  recordCropPlanted(): void {
    this.state.cropsPlanted++;
  }

  recordCropHarvested(count: number): void {
    this.state.cropsHarvested += count;
  }

  recordTreeFelled(): void {
    this.state.treesFelled++;
  }

  recordFoxFelled(): void {
    this.state.foxesFelled++;
  }

  setDaysReached(day: number): void {
    this.state.daysReached = day;
  }

  snapshot(inGameSeconds: number, day: number, now: number): RuntimeMetricsSnapshot {
    return {
      ...this.state,
      actionKinds: { ...this.state.actionKinds },
      outcomes: cloneOutcomeMetrics(this.state.outcomes),
      sessionSeconds: (now - this.state.sessionStartedAt) / 1000,
      inGameSeconds,
      day,
      timeToFirst: firstOutcomeCompletionTimes(this.state.outcomes),
    };
  }
}
