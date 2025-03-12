import { dirname, join } from 'path';

import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [16, 32, 48, 128];
const inputSvg = join(__dirname, '../src/assets/icon.svg');
const outputDir = join(__dirname, '../src/assets');

async function generateIcons() {
  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Generate icons for each size
    for (const size of sizes) {
      const outputPath = join(outputDir, `icon-${size}.png`);
      await sharp(inputSvg)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`Generated ${size}x${size} icon`);
    }

    console.log('Icon generation complete!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons(); 