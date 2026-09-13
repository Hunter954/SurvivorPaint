# Changelog

## 5.2.0 — Torcida 1444 e Avenida Brasil

- Avenida Brasil refeita em pixel art a partir da referência real, sem carros e com área de luta sobre a calçada portuguesa.
- Torcida animada em preto e amarelo cresce de quatro para dezesseis pessoas conforme as fases avançam.
- Placas e bandeiras exibem o número 1444, incluindo retrato pixelado do candidato e gritos visuais.
- Nova sequência final: após o chefão, o protagonista comemora cercado por apoiadores, bandeiras e confetes.
- Cache offline atualizado com os novos assets e versão 5.2.0.

## 5.1.0 — Elenco e animações renovados

- Protagonista redesenhado em pixel art a partir da referência do deputado.
- Dez adversários refeitos a partir das novas referências visuais.
- Caminhada corrigida com quatro poses e alternância real das pernas.
- Quadros isolados com margem transparente e recorte seguro para eliminar fragmentos durante golpes longos.
- Golpes passam por preparação, impacto e retorno sem repetir por tempo excessivo a pose estendida.

## 5.0.0 — Sprites 128×128

- Folhas raster do herói e dos dez lutadores com 16 estados de animação por personagem.
- Cenários raster 16:9 de Foz do Iguaçu integrados ao Canvas com fallback procedural.
- Cache offline atualizado para incluir todos os sprites e fundos.

## 4.1.1 — Atualização imediata

- CSS e JavaScript usam URLs versionadas para impedir que celulares mantenham arquivos antigos em cache após o deploy.

## 4.1.0 — iPhone e Foz real

- PWA instalável com tela cheia, orientação horizontal e ícone próprio.
- Fallback específico para o visualViewport e safe areas do Safari no iPhone.
- Instruções dentro do jogo para abrir pela Tela de Início no iOS.
- Fases redesenhadas como Avenida Brasil, Rua Almirante Barroso, Praça da Bíblia, Avenida Jorge Schimmelpfeng e Praça da Paz.
- Novos monumentos, igreja, paisagismo, placas de rua e arquitetura urbana em pixel art.

## 4.0.0 — Missão Foz

- Projeto convertido de survivor multiplayer para beat'em up single-player.
- Nova direção visual em pixel art procedural.
- Cinco fases urbanas, dez lutadores fictícios e transições em fade.
- Combate manual com soco/chute e IA de aproximação e ataque.
- Joystick e botões touch, fullscreen/orientação horizontal e HUD responsivo.
- Servidor simplificado para conteúdo estático e healthcheck do Railway.

## 3.0.0 — CO-OP COLOR

## Mudança estrutural
- O jogo deixou de ser somente um HTML local e virou um projeto Node.js completo.
- Servidor multiplayer próprio, sem dependências externas.
- Pronto para GitHub e Railway.
- Salas por link `?room=ABC123`, até 4 jogadores, cada um no próprio navegador/tela.
- Mundo, inimigos, chefes, vida, XP, pausa de evolução e revive são compartilhados.

## Novas armas
- Rifle de Rabisco
- Espingarda Torta
- Bomba de Tinta com poça de dano por segundo
- Páginas Giratórias
- Machado do Céu
- Lápis Bumerangue
- Compasso Maluco
- Raio de Caneta
- Mina de Borracha
- Rolo de Tinta
- Tesoura Voadora
- Passarinho Aliado

Cada arma possui 8 níveis e uma evolução especial por combinação com passivo.

## Visual
- Mantida a estética desenhada à mão / Paint.
- Adicionada paleta limitada de cores fortes.
- Tinta usa manchas irregulares, pingos aleatórios e contorno rabiscado.
- Efeitos de impacto, linhas elétricas, machados, minas e aliados coloridos.

## Co-op
- Lobby online.
- Link copiável e Web Share quando disponível.
- Host inicia e pausa a run.
- Evoluções pausam a sala para não prejudicar quem está escolhendo.
- Revive cooperativo ficando perto do amigo caído por 3 segundos.
- XP e baús de elite/chefes são distribuídos para a equipe.
- Power-ups de equipe: cura, tiro duplo, turbo, nuke, moedas e escudo.
