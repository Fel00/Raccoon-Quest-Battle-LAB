# Guia de sprites

## Como o frontend encontra um sprite

O componente `Sprite` procura automaticamente uma imagem com o mesmo ID do personagem ou equipamento. Não é necessário cadastrar cada arquivo em um mapa.

Coloque os arquivos nas pastas abaixo, usando o ID exato do catálogo como nome:

| Tipo | Pasta |
| --- | --- |
| Personagens jogáveis | `apps/web/public/sprites/characters/` |
| Inimigos e invocações | `apps/web/public/sprites/enemies/` |
| Chapéus | `apps/web/public/sprites/hats/` |
| Itens consumíveis | `apps/web/public/sprites/items/` |
| Armas | `apps/web/public/sprites/weapons/` |

Por exemplo, o ID `pip-adventure` corresponde a:

```text
apps/web/public/sprites/characters/pip-adventure.png
```

Sprites de inimigos usam o ID do inimigo e ficam na pasta `enemies`. Por exemplo:

```text
apps/web/public/sprites/enemies/esquilo-coletor.png
```

Inimigos repetidos no mesmo encontro reutilizam o mesmo sprite. Invocações usam o ID da unidade invocada; para a Muralha de Troncos, o ID é `barricada-troncos`.

O código tenta os formatos `.png`, `.webp`, `.jpg`, `.jpeg` e `.svg`, primeiro na pasta do tipo correto e depois diretamente em `apps/web/public/sprites/`. Se não encontrar um arquivo que o navegador consiga carregar, usa `apps/web/public/sprites/template.svg`.

Os IDs estão em `packages/game-data/src/catalog.ts`. Use o ID — por exemplo `touca-natacao` — e não o nome de exibição, como “A Touca de Natação Velha”. Os mesmos sprites de personagens também aparecem na montagem, no catálogo e no combate.

## Proporção, corte e centralização

As molduras da interface são quadradas. O CSS usa `object-fit: cover`, centralizando a imagem e cortando o excesso para preencher a moldura. Isso **preserva a proporção original**: não estica nem altera o arquivo, que pode continuar com dimensões diferentes.

Se quiser exibir a imagem inteira, sem corte, altere `object-fit: cover` para `object-fit: contain` em `.sprite img`, em `apps/web/src/styles.css`. Nesse modo podem sobrar espaços nas laterais ou acima/abaixo.

Para sprites novos, recomendamos:

- Canvas de 256×256 px
- Personagem ocupando aproximadamente 84% do quadro
- Margem segura de 8% em todos os lados
- Fundo transparente
- Ícone de equipamento: 128×128 px
- Ícone de efeito: 32×32 px

Não é necessário cortar ou redimensionar o arquivo original para que o frontend o exiba.

## Solução de problemas

- **O template ainda aparece:** confira a pasta, o nome e a extensão. Por exemplo, `pip-adventure.png` deve estar em `sprites/characters/` e `esquilo-coletor.png` em `sprites/enemies/`.
- **O nome não corresponde:** compare com o ID em `packages/game-data/src/catalog.ts`; nomes de exibição e IDs não são necessariamente iguais.
- **O arquivo existe, mas o template aparece:** confira se a imagem abre normalmente e se o formato/extensão correspondem ao conteúdo. O frontend usa o template quando a imagem falha ao carregar.
- **A mudança não aparece:** atualize a página do navegador. Arquivos em `public` são acessados pela URL `/sprites/<pasta>/<id>.<extensão>`; não inclua `public` na URL.

Use somente arte própria ou licenciada para os sprites do projeto. [template.svg](../assets/sprites/template.svg) é o fallback e uma referência de proporção.
