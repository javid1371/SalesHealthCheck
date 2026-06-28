export type DiagnosisSeverity = "low" | "medium" | "high" | "critical";

export interface BottleneckResult {
  domainId: string;
  domainSlug: string;
  domainName: string;
  weaknessScore: number;
  domainWeight: number;
  priorityScore: number;
  rank: number;
}

export interface LayerStatusResult {
  layerId: string;
  layerSlug: string;
  layerName: string;
  percentage: number;
  status: "healthy" | "medium" | "weak" | "critical";
}

export interface DiagnosisResult {
  diagnosisKey: string;
  title: string;
  description: string;
  severity: DiagnosisSeverity;
  priority: number;
  relatedDomainIds: string[];
  relatedLayerIds: string[];
}
