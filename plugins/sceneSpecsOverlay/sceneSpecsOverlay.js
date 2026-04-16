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

  function fmtSize(bytes) {
    if (!bytes) return null;
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  }

  function fmtBitrate(bps) {
    if (!bps) return null;
    if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
    return `${Math.round(bps / 1000)} Kbps`;
  }

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

  function parseSingleTokenExpr(tokenExpr) {
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
  }

  function parseOverlayFormat(raw) {
    const input = String(raw || '').trim();
    const normalized = input.replace(/\\n/g, '\n').replace(/\[BR\]/gi, '\n');
    const lineTexts = normalized
      .split(/\r?\n/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);

    if (lineTexts.length === 0) {
      throw new Error('No bracketed tokens found.');
    }

    return lineTexts.map(function (lineText) {
      const re = /\[([^\]]+)\]/g;
      const groups = [];
      let m;

      while ((m = re.exec(lineText)) !== null) {
        const groupExpr = m[1].trim();
        const partExprs = groupExpr
          .split('/')
          .map(function (p) {
            return p.trim();
          })
          .filter(Boolean);
        if (partExprs.length === 0) {
          throw new Error('Empty token group: ' + groupExpr);
        }
        groups.push({
          parts: partExprs.map(parseSingleTokenExpr),
        });
      }

      if (groups.length === 0) {
        throw new Error('No bracketed tokens found on line: ' + lineText);
      }

      return groups;
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

  function buildLegacyLines(file) {
    const line1 = [];
    const line2 = [];
    if (!file) return [];

    const map = buildValueMap(file);
    if (map.Resolution) line1.push({ text: map.Resolution, className: 'sso-value sso-value--res' });
    if (map.Duration) line1.push({ text: map.Duration, className: 'sso-value' });
    if (map.FileSize) line1.push({ text: map.FileSize, className: 'sso-value' });

    const codecParts = [map.VideoCodec, map.AudioCodec].filter(Boolean);
    if (codecParts.length) line2.push({ text: codecParts.join(' / '), className: 'sso-value' });
    if (map.BitRate) line2.push({ text: map.BitRate, className: 'sso-value' });
    if (map.FPS) line2.push({ text: map.FPS, className: 'sso-value' });

    const lines = [];
    if (line1.length) lines.push(line1);
    if (line2.length) lines.push(line2);
    return lines;
  }

  function buildCustomLines(file, overlayFormat) {
    const valueMap = buildValueMap(file);
    const parsedLines = parseOverlayFormat(overlayFormat);
    return parsedLines
      .map(function (lineGroups) {
        return lineGroups
          .map(function (group) {
            const values = group.parts
              .map(function (part) {
                const value = valueMap[part.token];
                if (!value) return null;
                if (
                  part.suppressValue != null &&
                  String(value).trim() === String(part.suppressValue).trim()
                ) {
                  return null;
                }
                return value;
              })
              .filter(Boolean);

            if (values.length === 0) return null;

            const firstToken = group.parts[0] && group.parts[0].token;
            return {
              text: values.join(' / '),
              className:
                group.parts.length === 1 && firstToken === 'Resolution'
                  ? 'sso-value sso-value--res'
                  : 'sso-value',
            };
          })
          .filter(Boolean);
      })
      .filter(function (line) {
        return line.length > 0;
      });
  }

  function renderLines(lines) {
    return lines.map(function (line, idx) {
      const lineCls = idx === 1 ? 'sso-line sso-line--secondary' : 'sso-line';
      return React.createElement(
        'div',
        { className: lineCls, key: idx },
        line.map(function (item, i) {
          return React.createElement('span', { className: item.className, key: i }, item.text);
        })
      );
    });
  }

  function SceneSpecsPanel({ scene }) {
    const overlayFormat = useOverlayFormat();
    const file = scene && scene.files && scene.files[0];
    if (!file) return null;

    let lines = [];
    const formatInput = String(overlayFormat || '').trim();

    if (formatInput.length === 0) {
      lines = buildLegacyLines(file);
    } else {
      try {
        lines = buildCustomLines(file, formatInput);
      } catch (err) {
        console.warn('[sceneSpecsOverlay] Invalid Overlay Format, using default two-line layout.', {
          overlayFormat: overlayFormat,
          error: err && err.message ? err.message : String(err),
          defaultFormat: DEFAULT_FORMAT,
        });
        lines = buildLegacyLines(file);
      }
    }

    if (lines.length === 0) return null;

    return React.createElement(
      'div',
      { className: 'sso-panel' },
      React.createElement('div', { className: 'sso-specs' }, renderLines(lines))
    );
  }

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
