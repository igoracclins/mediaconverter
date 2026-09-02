# Media Converter

Aplicativo desktop de conversão e compressão de mídia (áudio, vídeo e imagens), local-first e multiplataforma, construído com Electron, Vue 3 e TypeScript.

Todo o processamento é feito localmente na sua máquina — nenhum arquivo é enviado para a nuvem.

## Sobre o projeto

O Media Converter é um aplicativo desktop para conversão em lote de arquivos de mídia. Você pode adicionar vários arquivos, escolher o formato e a qualidade de saída para cada um, processá-los em fila e acompanhar o progresso em tempo real.

Além da conversão convencional, o aplicativo oferece um modo de compressão por arquivo com controle de tamanho máximo de saída, preservando a melhor qualidade possível dentro do limite definido.

## Funcionalidades

- Conversão de arquivos de mídia (áudio, vídeo e imagem) em lote, com fila de processamento com concorrência e progresso em tempo real.
- Seleção do formato de saída e da qualidade por arquivo.
- Identificação de arquivos incompatíveis ou não suportados no momento da adição.
- Pasta de saída automática `Convertidos` criada junto a cada arquivo de origem, ou pasta de destino escolhida pelo usuário.
- Compressão individual por arquivo, com definição de um tamanho máximo de saída (em MB).
- Preservação da melhor qualidade possível dentro do limite definido, com ajuste automático dos parâmetros de codificação.
- Cancelamento de cada conversão individualmente ou de toda a fila.
- Limpeza das conversões concluídas.
- Arrastar e soltar arquivos na janela do aplicativo.

### Formatos suportados

| Categoria | Saída                                 |
| --------- | ------------------------------------- |
| Áudio     | MP3, WAV, M4A/AAC, OGG (Vorbis), FLAC |
| Vídeo     | MP4, MOV, MKV, WEBM                   |
| Imagem    | JPG, PNG, WEBP, AVIF                  |

## Tecnologias

- [Electron](https://www.electronjs.org/) — aplicação desktop
- [Vue 3](https://vuejs.org/) — interface do usuário
- [TypeScript](https://www.typescriptlang.org/) — linguagem
- [Vite](https://vitejs.dev/) / [electron-vite](https://electron-vite.org/) — build e desenvolvimento
- [FFmpeg](https://ffmpeg.org/) — conversão de áudio e vídeo
- [Sharp](https://sharp.pixelplumbing.com/) — conversão de imagens

## Plataformas

| Plataforma | Arquitetura | Status                                  |
| ---------- | ----------- | --------------------------------------- |
| macOS      | arm64       | ✅ Binários FFmpeg preparados           |
| macOS      | x64         | ⚠️ Configurado, sem binários preparados |
| Windows    | x64         | ✅ Binários FFmpeg preparados           |
| Linux      | x64         | ⚠️ Configurado, sem binários preparados |

Os binários do FFmpeg são distribuídos junto ao aplicativo para as plataformas em que foram preparados (`darwin-arm64` e `win32-x64`).

## Como executar em desenvolvimento

Pré-requisitos: [Node.js](https://nodejs.org/) ≥ 20.19 e [pnpm](https://pnpm.io/) ≥ 10.

```sh
# instala as dependências (e recompila os módulos nativos para o Electron)
pnpm install

# baixa, verifica (sha256) e instala os binários do FFmpeg para esta plataforma
pnpm ffmpeg:prepare

# executa o aplicativo em modo de desenvolvimento (HMR)
pnpm dev
```

> No pnpm ≥ 10.18, o mapa `allowBuilds` em `pnpm-workspace.yaml` precisa permanecer
> sincronizado com os scripts de instalação (esbuild, sharp, electron, etc.), caso
> contrário o pnpm se recusa a executar os builds de pós-instalação.

### Scripts disponíveis

| Comando                                   | Finalidade                                                        |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                                | Executa o app em modo de desenvolvimento (HMR)                    |
| `pnpm build`                              | Build de produção via electron-vite (em `out/`)                   |
| `pnpm start`                              | Abre uma prévia do app compilado                                  |
| `pnpm typecheck`                          | `vue-tsc` (renderer) + `tsc` (main/preload)                       |
| `pnpm lint` / `pnpm format`               | ESLint / Prettier                                                 |
| `pnpm test`                               | Testes unitários (Vitest)                                         |
| `pnpm test:integration`                   | Testes de integração com binários reais (requer FFmpeg preparado) |
| `pnpm ffmpeg:prepare` / `verify` / `info` | Ferramentas do FFmpeg (ver `docs/ffmpeg.md`)                      |
| `pnpm deps:check`                         | Verificação de higiene das dependências                           |
| `pnpm licenses:check`                     | Auditoria de licenças das dependências de produção                |
| `pnpm pack:dir`                           | Gera o pacote do app descompactado                                |
| `pnpm dist`                               | Gera os artefatos de instalação via electron-builder              |

## Build e distribuição

O build de produção é gerado com o `electron-vite` (saída em `out/`), e os instaladores são criados com o [electron-builder](https://www.electron.build/).

Comandos de distribuição:

- `pnpm dist:mac` — gera o instalador para macOS (Apple Silicon / arm64);
- `pnpm dist:win` — gera o instalador para Windows (x64);
- `pnpm dist` — gera artefatos para as plataformas configuradas.

Os artefatos são gravados na pasta `dist/`, que não faz parte do código-fonte nem é versionada.

## Download

Os instaladores ainda não estão publicados. Quando o repositório receber o primeiro lançamento (GitHub Release), os instaladores estarão disponíveis como assets da release.

Substitua `URL_DA_RELEASE` pelos links reais da release:

- **macOS — Apple Silicon:** [Baixar .dmg](URL_DA_RELEASE)
- **Windows — x64:** [Baixar .exe](URL_DA_RELEASE)

> Os instaladores não são versionados no repositório Git; eles são distribuídos apenas como assets das releases.

## Estrutura do projeto

```
src/
  core/       lógica de domínio: detecção, nomes, jobs, fila
  conversion/ mecanismos (ffmpeg/sharp), parsing de progresso, orquestração
  platform/   detecção de plataforma, spawn de processos, resolução de caminhos
  main/       processo principal do Electron: IPC, janela, fila de conversão, diálogos
  preload/    API via contextBridge
  renderer/   interface Vue
  shared/     tipos e constantes compartilhados entre processos
scripts/
  ffmpeg/     busca + verificação + inspeção dos binários do FFmpeg
  smoke/      scripts de smoke test em runtime do Electron (ABI do sharp)
  licenses/   auditoria de licenças
tests/
  integration/  testes de ponta a ponta com binários reais
resources/ffmpeg/  binários baixados (ignorados pelo Git)
```

## Documentação

- [Arquitetura](docs/architecture.md)
- [Guia de desenvolvimento](docs/development.md)
- [Empacotamento e distribuição](docs/packaging.md)
- [Ferramentas do FFmpeg](docs/ffmpeg.md)
- [Licenciamento](docs/licensing.md)
- [Matriz de validação](docs/validation.md)

## Status do projeto

Versão atual em desenvolvimento (0.1.0). O projeto está sendo preparado para a primeira distribuição pública.

## Licença

O Media Converter é distribuído sob a [Licença MIT](LICENSE).

O projeto utiliza software de terceiros, como FFmpeg e Sharp, distribuídos sob suas respectivas licenças. Consulte [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) para detalhes.
