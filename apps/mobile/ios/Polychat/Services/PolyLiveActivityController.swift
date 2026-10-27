import Foundation
#if canImport(ActivityKit) && os(iOS)
import ActivityKit
#endif

struct LiveWorkLine {
    let id: String
    let title: String
    let place: String
    let step: String?
    let needsYou: Bool
    let since: Date
    let link: URL?
}

@MainActor
final class PolyLiveActivityController {
    private static let titleLimit = 90
    private static let nextLimit = 3

    func sync(needsYou: Int, workingOn: Int, lines: [LiveWorkLine]) async {
        #if canImport(ActivityKit) && os(iOS)
        let active = Activity<PolyActivityAttributes>.activities

        guard ActivityAuthorizationInfo().areActivitiesEnabled, needsYou > 0 || workingOn > 0 else {
            for activity in active {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            return
        }

        let ordered = lines.filter { !$0.needsYou } + lines.filter(\.needsYou)
        let focus = ordered.first.map(Self.workLine)
        let state = PolyActivityAttributes.ContentState(
            mood: needsYou > 0 ? PolyMood.wait.rawValue : PolyMood.work.rawValue,
            needsYou: needsYou,
            workingOn: workingOn,
            focus: focus,
            next: ordered.dropFirst().prefix(Self.nextLimit).map(Self.workLine)
        )
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(60 * 60))

        if let activity = active.first {
            let previous = activity.content.state.needsYou
            let alert = needsYou > previous
                ? AlertConfiguration(
                    title: "Poly needs you",
                    body: "\(needsYou) waiting on you",
                    sound: .default
                )
                : nil
            await activity.update(content, alertConfiguration: alert)
            return
        }

        _ = try? Activity.request(
            attributes: PolyActivityAttributes(),
            content: content,
            pushType: nil
        )
        #endif
    }

    #if canImport(ActivityKit) && os(iOS)
    private static func workLine(_ line: LiveWorkLine) -> PolyActivityAttributes.WorkLine {
        PolyActivityAttributes.WorkLine(
            id: line.id,
            title: String(line.title.prefix(titleLimit)),
            place: line.place,
            step: line.step.map { String($0.prefix(titleLimit)) },
            state: line.needsYou ? .needsYou : .running,
            since: line.since,
            link: line.link
        )
    }
    #endif
}
