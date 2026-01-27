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
  player1Color = '#2196F3',
  player2Color = '#FF5722',
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
          {/* Piso de la cancha con textura */}
          <Rect
            x="0"
            y="0"
            width={COURT_WIDTH}
            height={COURT_HEIGHT}
            fill="#E8D5B5"
            stroke="#8B6F47"
            strokeWidth="4"
          />
          
          {/* Línea divisoria central (mitad de la cancha) */}
          <Line
            x1={COURT_WIDTH / 2}
            y1="0"
            x2={COURT_WIDTH / 2}
            y2={COURT_HEIGHT}
            stroke="#8B6F47"
            strokeWidth="3"
            strokeDasharray="10,5"
            opacity="0.4"
          />
          
          {/* Línea de servicio frontal (más cerca de la pared) */}
          <Line
            x1="0"
            y1={COURT_HEIGHT * 0.25}
            x2={COURT_WIDTH}
            y2={COURT_HEIGHT * 0.25}
            stroke="#8B6F47"
            strokeWidth="2"
          />
          
          {/* Línea de media cancha (horizontal) */}
          <Line
            x1={COURT_WIDTH / 2}
            y1={COURT_HEIGHT * 0.25}
            x2={COURT_WIDTH / 2}
            y2={COURT_HEIGHT}
            stroke="#8B6F47"
            strokeWidth="2"
          />
          
          {/* Caja de servicio izquierda */}
          <Rect
            x={COURT_WIDTH * 0.05}
            y={COURT_HEIGHT * 0.55}
            width={COURT_WIDTH * 0.4}
            height={COURT_HEIGHT * 0.35}
            fill="none"
            stroke="#8B6F47"
            strokeWidth="2"
          />
          
          {/* Caja de servicio derecha */}
          <Rect
            x={COURT_WIDTH * 0.55}
            y={COURT_HEIGHT * 0.55}
            width={COURT_WIDTH * 0.4}
            height={COURT_HEIGHT * 0.35}
            fill="none"
            stroke="#8B6F47"
            strokeWidth="2"
          />
          
          {/* Línea T (horizontal en el fondo) */}
          <Line
            x1="0"
            y1={COURT_HEIGHT * 0.55}
            x2={COURT_WIDTH}
            y2={COURT_HEIGHT * 0.55}
            stroke="#8B6F47"
            strokeWidth="2"
          />
          
          {/* Texto "PARED FRONTAL" en la parte superior */}
          <SvgText
            x={COURT_WIDTH / 2}
            y={COURT_HEIGHT * 0.12}
            fontSize="14"
            fontWeight="bold"
            fill="#8B6F47"
            textAnchor="middle"
          >
            PARED FRONTAL
          </SvgText>
          
          {/* Puntos marcados con números */}
          {points.map((point, index) => (
            <React.Fragment key={index}>
              <Circle
                cx={point.x * COURT_WIDTH}
                cy={point.y * COURT_HEIGHT}
                r="14"
                fill={point.isWin ? player1Color : player2Color}
                opacity="0.8"
              />
              <SvgText
                x={point.x * COURT_WIDTH}
                y={point.y * COURT_HEIGHT + 5}
                fontSize="12"
                fontWeight="bold"
                fill="#FFF"
                textAnchor="middle"
              >
                {point.number || index + 1}
              </SvgText>
            </React.Fragment>
          ))}
          
          {/* Posición del jugador */}
          {showPositions && playerPosition && (
            <>
              <Circle
                cx={playerPosition.x * COURT_WIDTH}
                cy={playerPosition.y * COURT_HEIGHT}
                r="16"
                fill={player1Color}
                opacity="0.6"
              />
              <SvgText
                x={playerPosition.x * COURT_WIDTH}
                y={playerPosition.y * COURT_HEIGHT + 5}
                fontSize="12"
                fontWeight="bold"
                fill="#FFF"
                textAnchor="middle"
              >
                YO
              </SvgText>
            </>
          )}
          
          {/* Posición del oponente */}
          {showPositions && opponentPosition && (
            <>
              <Circle
                cx={opponentPosition.x * COURT_WIDTH}
                cy={opponentPosition.y * COURT_HEIGHT}
                r="16"
                fill={player2Color}
                opacity="0.6"
              />
              <SvgText
                x={opponentPosition.x * COURT_WIDTH}
                y={opponentPosition.y * COURT_HEIGHT + 5}
                fontSize="11"
                fontWeight="bold"
                fill="#FFF"
                textAnchor="middle"
              >
                RIV
              </SvgText>
            </>
          )}
        </Svg>
      </Pressable>
      
      {/* Leyenda */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: player1Color }]} />
          <Text style={styles.legendText}>Mi jugador</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: player2Color }]} />
          <Text style={styles.legendText}>Oponente</Text>
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