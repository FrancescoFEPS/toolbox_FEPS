/* Small animated GIF encoder (no library). Shared by the tools that make GIF files.
   GIF.encode(frames, width, height, { delayCs, loop, dither }) -> Uint8Array
   frames = array of RGBA pixel arrays (Uint8ClampedArray from getImageData), all width x height.
   One colour table (256 colours) is made for the whole animation, so colours do not flicker. */
"use strict";
const GIF = (() => {
  const key15 = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  const up = v => (v << 3) | (v >> 2);

  /* Colour table by median cut, from a sample of the pixels of all frames. */
  function buildPalette(frames) {
    const hist = new Uint32Array(32768);
    let total = 0; for (const f of frames) total += f.length >> 2;
    const step = Math.max(1, Math.floor(total / 300000));
    for (const f of frames) for (let i = 0; i < f.length; i += 4 * step) hist[key15(f[i], f[i + 1], f[i + 2])]++;
    const cols = []; for (let k = 0; k < 32768; k++) if (hist[k]) cols.push(k);
    const rgb = k => [up((k >> 10) & 31), up((k >> 5) & 31), up(k & 31)];
    if (cols.length <= 256) { const pal = cols.map(rgb); while (pal.length < 2) pal.push([0, 0, 0]); return pal; }
    let boxes = [cols];
    const chan = [k => (k >> 10) & 31, k => (k >> 5) & 31, k => k & 31];
    const pop = b => { let n = 0; for (const k of b) n += hist[k]; return n; };
    while (boxes.length < 256) {
      let bi = -1, best = 0;
      boxes.forEach((b, i) => { if (b.length > 1) { const p = pop(b); if (p > best) { best = p; bi = i; } } });
      if (bi < 0) break;
      const b = boxes[bi];
      let ax = 0, ar = -1;
      chan.forEach((c, a) => { let lo = 31, hi = 0; for (const k of b) { const v = c(k); if (v < lo) lo = v; if (v > hi) hi = v; } if (hi - lo > ar) { ar = hi - lo; ax = a; } });
      const c = chan[ax]; b.sort((x, y) => c(x) - c(y));
      let half = pop(b) / 2, acc = 0, cut = 1;
      for (let i = 0; i < b.length - 1; i++) { acc += hist[b[i]]; cut = i + 1; if (acc >= half) break; }
      boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
    }
    return boxes.map(b => { let n = 0, r = 0, g = 0, bl = 0; for (const k of b) { const h = hist[k], c = rgb(k); n += h; r += c[0] * h; g += c[1] * h; bl += c[2] * h; } return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)]; });
  }

  /* Index of the nearest colour of the table for each 15-bit colour, worked out only when needed. */
  function makeMapper(pal) {
    const cache = new Int16Array(32768).fill(-1);
    return k => {
      let m = cache[k]; if (m >= 0) return m;
      const r = up((k >> 10) & 31), g = up((k >> 5) & 31), b = up(k & 31);
      let bd = 1e9; m = 0;
      for (let i = 0; i < pal.length; i++) { const p = pal[i], d = (p[0] - r) * (p[0] - r) + (p[1] - g) * (p[1] - g) + (p[2] - b) * (p[2] - b); if (d < bd) { bd = d; m = i; } }
      return cache[k] = m;
    };
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function toIndices(rgba, w, h, map, dither) {
    const out = new Uint8Array(w * h);
    for (let y = 0, p = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, p++, i += 4) {
      let r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      if (dither) {
        const t = (BAYER[((y & 3) << 2) | (x & 3)] - 7.5) * 1.6;
        r = Math.max(0, Math.min(255, r + t)); g = Math.max(0, Math.min(255, g + t)); b = Math.max(0, Math.min(255, b + t));
      }
      out[p] = map(key15(r | 0, g | 0, b | 0));
    }
    return out;
  }

  /* GIF flavour of LZW */
  function lzw(idx, minCode) {
    const clear = 1 << minCode, eoi = clear + 1, out = [];
    let size = minCode + 1, next = eoi + 1, cur = 0, bits = 0, dict = new Map();
    const emit = c => { cur |= c << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
    emit(clear);
    let prefix = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const k = idx[i], key = (prefix << 8) | k, f = dict.get(key);
      if (f !== undefined) { prefix = f; continue; }
      emit(prefix);
      if (next === 4096) { emit(clear); dict = new Map(); next = eoi + 1; size = minCode + 1; }
      else { if (next >= (1 << size)) size++; dict.set(key, next++); }
      prefix = k;
    }
    emit(prefix); emit(eoi);
    if (bits > 0) out.push(cur & 255);
    return out;
  }

  function encode(frames, w, h, opt = {}) {
    if (!frames.length) throw new Error("no frames");
    const delay = Math.max(2, Math.round(opt.delayCs || 10)), pal = buildPalette(frames), map = makeMapper(pal);
    const out = [], w16 = v => out.push(v & 255, (v >> 8) & 255);
    for (const c of "GIF89a") out.push(c.charCodeAt(0));
    w16(w); w16(h); out.push(0xF7, 0, 0);                       // global colour table, 256 colours
    for (let i = 0; i < 256; i++) { const p = pal[i] || [0, 0, 0]; out.push(p[0], p[1], p[2]); }
    if (opt.loop !== false && frames.length > 1) { out.push(0x21, 0xFF, 11); for (const c of "NETSCAPE2.0") out.push(c.charCodeAt(0)); out.push(3, 1, 0, 0, 0); }   // loop forever
    let bytes = out.length; const parts = [Uint8Array.from(out)];
    for (const f of frames) {
      const head = [0x21, 0xF9, 4, 0x04, delay & 255, (delay >> 8) & 255, 0, 0, 0x2C, 0, 0, 0, 0, w & 255, (w >> 8) & 255, h & 255, (h >> 8) & 255, 0, 8];
      const data = lzw(toIndices(f, w, h, map, !!opt.dither), 8), blocks = [];
      for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); blocks.push(n); for (let j = 0; j < n; j++) blocks.push(data[i + j]); }
      blocks.push(0);
      parts.push(Uint8Array.from(head), Uint8Array.from(blocks));
    }
    parts.push(Uint8Array.of(0x3B));
    let n = 0; for (const p of parts) n += p.length;
    const res = new Uint8Array(n); let o = 0; for (const p of parts) { res.set(p, o); o += p.length; }
    return res;
  }
  return { encode };
})();
if (typeof module !== "undefined") module.exports = GIF;
