/* =========================================================
   Efeitos gerais da página
   Menu, animações ao rolar, barra de progresso e brilho do cursor.
   ========================================================= */
(function () {
  'use strict';

  const LITE_STORAGE_KEY = 'synthesis-lite'; // mesma chave do script no <head> do index.html
  const liteMode = document.documentElement.classList.contains('lite');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Separa o título "Synthesis" em letras para animar uma de cada vez
  function splitHeroTitle() {
    const title = document.getElementById('heroTitle');
    if (!title) return;
    const text = title.textContent.trim();
    title.setAttribute('aria-label', text);
    title.innerHTML = '';
    [...text].forEach((char, index) => {
      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = char;
      letter.style.setProperty('--i', index);
      letter.setAttribute('aria-hidden', 'true');
      title.appendChild(letter);
    });
  }

  function setupNav() {
    const nav = document.getElementById('nav');
    const toggle = document.getElementById('navToggle');
    const links = document.querySelectorAll('#navLinks a');

    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }));

    // Destaca no menu a seção que está no meio da tela
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => {
          link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach((section) => observer.observe(section));
  }

  function setupScrollEffects() {
    const progress = document.getElementById('scrollProgress');
    const nav = document.getElementById('nav');
    const timeline = document.getElementById('timeline');
    const timelineProgress = document.getElementById('timelineProgress');
    let ticking = false;

    function update() {
      const scrollTop = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${maxScroll > 0 ? scrollTop / maxScroll : 0})`;
      nav.classList.toggle('is-scrolled', scrollTop > 40);

      // A linha dourada da história "se enche" conforme a rolagem (no modo leve ela já fica cheia)
      if (timeline && !liteMode) {
        const rect = timeline.getBoundingClientRect();
        const ratio = (window.innerHeight * 0.6 - rect.top) / rect.height;
        timelineProgress.style.transform = `scaleY(${Math.max(0, Math.min(1, ratio))})`;
      }
      ticking = false;
    }

    // requestAnimationFrame evita recalcular mais vezes do que a tela consegue mostrar
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  function setupReveal() {
    // Itens dentro de [data-stagger] aparecem em cascata, um depois do outro
    document.querySelectorAll('[data-stagger]').forEach((group) => {
      group.querySelectorAll(':scope > .reveal').forEach((element, index) => {
        element.style.setProperty('--delay', `${index * 0.1}s`);
      });
    });

    const elements = document.querySelectorAll('.reveal');
    // No modo leve tudo já aparece no lugar, sem esperar a rolagem
    if (liteMode || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible', 'is-settled'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    elements.forEach((element) => {
      observer.observe(element);
      // Depois que entrou, tira o atraso para o hover responder na hora.
      // Ignora transições de elementos internos, que também chegam aqui
      const settle = (event) => {
        if (event.target !== element || event.propertyName !== 'opacity') return;
        element.classList.add('is-settled');
        element.removeEventListener('transitionend', settle);
      };
      element.addEventListener('transitionend', settle);
    });
  }

  // Brilho dourado que segue o mouse com um pequeno atraso (suavizado)
  function setupCursorGlow() {
    const glow = document.getElementById('cursorGlow');
    if (!glow || liteMode || reducedMotion || !window.matchMedia('(pointer: fine)').matches) return;

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const current = { x: target.x, y: target.y };

    window.addEventListener('pointermove', (event) => {
      target.x = event.clientX;
      target.y = event.clientY;
      glow.classList.add('is-visible');
    });
    document.documentElement.addEventListener('mouseleave', () => glow.classList.remove('is-visible'));

    function follow() {
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;
      glow.style.transform = `translate(${current.x}px, ${current.y}px)`;
      requestAnimationFrame(follow);
    }
    follow();
  }

  // Botão "Modo leve": salva a escolha no navegador e recarrega a página já no novo modo
  function setupLiteToggle() {
    const button = document.getElementById('liteToggle');
    if (!button) return;

    button.setAttribute('aria-pressed', String(liteMode));
    button.textContent = liteMode ? 'Modo leve: on' : 'Modo leve';

    button.addEventListener('click', () => {
      try {
        localStorage.setItem(LITE_STORAGE_KEY, liteMode ? '0' : '1');
      } catch (error) {
        console.warn('Não foi possível salvar o modo leve:', error);
      }
      // Tira o ?lite da URL, senão ele forçaria o modo de novo ao recarregar
      history.replaceState(null, '', location.pathname + location.hash);
      location.reload();
    });
  }

  // Atualiza a parte dourada preenchida dos sliders
  function setupRanges() {
    document.querySelectorAll('input[type="range"]').forEach((input) => {
      const update = () => {
        const percent = ((input.value - input.min) / (input.max - input.min)) * 100;
        input.style.setProperty('--fill', `${percent}%`);
      };
      input.addEventListener('input', update);
      update();
    });
  }

  splitHeroTitle();
  setupNav();
  setupScrollEffects();
  setupReveal();
  setupCursorGlow();
  setupRanges();
  setupLiteToggle();
  document.getElementById('year').textContent = new Date().getFullYear();
})();
