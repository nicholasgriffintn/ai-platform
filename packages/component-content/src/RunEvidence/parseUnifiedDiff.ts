export type DiffFileStatus = "added" | "modified" | "deleted" | "renamed";

export interface DiffHunk {
  header: string;
  lines: string[];
}

export interface DiffFile {
  oldPath?: string;
  path: string;
  status: DiffFileStatus;
  additions: number;
  deletions: number;
  binary: boolean;
  hunks: DiffHunk[];
}

export interface DiffLineGroup {
  kind: "changed" | "context";
  startIndex: number;
  lines: string[];
}

export function groupDiffHunkLines(lines: string[]): DiffLineGroup[] {
  const groups: DiffLineGroup[] = [];

  for (const [index, line] of lines.entries()) {
    const kind = line.startsWith("+") || line.startsWith("-") ? "changed" : "context";
    const previous = groups.at(-1);

    if (previous?.kind === kind) {
      previous.lines.push(line);
    } else {
      groups.push({ kind, startIndex: index, lines: [line] });
    }
  }

  return groups;
}

function cleanPath(value: string): string {
  const withoutTimestamp = value.split("\t")[0]?.trim() ?? value.trim();
  const unquoted = withoutTimestamp.replace(/^"|"$/g, "");

  if (unquoted === "/dev/null") {
    return "";
  }

  return unquoted.replace(/^[ab]\//, "");
}

function readDiffHeader(line: string): { oldPath: string; path: string } | null {
  const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);

  return match ? { oldPath: cleanPath(match[1] ?? ""), path: cleanPath(match[2] ?? "") } : null;
}

function reviewPriority(file: DiffFile): number {
  const path = file.path.toLowerCase();

  if (
    path.includes("/schema") ||
    path.startsWith("schema") ||
    /(^|\/)(package\.json|[^/]*config[^/]*|[^/]*\.config\.[^/]+)$/.test(path) ||
    path.includes("migration")
  ) {
    return 0;
  }

  if (/(^|\/)(__tests__|tests?|specs?)(\/|\.|$)|\.(test|spec)\.[^/]+$/.test(path)) {
    return 2;
  }

  return 1;
}

export function orderDiffFilesForReview(files: DiffFile[]): DiffFile[] {
  const ordered: DiffFile[] = [];

  for (const file of files) {
    const insertionIndex = ordered.findIndex(
      (candidate) =>
        reviewPriority(file) - reviewPriority(candidate) < 0 ||
        (reviewPriority(file) === reviewPriority(candidate) &&
          file.path.localeCompare(candidate.path) < 0),
    );

    if (insertionIndex === -1) {
      ordered.push(file);
    } else {
      ordered.splice(insertionIndex, 0, file);
    }
  }

  return ordered;
}

export function parseUnifiedDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | undefined;
  let currentHunk: DiffHunk | undefined;

  const pushCurrent = () => {
    if (current) {
      files.push(current);
    }
  };

  for (const line of diff.split("\n")) {
    const header = readDiffHeader(line);

    if (header) {
      pushCurrent();
      current = {
        ...header,
        status: "modified",
        additions: 0,
        deletions: 0,
        binary: false,
        hunks: [],
      };
      currentHunk = undefined;
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("new file mode ")) {
      current.status = "added";
      continue;
    }

    if (line.startsWith("deleted file mode ")) {
      current.status = "deleted";
      continue;
    }

    if (line.startsWith("rename from ")) {
      current.status = "renamed";
      current.oldPath = cleanPath(line.slice("rename from ".length));
      continue;
    }

    if (line.startsWith("rename to ")) {
      current.status = "renamed";
      current.path = cleanPath(line.slice("rename to ".length));
      continue;
    }

    if (line.startsWith("Binary files ") || line === "GIT binary patch") {
      current.binary = true;
      continue;
    }

    if (line.startsWith("--- ")) {
      const oldPath = cleanPath(line.slice(4));

      if (oldPath) {
        current.oldPath = oldPath;
      }

      continue;
    }

    if (line.startsWith("+++ ")) {
      const path = cleanPath(line.slice(4));

      if (path) {
        current.path = path;
      }

      continue;
    }

    if (line.startsWith("@@")) {
      currentHunk = { header: line, lines: [] };
      current.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    currentHunk.lines.push(line);

    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.additions += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      current.deletions += 1;
    }
  }

  pushCurrent();

  return orderDiffFilesForReview(files);
}
