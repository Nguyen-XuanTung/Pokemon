import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { SPECIES } from '../src/data/species.ts';
import type { CombatElement } from '../src/domain/types.ts';

type Rgba = readonly [number, number, number, number];

function hexToRgba(hex: string, alpha: number = 255): Rgba {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return [r, g, b, alpha];
}

class PixelSurface {
  public readonly width: number;
  public readonly height: number;
  public readonly data: Uint8Array;

  public constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  public setPixel(x: number, y: number, color: Rgba): void {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return;
    const offset = (iy * this.width + ix) * 4;
    this.data[offset] = color[0];
    this.data[offset + 1] = color[1];
    this.data[offset + 2] = color[2];
    this.data[offset + 3] = color[3];
  }

  public fillRect(x: number, y: number, w: number, h: number, color: Rgba): void {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, color);
      }
    }
  }

  public fillEllipse(cx: number, cy: number, rx: number, ry: number, color: Rgba): void {
    const minX = Math.floor(cx - rx - 1);
    const maxX = Math.ceil(cx + rx + 1);
    const minY = Math.floor(cy - ry - 1);
    const maxY = Math.ceil(cy + ry + 1);
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          this.setPixel(px, py, color);
        }
      }
    }
  }

  public outlineNonTransparent(ox: number, oy: number, w: number, h: number, outlineColor: Rgba): void {
    const isSolid = (px: number, py: number): boolean => {
      if (px < ox || py < oy || px >= ox + w || py >= oy + h) return false;
      const idx = (py * this.width + px) * 4;
      return (this.data[idx + 3] ?? 0) > 0;
    };
    const toOutline: Array<[number, number]> = [];
    for (let py = oy; py < oy + h; py++) {
      for (let px = ox; px < ox + w; px++) {
        if (isSolid(px, py)) continue;
        if (
          isSolid(px - 1, py) ||
          isSolid(px + 1, py) ||
          isSolid(px, py - 1) ||
          isSolid(px, py + 1)
        ) {
          toOutline.push([px, py]);
        }
      }
    }
    for (const [px, py] of toOutline) {
      this.setPixel(px, py, outlineColor);
    }
  }

  public toPngBuffer(): Buffer {
    const stride = this.width * 4 + 1;
    const raw = Buffer.alloc(stride * this.height);
    for (let y = 0; y < this.height; y++) {
      const rowStart = y * stride;
      raw[rowStart] = 0;
      const srcStart = y * this.width * 4;
      Buffer.from(this.data.buffer, srcStart, this.width * 4).copy(raw, rowStart + 1);
    }
    const compressed = zlib.deflateSync(raw, { level: 9 });

    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
      signature,
      makePngChunk('IHDR', ihdr),
      makePngChunk('IDAT', compressed),
      makePngChunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, payload: Buffer): Buffer {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(payload.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, payload])), 0);
  return Buffer.concat([lenBuf, typeBuf, payload, crcBuf]);
}

const INK = hexToRgba('#1f1c18');
const CREAM = hexToRgba('#f4ecd8');

