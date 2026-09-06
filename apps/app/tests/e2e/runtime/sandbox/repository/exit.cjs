const exitCode = Number.parseInt(process.argv[2] ?? "0", 10);

setTimeout(() => process.exit(exitCode), 500);
