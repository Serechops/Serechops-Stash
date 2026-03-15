(function () {
  'use strict';

  const PluginApi = window.PluginApi;
  if (!PluginApi) { console.warn('[stashGlobalSearch] PluginApi not available'); return; }

  const React = PluginApi.React;
  const { useState, useEffect, useCallback, useRef } = React;
  const { Modal, Form, Spinner, Button } = PluginApi.libraries.Bootstrap;
  const { useHistory } = PluginApi.libraries.ReactRouterDOM;
  const FontAwesomeIcon =
    PluginApi.libraries.ReactFontAwesome?.FontAwesomeIcon ??
    PluginApi.components['Icon'];
  const {
    faMagnifyingGlass, faTimes, faUser, faVideo, faTag,
    faImages, faPlayCircle, faList, faHeart,
  } = PluginApi.libraries.FontAwesomeSolid;
  const { patch } = PluginApi;
  const Mousetrap = PluginApi.libraries.Mousetrap;

  // ─── Open/close store ────────────────────────────────────────────────────────
  const searchStore = {
    isOpen: false,
    listeners: new Set(),
    subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    _notify() { this.listeners.forEach(fn => fn(this.isOpen)); },
    open()   { if (!this.isOpen)  { this.isOpen = true;  this._notify(); } },
    close()  { if (this.isOpen)   { this.isOpen = false; this._notify(); } },
    toggle() { this.isOpen ? this.close() : this.open(); },
  };

  // Ctrl+K to open / close from anywhere in the app.
  Mousetrap.bind('ctrl+k', function (e) {
    e.preventDefault();
    searchStore.toggle();
    return false;
  });

  function useSearchOpen() {
    const [open, setOpen] = useState(searchStore.isOpen);
    useEffect(() => searchStore.subscribe(setOpen), []);
    return [open, () => searchStore.open(), () => searchStore.close()];
  }

  // ─── GraphQL ─────────────────────────────────────────────────────────────────
  const SEARCH_QUERY = `
    query GlobalSearch($q: String!) {
      scenes: findScenes(filter: { q: $q, per_page: 8, sort: "created_at", direction: DESC }) {
        count
        scenes { id title date files { path } studio { name } paths { screenshot preview } }
      }
      performers: findPerformers(filter: { q: $q, per_page: 8, sort: "rating", direction: DESC }) {
        count
        performers { id name disambiguation alias_list image_path }
      }
      studios: findStudios(filter: { q: $q, per_page: 8, sort: "name", direction: ASC }) {
        count
        studios { id name image_path }
      }
      tags: findTags(filter: { q: $q, per_page: 8, sort: "name", direction: ASC }) {
        count
        tags { id name image_path }
      }
      galleries: findGalleries(filter: { q: $q, per_page: 8, sort: "created_at", direction: DESC }) {
        count
        galleries { id title date paths { cover } }
      }
    }
  `;

  async function runSearch(q) {
    const r = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { q } }),
    });
    const json = await r.json();
    const d = json.data ?? {};
    return {
      scenes:     d.scenes?.scenes        ?? [],
      performers: d.performers?.performers ?? [],
      studios:    d.studios?.studios       ?? [],
      tags:       d.tags?.tags             ?? [],
      galleries:  d.galleries?.galleries   ?? [],
      counts: {
        scenes:     d.scenes?.count        ?? 0,
        performers: d.performers?.count    ?? 0,
        studios:    d.studios?.count       ?? 0,
        tags:       d.tags?.count          ?? 0,
        galleries:  d.galleries?.count     ?? 0,
      },
    };
  }

  // ─── System navigation items ────────────────────────────────────────────────
  const SYSTEM_PAGES = [
    { label: 'Scenes',              url: '/scenes'                 },
    { label: 'Performers',          url: '/performers'             },
    { label: 'Studios',             url: '/studios'                },
    { label: 'Tags',                url: '/tags'                   },
    { label: 'Galleries',           url: '/galleries'              },
    { label: 'Images',              url: '/images'                 },
    { label: 'Movies',              url: '/movies'                 },
    { label: 'Markers',             url: '/scenes/markers'         },
    { label: 'Settings: Tasks',     url: '/settings?tab=tasks'     },
    { label: 'Settings: Plugins',   url: '/settings?tab=plugins'   },
    { label: 'Settings: Interface', url: '/settings?tab=interface' },
    { label: 'Settings: Security',  url: '/settings?tab=security'  },
    { label: 'Settings: Stats',     url: '/settings?tab=stats'     },
  ];

  function getSystemMatches(q) {
    if (!q || q.length < 2) return [];
    const lower = q.toLowerCase();
    return SYSTEM_PAGES
      .filter(p => p.label.toLowerCase().includes(lower))
      .map(p => ({ type: 'navigation', id: p.url, name: p.label, sub: p.url, thumb: null, url: p.url }));
  }

  // ─── Type config ─────────────────────────────────────────────────────────────
  const TYPES = [
    { key: 'navigation', label: 'Navigation',  icon: faList,       listKey: null,         path: null          },
    { key: 'scene',      label: 'Scenes',      icon: faPlayCircle, listKey: 'scenes',     path: '/scenes'     },
    { key: 'performer',  label: 'Performers',  icon: faUser,       listKey: 'performers', path: '/performers' },
    { key: 'studio',     label: 'Studios',     icon: faVideo,      listKey: 'studios',    path: '/studios'    },
    { key: 'tag',        label: 'Tags',        icon: faTag,        listKey: 'tags',       path: '/tags'       },
    { key: 'gallery',    label: 'Galleries',   icon: faImages,     listKey: 'galleries',  path: '/galleries'  },
  ];

  function flattenResults(data) {
    if (!data) return [];
    return [
      ...data.scenes.map(s => ({
        type: 'scene', id: s.id,
        name: s.title || s.files?.[0]?.path || 'Untitled',
        sub: [s.studio?.name, s.date].filter(Boolean).join(' · '),
        thumb: s.paths?.screenshot,
        preview: s.paths?.preview || null,
        url: `/scenes/${s.id}`,
      })),
      ...data.performers.map(p => ({
        type: 'performer', id: p.id,
        name: p.name + (p.disambiguation ? ` (${p.disambiguation})` : ''),
        sub: p.alias_list?.length ? p.alias_list.slice(0, 3).join(', ') : '',
        thumb: p.image_path,
        url: `/performers/${p.id}`,
      })),
      ...data.studios.map(s => ({
        type: 'studio', id: s.id,
        name: s.name, sub: '',
        thumb: s.image_path,
        url: `/studios/${s.id}`,
      })),
      ...data.tags.map(t => ({
        type: 'tag', id: t.id,
        name: t.name, sub: '',
        thumb: t.image_path || null,
        url: `/tags/${t.id}`,
      })),
      ...data.galleries.map(g => ({
        type: 'gallery', id: g.id,
        name: g.title || 'Untitled Gallery',
        sub: g.date || '',
        thumb: g.paths?.cover,
        url: `/galleries/${g.id}`,
      })),
    ];
  }
  // ─── Scene preview thumb (hover-to-play) ───────────────────────────────────────────
  const SceneThumb = ({ thumb, preview, icon }) => {
    const [active, setActive]   = useState(false);
    const [ready,  setReady]    = useState(false);
    const videoRef = useRef(null);

    const handleEnter = () => {
      if (!preview) return;
      setActive(true);
      videoRef.current?.play().catch(() => { setActive(false); setReady(false); });
    };
    const handleLeave = () => {
      setActive(false);
      setReady(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    };

    // video is visible only once it has data AND mouse is over
    const showVideo = active && ready;

    return React.createElement('div', {
      className: 'gs-card__thumb gs-scene-thumb',
      onMouseEnter: handleEnter,
      onMouseLeave: handleLeave,
    },
      thumb
        ? React.createElement('img', {
            src: thumb, alt: '',
            className: 'gs-scene-thumb__img',
            style: { opacity: showVideo ? 0 : 1 },
            onError: e => { e.target.style.display = 'none'; },
          })
        : React.createElement('div', { className: 'gs-card__thumb-placeholder' },
            React.createElement(FontAwesomeIcon, { icon })
          ),
      preview && React.createElement('video', {
        ref: videoRef,
        src: preview,
        muted: true,
        loop: true,
        playsInline: true,
        className: 'gs-scene-preview',
        style: { opacity: showVideo ? 1 : 0 },
        onCanPlay: () => setReady(true),
        onError:   () => { setActive(false); setReady(false); },
      })
    );
  };
  // ─── Modal component ──────────────────────────────────────────────────────────
  const GlobalSearchModal = () => {
    const [open,, close] = useSearchOpen();
    const history = useHistory();

    const [query,   setQuery]   = useState('');
    const [loading, setLoading] = useState(false);
    const [data,    setData]    = useState(null);
    const [focused, setFocused] = useState(-1);
    const inputRef  = useRef(null);
    const resultsRef = useRef(null);

    const systemItems = getSystemMatches(query);
    const flatResults = [...systemItems, ...flattenResults(data)];
    const hasResults  = flatResults.length > 0;
    const showEmpty   = !loading && data !== null && !hasResults && query.length >= 2;
    const showHint    = !loading && data === null && systemItems.length === 0;

    // Focus input when modal opens; reset state on close.
    useEffect(() => {
      if (open) {
        setTimeout(() => inputRef.current?.focus(), 60);
      } else {
        setQuery('');
        setData(null);
        setFocused(-1);
        setLoading(false);
      }
    }, [open]);

    // Reset focused index when query changes.
    useEffect(() => { setFocused(-1); }, [query]);

    // Scroll focused item into view.
    useEffect(() => {
      if (focused < 0 || !resultsRef.current) return;
      const el = resultsRef.current.querySelector('.gs-focused');
      el?.scrollIntoView({ block: 'nearest' });
    }, [focused]);

    // Debounced search.
    useEffect(() => {
      if (query.length < 2) { setData(null); setLoading(false); return; }
      setLoading(true);
      const timer = setTimeout(async () => {
        try {
          setData(await runSearch(query));
        } catch (e) {
          console.error('[stashGlobalSearch]', e);
          setData({ scenes: [], performers: [], studios: [], tags: [], galleries: [] });
        } finally {
          setLoading(false);
        }
      }, 150);
      return () => clearTimeout(timer);
    }, [query]);

    const navigateTo = useCallback((url) => {
      history.push(url);
      close();
    }, [history, close]);

    const handleKeyDown = useCallback((e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocused(f => Math.min(f + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocused(f => Math.max(f - 1, 0));
      } else if (e.key === 'Enter' && focused >= 0 && flatResults[focused]) {
        navigateTo(flatResults[focused].url);
      }
    }, [flatResults, focused, navigateTo]);

    // Render grouped result rows.
    const resultRows = TYPES.flatMap(({ key, label, icon, listKey, path }) => {
      const items = flatResults.filter(r => r.type === key);
      if (items.length === 0) return [];
      const count = listKey ? (data?.counts?.[listKey] ?? 0) : 0;
      const seeAllUrl = path ? `${path}?q=${encodeURIComponent(query)}` : null;
      const isChip = key === 'tag' || key === 'navigation';
      return [
        React.createElement('div', { className: 'gs-section-header', key: `hdr-${key}` },
          React.createElement(FontAwesomeIcon, { icon, className: 'me-2' }),
          label,
          count > 0 && React.createElement('span', { className: 'gs-section-count' }, count)
        ),
        React.createElement('div', { className: `gs-grid gs-grid--${key}`, key: `grid-${key}` },
          ...items.map(item => {
            const idx = flatResults.indexOf(item);
            const isFocused = idx === focused;
            if (isChip) {
              return React.createElement('div', {
                key: item.url,
                className: `gs-chip${isFocused ? ' gs-focused' : ''}`,
                onMouseEnter: () => setFocused(idx),
                onClick: () => navigateTo(item.url),
              },
                item.thumb && React.createElement('img', {
                  src: item.thumb, alt: '',
                  className: 'gs-chip__img',
                  onError: e => { e.target.style.display = 'none'; },
                }),
                item.name
              );
            }
            return React.createElement('div', {
              key: item.url,
              className: `gs-card gs-card--${item.type}${isFocused ? ' gs-focused' : ''}`,
              onMouseEnter: () => setFocused(idx),
              onClick: () => navigateTo(item.url),
            },
              item.type === 'scene'
                ? React.createElement(SceneThumb, { thumb: item.thumb, preview: item.preview, icon })
                : React.createElement('div', { className: 'gs-card__thumb' },
                    item.thumb
                      ? React.createElement('img', {
                          src: item.thumb, alt: '',
                          onError: e => { e.target.style.display = 'none'; },
                        })
                      : React.createElement('div', { className: 'gs-card__thumb-placeholder' },
                          React.createElement(FontAwesomeIcon, { icon })
                        )
                  ),
              React.createElement('div', { className: 'gs-card__body' },
                React.createElement('div', { className: 'gs-card__name' }, item.name),
                item.sub
                  ? React.createElement('div', { className: 'gs-card__sub' }, item.sub)
                  : null
              )
            );
          })
        ),
        seeAllUrl && count > items.length && React.createElement('div', {
          key: `see-all-${key}`,
          className: 'gs-see-all',
          onClick: () => navigateTo(seeAllUrl),
        }, `See all ${count} results →`),
      ].filter(Boolean);
    });

    return React.createElement(Modal, {
      show: open,
      onHide: close,
      size: 'lg',
      centered: true,
      animation: true,
      className: 'gs-modal',
    },
      React.createElement(Modal.Body, { className: 'gs-body p-0' },
        // ── Input row ──────────────────────────────────────────────────────
        React.createElement('div', { className: 'gs-input-row' },
          React.createElement(FontAwesomeIcon, {
            icon: faMagnifyingGlass,
            className: 'gs-input-icon',
          }),
          React.createElement(Form.Control, {
            ref: inputRef,
            type: 'text',
            placeholder: 'Search scenes, performers, studios, tags, galleries…',
            value: query,
            onChange: e => setQuery(e.target.value),
            onKeyDown: handleKeyDown,
            className: 'gs-input',
            spellCheck: false,
            autoComplete: 'off',
          }),
          loading && React.createElement(Spinner, {
            animation: 'border', size: 'sm', className: 'gs-loading',
          }),
          query && !loading && React.createElement('button', {
            className: 'gs-clear',
            tabIndex: -1,
            onClick: () => { setQuery(''); inputRef.current?.focus(); },
          }, React.createElement(FontAwesomeIcon, { icon: faTimes }))
        ),
        // ── Hint ───────────────────────────────────────────────────────────
        showHint && React.createElement('div', { className: 'gs-hint' },
          'Type at least 2 characters to search ',
          React.createElement('span', { className: 'gs-hint-keys' },
            React.createElement('kbd', null, '↑↓'),
            ' navigate · ',
            React.createElement('kbd', null, 'Enter'),
            ' open · ',
            React.createElement('kbd', null, 'Esc'),
            ' close · ',
            React.createElement('kbd', null, 'Ctrl+K'),
            ' toggle'
          )
        ),
        // ── Empty state ────────────────────────────────────────────────────
        showEmpty && React.createElement('div', { className: 'gs-empty' },
          `No results for "${query}"`
        ),
        // ── Results ────────────────────────────────────────────────────────
        hasResults && React.createElement('div', {
          className: 'gs-results',
          ref: resultsRef,
        }, ...resultRows),
        // ── Footer ─────────────────────────────────────────────────────────
        React.createElement('div', { className: 'gs-footer' },
          React.createElement(FontAwesomeIcon, { icon: faHeart, className: 'gs-footer-heart' }),
          React.createElement('a', {
            href: 'https://www.patreon.com/c/Creat1veB1te',
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'gs-footer-link',
            onClick: e => e.stopPropagation(),
          }, 'Support the dev')
        )
      )
    );
  };

  // ─── Navbar trigger button ────────────────────────────────────────────────────
  const SearchTriggerButton = () =>
    React.createElement(Button, {
      variant: 'link',
      className: 'minimal gs-trigger nav-utility d-flex align-items-center',
      onClick: () => searchStore.open(),
      title: 'Global search (Ctrl+K)',
    },
      React.createElement(FontAwesomeIcon, { icon: faMagnifyingGlass })
    );

  // ─── Combined widget (button + always-mounted modal) ─────────────────────────
  const GlobalSearchWidget = () =>
    React.createElement(React.Fragment, null,
      React.createElement(SearchTriggerButton, null),
      React.createElement(GlobalSearchModal, null)
    );

  // ─── Inject into navbar utility items ────────────────────────────────────────
  patch.before('MainNavBar.UtilityItems', function (props) {
    return [{
      ...props,
      children: React.createElement(React.Fragment, null,
        React.createElement(GlobalSearchWidget, null),
        props.children
      ),
    }];
  });

})();
