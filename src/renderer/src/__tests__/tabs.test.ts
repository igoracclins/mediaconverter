// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import type {
  AddFilesResult,
  AppInfo,
  JobSnapshot,
  QueueSnapshot,
  RendererApi,
  SelectionResult,
  StartConversionRequest,
  StartConversionResult,
} from '@shared/ipc';
import App from '../App.vue';
import DropZone from '../components/DropZone.vue';

const apiMock = {
  getAppInfo: vi.fn<() => Promise<AppInfo>>(async () => ({
    appVersion: '0.1.0',
    electronVersion: '44.0.0',
    platform: 'test',
    arch: 'x64',
    ffmpeg: { present: false, path: null, version: null },
    engines: [],
  })),
  openFiles: vi.fn<() => Promise<SelectionResult>>(async () => ({ cancelled: true, files: [] })),
  inspectFiles: vi.fn<(paths: string[]) => Promise<AddFilesResult>>(async () => ({
    files: [],
    rejected: [],
  })),
  startConversion: vi.fn<(request: StartConversionRequest) => Promise<StartConversionResult>>(
    async () => ({ ok: true, created: 0, rejected: [] }),
  ),
  cancelJob: vi.fn<() => Promise<void>>(async () => undefined),
  cancelAll: vi.fn<() => Promise<void>>(async () => undefined),
  clearCompleted: vi.fn<() => Promise<void>>(async () => undefined),
  revealOutput: vi.fn<() => Promise<void>>(async () => undefined),
  getPathForFile: vi.fn<() => string>(() => ''),
  onQueueUpdated: vi.fn<(listener: (snapshot: QueueSnapshot) => void) => () => void>(
    () => () => undefined,
  ),
};

async function pickOperation(wrapper: VueWrapper, label: string): Promise<void> {
  const button = wrapper.findAll('button').find((b) => b.text().includes(label))!;
  await button.trigger('click');
  await flushPromises();
}

function numberInputs(wrapper: VueWrapper): DOMWrapper<HTMLInputElement>[] {
  return wrapper.findAll<HTMLInputElement>('input[inputmode="decimal"]');
}

const DRAFT_A: AddFilesResult = {
  files: [
    {
      path: '/tmp/a.ogg',
      name: 'a.ogg',
      extension: 'ogg',
      category: 'audio',
      sizeBytes: 104857600,
    },
  ],
  rejected: [],
};

const DRAFT_B: AddFilesResult = {
  files: [
    {
      path: '/tmp/b.ogg',
      name: 'b.ogg',
      extension: 'ogg',
      category: 'audio',
      sizeBytes: 104857600,
    },
  ],
  rejected: [],
};

async function addDraft(wrapper: VueWrapper, draft: AddFilesResult = DRAFT_A): Promise<void> {
  apiMock.openFiles.mockResolvedValue({ cancelled: false, files: draft.files });
  apiMock.inspectFiles.mockResolvedValue(draft);
  await wrapper.findComponent(DropZone).trigger('click');
  await flushPromises();
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(400);
  await vi.advanceTimersByTimeAsync(400);
  await flushPromises();
}

function installApi(): void {
  vi.useFakeTimers();
  vi.clearAllMocks();
  window.localStorage.clear();
  apiMock.onQueueUpdated.mockReturnValue(() => undefined);
  apiMock.openFiles.mockResolvedValue({ cancelled: true, files: [] });
  apiMock.inspectFiles.mockResolvedValue({ files: [], rejected: [] });
  const win = window as unknown as { api: RendererApi };
  win.api = apiMock as unknown as RendererApi;
}

