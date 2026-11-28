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
    let colorType = 6;
    const idatParts: Buffer[] = [];

    while (offset < buf.length) {
      const length = buf.readUInt32BE(offset);
      const type = buf.toString('ascii', offset + 4, offset + 8);
      const chunkData = buf.subarray(offset + 8, offset + 8 + length);
      if (type === 'IHDR') {
        width = chunkData.readUInt32BE(0);
        height = chunkData.readUInt32BE(4);
        const bitDepth = chunkData[8];
        colorType = chunkData[9]!;
        if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
          throw new Error(
            `Expected 8-bit RGB/RGBA PNG in ${filePath}, got depth=${bitDepth} type=${colorType}`,
          );
        }
      } else if (type === 'IDAT') {
        idatParts.push(chunkData);
      } else if (type === 'IEND') {
        break;
      }
      offset += 12 + length;
    }

    const inflated = zlib.inflateSync(Buffer.concat(idatParts));
    const bpp = colorType === 6 ? 4 : 3;
    const rowBytes = width * bpp;
    const rawRecon = new Uint8Array(width * height * bpp);

    for (let y = 0; y < height; y++) {
      const filterType = inflated[y * (rowBytes + 1)]!;
      const srcRowOffset = y * (rowBytes + 1) + 1;
      const dstRowOffset = y * rowBytes;

      for (let i = 0; i < rowBytes; i++) {
        const rawByte = inflated[srcRowOffset + i]!;
        const left = i >= bpp ? rawRecon[dstRowOffset + i - bpp]! : 0;
        const up = y > 0 ? rawRecon[dstRowOffset - rowBytes + i]! : 0;
        const upLeft = y > 0 && i >= bpp ? rawRecon[dstRowOffset - rowBytes + i - bpp]! : 0;

        let recon = rawByte;
        if (filterType === 1) recon = (rawByte + left) & 0xff;
        else if (filterType === 2) recon = (rawByte + up) & 0xff;
        else if (filterType === 3) recon = (rawByte + ((left + up) >> 1)) & 0xff;
        else if (filterType === 4) recon = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;
        rawRecon[dstRowOffset + i] = recon;
      }
    }

    if (bpp === 4) {
      return new PixelSurface(width, height, rawRecon);
    }

    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0, j = 0; i < rawRecon.length; i += 3, j += 4) {
      rgba[j] = rawRecon[i]!;
      rgba[j + 1] = rawRecon[i + 1]!;
      rgba[j + 2] = rawRecon[i + 2]!;
      rgba[j + 3] = 255;
    }
    return new PixelSurface(width, height, rgba);
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
    tint?: { rMul: number; gMul: number; bMul: number; aMul?: number },
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
            Math.min(255, Math.round(col[3] * (tint.aMul ?? 1))),
          ];
        }
        this.blendPixel(dx + px, dy + py, col);
      }
    }
  }

  public blitScaled(
    src: PixelSurface,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    tint?: { rMul: number; gMul: number; bMul: number; aMul?: number },
    chromaKey?: Rgba,
  ): void {
    for (let py = 0; py < dh; py++) {
      const srcY = sy + Math.min(sh - 1, Math.floor((py * sh) / dh));
      for (let px = 0; px < dw; px++) {
        const srcX = sx + Math.min(sw - 1, Math.floor((px * sw) / dw));
        let col = src.getPixel(srcX, srcY);
        if (col[3] === 0) continue;
        if (
          chromaKey &&
          Math.abs(col[0] - chromaKey[0]) <= 6 &&
          Math.abs(col[1] - chromaKey[1]) <= 6 &&
          Math.abs(col[2] - chromaKey[2]) <= 6
        ) {
          continue;
        }
        if (tint) {
          col = [
            Math.min(255, Math.round(col[0] * tint.rMul)),
            Math.min(255, Math.round(col[1] * tint.gMul)),
            Math.min(255, Math.round(col[2] * tint.bMul)),
            Math.min(255, Math.round(col[3] * (tint.aMul ?? 1))),
          ];
        }
        this.blendPixel(dx + px, dy + py, col);
      }
    }
  }

  public fillRect(x: number, y: number, w: number, h: number, color: Rgba): void {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.blendPixel(px, py, color);
      }
    }
  }

  public fillEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: Rgba,
    shadeColor?: Rgba,
  ): void {
    const minX = Math.floor(cx - rx - 1);
    const maxX = Math.ceil(cx + rx + 1);
    const minY = Math.floor(cy - ry - 1);
    const maxY = Math.ceil(cy + ry + 1);
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const nx = (px + 0.5 - cx) / Math.max(0.5, rx);
        const ny = (py + 0.5 - cy) / Math.max(0.5, ry);
        if (nx * nx + ny * ny <= 1) {
          if (shadeColor && (ny > 0.32 || (nx > 0.35 && ((px + py) & 1) === 0))) {
            this.blendPixel(px, py, shadeColor);
          } else {
            this.blendPixel(px, py, color);
          }
        }
      }
    }
  }

  public drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    thickness: number,
    color: Rgba,
  ): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    const r = Math.max(0.5, thickness / 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      this.fillEllipse(x, y, r, r, color);
    }
  }

  public outlineRegion(rx: number, ry: number, rw: number, rh: number, outlineColor: Rgba): void {
    const mask = new Uint8Array(rw * rh);
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const a = this.getPixel(rx + x, ry + y)[3];
        if (a > 200) mask[y * rw + x] = 1;
      }
    }
    const dirs: ReadonlyArray<[number, number]> = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        if (mask[y * rw + x] === 1) continue;
        // Skip contact shadow band near very bottom
        if (y >= rh - 5 && this.getPixel(rx + x, ry + y)[3] > 0) continue;
        let touchesOpaque = false;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < rw && ny >= 0 && ny < rh && mask[ny * rw + nx] === 1) {
            touchesOpaque = true;
            break;
          }
        }
        if (touchesOpaque) {
          this.setPixel(rx + x, ry + y, outlineColor);
        }
      }
    }
  }

  public toPngBuffer(): Buffer {
    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }

    const crc32 = (buf: Buffer): number => {
      let c = 0xffffffff;
      for (let i = 0; i < buf.length; i++) {
        c = crcTable[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
      }
      return (c ^ 0xffffffff) >>> 0;
    };

    const makeChunk = (type: string, payload: Buffer): Buffer => {
      const chunk = Buffer.alloc(12 + payload.length);
      chunk.writeUInt32BE(payload.length, 0);
      chunk.write(type, 4, 4, 'ascii');
      payload.copy(chunk, 8);
      const crc = crc32(chunk.subarray(4, 8 + payload.length));
      chunk.writeUInt32BE(crc, 8 + payload.length);
      return chunk;
    };

    const rowBytes = this.width * 4;
    const raw = Buffer.alloc(this.height * (rowBytes + 1));
    for (let y = 0; y < this.height; y++) {
      raw[y * (rowBytes + 1)] = 0;
      Buffer.from(this.data.buffer, this.data.byteOffset + y * rowBytes, rowBytes).copy(
        raw,
        y * (rowBytes + 1) + 1,
      );
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const compressed = zlib.deflateSync(raw, { level: 9 });
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      makeChunk('IHDR', ihdr),
      makeChunk('IDAT', compressed),
      makeChunk('IEND', Buffer.alloc(0)),
    ]);
  }
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
const armmOverworld = PixelSurface.fromPngFile(
  path.join(ROOT, 'assets-src', 'armm-zelda-cc0', 'Overworld.png'),
);
const armmObjects = PixelSurface.fromPngFile(
  path.join(ROOT, 'assets-src', 'armm-zelda-cc0', 'objects.png'),
);

const INK = hexToRgba('#1b1917');
const CREAM = hexToRgba('#f6eed9');

