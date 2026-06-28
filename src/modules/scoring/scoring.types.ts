export interface ScoringAnswerInput {
  questionId: string;
  domainId: string;
  domainSlug: string;
  score: number;
}

export interface ScoringDomainInput {
  id: string;
  slug: string;
  name: string;
  layerId: string;
  layerSlug: string;
  displayOrder: number;
}

export interface ScoringLayerInput {
  id: string;
  slug: string;
  name: string;
  displayOrder: number;
}
