# CodeFly 🚀

**Fly through any codebase in 3D.** Type a GitHub/GitLab URL or pick a local folder — your repo renders as a navigable 3D graph in the browser. Files are glowing spheres connected by dependency edges. Functions and classes orbit their parent file.

WASD to fly, mouse to look, click to explore. Multiplayer rooms let your team explore together.

![CodeFly demo](https://via.placeholder.com/800x400?text=CodeFly+Demo)

## Features

- 🌐 **Public repos** — paste any GitHub/GitLab URL, no login
- 💻 **Local folders** — browser-only, files never leave your machine (Chrome/Edge)
- 🔒 **Private repos** — connect via GitHub/GitLab OAuth
- 👥 **Multiplayer** — explore the same repo with your team in real-time
- 🔍 **Smart search** — `Ctrl+K` for files, functions, classes
- 📊 **Analytics lenses** — orphan files, hub files, hot paths, blast radius, churn heatmap, blame overlay
- 🗺️ **Landmarks & tours** — pin nodes, share tours via QR code
- 🧭 **Three layout modes** — cluster, galaxy, filesystem
- ⚡ **IDE integration** — open files directly in VS Code, Cursor, Windsurf, Zed

## Supported Languages

JavaScript, TypeScript, Python, Go, Java, Rust, C#, Ruby, PHP, Swift, Kotlin, Scala, C, C++, HTML, CSS, Vue, Svelte, JSON, YAML, Markdown, Shell, SQL, XML, TOML, Docker.

**Unsupported languages still appear as nodes** — you just won't get function/import extraction. See [CONTRIBUTING.md](CONTRIBUTING.md) to add language support.

## Run Locally

```bash
npm install
npm start
# open http://localhost:8090
```

## Deploy

Deploy for free with GitHub Pages:

1. Push this repo to `main`
2. In GitHub, open `Settings` → `Pages`
3. Set `Source` to `GitHub Actions`
4. The included workflow (`.github/workflows/pages.yml`) publishes `index.html`, `explorer.js`, and `graph-generator.js`

Optional multiplayer (still free): deploy the Cloudflare Worker in `multiplayer/` and set `window.CODEFLY_MULTIPLAYER_HOST` in `index.html`.

## Support the Project

If CodeFly helps you, please consider:

- 💛 [Donate via PayPal](https://paypal.me/CelestifyLTD)
- ⭐ Star this repo
- 🐛 Report bugs / request languages via issues

## License

MIT — see [LICENSE](LICENSE).
