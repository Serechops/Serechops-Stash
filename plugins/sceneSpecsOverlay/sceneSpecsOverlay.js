(function () {
  'use strict';

  const PluginApi = window.PluginApi;
  if (!PluginApi) return;

  const React = PluginApi.React;

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
    if (bytes >= 1048576)    return `${(bytes / 1048576).toFixed(1)} MB`;
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

  // ---------------------------------------------------------------------------
  // React component
  // ---------------------------------------------------------------------------

  function SceneSpecsPanel({ scene }) {
    const file = scene && scene.files && scene.files[0];

    // Line 1: resolution · duration · size
    const line1 = [];
    // Line 2: codec · bitrate · fps
    const line2 = [];

    if (file) {
      if (file.width && file.height) {
        const label = resLabel(file.width, file.height);
        if (label) line1.push(label);
      }
      const dur = fmtDuration(file.duration);
      if (dur) line1.push(dur);
      const sz = fmtSize(file.size);
      if (sz) line1.push(sz);

      if (file.video_codec) {
        const parts = [file.video_codec, file.audio_codec]
          .filter(Boolean)
          .map(function (c) { return c.toUpperCase(); });
        line2.push(parts.join(' / '));
      }
      const br = fmtBitrate(file.bit_rate);
      if (br) line2.push(br);
      const fps = fmtFPS(file.frame_rate);
      if (fps) line2.push(fps);
    }

    if (line1.length === 0 && line2.length === 0) return null;

    function renderLine(items) {
      return React.createElement(
        'div', { className: 'sso-line' },
        items.map(function (v, i) {
          return React.createElement('span', { className: 'sso-value', key: i }, v);
        })
      );
    }

    return React.createElement(
      'div', { className: 'sso-panel' },
      React.createElement(
        'div', { className: 'sso-specs' },
        line1.length > 0 && renderLine(line1),
        line2.length > 0 && renderLine(line2)
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Patch
  // ---------------------------------------------------------------------------

  PluginApi.patch.after('SceneCard.Overlays', function () {
    var props  = arguments[0];
    var result = arguments[arguments.length - 1];
    return React.createElement(
      React.Fragment, null,
      result,
      React.createElement(SceneSpecsPanel, { scene: props.scene })
    );
  });

})();
