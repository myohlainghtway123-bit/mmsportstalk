const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RED = [243, 39, 53, 255];
const RED_DARK = [188, 22, 34, 255];
const BLACK = [7, 9, 11, 255];
const PANEL = [14, 18, 22, 255];
const WHITE = [247, 248, 249, 255];
const TRANSPARENT = [0, 0, 0, 0];

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

function pixel(c, x, y, color) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const i = (Math.floor(y) * c.width + Math.floor(x)) * 4;
  c.data[i]=color[0]; c.data[i+1]=color[1]; c.data[i+2]=color[2]; c.data[i+3]=color[3];
}

function rect(c, x, y, w, h, color) {
  const x0=Math.max(0,Math.floor(x)), y0=Math.max(0,Math.floor(y));
  const x1=Math.min(c.width,Math.ceil(x+w)), y1=Math.min(c.height,Math.ceil(y+h));
  for (let yy=y0; yy<y1; yy++) for (let xx=x0; xx<x1; xx++) pixel(c, xx, yy, color);
}

function circle(c, cx, cy, r, color) {
  const x0=Math.max(0,Math.floor(cx-r)), x1=Math.min(c.width-1,Math.ceil(cx+r));
  const y0=Math.max(0,Math.floor(cy-r)), y1=Math.min(c.height-1,Math.ceil(cy+r));
  const rr=r*r;
  for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++) {
    const dx=x-cx, dy=y-cy;
    if (dx*dx+dy*dy<=rr) pixel(c,x,y,color);
  }
}

function roundedRect(c, x, y, w, h, r, color) {
  const radius=Math.min(r,w/2,h/2);
  rect(c,x+radius,y,w-2*radius,h,color);
  rect(c,x,y+radius,w,h-2*radius,color);
  circle(c,x+radius,y+radius,radius,color);
  circle(c,x+w-radius,y+radius,radius,color);
  circle(c,x+radius,y+h-radius,radius,color);
  circle(c,x+w-radius,y+h-radius,radius,color);
}

function polygon(c, points, color) {
  const minY=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1]))));
  const maxY=Math.min(c.height-1,Math.ceil(Math.max(...points.map(p=>p[1]))));
  for (let y=minY; y<=maxY; y++) {
    const xs=[];
    for (let i=0,j=points.length-1;i<points.length;j=i++) {
      const [xi,yi]=points[i], [xj,yj]=points[j];
      if ((yi>y)!==(yj>y)) xs.push((xj-xi)*(y-yi)/(yj-yi)+xi);
    }
    xs.sort((a,b)=>a-b);
    for (let i=0;i<xs.length;i+=2) {
      const start=Math.max(0,Math.ceil(xs[i]));
      const end=Math.min(c.width-1,Math.floor(xs[i+1] ?? xs[i]));
      for (let x=start;x<=end;x++) pixel(c,x,y,color);
    }
  }
}

function drawMST(c, centerX, centerY, scale, color) {
  const W=600*scale, H=226*scale;
  const x=centerX-W/2, y=centerY-H/2;
  const s=scale;

  // M: bold geometric sports monogram with a clean center V.
  roundedRect(c,x,y,38*s,226*s,8*s,color);
  roundedRect(c,x+164*s,y,38*s,226*s,8*s,color);
  polygon(c,[[x+30*s,y],[x+78*s,y],[x+116*s,y+86*s],[x+94*s,y+132*s]],color);
  polygon(c,[[x+172*s,y],[x+124*s,y],[x+86*s,y+86*s],[x+108*s,y+132*s]],color);

  // S: compact five-stroke scoreboard form.
  const sx=x+238*s;
  roundedRect(c,sx,y,142*s,34*s,12*s,color);
  roundedRect(c,sx,y,34*s,113*s,12*s,color);
  roundedRect(c,sx,y+96*s,142*s,34*s,12*s,color);
  roundedRect(c,sx+108*s,y+113*s,34*s,113*s,12*s,color);
  roundedRect(c,sx,y+192*s,142*s,34*s,12*s,color);

  // T: wide head and strong stem.
  const tx=x+418*s;
  roundedRect(c,tx,y,182*s,36*s,12*s,color);
  roundedRect(c,tx+72*s,y+18*s,38*s,208*s,10*s,color);
}

function drawBadge(c, x, y, size) {
  const r=size*0.245;
  roundedRect(c,x,y,size,size,r,RED_DARK);
  roundedRect(c,x+size*0.018,y+size*0.018,size*0.964,size*0.964,r*0.94,RED);
  roundedRect(c,x+size*0.055,y+size*0.055,size*0.89,size*0.89,r*0.84,PANEL);
  // Small live-score accent in the top-right corner.
  circle(c,x+size*0.78,y+size*0.22,size*0.035,RED);
  circle(c,x+size*0.78,y+size*0.22,size*0.014,WHITE);
  drawMST(c,x+size*0.50,y+size*0.51,size/1024*1.10,WHITE);
}

function save(name, c) {
  const out = path.join(__dirname, '..', 'assets', name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, png(c.width, c.height, c.data));
  console.log(`generated ${out}`);
}

// Premium launcher icon: dark score-app tile, red MST frame, large white monogram.
const icon = canvas(1024,1024,BLACK);
drawBadge(icon,86,86,852);
save('icon.png',icon);

// Android adaptive foreground: keep the complete badge inside common circle/squircle masks.
const adaptive = canvas(1024,1024,TRANSPARENT);
drawBadge(adaptive,185,185,654);
save('adaptive-icon.png',adaptive);

// Splash: restrained black field with the exact same app badge.
const splash = canvas(1242,2436,BLACK);
drawBadge(splash,401,998,440);
save('splash.png',splash);
