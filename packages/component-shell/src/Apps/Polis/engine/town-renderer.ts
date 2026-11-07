import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  STATUS_CHILD,
  STATUS_EMPLOYED,
  STATUS_RETIRED,
  STATUS_STUDENT,
  hash32,
  nearestRoad,
  personAccount,
  type Town,
  type World,
} from "@ngriffin_uk/polychat-library-polis";

import type { PolisMapMode } from "./protocol.js";
import { drawBuilding, drawTown } from "./town-art.js";

type Context = OffscreenCanvasRenderingContext2D;

const GROUP_COLORS = ["#2b3a55", "#f2b632", "#7d5ba6", "#d9483b", "#e8e4d8"];
const GROUP_WORKER = 0;
const GROUP_STUDENT = 1;
const GROUP_RETIRED = 2;
const GROUP_ALERT = 3;
const GROUP_OTHER = 4;
const CAR_COLORS = ["#d9483b", "#f4ecd8", "#3b6fb5", "#2f8f83", "#e0a030"];
const CAR_TRIP_LENGTH = 340;
const NIGHT_TINT = "rgba(24, 28, 70, ";
const MIN_ZOOM_MARGIN = 0.92;
const MAX_ZOOM = 9;
const OVERLAY_REFRESH_MS = 1200;
const FOLLOW_EASING = 0.18;

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface Point {
  x: number;
  y: number;
}

interface OverlayRange {
  mode: PolisMapMode;
  low: number;
  high: number;
}

function routePoint(town: Town, from: Point, to: Point, progress: number, out: Point): void {
  const roadY = nearestRoad(town.roadY, from.y);
  const roadX = nearestRoad(town.roadX, to.x);
  const leg1 = Math.abs(roadY - from.y);
  const leg2 = Math.abs(roadX - from.x);
  const leg3 = Math.abs(to.y - roadY);
  const leg4 = Math.abs(to.x - roadX);
  let remaining = progress * (leg1 + leg2 + leg3 + leg4);

  if (remaining <= leg1) {
    out.x = from.x;
    out.y = from.y + Math.sign(roadY - from.y) * remaining;

    return;
  }

  remaining -= leg1;

  if (remaining <= leg2) {
    out.x = from.x + Math.sign(roadX - from.x) * remaining;
    out.y = roadY;

    return;
  }

  remaining -= leg2;

  if (remaining <= leg3) {
    out.x = roadX;
    out.y = roadY + Math.sign(to.y - roadY) * remaining;

    return;
  }

  out.x = roadX + Math.sign(to.x - roadX) * (remaining - leg3);
  out.y = to.y;
}

export class TownRenderer {
  mode: PolisMapMode = "town";

  private context: Context;
  private canvas: OffscreenCanvas;
  private base: OffscreenCanvas | null = null;
  private baseContext: Context | null = null;
  private world: World | null = null;
  private view: Viewport = { x: 0, y: 0, scale: 1 };
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private overlay: Float32Array | null = null;
  private overlayCounts: Float32Array | null = null;
  private overlayAge = 0;
  private overlayRange: OverlayRange = { mode: "town", low: 0, high: 1 };
  private from: Point = { x: 0, y: 0 };
  private to: Point = { x: 0, y: 0 };
  private point: Point = { x: 0, y: 0 };
  private visibleIds = new Int32Array(0);
  private visibleX = new Float32Array(0);
  private visibleY = new Float32Array(0);
  private visibleCount = 0;
  private groupX: Float32Array[] = [];
  private groupY: Float32Array[] = [];
  private counts = new Int32Array(GROUP_COLORS.length);
  private tracking = false;
  private followedPoint: Point | null = null;

  constructor(canvas: OffscreenCanvas) {
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("This browser cannot draw the town");
    }

