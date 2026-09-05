import Foundation

enum StreamFailure: Equatable {
    case transport
    case api
    case cancelled
}

enum StreamFailureClassifier {
    static func classify(_ error: Error) -> StreamFailure {
        if error is CancellationError {
            return .cancelled
        }

        if error is ChatStreamBufferError {
            return .transport
        }

        if error is APIClientError {
            return .api
        }

        guard let urlError = error as? URLError else {
            return .api
        }

        return urlError.code == .cancelled ? .cancelled : .transport
    }
}
