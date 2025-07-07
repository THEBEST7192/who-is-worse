// Backend-specific constants

export const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  HARDCORE: 'hardcore'
};

export const CANDIDATE_POOL_SIZES = {
  [DIFFICULTY.HARD]: 5,
  [DIFFICULTY.HARDCORE]: 10
};

export const MAX_ATTEMPTS_MEDIUM = 10;