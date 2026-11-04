# Browser-only testing through GitHub Pages

The DS-9 is a static application: Web Audio synthesis, sequencing, imported sample processing and pattern files run in the visitor's browser. No backend or local development software is needed to use the deployed site. HTTPS supports Web Audio; visitors must click Play or a voice name to unlock audio.

## Visibility and approval

A standard GitHub Pages site is publicly accessible, including when its source repository is private on a plan supporting private-repository Pages. Private Pages access control is a separate GitHub Enterprise capability and must not be assumed. Anyone with the public URL can use the instrument and inspect/download its shipped JavaScript, CSS and static assets. Public deployment does not itself make a private repository public, but the application implementation is shipped to browsers. There is no login gate in this application.

Imported audio and patterns are processed locally by the current application; it contains no upload backend. GitHub hosts the site and may log normal web requests. A published URL can be shared or indexed. Removing a site cannot retract copies already downloaded.

Do not enable or run deployment until the owner explicitly approves public publication.

## Prepared configuration

- `vite.config.ts` sets production base `/DS-9-Drum-Machine/`; development remains at `/`.
- `.github/workflows/deploy-pages.yml` installs the lockfile with Node 24, runs the state tests and production build, uploads `dist`, and deploys through GitHub's Pages actions.
- Only pushes to the dedicated `pages-release` branch (or manual dispatch on that branch, if available) deploy. Ordinary `development`/`main` pushes and pull requests never publish. Do not create or push `pages-release` before explicit publication approval.
- No UI or DSP changes are required.

## After explicit approval

1. Commit the prepared configuration on `development` if not already committed. Check the current remote state before pushing.
2. In the repository, open **Settings → Pages** and select **GitHub Actions** as the build source. Check Pages availability for the repository's plan and visibility. Do not change repository visibility as a workaround without permission.
3. After owner approval, publish the reviewed development revision to the dedicated `pages-release` branch with `git push origin development:pages-release`. This push triggers the workflow without changing `main` or requiring a manual workflow on GitHub's default branch. Do not force-push an existing release branch; inspect it first.
4. Wait for both jobs to succeed. Use the URL returned by `actions/deploy-pages`, then verify HTML, JS/CSS, controls, audio and the repository base path on the deployed site.
5. The expected default URL is `https://grimiss.github.io/DS-9-Drum-Machine/`. This is a planned address, not confirmation that a site exists; a configured custom domain could change the actual URL.

A `github-pages` environment protection rule may require allowing the `pages-release` branch or approving the deployment. Preserve existing protection rules and resolve these through repository settings.

## Local preparation checks

`npm run build` and `npm test` must pass. Serve `dist` with `npx vite preview --host 127.0.0.1 --port 4173 --strictPort` and request `/DS-9-Drum-Machine/`. Browser verification must confirm repository-prefixed asset loads, all 144 steps, interaction and nonzero audio signals. This internal smoke test is not a public preview URL.

Preparation validation: TypeScript/Vite production build and all four state tests pass. A Chromium smoke test at the repository subpath verified prefixed asset loading, 144 steps, pattern memory, length editing, and nonzero production audio output with no browser errors. This does not validate an actual public deployment. GitHub API access returned Forbidden in this session; Pages settings, account-plan support, and repository visibility remain unverified. Read-only Git access works.
