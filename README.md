# Jira Board Browse Tab

Manifest V3 Chrome extension that turns Jira board-card clicks into dedicated `/browse/ISSUE-KEY` tabs instead of opening the board sidebar.

## What It Does

- Works on Jira Cloud board and backlog pages.
- Lets the user grant access per Jira site from the extension popup.
- Intercepts board-card clicks and opens the issue in a new tab like:
  - `https://your-site.atlassian.net/browse/OPS-878`
- Avoids remote code, third-party runtime dependencies, and broad required host permissions.

## Folder Layout

- `manifest.json`
- `src/background.js`
- `src/content.js`
- `src/popup.*`
- `src/options.*`
- `icons/`

## Local Load

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder

## Store Packaging

Zip the contents of this folder, not the parent directory.

Example:

```bash
cd /path/to/jira-board-browse-tab
zip -r ../jira-board-browse-tab.zip .
```

## Publish Notes

- Manifest V3 only.
- No remotely hosted code.
- Uses `optional_host_permissions` so site access is granted per Jira origin by the user.
- You still need to provide Chrome Web Store listing assets such as screenshots, store description, and category metadata in the dashboard.

## Recommended Listing Copy

Short description:

> Open Jira board cards in a dedicated issue tab instead of the board sidebar.

Key privacy statement:

> This extension does not collect, transmit, or sell user data. It only runs on Jira sites that the user explicitly enables.
