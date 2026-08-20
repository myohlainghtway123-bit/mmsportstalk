const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RED = [243, 38, 45, 255];
const BLACK = [8, 10, 12, 255];
const TRANSPARENT = [0, 0, 0, 0];

const FONT = {
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  S: ['11111','10000','10000','11111','00001','00001','11111'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
};

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([len, name, data, crc]);
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    const start = y * width * 4;
    rgba.copy(raw, offset, start, start + width * 4);
    offset += width * 4;
  }
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  return Buffer.concat([signature, chunk('IHDR',ihdr), chunk('IDAT',zlib.deflateSync(raw,{level:9})), chunk('IEND',Buffer.alloc(0))]);
}

function canvas(width, height, bg) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i*4]=bg[0]; data[i*4+1]=bg[1]; data[i*4+2]=bg[2]; data[i*4+3]=bg[3];
  }
  return { width, height, data };
}

function rect(c, x, y, w, h, color) {
  const x0=Math.max(0,Math.floor(x)), y0=Math.max(0,Math.floor(y));
  const x1=Math.min(c.width,Math.ceil(x+w)), y1=Math.min(c.height,Math.ceil(y+h));
  for (let yy=y0; yy<y1; yy++) for (let xx=x0; xx<x1; xx++) {
    const i=(yy*c.width+xx)*4;
    c.data[i]=color[0]; c.data[i+1]=color[1]; c.data[i+2]=color[2]; c.data[i+3]=color[3];
  }
}

function drawText(c, text, centerX, centerY, cell, color) {
  const chars = text.split('');
  const charWidth = 5 * cell;
  const gap = cell * 1.15;
  const total = chars.length * charWidth + (chars.length - 1) * gap;
  let x = centerX - total / 2;
  const totalH = 7 * cell;
  const y = centerY - totalH / 2;
  chars.forEach((ch) => {
    const glyph = FONT[ch];
    if (glyph) glyph.forEach((row, ry) => row.split('').forEach((bit, rx) => {
      if (bit === '1') {
        const italicShift = (6 - ry) * cell * 0.10;
        rect(c, x + rx * cell + italicShift, y + ry * cell, cell * 0.92, cell * 0.92, color);
      }
    }));
    x += charWidth + gap;
  });
}

function save(name, c) {
  const out = path.join(__dirname, '..', 'assets', name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, png(c.width, c.height, c.data));
  console.log(`generated ${out}`);
}

// Standard icon: keep the full MST word well inside the square.
const icon = canvas(1024,1024,BLACK);
drawText(icon,'MST',512,500,52,RED);
save('icon.png',icon);

// Android adaptive foreground: much smaller safe-zone to survive circular/squircle masks.
const adaptive = canvas(1024,1024,TRANSPARENT);
drawText(adaptive,'MST',512,512,42,RED);
save('adaptive-icon.png',adaptive);

// Splash: centered MST mark with generous breathing room.
const splash = canvas(1242,2436,BLACK);
drawText(splash,'MST',621,1218,62,RED);
save('splash.png',splash);
