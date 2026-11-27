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

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

class PixelSurface {
  public readonly width: number;
  public readonly height: number;
  public readonly data: Uint8Array;

  public constructor(width: number, height: number, existing?: Uint8Array) {
    this.width = width;
    this.height = height;
    this.data = existing ?? new Uint8Array(width * height * 4);
  }

  public static fromPngFile(filePath: string): PixelSurface {
    const buf = fs.readFileSync(filePath);
    let offset = 8;
    let width = 0;
    let height = 0;
    const idatParts: Buffer[] = [];

    while (offset < buf.length) {
      const length = buf.readUInt32BE(offset);
      const type = buf.toString('ascii', offset + 4, offset + 8);
      const chunkData = buf.subarray(offset + 8, offset + 8 + length);
      if (type === 'IHDR') {
        width = chunkData.readUInt32BE(0);
        height = chunkData.readUInt32BE(4);
        const bitDepth = chunkData[8];
        const colorType = chunkData[9];
        if (bitDepth !== 8 || colorType !== 6) {
          throw new Error(`Expected 8-bit RGBA PNG in ${filePath}, got depth=${bitDepth} type=${colorType}`);
        }
      } else if (type === 'IDAT') {
        idatParts.push(chunkData);
      } else if (type === 'IEND') {
        break;
      }
      offset += 12 + length;
    }

    const inflated = zlib.inflateSync(Buffer.concat(idatParts));
    const bpp = 4;
    const rowBytes = width * bpp;
    const pixels = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      const filterType = inflated[y * (rowBytes + 1)]!;
      const srcRowOffset = y * (rowBytes + 1) + 1;
      const dstRowOffset = y * rowBytes;

      for (let i = 0; i < rowBytes; i++) {
        const rawByte = inflated[srcRowOffset + i]!;
        const left = i >= bpp ? pixels[dstRowOffset + i - bpp]! : 0;
        const up = y > 0 ? pixels[dstRowOffset - rowBytes + i]! : 0;
        const upLeft = y > 0 && i >= bpp ? pixels[dstRowOffset - rowBytes + i - bpp]! : 0;

        let recon = rawByte;
        if (filterType === 1) recon = (rawByte + left) & 0xff;
        else if (filterType === 2) recon = (rawByte + up) & 0xff;
        else if (filterType === 3) recon = (rawByte + ((left + up) >> 1)) & 0xff;
        else if (filterType === 4) recon = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;
        pixels[dstRowOffset + i] = recon;
      }
    }

