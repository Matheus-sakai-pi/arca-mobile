export const soundEffectsConfig = {
  enabledByDefault: true,
  volume: 0.65,
  diagnostics: false,
  sources: {
    correct: require('../../assets/sounds/correct.wav'),
    wrong: require('../../assets/sounds/wrong.wav'),
  },
} as const;
