import Foundation

enum URLSessionStreamEvent {
    case response(URLResponse)
    case data(Data)
}

final class URLSessionStreamClient: NSObject, URLSessionDataDelegate {
    private let configuration: URLSessionConfiguration
    private let request: URLRequest
    private var continuation: AsyncThrowingStream<URLSessionStreamEvent, Error>.Continuation?
    private var session: URLSession?
    private var task: URLSessionDataTask?

    init(configuration: URLSessionConfiguration, request: URLRequest) {
        self.configuration = configuration
        self.request = request
    }

    func stream() -> AsyncThrowingStream<URLSessionStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            self.continuation = continuation

            let session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
            self.session = session

            let task = session.dataTask(with: request)
            self.task = task

            continuation.onTermination = { [weak self] _ in
                self?.cancel()
            }

            task.resume()
        }
    }

    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        continuation?.yield(.response(response))
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        continuation?.yield(.data(data))
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        self.task = nil
        self.session = nil

        if let error {
            continuation?.finish(throwing: error)
        } else {
            continuation?.finish()
        }

        continuation = nil
        session.finishTasksAndInvalidate()
    }

    private func cancel() {
        task?.cancel()
        task = nil
        session?.invalidateAndCancel()
        session = nil
    }
}
