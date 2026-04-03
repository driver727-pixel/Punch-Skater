import express from 'express';
import cors from 'cors';
import { handler } from '@fal-ai/server-proxy/express';
import 'dotenv/config';

const app = express();

// Allow the production site, GitHub Pages, and localhost to call this server
app.use(cors({
  origin: ['https://punchskater.com', 'https://driver727-pixel.github.io', 'http://localhost:5173'],
}));

// This automatically handles all /api/fal/* requests and attaches your key
app.all('/api/fal/*', handler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Card Forge Proxy running on port ${PORT}`);
});
