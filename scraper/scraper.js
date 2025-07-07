import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categories = [
  { url: 'https://villains.fandom.com/wiki/Category:Comic_Book_Villains', name: 'Comic Book' },
  { url: 'https://villains.fandom.com/wiki/Category:Book_Villains', name: 'Book' },
  { url: 'https://villains.fandom.com/wiki/Category:Video_Game_Villains', name: 'Video Game' },
  { url: 'https://villains.fandom.com/wiki/Category:Movie_Villains', name: 'Movie' },
  { url: 'https://villains.fandom.com/wiki/Category:TV_Show_Villains', name: 'TV Show' }
];

const DATA_PATH = path.join(__dirname, 'data', 'villains.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchHTML(url) {
  const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  return cheerio.load(data);
}

async function scrapeCategory(categoryObj) {
  let villains = [];
  let nextUrl = categoryObj.url;
  while (nextUrl) {
    console.log('Scraping category page:', nextUrl);
    const $ = await fetchHTML(nextUrl);
    $('.category-page__member').each((_, el) => {
      const link = $(el).find('a.category-page__member-link');
      const name = link.text().trim();
      const url = 'https://villains.fandom.com' + link.attr('href');
      const img = $(el).find('img').attr('src') || '';
      villains.push({ name, url, img, category: categoryObj.name });
    });
    // Find next page
    const nextLink = $('a.category-page__pagination-next').attr('href');
    if (nextLink) {
      if (nextLink.startsWith('http')) {
        nextUrl = nextLink;
      } else if (nextLink.startsWith('/')) {
        nextUrl = 'https://villains.fandom.com' + nextLink;
      } else {
        // relative path, append to domain
        nextUrl = 'https://villains.fandom.com/' + nextLink.replace(/^\/*/, '');
      }
    } else {
      nextUrl = null;
    }
    await sleep(1000); // be nice to the server
  }
  return villains;
}

function extractCrimeCount($) {
  // 1. Try infobox-style extraction
  let crimes = null;
  let crimeEntries = [];
  $('.pi-data-label').each((_, el) => {
    const label = $(el).text().toLowerCase();
    if (label.includes('crime')) {
      const valueEl = $(el).closest('.pi-item').find('.pi-data-value');
      if (valueEl.length) {
        // Get all text nodes separated by <br>, <p>, or newlines
        let html = valueEl.html() || '';
        // Replace <br> and <p> with newlines for splitting
        html = html.replace(/<br\s*\/?>(\s*)?/gi, '\n')
                   .replace(/<p[^>]*>/gi, '\n')
                   .replace(/<\/p>/gi, '\n');
        // Remove any remaining HTML tags
        html = html.replace(/<[^>]+>/g, '');
        // Split and trim
        const entries = html.split(/\n|\r/).map(e => e.trim()).filter(e => e.length > 0);
        crimeEntries.push(...entries);
      }
    }
  });
  if (crimeEntries.length > 0) {
    return crimeEntries.length;
  }

  // 2. Fallback: Try to find a table row with "Crimes" or "Notable Crimes" or similar
  $('tr').each((_, el) => {
    const label = $(el).find('th').text().toLowerCase();
    if (label.includes('crime') || label.includes('notable actions')) {
      const text = $(el).find('td').text().trim();
      // Try to extract a number from the text
      const match = text.match(/\d+/);
      crimes = match ? parseInt(match[0], 10) : 0;
    }
  });
  return crimes;
}


function extractDescription($) {
  // Try to get the first paragraph after the infobox
  let description = '';
  const firstParagraph = $('.mw-parser-output > p')
    .filter((_, el) => $(el).text().trim().length > 100) // Filter out short paragraphs
    .first()
    .text()
    .trim()
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' '); // Collapse multiple spaces
  
  // If we couldn't find a good paragraph, try the first non-empty one
  if (!firstParagraph) {
    description = $('.mw-parser-output > p')
      .filter((_, el) => $(el).text().trim().length > 0)
      .first()
      .text()
      .trim()
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ');
  } else {
    description = firstParagraph;
  }
  
  // Truncate to 300 characters and add ellipsis if needed
  if (description.length > 300) {
    description = description.substring(0, 297) + '...';
  }
  
  return description || 'No description available.';
}

function extractVillainType($) {
  // Try to find infobox rows with label 'Type', 'Villain Type', etc.
  let villainType = '';
  $('tr').each((_, el) => {
    const label = $(el).find('th').text().toLowerCase();
    if (label.includes('type')) {
      villainType = $(el).find('td').text().trim();
    }
  });
  // If not found, try to find infobox categories
  if (!villainType) {
    const categories = [];
    $('.pi-data-label').each((_, el) => {
      const label = $(el).text().toLowerCase();
      if (label.includes('type')) {
        categories.push($(el).next('.pi-data-value').text().trim());
      }
    });
    if (categories.length > 0) villainType = categories.join(', ');
  }
  return villainType || 'Unknown';
}

async function scrapeVillainDetails(villain) {
  try {
    const { data: html } = await axios.get(villain.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(html);

    // Extract high-res image
    let imageUrl = villain.img;
    try {
      // Find JSON-LD script with "image" property
      const ldJson = $('script[type="application/ld+json"]').html();
      if (ldJson) {
        const parsed = JSON.parse(ldJson);
        if (parsed && parsed.image) {
          imageUrl = parsed.image;
        }
      }
    } catch (err) {
      // fallback below
    }
    // If not found, upgrade the thumbnail URL
    if (imageUrl && /\/smart\//.test(imageUrl)) {
      imageUrl = imageUrl.replace(/\/smart\/width\/\d+\/height\/\d+/, '/scale-to-width-down/1200');
    }

    const crimeCount = extractCrimeCount($) || 0;
    const description = extractDescription($);
    const villainType = extractVillainType($);
    // Always use the parent category from the scrapeCategory step
    const category = villain.category || getCategoryFromUrl(villain.url);
    
    return {
      name: villain.name,
      url: villain.url,
      category,
      villainType,
      description,
      imageUrl,
      crimeCount,
      lastUpdated: new Date().toISOString()
    };
  } catch (e) {
    console.error('Failed to scrape', villain.url, e.message);
    // fallback: upgrade thumbnail if possible
    let imageUrl = villain.img;
    if (imageUrl && /\/smart\//.test(imageUrl)) {
      imageUrl = imageUrl.replace(/\/smart\/width\/\d+\/height\/\d+/, '/scale-to-width-down/1200');
    }
    return {
      name: villain.name,
      url: villain.url,
      category: villain.category || getCategoryFromUrl(villain.url),
      villainType: 'Unknown',
      description: 'No description available.',
      imageUrl,
      crimeCount: 0,
      lastUpdated: new Date().toISOString()
    };
  }
}

async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.allSettled(ret);
}

async function main() {
  let allVillains = [];
  // First collect all villains from all categories
  for (const cat of categories) {
    console.log(`\n=== Scraping category: ${cat.name} ===`);
    const villains = await scrapeCategory(cat);
    allVillains = allVillains.concat(villains);
    console.log(`Found ${villains.length} villains in this category.`);
  }
  
  // Remove duplicates by URL
  const uniqueVillains = Array.from(new Map(allVillains.map(v => [v.url, v])).values());
  console.log(`\nTotal unique villains found: ${uniqueVillains.length}`);
  
  // Scrape details with concurrency pool
  const detailedVillains = [];
  const startTime = Date.now();
  let completed = 0;
  const poolLimit = 8; // Number of concurrent requests

  await asyncPool(poolLimit, uniqueVillains, async (villain, idx) => {
    const details = await scrapeVillainDetails(villain);
    detailedVillains.push(details);
    completed++;
    if (completed % 10 === 0 || completed === uniqueVillains.length) {
      fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
      fs.writeFileSync(DATA_PATH, JSON.stringify(detailedVillains, null, 2));
      console.log(`  Progress saved to ${DATA_PATH}`);
    }
    // Progress and ETA
    const elapsed = (Date.now() - startTime) / 1000;
    const itemsPerSecond = completed / elapsed;
    const remainingItems = uniqueVillains.length - completed;
    const etaSeconds = remainingItems / itemsPerSecond;
    const etaMinutes = Math.ceil(etaSeconds / 60);
    console.log(`[${completed}/${uniqueVillains.length}] Progress: ${Math.round((completed/uniqueVillains.length)*100)}% | ETA: ~${etaMinutes} min`);
  });

  // Final save
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(detailedVillains, null, 2));
  console.log('Done. Villains saved to', DATA_PATH);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
