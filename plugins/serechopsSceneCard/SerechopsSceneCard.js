"use strict";
(function () {
    const PluginApi = window.PluginApi;
    const React = PluginApi.React;
    const { useState, useEffect, useRef, createContext, useContext } = React;
    const { patch } = PluginApi;
    const { Overlay, Popover, PopoverContent } = PluginApi.libraries.Bootstrap;
    const { Link } = PluginApi.libraries.ReactRouterDOM;
    const { FormattedDate } = PluginApi.libraries.Intl;
    // 1. Define GraphQL Queries
    const FIND_PERFORMER_QUERY = `
    query FindPerformer($id: ID!) {
      findPerformer(id: $id) {
        id
        name
        image_path
        scenes {
          id
          title
          rating100
          paths {
            screenshot
            stream
          }
        }
      }
    }
  `;
    const FIND_TAG_SCENES_QUERY = `
    query FindScenes($tag_id: [ID!]!) {
      findScenes(
        scene_filter: { tags: { value: $tag_id, modifier: INCLUDES } }
        filter: { per_page: -1, sort: "title", direction: ASC }
      ) {
        scenes {
          id
          title
          rating100
          paths {
            screenshot
            stream
          }
          files {
            height
          }
        }
      }
    }
  `;
    const DEFAULT_CONFIG = {
        enablePerformerList: false,
        enableTagChips: false,
        enableBadges: false,
        enableFooter: false,
    };
    // 3. Create Context for Configuration
    const SceneCardConfigContext = createContext(DEFAULT_CONFIG);
    // 4. Provider Component to Fetch and Provide Configuration
    const SceneCardConfigProvider = ({ children, }) => {
        const [config, setConfig] = useState(DEFAULT_CONFIG);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        useEffect(() => {
            let isMounted = true;
            const FETCH_CONFIG_QUERY = `
        query Configuration {
          configuration {
            plugins
          }
        }
      `;
            const fetchConfig = async () => {
                var _a, _b, _c, _d, _e, _f;
                try {
                    const graphqlEndpoint = `${window.location.origin}/graphql`;
                    const response = await fetch(graphqlEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: FETCH_CONFIG_QUERY }),
                    });
                    const result = await response.json();
                    if (!isMounted)
                        return;
                    const plugins = ((_b = (_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a.configuration) === null || _b === void 0 ? void 0 : _b.plugins) || {};
                    const sceneCardPluginConfig = plugins['SerechopsSceneCard'] || {};
                    // Map configuration fields to match SceneCardConfig interface
                    const mappedConfig = {
                        enablePerformerList: (_c = sceneCardPluginConfig['EnablePerformerList']) !== null && _c !== void 0 ? _c : DEFAULT_CONFIG.enablePerformerList,
                        enableTagChips: (_d = sceneCardPluginConfig['EnableTagChips']) !== null && _d !== void 0 ? _d : DEFAULT_CONFIG.enableTagChips,
                        enableBadges: (_e = sceneCardPluginConfig['Badges']) !== null && _e !== void 0 ? _e : DEFAULT_CONFIG.enableBadges,
                        enableFooter: (_f = sceneCardPluginConfig['EnableFooter']) !== null && _f !== void 0 ? _f : DEFAULT_CONFIG.enableFooter,
                    };
                    setConfig({
                        ...DEFAULT_CONFIG,
                        ...mappedConfig,
                    });
                    setLoading(false);
                }
                catch (err) {
                    console.error('Error fetching SceneCard configuration:', err);
                    if (isMounted) {
                        setError('Failed to load configuration.');
                        setLoading(false);
                    }
                }
            };
            fetchConfig();
            return () => {
                isMounted = false;
            };
        }, []);
        if (loading) {
            // Optionally, render a loader or nothing while loading
            return null;
        }
        if (error) {
            // Optionally, render an error message or fallback UI
            return null;
        }
        return (React.createElement(SceneCardConfigContext.Provider, { value: config }, children));
    };
    // 5. Custom Hook to Access Configuration
    const useSceneCardConfig = () => useContext(SceneCardConfigContext);
    const Footer = ({ date, views, studio }) => {
        return (React.createElement("div", { className: "footer" },
            React.createElement("span", { className: "studio" }, studio && (React.createElement(Link, { to: `/studios/${studio.id}`, onMouseDown: (e) => e.stopPropagation() }, studio.name))),
            React.createElement("span", { className: "views" },
                views || 0,
                " ",
                views === 1 ? 'view' : 'views'),
            React.createElement("span", { className: "date" }, date && React.createElement(FormattedDate, { value: date, format: "short", timeZone: "utc" }))));
    };
    const SceneItem = ({ scene }) => {
        var _a, _b;
        const [isHovered, setIsHovered] = useState(false);
        const videoRef = useRef(null);
        const handleMouseEnter = () => {
            setIsHovered(true);
        };
        const handleMouseLeave = () => {
            setIsHovered(false);
        };
        useEffect(() => {
            if (isHovered && videoRef.current) {
                videoRef.current.play();
            }
            else if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        }, [isHovered]);
        return (React.createElement("div", { className: "recommended-scene-item", onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, tabIndex: 0, "aria-label": `Scene titled ${scene.title}` },
            React.createElement(Link, { to: `/scenes/${scene.id}`, className: "scene-link", onMouseDown: (e) => e.stopPropagation() },
                React.createElement("div", { className: "scene-thumbnail-wrapper" }, isHovered && ((_a = scene.paths) === null || _a === void 0 ? void 0 : _a.stream) ? (React.createElement("video", { src: scene.paths.stream, className: "scene-thumbnail video-thumbnail", ref: videoRef, muted: true, loop: true, playsInline: true, "aria-label": `Preview of ${scene.title}` })) : (React.createElement("img", { src: ((_b = scene.paths) === null || _b === void 0 ? void 0 : _b.screenshot) || '/ui/images/default_thumbnail.jpg', alt: scene.title, className: "scene-thumbnail" }))),
                React.createElement("span", { className: "scene-title" }, scene.title))));
    };
    const RecommendedScenesPopover = ({ performerId, currentSceneId, }) => {
        const [scenes, setScenes] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const cacheRef = useRef({});
        useEffect(() => {
            let isMounted = true;
            const fetchPerformerScenes = async () => {
                try {
                    if (cacheRef.current[performerId]) {
                        setScenes(cacheRef.current[performerId]);
                        setLoading(false);
                        return;
                    }
                    setLoading(true);
                    const graphqlEndpoint = `${window.location.origin}/graphql`;
                    const response = await fetch(graphqlEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: FIND_PERFORMER_QUERY,
                            variables: { id: performerId },
                        }),
                    });
                    const result = await response.json();
                    if (!isMounted)
                        return;
                    if (result.errors && result.errors.length > 0) {
                        setError('Failed to load scenes.');
                        setLoading(false);
                        return;
                    }
                    const performer = result.data.findPerformer;
                    if (performer && performer.scenes) {
                        const filteredScenes = performer.scenes.filter((s) => s.id !== currentSceneId);
                        const recommended = filteredScenes.slice(0, 2);
                        setScenes(recommended);
                        cacheRef.current[performerId] = recommended;
                    }
                    else {
                        setScenes([]);
                    }
                    setLoading(false);
                }
                catch (err) {
                    console.error('Error fetching performer scenes:', err);
                    if (isMounted) {
                        setError('Failed to load scenes.');
                        setLoading(false);
                    }
                }
            };
            fetchPerformerScenes();
            return () => {
                isMounted = false;
            };
        }, [performerId, currentSceneId]);
        if (loading)
            return React.createElement("div", { className: "recommendation-popover" }, "Loading...");
        if (error)
            return React.createElement("div", { className: "recommendation-popover" }, error);
        if (scenes && scenes.length === 0) {
            return null;
        }
        return (React.createElement("div", { className: "recommendation-popover", onMouseDown: (e) => e.stopPropagation() },
            React.createElement("h3", { className: "popover-title" }, "Related Scenes"),
            React.createElement("hr", { className: "popover-divider" }),
            scenes && scenes.map((sc) => React.createElement(SceneItem, { key: sc.id, scene: sc }))));
    };
    const RelatedScenesPopover = ({ tagId, }) => {
        const [scenes, setScenes] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const cacheRef = useRef({});
        useEffect(() => {
            let isMounted = true;
            const fetchTagScenes = async () => {
                try {
                    if (cacheRef.current[tagId]) {
                        console.log(`Using cached tag scenes for tag_id: ${tagId}`);
                        setScenes(cacheRef.current[tagId]);
                        setLoading(false);
                        return;
                    }
                    setLoading(true);
                    const graphqlEndpoint = `${window.location.origin}/graphql`;
                    console.log('Performing tag scenes query:', {
                        endpoint: graphqlEndpoint,
                        query: FIND_TAG_SCENES_QUERY,
                        variables: { tag_id: [parseInt(tagId, 10)] },
                    });
                    const response = await fetch(graphqlEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: FIND_TAG_SCENES_QUERY,
                            variables: { tag_id: [parseInt(tagId, 10)] },
                        }),
                    });
                    const result = await response.json();
                    console.log('Tag scenes query response:', result);
                    if (!isMounted)
                        return;
                    if (result.errors && result.errors.length > 0) {
                        setError('Failed to load related scenes.');
                        setLoading(false);
                        return;
                    }
                    if (result.data.findScenes && result.data.findScenes.scenes) {
                        const related = result.data.findScenes.scenes.slice(0, 2);
                        setScenes(related);
                        cacheRef.current[tagId] = related;
                    }
                    else {
                        setScenes([]);
                    }
                    setLoading(false);
                }
                catch (err) {
                    console.error('Error fetching tag scenes:', err);
                    if (isMounted) {
                        setError('Failed to load related scenes.');
                        setLoading(false);
                    }
                }
            };
            fetchTagScenes();
            return () => {
                isMounted = false;
            };
        }, [tagId]);
        if (loading)
            return React.createElement("div", { className: "related-scenes-popover" }, "Loading...");
        if (error)
            return React.createElement("div", { className: "related-scenes-popover" }, error);
        if (scenes && scenes.length === 0) {
            return (React.createElement("div", { className: "related-scenes-popover" },
                React.createElement("p", null, "No related scenes found.")));
        }
        return (React.createElement("div", { className: "related-scenes-popover", onMouseDown: (e) => e.stopPropagation() },
            React.createElement("h3", { className: "popover-title" }, "Related Scenes"),
            React.createElement("hr", { className: "popover-divider" }),
            scenes && scenes.map((sc) => React.createElement(SceneItem, { key: sc.id, scene: sc }))));
    };
    const MoreListPopover = ({ items, show, target, onHide, title, renderItem, noItemsMessage = 'No items found.', }) => {
        const popoverRef = useRef(null);
        const [searchTerm, setSearchTerm] = useState('');
        const hideTimeoutRef = useRef(null);
        // Handle mouse enter: clear any existing hide timeout
        const handleMouseEnter = () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = null;
            }
        };
        // Handle mouse leave: set a timeout to hide the popover
        const handleMouseLeave = () => {
            hideTimeoutRef.current = window.setTimeout(() => {
                onHide();
            }, 400); // Delay in milliseconds
        };
        useEffect(() => {
            const handleClickOutside = (event) => {
                if (popoverRef.current &&
                    !popoverRef.current.contains(event.target) &&
                    target &&
                    !target.contains(event.target)) {
                    onHide();
                }
            };
            if (show) {
                document.addEventListener('mousedown', handleClickOutside);
            }
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, [show, onHide, target]);
        // Filter items based on search term
        const filteredItems = items.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
        return (React.createElement(Overlay, { show: show, target: target, placement: "bottom", containerPadding: 20, rootClose: false, onHide: onHide },
            React.createElement(Popover, { className: "custom-popover", ref: popoverRef, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave },
                React.createElement(PopoverContent, { className: "popover-content-container" },
                    React.createElement("div", { className: "popover-flex-container" },
                        React.createElement("div", { style: { width: '100%' } },
                            React.createElement("h4", { className: "popover-title" }, title),
                            React.createElement("input", { type: "text", className: "more-list-popover-search", placeholder: "Search...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), onMouseDown: (e) => e.stopPropagation() }),
                            React.createElement("div", { className: "more-list-scroll" }, filteredItems.length > 0 ? (filteredItems.map((item) => renderItem(item))) : (React.createElement("div", { className: "no-results" }, noItemsMessage)))))))));
    };
    const PerformerTag = ({ performer, currentSceneId, }) => {
        const imageSrc = performer.image_path || '/ui/images/icon_person.svg';
        const [showPopover, setShowPopover] = useState(false);
        const [placement, setPlacement] = useState('bottom');
        const targetRef = useRef(null);
        let hoverTimeout = null;
        const handleMouseEnter = () => {
            if (hoverTimeout)
                clearTimeout(hoverTimeout);
            hoverTimeout = window.setTimeout(() => {
                if (targetRef.current) {
                    const rect = targetRef.current.getBoundingClientRect();
                    const popoverHeight = 400;
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const newPlacement = spaceBelow < popoverHeight ? 'top' : 'bottom';
                    setPlacement(newPlacement);
                }
                setShowPopover(true);
            }, 200);
        };
        const handleMouseLeave = () => {
            if (hoverTimeout)
                clearTimeout(hoverTimeout);
            hoverTimeout = window.setTimeout(() => setShowPopover(false), 200);
        };
        useEffect(() => {
            const handleClickOutside = (event) => {
                if (showPopover &&
                    targetRef.current &&
                    !targetRef.current.contains(event.target)) {
                    const popoverElement = document.getElementById(`popover-${performer.id}`);
                    if (popoverElement && popoverElement.contains(event.target)) {
                        return;
                    }
                    setShowPopover(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, [showPopover, performer.id]);
        return (React.createElement("div", { className: "performer-tag-wrapper", onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave },
            React.createElement(Link, { to: `/performers/${performer.id}`, className: `performer-tag ${performer.gender}`, ref: targetRef, "aria-haspopup": "true", "aria-expanded": showPopover, onMouseDown: (e) => e.stopPropagation() }, performer.name),
            React.createElement(Overlay, { show: showPopover, target: targetRef.current, placement: placement, containerPadding: 20 },
                React.createElement(Popover, { id: `popover-${performer.id}`, className: "custom-popover", "aria-label": `Recommended scenes for ${performer.name}`, onMouseDown: (e) => e.stopPropagation() },
                    React.createElement(PopoverContent, { className: "popover-content-container" },
                        React.createElement("div", { className: "popover-flex-container" },
                            React.createElement("img", { src: imageSrc, alt: performer.name || 'Performer', className: "performer-hover-image" }),
                            React.createElement(RecommendedScenesPopover, { performerId: performer.id, currentSceneId: currentSceneId })))))));
    };
    const TagChipWithPopover = ({ tag }) => {
        const [showPopover, setShowPopover] = useState(false);
        const [placement, setPlacement] = useState('bottom');
        const targetRef = useRef(null);
        let hoverTimeout = null;
        const handleMouseEnter = () => {
            if (hoverTimeout)
                clearTimeout(hoverTimeout);
            hoverTimeout = window.setTimeout(() => {
                if (targetRef.current) {
                    const rect = targetRef.current.getBoundingClientRect();
                    const popoverHeight = 250;
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const newPlacement = spaceBelow < popoverHeight ? 'top' : 'bottom';
                    setPlacement(newPlacement);
                }
                setShowPopover(true);
            }, 200);
        };
        const handleMouseLeave = () => {
            if (hoverTimeout)
                clearTimeout(hoverTimeout);
            hoverTimeout = window.setTimeout(() => setShowPopover(false), 200);
        };
        useEffect(() => {
            const handleClickOutside = (event) => {
                if (showPopover &&
                    targetRef.current &&
                    !targetRef.current.contains(event.target)) {
                    const popoverElement = document.getElementById(`popover-tag-${tag.id}`);
                    if (popoverElement && popoverElement.contains(event.target)) {
                        return;
                    }
                    setShowPopover(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, [showPopover, tag.id]);
        return (React.createElement("div", { className: "tag-chip-wrapper", onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave },
            React.createElement(Link, { to: `/tags/${tag.id}`, className: "tag-chip", ref: targetRef, "aria-haspopup": "true", "aria-expanded": showPopover, onMouseDown: (e) => e.stopPropagation() }, tag.name),
            React.createElement(Overlay, { show: showPopover, target: targetRef.current, placement: placement, containerPadding: 20 },
                React.createElement(Popover, { id: `popover-tag-${tag.id}`, className: "custom-popover", "aria-label": `Related scenes for tag ${tag.name}`, onMouseDown: (e) => e.stopPropagation() },
                    React.createElement(PopoverContent, { className: "popover-content-container" },
                        React.createElement("div", { className: "popover-flex-container" },
                            React.createElement(RelatedScenesPopover, { tagId: tag.id })))))));
    };
    const TagChips = ({ tags }) => {
        const [showMore, setShowMore] = useState(false);
        const [moreTarget, setMoreTarget] = useState(null);
        const hasMore = tags.length > 2;
        const displayed = tags.slice(0, 2);
        const moreItems = tags.slice(2); // Remaining tags
        const containerRef = useRef(null);
        const handleMouseEnter = (e) => {
            setMoreTarget(e.currentTarget);
            setShowMore(true);
        };
        const handleMouseLeave = () => {
            setShowMore(false);
        };
        return (React.createElement("div", { className: "tag-chips-container", ref: containerRef, onMouseLeave: handleMouseLeave },
            React.createElement("div", { className: "tag-chips" },
                displayed.map((tag) => (React.createElement(TagChipWithPopover, { key: tag.id, tag: tag }))),
                hasMore && (React.createElement("span", { className: "more-indicator", onMouseEnter: handleMouseEnter },
                    "+",
                    tags.length - 2,
                    " more"))),
            hasMore && (React.createElement(MoreListPopover, { items: moreItems, show: showMore, target: moreTarget, onHide: () => setShowMore(false), title: "All Tags", renderItem: (tag) => React.createElement(TagChipWithPopover, { key: tag.id, tag: tag }), noItemsMessage: "No tags found." }))));
    };
    const PerformerList = ({ performers, currentSceneId, }) => {
        const [showMore, setShowMore] = useState(false);
        const [moreTarget, setMoreTarget] = useState(null);
        const hasMore = performers.length > 2;
        const displayed = performers.slice(0, 2);
        const moreItems = performers.slice(2); // Remaining performers
        const handleMouseEnter = (e) => {
            setMoreTarget(e.currentTarget);
            setShowMore(true);
        };
        // Removed handleMouseLeave from here
        return (React.createElement("div", { className: "performers-container" },
            React.createElement("div", { className: "performers" },
                displayed.map((performer) => (React.createElement(PerformerTag, { performer: performer, key: performer.id, currentSceneId: currentSceneId }))),
                hasMore && (React.createElement("span", { className: "more-indicator", onMouseEnter: handleMouseEnter },
                    "+",
                    performers.length - 2,
                    " more"))),
            hasMore && (React.createElement(MoreListPopover, { items: moreItems, show: showMore, target: moreTarget, onHide: () => setShowMore(false), title: "All Performers", renderItem: (performer) => (React.createElement(PerformerTag, { performer: performer, key: performer.id, currentSceneId: currentSceneId })), noItemsMessage: "No performers found." }))));
    };
    // 6.10. SceneCardDetails Component (Updated with Config)
    const SceneCardDetails = ({ scene }) => {
        var _a, _b;
        const config = useSceneCardConfig();
        const tags = scene.tags
            ? scene.tags.map((tag) => ({ id: tag.id, name: tag.name }))
            : [];
        const getResolutionLabel = (height) => {
            if (height >= 4320)
                return '8K';
            if (height >= 2160)
                return '4K';
            if (height >= 1440)
                return '1440p';
            if (height >= 1080)
                return '1080p';
            if (height >= 720)
                return '720p';
            if (height >= 540)
                return '540p';
            return '480p';
        };
        const getResolutionColor = (label) => {
            switch (label) {
                case '8K':
                case '4K':
                    return 'gold';
                case '1440p':
                    return 'emerald';
                case '1080p':
                    return 'ruby';
                case '720p':
                    return 'silver';
                case '540p':
                case '480p':
                    return 'bronze';
                default:
                    return 'metallic';
            }
        };
        const getHighestResolution = (files) => {
            if (!files || files.length === 0)
                return 0;
            return Math.max(...files.map((file) => file.height || 0));
        };
        const files = scene.files || [];
        const highestHeight = getHighestResolution(files);
        const resolutionLabel = highestHeight
            ? getResolutionLabel(highestHeight)
            : null;
        const resolutionBadge = resolutionLabel
            ? { label: resolutionLabel, color: getResolutionColor(resolutionLabel) }
            : null;
        const ratingValue = (_a = scene.rating) !== null && _a !== void 0 ? _a : (scene.rating100 ? (scene.rating100 / 100) * 5 : null);
        let ratingBadge = null;
        if (ratingValue) {
            if (ratingValue >= 4.5)
                ratingBadge = { label: 'Top Rated', color: 'badge-elite' };
            else if (ratingValue >= 3.5)
                ratingBadge = { label: 'Great', color: 'badge-superb' };
            else if (ratingValue >= 2.5)
                ratingBadge = { label: 'Good', color: 'badge-great' };
            else if (ratingValue >= 1.5)
                ratingBadge = { label: 'Decent', color: 'badge-decent' };
            else if (ratingValue >= 0.5)
                ratingBadge = { label: 'Bad', color: 'badge-awful' };
        }
        let isNew = false;
        if (scene.date) {
            const sceneDate = new Date(scene.date);
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            if (sceneDate > oneMonthAgo) {
                isNew = true;
            }
        }
        const isPopular = scene.play_count && scene.play_count >= 10 ? true : false;
        const badges = [
            ...(config.enableBadges
                ? isNew
                    ? [{ label: 'New', color: 'green' }]
                    : []
                : []),
            ...(config.enableBadges
                ? isPopular
                    ? [{ label: 'Popular', color: 'blue' }]
                    : []
                : []),
            ...(config.enableBadges && ratingBadge ? [ratingBadge] : []),
            ...(config.enableBadges && resolutionBadge && highestHeight >= 720
                ? [{ label: resolutionBadge.label, color: resolutionBadge.color }]
                : []),
        ];
        return (React.createElement("div", { className: "scene-card-content" },
            config.enableBadges && (React.createElement("div", { className: "badges" }, badges.map((badge, index) => (React.createElement("span", { key: index, className: `badge ${badge.color}` }, badge.label))))),
            React.createElement("div", { className: "scene-title-wrapper" },
                React.createElement(Link, { className: "scene-title", to: `/scenes/${scene.id}`, "data-full-text": scene.title, onMouseDown: (e) => e.stopPropagation() }, scene.title || 'Untitled Scene')),
            config.enablePerformerList && (React.createElement(PerformerList, { performers: scene.performers || [], currentSceneId: scene.id })),
            config.enableFooter && (React.createElement(Footer, { date: ((_b = scene.date) === null || _b === void 0 ? void 0 : _b.toString()) || '', views: scene.play_count || 0, studio: scene.studio || { id: '', name: 'Unknown Studio' } })),
            config.enableTagChips && (React.createElement("div", { className: "tag-resolution-row" },
                React.createElement(TagChips, { tags: tags })))));
    };
    // 7. Wrap SceneCardDetails with Configuration Provider
    const WrappedSceneCardDetails = (props) => {
        return (React.createElement(SceneCardConfigProvider, null,
            React.createElement(SceneCardDetails, { scene: props.scene })));
    };
    // 8. Patch the 'SceneCard.Details' component with the Wrapped Component
    patch.instead('SceneCard.Details', (props) => {
        return React.createElement(WrappedSceneCardDetails, { ...props });
    });
    // 9. Remove 'SceneCard.Popovers' if not needed
    patch.instead('SceneCard.Popovers', () => null);
})();
//# sourceMappingURL=SerechopsSceneCard.js.map