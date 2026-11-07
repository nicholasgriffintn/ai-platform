import Foundation

struct PetSelection: Codable, Equatable, Hashable {
    enum Source: String, Codable {
        case preset
        case custom
    }

    var source: Source
    var id: String

    static let `default` = PetSelection(source: .preset, id: "pip")

    var key: String { "\(source.rawValue):\(id)" }
}

struct UserPet: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let layoutId: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case layoutId = "layout_id"
    }

    var selection: PetSelection { PetSelection(source: .custom, id: id) }
}

struct UserPetsPage: Decodable {
    let data: [UserPet]
}

struct PetSelectionUpdate: Encodable {
    let selection: PetSelection

    enum CodingKeys: String, CodingKey {
        case source = "pet_source"
        case id = "pet_id"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(selection.source, forKey: .source)
        try container.encode(selection.id, forKey: .id)
    }
}

struct PetAnimationUpdate: Encodable {
    let enabled: Bool

    enum CodingKeys: String, CodingKey {
        case enabled = "pet_animation_enabled"
    }
}

extension AuthUserSettings {
    var petSelection: PetSelection {
        guard let petId, !petId.isEmpty else { return .default }
        return PetSelection(source: PetSelection.Source(rawValue: petSource ?? "") ?? .preset, id: petId)
    }
}
