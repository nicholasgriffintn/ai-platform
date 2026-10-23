import Foundation

private let missingChatMessagesErrorMessage = "Missing required parameter: messages"

final class APIClient: ObservableObject {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private let userAgent: String
    private var authToken: String?

    init(
        baseURL: URL = APIClient.defaultBaseURL(),
        session: URLSession = .shared,
        userAgent: String = APIClient.defaultUserAgent()
    ) {
        self.baseURL = baseURL
        self.session = session
        self.userAgent = userAgent
    }

    func setAuthToken(_ token: String?) {
        self.authToken = token
    }

    func authURL(path: String, queryItems: [URLQueryItem] = []) -> URL {
        buildURL(path: path, queryItems: queryItems)
    }

    func fetchAuthStatus() async throws -> AuthStatusResponse {
        try await send(path: "/auth/me", method: "GET")
    }

    func fetchToken() async throws -> TokenResponse {
        try await send(path: "/auth/token", method: "GET")
    }

    func exchangeNativeAuthCode(_ code: String) async throws -> TokenResponse {
        try await send(
            path: "/auth/native/exchange",
            method: "POST",
            body: NativeAuthExchangeRequest(code: code)
        )
    }

    func signInWithApple(identityToken: String, nonce: String, fullName: String?) async throws -> TokenResponse {
        try await send(
            path: "/auth/apple",
            method: "POST",
            body: AppleSignInRequest(identityToken: identityToken, nonce: nonce, fullName: fullName)
        )
    }

    func requestMagicLink(email: String, redirectUri: String) async throws -> SuccessResponse {
        try await send(
            path: "/auth/magic-link/request",
            method: "POST",
            body: MagicLinkRequest(email: email, redirectUri: redirectUri)
        )
    }

    func verifyMagicLink(token: String) async throws -> SuccessResponse {
        try await send(
            path: "/auth/magic-link/verify",
            method: "POST",
            body: MagicLinkVerifyRequest(token: token)
        )
    }

    func logout() async throws -> SuccessResponse {
        try await send(path: "/auth/logout", method: "POST", emptyBody: true)
    }

    func fetchTaskInbox() async throws -> TaskInboxResponse {
        try await send(path: "/notifications", method: "GET")
    }

    func fetchPolyAgenda() async throws -> PolyAgenda {
        try await send(path: "/poly/agenda", method: "GET")
    }

    func fetchTeammates() async throws -> [TeammateSummary] {
        let response: TeammateListResponse = try await send(path: "/teammates", method: "GET")
        return response.data
    }

    func fetchTeammateRoster() async throws -> [TeammateRosterEntry] {
        let response: TeammateRosterResponse = try await send(path: "/teammates/roster", method: "GET")
        return response.data
    }

    func setPolyPause(contextId: String, until: Date?) async throws {
        let formatter = ISO8601DateFormatter()
        let _: PolyContextResponse = try await send(
            path: "/teammates/contexts/\(contextId)",
            method: "PATCH",
            body: PolyPauseRequest(pausedUntil: until.map { formatter.string(from: $0) })
        )
    }

    func setPolyLookAround(enabled: Bool) async throws -> PolyLookAround {
        try await send(
            path: "/poly/look-around",
            method: "PATCH",
            body: PolyLookAroundRequest(enabled: enabled, timezone: TimeZone.current.identifier)
        )
    }

    func fetchTaskNotificationSettings() async throws -> TaskNotificationSettings {
        try await send(path: "/notifications/settings", method: "GET")
    }

    func updateTaskNotificationPreferences(
        _ request: UpdateTaskNotificationPreferencesRequest
    ) async throws -> TaskNotificationSettings {
        try await send(path: "/notifications/settings", method: "PATCH", body: request)
    }

    func updateTaskInbox(itemIds: [String], action: String) async throws -> TaskInboxMutationResponse {
        try await send(
            path: "/notifications/\(action)",
            method: "POST",
            body: TaskInboxReceiptRequest(itemIds: itemIds)
        )
    }

    func fetchOutputHistory(id: String) async throws -> OutputHistoryResponse {
        try await send(path: "/outputs/\(id)/revisions", method: "GET")
    }

    func restoreOutputRevision(
        outputId: String,
        revision: Int,
        expectedRevision: Int
    ) async throws -> RestoredOutputResponse {
        try await send(
            path: "/outputs/\(outputId)/revisions/\(revision)/restore",
            method: "POST",
            body: RestoreOutputRevisionRequest(expectedRevision: expectedRevision)
        )
    }

