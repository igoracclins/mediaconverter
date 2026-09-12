// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import type {
  AddFilesResult,
  AppInfo,
  QueueSnapshot,
  RendererApi,
  SelectionResult,
  StartConversionRequest,
  StartConversionResult,
} from '@shared/ipc';
import App from '../App.vue';
import DropZone from '../components/DropZone.vue';
import DraftList from '../components/DraftList.vue';
import CompressionDraftList from '../components/CompressionDraftList.vue';

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
    async () => ({ ok: true as const, created: 0, rejected: [] }),
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

const MIXED: AddFilesResult = {
  files: [
    {
      path: '/m/video.mp4',
      name: 'video.mp4',
      extension: 'mp4',
      category: 'video',
      sizeBytes: 52428800,
    },
    {
      path: '/m/musica.mp3',
      name: 'musica.mp3',
      extension: 'mp3',
      category: 'audio',
      sizeBytes: 10485760,
    },
    {
      path: '/m/foto.jpg',
      name: 'foto.jpg',
      extension: 'jpg',
      category: 'image',
      sizeBytes: 2097152,
    },
  ],
  rejected: [],
};

async function pickOperation(wrapper: VueWrapper, label: string): Promise<void> {
  const button = wrapper.findAll('button').find((b) => b.text().includes(label))!;
  await button.trigger('click');
  await flushPromises();
}

async function addDraft(wrapper: VueWrapper, draft: AddFilesResult = MIXED): Promise<void> {
  apiMock.openFiles.mockResolvedValue({ cancelled: false, files: draft.files });
  apiMock.inspectFiles.mockResolvedValue(draft);
  await wrapper.findComponent(DropZone).trigger('click');
  await flushPromises();
}

function installApi(): void {
  vi.clearAllMocks();
  window.localStorage.clear();
  apiMock.onQueueUpdated.mockReturnValue(() => undefined);
  apiMock.openFiles.mockResolvedValue({ cancelled: true, files: [] });
  apiMock.inspectFiles.mockResolvedValue({ files: [], rejected: [] });
  const win = window as unknown as { api: RendererApi };
  win.api = apiMock as unknown as RendererApi;
}

function sectionHeaders(wrapper: VueWrapper): string {
  return wrapper
    .findComponent(DraftList)
    .findAll('h3')
    .map((h) => h.text())
    .join('|');
}

function childOfList(wrapper: VueWrapper, selector: string): DOMWrapper<Element>[] {
  const list = wrapper.findComponent(DraftList);
  return list.findAll(selector);
}

