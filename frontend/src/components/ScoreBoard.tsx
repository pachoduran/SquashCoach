import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ScoreBoardProps {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  player1Games: number;
  player2Games: number;
  currentGame: number;
  isPlayer1My: boolean;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  player1Games,
  player2Games,
  currentGame,
  isPlayer1My,
}) => {
  const player1Color = '#2196F3';
  const player2Color = '#FF5722';
  
  return (
    <View style={styles.container}>
      <Text style={styles.gameText}>Game {currentGame}</Text>
      
      <View style={styles.scoreContainer}>
        {/* Jugador 1 */}
        <View style={[
          styles.playerSection,
          { borderColor: player1Color, borderWidth: 2 }
        ]}>
          <View style={[styles.colorIndicator, { backgroundColor: player1Color }]} />
          <Text style={styles.playerName} numberOfLines={1}>
            {player1Name} {isPlayer1My && '(Yo)'}
          </Text>
          <Text style={styles.gamesText}>Games: {player1Games}</Text>
          <Text style={styles.scoreText}>{player1Score}</Text>
        </View>
        
        {/* Separador */}
        <View style={styles.separator}>
          <Text style={styles.separatorText}>-</Text>
        </View>
        
        {/* Jugador 2 */}
        <View style={[
          styles.playerSection,
          { borderColor: player2Color, borderWidth: 2 }
        ]}>
          <View style={[styles.colorIndicator, { backgroundColor: player2Color }]} />
          <Text style={styles.playerName} numberOfLines={1}>
            {player2Name} {!isPlayer1My && '(Yo)'}
          </Text>
          <Text style={styles.gamesText}>Games: {player2Games}</Text>
          <Text style={styles.scoreText}>{player2Score}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E3A5F',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  gameText: {
    fontSize: 13,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerSection: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  colorIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  myPlayerSection: {
    backgroundColor: 'rgba(33, 150, 243, 0.3)',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  playerName: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  gamesText: {
    fontSize: 10,
    color: '#B0BEC5',
    marginBottom: 6,
  },
  scoreText: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: 'bold',
  },
  separator: {
    paddingHorizontal: 15,
  },
  separatorText: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: 'bold',
  },
});