// 1. Generate 16x16 Tileset Sheet (16 columns x 2 rows = 32 frames)
function generateTilesetPng(): Buffer {
  const cols = 16;
  const rows = 2;
  const s = new PixelSurface(cols * 16, rows * 16);

  const mossBase = hexToRgba('#5e8c52');
  const mossLight = hexToRgba('#78a866');
  const mossDark = hexToRgba('#3f6638');
  const pathBase = hexToRgba('#c7a77b');
  const pathDark = hexToRgba('#a38258');
  const pathLight = hexToRgba('#dec299');
  const waterBase = hexToRgba('#3b7a8c');
  const waterLight = hexToRgba('#6bb0c2');
  const waterDeep = hexToRgba('#285766');
  const wallBase = hexToRgba('#57524a');
  const wallLight = hexToRgba('#787166');
  const wallDark = hexToRgba('#38342e');
  const clayBase = hexToRgba('#b85d3b');
  const clayLight = hexToRgba('#d67c58');
  const clayDark = hexToRgba('#873d23');
  const sandBase = hexToRgba('#dbbe8c');
  const sandDark = hexToRgba('#bda06d');
  const stoneFloor = hexToRgba('#a8a196');
  const stoneLine = hexToRgba('#7d776d');
  const woodBase = hexToRgba('#9c6b43');
  const woodDark = hexToRgba('#6b4426');
  const woodLight = hexToRgba('#bd895e');
  const goldGlow = hexToRgba('#ebae34');
  const flameRed = hexToRgba('#d9532f');

  const tileOrigin = (idx: number): [number, number] => [(idx % cols) * 16, Math.floor(idx / cols) * 16];

  // 0: grass
  {
    const [ox, oy] = tileOrigin(0);
    s.fillRect(ox, oy, 16, 16, mossBase);
    for (const [dx, dy] of [[2, 3], [9, 6], [5, 12], [13, 11], [11, 2]]) {
      s.setPixel(ox + dx!, oy + dy!, mossLight);
      s.setPixel(ox + dx!, oy + dy! + 1, mossDark);
    }
  }
  // 1: flowers
  {
    const [ox, oy] = tileOrigin(1);
    s.fillRect(ox, oy, 16, 16, mossBase);
    for (const [fx, fy, col] of [
      [4, 4, goldGlow],
      [11, 6, CREAM],
      [6, 12, clayLight],
    ] as const) {
      s.setPixel(ox + fx, oy + fy - 1, col);
      s.setPixel(ox + fx - 1, oy + fy, col);
      s.setPixel(ox + fx + 1, oy + fy, col);
      s.setPixel(ox + fx, oy + fy + 1, col);
      s.setPixel(ox + fx, oy + fy, goldGlow);
    }
  }
  // 2: path
  {
    const [ox, oy] = tileOrigin(2);
    s.fillRect(ox, oy, 16, 16, pathBase);
    s.fillRect(ox + 1, oy + 1, 6, 6, pathLight);
    s.fillRect(ox + 9, oy + 8, 5, 5, pathLight);
    s.setPixel(ox + 7, oy + 4, pathDark);
    s.setPixel(ox + 3, oy + 11, pathDark);
    s.setPixel(ox + 12, oy + 3, pathDark);
  }
  // 3: tall_grass
  {
    const [ox, oy] = tileOrigin(3);
    s.fillRect(ox, oy, 16, 16, mossBase);
    for (let gx = 2; gx <= 13; gx += 3) {
      for (const gy of [5, 12]) {
        s.fillRect(ox + gx, oy + gy - 3, 2, 4, mossDark);
        s.setPixel(ox + gx, oy + gy - 4, mossLight);
        s.setPixel(ox + gx + 1, oy + gy - 3, mossLight);
      }
    }
  }
  // 4: water frame 1
  {
    const [ox, oy] = tileOrigin(4);
    s.fillRect(ox, oy, 16, 16, waterBase);
    s.fillRect(ox + 2, oy + 4, 5, 1, waterLight);
    s.fillRect(ox + 9, oy + 10, 5, 1, waterLight);
    s.fillRect(ox + 1, oy + 13, 4, 1, waterDeep);
  }
  // 5: wall / boulder
  {
    const [ox, oy] = tileOrigin(5);
    s.fillRect(ox, oy, 16, 16, wallDark);
    s.fillRect(ox + 1, oy + 1, 14, 13, wallBase);
    s.fillRect(ox + 2, oy + 2, 11, 5, wallLight);
    s.fillRect(ox + 1, oy + 8, 14, 1, wallDark);
    s.fillRect(ox + 8, oy + 1, 1, 7, wallDark);
  }
  // 6: tree
  {
    const [ox, oy] = tileOrigin(6);
    s.fillRect(ox, oy, 16, 16, mossBase);
    s.fillRect(ox + 6, oy + 11, 4, 5, woodDark);
    s.fillEllipse(ox + 8, oy + 7, 6.5, 6, mossDark);
    s.fillEllipse(ox + 8, oy + 6, 5, 4.5, hexToRgba('#2f5732'));
    s.fillEllipse(ox + 7, oy + 5, 3, 2.5, mossLight);
  }
  // 7: cliff (terracotta)
  {
    const [ox, oy] = tileOrigin(7);
    s.fillRect(ox, oy, 16, 16, clayDark);
    s.fillRect(ox, oy, 16, 6, clayLight);
    s.fillRect(ox, oy + 6, 16, 6, clayBase);
    s.fillRect(ox + 3, oy + 8, 4, 1, clayDark);
    s.fillRect(ox + 10, oy + 11, 4, 1, clayDark);
  }
  // 8: bridge
  {
    const [ox, oy] = tileOrigin(8);
    s.fillRect(ox, oy, 16, 16, waterDeep);
    s.fillRect(ox, oy + 1, 16, 14, woodBase);
    s.fillRect(ox, oy + 1, 16, 2, woodLight);
    s.fillRect(ox, oy + 13, 16, 2, woodDark);
    for (let bx = 3; bx < 16; bx += 4) {
      s.fillRect(ox + bx, oy + 1, 1, 14, woodDark);
    }
  }
  // 9: sand
  {
    const [ox, oy] = tileOrigin(9);
    s.fillRect(ox, oy, 16, 16, sandBase);
    s.setPixel(ox + 4, oy + 5, sandDark);
    s.setPixel(ox + 11, oy + 9, sandDark);
    s.setPixel(ox + 6, oy + 13, pathLight);
  }
  // 10: stone_floor
  {
    const [ox, oy] = tileOrigin(10);
    s.fillRect(ox, oy, 16, 16, stoneFloor);
    s.fillRect(ox, oy, 16, 1, stoneLine);
    s.fillRect(ox, oy + 8, 16, 1, stoneLine);
    s.fillRect(ox + 8, oy, 1, 8, stoneLine);
    s.fillRect(ox + 4, oy + 8, 1, 8, stoneLine);
    s.setPixel(ox + 2, oy + 2, CREAM);
  }
  // 11: reed_marsh
  {
    const [ox, oy] = tileOrigin(11);
    s.fillRect(ox, oy, 16, 16, hexToRgba('#497d76'));
    for (const rx of [3, 7, 12]) {
      s.fillRect(ox + rx, oy + 3, 1, 10, mossLight);
      s.fillRect(ox + rx, oy + 4, 2, 3, woodDark);
    }
    s.fillRect(ox + 2, oy + 13, 11, 1, waterLight);
  }
  // 12: portal marker
  {
    const [ox, oy] = tileOrigin(12);
    s.fillRect(ox, oy, 16, 16, pathBase);
    s.fillRect(ox + 3, oy + 3, 10, 10, pathLight);
    s.fillRect(ox + 6, oy + 5, 4, 6, goldGlow);
  }
  // 13: campfire
  {
    const [ox, oy] = tileOrigin(13);
    s.fillRect(ox, oy, 16, 16, stoneFloor);
    s.fillEllipse(ox + 8, oy + 12, 6, 3, wallDark);
    s.fillRect(ox + 4, oy + 10, 8, 3, woodDark);
    s.fillEllipse(ox + 8, oy + 7, 4, 5, flameRed);
    s.fillEllipse(ox + 8, oy + 8, 2.5, 3, goldGlow);
    s.setPixel(ox + 8, oy + 3, goldGlow);
  }
  // 14: shrine / resonance stone
  {
    const [ox, oy] = tileOrigin(14);
    s.fillRect(ox, oy, 16, 16, stoneFloor);
    s.fillRect(ox + 3, oy + 12, 10, 3, wallDark);
    s.fillRect(ox + 4, oy + 2, 8, 11, wallLight);
    s.fillRect(ox + 6, oy + 4, 4, 6, waterLight);
    s.fillRect(ox + 7, oy + 5, 2, 4, goldGlow);
  }
  // 15: signpost prop
  {
    const [ox, oy] = tileOrigin(15);
    s.fillRect(ox + 7, oy + 9, 2, 6, woodDark);
    s.fillRect(ox + 2, oy + 3, 12, 7, woodBase);
    s.fillRect(ox + 3, oy + 4, 10, 5, woodLight);
    s.fillRect(ox + 4, oy + 5, 8, 1, woodDark);
    s.fillRect(ox + 4, oy + 7, 6, 1, woodDark);
    s.outlineNonTransparent(ox, oy, 16, 16, INK);
  }
  // 16: chest closed
  {
    const [ox, oy] = tileOrigin(16);
    s.fillRect(ox + 2, oy + 4, 12, 10, woodBase);
    s.fillRect(ox + 2, oy + 4, 12, 3, woodLight);
    s.fillRect(ox + 2, oy + 8, 12, 1, INK);
    s.fillRect(ox + 7, oy + 7, 2, 3, goldGlow);
    s.outlineNonTransparent(ox, oy, 16, 16, INK);
  }
  // 17: chest opened
  {
    const [ox, oy] = tileOrigin(17);
    s.fillRect(ox + 2, oy + 7, 12, 7, woodDark);
    s.fillRect(ox + 2, oy + 2, 12, 4, woodBase);
    s.outlineNonTransparent(ox, oy, 16, 16, INK);
  }
  // 18: supply post counter
  {
    const [ox, oy] = tileOrigin(18);
    s.fillRect(ox + 1, oy + 2, 14, 4, clayBase);
    s.fillRect(ox + 3, oy + 2, 3, 4, CREAM);
    s.fillRect(ox + 10, oy + 2, 3, 4, CREAM);
    s.fillRect(ox + 2, oy + 9, 12, 6, woodBase);
    s.fillRect(ox + 4, oy + 6, 3, 3, goldGlow);
    s.fillRect(ox + 9, oy + 6, 3, 3, waterLight);
    s.outlineNonTransparent(ox, oy, 16, 16, INK);
  }
  // 19: water frame 2
  {
    const [ox, oy] = tileOrigin(19);
    s.fillRect(ox, oy, 16, 16, waterBase);
    s.fillRect(ox + 5, oy + 5, 5, 1, waterLight);
    s.fillRect(ox + 6, oy + 11, 5, 1, waterLight);
    s.fillRect(ox + 10, oy + 2, 4, 1, waterDeep);
  }

  return s.toPngBuffer();
}

