# CodeFly

CodeFly is a browser-based 3D codebase explorer for quickly understanding unfamiliar repositories.

Paste a public GitHub/GitLab URL or choose a local folder, then navigate files, dependencies, definitions, and static execution paths in a single visual map.

## Public Beta Scope

### Headline features

- 🌐 Public GitHub/GitLab repository loading
- 💻 Local folder loading in supported browsers (files stay local)
- 🧭 3D file and dependency graph
- � File/function/class search (`Ctrl+K` / `Cmd+K`)
- 🧬 Static execution paths from `graphData.symbolEdges`
- 📊 Basic dependency insights (for example: orphan files, hub files, blast radius)
- ↗ Open file in GitHub/GitLab/local IDE where supported

### Secondary / beta features

- Private repository OAuth/token flows
- Multiplayer presence
- Chat (experimental and non-blocking)

### Not part of launch promise

- Runtime call stacks or runtime tracing
- Persistent team collaboration platform claims
- Advanced analytics platform claims

## Supported Languages

JavaScript, TypeScript, Python, Go, Java, Rust, C#, Ruby, PHP, Swift, Kotlin, Scala, C, C++, HTML, CSS, Vue, Svelte, JSON, YAML, Markdown, Shell, SQL, XML, TOML, and Docker.

Unsupported non-binary files are still included as nodes in `unsupported` parse mode so repositories load without crashing.

## Run Locally

```bash
git clone https://github.com/sugarspacejam/codefly.git
cd codefly
npm start
```

Open `http://localhost:8090`.

For static/browser-only mode:

```bash
npm run start:static
```

## Deploy

Static-first deployment uses GitHub Pages via `.github/workflows/pages.yml`.

1. Push to `main`
2. Open GitHub `Settings` → `Pages`
3. Set source to `GitHub Actions`

Optional OAuth/multiplayer proxy lives in `multiplayer/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for parser and feature contribution guidelines.

## License

MIT — see [LICENSE](LICENSE).
