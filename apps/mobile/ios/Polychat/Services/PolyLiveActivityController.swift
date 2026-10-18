import Foundation
#if canImport(ActivityKit) && os(iOS)
import ActivityKit
#endif

@MainActor
final class PolyLiveActivityController {
    func sync(agenda: PolyAgenda?, presence: PolyPresence) async {
        #if canImport(ActivityKit) && os(iOS)
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            return
        }

        let active = Activity<PolyActivityAttributes>.activities
        let shouldShow = agenda.map { !$0.needsYou.isEmpty || !$0.workingOn.isEmpty } ?? false

        guard let agenda, shouldShow else {
            for activity in active {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            return
        }

        let state = PolyActivityAttributes.ContentState(
            mood: presence.mood.rawValue,
            status: presence.status,
            needsYou: agenda.needsYou.count,
            workingOn: agenda.workingOn.count,
            headline: (agenda.needsYou.first ?? agenda.workingOn.first)?.title
        )
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(60 * 60))

        if let activity = active.first {
            await activity.update(content)
            return
        }

        _ = try? Activity.request(
            attributes: PolyActivityAttributes(),
            content: content,
            pushType: nil
        )
        #endif
    }
}
