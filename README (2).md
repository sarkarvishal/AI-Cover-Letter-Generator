# AI Cover Letter Generator

A lightweight SaaS utility that turns a candidate's role, target company, and
key skills into a drafted cover letter — built as a single-file vanilla
HTML/CSS/JS app with no framework or build step.

**Status:** Phase 1 (Base MVP) complete. Phase 2 (LLM integration) and
Phase 3 (resume parsing) not yet implemented.

---

## Live demo

Open `index.html` directly in any browser — no server or install required.

## What it does (Phase 1)

- Captures candidate name, job role, target company, and key skills through
  a plain HTML form.
- On submit, interpolates those fields into a fixed template string via a
  `buildSimulatedLetter()` controller function — no external API is called
  in this phase.
- Renders the result as clean paragraph elements (built with
  `document.createElement` / `textContent`, not `innerHTML`, to avoid any
  injection risk from user-entered text).
- Provides a one-click "Copy to clipboard" action using the
  `navigator.clipboard` API.

## Project structure

```
.
├── index.html   # Markup, styles, and logic (single file, no build step)
└── README.md
```

## Tech stack

- Vanilla HTML, CSS, and JavaScript (ES5-compatible syntax, no transpiling)
- No dependencies, no package manager, no bundler
- `navigator.clipboard` for copy support (requires a secure context —
  `https://` or `localhost`)

## Roadmap

| Phase | Feature | Status |
|---|---|---|
| 1 | Form capture + simulated letter generation + copy to clipboard | ✅ Done |
| 2 | Live Gemini/OpenAI API call replacing the simulated template | ⬜ Not started |
| 2 | Server-side API key handling (required — see note below) | ⬜ Not started |
| 2 | "Generating…" loading state for real API latency | ⬜ Not started |
| 3 | Resume upload (PDF) + text extraction | ⬜ Not started |
| 3 | Resume-aware, personalized generation | ⬜ Not started |

### A note on Phase 2 security

A `.env` file keeps a key out of version control, but it does **not** keep a
key out of the shipped app: any API call made directly from browser
JavaScript exposes the key in the request, visible to anyone via dev tools.
Phase 2 will need a minimal backend (e.g. a single Node/Express route or a
serverless function) that holds the API key server-side and proxies
requests from the front end — the browser will call that endpoint, never
the Gemini/OpenAI API directly.

## Running locally

No build step. Either:

- Open `index.html` directly in a browser, or
- Serve it locally for clipboard/API compatibility during later phases:
  ```bash
  npx serve .
  ```

## License

Internal sprint project — no license specified.
