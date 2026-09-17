// Small shared formatter so "1 class" vs "5 classes" is handled consistently
// everywhere, instead of every screen repeating its own ternary (and some of them
// forgetting to).
export function classesLabel(n) {
  return `${n} ${n === 1 ? "class" : "classes"}`;
}
