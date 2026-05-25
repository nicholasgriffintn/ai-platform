import AVFoundation
import Foundation

@MainActor
final class VoiceRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published private(set) var isRecording = false

    private var recorder: AVAudioRecorder?
    private var recordingURL: URL?

    func start() async throws {
        let granted = await requestPermission()
        guard granted else {
            throw VoiceRecorderError.permissionDenied
        }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .spokenAudio,
            options: [.defaultToSpeaker, .allowBluetoothHFP, .allowBluetoothA2DP]
        )
        try session.setActive(true)

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("polychat-voice-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]

        let recorder = try AVAudioRecorder(url: url, settings: settings)
        recorder.delegate = self
        guard recorder.prepareToRecord(), recorder.record() else {
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
            throw VoiceRecorderError.failedToStart
        }

        self.recorder = recorder
        self.recordingURL = url
        self.isRecording = true
    }

    func stop() throws -> URL {
        guard let activeRecorder = recorder, let recordingURL else {
            throw VoiceRecorderError.noActiveRecording
        }

        activeRecorder.stop()
        self.recorder = nil
        self.recordingURL = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        let fileSize = (try? recordingURL.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        guard fileSize > 0 else {
            throw VoiceRecorderError.emptyRecording
        }

        return recordingURL
    }

    private func requestPermission() async -> Bool {
        if #available(iOS 17.0, *) {
            return await AVAudioApplication.requestRecordPermission()
        } else {
            return await withCheckedContinuation { continuation in
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            }
        }
    }
}

enum VoiceRecorderError: LocalizedError {
    case permissionDenied
    case failedToStart
    case noActiveRecording
    case emptyRecording

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Microphone access is required for voice input."
        case .failedToStart:
            return "Voice recording could not start."
        case .noActiveRecording:
            return "There is no active voice recording."
        case .emptyRecording:
            return "Voice recording did not capture any audio."
        }
    }
}
