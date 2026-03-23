#!/usr/bin/env node
/**
 * Generates macOS .icns from resources/logo.svg
 * Requires: npm install -D sharp (run once)
 * Usage: node scripts/generate-icon.js
 */

const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const sharp = require('sharp')

const SVG_PATH = path.join(__dirname, '../resources/logo.svg')
const ICONSET_DIR = path.join(__dirname, '../resources/icon.iconset')
const ICNS_PATH = path.join(__dirname, '../resources/icon.icns')
const PNG_PATH = path.join(__dirname, '../resources/icon.png')

const SIZES = [16, 32, 64, 128, 256, 512, 1024]

async function main() {
  if (!fs.existsSync(ICONSET_DIR)) fs.mkdirSync(ICONSET_DIR, { recursive: true })

  const svgBuffer = fs.readFileSync(SVG_PATH)

  // Generate icon.png (512px) for electron dock
  await sharp(svgBuffer).resize(512, 512).png().toFile(PNG_PATH)
  console.log('Generated icon.png (512px)')

  // Generate all iconset sizes
  for (const size of SIZES) {
    const file1x = path.join(ICONSET_DIR, `icon_${size}x${size}.png`)
    await sharp(svgBuffer).resize(size, size).png().toFile(file1x)
    console.log(`  ${file1x}`)

    if (size <= 512) {
      const file2x = path.join(ICONSET_DIR, `icon_${size}x${size}@2x.png`)
      await sharp(svgBuffer).resize(size * 2, size * 2).png().toFile(file2x)
      console.log(`  ${file2x}`)
    }
  }

  // Use iconutil to create .icns (macOS only)
  execSync(`iconutil -c icns "${ICONSET_DIR}" -o "${ICNS_PATH}"`)
  console.log(`\nGenerated ${ICNS_PATH}`)

  // Clean up iconset dir
  fs.rmSync(ICONSET_DIR, { recursive: true, force: true })
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
