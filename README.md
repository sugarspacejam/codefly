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

One-click deploy to Railway using the included `Dockerfile` and `railway.json`:

1. Push this repo to GitHub
2. Go to [railway.app/new](https://railway.app/new) → "Deploy from GitHub repo"
3. Select your fork — Railway auto-detects the Dockerfile

## Support the Project

If CodeFly helps you, please consider:

- ☕ [Buy Me a Coffee](https://buymeacoffee.com/codefly)
- ⭐ Star this repo
- 🐛 Report bugs / request languages via issues

## License

MIT — see [LICENSE](LICENSE).
