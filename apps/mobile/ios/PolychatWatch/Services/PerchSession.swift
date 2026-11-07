import Foundation
import WatchKit

@MainActor
final class PerchSession: ObservableObject {
    private static let nudgeTurns = 0.05

    @Published private(set) var engine = PerchEngine(feel: .steady)
    @Published private(set) var now = Date().timeIntervalSinceReferenceDate

    private var loop = CrownLoop(length: Double(CrownFeel.steady.ticksPerLoop))
    private var carriedTurns = 0.0
    private var carriedLongest = 0.0
    private var recordedTurns = 0.0

    var frameInterval: Duration { engine.isMoving ? .milliseconds(50) : .milliseconds(200) }

    var turns: Double { carriedTurns + engine.totalTurns }

    func configure(feel: CrownFeel, milestoneEvery: Int) {
        carriedTurns += engine.totalTurns
        carriedLongest = max(carriedLongest, engine.longestSpin)
        engine = PerchEngine(feel: feel, milestoneEvery: milestoneEvery)
        loop = CrownLoop(length: Double(feel.ticksPerLoop))
    }

    func crown(offset: Double) {
        turn(by: loop.turns(to: offset))
    }

    func turn(by turns: Double) {
        play(engine.turn(by: turns, at: tick()))
    }

    func frame() {
        play(engine.coast(at: tick()))
    }

    func poke() {
        engine.poke(at: tick())
        WKInterfaceDevice.current().play(.click)
    }

    func cheer() {
        engine.cheer(at: tick())
        WKInterfaceDevice.current().play(.success)
    }

    func drain() -> (turns: Double, longestSpin: Double) {
        defer { recordedTurns = turns }
        return (turns - recordedTurns, max(carriedLongest, engine.longestSpin))
    }

    private func tick() -> TimeInterval {
        now = Date().timeIntervalSinceReferenceDate
        return now
    }

    private func play(_ beats: [PerchEngine.Beat]) {
        for beat in beats {
            switch beat {
            case .milestone:
                WKInterfaceDevice.current().play(.directionUp)
            case .settled(let turns) where turns >= PerchEngine.longSpinTurns:
                WKInterfaceDevice.current().play(.success)
            case .settled(let turns) where turns >= Self.nudgeTurns:
                WKInterfaceDevice.current().play(.click)
            case .settled:
                break
            }
        }
    }
}
