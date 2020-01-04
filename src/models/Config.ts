export interface DrawConfig {
  chartCount: number;
  upperBound: number;
  lowerBound: number;
  useWeights: boolean;
  weights: number[];
  forceDistribution: boolean;
  style: string;
  difficulties: Set<string>;
  flags: Set<string>;
}
