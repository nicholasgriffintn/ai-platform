import AVFoundation

enum PlaybackSessionError: LocalizedError {
    case noRoute

    var errorDescription: String? {
        "Choose AirPods or a speaker to listen on."
    }
}

enum PlaybackSession {
    static func activate() async throws {
        let session = AVAudioSession.sharedInstance()
        #if os(watchOS)
        try session.setCategory(.playback, mode: .spokenAudio, policy: .longFormAudio)
        guard try await session.activate() else {
            throw PlaybackSessionError.noRoute
        }
        #else
        try session.setCategory(.playback, mode: .spokenAudio)
        try session.setActive(true)
        #endif
    }
}