describe('Conversion operation flow', () => {
  beforeEach(installApi);
  afterEach(() => vi.useRealTimers());

  it('shows only conversion controls', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Conversão');
    await addDraft(wrapper);

    expect(wrapper.text()).toContain('Converter todos para');
    expect(wrapper.find('#convert-format-audio').exists()).toBe(true);
    expect(wrapper.text()).toContain('Converter 1 áudio');

    expect(wrapper.text()).not.toContain('Perfil');
    expect(wrapper.text()).not.toContain('Tamanho máximo');
    expect(wrapper.find('input[inputmode="decimal"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('keeps the normal conversion global (per-format, no compression)', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Conversão');
    await addDraft(wrapper, DRAFT_A);
    await addDraft(wrapper, DRAFT_B);

    expect((wrapper.find('#convert-format-audio').element as HTMLSelectElement).value).toBe('mp3');
    expect(wrapper.text()).toContain('Converter 2 áudios');

    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'Converter 2 áudios')!
      .trigger('click');
    await flushPromises();

    const calls = apiMock.startConversion.mock.calls;
    expect(calls).toHaveLength(1);
    const request = calls[0]![0];
    expect(request.operation).toBe('convert');
    expect(request.destination).toBeNull();
    expect(request.items).toHaveLength(2);
    for (const item of request.items) {
      expect(item.targetFormat).toBe('mp3');
      expect(item.compression).toBeUndefined();
    }

    wrapper.unmount();
  });
});

