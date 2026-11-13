# Editor de blocos da plataforma Blocos

Este repositório é um fork do [TurboWarp/scratch-gui](https://github.com/TurboWarp/scratch-gui)
(commit 7738389afee319d2c6293550a2f7cb13004b928c), distribuído sob a mesma licença: **GPL-3.0** (veja `LICENSE`).

É o editor usado nas lições da plataforma, dentro de um iframe. As mudanças ficam ativas só no modo
Blocos (`window.__BLOCOS__`, entrada `src/playground/blocos.jsx`):

- ponte de mensagens com o site (`src/lib/blocos-bridge.js`): carregar o projeto da lição, filtrar os blocos da paleta e devolver o projeto (.sb3);
- idioma pela URL, cor roxa, sem itens de comunidade, conta, configurações avançadas e "Novo";
- bibliotecas de atores, cenários e sons: a da plataforma primeiro, seguida da original;
- palco pequeno automático e sem tamanho mínimo, para caber na janela.

Scratch é um projeto do Scratch Foundation. Este editor não é afiliado ao Scratch nem ao TurboWarp.

## Compilar

    npm ci
    BLOCOS=1 ROOT=/editor/ NODE_ENV=production npx webpack --bail
