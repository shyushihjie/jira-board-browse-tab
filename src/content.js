(() => {
  const MARKER = 'jiraBoardBrowseTabInjected';
  if (document.documentElement.dataset[MARKER] === 'true') {
    return;
  }
  document.documentElement.dataset[MARKER] = 'true';

  const ISSUE_KEY_PATTERN = /\b([A-Z][A-Z0-9]+-\d+)\b/;
  const SITE_CONFIGS_KEY = 'siteConfigs';
  const MAX_PATH_ELEMENTS = 8;
  const MOVE_THRESHOLD = 6;
  const CLICK_SUPPRESSION_MS = 750;
  const origin = window.location.origin;

  let siteEnabled = false;
  let dragState = resetDragState();
  let recentPointerOpen = null;

  void initialize();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[SITE_CONFIGS_KEY]) {
      return;
    }

    const nextConfigs = changes[SITE_CONFIGS_KEY].newValue ?? {};
    siteEnabled = Boolean(nextConfigs[origin]?.enabled);
  });

  function initialize() {
    return chrome.storage.sync.get({ [SITE_CONFIGS_KEY]: {} }).then((result) => {
      siteEnabled = Boolean(result[SITE_CONFIGS_KEY][origin]?.enabled);

      document.addEventListener('pointerdown', handlePointerDown, true);
      document.addEventListener('pointermove', handlePointerMove, true);
      document.addEventListener('pointerup', handlePointerUp, true);
      document.addEventListener('pointercancel', handlePointerCancel, true);
      document.addEventListener('dragstart', handleDragStart, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('blur', handleWindowBlur, true);
      document.addEventListener('visibilitychange', handleVisibilityChange, true);
    });
  }

  function handlePointerDown(event) {
    if (!shouldHandlePointerActivation(event)) {
      dragState = resetDragState();
      return;
    }

    const candidate = findIssueCandidate(event);
    dragState = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      dragging: false,
      candidate
    };
  }

  function handlePointerMove(event) {
    if (dragState.pointerId !== event.pointerId || dragState.moved) {
      return;
    }

    const deltaX = Math.abs(event.clientX - dragState.x);
    const deltaY = Math.abs(event.clientY - dragState.y);
    if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
      dragState.moved = true;
    }
  }

  function handleDragStart() {
    if (dragState.pointerId === null) {
      return;
    }

    dragState.dragging = true;
  }

  function handlePointerUp(event) {
    try {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      const pendingDragState = dragState;
      dragState = resetDragState();

      if (!shouldHandlePointerActivation(event)) {
        return;
      }

      if (!pendingDragState.candidate || pendingDragState.moved || pendingDragState.dragging) {
        return;
      }

      const releaseCandidate = findIssueCandidate(event);
      if (!releaseCandidate || releaseCandidate.browseUrl !== pendingDragState.candidate.browseUrl) {
        return;
      }

      rememberRecentPointerOpen(releaseCandidate.browseUrl);
      openBrowseTab(releaseCandidate.browseUrl, event);
    } catch (error) {
      console.warn('Jira Board Browse Tab pointerup handler failed', error);
    }
  }

  function handlePointerCancel() {
    dragState = resetDragState();
  }

  function handleClick(event) {
    try {
      if (!shouldHandlePointerActivation(event)) {
        return;
      }

      const candidate = findIssueCandidate(event);
      dragState = resetDragState();
      if (!candidate) {
        return;
      }

      if (shouldSuppressClick(candidate.browseUrl)) {
        consumeEvent(event);
        recentPointerOpen = null;
        return;
      }

      openBrowseTab(candidate.browseUrl, event);
    } catch (error) {
      console.warn('Jira Board Browse Tab click handler failed', error);
    }
  }

  function handleKeyDown(event) {
    try {
      if (!siteEnabled || !isEligibleBoardPage()) {
        return;
      }

      if (event.defaultPrevented || event.key !== 'Enter') {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const candidate = buildCandidateFromPath([target, ...ancestorElements(target, MAX_PATH_ELEMENTS - 1)]);
      if (!candidate) {
        return;
      }

      openBrowseTab(candidate.browseUrl, event);
    } catch (error) {
      console.warn('Jira Board Browse Tab keyboard handler failed', error);
    }
  }

  function shouldHandlePointerActivation(event) {
    return siteEnabled &&
      isEligibleBoardPage() &&
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey;
  }

  function handleWindowBlur() {
    dragState = resetDragState();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      return;
    }

    dragState = resetDragState();
  }

  function isEligibleBoardPage() {
    const path = window.location.pathname;
    return path.includes('/boards/') || path.includes('/backlog');
  }

  function findIssueCandidate(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return null;
    }

    if (target.closest('input, textarea, select, option, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="searchbox"]')) {
      return null;
    }

    if (target.closest('[role="dialog"], dialog')) {
      return null;
    }

    const path = event.composedPath().filter((node) => node instanceof Element).slice(0, MAX_PATH_ELEMENTS);
    return buildCandidateFromPath(path);
  }

  function buildCandidateFromPath(path) {
    for (const rawElement of path) {
      const element = rawElement;
      if (!(element instanceof Element)) {
        continue;
      }

      const directUrl = issueBrowseUrlFromHref(element.getAttribute('href'));
      if (directUrl) {
        return { browseUrl: directUrl };
      }

      const anchor = findSingleIssueAnchor(element);
      if (!anchor) {
        continue;
      }

      const key = extractIssueKey(anchor.href) ||
        extractIssueKey(anchor.textContent) ||
        extractIssueKey(element.getAttribute('aria-label')) ||
        extractIssueKey(element.textContent);

      if (!key) {
        continue;
      }

      const text = `${element.getAttribute('aria-label') ?? ''} ${element.textContent ?? ''}`;
      const hasCardLikeControl = element.matches('button, [role="button"]') || Boolean(element.querySelector('button, [role="button"]'));
      if (!hasCardLikeControl || !text.includes(key)) {
        continue;
      }

      return {
        browseUrl: `${window.location.origin}/browse/${key}`
      };
    }

    return null;
  }

  function findSingleIssueAnchor(element) {
    const anchors = Array.from(element.querySelectorAll('a[href*="/browse/"]')).filter((anchor) => {
      const url = issueBrowseUrlFromHref(anchor.getAttribute('href'));
      return Boolean(url);
    });

    return anchors.length === 1 ? anchors[0] : null;
  }

  function issueBrowseUrlFromHref(href) {
    if (!href) {
      return null;
    }

    const resolved = new URL(href, window.location.href);
    if (resolved.origin !== window.location.origin) {
      return null;
    }

    const key = extractIssueKey(resolved.href);
    if (!key) {
      return null;
    }

    return `${window.location.origin}/browse/${key}`;
  }

  function extractIssueKey(value) {
    if (typeof value !== 'string') {
      return null;
    }

    return value.match(ISSUE_KEY_PATTERN)?.[1] ?? null;
  }

  function ancestorElements(start, limit) {
    const elements = [];
    let current = start.parentElement;

    while (current && elements.length < limit) {
      elements.push(current);
      current = current.parentElement;
    }

    return elements;
  }

  function openBrowseTab(browseUrl, event) {
    consumeEvent(event);
    window.open(browseUrl, '_blank', 'noopener,noreferrer');
  }

  function resetDragState() {
    return {
      pointerId: null,
      x: 0,
      y: 0,
      moved: false,
      dragging: false,
      candidate: null
    };
  }

  function rememberRecentPointerOpen(browseUrl) {
    recentPointerOpen = {
      browseUrl,
      at: performance.now()
    };
  }

  function shouldSuppressClick(browseUrl) {
    if (!recentPointerOpen) {
      return false;
    }

    if (recentPointerOpen.browseUrl !== browseUrl) {
      return false;
    }

    return performance.now() - recentPointerOpen.at <= CLICK_SUPPRESSION_MS;
  }

  function consumeEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
})();