// 1. Build Multi-Layer 16x16 Tileset Atlas (16 cols x 8 rows = 128 tiles) from Kenney CC0 + Sharm CC-BY + ArMM1998 CC0
function generateTilesetPng(): Buffer {
  const cols = 16;
  const rows = 8;
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

  // Richer, textured meadow grass blending Kenney + subtle clover/blade depth so maps never look flat
  const grassTint = { rMul: 0.84, gMul: 0.91, bMul: 0.85 };
  const putGrassBase = (idx: number, variant: 0 | 1 = 0) => {
    blitKenney(5, variant, idx, grassTint);
    const [dx, dy] = cell(idx);
    const tuftShade = hexToRgba('#3d7540', 115);
    const tuftLight = hexToRgba('#7fc276', 110);
    if (variant === 0) {
      out.blendPixel(dx + 3, dy + 6, tuftShade);
      out.blendPixel(dx + 4, dy + 5, tuftLight);
      out.blendPixel(dx + 12, dy + 13, tuftShade);
    } else {
      out.blendPixel(dx + 6, dy + 3, tuftLight);
      out.blendPixel(dx + 10, dy + 10, tuftShade);
      out.blendPixel(dx + 11, dy + 9, tuftLight);
    }
  };

  putGrassBase(0, 0);
  putGrassBase(1, 1);

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
  drawFlowerCluster(4, hexToRgba('#6bb8f0'), hexToRgba('#a2dcff'), hexToRgba('#fff6ba'), [
    [4, 8],
    [10, 4],
    [11, 12],
  ]);

  const drawTallGrassBlades = (idx: number, sway: number) => {
    const [dx, dy] = cell(idx);
    const dark = hexToRgba('#1f4f2b');
    const mid = hexToRgba('#387d44');
    const tip = hexToRgba('#8cd47e');
    for (const bx of [2, 5, 8, 11, 13]) {
      const h = bx % 2 === 0 ? 7 : 6;
      for (let step = 0; step < h; step++) {
        const shift = step >= 4 ? sway : 0;
        const col = step >= h - 2 ? tip : step >= 2 ? mid : dark;
        out.setPixel(dx + bx + shift, dy + 14 - step, col);
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

  // 7 & 8: sparkling animated water frames
  blitKenney(0, 0, 7, { rMul: 0.8, gMul: 0.92, bMul: 0.98 });
  blitKenney(1, 0, 8, { rMul: 0.8, gMul: 0.92, bMul: 0.98 });

  const waterRimTint = { rMul: 0.86, gMul: 0.93, bMul: 0.94 };
  blitKenney(3, 0, 9, waterRimTint);
  blitKenney(3, 2, 10, waterRimTint);
  blitKenney(2, 1, 11, waterRimTint);
  blitKenney(4, 1, 12, waterRimTint);
  blitKenney(2, 0, 13, waterRimTint);
  blitKenney(4, 0, 14, waterRimTint);
  blitKenney(2, 2, 15, waterRimTint);
  blitKenney(4, 2, 16, waterRimTint);

  const roadCoords: ReadonlyArray<[number, number, number]> = [
    [6, 8, 17],
    [6, 7, 18],
    [6, 9, 19],
    [5, 8, 20],
    [7, 8, 21],
    [5, 7, 22],
    [7, 7, 23],
    [5, 9, 24],
    [7, 9, 25],
  ];
  for (const [kc, kr, idx] of roadCoords) {
    putGrassBase(idx, 0);
    blitKenney(kc, kr, idx);
  }

  // 26: wooden plank bridge over water
  blitKenney(0, 0, 26, { rMul: 0.8, gMul: 0.9, bMul: 0.96 });
  blitKenney(6, 4, 26);

  // 27: seamless warm canyon sand, 28: terracotta ground, 29: carved village limestone flagstones
  {
    const [dx, dy] = cell(27);
    const sandBase = hexToRgba('#dfbe92');
    const sandLight = hexToRgba('#ebd0a7');
    const sandShade = hexToRgba('#c7a274');
    out.fillRect(dx, dy, 16, 16, sandBase);
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
    const stoneLight = hexToRgba('#ddd6c7');
    const mortar = hexToRgba('#aba190');
    out.fillRect(dx, dy, 16, 16, stoneBase);
    out.fillRect(dx + 1, dy + 1, 6, 6, stoneLight);
    out.fillRect(dx + 9, dy + 9, 6, 5, stoneLight);
    out.fillRect(dx, dy + 7, 16, 1, mortar);
    out.fillRect(dx, dy + 15, 16, 1, mortar);
    out.fillRect(dx + 7, dy, 1, 7, mortar);
    out.fillRect(dx + 12, dy + 8, 1, 7, mortar);
    out.setPixel(dx + 3, dy + 11, mortar);
    out.setPixel(dx + 10, dy + 3, mortar);
  }

  // 30 & 31: misty reed marsh (2 sway frames)
  const drawMarshReeds = (idx: number, sway: number) => {
    const [dx, dy] = cell(idx);
    const stalk = hexToRgba('#2d6338');
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
  blitKenney(0, 0, 30, { rMul: 0.68, gMul: 0.85, bMul: 0.8 });
  blitKenney(21, 10, 30);
  drawMarshReeds(30, 0);
  blitKenney(1, 0, 31, { rMul: 0.68, gMul: 0.85, bMul: 0.8 });
  {
    const [dx, dy] = cell(31);
    out.blitFrom(kenney, 21 * 17, 10 * 17, 15, 16, dx + 1, dy);
  }
  drawMarshReeds(31, 1);

  // 32: rock crag wall, 33: stratified terracotta cliff face, 34: sandstone cliff rim lip, 35: carved stone stairs
  {
    const [dx, dy] = cell(32);
    out.blitFrom(sharmBasic, 7 * 16, 1 * 16, 16, 16, dx, dy);
    const [cxFace, cyFace] = cell(33);
    out.blitFrom(sharmBasic, 0, 9 * 16, 16, 16, cxFace, cyFace, {
      rMul: 1.28,
      gMul: 0.94,
      bMul: 0.76,
    });
    out.fillRect(cxFace, cyFace + 14, 16, 2, hexToRgba('#4f2617', 150));

    const [cxTop, cyTop] = cell(34);
    out.blitFrom(sharmBasic, 0, 9 * 16, 16, 16, cxTop, cyTop, {
      rMul: 1.28,
      gMul: 0.94,
      bMul: 0.76,
    });
    // Crisp sunlit canyon sandstone lip along top 5px + dark overhang crease
    out.fillRect(cxTop, cyTop, 16, 3, hexToRgba('#dfbe92'));
    out.fillRect(cxTop, cyTop + 3, 16, 2, hexToRgba('#ebd0a7'));
    out.fillRect(cxTop, cyTop + 5, 16, 1, hexToRgba('#5e2d1a'));

    const [sx, sy] = cell(35);
    out.blitFrom(sharmBasic, 0, 7 * 16, 16, 16, sx, sy);
  }

  // 36..43: Richer 2-high multi-layer trees with deep foliage contrast & trunk shadow
  blitKenney(13, 10, 36, { rMul: 0.9, gMul: 0.96, bMul: 0.88 });
  blitKenney(13, 11, 37, { rMul: 0.9, gMul: 0.96, bMul: 0.88 });
  blitKenney(15, 10, 38, { rMul: 0.82, gMul: 0.92, bMul: 0.86 });
  blitKenney(15, 11, 39, { rMul: 0.82, gMul: 0.92, bMul: 0.86 });
  blitKenney(14, 10, 40, { rMul: 1.04, gMul: 0.92, bMul: 0.78 });
  blitKenney(14, 11, 41, { rMul: 1.04, gMul: 0.92, bMul: 0.78 });
  blitKenney(18, 10, 42, { rMul: 0.76, gMul: 0.92, bMul: 1.15 });
  blitKenney(18, 11, 43, { rMul: 0.76, gMul: 0.92, bMul: 1.15 });
  {
    const [sx, sy] = cell(42);
    out.setPixel(sx + 6, sy + 5, hexToRgba('#f7df7c'));
    out.setPixel(sx + 10, sy + 9, hexToRgba('#9ce8ff'));
  }

  // 44: lush round ArMM1998 shrub, 45: mossy stump, 46: waterlily pad, 47: Sharm field boulders
  {
    const [b0, b1] = cell(44);
    out.blitFrom(armmOverworld, 1 * 16, 16 * 16, 16, 16, b0, b1);
    const [s0, s1] = cell(45);
    out.blitFrom(armmObjects, 0, 9 * 16, 16, 16, s0, s1);
  }
  blitKenney(25, 11, 46);
  {
    const [r0, r1] = cell(47);
    out.blitFrom(sharmBasic, 2 * 16, 7 * 16, 16, 16, r0, r1);
  }

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

  // 61: Moored Rowboat, 62: Wooden Ranch Fence H, 63: Wooden Ranch Fence V
  blitKenney(53, 18, 61);
  {
    const [fhX, fhY] = cell(62);
    const postDark = hexToRgba('#4a2f1b');
    const postWood = hexToRgba('#8f5e36');
    const railLight = hexToRgba('#b88252');
    // Two sturdy fence posts + upper and lower horizontal wooden rails
    out.fillRect(fhX, fhY + 5, 16, 3, postDark);
    out.fillRect(fhX, fhY + 6, 16, 2, railLight);
    out.fillRect(fhX, fhY + 10, 16, 3, postDark);
    out.fillRect(fhX, fhY + 11, 16, 2, postWood);
    for (const px of [2, 11]) {
      out.fillRect(fhX + px, fhY + 2, 4, 13, postDark);
      out.fillRect(fhX + px + 1, fhY + 3, 2, 11, postWood);
      out.fillRect(fhX + px + 1, fhY + 3, 2, 2, railLight);
    }

    const [fvX, fvY] = cell(63);
    out.fillRect(fvX + 6, fvY, 4, 16, postDark);
    out.fillRect(fvX + 7, fvY, 2, 16, postWood);
    for (const py of [2, 10]) {
      out.fillRect(fvX + 5, fvY + py, 6, 5, postDark);
      out.fillRect(fvX + 6, fvY + py + 1, 4, 3, railLight);
    }
  }

  // 64..72: Legacy Cottage Roofs & Walls (kept for backward compatibility)
  blitKenney(20, 22, 64);
  blitKenney(21, 22, 65);
  blitKenney(22, 22, 66);
  blitKenney(46, 10, 67);
  blitKenney(47, 10, 68);
  blitKenney(13, 19, 69);
  blitKenney(14, 19, 70);
  blitKenney(45, 2, 70);
  blitKenney(14, 19, 71);
  blitKenney(45, 7, 71);
  blitKenney(15, 19, 72);

  // 73: Portal Trail Marker, 74: Hanging Lantern, 75,76: Stone Pillar Top/Base
  blitKenney(49, 21, 73);
  blitKenney(51, 17, 74);
  {
    const [px0, py0] = cell(75);
    out.blitFrom(sharmBasic, 3 * 16, 11 * 16, 16, 16, px0, py0);
    const [px1, py1] = cell(76);
    out.blitFrom(sharmBasic, 3 * 16, 12 * 16, 16, 16, px1, py1);
  }

  // 77: Creature Habitat Trace icon (glowing pawprints & feather clue on grass!)
  {
    const [tx, ty] = cell(77);
    const glow = hexToRgba('#ffe98a');
    const amber = hexToRgba('#d98a2b');
    const ring = hexToRgba('#4f3619', 180);
    // Two distinct diagonal animal pawprints + sparkle mote
    for (const [px, py] of [
      [5, 11],
      [10, 6],
    ] as const) {
      out.fillEllipse(tx + px, ty + py, 2.2, 1.8, ring);
      out.fillRect(tx + px - 1, ty + py, 2, 2, amber);
      out.setPixel(tx + px - 2, ty + py - 2, glow);
      out.setPixel(tx + px, ty + py - 3, glow);
      out.setPixel(tx + px + 2, ty + py - 2, glow);
    }
    out.setPixel(tx + 13, ty + 3, hexToRgba('#ffffff'));
    out.setPixel(tx + 3, ty + 4, glow);
  }

  // 78: Sanctuary dark slate floor tile, 79: Mossy ancient woodland & wetland flagstones (Sharm CC-BY)
  {
    const [sx, sy] = cell(78);
    const slate = hexToRgba('#353f54');
    const slateHi = hexToRgba('#46536e');
    const runeSeam = hexToRgba('#232a38');
    const moss = hexToRgba('#4b7a5e');
    out.fillRect(sx, sy, 16, 16, slate);
    out.fillRect(sx + 1, sy + 1, 6, 6, slateHi);
    out.fillRect(sx + 9, sy + 9, 6, 5, slateHi);
    out.fillRect(sx, sy + 7, 16, 1, runeSeam);
    out.fillRect(sx, sy + 15, 16, 1, runeSeam);
    out.fillRect(sx + 7, sy, 1, 7, runeSeam);
    out.fillRect(sx + 12, sy + 8, 1, 7, runeSeam);
    out.setPixel(sx + 1, sy + 7, moss);
    out.setPixel(sx + 12, sy + 14, moss);

    const [mx, my] = cell(79);
    out.blitFrom(sharmBasic, 6 * 16, 1 * 16, 16, 16, mx, my);
  }

  // 80..95 (Row 5): 16-state NESW Bitmask Organic Dirt Footpaths with pebble shading
  const dirtMain = hexToRgba('#b88958');
  const dirtHi = hexToRgba('#cfa270');
  const dirtEdge = hexToRgba('#805831');
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
        } else if ((px * 5 + py * 3 + mask) % 11 === 0) {
          out.setPixel(dx + px, dy + py, dirtHi);
        } else if ((px * 7 + py * 13 + mask) % 17 === 0) {
          out.setPixel(dx + px, dy + py, dirtEdge);
        } else {
          out.setPixel(dx + px, dy + py, dirtMain);
        }
      }
    }
  }

  // 96..111 (Row 6): 16-state NESW Bitmask Organic Water Shorelines
  const waterDeep = hexToRgba('#3d8ca8');
  const waterFoam = hexToRgba('#a8e6f0');
  const bankEarth = hexToRgba('#6e5334');
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

  // Row 7 (112..127): Wetland timber boardwalk planks, olive marsh mud, potted flowers, barrels, crates, waterfall frames
  // 112: full-tile warm timber boardwalk planks with cross-beams and nail heads (Sharm CC-BY wood base)
  {
    const [bx, by] = cell(112);
    out.blitFrom(sharmBasic, 0, 2 * 16, 16, 16, bx, by, {
      rMul: 0.96,
      gMul: 0.9,
      bMul: 0.82,
    });
    const railTrim = hexToRgba('#593a20');
    const nail = hexToRgba('#382312');
    out.fillRect(bx, by, 16, 1, railTrim);
    out.fillRect(bx, by + 15, 16, 1, railTrim);
    for (const nx of [2, 6, 10, 14]) {
      out.setPixel(bx + nx, by + 2, nail);
      out.setPixel(bx + nx, by + 13, nail);
    }
    // 113: mossy wetland mud ground
    const [mx, my] = cell(113);
    const mudA = hexToRgba('#4a6946');
    const mudB = hexToRgba('#3b5739');
    const puddle = hexToRgba('#38778a');
    out.fillRect(mx, my, 16, 16, mudA);
    out.fillEllipse(mx + 5, my + 6, 3.5, 2, mudB);
    out.fillEllipse(mx + 11, my + 12, 3, 1.8, puddle);
    // 114: potted flowerbox (ArMM1998 col 26, row 20)
    const [fx, fy] = cell(114);
    out.blitFrom(armmOverworld, 26 * 16, 20 * 16, 16, 16, fx, fy);
    // 115: wooden barrel (ArMM1998 col 33, row 0)
    const [brX, brY] = cell(115);
    out.blitFrom(armmOverworld, 33 * 16, 0, 16, 16, brX, brY);
    // 116: wooden crate (ArMM1998 col 21, row 20)
    const [crX, crY] = cell(116);
    out.blitFrom(armmOverworld, 21 * 16, 20 * 16, 16, 16, crX, crY);
    // 117, 118: animated waterfall foam tiles
    const [wf0X, wf0Y] = cell(117);
    out.blitFrom(armmOverworld, 19 * 16, 6 * 16, 16, 16, wf0X, wf0Y);
    const [wf1X, wf1Y] = cell(118);
    out.blitFrom(armmOverworld, 19 * 16, 7 * 16, 16, 16, wf1X, wf1Y);
  }

  return out.toPngBuffer();
}

