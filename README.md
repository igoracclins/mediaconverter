# Media Converter

Aplicativo desktop para conversão em lote de arquivos de mídia (áudio, vídeo e imagem), desenvolvido com Electron, Vue 3 e TypeScript. Todo o processamento acontece localmente, na própria máquina; nenhum arquivo é enviado para a nuvem.

## Download

A versão mais recente do Media Converter pode ser baixada na página de Releases do GitHub.

| Plataforma                  | Instalador |
| --------------------------- | ---------- |
| macOS Apple Silicon (arm64) | `.dmg`     |
| Windows x64                 | `.exe`     |

**[Baixar a versão mais recente](../../releases/latest)**

Os instaladores são disponibilizados como assets das Releases do projeto.

## Sobre o projeto

Projeto desenvolvido para fins acadêmicos. O aplicativo permite adicionar vários arquivos de mídia e processá-los em uma fila, com acompanhamento do progresso em tempo real, em três operações:

- **Conversão**: escolha o formato de saída desejado (opção "Converter todos para"), aplicado globalmente aos arquivos compatíveis.
- **Compressão**: cada arquivo é comprimido com um limite de tamanho máximo de saída em megabytes, mantendo o próprio formato original; o aplicativo ajusta os parâmetros de codificação para buscar a melhor qualidade possível dentro desse limite.
- **Extração de áudio**: vídeos têm apenas a faixa de áudio extraída, sem reencodificação quando o contêiner e o codec permitem (stream copy).

Os resultados são salvos em pastas criadas ao lado do arquivo de origem: `Convertidos` (conversão e compressão) e `Extraidos` (extração de áudio).

## Funcionalidades

- Conversão de arquivos de mídia (áudio, vídeo e imagem) em lote.
- Fila de processamento com execução concorrente e progresso em tempo real.
- Seleção global do formato de saída, através da opção "Converter todos para".
- Compressão individual por arquivo, com definição de tamanho máximo de saída.
- Ajuste automático dos parâmetros de codificação na compressão.
- Extração da faixa de áudio de vídeos, sem reencodificação quando o contêiner e o codec permitem (stream copy).
- Identificação de arquivos de formato não suportado no momento da adição.
- Pasta de saída criada automaticamente ao lado do arquivo de origem (`Convertidos` para conversão/compressão e `Extraidos` para extração).
- Botão para abrir a pasta e localizar o arquivo de cada conversão concluída.
- Cancelamento de conversões individuais ou de toda a fila.
- Limpeza das conversões concluídas.
- Arrastar e soltar arquivos na janela do aplicativo.

## Formatos suportados

| Categoria | Formatos de saída        |
| --------- | ------------------------ |
| Áudio     | MP3, WAV, M4A, OGG, FLAC |
| Vídeo     | MP4, MOV, MKV, WEBM      |
| Imagem    | JPG, PNG, WEBP, AVIF     |

Na extração de áudio, o destino pode ser qualquer um dos formatos de áudio acima (padrão MP3). Quando o codec de áudio do vídeo é compatível com o contêiner de destino, a faixa é copiada diretamente, sem reencodificação.

## Tecnologias

- Electron
- Vue 3
- TypeScript
- Vite / electron-vite
- FFmpeg
- Sharp
- Vitest
- electron-builder

## Plataformas

| Plataforma | Arquitetura           | Status              |
| ---------- | --------------------- | ------------------- |
| macOS      | arm64 (Apple Silicon) | Binários preparados |
| Windows    | x64                   | Binários preparados |
| macOS      | x64                   | Configurado         |
| Linux      | x64                   | Configurado         |

Os binários do FFmpeg são distribuídos junto ao aplicativo para as plataformas com binários preparados: `darwin-arm64` (macOS) e `win32-x64` (Windows).

## Como executar

Pré-requisitos:

- Node.js (>= 20.19)
- pnpm (>= 10)

Instale as dependências:

```bash
pnpm install
```

Prepare os binários do FFmpeg para a plataforma atual:

```bash
pnpm ffmpeg:prepare
```

Execute o aplicativo em modo de desenvolvimento:

```bash
pnpm dev
```

## Build

Para gerar as versões de distribuição:

```bash
pnpm dist:mac   # instalador para macOS Apple Silicon
pnpm dist:win   # instalador para Windows x64
pnpm dist       # artefatos para as plataformas configuradas
```

Os artefatos são gravados na pasta `dist/`, que é gerada durante o build e não faz parte do código-fonte versionado.

> **Assinatura de código (produção).** Os instaladores são gerados **sem assinatura**
> a menos que credenciais reais sejam fornecidas via variáveis de ambiente/CI — o
> projeto não guarda nem exige certificados. Quando as credenciais estiverem
> presentes, o build produz: macOS assinado (Developer ID) + notarizado + stapled;
> Windows assinado com Authenticode. Sem elas, o macOS pode bloquear um build
> baixado pelo Gatekeeper (mensagem *"o aplicativo está danificado"* ou *"não foi
> possível verificar"*) e o SmartScreen pode mostrar *"editor desconhecido"* —
> comportamento esperado do sistema para software não assinado. Detalhes em
> [`docs/packaging.md`](docs/packaging.md#code-signing--notarization-production).

## Estrutura do projeto

```
src/
  core/       lógica de domínio: detecção, nomes, jobs e fila
  conversion/ mecanismos de conversão (FFmpeg/Sharp) e parsing de progresso
  platform/   detecção de plataforma, processos e caminhos
  main/       processo principal do Electron, IPC e serviços
  preload/    API exposta ao renderer via contextBridge
  renderer/   interface (Vue)
  shared/     tipos e constantes compartilhados

scripts/
  ffmpeg/     preparação, verificação e inspeção do FFmpeg
  smoke/      scripts de smoke test
  licenses/   auditoria de licenças

tests/
  integration/  testes de integração com binários reais

resources/
  ffmpeg/       binários do FFmpeg preparados localmente
```

## Documentação

- [Arquitetura](docs/architecture.md)
- [Guia de desenvolvimento](docs/development.md)
- [Empacotamento e distribuição](docs/packaging.md)
- [Ferramentas do FFmpeg](docs/ffmpeg.md)
- [Licenciamento](docs/licensing.md)
- [Matriz de validação](docs/validation.md)

## Licença

O projeto é distribuído sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para detalhes.

O projeto utiliza software de terceiros, como FFmpeg e Sharp, que possuem suas próprias licenças. Consulte [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) para mais informações.
