import sharp from 'sharp';

const source = 'public/icon.svg';
const outputs = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
];

await Promise.all(
  outputs.map(([file, size]) =>
    sharp(source)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(file),
  ),
);

console.log('Generated PWA PNG icons.');
