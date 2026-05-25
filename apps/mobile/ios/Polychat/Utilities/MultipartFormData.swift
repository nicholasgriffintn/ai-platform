import Foundation

struct MultipartFormData {
    let boundary: String
    private var body = Data()

    init(boundary: String = "Boundary-\(UUID().uuidString)") {
        self.boundary = boundary
    }

    var contentType: String {
        "multipart/form-data; boundary=\(boundary)"
    }

    mutating func appendField(name: String, value: String) {
        appendBoundary()
        appendString("Content-Disposition: form-data; name=\"\(Self.headerValue(name))\"\r\n\r\n")
        appendString(value)
        appendString("\r\n")
    }

    mutating func appendFile(name: String, fileName: String, mimeType: String, data: Data) {
        appendBoundary()
        appendString(
            "Content-Disposition: form-data; name=\"\(Self.headerValue(name))\"; filename=\"\(Self.headerValue(fileName))\"\r\n"
        )
        appendString("Content-Type: \(Self.headerValue(mimeType))\r\n\r\n")
        body.append(data)
        appendString("\r\n")
    }

    func finalizedBody() -> Data {
        var finalized = body
        finalized.append(Data("--\(boundary)--\r\n".utf8))
        return finalized
    }

    private mutating func appendBoundary() {
        appendString("--\(boundary)\r\n")
    }

    private mutating func appendString(_ string: String) {
        body.append(Data(string.utf8))
    }

    private static func headerValue(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\r", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
    }
}
