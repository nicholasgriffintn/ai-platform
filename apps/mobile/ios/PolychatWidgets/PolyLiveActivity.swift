import ActivityKit
import SwiftUI
import WidgetKit

private let inboxURL = URL(string: "polychat://attention")!

private typealias WorkLine = PolyActivityAttributes.WorkLine
private typealias ActivityState = PolyActivityAttributes.ContentState

private extension WorkLine.State {
    var tint: Color {
        switch self {
        case .running: return .blue
        case .needsYou: return .orange
        case .completed: return .green
        case .failed: return .red
        }
    }

    var symbol: String {
        switch self {
        case .running: return "arrow.triangle.2.circlepath"
        case .needsYou: return "exclamationmark.bubble.fill"
        case .completed: return "checkmark.circle"
        case .failed: return "xmark.circle"
        }
    }

    var label: String {
        switch self {
        case .running: return "Working"
        case .needsYou: return "Needs you"
        case .completed: return "Completed"
        case .failed: return "Failed"
        }
    }

    var fallbackDetail: String {
        switch self {
        case .running: return "Poly is on it"
        case .needsYou: return "Waiting on your answer"
        case .completed: return "Your agent is done working"
        case .failed: return "Stopped before finishing"
        }
    }

    var action: String {
        self == .needsYou ? "Respond" : "View work"
    }
}

private extension WorkLine {
    var detail: String {
        if let step, !step.isEmpty { return step }
        return state.fallbackDetail
    }
}

private extension ActivityState {
    var segments: [WorkLine.State] {
        [focus.state] + others
    }

    var link: URL {
        focus.link ?? inboxURL
    }
}

private struct Elapsed: View {
    let line: WorkLine

    var body: some View {
        if let endedAt = line.endedAt {
            Text(Duration.seconds(endedAt.timeIntervalSince(line.since)).formatted(
                .units(allowed: [.hours, .minutes, .seconds], width: .narrow, maximumUnitCount: 1)
            ))
        } else {
            Text(timerInterval: line.since...Date.distantFuture, countsDown: false)
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct StatusLine: View {
    let line: WorkLine

    var body: some View {
        HStack(spacing: 8) {
            Text("\(Text(line.state.label).foregroundStyle(line.state.tint)) · \(line.detail)")
                .lineLimit(1)
            Spacer(minLength: 4)
            Elapsed(line: line)
                .monospacedDigit()
                .frame(maxWidth: 64, alignment: .trailing)
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
}

private struct Segments: View {
    let states: [WorkLine.State]

    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(states.enumerated()), id: \.offset) { _, state in
                Capsule()
                    .fill(state.tint)
                    .frame(height: 6)
            }
        }
    }
}

private struct ActionButton: View {
    let state: ActivityState

    var body: some View {
        Link(destination: state.link) {
            Text(state.focus.state.action)
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(.white.opacity(0.12), in: Capsule())
        }
    }
}

private struct TitleRow: View {
    let line: WorkLine

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            PolyMark(size: 22)
            Text(line.title)
                .font(.headline)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: line.state.symbol)
                .font(.title3)
                .foregroundStyle(line.state.tint)
        }
    }
}

private struct PolyActivityLockScreen: View {
    @Environment(\.activityFamily) private var family
    let state: ActivityState

    var body: some View {
        switch family {
        case .small:
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    PolyMark(size: 16)
                    Image(systemName: state.focus.state.symbol)
                        .font(.caption2)
                        .foregroundStyle(state.focus.state.tint)
                    Spacer(minLength: 0)
                    Elapsed(line: state.focus)
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: 44, alignment: .trailing)
                }
                Text(state.focus.title)
                    .font(.caption.weight(.semibold))
                    .lineLimit(2)
                Text(state.focus.state.label)
                    .font(.caption2)
                    .foregroundStyle(state.focus.state.tint)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(8)
        default:
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    TitleRow(line: state.focus)
                    StatusLine(line: state.focus)
                }
                Segments(states: state.segments)
                ActionButton(state: state)
            }
            .padding(16)
        }
    }
}

struct PolyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PolyActivityAttributes.self) { context in
            PolyActivityLockScreen(state: context.state)
                .activitySystemActionForegroundColor(.primary)
                .widgetURL(context.state.link)
        } dynamicIsland: { context in
            let focus = context.state.focus
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    PolyMark(size: 28)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Image(systemName: focus.state.symbol)
                        .font(.title3)
                        .foregroundStyle(focus.state.tint)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(focus.title)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 10) {
                        StatusLine(line: focus)
                        Segments(states: context.state.segments)
                        ActionButton(state: context.state)
                    }
                    .padding(.top, 4)
                }
            } compactLeading: {
                PolyMark(size: 18)
            } compactTrailing: {
                if focus.state == .running {
                    Elapsed(line: focus)
                        .font(.caption2.weight(.semibold).monospacedDigit())
                        .foregroundStyle(focus.state.tint)
                        .frame(maxWidth: 44)
                } else {
                    Image(systemName: focus.state.symbol)
                        .font(.caption)
                        .foregroundStyle(focus.state.tint)
                }
            } minimal: {
                Image(systemName: focus.state.symbol)
                    .font(.caption)
                    .foregroundStyle(focus.state.tint)
            }
            .widgetURL(context.state.link)
        }
        .supplementalActivityFamilies([.small, .medium])
    }
}
