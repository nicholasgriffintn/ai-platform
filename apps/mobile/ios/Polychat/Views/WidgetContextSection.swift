import SwiftUI

struct WidgetContextSection: View {
    @EnvironmentObject private var widgetContext: WidgetContextController

    var body: some View {
        Section {
            Toggle("Calendar", isOn: binding(\.syncsCalendar, widgetContext.setCalendar))
            Toggle("Where I am", isOn: binding(\.sharesLocation, widgetContext.setLocation))
            if widgetContext.sharesLocation && !widgetContext.tracksInBackground {
                Button("Keep it current when Polychat is closed") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                .font(.footnote)
            }
            if let error = widgetContext.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.polychat.error)
            }
        } header: {
            Text("iPhone data")
        } footer: {
            Text("Syncs every calendar on this iPhone and where you are to Polychat, so Discover, Poly and your widgets on every device use them. With location set to Always, it keeps up as you move around. Apple Health is under Discover.")
        }
        .disabled(widgetContext.isWorking)
    }

    private func binding(
        _ value: KeyPath<WidgetContextController, Bool>,
        _ update: @escaping (Bool) async -> Void
    ) -> Binding<Bool> {
        Binding(
            get: { widgetContext[keyPath: value] },
            set: { enabled in Task { await update(enabled) } }
        )
    }
}
