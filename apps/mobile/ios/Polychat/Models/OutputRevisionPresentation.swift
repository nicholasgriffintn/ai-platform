import Foundation

enum OutputRevisionPresentation {
    static func changedFields(current: OutputRevision, selected: OutputRevision) -> [String] {
        var fields: [String] = []

        if current.title != selected.title { fields.append("Title") }
        if current.status != selected.status { fields.append("Status") }
        if current.sensitivity != selected.sensitivity { fields.append("Sensitivity") }
        if current.content != selected.content { fields.append("Content") }

        return fields
    }

    static func provenanceLabel(_ provenance: OutputProvenance) -> String {
        guard provenance.completeness != "legacy" else {
            return "Legacy origin unavailable"
        }

        let model = provenance.model.map { "\($0.id) via \($0.provider)" }
            ?? "Model details incomplete"
        let run = provenance.run.map { "Run \($0.id), attempt \($0.attempt)" }

        return [model, run].compactMap { $0 }.joined(separator: " · ")
    }
}
