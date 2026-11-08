// Generates simple placeholder PWA icons (flame on an ember gradient) with sharp.
import fs from "node:fs";
import sharp from "sharp";

const flame = (scale) => {
  // flame path drawn in a 100x100 box, scaled around the centre
  const s = scale;
  const t = (50 * (1 - s)).toFixed(2);
  return `<g transform="translate(${t} ${t}) scale(${s})">
    <path d="M50 8c4 14 22 24 22 46a22 22 0 0 1-44 0c0-10 5-17 10-22 1 7 4 11 8 12-2-14 2-26 4-36z" fill="#fff"/>
    <path d="M50 52c3 6 10 10 10 18a10 10 0 0 1-20 0c0-5 3-9 5-11 1 3 2 5 4 5-1-5 0-9 1-12z" fill="#f97316"/>
  </g>`;
};
const svg = ({ size, scale, rounded }) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#c2410c"/></linearGradient></defs>
  <rect width="100" height="100" rx="${rounded ? 22 : 0}" fill="url(#g)"/>
  ${flame(scale)}
</svg>`);

fs.mkdirSync("public/icons", { recursive: true });
const jobs = [
  ["public/icons/icon-192.png", { size: 192, scale: 0.8, rounded: false }],
  ["public/icons/icon-512.png", { size: 512, scale: 0.8, rounded: false }],
  // maskable: keep artwork inside the 80% safe zone
  ["public/icons/maskable-512.png", { size: 512, scale: 0.62, rounded: false }],
  ["public/icons/maskable-192.png", { size: 192, scale: 0.62, rounded: false }],
  ["public/apple-touch-icon.png", { size: 180, scale: 0.78, rounded: false }],
  ["public/icons/favicon-32.png", { size: 32, scale: 0.85, rounded: true }],
];
for (const [file, opts] of jobs) {
  await sharp(svg(opts)).png().toFile(file);
  console.log("wrote", file);
}
fs.writeFileSync("public/icons/icon.svg", svg({ size: 512, scale: 0.8, rounded: true }));
