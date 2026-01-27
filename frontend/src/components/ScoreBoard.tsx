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
      
      <View style={styles.mainRow}>
        {/* Cuadro Jugador 1 - Izquierda */}
        <View style={[
          styles.playerBox,
          { borderColor: player1Color, borderWidth: 2 }
        ]}>
          <View style={[styles.colorIndicator, { backgroundColor: player1Color }]} />
          <Text style={styles.playerNameSmall} numberOfLines={1}>
            {player1Name}
          </Text>
          <Text style={styles.gamesSmall}>{player1Games}</Text>
        </View>
        
        {/* Centro - Puntos grandes */}
        <View style={styles.centerSection}>
          <View style={styles.pointsRow}>
            <Text style={[styles.pointsHuge, { color: player1Color }]}>{player1Score}</Text>
            <Text style={styles.pointsSeparator}>-</Text>
            <Text style={[styles.pointsHuge, { color: player2Color }]}>{player2Score}</Text>
          </View>
          <Text style={styles.gamesLabel}>
            Games: {player1Games} - {player2Games}
          </Text>
        </View>
        
        {/* Cuadro Jugador 2 - Derecha */}
        <View style={[
          styles.playerBox,
          { borderColor: player2Color, borderWidth: 2 }
        ]}>
          <View style={[styles.colorIndicator, { backgroundColor: player2Color }]} />
          <Text style={styles.playerNameSmall} numberOfLines={1}>
            {player2Name}
          </Text>
          <Text style={styles.gamesSmall}>{player2Games}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginBottom: 12,
  },
  gameText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  pointsOuterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pointSection: {
    minWidth: 70,
    alignItems: 'center',
  },
  pointsLarge: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  pointsSeparator: {
    fontSize: 36,
    color: '#999',
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  gamesContainer: {
    backgroundColor: '#1E3A5F',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerSection: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  colorIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  playerName: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
    marginBottom: 6,
  },
  gamesLabel: {
    fontSize: 10,
    color: '#B0BEC5',
    marginBottom: 4,
  },
  gamesScore: {
    fontSize: 36,
    color: '#FFF',
    fontWeight: 'bold',
  },
  separator: {
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  separatorText: {
    fontSize: 24,
    color: '#B0BEC5',
    fontWeight: 'bold',
  },
});