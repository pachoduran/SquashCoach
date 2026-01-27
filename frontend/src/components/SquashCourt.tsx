import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Dimensions, Text, Image, Animated } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  compact?: boolean;
}

// Componente animado para el punto seleccionado
const PulsingPoint: React.FC<{
  x: number;
  y: number;
  color: string;
  score?: string;
  courtWidth: number;
  courtHeight: number;
}> = ({ x, y, color, score, courtWidth, courtHeight }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.8,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: false,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const size = 50;

  return (
    <View
      style={{
        position: 'absolute',
        left: x * courtWidth - size/2,
        top: y * courtHeight - size/2,
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size/2,
          backgroundColor: color,
          opacity: opacityAnim,
          transform: [{ scale: pulseAnim }],
        }}
      />
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: '#FFD700',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#FFD700',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Text style={{ color: '#FFF', fontSize: 9, fontWeight: 'bold' }}>
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
  compact = false,
}) => {
  // Ajustar tamaño según modo compacto
  const COURT_WIDTH = compact ? SCREEN_WIDTH - 60 : SCREEN_WIDTH - 40;
  const COURT_HEIGHT = compact ? COURT_WIDTH * 1.2 : COURT_WIDTH * 1.5;
  
  const handlePress = (event: any) => {
    if (onCourtPress) {
      const { locationX, locationY } = event.nativeEvent;
      const normalizedX = locationX / COURT_WIDTH;
      const normalizedY = locationY / COURT_HEIGHT;
      onCourtPress(normalizedX, normalizedY);
    }
  };

  const selectedPoint = selectedPointIndex !== undefined ? points[selectedPointIndex] : null;
  const pointSize = compact ? 12 : 16;
  const fontSize = compact ? 8 : 10;

  return (
    <View style={styles.container}>
      <View style={[styles.courtContainer, compact && styles.courtContainerCompact]}>
        <Pressable onPress={handlePress} style={{ width: COURT_WIDTH, height: COURT_HEIGHT }}>
          <Image
            source={require('../../assets/squash-court.png')}
            style={{
              width: COURT_WIDTH,
              height: COURT_HEIGHT,
              position: 'absolute',
            }}
            resizeMode="cover"
          />
          
          <Svg width={COURT_WIDTH} height={COURT_HEIGHT} style={{ position: 'absolute' }}>
            {/* Puntos marcados con marcador */}
            {points.map((point, index) => {
              const isSelected = showSelectedHighlight && index === selectedPointIndex;
              if (isSelected) return null;
              
              return (
                <React.Fragment key={index}>
                  <Circle
                    cx={point.x * COURT_WIDTH}
                    cy={point.y * COURT_HEIGHT}
                    r={pointSize}
                    fill={point.isWin ? player1Color : player2Color}
                    opacity={showSelectedHighlight ? 0.35 : 0.85}
                  />
                  <SvgText
                    x={point.x * COURT_WIDTH}
                    y={point.y * COURT_HEIGHT + 3}
                    fontSize={fontSize}
                    fontWeight="bold"
                    fill="#FFF"
                    textAnchor="middle"
                    opacity={showSelectedHighlight ? 0.5 : 1}
                  >
                    {point.score || (index + 1)}
                  </SvgText>
                </React.Fragment>
              );
            })}
            
            {/* Posiciones de jugadores */}
            {showAllPositions && playerPositions.map((pos, index) => (
              <React.Fragment key={`pos-${index}`}>
                <Circle
                  cx={pos.x * COURT_WIDTH}
                  cy={pos.y * COURT_HEIGHT}
                  r={pointSize - 4}
                  fill={pos.isPlayer1 ? player1Color : player2Color}
                  opacity="0.6"
                  stroke="#FFF"
                  strokeWidth="2"
                />
              </React.Fragment>
            ))}
            
            {/* Posición temporal del jugador */}
            {showPositions && playerPosition && (
              <>
                <Circle
                  cx={playerPosition.x * COURT_WIDTH}
                  cy={playerPosition.y * COURT_HEIGHT}
                  r={pointSize}
                  fill={player1Color}
                  opacity="0.6"
                />
                <SvgText
                  x={playerPosition.x * COURT_WIDTH}
                  y={playerPosition.y * COURT_HEIGHT + 4}
                  fontSize={fontSize + 2}
                  fontWeight="bold"
                  fill="#FFF"
                  textAnchor="middle"
                >
                  YO
                </SvgText>
              </>
            )}
            
            {/* Posición temporal del oponente */}
            {showPositions && opponentPosition && (
              <>
                <Circle
                  cx={opponentPosition.x * COURT_WIDTH}
                  cy={opponentPosition.y * COURT_HEIGHT}
                  r={pointSize}
                  fill={player2Color}
                  opacity="0.6"
                />
                <SvgText
                  x={opponentPosition.x * COURT_WIDTH}
                  y={opponentPosition.y * COURT_HEIGHT + 4}
                  fontSize={fontSize + 1}
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
              courtWidth={COURT_WIDTH}
              courtHeight={COURT_HEIGHT}
            />
          )}
        </Pressable>
      </View>
      
      {/* Leyenda - solo si no es compacto */}
      {!compact && (
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
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
  courtContainerCompact: {
    padding: 6,
    borderRadius: 6,
  },
  legendContainer: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
});