describe('Compressão individual por arquivo', () => {
  beforeEach(installApi);
  afterEach(() => vi.useRealTimers());

  async function setupTwo(): Promise<VueWrapper> {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Compressão');
    await addDraft(wrapper, DRAFT_A);
    await addDraft(wrapper, DRAFT_B);
    await settle();
    return wrapper;
  }

  it('shows only compression controls without any quality recommendation', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Compressão');
    await addDraft(wrapper);
    await settle();

    const html = wrapper.html();
    expect(wrapper.text()).toContain('Tamanho máximo');
    expect(wrapper.text()).toContain('Comprimir 1 áudio');
    expect(wrapper.text()).toContain('Defina um tamanho máximo (em MB) para este arquivo.');
    expect(wrapper.find('input[inputmode="decimal"]').exists()).toBe(true);

    expect(html).not.toContain('não ultrapassará o tamanho máximo');
    expect(html).not.toContain('prioriza a melhor qualidade');
    expect(wrapper.text()).not.toContain('qualidade aceitável');
    expect(wrapper.text()).not.toContain('tamanho mínimo recomendado');
    expect(wrapper.text()).not.toContain('tamanho recomendado');

    expect(wrapper.text()).not.toContain('Perfil');
    expect(wrapper.text()).not.toContain('alvo aproximado');
    expect(wrapper.text()).not.toContain('Boa qualidade');
    expect(wrapper.text()).not.toContain('Máxima compressão');
    expect(wrapper.text()).not.toContain('Converter todos para');
    expect(wrapper.find('#global-format').exists()).toBe(false);

    wrapper.unmount();
  });

  it('switches back to the conversion-only controls', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Conversão');
    await addDraft(wrapper);
    expect(wrapper.text()).toContain('Converter todos para');

    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'Trocar operação')!
      .trigger('click');
    await flushPromises();
    await pickOperation(wrapper, 'Compressão');
    await addDraft(wrapper);
    await settle();
    expect(wrapper.text()).toContain('Tamanho máximo');

    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'Trocar operação')!
      .trigger('click');
    await flushPromises();
    await pickOperation(wrapper, 'Conversão');
    await addDraft(wrapper);

    expect(wrapper.text()).toContain('Converter todos para');
    expect(wrapper.find('#convert-format-audio').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Tamanho máximo');

    wrapper.unmount();
  });

  it('drafts start without a max size configured', async () => {
    const wrapper = await setupTwo();

    expect(wrapper.findAll('select').length).toBe(0);
    expect(numberInputs(wrapper)[0]!.element.value).toBe('');
    expect(numberInputs(wrapper)[1]!.element.value).toBe('');
    expect(numberInputs(wrapper)[0]!.attributes('placeholder')).toBe('0,00');

    wrapper.unmount();
  });

  it('each file has its own max size', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('30');
    await numberInputs(wrapper)[1]!.setValue('80');
    await settle();

    expect(numberInputs(wrapper)[0]!.element.value).toBe('30');
    expect(numberInputs(wrapper)[1]!.element.value).toBe('80');

    wrapper.unmount();
  });

  it('changing the max size of A does not change B', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('30');
    await numberInputs(wrapper)[1]!.setValue('80');
    await settle();
    await numberInputs(wrapper)[0]!.setValue('45');
    await settle();

    expect(numberInputs(wrapper)[0]!.element.value).toBe('45');
    expect(numberInputs(wrapper)[1]!.element.value).toBe('80');

    wrapper.unmount();
  });

  it('accepts a comma decimal separator and keeps it in the field', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('30,5');
    await settle();

    expect(numberInputs(wrapper)[0]!.element.value).toBe('30,5');

    wrapper.unmount();
  });

  it('strips letters and extra separators typed into the max size input', async () => {
    const wrapper = await setupTwo();
    const input = numberInputs(wrapper)[0]!;

    await input.setValue('abc30.5def');
    await settle();

    expect(input.element.value).toBe('30.5');

    await input.setValue('40,,.x');
    expect(input.element.value).toBe('40,');

    wrapper.unmount();
  });

  it('sends each job its own compression maxSizeMb limit', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('30,5');
    await numberInputs(wrapper)[1]!.setValue('80');
    await settle();

    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'Comprimir 2 áudios')!
      .trigger('click');
    await flushPromises();

    const calls = apiMock.startConversion.mock.calls;
    expect(calls).toHaveLength(1);
    const request = calls[0]![0];
    expect(request.operation).toBe('compress');
    expect(request.destination).toBeNull();
    expect(request.items.map((item) => item.compression)).toEqual([
      { maxSizeMb: 30.5 },
      { maxSizeMb: 80 },
    ]);

    wrapper.unmount();
  });

  it('does not submit files with an invalid (non-positive) max size', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('0');
    await numberInputs(wrapper)[1]!.setValue('80');
    await settle();

    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'Comprimir 1 áudio')!
      .trigger('click');
    await flushPromises();

    const calls = apiMock.startConversion.mock.calls;
    expect(calls).toHaveLength(1);
    const request = calls[0]![0];
    expect(request.items.map((item) => item.compression)).toEqual([{ maxSizeMb: 80 }]);

    wrapper.unmount();
  });

  it('the max-size input does not react to the wheel', async () => {
    const wrapper = await setupTwo();
    const input = numberInputs(wrapper)[0]!;

    await input.setValue('30');
    await input.trigger('wheel', { deltaY: -100 });

    expect(input.element.value).toBe('30');

    wrapper.unmount();
  });

  it('shows an error hint when the max size is not below the original size', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('150');
    await settle();

    expect(wrapper.text()).toContain('menor que o tamanho original');

    wrapper.unmount();
  });

  it('shows the permitted minimum when the limit is below the 5% floor', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('0.5');
    await settle();

    expect(wrapper.text()).toContain('mínimo permitido');
    expect(wrapper.text()).toContain('5.00 MB');

    wrapper.unmount();
  });

  it('does not submit a file whose max size is not valid', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('30');
    await numberInputs(wrapper)[1]!.setValue('150');
    await settle();

    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'Comprimir 1 áudio')!
      .trigger('click');
    await flushPromises();

    const calls = apiMock.startConversion.mock.calls;
    expect(calls).toHaveLength(1);
    const request = calls[0]![0];
    expect(request.items.map((item) => item.compression)).toEqual([{ maxSizeMb: 30 }]);

    wrapper.unmount();
  });
});

