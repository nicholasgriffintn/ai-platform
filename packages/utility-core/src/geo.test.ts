import { describe, expect, it } from "vitest";

import { haversineKm, invertEqualEarth, projectEqualEarth, readCountryCode } from "./geo.js";
import { stripJpegMetadata } from "./jpeg.js";

describe("geo", () => {
  it("measures great-circle distance", () => {
    expect(haversineKm({ lat: 51.5074, lng: -0.1278 }, { lat: 40.7128, lng: -74.006 })).toBeCloseTo(
      5570,
      -1,
    );
  });

  it("inverts the Equal Earth projection so map clicks land where they were drawn", () => {
    for (const point of [
      { lat: 0, lng: 0 },
      { lat: 51.5, lng: -0.13 },
      { lat: -33.87, lng: 151.2 },
      { lat: 85, lng: -170 },
    ]) {
      const back = invertEqualEarth(projectEqualEarth(point));

      expect(back.lat).toBeCloseTo(point.lat, 6);
      expect(back.lng).toBeCloseTo(point.lng, 6);
    }
  });
});

describe("stripJpegMetadata", () => {
  it("drops EXIF and comment segments and keeps the image data", () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xe1, 0x00, 0x06, 0x47, 0x50, 0x53,
      0x21, 0xff, 0xfe, 0x00, 0x03, 0x58, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9,
    ]);

    expect([...stripJpegMetadata(jpeg)]).toEqual([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff,
      0xd9,
    ]);
  });

  it("refuses files that are not JPEGs or have broken segments", () => {
    expect(() => stripJpegMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow();
    expect(() => stripJpegMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00]))).toThrow();
  });
});

describe("readCountryCode", () => {
  it("accepts two-letter country codes and rejects unknown or malformed ones", () => {
    expect(["gb", " US ", "XX", "T1", "GBR", undefined].map(readCountryCode)).toEqual([
      "GB",
      "US",
      null,
      null,
      null,
      null,
    ]);
  });
});
