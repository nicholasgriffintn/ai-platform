import { expect, it } from "vitest";

import { listeningPortsFromProcNet } from "../network-ports";

it("finds IPv4 and IPv6 listeners without treating established sockets as port reservations", () => {
  expect(
    listeningPortsFromProcNet(
      [
        "sl local_address rem_address st tx_queue rx_queue",
        "0: 00000000:0FA0 00000000:0000 0A 00000000:00000000",
        "1: 0100007F:CAFE 0100007F:01BB 01 00000000:00000000",
        "0: 00000000000000000000000000000000:1F90 00000000000000000000000000000000:0000 0A 00000000:00000000",
        "1: 00000000000000000000000000000000:0FA0 00000000000000000000000000000000:0000 0A 00000000:00000000",
      ].join("\n"),
    ),
  ).toEqual(new Set([4000, 8080]));
});
