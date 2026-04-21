const stateMessage = document.querySelector('#stateMessage');
const siteLabel = document.querySelector('#siteLabel');
const primaryActions = document.querySelector('#primaryActions');
const enableButton = document.querySelector('#enableButton');
const toggleRow = document.querySelector('#toggleRow');
const enabledToggle = document.querySelector('#enabledToggle');
const disconnectButton = document.querySelector('#disconnectButton');
const openOptionsButton = document.querySelector('#openOptionsButton');

let currentState = null;
let activeTabId = null;

void init();

enableButton.addEventListener('click', async () => {
  if (!currentState?.site || activeTabId === null) {
    return;
  }

  setBusy('Requesting access to this Jira site…');
  const response = await chrome.runtime.sendMessage({
    type: 'ENABLE_SITE',
    origin: currentState.site.origin,
    tabId: activeTabId
  });
  if (!response?.ok) {
    renderError(response?.error ?? 'Could not enable this site.');
    return;
  }

  await refresh();
});

enabledToggle.addEventListener('change', async () => {
  if (!currentState?.site) {
    return;
  }

  setBusy(enabledToggle.checked ? 'Enabling card interception…' : 'Disabling card interception…');
  const response = await chrome.runtime.sendMessage({
    type: 'SET_SITE_ENABLED',
    origin: currentState.site.origin,
    enabled: enabledToggle.checked
  });

  if (!response?.ok) {
    renderError(response?.error ?? 'Could not update site state.');
    return;
  }

  await refresh();
});

disconnectButton.addEventListener('click', async () => {
  if (!currentState?.site) {
    return;
  }

  setBusy('Removing site access…');
  const response = await chrome.runtime.sendMessage({
    type: 'DISCONNECT_SITE',
    origin: currentState.site.origin
  });

  if (!response?.ok) {
    renderError(response?.error ?? 'Could not remove site access.');
    return;
  }

  await refresh();
});

openOptionsButton.addEventListener('click', async () => {
  await chrome.runtime.openOptionsPage();
});

async function init() {
  await refresh();
}

async function refresh() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  activeTabId = typeof tab?.id === 'number' ? tab.id : null;

  const response = await chrome.runtime.sendMessage({
    type: 'GET_SITE_STATE',
    tabUrl: tab?.url ?? ''
  });

  if (!response?.ok) {
    renderError(response?.error ?? 'Could not inspect the current tab.');
    return;
  }

  currentState = response;
  renderState(response);
}

function renderState(state) {
  primaryActions.classList.add('hidden');
  siteLabel.classList.add('hidden');
  toggleRow.classList.add('hidden');
  disconnectButton.classList.add('hidden');
  enableButton.classList.add('hidden');

  if (!state.supported) {
    stateMessage.textContent = 'Open a Jira Cloud board or backlog page, then use this popup to enable the extension on that site.';
    return;
  }

  primaryActions.classList.remove('hidden');
  siteLabel.classList.remove('hidden');
  siteLabel.textContent = state.site.label;

  if (!state.hasPermission) {
    stateMessage.textContent = 'This Jira site has not granted host access yet.';
    enableButton.classList.remove('hidden');
    return;
  }

  disconnectButton.classList.remove('hidden');
  toggleRow.classList.remove('hidden');
  enabledToggle.checked = Boolean(state.enabled);
  stateMessage.textContent = state.enabled
    ? 'Board cards on this site now open in a dedicated /browse issue tab.'
    : 'Host access is granted, but card interception is currently turned off.';
}

function renderError(message) {
  stateMessage.textContent = message;
  primaryActions.classList.add('hidden');
}

function setBusy(message) {
  stateMessage.textContent = message;
}
