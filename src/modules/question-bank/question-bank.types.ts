export interface QuestionOptionDto {
  id: string;
  text: string;
  score: number;
  displayOrder: number;
}

export interface QuestionDto {
  id: string;
  text: string;
  displayOrder: number;
  options: QuestionOptionDto[];
}

export interface DomainQuestionsDto {
  id: string;
  name: string;
  slug: string;
  layer: {
    id: string;
    slug: string;
    name: string;
  };
  displayOrder: number;
  questions: QuestionDto[];
}

export interface ModelVersionDto {
  id: string;
  versionNumber: string;
  name: string;
}

export interface QuestionsForAssessmentDto {
  assessmentId: string;
  modelVersion: ModelVersionDto;
  domains: DomainQuestionsDto[];
}
