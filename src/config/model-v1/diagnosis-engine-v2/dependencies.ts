export type DependencyEdge = {
  rootEngineId: number;
  symptomEngineId: number;
  weight: number;
};

export const DEPENDENCY_EDGES: DependencyEdge[] = [
  { rootEngineId: 2, symptomEngineId: 3, weight: 0.8 },
  { rootEngineId: 2, symptomEngineId: 5, weight: 0.7 },
  { rootEngineId: 2, symptomEngineId: 12, weight: 0.7 },
  { rootEngineId: 2, symptomEngineId: 9, weight: 0.6 },
  { rootEngineId: 2, symptomEngineId: 10, weight: 0.6 },
  { rootEngineId: 3, symptomEngineId: 12, weight: 0.8 },
  { rootEngineId: 3, symptomEngineId: 11, weight: 0.7 },
  { rootEngineId: 3, symptomEngineId: 9, weight: 0.7 },
  { rootEngineId: 3, symptomEngineId: 4, weight: 0.7 },
  { rootEngineId: 3, symptomEngineId: 5, weight: 0.6 },
  { rootEngineId: 1, symptomEngineId: 16, weight: 0.7 },
  { rootEngineId: 1, symptomEngineId: 7, weight: 0.5 },
  { rootEngineId: 1, symptomEngineId: 13, weight: 0.5 },
  { rootEngineId: 7, symptomEngineId: 13, weight: 0.7 },
  { rootEngineId: 7, symptomEngineId: 9, weight: 0.6 },
  { rootEngineId: 7, symptomEngineId: 12, weight: 0.5 },
  { rootEngineId: 8, symptomEngineId: 10, weight: 0.6 },
  { rootEngineId: 8, symptomEngineId: 11, weight: 0.5 },
  { rootEngineId: 8, symptomEngineId: 12, weight: 0.5 },
  { rootEngineId: 4, symptomEngineId: 13, weight: 0.8 },
  { rootEngineId: 4, symptomEngineId: 12, weight: 0.7 },
  { rootEngineId: 6, symptomEngineId: 13, weight: 0.6 },
  { rootEngineId: 6, symptomEngineId: 12, weight: 0.5 },
  { rootEngineId: 15, symptomEngineId: 13, weight: 0.5 },
  { rootEngineId: 15, symptomEngineId: 9, weight: 0.5 },
];

/** Binary dependency map (root → symptoms) for fallback M. */
export const BINARY_DEPENDENCIES: Record<number, number[]> = {
  2: [5, 3, 9, 10, 12],
  3: [5, 9, 11, 12, 4],
  1: [16, 7, 13],
  7: [9, 12, 13],
  8: [10, 11, 12],
  4: [12, 13],
  6: [12, 13],
  15: [9, 13],
};
