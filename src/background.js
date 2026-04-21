const SITE_CONFIGS_KEY = 'siteConfigs';

chrome.runtime.onInstalled.addListener(() => {
  void reconcileRegisteredSites();
});

chrome.runtime.onStartup.addListener(() => {
  void reconcileRegisteredSites();
});

chrome.permissions.onRemoved.addListener((removed) => {
  void handleRemovedPermissions(removed.origins ?? []);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void (async () => {
    try {
      switch (message?.type) {
        case 'GET_SITE_STATE':
          sendResponse(await getSiteState(message.tabUrl));
          break;
        case 'ENABLE_SITE':
          sendResponse(await enableSite(message.origin, message.tabId));
          break;
        case 'SET_SITE_ENABLED':
          sendResponse(await setSiteEnabled(message.origin, message.enabled));
          break;
        case 'DISCONNECT_SITE':
          sendResponse(await disconnectSite(message.origin));
          break;
        case 'GET_CONNECTED_SITES':
          sendResponse(await getConnectedSites());
          break;
        default:
          sendResponse({ ok: false, error: 'Unknown message type.' });
          break;
      }
    } catch (error) {
      console.error('Background message handler failed', error);
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error.'
      });
    }
  })();

  return true;
});

async function getSiteState(tabUrl) {
  const site = parseSupportedSite(tabUrl);
  if (!site) {
    return {
      ok: true,
      supported: false
    };
  }

  const siteConfigs = await readSiteConfigs();
  const hasPermission = await hasOriginPermission(site.originPattern);
  const enabled = Boolean(siteConfigs[site.origin]?.enabled);

  return {
    ok: true,
    supported: true,
    site: {
      origin: site.origin,
      originPattern: site.originPattern,
      label: site.hostname
    },
    hasPermission,
    enabled
  };
}

async function enableSite(origin, tabId) {
  const site = parseSupportedSite(origin);
  if (!site) {
    return { ok: false, error: 'Unsupported Jira origin.' };
  }

  const granted = await chrome.permissions.request({
    origins: [site.originPattern]
  });

  if (!granted) {
    return { ok: false, error: 'Site access was not granted.' };
  }

  const siteConfigs = await readSiteConfigs();
  siteConfigs[site.origin] = {
    enabled: true,
    updatedAt: new Date().toISOString()
  };
  await writeSiteConfigs(siteConfigs);
  await registerSiteScript(site.origin);
  await injectOpenSiteTabs(site.origin, tabId);

  return {
    ok: true,
    site: {
      origin: site.origin,
      originPattern: site.originPattern,
      label: site.hostname
    }
  };
}

async function setSiteEnabled(origin, enabled) {
  const site = parseSupportedSite(origin);
  if (!site) {
    return { ok: false, error: 'Unsupported Jira origin.' };
  }

  if (!await hasOriginPermission(site.originPattern)) {
    return { ok: false, error: 'This site has not granted host access yet.' };
  }

  const siteConfigs = await readSiteConfigs();
  siteConfigs[site.origin] = {
    enabled: Boolean(enabled),
    updatedAt: new Date().toISOString()
  };
  await writeSiteConfigs(siteConfigs);

  if (enabled) {
    await registerSiteScript(site.origin);
    await injectOpenSiteTabs(site.origin);
  } else {
    await unregisterSiteScript(site.origin);
  }

  return { ok: true };
}

async function disconnectSite(origin) {
  const site = parseSupportedSite(origin);
  if (!site) {
    return { ok: false, error: 'Unsupported Jira origin.' };
  }

  await unregisterSiteScript(site.origin);
  await chrome.permissions.remove({
    origins: [site.originPattern]
  });

  const siteConfigs = await readSiteConfigs();
  delete siteConfigs[site.origin];
  await writeSiteConfigs(siteConfigs);

  return { ok: true };
}

async function getConnectedSites() {
  const siteConfigs = await readSiteConfigs();
  const sites = [];

  for (const [origin, config] of Object.entries(siteConfigs)) {
    const site = parseSupportedSite(origin);
    if (!site) {
      continue;
    }

    const hasPermission = await hasOriginPermission(site.originPattern);
    sites.push({
      origin: site.origin,
      originPattern: site.originPattern,
      label: site.hostname,
      enabled: Boolean(config.enabled),
      hasPermission
    });
  }

  sites.sort((left, right) => left.label.localeCompare(right.label));

  return {
    ok: true,
    sites
  };
}

