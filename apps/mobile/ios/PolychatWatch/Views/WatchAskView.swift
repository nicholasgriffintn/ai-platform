import AVFoundation
import SwiftUI

struct WatchAskView: View {
    @State private var question = ""
    @State private var answer: String?
    @State private var isAsking = false
    @State private var error: String?
    @State private var speaker = AVSpeechSynthesizer()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                TextField("Ask Poly", text: $question)
                    .onSubmit(ask)
                    .disabled(isAsking)

                if isAsking {
                    ProgressView()
                }

                if let answer {
                    Text(answer).font(.footnote)
                    Button {
                        speak(answer)
                    } label: {
                        Label("Read aloud", systemImage: "speaker.wave.2")
                    }
                }

                if let error {
                    Text(error).font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Ask Poly")
        .onDisappear { speaker.stopSpeaking(at: .immediate) }
    }

    private func ask() {
        let text = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isAsking = true
        error = nil
        Task {
            do {
                answer = try await PolyThread.ask(text)
                question = ""
            } catch {
                self.error = "Poly could not answer: \(error.localizedDescription)"
            }
            isAsking = false
        }
    }

    private func speak(_ text: String) {
        speaker.stopSpeaking(at: .immediate)
        speaker.speak(AVSpeechUtterance(string: text))
    }
}
