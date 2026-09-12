import type {
  AppErrorCode,
  ConversionEngineId,
  MediaCategory,
  QualityPreset,
  TargetFormat,
} from './types';
import {
  AUDIO_TARGET_FORMATS,
  IMAGE_TARGET_FORMATS,
  QUALITY_PRESETS,
  VIDEO_TARGET_FORMATS,
} from './types';

export const CATEGORY_EXTENSIONS: Record<MediaCategory, readonly string[]> = {
  audio: [
    'mp3',
    'wav',
    'wave',
    'm4a',
    'm4b',
    'm4r',
    'aac',
    'ogg',
    'oga',
    'opus',
    'flac',
    'wma',
    'aiff',
    'aif',
    'aifc',
    'ac3',
    'amr',
    'ape',
    'mp2',
    'mpc',
    'wv',
    '3g2',
  ],
  video: [
    'mp4',
    'mov',
    'mkv',
    'webm',
    'avi',
    'flv',
    'wmv',
    'm4v',
    'mpg',
    'mpeg',
    'm2v',
    'ts',
    'mts',
    'm2ts',
    'ogv',
    '3gp',
    '3gpp',
    'vob',
    'asf',
    'rmvb',
    'rm',
    'f4v',
    'dv',
    'mxf',
    'hevc',
    'h264',
    'm2p',
    'vob',
  ],
  image: [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'avif',
    'gif',
    'bmp',
    'tif',
    'tiff',
    'heic',
    'heif',
    'jxl',
    'svg',
    'ico',
    'jp2',
    'raw',
    'dng',
  ],
};

export interface FormatDescriptor {
  id: TargetFormat;
  category: MediaCategory;
  label: string;
  description: string;
  supportsQuality: boolean;
  defaultQuality: QualityPreset;
  engine: ConversionEngineId;
}

export function qualityFromValue(value: unknown): QualityPreset | null {
  return QUALITY_PRESETS.includes(value as QualityPreset) ? (value as QualityPreset) : null;
}

export function formatFromValue(value: unknown): TargetFormat | null {
  if (typeof value !== 'string') return null;
  if ((AUDIO_TARGET_FORMATS as readonly string[]).includes(value)) return value as TargetFormat;
  if ((VIDEO_TARGET_FORMATS as readonly string[]).includes(value)) return value as TargetFormat;
  if ((IMAGE_TARGET_FORMATS as readonly string[]).includes(value)) return value as TargetFormat;
  return null;
}