describe('Extração de áudio', () => {
  beforeEach(installApi);
  afterEach(() => vi.useRealTimers());

  const DRAFT_VIDEO: AddFilesResult = {
    files: [
      {
        path: '/tmp/clip.mp4',
        name: 'clip.mp4',
        extension: 'mp4',
        category: 'video',
        sizeBytes: 10485760,
      },
    ],
    rejected: [],
  };

  async function setupVideo(wrapper: VueWrapper): Promise<void> {
    await pickOperation(wrapper, 'Extração de áudio');
    await addDraft(wrapper, DRAFT_VIDEO);
  }

  it('shows extraction controls for video drafts', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await setupVideo(wrapper);

    expect(wrapper.text()).toContain('Prontos para extrair');
    expect(wrapper.text()).toContain('Extrair áudio para');
    expect(wrapper.find('#extract-audio-format').exists()).toBe(true);
    expect(wrapper.text()).toContain('Extrair áudio de 1 vídeo');
    expect((wrapper.find('#extract-audio-format').element as HTMLSelectElement).value).toBe('mp3');

    expect(wrapper.text()).not.toContain('Converter todos para');
    expect(wrapper.text()).not.toContain('Tamanho máximo');

    wrapper.unmount();
  });

  it('ignores non-video files and reports it', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Extração de áudio');
    await addDraft(wrapper, DRAFT_A);

    expect(wrapper.text()).toContain('A extração de áudio aceita somente vídeos');
    expect(wrapper.text()).toContain('Nenhum arquivo adicionado ainda.');

    wrapper.unmount();
  });

  it('submits an extract request with the chosen audio format', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await setupVideo(wrapper);

    await wrapper.find('#extract-audio-format').setValue('m4a');
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'Extrair áudio de 1 vídeo')!
      .trigger('click');
    await flushPromises();

    const calls = apiMock.startConversion.mock.calls;
    expect(calls).toHaveLength(1);
    const request = calls[0]![0];
    expect(request.operation).toBe('extract');
    expect(request.destination).toBeNull();
    expect(request.items).toEqual([
      { inputPath: '/tmp/clip.mp4', targetFormat: 'm4a', quality: 'high' },
    ]);

    wrapper.unmount();
  });
});

describe('Queue output reveal', () => {
  beforeEach(installApi);
  afterEach(() => vi.useRealTimers());

  function completedJob(): JobSnapshot {
    return {
      id: 'job-1',
      operation: 'extract',
      name: 'clip.mp4',
      sourceExtension: 'mp4',
      category: 'video',
      targetFormat: 'mp3',
      quality: 'high',
      status: 'completed',
      progress: 100,
      errorCode: null,
      errorMessage: null,
      outputPath: 'C:/Users/igor/Videos/Extraidos/clip.mp3',
      createdAt: 1,
      startedAt: 2,
      finishedAt: 3,
    };
  }

  it('shows a reveal button for a completed job and reveals its output', async () => {
    let listener: ((snapshot: QueueSnapshot) => void) | null = null;
    apiMock.onQueueUpdated.mockImplementation((cb) => {
      listener = cb;
      return () => undefined;
    });

    const wrapper = mount(App);
    await flushPromises();
    expect(listener).not.toBeNull();

    listener?.({ jobs: [completedJob()], running: false, activeCount: 0 });
    await nextTick();
    await flushPromises();

    const revealButton = wrapper.find('button[aria-label="Abrir pasta do arquivo gerado"]');
    expect(revealButton.exists()).toBe(true);

    await revealButton.trigger('click');
    await flushPromises();
    expect(apiMock.revealOutput).toHaveBeenCalledWith('job-1');

    wrapper.unmount();
  });

  it('does not show a reveal button for non-completed jobs', async () => {
    let listener: ((snapshot: QueueSnapshot) => void) | null = null;
    apiMock.onQueueUpdated.mockImplementation((cb) => {
      listener = cb;
      return () => undefined;
    });

    const wrapper = mount(App);
    await flushPromises();

    const job = completedJob();
    job.status = 'processing';
    job.outputPath = null;
    listener?.({ jobs: [job], running: true, activeCount: 1 });
    await nextTick();
    await flushPromises();

    expect(wrapper.find('button[aria-label="Abrir pasta do arquivo gerado"]').exists()).toBe(false);

    wrapper.unmount();
  });
});