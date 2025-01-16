export enum ValueType {
  NUMBER,
  NUMBERS_1_12,
  NUMBERS_2_12,
  NUMBERS_3_12,
  NUMBERS_1_18,
  NUMBERS_19_36,
  EVEN,
  ODD,
  RED,
  BLACK,
  DOUBLE_SPLIT,
  QUAD_SPLIT,
  TRIPLE_SPLIT,
  EMPTY,
}

export type ChipsData = {
  selectedChip: any;
  placedChips: any;
};

export interface Item {
  type: ValueType;
  value: number;
  valueSplit: number[];
}

export type WheelNumber = {
  next: any;
};

export type Winner = {
  username: string;
  sum: number;
};

export interface PlacedChip {
  item: Item;
  sum: number;
}
export type rouletteData = {
  numbers: number[];
};

export enum GameStages {
  PLACE_BET,
  NO_MORE_BETS,
  ROLL,
  WINNERS,
  NONE,
  ERROR,
}

export type RouletteWrapperState = {
  counter: number;
  gameId: string;
  isWasmLoaded: boolean;
  readyToRoll: boolean;
  extensionError: boolean;
  currentRoundBetPlaced: boolean;
  players: string[];
  commitments: [];
  rouletteData: rouletteData;
  number: WheelNumber;
  chipsData: ChipsData;
  winners: Winner[];
  username: string;
  endTime: number;
  progressCountdown: number;
  time_remaining: number;
  stage: GameStages;
  history: number[];
};

export type GameData = {
  id: string;
  stage: GameStages;
  time_remaining: number;
  value: number;
  wins: Winner[];
  history: number[];
};