    func createResponse(
        messages: [ChatMessage],
        modelId: String?,
        provider: String? = nil,
        conversationId: String? = nil,
        settings: ChatSettings? = nil,
        agentTeammateId: String? = nil
    ) async throws -> PlatformResponse {
        let requestBody = CreateResponseRequest(
            messages: messages,
            model: modelId,
            provider: provider,
            store: true,
            conversationId: conversationId,
            settings: settings,
            agentTeammateId: agentTeammateId
        )
        try validateResponseRequest(requestBody)

        return try await send(path: "/responses", method: "POST", body: requestBody)
    }

    func streamResponse(
        messages: [ChatMessage],
        modelId: String?,
        provider: String? = nil,
        conversationId: String? = nil,
        settings: ChatSettings? = nil,
        idempotencyKey: String = UUID().uuidString,
        modelTier: String? = nil,
        computeSite: String = "hosted",
        agentTeammateId: String? = nil
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        let requestBody = CreateResponseRequest(
            messages: messages,
            model: modelId,
            provider: provider,
            store: true,
            conversationId: conversationId,
            settings: settings,
            stream: true,
            modelTier: modelTier,
            computeSite: computeSite,
            idempotencyKey: idempotencyKey,
            agentTeammateId: agentTeammateId
        )
        guard requestBody.hasMessages else {
            return AsyncThrowingStream { continuation in
                continuation.finish(throwing: APIClientError.invalidRequest(missingChatMessagesErrorMessage))
            }
        }

        return responseStream(requestBody)
    }

    func streamApprovedConnectorOperation(
        messages: [ChatMessage],
        modelId: String?,
        provider: String?,
        conversationId: String,
        settings: ChatSettings?,
        approvalId: String,
        idempotencyKey: String,
        modelTier: String?,
        computeSite: String
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        let requestBody = CreateResponseRequest(
            messages: messages,
            model: modelId,
            provider: provider,
            store: true,
            conversationId: conversationId,
            settings: settings,
            stream: true,
            modelTier: modelTier,
            computeSite: computeSite,
            idempotencyKey: idempotencyKey,
            connectorApprovalId: approvalId
        )

        return responseStream(requestBody)
    }

