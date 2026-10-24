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
            makeModel(id: "gpt-4o", name: "GPT-4o", provider: "openai", description: "Vision model", strengths: ["Vision"], isFeatured: true, deprecated: false),
            makeModel(id: "old-gpt", name: "Old GPT", provider: "openai", description: "Legacy", strengths: ["Chat"], isFeatured: true, deprecated: true),
            makeModel(id: "mistral", name: "Mistral", provider: "mistral", description: "Fast", strengths: ["Code"], isFeatured: false, deprecated: false),
            makeModel(id: "unavailable", name: "Unavailable", provider: "openai", isFeatured: true, isExecutable: false)
        ]

        let featuredFilter = ModelSelectionFilter(searchText: "", showsFeaturedOnly: true, showsDeprecated: false, selectedProvider: nil)
        #expect(featuredFilter.apply(to: models).map(\.id) == ["gpt-4o", "unavailable"])

        let providerFilter = ModelSelectionFilter(searchText: "code", showsFeaturedOnly: false, showsDeprecated: false, selectedProvider: "mistral")
        #expect(providerFilter.apply(to: models).map(\.id) == ["mistral"])

        let deprecatedFilter = ModelSelectionFilter(searchText: "legacy", showsFeaturedOnly: true, showsDeprecated: true, selectedProvider: nil)
        #expect(deprecatedFilter.apply(to: models).map(\.id) == ["old-gpt"])
        #expect(ModelSelectionFilter(searchText: "unavailable", showsFeaturedOnly: false, showsDeprecated: true).apply(to: models).map(\.id) == ["unavailable"])
        #expect(models[1].isAvailableForSelection == false)
        #expect(ModelSelectionFilter.availableProviders(in: models) == ["mistral", "openai"])
    }

    @Test func modelContinuityBlocksPendingInteractionsAndIncompatibleAttachments() {
        let model = makeModel(id: "text-model")

        let pending = ModelContinuity.evaluate(
            model: model,
            hasConversationHistory: true,
            activeResponse: makeResponse(status: "awaiting_approval"),
            attachmentTypes: []
        )
        let attachment = ModelContinuity.evaluate(
            model: model,
            hasConversationHistory: true,
            activeResponse: nil,
            attachmentTypes: [.image]
        )

        #expect(pending.state == .blocked)
        #expect(pending.reason.contains("approval"))
        #expect(attachment.unsupportedAttachments == [.image])
    }

    @Test func modelContinuityRequiresANewConversationForOneTurnImageGeneration() {
        let imageModel = makeModel(
            id: "image-model",
            inputModalities: ["text"],
            outputModalities: ["image"]
        )

        let decision = ModelContinuity.evaluate(
            model: imageModel,
            hasConversationHistory: true,
            activeResponse: nil,
            attachmentTypes: []
        )

        #expect(decision.state == .newConversationRequired)
        #expect(decision.reason.contains("history will not carry"))
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

    @Test func discoverEpisodeTileReportsPartialAndFinishedChaptersLikeTheWeb() throws {
        let edition = try JSONDecoder().decode(DiscoverEdition.self, from: Data("""
        {"id":"e1","date":"2026-10-24","greeting":"Evening","brief":[],"cards":[],"feedback":{},
         "episodeId":"ep1","edition":"evening"}
        """.utf8))
        func episode(_ statuses: [String]) throws -> DiscoverEpisode {
            let chapters = statuses.map { status in
                #"{"title":"c","status":"\#(status)","timings":[{"start":0,"end":90}],"scenes":[{"title":"s","shots":[{"image":true}]}]}"#
            }.joined(separator: ",")
            return try JSONDecoder().decode(DiscoverEpisode.self, from: Data("""
            {"id":"ep1","title":"Debate","recap":"","topic":"Debate","part":2,"parts":5,"chapters":[\(chapters)]}
            """.utf8))
        }

        let partial = DiscoverMediaPresentation.episode(edition: edition, episode: try episode(["ready", "rendering"]))
        let finished = DiscoverMediaPresentation.episode(edition: edition, episode: try episode(["ready", "ready"]))
        let recording = DiscoverMediaPresentation.episode(edition: edition, episode: try episode(["rendering"]))

        #expect(partial.status == "Part 2 of 5 · 1 of 2 chapters")
        #expect(partial.isReady)
        #expect(finished.status == "Part 2 of 5 · 3 min")
        #expect(recording.isWorking)
        #expect(!recording.isReady)
        #expect(finished.coverKey == "episode:ep1:0:0:0")
    }
}
