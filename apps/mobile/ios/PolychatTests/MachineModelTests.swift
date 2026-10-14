import Foundation
import Testing
@testable import Polychat

struct MachineModelTests {
    @Test func decodesAdvertisedMachineCapabilities() throws {
        let model = try JSONDecoder().decode(MachineModel.self, from: Data("""
        {"nativeId":"gemma3:1b","displayName":"Gemma","contextTokens":null,
         "capabilities":{"tools":false,"vision":false,"thinking":false},"loaded":true}
        """.utf8))
        #expect(model.nativeId == "gemma3:1b")
        #expect(model.capabilities.vision == false)
    }
}