    this.canvas = canvas;
    this.context = context;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.canvas.width = Math.max(1, Math.round(width * pixelRatio));
    this.canvas.height = Math.max(1, Math.round(height * pixelRatio));
    this.clampView();
  }

  attach(world: World): void {
    const { town } = world;
    const baseScale = town.width > 2200 ? 1.5 : 2;
    const keepView = this.world !== null && this.world.town.width === town.width;

    this.world = world;
    this.overlay = new Float32Array(town.zones.length);
    this.overlayCounts = new Float32Array(town.zones.length);
    this.visibleIds = new Int32Array(world.capacity);
    this.visibleX = new Float32Array(world.capacity);
    this.visibleY = new Float32Array(world.capacity);
    this.groupX = GROUP_COLORS.map(() => new Float32Array(world.capacity));
    this.groupY = GROUP_COLORS.map(() => new Float32Array(world.capacity));
    this.base = new OffscreenCanvas(
      Math.ceil(town.width * baseScale),
      Math.ceil(town.height * baseScale),
    );
    this.baseContext = this.base.getContext("2d", { alpha: false });

    if (this.baseContext) {
      this.baseContext.scale(baseScale, baseScale);
      drawTown(this.baseContext, town);
    }

    world.dirtyBuildings.length = 0;

    if (!keepView) {
      this.fitTown(town);
    }
  }

  private fitTown(town: Town): void {
    const scale = Math.max(this.width / town.width, this.height / town.height);

    this.view = {
      scale,
      x: town.width / 2 - this.width / scale / 2,
      y: town.height / 2 - this.height / scale / 2,
    };
  }

  private minScale(): number {
    const town = this.world?.town;

    return town
      ? Math.min(this.width / town.width, this.height / town.height) * MIN_ZOOM_MARGIN
      : 0.1;
  }

  private clampView(): void {
    const town = this.world?.town;

    if (!town) {
      return;
    }

    const { view } = this;
    const visibleWidth = this.width / view.scale;
    const visibleHeight = this.height / view.scale;

    view.x =
      visibleWidth >= town.width
        ? (town.width - visibleWidth) / 2
        : Math.min(town.width - visibleWidth, Math.max(0, view.x));
    view.y =
      visibleHeight >= town.height
        ? (town.height - visibleHeight) / 2
        : Math.min(town.height - visibleHeight, Math.max(0, view.y));
  }

  pan(dx: number, dy: number): void {
    this.tracking = false;
    this.view.x -= dx / this.view.scale;
    this.view.y -= dy / this.view.scale;
    this.clampView();
  }

  zoom(factor: number, x: number, y: number): void {
    const { view } = this;
    const worldX = view.x + x / view.scale;
    const worldY = view.y + y / view.scale;

    view.scale = Math.min(MAX_ZOOM, Math.max(this.minScale(), view.scale * factor));
    view.x = worldX - x / view.scale;
    view.y = worldY - y / view.scale;
    this.clampView();
  }

  track(): void {
    this.tracking = true;
    this.view.scale = Math.max(this.view.scale, 4);
  }

  private followCamera(): void {
    const point = this.followedPoint;

    if (!this.tracking || !point) {
      return;
    }

    const targetX = point.x - this.width / this.view.scale / 2;
    const targetY = point.y - this.height / this.view.scale / 2;

    this.view.x += (targetX - this.view.x) * FOLLOW_EASING;
    this.view.y += (targetY - this.view.y) * FOLLOW_EASING;
    this.clampView();
  }

  personAt(x: number, y: number): number {
    const worldX = this.view.x + x / this.view.scale;
    const worldY = this.view.y + y / this.view.scale;
    const radius = Math.max(4, 14 / this.view.scale);
    let best = -1;
    let bestDistance = radius * radius;

    for (let index = 0; index < this.visibleCount; index += 1) {
      const dx = this.visibleX[index] - worldX;
      const dy = this.visibleY[index] - worldY;
      const distance = dx * dx + dy * dy;

      if (distance < bestDistance) {
        best = this.visibleIds[index];
        bestDistance = distance;
      }
    }

    return best !== -1 ? best : this.residentNear(worldX, worldY);
  }

  private residentNear(worldX: number, worldY: number): number {
    const world = this.world;

    if (!world) {
      return -1;
    }

    const { town, homes } = world;

    for (let building = 0; building < town.buildingCount; building += 1) {
      const inside =
        worldX >= town.x[building] &&
        worldX <= town.x[building] + town.w[building] &&
        worldY >= town.y[building] &&
        worldY <= town.y[building] + town.h[building];

      if (inside) {
        const first = town.firstHome[building];

        for (let home = first; home < first + town.homeCount[building]; home += 1) {
          if (homes.head[home] !== -1) {
            return homes.head[home];
          }
        }
      }
    }

    return -1;
  }

  private redrawDirty(world: World): void {
    if (!this.baseContext || world.dirtyBuildings.length === 0) {
      return;
    }

    for (const building of world.dirtyBuildings) {
      drawBuilding(this.baseContext, world.town, building);
    }

    world.dirtyBuildings.length = 0;
  }

  private overlayValue(world: World, person: number): number {
    if (this.mode === "mood") {
      return world.people.mood[person];
    }

    if (this.mode === "wealth") {
      return Math.max(0, world.accounts[personAccount(world, person)]);
    }

    const home = world.people.home[person];

    return home === -1 ? 0 : world.homes.rent[home];
  }

  private refreshOverlay(world: World, overlay: Float32Array, counts: Float32Array): void {
    const { people, homes, town, capacity } = world;
    let low = Infinity;
    let high = -Infinity;

    overlay.fill(0);
    counts.fill(0);

    for (let person = 0; person < capacity; person += 3) {
      const home = people.home[person];

      if (people.alive[person] && home !== -1 && people.status[person] !== STATUS_CHILD) {
        const block = town.block[homes.building[home]];

        overlay[block] += this.overlayValue(world, person);
        counts[block] += 1;
      }
    }

    for (let block = 0; block < overlay.length; block += 1) {
      if (counts[block] > 0) {
        overlay[block] /= counts[block];
        low = Math.min(low, overlay[block]);
        high = Math.max(high, overlay[block]);
      } else {
        overlay[block] = -1;
      }
    }

    this.overlayRange = {
      mode: this.mode,
      low: Number.isFinite(low) ? low : 0,
      high: Number.isFinite(high) ? high : 1,
    };
  }

  private drawOverlay(world: World, wallClock: number): void {
    const { overlay, overlayCounts, context } = this;

    if (this.mode === "town" || !overlay || !overlayCounts) {
      return;
    }

    const stale = wallClock - this.overlayAge > OVERLAY_REFRESH_MS;

    if (stale || this.overlayRange.mode !== this.mode) {
      this.refreshOverlay(world, overlay, overlayCounts);
      this.overlayAge = wallClock;
    }

    const { low, high } = this.overlayRange;
    const { town } = world;
    const span = Math.max(high - low, 1e-6);

    for (let block = 0; block < overlay.length; block += 1) {
      if (overlay[block] >= 0) {
        const level = (overlay[block] - low) / span;

        context.fillStyle =
          this.mode === "mood"
            ? `rgba(${Math.round(217 - level * 170)}, ${Math.round(72 + level * 70)}, ${Math.round(59 + level * 150)}, 0.62)`
            : `rgba(32, 72, 150, ${0.08 + level * 0.72})`;
        context.fillRect(town.blockX[block], town.blockY[block], BLOCK_WIDTH, BLOCK_HEIGHT);
      }
    }
  }

  private noteFollowed(world: World, person: number, x: number, y: number): void {
    if (person === world.followed) {
      this.followedPoint = { x, y };
    }
  }

  private remember(person: number, x: number, y: number): void {
    this.visibleIds[this.visibleCount] = person;
    this.visibleX[this.visibleCount] = x;
    this.visibleY[this.visibleCount] = y;
    this.visibleCount += 1;
  }

  private addDot(person: number, x: number, y: number, group: number): void {
    const index = this.counts[group];

    if (person === this.world?.followed) {
      this.followedPoint = { x, y };
    }

    this.groupX[group][index] = x;
    this.groupY[group][index] = y;
    this.counts[group] += 1;
    this.remember(person, x, y);
  }

  private scatterIn(person: number, building: number, salt: number, town: Town): void {
    this.addDot(
      person,
      town.x[building] + ((salt % 1000) / 1000) * town.w[building],
      town.y[building] + (((salt >>> 10) % 1000) / 1000) * town.h[building],
      GROUP_ALERT,
    );
  }

  private drawCar(x: number, y: number, person: number, town: Town): void {
    const { context } = this;
    const horizontal = Math.abs(y - nearestRoad(town.roadY, y)) < 2;

    if (person === this.world?.followed) {
      this.followedPoint = { x, y };
    }

    context.fillStyle = CAR_COLORS[person % CAR_COLORS.length];
    context.fillRect(
      x - (horizontal ? 2 : 1),
      y - (horizontal ? 1 : 2),
      horizontal ? 4 : 2.4,
      horizontal ? 2.4 : 4,
    );
    this.remember(person, x, y);
  }

  private place(world: World, person: number, time: number): void {
    const { people, homes, town, firms } = world;
    const status = people.status[person];
    const home = people.home[person];
    const salt = hash32(person);
    const jitter = (salt % 1000) / 1000;

    if (people.protesting[person] > 0 && time > 0.35 && time < 0.7) {
      this.scatterIn(person, town.plaza, salt, town);

      return;
    }

    if (home === -1) {
      const park = town.parks.length > 0 ? town.parks[salt % town.parks.length] : town.plaza;

      this.scatterIn(person, park, salt, town);

      return;
    }

    const building = homes.building[home];
    const { from, to, point } = this;
    const dayHash = hash32(person * 31 + world.day);
    let group = GROUP_OTHER;
    let leave: number;
    let back: number;

    from.x = town.x[building] + town.w[building] / 2;
    from.y = town.y[building] + town.h[building];

    if (status === STATUS_EMPLOYED) {
      const workplace = firms.building[people.firm[person]];

      group = GROUP_WORKER;
      to.x = town.x[workplace] + town.w[workplace] / 2;
      to.y = town.y[workplace] + town.h[workplace];
      leave = 0.27 + jitter * 0.08;
      back = 0.67 + jitter * 0.08;
    } else if (status === STATUS_STUDENT && people.school[person] !== -1) {
      const school = people.school[person];

      group = GROUP_STUDENT;
      to.x = town.x[school] + town.w[school] / 2;
      to.y = town.y[school] + town.h[school];
      leave = 0.31 + jitter * 0.04;
      back = 0.62 + jitter * 0.05;
    } else if (status !== STATUS_CHILD && dayHash % 100 < 35) {
      const places = dayHash % 2 === 0 ? town.parks : town.shops;

      if (places.length === 0) {
        return;
      }

      const place = places[(dayHash >>> 8) % places.length];

      group = status === STATUS_RETIRED ? GROUP_RETIRED : GROUP_OTHER;
      to.x = town.x[place] + town.w[place] / 2;
      to.y = town.y[place] + town.h[place] / 2;
      leave = 0.4 + jitter * 0.2;
      back = leave + 0.14;
    } else {
      this.noteFollowed(world, person, from.x, from.y - town.h[building] / 2);

      return;
    }

    const distance = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    const duration = Math.min(0.06, 0.018 + distance / 22000);
    let progress: number;

    if (time >= leave && time < leave + duration) {
      progress = (time - leave) / duration;
    } else if (time >= back && time < back + duration) {
      progress = 1 - (time - back) / duration;
    } else if (
      status !== STATUS_EMPLOYED &&
      status !== STATUS_STUDENT &&
      time >= leave &&
      time < back
    ) {
      this.addDot(
        person,
        to.x + (jitter - 0.5) * 18,
        to.y + (((salt >>> 10) % 100) / 100 - 0.5) * 12,
        group,
      );

      return;
    } else {
      const away = time >= leave && time < back;

      this.noteFollowed(world, person, away ? to.x : from.x, away ? to.y : from.y);

      return;
    }

    routePoint(town, from, to, progress, point);

    if (distance > CAR_TRIP_LENGTH && status !== STATUS_STUDENT) {
      this.drawCar(point.x, point.y, person, town);
    } else {
      this.addDot(person, point.x, point.y, group);
    }
  }

  private drawPeople(world: World, time: number): void {
    const { people, capacity, followed } = world;
    const { context, view, counts } = this;
    const dotSize = Math.max(1.1, Math.min(2.4, 1.9 / Math.sqrt(view.scale)));

    counts.fill(0);
    this.visibleCount = 0;
    this.followedPoint = null;

    for (let person = 0; person < capacity; person += 1) {
      if (people.alive[person]) {
        this.place(world, person, time);
      }
    }

    GROUP_COLORS.forEach((color, group) => {
      const xs = this.groupX[group];
      const ys = this.groupY[group];

      context.fillStyle = color;

      for (let index = 0; index < counts[group]; index += 1) {
        context.fillRect(xs[index] - dotSize / 2, ys[index] - dotSize / 2, dotSize, dotSize);
      }
    });

    if (followed !== -1 && people.alive[followed] && this.followedPoint) {
      this.drawFollowed(this.followedPoint);
    }
  }

  private drawFollowed({ x, y }: Point): void {
    const { context, view } = this;

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2.4 / view.scale;
    context.beginPath();
    context.arc(x, y, 9 / view.scale, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = "#e0348a";
    context.lineWidth = 1.2 / view.scale;
    context.stroke();
  }

  render(world: World, dayFraction: number, wallClock: number, fast: boolean): void {
    const { base, context, view, pixelRatio } = this;

    if (!base) {
      return;
    }

    this.redrawDirty(world);

    const time = fast ? (wallClock / 7000) % 1 : dayFraction;
    const scale = view.scale * pixelRatio;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "#6e8f5f";
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    context.imageSmoothingEnabled = view.scale < 1.2;
    context.setTransform(scale, 0, 0, scale, -view.x * scale, -view.y * scale);
    context.drawImage(
      base,
      0,
      0,
      base.width,
      base.height,
      0,
      0,
      world.town.width,
      world.town.height,
    );
    this.drawOverlay(world, wallClock);
    this.drawPeople(world, time);
    this.followCamera();

    if (!fast) {
      const darkness = Math.max(0, Math.cos(time * Math.PI * 2)) * 0.42;

      if (darkness > 0.01) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.fillStyle = `${NIGHT_TINT}${darkness})`;
        context.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }
}
