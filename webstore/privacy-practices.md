# Privacy Practices Answers

These are suggested responses for the Chrome Web Store Privacy practices tab. They are based on the current extension behavior in `manifest.json`, `src/background.js`, `src/content.js`, `src/popup.js`, and `src/options.js`.

## Single Purpose

Open Jira Cloud board and backlog issue cards in dedicated `/browse/ISSUE-KEY` tabs instead of Jira's board sidebar or dialog.

## Permissions Justification

### `activeTab`

Used by the popup to inspect the current active tab and determine whether the user is on a supported Jira Cloud board or backlog page before showing site-specific controls.

### `tabs`

Used by the background service worker to inspect tab URLs so the extension can show a badge on unsupported-but-eligible Jira board and backlog tabs until the user grants host access for that Jira site.

### `scripting`

Used to inject the local content script into Jira tabs that the user explicitly enabled so the extension can intercept board-card activation and open the matching `/browse/ISSUE-KEY` tab.

### `storage`

Used to store per-site extension settings locally in Chrome, including which Jira sites were connected and whether the behavior is enabled for each site.

### Optional host permissions

The extension requests host access only for Jira sites the user explicitly enables. Host access is required so the content script can run on that Jira site and intercept board-card interactions.

Suggested summary:

`https://*.atlassian.net/*` and `https://*.atlassian.com/*` are optional host permissions. The extension asks for them only after the user enables a specific Jira site from the popup.

## Remote Code

Select:

`No, I am not using remote code.`

The extension does not fetch or execute remotely hosted JavaScript, WebAssembly, or other executable code.

## User Data / Data Usage

Accurate summary:

- The extension handles the active tab URL and Jira site origin to determine whether a tab is supported and to apply site-specific settings.
- The extension stores site configuration locally in Chrome extension storage.
- The extension does not transmit Jira issue data, browsing history, analytics, or personal data to the developer or any third party.

Recommended dashboard answer:

- Data sold: `No`
- Data used for creditworthiness or lending: `No`
- Data collected for purposes unrelated to the extension's single purpose: `No`

If the dashboard asks whether the extension collects personal or sensitive user data, answer based on the exact field wording shown in the UI. The safest reviewer-facing explanation is:

`The extension stores only local site preferences in Chrome storage and does not transmit user data off-device.`

## Privacy Policy URL

After pushing the repository and enabling GitHub Pages from the `docs/` folder, use:

`https://shyushihjie.github.io/jira-board-browse-tab/privacy-policy.html`
