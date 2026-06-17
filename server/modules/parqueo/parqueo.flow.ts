export const FLOW_ARROW_KINDS = ['straight', 'turn-left', 'turn-right', 'split-up-right', 'split-left-right', 'u-turn-right'] as const;
export type FlowArrowKind = typeof FLOW_ARROW_KINDS[number];

export interface DefaultFlowArrow {
  id: string;
  plan: string;
  x: number;
  y: number;
  r: number;
  kind?: FlowArrowKind;
}

export const DEFAULT_FLOW_ARROWS: DefaultFlowArrow[] = [];
