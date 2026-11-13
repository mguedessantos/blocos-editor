// Blocos: ponte entre o site (janela de cima) e o editor dentro do iframe.
// Mensagens recebidas: {type:'load', sb3: ArrayBuffer, allowedBlocks: string[]}, {type:'getProject', id}.
// Mensagens enviadas: {type:'ready'}, {type:'loaded'}, {type:'project', id, sb3}, {type:'changed'}, {type:'error', message}.

import {setStageSize} from '../reducers/stage-size';
import {STAGE_SIZE_MODES} from './layout-constants';

let allowed = null; // null = todos os blocos

/** Remove da paleta os blocos que a lição não libera (e categorias que ficarem vazias). */
export const filterToolbox = xml => {
    if (!allowed || !xml) return xml;
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    for (const category of Array.from(doc.querySelectorAll('category'))) {
        for (const block of Array.from(category.children)) {
            if (block.tagName === 'block' && !allowed.has(block.getAttribute('type'))) category.removeChild(block);
        }
        const hasBlocks = Array.from(category.children).some(c => c.tagName === 'block');
        // a categoria Variáveis tem o botão "Criar uma variável": fica se algum bloco de dados for liberado
        const keepVariables = category.getAttribute('custom') === 'VARIABLE' &&
            Array.from(allowed).some(t => t.startsWith('data_'));
        if (!hasBlocks && !keepVariables) category.parentNode.removeChild(category);
    }
    return new XMLSerializer().serializeToString(doc);
};

export const setupBridge = vm => {
    const parentOrigin = (() => {
        try {
            return new URL(document.referrer).origin;
        } catch (e) {
            return location.origin;
        }
    })();
    const send = msg => window.parent.postMessage(msg, parentOrigin);

    let changeTimer = null;
    vm.on('PROJECT_CHANGED', () => {
        clearTimeout(changeTimer);
        changeTimer = setTimeout(() => send({type: 'changed'}), 1500);
    });

    window.addEventListener('message', async e => {
        if (e.origin !== parentOrigin || !e.data || typeof e.data !== 'object') return;
        const msg = e.data;
        try {
            if (msg.type === 'hello') {
                // o site começou a ouvir depois do nosso 'ready': avisa de novo
                send({type: 'ready'});
            } else if (msg.type === 'load') {
                allowed = Array.isArray(msg.allowedBlocks) && msg.allowedBlocks.length ?
                    new Set(msg.allowedBlocks) : null;
                await vm.loadProject(msg.sb3);
                vm.setEditingTarget(vm.runtime.targets.find(t => !t.isStage)?.id || vm.runtime.getTargetForStage().id);
                send({type: 'loaded'});
            } else if (msg.type === 'getProject') {
                const blob = await vm.saveProjectSb3();
                send({type: 'project', id: msg.id, sb3: await blob.arrayBuffer()});
            }
        } catch (err) {
            send({type: 'error', message: String(err && err.message || err)});
        }
    });
    // janela estreita (a coluna da missão ocupa parte da tela): palco pequeno para tudo caber sem cortar
    let lastSmall = null;
    const fit = () => {
        const small = window.innerWidth < 1150;
        if (small === lastSmall || !window.ReduxStore) return;
        lastSmall = small;
        window.ReduxStore.dispatch(setStageSize(small ? STAGE_SIZE_MODES.small : STAGE_SIZE_MODES.large));
    };
    window.addEventListener('resize', fit);
    fit();

    send({type: 'ready'});
};
