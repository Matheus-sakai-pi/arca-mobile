export type JourneyPosition = 'center' | 'left' | 'right';
const positions: readonly JourneyPosition[] = ['center', 'left', 'right', 'center', 'left', 'right'];
export const JOURNEY_CONNECTOR_HEIGHT = 36;

export function journeyGeometry(width: number, index: number) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isInteger(index) || index < 0) throw new Error('Dimensões da trilha inválidas.');
  const position = positions[index % positions.length]!;
  const clusterWidth = Math.min(width, Math.max(144, Math.min(180, width / 2)));
  const centerX = position === 'left' ? clusterWidth / 2 : position === 'right' ? width - clusterWidth / 2 : width / 2;
  return { position, clusterWidth, centerX };
}

export function journeyConnector(width: number, index: number): string {
  const start = journeyGeometry(width, index).centerX;
  const end = journeyGeometry(width, index + 1).centerX;
  const middle = JOURNEY_CONNECTOR_HEIGHT / 2;
  return `M ${start} 0 C ${start} ${middle}, ${end} ${middle}, ${end} ${JOURNEY_CONNECTOR_HEIGHT}`;
}
