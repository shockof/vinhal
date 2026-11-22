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

  function name(profile, fallback='A definir') {
    return [profile?.card_name,profile?.username].find(value=>typeof value==='string'&&value.trim())?.trim() || fallback;
  }
  function memberName(person, profiles=[]) {
    if(!person?.leadership_member) return person?.full_name || '';
    const direct=profiles.find(profile=>person.profile_id&&profile.id===person.profile_id);
    const matches=profiles.filter(profile=>profile.display_name===person.full_name);
    return name(direct || (matches.length===1?matches[0]:null),person.full_name);
  }
  return {login, bind, name, memberName};
})();
