const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RED = [243, 38, 45, 255];
const BLACK = [8, 10, 12, 255];
const WHITE = [255, 255, 255, 255];
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
  const W=560*scale, H=220*scale;
  const x=centerX-W/2, y=centerY-H/2;
  const s=scale;

  // M — strong vertical stems with sharp inner chevrons.
  rect(c,x,y,34*s,220*s,color);
  rect(c,x+156*s,y,34*s,220*s,color);
  polygon(c,[[x+28*s,y],[x+68*s,y],[x+104*s,y+82*s],[x+80*s,y+119*s]],color);
  polygon(c,[[x+162*s,y],[x+122*s,y],[x+86*s,y+82*s],[x+110*s,y+119*s]],color);

  // S — compact sport-display shape with softened corners.
  const sx=x+220*s;
  roundedRect(c,sx,y,140*s,30*s,10*s,color);
  roundedRect(c,sx,y,30*s,108*s,10*s,color);
  roundedRect(c,sx,y+95*s,140*s,30*s,10*s,color);
  roundedRect(c,sx+110*s,y+112*s,30*s,108*s,10*s,color);
  roundedRect(c,sx,y+190*s,140*s,30*s,10*s,color);

  // T — wide top, narrow stem.
  const tx=x+390*s;
  roundedRect(c,tx,y,170*s,32*s,10*s,color);
  roundedRect(c,tx+68*s,y+20*s,36*s,200*s,10*s,color);
}

function save(name, c) {
  const out = path.join(__dirname, '..', 'assets', name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, png(c.width, c.height, c.data));
  console.log(`generated ${out}`);
}

// Main launcher icon: simple red sports tile with a crisp white MST mark.
const icon = canvas(1024,1024,RED);
drawMST(icon,512,500,1.12,WHITE);
roundedRect(icon,368,710,288,18,9,BLACK);
save('icon.png',icon);

// Android adaptive foreground: compact tile kept well inside every launcher mask.
const adaptive = canvas(1024,1024,TRANSPARENT);
roundedRect(adaptive,188,188,648,648,150,RED);
drawMST(adaptive,512,500,0.72,WHITE);
roundedRect(adaptive,420,650,184,13,7,BLACK);
save('adaptive-icon.png',adaptive);

// Splash screen uses the same badge so launch branding matches the launcher.
const splash = canvas(1242,2436,BLACK);
roundedRect(splash,391,923,460,460,108,RED);
drawMST(splash,621,1124,0.52,WHITE);
roundedRect(splash,560,1260,122,10,5,BLACK);
save('splash.png',splash);
