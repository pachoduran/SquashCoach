import React from 'react';
import { View, StyleSheet, Pressable, Dimensions, Text } from 'react-native';
import Svg, { Rect, Line, Circle, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COURT_WIDTH = SCREEN_WIDTH - 40;
const COURT_HEIGHT = COURT_WIDTH * 1.5; // Cancha de squash es más larga que ancha

interface SquashCourtProps {
  onCourtPress?: (x: number, y: number) => void;
  points?: Array<{ x: number; y: number; isWin: boolean; number?: number }>;
  playerPosition?: { x: number; y: number };
  opponentPosition?: { x: number; y: number };
  showPositions?: boolean;
  player1Color?: string;
  player2Color?: string;
}

export const SquashCourt: React.FC<SquashCourtProps> = ({
  onCourtPress,
  points = [],
  playerPosition,
  opponentPosition,
  showPositions = false,
}) => {
  const handlePress = (event: any) => {
    if (onCourtPress) {
      const { locationX, locationY } = event.nativeEvent;
      // Normalizar coordenadas (0-1)
      const normalizedX = locationX / COURT_WIDTH;
      const normalizedY = locationY / COURT_HEIGHT;
      onCourtPress(normalizedX, normalizedY);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} style={styles.courtContainer}>
        <Svg width={COURT_WIDTH} height={COURT_HEIGHT}>
          {/* Piso de la cancha */}
          <Rect
            x="0"
            y="0"
            width={COURT_WIDTH}
            height={COURT_HEIGHT}
            fill="#D4A574"
            stroke="#8B6F47"
            strokeWidth="3"
          />
          
          {/* Línea de servicio frontal */}
          <Line
            x1="0"
            y1={COURT_HEIGHT * 0.3}
            x2={COURT_WIDTH}
            y2={COURT_HEIGHT * 0.3}
            stroke="#8B6F47"
            strokeWidth="2"
          />
          
          {/* Línea de media cancha */}
          <Line
            x1={COURT_WIDTH / 2}
            y1={COURT_HEIGHT * 0.3}
            x2={COURT_WIDTH / 2}
            y2={COURT_HEIGHT}
            stroke="#8B6F47"
            strokeWidth="2"
          />
          
          {/* Caja de servicio izquierda */}
          <Rect
            x={COURT_WIDTH * 0.1}
            y={COURT_HEIGHT * 0.5}
            width={COURT_WIDTH * 0.3}
            height={COURT_HEIGHT * 0.35}
            fill="none"
            stroke="#8B6F47"
            strokeWidth="2"
          />
          
          {/* Caja de servicio derecha */}
          <Rect
            x={COURT_WIDTH * 0.6}
            y={COURT_HEIGHT * 0.5}
            width={COURT_WIDTH * 0.3}
            height={COURT_HEIGHT * 0.35}
            fill="none"
            stroke="#8B6F47"
            strokeWidth="2"
          />
          
          {/* Línea T */}
          <Line
            x1="0"
            y1={COURT_HEIGHT * 0.5}
            x2={COURT_WIDTH}
            y2={COURT_HEIGHT * 0.5}
            stroke="#8B6F47"
            strokeWidth="2"
          />
          
          {/* Puntos marcados */}
          {points.map((point, index) => (
            <Circle
              key={index}
              cx={point.x * COURT_WIDTH}
              cy={point.y * COURT_HEIGHT}
              r="6"
              fill={point.isWin ? '#4CAF50' : '#F44336'}
              opacity="0.7"
            />
          ))}
          
          {/* Posición del jugador */}
          {showPositions && playerPosition && (
            <Circle
              cx={playerPosition.x * COURT_WIDTH}
              cy={playerPosition.y * COURT_HEIGHT}
              r="12"
              fill="#2196F3"
              opacity="0.8"
            />
          )}
          
          {/* Posición del oponente */}
          {showPositions && opponentPosition && (
            <Circle
              cx={opponentPosition.x * COURT_WIDTH}
              cy={opponentPosition.y * COURT_HEIGHT}
              r="12"
              fill="#FF9800"
              opacity="0.8"
            />
          )}
        </Svg>
      </Pressable>
      
      {/* Leyenda de la pared frontal */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#8B6F47' }]} />
          <Text style={styles.legendText}>Pared Frontal</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
  },
  courtContainer: {
    backgroundColor: '#F5E6D3',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  legendContainer: {
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
});