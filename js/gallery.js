/* =========================================================
   Galeria de fotos do projeto
   Ao clicar, a foto cresce do lugar onde está até o centro da tela.
   A animação usa a Web Animations API porque o modo leve zera as
   transições em CSS, e a foto precisa animar nos dois modos.
   ========================================================= */
(function () {
  'use strict';

  const DURATION = 380;
  const EASING = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
  const SCREEN_MARGIN = 24;
  const CAPTION_SPACE = 64;
  const MAX_UPSCALE = 1.6; // acima disso, a foto começa a ficar borrada
  const THUMB_RADIUS = 18;
  const FULL_RADIUS = 8;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gallery = document.querySelector('.gallery');
  if (!gallery) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', 'Foto ampliada');
  dialog.innerHTML = `
    <div class="lightbox__backdrop"></div>
    <img class="lightbox__image" alt="">
    <p class="lightbox__caption"></p>
    <button class="lightbox__close" type="button" aria-label="Fechar foto">&times;</button>
  `;
  document.body.appendChild(dialog);

  const backdrop = dialog.querySelector('.lightbox__backdrop');
  const image = dialog.querySelector('.lightbox__image');
  const caption = dialog.querySelector('.lightbox__caption');

  let activeFigure = null;
  let busy = false;

  // Trava a rolagem sem deixar a página pular quando a barra de rolagem some
  function lockScroll() {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  function unlockScroll() {
    document.documentElement.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  // Maior tamanho em que a foto inteira cabe na tela, centralizada
  function computeFullRect() {
    const maxWidth = Math.min(window.innerWidth - SCREEN_MARGIN * 2, image.naturalWidth * MAX_UPSCALE);
    const maxHeight = Math.min(
      window.innerHeight - SCREEN_MARGIN * 2 - CAPTION_SPACE,
      image.naturalHeight * MAX_UPSCALE
    );
    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    return {
      left: (window.innerWidth - width) / 2,
      top: (window.innerHeight - CAPTION_SPACE - height) / 2,
      width,
      height,
    };
  }

  function placeImage() {
    const rect = computeFullRect();
    image.style.left = `${rect.left}px`;
    image.style.top = `${rect.top}px`;
    image.style.width = `${rect.width}px`;
    image.style.height = `${rect.height}px`;
    caption.style.top = `${rect.top + rect.height + 14}px`;
    return rect;
  }

  // Quadros da foto: de "recortada no card" até "inteira no centro".
  // O clip-path reproduz o recorte do object-fit: cover da galeria.
  function buildImageFrames(rect) {
    const thumb = activeFigure.getBoundingClientRect();
    const scale = Math.max(thumb.width / rect.width, thumb.height / rect.height);
    const moveX = thumb.left + thumb.width / 2 - (rect.left + rect.width / 2);
    const moveY = thumb.top + thumb.height / 2 - (rect.top + rect.height / 2);
    const clipX = (rect.width * scale - thumb.width) / 2 / scale;
    const clipY = (rect.height * scale - thumb.height) / 2 / scale;
    return [
      {
        transform: `translate(${moveX}px, ${moveY}px) scale(${scale})`,
        clipPath: `inset(${clipY}px ${clipX}px round ${THUMB_RADIUS / scale}px)`,
      },
      {
        transform: 'translate(0px, 0px) scale(1)',
        clipPath: `inset(0px 0px round ${FULL_RADIUS}px)`,
      },
    ];
  }

  // Roda a animação da foto e o fade do fundo; devolve quando as duas terminam
  function animate(direction) {
    if (reducedMotion) return Promise.resolve();
    const timing = { duration: DURATION, easing: EASING, direction, fill: 'both' };
    const fade = [{ opacity: 0 }, { opacity: 1 }];
    const animations = [
      image.animate(buildImageFrames(placeImage()), timing),
      backdrop.animate(fade, timing),
      caption.animate(fade, timing),
    ];
    return Promise.all(animations.map((item) => item.finished)).then(() => animations);
  }

  async function open(figure) {
    const thumb = figure.querySelector('img');
    if (busy || dialog.open || !thumb || !thumb.complete || !thumb.naturalWidth) return;
    busy = true;
    activeFigure = figure;

    image.src = thumb.currentSrc || thumb.src;
    image.alt = thumb.alt;
    const figcaption = figure.querySelector('figcaption');
    caption.textContent = figcaption ? figcaption.textContent : '';
    await image.decode().catch(() => { /* a foto já carregou na galeria */ });

    lockScroll();
    dialog.showModal();
    placeImage();
    const animations = await animate('normal');
    if (animations) animations.forEach((item) => item.cancel()); // volta a valer o CSS
    busy = false;
  }

  async function close() {
    if (busy || !dialog.open) return;
    busy = true;
    const animations = await animate('reverse');
    dialog.close();
    if (animations) animations.forEach((item) => item.cancel()); // senão a próxima abertura herda o estado final
    unlockScroll();
    activeFigure = null;
    busy = false;
  }

  function figureFromEvent(event) {
    return event.target.closest('.gallery__item');
  }

  gallery.addEventListener('click', (event) => {
    const figure = figureFromEvent(event);
    if (figure) open(figure);
  });

  // Teclado: Enter ou espaço abrem a foto que está em foco
  gallery.querySelectorAll('.gallery__item img').forEach((photo) => {
    photo.tabIndex = 0;
    photo.setAttribute('role', 'button');
  });
  gallery.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const figure = figureFromEvent(event);
    if (!figure) return;
    event.preventDefault();
    open(figure);
  });

  dialog.addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => { // tecla Esc
    event.preventDefault();
    close();
  });
  window.addEventListener('resize', () => {
    if (dialog.open) placeImage();
  });
})();
