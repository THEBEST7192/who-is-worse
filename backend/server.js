import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import axios from 'axios';
import cors from 'cors';
import { DIFFICULTY, CANDIDATE_POOL_SIZES, MAX_ATTEMPTS_MEDIUM } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3001;

// Serve villains.json
app.get('/api/villains', (req, res) => {
  const { difficulty, category, leftVillainName, numCandidates } = req.query;
  let allVillains = [];
  try {
    const villainsPath = path.join(__dirname, 'data', 'villains.json');
    const villainsData = readFileSync(villainsPath, 'utf8');
    allVillains = JSON.parse(villainsData);

    let filteredVillains = allVillains;

    if (category && category !== 'all') {
      filteredVillains = filteredVillains.filter(villain => villain.category === category);
    }
    console.log(`Filtered villains count for category '${category}': ${filteredVillains.length}`);

    // Helper function to get a random villain from a filtered list
    const getRandomVillain = (excludeNames = []) => {
      const availableVillains = filteredVillains.filter(v =>
        !excludeNames.includes(v.name) && !v.name.startsWith('Category:')
      );
      if (availableVillains.length === 0) return null;
      const idx = Math.floor(Math.random() * availableVillains.length);
      return { ...availableVillains[idx] };
    };

    let firstVillain = null;
    if (leftVillainName) {
      firstVillain = allVillains.find(v => v.name === leftVillainName);
    } else {
      // If no leftVillainName is provided, pick a random first villain
      firstVillain = getRandomVillain();
    }

    if (difficulty === 'easy') {
      const secondVillain = getRandomVillain(firstVillain ? [firstVillain.name] : []);
      console.log(`Easy difficulty: firstVillain: ${firstVillain?.name}, secondVillain: ${secondVillain?.name}`);
      res.json({ firstVillain, secondVillain });
    } else if (difficulty === 'medium') {
      let secondVillain = null;
      let attempts = 0;
      const MAX_ATTEMPTS = MAX_ATTEMPTS_MEDIUM;
      do {
        secondVillain = getRandomVillain(firstVillain ? [firstVillain.name] : []);
        attempts++;
      } while (attempts < MAX_ATTEMPTS && secondVillain && firstVillain && secondVillain.crimeCount === firstVillain.crimeCount);

      console.log(`Medium difficulty: firstVillain: ${firstVillain?.name}, secondVillain: ${secondVillain?.name}`);
      res.json({ firstVillain, secondVillain });
    } else if (difficulty === DIFFICULTY.HARD || difficulty === DIFFICULTY.HARDCORE) {
      const num = CANDIDATE_POOL_SIZES[difficulty];
      let candidates = [];
      const usedNames = firstVillain ? [firstVillain.name] : [];

      for (let i = 0; i < num; i++) {
        const candidate = getRandomVillain([...usedNames, ...candidates.map(v => v.name)]);
        if (candidate) {
          candidates.push(candidate);
          usedNames.push(candidate.name);
        }
      }

      let secondVillain = null;
      if (firstVillain && candidates.length > 0) {
        // Filter out tying villains first, unless all are tying
        let nonTyingCandidates = candidates.filter(c => c.crimeCount !== firstVillain.crimeCount);

        if (nonTyingCandidates.length === 0) {
          // If all candidates are tying, pick one randomly from all candidates
          secondVillain = candidates[Math.floor(Math.random() * candidates.length)];
        } else {
          // Find the non-tying villain with the closest crime count
          secondVillain = nonTyingCandidates.reduce((prev, curr) => {
            const prevDiff = Math.abs(prev.crimeCount - firstVillain.crimeCount);
            const currDiff = Math.abs(curr.crimeCount - firstVillain.crimeCount);
            if (currDiff < prevDiff) {
              return curr;
            } else if (currDiff === prevDiff) {
              // If differences are equal, prioritize the one with higher crime count
              return curr.crimeCount > prev.crimeCount ? curr : prev;
            } else {
              return prev;
            }
          });
        }
      } else if (candidates.length > 0) {
        // If no firstVillain (shouldn't happen for hard/hardcore but for safety), pick a random candidate
        secondVillain = candidates[Math.floor(Math.random() * candidates.length)];
      }

      console.log(`Hard/Hardcore difficulty: firstVillain: ${firstVillain?.name}, secondVillain: ${secondVillain?.name}`);
      res.json({ firstVillain, secondVillain });
    } else {
      // Default case: return a random pair if difficulty is not specified or unknown
      const first = getRandomVillain();
      const second = getRandomVillain(first ? [first.name] : []);
      console.log(`Default difficulty: firstVillain: ${first?.name}, secondVillain: ${second?.name}`);
      res.json({ firstVillain: first, secondVillain: second });
    }
  } catch (error) {
    console.error('Error reading villains.json:', error);
    res.status(500).json({ message: 'Error loading villains data' });
  }
});

// Image proxy endpoint
app.get('/image-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string' || !url.startsWith('https://static.wikia.nocookie.net/')) {
    return res.status(400).send('Invalid image URL');
  }
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);
  } catch (e) {
    console.error('Image proxy error:', e);
    res.status(404).send('Image not found');
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});