// 2. Generate Characters Sheet (6 variants x 8 frames [down0,down1,up0,up1,left0,left1,right0,right1], 16x16)
function generateCharactersPng(): Buffer {
  const cols = 8;
  const rows = 6;
  const s = new PixelSurface(cols * 16, rows * 16);

  const outfits: ReadonlyArray<{ hat: Rgba; tunic: Rgba; hair: Rgba; boots: Rgba }> = [
    // 0: Player Naturalist (moss cap, terracotta jacket)
    {
      hat: hexToRgba('#3f6b46'),
      tunic: hexToRgba('#b85d3b'),
      hair: hexToRgba('#4a3423'),
      boots: hexToRgba('#3d2b1f'),
    },
    // 1: Lead Ranger Rowan (forest cloak)
    {
      hat: hexToRgba('#2f4f3a'),
      tunic: hexToRgba('#5e7d52'),
      hair: hexToRgba('#6e685f'),
      boots: hexToRgba('#3d2b1f'),
    },
    // 2: Botanist / Scholar (cream shawl & pond tunic)
    {
      hat: hexToRgba('#d9c59a'),
      tunic: hexToRgba('#3b7a8c'),
      hair: hexToRgba('#2b211b'),
      boots: hexToRgba('#4a3728'),
    },
    // 3: Outfitter / Artisan (ochre vest)
    {
      hat: hexToRgba('#8f563b'),
      tunic: hexToRgba('#c79a2b'),
      hair: hexToRgba('#3b281d'),
      boots: hexToRgba('#332419'),
    },
    // 4: Trail Scout (sage tunic)
    {
      hat: hexToRgba('#4f7a6d'),
      tunic: hexToRgba('#6b8e55'),
      hair: hexToRgba('#593a27'),
      boots: hexToRgba('#36261b'),
    },
    // 5: Regional Warden / Elder (deep gold & crimson mantle)
    {
      hat: hexToRgba('#ebae34'),
      tunic: hexToRgba('#8c3b2b'),
      hair: hexToRgba('#e8dfc8'),
      boots: hexToRgba('#2e221b'),
    },
  ];

  const skin = hexToRgba('#f0c8a0');

  for (let r = 0; r < rows; r++) {
    const style = outfits[r]!;
    for (let c = 0; c < cols; c++) {
      const ox = c * 16;
      const oy = r * 16;
      const dirIdx = Math.floor(c / 2); // 0 down, 1 up, 2 left, 3 right
      const step = c % 2;

      // Hat & head
      s.fillRect(ox + 5, oy + 2, 6, 3, style.hat);
      s.fillRect(ox + 4, oy + 3, 8, 1, style.hat);
      s.fillRect(ox + 5, oy + 5, 6, 4, skin);

      if (dirIdx === 1) {
        // Facing up: hair covers back of head
        s.fillRect(ox + 5, oy + 5, 6, 4, style.hair);
      } else if (dirIdx === 0) {
        s.setPixel(ox + 6, oy + 6, INK);
        s.setPixel(ox + 9, oy + 6, INK);
      } else if (dirIdx === 2) {
        s.setPixel(ox + 6, oy + 6, INK);
        s.fillRect(ox + 9, oy + 5, 2, 3, style.hair);
      } else {
        s.setPixel(ox + 9, oy + 6, INK);
        s.fillRect(ox + 5, oy + 5, 2, 3, style.hair);
      }

      // Torso & satchel
      s.fillRect(ox + 4, oy + 9, 8, 4, style.tunic);
      s.fillRect(ox + 6, oy + 9, 4, 4, style.hat);

      // Legs with walk bob
      const leftY = step === 0 ? 13 : 12;
      const rightY = step === 0 ? 12 : 13;
      s.fillRect(ox + 5, oy + leftY, 2, 2, style.boots);
      s.fillRect(ox + 9, oy + rightY, 2, 2, style.boots);

      s.outlineNonTransparent(ox, oy, 16, 16, INK);
    }
  }

  return s.toPngBuffer();
}

