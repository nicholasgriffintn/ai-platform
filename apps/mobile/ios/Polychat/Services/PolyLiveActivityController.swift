import Foundation
#if canImport(ActivityKit) && os(iOS)
import ActivityKit
#endif

struct LiveWorkLine {
    enum State {
        case running
        case needsYou
        case completed
        case failed
    }

    let id: String
    let title: String
    let place: String
    let step: String?
    let state: State
    let since: Date
    let link: URL?
}

@MainActor
final class PolyLiveActivityController {
    private static let titleLimit = 90
    private static let otherLimit = 3
    private static let finishedLinger: TimeInterval = 10 * 60

    func sync(live: [LiveWorkLine], finished: [LiveWorkLine]) async {
        #if canImport(ActivityKit) && os(iOS)
        let activities = Activity<PolyActivityAttributes>.activities.filter {
            $0.activityState == .active || $0.activityState == .stale
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled, let focus = live.first else {
            for activity in activities {
                await finish(activity, finished: finished)
            }
            return
        }

        let state = PolyActivityAttributes.ContentState(
            focus: Self.workLine(focus),
            others: live.dropFirst().prefix(Self.otherLimit).map { Self.activityState($0.state) },
            needsYou: live.filter { $0.state == .needsYou }.count
        )
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(60 * 60))

        if let activity = activities.first {
            let alert = state.needsYou > activity.content.state.needsYou
                ? AlertConfiguration(title: "Poly needs you", body: "\(focus.title)", sound: .default)
                : nil
            await activity.update(content, alertConfiguration: alert)
            for duplicate in activities.dropFirst() {
                await duplicate.end(nil, dismissalPolicy: .immediate)
            }
            return
        }

        for lingering in Activity<PolyActivityAttributes>.activities where lingering.activityState == .ended {
            await lingering.end(nil, dismissalPolicy: .immediate)
        }
        _ = try? Activity.request(
            attributes: PolyActivityAttributes(),
            content: content,
            pushType: nil
        )
        #endif
    }

    #if canImport(ActivityKit) && os(iOS)
    private func finish(_ activity: Activity<PolyActivityAttributes>, finished: [LiveWorkLine]) async {
        var last = activity.content.state.focus
        guard let outcome = finished.first(where: { $0.id == last.id }) else {
            await activity.end(nil, dismissalPolicy: .immediate)
            return
        }

        last.state = Self.activityState(outcome.state)
        last.step = outcome.step.map { String($0.prefix(Self.titleLimit)) }
        last.endedAt = max(outcome.since, last.since)
        let state = PolyActivityAttributes.ContentState(focus: last, others: [], needsYou: 0)
        await activity.end(
            ActivityContent(state: state, staleDate: nil),
            dismissalPolicy: .after(Date().addingTimeInterval(Self.finishedLinger))
        )
    }

    private static func activityState(_ state: LiveWorkLine.State) -> PolyActivityAttributes.WorkLine.State {
        switch state {
        case .running: return .running
        case .needsYou: return .needsYou
        case .completed: return .completed
        case .failed: return .failed
        }
    }

    private static func workLine(_ line: LiveWorkLine) -> PolyActivityAttributes.WorkLine {
        PolyActivityAttributes.WorkLine(
            id: line.id,
            title: String(line.title.prefix(titleLimit)),
            place: line.place,
            step: line.step.map { String($0.prefix(titleLimit)) },
            state: activityState(line.state),
            since: line.since,
            endedAt: nil,
            link: line.link
        )
    }
    #endif
}