    private func responseStream(
        _ requestBody: CreateResponseRequest
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task(priority: .userInitiated) {
                do {
                    try await self.stream(path: "/responses", method: "POST", body: requestBody, continuation: continuation)
                } catch {
                    continuation.finish(throwing: error)
                }
            }

            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    func fetchModels() async throws -> ModelsResponse {
        let response: ModelListResponse = try await send(
            path: "/models",
            method: "GET",
            additionalHeaders: ["Cache-Control": "no-cache"]
        )

        return Dictionary(response.data.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    }

    func fetchModelTiers() async throws -> ModelTiersResponse {
        try await send(path: "/models/tiers", method: "GET")
    }

    func fetchMachines() async throws -> [MachineRecord] {
        let response: EnvironmentListResponse<MachineRecord> = try await send(
            path: "/environments",
            method: "GET",
            queryItems: [URLQueryItem(name: "kind", value: "machine")]
        )

        return response.data.map(\.detail)
    }

    func fetchAssistantRecipes() async throws -> AssistantRecipesResponse {
        try await send(path: "/recipes", method: "GET")
    }

    func fetchWorkspaces() async throws -> [WorkspaceSummary] {
        let response: WorkspaceListResponse = try await send(path: "/workspaces", method: "GET")
        return response.data
    }

    func fetchMyModelPermissions(workspaceId: String) async throws -> MyModelPermissions {
        try await send(path: "/model_platform/workspaces/\(workspaceId)/permissions/me", method: "GET")
    }

    func fetchPendingModelDecisions(workspaceId: String) async throws -> [ModelDecisionItem] {
        let response: ModelDecisionsResponse = try await send(
            path: "/model_platform/workspaces/\(workspaceId)/decisions",
            method: "GET",
            queryItems: [URLQueryItem(name: "state", value: "pending")]
        )
        return response.decisions
    }

    func resolveModelDecision(workspaceId: String, decisionId: String, state: String) async throws {
        let _: ModelActionResult = try await send(
            path: "/model_platform/workspaces/\(workspaceId)/decisions/\(decisionId)",
            method: "PATCH",
            body: ResolveModelDecisionRequest(state: state)
        )
    }

    func fetchSpendRequests(workspaceId: String) async throws -> [SpendRequestItem] {
        let response: SpendRequestsResponse = try await send(
            path: "/model_platform/workspaces/\(workspaceId)/spend_requests",
            method: "GET"
        )
        return response.requests
    }

    func resolveSpendRequest(workspaceId: String, requestId: String, state: String) async throws {
        let _: ModelActionResult = try await send(
            path: "/model_platform/workspaces/\(workspaceId)/spend_requests/\(requestId)",
            method: "PATCH",
            body: ResolveSpendRequestBody(state: state)
        )
    }

    func fetchModelDeployments(workspaceId: String) async throws -> [ModelDeploymentItem] {
        let response: ModelDeploymentsResponse = try await send(
            path: "/model_platform/workspaces/\(workspaceId)/deployments",
            method: "GET"
        )
        return response.deployments
    }

    func changeModelDeployment(workspaceId: String, deploymentId: String, action: String) async throws {
        let _: ModelActionResult = try await send(
            path: "/model_platform/workspaces/\(workspaceId)/deployments/\(deploymentId)/actions",
            method: "POST",
            body: DeploymentActionRequest(action: action)
        )
    }

    func fetchWorkAttention(limit: Int = 25) async throws -> WorkAttentionResponse {
        try await send(
            path: "/attention",
            method: "GET",
            queryItems: [URLQueryItem(name: "limit", value: String(limit))]
        )
    }

    func fetchSandboxRun(id: String) async throws -> SandboxRunDetail {
        let response: EnvironmentResponse<SandboxRunDetail> = try await send(
            path: "/environments/\(id)",
            method: "GET",
            queryItems: [URLQueryItem(name: "kind", value: "sandbox")]
        )

        return response.detail
    }

    func acceptProjectTask(projectId: String, taskId: String) async throws -> ProjectTaskResponse {
        try await send(
            path: "/projects/\(projectId)/tasks/\(taskId)/accept",
            method: "POST",
            emptyBody: true
        )
    }

    func fetchSandboxRunEvents(id: String) async throws -> SandboxRunEventsResponse {
        try await send(path: "/environments/\(id)/events", method: "GET")
    }

    func fetchSandboxRunInstructions(id: String) async throws -> SandboxRunInstructionsResponse {
        try await send(path: "/environments/\(id)/instructions", method: "GET")
    }

    func fetchSandboxRunControl(id: String) async throws -> SandboxRunControl {
        try await send(path: "/environments/\(id)/control", method: "GET")
    }

    func sendSandboxRunInstruction(
        id: String,
        kind: String,
        content: String? = nil,
        requestId: String? = nil,
        approvalStatus: String? = nil
    ) async throws -> SandboxRunInstructionResponse {
        try await send(
            path: "/environments/\(id)/instructions",
            method: "POST",
            body: SubmitSandboxRunInstructionRequest(
                kind: kind,
                idempotencyKey: UUID().uuidString,
                content: content,
                requestId: requestId,
                approvalStatus: approvalStatus
            )
        )
    }

    func updateSandboxRunControl(
        id: String,
        action: String,
        expectedUpdatedAt: String
    ) async throws -> SandboxRunControl {
        try await send(
            path: "/environments/\(id)/actions",
            method: "POST",
            queryItems: [URLQueryItem(name: "kind", value: "sandbox")],
            body: EnvironmentActionRequest(
                action: action,
                expectedUpdatedAt: expectedUpdatedAt
            )
        )
    }

    func registerMobilePushDevice(token: String, environment: String) async throws {
        let _: EmptyResponse = try await send(
            path: "/devices",
            method: "POST",
            body: RegisterMobilePushDeviceRequest(
                token: token,
                environment: environment,
                appBundleId: Bundle.main.bundleIdentifier ?? "app.polychat"
            )
        )
    }

    func unregisterMobilePushDevice(token: String) async throws {
        let _: EmptyResponse = try await send(path: "/devices/\(token)", method: "DELETE")
    }

    func installAssistantRecipe(
        id: String,
        triggers: [RecipeInstallationTrigger]? = nil,
        configuration: RecipeConfiguration? = nil
    ) async throws -> AssistantRecipeInstallResponse {
        try await send(
            path: "/recipes/\(id)/install",
            method: "POST",
            body: AssistantRecipeInstallRequest(
                channel: "ios",
                triggers: triggers,
                configuration: configuration
            )
        )
    }

    func generateTitle(conversationId: String, messages: [ChatMessage]) async throws -> TitleGenerationResponse {
        try await send(
            path: "/conversations/\(conversationId)/title",
            method: "POST",
            body: TitleGenerationRequest(messages: messages)
        )
    }

    func reactToItem(
        conversationId: String,
        itemId: String,
        emoji: String,
        remove: Bool
    ) async throws -> ItemReactionEnvelope {
        try await send(
            path: "/conversations/\(conversationId)/reactions",
            method: "POST",
            body: ItemReactionRequest(itemId: itemId, emoji: emoji, remove: remove)
        )
    }

    func fetchConversations(
        limit: Int = 50,
        after: String? = nil,
        includeArchived: Bool = false
    ) async throws -> ConversationListResponse {
        var queryItems = [
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "archived", value: includeArchived ? "all" : "active")
        ]

        if let after {
            queryItems.append(URLQueryItem(name: "after", value: after))
        }

        return try await send(path: "/conversations", method: "GET", queryItems: queryItems)
    }

    func fetchConversation(
        id: String,
        refreshPending: Bool = true
    ) async throws -> ConversationDetailResponse {
        var queryItems = [URLQueryItem(name: "item_limit", value: "100")]

        if refreshPending {
            queryItems.insert(URLQueryItem(name: "refresh_pending", value: "true"), at: 0)
        }

        return try await send(
            path: "/conversations/\(id)",
            method: "GET",
            queryItems: queryItems
        )
    }

    func fetchConversationMessages(
        id: String,
        before: String,
        limit: Int = 100
    ) async throws -> ConversationMessagePageResponse {
        try await send(
            path: "/conversations/\(id)/items",
            method: "GET",
            queryItems: [
                URLQueryItem(name: "before", value: before),
                URLQueryItem(name: "limit", value: String(limit))
            ]
        )
    }

    func fetchResponseSnapshot(id: String) async throws -> ResponseSnapshot {
        try await send(path: "/responses/\(id)", method: "GET")
    }

    func fetchResponseEvents(
        id: String,
        after: Int,
        limit: Int = 100
    ) async throws -> ResponseReplayResponse {
        try await send(
            path: "/responses/\(id)/events",
            method: "GET",
            queryItems: [
                URLQueryItem(name: "after", value: String(after)),
                URLQueryItem(name: "limit", value: String(limit))
            ]
        )
    }

    func cancelResponse(
        id: String,
        expectedAttempt: Int,
        idempotencyKey: String = UUID().uuidString
    ) async throws -> PlatformResponse {
        try await send(
            path: "/responses/\(id)/cancel",
            method: "POST",
            body: CancelResponseRequest(expectedAttempt: expectedAttempt, idempotencyKey: idempotencyKey)
        )
    }

    func fetchConnectorApproval(id: String) async throws -> ConnectorOperationApproval {
        try await send(path: "/approvals/\(id)", method: "GET")
    }

    func resolveConnectorApproval(
        id: String,
        resolution: String
    ) async throws -> ConnectorApprovalResolution {
        try await send(
            path: "/approvals/\(id)",
            method: "PATCH",
            body: ResolveApprovalRequest(state: resolution)
        )
    }

    func fetchProjectTask(projectId: String, taskId: String) async throws -> ProjectTaskDetailResponse {
        try await send(path: "/projects/\(projectId)/tasks/\(taskId)", method: "GET")
    }

    func answerProjectTaskQuestions(
        projectId: String,
        taskId: String,
        interactionId: String,
        answers: [UserQuestionAnswer]
    ) async throws -> ProjectTaskResponse {
        try await sendProjectTaskInteraction(
            projectId: projectId,
            taskId: taskId,
            toolName: "ask_user",
            payload: AnswerProjectTaskQuestionsRequest(interactionId: interactionId, answers: answers)
        )
    }

    func resolveProjectTaskApproval(
        projectId: String,
        taskId: String,
        interactionId: String,
        resolution: String
    ) async throws -> ProjectTaskResponse {
        try await sendProjectTaskInteraction(
            projectId: projectId,
            taskId: taskId,
            toolName: "tool_approval",
            payload: ResolveProjectTaskApprovalRequest(interactionId: interactionId, resolution: resolution)
        )
    }

    private func sendProjectTaskInteraction<Payload: Encodable>(
        projectId: String,
        taskId: String,
        toolName: String,
        payload: Payload
    ) async throws -> ProjectTaskResponse {
        let detail = try await fetchProjectTask(projectId: projectId, taskId: taskId)

        guard let responseId = detail.task.runId else {
            throw APIClientError.invalidRequest("This task has no response waiting for input.")
        }

        let _: PlatformResponse = try await send(
            path: "/responses/\(responseId)/input",
            method: "POST",
            body: ResponseInteractionRequest(
                input: [InteractionResponseItem(toolName: toolName, response: payload)]
            )
        )

        return ProjectTaskResponse(task: try await fetchProjectTask(projectId: projectId, taskId: taskId).task)
    }

    func updateConversation(
        id: String,
        title: String? = nil,
        messages: [ChatMessage]? = nil,
        parentConversationId: String? = nil,
        parentMessageId: String? = nil
    ) async throws {
        let _: EmptyResponse = try await send(
            path: "/conversations/\(id)",
            method: "PATCH",
            body: UpdateConversationRequest(
                title: title,
                messages: messages,
                parentConversationId: parentConversationId,
                parentMessageId: parentMessageId
            )
        )
    }

    func deleteConversation(id: String) async throws {
        let _: SuccessResponse = try await send(path: "/conversations/\(id)", method: "DELETE")
    }

    func uploadFile(
        data: Data,
        fileName: String,
        mimeType: String,
        fileType: String,
        convertToMarkdown: Bool = false,
        conversionOptions: MarkdownConversionOptions? = nil
    ) async throws -> UploadResponse {
        var formData = MultipartFormData()
        formData.appendFile(
            name: "file",
            fileName: fileName,
            mimeType: mimeType,
            data: data
        )
        formData.appendField(name: "file_type", value: fileType)
        if convertToMarkdown {
            formData.appendField(name: "convert_to_markdown", value: "true")
        }
        if let conversionOptions {
            let optionsData = try JSONEncoder().encode(conversionOptions)
            formData.appendField(
                name: "conversion_options",
                value: String(decoding: optionsData, as: UTF8.self)
            )
        }

        return try await send(
            path: "/uploads",
            method: "POST",
            bodyData: formData.finalizedBody(),
            contentType: formData.contentType
        )
    }

    func transcribeAudio(data: Data, fileName: String, mimeType: String) async throws -> TranscriptionResponse {
        var formData = MultipartFormData()
        formData.appendFile(
            name: "audio",
            fileName: fileName,
            mimeType: mimeType,
            data: data
        )

        return try await send(
            path: "/audio/transcribe",
            method: "POST",
            bodyData: formData.finalizedBody(),
            contentType: formData.contentType
        )
    }

    func generateSpeech(input: String, store: Bool = true) async throws -> SpeechGenerationResponse {
        let envelope: SpeechGenerationEnvelope = try await send(
            path: "/audio/speech",
            method: "POST",
            body: SpeechGenerationRequest(input: input, store: store)
        )

        return envelope.response
    }

    func initialize() async throws {
        if authToken == nil, let storedToken = try KeychainTokenStore.shared.load(), storedToken.isUsable {
            authToken = storedToken.value
        }
    }

    private func send<T: Decodable, Body: Encodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        body: Body
    ) async throws -> T {
        let bodyData = try JSONEncoder().encode(body)
        return try await send(
            path: path,
            method: method,
            queryItems: queryItems,
            bodyData: bodyData,
            contentType: "application/json"
        )
    }

