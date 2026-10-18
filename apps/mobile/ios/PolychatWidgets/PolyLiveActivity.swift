import ActivityKit
import SwiftUI
import WidgetKit

private let polyURL = URL(string: "polychat://poly")!

private struct PolyActivityCounts: View {
    let state: PolyActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 10) {
            if state.needsYou > 0 {
                Label("\(state.needsYou)", systemImage: "exclamationmark.circle")
                    .foregroundStyle(.orange)
            }
            if state.workingOn > 0 {
                Label("\(state.workingOn)", systemImage: "gearshape")
                    .foregroundStyle(.blue)
            }
        }
        .font(.caption.weight(.semibold))
        .labelStyle(.titleAndIcon)
    }
}

struct PolyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PolyActivityAttributes.self) { context in
            HStack(spacing: 12) {
                PolyGlyph(mood: context.state.mood, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.status)
                        .font(.headline)
                    if let headline = context.state.headline {
                        Text(headline)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                PolyActivityCounts(state: context.state)
            }
            .padding()
            .widgetURL(polyURL)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    PolyGlyph(mood: context.state.mood, size: 36)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    PolyActivityCounts(state: context.state)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.status).font(.headline)
                        if let headline = context.state.headline {
                            Text(headline)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                PolyGlyph(mood: context.state.mood, size: 20)
            } compactTrailing: {
                Text("\(context.state.needsYou > 0 ? context.state.needsYou : context.state.workingOn)")
                    .foregroundStyle(context.state.needsYou > 0 ? .orange : .blue)
            } minimal: {
                PolyGlyph(mood: context.state.mood, size: 18)
            }
            .widgetURL(polyURL)
        }
    }
}
