// Blocos: ponte entre o site (janela de cima) e o editor dentro do iframe.
// Mensagens recebidas: {type:'load', sb3: ArrayBuffer, allowedBlocks: string[]}, {type:'getProject', id}.
// Mensagens enviadas: {type:'ready'}, {type:'loaded'}, {type:'project', id, sb3}, {type:'changed'}, {type:'error', message}.

import {setStageSize} from '../reducers/stage-size';
import {setFullScreen, setPlayer} from '../reducers/mode';
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
        changeTimer = setTimeout(() => {
            changeTimer = null;
            send({type: 'changed'});
        }, 1500);
    });
    // o aluno rodou o programa (bandeira verde): o site libera o Verificar.
    // Uma mudança ainda pendente vai antes, para o 'run' sempre valer para o projeto atual.
    vm.on('PROJECT_RUN_START', () => {
        if (changeTimer) {
            clearTimeout(changeTimer);
            changeTimer = null;
            send({type: 'changed'});
        }
        send({type: 'run'});
        hideDone();
    });

    // tela verde de CONCLUÍDO sobre o palco (o site avisa quando a missão foi cumprida); some ao rodar de novo
    let done = null;
    let doneTimer = null;
    const hideDone = () => {
        clearTimeout(doneTimer);
        if (done) done.remove();
        done = null;
    };
    const showDone = () => {
        const canvas = document.querySelector('canvas');
        const box = canvas && canvas.parentElement;
        if (!box) return;
        hideDone();
        done = document.createElement('div');
        done.setAttribute('role', 'status');
        done.style.cssText = 'position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;' +
            'justify-content:center;gap:6px;background:linear-gradient(#15803d,#4ade80);color:#fff;font-family:system-ui,sans-serif;' +
            'cursor:pointer;border-radius:inherit;text-align:center';
        done.innerHTML = '<div style="font-size:clamp(20px,9cqw,52px);font-weight:800">CONCLUÍDO!</div>' +
            '<div style="font-size:clamp(11px,4cqw,22px);font-weight:700">Missão cumprida!</div>';
        box.style.position = box.style.position || 'relative';
        box.style.containerType = 'inline-size';
        done.addEventListener('click', hideDone);
        box.appendChild(done);
    };

    window.addEventListener('message', async e => {
        if (e.origin !== parentOrigin || !e.data || typeof e.data !== 'object') return;
        const msg = e.data;
        try {
            if (msg.type === 'hello') {
                // o site começou a ouvir depois do nosso 'ready': avisa de novo
                send({type: 'ready'});
            } else if (msg.type === 'concluido') {
                // deixa o programa terminar e espera 1 s, para a criança ver o resultado antes de cobrir o palco
                const later = () => {
                    clearTimeout(doneTimer);
                    doneTimer = setTimeout(showDone, 1000);
                };
                if (vm.runtime.threads.length) vm.runtime.once('PROJECT_RUN_STOP', later);
                else later();
            } else if (msg.type === 'center') {
                // o aluno perdeu o ator no palco: para tudo e põe cada ator de volta no lugar inicial (o código fica)
                vm.stopAll();
                for (const p of Array.isArray(msg.sprites) ? msg.sprites : []) {
                    const t = vm.runtime.getSpriteTargetByName(String(p.name));
                    if (!t) continue;
                    t.setXY(Number(p.x) || 0, Number(p.y) || 0);
                    t.setDirection(Number.isFinite(Number(p.direction)) ? Number(p.direction) : 90);
                    if (p.visible !== false) t.setVisible(true);
                }
                // jogo recomeça do zero: variáveis (placar) em 0 e sai da tela de CONCLUÍDO
                const stage = vm.runtime.getTargetForStage();
                for (const v of Object.values(stage.variables)) if (v.type === '') v.value = 0;
                const tela = stage.getCostumes()[stage.currentCostume];
                if (tela && /^conclu/i.test(tela.name)) stage.setCostume(0);
                hideDone();
                vm.emitTargetsUpdate();
            } else if (msg.type === 'load') {
                hideDone();
                allowed = Array.isArray(msg.allowedBlocks) && msg.allowedBlocks.length ?
                    new Set(msg.allowedBlocks) : null;
                // modo jogar (jurado): só o palco, em tela cheia dentro do quadro
                if (msg.player && window.ReduxStore) {
                    window.ReduxStore.dispatch(setPlayer(true));
                    window.ReduxStore.dispatch(setFullScreen(true));
                }
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
