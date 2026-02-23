import { create } from 'zustand';

interface Player {
  id: number;
  name: string;
  nickname?: string;
}

interface Match {
  id: number;
  player1: Player;
  player2: Player;
  myPlayer: Player;
  bestOf: number;
  currentGame: number;
  player1Games: number;
  player2Games: number;
  player1Score: number;
  player2Score: number;
  status: 'playing' | 'finished';
}

interface Point {
  positionX: number;
  positionY: number;
  winnerPlayerId: number;
  reason: string;
  myPlayerPosX?: number;
  myPlayerPosY?: number;
  opponentPosX?: number;
  opponentPosY?: number;
}

interface MatchStore {
  currentMatch: Match | null;
  points: Point[];
  setCurrentMatch: (match: Match) => void;
  addPoint: (point: Point) => void;
  updateScore: (player1Score: number, player2Score: number) => void;
  updateGames: (player1Games: number, player2Games: number) => void;
  nextGame: () => void;
  finishMatch: (winnerId: number) => void;
  resetMatch: () => void;
}

export const useMatchStore = create<MatchStore>((set) => ({
  currentMatch: null,
  points: [],
  
  setCurrentMatch: (match) => set({ currentMatch: match, points: [] }),
  
  addPoint: (point) => set((state) => ({ points: [...state.points, point] })),
  
  updateScore: (player1Score, player2Score) => set((state) => ({
    currentMatch: state.currentMatch ? {
      ...state.currentMatch,
      player1Score,
      player2Score,
    } : null,
  })),
  
  updateGames: (player1Games, player2Games) => set((state) => ({
    currentMatch: state.currentMatch ? {
      ...state.currentMatch,
      player1Games,
      player2Games,
    } : null,
  })),
  
  nextGame: () => set((state) => ({
    currentMatch: state.currentMatch ? {
      ...state.currentMatch,
      currentGame: state.currentMatch.currentGame + 1,
      player1Score: 0,
      player2Score: 0,
    } : null,
  })),
  
  finishMatch: (winnerId) => set((state) => ({
    currentMatch: state.currentMatch ? {
      ...state.currentMatch,
      status: 'finished',
    } : null,
  })),
  
  resetMatch: () => set({ currentMatch: null, points: [] }),
}));