// 1b. Build Artist Multi-Tile Architectural & Scenic Props Atlas (structures.png: 256 x 256) from ArMM1998 CC0
function generateStructuresPng(): Buffer {
  const out = new PixelSurface(256, 256);

  // (0, 0, 80x80): 5x5 Timber Lodge Cottage (ArMM1998 cols 6..10, rows 0..4)
  out.blitFrom(armmOverworld, 6 * 16, 0, 80, 80, 0, 0);

  // (80, 0, 32x48): 2x3 Botanist Cabin (ArMM1998 cols 13..14, rows 5..7)
  out.blitFrom(armmOverworld, 13 * 16, 5 * 16, 32, 48, 80, 0);

  // (112, 0, 80x80): 5x5 Market Stall with Warm Terracotta-and-Cream Striped Awning (ArMM1998 cols 18..22, rows 22..26)
  for (let py = 0; py < 80; py++) {
    for (let px = 0; px < 80; px++) {
      const p = armmOverworld.getPixel(18 * 16 + px, 22 * 16 + py);
      if (p[3] === 0) continue;
      // Harmonize bright blue awning stripes into LingoWild warm terracotta/amber while keeping wood & cream intact
      if (p[2] > p[0] + 35) {
        out.setPixel(112 + px, py, [
          Math.min(255, Math.round(p[2] * 0.92)),
          Math.round(p[1] * 0.58),
          Math.round(p[0] * 0.65),
          p[3],
        ]);
      } else {
        out.setPixel(112 + px, py, p);
      }
    }
  }

  // (192, 0, 64x64): 4x4 Carved Sanctuary Stone Archway (ArMM1998 cols 4..7, rows 31..34)
  out.blitFrom(armmOverworld, 4 * 16, 31 * 16, 64, 64, 192, 0);

  // (0, 80, 144x48): 3 frames of 3x3 (48x48) Animated Stone Village Fountain (ArMM1998 cols 22..30, rows 9..11)
  out.blitFrom(armmOverworld, 22 * 16, 9 * 16, 144, 48, 0, 80);

  // (144, 80, 48x32): 3x2 Wooden Park Bench (ArMM1998 cols 28..30, rows 4..5)
  out.blitFrom(armmOverworld, 28 * 16, 4 * 16, 48, 32, 144, 80);

  // (192, 80, 48x16): 3x1 Fallen Hollow Woodland Log (ArMM1998 cols 3..5, row 5)
  out.blitFrom(armmOverworld, 3 * 16, 5 * 16, 48, 16, 192, 80);

  // (192, 96, 32x48): 2x3 Guardian Stone Statue (ArMM1998 cols 8..9, rows 31..33)
  out.blitFrom(armmOverworld, 8 * 16, 31 * 16, 32, 48, 192, 96);

  // (0, 128, 48x48): 3x3 Cascading Canyon Waterfall (ArMM1998 cols 18..20, rows 6..8)
  out.blitFrom(armmOverworld, 18 * 16, 6 * 16, 48, 48, 0, 128);

  // (48, 128, 32x32): 2x2 Lush Rounded Woodland Tree Cluster (ArMM1998 cols 5..6, rows 16..17)
  out.blitFrom(armmOverworld, 5 * 16, 16 * 16, 32, 32, 48, 128);

  return out.toPngBuffer();
}

