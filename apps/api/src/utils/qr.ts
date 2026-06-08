import { bufferToBase64 } from "./base64";

interface QrVersionConfig {
	version: number;
	dataCodewords: number;
	eccCodewords: number;
	blockDataCodewords: readonly number[];
}

const QR_VERSION_CONFIGS: readonly QrVersionConfig[] = [
	{ version: 1, dataCodewords: 19, eccCodewords: 7, blockDataCodewords: [19] },
	{ version: 2, dataCodewords: 34, eccCodewords: 10, blockDataCodewords: [34] },
	{ version: 3, dataCodewords: 55, eccCodewords: 15, blockDataCodewords: [55] },
	{ version: 4, dataCodewords: 80, eccCodewords: 20, blockDataCodewords: [80] },
	{ version: 5, dataCodewords: 108, eccCodewords: 26, blockDataCodewords: [108] },
	{ version: 6, dataCodewords: 136, eccCodewords: 18, blockDataCodewords: [68, 68] },
	{ version: 7, dataCodewords: 156, eccCodewords: 20, blockDataCodewords: [78, 78] },
	{ version: 8, dataCodewords: 194, eccCodewords: 24, blockDataCodewords: [97, 97] },
	{ version: 9, dataCodewords: 232, eccCodewords: 30, blockDataCodewords: [116, 116] },
	{ version: 10, dataCodewords: 274, eccCodewords: 18, blockDataCodewords: [68, 68, 69, 69] },
];

const ALIGNMENT_PATTERN_POSITIONS: readonly (readonly number[])[] = [
	[],
	[6, 18],
	[6, 22],
	[6, 26],
	[6, 30],
	[6, 34],
	[6, 22, 38],
	[6, 24, 42],
	[6, 26, 46],
	[6, 28, 50],
];

const QR_MODE_BYTE = 0b0100;
const QR_ERROR_CORRECTION_LOW = 0b01;
const FORMAT_XOR_MASK = 0x5412;
const FORMAT_GENERATOR = 0x537;
const GF_GENERATOR = 0x11d;
const QR_QUIET_ZONE = 4;
export const MAX_QR_PAYLOAD_BYTES = 271;
export const DEFAULT_QR_SIZE = "300x300";
const QR_SIZE_PATTERN = /^([1-9]\d{1,3})x([1-9]\d{1,3})$/;
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_MAX_DEFLATE_BLOCK_BYTES = 0xffff;

export interface QrSize {
	height: number;
	label: string;
	width: number;
}

export interface FirstPartyQrPngRequest {
	payload: string;
	size: QrSize;
}

export function normaliseQrSize(value: unknown): QrSize {
	if (typeof value !== "string" || !value.trim()) {
		return { height: 300, label: DEFAULT_QR_SIZE, width: 300 };
	}

	const trimmed = value.trim().toLowerCase();
	const match = trimmed.match(QR_SIZE_PATTERN);
	if (!match) {
		return { height: 300, label: DEFAULT_QR_SIZE, width: 300 };
	}

	const width = Number.parseInt(match[1], 10);
	const height = Number.parseInt(match[2], 10);
	if (width > 1000 || height > 1000) {
		return { height: 300, label: DEFAULT_QR_SIZE, width: 300 };
	}

	return { height, label: `${width}x${height}`, width };
}

