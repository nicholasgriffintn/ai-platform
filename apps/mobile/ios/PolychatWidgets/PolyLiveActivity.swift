import ActivityKit
import SwiftUI
import WidgetKit

private let polyURL = URL(string: "polychat://poly")!
private let inboxURL = URL(string: "polychat://attention")!

private typealias WorkLine = PolyActivityAttributes.WorkLine
private typealias ActivityState = PolyActivityAttributes.ContentState

private extension WorkLine.State {
    var tint: Color {
        switch self {
        case .running: return .blue
        case .needsYou: return .orange
        }
    }

    var symbol: String {
        switch self {
        case .running: return "gearshape.2.fill"
        case .needsYou: return "exclamationmark.bubble.fill"
        }
    }

    var label: String {
        switch self {
        case .running: return "Running"
        case .needsYou: return "Waiting on you"
        }
    }
}

private struct StateGlyph: View {
    let state: WorkLine.State
    var size: CGFloat = 30

    var body: some View {
        Image(systemName: state.symbol)
            .font(.system(size: size * 0.48, weight: .semibold))
            .foregroundStyle(state.tint)
            .frame(width: size, height: size)
            .background(state.tint.opacity(0.18), in: Circle())
    }
}

private struct ElapsedTimer: View {
    let since: Date

    var body: some View {
        Text(timerInterval: since...Date.distantFuture, countsDown: false)
            .monospacedDigit()
            .multilineTextAlignment(.trailing)
    }
}

private struct Counts: View {
    let state: ActivityState

    var body: some View {
        HStack(spacing: 8) {
            if state.needsYou > 0 {
                Label("\(state.needsYou)", systemImage: "exclamationmark.circle.fill")
                    .foregroundStyle(.orange)
            }
            if state.workingOn > 0 {
                Label("\(state.workingOn)", systemImage: "bolt.fill")
                    .foregroundStyle(.blue)
            }
        }
        .font(.caption.weight(.semibold))
        .labelStyle(.titleAndIcon)
    }
}

private struct FocusCard: View {
    let line: WorkLine

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            StateGlyph(state: line.state)
            VStack(alignment: .leading, spacing: 2) {
                Text(line.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                Text(line.place)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if let step = line.step, !step.isEmpty {
                    Text(step)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 2) {
                ElapsedTimer(since: line.since)
                    .font(.title3.weight(.semibold))
                    .frame(maxWidth: 76, alignment: .trailing)
                Text(line.state.label)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(line.state.tint)
            }
        }
    }
}

private struct NextRow: View {
    let line: WorkLine

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(line.state.tint)
                .frame(width: 6, height: 6)
            Text(line.title)
                .font(.caption)
                .lineLimit(1)
            Spacer(minLength: 4)
            ElapsedTimer(since: line.since)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .frame(maxWidth: 52, alignment: .trailing)
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
                    PolyMark(size: 18)
                    Counts(state: state)
                }
                if let focus = state.focus {
                    Text(focus.title)
                        .font(.caption.weight(.semibold))
                        .lineLimit(2)
                    ElapsedTimer(since: focus.since)
                        .font(.caption2)
                        .foregroundStyle(focus.state.tint)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(8)
        default:
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    PolyMark(size: 22)
                    Text("Poly")
                        .font(.subheadline.weight(.bold))
                    Spacer(minLength: 0)
                    Counts(state: state)
                }
                if let focus = state.focus {
                    Link(destination: focus.link ?? inboxURL) {
                        FocusCard(line: focus)
                    }
                }
                if !state.next.isEmpty {
                    VStack(spacing: 6) {
                        ForEach(state.next.prefix(2)) { line in
                            Link(destination: line.link ?? inboxURL) {
                                NextRow(line: line)
                            }
                        }
                    }
                    .padding(.top, 2)
                }
            }
            .padding(14)
        }
    }
}

struct PolyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PolyActivityAttributes.self) { context in
            PolyActivityLockScreen(state: context.state)
                .activitySystemActionForegroundColor(.primary)
                .widgetURL(context.state.focus?.link ?? inboxURL)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    if let focus = context.state.focus {
                        StateGlyph(state: focus.state, size: 36)
                    } else {
                        PolyMark(size: 36)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let focus = context.state.focus {
                        ElapsedTimer(since: focus.since)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(focus.state.tint)
                            .frame(maxWidth: 76, alignment: .trailing)
                    } else {
                        Counts(state: context.state)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    if let focus = context.state.focus {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(focus.title)
                                .font(.subheadline.weight(.semibold))
                                .lineLimit(1)
                            Text(focus.place)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        if let next = context.state.next.first {
                            Link(destination: next.link ?? inboxURL) {
                                NextRow(line: next)
                            }
                        }
                        HStack {
                            Counts(state: context.state)
                            Spacer(minLength: 0)
                            Link(destination: inboxURL) {
                                Text("Open inbox")
                                    .font(.caption.weight(.semibold))
                            }
                        }
                    }
                }
            } compactLeading: {
                HStack(spacing: 4) {
                    PolyMark(size: 18)
                    if let focus = context.state.focus {
                        Image(systemName: focus.state.symbol)
                            .font(.caption2)
                            .foregroundStyle(focus.state.tint)
                    }
                }
            } compactTrailing: {
                if context.state.needsYou > 0 {
                    Text("\(context.state.needsYou)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.orange)
                } else if let focus = context.state.focus {
                    ElapsedTimer(since: focus.since)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.blue)
                        .frame(maxWidth: 44)
                }
            } minimal: {
                if context.state.needsYou > 0 {
                    Text("\(context.state.needsYou)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.orange)
                } else {
                    Image(systemName: "bolt.fill")
                        .foregroundStyle(.blue)
                }
            }
            .widgetURL(context.state.focus?.link ?? polyURL)
        }
        .supplementalActivityFamilies([.small, .medium])
    }
}