    return new PixelSurface(width, height, pixels);
  }

  public getPixel(x: number, y: number): Rgba {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return [0, 0, 0, 0];
    const off = (iy * this.width + ix) * 4;
    return [this.data[off]!, this.data[off + 1]!, this.data[off + 2]!, this.data[off + 3]!];
  }

  public setPixel(x: number, y: number, color: Rgba): void {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return;
    const off = (iy * this.width + ix) * 4;
    this.data[off] = color[0];
    this.data[off + 1] = color[1];
    this.data[off + 2] = color[2];
    this.data[off + 3] = color[3];
  }

  public blendPixel(x: number, y: number, color: Rgba): void {
    const sa = color[3] / 255;
    if (sa <= 0) return;
    if (sa >= 0.999) {
      this.setPixel(x, y, color);
      return;
    }
    const dst = this.getPixel(x, y);
    const da = dst[3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) return;
    const r = Math.round((color[0] * sa + dst[0] * da * (1 - sa)) / outA);
    const g = Math.round((color[1] * sa + dst[1] * da * (1 - sa)) / outA);
    const b = Math.round((color[2] * sa + dst[2] * da * (1 - sa)) / outA);
    this.setPixel(x, y, [r, g, b, Math.round(outA * 255)]);
  }

  public blitFrom(
    src: PixelSurface,
    sx: number,
    sy: number,
    w: number,
    h: number,
    dx: number,
    dy: number,
    tint?: { rMul: number; gMul: number; bMul: number },
  ): void {
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        let col = src.getPixel(sx + px, sy + py);
        if (col[3] === 0) continue;
        if (tint) {
          col = [
            Math.min(255, Math.round(col[0] * tint.rMul)),
            Math.min(255, Math.round(col[1] * tint.gMul)),
            Math.min(255, Math.round(col[2] * tint.bMul)),
            col[3],
          ];
        }
        this.blendPixel(dx + px, dy + py, col);
      }
    }
  }

  public fillRect(x: number, y: number, w: number, h: number, color: Rgba): void {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, color);
      }
    }
  }

  public fillEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: Rgba,
    ditherShade?: Rgba,
  ): void {
    const minX = Math.floor(cx - rx - 1);
    const maxX = Math.ceil(cx + rx + 1);
    const minY = Math.floor(cy - ry - 1);
    const maxY = Math.ceil(cy + ry + 1);
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        const distSq = dx * dx + dy * dy;
        if (distSq <= 1) {
          if (ditherShade && dy > 0.25 && ((px + py) & 1) === 0) {
            this.setPixel(px, py, ditherShade);
          } else {
            this.setPixel(px, py, color);
          }
        }
      }
    }
  }

  public drawLine(x0: number, y0: number, x1: number, y1: number, thickness: number, color: Rgba): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (thickness <= 1) {
        this.setPixel(Math.round(x), Math.round(y), color);
      } else {
        this.fillEllipse(x, y, thickness * 0.5, thickness * 0.5, color);
      }
    }
  }

  public outlineRegion(ox: number, oy: number, w: number, h: number, outlineColor: Rgba): void {
    const isOpaque = (px: number, py: number): boolean => {
      if (px < ox || py < oy || px >= ox + w || py >= oy + h) return false;
      return this.getPixel(px, py)[3] > 180;
    };
    const pts: Array<[number, number]> = [];
    for (let py = oy; py < oy + h; py++) {
      for (let px = ox; px < ox + w; px++) {
        if (isOpaque(px, py)) continue;
        if (
          isOpaque(px - 1, py) ||
          isOpaque(px + 1, py) ||
          isOpaque(px, py - 1) ||
          isOpaque(px, py + 1)
        ) {
          pts.push([px, py]);
        }
      }
    }
    for (const [px, py] of pts) {
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

const ROOT = process.cwd();
const kenney = PixelSurface.fromPngFile(
  path.join(ROOT, 'assets-src', 'kenney-roguelike-cc0', 'roguelikeSheet_transparent.png'),
);
const sharmChars = PixelSurface.fromPngFile(
  path.join(ROOT, 'assets-src', 'sharm-tiny16-ccby', 'characters_1.png'),
);
const sharmThings = PixelSurface.fromPngFile(
  path.join(ROOT, 'assets-src', 'sharm-tiny16-ccby', 'things_0.png'),
);
const sharmBasic = PixelSurface.fromPngFile(
  path.join(ROOT, 'assets-src', 'sharm-tiny16-ccby', 'basictiles_2.png'),
);

const INK = hexToRgba('#1b1917');
const CREAM = hexToRgba('#f6eed9');

// 1. Build Multi-Layer 16x16 Tileset Atlas (16 cols x 5 rows = 80 tiles) from Kenney CC0 + Sharm CC-BY
function generateTilesetPng(): Buffer {
  const cols = 16;
  const rows = 7;
  const out = new PixelSurface(cols * 16, rows * 16);

  const cell = (idx: number): [number, number] => [(idx % cols) * 16, Math.floor(idx / cols) * 16];
  const blitKenney = (
    kCol: number,
    kRow: number,
    targetIdx: number,
    tint?: { rMul: number; gMul: number; bMul: number },
  ) => {
    const [dx, dy] = cell(targetIdx);
    out.blitFrom(kenney, kCol * 17, kRow * 17, 16, 16, dx, dy, tint);
  };

  // Warm slightly deeper forest-moss tint on Kenney bright lime grass so palette matches Stardew/Eastward warmth
  const grassTint = { rMul: 0.86, gMul: 0.92, bMul: 0.88 };
  const putGrassBase = (idx: number, variant: 0 | 1 = 0) => {
    blitKenney(5, variant, idx, grassTint);
  };

  // 0: grass plain, 1: grass clover
  putGrassBase(0, 0);
  putGrassBase(1, 1);

  // 2: red-gold wildflowers, 3: white daisies, 4: blue flowers (standalone overlays without stone borders)
  const drawFlowerCluster = (
    idx: number,
    petalA: Rgba,
    petalB: Rgba,
    centerCol: Rgba,
    spots: ReadonlyArray<[number, number]>,
  ) => {
    const [dx, dy] = cell(idx);
    const stem = hexToRgba('#234c2e');
    for (const [fx, fy] of spots) {
      out.setPixel(dx + fx, dy + fy + 2, stem);
      out.setPixel(dx + fx, dy + fy - 1, petalA);
      out.setPixel(dx + fx, dy + fy + 1, petalA);
      out.setPixel(dx + fx - 1, dy + fy, petalB);
      out.setPixel(dx + fx + 1, dy + fy, petalB);
      out.setPixel(dx + fx, dy + fy, centerCol);
    }
  };

  putGrassBase(2, 0);
  blitKenney(30, 9, 2, grassTint);
  drawFlowerCluster(2, hexToRgba('#eb6f52'), hexToRgba('#f4b449'), hexToRgba('#fff3c4'), [
    [4, 5],
    [11, 4],
    [8, 11],
  ]);

  putGrassBase(3, 1);
  blitKenney(31, 9, 3, grassTint);
  drawFlowerCluster(3, hexToRgba('#f7f4e8'), hexToRgba('#e2dec9'), hexToRgba('#e8a938'), [
    [5, 4],
    [12, 8],
    [4, 11],
  ]);

  putGrassBase(4, 0);
  blitKenney(30, 9, 4, grassTint);
  drawFlowerCluster(4, hexToRgba('#6bb8f0'), hexToRgba('#9cd4ff'), hexToRgba('#fff3c4'), [
    [4, 6],
    [10, 4],
    [11, 11],
  ]);

  // 5 & 6: swaying tall grass (2 animation frames using Kenney grass blades 21,10 & 22,10 + layered tufts)
  const drawTallGrassBlades = (idx: number, sway: number) => {
    const [dx, dy] = cell(idx);
    const darkBlade = hexToRgba('#1f4d2b');
    const midBlade = hexToRgba('#347840');
    const tipBlade = hexToRgba('#62ad56');
    for (const bx of [2, 5, 8, 11, 13]) {
      const h = bx % 2 === 0 ? 7 : 6;
      for (let step = 0; step < h; step++) {
        const shift = step >= h - 2 ? sway : 0;
        const col = step < 2 ? darkBlade : step < h - 1 ? midBlade : tipBlade;
        out.setPixel(dx + bx + shift, dy + 14 - step, col);
        out.setPixel(dx + bx + shift, dy + 7 - Math.floor(step * 0.7), col);
      }
    }
  };
  putGrassBase(5, 0);
  blitKenney(21, 10, 5);
  blitKenney(22, 10, 5);
  drawTallGrassBlades(5, 0);

  putGrassBase(6, 1);
  {
    const [dx, dy] = cell(6);
    out.blitFrom(kenney, 21 * 17, 10 * 17, 15, 16, dx + 1, dy);
    out.blitFrom(kenney, 22 * 17, 10 * 17, 15, 16, dx + 1, dy);
  }
  drawTallGrassBlades(6, 1);

  // 7 & 8: sparkling water frames 1 & 2
  blitKenney(0, 0, 7, { rMul: 0.85, gMul: 0.94, bMul: 0.98 });
  blitKenney(1, 0, 8, { rMul: 0.85, gMul: 0.94, bMul: 0.98 });

  // 9..16: 8 shoreline edges/corners from Kenney (cols 2..4, rows 0..2)
  const waterRimTint = { rMul: 0.86, gMul: 0.93, bMul: 0.94 };
  blitKenney(3, 0, 9, waterRimTint); // Top shore
  blitKenney(3, 2, 10, waterRimTint); // Bottom shore
  blitKenney(2, 1, 11, waterRimTint); // Left shore
  blitKenney(4, 1, 12, waterRimTint); // Right shore
  blitKenney(2, 0, 13, waterRimTint); // TL corner
  blitKenney(4, 0, 14, waterRimTint); // TR corner
  blitKenney(2, 2, 15, waterRimTint); // BL corner
  blitKenney(4, 2, 16, waterRimTint); // BR corner

  // 17..25: 9-slice curved dirt trail from Kenney (cols 5..7, rows 7..9) over grass base!
  const roadCoords: ReadonlyArray<[number, number, number]> = [
    [6, 8, 17], // center
    [6, 7, 18], // top
    [6, 9, 19], // bottom
    [5, 8, 20], // left
    [7, 8, 21], // right
    [5, 7, 22], // TL
    [7, 7, 23], // TR
    [5, 9, 24], // BL
    [7, 9, 25], // BR
  ];
  for (const [kc, kr, idx] of roadCoords) {
    putGrassBase(idx, 0);
    blitKenney(kc, kr, idx);
  }

  // 26: wooden bridge over water
  blitKenney(0, 0, 26, { rMul: 0.82, gMul: 0.92, bMul: 0.96 });
  blitKenney(6, 4, 26);

  // 27: seamless warm canyon sand, 28: terracotta ground, 29: seamless carved limestone plaza flagstones
  {
    const [dx, dy] = cell(27);
    const sandBase = hexToRgba('#dfbe92');
    const sandLight = hexToRgba('#ebd0a7');
    const sandShade = hexToRgba('#c7a274');
    out.fillRect(dx, dy, 16, 16, sandBase);
    // Soft wind-blown sand ripples (no dark ledge borders)
    out.fillRect(dx + 2, dy + 3, 5, 1, sandLight);
    out.fillRect(dx + 9, dy + 8, 5, 1, sandLight);
    out.fillRect(dx + 3, dy + 13, 6, 1, sandLight);
    out.fillRect(dx + 2, dy + 4, 4, 1, sandShade);
    out.fillRect(dx + 10, dy + 9, 4, 1, sandShade);
    out.setPixel(dx + 13, dy + 3, sandShade);
    out.setPixel(dx + 5, dy + 10, sandShade);
    out.setPixel(dx + 11, dy + 14, sandShade);
  }
  blitKenney(1, 18, 28);
  {
    const [dx, dy] = cell(29);
    const stoneBase = hexToRgba('#cfc7b8');
    const stoneLight = hexToRgba('#dcd5c7');
    const mortar = hexToRgba('#aba190');
    out.fillRect(dx, dy, 16, 16, stoneBase);
    out.fillRect(dx + 1, dy + 1, 6, 6, stoneLight);
    out.fillRect(dx + 9, dy + 9, 6, 5, stoneLight);
    // Subtle staggered flagstone mortar joints (no harsh black stripes!)
    out.fillRect(dx, dy + 7, 16, 1, mortar);
    out.fillRect(dx, dy + 15, 16, 1, mortar);
    out.fillRect(dx + 7, dy, 1, 7, mortar);
    out.fillRect(dx + 12, dy + 8, 1, 7, mortar);
    out.setPixel(dx + 3, dy + 11, mortar);
    out.setPixel(dx + 10, dy + 3, mortar);
  }

  // 30 & 31: misty reed marsh (2 frames with cattail stalks over shallow marsh water)
  const drawMarshReeds = (idx: number, sway: number) => {
    const [dx, dy] = cell(idx);
    const stalk = hexToRgba('#356b3f');
    const cattail = hexToRgba('#8f5932');
    const ripple = hexToRgba('#8bd4cf');
    out.setPixel(dx + 3, dy + 14, ripple);
    out.setPixel(dx + 4, dy + 14, ripple);
    out.setPixel(dx + 11, dy + 13, ripple);
    for (const rx of [3, 7, 11, 13]) {
      for (let step = 0; step < 9; step++) {
        const shift = step >= 6 ? sway : 0;
        out.setPixel(dx + rx + shift, dy + 13 - step, stalk);
      }
      if (rx === 3 || rx === 11) {
        out.setPixel(dx + rx + sway, dy + 4, cattail);
        out.setPixel(dx + rx + sway, dy + 5, cattail);
      }
    }
  };
  blitKenney(0, 0, 30, { rMul: 0.72, gMul: 0.88, bMul: 0.82 });
  blitKenney(21, 10, 30);
  drawMarshReeds(30, 0);
  blitKenney(1, 0, 31, { rMul: 0.72, gMul: 0.88, bMul: 0.82 });
  {
    const [dx, dy] = cell(31);
    out.blitFrom(kenney, 21 * 17, 10 * 17, 15, 16, dx + 1, dy);
  }
  drawMarshReeds(31, 1);

  // 32: rock crag wall (Sharm basictiles 7,1), 33: terracotta cliff face, 34: cliff top, 35: stone stairs
  {
    const [dx, dy] = cell(32);
    out.blitFrom(sharmBasic, 7 * 16, 1 * 16, 16, 16, dx, dy);
  }
  const terraTint = { rMul: 1.05, gMul: 0.68, bMul: 0.52 };
  blitKenney(14, 19, 33, terraTint);
  blitKenney(14, 18, 34, terraTint);
  blitKenney(16, 18, 35);

  // 36..43: Transparent multi-tile 2-high trees (Canopy Top + Trunk Bottom!)
  blitKenney(13, 10, 36); // Oak top
  blitKenney(13, 11, 37); // Oak bottom
  blitKenney(15, 10, 38); // Pine top
  blitKenney(15, 11, 39); // Pine bottom
  blitKenney(14, 10, 40); // Ridge golden tree top
  blitKenney(14, 11, 41); // Ridge golden tree bottom
  blitKenney(18, 10, 42, { rMul: 0.8, gMul: 0.95, bMul: 1.15 }); // Sanctuary spruce top
  blitKenney(18, 11, 43, { rMul: 0.8, gMul: 0.95, bMul: 1.15 }); // Sanctuary spruce bottom
  {
    const [sx, sy] = cell(42);
    out.setPixel(sx + 6, sy + 5, hexToRgba('#f7df7c'));
    out.setPixel(sx + 10, sy + 9, hexToRgba('#9ce8ff'));
  }

  // 44: berry bush, 45: stump, 46: waterlily pad, 47: boulder
  blitKenney(23, 10, 44);
  blitKenney(27, 11, 45);
  blitKenney(25, 11, 46);
  blitKenney(54, 22, 47);

  // 48: signpost, 49: overlook board, 50: chest closed, 51: chest opened
  blitKenney(20, 0, 48);
  blitKenney(19, 0, 49);
  {
    const [dx0, dy0] = cell(50);
    out.blitFrom(sharmThings, 6 * 16, 0, 16, 16, dx0, dy0);
    const [dx1, dy1] = cell(51);
    out.blitFrom(sharmThings, 6 * 16, 3 * 16, 16, 16, dx1, dy1);
  }

  // 52,53: animated campfire, 54,55: animated sanctuary brazier
  blitKenney(14, 8, 52);
  blitKenney(15, 8, 53);
  {
    const [bx0, by0] = cell(54);
    out.blitFrom(sharmThings, 0, 5 * 16, 16, 16, bx0, by0);
    const [bx1, by1] = cell(55);
    out.blitFrom(sharmThings, 16, 5 * 16, 16, 16, bx1, by1);
  }

  // 56,57: Resonance Shrine Top & Pedestal Base
  blitKenney(50, 9, 56);
  blitKenney(50, 11, 57);

  // 58,59,60: Supply Post Stall Awning Left/Right & Counter
  blitKenney(10, 1, 58);
  blitKenney(10, 2, 59);
  blitKenney(20, 3, 60);

  // 61: Moored Rowboat, 62: Fence H, 63: Fence V
  blitKenney(53, 18, 61);
  blitKenney(48, 24, 62);
  blitKenney(50, 23, 63);

  // 64..72: Cottage Roofs & Walls
  blitKenney(20, 22, 64); // Roof L
  blitKenney(21, 22, 65); // Roof M
  blitKenney(22, 22, 66); // Roof R
  blitKenney(46, 10, 67); // Greenhouse Sage Roof L
  blitKenney(47, 10, 68); // Greenhouse Sage Roof R
  blitKenney(13, 19, 69); // Wall L
  blitKenney(14, 19, 70);
  blitKenney(45, 2, 70); // Wall + Window
  blitKenney(14, 19, 71);
  blitKenney(45, 7, 71); // Wall + Door
  blitKenney(15, 19, 72); // Wall R

  // 73: Portal Trail Marker, 74: Hanging Lantern, 75,76: Stone Pillar Top/Base
  blitKenney(49, 21, 73);
  blitKenney(51, 17, 74);
  {
    const [px0, py0] = cell(75);
    out.blitFrom(sharmBasic, 3 * 16, 11 * 16, 16, 16, px0, py0);
    const [px1, py1] = cell(76);
    out.blitFrom(sharmBasic, 3 * 16, 12 * 16, 16, 16, px1, py1);
  }

  // 80..95 (Row 5): 16-state NESW Bitmask Organic Dirt Footpaths (N=1, E=2, S=4, W=8)
  const dirtMain = hexToRgba('#b88958');
  const dirtHi = hexToRgba('#c99c6b');
  const dirtEdge = hexToRgba('#8c6239');
  for (let mask = 0; mask < 16; mask++) {
    const idx = 80 + mask;
    putGrassBase(idx, (mask & 1) as 0 | 1);
    const [dx, dy] = cell(idx);
    const hasN = (mask & 1) !== 0;
    const hasE = (mask & 2) !== 0;
    const hasS = (mask & 4) !== 0;
    const hasW = (mask & 8) !== 0;

    for (let py = 0; py < 16; py++) {
      for (let px = 0; px < 16; px++) {
        const cx = px - 7.5;
        const cy = py - 7.5;
        let inDirt = Math.hypot(cx, cy) <= 5.8;
        if (hasN && py <= 8 && Math.abs(cx) <= 5.6) inDirt = true;
        if (hasS && py >= 7 && Math.abs(cx) <= 5.6) inDirt = true;
        if (hasW && px <= 8 && Math.abs(cy) <= 5.6) inDirt = true;
        if (hasE && px >= 7 && Math.abs(cy) <= 5.6) inDirt = true;
        // Fill inner corners when adjacent orthogonal neighbors are both road
        if (hasN && hasW && px <= 8 && py <= 8) inDirt = true;
        if (hasN && hasE && px >= 7 && py <= 8) inDirt = true;
        if (hasS && hasW && px <= 8 && py >= 7) inDirt = true;
        if (hasS && hasE && px >= 7 && py >= 7) inDirt = true;

        if (!inDirt) continue;

        const nearGrass =
          (!hasN && py <= 3) ||
          (!hasS && py >= 12) ||
          (!hasW && px <= 3) ||
          (!hasE && px >= 12);
        if (nearGrass && ((px + py) & 1) === 0) {
          out.setPixel(dx + px, dy + py, dirtEdge);
        } else if (((px * 5 + py * 3 + mask) % 11) === 0) {
          out.setPixel(dx + px, dy + py, dirtHi);
        } else if (((px * 7 + py * 13 + mask) % 17) === 0) {
          out.setPixel(dx + px, dy + py, dirtEdge);
        } else {
          out.setPixel(dx + px, dy + py, dirtMain);
        }
      }
    }
  }

  // 96..111 (Row 6): 16-state NESW Bitmask Organic Water Shorelines (N=1, E=2, S=4, W=8)
  const waterDeep = hexToRgba('#4a9bb5');
  const waterFoam = hexToRgba('#a8e6f0');
  const bankEarth = hexToRgba('#7d613f');
  for (let mask = 0; mask < 16; mask++) {
    const idx = 96 + mask;
    putGrassBase(idx, 0);
    const [dx, dy] = cell(idx);
    const hasN = (mask & 1) !== 0;
    const hasE = (mask & 2) !== 0;
    const hasS = (mask & 4) !== 0;
    const hasW = (mask & 8) !== 0;

    for (let py = 0; py < 16; py++) {
      for (let px = 0; px < 16; px++) {
        const cx = px - 7.5;
        const cy = py - 7.5;
        let inWater = Math.hypot(cx, cy) <= 6.2;
        if (hasN && py <= 8 && Math.abs(cx) <= 6.2) inWater = true;
        if (hasS && py >= 7 && Math.abs(cx) <= 6.2) inWater = true;
        if (hasW && px <= 8 && Math.abs(cy) <= 6.2) inWater = true;
        if (hasE && px >= 7 && Math.abs(cy) <= 6.2) inWater = true;
        if (hasN && hasW && px <= 8 && py <= 8) inWater = true;
        if (hasN && hasE && px >= 7 && py <= 8) inWater = true;
        if (hasS && hasW && px <= 8 && py >= 7) inWater = true;
        if (hasS && hasE && px >= 7 && py >= 7) inWater = true;

        if (!inWater) continue;

        const bankDist = Math.min(
          hasN ? 99 : py - 1,
          hasS ? 99 : 14 - py,
          hasW ? 99 : px - 1,
          hasE ? 99 : 14 - px,
        );
        if (bankDist <= 0) {
          out.setPixel(dx + px, dy + py, bankEarth);
        } else if (bankDist === 1) {
          out.setPixel(dx + px, dy + py, waterFoam);
        } else {
          out.setPixel(dx + px, dy + py, waterDeep);
        }
      }
    }
    if (mask === 15) {
      out.setPixel(dx + 4, dy + 5, waterFoam);
      out.setPixel(dx + 5, dy + 5, waterFoam);
      out.setPixel(dx + 11, dy + 11, waterFoam);
    }
  }

  return out.toPngBuffer();
}

// 2. Build 16x16 JRPG Characters Sheet (12 cols [down x3, up x3, left x3, right x3] x 6 rows) from Sharm CC-BY
function generateCharactersPng(): Buffer {
  const out = new PixelSurface(12 * 16, 6 * 16);

  // Sharm characters_1.png layout:
  // Char A (adventurer): cols 3..5, rows 0(down), 1(left), 2(right), 3(up)
  // Char B (scholar):    cols 6..8, rows 0(down), 1(left), 2(right), 3(up)
  const variants: ReadonlyArray<{
    baseCol: number;
    recolorClothing: (r: number, g: number, b: number) => Rgba;
  }> = [
    // 0: Player Naturalist (warm terracotta jacket)
    {
      baseCol: 3,
      recolorClothing: (r, g, b) =>
        b > r + 25 ? [Math.min(255, b + 25), Math.round(g * 0.85), Math.round(r * 0.7), 255] : [r, g, b, 255],
    },
    // 1: Lead Ranger Rowan (forest moss cloak)
    {
      baseCol: 3,
      recolorClothing: (r, g, b) =>
        b > r + 25 ? [Math.round(r * 0.75), Math.min(255, b + 5), Math.round(g * 0.8), 255] : [r, g, b, 255],
    },
    // 2: Botanist Linh / Sora / Amara / Lyra (scholar pond-blue & cream)
    {
      baseCol: 6,
      recolorClothing: (r, g, b) => [r, g, b, 255],
    },
    // 3: Quartermaster Tomas / Haru / Noah / Diego (golden ochre vest)
    {
      baseCol: 3,
      recolorClothing: (r, g, b) =>
        b > r + 25 ? [Math.min(255, b + 35), Math.min(255, Math.round(b * 0.78)), 52, 255] : [r, g, b, 255],
    },
    // 4: Trail Scout Mai / Elena / Orin (teal-sage tunic)
    {
      baseCol: 6,
      recolorClothing: (r, g, b) =>
        b > r + 20 ? [68, Math.min(255, Math.round(b * 0.92)), Math.round(b * 0.78), 255] : [r, g, b, 255],
    },
    // 5: Regional Wardens & Elder Astraea (crimson & gold mantle)
    {
      baseCol: 6,
      recolorClothing: (r, g, b) =>
        b > r + 20 ? [Math.min(255, Math.round(b * 0.95)), 58, 48, 255] : [r, g, b, 255],
    },
  ];

  // Map target dir order [down(0..2), up(3..5), left(6..8), right(9..11)] from Sharm rows [0, 3, 1, 2]
  const sharmDirRows = [0, 3, 1, 2];

  for (let rowIdx = 0; rowIdx < variants.length; rowIdx++) {
    const v = variants[rowIdx]!;
    for (let dirIdx = 0; dirIdx < 4; dirIdx++) {
      const sRow = sharmDirRows[dirIdx]!;
      for (let f = 0; f < 3; f++) {
        const sx = (v.baseCol + f) * 16;
        const sy = sRow * 16;
        const dx = (dirIdx * 3 + f) * 16;
        const dy = rowIdx * 16;

        for (let py = 0; py < 16; py++) {
          for (let px = 0; px < 16; px++) {
            const p = sharmChars.getPixel(sx + px, sy + py);
            if (p[3] === 0) continue;
            const mapped = v.recolorClothing(p[0], p[1], p[2]);
            out.setPixel(dx + px, dy + py, [mapped[0], mapped[1], mapped[2], p[3]]);
          }
        }
      }
    }
  }

  return out.toPngBuffer();
}

// 3. Build Detailed 48x48 Pixel-Art Wildkin Spritesheet (10 cols x 6 rows = 60 frames for 30 species)
function generateCreaturesPng(): Buffer {
  const cols = 10;
  const rows = 6;
  const size = 48;
  const s = new PixelSurface(cols * size, rows * size);

  const palettes: Record<
    CombatElement,
    { mid: Rgba; hi: Rgba; shade: Rgba; deep: Rgba; accent: Rgba; glow: Rgba }
  > = {
    leaf: {
      hi: hexToRgba('#9cd482'),
      mid: hexToRgba('#579c56'),
      shade: hexToRgba('#386e3d'),
      deep: hexToRgba('#234728'),
      accent: hexToRgba('#f2bd42'),
      glow: hexToRgba('#c5f099'),
    },
    ember: {
      hi: hexToRgba('#f7a263'),
      mid: hexToRgba('#d95f34'),
      shade: hexToRgba('#9c381c'),
      deep: hexToRgba('#5e1d10'),
      accent: hexToRgba('#fae06b'),
      glow: hexToRgba('#fff3a1'),
    },
    water: {
      hi: hexToRgba('#8fd3e8'),
      mid: hexToRgba('#3f89a6'),
      shade: hexToRgba('#295d75'),
      deep: hexToRgba('#193a4d'),
      accent: hexToRgba('#f5edd6'),
      glow: hexToRgba('#c4f2ff'),
    },
    stone: {
      hi: hexToRgba('#d4aa83'),
      mid: hexToRgba('#9e7453'),
      shade: hexToRgba('#6e4c34'),
      deep: hexToRgba('#452e1e'),
      accent: hexToRgba('#e36f42'),
      glow: hexToRgba('#f5c96b'),
    },
    gale: {
      hi: hexToRgba('#a8e0cc'),
      mid: hexToRgba('#5ca18d'),
      shade: hexToRgba('#3a6e60'),
      deep: hexToRgba('#22453c'),
      accent: hexToRgba('#f7f1df'),
      glow: hexToRgba('#d9fff2'),
    },
    spark: {
      hi: hexToRgba('#ffe073'),
      mid: hexToRgba('#e0a526'),
      shade: hexToRgba('#a67014'),
      deep: hexToRgba('#66420a'),
      accent: hexToRgba('#66d4eb'),
      glow: hexToRgba('#fff7b8'),
    },
  };

  const drawEye = (ex: number, ey: number, iris: Rgba = INK) => {
    s.fillRect(ex, ey, 3, 3, iris);
    s.setPixel(ex, ey, CREAM);
  };

  for (let i = 0; i < SPECIES.length; i++) {
    const sp = SPECIES[i]!;
    const p = palettes[sp.element];

    for (let frame = 0; frame < 2; frame++) {
      const idx = i * 2 + frame;
      const ox = (idx % cols) * size;
      const oy = Math.floor(idx / cols) * size;
      const bob = frame === 1 ? -2 : 0;
      const wingLift = frame === 1 ? -3 : 1;
      const sc = sp.stage === 1 ? 0.8 : sp.stage === 2 ? 0.96 : 1.14;

      const cx = ox + 24;
      const cy = oy + 28 + bob;

      // Crisp pixel shadow beneath creature
      s.fillEllipse(ox + 24, oy + 42, Math.round(12 * sc), 3.2, hexToRgba('#141c16', 110));

      if (sp.dexNumber <= 3) {
        // Family 1: Fern Lynx (Mosskit -> Briarpaw -> Verdantag)
        const rx = Math.round(9.5 * sc);
        const ry = Math.round(7.5 * sc);
        // Leafy plumed tail
        s.fillEllipse(cx + rx + 2, cy - 3 - frame, 6 * sc, 3.5 * sc, p.mid, p.shade);
        s.fillEllipse(cx + rx + 4, cy - 4 - frame, 3 * sc, 2 * sc, p.hi);
        // Back & front legs
        s.fillRect(cx - rx + 3, oy + 34, 4, 8, p.shade);
        s.fillRect(cx + rx - 6, oy + 34, 4, 8, p.shade);
        s.fillRect(cx - rx + 5, oy + 35, 4, 8, p.mid);
        // Dithered feline torso + cream chest ruff
        s.fillEllipse(cx + 1, cy + 1, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx - 3, cy + 1, rx * 0.55, ry * 0.72, p.glow);
        // Head, tufted lynx ears & stage-3 verdant antlers
        const hx = cx - Math.round(5 * sc);
        const hy = cy - Math.round(7 * sc);
        s.drawLine(hx - 5, hy - 3, hx - 9, hy - 10, 3, p.shade);
        s.drawLine(hx + 4, hy - 3, hx + 8, hy - 10, 3, p.shade);
        s.setPixel(hx - 8, hy - 9, p.accent);
        s.setPixel(hx + 7, hy - 9, p.accent);
        if (sp.stage === 3) {
          s.drawLine(hx - 2, hy - 6, hx - 4, hy - 14, 2, p.accent);
          s.drawLine(hx + 2, hy - 6, hx + 5, hy - 14, 2, p.accent);
        }
        s.fillEllipse(hx, hy, 7 * sc, 6 * sc, p.mid, p.shade);
        s.fillEllipse(hx - 1, hy - 2, 4.5 * sc, 2.5 * sc, p.hi);
        drawEye(hx - 5, hy - 1);
        drawEye(hx + 1, hy - 1);
        s.setPixel(hx - 2, hy + 2, p.accent);
      } else if (sp.dexNumber <= 6) {
        // Family 2: Hearth Fox (Kindlet -> Cinderfox -> Pyrelume)
        const rx = Math.round(9 * sc);
        const ry = Math.round(7 * sc);
        // Flowing multi-plume flame tail!
        s.fillEllipse(cx + rx + 3, cy - 4 - frame, 7 * sc, 5 * sc, p.mid, p.shade);
        s.fillEllipse(cx + rx + 4, cy - 5 - frame, 4.5 * sc, 3 * sc, p.accent);
        if (sp.stage >= 2) {
          s.fillEllipse(cx + rx + 1, cy - 9 - frame, 5 * sc, 3 * sc, p.hi);
        }
        s.fillRect(cx - 6, oy + 34, 3, 8, p.deep);
        s.fillRect(cx + 3, oy + 34, 3, 8, p.deep);
        s.fillEllipse(cx, cy + 1, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx - 4, cy + 2, rx * 0.5, ry * 0.65, CREAM);
        const hx = cx - Math.round(5 * sc);
        const hy = cy - Math.round(7 * sc);
        s.drawLine(hx - 4, hy - 3, hx - 7, hy - 11, 3, p.mid);
        s.drawLine(hx + 3, hy - 3, hx + 6, hy - 11, 3, p.mid);
        s.fillEllipse(hx, hy, 6.8 * sc, 5.5 * sc, p.hi, p.mid);
        s.fillEllipse(hx - 4, hy + 2, 3, 2, CREAM);
        drawEye(hx - 5, hy - 1);
        drawEye(hx + 1, hy - 1);
      } else if (sp.dexNumber <= 9) {
        // Family 3: Stream Otter (Ripplefin -> Brookotter -> Tidecrest)
        const rx = Math.round(9 * sc);
        const ry = Math.round(8.5 * sc);
        s.fillEllipse(cx + rx + 3, cy + 3, 6.5 * sc, 3 * sc, p.shade);
        s.fillEllipse(cx, cy, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx - 1, cy + 2, rx * 0.62, ry * 0.7, p.accent);
        if (sp.stage >= 2) {
          // Shell collar / wave crest
          s.fillEllipse(cx, cy - ry + 2, rx * 0.8, 2.5, p.glow);
        }
        const hx = cx - 1;
        const hy = cy - Math.round(8 * sc);
        s.fillEllipse(hx, hy, 6.8 * sc, 5.8 * sc, p.hi, p.mid);
        if (sp.stage === 3) {
          s.drawLine(hx, hy - 5, hx + 4, hy - 12, 3, p.glow);
        }
        drawEye(hx - 4, hy - 1);
        drawEye(hx + 2, hy - 1);
        s.fillRect(cx - 7, oy + 36, 5, 5, p.shade);
        s.fillRect(cx + 3, oy + 36, 5, 5, p.shade);
      } else if (sp.dexNumber <= 12 || sp.dexNumber === 28 || sp.dexNumber === 29) {
        // Avian & Celestial Owl Lines (10-12, 28-29)
        const rx = Math.round(7.5 * sc);
        const ry = Math.round(8 * sc);
        const isOwl = sp.dexNumber >= 28;
        // Outstretched layered wings
        s.fillEllipse(cx - rx - 3, cy + wingLift, 7 * sc, 4.5 * sc, p.shade);
        s.fillEllipse(cx + rx + 3, cy + wingLift, 7 * sc, 4.5 * sc, p.shade);
        s.fillEllipse(cx - rx - 2, cy + wingLift - 1, 5 * sc, 2.5 * sc, p.hi);
        s.fillEllipse(cx + rx + 2, cy + wingLift - 1, 5 * sc, 2.5 * sc, p.hi);
        s.fillEllipse(cx, cy + 1, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx, cy + 2, rx * 0.65, ry * 0.65, isOwl ? p.glow : p.accent);
        const hy = cy - Math.round(7 * sc);
        s.fillEllipse(cx, hy, 6.5 * sc, 5.8 * sc, p.mid, p.shade);
        if (isOwl) {
          s.fillEllipse(cx - 3, hy, 3, 3, CREAM);
          s.fillEllipse(cx + 3, hy, 3, 3, CREAM);
          s.drawLine(cx - 5, hy - 4, cx - 8, hy - 9, 2, p.accent);
          s.drawLine(cx + 5, hy - 4, cx + 8, hy - 9, 2, p.accent);
        } else if (sp.stage >= 2) {
          s.drawLine(cx, hy - 5, cx + 5, hy - 11, 2.5, p.accent);
        }
        drawEye(cx - 4, hy - 1);
        drawEye(cx + 2, hy - 1);
        s.fillRect(cx - 1, hy + 2, 3, 3, hexToRgba('#f2a93b'));
        s.fillRect(cx - 4, oy + 36, 2, 5, hexToRgba('#d98a2b'));
        s.fillRect(cx + 3, oy + 36, 2, 5, hexToRgba('#d98a2b'));
      } else if (sp.dexNumber <= 15) {
        // Woodland Beetle Line (Dewgrub -> Shellglow -> Canopyhorn)
        const rx = Math.round(10 * sc);
        const ry = Math.round(8 * sc);
        s.fillEllipse(cx, cy + 2, rx, ry, p.shade);
        s.fillEllipse(cx, cy, rx - 1, ry - 1, p.mid, p.shade);
        s.fillEllipse(cx - 2, cy - 2, rx * 0.55, ry * 0.4, p.hi);
        // Glowing bioluminescent lantern core
        s.fillEllipse(cx, cy, 4 * sc, 4 * sc, p.accent);
        s.fillEllipse(cx, cy, 2 * sc, 2 * sc, p.glow);
        if (sp.stage === 3) {
          s.drawLine(cx - 2, cy - ry, cx - 5, cy - ry - 10, 3, p.accent);
          s.drawLine(cx + 2, cy - ry, cx + 5, cy - ry - 10, 3, p.accent);
        }
        drawEye(cx - 5, cy + 1);
        drawEye(cx + 3, cy + 1);
      } else if (sp.dexNumber <= 17) {
        // Spark Hare Line (Voltkit -> Thundash)
        const rx = Math.round(8.5 * sc);
        const ry = Math.round(7.5 * sc);
        // Lightning bolt tail
        s.drawLine(cx + rx, cy + 2, cx + rx + 6, cy - 5, 3, p.accent);
        // Tall rabbit ears
        s.fillEllipse(cx - 4, cy - ry - 7, 2.8, 8 * sc, p.mid, p.shade);
        s.fillEllipse(cx + 3, cy - ry - 7, 2.8, 8 * sc, p.mid, p.shade);
        s.fillEllipse(cx - 4, cy - ry - 7, 1.3, 5 * sc, p.accent);
        s.fillEllipse(cx + 3, cy - ry - 7, 1.3, 5 * sc, p.accent);
        s.fillEllipse(cx, cy + 2, rx, ry, p.hi, p.mid);
        s.fillEllipse(cx - 2, cy + 3, rx * 0.55, ry * 0.55, CREAM);
        drawEye(cx - 4, cy - 2);
        drawEye(cx + 2, cy - 2);
        s.fillRect(cx - 6, oy + 36, 4, 5, p.shade);
        s.fillRect(cx + 3, oy + 36, 4, 5, p.shade);
      } else if (sp.dexNumber <= 20) {
        // Fen Chorus Frog -> Lotusbell Line (18-20)
        const rx = Math.round(10.5 * sc);
        const ry = Math.round(7.5 * sc);
        if (sp.stage >= 2) {
          // Lily pad & lotus crown on back
          s.fillEllipse(cx + 1, cy - ry + 1, 7 * sc, 2.5, hexToRgba('#4fa35a'));
        }
        if (sp.stage === 3) {
          s.fillEllipse(cx + 1, cy - ry - 3, 5.5, 4, hexToRgba('#f28ca6'));
          s.fillEllipse(cx + 1, cy - ry - 4, 3, 2.5, CREAM);
        }
        s.fillEllipse(cx, cy + 3, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx - 1, cy + 5, rx * 0.7, ry * 0.55, p.glow);
        // Prominent frog eyes
        s.fillEllipse(cx - 5, cy - ry + 4, 3.5, 3.5, p.hi);
        s.fillEllipse(cx + 4, cy - ry + 4, 3.5, 3.5, p.hi);
        drawEye(cx - 6, cy - ry + 3);
        drawEye(cx + 3, cy - ry + 3);
      } else if (sp.dexNumber <= 22) {
        // Lantern Minnow -> Surgecoil River Dragon-Eel (21-22)
        const rx = Math.round(11 * sc);
        const ry = Math.round(6 * sc);
        s.fillEllipse(cx + rx + 2, cy - frame, 4.5 * sc, 5.5 * sc, p.accent);
        s.fillEllipse(cx, cy, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx - 2, cy - 1, rx * 0.7, ry * 0.5, p.hi);
        // Angler lantern lure
        s.drawLine(cx - rx + 2, cy - 3, cx - rx - 4, cy - 9, 1.5, p.accent);
        s.fillEllipse(cx - rx - 5, cy - 9, 3, 3, p.glow);
        drawEye(cx - 6, cy - 1);
      } else if (sp.dexNumber <= 25) {
        // Terracotta Pangolin -> Kilnshell -> Cragbastion (23-25)
        const rx = Math.round(11.5 * sc);
        const ry = Math.round(8.5 * sc);
        s.fillRect(cx - 8, oy + 34, 5, 7, p.deep);
        s.fillRect(cx + 4, oy + 34, 5, 7, p.deep);
        // Domed armored terracotta carapace with plate ridges
        s.fillEllipse(cx + 1, cy, rx, ry, p.shade, p.deep);
        s.fillEllipse(cx + 1, cy - 1, rx - 2, ry - 2, p.mid, p.shade);
        s.fillRect(cx - rx + 3, cy + 2, rx * 2 - 4, 2, p.accent);
        if (sp.stage === 3) {
          // Mossy sanctuary stones atop Cragbastion!
          s.fillEllipse(cx + 1, cy - ry + 1, rx * 0.65, 3, hexToRgba('#579c56'));
          s.drawLine(cx + 4, cy - ry, cx + 6, cy - ry - 6, 3, p.accent);
        }
        s.fillEllipse(cx - rx - 1, cy + 2, 5 * sc, 4 * sc, p.hi);
        drawEye(cx - rx - 3, cy + 1);
      } else if (sp.dexNumber <= 27) {
        // Sunskink -> Flarecrest Canyon Drake (26-27)
        const rx = Math.round(10 * sc);
        const ry = Math.round(7 * sc);
        s.drawLine(cx + rx - 2, cy + 3, cx + rx + 8, cy - 3, 3.5, p.mid);
        s.fillEllipse(cx, cy + 2, rx, ry, p.mid, p.shade);
        const hx = cx - Math.round(6 * sc);
        const hy = cy - Math.round(5 * sc);
        // Radiant amber neck frill
        s.fillEllipse(hx + 2, hy, 7 * sc, 6.5 * sc, p.accent);
        s.fillEllipse(hx, hy + 1, 5.5 * sc, 4.2 * sc, p.hi);
        drawEye(hx - 3, hy);
        s.fillRect(cx - 6, oy + 35, 4, 6, p.shade);
        s.fillRect(cx + 3, oy + 35, 4, 6, p.shade);
      } else {
        // #30: Solacern Sanctuary Harmony Stag
        s.fillRect(cx - 6, oy + 29, 3, 12, p.shade);
        s.fillRect(cx + 5, oy + 29, 3, 12, p.shade);
        s.fillEllipse(cx + 1, cy + 1, 11, 6.5, CREAM, p.hi);
        s.fillEllipse(cx + 11, cy - 2, 4, 2.5, p.accent);
        // Graceful neck & head
        s.drawLine(cx - 6, cy, cx - 8, cy - 10, 5, CREAM);
        s.fillEllipse(cx - 9, cy - 11, 5.5, 4.2, CREAM);
        // Branching crystalline star-antlers!
        s.drawLine(cx - 9, cy - 14, cx - 14, cy - 24, 2, p.accent);
        s.drawLine(cx - 12, cy - 19, cx - 16, cy - 20, 2, p.glow);
        s.drawLine(cx - 6, cy - 14, cx - 2, cy - 24, 2, p.accent);
        s.drawLine(cx - 4, cy - 19, cx + 1, cy - 20, 2, p.glow);
        drawEye(cx - 11, cy - 12);
      }

      s.outlineRegion(ox, oy, size, size, INK);
    }
  }

  return s.toPngBuffer();
}

// 4. Build 16x16 Item Icons Sheet (16 cols x 1 row) combining Kenney CC0 flasks/scrolls & bells
function generateItemsPng(): Buffer {
  const s = new PixelSurface(16 * 16, 16);
  const charmColors: ReadonlyArray<[Rgba, Rgba]> = [
    [hexToRgba('#579c56'), hexToRgba('#f2bd42')],
    [hexToRgba('#3f89a6'), CREAM],
    [hexToRgba('#d95f34'), hexToRgba('#fae06b')],
    [hexToRgba('#66d4eb'), hexToRgba('#fff3a1')],
  ];

  // 0..3: 4 Resonance Chimes
  for (let i = 0; i < 4; i++) {
    const ox = i * 16;
    const [main, acc] = charmColors[i]!;
    s.fillRect(ox + 6, 2, 4, 2, acc);
    s.fillEllipse(ox + 8, 8, 5, 4.5, main);
    s.fillRect(ox + 3, 10, 10, 2, acc);
    s.fillRect(ox + 7, 12, 2, 2, acc);
    s.outlineRegion(ox, 0, 16, 16, INK);
  }

  // 4..6: Kenney CC0 Potion Flasks (54,11; 55,11; 56,11)
  s.blitFrom(kenney, 54 * 17, 11 * 17, 16, 16, 4 * 16, 0);
  s.blitFrom(kenney, 55 * 17, 11 * 17, 16, 16, 5 * 16, 0);
  s.blitFrom(kenney, 56 * 17, 11 * 17, 16, 16, 6 * 16, 0);

  // 7: Clearleaf Herb (Kenney plant 30,9), 8: Breeze Tea teapot (Kenney 55,15), 9: Cedar Lantern (Kenney 51,17)
  s.blitFrom(kenney, 30 * 17, 9 * 17, 16, 16, 7 * 16, 0);
  s.blitFrom(kenney, 55 * 17, 15 * 17, 16, 16, 8 * 16, 0);
  s.blitFrom(kenney, 51 * 17, 17 * 17, 16, 16, 9 * 16, 0);

  // 10..12: Story Key Emblems (Kenney shields/crests 50,8; 42,18; 50,9)
  s.blitFrom(kenney, 50 * 17, 8 * 17, 16, 16, 10 * 16, 0);
  s.blitFrom(kenney, 42 * 17, 18 * 17, 16, 16, 11 * 16, 0);
  s.blitFrom(kenney, 50 * 17, 9 * 17, 16, 16, 12 * 16, 0);

  return s.toPngBuffer();
}

// 5. Build 32x32 Elemental Combat & Chime Capture VFX Sheet (8 cols x 1 row)
function generateVfxPng(): Buffer {
  const s = new PixelSurface(8 * 32, 32);

  // 0: Leaf razor swirl
  s.fillEllipse(16, 16, 10, 4, hexToRgba('#579c56'));
  s.fillEllipse(16, 16, 4, 10, hexToRgba('#9cd482'));
  s.outlineRegion(0, 0, 32, 32, INK);

  // 1: Water splash burst
  s.fillEllipse(32 + 16, 16, 10, 10, hexToRgba('#3f89a6'));
  s.fillEllipse(32 + 16, 16, 6, 6, hexToRgba('#c4f2ff'));
  s.outlineRegion(32, 0, 32, 32, INK);

  // 2: Ember flame burst
  s.fillEllipse(64 + 16, 17, 10, 11, hexToRgba('#d95f34'));
  s.fillEllipse(64 + 16, 18, 6, 7, hexToRgba('#fae06b'));
  s.outlineRegion(64, 0, 32, 32, INK);

  // 3: Stone crystal spikes
  s.drawLine(96 + 10, 26, 96 + 13, 8, 4, hexToRgba('#9e7453'));
  s.drawLine(96 + 18, 26, 96 + 21, 6, 4, hexToRgba('#d4aa83'));
  s.outlineRegion(96, 0, 32, 32, INK);

  // 4: Gale wind arc
  s.drawLine(128 + 6, 22, 128 + 26, 8, 3, hexToRgba('#a8e0cc'));
  s.drawLine(128 + 8, 26, 128 + 26, 14, 2, CREAM);
  s.outlineRegion(128, 0, 32, 32, INK);

  // 5: Spark lightning bolt
  s.drawLine(160 + 18, 4, 160 + 11, 16, 3, hexToRgba('#ffe073'));
  s.drawLine(160 + 11, 16, 160 + 20, 16, 3, hexToRgba('#ffe073'));
  s.drawLine(160 + 20, 16, 160 + 12, 28, 3, hexToRgba('#66d4eb'));
  s.outlineRegion(160, 0, 32, 32, INK);

  // 6: Neutral impact star
  s.drawLine(192 + 6, 16, 192 + 26, 16, 3, CREAM);
  s.drawLine(192 + 16, 6, 192 + 16, 26, 3, CREAM);
  s.outlineRegion(192, 0, 32, 32, INK);

  // 7: Golden Resonance Chime Bell
  s.fillEllipse(224 + 16, 15, 8, 8, hexToRgba('#f2bd42'));
  s.fillRect(224 + 8, 20, 16, 3, hexToRgba('#fff3a1'));
  s.outlineRegion(224, 0, 32, 32, INK);

  return s.toPngBuffer();
}

const outDir = path.join(ROOT, 'public', 'assets', 'sprites');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'tileset.png'), generateTilesetPng());
fs.writeFileSync(path.join(outDir, 'characters.png'), generateCharactersPng());
fs.writeFileSync(path.join(outDir, 'creatures.png'), generateCreaturesPng());
fs.writeFileSync(path.join(outDir, 'items.png'), generateItemsPng());
fs.writeFileSync(path.join(outDir, 'vfx.png'), generateVfxPng());

console.log(
  'Built verified open-asset & pixel-art atlases in public/assets/sprites/ (tileset.png, characters.png, creatures.png, items.png, vfx.png).',
);