// 1c. Build 5 Artist-Crafted Pixel Battle Arena Backgrounds (battle-bg.png: 384 x 1080 = 5 stacked 384x216 scenes)
function generateBattleBackgroundsPng(): Buffer {
  const W = 384;
  const H = 216;
  const out = new PixelSurface(W, H * 5);

  const bgDir = path.join(ROOT, 'assets-src', 'battle-backgrounds');
  const sunnyHills = PixelSurface.fromPngFile(path.join(bgDir, 'ansimuz-sunny-hills.png'));
  const swampMid = PixelSurface.fromPngFile(path.join(bgDir, 'ansimuz-swamp-mid.png'));
  const sunsetClouds = PixelSurface.fromPngFile(path.join(bgDir, 'pyromantic-sunset-clouds.png'));

  const drawTexturedBattleFloor = (
    yOffset: number,
    floorStartY: number,
    topCol: Rgba,
    midCol: Rgba,
    deepCol: Rgba,
    speckCol: Rgba,
    padFill: Rgba,
    padRim: Rgba,
  ) => {
    for (let y = floorStartY; y < H; y++) {
      const ratio = (y - floorStartY) / Math.max(1, H - floorStartY);
      const base = ratio < 0.32 ? topCol : ratio < 0.68 ? midCol : deepCol;
      for (let x = 0; x < W; x++) {
        out.setPixel(x, yOffset + y, base);
        const h = (Math.imul(x + 23, 2654435761) ^ Math.imul(y + 59, 2246822519)) >>> 0;
        if (h % 29 === 0) {
          out.setPixel(x, yOffset + y, speckCol);
        } else if (h % 47 === 0) {
          out.setPixel(x, yOffset + y, ratio < 0.5 ? midCol : deepCol);
        }
      }
    }
    // Enemy back-right & Ally front-left grounded pixel combatant rings
    const ex = Math.round(W * 0.71);
    const ey = yOffset + Math.round(H * 0.56);
    const px = Math.round(W * 0.28);
    const py = yOffset + Math.round(H * 0.79);
    out.fillEllipse(ex, ey + 2, 46, 12, hexToRgba('#0e1410', 110));
    out.fillEllipse(ex, ey, 44, 11, padRim);
    out.fillEllipse(ex, ey - 1, 40, 9, padFill);

    out.fillEllipse(px, py + 3, 54, 14, hexToRgba('#0e1410', 120));
    out.fillEllipse(px, py, 52, 13, padRim);
    out.fillEllipse(px, py - 1, 47, 10.5, padFill);
  };

  // Arena 0: Mosslight Camp (Admurin Plains CC-BY 4.0 + village timber fence, trees & wildflowers)
  for (let l = 0; l <= 8; l++) {
    const p = path.join(bgDir, 'admurin-plains', `${l}.png`);
    if (fs.existsSync(p)) {
      const layer = PixelSurface.fromPngFile(p);
      out.blitScaled(layer, 0, 0, layer.width, layer.height, 0, 0, W, 142);
    }
  }
  // Village fence & distant trees along meadow horizon (drawn behind combatant pads!)
  for (const tx of [12, 52, 316, 348]) {
    out.blitFrom(armmOverworld, 5 * 16, 16 * 16, 32, 32, tx, 92);
  }
  for (let fx = 0; fx < W; fx += 16) {
    out.blitFrom(armmOverworld, 22 * 16, 7 * 16, 16, 16, fx, 108);
  }
  drawTexturedBattleFloor(
    0,
    124,
    hexToRgba('#548f4e'),
    hexToRgba('#427840'),
    hexToRgba('#305c31'),
    hexToRgba('#78b868'),
    hexToRgba('#dec79b'),
    hexToRgba('#8f7047'),
  );

  // Arena 1: Whisperwood Glen (ansimuz Battle Background Hazy Hills CC-BY 3.0 + dappled sunbeams!)
  out.blitScaled(sunnyHills, 0, 0, sunnyHills.width, sunnyHills.height, 0, H, W, H);
  // Subtle golden sunbeams piercing the forest canopy
  for (const beamX of [74, 188, 292]) {
    for (let by = 0; by < 135; by++) {
      const bxStart = beamX + Math.floor(by * 0.28);
      for (let bw = 0; bw < 18; bw++) {
        out.blendPixel(bxStart + bw, H + by, [255, 244, 184, 18]);
      }
    }
  }
  const ex1 = Math.round(W * 0.71);
  const ey1 = H + Math.round(H * 0.56);
  const px1 = Math.round(W * 0.28);
  const py1 = H + Math.round(H * 0.79);
  out.fillEllipse(ex1, ey1, 44, 11, hexToRgba('#2a4526'));
  out.fillEllipse(ex1, ey1 - 1, 40, 9, hexToRgba('#577d42'));
  out.fillEllipse(px1, py1, 52, 13, hexToRgba('#233b20'));
  out.fillEllipse(px1, py1 - 1, 47, 10.5, hexToRgba('#4d733a'));

  // Arena 2: Reedwater Fen (Admurin Dock CC-BY 4.0 + ansimuz Swamp CC0 misty trees & lotus marsh)
  const y2 = H * 2;
  for (let l = 0; l <= 7; l++) {
    const p = path.join(bgDir, 'admurin-dock', `${l}.png`);
    if (fs.existsSync(p)) {
      const layer = PixelSurface.fromPngFile(p);
      out.blitScaled(layer, 0, 0, layer.width, layer.height, 0, y2, W, 146, {
        rMul: 0.82,
        gMul: 0.98,
        bMul: 0.96,
      });
    }
  }
  // Tile misty gnarled wetland trees along the far horizon (cropping top 96px above ground)
  for (let tx = 0; tx < W; tx += 192) {
    out.blitScaled(swampMid, 0, 48, swampMid.width, 96, tx, y2 + 34, 192, 92, {
      rMul: 0.85,
      gMul: 1.05,
      bMul: 0.95,
      aMul: 0.72,
    });
  }
  drawTexturedBattleFloor(
    y2,
    124,
    hexToRgba('#2f6e73'),
    hexToRgba('#26595e'),
    hexToRgba('#1d464a'),
    hexToRgba('#7ad1cc'),
    hexToRgba('#a38158'),
    hexToRgba('#5e452b'),
  );
  // Lotus lily pads & pink lotus blossoms floating on marsh lagoon (clear of combatant pads!)
  for (const [lx, ly] of [
    [42, 140],
    [176, 136],
    [204, 168],
    [340, 152],
    [354, 188],
  ] as const) {
    out.fillEllipse(lx, y2 + ly, 8, 3.5, hexToRgba('#4fa35a'));
    out.fillEllipse(lx + 1, y2 + ly - 2, 3.5, 2.2, hexToRgba('#f29cb3'));
  }
  // Soft wetland mist bands
  out.fillRect(0, y2 + 116, W, 10, [205, 240, 236, 44]);
  out.fillRect(0, y2 + 146, W, 6, [205, 240, 236, 26]);

  // Arena 3: Terracotta Ridge (Pyromantic Sunset Clouds CC0 + warm ochre canyon cliffs & boulders)
  const y3 = H * 3;
  out.blitScaled(
    sunsetClouds,
    0,
    0,
    sunsetClouds.width,
    sunsetClouds.height,
    0,
    y3,
    W,
    136,
  );
  for (const l of [1, 2, 3]) {
    const p = path.join(bgDir, 'admurin-mountains', `${l}.png`);
    if (fs.existsSync(p)) {
      const layer = PixelSurface.fromPngFile(p);
      out.blitScaled(layer, 0, 0, layer.width, layer.height, 0, y3 + 14, W, 122, {
        rMul: 1.45,
        gMul: 0.85,
        bMul: 0.62,
      });
    }
  }
  drawTexturedBattleFloor(
    y3,
    126,
    hexToRgba('#c97d50'),
    hexToRgba('#b0643b'),
    hexToRgba('#8f4c29'),
    hexToRgba('#e6a677'),
    hexToRgba('#e3c396'),
    hexToRgba('#8c5635'),
  );
  // Canyon rock outcrops framing left & right cliff edges
  for (const bx of [18, 44, 332, 354]) {
    out.blitScaled(armmOverworld, 2 * 16, 18 * 16, 16, 16, bx, y3 + 112, 22, 22, {
      rMul: 1.18,
      gMul: 0.88,
      bMul: 0.72,
    });
  }

  // Arena 4: Starfall Sanctuary (Starlit night sky + Admurin Mountains CC-BY 4.0 + ArMM1998 CC0 sanctuary pillars)
  const y4 = H * 4;
  out.fillRect(0, y4, W, 136, hexToRgba('#141b30'));
  out.fillRect(0, y4 + 54, W, 82, hexToRgba('#1d2745'));
  // Pixel starfield & constellations
  for (let i = 0; i < 48; i++) {
    const sx = (i * 53 + 17) % W;
    const sy = y4 + ((i * 29 + 7) % 86);
    out.setPixel(sx, sy, i % 4 === 0 ? hexToRgba('#fff3a6') : hexToRgba('#bfe3ff'));
    if (i % 7 === 0) {
      out.setPixel(sx + 1, sy, hexToRgba('#fff3a6', 160));
      out.setPixel(sx, sy + 1, hexToRgba('#fff3a6', 160));
    }
  }
  for (let l = 1; l <= 5; l++) {
    const p = path.join(bgDir, 'admurin-mountains', `${l}.png`);
    if (fs.existsSync(p)) {
      const layer = PixelSurface.fromPngFile(p);
      out.blitScaled(layer, 0, 0, layer.width, layer.height, 0, y4 + 14, W, 122, {
        rMul: 0.68,
        gMul: 0.78,
        bMul: 1.12,
      });
    }
  }
  drawTexturedBattleFloor(
    y4,
    126,
    hexToRgba('#343f59'),
    hexToRgba('#293247'),
    hexToRgba('#1e2536'),
    hexToRgba('#5e729c'),
    hexToRgba('#54668c'),
    hexToRgba('#9ec4eb'),
  );
  // Frame horizon with ArMM1998 carved sanctuary guardian statues (clear of enemy pad at x=272!)
  for (const pxCol of [20, 92, 184, 336]) {
    out.blitScaled(armmOverworld, 8 * 16, 31 * 16, 32, 48, pxCol, y4 + 76, 32, 52, {
      rMul: 0.85,
      gMul: 0.9,
      bMul: 1.08,
    });
  }

  return out.toPngBuffer();
}

