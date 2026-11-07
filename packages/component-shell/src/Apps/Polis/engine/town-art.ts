import {
  BUILDING_FACTORY,
  BUILDING_FARM,
  BUILDING_FLATS,
  BUILDING_HALL,
  BUILDING_HOSPITAL,
  BUILDING_HOUSE,
  BUILDING_OFFICE,
  BUILDING_PARK,
  BUILDING_PLAZA,
  BUILDING_SCHOOL,
  BUILDING_SHOP,
  BUILDING_TERRACE,
  ROAD_WIDTH,
  RIVER_HEIGHT,
  hash32,
  type Town,
} from "@ngriffin_uk/polychat-library-polis";

type Context = OffscreenCanvasRenderingContext2D;

const ROOFS = ["#c8553d", "#d98e32", "#5b7fa6", "#7a6aa8", "#3f8f7a", "#b5546e", "#8c6e4f"];
const SHOP_AWNINGS = ["#d9483b", "#e0a030", "#2f8f83", "#3b6fb5", "#b24a8f"];
const GRASS = "#9ccb7c";
const GRASS_DARK = "#8fc070";
const LOT = "#b2d696";
const ROAD = "#55606b";
const ROAD_EDGE = "#6b7682";
const ROAD_LINE = "#d8d2b8";
const WATER = "#4fb0c6";
const WATER_LIGHT = "#7cc9d8";
const PATH = "#e7dcc0";
const WALL = "#f4ecd8";
const SHADOW = "rgba(30, 40, 30, 0.22)";

function rect(context: Context, color: string, x: number, y: number, w: number, h: number): void {
  context.fillStyle = color;
  context.fillRect(x, y, w, h);
}

