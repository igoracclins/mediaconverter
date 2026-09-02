# Media Converter

Aplicativo desktop para conversão e compressão de mídia (áudio, vídeo e imagens), local-first e multiplataforma, construído com Electron, Vue 3 e TypeScript.

Todo o processamento é feito localmente na sua máquina — nenhum arquivo é enviado para a nuvem.

## Sobre o projeto

O Media Converter é um aplicativo desktop para conversão em lote de arquivos de mídia.

Você pode adicionar vários arquivos, selecionar o formato de saída e processá-los em uma fila, acompanhando o progresso em tempo real.

Além da conversão convencional, o aplicativo oferece compressão individual por arquivo, permitindo definir um tamanho máximo de saída e buscando a melhor qualidade possível dentro do limite especificado.

A saída das conversões é criada automaticamente em uma pasta `Convertidos`, dentro da pasta de origem de cada arquivo.

## Funcionalidades

- Conversão de arquivos de mídia (áudio, vídeo e imagem) em lote.
- Fila de processamento com concorrência e progresso em tempo real.
- Seleção do formato de saída.
- Identificação de arquivos incompatíveis ou não suportados no momento da adição.
- Pasta de saída automática `Convertidos` dentro da pasta de origem de cada arquivo.
- Compressão individual por arquivo, com definição de tamanho máximo de saída em MB.
- Busca pela melhor qualidade possível dentro do limite de tamanho definido.
- Ajuste automático dos parâmetros de codificação durante a compressão.
- Cancelamento de conversões individuais ou de toda a fila.
- Limpeza das conversões concluídas.
- Arrastar e soltar arquivos na janela do aplicativo.
- Processamento totalmente local.

