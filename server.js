import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Scraped from './Scraped.js';
import cors from 'cors'

const app = express();
const PORT = 3000;

mongoose.connect('mongodb://localhost:27017/webscraping')
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.error(err));

app.use(express.json());
app.use(cors({
  origin: "*"
}))

app.get('/scrape', async (req, res) => {
  const { topic } = req.query;

  if (!topic) {
    return res.status(404).json({ message: "No Query found" });
  }

  try {
    const url = `https://www.ndtv.com/topic/${topic}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const scrapedData = [];

    // Use Promise.all to handle asynchronous tasks in the loop
    const scrapePromises = $('.src_lst-li').map(async (index, element) => {
      const imageSrc = $(element).find('img').attr('src');
      const anchorLink = $(element).find('.src_itm-ttl a').attr('href');
      const spanText = $(element).find('img').attr('alt');
      const paragraphText = $(element).find('.src_itm-txt').text().trim();
      const uploaderAndTime = $(element).find('.src_itm-stx').text().split('|');
      const source = (uploaderAndTime[0])?.trim();
      const uploadTime = (uploaderAndTime[2])?.trim();

      if (source === "India News") {
        // Check if an entry with the same spanText already exists
        const exists = await Scraped.findOne({ spanText });

        if (!exists) {
          const entry = {
            type: topic,
            imageSrc,
            anchorLink,
            spanText,
            paragraphText,
            source,
            uploadTime,
          };
          scrapedData.push(entry);
        }
      }
    }).get(); // Get array of promises

    // Wait for all scraping promises to resolve
    await Promise.all(scrapePromises);

    if (scrapedData.length > 0) {
      const savedData = await Scraped.insertMany(scrapedData);
      return res.status(200).json(savedData);
    } else {
      return res.status(404).json({ message: "No relevant data found for the topic or data already exists" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Error occurred while scraping');
  }
});


app.get('/', async (req, res) => {
  try {
    const sortField = req.query.sortField;
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const page = parseInt(req.query.page) || 1;  // Default to page 1 if not provided
    const limit = parseInt(req.query.limit) || 10;  // Default to 10 items per page if not provided

    let query = Scraped.find();

    // Sort by valid fields if specified
    if (sortField) {
      const validFields = ['imageSrc', 'anchorLink', 'spanText', 'paragraphText', 'zxBigText'];

      if (validFields.includes(sortField)) {
        query = query.sort({ [sortField]: sortOrder });
      }
    }

    // Get total documents for pagination (without any pagination or sorting)
    const total = await Scraped.countDocuments(query.getFilter()); // Count the documents that match the query

    // Fetch the paginated data
    const data = await query.skip((page - 1) * limit).limit(limit);

    // Respond with the total count and paginated data
    res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      data
    });
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).send('Error retrieving data');
  }
});



app.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const page = parseInt(req.query.page, 10) || 1;  // Default to page 1 if not provided
    const limit = parseInt(req.query.limit, 10) || 10;  // Default to 10 items per page if not provided

    // Validate page and limit to be positive integers
    if (page < 1 || limit < 1) {
      return res.status(400).json({ error: 'Page and limit must be positive integers.' });
    }

    const query = Scraped.find({ type });
    const total = await Scraped.countDocuments({ type });

    // Fetch paginated data
    const data = await query.skip((page - 1) * limit).limit(limit);

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'No data found for the given type' });
    }

    // Respond with the total count and paginated data
    res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      data
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'An internal server error occurred. Please try again later.' });
  }
});


app.get("/health", (req, res) => {
  res.send("Health! Ok");
});

const keepAlive = () => {
  setInterval(async () => {
    try {
      const res = await axios.get('https://dmc-server.onrender.com/health');
      console.log(`Self-ping success: ${res.data}`);
    } catch (error) {
      console.error('Self-ping failed:', error.message);
    }
  }, 13 * 60 * 1000);
};


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  keepAlive();
});
