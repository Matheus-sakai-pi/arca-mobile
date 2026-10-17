export const ENERGY_CONFIG = Object.freeze({
  version: 2,
  capacity: 30,
  exerciseCost: 1,
  refillSeconds: 2880,
  streakMilestones: [5, 10] as readonly number[],
  streakBonusMin: 5,
  streakBonusMax: 8,
  perfectBonus: 5,
  bonusOverflow: false,
  minimumDraftHours: 72,
  pollSeconds: 30,
  legacyCapacity: 5,
  legacyRefillSeconds: 14400,
});

export const CHEST_ENERGY_CONFIG = Object.freeze({ min: 5, max: 7, completedFraction: 0.5 });
