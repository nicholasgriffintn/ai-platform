import Foundation

struct ProjectFlowReviewDraft {
    var answers: [String: String] = [:]
    var checked: [String: Bool] = [:]

    func values(for fields: [NativeRecordColumn]) throws -> [String: JSONValue] {
        var values: [String: JSONValue] = [:]
        for field in fields {
            if field.type == "boolean" {
                values[field.id] = .bool(checked[field.id] ?? false)
                continue
            }
            let answer = (answers[field.id] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if answer.isEmpty {
                if field.required { throw ReviewInputError(message: "Enter \(field.name).") }
                continue
            }
            switch field.type {
            case "number":
                guard let number = Double(answer), number.isFinite,
                      field.minimum.map({ number >= $0 }) ?? true,
                      field.maximum.map({ number <= $0 }) ?? true else {
                    throw ReviewInputError(message: "Enter a valid number for \(field.name) within its allowed range.")
                }
                values[field.id] = .number(number)
            case "select":
                guard field.options?.contains(answer) == true else {
                    throw ReviewInputError(message: "Choose an option for \(field.name).")
                }
                values[field.id] = .string(answer)
            case "date":
                guard AppDateParser.isCalendarDate(answer) else {
                    throw ReviewInputError(message: "Enter \(field.name) as YYYY-MM-DD.")
                }
                values[field.id] = .string(answer)
            case "text":
                guard answer.utf16.count <= (field.maxLength ?? 5000) else {
                    throw ReviewInputError(message: "Shorten \(field.name) to \(field.maxLength ?? 5000) characters.")
                }
                values[field.id] = .string(answer)
            default:
                throw ReviewInputError(message: "Update Polychat to answer this form field.")
            }
        }
        return values
    }
}

struct ReviewInputError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}
