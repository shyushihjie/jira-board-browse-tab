# Chrome Web Store Submission Assets

This folder contains the non-runtime files needed for Chrome Web Store submission.

## Files

- `listing.md`
  Store title, short description, detailed description, and suggested listing metadata.
- `privacy-practices.md`
  Suggested answers for the Privacy practices tab in the Chrome Web Store dashboard.
- `source/`
  HTML and CSS source files for screenshots and promo graphics.
- `assets/`
  Generated PNG files ready to upload to the Chrome Web Store.

## Generate Store Images

```bash
sh scripts/render-webstore-assets.sh
```

This uses headless Chrome to render:

- `webstore/assets/screenshot-01-open-browse.png`
- `webstore/assets/screenshot-02-enable-site.png`
- `webstore/assets/screenshot-03-manage-sites.png`
- `webstore/assets/promo-small.png`
- `webstore/assets/promo-marquee.png`

## Build the Submission ZIP

```bash
sh scripts/build-extension-zip.sh
```

This creates a clean upload archive in `dist/` that contains only the extension runtime files.