## Formatos suportados

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
- [FFmpeg](https://ffmpeg.org/) — conversão e processamento de áudio e vídeo
- [Sharp](https://sharp.pixelplumbing.com/) — processamento de imagens
- [Vitest](https://vitest.dev/) — testes automatizados
- [electron-builder](https://www.electron.build/) — empacotamento e distribuição

## Plataformas

| Plataforma | Arquitetura           | Status                                  |
| ---------- | --------------------- | --------------------------------------- |
| macOS      | arm64 (Apple Silicon) | ✅ Preparado                            |
| Windows    | x64                   | ✅ Preparado                            |
| macOS      | x64                   | ⚠️ Configurado, sem binários preparados |
| Linux      | x64                   | ⚠️ Configurado, sem binários preparados |

Os binários do FFmpeg são distribuídos junto ao aplicativo para as plataformas atualmente preparadas:

- macOS — `darwin-arm64`
- Windows — `win32-x64`

## Download

Os instaladores para usuários finais serão disponibilizados através das GitHub Releases.

### macOS — Apple Silicon

[Baixar o instalador `.dmg`](URL_DA_RELEASE_MAC)

### Windows — x64

[Baixar o instalador `.exe`](URL_DA_RELEASE_WINDOWS)

> Os links acima devem ser substituídos pelos links dos respectivos arquivos publicados na GitHub Release.

Os instaladores não são versionados no repositório Git. Os arquivos de distribuição são publicados como assets das releases.

## Instalação para usuários finais

Quem baixar uma versão pronta do Media Converter **não precisa instalar separadamente as dependências de desenvolvimento**.

Não é necessário instalar:

- Node.js
- pnpm
- FFmpeg
- Sharp

Os componentes necessários para executar o aplicativo são incluídos no empacotamento da versão distribuída, de acordo com a plataforma.

### macOS

Abra o arquivo `.dmg` e arraste o Media Converter para a pasta `Applications`.

### Windows

Execute o instalador `.exe` e siga as instruções apresentadas pelo instalador.

O instalador do Windows também fornece o desinstalador padrão do aplicativo.

## Desenvolvimento

Esta seção é destinada a desenvolvedores que desejam clonar o repositório, executar o projeto localmente ou contribuir com o código.

### Pré-requisitos

- [Node.js](https://nodejs.org/) ≥ 20.19
- [pnpm](https://pnpm.io/) ≥ 10

### Instalação

Instale as dependências:

```sh
pnpm install
```

Prepare os binários do FFmpeg necessários para a plataforma atual:

```sh
pnpm ffmpeg:prepare
```

Execute o aplicativo em modo de desenvolvimento:

```sh
pnpm dev
```

O projeto utiliza módulos nativos específicos de plataforma. A configuração do workspace mantém as dependências necessárias para as plataformas suportadas.

No pnpm ≥ 10.18, o mapa `allowBuilds` em `pnpm-workspace.yaml` deve permanecer sincronizado com os pacotes que precisam executar scripts de instalação, como Electron, Sharp e esbuild.

### Scripts disponíveis

| Comando                 | Finalidade                                         |
| ----------------------- | -------------------------------------------------- |
| `pnpm dev`              | Executa o aplicativo em modo de desenvolvimento    |
| `pnpm build`            | Gera o build de produção via electron-vite         |
| `pnpm start`            | Abre uma prévia do aplicativo compilado            |
| `pnpm typecheck`        | Verifica os tipos TypeScript                       |
| `pnpm lint`             | Executa o ESLint                                   |
| `pnpm format`           | Formata os arquivos com Prettier                   |
| `pnpm format:check`     | Verifica a formatação                              |
| `pnpm test`             | Executa os testes unitários                        |
| `pnpm test:integration` | Executa os testes de integração com binários reais |
| `pnpm ffmpeg:prepare`   | Prepara os binários do FFmpeg                      |
| `pnpm ffmpeg:verify`    | Verifica os binários do FFmpeg                     |
| `pnpm ffmpeg:info`      | Exibe informações dos binários do FFmpeg           |
| `pnpm deps:check`       | Verifica as dependências do projeto                |
| `pnpm licenses:check`   | Audita as licenças das dependências                |
| `pnpm pack:dir`         | Gera o pacote do aplicativo descompactado          |
| `pnpm dist:mac`         | Gera o instalador para macOS arm64                 |
| `pnpm dist:win`         | Gera o instalador para Windows x64                 |
| `pnpm dist`             | Gera os artefatos de distribuição configurados     |

### Build e distribuição

O build de produção é gerado com electron-vite e os instaladores são criados com electron-builder.

Para gerar o instalador do macOS Apple Silicon:

```sh
pnpm dist:mac
```

Para gerar o instalador do Windows x64:

```sh
pnpm dist:win
```

Para gerar os artefatos das plataformas configuradas:

```sh
pnpm dist
```

Os artefatos são gravados na pasta `dist/`.

A pasta `dist/` contém arquivos gerados durante o processo de build e distribuição e não faz parte do código-fonte versionado.

## Estrutura do projeto

```
src/
├── core/          lógica de domínio: detecção, nomes, jobs e fila
├── conversion/    mecanismos FFmpeg/Sharp, parsing de progresso e conversão
├── platform/      detecção de plataforma, processos e caminhos
├── main/          processo principal do Electron, IPC e serviços
├── preload/       API exposta ao renderer via contextBridge
├── renderer/      interface Vue
└── shared/        tipos e constantes compartilhados

scripts/
├── ffmpeg/        preparação, verificação e inspeção do FFmpeg
├── smoke/         scripts de smoke test
└── licenses/      auditoria de licenças

tests/
└── integration/   testes de integração com binários reais

resources/
└── ffmpeg/        binários do FFmpeg preparados localmente
```

## Documentação

- [Arquitetura](docs/architecture.md)
- [Guia de desenvolvimento](docs/development.md)
- [Empacotamento e distribuição](docs/packaging.md)
- [Ferramentas do FFmpeg](docs/ffmpeg.md)
- [Licenciamento](docs/licensing.md)
- [Matriz de validação](docs/validation.md)

## Status do projeto

Versão: 0.1.0

O projeto está em preparação para sua primeira distribuição pública.

## Licença

O Media Converter é distribuído sob a [Licença MIT](LICENSE).

O projeto utiliza software de terceiros, incluindo FFmpeg e Sharp, que possuem suas próprias licenças.

Para mais informações, consulte [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
