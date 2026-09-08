# Rabisco Survivors CO-OP

Um roguelike survivor 2D inspirado no ritmo de jogos do gênero *survivor*, mas com identidade própria: aves inimigas, armas de rabisco, manchas de tinta, páginas giratórias, machados caindo do céu e estética de desenho feito no Paint.

Esta versão já foi reestruturada para funcionar como **game web online**, com servidor Node.js, salas multiplayer por link e deploy direto no Railway.

## Principais recursos

- Arena infinita com câmera seguindo o jogador.
- Até **4 jogadores na mesma run**, cada um em seu próprio navegador/tela.
- Sala por código de 6 caracteres e link compartilhável `?room=ABC123`.
- Host cria a sala, compartilha o link e inicia a partida.
- Movimento em 8 direções, mira pelo mouse e dash.
- Hordas progressivas, elites e 4 chefes.
- Run de 8 minutos.
- Vida, dano inimigo, XP, chefes, inimigos e power-ups compartilhados pelo servidor.
- Level-up com 3 escolhas e pausa global durante a escolha.
- Baús para todos quando elites e chefes morrem.
- Revive co-op: fique perto de um amigo caído por 3 segundos.
- Power-ups de equipe: cura, tiro duplo, turbo, nuke, moedas e escudo.
- Melhorias permanentes salvas no navegador com `localStorage`.
- Funciona em desktop e possui controles touch básicos.

## Armas atuais

1. **Rifle de Rabisco** → Riscadora Turbo
2. **Espingarda Torta** → Tempestade de Giz
3. **Bomba de Tinta** → Dilúvio de Tinta
4. **Páginas Giratórias** → Enciclopédia Giratória
5. **Machado do Céu** → Machado Meteoro
6. **Lápis Bumerangue** → Lápis Infinito
7. **Compasso Maluco** → Órbita do Caos
8. **Raio de Caneta** → Linha de Choque
9. **Mina de Borracha** → Borracha Nuclear
10. **Rolo de Tinta** → Asfalto de Guache
11. **Tesoura Voadora** → Tesoura Fantasma
12. **Passarinho Aliado** → Esquadrão de Pombos

Cada arma tem **8 níveis**. A evolução exige a arma no nível 8 e o passivo correspondente no nível 3 ou superior; depois disso, um baú pode transformá-la.

## Passivos

- Luva de Borracha — recarga
- Pote de Tinta — dano
- Tênis Riscado — velocidade e dash
- Colete de Papelão — armadura
- Ímã Torto — alcance elétrico
- Coração Rabiscado — vida e regeneração
- Lente Quebrada — crítico
- Caderno de XP — ganho de XP
- Régua Torta — área
- Mola de Caneta — velocidade/quantidade de projéteis
- Paleta Molhada — duração de efeitos no chão

## Como rodar no Windows

Requer Node.js 18 ou superior.

1. Extraia o ZIP.
2. Dê dois cliques em `JOGAR_LOCAL.bat`.
3. O servidor abre em `http://localhost:3000`.

Também pode executar no terminal:

```bash
npm start
```

Não há `npm install` obrigatório porque esta versão usa apenas módulos nativos do Node.js.

## Como testar multiplayer local

1. Rode `JOGAR_LOCAL.bat`.
2. Clique em **CRIAR SALA CO-OP**.
3. Copie o link exibido.
4. Abra o link em outro navegador, janela anônima ou outro computador da mesma rede usando o endereço acessível da máquina.
5. O segundo jogador entra e o host inicia.

Para jogar entre computadores pela internet, faça o deploy no Railway.

## Deploy no GitHub

Crie um repositório vazio e envie **o conteúdo desta pasta** para a raiz do repositório.

Arquivos importantes que devem ficar na raiz:

```text
server.js
package.json
railway.toml
Procfile
public/
README.md
```

Exemplo com Git:

```bash
git init
git add .
git commit -m "Rabisco Survivors CO-OP"
git branch -M main
git remote add origin SEU_REPOSITORIO.git
git push -u origin main
```

## Deploy no Railway

1. Entre no Railway.
2. Escolha **New Project → Deploy from GitHub Repo**.
3. Selecione o repositório deste jogo.
4. O Railway detectará Node.js pelo `package.json`.
5. O comando de start já está configurado como:

```text
node server.js
```

6. Gere um domínio público em **Settings / Networking**.
7. Abra o domínio do Railway e crie uma sala.
8. O link copiado pelo próprio jogo já usará o domínio público correto.

O healthcheck usado é:

```text
/api/health
```

## Arquitetura multiplayer

O servidor é responsável por:

- salas;
- jogadores;
- posições;
- hordas;
- chefes;
- projéteis inimigos;
- dano recebido;
- XP;
- level-up pendente;
- baús;
- revive;
- power-ups;
- HP compartilhado dos inimigos.

Os navegadores calculam os efeitos e padrões das armas e enviam o dano ao servidor. Para este Hyper MVP isso oferece uma experiência cooperativa leve sem bibliotecas externas.

### Limitação atual de infraestrutura

As salas ficam **na memória do processo Node.js**. Isso é ideal para o MVP e para uma única instância Railway. Se o serviço reiniciar ou for redeployado, as salas ativas são perdidas.

Para uma versão comercial/escalável, o próximo passo seria mover estado de sala/sessão para Redis e trocar o polling HTTP por WebSocket.

## Estrutura

```text
rabisco-survivors-coop/
├─ server.js               # servidor HTTP + multiplayer + simulação
├─ package.json
├─ railway.toml
├─ Procfile
├─ JOGAR_LOCAL.bat
├─ start.sh
├─ CHANGELOG.md
├─ LICENSE
└─ public/
   ├─ index.html            # interface / overlays / lobby
   ├─ style.css             # UI estilo rabisco/Paint
   ├─ game.js               # render, armas, efeitos e cliente multiplayer
   └─ assets/
      └─ concept-reference.png
```

## Controles

- `WASD` / setas — mover
- Mouse — mirar
- Ataque — automático
- `Espaço` — dash
- `P` — host pausa/despausa a sala
- `1`, `2`, `3` — escolher evolução

## Identidade visual

A imagem original de conceito foi mantida em `public/assets/concept-reference.png` como referência. O jogo não depende de sprites externos: personagens, aves, páginas, machados, manchas de tinta, minas e projéteis são desenhados via Canvas em tempo real.
