(function () {
  'use strict';

  const PluginApi = window.PluginApi;
  if (!PluginApi) return;

  const React = PluginApi.React;
  const PLUGIN_ID = 'sceneSpecsOverlay';
  const DEFAULT_FORMAT = '[Resolution][Duration][FileSize][VideoCodec][BitRate][FPS]';
  const VALID_TOKENS = new Set([
    'Resolution',
    'Duration',
    'FileSize',
    'VideoCodec',
    'AudioCodec',
    'BitRate',
    'FPS',
  ]);

  const settingsState = {
    overlayFormat: '',
    listeners: new Set(),
    loaded: false,
    loading: false,
  };

  // ---------------------------------------------------------------------------
  // Helpers — match Stash's own formatting conventions where possible
  // ---------------------------------------------------------------------------

  /**
   * Resolution label matching Stash's TextUtils.resolution() (text.ts).
   * Uses min(width, height) — same as upstream.
   */
  function resLabel(w, h) {
    if (!w || !h) return null;
    const n = Math.min(w, h);
    if (n >= 6144) return 'HUGE';
    if (n >= 3840) return '8K';
    if (n >= 3584) return '7K';
    if (n >= 3000) return '6K';
    if (n >= 2560) return '5K';
    if (n >= 1920) return '4K';
    if (n >= 1440) return '1440p';
    if (n >= 1080) return '1080p';
    if (n >= 720) return '720p';
    if (n >= 540) return '540p';
    if (n >= 480) return '480p';
    if (n >= 360) return '360p';
    return `${n}p`;
  }

  /** HH:MM:SS or MM:SS */
  function fmtDuration(secs) {
    if (!secs || secs < 1) return null;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Human-readable file size (binary, same as Stash's FileSize component) */
  function fmtSize(bytes) {
    if (!bytes) return null;
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  }

  /** Bitrate in Mbps / Kbps */
  function fmtBitrate(bps) {
    if (!bps) return null;
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
    return `${Math.round(bps / 1000)} Kbps`;
  }

  /** Frame rate with up to 2 significant decimals */
  function fmtFPS(fps) {
    if (!fps) return null;
    return `${parseFloat(fps.toFixed(2))} fps`;
  }

  function normalizeCodec(codec) {
    return codec ? String(codec).trim().toUpperCase() : null;
  }

  function readOverlayFormatFromPlugins(pluginsObj) {
    if (!pluginsObj || typeof pluginsObj !== 'object') return '';
    const direct = pluginsObj[PLUGIN_ID];
    if (direct && typeof direct === 'object') {
      const v = direct.overlayFormat;
      return v == null ? '' : String(v);
    }
    const key = Object.keys(pluginsObj).find(function (k) {
      return String(k).toLowerCase() === PLUGIN_ID.toLowerCase();
    });
    if (!key) return '';
    const cfg = pluginsObj[key];
    if (!cfg || typeof cfg !== 'object') return '';
    return cfg.overlayFormat == null ? '' : String(cfg.overlayFormat);
  }

  function notifySettingsListeners() {
    settingsState.listeners.forEach(function (fn) {
      try {
        fn(settingsState.overlayFormat);
      } catch (e) {
        // Keep plugin resilient.
      }
    });
  }

  async function loadSettings() {
    if (settingsState.loading) return;
    settingsState.loading = true;
    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ configuration { plugins } }' }),
      });
      if (!res.ok) return;
      const json = await res.json();
      const pluginsObj =
        json && json.data && json.data.configuration && json.data.configuration.plugins;
      const next = readOverlayFormatFromPlugins(pluginsObj);
      if (next !== settingsState.overlayFormat || !settingsState.loaded) {
        settingsState.overlayFormat = next;
        notifySettingsListeners();
      }
      settingsState.loaded = true;
    } catch (e) {
      // Keep defaults; do not break UI if settings query fails.
    } finally {
      settingsState.loading = false;
    }
  }

  function useOverlayFormat() {
    const useEffect = React.useEffect;
    const useState = React.useState;
    const state = useState(settingsState.overlayFormat);
    const overlayFormat = state[0];
    const setOverlayFormat = state[1];

    useEffect(function () {
      function listener(next) {
        setOverlayFormat(next);
      }
      settingsState.listeners.add(listener);
      if (!settingsState.loaded) loadSettings();
      return function () {
        settingsState.listeners.delete(listener);
      };
    }, []);

    return overlayFormat;
  }

  function parseOverlayFormat(raw) {
    const input = String(raw || '').trim();
    const format = input || DEFAULT_FORMAT;
    const re = /\[([^\]]+)\]/g;
    const tokenExprs = [];
    let m;

    while ((m = re.exec(format)) !== null) {
      tokenExprs.push(m[1].trim());
    }

    if (tokenExprs.length === 0) {
      throw new Error('No bracketed tokens found.');
    }

    return tokenExprs.map(function (tokenExpr) {
      const tm = tokenExpr.match(
        /^([A-Za-z]+)(?:\(\s*=\s*('([^']*)'|"([^"]*)")\s*\))?$/
      );
      if (!tm) {
        throw new Error('Invalid token syntax: ' + tokenExpr);
      }
      const token = tm[1];
      if (!VALID_TOKENS.has(token)) {
        throw new Error('Unknown token: ' + token);
      }
      const suppressValue =
        tm[3] != null ? tm[3] : tm[4] != null ? tm[4] : null;
      return { token: token, suppressValue: suppressValue };
    });
  }

  function buildValueMap(file) {
    return {
      Resolution: file && file.width && file.height ? resLabel(file.width, file.height) : null,
      Duration: file ? fmtDuration(file.duration) : null,
      FileSize: file ? fmtSize(file.size) : null,
      VideoCodec: file ? normalizeCodec(file.video_codec) : null,
      AudioCodec: file ? normalizeCodec(file.audio_codec) : null,
      BitRate: file ? fmtBitrate(file.bit_rate) : null,
      FPS: file ? fmtFPS(file.frame_rate) : null,
    };
  }

  function buildItemsFromFormat(file, overlayFormat) {
    const valueMap = buildValueMap(file);
    const specs = parseOverlayFormat(overlayFormat);
    return specs
      .map(function (spec) {
        const value = valueMap[spec.token];
        if (!value) return null;
        if (
          spec.suppressValue != null &&
          String(value).trim() === String(spec.suppressValue).trim()
        ) {
          return null;
        }
        return {
          text: value,
          className: spec.token === 'Resolution' ? 'sso-value sso-value--res' : 'sso-value',
        };
      })
      .filter(Boolean);
  }

  // ---------------------------------------------------------------------------
  // React component
  // ---------------------------------------------------------------------------

  function SceneSpecsPanel({ scene }) {
    const overlayFormat = useOverlayFormat();
    const file = scene && scene.files && scene.files[0];
    if (!file) return null;

    let items = [];
    try {
      items = buildItemsFromFormat(file, overlayFormat);
    } catch (err) {
      if (String(overlayFormat || '').trim().length > 0) {
        console.warn('[sceneSpecsOverlay] Invalid Overlay Format, using default layout.', {
          overlayFormat: overlayFormat,
          error: err && err.message ? err.message : String(err),
          defaultFormat: DEFAULT_FORMAT,
        });
      }
      items = buildItemsFromFormat(file, DEFAULT_FORMAT);
    }

    if (items.length === 0) return null;

    return React.createElement(
      'div',
      { className: 'sso-panel' },
      React.createElement(
        'div',
        { className: 'sso-specs' },
        items.map(function (item, i) {
          return React.createElement('span', { className: item.className, key: i }, item.text);
        })
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Patch
  // ---------------------------------------------------------------------------

  PluginApi.patch.after('SceneCard.Overlays', function () {
    var props = arguments[0];
    var result = arguments[arguments.length - 1];
    return React.createElement(
      React.Fragment,
      null,
      result,
      React.createElement(SceneSpecsPanel, { scene: props.scene })
    );
  });

  loadSettings();
})();
