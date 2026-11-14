(() => {
  const track = document.getElementById('visit-carousel-track');
  if (!track || track.children.length < 2) return;

  let cards = [...track.children];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let requestedIndex = null;

  function offset(index) {
    return cards[index].offsetLeft - cards[0].offsetLeft;
  }

  function currentIndex() {
    return cards.reduce((closest, card, index) =>
      Math.abs(offset(index) - track.scrollLeft) < Math.abs(offset(closest) - track.scrollLeft)
        ? index : closest, 0);
  }

  function makeArrow(direction, label, icon) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'visit-carousel-arrow';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-controls', track.id);
    button.textContent = icon;
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') return;
      requestedIndex = (requestedIndex ?? currentIndex()) + direction;
      track.scrollTo({ left: offset(requestedIndex), behavior: reduceMotion.matches ? 'instant' : 'smooth' });
      updateArrows();
    });
    track.parentElement.append(button);
    return button;
  }

  const previous = makeArrow(-1, 'Igreja anterior', '‹');
  const next = makeArrow(1, 'Próxima igreja', '›');

  function updateArrows() {
    const index = requestedIndex ?? currentIndex();
    previous.setAttribute('aria-disabled', String(index === 0));
    next.setAttribute('aria-disabled', String(index === cards.length - 1));
  }

  track.addEventListener('scroll', () => {
    if (requestedIndex !== null && Math.abs(track.scrollLeft - offset(requestedIndex)) < 2) requestedIndex = null;
    updateArrows();
  }, { passive: true });

  for (const event of ['pointerdown', 'wheel', 'focusin']) {
    track.addEventListener(event, () => { requestedIndex = null; updateArrows(); }, { passive: true });
  }
  track.addEventListener('visit-cards-changed', () => {
    cards = [...track.children];
    requestedIndex = null;
    updateArrows();
  });
  updateArrows();
})();