describe('category grouping', () => {
  beforeEach(installApi);
  afterEach(() => vi.useRealTimers());

  it('shows only non-empty category groups with the right headers', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Conversão');
    await addDraft(wrapper);

    expect(sectionHeaders(wrapper)).toContain('Vídeos');
    expect(sectionHeaders(wrapper)).toContain('Áudios');
    expect(sectionHeaders(wrapper)).toContain('Imagens');
    expect(wrapper.text()).toContain('Prontos para converter');

    wrapper.unmount();
  });

  it('places each file in its correct category group', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Conversão');
    await addDraft(wrapper);

    const groups = wrapper
      .findComponent(DraftList)
      .findAll('h3')
      .map((h) => h.parent()!.parent()!);
    const video = groups.find((g) => g.text().includes('Vídeos'))!;
    const audio = groups.find((g) => g.text().includes('Áudios'))!;
    const image = groups.find((g) => g.text().includes('Imagens'))!;

    expect(video.text()).toContain('video.mp4');
    expect(video.text()).not.toContain('musica.mp3');
    expect(video.text()).not.toContain('foto.jpg');
    expect(audio.text()).toContain('musica.mp3');
    expect(audio.text()).not.toContain('video.mp4');
    expect(image.text()).toContain('foto.jpg');
    expect(image.text()).not.toContain('video.mp4');

    wrapper.unmount();
  });

  it('hides empty categories', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Conversão');
    await addDraft(wrapper, {
      files: [
        {
          path: '/m/only.mp4',
          name: 'only.mp4',
          extension: 'mp4',
          category: 'video',
          sizeBytes: 52428800,
        },
      ],
      rejected: [],
    });

    expect(sectionHeaders(wrapper)).toBe('Vídeos');
    expect(wrapper.text()).not.toContain('Áudios');
    expect(wrapper.text()).not.toContain('Imagens');

    wrapper.unmount();
  });

  it('keeps mixed-category files selectable together and converts only the chosen category', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Conversão');
    await addDraft(wrapper);

    expect(wrapper.text()).toContain('Prontos para converter');
    expect(wrapper.text()).toContain('video.mp4');
    expect(wrapper.text()).toContain('musica.mp3');
    expect(wrapper.text()).toContain('foto.jpg');

    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'Converter 1 vídeo')!
      .trigger('click');
    await flushPromises();

    const calls = apiMock.startConversion.mock.calls;
    expect(calls).toHaveLength(1);
    const request = calls[0]![0];
    expect(request.operation).toBe('convert');
    expect(request.items).toHaveLength(1);
    expect(request.items[0]!.inputPath).toBe('/m/video.mp4');
    expect(request.items[0]!.targetFormat).toBe('mp4');

    wrapper.unmount();
  });

  it('removes an individual file across categories', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Conversão');
    await addDraft(wrapper);

    const removeButtons = childOfList(wrapper, 'button[title]').filter((b) =>
      (b.attributes('title') as string).startsWith('Remover '),
    );
    const removeMusica = removeButtons.find(
      (b) => (b.attributes('title') as string) === 'Remover musica.mp3',
    )!;
    await removeMusica.trigger('click');

    expect(sectionHeaders(wrapper)).toBe('Vídeos|Imagens');
    expect(wrapper.text()).not.toContain('musica.mp3');
    expect(wrapper.text()).toContain('video.mp4');
    expect(wrapper.text()).toContain('foto.jpg');

    wrapper.unmount();
  });

  it('“Remover todos” clears every category group', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Conversão');
    await addDraft(wrapper);

    const removeAll = wrapper.findAll('button').find((b) => b.text().trim() === 'Remover todos')!;
    await removeAll.trigger('click');
    await flushPromises();

    expect(wrapper.text()).not.toContain('Vídeos');
    expect(wrapper.text()).not.toContain('Áudios');
    expect(wrapper.text()).not.toContain('Imagens');
    expect(wrapper.text()).not.toContain('video.mp4');

    wrapper.unmount();
  });

  it('each category gets its own conversion format', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Conversão');
    await addDraft(wrapper);

    expect((wrapper.find('#convert-format-video').element as HTMLSelectElement).value).toBe('mp4');
    expect((wrapper.find('#convert-format-audio').element as HTMLSelectElement).value).toBe('mp3');
    expect((wrapper.find('#convert-format-image').element as HTMLSelectElement).value).toBe('jpg');

    await wrapper.find('#convert-format-video').setValue('webm');
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'Converter 1 vídeo')!
      .trigger('click');
    await flushPromises();

    const calls = apiMock.startConversion.mock.calls;
    const request = calls[0]![0];
    expect(request.items[0]!.targetFormat).toBe('webm');

    wrapper.unmount();
  });

  it('groups by category in compression mode too', async () => {
    vi.useFakeTimers();
    const wrapper = mount(App);
    await flushPromises();
    await pickOperation(wrapper, 'Compressão');
    await addDraft(wrapper);

    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(400);
    await flushPromises();

    const list = wrapper.findComponent(CompressionDraftList);
    const headers = list
      .findAll('h3')
      .map((h) => h.text())
      .join('|');
    expect(headers).toBe('Vídeos|Áudios|Imagens');
    expect(list.text()).toContain('video.mp4');
    expect(list.text()).toContain('musica.mp3');
    expect(list.text()).toContain('foto.jpg');

    wrapper.unmount();
    vi.useRealTimers();
  });
});