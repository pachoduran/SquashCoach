import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Dimensions, Text, Image, Animated } from 'react-native';
import Svg, { Rect, Line, Circle, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COURT_WIDTH = SCREEN_WIDTH - 40;
const COURT_HEIGHT = COURT_WIDTH * 1.5;

interface SquashCourtProps {
  onCourtPress?: (x: number, y: number) => void;
  points?: Array<{ x: number; y: number; isWin: boolean; score?: string; isSelected?: boolean }>;
  playerPosition?: { x: number; y: number };
  opponentPosition?: { x: number; y: number };
  showPositions?: boolean;
  player1Color?: string;
  player2Color?: string;
  playerPositions?: Array<{ x: number; y: number; isPlayer1: boolean; score: string }>;
  showAllPositions?: boolean;
  selectedPointIndex?: number;
  showSelectedHighlight?: boolean;
}

// Componente animado para el punto seleccionado
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const PulsingPoint: React.FC<{
  x: number;
  y: number;
  color: string;
  score?: string;
}> = ({ x, y, color, score }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 2,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: false,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View
      style={{
        position: 'absolute',
        left: x * COURT_WIDTH - 30,
        top: y * COURT_HEIGHT - 30,
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Círculo exterior pulsante */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: color,
          opacity: opacityAnim,
          transform: [{ scale: pulseAnim }],
        }}
      />
      {/* Círculo interior sólido */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: '#FFD700',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#FFD700',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 10,
          elevation: 10,
        }}
      >
        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: 'bold' }}>
          {score || '•'}
        </Text>
      </View>
    </View>
  );
};

export const SquashCourt: React.FC<SquashCourtProps> = ({
  onCourtPress,
  points = [],
  playerPosition,
  opponentPosition,
  showPositions = false,
  player1Color = '#2196F3',
  player2Color = '#FF5722',
  playerPositions = [],
  showAllPositions = false,
  selectedPointIndex,
  showSelectedHighlight = false,
}) => {
  const handlePress = (event: any) => {
    if (onCourtPress) {
      const { locationX, locationY } = event.nativeEvent;
      const normalizedX = locationX / COURT_WIDTH;
      const normalizedY = locationY / COURT_HEIGHT;
      onCourtPress(normalizedX, normalizedY);
    }
  };

  const selectedPoint = selectedPointIndex !== undefined ? points[selectedPointIndex] : null;

  return (
    <View style={styles.container}>
      <View style={styles.courtContainer}>
        <Pressable onPress={handlePress} style={{ width: COURT_WIDTH, height: COURT_HEIGHT }}>
          {/* Imagen de fondo de la cancha */}
          <Image
            source={require('../../assets/squash-court.png')}
            style={{
              width: COURT_WIDTH,
              height: COURT_HEIGHT,
              position: 'absolute',
            }}
            resizeMode="cover"
          />
          
          {/* SVG para los puntos */}
          <Svg width={COURT_WIDTH} height={COURT_HEIGHT} style={{ position: 'absolute' }}>
            {/* Puntos marcados (excepto el seleccionado) */}
            {points.map((point, index) => {
              const isSelected = showSelectedHighlight && index === selectedPointIndex;
              if (isSelected) return null; // El seleccionado se renderiza por separado
              
              return (
                <React.Fragment key={index}>
                  <Circle
                    cx={point.x * COURT_WIDTH}
                    cy={point.y * COURT_HEIGHT}
                    r="16"
                    fill={point.isWin ? player1Color : player2Color}
                    opacity={showSelectedHighlight ? 0.4 : 0.85}
                  />
                  <SvgText
                    x={point.x * COURT_WIDTH}
                    y={point.y * COURT_HEIGHT + 4}
                    fontSize="10"
                    fontWeight="bold"
                    fill="#FFF"
                    textAnchor="middle"
                    opacity={showSelectedHighlight ? 0.6 : 1}
                  >
                    {point.score || (index + 1)}
                  </SvgText>
                </React.Fragment>
              );
            })}
            
            {/* Mostrar todas las posiciones de jugadores */}
            {showAllPositions && playerPositions.map((pos, index) => (
              <React.Fragment key={`pos-${index}`}>
                <Circle
                  cx={pos.x * COURT_WIDTH}
                  cy={pos.y * COURT_HEIGHT}
                  r="12"
                  fill={pos.isPlayer1 ? player1Color : player2Color}
                  opacity="0.6"
                  stroke="#FFF"
                  strokeWidth="2"
                />
                <SvgText
                  x={pos.x * COURT_WIDTH}
                  y={pos.y * COURT_HEIGHT + 4}
                  fontSize="9"
                  fontWeight="bold"
                  fill="#FFF"
                  textAnchor="middle"
                >
                  {pos.score}
                </SvgText>
              </React.Fragment>
            ))}
            
            {/* Posición del jugador (temporal) */}
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
            
            {/* Posición del oponente (temporal) */}
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
          
          {/* Punto seleccionado con animación */}
          {showSelectedHighlight && selectedPoint && (
            <PulsingPoint
              x={selectedPoint.x}
              y={selectedPoint.y}
              color={selectedPoint.isWin ? player1Color : player2Color}
              score={selectedPoint.score}
            />
          )}
        </Pressable>
      </View>
      
      {/* Leyenda */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: player1Color }]} />
          <Text style={styles.legendText}>Mi Jugador</Text>
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
    marginVertical: 10,
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
    overflow: 'hidden',
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
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
});
