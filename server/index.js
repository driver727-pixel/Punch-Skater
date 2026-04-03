const express = require('express');
const cors = require('cors');
const { route } = require('@fal-ai/server-proxy/express');
require('dotenv').config();

const app = express();

// Allow your GitHub Pages URL or localhost to call this server
app.use(cors({
  origin: ['http://localhost:5173', 'https://driver727-pixel.github.io'] 
}));

// This automatically handles all /api/fal/* requests and attaches your key
app.all('/api/fal/*', route);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Card Forge Proxy running on port ${PORT}`);
});
