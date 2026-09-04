// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import type {
  AddFilesResult,
  AppInfo,
  CompressionEstimate,
  CompressionEstimateRequest,
  EstimateCompressionResult,
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
  estimateCompression: vi.fn<
    (request: CompressionEstimateRequest) => Promise<EstimateCompressionResult>
  >(async () => ({
    ok: true,
    estimate: {
      status: 'ok',
      currentSizeMb: 100,
      recommendedMinMb: 13.4,
      hardMinMb: 8,
    } satisfies CompressionEstimate,
  })),
  startConversion: vi.fn<(request: StartConversionRequest) => Promise<StartConversionResult>>(
    async () => ({ ok: true, created: 0, rejected: [] }),
  ),
  cancelJob: vi.fn<() => Promise<void>>(async () => undefined),
  cancelAll: vi.fn<() => Promise<void>>(async () => undefined),
  clearCompleted: vi.fn<() => Promise<void>>(async () => undefined),
  getPathForFile: vi.fn<() => string>(() => ''),
  onQueueUpdated: vi.fn<(listener: (snapshot: QueueSnapshot) => void) => () => void>(
    () => () => undefined,
  ),
};

function tabButton(wrapper: VueWrapper): (label: string) => DOMWrapper<Element> {
  return (label: string) => wrapper.findAll('button').find((b) => b.text().trim() === label)!;
}

function numberInputs(wrapper: VueWrapper): DOMWrapper<HTMLInputElement>[] {
  return wrapper.findAll<HTMLInputElement>('input[type="number"]');
}

const DRAFT_A: AddFilesResult = {
  files: [{ path: '/tmp/a.wav', name: 'a.wav', extension: 'wav', category: 'audio' }],
  rejected: [],
};

const DRAFT_B: AddFilesResult = {
  files: [{ path: '/tmp/b.wav', name: 'b.wav', extension: 'wav', category: 'audio' }],
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

function lastEstimateCallFor(path: string): CompressionEstimateRequest | undefined {
  const calls = apiMock.estimateCompression.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const request = calls[i]![0];
    if (request.inputPath === path) return request;
  }
  return undefined;
}

function installApi(): void {
  vi.useFakeTimers();
  vi.clearAllMocks();
  apiMock.onQueueUpdated.mockReturnValue(() => undefined);
  apiMock.openFiles.mockResolvedValue({ cancelled: true, files: [] });
  apiMock.inspectFiles.mockResolvedValue({ files: [], rejected: [] });
  apiMock.estimateCompression.mockResolvedValue({
    ok: true,
    estimate: {
      status: 'ok',
      currentSizeMb: 100,
      recommendedMinMb: 13.4,
      hardMinMb: 8,
    } satisfies CompressionEstimate,
  });
  const win = window as unknown as { api: RendererApi };
  win.api = apiMock as unknown as RendererApi;
}

