import SwiftUI

struct ChatSettingsView: View {
    @Binding var settings: ChatSettings
    var modelConfig: ModelConfigItem?
    @Environment(\.dismiss) private var dismiss

    private var reasoningOptions: [ChatSettings.ReasoningEffort] {
        ChatSettings.ReasoningEffort.supportedLevels(for: modelConfig)
    }

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Response")) {
                    Picker("Reasoning", selection: reasoningSelection) {
                        Text("Default").tag("")
                        ForEach(reasoningOptions, id: \.rawValue) { effort in
                            Text(effort.displayName).tag(effort.rawValue)
                        }
                    }

                    Picker("Verbosity", selection: verbositySelection) {
                        Text("Default").tag("")
                        ForEach(ChatSettings.VerbosityLevel.allCases, id: \.rawValue) { level in
                            Text(level.displayName).tag(level.rawValue)
                        }
                    }

                    automaticSlider(
                        title: "Temperature",
                        value: $settings.temperature,
                        range: 0...2,
                        step: 0.1,
                        overrideValue: 1,
                        format: "%.1f"
                    )
                }

                Section(header: Text("Advanced")) {
                    automaticSlider(
                        title: "Top P",
                        value: $settings.topP,
                        range: 0...1,
                        step: 0.05,
                        overrideValue: 0.8,
                        format: "%.2f"
                    )

                    Toggle("Limit Max Tokens", isOn: Binding(
                        get: { settings.maxTokens != nil },
                        set: { enabled in settings.maxTokens = enabled ? 8192 : nil }
                    ))

                    if settings.maxTokens != nil {
                        Stepper("Max Tokens: \(settings.maxTokens ?? 8192)", value: Binding(
                            get: { settings.maxTokens ?? 8192 },
                            set: { settings.maxTokens = $0 }
                        ), in: 256...Int.max, step: 256)
                    }

                    automaticSlider(
                        title: "Presence Penalty",
                        value: $settings.presencePenalty,
                        range: -2...2,
                        step: 0.1,
                        overrideValue: 0,
                        format: "%.1f"
                    )

                    automaticSlider(
                        title: "Frequency Penalty",
                        value: $settings.frequencyPenalty,
                        range: -2...2,
                        step: 0.1,
                        overrideValue: 0,
                        format: "%.1f"
                    )
                }

                Section {
                    Button("Reset to Defaults", role: .destructive) {
                        settings = .default
                    }
                }
            }
            .navigationTitle("Chat Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func automaticSlider(
        title: String,
        value: Binding<Double?>,
        range: ClosedRange<Double>,
        step: Double,
        overrideValue: Double,
        format: String
    ) -> some View {
        Toggle("Set \(title)", isOn: Binding(
            get: { value.wrappedValue != nil },
            set: { enabled in value.wrappedValue = enabled ? overrideValue : nil }
        ))

        if let current = value.wrappedValue {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(title)
                    Spacer()
                    Text(String(format: format, current))
                        .foregroundColor(.secondary)
                }
                Slider(
                    value: Binding(
                        get: { value.wrappedValue ?? overrideValue },
                        set: { value.wrappedValue = $0 }
                    ),
                    in: range,
                    step: step
                )
            }
        }
    }

    private var reasoningSelection: Binding<String> {
        Binding(
            get: { settings.reasoningEffort?.rawValue ?? "" },
            set: { value in
                settings.reasoningEffort = value.isEmpty ? nil : ChatSettings.ReasoningEffort(rawValue: value)
            }
        )
    }

    private var verbositySelection: Binding<String> {
        Binding(
            get: { settings.verbosity?.rawValue ?? "" },
            set: { value in
                settings.verbosity = value.isEmpty ? nil : ChatSettings.VerbosityLevel(rawValue: value)
            }
        )
    }
}

#Preview {
    ChatSettingsView(settings: .constant(.default))
}
