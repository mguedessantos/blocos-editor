// blocos: a nossa biblioteca (de /editor-assets/library) vem primeiro, seguida da do TurboWarp.
// Os arquivos da nossa ficam marcados em window.__BLOCOS_OURS__ (servidos pelo site); os outros vêm do servidor de arte do Scratch.
const blocosLibrary = (name, builtin) => Promise.all([
    fetch(`/editor-assets/library/${name}.json`).then(r => r.json()),
    builtin().then(mod => mod.default)
]).then(([ours, theirs]) => {
    const marks = window.__BLOCOS_OURS__ || (window.__BLOCOS_OURS__ = new Set());
    const mark = item => [item, ...(item.costumes || []), ...(item.sounds || [])]
        .forEach(a => a.assetId && marks.add(a.assetId));
    ours.forEach(mark);
    return ours.concat(theirs);
});
const asyncLibrary = (callback, name) => {
    let data = null;
    return () => {
        if (data) return data;
        if (window.__BLOCOS__) return blocosLibrary(name, callback).then(d => (data = d));
        return callback()
            .then(mod => (data = mod.default));
    };
};

export const getBackdropLibrary = asyncLibrary(
    () => import(/* webpackChunkName: "library-backdrops" */ './backdrops.json'),
    'backdrops'
);
export const getCostumeLibrary = asyncLibrary(
    () => import(/* webpackChunkName: "library-costumes" */ './costumes.json'),
    'costumes'
);
export const getSoundLibrary = asyncLibrary(
    () => import(/* webpackChunkName: "library-sounds" */ './sounds.json'),
    'sounds'
);
export const getSpriteLibrary = asyncLibrary(
    () => import(/* webpackChunkName: "library-sprites" */ './sprites.json'),
    'sprites'
);
