import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { getInitialPair, getNextVillain, checkGuess, Villain } from './villainGameUtils';
import { getCookie, setCookie } from './utils/cookies';
import { COOKIE_EXPIRY_DAYS, IMAGE_LOADING_SPIN_DELAY_MS, CATEGORY_ALL, CATEGORIES } from './utils/constants';

interface VillainCardProps {
  villain: Villain | null;
  side: 'left' | 'right';
  showCrimeCount: boolean;
  isRevealed: boolean;
  onSpinningChange?: (isSpinning: boolean) => void;
}

function VillainCard({ villain, side, showCrimeCount, isRevealed, onSpinningChange }: VillainCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [currentImage, setCurrentImage] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  
  // Notify parent component when spinning state changes
  useEffect(() => {
    if (onSpinningChange) {
      onSpinningChange(isSpinning);
    }
  }, [isSpinning, onSpinningChange]);
    const imageCache = useRef(new Map());
    const showWikiLink = side === 'left' || isRevealed;

    useEffect(() => {
      if (!villain) {
        setImageLoaded(false);
        setCurrentImage('');
        setShowFallback(true);
        setIsSpinning(true);
        const timer = setTimeout(() => setIsSpinning(false), IMAGE_LOADING_SPIN_DELAY_MS);
        return () => clearTimeout(timer);
      }

      const imageUrl = villain.imageUrl && villain.imageUrl.startsWith('https://static.wikia.nocookie.net/')
        ? `${import.meta.env.VITE_IMAGE_PROXY_BASE_URL || ''}/image-proxy?url=${encodeURIComponent(villain.imageUrl)}`
        : villain.imageUrl || '';

      if (!imageUrl) {
        setImageLoaded(false);
        setCurrentImage('');
        setShowFallback(true);
        setIsSpinning(true);
        const timer = setTimeout(() => setIsSpinning(false), IMAGE_LOADING_SPIN_DELAY_MS);
        return () => clearTimeout(timer);
      }

      // Only start spinning and reset states if the villain or imageUrl changes
      setImageLoaded(false);
      setShowFallback(false);
      setCurrentImage('');
      setIsSpinning(true);

      // Check if image is in cache first
      if (imageCache.current.has(imageUrl)) {
        const cachedImg = imageCache.current.get(imageUrl);
        if (cachedImg.complete) {
          setCurrentImage(imageUrl);
          setImageLoaded(true);
          setShowFallback(false);
          setIsSpinning(false);
          return;
        }
      }

      const img = new Image();
      imageCache.current.set(imageUrl, img);
      img.onload = () => {
        setCurrentImage(imageUrl);
        setImageLoaded(true);
        setTimeout(() => setIsSpinning(false), IMAGE_LOADING_SPIN_DELAY_MS);
      };
      img.onerror = () => {
        setShowFallback(true);
        setIsSpinning(false);
        imageCache.current.delete(imageUrl);
      };
      img.src = imageUrl;

      return () => {
        img.onload = null;
        img.onerror = null;
      };
    }, [villain]);

  if (!villain) {
    // When there's no villain, render a spinning empty card instead of just text
    return (
      <div className="villain-card empty">
        <div className="villain-image-container">
          <div className={`image-container ${isSpinning ? 'spinning' : ''}`}>
            <div className="image-fallback">?</div>
          </div>
        </div>
      </div>
    );
  }

  const imageToShow = showFallback 
    ? '/src/assets/unknown.png' 
    : currentImage;

  const renderImage = () => (
    <div className={`image-container ${isSpinning ? 'spinning' : ''}`}>
      {!imageLoaded && !showFallback ? (
        <div className="image-loading">Loading...</div>
      ) : (
        <img
          src={imageToShow}
          alt={villain.name}
          className={`villain-img ${isRevealed ? 'revealed' : ''}`}
          onError={() => setShowFallback(true)}
        />
      )}
    </div>
  );

  return (
    <div className={`villain-card ${side}`}>
      <div className="villain-image-container">
        {showWikiLink && villain.url ? (
          <a 
            href={villain.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="villain-link"
            title="View on Villains Wiki"
          >
            {renderImage()}
            <span className="wiki-text">🔍 View on Wiki</span>
          </a>
        ) : (
          renderImage()
        )}
      </div>
      <h2>{villain.name}</h2>
      <p className="villain-category">Category: {villain.category}</p>
      {villain.villainType && villain.villainType.toLowerCase() !== 'unknown' && (
        <p className="villain-type">Type: {villain.villainType}</p>
      )}
      <p className="villain-desc">{villain.description}</p>
      {(showCrimeCount || isRevealed) && (
        <div className="crime-count">
          Crimes: {villain.crimeCount || 0}
        </div>
      )}
    </div>
  );
}



function App() {
  const [left, setLeft] = useState<Villain | null>(null);
  const [right, setRight] = useState<Villain | null>(null);
  const [message, setMessage] = useState('');
  const [disable, setDisable] = useState(false);
  const [score, setScore] = useState(0);
  const [leftCardSpinning, setLeftCardSpinning] = useState(false);
  const [rightCardSpinning, setRightCardSpinning] = useState(false);
  const [category, setCategory] = useState(() => {
    const savedCategory = getCookie('category');
    return savedCategory || CATEGORY_ALL;
  });
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'hardcore'>(() => {
    const savedDifficulty = getCookie('difficulty');
    return (savedDifficulty as 'easy' | 'medium' | 'hard' | 'hardcore') || 'medium';
  });
  const [highScore, setHighScore] = useState(() => {
    // Initialize high score from cookie or default to 0
    const savedHighScore = getCookie('highScore');
    return savedHighScore ? parseInt(savedHighScore, 10) : 0;
  });
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Update high score whenever score changes
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      setCookie('highScore', score.toString(), COOKIE_EXPIRY_DAYS);
    }
  }, [score, highScore]);

  const loadNextVillain = useCallback(async (leftVillain: Villain) => {
    return await getNextVillain(leftVillain, category === CATEGORY_ALL ? undefined : category, difficulty);
  }, [category, difficulty]);

  const loadNewPair = useCallback(async () => {
    const initialPair = await getInitialPair(category === CATEGORY_ALL ? undefined : category, difficulty);
    if (!initialPair) return; // Handle null case
    const [a, b] = initialPair;
    setLeft(a);
    setRight(b);
  }, [category, difficulty]);

  // Load initial pair only once on component mount
  useEffect(() => {
    loadNewPair();
  }, []); // Dependency array includes loadNewPair

  // Save difficulty to cookie whenever it changes
  useEffect(() => {
    setCookie('difficulty', difficulty, COOKIE_EXPIRY_DAYS);
  }, [difficulty]);

  // Save category to cookie whenever it changes
  useEffect(() => {
    setCookie('category', category, COOKIE_EXPIRY_DAYS);
  }, [category]);

  const handleGuess = useCallback(async (guess: 'left' | 'right' | 'higher' | 'lower') => {
    // Prevent guessing if either card is still spinning or if already disabled
    if (!left || !right || disable || leftCardSpinning || rightCardSpinning) return;

    setDisable(true); // Disable buttons immediately
    setShowResult(true); // Show result immediately

    const isCorrect = checkGuess(left, right, guess, difficulty);
    setRevealAnswer(true); // Always reveal answer after a guess

    if (isCorrect) {
      setMessage('Correct!');
      setScore(prevScore => prevScore + 1);
    } else {
      setMessage('Incorrect! Game Over.');
      setScore(0); // Reset score on loss
      setDisable(true); // Keep disabled after game over
      // No new villain loaded, just show game over message
    }
  }, [left, right, disable, difficulty, score, highScore, loadNextVillain, loadNewPair, leftCardSpinning, rightCardSpinning]);
  
  const handleNext = useCallback(async () => {
    setShowResult(false);
    setRevealAnswer(false);
    
    if (message === 'Correct!') {
      // Get next villain for the right side
      let nextVillain: Villain | null = await loadNextVillain(right as Villain);
      
      if (nextVillain) {
        setLeft(right);
        
        // For medium and hard difficulty, ensure we don't have a tie
        if ((difficulty === 'medium' || difficulty === 'hard') && nextVillain) {
          // If we have a tie, try up to 3 more times to get a non-tie villain
          if (right && nextVillain.crimeCount === right.crimeCount) {
            console.log(`Tie detected in handleNext for ${difficulty} mode, trying again...`);
            let attempts = 0;
            let foundNonTie = false;
            
            while (!foundNonTie && attempts < 3) {
              const newVillain = await loadNextVillain(right as Villain);
              if (newVillain && right && newVillain.crimeCount !== right.crimeCount) {
                nextVillain = newVillain;
                foundNonTie = true;
                console.log(`Found non-tie villain in handleNext for ${difficulty} mode`);
              } else {
                attempts++;
                console.log(`Attempt ${attempts}: Still a tie in handleNext for ${difficulty} mode`);
              }
            }
          }
        }
        
        setRight(nextVillain);
      } else {
        // If no next villain, load a completely new pair
        await loadNewPair();
      }
    } else {
      // Reset the game with a new pair
      await loadNewPair();
    }
    
    setDisable(false);
    setMessage('');
    
    // Preload the next villain in the background
    if (right) {
      await loadNextVillain(right as Villain); // This already uses difficulty from the loadNextVillain useCallback
    }
  }, [message, right, loadNextVillain, difficulty, category, loadNewPair]);

  const handleCategoryChange = async (newCategory: string) => {
    setCategory(newCategory);
    setScore(0);
    setDisable(true);
    setMessage('Loading...');
    setShowResult(false);
    setRevealAnswer(false);
    
    try {
      const initialPair = await getInitialPair(newCategory === CATEGORY_ALL ? undefined : newCategory, difficulty);
      if (!initialPair) {
        setMessage('Error loading villains. Please try again.');
        setDisable(false);
        return;
      }
      const [a, b] = initialPair;
      setLeft(a);
      setRight(b);
      setMessage('');
      setDisable(false);
    } catch (error) {
      console.error('Error loading villains:', error);
      setMessage('Error loading villains. Please try again.');
      setDisable(false);
    }
  };

  const handleDifficultyChange = async (newDifficulty: 'easy' | 'medium' | 'hard' | 'hardcore') => {
    console.log(`Changing difficulty to: ${newDifficulty}`);
    setDifficulty(newDifficulty);
    setScore(0);
    setDisable(true);
    setMessage('Loading...');
    setShowResult(false);
    setRevealAnswer(false);
    
    try {
      const initialPair = await getInitialPair(category === CATEGORY_ALL ? undefined : category, newDifficulty);
      if (!initialPair) {
        setMessage('Error loading villains. Please try again.');
        setDisable(false);
        return;
      }
      const [a, b] = initialPair;
      setLeft(a);
      setRight(b);
      setMessage('');
      setDisable(false);
    } catch (error) {
      console.error('Error loading villains:', error);
      setMessage('Error loading villains. Please try again.');
      setDisable(false);
    }
  };

  return (
    <div className="game-container">
      <h1>Who Has Committed More Crimes?</h1>
      <div className="category-selector">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`category-btn ${category === cat.id ? 'active' : ''}`}
            onClick={() => handleCategoryChange(cat.id)}
            disabled={disable && !showResult}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <div className="difficulty-selector">
        <button
          className={`difficulty-btn difficulty-btn-easy ${difficulty === 'easy' ? 'active' : ''}`}
          onClick={() => handleDifficultyChange('easy')}
          disabled={disable && !showResult}
          title="Use first random villain"
        >
          Easy
        </button>
        <button
          className={`difficulty-btn difficulty-btn-medium ${difficulty === 'medium' ? 'active' : ''}`}
          onClick={() => handleDifficultyChange('medium')}
          disabled={disable && !showResult}
          title="Filter out ties"
        >
          Medium
        </button>
        <button
          className={`difficulty-btn difficulty-btn-hard ${difficulty === 'hard' ? 'active' : ''}`}
          onClick={() => handleDifficultyChange('hard')}
          disabled={disable && !showResult}
          title="Use closest of two random villains and filter out ties"
        >
          Hard
        </button>
        <button
          className={`difficulty-btn difficulty-btn-hardcore ${difficulty === 'hardcore' ? 'active' : ''}`}
          onClick={() => handleDifficultyChange('hardcore')}
          disabled={disable && !showResult}
          title="Use closest of five random villains and filter out ties"
        >
          Hardcore
        </button>
      </div>
      <div className="villains-row">
        <VillainCard 
          villain={left} 
          side="left" 
          showCrimeCount={true}
          isRevealed={revealAnswer}
          onSpinningChange={setLeftCardSpinning}
        />
        <div className="vs-container">
          <div className="controls-sticky">
            <div className="score-display">
              <div className="score">Score: {score}</div>
              <div className="high-score">High Score: {highScore}</div>
            </div>
            <div className="arrows-container">
              <button 
                className={`vs-arrow ${showResult || leftCardSpinning || rightCardSpinning ? 'disabled' : ''}`} 
                onClick={() => handleGuess('higher')} 
                disabled={disable || showResult || leftCardSpinning || rightCardSpinning}
                aria-label="Higher"
                style={{
                  fontSize: '2rem',
                  padding: '0.5rem',
                  minWidth: '60px',
                  minHeight: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'manipulation'
                }}
              >
                ˄
              </button>
              <div className="vs" style={{
                padding: '0.5rem',
                fontSize: '1.5rem',
                margin: '0.5rem 0'
              }}>VS</div>
              <button 
                className={`vs-arrow ${showResult || leftCardSpinning || rightCardSpinning ? 'disabled' : ''}`} 
                onClick={() => handleGuess('lower')} 
                disabled={disable || showResult || leftCardSpinning || rightCardSpinning}
                aria-label="Lower"
                style={{
                  fontSize: '2rem',
                  padding: '0.5rem',
                  minWidth: '60px',
                  minHeight: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'manipulation'
                }}
              >
                ˅
              </button>
            </div>
            <div className="result-message-container">
              {showResult && (
                <div className="result-message show">
                  <div className="message">{message}</div>
                  <button 
                    className="next-round-btn"
                    onClick={handleNext}
                    title="Next Round"
                    aria-label="Next Round"
                  >
                    {message.includes('Correct') ? '➜' : '↻'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <VillainCard 
          villain={right} 
          side="right" 
          showCrimeCount={revealAnswer}
          isRevealed={revealAnswer}
          onSpinningChange={setRightCardSpinning}
        />
      </div>

      <div className="instructions">
        <p>Guess if the villain on the right has committed more or fewer crimes than the villain on the left.<br/>Each villain's category and description is shown below their name.</p>
      </div>
    </div>
  );
}

export default App;
