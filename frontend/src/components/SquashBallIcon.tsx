import React from 'react';
import Svg, { Circle } from 'react-native-svg';

interface SquashBallIconProps {
  size?: number;
  color?: string;
}

export const SquashBallIcon: React.FC<SquashBallIconProps> = ({ 
  size = 64, 
  color = '#CCC' 
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Pelota principal */}
      <Circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke={color}
        strokeWidth="3"
      />
      {/* Punto 1 - arriba izquierda */}
      <Circle
        cx="35"
        cy="35"
        r="6"
        fill={color}
      />
      {/* Punto 2 - abajo derecha */}
      <Circle
        cx="65"
        cy="65"
        r="6"
        fill={color}
      />
    </Svg>
  );
};

export default SquashBallIcon;
