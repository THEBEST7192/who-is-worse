# Who is Worse? - Villain Comparison Game

A fun game that challenges you to guess which villain has committed more crimes. Features villains from movies, TV shows, video games, comic books and books! With a filtering system to select your favorite category and a difficulty setting to adjust the challenge level.

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/THEBEST7192/who-is-worse
   cd who-is-worse
   ```

2. Install dependencies for frontend/backend/scraper
   ```bash
   # Install main app dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   cd ..
   
   # Install scraper dependencies
   cd scraper
   npm install
   cd ..
   ```

## Running the Application

You'll need to run two servers simultaneously:

1. **Backend Server** (port 3001 by default):
   ```bash
   # From the project root directory
   cd backend
   npm start
   ```

2. **Main Application** (port 5173 by default):
   Before running the main application, create a `.env` file in the project root directory with the following content:
   ```
   VITE_API_BASE_URL=http://localhost:3001
   VITE_IMAGE_PROXY_BASE_URL=http://localhost:3001
   ```
   Then, from the project root directory:
   ```bash
   npm run dev
   ```
   Or for a production build:
   ```bash
   npm run build
   serve -s dist
   ```

3. **Access the Game**:
   Open your browser and visit: http://localhost:5173

## Scraping Villain Data (Optional)

To update the villain database:

```bash
cd scraper
node scraper.js
```

This will update the `villains.json` file with the latest villain data from [villains.fandom.com](https://villains.fandom.com/wiki/Main_Page) and save it in `scraper/data/villains.json`, move it to the `backend/data` folder.

(This takes 30-40 minutes for *~~68141~~* *~~68203~~* **68227** entries)

## Troubleshooting

- **No Images Appear**: Make sure the image proxy server is running on port 3001
- **CORS Errors**: Ensure both servers are running and accessible
- **Missing Data**: Run the scraper to update the villain database

### Game Logic

The game logic is primarily handled in `src/villainGameUtils.ts` and `backend/server.js`:
- `fetchVillains`: Fetches villain data from the backend. It now accepts `category`, `difficulty`, `leftVillainName`, and `numCandidates` parameters to filter and select villains server-side, reducing data transfer.
- `getInitialPair`: Generates the first pair of villains for a new game by calling the backend with the selected category and difficulty.
- `getNextVillain`: Fetches the next villain for the right side by calling the backend, passing the left villain's name, category, and difficulty.
- `checkGuess`: Determines if the player's guess is correct based on crime counts.
- `isTie`: Checks if two villains have the same crime count.
- `preloadImage`: Preloads villain images to improve user experience.

### Difficulty Levels (Backend-Handled)

The game features four difficulty levels, with the villain selection logic now primarily handled by the backend:
- **Easy**: The backend selects a random villain for the right side, meaning a tie in crime count is possible.
- **Medium**: The backend attempts to find a non-tying villain for the right side, similar to the previous frontend logic.
- **Hard**: The backend selects the right villain from a pool of 5 candidates, aiming for the closest non-tying crime count to the left villain.
- **Hardcore**: The backend selects the right villain from a pool of 10 candidates, aiming for the closest non-tying crime count to the left villain.

### Adding Custom Villain Categories

To add your own custom villain categories:

1.  **Define the category in the Scraper**: Open `scraper/scraper.js` and add your new category to the `categories` array. The `url` should point to a Fandom wiki category page, and the `name` will be the category identifier used throughout the application.

    Example:
    ```javascript
    const categories = [
      // ... existing categories
      { url: 'https://villains.fandom.com/wiki/Category:My_New_Villain_Category', name: 'My New Category' }
    ];
    ```

2.  **Run the Scraper**: Navigate to the `scraper` directory in your terminal and run `node scraper.js`. This will scrape villains from the new category and output it too `backend/data/villains.json`, move the file to `scraper/data/villans.json`

3.  **Update Frontend Constants**: Open `src/utils/constants.ts` and add your new category to the `CATEGORIES` array. The `id` should exactly match the `name` you defined in `scraper/scraper.js`.

    Example:
    ```typescript
    export const CATEGORIES = [
      // ... existing categories
      { id: 'My New Category', name: 'My New Category' }
    ];
    ```

Now, your custom category will appear in the game's category selection dropdown, and villains from that category will be available.


## Contact 
For any issues or suggestions, please contact me here:
Discord: @thebest7192