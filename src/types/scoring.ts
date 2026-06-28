import type { HealthLevel } from "./assessment";

export interface DomainScoreResult {
  domainId: string;
  domainSlug: string;
  rawScore: number;
  maxScore: number;
  percentage: number;
  healthLevel: HealthLevel;
}

export interface LayerScoreResult {
  layerId: string;
  layerSlug: string;
  rawScore: number;
  maxScore: number;
  percentage: number;
  healthLevel: HealthLevel;
}

export interface OverallScoreResult {
  rawScore: number;
  maxScore: number;
  percentage: number;
  healthLevel: HealthLevel;
}

export interface SpiderChartDataPoint {
  domainSlug: string;
  domainName: string;
  percentage: number;
}