export const TARGET_FORMATS: readonly FormatDescriptor[] = [
  {
    id: 'mp3',
    category: 'audio',
    label: 'MP3',
    description: 'Áudio compactado, amplamente compatível',
    supportsQuality: true,
    defaultQuality: 'high',
    engine: 'ffmpeg',
  },
  {
    id: 'wav',
    category: 'audio',
    label: 'WAV',
    description: 'Sem perdas (PCM)',
    supportsQuality: false,
    defaultQuality: 'high',
    engine: 'ffmpeg',
  },
  {
    id: 'm4a',
    category: 'audio',
    label: 'M4A / AAC',
    description: 'Áudio compactado MPEG-4',
    supportsQuality: true,
    defaultQuality: 'high',
    engine: 'ffmpeg',
  },
  {
    id: 'ogg',
    category: 'audio',
    label: 'OGG (Vorbis)',
    description: 'Compacto e moderno, ótimo para a web',
    supportsQuality: true,
    defaultQuality: 'high',
    engine: 'ffmpeg',
  },
  {
    id: 'flac',
    category: 'audio',
    label: 'FLAC',
    description: 'Sem perdas, arquivos maiores',
    supportsQuality: false,
    defaultQuality: 'high',
    engine: 'ffmpeg',
  },
  {
    id: 'mp4',
    category: 'video',
    label: 'MP4',
    description: 'H.264 + AAC, compatibilidade universal',
    supportsQuality: true,
    defaultQuality: 'medium',
    engine: 'ffmpeg',
  },
  {
    id: 'mov',
    category: 'video',
    label: 'MOV',
    description: 'Contêiner H.264 para o ecossistema Apple',
    supportsQuality: true,
    defaultQuality: 'medium',
    engine: 'ffmpeg',
  },
  {
    id: 'mkv',
    category: 'video',
    label: 'MKV',
    description: 'Contêiner flexível (Matroska)',
    supportsQuality: true,
    defaultQuality: 'medium',
    engine: 'ffmpeg',
  },
  {
    id: 'webm',
    category: 'video',
    label: 'WEBM',
    description: 'VP9 + Opus, otimizado para a web',
    supportsQuality: true,
    defaultQuality: 'medium',
    engine: 'ffmpeg',
  },
  {
    id: 'jpg',
    category: 'image',
    label: 'JPG',
    description: 'Fotos e imagens comuns',
    supportsQuality: true,
    defaultQuality: 'medium',
    engine: 'sharp',
  },
  {
    id: 'png',
    category: 'image',
    label: 'PNG',
    description: 'Sem perdas, suporta transparência',
    supportsQuality: false,
    defaultQuality: 'medium',
    engine: 'sharp',
  },
  {
    id: 'webp',
    category: 'image',
    label: 'WEBP',
    description: 'Moderno e compacto',
    supportsQuality: true,
    defaultQuality: 'medium',
    engine: 'sharp',
  },
  {
    id: 'avif',
    category: 'image',
    label: 'AVIF',
    description: 'Muito compacto, mais lento para codificar',
    supportsQuality: true,
    defaultQuality: 'medium',
    engine: 'sharp',
  },
];

export const TARGET_FORMAT_MAP: Record<TargetFormat, FormatDescriptor> = Object.fromEntries(
  TARGET_FORMATS.map((f) => [f.id, f]),
) as Record<TargetFormat, FormatDescriptor>;

export const FORMATS_BY_CATEGORY: Record<MediaCategory, readonly FormatDescriptor[]> = {
  audio: TARGET_FORMATS.filter((f) => f.category === 'audio'),
  video: TARGET_FORMATS.filter((f) => f.category === 'video'),
  image: TARGET_FORMATS.filter((f) => f.category === 'image'),
};

export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  FFMPEG_NOT_FOUND:
    'Não foi possível iniciar o mecanismo de conversão. Reinstale o aplicativo e tente novamente.',
  INVALID_REQUEST: 'A solicitação é inválida. Verifique os arquivos e opções selecionados.',
  INVALID_PATH: 'Um dos caminhos de arquivo não é válido.',
  UNSUPPORTED_SOURCE:
    'Este formato de arquivo não é suportado. O formato de origem pode não ser reconhecido.',
  MISSING_FILE: 'Um dos arquivos não existe mais. Ele pode ter sido movido ou excluído.',
  OUTPUT_EXISTS:
    'Não foi possível criar um nome de saída exclusivo. O destino pode estar bloqueado.',
  NO_WRITE_PERMISSION: 'O aplicativo não tem permissão para gravar no destino.',
  OUTPUT_NOT_CREATED: 'A conversão terminou, mas o arquivo de saída não foi criado.',
  NO_AUDIO_STREAM: 'Este vídeo não possui uma faixa de áudio para extrair.',
  ENCODE_FAILED:
    'Não foi possível converter este arquivo. O formato de origem pode não ser suportado ou o arquivo pode estar corrompido.',
  JOB_CANCELLED: 'Conversão cancelada.',
  ENGINE_UNAVAILABLE: 'O mecanismo de conversão não está disponível neste sistema.',
  INTERNAL: 'Ocorreu um erro inesperado. Verifique os logs para mais detalhes.',
};

export function isextensionSupported(extension: string): MediaCategory | null {
  const ext = extension.toLowerCase().replace(/^\./, '');
  for (const category of Object.keys(CATEGORY_EXTENSIONS) as MediaCategory[]) {
    if (CATEGORY_EXTENSIONS[category].includes(ext)) return category;
  }
  return null;
}
