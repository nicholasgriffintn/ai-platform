import Foundation
import Testing
@testable import Polychat

struct ViewPresentationTests {
    @Test func conversationSectionsUseInjectedDateForStableGrouping() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(secondsFromGMT: 0))
        calendar.firstWeekday = 2

        let now = try #require(AppDateParser.parse("2026-05-27T12:00:00Z"))
        let conversations = [
            makeConversation(id: "today", lastMessageAt: try #require(AppDateParser.parse("2026-05-27T08:00:00Z"))),
            makeConversation(id: "yesterday", lastMessageAt: try #require(AppDateParser.parse("2026-05-26T08:00:00Z"))),
            makeConversation(id: "week", lastMessageAt: try #require(AppDateParser.parse("2026-05-25T08:00:00Z"))),
            makeConversation(id: "month", lastMessageAt: try #require(AppDateParser.parse("2026-05-01T08:00:00Z"))),
            makeConversation(id: "older", lastMessageAt: try #require(AppDateParser.parse("2026-04-30T08:00:00Z")))
        ]

        let sections = ConversationListSectionBuilder.sections(for: conversations, calendar: calendar, now: now)

        #expect(sections.map(\.title) == ["Today", "Yesterday", "This Week", "This Month", "Older"])
        #expect(sections.flatMap(\.conversations).map(\.id) == ["today", "yesterday", "week", "month", "older"])
    }

    @Test func modelSelectionFilterAppliesSearchProviderFeaturedAndDeprecatedRules() {
        let models = [
            makeModel(id: "gpt-4o", name: "GPT-4o", provider: "openai", description: "Vision model", strengths: ["Vision"], isFeatured: true, isDeprecated: false),
            makeModel(id: "old-gpt", name: "Old GPT", provider: "openai", description: "Legacy", strengths: ["Chat"], isFeatured: true, isDeprecated: true),
            makeModel(id: "mistral", name: "Mistral", provider: "mistral", description: "Fast", strengths: ["Code"], isFeatured: false, isDeprecated: false)
        ]

        let featuredFilter = ModelSelectionFilter(searchText: "", showsFeaturedOnly: true, showsDeprecated: false, selectedProvider: nil)
        #expect(featuredFilter.apply(to: models).map(\.id) == ["gpt-4o"])

        let providerFilter = ModelSelectionFilter(searchText: "code", showsFeaturedOnly: false, showsDeprecated: false, selectedProvider: "mistral")
        #expect(providerFilter.apply(to: models).map(\.id) == ["mistral"])

        let deprecatedFilter = ModelSelectionFilter(searchText: "legacy", showsFeaturedOnly: true, showsDeprecated: true, selectedProvider: nil)
        #expect(deprecatedFilter.apply(to: models).map(\.id) == ["old-gpt"])
        #expect(ModelSelectionFilter.availableProviders(in: models) == ["mistral", "openai"])
    }

    @Test func messageFormattingSeparatesReasoningArtifactsAndTextSegments() throws {
        let formatted = MessageFormatting.formattedMessageContent(
            role: "assistant",
            originalContent: """
            <think>Plan quietly</think>
            Before
            <artifact identifier="a1" type="text/markdown" title="Notes"># Notes</artifact>
            <answer>After</answer>
            """
        )

        #expect(formatted.reasoning.map(\.content) == ["Plan quietly"])
        #expect(formatted.artifacts.map(\.id) == ["a1"])
        #expect(formatted.artifacts.first?.type == .markdown)
        #expect(formatted.segments.count == 3)

        guard case .artifact(let artifact) = formatted.segments[1] else {
            Issue.record("Expected artifact segment")
            return
        }

        #expect(artifact.id == "a1")
    }

    @Test func customXmlTagFormattingPreservesCodeFences() {
        let formatted = MessageFormatting.processCustomXmlTags("""
        <analysis>Explain this</analysis>

        ```xml
        <analysis>Do not touch this</analysis>
        ```
        """)

        #expect(formatted.contains("**Analysis**"))
        #expect(formatted.contains("<analysis>Do not touch this</analysis>"))
    }
}