// 2. Build 16x16 JRPG Characters Sheet (12 cols x 6 rows) from Sharm CC-BY
function generateCharactersPng(): Buffer {
  const out = new PixelSurface(12 * 16, 6 * 16);
  const variants: ReadonlyArray<{
    baseCol: number;
    recolorClothing: (r: number, g: number, b: number) => Rgba;
  }> = [
    {
      baseCol: 3,
      recolorClothing: (r, g, b) =>
        b > r + 25
          ? [Math.min(255, b + 25), Math.round(g * 0.85), Math.round(r * 0.7), 255]
          : [r, g, b, 255],
    },
    {
      baseCol: 3,
      recolorClothing: (r, g, b) =>
        b > r + 25
          ? [Math.round(r * 0.75), Math.min(255, b + 5), Math.round(g * 0.8), 255]
          : [r, g, b, 255],
    },
    {
      baseCol: 6,
      recolorClothing: (r, g, b) => [r, g, b, 255],
    },
    {
      baseCol: 3,
      recolorClothing: (r, g, b) =>
        b > r + 25
          ? [Math.min(255, b + 35), Math.min(255, Math.round(b * 0.78)), 52, 255]
          : [r, g, b, 255],
    },
    {
      baseCol: 6,
      recolorClothing: (r, g, b) =>
        b > r + 20
          ? [68, Math.min(255, Math.round(b * 0.92)), Math.round(b * 0.78), 255]
          : [r, g, b, 255],
    },
    {
      baseCol: 6,
      recolorClothing: (r, g, b) =>
        b > r + 20 ? [Math.min(255, Math.round(b * 0.95)), 58, 48, 255] : [r, g, b, 255],
    },
  ];

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

// 3. Build Detailed 48x48 Pixel-Art Wildkin Spritesheet AND 16x16 Overworld Companion Follower Sheet
function generateCreaturesAndCompanionsPng(): { creatures: Buffer; companions: Buffer } {
  const cols = 10;
  const rows = 6;
  const size = 48;
  const s = new PixelSurface(cols * size, rows * size);
  const comp = new PixelSurface(cols * 16, rows * 16);

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
      const sc = sp.stage === 1 ? 0.84 : sp.stage === 2 ? 1.0 : 1.16;

      const cx = ox + 24;
      const cy = oy + 28 + bob;

      // Grounded pixel contact shadow
      s.fillEllipse(ox + 24, oy + 42, Math.round(12 * sc), 3.2, hexToRgba('#141c16', 120));

      if (sp.dexNumber <= 3) {
        const rx = Math.round(9.5 * sc);
        const ry = Math.round(7.5 * sc);
        s.fillEllipse(cx + rx + 2, cy - 3 - frame, 6 * sc, 3.5 * sc, p.mid, p.shade);
        s.fillEllipse(cx + rx + 4, cy - 4 - frame, 3 * sc, 2 * sc, p.hi);
        // Leaf vein detail on tail
        s.drawLine(cx + rx - 1, cy - 2 - frame, cx + rx + 5, cy - 4 - frame, 1.2, p.glow);
        s.fillRect(cx - rx + 3, oy + 34, 4, 8, p.shade);
        s.fillRect(cx + rx - 6, oy + 34, 4, 8, p.shade);
        s.fillRect(cx - rx + 5, oy + 35, 4, 8, p.mid);
        s.fillEllipse(cx + 1, cy + 1, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx - 3, cy + 1, rx * 0.55, ry * 0.72, p.glow);
        // Forehead leaf crest & stripe markings
        s.fillRect(cx + 2, cy - 3, 4, 1, p.deep);
        s.fillRect(cx + 3, cy - 1, 4, 1, p.deep);
        const hx = cx - Math.round(5 * sc);
        const hy = cy - Math.round(7 * sc);
        s.drawLine(hx - 5, hy - 3, hx - 9, hy - 10, 3, p.shade);
        s.drawLine(hx + 4, hy - 3, hx + 8, hy - 10, 3, p.shade);
        s.setPixel(hx - 8, hy - 9, p.accent);
        s.setPixel(hx + 7, hy - 9, p.accent);
        if (sp.stage >= 2) {
          // Cheek whisker tufts
          s.drawLine(hx - 6, hy + 1, hx - 10, hy + 2, 2, p.glow);
        }
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
        const rx = Math.round(9 * sc);
        const ry = Math.round(7 * sc);
        s.fillEllipse(cx + rx + 3, cy - 4 - frame, 7.5 * sc, 5.2 * sc, p.mid, p.shade);
        s.fillEllipse(cx + rx + 4, cy - 5 - frame, 4.8 * sc, 3.2 * sc, p.accent);
        s.fillEllipse(cx + rx + 5, cy - 6 - frame, 2.2 * sc, 1.8 * sc, p.glow);
        if (sp.stage >= 2) {
          s.fillEllipse(cx + rx + 1, cy - 9 - frame, 5 * sc, 3 * sc, p.hi);
        }
        s.fillRect(cx - 6, oy + 34, 3, 8, p.deep);
        s.fillRect(cx + 3, oy + 34, 3, 8, p.deep);
        s.fillEllipse(cx, cy + 1, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx - 4, cy + 2, rx * 0.52, ry * 0.68, CREAM);
        const hx = cx - Math.round(5 * sc);
        const hy = cy - Math.round(7 * sc);
        s.drawLine(hx - 4, hy - 3, hx - 7, hy - 11, 3, p.mid);
        s.drawLine(hx + 3, hy - 3, hx + 6, hy - 11, 3, p.mid);
        s.setPixel(hx - 6, hy - 9, p.accent);
        s.setPixel(hx + 5, hy - 9, p.accent);
        s.fillEllipse(hx, hy, 6.8 * sc, 5.5 * sc, p.hi, p.mid);
        s.fillEllipse(hx - 4, hy + 2, 3.2, 2.2, CREAM);
        drawEye(hx - 5, hy - 1);
        drawEye(hx + 1, hy - 1);
      } else if (sp.dexNumber <= 9) {
        const rx = Math.round(9 * sc);
        const ry = Math.round(8.5 * sc);
        // Broad rudder fin tail
        s.fillEllipse(cx + rx + 3, cy + 3, 6.8 * sc, 3.2 * sc, p.shade);
        s.fillEllipse(cx + rx + 5, cy + 2, 3.5 * sc, 2.2 * sc, p.hi);
        s.fillEllipse(cx, cy, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx - 1, cy + 2, rx * 0.62, ry * 0.7, p.accent);
        if (sp.stage >= 2) {
          s.fillEllipse(cx, cy - ry + 2, rx * 0.85, 2.8, p.glow);
        }
        const hx = cx - 1;
        const hy = cy - Math.round(8 * sc);
        s.fillEllipse(hx, hy, 6.8 * sc, 5.8 * sc, p.hi, p.mid);
        // Otter ear fins
        s.fillEllipse(hx - 6, hy - 2, 2.2, 2.8, p.glow);
        s.fillEllipse(hx + 6, hy - 2, 2.2, 2.8, p.glow);
        if (sp.stage === 3) {
          s.drawLine(hx, hy - 5, hx + 4, hy - 12, 3, p.glow);
        }
        drawEye(hx - 4, hy - 1);
        drawEye(hx + 2, hy - 1);
        s.fillRect(cx - 7, oy + 36, 5, 5, p.shade);
        s.fillRect(cx + 3, oy + 36, 5, 5, p.shade);
      } else if (sp.dexNumber <= 12 || sp.dexNumber === 28 || sp.dexNumber === 29) {
        const rx = Math.round(7.5 * sc);
        const ry = Math.round(8 * sc);
        const isOwl = sp.dexNumber >= 28;
        s.fillEllipse(cx - rx - 3, cy + wingLift, 7.5 * sc, 4.8 * sc, p.shade);
        s.fillEllipse(cx + rx + 3, cy + wingLift, 7.5 * sc, 4.8 * sc, p.shade);
        s.fillEllipse(cx - rx - 2, cy + wingLift - 1, 5.2 * sc, 2.6 * sc, p.hi);
        s.fillEllipse(cx + rx + 2, cy + wingLift - 1, 5.2 * sc, 2.6 * sc, p.hi);
        s.fillEllipse(cx, cy + 1, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx, cy + 2, rx * 0.65, ry * 0.65, isOwl ? p.glow : p.accent);
        const hy = cy - Math.round(7 * sc);
        s.fillEllipse(cx, hy, 6.5 * sc, 5.8 * sc, p.mid, p.shade);
        if (isOwl) {
          s.fillEllipse(cx - 3, hy, 3.2, 3.2, CREAM);
          s.fillEllipse(cx + 3, hy, 3.2, 3.2, CREAM);
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
        const rx = Math.round(10 * sc);
        const ry = Math.round(8 * sc);
        s.fillEllipse(cx, cy + 2, rx, ry, p.shade);
        s.fillEllipse(cx, cy, rx - 1, ry - 1, p.mid, p.shade);
        s.fillEllipse(cx - 2, cy - 2, rx * 0.55, ry * 0.4, p.hi);
        // Elytra center seam
        s.fillRect(cx, cy - ry + 2, 1, ry * 2 - 4, p.deep);
        s.fillEllipse(cx, cy, 4 * sc, 4 * sc, p.accent);
        s.fillEllipse(cx, cy, 2 * sc, 2 * sc, p.glow);
        if (sp.stage >= 2) {
          s.drawLine(cx, cy - ry + 1, cx, cy - ry - 6, 2.5, p.accent);
        }
        if (sp.stage === 3) {
          s.drawLine(cx - 2, cy - ry, cx - 5, cy - ry - 10, 3, p.accent);
          s.drawLine(cx + 2, cy - ry, cx + 5, cy - ry - 10, 3, p.accent);
        }
        drawEye(cx - 5, cy + 1);
        drawEye(cx + 3, cy + 1);
      } else if (sp.dexNumber <= 17) {
        const rx = Math.round(8.5 * sc);
        const ry = Math.round(7.5 * sc);
        s.drawLine(cx + rx, cy + 2, cx + rx + 6, cy - 5, 3, p.accent);
        s.drawLine(cx + rx + 6, cy - 5, cx + rx + 3, cy - 8, 2.5, p.glow);
        s.fillEllipse(cx - 4, cy - ry - 7, 2.8, 8 * sc, p.mid, p.shade);
        s.fillEllipse(cx + 3, cy - ry - 7, 2.8, 8 * sc, p.mid, p.shade);
        s.fillEllipse(cx - 4, cy - ry - 7, 1.3, 5 * sc, p.accent);
        s.fillEllipse(cx + 3, cy - ry - 7, 1.3, 5 * sc, p.accent);
        s.fillEllipse(cx, cy + 2, rx, ry, p.hi, p.mid);
        s.fillEllipse(cx - 2, cy + 3, rx * 0.55, ry * 0.55, CREAM);
        drawEye(cx - 4, cy - 2);
        drawEye(cx + 2, cy - 2);
        s.setPixel(cx - 6, cy + 1, p.accent);
        s.setPixel(cx + 5, cy + 1, p.accent);
        s.fillRect(cx - 6, oy + 36, 4, 5, p.shade);
        s.fillRect(cx + 3, oy + 36, 4, 5, p.shade);
      } else if (sp.dexNumber <= 20) {
        const rx = Math.round(10.5 * sc);
        const ry = Math.round(7.5 * sc);
        if (sp.stage >= 2) {
          s.fillEllipse(cx + 1, cy - ry + 1, 7.5 * sc, 2.8, hexToRgba('#4fa35a'));
        }
        if (sp.stage === 3) {
          s.fillEllipse(cx + 1, cy - ry - 3, 5.8, 4.2, hexToRgba('#f28ca6'));
          s.fillEllipse(cx + 1, cy - ry - 4, 3.2, 2.5, CREAM);
        }
        s.fillEllipse(cx, cy + 3, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx - 1, cy + 5, rx * 0.7, ry * 0.55, p.glow);
        s.fillEllipse(cx - 5, cy - ry + 4, 3.5, 3.5, p.hi);
        s.fillEllipse(cx + 4, cy - ry + 4, 3.5, 3.5, p.hi);
        drawEye(cx - 6, cy - ry + 3);
        drawEye(cx + 3, cy - ry + 3);
      } else if (sp.dexNumber <= 22) {
        const rx = Math.round(11 * sc);
        const ry = Math.round(6 * sc);
        s.fillEllipse(cx + rx + 2, cy - frame, 4.8 * sc, 5.8 * sc, p.accent);
        s.fillEllipse(cx, cy, rx, ry, p.mid, p.shade);
        s.fillEllipse(cx - 2, cy - 1, rx * 0.7, ry * 0.5, p.hi);
        // Dorsal fin crest
        s.fillEllipse(cx + 1, cy - ry, 5 * sc, 2.2, p.accent);
        s.drawLine(cx - rx + 2, cy - 3, cx - rx - 4, cy - 9, 1.5, p.accent);
        s.fillEllipse(cx - rx - 5, cy - 9, 3, 3, p.glow);
        drawEye(cx - 6, cy - 1);
      } else if (sp.dexNumber <= 25) {
        const rx = Math.round(11.5 * sc);
        const ry = Math.round(8.5 * sc);
        s.fillRect(cx - 8, oy + 34, 5, 7, p.deep);
        s.fillRect(cx + 4, oy + 34, 5, 7, p.deep);
        s.fillEllipse(cx + 1, cy, rx, ry, p.shade, p.deep);
        s.fillEllipse(cx + 1, cy - 1, rx - 2, ry - 2, p.mid, p.shade);
        // Kiln shell hexagonal plate lines
        s.fillRect(cx - 3, cy - ry + 3, 1, ry + 1, p.deep);
        s.fillRect(cx + 4, cy - ry + 3, 1, ry + 1, p.deep);
        s.fillRect(cx - rx + 3, cy + 2, rx * 2 - 4, 2, p.accent);
        if (sp.stage === 3) {
          s.fillEllipse(cx + 1, cy - ry + 1, rx * 0.65, 3, hexToRgba('#579c56'));
          s.drawLine(cx + 4, cy - ry, cx + 6, cy - ry - 6, 3, p.accent);
        }
        s.fillEllipse(cx - rx - 1, cy + 2, 5 * sc, 4 * sc, p.hi);
        drawEye(cx - rx - 3, cy + 1);
      } else if (sp.dexNumber <= 27) {
        const rx = Math.round(10 * sc);
        const ry = Math.round(7 * sc);
        s.drawLine(cx + rx - 2, cy + 3, cx + rx + 8, cy - 3, 3.5, p.mid);
        s.fillEllipse(cx + 8, cy - 3, 2.5, 2.5, p.accent);
        s.fillEllipse(cx, cy + 2, rx, ry, p.mid, p.shade);
        const hx = cx - Math.round(6 * sc);
        const hy = cy - Math.round(5 * sc);
        s.fillEllipse(hx + 2, hy, 7.2 * sc, 6.8 * sc, p.accent);
        s.fillEllipse(hx, hy + 1, 5.5 * sc, 4.2 * sc, p.hi);
        drawEye(hx - 3, hy);
        s.fillRect(cx - 6, oy + 35, 4, 6, p.shade);
        s.fillRect(cx + 3, oy + 35, 4, 6, p.shade);
      } else {
        s.fillRect(cx - 6, oy + 29, 3, 12, p.shade);
        s.fillRect(cx + 5, oy + 29, 3, 12, p.shade);
        s.fillEllipse(cx + 1, cy + 1, 11, 6.5, CREAM, p.hi);
        s.fillEllipse(cx + 11, cy - 2, 4, 2.5, p.accent);
        s.drawLine(cx - 6, cy, cx - 8, cy - 10, 5, CREAM);
        s.fillEllipse(cx - 9, cy - 11, 5.5, 4.2, CREAM);
        s.drawLine(cx - 9, cy - 14, cx - 14, cy - 24, 2, p.accent);
        s.drawLine(cx - 12, cy - 19, cx - 16, cy - 20, 2, p.glow);
        s.drawLine(cx - 6, cy - 14, cx - 2, cy - 24, 2, p.accent);
        s.drawLine(cx - 4, cy - 19, cx + 1, cy - 20, 2, p.glow);
        drawEye(cx - 11, cy - 12);
      }

      s.outlineRegion(ox, oy, size, size, INK);

      // Build crisp 16x16 Overworld Companion Follower Sprite for this species & frame!
      const cox = (idx % cols) * 16;
      const coy = Math.floor(idx / cols) * 16;
      const cbob = frame === 1 ? -1 : 0;
      comp.fillEllipse(cox + 8, coy + 14, 5, 1.6, hexToRgba('#121814', 110));
      // Body & head tailored by silhouette family so every follower looks adorable & recognizable at 16x16
      comp.fillEllipse(cox + 8, coy + 10 + cbob, 4.8, 3.8, p.mid, p.shade);
      comp.fillEllipse(cox + 8, coy + 6 + cbob, 4.2, 3.4, p.hi, p.mid);
      if (sp.dexNumber <= 6 || sp.dexNumber === 16 || sp.dexNumber === 17) {
        // Pointed lynx/fox/hare ears + tail
        comp.setPixel(cox + 5, coy + 2 + cbob, p.shade);
        comp.setPixel(cox + 5, coy + 3 + cbob, p.accent);
        comp.setPixel(cox + 11, coy + 2 + cbob, p.shade);
        comp.setPixel(cox + 11, coy + 3 + cbob, p.accent);
        comp.fillRect(cox + 12, coy + 8 + cbob, 2, 2, p.accent);
      } else if (sp.dexNumber >= 10 && sp.dexNumber <= 12 || sp.dexNumber >= 28 && sp.dexNumber <= 29) {
        // Flapping wings
        comp.fillRect(cox + 2, coy + 8 + (frame === 1 ? -1 : 1), 2, 3, p.hi);
        comp.fillRect(cox + 12, coy + 8 + (frame === 1 ? -1 : 1), 2, 3, p.hi);
      } else if (sp.dexNumber === 30) {
        // Crystal antlers
        comp.setPixel(cox + 5, coy + 1 + cbob, p.accent);
        comp.setPixel(cox + 6, coy + 2 + cbob, p.glow);
        comp.setPixel(cox + 11, coy + 1 + cbob, p.accent);
        comp.setPixel(cox + 10, coy + 2 + cbob, p.glow);
      } else {
        // Crest / shell accent
        comp.fillRect(cox + 6, coy + 3 + cbob, 4, 1, p.accent);
      }
      comp.setPixel(cox + 6, coy + 6 + cbob, INK);
      comp.setPixel(cox + 10, coy + 6 + cbob, INK);
      comp.outlineRegion(cox, coy, 16, 16, INK);
    }
  }

  return {
    creatures: s.toPngBuffer(),
    companions: comp.toPngBuffer(),
  };
}

