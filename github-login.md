# GitHub Login / Git Credential Manager (GCM) Tutorial

General tutorial for setting up GitHub authentication via Git Credential Manager (GCM) and managing multiple GitHub accounts. Works the same way regardless of repo or device.

## What you need installed

| Component | Windows | Mac | Linux |
|---|---|---|---|
| **Git** | [Git for Windows installer](https://git-scm.com/download/win) | `brew install git` or Xcode Command Line Tools | `apt install git` / `dnf install git` |
| **Git Credential Manager (GCM)** | Bundled automatically with Git for Windows (default component in the installer) | Bundled with Git for Mac in recent versions, or `brew install --cask git-credential-manager` | Not bundled — install separately: [GCM releases page](https://github.com/git-ecosystem/git-credential-manager/releases) (`.deb`/`.rpm`/tarball) |
| **A browser** | Already there | Already there | Already there |

Check if GCM is already installed on a machine:
```
git-credential-manager --version
```
If that fails, install it via the table above, then run `git-credential-manager configure` once to register it with Git.

## One-time setup (per device)

```
git config --global credential.helper manager
```
(On Windows this is usually already the default after installing Git.)

## Logging in with an account

```
git-credential-manager github login --browser
```
- Opens your default browser to GitHub's login/authorize page
- After you approve, GitHub redirects to a local `http://127.0.0.1:<port>/?code=...&state=...` URL — this is just GCM's temporary localhost listener catching the OAuth callback; it never leaves your machine
- GCM exchanges that code for a token and stores it securely (Windows Credential Manager / macOS Keychain / Linux Secret Service, depending on OS)

## Adding more accounts

Just repeat the login command — each one is stored separately, keyed by GitHub username:
```
git-credential-manager github login --browser
```

## Managing accounts

```
git-credential-manager github list              # see all cached accounts for github.com
git-credential-manager github logout <account>   # remove one specific account
```

## Result

Once 2+ accounts are cached, any `git push`/`git pull` against a `github.com` HTTPS remote that needs auth will show an account picker so you choose which identity to use — this works the same way regardless of which repo or device, since it's tied to GCM's credential store, not to any particular project.

## Troubleshooting

If a push fails with a stale/expired credential error for a single-account setup:
```
git-credential-manager github logout <account>
git push
```
This removes the stale credential and triggers a fresh browser login on the next push.
