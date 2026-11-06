/* =========================================================
   Fundo animado do site inteiro
   Desenha poeira dourada, notas musicais flutuando e ondas sonoras.
   O canvas fica fixo atrás da página (ver .bg-canvas no CSS).
   ========================================================= */
(function () {
  'use strict';

  const canvas = document.getElementById('heroCanvas');
  // No modo leve o fundo nem é desenhado (o CSS também esconde o canvas)
  if (!canvas || document.documentElement.classList.contains('lite')) return;

  const ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SYMBOLS = ['♪', '♫', '♩', '♬', '𝄞'];
  const MOUSE_RADIUS = 130;
  // Fora da tela inicial as ondas ficam mais fracas para não atrapalhar a leitura
  const WAVE_MIN_FADE = 0.3;

  // Ondas do rodapé: altura relativa, amplitude, comprimento, velocidade e transparência
  const WAVES = [
    { y: 0.72, amplitude: 28, length: 0.006, speed: 0.6, alpha: 0.35 },
    { y: 0.76, amplitude: 42, length: 0.004, speed: -0.4, alpha: 0.18 },
    { y: 0.8, amplitude: 18, length: 0.01, speed: 0.9, alpha: 0.12 },
  ];

  const mouse = { x: -9999, y: -9999 };
  let width = 0;
  let height = 0;
  let particles = [];
  let symbols = [];
  let time = 0;
  let running = false;

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function createParticle(anywhere) {
    return {
      x: random(0, width),
      y: anywhere ? random(0, height) : height + 10,
      radius: random(0.4, 1.8),
      speedX: random(-0.15, 0.15),
      speedY: random(0.15, 0.6),
      alpha: random(0.2, 0.9),
      twinkle: random(0, Math.PI * 2),
      pushX: 0,
      pushY: 0,
    };
  }

  function createSymbol(anywhere) {
    return {
      char: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      x: random(0, width),
      y: anywhere ? random(0, height) : height + 60,
      size: random(16, 46),
      speed: random(0.2, 0.55),
      rotation: random(-0.4, 0.4),
      spin: random(-0.004, 0.004),
      alpha: random(0.05, 0.22),
      sway: random(0, Math.PI * 2),
    };
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particleCount = Math.min(170, Math.floor((width * height) / 9000));
    const symbolCount = Math.min(16, Math.floor(width / 90));
    particles = Array.from({ length: particleCount }, () => createParticle(true));
    symbols = Array.from({ length: symbolCount }, () => createSymbol(true));
  }

  function drawWaves() {
    const scrolled = Math.min(1, window.scrollY / height);
    const fade = 1 - scrolled * (1 - WAVE_MIN_FADE);
    WAVES.forEach((wave) => {
      ctx.beginPath();
      for (let x = 0; x <= width; x += 6) {
        // As ondas são mais fortes no centro e somem nas bordas
        const envelope = Math.sin((x / width) * Math.PI);
        const y = height * wave.y
          + Math.sin(x * wave.length + time * wave.speed) * wave.amplitude * envelope
          + Math.sin(x * wave.length * 2.3 + time * wave.speed * 1.7) * wave.amplitude * 0.3 * envelope;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(212, 175, 55, ${wave.alpha * fade})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });
  }

  function drawSymbols() {
    symbols.forEach((symbol, index) => {
      symbol.y -= symbol.speed;
      symbol.sway += 0.01;
      symbol.rotation += symbol.spin;
      if (symbol.y < -60) symbols[index] = createSymbol(false);

      ctx.save();
      ctx.translate(symbol.x + Math.sin(symbol.sway) * 20, symbol.y);
      ctx.rotate(symbol.rotation);
      ctx.font = `${symbol.size}px "Segoe UI Symbol", "Noto Music", Georgia, serif`;
      ctx.fillStyle = `rgba(212, 175, 55, ${symbol.alpha})`;
      ctx.fillText(symbol.char, 0, 0);
      ctx.restore();
    });
  }

  function drawParticles() {
    particles.forEach((particle, index) => {
      particle.x += particle.speedX;
      particle.y -= particle.speedY;
      particle.twinkle += 0.03;

      // A poeira foge do mouse
      const dx = particle.x + particle.pushX - mouse.x;
      const dy = particle.y + particle.pushY - mouse.y;
      const distance = Math.hypot(dx, dy);
      if (distance < MOUSE_RADIUS && distance > 0) {
        const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS;
        particle.pushX += (dx / distance) * force * 2.5;
        particle.pushY += (dy / distance) * force * 2.5;
      }
      particle.pushX *= 0.94;
      particle.pushY *= 0.94;

      if (particle.y < -10) particles[index] = createParticle(false);

      const alpha = particle.alpha * (0.6 + 0.4 * Math.sin(particle.twinkle));
      ctx.beginPath();
      ctx.arc(particle.x + particle.pushX, particle.y + particle.pushY, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(243, 220, 147, ${alpha})`;
      ctx.fill();
    });
  }

  function drawFrame() {
    ctx.clearRect(0, 0, width, height);
    drawWaves();
    drawSymbols();
    drawParticles();
  }

  function loop() {
    if (!running) return;
    time += 0.016;
    drawFrame();
    requestAnimationFrame(loop);
  }

  // Pausa quando a aba fica escondida (economiza processador)
  function updateRunning() {
    const shouldRun = !document.hidden && !reducedMotion;
    if (shouldRun && !running) {
      running = true;
      requestAnimationFrame(loop);
    } else if (!shouldRun) {
      running = false;
    }
  }

  // O canvas cobre a janela inteira, então a posição do mouse já é a da tela
  window.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  document.documentElement.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (reducedMotion) drawFrame();
    }, 150);
  });

  resize();
  drawFrame();

  document.addEventListener('visibilitychange', updateRunning);
  updateRunning();
})();
