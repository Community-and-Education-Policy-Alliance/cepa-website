# Repository Guidelines

## Project Structure & Module Organization

This repository is a static CEPA donation site. `index.html` is the primary page, and `recurring.html` handles monthly giving. Shared styles live in `css/style.css`. Root-level image assets include `favicon.png`, `sw-donate.png`, `stripe-logo.png`, and `venmo-logo.png`. `CNAME` configures the custom GitHub Pages domain.

There is no build step, package manager, or generated source directory. Keep edits focused on the HTML pages, the shared stylesheet, and the small set of root assets.

## Build, Test, and Development Commands

- `python3 -m http.server 8000`: serves the site locally at `http://localhost:8000`.
- `open http://localhost:8000`: opens the local site on macOS after starting the server.
- `git status --short`: checks changed files before committing.
- `git diff -- index.html recurring.html css/style.css`: reviews typical content and style edits.

Because this is static HTML/CSS, deployment is expected to happen through the hosting provider, likely GitHub Pages, from committed files.

## Coding Style & Naming Conventions

Use two-space indentation in HTML and CSS, matching the existing files. Prefer semantic HTML sections and descriptive class names such as `.donate-grid`, `.donate-card`, and `.match-banner`. Keep shared visual rules in `css/style.css`; use inline styles only for small page-specific exceptions already common in the current markup.

Use lowercase, hyphenated filenames for new assets and pages, for example `donor-banner.png` or `annual-report.html`. Preserve existing external links with `target="_blank"` and `rel="noopener"` where applicable.

## Testing Guidelines

There is no automated test suite. Validate changes manually in a browser before opening a pull request or publishing. Check desktop and mobile widths, confirm donation links and internal links work, and verify images load from the repository root. For content changes, review metadata in `index.html`, including Open Graph and Twitter card fields, if the public message or primary image changes.

## Commit & Pull Request Guidelines

Recent commits use short, imperative subject lines, for example `Update donation card descriptions` or `Remove Zelle from donation options permanently`. Keep commit subjects specific to the visible change.

Pull requests should include a concise summary, screenshots for visual changes, notes about link or payment-provider updates, and any manual verification performed. If changing donation wording, legal language, or payment URLs, call that out clearly for reviewer attention.

## Agent-Specific Instructions

Do not introduce a build system, JavaScript framework, or dependency manager unless explicitly requested. Keep the site lightweight and static. Avoid unrelated formatting churn in large content sections.
