export interface PetGazeDirection {
  angle: number;
  facing: "left" | "right";
}

export interface GazeBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function centreOf(box: GazeBox): { x: number; y: number } {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

export function gazeAngleBetween(from: GazeBox, to: GazeBox): PetGazeDirection {
  const origin = centreOf(from);
  const target = centreOf(to);
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;

  return { angle, facing: dx < 0 ? "left" : "right" };
}

export function gazeDistance(from: GazeBox, to: GazeBox): number {
  const origin = centreOf(from);
  const target = centreOf(to);

  return Math.hypot(target.x - origin.x, target.y - origin.y);
}
