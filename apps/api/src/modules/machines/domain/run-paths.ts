const MACHINE_RUN_REPORT_PATH = /^\/machines\/[^/]+\/runs\/(?:claim|update)$/u;

export function isMachineRunReportPath(pathname: string): boolean {
  return MACHINE_RUN_REPORT_PATH.test(pathname);
}
