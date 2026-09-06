const SECTION_HEADING = /^## +(.+?) *$/;
const SUBSECTION_HEADING = /^### +/;
const DEPENDENCY_BULLET = /^- +Updated dependencies\b/;

export function readChangelogEntry(changelog, version) {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => {
    const heading = SECTION_HEADING.exec(line);

    return heading?.[1] === version;
  });

  if (start === -1) {
    return null;
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => SECTION_HEADING.test(line));
  const body = end === -1 ? rest : rest.slice(0, end);

  return body.join("\n").trim();
}

export function hasDirectChanges(entry) {
  if (!entry) {
    return false;
  }

  let insideDependencyBullet = false;

  for (const line of entry.split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "") {
      continue;
    }

    if (SUBSECTION_HEADING.test(trimmed)) {
      insideDependencyBullet = false;
      continue;
    }

    const indented = /^\s/.test(line);

    if (insideDependencyBullet && indented) {
      continue;
    }

    if (!indented && DEPENDENCY_BULLET.test(trimmed)) {
      insideDependencyBullet = true;
      continue;
    }

    return true;
  }

  return false;
}
