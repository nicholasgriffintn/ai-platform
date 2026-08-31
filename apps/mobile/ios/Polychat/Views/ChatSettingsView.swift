import SwiftUI

struct ChatSettingsView: View {
    @Binding var settings: ChatSettings
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Response")) {
                    Picker("Reasoning", selection: reasoningSelection) {
                        Text("Default").tag("")
                        ForEach(ChatSettings.ReasoningEffort.allCases, id: \.rawValue) { effort in
                            Text(effort.displayName).tag(effort.rawValue)
                        }
                    }

                    Picker("Verbosity", selection: verbositySelection) {
                        Text("Default").tag("")
                        ForEach(ChatSettings.VerbosityLevel.allCases, id: \.rawValue) { level in
                            Text(level.displayName).tag(level.rawValue)
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Temperature")
                            Spacer()
                            Text(String(format: "%.1f", settings.temperature))
                                .foregroundColor(.secondary)
                        }
                        Slider(value: $settings.temperature, in: 0...2, step: 0.1)
                    }
                }

                Section(header: Text("Advanced")) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Top P")
                            Spacer()
                            Text(String(format: "%.2f", settings.topP))
                                .foregroundColor(.secondary)
                        }
                        Slider(value: $settings.topP, in: 0...1, step: 0.05)
                    }

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

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Presence Penalty")
                            Spacer()
                            Text(String(format: "%.1f", settings.presencePenalty))
                                .foregroundColor(.secondary)
                        }
                        Slider(value: $settings.presencePenalty, in: -2...2, step: 0.1)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Frequency Penalty")
                            Spacer()
                            Text(String(format: "%.1f", settings.frequencyPenalty))
                                .foregroundColor(.secondary)
                        }
                        Slider(value: $settings.frequencyPenalty, in: -2...2, step: 0.1)
                    }
                }

                Section(header: Text("Retrieval")) {
                    Toggle("Enable RAG", isOn: $settings.useRag)

                    if settings.useRag {
                        Stepper("Top K: \(settings.ragOptions.topK)", value: $settings.ragOptions.topK, in: 1...20)
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Score Threshold")
                                Spacer()
                                Text(String(format: "%.2f", settings.ragOptions.scoreThreshold))
                                    .foregroundColor(.secondary)
                            }
                            Slider(value: $settings.ragOptions.scoreThreshold, in: 0...1, step: 0.05)
                        }
                        Toggle("Include Metadata", isOn: $settings.ragOptions.includeMetadata)
                        TextField("Namespace", text: $settings.ragOptions.namespace)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
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
