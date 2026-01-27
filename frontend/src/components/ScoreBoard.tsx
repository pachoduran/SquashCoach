import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GameResult {
  player1Score: number;
  player2Score: number;
}

interface ScoreBoardProps {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  player1Games: number;
  player2Games: number;
  currentGame: number;
  bestOf: number;
  gameResults?: GameResult[];
  tournamentName?: string;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  player1Games,
  player2Games,
  currentGame,
  bestOf,
  gameResults = [],
  tournamentName,
}) => {
  // Crear array de games para mostrar (siempre mostrar bestOf columnas)
  const totalGames = bestOf;
  
  // Construir scores de cada game
  const getGameScores = () => {
    const scores: Array<{ p1: number | null; p2: number | null; isCurrent: boolean; isPlayed: boolean }> = [];
    
    for (let i = 0; i < totalGames; i++) {
      const gameNum = i + 1;
      
      if (gameNum < currentGame && gameResults[i]) {
        // Game ya jugado
        scores.push({
          p1: gameResults[i].player1Score,
          p2: gameResults[i].player2Score,
          isCurrent: false,
          isPlayed: true,
        });
      } else if (gameNum === currentGame) {
        // Game actual
        scores.push({
          p1: player1Score,
          p2: player2Score,
          isCurrent: true,
          isPlayed: true,
        });
      } else {
        // Game futuro
        scores.push({
          p1: 0,
          p2: 0,
          isCurrent: false,
          isPlayed: false,
        });
      }
    }
    
    return scores;
  };
  
  const gameScores = getGameScores();
  
  return (
    <View style={styles.container}>
      {/* Header del torneo */}
      {tournamentName && (
        <View style={styles.tournamentHeader}>
          <Text style={styles.tournamentText}>{tournamentName}</Text>
        </View>
      )}
      
      {/* Fila del Jugador 1 */}
      <View style={styles.playerRow}>
        <View style={styles.nameContainer}>
          <Text style={styles.playerName} numberOfLines={1}>{player1Name}</Text>
        </View>
        <View style={styles.scoresContainer}>
          {gameScores.map((score, index) => (
            <View
              key={index}
              style={[
                styles.scoreBox,
                score.isCurrent && styles.scoreBoxCurrent,
                !score.isPlayed && styles.scoreBoxFuture,
                score.isPlayed && !score.isCurrent && 
                  (score.p1! > score.p2! ? styles.scoreBoxWon : styles.scoreBoxLost),
              ]}
            >
              <Text
                style={[
                  styles.scoreText,
                  score.isCurrent && styles.scoreTextCurrent,
                  !score.isPlayed && styles.scoreTextFuture,
                ]}
              >
                {score.p1}
              </Text>
            </View>
          ))}
          {/* Games ganados */}
          <View style={styles.gamesWonBox}>
            <Text style={styles.gamesWonText}>{player1Games}</Text>
          </View>
        </View>
      </View>
      
      {/* Separador */}
      <View style={styles.separator} />
      
      {/* Fila del Jugador 2 */}
      <View style={styles.playerRow}>
        <View style={styles.nameContainer}>
          <Text style={styles.playerName} numberOfLines={1}>{player2Name}</Text>
        </View>
        <View style={styles.scoresContainer}>
          {gameScores.map((score, index) => (
            <View
              key={index}
              style={[
                styles.scoreBox,
                score.isCurrent && styles.scoreBoxCurrent,
                !score.isPlayed && styles.scoreBoxFuture,
                score.isPlayed && !score.isCurrent && 
                  (score.p2! > score.p1! ? styles.scoreBoxWon : styles.scoreBoxLost),
              ]}
            >
              <Text
                style={[
                  styles.scoreText,
                  score.isCurrent && styles.scoreTextCurrent,
                  !score.isPlayed && styles.scoreTextFuture,
                ]}
              >
                {score.p2}
              </Text>
            </View>
          ))}
          {/* Games ganados */}
          <View style={styles.gamesWonBox}>
            <Text style={styles.gamesWonText}>{player2Games}</Text>
          </View>
        </View>
      </View>
      
      {/* Indicador de game actual */}
      <View style={styles.gameIndicator}>
        <Text style={styles.gameIndicatorText}>
          Game {currentGame} de {bestOf}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2C3E50',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
  },
  tournamentHeader: {
    backgroundColor: '#1A252F',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#34495E',
  },
  tournamentText: {
    color: '#ECF0F1',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  nameContainer: {
    flex: 1,
    paddingRight: 10,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoresContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBox: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#34495E',
    marginHorizontal: 2,
    borderRadius: 4,
  },
  scoreBoxCurrent: {
    backgroundColor: '#F1C40F',
  },
  scoreBoxWon: {
    backgroundColor: '#2980B9',
  },
  scoreBoxLost: {
    backgroundColor: '#34495E',
  },
  scoreBoxFuture: {
    backgroundColor: '#1A252F',
    opacity: 0.5,
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreTextCurrent: {
    color: '#000000',
  },
  scoreTextFuture: {
    color: '#7F8C8D',
  },
  gamesWonBox: {
    width: 40,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#F1C40F',
    paddingLeft: 8,
  },
  gamesWonText: {
    color: '#F1C40F',
    fontSize: 22,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: '#34495E',
    marginHorizontal: 12,
  },
  gameIndicator: {
    backgroundColor: '#1A252F',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  gameIndicatorText: {
    color: '#7F8C8D',
    fontSize: 11,
    textAlign: 'center',
  },
});
