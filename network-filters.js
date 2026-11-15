'use strict';
window.VideiraNetworkFilters = (() => {
 const categories = new Map([['group:adults','Adultos'],['group:youth','Jovens'],['group:kids','Kids']]);
 const churchOf = network => network.church_id ?? network.church;
 function category(network) {
  const name = (network?.name || '').trim().toLowerCase().replace(/^rede\s+/, '');
  if (network?.kind === 'kids' || /^kids\b/.test(name)) return 'group:kids';
  if (name === 'adultos') return 'group:adults';
  if (name === 'jovens') return 'group:youth';
  return '';
 }
 function update(select, networks, church, all = 'Todas as redes') {
  const previous = select.value;
  const scoped = church ? networks.filter(network => churchOf(network) === church) : networks;
  const options = new Map(categories);
  const kids = scoped.filter(network => category(network) === 'group:kids');
  if (church && kids.length > 1) {
   for (const network of kids.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))) {
    if (/^(rede\s+)?kids$/i.test(network.name.trim())) continue;
    options.set(network.id, network.name);
   }
  }
  for (const network of scoped) {
   if (!category(network) && ![...options.values()].includes(network.name)) options.set('name:' + network.name, network.name);
  }
  select.replaceChildren(new Option(all, ''), ...Array.from(options, ([value, label]) => new Option(label, value)));
  select.value = options.has(previous) ? previous : '';
 }
 function matches(value, network, id = network?.id) {
  if (!value) return true;
  if (categories.has(value)) return category(network) === value;
  return value === id || value === 'name:' + network?.name;
 }
 return {update, matches};
})();
