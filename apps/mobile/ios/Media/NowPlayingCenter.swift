import MediaPlayer
import UIKit

@MainActor
final class NowPlayingCenter {
    struct Item {
        let title: String
        let subtitle: String
        let artwork: UIImage?
        let duration: TimeInterval
        let elapsed: TimeInterval
        let isPlaying: Bool
    }

    static let shared = NowPlayingCenter()

    private var targets: [(MPRemoteCommand, Any)] = []

    func bind(
        isPlaying: @escaping () -> Bool,
        setPlaying: @escaping (Bool) -> Void,
        onNext: (() -> Void)? = nil
    ) {
        unbind()
        let commands = MPRemoteCommandCenter.shared()
        register(commands.togglePlayPauseCommand) { _ in
            setPlaying(!isPlaying())
            return .success
        }
        register(commands.playCommand) { _ in
            setPlaying(true)
            return .success
        }
        register(commands.pauseCommand) { _ in
            setPlaying(false)
            return .success
        }
        commands.nextTrackCommand.isEnabled = onNext != nil
        if let onNext {
            register(commands.nextTrackCommand) { _ in
                onNext()
                return .success
            }
        }
    }

    func update(_ item: Item) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: item.title,
            MPMediaItemPropertyArtist: item.subtitle,
            MPMediaItemPropertyPlaybackDuration: item.duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: item.elapsed,
            MPNowPlayingInfoPropertyPlaybackRate: item.isPlaying ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue
        ]
        if let artwork = item.artwork {
            info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: artwork.size) { _ in artwork }
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    func clear() {
        unbind()
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    private func register(
        _ command: MPRemoteCommand,
        _ handler: @escaping (MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus
    ) {
        command.isEnabled = true
        targets.append((command, command.addTarget(handler: handler)))
    }

    private func unbind() {
        for (command, target) in targets {
            command.removeTarget(target)
        }
        targets = []
    }
}
