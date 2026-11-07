import CoreGraphics
import Foundation
import Testing
@testable import Polychat

struct PerchTests {
    @Test func crownDeltaCrossesTheWrapPointTheShortWay() {
        var loop = CrownLoop(length: 24)

        #expect(loop.turns(to: 23) == 0)
        #expect(loop.turns(to: 1) == 2.0 / 24)
        #expect(loop.turns(to: 23) == -2.0 / 24)
    }

    @Test func milestonesFireAtTheChosenIntervalWhicheverWayYouSpin() {
        var engine = PerchEngine(feel: .steady, milestoneEvery: 10)
        var beats: [PerchEngine.Beat] = []

        for step in 0..<40 {
            beats += engine.turn(by: step.isMultiple(of: 2) ? 0.5 : -0.5, at: Double(step))
        }

        #expect(beats == [.milestone(10), .milestone(20)])
    }

    @Test func milestonesStayQuietWhenTurnedOff() {
        var engine = PerchEngine(feel: .steady, milestoneEvery: 0)

        #expect(engine.turn(by: 100, at: 1).isEmpty)
    }

    @Test func aLongSpinCoastsToRestThenCheers() {
        var engine = PerchEngine(feel: .heavy)
        for step in 0..<40 {
            _ = engine.turn(by: 0.1, at: Double(step) / 30)
        }
        #expect(engine.clip(resting: .idle, at: 1.3) == .fret)

        var beats: [PerchEngine.Beat] = []
        var time = 1.4
        while engine.isMoving && time < 10 {
            beats += engine.coast(at: time)
            time += 0.05
        }

        #expect(beats.count == 1)
        guard case .settled(let turns) = beats.first else {
            Issue.record("Expected the spin to settle")
            return
        }
        #expect(abs(turns - 4) < 0.001)
        #expect(engine.clip(resting: .idle, at: time) == .cheer)
        #expect(engine.clip(resting: .idle, at: time + 5) == .idle)
    }

    @Test func coastingDoesNotCountAsTurning() {
        var engine = PerchEngine(feel: .glide)
        _ = engine.turn(by: 0.5, at: 0)
        let turned = engine.totalTurns

        _ = engine.coast(at: 1)
        _ = engine.coast(at: 2)

        #expect(engine.totalTurns == turned)
        #expect(engine.heading > 0.5)
    }

    @Test func windGateFiresExactlyOnceAtAFullTurn() {
        var gate = WindGate()

        #expect(gate.wind(by: 0.6) == false)
        #expect(gate.wind(by: 0.4) == true)
        #expect(gate.wind(by: 0.5) == false)
        #expect(gate.isComplete)
    }

    @Test func windGateUnwindsAndRelaxesWithoutGoingNegative() {
        var gate = WindGate()

        _ = gate.wind(by: 0.5)
        _ = gate.wind(by: -0.8)
        #expect(gate.progress == 0)

        _ = gate.wind(by: 0.5)
        gate.relax(for: 0.5)
        #expect(abs(gate.progress - (0.5 - WindGate.releaseRate * 0.5)) < 0.001)

        gate.relax(for: 10)
        #expect(gate.progress == 0)
    }

    @Test func windGateHoldsOnceComplete() {
        var gate = WindGate()

        _ = gate.wind(by: 1)
        gate.relax(for: 10)

        #expect(gate.progress == 1)
    }

    @Test func snapshotPoseFollowsThePresenceOrder() {
        let now = Date()
        let paused = WidgetSnapshot.Poly(status: "", needsYou: 0, workingOn: 2, items: [], pausedUntil: now.addingTimeInterval(60))
        let expired = WidgetSnapshot.Poly(status: "", needsYou: 0, workingOn: 2, items: [], pausedUntil: now.addingTimeInterval(-60))
        let waiting = WidgetSnapshot.Poly(status: "", needsYou: 1, workingOn: 2, items: [], pausedUntil: now.addingTimeInterval(60))

        #expect(WidgetSnapshot.empty.pose(at: now) == .idle)
        #expect(WidgetSnapshot(poly: paused).pose(at: now) == .doze)
        #expect(WidgetSnapshot(poly: expired).pose(at: now) == .work)
        #expect(WidgetSnapshot(poly: waiting).pose(at: now) == .wait)
    }

    @Test func layoutsFallBackLikeTheWebWhenAClipIsMissing() {
        #expect(PetSheetLayout.polychat.clip(.wait) == PetSheetLayout.polychat.clip(.idle))
        #expect(PetSheetLayout.polychat.clip(.review) == PetSheetLayout.polychat.clip(.think))
        #expect(PetSheetLayout.codex.clip(.doze) == PetSheetLayout.codex.clip(.idle))
        #expect(PetSheetLayout.named("unknown") == .polychat)
    }

    @Test func posesFitTheSmallestWidgetSlot() throws {
        let smallestCornerSlotPixels = 68.0
        let context = try #require(CGContext(
            data: nil,
            width: PetSheetLayout.frameWidth,
            height: PetSheetLayout.frameHeight,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ))
        let frame = try #require(context.makeImage())

        let pose = try #require(PetSheet.poseImage(from: frame))

        #expect(Double(pose.width * pose.height) <= smallestCornerSlotPixels * smallestCornerSlotPixels)
    }

    @Test func unknownPresetsKeepTheirOwnSheetInsteadOfBecomingPip() {
        let preset = PetPreset.named("newbird")

        #expect(preset.name == "Newbird")
        #expect(preset.sheetURL.lastPathComponent == "newbird.png")
    }

    @Test func theNewestChangeWinsWhenDevicesSync() {
        var older = PerchPreferences()
        older.milestoneEvery = 25
        older.updatedAt = Date(timeIntervalSince1970: 100)
        var newer = PerchPreferences()
        newer.milestoneEvery = 50
        newer.updatedAt = Date(timeIntervalSince1970: 200)

        #expect(older.merged(with: newer).milestoneEvery == 50)
        #expect(newer.merged(with: older).milestoneEvery == 50)
    }

    @Test func aCheerShowsBrieflyThenReturnsToResting() {
        var engine = PerchEngine(feel: .steady)

        engine.cheer(at: 10)

        #expect(engine.clip(resting: .wait, at: 10.5) == .cheer)
        #expect(engine.clip(resting: .wait, at: 20) == .wait)
    }

    @Test func feelOverridesBelongToOnePet() {
        var preferences = PerchPreferences()
        let moss = PetPreset.named("moss").selection

        preferences.feelOverrides[moss.key] = .glide

        #expect(preferences.feelOverride(for: moss) == .glide)
        #expect(preferences.feelOverride(for: .default) == nil)
    }

    @Test func petSelectionComesFromAccountSettingsAndDefaultsToPip() throws {
        let decoded = try JSONDecoder().decode(
            AuthUserSettings.self,
            from: Data(#"{"pet_source":"custom","pet_id":"pet-1"}"#.utf8)
        )
        let unset = try JSONDecoder().decode(AuthUserSettings.self, from: Data("{}".utf8))

        #expect(decoded.petSelection == PetSelection(source: .custom, id: "pet-1"))
        #expect(unset.petSelection == .default)
    }
}
