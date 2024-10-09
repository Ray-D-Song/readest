import {
  exists,
  mkdir,
  readTextFile,
  readFile,
  writeTextFile,
  writeFile,
  readDir,
  remove,
  copyFile,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open, message } from '@tauri-apps/plugin-dialog';
import { join, documentDir, appDataDir } from '@tauri-apps/api/path';
import { type as osType } from '@tauri-apps/plugin-os';

import { Book } from '@/types/book';
import { ToastType, FileSystem, BaseDir } from '@/types/system';
import { getCoverFilename } from '@/utils/book';

import { BaseAppService } from './appService';
import { LOCAL_BOOKS_SUBDIR } from './constants';

export const isMobile = ['android', 'ios'].includes(osType());

export const resolvePath = (
  fp: string,
  base: BaseDir,
): { baseDir: number; base: BaseDir; fp: string } => {
  switch (base) {
    case 'Settings':
      return { baseDir: BaseDirectory.AppConfig, fp, base };
    case 'Data':
      return { baseDir: BaseDirectory.AppData, fp, base };
    case 'Cache':
      return { baseDir: BaseDirectory.AppCache, fp, base };
    case 'Log':
      return { baseDir: BaseDirectory.AppLog, fp, base };
    case 'Books':
      return {
        baseDir: isMobile ? BaseDirectory.AppData : BaseDirectory.Document,
        fp: `${LOCAL_BOOKS_SUBDIR}/${fp}`,
        base,
      };
    default:
      return {
        baseDir: BaseDirectory.Temp,
        fp,
        base,
      };
  }
};

export const nativeFileSystem: FileSystem = {
  getURL(path: string) {
    return convertFileSrc(path);
  },
  async copyFile(srcPath: string, dstPath: string, base: BaseDir) {
    const { fp, baseDir } = resolvePath(dstPath, base);
    await copyFile(srcPath, fp, base && { toPathBaseDir: baseDir });
  },
  async readFile(path: string, base: BaseDir, mode: 'text' | 'binary') {
    const { fp, baseDir } = resolvePath(path, base);

    return mode === 'text'
      ? (readTextFile(fp, base && { baseDir }) as Promise<string>)
      : ((await readFile(fp, base && { baseDir })).buffer as ArrayBuffer);
  },
  async writeFile(path: string, base: BaseDir, content: string | ArrayBuffer) {
    const { fp, baseDir } = resolvePath(path, base);

    return typeof content === 'string'
      ? writeTextFile(fp, content, base && { baseDir })
      : writeFile(fp, new Uint8Array(content), base && { baseDir });
  },
  async removeFile(path: string, base: BaseDir) {
    const { fp, baseDir } = resolvePath(path, base);

    return remove(fp, base && { baseDir });
  },
  async createDir(path: string, base: BaseDir, recursive = false) {
    const { fp, baseDir } = resolvePath(path, base);

    await mkdir(fp, base && { baseDir, recursive });
  },
  async removeDir(path: string, base: BaseDir, recursive = false) {
    const { fp, baseDir } = resolvePath(path, base);

    await remove(fp, base && { baseDir, recursive });
  },
  async readDir(path: string, base: BaseDir) {
    const { fp, baseDir } = resolvePath(path, base);

    const list = await readDir(fp, base && { baseDir });
    return list.map((entity) => {
      return {
        path: entity.name,
        isDir: entity.isDirectory,
      };
    });
  },
  async exists(path: string, base: BaseDir) {
    const { fp, baseDir } = resolvePath(path, base);

    try {
      const res = await exists(fp, base && { baseDir });
      return res;
    } catch {
      return false;
    }
  },
};

export class NativeAppService extends BaseAppService {
  fs = nativeFileSystem;
  isAppDataSandbox = isMobile;

  resolvePath(fp: string, base: BaseDir): { baseDir: number; base: BaseDir; fp: string } {
    switch (base) {
      case 'Settings':
        return { baseDir: BaseDirectory.AppConfig, fp, base };
      case 'Data':
        return { baseDir: BaseDirectory.AppData, fp, base };
      case 'Cache':
        return { baseDir: BaseDirectory.AppCache, fp, base };
      case 'Log':
        return { baseDir: BaseDirectory.AppLog, fp, base };
      case 'Books':
        return {
          baseDir: BaseDirectory.Document,
          fp: `${LOCAL_BOOKS_SUBDIR}/${fp}`,
          base,
        };
      default:
        return {
          baseDir: BaseDirectory.Temp,
          fp,
          base,
        };
    }
  }

  async getInitBooksDir(): Promise<string> {
    return join(appDataDir ? await appDataDir() : await documentDir(), LOCAL_BOOKS_SUBDIR);
  }

  async selectDirectory(title: string): Promise<string> {
    const selected = await open({
      title,
      directory: true,
    });
    return selected as string;
  }

  async selectFiles(name: string, extensions: string[]): Promise<string[]> {
    const selected = await open({
      multiple: true,
      filters: [{ name, extensions }],
    });
    return Array.isArray(selected) ? selected : selected ? [selected] : [];
  }

  async showMessage(
    msg: string,
    kind: ToastType = 'info',
    title?: string,
    okLabel?: string,
  ): Promise<void> {
    await message(msg, { kind, title, okLabel });
  }

  getCoverImageUrl = (book: Book): string => {
    return this.fs.getURL(`${this.localBooksDir}/${getCoverFilename(book)}`);
  };
}