import { spawnSync } from "node:child_process";
import path from "node:path";

const [binary, ...args] = process.argv.slice(2);

if (!binary) {
  throw new Error("Cargo did not provide a desktop executable.");
}

if (path.basename(binary) === "polychat-desktop") {
  let identity = process.env.APPLE_SIGNING_IDENTITY;

  if (!identity) {
    const result = spawnSync("security", ["find-identity", "-v", "-p", "codesigning"], {
      encoding: "utf8",
    });
    const identities = [
      ...(result.stdout ?? "").matchAll(/\b([A-F0-9]{40}) "Apple Development:[^"]+"/g),
    ];

    if (identities.length === 1) {
      identity = identities[0][1];
    }
  }

  if (identity && identity !== "-") {
    const signed = spawnSync(
      "codesign",
      [
        "--force",
        "--sign",
        identity,
        "--identifier",
        "uk.co.nicholasgriffin.polychat.desktop",
        binary,
      ],
      { stdio: "inherit" },
    );

    if (signed.status !== 0) {
      throw new Error("Desktop development signing failed.");
    }
  } else {
    process.stderr.write(
      "Set APPLE_SIGNING_IDENTITY to a development certificate to retain Keychain access across rebuilds.\n",
    );
  }
}

process.execve(path.resolve(binary), [binary, ...args], process.env);