// 4. Build 16x16 Item Icons Sheet (16 cols x 1 row)
function generateItemsPng(): Buffer {
  const s = new PixelSurface(16 * 16, 16);
  const charmColors: ReadonlyArray<[Rgba, Rgba]> = [
    [hexToRgba('#579c56'), hexToRgba('#f2bd42')],
    [hexToRgba('#3f89a6'), CREAM],
    [hexToRgba('#d95f34'), hexToRgba('#fae06b')],
    [hexToRgba('#66d4eb'), hexToRgba('#fff3a1')],
  ];

  for (let i = 0; i < 4; i++) {
    const ox = i * 16;
    const [main, acc] = charmColors[i]!;
    s.fillRect(ox + 6, 2, 4, 2, acc);
    s.fillEllipse(ox + 8, 8, 5, 4.5, main);
    s.fillRect(ox + 3, 10, 10, 2, acc);
    s.fillRect(ox + 7, 12, 2, 2, acc);
    s.outlineRegion(ox, 0, 16, 16, INK);
  }

  s.blitFrom(kenney, 54 * 17, 11 * 17, 16, 16, 4 * 16, 0);
  s.blitFrom(kenney, 55 * 17, 11 * 17, 16, 16, 5 * 16, 0);
  s.blitFrom(kenney, 56 * 17, 11 * 17, 16, 16, 6 * 16, 0);
  s.blitFrom(kenney, 30 * 17, 9 * 17, 16, 16, 7 * 16, 0);
  s.blitFrom(kenney, 55 * 17, 15 * 17, 16, 16, 8 * 16, 0);
  s.blitFrom(kenney, 51 * 17, 17 * 17, 16, 16, 9 * 16, 0);
  s.blitFrom(kenney, 50 * 17, 8 * 17, 16, 16, 10 * 16, 0);
  s.blitFrom(kenney, 42 * 17, 18 * 17, 16, 16, 11 * 16, 0);
  s.blitFrom(kenney, 50 * 17, 9 * 17, 16, 16, 12 * 16, 0);

  return s.toPngBuffer();
}

