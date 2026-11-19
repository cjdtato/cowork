# UI refresh
- Logo centering fixed (block SVG now centred with auto margins; invalid gradient id `lglogo big` replaced).
- Login + home header redesigned: flatter, hairline borders, softer shadows, no dot-grid (kept only for CEPALCO).
- Stats are an inline strip; header actions are ghost buttons; theme swatches moved into a Theme menu.
- 11 themes: Classic, Dark, Midnight, Graphite, Ocean, Forest, Lavender, Sunset, Sand, Pink, CEPALCO.
  Add one by: a `.th-name{...}` block in style.css, an entry in `THEMES` in auth.js and netlify/functions/api.mjs, and a swatch button.
- Shared-mode accent is now a per-theme token (`--sec`).
