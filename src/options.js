const emptyState = document.querySelector('#emptyState');
const siteList = document.querySelector('#siteList');
const siteTemplate = document.querySelector('#siteTemplate');

void render();

async function render() {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_CONNECTED_SITES'
  });

  if (!response?.ok) {
    emptyState.textContent = response?.error ?? 'Could not load connected sites.';
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
  toggle.checked = Boolean(site.enabled);
  toggle.disabled = !site.hasPermission;

  toggle.addEventListener('change', async () => {
    await chrome.runtime.sendMessage({
      type: 'SET_SITE_ENABLED',
      origin: site.origin,
      enabled: toggle.checked
    });
    await render();
  });

  removeButton.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({
      type: 'DISCONNECT_SITE',
      origin: site.origin
    });
    await render();
  });

  return item;
}
