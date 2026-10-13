import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { EQUAL_EARTH_EXTENT, projectEqualEarth } from "@ngriffin_uk/polychat-utility-core";

const SOURCE_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json";
const WIDTH = 1000;
const SCALE = WIDTH / 2 / EQUAL_EARTH_EXTENT.x;
const HEIGHT = Math.round(2 * EQUAL_EARTH_EXTENT.y * SCALE);
const ANTIMERIDIAN_JUMP = 180;

function decodeArcs(topology) {
  const [scaleX, scaleY] = topology.transform.scale;
  const [translateX, translateY] = topology.transform.translate;

  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;

    return arc.map(([deltaX, deltaY]) => {
      x += deltaX;
      y += deltaY;

      return [x * scaleX + translateX, y * scaleY + translateY];
    });
  });
}

function ringCoordinates(ring, arcs) {
  const points = [];

  for (const index of ring) {
    const arc = index >= 0 ? arcs[index] : [...arcs[~index]].reverse();

    points.push(...(points.length > 0 ? arc.slice(1) : arc));
  }

  return points;
}

function toSvg([lng, lat]) {
  const { x, y } = projectEqualEarth({ lat, lng });

  return `${((x + EQUAL_EARTH_EXTENT.x) * SCALE).toFixed(1)} ${((EQUAL_EARTH_EXTENT.y - y) * SCALE).toFixed(1)}`;
}

function ringPath(points) {
  let path = "";
  let previous = null;

  for (const point of points) {
    const jumped = previous && Math.abs(point[0] - previous[0]) > ANTIMERIDIAN_JUMP;

    path += `${path === "" || jumped ? "M" : "L"}${toSvg(point)}`;
    previous = point;
  }

  return `${path}Z`;
}

const topology = await (await fetch(SOURCE_URL)).json();
const arcs = decodeArcs(topology);
const polygons = topology.objects.land.geometries.flatMap((geometry) =>
  geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs,
);
const path = polygons
  .flatMap((polygon) => polygon.map((ring) => ringPath(ringCoordinates(ring, arcs))))
  .join("");
const output = fileURLToPath(
  new URL("../../component-shell/src/Benchmarks/geo/world-outline.ts", import.meta.url),
);

await writeFile(
  output,
  `export const WORLD_OUTLINE = {\n  width: ${WIDTH},\n  height: ${HEIGHT},\n  scale: ${SCALE},\n  path: "${path}",\n} as const;\n`,
);
console.log(`Wrote ${path.length} characters`);
