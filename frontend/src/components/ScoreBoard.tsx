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
        {/* Cuadro Jugador 1 - Izquierda - PUNTOS */}
        <View style={[
          styles.playerBox,
          { borderColor: player1Color, borderWidth: 2 }
        ]}>
          <View style={[styles.colorIndicator, { backgroundColor: player1Color }]} />
          <Text style={styles.playerNameSmall} numberOfLines={1}>
            {player1Name}
          </Text>
          <Text style={styles.pointsInBox}>{player1Score}</Text>
        </View>
        
        {/* Centro - GAMES grandes */}
        <View style={styles.centerSection}>
          <View style={styles.gamesRow}>
            <Text style={[styles.gamesHuge, { color: player1Color }]}>{player1Games}</Text>
            <Text style={styles.gamesSeparator}>-</Text>
            <Text style={[styles.gamesHuge, { color: player2Color }]}>{player2Games}</Text>
          </View>
          <Text style={styles.gamesLabelCenter}>Games</Text>
        </View>
        
        {/* Cuadro Jugador 2 - Derecha - PUNTOS */}
        <View style={[
          styles.playerBox,
          { borderColor: player2Color, borderWidth: 2 }
        ]}>
          <View style={[styles.colorIndicator, { backgroundColor: player2Color }]} />
          <Text style={styles.playerNameSmall} numberOfLines={1}>
            {player2Name}
          </Text>
          <Text style={styles.pointsInBox}>{player2Score}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  gameText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerBox: {
    width: 70,
    backgroundColor: 'rgba(30, 58, 95, 0.8)',
    borderRadius: 8,
    padding: 6,
    alignItems: 'center',
    position: 'relative',
  },
  colorIndicator: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playerNameSmall: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  gamesSmall: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: 'bold',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsHuge: {
    fontSize: 48,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  pointsSeparator: {
    fontSize: 36,
    color: '#999',
    fontWeight: 'bold',
  },
  gamesLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    fontWeight: '600',
  },
});