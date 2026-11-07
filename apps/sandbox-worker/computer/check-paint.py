#!/usr/bin/env python3
"""Score a PNG screenshot for visible content.

Prints the mean pixel brightness (0-255). A fresh X framebuffer scores near
0; a painted page scores well above that. Scoring stops once the frame has
cleared the paint threshold, so a painted frame prints a lower bound on its
mean. Any failure prints 0 so callers treat unreadable captures as blank.
Standard library only.
"""

import struct
import sys
import zlib

PAINT_BRIGHTNESS_THRESHOLD = 6.0


def read_chunks(path):
    with open(path, "rb") as handle:
        data = handle.read()

    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a png")

    pos = 8
    width = height = 0
    bit_depth = color_type = 0
    compressed = bytearray()

    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        chunk_type = data[pos + 4 : pos + 8]
        chunk_data = data[pos + 8 : pos + 8 + length]

        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type, _, _, _ = struct.unpack(
                ">IIBBBBB", chunk_data
            )
        elif chunk_type == b"IDAT":
            compressed += chunk_data
        elif chunk_type == b"IEND":
            break

        pos += 12 + length

    return width, height, bit_depth, color_type, bytes(compressed)


def unfiltered_rows(width, height, channels, raw):
    stride = width * channels
    previous = bytearray(stride)

    for row in range(height):
        offset = row * (stride + 1)
        filter_type = raw[offset]
        current = bytearray(raw[offset + 1 : offset + 1 + stride])

        if filter_type == 1:
            for i in range(channels, stride):
                current[i] = (current[i] + current[i - channels]) & 0xFF
        elif filter_type == 2:
            for i in range(stride):
                current[i] = (current[i] + previous[i]) & 0xFF
        elif filter_type == 3:
            for i in range(stride):
                above = previous[i]
                left = current[i - channels] if i >= channels else 0
                current[i] = (current[i] + ((left + above) >> 1)) & 0xFF
        elif filter_type == 4:
            for i in range(stride):
                left = current[i - channels] if i >= channels else 0
                above = previous[i]
                upper_left = previous[i - channels] if i >= channels else 0
                left_distance = abs(above - upper_left)
                above_distance = abs(left - upper_left)
                corner_distance = abs(left + above - 2 * upper_left)

                if left_distance <= above_distance and left_distance <= corner_distance:
                    predictor = left
                elif above_distance <= corner_distance:
                    predictor = above
                else:
                    predictor = upper_left

                current[i] = (current[i] + predictor) & 0xFF

        yield row, current
        previous = current


def main():
    try:
        width, height, bit_depth, color_type, compressed = read_chunks(sys.argv[1])

        if bit_depth != 8 or color_type not in (2, 6) or width <= 0 or height <= 0:
            print("0")
            return

        channels = 3 if color_type == 2 else 4
        step = max(1, height // 200)
        columns = range(0, width * channels, channels * 7)
        count = len(range(0, height, step)) * len(columns) * 3
        total = 0

        for row, pixels in unfiltered_rows(width, height, channels, zlib.decompress(compressed)):
            if row % step:
                continue

            for col in columns:
                total += pixels[col] + pixels[col + 1] + pixels[col + 2]

            if total >= PAINT_BRIGHTNESS_THRESHOLD * count:
                break

        print(f"{total / max(1, count):.1f}")
    except Exception:
        print("0")


if __name__ == "__main__":
    main()