// 3. Generate 30 Species Spritesheet (10 cols x 6 rows of 32x32 -> 2 frames per species = 60 frames)
function generateCreaturesPng(): Buffer {
  const cols = 10;
  const rows = 6;
  const s = new PixelSurface(cols * 32, rows * 32);

  const palettes: Record<CombatElement, { primary: Rgba; light: Rgba; dark: Rgba; accent: Rgba }> = {
    leaf: {
      primary: hexToRgba('#4f8f54'),
      light: hexToRgba('#85bd77'),
      dark: hexToRgba('#2f5c36'),
      accent: hexToRgba('#ebae34'),
    },
    ember: {
      primary: hexToRgba('#cc5a33'),
      light: hexToRgba('#eb8b52'),
      dark: hexToRgba('#87331c'),
      accent: hexToRgba('#f5cf5b'),
    },
    water: {
      primary: hexToRgba('#3b7e96'),
      light: hexToRgba('#74b9cf'),
      dark: hexToRgba('#234f61'),
      accent: hexToRgba('#f4ecd8'),
    },
    stone: {
      primary: hexToRgba('#9c7352'),
      light: hexToRgba('#c49a74'),
      dark: hexToRgba('#63462f'),
      accent: hexToRgba('#d96b43'),
    },
    gale: {
      primary: hexToRgba('#579482'),
      light: hexToRgba('#92ccb8'),
      dark: hexToRgba('#345e52'),
      accent: hexToRgba('#f4ecd8'),
    },
    spark: {
      primary: hexToRgba('#d9a32b'),
      light: hexToRgba('#f7cf65'),
      dark: hexToRgba('#8f6414'),
      accent: hexToRgba('#62c4d9'),
    },
  };

  for (let i = 0; i < SPECIES.length; i++) {
    const sp = SPECIES[i]!;
    const pal = palettes[sp.element];

    for (let frame = 0; frame < 2; frame++) {
      const frameIndex = i * 2 + frame;
      const ox = (frameIndex % cols) * 32;
      const oy = Math.floor(frameIndex / cols) * 32;
      const bob = frame === 1 ? -1 : 0;

      const sizeScale = sp.stage === 1 ? 0.78 : sp.stage === 2 ? 0.94 : 1.1;
      const bodyRx = Math.round(7.5 * sizeScale);
      const bodyRy = Math.round(6.5 * sizeScale);
      const cy = oy + 19 + bob;
      const cx = ox + 16;

      // Ground shadow
      s.fillEllipse(ox + 16, oy + 28, bodyRx + 1, 2.2, hexToRgba('#1f1c18', 90));

      // Archetype silhouettes by dexNumber family
      if (sp.dexNumber <= 6) {
        // Quadruped Lynx / Fox lines (1-3, 4-6)
        s.fillEllipse(cx + bodyRx - 1, cy - 2 - frame, 4, 2.5, pal.accent); // Tail
        s.fillEllipse(cx, cy + 1, bodyRx, bodyRy - 1, pal.primary);
        s.fillEllipse(cx - 1, cy, bodyRx - 2, bodyRy - 2, pal.light);
        // Head & pointed ears
        s.fillEllipse(cx - 3, cy - bodyRy + 1, 5.5, 5, pal.primary);
        s.fillRect(cx - 8, cy - bodyRy - 5, 3, 5, pal.dark);
        s.fillRect(cx + 1, cy - bodyRy - 5, 3, 5, pal.dark);
        s.setPixel(cx - 7, cy - bodyRy - 4, pal.accent);
        s.setPixel(cx + 2, cy - bodyRy - 4, pal.accent);
        // Paws
        s.fillRect(cx - 5, oy + 24, 3, 4, pal.dark);
        s.fillRect(cx + 2, oy + 24, 3, 4, pal.dark);
        s.setPixel(cx - 5, cy - bodyRy + 1, INK);
        s.setPixel(cx - 1, cy - bodyRy + 1, INK);
      } else if (sp.dexNumber <= 9) {
        // Otter line (7-9)
        s.fillEllipse(cx + bodyRx, cy + 2, 5, 2.5, pal.dark); // Rudder tail
        s.fillEllipse(cx, cy, bodyRx - 1, bodyRy + 1, pal.primary);
        s.fillEllipse(cx - 1, cy + 1, bodyRx - 3, bodyRy - 1, pal.accent);
        s.fillEllipse(cx - 1, cy - bodyRy, 5, 4.5, pal.light);
        s.setPixel(cx - 3, cy - bodyRy, INK);
        s.setPixel(cx + 1, cy - bodyRy, INK);
        s.fillRect(cx - 5, oy + 25, 3, 3, pal.dark);
        s.fillRect(cx + 2, oy + 25, 3, 3, pal.dark);
      } else if (sp.dexNumber <= 12 || sp.dexNumber === 28 || sp.dexNumber === 29) {
        // Avian / Owl lines (10-12, 28-29)
        const wingSpread = frame === 1 ? 4 : 2;
        s.fillEllipse(cx - bodyRx - 1, cy - wingSpread, 5, 3.5, pal.dark);
        s.fillEllipse(cx + bodyRx + 1, cy - wingSpread, 5, 3.5, pal.dark);
        s.fillEllipse(cx, cy, bodyRx - 1, bodyRy, pal.primary);
        s.fillEllipse(cx, cy + 1, bodyRx - 3, bodyRy - 2, pal.light);
        s.fillEllipse(cx, cy - bodyRy + 1, 5, 4.5, pal.primary);
        s.fillRect(cx - 1, cy - bodyRy + 2, 2, 2, pal.accent); // Beak
        s.setPixel(cx - 3, cy - bodyRy, INK);
        s.setPixel(cx + 2, cy - bodyRy, INK);
      } else if (sp.dexNumber <= 15) {
        // Beetle line (13-15)
        s.fillEllipse(cx, cy + 1, bodyRx, bodyRy, pal.dark);
        s.fillEllipse(cx, cy, bodyRx - 1, bodyRy - 1, pal.primary);
        s.fillEllipse(cx, cy - 1, 3, 3, pal.accent); // Bioluminescent core
        if (sp.stage === 3) {
          s.fillRect(cx - 2, cy - bodyRy - 6, 4, 6, pal.accent); // Stag horn
        }
        s.setPixel(cx - 3, cy + 1, INK);
        s.setPixel(cx + 3, cy + 1, INK);
      } else if (sp.dexNumber <= 17) {
        // Spark Hare line (16-17)
        s.fillRect(cx - 5, cy - bodyRy - 8, 3, 8, pal.primary);
        s.fillRect(cx + 2, cy - bodyRy - 8, 3, 8, pal.primary);
        s.fillRect(cx - 4, cy - bodyRy - 7, 1, 5, pal.accent);
        s.fillRect(cx + 3, cy - bodyRy - 7, 1, 5, pal.accent);
        s.fillEllipse(cx, cy + 1, bodyRx - 1, bodyRy, pal.light);
        s.setPixel(cx - 2, cy - 1, INK);
        s.setPixel(cx + 2, cy - 1, INK);
      } else if (sp.dexNumber <= 20) {
        // Fen Frog / Lotus Toad line (18-20)
        s.fillEllipse(cx, cy + 2, bodyRx + 1, bodyRy - 1, pal.primary);
        s.fillEllipse(cx, cy + 3, bodyRx - 2, bodyRy - 2, pal.light);
        if (sp.stage === 3) {
          s.fillEllipse(cx, cy - bodyRy - 1, 5, 3, hexToRgba('#e88ca5')); // Lotus flower!
        }
        s.fillEllipse(cx - 4, cy - bodyRy + 3, 2.5, 2.5, pal.light);
        s.fillEllipse(cx + 4, cy - bodyRy + 3, 2.5, 2.5, pal.light);
        s.setPixel(cx - 4, cy - bodyRy + 3, INK);
        s.setPixel(cx + 4, cy - bodyRy + 3, INK);
      } else if (sp.dexNumber <= 22) {
        // Lantern Minnow / River Eel (21-22)
        s.fillEllipse(cx, cy, bodyRx + 2, bodyRy - 2, pal.primary);
        s.fillEllipse(cx - 2, cy, bodyRx - 1, bodyRy - 3, pal.light);
        s.fillEllipse(cx + bodyRx + 2, cy, 3, 4, pal.accent); // Fin
        s.fillEllipse(cx - bodyRx - 2, cy - 3, 2, 2, pal.accent); // Lantern lure
        s.setPixel(cx - 4, cy - 1, INK);
      } else if (sp.dexNumber <= 25) {
        // Armored Pangolin / Tortoise / Monolith (23-25)
        s.fillEllipse(cx, cy + 1, bodyRx + 2, bodyRy, pal.dark);
        s.fillEllipse(cx, cy, bodyRx, bodyRy - 1, pal.primary);
        s.fillRect(cx - 4, cy - 3, 8, 2, pal.accent);
        s.fillEllipse(cx - bodyRx - 1, cy + 2, 3.5, 3, pal.light);
        s.setPixel(cx - bodyRx - 2, cy + 1, INK);
        s.fillRect(cx - 6, oy + 24, 4, 4, pal.dark);
        s.fillRect(cx + 3, oy + 24, 4, 4, pal.dark);
      } else if (sp.dexNumber <= 27) {
        // Canyon Skink / Drake (26-27)
        s.fillEllipse(cx + bodyRx, cy + 2, 5, 2, pal.primary);
        s.fillEllipse(cx, cy + 1, bodyRx, bodyRy - 1, pal.primary);
        s.fillEllipse(cx - 3, cy - bodyRy + 1, 5.5, 4, pal.accent); // Amber frill
        s.fillEllipse(cx - 3, cy - bodyRy + 2, 4, 3, pal.light);
        s.setPixel(cx - 5, cy - bodyRy + 2, INK);
      } else {
        // 30: Solacern Guardian Stag
        s.fillEllipse(cx + 1, cy + 1, 8, 5.5, pal.light);
        s.fillEllipse(cx - 5, cy - 6, 4.5, 4.5, CREAM);
        // Crystalline antlers
        s.fillRect(cx - 8, cy - 15, 2, 8, pal.accent);
        s.fillRect(cx - 10, cy - 13, 5, 2, pal.accent);
        s.fillRect(cx - 3, cy - 15, 2, 8, pal.accent);
        s.fillRect(cx - 4, cy - 13, 5, 2, pal.accent);
        s.fillRect(cx - 4, oy + 22, 2, 6, pal.dark);
        s.fillRect(cx + 4, oy + 22, 2, 6, pal.dark);
        s.setPixel(cx - 6, cy - 6, INK);
      }

      s.outlineNonTransparent(ox, oy, 32, 32, INK);
    }
  }

  return s.toPngBuffer();
}

