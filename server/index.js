import express from 'express';
import cors from 'cors';
import { createExpressHandler } from '@fal-ai/server-proxy/express';
import 'dotenv/config';

const app = express();

// Allow the production site, GitHub Pages, and localhost to call this server
app.use(cors({
  origin: ['https://punchskater.com', 'https://driver727-pixel.github.io', 'http://localhost:5173'],
}));

// Restrict the proxy to only the Fal.ai endpoint this app actually uses.
// allowUnauthorizedRequests is true because image generation does not require
// user authentication; access is already limited by the CORS allowlist above.
const falHandler = createExpressHandler({
  allowedEndpoints: ['fal-ai/flux/dev'],
  allowUnauthorizedRequests: true,
});

app.all('/api/fal/*', falHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Card Forge Proxy running on port ${PORT}`);
});
