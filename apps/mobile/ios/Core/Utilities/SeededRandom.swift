import Foundation

struct SeededRandom {
    private var state: UInt32

    init(seed: String) {
        var hash: UInt32 = 2_166_136_261
        for unit in seed.utf16 {
            hash ^= UInt32(unit)
            hash = hash &* 16_777_619
        }
        state = hash == 0 ? 1 : hash
    }

    mutating func next() -> Double {
        state ^= state << 13
        state ^= state >> 17
        state ^= state << 5
        return Double(state) / 4_294_967_296
    }

    mutating func next(in range: ClosedRange<Double>) -> Double {
        range.lowerBound + next() * (range.upperBound - range.lowerBound)
    }
}
