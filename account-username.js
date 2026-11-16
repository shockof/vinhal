'use strict';
window.VideiraUsername = (() => {
  function login(value) {
    return value.trim().replace(/^@/, '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, '');
  }

  function bind(input) {
    const label = input.closest('label');
    const help = document.createElement('small');
    help.setAttribute('aria-live', 'polite');
    label.append(help);
    function update() {
      const handle = login(input.value);
      const valid = /^[a-z0-9][a-z0-9._-]{2,49}$/.test(handle);
      input.setCustomValidity(input.value && !valid ? 'Use de 3 a 50 caracteres no login. São permitidos letras, números, ponto, hífen e sublinhado.' : '');
      help.textContent = valid ? 'Login: @' + handle : 'Este nome será exibido nos cartões.';
    }
    input.addEventListener('input', update);
    update();
  }

  return {login, bind};
})();
