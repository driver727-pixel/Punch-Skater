export function Credits() {
  return (
    <div className="page credits-page">
      <h1 className="page-title">CREDITS &amp; ATTRIBUTIONS</h1>
      <p className="page-sub">Tools, services, and libraries that power Punch Skater.</p>

      <section className="credits-section">
        <h2 className="credits-heading">Developed By</h2>
        <div className="credits-card credits-card--featured">
          <span className="credits-org">SP Digital LLC</span>
          <p className="credits-desc">Game design, engineering, and creative direction.</p>
          <a href="https://punchskater.com" target="_blank" rel="noopener noreferrer" className="credits-link">
            punchskater.com
          </a>
        </div>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Frameworks &amp; Build Tools</h2>
        <ul className="credits-list">
          <li className="credits-item">
            <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="credits-name">React</a>
            <span className="credits-desc">UI component library (MIT)</span>
          </li>
          <li className="credits-item">
            <a href="https://www.typescriptlang.org" target="_blank" rel="noopener noreferrer" className="credits-name">TypeScript</a>
            <span className="credits-desc">Typed JavaScript (Apache-2.0)</span>
          </li>
          <li className="credits-item">
            <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer" className="credits-name">Vite</a>
            <span className="credits-desc">Build tool &amp; dev server (MIT)</span>
          </li>
          <li className="credits-item">
            <a href="https://vite-pwa-org.netlify.app" target="_blank" rel="noopener noreferrer" className="credits-name">vite-plugin-pwa</a>
            <span className="credits-desc">Progressive Web App support (MIT)</span>
          </li>
        </ul>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Routing &amp; UI</h2>
        <ul className="credits-list">
          <li className="credits-item">
            <a href="https://reactrouter.com" target="_blank" rel="noopener noreferrer" className="credits-name">React Router DOM</a>
            <span className="credits-desc">Client-side routing (MIT)</span>
          </li>
          <li className="credits-item">
            <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer" className="credits-name">Lucide React</a>
            <span className="credits-desc">Icon library (ISC)</span>
          </li>
        </ul>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Backend &amp; Infrastructure</h2>
        <ul className="credits-list">
          <li className="credits-item">
            <a href="https://firebase.google.com" target="_blank" rel="noopener noreferrer" className="credits-name">Firebase</a>
            <span className="credits-desc">Authentication &amp; Firestore database (Google)</span>
          </li>
          <li className="credits-item">
            <a href="https://expressjs.com" target="_blank" rel="noopener noreferrer" className="credits-name">Express</a>
            <span className="credits-desc">Node.js proxy server (MIT)</span>
          </li>
          <li className="credits-item">
            <a href="https://github.com/expressjs/cors" target="_blank" rel="noopener noreferrer" className="credits-name">cors</a>
            <span className="credits-desc">Express CORS middleware (MIT)</span>
          </li>
          <li className="credits-item">
            <a href="https://github.com/express-rate-limit/express-rate-limit" target="_blank" rel="noopener noreferrer" className="credits-name">express-rate-limit</a>
            <span className="credits-desc">API rate-limiting middleware (MIT)</span>
          </li>
          <li className="credits-item">
            <a href="https://helmetjs.github.io" target="_blank" rel="noopener noreferrer" className="credits-name">Helmet</a>
            <span className="credits-desc">HTTP security headers middleware (MIT)</span>
          </li>
          <li className="credits-item">
            <a href="https://github.com/motdotla/dotenv" target="_blank" rel="noopener noreferrer" className="credits-name">dotenv</a>
            <span className="credits-desc">Environment variable management (BSD-2-Clause)</span>
          </li>
          <li className="credits-item">
            <a href="https://render.com" target="_blank" rel="noopener noreferrer" className="credits-name">Render</a>
            <span className="credits-desc">Cloud hosting for proxy server</span>
          </li>
          <li className="credits-item">
            <a href="https://pages.github.com" target="_blank" rel="noopener noreferrer" className="credits-name">GitHub Pages</a>
            <span className="credits-desc">Static hosting for the front-end</span>
          </li>
        </ul>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">AI Image Generation</h2>
        <ul className="credits-list">
          <li className="credits-item">
            <a href="https://fal.ai" target="_blank" rel="noopener noreferrer" className="credits-name">Fal.ai</a>
            <span className="credits-desc">AI image generation infrastructure</span>
          </li>
          <li className="credits-item">
            <a href="https://blackforestlabs.ai" target="_blank" rel="noopener noreferrer" className="credits-name">FLUX LoRA models</a>
            <span className="credits-desc">Text-to-image models used via Fal.ai (Black Forest Labs)</span>
          </li>
          <li className="credits-item">
            <a href="https://github.com/ZhengPeng7/BiRefNet" target="_blank" rel="noopener noreferrer" className="credits-name">BiRefNet</a>
            <span className="credits-desc">Background removal model via Fal.ai (MIT)</span>
          </li>
        </ul>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Linting &amp; Code Quality</h2>
        <ul className="credits-list">
          <li className="credits-item">
            <a href="https://eslint.org" target="_blank" rel="noopener noreferrer" className="credits-name">ESLint</a>
            <span className="credits-desc">JavaScript / TypeScript linter (MIT)</span>
          </li>
          <li className="credits-item">
            <a href="https://typescript-eslint.io" target="_blank" rel="noopener noreferrer" className="credits-name">typescript-eslint</a>
            <span className="credits-desc">TypeScript ESLint rules (MIT)</span>
          </li>
          <li className="credits-item">
            <a href="https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks" target="_blank" rel="noopener noreferrer" className="credits-name">eslint-plugin-react-hooks</a>
            <span className="credits-desc">React Hooks linting rules (MIT)</span>
          </li>
          <li className="credits-item">
            <a href="https://github.com/ArnaudBarre/eslint-plugin-react-refresh" target="_blank" rel="noopener noreferrer" className="credits-name">eslint-plugin-react-refresh</a>
            <span className="credits-desc">Fast-refresh linting rules (MIT)</span>
          </li>
        </ul>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Testing</h2>
        <ul className="credits-list">
          <li className="credits-item">
            <a href="https://playwright.dev" target="_blank" rel="noopener noreferrer" className="credits-name">Playwright</a>
            <span className="credits-desc">End-to-end browser testing (Apache-2.0)</span>
          </li>
        </ul>
      </section>



      <footer className="credits-legal">
        <p>© 2025–{new Date().getFullYear()} SP Digital LLC. All Rights Reserved.</p>
        <p>
          "Punch Skater", the Punch Skater game, card mechanics, artwork concepts, and all
          associated intellectual property are owned exclusively by SP Digital LLC.
        </p>
        <p>
          For copyright notices, DMCA takedown requests, or licensing inquiries, contact us via{" "}
          <a href="https://punchskater.com" target="_blank" rel="noopener noreferrer" className="credits-link">
            punchskater.com
          </a>.
        </p>
        <p>
          See the <a href="/LICENSE.txt" target="_blank" rel="noopener noreferrer" className="credits-link">LICENSE</a> file for full terms.
        </p>
      </footer>
    </div>
  );
}
