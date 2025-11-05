import SwiftUI

struct ChatSettingsView: View {
    @Binding var settings: ChatSettings
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Model Parameters")) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Temperature")
                            Spacer()
                            Text(String(format: "%.2f", settings.temperature))
                                .foregroundColor(.secondary)
                        }
                        Slider(value: $settings.temperature, in: 0...2, step: 0.1)
                        Text("Controls randomness. Lower is more focused, higher is more creative.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Top P")
                            Spacer()
                            Text(String(format: "%.2f", settings.topP))
                                .foregroundColor(.secondary)
                        }
                        Slider(value: $settings.topP, in: 0...1, step: 0.05)
                        Text("Controls diversity via nucleus sampling. 1.0 = all options considered.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Toggle("Limit Max Tokens", isOn: Binding(
                        get: { settings.maxTokens != nil },
                        set: { enabled in
                            settings.maxTokens = enabled ? 2048 : nil
                        }
                    ))

                    if settings.maxTokens != nil {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Max Tokens")
                                Spacer()
                                Text("\(settings.maxTokens ?? 2048)")
                                    .foregroundColor(.secondary)
                            }
                            Slider(
                                value: Binding(
                                    get: { Double(settings.maxTokens ?? 2048) },
                                    set: { settings.maxTokens = Int($0) }
                                ),
                                in: 256...8192,
                                step: 256
                            )
                            Text("Maximum length of the response in tokens.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Section(header: Text("Response Style")) {
                    ForEach(ChatSettings.ResponseMode.allCases, id: \.self) { mode in
                        Button(action: {
                            settings.responseMode = mode
                        }) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(mode.displayName)
                                        .font(.headline)
                                        .foregroundColor(.primary)
                                    Text(mode.description)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                if settings.responseMode == mode {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.blue)
                                }
                            }
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }

                Section {
                    Button("Reset to Defaults") {
                        settings = .default
                    }
                    .foregroundColor(.red)
                }

                Section {
                    Text("These settings control how the AI generates responses. Experiment to find what works best for your needs.")
                        .font(.caption)
                        .foregroundColor(.secondary)
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
}

#Preview {
    ChatSettingsView(settings: .constant(.default))
}
