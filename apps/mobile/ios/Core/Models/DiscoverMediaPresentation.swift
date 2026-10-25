import Foundation

enum DiscoverMediaPresentation {
    static func episode(edition: DiscoverEdition, episode: DiscoverEpisode?) -> DiscoverMediaState {
        guard edition.episodeId != nil else {
            let status = edition.episodeOverBudget == true
                ? "Over budget"
                : edition.episodeFailed == true ? "Didn't take" : "Not made yet"
            return DiscoverMediaState(title: edition.interests?.first?.topic ?? "Today's episode", status: status, isReady: false)
        }

        guard let episode else {
            return DiscoverMediaState(title: "Today's episode", status: "Checking", isReady: false, isWorking: true)
        }

        let ready = episode.chapters.filter(\.isReady)
        let status: String
        if ready.count == episode.chapters.count {
            status = minutes(ready.reduce(0) { $0 + ($1.timings.last?.end ?? 0) })
        } else if !ready.isEmpty {
            status = "\(ready.count) of \(episode.chapters.count) chapters"
        } else if episode.chapters.contains(where: { $0.status != "failed" }) {
            status = "Recording"
        } else {
            status = "Didn't take"
        }

        return DiscoverMediaState(
            title: episode.title,
            status: "Part \(episode.part) of \(episode.parts) · \(status)",
            isReady: !ready.isEmpty,
            coverKey: coverShot(in: episode).map { "episode:\(episode.id):\($0.chapter):\($0.scene):\($0.shot)" },
            isWorking: status == "Recording"
        )
    }

    static func listen(item: DiscoverMediaItem, sourceId: String?, source: MediaSource?) -> DiscoverMediaState {
        let title = item == .week ? "Your week, told back" : "Today's round-up"

        guard sourceId != nil else {
            return DiscoverMediaState(title: title, status: item == .week ? "Arrives on Sundays" : "Not recorded yet", isReady: false)
        }

        guard let source else {
            return DiscoverMediaState(title: title, status: "Checking", isReady: false, isWorking: true)
        }

        if source.isPlayable {
            return DiscoverMediaState(title: title, status: "Ready", isReady: true, coverKey: "source:\(source.id)")
        }

        return DiscoverMediaState(
            title: title,
            status: source.status == "processing" ? "Recording" : "Didn't record",
            isReady: false,
            isWorking: source.status == "processing"
        )
    }

    static func windDown(_ windDown: DiscoverWindDown?) -> DiscoverMediaState {
        guard let windDown else {
            return DiscoverMediaState(title: "Something quieter", status: "5, 10 or 20 min", isReady: false)
        }

        if windDown.status == "failed" {
            return DiscoverMediaState(title: windDown.title, status: "Didn't take", isReady: false)
        }

        return DiscoverMediaState(
            title: windDown.title,
            status: windDown.isReady ? "\(windDown.minutes) min" : "Settling in",
            isReady: windDown.isReady,
            isWorking: !windDown.isReady
        )
    }

    static func coverShot(in episode: DiscoverEpisode) -> (chapter: Int, scene: Int, shot: Int)? {
        for (chapterIndex, chapter) in episode.chapters.enumerated() {
            for (sceneIndex, scene) in chapter.scenes.enumerated() {
                if let shotIndex = scene.shots.firstIndex(where: \.image) {
                    return (chapterIndex, sceneIndex, shotIndex)
                }
            }
        }
        return nil
    }

    private static func minutes(_ seconds: Double) -> String {
        "\(max(1, Int((seconds / 60).rounded()))) min"
    }
}
