import assert from 'node:assert/strict';
import test from 'node:test';
import { squareCropRect, squareOutputSize } from '../lib/square-crop.js';

test('landscape and portrait crops start at the center and can reach all edges', () => {
  assert.deepEqual(squareCropRect(1200, 800, 1, .5, .5), { x: 200, y: 0, size: 800 });
  assert.deepEqual(squareCropRect(800, 1200, 1, .5, .5), { x: 0, y: 200, size: 800 });
  assert.deepEqual(squareCropRect(1200, 800, 2, 0, 0), { x: 0, y: 0, size: 400 });
  assert.deepEqual(squareCropRect(1200, 800, 2, 1, 1), { x: 800, y: 400, size: 400 });
});

test('zoom and position never put pixels outside the image', () => {
  for (const [width, height] of [[1, 1], [3200, 400], [400, 3200], [1024, 1024]]) {
    for (const zoom of [-1, 1, 1.5, 4, 8]) {
      for (const position of [-1, 0, .5, 1, 2]) {
        const rect = squareCropRect(width, height, zoom, position, position);
        assert.ok(rect.x >= 0 && rect.y >= 0 && rect.size > 0);
        assert.ok(rect.x + rect.size <= width && rect.y + rect.size <= height);
      }
    }
  }
  assert.throws(() => squareCropRect(0, 800, 1, .5, .5));
  assert.throws(() => squareCropRect(800, NaN, 1, .5, .5));
});

test('output retains small images and bounds the square to 2048 pixels', () => {
  assert.equal(squareOutputSize(400), 400);
  assert.equal(squareOutputSize(4000), 2048);
  assert.equal(squareOutputSize(.25), 1);
});
