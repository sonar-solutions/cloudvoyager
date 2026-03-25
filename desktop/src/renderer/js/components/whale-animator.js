/**
 * Whale animation component — pixel whale sprite, starfield, cloud parallax.
 * Used by ExecutionScreen to render the progress animation.
 */
window.WhaleAnimator = {
  whaleSpriteF1: null,
  whaleSpriteF2: null,
  whaleAnimInterval: null,
  starfieldTwinkleInterval: null,
  typewriterInterval: null,
  _cloudTile: null,
  _cloudPalette: null,
  _resizeHandler: null,

  /** Render a sprite array onto an offscreen canvas. */
  renderSprite(spriteArray, palette, scale, expectedWidth) {
    const canvas = document.createElement('canvas');
    canvas.width = expectedWidth * scale;
    canvas.height = spriteArray.length * scale;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < spriteArray.length; y++) {
      const row = spriteArray[y].padEnd(expectedWidth, ' ');
      for (let x = 0; x < expectedWidth; x++) {
        const ch = row[x];
        if (palette[ch]) {
          ctx.fillStyle = palette[ch];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    return canvas;
  },

  /** Draw the whale sprite, starfield, and clouds into the DOM. */
  drawWhale() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const palette = isDark ? {
      'D': '#1e293b', 'M': '#334155', 'L': '#94a3b8',
      'W': '#f8fafc', 'B': '#0f172a', 'C': '#bae6fd',
      'S': '#7dd3fc', 'P': '#e0f2fe'
    } : {
      'D': '#1e3a5f', 'M': '#2d5986', 'L': '#5b8cb8',
      'W': '#ffffff', 'B': '#0c2340', 'C': '#7ec8e3',
      'S': '#4da8da', 'P': '#b8dff0'
    };

    // Frame 1: Tail up, spout visible
    const whaleF1 = [
      '                                                                                ',
      '                                                                                ',
      '                                          P   P                                 ',
      '                                         P  P  P                                ',
      '                                        PPPPPPPPP                               ',
      '                                          PPPPP                                 ',
      '                                            P                                   ',
      '                                                                                ',
      '                                  DDDDDDDDDDDD                                  ',
      '                              DDDDMMMMMMMMMMMMDDDD                              ',
      '                           DDDMMMMMMMMMMMMMMMMMMMMDD                            ',
      '                         DDMMMMMMMMMMMMMMMMMMMMMMMMMDD                          ',
      '                       DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD                        ',
      '  DD                 DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD                       ',
      ' DMMD               DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMBMD                      ',
      ' DMMMD            DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDD                      ',
      ' DMMMMD         DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWW                    ',
      '  DMMMMD      DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWWWW                   ',
      '   DMMMMDDDDDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWW                    ',
      '    DMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWWW                    ',
      '     DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWWWW                    ',
      '       DDDWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWLLWWWWWWW                     ',
      '          WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWLLWWWWWW                      ',
      '                            DDDDDDDDD                                           ',
      '                            DMMMMMMMMDD                                         ',
      '                             DMMMMMMMMMDD                                       ',
      '                              WWWWWWWWWWW                                       ',
      '                               WWWWWWWWWW                                       ',
      '                                WWWWWWWW                                        ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                '
    ];

    // Frame 2: Tail down, no spout
    const whaleF2 = [
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                  DDDDDDDDDDDD                                  ',
      '                              DDDDMMMMMMMMMMMMDDDD                              ',
      '                           DDDMMMMMMMMMMMMMMMMMMMMDD                            ',
      '                         DDMMMMMMMMMMMMMMMMMMMMMMMMMDD                          ',
      '                       DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD                        ',
      '                     DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD                       ',
      '                   DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMBMD                       ',
      '  DD             DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDD                       ',
      ' DMMD          DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWW                     ',
      ' DMMMD       DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWWWW                    ',
      ' DMMMMD   DDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWW                     ',
      '  DMMMMDDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWWW                     ',
      '   DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWWWW                     ',
      '     DDDWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWLLWWWWWWW                      ',
      '        WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWLLWWWWWW                       ',
      '                             DDDDDDD                                            ',
      '                              DMMMMMMDD                                         ',
      '                               DMMMMMMMDD                                       ',
      '                                WWWWWWWWWW                                      ',
      '                                 WWWWWWWWW                                      ',
      '                                  WWWWWWWW                                      ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                '
    ];

    // Multi-shaded pixel clouds
    const cloudSprite = [
      '',
      '          WWWW',
      '        WWWWWWWW                              WWW',
      '       WWWWWWWWWW                           WWWWWWW',
      '      WWWWWWWWWWWC                         WWWWWWWWC',
      '     WWWWWWWWWWWWCC                       WWWWWWWWWCC',
      '    WWWWWWWWWWWWWWCC                     WWWWWWWWWWWCC',
      '    CCCCCCCCCCCCCCCC                     CCCCCCCCCCCCC',
      '     SSSSSSSSSSSSSS                       SSSSSSSSSSS',
      '',
      '',
      '                                    WWWWW',
      '                                  WWWWWWWWW',
      '                                 WWWWWWWWWWC',
      '                                WWWWWWWWWWWWCC',
      '                                CCCCCCCCCCCCCC',
      '                                 SSSSSSSSSSSS',
      '',
      '  WWW',
      ' WWWWWWW                                                 WWWW',
      'WWWWWWWWC                                              WWWWWWWW',
      'CCCCCCCCCC                                            WWWWWWWWWC',
      'SSSSSSSSSS                                            CCCCCCCCCC',
      '                                                       SSSSSSSS',
      '',
      '                         WWWWWWW',
      '                       WWWWWWWWWWW',
      '                      WWWWWWWWWWWWC',
      '                      CCCCCCCCCCCCC',
      '                       SSSSSSSSSSS',
      '',
      ''
    ];

    // --- WHALE: render both frames as offscreen canvases ---
    this.whaleSpriteF1 = this.renderSprite(whaleF1, palette, 2, 80);
    this.whaleSpriteF2 = this.renderSprite(whaleF2, palette, 2, 80);

    // Create display canvas and append to DOM
    const whaleEl = document.getElementById('whale-sprite');
    if (whaleEl) {
      const display = document.createElement('canvas');
      display.width = 160;  // 80 * 2
      display.height = 64;  // 32 * 2
      display.id = 'whale-display';
      whaleEl.appendChild(display);
      display.getContext('2d').drawImage(this.whaleSpriteF1, 0, 0);
    }

    // --- STARFIELD: draw a canvas of twinkling stars behind the whale ---
    const trackEl = document.querySelector('.whale-track');
    if (trackEl) {
      const starCanvas = document.createElement('canvas');
      starCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
      const trackRect = trackEl.getBoundingClientRect();
      const starW = Math.max(trackRect.width, 400);
      const starH = Math.max(trackRect.height, 64);
      starCanvas.width = starW;
      starCanvas.height = starH;
      const starCtx = starCanvas.getContext('2d');

      // Generate random star positions
      const starCount = 40 + Math.floor(Math.random() * 20); // 40-60 stars
      const stars = [];
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * starW,
          y: Math.random() * starH,
          r: 0.5 + Math.random() * 1.5, // 0.5-2px radius
          opacity: 0.3 + Math.random() * 0.7, // 0.3-1.0
          isBlue: Math.random() > 0.7 // 30% chance of light blue tint
        });
      }

      const drawStars = () => {
        starCtx.clearRect(0, 0, starW, starH);
        const dark = document.documentElement.getAttribute('data-theme') !== 'light';
        for (const star of stars) {
          const color = dark
            ? (star.isBlue ? `rgba(200, 220, 255, ${star.opacity})` : `rgba(255, 255, 255, ${star.opacity})`)
            : (star.isBlue ? `rgba(100, 140, 200, ${star.opacity * 0.5})` : `rgba(80, 100, 140, ${star.opacity * 0.4})`);
          starCtx.fillStyle = color;
          starCtx.beginPath();
          starCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
          starCtx.fill();
        }
      };

      drawStars();
      trackEl.insertBefore(starCanvas, trackEl.firstChild);

      // Subtle twinkle: randomly adjust opacity of a few stars every 2s
      this.starfieldTwinkleInterval = setInterval(() => {
        const numTwinkle = 5 + Math.floor(Math.random() * 5);
        for (let i = 0; i < numTwinkle; i++) {
          const idx = Math.floor(Math.random() * stars.length);
          stars[idx].opacity = 0.3 + Math.random() * 0.7;
        }
        drawStars();
      }, 2000);
    }

    // --- CLOUDS: render tile then repeat across a wide canvas (dynamic to track width) ---
    const cloudTile = this.renderSprite(cloudSprite, palette, 2, 64);
    const tileW = cloudTile.width;  // 128
    const cloudTrackEl = document.querySelector('.whale-track');
    const trackWidth = cloudTrackEl ? cloudTrackEl.getBoundingClientRect().width : 800;
    // Need enough tiles to cover the full track width + one extra tile for seamless scroll
    const numTiles = Math.ceil(trackWidth / tileW) + 2;
    const cloudsCanvas = document.createElement('canvas');
    cloudsCanvas.width = tileW * numTiles;
    cloudsCanvas.height = cloudTile.height;
    const cloudCtx = cloudsCanvas.getContext('2d');
    for (let i = 0; i < numTiles; i++) {
      cloudCtx.drawImage(cloudTile, i * tileW, 0);
    }
    const cloudsEl = document.getElementById('whale-clouds');
    if (cloudsEl) cloudsEl.appendChild(cloudsCanvas);

    // --- CLOUDS: rebuild on resize so they always cover the full track width ---
    this._cloudTile = cloudTile;
    this._cloudPalette = palette;
    this._resizeHandler = () => {
      const el = document.getElementById('whale-clouds');
      const track = document.querySelector('.whale-track');
      if (!el || !track || !this._cloudTile) return;
      const newWidth = track.getBoundingClientRect().width;
      const tw = this._cloudTile.width;
      const count = Math.ceil(newWidth / tw) + 2;
      const existing = el.querySelector('canvas');
      if (existing && existing.width >= tw * count) return; // already wide enough
      const c = document.createElement('canvas');
      c.width = tw * count;
      c.height = this._cloudTile.height;
      const cx = c.getContext('2d');
      for (let i = 0; i < count; i++) cx.drawImage(this._cloudTile, i * tw, 0);
      if (existing) existing.remove();
      el.appendChild(c);
    };
    window.addEventListener('resize', this._resizeHandler);

    // --- FRAME ANIMATION: alternate whale sprites every 450ms ---
    let frame = 0;
    this.whaleAnimInterval = setInterval(() => {
      frame = (frame + 1) % 2;
      const canvas = document.getElementById('whale-display');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, 160, 64);
        ctx.drawImage(frame === 0 ? this.whaleSpriteF1 : this.whaleSpriteF2, 0, 0);
      }
    }, 450);
  },

  /** Move the whale sprite to the given percentage and update the trail/percent display. */
  updateWhale(percent) {
    const sprite = document.getElementById('whale-sprite');
    const trail = document.getElementById('whale-trail');
    const percentEl = document.getElementById('whale-percent');
    if (!sprite || !trail || !percentEl) return;

    const clamped = Math.min(100, Math.max(0, percent));
    // Whale moves from left (0%) to right (100%) of the track
    sprite.style.left = `calc(${clamped}% - 100px)`;
    trail.style.width = `${clamped}%`;
    percentEl.textContent = `${clamped}%`;

    // On completion: green trail, stop animation on spout frame
    if (clamped >= 100) {
      trail.classList.add('whale-trail-complete');
      if (this.whaleAnimInterval) {
        clearInterval(this.whaleAnimInterval);
        this.whaleAnimInterval = null;
      }
      const display = document.getElementById('whale-display');
      if (display && this.whaleSpriteF1) {
        const ctx = display.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 160, 64);
          ctx.drawImage(this.whaleSpriteF1, 0, 0);
        }
      }
    }
  },

  /** Show a phase label with typewriter effect. */
  setPhaseLabel(label) {
    const el = document.getElementById('whale-phase');
    if (!el) return;

    // Clear any ongoing typewriter interval
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
      this.typewriterInterval = null;
    }

    // Typewriter effect: type out char-by-char at ~30ms per char
    el.textContent = '';
    let charIndex = 0;
    this.typewriterInterval = setInterval(() => {
      if (charIndex < label.length) {
        el.textContent = label.slice(0, charIndex + 1);
        charIndex++;
      } else {
        clearInterval(this.typewriterInterval);
        this.typewriterInterval = null;
      }
    }, 30);
  },

  /** Clean up all intervals and event listeners. */
  cleanup() {
    if (this.whaleAnimInterval) { clearInterval(this.whaleAnimInterval); this.whaleAnimInterval = null; }
    if (this.typewriterInterval) { clearInterval(this.typewriterInterval); this.typewriterInterval = null; }
    if (this.starfieldTwinkleInterval) { clearInterval(this.starfieldTwinkleInterval); this.starfieldTwinkleInterval = null; }
    if (this._resizeHandler) { window.removeEventListener('resize', this._resizeHandler); this._resizeHandler = null; }
  }
};
