'use strict';
window.VideiraLeadershipPhone = (() => {
 const attributes = 'maxlength="40" autocomplete="tel-national" inputmode="tel" placeholder="(82) 91234-5678"';
 function format(value) {
  const digits = value.replace(/\D/g, '');
  const local = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length <= 2) return local;
  const area = local.slice(0, 2);
  const number = local.slice(2);
  return '(' + area + ') ' + number.slice(0, 5) + (number.length > 5 ? '-' + number.slice(5) : '');
 }
 function bind(input) {
  const isMobile = value => /^[1-9]\d9\d{8}$/.test(value.replace(/\D/g, ''));
  const initial = input.value;
  const formatted = format(initial);
  if (isMobile(formatted)) input.value = formatted;
  input.addEventListener('input', () => {
   const value = format(input.value);
   if (isMobile(value)) input.value = value;
   input.setCustomValidity(input.value && !isMobile(value) ? 'Informe um celular com DDD e nove dígitos, como (82) 91234-5678.' : '');
  });
  input.form.addEventListener('reset', () => input.setCustomValidity(''));
 }
 return {attributes, bind};
})();
