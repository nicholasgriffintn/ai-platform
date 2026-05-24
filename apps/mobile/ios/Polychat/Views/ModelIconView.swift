import SwiftUI

struct ModelIconView: View {
    let modelName: String
    let provider: String?
    let size: CGFloat

    var body: some View {
        Group {
            if modelName == "Automatic" {
                Image(systemName: "wand.and.sparkles")
                    .font(.system(size: size * 0.58, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: size, height: size)
            } else {
                Text(icon.shortLabel)
                    .font(.system(size: icon.fontSize(for: size), weight: .semibold, design: .rounded))
                    .foregroundStyle(icon.foregroundColor)
                    .frame(width: size, height: size)
                    .background(icon.backgroundColor)
                    .clipShape(Circle())
            }
        }
        .accessibilityLabel(icon.accessibilityLabel(modelName: modelName, provider: provider))
    }

    private var icon: ModelIconDefinition {
        ModelIconDefinition.resolve(modelName: modelName, provider: provider)
    }
}

private struct ModelIconDefinition {
    let iconName: String
    let shortLabel: String
    let foregroundColor: Color
    let backgroundColor: Color

    func fontSize(for size: CGFloat) -> CGFloat {
        shortLabel.count > 2 ? size * 0.32 : size * 0.43
    }

    func accessibilityLabel(modelName: String, provider: String?) -> String {
        if let provider, !provider.isEmpty {
            return "\(modelName) by \(provider)"
        }

        return modelName
    }

    static func resolve(modelName: String, provider: String?) -> ModelIconDefinition {
        let normalizedModelName = modelName.lowercased()

        for (pattern, iconName) in modelIcons where normalizedModelName.contains(pattern) {
            return definition(named: iconName, provider: provider)
        }

        if let provider {
            let normalizedProvider = provider.lowercased()
            for (providerPattern, iconName) in providerIcons where normalizedProvider == providerPattern {
                return definition(named: iconName, provider: provider)
            }
        }

        return fallback(text: modelName, provider: provider)
    }

    private static func definition(named iconName: String, provider: String?) -> ModelIconDefinition {
        let palette = providerPalette(provider ?? iconName)
        return ModelIconDefinition(
            iconName: iconName,
            shortLabel: iconLabels[iconName] ?? fallbackLabel(for: iconName),
            foregroundColor: palette.foreground,
            backgroundColor: palette.background
        )
    }

    private static func fallback(text: String, provider: String?) -> ModelIconDefinition {
        let palette = providerPalette(provider ?? "")
        return ModelIconDefinition(
            iconName: "fallback",
            shortLabel: fallbackLabel(for: text),
            foregroundColor: palette.foreground,
            backgroundColor: palette.background
        )
    }

    private static func fallbackLabel(for text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines).first.map { String($0).uppercased() } ?? "?"
    }

    private static func providerPalette(_ provider: String) -> (foreground: Color, background: Color) {
        switch provider.lowercased() {
        case "openai":
            return (.green, Color.green.opacity(0.13))
        case "anthropic", "grok":
            return (.purple, Color.purple.opacity(0.13))
        case "google-ai-studio", "googleai", "google":
            return (.blue, Color.blue.opacity(0.13))
        case "mistral":
            return (.indigo, Color.indigo.opacity(0.13))
        case "groq":
            return (.orange, Color.orange.opacity(0.13))
        case "perplexity-ai":
            return (.pink, Color.pink.opacity(0.13))
        case "deepseek":
            return (.teal, Color.teal.opacity(0.13))
        case "bedrock":
            return (.yellow, Color.yellow.opacity(0.18))
        case "together-ai":
            return (.red, Color.red.opacity(0.13))
        default:
            return (.secondary, Color.secondary.opacity(0.13))
        }
    }

    private static let modelIcons: [(String, String)] = [
        ("claude", "claude"),
        ("command", "command-a"),
        ("amazon-nova", "amazon-nova"),
        ("llava", "llava"),
        ("gemini", "gemini"),
        ("gemma", "gemma"),
        ("mistral", "mistral"),
        ("codestral", "mistral"),
        ("voxtral", "mistral"),
        ("devstral", "mistral"),
        ("magistral", "mistral"),
        ("ministral", "mistral"),
        ("qwen", "qwen"),
        ("gpt-", "openai"),
        ("o1", "openai"),
        ("o3", "openai"),
        ("flux", "flux"),
        ("grok", "grok"),
        ("together", "together-ai"),
        ("perplexity", "perplexity"),
        ("deepseek", "deepseek"),
        ("lm-studio", "lm-studio"),
        ("ai21", "ai21"),
        ("jamba", "ai21"),
        ("baai", "baai"),
        ("bytedance", "bytedance"),
        ("hunyuan", "hunyuan"),
        ("midjourney", "midjourney"),
        ("meta", "meta"),
        ("stability", "stability"),
        ("sonar", "perplexity"),
        ("titan", "bedrock"),
        ("nova", "bedrock"),
        ("moonshot", "moonshot"),
        ("kimi", "moonshot"),
        ("nvidia", "nvidia")
    ]

    private static let providerIcons: [(String, String)] = [
        ("openai", "openai"),
        ("anthropic", "anthropic"),
        ("google", "google"),
        ("google-ai-studio", "google"),
        ("googleai", "google"),
        ("mistral", "mistral"),
        ("groq", "groq"),
        ("perplexity-ai", "perplexity"),
        ("deepseek", "deepseek"),
        ("bedrock", "bedrock"),
        ("together-ai", "together-ai"),
        ("grok", "grok"),
        ("replicate", "replicate"),
        ("huggingface", "huggingface"),
        ("cohere", "cohere"),
        ("ollama", "ollama"),
        ("github-models", "github"),
        ("github", "github"),
        ("xai", "xai"),
        ("openrouter", "openrouter"),
        ("workers-ai", "workers-ai"),
        ("cloudflare", "cloudflare"),
        ("fireworks", "fireworks"),
        ("hyperbolic", "hyperbolic"),
        ("v0", "v0")
    ]

    private static let iconLabels: [String: String] = [
        "ai21": "AI",
        "amazon-nova": "N",
        "anthropic": "A",
        "baai": "BA",
        "bedrock": "BR",
        "bytedance": "BD",
        "claude": "C",
        "cloudflare": "CF",
        "cohere": "Co",
        "command-a": "CA",
        "deepseek": "DS",
        "fireworks": "FW",
        "flux": "Fx",
        "gemini": "G",
        "gemma": "Gm",
        "github": "GH",
        "grok": "Gk",
        "groq": "GQ",
        "huggingface": "HF",
        "hunyuan": "HY",
        "hyperbolic": "H",
        "llava": "L",
        "lm-studio": "LM",
        "meta": "M",
        "midjourney": "MJ",
        "mistral": "M",
        "moonshot": "K",
        "nvidia": "NV",
        "ollama": "O",
        "openai": "AI",
        "openrouter": "OR",
        "perplexity": "P",
        "qwen": "Q",
        "replicate": "R",
        "stability": "S",
        "together-ai": "T",
        "v0": "v0",
        "workers-ai": "W",
        "xai": "xAI"
    ]
}

