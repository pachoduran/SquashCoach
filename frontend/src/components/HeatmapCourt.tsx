import React from 'react';
import { View, StyleSheet, Dimensions, Image, Text } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COURT_WIDTH = SCREEN_WIDTH - 80;
const COURT_HEIGHT = COURT_WIDTH * 1.2;

// Dividir la cancha en una cuadrícula 4x6 para el heatmap
const GRID_COLS = 4;
const GRID_ROWS = 6;
const CELL_WIDTH = COURT_WIDTH / GRID_COLS;
const CELL_HEIGHT = COURT_HEIGHT / GRID_ROWS;

interface HeatmapCourtProps {
  points: Array<{ x: number; y: number }>;
  color?: string;
}

export const HeatmapCourt: React.FC<HeatmapCourtProps> = ({
  points,
  color = '#2196F3',
}) => {
  // Calcular densidad de puntos en cada celda
  const calculateHeatmap = () => {
    const grid: number[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(0));
    
    points.forEach(point => {
      const col = Math.min(Math.floor(point.x * GRID_COLS), GRID_COLS - 1);
      const row = Math.min(Math.floor(point.y * GRID_ROWS), GRID_ROWS - 1);
      grid[row][col]++;
    });
    
    return grid;
  };

  const heatmapData = calculateHeatmap();
  const maxValue = Math.max(...heatmapData.flat(), 1);

  // Función para obtener el color con opacidad basada en la intensidad
  const getOpacity = (value: number) => {
    if (value === 0) return 0;
    return 0.2 + (value / maxValue) * 0.7; // Rango de 0.2 a 0.9
  };

  // Convertir color hex a RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 33, g: 150, b: 243 };
  };

  const rgb = hexToRgb(color);

  return (
    <View style={styles.container}>
      <View style={styles.courtContainer}>
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
        
        {/* SVG con el heatmap */}
        <Svg width={COURT_WIDTH} height={COURT_HEIGHT}>
          {heatmapData.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              if (value === 0) return null;
              
              const opacity = getOpacity(value);
              
              return (
                <React.Fragment key={`${rowIndex}-${colIndex}`}>
                  <Rect
                    x={colIndex * CELL_WIDTH}
                    y={rowIndex * CELL_HEIGHT}
                    width={CELL_WIDTH}
                    height={CELL_HEIGHT}
                    fill={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`}
                    rx={4}
                    ry={4}
                  />
                  {value > 0 && (
                    <SvgText
                      x={colIndex * CELL_WIDTH + CELL_WIDTH / 2}
                      y={rowIndex * CELL_HEIGHT + CELL_HEIGHT / 2 + 5}
                      fontSize="14"
                      fontWeight="bold"
                      fill="#FFF"
                      textAnchor="middle"
                      opacity={opacity > 0.4 ? 1 : 0}
                    >
                      {value}
                    </SvgText>
                  )}
                </React.Fragment>
              );
            })
          )}
        </Svg>
      </View>
      
      {/* Leyenda de intensidad */}
      <View style={styles.legend}>
        <View style={styles.legendGradient}>
          <View style={[styles.legendBlock, { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)` }]} />
          <View style={[styles.legendBlock, { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)` }]} />
          <View style={[styles.legendBlock, { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)` }]} />
          <View style={[styles.legendBlock, { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)` }]} />
        </View>
        <View style={styles.legendLabels}>
          <Text style={styles.legendText}>Menos</Text>
          <Text style={styles.legendText}>Más</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  courtContainer: {
    backgroundColor: '#F5E6D3',
    borderRadius: 6,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  legend: {
    marginTop: 10,
    alignItems: 'center',
  },
  legendGradient: {
    flexDirection: 'row',
    gap: 2,
  },
  legendBlock: {
    width: 30,
    height: 12,
    borderRadius: 2,
  },
  legendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 126,
    marginTop: 2,
  },
  legendText: {
    fontSize: 10,
    color: '#999',
  },
});
