import Combine
import CoreGraphics
import Foundation

@MainActor
final class PerchStore: ObservableObject {
    @Published private(set) var preferences = PerchStorage.preferences
    @Published private(set) var stats = PerchStorage.stats
    @Published private(set) var pet: LoadedPet?
    @Published private(set) var customPets: [UserPet] = []
    @Published private(set) var thumbnails: [PetSelection: CGImage] = [:]
    @Published private(set) var isSaving = false
    @Published var error: String?

    private let apiClient: APIClient
    private let publish: () -> Void
    private var changes: AnyCancellable?

    init(apiClient: APIClient = .shared, publish: @escaping () -> Void) {
        self.apiClient = apiClient
        self.publish = publish
        changes = NotificationCenter.default.publisher(for: .perchChanged)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                guard let self else { return }
                self.preferences = PerchStorage.preferences
                self.stats = PerchStorage.stats
                Task { await self.loadPet() }
            }
    }

    var feel: CrownFeel {
        preferences.feelOverride(for: preferences.selection) ?? pet?.feel ?? .steady
    }

    var choices: [PetSelection] {
        PetPreset.all.map(\.selection) + customPets.map(\.selection)
    }

    var turnsToday: Double {
        stats.turns(on: today)
    }

    private var today: String {
        CalendarDate.string(from: Date(), calendar: .current)
    }

    func name(of selection: PetSelection) -> String {
        switch selection.source {
        case .preset: return PetPreset.named(selection.id).name
        case .custom: return customPets.first { $0.id == selection.id }?.name ?? "Your pet"
        }
    }

    func refresh() async {
        try? await apiClient.initialize()

        async let status = apiClient.fetchAuthStatus()
        async let pets = apiClient.fetchUserPets()

        if let settings = try? await status.userSettings {
            update {
                $0.selection = settings.petSelection
                $0.animated = settings.petAnimationEnabled ?? false
            }
        }
        if let pets = try? await pets {
            customPets = pets
        }
        await loadPet()
    }

    func choose(_ selection: PetSelection) async {
        guard selection != preferences.selection else { return }

        await save("That pet could not be chosen") {
            try await self.apiClient.updatePetSelection(selection)
            self.update { $0.selection = selection }
            await self.loadPet()
        }
    }

    func setAnimated(_ animated: Bool) async {
        await save("That could not be saved") {
            try await self.apiClient.updatePetAnimation(enabled: animated)
            self.update { $0.animated = animated }
        }
    }

    func setFeel(_ feel: CrownFeel?) {
        update { $0.feelOverrides[$0.selection.key] = feel }
    }

    func setWindToApprove(_ enabled: Bool) {
        update { $0.windToApprove = enabled }
    }

    func setMilestoneEvery(_ turns: Int) {
        update { $0.milestoneEvery = turns }
    }

    func record(turns: Double, longestSpin: Double) {
        guard turns > 0 else { return }

        stats.record(turns: turns, longestSpin: longestSpin, day: today)
        PerchStorage.stats = stats
        publish()
    }

    func loadThumbnail(_ selection: PetSelection) async {
        guard thumbnails[selection] == nil else { return }
        thumbnails[selection] = try? await PetLibrary.thumbnail(selection, apiClient: apiClient)
    }

    func reset() {
        pet = nil
        customPets = []
        thumbnails = [:]
        preferences = PerchPreferences()
        stats = PerchStats()
        error = nil
    }

    private func save(_ failure: String, _ work: @escaping () async throws -> Void) async {
        isSaving = true
        defer { isSaving = false }

        do {
            try await work()
            error = nil
        } catch {
            self.error = "\(failure): \(error.localizedDescription)"
        }
    }

    private func update(_ change: (inout PerchPreferences) -> Void) {
        var next = preferences
        change(&next)
        guard next != preferences else { return }

        next.updatedAt = Date()
        preferences = next
        PerchStorage.preferences = next
        publish()
    }

    private func loadPet() async {
        let selection = preferences.selection
        guard pet?.selection != selection else { return }

        do {
            pet = try await PetLibrary.load(selection, apiClient: apiClient)
        } catch {
            if pet == nil, selection != .default {
                pet = try? await PetLibrary.load(.default, apiClient: apiClient)
            }
        }
    }
}
