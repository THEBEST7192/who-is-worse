// Utility functions for the Villain Crime Guessing Game



export const fetchVillains = async (
  category: string | undefined,
  difficulty?: string,
  leftVillainName?: string,
  numCandidates?: number
): Promise<{ firstVillain: Villain | null; secondVillain: Villain | null }> => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  let url = `${baseUrl}/api/villains`;
  const params = new URLSearchParams();

  if (category && category !== 'all') {
    params.append('category', category);
  }
  if (difficulty) {
    params.append('difficulty', difficulty);
  }
  if (leftVillainName) {
    params.append('leftVillainName', leftVillainName);
  }
  if (numCandidates) {
    params.append('numCandidates', numCandidates.toString());
  }

  if (params.toString()) {
    url += `?${params.toString()}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }
    const data: { firstVillain: Villain | null; secondVillain: Villain | null } = await response.json();
    console.log('Fetched villain pair:', data); // Debug line
    return data;
  } catch (error) {
    console.error('Could not fetch villain pair:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
};

export interface Villain {
  name: string;
  crimeCount: number;
  // Add other properties as they become apparent or are needed
  [key: string]: any; // For properties not explicitly defined
}

// In-memory cache for preloaded images
const imagePreloadCache = new Map();

// Preload an image with caching
export function preloadImage(url: string) {
  if (!url) return Promise.resolve();
  
  // Return cached promise if image is already being loaded
  if (imagePreloadCache.has(url)) {
    return imagePreloadCache.get(url);
  }
const promise = new Promise((resolve, reject) => {
    const img = new Image();
    const proxyUrl = url.startsWith('https://static.wikia.nocookie.net/')
      ? `${import.meta.env.VITE_IMAGE_PROXY_BASE_URL || ''}/image-proxy?url=${encodeURIComponent(url)}`
      : url;
    
    img.onload = () => {
      resolve(proxyUrl);
    };
    
    img.onerror = (error) => {
      imagePreloadCache.delete(url);
      reject(error);
    };
    
    img.src = proxyUrl;
  });

  // Cache the promise
  imagePreloadCache.set(url, promise);
  return promise;
}

export const getInitialPair = async (category: string | undefined, difficulty: string): Promise<[Villain, Villain] | null> => {
  try {
    const numCandidates = difficulty === 'hard' ? 5 : difficulty === 'hardcore' ? 10 : 0;
    const { firstVillain, secondVillain } = await fetchVillains(category, difficulty, undefined, numCandidates);

    if (!firstVillain || !secondVillain) {
      console.error('Could not generate a valid villain pair.');
      return null;
    }
    preloadImage(firstVillain.image);
    preloadImage(secondVillain.image);

    return [firstVillain, secondVillain];
  } catch (error) {
    console.error('Error in getInitialPair:', error);
    return null;
  }

  // These lines are now inside the try block in getInitialPair
  // and should not be here. The previous change moved them.
  // Removing them to avoid TS2304 errors.
  // The logic for preloading and returning the pair is now handled within the try-catch block of getInitialPair.

};

export async function getNextVillain(leftVillain: Villain, category: string | undefined, difficulty: string): Promise<Villain | null> {
  try {
    const numCandidates = difficulty === 'hard' ? 5 : difficulty === 'hardcore' ? 10 : 0;
    const { secondVillain } = await fetchVillains(category, difficulty, leftVillain.name, numCandidates);
    if (secondVillain) {
      preloadImage(secondVillain.image);
      return secondVillain;
    }
    return null;
  } catch (error) {
    console.error('Error in getNextVillain:', error);
    return null;
  }
}

export function checkGuess(left: Villain, right: Villain, guess: 'left' | 'right' | 'higher' | 'lower', difficulty: 'easy' | 'medium' | 'hard' | 'hardcore' = 'medium'): boolean {
  const leftCrimes = left.crimeCount || 0;
  const rightCrimes = right.crimeCount || 0;
  
  console.log(`Checking guess: ${guess}, difficulty: ${difficulty}`);
  console.log(`Left villain: ${left.name}, crimes: ${leftCrimes}`);
  console.log(`Right villain: ${right.name}, crimes: ${rightCrimes}`);
  
  // If there's a tie, it's always a win for the player in all difficulties
  if (leftCrimes === rightCrimes) {
    console.log(`${difficulty} mode: Tie detected. Tie counts as a win.`);
    return true; // Ties always count as a win
  }

  // For all difficulties, compare crime counts
  const result = guess === 'higher' ? rightCrimes > leftCrimes : rightCrimes < leftCrimes;
  console.log(`${difficulty} mode result: ${result}`);
  return result;
}
