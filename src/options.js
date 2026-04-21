const emptyState = document.querySelector('#emptyState');
const errorBanner = document.querySelector('#errorBanner');
const siteList = document.querySelector('#siteList');
const siteTemplate = document.querySelector('#siteTemplate');

void render();

async function render() {
  clearError();

  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: 'GET_CONNECTED_SITES'
    });
  } catch (error) {
    showError(normalizeError(error, 'Could not load connected sites.'));
    emptyState.textContent = 'Could not load connected sites.';
    emptyState.classList.remove('hidden');
    siteList.replaceChildren();
    return;
  }

  if (!response?.ok) {
    showError(response?.error ?? 'Could not load connected sites.');
    emptyState.textContent = 'Could not load connected sites.';
    emptyState.classList.remove('hidden');
    siteList.replaceChildren();
    return;
  }

  const sites = response.sites ?? [];
  emptyState.classList.toggle('hidden', sites.length > 0);
  siteList.replaceChildren(...sites.map(createSiteRow));
}

function createSiteRow(site) {
  const fragment = siteTemplate.content.cloneNode(true);
  const item = fragment.querySelector('.site-item');
  const title = fragment.querySelector('.site-item__title');
  const meta = fragment.querySelector('.site-item__meta');
  const toggle = fragment.querySelector('.site-toggle');
  const removeButton = fragment.querySelector('.site-remove');

  title.textContent = site.label;
  meta.textContent = site.hasPermission
    ? `${site.origin} · Host access granted`
    : `${site.origin} · Host access removed`;
  const initialEnabled = Boolean(site.enabled);
  toggle.checked = initialEnabled;
  toggle.disabled = !site.hasPermission;

  toggle.addEventListener('change', async () => {
    clearError();
    setRowBusy(item, true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SET_SITE_ENABLED',
        origin: site.origin,
        enabled: toggle.checked
      });

      if (!response?.ok) {
        toggle.checked = initialEnabled;
        showError(response?.error ?? 'Could not update site state.');
        setRowBusy(item, false, site.hasPermission);
        return;
      }

      await render();
    } catch (error) {
      toggle.checked = initialEnabled;
      showError(normalizeError(error, 'Could not update site state.'));
      setRowBusy(item, false, site.hasPermission);
    }
  });

  removeButton.addEventListener('click', async () => {
    clearError();
    setRowBusy(item, true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DISCONNECT_SITE',
        origin: site.origin
      });

      if (!response?.ok) {
        showError(response?.error ?? 'Could not remove this site.');
        setRowBusy(item, false, site.hasPermission);
        return;
      }

      await render();
    } catch (error) {
      showError(normalizeError(error, 'Could not remove this site.'));
      setRowBusy(item, false, site.hasPermission);
    }
  });

  return item;
}

function setRowBusy(item, busy, hasPermission = true) {
  item.classList.toggle('is-busy', busy);

  const toggle = item.querySelector('.site-toggle');
  const removeButton = item.querySelector('.site-remove');

  if (toggle instanceof HTMLInputElement) {
    toggle.disabled = busy || !hasPermission;
  }

  if (removeButton instanceof HTMLButtonElement) {
    removeButton.disabled = busy;
  }
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove('hidden');
}

function clearError() {
  errorBanner.textContent = '';
  errorBanner.classList.add('hidden');
}

function normalizeError(error, fallbackMessage) {
  return error instanceof Error ? error.message : fallbackMessage;
}