export function parseFirstPartyQrPngUrl(
	value: string,
	apiBaseUrl?: string,
): FirstPartyQrPngRequest | undefined {
	let url: URL;
	try {
		url = value.startsWith("/") ? new URL(value, "https://polychat.local") : new URL(value);
	} catch {
		return undefined;
	}

	const expectedUrl = apiBaseUrl
		? new URL("/qr", apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`)
		: undefined;
	const isRelativeQrUrl = value.startsWith("/") && url.pathname === "/qr";
	const isConfiguredApiQrUrl =
		expectedUrl && url.origin === expectedUrl.origin && url.pathname === expectedUrl.pathname;
	if (!isRelativeQrUrl && !isConfiguredApiQrUrl) {
		return undefined;
	}

	const format = url.searchParams.get("format");
	if (format && format !== "png") {
		return undefined;
	}

	const payload = url.searchParams.get("data");
	if (!payload) {
		return undefined;
	}

	try {
		assertQrPayloadByteLength(payload);
	} catch {
		return undefined;
	}

	return {
		payload,
		size: normaliseQrSize(url.searchParams.get("size")),
	};
}

export function assertQrPayloadByteLength(payload: string): number {
	const payloadBytes = new TextEncoder().encode(payload).length;
	if (payloadBytes > MAX_QR_PAYLOAD_BYTES) {
		throw new Error(`QR payloads are limited to ${MAX_QR_PAYLOAD_BYTES} UTF-8 bytes.`);
	}

	return payloadBytes;
}

class BitBuffer {
	private readonly bits: number[] = [];

	append(value: number, bitCount: number) {
		for (let shift = bitCount - 1; shift >= 0; shift -= 1) {
			this.bits.push((value >>> shift) & 1);
		}
	}

	get length(): number {
		return this.bits.length;
	}

	toCodewords(): number[] {
		const codewords: number[] = [];
		for (let index = 0; index < this.bits.length; index += 8) {
			let codeword = 0;
			for (let offset = 0; offset < 8; offset += 1) {
				codeword = (codeword << 1) | (this.bits[index + offset] ?? 0);
			}
			codewords.push(codeword);
		}
		return codewords;
	}
}

function makeGaloisTables() {
	const exp = new Array<number>(512).fill(0);
	const log = new Array<number>(256).fill(0);
	let value = 1;

	for (let index = 0; index < 255; index += 1) {
		exp[index] = value;
		log[value] = index;
		value <<= 1;
		if (value & 0x100) {
			value ^= GF_GENERATOR;
		}
	}

	for (let index = 255; index < exp.length; index += 1) {
		exp[index] = exp[index - 255];
	}

	return { exp, log };
}

const GF_TABLES = makeGaloisTables();

function gfMultiply(left: number, right: number): number {
	return left === 0 || right === 0 ? 0 : GF_TABLES.exp[GF_TABLES.log[left] + GF_TABLES.log[right]];
}

function makeGeneratorPolynomial(degree: number): number[] {
	let coefficients = [1];

	for (let index = 0; index < degree; index += 1) {
		const next = new Array<number>(coefficients.length + 1).fill(0);
		for (let coefficientIndex = 0; coefficientIndex < coefficients.length; coefficientIndex += 1) {
			next[coefficientIndex] ^= coefficients[coefficientIndex];
			next[coefficientIndex + 1] ^= gfMultiply(
				coefficients[coefficientIndex],
				GF_TABLES.exp[index],
			);
		}
		coefficients = next;
	}

	return coefficients;
}

function computeErrorCorrection(dataCodewords: readonly number[], degree: number): number[] {
	const generator = makeGeneratorPolynomial(degree);
	const remainder = [...dataCodewords, ...new Array<number>(degree).fill(0)];

	for (let index = 0; index < dataCodewords.length; index += 1) {
		const factor = remainder[index];
		if (factor === 0) {
			continue;
		}

		for (let offset = 0; offset < generator.length; offset += 1) {
			remainder[index + offset] ^= gfMultiply(generator[offset], factor);
		}
	}

	return remainder.slice(dataCodewords.length);
}

function selectVersion(payloadBytes: Uint8Array): QrVersionConfig | undefined {
	return QR_VERSION_CONFIGS.find((config) => {
		const characterCountBits = config.version < 10 ? 8 : 16;
		const requiredBits = 4 + characterCountBits + payloadBytes.length * 8;
		return requiredBits <= config.dataCodewords * 8;
	});
}

function buildDataCodewords(payloadBytes: Uint8Array, config: QrVersionConfig): number[] {
	const bits = new BitBuffer();
	const characterCountBits = config.version < 10 ? 8 : 16;
	bits.append(QR_MODE_BYTE, 4);
	bits.append(payloadBytes.length, characterCountBits);

	for (const byte of payloadBytes) {
		bits.append(byte, 8);
	}

	const totalBits = config.dataCodewords * 8;
	bits.append(0, Math.min(4, totalBits - bits.length));
	while (bits.length % 8 !== 0) {
		bits.append(0, 1);
	}

	const codewords = bits.toCodewords();
	for (let pad = 0xec; codewords.length < config.dataCodewords; pad ^= 0xec ^ 0x11) {
		codewords.push(pad);
	}

	return codewords;
}

function buildFinalCodewords(dataCodewords: readonly number[], config: QrVersionConfig): number[] {
	const blocks = config.blockDataCodewords.map((blockLength, blockIndex) => {
		const offset = config.blockDataCodewords
			.slice(0, blockIndex)
			.reduce((total, length) => total + length, 0);
		const data = dataCodewords.slice(offset, offset + blockLength);
		return {
			data,
			ecc: computeErrorCorrection(data, config.eccCodewords),
		};
	});

	const result: number[] = [];
	const maxDataLength = Math.max(...blocks.map((block) => block.data.length));
	for (let index = 0; index < maxDataLength; index += 1) {
		for (const block of blocks) {
			if (index < block.data.length) {
				result.push(block.data[index]);
			}
		}
	}

	for (let index = 0; index < config.eccCodewords; index += 1) {
		for (const block of blocks) {
			result.push(block.ecc[index]);
		}
	}

	return result;
}

function createMatrix(size: number): boolean[][] {
	return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

function createReservedMatrix(size: number): boolean[][] {
	return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

function setModule(
	matrix: boolean[][],
	reserved: boolean[][],
	row: number,
	column: number,
	dark: boolean,
) {
	if (row < 0 || column < 0 || row >= matrix.length || column >= matrix.length) {
		return;
	}
	matrix[row][column] = dark;
	reserved[row][column] = true;
}

function addFinderPattern(matrix: boolean[][], reserved: boolean[][], row: number, column: number) {
	for (let deltaRow = -1; deltaRow <= 7; deltaRow += 1) {
		for (let deltaColumn = -1; deltaColumn <= 7; deltaColumn += 1) {
			const patternRow = row + deltaRow;
			const patternColumn = column + deltaColumn;
			const inPattern = deltaRow >= 0 && deltaRow <= 6 && deltaColumn >= 0 && deltaColumn <= 6;
			const dark =
				inPattern &&
				(deltaRow === 0 ||
					deltaRow === 6 ||
					deltaColumn === 0 ||
					deltaColumn === 6 ||
					(deltaRow >= 2 && deltaRow <= 4 && deltaColumn >= 2 && deltaColumn <= 4));
			setModule(matrix, reserved, patternRow, patternColumn, dark);
		}
	}
}

function addAlignmentPattern(
	matrix: boolean[][],
	reserved: boolean[][],
	centerRow: number,
	centerColumn: number,
) {
	for (let deltaRow = -2; deltaRow <= 2; deltaRow += 1) {
		for (let deltaColumn = -2; deltaColumn <= 2; deltaColumn += 1) {
			const distance = Math.max(Math.abs(deltaRow), Math.abs(deltaColumn));
			setModule(matrix, reserved, centerRow + deltaRow, centerColumn + deltaColumn, distance !== 1);
		}
	}
}

function addFunctionPatterns(matrix: boolean[][], reserved: boolean[][], version: number) {
	const size = matrix.length;
	addFinderPattern(matrix, reserved, 0, 0);
	addFinderPattern(matrix, reserved, 0, size - 7);
	addFinderPattern(matrix, reserved, size - 7, 0);

	for (let index = 8; index < size - 8; index += 1) {
		const dark = index % 2 === 0;
		setModule(matrix, reserved, 6, index, dark);
		setModule(matrix, reserved, index, 6, dark);
	}

	for (const row of ALIGNMENT_PATTERN_POSITIONS[version - 1] ?? []) {
		for (const column of ALIGNMENT_PATTERN_POSITIONS[version - 1] ?? []) {
			const overlapsFinder =
				(row === 6 && (column === 6 || column === size - 7)) || (column === 6 && row === size - 7);
			if (!overlapsFinder) {
				addAlignmentPattern(matrix, reserved, row, column);
			}
		}
	}

	for (let index = 0; index < 9; index += 1) {
		if (index !== 6) {
			setModule(matrix, reserved, 8, index, false);
			setModule(matrix, reserved, index, 8, false);
		}
	}
	for (let index = 0; index < 8; index += 1) {
		setModule(matrix, reserved, size - 1 - index, 8, false);
		setModule(matrix, reserved, 8, size - 1 - index, false);
	}

	setModule(matrix, reserved, 4 * version + 9, 8, true);
}

function placeCodewords(matrix: boolean[][], reserved: boolean[][], codewords: readonly number[]) {
	const bits = codewords.flatMap((codeword) =>
		Array.from({ length: 8 }, (_, index) => (codeword >>> (7 - index)) & 1),
	);
	const size = matrix.length;
	let bitIndex = 0;
	let upward = true;

	for (let right = size - 1; right >= 1; right -= 2) {
		if (right === 6) {
			right -= 1;
		}

		for (let vertical = 0; vertical < size; vertical += 1) {
			const row = upward ? size - 1 - vertical : vertical;
			for (let columnOffset = 0; columnOffset < 2; columnOffset += 1) {
				const column = right - columnOffset;
				if (!reserved[row][column]) {
					matrix[row][column] = (bits[bitIndex] ?? 0) === 1;
					bitIndex += 1;
				}
			}
		}

		upward = !upward;
	}
}

function getMaskBit(mask: number, row: number, column: number): boolean {
	switch (mask) {
		case 0:
			return (row + column) % 2 === 0;
		case 1:
			return row % 2 === 0;
		case 2:
			return column % 3 === 0;
		case 3:
			return (row + column) % 3 === 0;
		case 4:
			return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
		case 5:
			return ((row * column) % 2) + ((row * column) % 3) === 0;
		case 6:
			return (((row * column) % 2) + ((row * column) % 3)) % 2 === 0;
		default:
			return (((row + column) % 2) + ((row * column) % 3)) % 2 === 0;
	}
}

function applyMask(matrix: boolean[][], reserved: boolean[][], mask: number): boolean[][] {
	return matrix.map((row, rowIndex) =>
		row.map((dark, columnIndex) =>
			!reserved[rowIndex][columnIndex] && getMaskBit(mask, rowIndex, columnIndex) ? !dark : dark,
		),
	);
}

function scoreAdjacentRuns(matrix: boolean[][]): number {
	let penalty = 0;
	for (const row of matrix) {
		let runColor = row[0];
		let runLength = 1;
		for (let column = 1; column < row.length; column += 1) {
			if (row[column] === runColor) {
				runLength += 1;
				continue;
			}
			if (runLength >= 5) {
				penalty += 3 + runLength - 5;
			}
			runColor = row[column];
			runLength = 1;
		}
		if (runLength >= 5) {
			penalty += 3 + runLength - 5;
		}
	}

	return penalty;
}

function transposeMatrix(matrix: boolean[][]): boolean[][] {
	return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function scoreQrMatrix(matrix: boolean[][]): number {
	let penalty = scoreAdjacentRuns(matrix) + scoreAdjacentRuns(transposeMatrix(matrix));
	const size = matrix.length;

	for (let row = 0; row < size - 1; row += 1) {
		for (let column = 0; column < size - 1; column += 1) {
			const color = matrix[row][column];
			if (
				matrix[row][column + 1] === color &&
				matrix[row + 1][column] === color &&
				matrix[row + 1][column + 1] === color
			) {
				penalty += 3;
			}
		}
	}

	let darkCount = 0;
	for (const row of matrix) {
		for (const dark of row) {
			if (dark) {
				darkCount += 1;
			}
		}
	}
	const percent = (darkCount * 100) / (size * size);
	penalty += Math.floor(Math.abs(percent - 50) / 5) * 10;

	return penalty;
}

function getFormatBits(mask: number): number {
	const data = (QR_ERROR_CORRECTION_LOW << 3) | mask;
	let bits = data << 10;
	for (let bit = 14; bit >= 10; bit -= 1) {
		if (((bits >>> bit) & 1) !== 0) {
			bits ^= FORMAT_GENERATOR << (bit - 10);
		}
	}

	return (((data << 10) | bits) ^ FORMAT_XOR_MASK) & 0x7fff;
}

function getBit(value: number, index: number): boolean {
	return ((value >>> index) & 1) !== 0;
}

function addFormatBits(matrix: boolean[][], reserved: boolean[][], mask: number) {
	const size = matrix.length;
	const bits = getFormatBits(mask);

	for (let index = 0; index <= 5; index += 1) {
		setModule(matrix, reserved, 8, index, getBit(bits, index));
	}
	setModule(matrix, reserved, 8, 7, getBit(bits, 6));
	setModule(matrix, reserved, 8, 8, getBit(bits, 7));
	setModule(matrix, reserved, 7, 8, getBit(bits, 8));
	for (let index = 9; index < 15; index += 1) {
		setModule(matrix, reserved, 14 - index, 8, getBit(bits, index));
	}

	for (let index = 0; index < 8; index += 1) {
		setModule(matrix, reserved, size - 1 - index, 8, getBit(bits, index));
	}
	for (let index = 8; index < 15; index += 1) {
		setModule(matrix, reserved, 8, size - 15 + index, getBit(bits, index));
	}
	setModule(matrix, reserved, size - 8, 8, true);
}

function createQrMatrix(payload: string): boolean[][] {
	const payloadBytes = new TextEncoder().encode(payload);
	const config = selectVersion(payloadBytes);
	if (!config) {
		throw new Error("QR payload is too long for the first-party encoder");
	}

	const size = 21 + (config.version - 1) * 4;
	const matrix = createMatrix(size);
	const reserved = createReservedMatrix(size);
	addFunctionPatterns(matrix, reserved, config.version);
	placeCodewords(
		matrix,
		reserved,
		buildFinalCodewords(buildDataCodewords(payloadBytes, config), config),
	);

	let bestMask = 0;
	let bestMatrix = applyMask(matrix, reserved, 0);
	let bestScore = scoreQrMatrix(bestMatrix);
	for (let mask = 1; mask < 8; mask += 1) {
		const candidate = applyMask(matrix, reserved, mask);
		const score = scoreQrMatrix(candidate);
		if (score < bestScore) {
			bestMask = mask;
			bestMatrix = candidate;
			bestScore = score;
		}
	}

	const finalReserved = createReservedMatrix(size);
	addFormatBits(bestMatrix, finalReserved, bestMask);
	return bestMatrix;
}

function renderQrSvg(
	matrix: readonly (readonly boolean[])[],
	width: number,
	height: number,
): string {
	const viewBoxSize = matrix.length + QR_QUIET_ZONE * 2;
	const path = matrix
		.flatMap((row, rowIndex) =>
			row.map((dark, columnIndex) =>
				dark ? `M${columnIndex + QR_QUIET_ZONE} ${rowIndex + QR_QUIET_ZONE}h1v1h-1z` : "",
			),
		)
		.join("");

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${viewBoxSize}v${viewBoxSize}H0z"/><path fill="#000" d="${path}"/></svg>`;
}

function qrPixelValue(
	matrix: readonly (readonly boolean[])[],
	x: number,
	y: number,
	width: number,
	height: number,
) {
	const viewBoxSize = matrix.length + QR_QUIET_ZONE * 2;
	const viewBoxX = Math.floor((x * viewBoxSize) / width);
	const viewBoxY = Math.floor((y * viewBoxSize) / height);
	const moduleX = viewBoxX - QR_QUIET_ZONE;
	const moduleY = viewBoxY - QR_QUIET_ZONE;
	return moduleX >= 0 &&
		moduleY >= 0 &&
		moduleX < matrix.length &&
		moduleY < matrix.length &&
		matrix[moduleY][moduleX]
		? 0
		: 255;
}

function createQrGrayscaleScanlines(
	matrix: readonly (readonly boolean[])[],
	width: number,
	height: number,
): Uint8Array {
	const scanlines = new Uint8Array((width + 1) * height);
	for (let y = 0; y < height; y += 1) {
		const rowOffset = y * (width + 1);
		scanlines[rowOffset] = 0;
		for (let x = 0; x < width; x += 1) {
			scanlines[rowOffset + x + 1] = qrPixelValue(matrix, x, y, width, height);
		}
	}
	return scanlines;
}

function writeUint32(value: number): Uint8Array {
	return new Uint8Array([
		(value >>> 24) & 0xff,
		(value >>> 16) & 0xff,
		(value >>> 8) & 0xff,
		value & 0xff,
	]);
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
	const length = parts.reduce((total, part) => total + part.length, 0);
	const result = new Uint8Array(length);
	let offset = 0;
	for (const part of parts) {
		result.set(part, offset);
		offset += part.length;
	}
	return result;
}

function makeCrcTable(): Uint32Array {
	const table = new Uint32Array(256);
	for (let index = 0; index < table.length; index += 1) {
		let value = index;
		for (let bit = 0; bit < 8; bit += 1) {
			value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		table[index] = value >>> 0;
	}
	return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
	let a = 1;
	let b = 0;
	for (const byte of bytes) {
		a = (a + byte) % 65521;
		b = (b + a) % 65521;
	}
	return ((b << 16) | a) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
	const typeBytes = new TextEncoder().encode(type);
	const payload = concatBytes([typeBytes, data]);
	return concatBytes([writeUint32(data.length), payload, writeUint32(crc32(payload))]);
}

function zlibStore(bytes: Uint8Array): Uint8Array {
	const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
	for (let offset = 0; offset < bytes.length; offset += PNG_MAX_DEFLATE_BLOCK_BYTES) {
		const chunk = bytes.subarray(offset, offset + PNG_MAX_DEFLATE_BLOCK_BYTES);
		const finalBlock = offset + PNG_MAX_DEFLATE_BLOCK_BYTES >= bytes.length;
		const length = chunk.length;
		blocks.push(
			new Uint8Array([
				finalBlock ? 0x01 : 0x00,
				length & 0xff,
				(length >>> 8) & 0xff,
				~length & 0xff,
				(~length >>> 8) & 0xff,
			]),
			chunk,
		);
	}
	blocks.push(writeUint32(adler32(bytes)));
	return concatBytes(blocks);
}

export function createQrSvg(payload: string, width: number, height: number): string {
	return renderQrSvg(createQrMatrix(payload), width, height);
}

export function createQrPng(payload: string, width: number, height: number): Uint8Array {
	const matrix = createQrMatrix(payload);
	const header = new Uint8Array(13);
	header.set(writeUint32(width), 0);
	header.set(writeUint32(height), 4);
	header[8] = 8;
	header[9] = 0;
	header[10] = 0;
	header[11] = 0;
	header[12] = 0;

	return concatBytes([
		PNG_SIGNATURE,
		pngChunk("IHDR", header),
		pngChunk("IDAT", zlibStore(createQrGrayscaleScanlines(matrix, width, height))),
		pngChunk("IEND", new Uint8Array()),
	]);
}

export function createQrSvgDataUrl(payload: string, width: number, height: number): string {
	const svg = createQrSvg(payload, width, height);
	return `data:image/svg+xml;base64,${bufferToBase64(new TextEncoder().encode(svg))}`;
}

export function createQrPngDataUrl(payload: string, width: number, height: number): string {
	return `data:image/png;base64,${bufferToBase64(createQrPng(payload, width, height))}`;
}
