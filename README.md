# Darlon Dutra: Missão Foz

Beat'em up 2D single-player em pixel art, feito para navegador e pensado primeiro para celular. O jogo percorre cinco quarteirões fictícios inspirados no centro urbano de Foz do Iguaçu.

> Obra fictícia e satírica. Os dez adversários são personagens adultos fictícios, apresentados como lutadores hostis. O jogo não transforma pessoas em situação de vulnerabilidade ou grupos étnicos em alvos.

## O que mudou na versão 4.0

- O survivor multiplayer e todo o sistema de poderes foram removidos.
- Novo combate manual com **soco** e **chute**.
- Movimento lateral e em profundidade, no estilo beat'em up clássico.
- Cinco telas/quarteirões com transição em fade.
- Dez lutadores diferentes, dois em cada fase.
- Adversários começam sentados e levantam quando o jogador se aproxima; só recebem dano depois de assumirem postura de combate.
- Personagem principal em pixel art com terno preto e óculos.
- Cenários urbanos desenhados diretamente no Canvas, com lojas, praça, palmeiras, calçada e placas de Foz do Iguaçu.
- HUD com vida, fase, cronômetro, adversários restantes e combo.
- Controles completos para celular e computador.
- Pedido automático de tela cheia e orientação horizontal em navegadores compatíveis.
- Áudio retrô gerado no navegador, sem arquivos externos.

## Controles

### Celular

- Joystick esquerdo: movimentar.
- **SOCO**: ataque rápido.
- **CHUTE**: ataque mais forte e com maior alcance.
- Botão `Ⅱ`: pausar.

Ao tocar em **JOGAR AGORA**, o jogo tenta abrir em tela cheia e travar a orientação na horizontal. Em aparelhos que não permitem o bloqueio automático, aparece uma tela pedindo para girar o celular.

### Computador

- `WASD` ou setas: movimentar.
- `J`, `Z` ou `Espaço`: soco.
- `K` ou `X`: chute.
- `P` ou `Esc`: pausar.

## Estrutura

```text
SurvivorPaint/
├─ server.js
├─ package.json
├─ railway.toml
├─ Procfile
├─ start.sh
├─ JOGAR_LOCAL.bat
└─ public/
   ├─ index.html
   ├─ style.css
   └─ game.js
```

O projeto usa apenas Node.js 18+ e APIs nativas do navegador. Não é necessário instalar dependências.

## Rodar localmente

```bash
npm start
```

Abra `http://localhost:3000`.

No Windows, também é possível executar `JOGAR_LOCAL.bat`.

## Verificações

```bash
npm run check
curl http://localhost:3000/api/health
```

O healthcheck deve responder:

```json
{"ok":true,"game":"Darlon Dutra: Missão Foz","version":"4.0.0"}
```

## Railway

O repositório já está configurado para Railway:

- start command: `node server.js`
- healthcheck: `/api/health`
- porta: variável `PORT` fornecida automaticamente pela plataforma

Quando o serviço estiver conectado à branch `main`, cada novo commit inicia um deploy automático.
