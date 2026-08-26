import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pngPath = path.join(root, "build", "icon.png");
const png = readFileSync(pngPath);

function pngToIco(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0);
  entry.writeUInt8(0, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuffer]);
}

function pngToIcns(pngBuffer) {
  const type = Buffer.from("ic09");
  const iconLen = Buffer.alloc(4);
  iconLen.writeUInt32BE(8 + pngBuffer.length, 0);
  const body = Buffer.concat([type, iconLen, pngBuffer]);
  const magic = Buffer.from("icns");
  const total = Buffer.alloc(4);
  total.writeUInt32BE(8 + body.length, 0);
  return Buffer.concat([magic, total, body]);
}

writeFileSync(path.join(root, "build", "icon.ico"), pngToIco(png));
writeFileSync(path.join(root, "build", "icon.icns"), pngToIcns(png));
console.log("Wrote build/icon.ico, build/icon.icns, and build/icon.png");
