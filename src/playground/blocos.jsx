/**
 * Blocos: editor dentro do iframe das lições. Licença GPL-3.0 (fork do TurboWarp/scratch-gui).
 * Fala com o site só por postMessage (src/lib/blocos-bridge.js).
 */

import './import-first';

window.__BLOCOS__ = true;

// a área de blocos encolhe para o editor caber na janela (sem as larguras mínimas do editor original)
const fitStyle = document.createElement('style');
fitStyle.textContent = '[class*="gui_editor-wrapper"]{flex-basis:0!important;flex-shrink:1!important;min-width:0!important}';
document.head.appendChild(fitStyle);

import React from 'react';
import {compose} from 'redux';
import AppStateHOC from '../lib/app-state-hoc.jsx';
import ErrorBoundaryHOC from '../lib/error-boundary-hoc.jsx';
import GUI from '../containers/gui.jsx';
import {setupBridge} from '../lib/blocos-bridge';
import render from './app-target';

const BlocosEditor = props => (
    <GUI
        canSave={false}
        canEditTitle={false}
        canShare={false}
        canRemix={false}
        canChangeLanguage={false}
        canChangeTheme={false}
        enableCommunity={false}
        backpackVisible={false}
        basePath={process.env.ROOT}
        onVmInit={setupBridge}
        {...props}
    />
);

const Wrapped = compose(
    AppStateHOC,
    ErrorBoundaryHOC('Blocos Editor')
)(BlocosEditor);

render(
    <div style={{position: 'fixed', inset: 0}}>
        <Wrapped isScratchDesktop={false} />
    </div>
);
