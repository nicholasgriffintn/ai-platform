import Foundation

struct PerchEngine {
    enum Beat: Equatable {
        case milestone(Int)
        case settled(turns: Double)
    }

    static let longSpinTurns = 3.0

    private static let spinningSpeed = 0.08
    private static let dizzySpeed = 1.6
    private static let inputHoldSeconds = 0.08
    private static let reactionSeconds = 1.6

    private(set) var heading = 0.0
    private(set) var speed = 0.0
    private(set) var totalTurns = 0.0
    private(set) var longestSpin = 0.0

    private let friction: Double
    private let milestoneEvery: Int
    private var spinTurns = 0.0
    private var lastInput: TimeInterval?
    private var lastFrame: TimeInterval?
    private var reaction: (clip: PetClipName, until: TimeInterval)?

    init(feel: CrownFeel, milestoneEvery: Int = 0) {
        friction = feel.friction
        self.milestoneEvery = milestoneEvery
    }

    var isMoving: Bool { speed != 0 }

    mutating func turn(by turns: Double, at time: TimeInterval) -> [Beat] {
        guard turns != 0 else { return [] }

        let elapsed = max(time - (lastInput ?? time - 1.0 / 30), 1.0 / 60)
        speed = speed * 0.6 + (turns / elapsed) * 0.4
        heading += turns
        spinTurns += abs(turns)
        longestSpin = max(longestSpin, spinTurns)
        lastInput = time
        lastFrame = time

        let before = Int(totalTurns)
        totalTurns += abs(turns)

        guard milestoneEvery > 0 else { return [] }
        let reached = Int(totalTurns) / milestoneEvery
        return reached > before / milestoneEvery ? [.milestone(reached * milestoneEvery)] : []
    }

    mutating func coast(at time: TimeInterval) -> [Beat] {
        defer { lastFrame = time }
        guard speed != 0, let lastFrame else { return [] }
        if let lastInput, time - lastInput < Self.inputHoldSeconds { return [] }

        let elapsed = time - lastFrame
        heading += speed * elapsed
        speed *= exp(-friction * elapsed)

        guard abs(speed) < Self.spinningSpeed else { return [] }

        let turns = spinTurns
        speed = 0
        spinTurns = 0
        if turns >= Self.longSpinTurns {
            reaction = (.cheer, time + Self.reactionSeconds)
        }
        return [.settled(turns: turns)]
    }

    mutating func poke(at time: TimeInterval) {
        reaction = (.greet, time + Self.reactionSeconds)
    }

    mutating func cheer(at time: TimeInterval) {
        reaction = (.cheer, time + Self.reactionSeconds)
    }

    func clip(resting: PetClipName, at time: TimeInterval) -> PetClipName {
        if abs(speed) >= Self.dizzySpeed { return .fret }
        if abs(speed) >= Self.spinningSpeed { return .flit }
        if let reaction, time < reaction.until { return reaction.clip }
        return resting
    }
}

struct WindGate {
    static let releaseRate = 0.35

    let required: Double
    private(set) var wound = 0.0
    private(set) var isComplete = false

    init(required: Double = 1) {
        self.required = required
    }

    var progress: Double { min(wound / required, 1) }

    mutating func wind(by turns: Double) -> Bool {
        guard !isComplete else { return false }

        wound = max(wound + turns, 0)
        isComplete = wound >= required
        return isComplete
    }

    mutating func relax(for seconds: TimeInterval) {
        guard !isComplete else { return }
        wound = max(wound - Self.releaseRate * seconds, 0)
    }
}
