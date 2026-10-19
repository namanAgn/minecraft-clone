TEXTURES
========
Edit any PNG here and refresh the page. A missing or misspelled file shows as a
magenta and black checkerboard, with a warning in the browser console.

blocks/       One PNG per face texture, 16 x 16 pixels (set BLOCK_TEXTURE_SIZE in config.js
              for a different size). The names to use are listed in blocks.js, without .png.
items/        Optional hotbar icons. Name them in items.js with the icon field, without .png.
              Items that place a block show that block's side texture instead.
player/skin.png
              The player's skin, on a 64 x 64 grid (the same layout the standard 64x64
              skins use, so skin editors work). A bigger file such as 128 x 128 also works
              if it keeps the layout.

SKIN LAYOUT (x, y, width, height on the 64 x 64 grid)
Each body part is unfolded into six rectangles. "right" and "left" are the
character's own sides, not yours when you look at them from the front.

  part        origin   top           bottom        right         front         left          back
  head        0,0      8,0,8,8       16,0,8,8      0,8,8,8       8,8,8,8       16,8,8,8      24,8,8,8
  body        16,16    20,16,8,4     28,16,8,4     16,20,4,12    20,20,8,12    28,20,4,12    32,20,8,12
  right arm   40,16    44,16,4,4     48,16,4,4     40,20,4,12    44,20,4,12    48,20,4,12    52,20,4,12
  left arm    32,48    36,48,4,4     40,48,4,4     32,52,4,12    36,52,4,12    40,52,4,12    44,52,4,12
  right leg   0,16     4,16,4,4      8,16,4,4      0,20,4,12     4,20,4,12     8,20,4,12     12,20,4,12
  left leg    16,48    20,48,4,4     24,48,4,4     16,52,4,12    20,52,4,12    24,52,4,12    28,52,4,12
