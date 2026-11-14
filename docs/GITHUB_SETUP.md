# Publishing this project on GitHub

## Suggested repository metadata

**Repository name:** `arcguard`

**About description:** `Rooted LG webOS TV helper that monitors Sound Out and cautiously restores HDMI ARC/eARC when the TV switches away.`

**Suggested topics:** `lg-webos`, `webos-tv`, `homebrew`, `hdmi-arc`, `earc`, `rooted-tv`, `luna-service`, `lg-tv`

**Suggested visibility:** Public if you are comfortable publishing the source and known limitations. Otherwise create a private repository first.

## GitHub Desktop (no command line required)

1. Download and extract the project ZIP.
2. Install/open GitHub Desktop and sign in to GitHub.
3. Choose **File → Add Local Repository…** and select the extracted `ARCGuard-GitHub-Repo` folder. If GitHub Desktop says it is not a repository, choose **Create a Repository** and use the selected folder as the local path.
4. Keep `README.md` and `LICENSE` in the repository root; do not add generated `dist/` IPKs or credentials.
5. Choose **Publish repository**. Select the name `arcguard`, then choose public or private.
6. On the GitHub repository page, enter the About description and topics above.
7. Open **Actions** and confirm the **Build IPK** workflow completes. Download its `arcguard-ipk` artifact to test on a TV.

The project intentionally does not ship an allegedly verified prebuilt IPK in the source tree. Use the official-CLI artifact produced by GitHub Actions, and do not create a version tag/release until it has been tested on the target TV. The prepared ZIP includes a local Git repository with one initial commit, so GitHub Desktop should recognize it immediately.

## CLI alternative

From the extracted project folder, a user comfortable with Git can create an empty repository on GitHub (do not initialise it with a README or license), then run:

```sh
git remote add origin https://github.com/YOUR-USERNAME/arcguard.git
git push -u origin main
```

Replace `YOUR-USERNAME` with the actual GitHub account or organization. Do not include a personal access token in a remote URL or commit any secret.
