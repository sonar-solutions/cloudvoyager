// -------- Detect Used Languages --------

export function detectUsedLanguages(components) {
  const usedLanguages = new Set();
  components.forEach(comp => {
    if (comp.language) usedLanguages.add(comp.language.toLowerCase());
  });
  if (usedLanguages.has('js') || usedLanguages.has('javascript')) {
    usedLanguages.add('js');
    usedLanguages.add('javascript');
    usedLanguages.add('ts');
    usedLanguages.add('web');
  }
  return usedLanguages;
}
