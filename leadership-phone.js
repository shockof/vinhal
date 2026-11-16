'use strict';
window.VideiraPhone = (() => {
 const attributes = 'maxlength="40" autocomplete="tel-national" inputmode="tel" placeholder="82 99999-9999"';
 function nationalDigits(value) {
  const digits = value.replace(/\D/g, '');
  return /^55\d{10,11}$/.test(digits) ? digits.slice(2) : digits;
 }
 function format(value) {
  if (!/^[+\d\s().-]+$/.test(value) || (value.trim().startsWith('+') && !/^\+55\d{10,11}$/.test(value.replace(/[\s().-]/g, '')))) return value;
  const digits = nationalDigits(value);
  if (!/^[1-9]\d{9,10}$/.test(digits)) return value;
  return digits.slice(0, 2) + ' ' + digits.slice(2, -4) + '-' + digits.slice(-4);
 }
 function bind(input, {mobileOnly = false} = {}) {
  if (input.dataset.phoneFormatting) return;
  input.dataset.phoneFormatting = 'true';
  input.value = format(input.value);
  function update() {
   const value = input.value.trim();
   const valid = !value || (/^[+\d\s().-]+$/.test(value) &&
    (!value.startsWith('+') || /^\+55[\s(\d]/.test(value)) &&
    (mobileOnly ? /^[1-9]\d9\d{8}$/ : /^[1-9]\d{9,10}$/).test(nationalDigits(value)));
   if (valid) input.value = format(value);
   input.setCustomValidity(valid ? '' : 'Informe um número brasileiro com DDD. Ex.: 82 99999-9999.');
  }
  input.addEventListener('input', update);
  input.addEventListener('blur', () => { input.value = format(input.value); });
  input.form.addEventListener('reset', () => input.setCustomValidity(''));
 }
 return {attributes, bind};
})();