async function reconcileRegisteredSites() {
  const siteConfigs = await readSiteConfigs();

  for (const [origin, config] of Object.entries(siteConfigs)) {
    const site = parseSupportedSite(origin);
    if (!site) {
      continue;
    }

    const granted = await hasOriginPermission(site.originPattern);
    if (!granted) {
      delete siteConfigs[origin];
      await unregisterSiteScript(origin);
      continue;
    }

    if (config.enabled) {
      await registerSiteScript(origin);
    } else {
      await unregisterSiteScript(origin);
    }
  }

  await writeSiteConfigs(siteConfigs);
}

async function handleRemovedPermissions(originPatterns) {
  if (originPatterns.length === 0) {
    return;
  }

  const siteConfigs = await readSiteConfigs();
  let changed = false;

  for (const originPattern of originPatterns) {
    const origin = originPattern.replace(/\/\*$/, '');
    if (!siteConfigs[origin]) {
      continue;
    }

    delete siteConfigs[origin];
    await unregisterSiteScript(origin);
    changed = true;
  }

  if (changed) {
    await writeSiteConfigs(siteConfigs);
  }
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content.js']
    });
  } catch (error) {
    console.warn('Failed to inject current tab content script', error);
  }
}

async function injectOpenSiteTabs(origin, preferredTabId) {
  const tabIds = await findOpenSiteTabIds(origin, preferredTabId);

  for (const tabId of tabIds) {
    await injectContentScript(tabId);
  }
}

async function findOpenSiteTabIds(origin, preferredTabId) {
  const tabIds = new Set();
  if (Number.isInteger(preferredTabId)) {
    tabIds.add(preferredTabId);
  }

  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch (error) {
    console.warn('Failed to enumerate open tabs for Jira site injection', error);
    return [...tabIds];
  }

  for (const tab of tabs) {
    if (!Number.isInteger(tab.id) || !isTabOnOrigin(tab, origin)) {
      continue;
    }

    tabIds.add(tab.id);
  }

  return [...tabIds];
}

function isTabOnOrigin(tab, origin) {
  if (typeof tab.url !== 'string') {
    return false;
  }

  try {
    return new URL(tab.url).origin === origin;
  } catch {
    return false;
  }
}

async function registerSiteScript(origin) {
  const definition = {
    id: scriptIdForOrigin(origin),
    js: ['src/content.js'],
    matches: [`${origin}/*`],
    runAt: 'document_start',
    allFrames: false,
    persistAcrossSessions: true
  };

  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [definition.id]
  });

  if (existing.length > 0) {
    await chrome.scripting.updateContentScripts([definition]);
    return;
  }

  await chrome.scripting.registerContentScripts([definition]);
}

async function unregisterSiteScript(origin) {
  const id = scriptIdForOrigin(origin);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });

  if (existing.length === 0) {
    return;
  }

  await chrome.scripting.unregisterContentScripts({ ids: [id] });
}

async function hasOriginPermission(originPattern) {
  return chrome.permissions.contains({
    origins: [originPattern]
  });
}

async function readSiteConfigs() {
  const result = await chrome.storage.sync.get({
    [SITE_CONFIGS_KEY]: {}
  });
  return result[SITE_CONFIGS_KEY];
}

async function writeSiteConfigs(siteConfigs) {
  await chrome.storage.sync.set({
    [SITE_CONFIGS_KEY]: siteConfigs
  });
}

function scriptIdForOrigin(origin) {
  return `jira-board-browse-${origin.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
}

function parseSupportedSite(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const normalizedValue = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  let url;
  try {
    url = new URL(normalizedValue);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') {
    return null;
  }

  if (!/\.atlassian\.(net|com)$/i.test(url.hostname)) {
    return null;
  }

  return {
    origin: url.origin,
    originPattern: `${url.origin}/*`,
    hostname: url.hostname
  };
}
