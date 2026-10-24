import Foundation
#if canImport(ActivityKit) && os(iOS)
import ActivityKit
#endif

@MainActor
final class PolyLiveActivityController {
    func sync(needsYou: Int, workingOn: Int, headline: String?) async {
        #if canImport(ActivityKit) && os(iOS)
        let active = Activity<PolyActivityAttributes>.activities

        guard ActivityAuthorizationInfo().areActivitiesEnabled, needsYou > 0 || workingOn > 0 else {
            for activity in active {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            return
        }

        let state = PolyActivityAttributes.ContentState(
            mood: needsYou > 0 ? PolyMood.wait.rawValue : PolyMood.work.rawValue,
            status: needsYou > 0
                ? "\(needsYou) waiting on you"
                : "\(workingOn) running",
            needsYou: needsYou,
            workingOn: workingOn,
            headline: headline
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
