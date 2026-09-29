const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const source = path.join(root, "Icon.png");
const buildDir = path.join(root, "build");
const pngTarget = path.join(buildDir, "icon.png");
const icoTarget = path.join(buildDir, "icon.ico");
const sizes = [16, 24, 32, 48, 64, 128, 256];

function iconDirEntry(size, bufferLength, offset) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(bufferLength, 8);
  entry.writeUInt32LE(offset, 12);
  return entry;
}

async function main() {
  if (!fs.existsSync(source)) {
    throw new Error(`Icon source not found: ${source}`);
  }

  fs.mkdirSync(buildDir, { recursive: true });
  await sharp(source).resize(1024, 1024, { fit: "contain" }).png().toFile(pngTarget);

  const pngs = await Promise.all(
    sizes.map((size) =>
      sharp(source)
        .resize(size, size, { fit: "contain" })
        .png()
        .toBuffer()
    )
  );

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = header.length + pngs.length * 16;
  const entries = pngs.map((buffer, index) => {
    const entry = iconDirEntry(sizes[index], buffer.length, offset);
    offset += buffer.length;
    return entry;
  });

  fs.writeFileSync(icoTarget, Buffer.concat([header, ...entries, ...pngs]));
  console.log(`Generated ${icoTarget}`);
  console.log(`Generated ${pngTarget}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