    private func send<T: Decodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        emptyBody: Bool = false,
        additionalHeaders: [String: String] = [:]
    ) async throws -> T {
        try await send(
            path: path,
            method: method,
            queryItems: queryItems,
            bodyData: emptyBody ? Data("{}".utf8) : nil,
            contentType: emptyBody ? "application/json" : nil,
            additionalHeaders: additionalHeaders
        )
    }

    private func send<T: Decodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        bodyData: Data?,
        contentType: String?,
        additionalHeaders: [String: String] = [:]
    ) async throws -> T {
        let request = makeRequest(
            path: path,
            method: method,
            queryItems: queryItems,
            bodyData: bodyData,
            contentType: contentType,
            additionalHeaders: additionalHeaders
        )

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)

        return try decodeResponse(T.self, from: data)
    }

    private func stream<Body: Encodable>(
        path: String,
        method: String,
        body: Body,
        continuation: AsyncThrowingStream<ChatStreamEvent, Error>.Continuation
    ) async throws {
        let bodyData = try JSONEncoder().encode(body)
        let request = makeRequest(
            path: path,
            method: method,
            bodyData: bodyData,
            contentType: "application/json",
            additionalHeaders: [
                "Accept": "text/event-stream",
                "Accept-Encoding": "identity",
                "Cache-Control": "no-cache"
            ]
        )

        let streamClient = URLSessionStreamClient(configuration: session.configuration, request: request)
        var response: URLResponse?
        var responseData = Data()
        var isServerSentEventResponse = false
        var eventParser = ChatStreamEventChunkParser()

        for try await streamEvent in streamClient.stream() {
            switch streamEvent {
            case .response(let urlResponse):
                response = urlResponse
                let contentType = (urlResponse as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Type") ?? ""
                let isSuccessfulHTTPResponse = (urlResponse as? HTTPURLResponse)
                    .map { (200...299).contains($0.statusCode) } ?? true
                isServerSentEventResponse = isSuccessfulHTTPResponse &&
                    contentType.localizedCaseInsensitiveContains("text/event-stream")
            case .data(let data):
                if isServerSentEventResponse {
                    yieldStreamEvents(from: try eventParser.append(data), continuation: continuation)
                } else {
                    responseData.append(data)
                }
            }
        }

        guard let response else {
            throw URLError(.badServerResponse)
        }

        try validate(response: response, data: responseData)

        if isServerSentEventResponse {
            yieldStreamEvents(from: try eventParser.finish(), continuation: continuation)
            continuation.finish()
        } else {
            let response = try decodeResponse(PlatformResponse.self, from: responseData)
            continuation.yield(.response(response))
            let content = response.lastAssistantText ?? ""
            if !content.isEmpty {
                continuation.yield(.content(content))
            }
            continuation.yield(.done)
            continuation.finish()
        }
    }

    private func yieldStreamEvents(
        from events: [ChatStreamEvent],
        continuation: AsyncThrowingStream<ChatStreamEvent, Error>.Continuation
    ) {
        for event in events {
            continuation.yield(event)
        }
    }

    private func makeRequest(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        bodyData: Data?,
        contentType: String?,
        additionalHeaders: [String: String] = [:]
    ) -> URLRequest {
        var request = URLRequest(url: buildURL(path: path, queryItems: queryItems))
        request.httpMethod = method
        request.setValue("mobile", forHTTPHeaderField: "X-Platform")
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")

        if let contentType {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }

        if let authToken {
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }

        for (field, value) in additionalHeaders {
            request.setValue(value, forHTTPHeaderField: field)
        }

        request.httpBody = bodyData
        return request
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            return
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let message = decodeErrorMessage(from: data) ?? HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
            throw APIClientError.httpStatus(httpResponse.statusCode, message)
        }
    }

    private func decodeErrorMessage(from data: Data) -> String? {
        guard !data.isEmpty else {
            return nil
        }

        if let errorResponse = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
            return errorResponse.message ?? errorResponse.error
        }

        return String(data: data, encoding: .utf8)
    }

    private func decodeResponse<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        let responseData = data.isEmpty ? Data("{}".utf8) : data
        let decoder = JSONDecoder()

        do {
            return try decoder.decode(type, from: responseData)
        } catch {
            if let envelope = try? decoder.decode(APIDataEnvelope<T>.self, from: responseData) {
                return envelope.data
            }
            throw error
        }
    }

    private func validateResponseRequest(_ request: CreateResponseRequest) throws {
        guard request.hasMessages else {
            throw APIClientError.invalidRequest(missingChatMessagesErrorMessage)
        }
    }

    private func buildURL(path: String, queryItems: [URLQueryItem] = []) -> URL {
        let trimmedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        var components = URLComponents(url: baseURL.appendingPathComponent(trimmedPath), resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        return components.url!
    }

    private static func defaultBaseURL() -> URL {
        if let rawValue = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String,
           let url = URL(string: rawValue) {
            return url
        }

        return URL(string: "https://api.polychat.app")!
    }

    private static func defaultUserAgent() -> String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        return "Polychat/\(version) CFNetwork Darwin"
    }
}

private struct EmptyResponse: Decodable {}

private struct APIErrorResponse: Decodable {
    let error: String?
    let message: String?
}

private struct APIDataEnvelope<T: Decodable>: Decodable {
    let data: T
}

enum APIClientError: LocalizedError {
    case invalidRequest(String)
    case httpStatus(Int, String)
    case streaming(String)

    var errorDescription: String? {
        switch self {
        case .invalidRequest(let message):
            return message
        case .httpStatus(let status, let message):
            return "API returned \(status): \(message)"
        case .streaming(let message):
            return message
        }
    }
}
