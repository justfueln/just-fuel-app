if (typeof window !== 'undefined') {
  window.addEventListener('jf-open-basket', () => {
    const button = document.querySelector('.bag-button, .training-basket');
    if (button instanceof HTMLElement) button.click();
  });
}
