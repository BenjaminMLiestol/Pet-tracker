import AppIntents
import Foundation
import WidgetKit

// The widget's buttons. They run in the widget's own process, without opening the app: one
// request to the API with the saved login. The count on the widget goes up at once; if there
// is no connection the entry is queued, and the app sends it the next time it opens.

enum LogError: Error { case notSignedIn }

enum LogService {
	static func log(kind: String) async throws {
		guard var snapshot = Store.loadSnapshot(), !snapshot.token.isEmpty else { throw LogError.notSignedIn }

		let now = Date()
		let id = UUID().uuidString.lowercased()
		let when = ISO8601DateFormatter().string(from: now)
		let path = kind == "walk" ? "/walks" : "/feedings"
		var body: [String: Any] = ["pet_id": snapshot.petId, "client_id": id]
		if kind == "walk" {
			body["walk_check"] = true
			body["walked_at"] = when
		} else {
			body["feed_check"] = true
			body["fed_at"] = when
		}

		var sent = false
		var queued = false
		if let url = URL(string: snapshot.api + path) {
			var request = URLRequest(url: url, timeoutInterval: 10)
			request.httpMethod = "POST"
			request.setValue("application/json", forHTTPHeaderField: "Content-Type")
			request.setValue("application/json", forHTTPHeaderField: "Accept")
			request.setValue("Bearer \(snapshot.token)", forHTTPHeaderField: "Authorization")
			request.httpBody = try? JSONSerialization.data(withJSONObject: body)
			do {
				let (_, response) = try await URLSession.shared.data(for: request)
				let status = (response as? HTTPURLResponse)?.statusCode ?? 0
				sent = (200..<300).contains(status)
				// A server answer that is not a success (an expired login, a refused entry) is not
				// queued: sending the same thing again would fail the same way.
			} catch {
				queued = true
			}
		}

		if sent || queued {
			let ms = now.timeIntervalSince1970 * 1000
			if kind == "walk" { snapshot.walks.append(ms) } else { snapshot.feedings.append(ms) }
			snapshot.updatedAt = ms
			Store.save(snapshot)
		}
		if queued {
			Store.addPending(PendingLog(id: id, kind: kind, petId: snapshot.petId, at: now.timeIntervalSince1970 * 1000))
		}
		WidgetCenter.shared.reloadAllTimelines()
	}
}

struct LogWalkIntent: AppIntent {
	static var title: LocalizedStringResource = "Log a walk"
	static var description = IntentDescription("Logs a walk for your dog, right now.")

	func perform() async throws -> some IntentResult {
		try await LogService.log(kind: "walk")
		return .result()
	}
}

struct LogFeedingIntent: AppIntent {
	static var title: LocalizedStringResource = "Log a feeding"
	static var description = IntentDescription("Logs a feeding for your dog, right now.")

	func perform() async throws -> some IntentResult {
		try await LogService.log(kind: "feeding")
		return .result()
	}
}