function tree(context: Context, x: number, y: number, size: number, tone: number): void {
  rect(context, "rgba(30,40,30,0.18)", x - size * 0.3, y + size * 0.5, size * 1.1, size * 0.35);
  context.fillStyle = tone % 2 === 0 ? "#4f9a55" : "#5fae5c";
  context.beginPath();
  context.arc(x, y, size * 0.62, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#7cc66e";
  context.beginPath();
  context.arc(x - size * 0.16, y - size * 0.18, size * 0.26, 0, Math.PI * 2);
  context.fill();
}

function windows(
  context: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  step: number,
  color: string,
): void {
  context.fillStyle = color;

  for (let wy = y; wy < y + h - 1; wy += step) {
    for (let wx = x; wx < x + w - 1; wx += step) {
      context.fillRect(wx, wy, step * 0.5, step * 0.5);
    }
  }
}

function drawHouse(
  context: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: number,
): void {
  const bodyW = w * 0.8;
  const bodyH = h * 0.62;
  const bx = x + (w - bodyW) / 2;
  const by = y + h * 0.26;

  rect(context, SHADOW, bx + 1, by + 1.5, bodyW, bodyH);
  rect(context, WALL, bx, by, bodyW, bodyH);
  rect(context, ROOFS[variant % ROOFS.length], bx - 0.6, by - h * 0.14, bodyW + 1.2, bodyH * 0.62);
  rect(context, "rgba(255,255,255,0.18)", bx - 0.6, by - h * 0.14, bodyW + 1.2, 1);
  rect(context, "#6d4c3a", bx + bodyW * 0.42, by + bodyH * 0.62, bodyW * 0.16, bodyH * 0.38);
}

function drawTerrace(
  context: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: number,
): void {
  const by = y + h * 0.2;
  const bodyH = h * 0.66;
  const unit = w / 5;

  rect(context, SHADOW, x + 1, by + 1.5, w, bodyH);

  for (let index = 0; index < 5; index += 1) {
    const ux = x + index * unit;

    rect(context, WALL, ux, by, unit - 0.4, bodyH);
    rect(
      context,
      ROOFS[(variant + index) % ROOFS.length],
      ux,
      by - h * 0.1,
      unit - 0.4,
      bodyH * 0.55,
    );
    rect(context, "#6d4c3a", ux + unit * 0.4, by + bodyH * 0.65, unit * 0.2, bodyH * 0.35);
  }
}

function drawFlats(
  context: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: number,
): void {
  const inset = 1.5;
  const bx = x + inset;
  const by = y + inset;
  const bw = w - inset * 2;
  const bh = h - inset * 2;

  rect(context, SHADOW, bx + 2, by + 2, bw, bh);
  rect(context, variant % 2 === 0 ? "#cfd8e3" : "#e3d6c6", bx, by, bw, bh);
  rect(context, variant % 3 === 0 ? "#6f8fb0" : "#8d97a8", bx, by, bw, 3);
  windows(context, bx + 2, by + 5, bw - 3, bh - 7, 3.4, "#5d7fa3");
}

function drawShop(
  context: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: number,
): void {
  rect(context, SHADOW, x + 1, y + 2, w, h - 2);
  rect(context, "#efe4cf", x, y + 1, w, h - 2);
  rect(context, "#b8a58a", x, y + 1, w, h * 0.34);
  rect(context, SHOP_AWNINGS[variant % SHOP_AWNINGS.length], x, y + h * 0.5, w, h * 0.13);
  rect(context, "#6c9dbc", x + w * 0.14, y + h * 0.65, w * 0.72, h * 0.22);
}

function drawOffice(
  context: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: number,
): void {
  rect(context, SHADOW, x + 2, y + 2, w, h);
  rect(context, variant % 2 === 0 ? "#b9c9d9" : "#a8bcc9", x, y, w, h);
  rect(context, "#7f94a8", x, y, w, 3);
  windows(context, x + 2, y + 5, w - 3, h - 7, 3, "#3f6d94");
}

function drawFactory(context: Context, x: number, y: number, w: number, h: number): void {
  rect(context, "#d9cfba", x, y, w, h);
  rect(context, SHADOW, x + w * 0.1 + 2, y + h * 0.3 + 2, w * 0.7, h * 0.56);
  rect(context, "#9aa3ad", x + w * 0.1, y + h * 0.3, w * 0.7, h * 0.56);

  for (let index = 0; index < 4; index += 1) {
    rect(context, "#7c8691", x + w * (0.12 + index * 0.17), y + h * 0.3, w * 0.09, h * 0.56);
  }

  rect(context, "#b45a3c", x + w * 0.84, y + h * 0.12, w * 0.06, h * 0.72);
  rect(context, "#f0ece2", x + w * 0.84, y + h * 0.2, w * 0.06, h * 0.06);
  rect(context, "#c49a3a", x + w * 0.14, y + h * 0.08, w * 0.3, h * 0.12);
}

function drawFarm(
  context: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: number,
): void {
  const crops = ["#d9c25a", "#b89fd6", "#7fb35a", "#d6a65a"];

  rect(context, crops[variant % crops.length], x, y, w, h);

  context.fillStyle = "rgba(90, 70, 30, 0.16)";

  for (let row = y + 3; row < y + h; row += 5) {
    context.fillRect(x, row, w, 1.2);
  }

  rect(context, SHADOW, x + w * 0.62 + 1, y + h * 0.66 + 1, w * 0.3, h * 0.24);
  rect(context, "#b5472f", x + w * 0.62, y + h * 0.66, w * 0.3, h * 0.24);
  rect(context, "#efe4cf", x + w * 0.72, y + h * 0.76, w * 0.1, h * 0.14);
}

function drawSchool(context: Context, x: number, y: number, w: number, h: number): void {
  rect(context, "#c9a24e", x, y + h * 0.56, w, h * 0.44);
  rect(context, "#e4cf8e", x + 2, y + h * 0.6, w - 4, h * 0.36);
  rect(context, SHADOW, x + 2, y + 2, w - 2, h * 0.5);
  rect(context, "#e8b24e", x, y, w, h * 0.5);
  rect(context, "#c8553d", x, y, w, 3);
  windows(context, x + 3, y + 6, w - 5, h * 0.36, 4, "#fdf6e3");
}

function drawHospital(context: Context, x: number, y: number, w: number, h: number): void {
  rect(context, SHADOW, x + 2, y + 2, w, h);
  rect(context, "#f6f3ee", x, y, w, h);
  rect(context, "#d9d3c8", x, y, w, 3);
  windows(context, x + 3, y + 6, w - 5, h - 9, 4, "#8db4cc");
  rect(context, "#d9483b", x + w / 2 - 6, y + h / 2 - 2, 12, 4);
  rect(context, "#d9483b", x + w / 2 - 2, y + h / 2 - 6, 4, 12);
}

function drawHall(context: Context, x: number, y: number, w: number, h: number): void {
  rect(context, SHADOW, x + 2, y + h * 0.2 + 2, w - 2, h * 0.7);
  rect(context, "#ece1c9", x + 1, y + h * 0.2, w - 2, h * 0.7);
  rect(context, "#5b7fa6", x + 1, y + h * 0.16, w - 2, h * 0.1);

  for (let index = 0; index < 5; index += 1) {
    rect(context, "#cfc0a2", x + 3 + (index * (w - 8)) / 4, y + h * 0.3, 2, h * 0.5);
  }

  rect(context, "#ece1c9", x + w / 2 - 4, y + 2, 8, h * 0.2);
  rect(context, "#3f5a78", x + w / 2 - 5, y, 10, 3);
  rect(context, "#fdf6e3", x + w / 2 - 2, y + 6, 4, 4);
}

function drawPlaza(context: Context, x: number, y: number, w: number, h: number): void {
  rect(context, "#ddd5c4", x, y, w, h);
  context.fillStyle = "#cfc6b2";

  for (let py = y; py < y + h; py += 6) {
    for (let px = x + ((py / 6) % 2) * 3; px < x + w; px += 6) {
      context.fillRect(px, py, 3, 3);
    }
  }

  context.fillStyle = "#b6ad99";
  context.beginPath();
  context.arc(x + w / 2, y + h / 2, 11, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = WATER_LIGHT;
  context.beginPath();
  context.arc(x + w / 2, y + h / 2, 8, 0, Math.PI * 2);
  context.fill();
}

function drawPark(
  context: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
): void {
  rect(context, "#8ec86f", x, y, w, h);
  rect(context, PATH, x, y + h / 2 - 1.5, w, 3);
  rect(context, PATH, x + w / 2 - 1.5, y, 3, h);

  if (seed % 2 === 0) {
    context.fillStyle = WATER;
    context.beginPath();
    context.ellipse(x + w * 0.74, y + h * 0.28, w * 0.13, h * 0.16, 0, 0, Math.PI * 2);
    context.fill();
  }

  for (let index = 0; index < 18; index += 1) {
    const hash = hash32(seed * 97 + index);
    const tx = x + 5 + ((hash % 1000) / 1000) * (w - 10);
    const ty = y + 5 + (((hash >>> 10) % 1000) / 1000) * (h - 10);

    if (Math.abs(tx - x - w / 2) > 6 && Math.abs(ty - y - h / 2) > 6) {
      tree(context, tx, ty, 5 + (hash % 3), index);
    }
  }
}

function drawLot(context: Context, x: number, y: number, w: number, h: number): void {
  rect(context, "#c9d6a0", x + 1, y + 1, w - 2, h - 2);
  rect(context, "#d7cfa8", x + 3, y + 3, w - 6, h - 6);
}

export function drawBuilding(context: Context, town: Town, building: number): void {
  const kind = town.kind[building];
  const x = town.x[building];
  const y = town.y[building];
  const w = town.w[building];
  const h = town.h[building];
  const variant = town.variant[building];
  const residential =
    kind === BUILDING_HOUSE || kind === BUILDING_TERRACE || kind === BUILDING_FLATS;

  rect(context, LOT, x - 1, y - 1, w + 2, h + 2);

  if (residential && town.builtHomes[building] === 0) {
    drawLot(context, x, y, w, h);

    return;
  }

  switch (kind) {
    case BUILDING_HOUSE:
      drawHouse(context, x, y, w, h, variant);
      break;
    case BUILDING_TERRACE:
      drawTerrace(context, x, y, w, h, variant);
      break;
    case BUILDING_FLATS:
      drawFlats(context, x, y, w, h, variant);
      break;
    case BUILDING_SHOP:
      drawShop(context, x, y, w, h, variant);
      break;
    case BUILDING_OFFICE:
      drawOffice(context, x, y, w, h, variant);
      break;
    case BUILDING_FACTORY:
      drawFactory(context, x, y, w, h);
      break;
    case BUILDING_FARM:
      drawFarm(context, x, y, w, h, variant);
      break;
    case BUILDING_SCHOOL:
      drawSchool(context, x, y, w, h);
      break;
    case BUILDING_HOSPITAL:
      drawHospital(context, x, y, w, h);
      break;
    case BUILDING_HALL:
      drawHall(context, x, y, w, h);
      break;
    case BUILDING_PLAZA:
      drawPlaza(context, x, y, w, h);
      break;
    case BUILDING_PARK:
      drawPark(context, x, y, w, h, variant + building);
      break;
    default:
      break;
  }
}

function drawLand(context: Context, town: Town): void {
  rect(context, GRASS, 0, 0, town.width, town.height);

  for (let index = 0; index < town.zones.length; index += 1) {
    const hash = hash32(index);

    rect(
      context,
      GRASS_DARK,
      town.blockX[index] + (hash % 40),
      town.blockY[index] + ((hash >>> 8) % 30),
      30 + (hash % 50),
      20 + ((hash >>> 16) % 30),
    );
  }
}

function drawRoads(context: Context, town: Town): void {
  for (const y of town.roadY) {
    rect(context, ROAD_EDGE, 0, y - ROAD_WIDTH / 2, town.width, ROAD_WIDTH);
    rect(context, ROAD, 0, y - ROAD_WIDTH / 2 + 1.5, town.width, ROAD_WIDTH - 3);

    for (let x = 0; x < town.width; x += 14) {
      rect(context, ROAD_LINE, x, y - 0.5, 7, 1);
    }
  }

  for (const x of town.roadX) {
    rect(context, ROAD_EDGE, x - ROAD_WIDTH / 2, 0, ROAD_WIDTH, town.height);
    rect(context, ROAD, x - ROAD_WIDTH / 2 + 1.5, 0, ROAD_WIDTH - 3, town.height);

    for (let y = 0; y < town.height; y += 14) {
      rect(context, ROAD_LINE, x - 0.5, y, 1, 7);
    }
  }
}

function drawRiver(context: Context, town: Town): void {
  const top = town.riverTop;

  rect(context, "#d8cfa6", 0, top, town.width, RIVER_HEIGHT);
  rect(context, WATER, 0, top + 4, town.width, RIVER_HEIGHT - 8);

  for (let x = 0; x < town.width; x += 26) {
    const hash = hash32(x);

    rect(context, WATER_LIGHT, x + (hash % 12), top + 8 + (hash % (RIVER_HEIGHT - 18)), 10, 1.5);
  }

  for (const x of town.roadX) {
    rect(context, "#7a6650", x - ROAD_WIDTH / 2 - 1, top, ROAD_WIDTH + 2, RIVER_HEIGHT);
    rect(context, ROAD, x - ROAD_WIDTH / 2 + 1.5, top, ROAD_WIDTH - 3, RIVER_HEIGHT);
  }
}

export function drawTown(context: Context, town: Town): void {
  drawLand(context, town);
  drawRoads(context, town);
  drawRiver(context, town);

  for (let building = 0; building < town.buildingCount; building += 1) {
    drawBuilding(context, town, building);
  }
}
