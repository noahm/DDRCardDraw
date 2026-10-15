/**
 * Adapts a folder chosen through `<input type="file" webkitdirectory>` into
 * something `simfile-parser`'s `parsePack` can walk.
 *
 * It can't consume the input directly: `parsePack` reads `input.webkitEntries`,
 * which browsers only populate when files are *dropped* onto an input, not when
 * they're picked through the dialog. What the picker does give us is a flat
 * `FileList` where each `File` carries its path in `webkitRelativePath`, so we
 * rebuild the directory tree from those paths and expose it through the same
 * File System Access shape (`kind`/`values()`/`getFile()`) the parser already
 * handles for dropped folders.
 *
 * `showDirectoryPicker()` would hand back a real handle and skip all of this,
 * but it's Chromium-only; `webkitdirectory` works everywhere.
 */

interface FileHandleLike {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}

interface DirHandleLike {
  kind: "directory";
  name: string;
  values(): AsyncIterableIterator<DirHandleLike | FileHandleLike>;
  getFileHandle(name: string): Promise<FileHandleLike>;
}

interface DirNode {
  name: string;
  dirs: Map<string, DirNode>;
  files: Map<string, File>;
}

function emptyDir(name: string): DirNode {
  return { name, dirs: new Map(), files: new Map() };
}

function fileHandle(name: string, file: File): FileHandleLike {
  return { kind: "file", name, getFile: () => Promise.resolve(file) };
}

function dirHandle(node: DirNode): DirHandleLike {
  return {
    kind: "directory",
    name: node.name,
    async *values() {
      for (const child of node.dirs.values()) {
        yield dirHandle(child);
      }
      for (const [name, file] of node.files) {
        yield fileHandle(name, file);
      }
    },
    getFileHandle(name) {
      const file = node.files.get(name);
      // Matches what the real API does for a missing file, which callers in the
      // parser already treat as "this image isn't here".
      return file
        ? Promise.resolve(fileHandle(name, file))
        : Promise.reject(new Error(`${name} not found`));
    },
  };
}

/**
 * Rebuild the picked folder from the flat file list, and wrap it so it looks
 * like a dropped item to `parsePack`.
 *
 * @param files the input's `files`, each with a `webkitRelativePath`
 * @returns a stand-in `DataTransferItem`, or null if nothing usable was picked
 */
export function pickedFolderAsDropItem(
  files: FileList | null,
): DataTransferItem | null {
  if (!files?.length) return null;

  // Every path starts with the folder the user picked, which becomes the root.
  const root = emptyDir(
    files[0].webkitRelativePath.split("/")[0] || "Imported Pack",
  );
  for (const file of files) {
    const segments = file.webkitRelativePath.split("/");
    // first segment is the root, last is the file itself
    let dir = root;
    for (const segment of segments.slice(1, -1)) {
      let child = dir.dirs.get(segment);
      if (!child) {
        child = emptyDir(segment);
        dir.dirs.set(segment, child);
      }
      dir = child;
    }
    dir.files.set(segments[segments.length - 1], file);
  }

  const handle = dirHandle(root);
  return {
    kind: "file",
    getAsFileSystemHandle: () => Promise.resolve(handle),
  } as unknown as DataTransferItem;
}