describe('App mode tabs', () => {
  beforeEach(installApi);
  afterEach(() => vi.useRealTimers());

  it('Conversão tab shows only conversion controls', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await addDraft(wrapper);

    expect(wrapper.text()).toContain('Converter todos para');
    expect(wrapper.find('#convert-format-audio').exists()).toBe(true);
    expect(wrapper.text()).toContain('Converter 1 áudio');

    expect(wrapper.text()).not.toContain('Perfil');
    expect(wrapper.text()).not.toContain('Tamanho máximo');
    expect(wrapper.find('input[type="number"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('Compressão tab shows only compression controls without the removed guarantee message', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await addDraft(wrapper);
    await tabButton(wrapper)('Compressão').trigger('click');
    await settle();

    const html = wrapper.html();
    expect(wrapper.text()).toContain('Tamanho máximo');
    expect(wrapper.text()).toContain('Comprimir 1 arquivo');
    expect(wrapper.find('input[type="number"]').exists()).toBe(true);

    expect(html).not.toContain('não ultrapassará o tamanho máximo');
    expect(html).not.toContain('prioriza a melhor qualidade');

    expect(wrapper.text()).not.toContain('Perfil');
    expect(wrapper.text()).not.toContain('alvo aproximado');
    expect(wrapper.text()).not.toContain('Boa qualidade');
    expect(wrapper.text()).not.toContain('Máxima compressão');
    expect(wrapper.text()).not.toContain('Converter todos para');
    expect(wrapper.find('#global-format').exists()).toBe(false);

    wrapper.unmount();
  });

  it('toggles back to the conversion-only controls', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await addDraft(wrapper);
    await tabButton(wrapper)('Compressão').trigger('click');
    await settle();
    await tabButton(wrapper)('Conversão').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Converter todos para');
    expect(wrapper.find('#convert-format-audio').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Tamanho máximo');

    wrapper.unmount();
  });
});

describe('Compressão individual por arquivo', () => {
  beforeEach(installApi);
  afterEach(() => vi.useRealTimers());

  async function setupTwo(): Promise<VueWrapper> {
    const wrapper = mount(App);
    await flushPromises();
    await addDraft(wrapper, DRAFT_A);
    await addDraft(wrapper, DRAFT_B);
    await tabButton(wrapper)('Compressão').trigger('click');
    await settle();
    return wrapper;
  }

  it('seeds each file max size from the estimator and there is no profile select', async () => {
    const wrapper = await setupTwo();

    expect(wrapper.findAll('select').length).toBe(0);
    expect(numberInputs(wrapper)[0]!.element.value).toBe('14');
    expect(numberInputs(wrapper)[1]!.element.value).toBe('14');

    wrapper.unmount();
  });

  it('each file has its own max size', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('30');
    await numberInputs(wrapper)[1]!.setValue('100');
    await settle();

    expect(numberInputs(wrapper)[0]!.element.value).toBe('30');
    expect(numberInputs(wrapper)[1]!.element.value).toBe('100');

    wrapper.unmount();
  });

  it('changing the max size of A does not change B', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('30');
    await numberInputs(wrapper)[1]!.setValue('100');
    await settle();
    await numberInputs(wrapper)[0]!.setValue('45');
    await settle();

    expect(numberInputs(wrapper)[0]!.element.value).toBe('45');
    expect(numberInputs(wrapper)[1]!.element.value).toBe('100');
    expect(lastEstimateCallFor('/tmp/b.wav')?.maxSizeMb).toBe(100);

    wrapper.unmount();
  });

  it('runs the estimator per file with its own maxSizeMb limit', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('30');
    await numberInputs(wrapper)[1]!.setValue('100');
    await settle();

    expect(lastEstimateCallFor('/tmp/a.wav')?.maxSizeMb).toBe(30);
    expect(lastEstimateCallFor('/tmp/b.wav')?.maxSizeMb).toBe(100);

    wrapper.unmount();
  });

  it('sends each job its own compression maxSizeMb limit', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('30');
    await numberInputs(wrapper)[1]!.setValue('100');
    await settle();

    await tabButton(wrapper)('Comprimir 2 arquivos').trigger('click');
    await flushPromises();

    const calls = apiMock.startConversion.mock.calls;
    expect(calls).toHaveLength(1);
    const request = calls[0]![0];
    expect(request.destination).toBeNull();
    expect(request.items.map((item) => item.compression)).toEqual([
      { maxSizeMb: 30 },
      { maxSizeMb: 100 },
    ]);

    wrapper.unmount();
  });

  it('keeps the normal conversion global (per-format, no compression)', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await addDraft(wrapper, DRAFT_A);
    await addDraft(wrapper, DRAFT_B);

    expect((wrapper.find('#convert-format-audio').element as HTMLSelectElement).value).toBe('mp3');
    expect(wrapper.text()).toContain('Converter 2 áudios');

    await tabButton(wrapper)('Converter 2 áudios').trigger('click');
    await flushPromises();

    const calls = apiMock.startConversion.mock.calls;
    expect(calls).toHaveLength(1);
    const request = calls[0]![0];
    expect(request.destination).toBeNull();
    expect(request.items).toHaveLength(2);
    for (const item of request.items) {
      expect(item.targetFormat).toBe('mp3');
      expect(item.compression).toBeUndefined();
    }

    wrapper.unmount();
  });

  it('does not submit files with an invalid (non-positive) max size', async () => {
    const wrapper = await setupTwo();

    await numberInputs(wrapper)[0]!.setValue('0');
    await numberInputs(wrapper)[1]!.setValue('100');
    await settle();

    await tabButton(wrapper)('Comprimir 1 arquivo').trigger('click');
    await flushPromises();

    const calls = apiMock.startConversion.mock.calls;
    expect(calls).toHaveLength(1);
    const request = calls[0]![0];
    expect(request.items.map((item) => item.compression)).toEqual([{ maxSizeMb: 100 }]);

    wrapper.unmount();
  });

  it('the max-size number input does not react to the wheel', async () => {
    const wrapper = await setupTwo();
    const input = numberInputs(wrapper)[0]!;

    await input.setValue('30');
    await input.trigger('wheel', { deltaY: -100 });

    expect(input.element.value).toBe('30');

    wrapper.unmount();
  });
});
