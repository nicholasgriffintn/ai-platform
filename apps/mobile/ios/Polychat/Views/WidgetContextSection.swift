import SwiftUI

struct WidgetContextSection: View {
    @EnvironmentObject private var widgetContext: WidgetContextController

    var body: some View {
        Section {
            Toggle("iPhone calendar", isOn: binding(\.showsCalendar, widgetContext.setCalendar))
            Toggle("Where I am", isOn: binding(\.sharesLocation, widgetContext.setLocation))
            if widgetContext.sharesLocation && !widgetContext.tracksInBackground {
                Button("Keep it current when Polychat is closed") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                .font(.footnote)
            }
            if widgetContext.isHealthAvailable {
                Toggle("Health vitals", isOn: binding(\.showsHealth, widgetContext.setHealth))
            }
            if let error = widgetContext.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.polychat.error)
            }
        } header: {
            Text("Today widget")
        } footer: {
            Text("Your calendar and health stay on this iPhone. With location set to Always, the widget updates when you move a noticeable distance or arrive somewhere, using little battery. Where you are is rounded to about 100 metres and kept for two hours to pick nearby lines and weather. Choose lines to watch in Your day.")
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
