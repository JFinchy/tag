import { dirname, join } from 'path';

import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcDir = join(__dirname, '../src/assets');
const destDir = join(__dirname, '../dist/chrome-mv3/assets');

async function copyAssets() {
  try {
    // Create destination directory if it doesn't exist
    await fs.mkdir(destDir, { recursive: true });

    // Copy all PNG files
    const files = await fs.readdir(srcDir);
    for (const file of files) {
      if (file.endsWith('.png')) {
        await fs.copyFile(join(srcDir, file), join(destDir, file));
        console.log(`Copied ${file} to build directory`);
      }
    }

    console.log('Asset copying complete!');
  } catch (error) {
    console.error('Error copying assets:', error);
    process.exit(1);
  }
}

copyAssets(); 