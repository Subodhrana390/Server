import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import * as cheerio from 'cheerio';
<<<<<<< HEAD
import Scraped from './Scraped.js';
=======
>>>>>>> c5851c8a79d1bbdb412e1d6cca23ec1a2449947c
import cors from 'cors'

const app = express();
const PORT = 3000;

mongoose.connect('mongodb+srv://gencoder:kharay2005@cluster0.qicga.mongodb.net/WebScrappingDB?retryWrites=true&w=majority')
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.error(err));

app.use(express.json());
app.use(cors({
  origin: "*"
}))

app.get('/scrape', async (req, res) => {

  const { topic } = req.query;

  if (!topic) {
    return res.status(404).json({ message: "No Query found" })
  }

  try {
    const url = `https://timesofindia.indiatimes.com/topic/${topic}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const scrapedData = [];
    $('.uwU81').each((index, element) => {
      const imageSrc = $(element).find('img').attr('src');
      const anchorLink = $(element).find('a').attr('href');
      const spanText = $(element).find('span').first().text().trim();
      const paragraphText = $(element).find('p').text().trim();
      const zxBigText = $(element).find('.ZxBIG').text().trim();

      const Entries = {
        type: topic,
        imageSrc,
        anchorLink,
        spanText,
        paragraphText,
        zxBigText
      }
      scrapedData.push(Entries);
    })
    const savedData = await Scraped.insertMany(scrapedData);
    res.status(200).json(savedData);
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

    if (sortField) {
      const validFields = ['imageSrc', 'anchorLink', 'spanText', 'paragraphText', 'zxBigText'];

      if (validFields.includes(sortField)) {
        query = query.sort({ [sortField]: sortOrder });
      }
    }

    const total = await Scraped.countDocuments();
    const data = await query.skip((page - 1) * limit).limit(limit);

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const query = Scraped.find({ type });
    const total = await Scraped.countDocuments({ type });

    const data = await query.skip((page - 1) * limit).limit(limit);

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'No data found for the given type' });
    }

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


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
