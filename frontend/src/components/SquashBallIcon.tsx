import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';

interface SquashBallIconProps {
  size?: number;
  color?: string;
}

/**
 * Pelota de squash: círculo outline con 2 puntos pequeños alineados
 * hacia un lado e inclinados ~50° respecto al centro de la pelota.
 */
export const SquashBallIcon: React.FC<SquashBallIconProps> = ({
  size = 28,
  color = '#FFF',
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke={color}
        strokeWidth="6"
      />
      {/* Dos puntitos alineados hacia un lado e inclinados -50° */}
      <G rotation={-50} origin="50, 50">
        <Circle cx="50" cy="22" r="6" fill={color} />
        <Circle cx="50" cy="36" r="6" fill={color} />
      </G>
    </Svg>
  );
};

export default SquashBallIcon;
