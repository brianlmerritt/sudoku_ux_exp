import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const output = new URL('../dist/', import.meta.url)
const read = (name) => readFileSync(new URL(name, output))
const manifest = JSON.parse(read('manifest.webmanifest'))
const html = read('index.html').toString()
const worker = read('sw.js').toString()
const entries = [...worker.matchAll(/\{url:"([^"]+)",revision:(null|"[^"]*")\}/g)]
  .map((match) => ({ url: match[1], revision: JSON.parse(match[2]) }))
const precached = new Set(entries.map((entry) => entry.url))

test('installation paths work at both a domain root and a Pages project path', () => {
  assert.equal(manifest.name, 'Sudoku CooCoo')
  assert.equal(manifest.display, 'standalone')
  for (const path of ['/', '/sudoku_ux_exp/']) {
    const url = new URL(`https://example.test${path}manifest.webmanifest`)
    for (const property of ['id', 'start_url', 'scope']) {
      assert.equal(new URL(manifest[property], url).pathname, path)
    }
    for (const icon of manifest.icons) {
      assert.ok(new URL(icon.src, url).pathname.startsWith(path))
    }
  }
})

test('Android and iPhone icons exist at their declared sizes', () => {
  const sizes = new Set(manifest.icons.map((icon) => icon.sizes))
  assert.ok(sizes.has('192x192'))
  assert.ok(sizes.has('512x512'))
  assert.ok(manifest.icons.some((icon) => icon.purpose?.split(' ').includes('maskable')))
  const appleIcon = html.match(/<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]+)"/)
  assert.ok(appleIcon, 'iPhone home-screen icon must be linked')
  for (const icon of [...manifest.icons, { src: appleIcon[1], sizes: '180x180' }]) {
    const png = read(icon.src)
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes)
  }
})

test('offline cache contains the entry page, embedded puzzle bundle, styles, and icons', () => {
  assert.ok(entries.length > 0, 'service worker must have a precache manifest')
  const htmlAssets = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)]
    .map((match) => match[1])
  assert.ok(htmlAssets.some((name) => /^assets\/.+\.js$/.test(name)))
  assert.ok(htmlAssets.some((name) => /^assets\/.+\.css$/.test(name)))
  for (const asset of ['index.html', 'registerSW.js', 'manifest.webmanifest', ...htmlAssets]) {
    assert.ok(precached.has(asset), `${asset} must be available offline`)
  }
  for (const entry of entries) {
    const content = read(entry.url)
    if (entry.revision !== null) {
      assert.equal(createHash('md5').update(content).digest('hex'), entry.revision,
        `${entry.url} must match its offline cache revision`)
    }
  }
  assert.match(read('registerSW.js').toString(), /register\('\.\/sw\.js'/)
})