// 5. Build 32x32 Elemental Combat, Evolution Sparkle & Chime Capture VFX Sheet (10 cols x 1 row)
function generateVfxPng(): Buffer {
  const s = new PixelSurface(10 * 32, 32);

  // 0: Leaf razor swirl (blended with ArMM1998 leaf burst)
  s.blitScaled(armmObjects, 4 * 16, 1 * 16, 16, 16, 2, 2, 28, 28);
  s.fillEllipse(16, 16, 8, 3, hexToRgba('#579c56'));
  s.fillEllipse(16, 16, 3, 8, hexToRgba('#9cd482'));
  s.outlineRegion(0, 0, 32, 32, INK);

  // 1: Water splash burst
  s.fillEllipse(32 + 16, 16, 11, 11, hexToRgba('#3f89a6'));
  s.fillEllipse(32 + 16, 16, 7, 7, hexToRgba('#8fd3e8'));
  s.fillEllipse(32 + 15, 14, 3.5, 3.5, hexToRgba('#ffffff'));
  s.outlineRegion(32, 0, 32, 32, INK);

  // 2: Ember flame burst (blended with ArMM1998 fire crest)
  s.blitScaled(armmObjects, 7 * 16, 2 * 16, 16, 16, 64 + 3, 2, 26, 28);
  s.fillEllipse(64 + 16, 19, 6, 7, hexToRgba('#fae06b'));
  s.outlineRegion(64, 0, 32, 32, INK);

  // 3: Stone crystal spikes (blended with ArMM1998 rock burst)
  s.blitScaled(armmObjects, 7 * 16, 3 * 16, 16, 16, 96 + 2, 2, 28, 28);
  s.drawLine(96 + 10, 26, 96 + 13, 8, 4, hexToRgba('#9e7453'));
  s.drawLine(96 + 18, 26, 96 + 21, 6, 4, hexToRgba('#d4aa83'));
  s.outlineRegion(96, 0, 32, 32, INK);

  // 4: Gale wind arc
  s.drawLine(128 + 5, 22, 128 + 26, 7, 3.5, hexToRgba('#a8e0cc'));
  s.drawLine(128 + 8, 26, 128 + 27, 14, 2.5, CREAM);
  s.outlineRegion(128, 0, 32, 32, INK);

  // 5: Spark lightning bolt
  s.drawLine(160 + 18, 4, 160 + 11, 16, 3.5, hexToRgba('#ffe073'));
  s.drawLine(160 + 11, 16, 160 + 20, 16, 3.5, hexToRgba('#ffe073'));
  s.drawLine(160 + 20, 16, 160 + 12, 28, 3.5, hexToRgba('#66d4eb'));
  s.outlineRegion(160, 0, 32, 32, INK);

  // 6: Neutral impact star
  s.drawLine(192 + 6, 16, 192 + 26, 16, 3, CREAM);
  s.drawLine(192 + 16, 6, 192 + 16, 26, 3, CREAM);
  s.drawLine(192 + 9, 9, 192 + 23, 23, 2, hexToRgba('#fae06b'));
  s.outlineRegion(192, 0, 32, 32, INK);

  // 7: Golden Resonance Chime Bell
  s.fillEllipse(224 + 16, 15, 8.5, 8.5, hexToRgba('#f2bd42'));
  s.fillRect(224 + 8, 20, 16, 3, hexToRgba('#fff3a1'));
  s.fillRect(224 + 14, 23, 4, 3, hexToRgba('#d98a2b'));
  s.outlineRegion(224, 0, 32, 32, INK);

  // 8: Radiant Gleaming Starburst (for rare variant & evolution aura!)
  s.drawLine(256 + 16, 3, 256 + 16, 29, 2.5, hexToRgba('#fff7b8'));
  s.drawLine(256 + 3, 16, 256 + 29, 16, 2.5, hexToRgba('#fff7b8'));
  s.drawLine(256 + 8, 8, 256 + 24, 24, 2, hexToRgba('#66d4eb'));
  s.drawLine(256 + 24, 8, 256 + 8, 24, 2, hexToRgba('#66d4eb'));
  s.outlineRegion(256, 0, 32, 32, INK);

  // 9: Capture Success Harmony Ring
  for (let deg = 0; deg < 360; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    s.fillEllipse(
      288 + 16 + Math.cos(rad) * 10,
      16 + Math.sin(rad) * 10,
      2,
      2,
      deg % 30 === 0 ? hexToRgba('#a8f0a5') : hexToRgba('#fff3a1'),
    );
  }
  s.outlineRegion(288, 0, 32, 32, INK);

  return s.toPngBuffer();
}

const outDir = path.join(ROOT, 'public', 'assets', 'sprites');
fs.mkdirSync(outDir, { recursive: true });

const creatureSheets = generateCreaturesAndCompanionsPng();
fs.writeFileSync(path.join(outDir, 'tileset.png'), generateTilesetPng());
fs.writeFileSync(path.join(outDir, 'structures.png'), generateStructuresPng());
fs.writeFileSync(path.join(outDir, 'battle-bg.png'), generateBattleBackgroundsPng());
fs.writeFileSync(path.join(outDir, 'characters.png'), generateCharactersPng());
fs.writeFileSync(path.join(outDir, 'creatures.png'), creatureSheets.creatures);
fs.writeFileSync(path.join(outDir, 'companions.png'), creatureSheets.companions);
fs.writeFileSync(path.join(outDir, 'items.png'), generateItemsPng());
fs.writeFileSync(path.join(outDir, 'vfx.png'), generateVfxPng());

console.log(
  'Built verified open-asset & pixel-art atlases in public/assets/sprites/ (tileset.png, structures.png, battle-bg.png, characters.png, creatures.png, companions.png, items.png, vfx.png).',
);
