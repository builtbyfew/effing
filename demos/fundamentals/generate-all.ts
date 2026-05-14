const steps = [
  "1a-first",
  "1b-two-segments",
  "1c-effects-motion",
  "1d-audio",
  "2a-title-card",
  "2b-badge-stacked",
  "3-final",
];

for (const step of steps) {
  console.log(`--- ${step} ---`);
  await import(`./${step}.tsx`);
}