// 4. Generate 16x16 Item Icons Sheet (16 cols x 1 row)
function generateItemsPng(): Buffer {
  const s = new PixelSurface(16 * 16, 16);
  const colors: ReadonlyArray<[Rgba, Rgba]> = [
    [hexToRgba('#5e8c52'), hexToRgba('#ebae34')], // moss_charm
    [hexToRgba('#3b7a8c'), hexToRgba('#f4ecd8')], // reed_charm
    [hexToRgba('#c85a32'), hexToRgba('#f7cf65')], // amber_charm
    [hexToRgba('#62c4d9'), hexToRgba('#f7cf65')], // star_charm
    [hexToRgba('#4fa889'), CREAM], // dew_tonic
    [hexToRgba('#cc5a33'), CREAM], // orchard_salve
    [hexToRgba('#ebae34'), CREAM], // nectar_flask
    [hexToRgba('#5e8c52'), hexToRgba('#92ccb8')], // clear_herb
    [hexToRgba('#8f563b'), hexToRgba('#92ccb8')], // breeze_tea
    [hexToRgba('#c79a2b'), hexToRgba('#f7cf65')], // calm_lantern
    [hexToRgba('#6b4426'), hexToRgba('#85bd77')], // reed_ferry_pass
    [hexToRgba('#9c7352'), hexToRgba('#ebae34')], // sunforge_rope
    [hexToRgba('#3b7a8c'), hexToRgba('#f7cf65')], // starfall_crest
  ];

  for (let i = 0; i < colors.length; i++) {
    const ox = i * 16;
    const [main, acc] = colors[i]!;
    if (i < 4) {
      // Bell / Chime icon
      s.fillRect(ox + 6, oyFrom(2), 4, 2, acc);
      s.fillEllipse(ox + 8, 8, 4.5, 4.5, main);
      s.fillRect(ox + 4, 10, 8, 2, acc);
      s.fillRect(ox + 7, 12, 2, 2, acc);
    } else if (i < 7) {
      // Flask / Tonic icon
      s.fillRect(ox + 6, 2, 4, 3, acc);
      s.fillEllipse(ox + 8, 10, 4.5, 4.5, main);
      s.fillRect(ox + 6, 8, 2, 3, acc);
    } else {
      // Herb / Emblem / Lantern
      s.fillEllipse(ox + 8, 8, 5, 5, main);
      s.fillEllipse(ox + 8, 8, 2.5, 2.5, acc);
    }
    s.outlineNonTransparent(ox, 0, 16, 16, INK);
  }
  return s.toPngBuffer();
}

function oyFrom(v: number): number {
  return v;
}

const outDir = path.join(process.cwd(), 'public', 'assets', 'sprites');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'tileset.png'), generateTilesetPng());
fs.writeFileSync(path.join(outDir, 'characters.png'), generateCharactersPng());
fs.writeFileSync(path.join(outDir, 'creatures.png'), generateCreaturesPng());
fs.writeFileSync(path.join(outDir, 'items.png'), generateItemsPng());

console.log('Generated pixel-art sprite sheets in public/assets/sprites/ (tileset.png, characters.png, creatures.png, items.png).');
