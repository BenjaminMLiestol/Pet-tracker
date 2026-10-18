import Foundation

// What the app hands the widget, as JSON text under one key in the shared App Group storage.
// Counts are worked out here from recent timestamps, in the dog's own timezone, so the widget
// shows the right day by itself after midnight even if the app has not been opened.

let appGroupId = "group.com.benjaminliestol.pettracker"
let snapshotKey = "petSnapshot"
let pendingKey = "pendingLogs"

struct Snapshot: Codable {
	var petId: Int
	var name: String
	var tz: String
	var feedGoal: Int
	var walkGoal: Int
	// Milliseconds since 1970, the last few days.
	var feedings: [Double]
	var walks: [Double]
	// API root including the version, e.g. https://host/api/v1
	var api: String
	var token: String
	var updatedAt: Double
}

// A log made from the widget that could not be sent (no connection). The app sends it later.
struct PendingLog: Codable {
	var id: String
	var kind: String // "feeding" or "walk"
	var petId: Int
	var at: Double
}

enum Store {
	static var defaults: UserDefaults? { UserDefaults(suiteName: appGroupId) }

	static func loadSnapshot() -> Snapshot? {
		guard let text = defaults?.string(forKey: snapshotKey), let data = text.data(using: .utf8) else { return nil }
		return try? JSONDecoder().decode(Snapshot.self, from: data)
	}

	static func save(_ snapshot: Snapshot) {
		guard let data = try? JSONEncoder().encode(snapshot), let text = String(data: data, encoding: .utf8) else { return }
		defaults?.set(text, forKey: snapshotKey)
	}

	static func loadPending() -> [PendingLog] {
		guard let text = defaults?.string(forKey: pendingKey), let data = text.data(using: .utf8) else { return [] }
		return (try? JSONDecoder().decode([PendingLog].self, from: data)) ?? []
	}

	static func addPending(_ log: PendingLog) {
		var all = loadPending()
		all.append(log)
		guard let data = try? JSONEncoder().encode(all), let text = String(data: data, encoding: .utf8) else { return }
		defaults?.set(text, forKey: pendingKey)
	}
}

extension Snapshot {
	private var calendar: Calendar {
		var c = Calendar(identifier: .gregorian)
		c.timeZone = TimeZone(identifier: tz) ?? .current
		return c
	}

	/// How many of `stamps` fall on today's date in the dog's timezone.
	func countToday(_ stamps: [Double], now: Date = Date()) -> Int {
		stamps.filter { calendar.isDate(Date(timeIntervalSince1970: $0 / 1000), inSameDayAs: now) }.count
	}

	func fedToday(now: Date = Date()) -> Int { countToday(feedings, now: now) }
	func walkedToday(now: Date = Date()) -> Int { countToday(walks, now: now) }

	/// Just after the next midnight in the dog's timezone, when the counts start again from zero.
	func nextMidnight(after now: Date = Date()) -> Date {
		let start = calendar.startOfDay(for: now)
		let next = calendar.date(byAdding: .day, value: 1, to: start) ?? now.addingTimeInterval(3600)
		return next.addingTimeInterval(60)
	}
}

/// Norwegian if that is the phone's language, otherwise English.
enum Words {
	static var norwegian: Bool {
		let lang = Locale.preferredLanguages.first ?? "en"
		return lang.hasPrefix("nb") || lang.hasPrefix("no") || lang.hasPrefix("nn")
	}
	static var fed: String { norwegian ? "Matet" : "Fed" }
	static var walked: String { norwegian ? "Tur" : "Walks" }
	static var openApp: String { norwegian ? "Åpne Pet Tracker" : "Open Pet Tracker" }
	static var signIn: String { norwegian ? "Logg inn i appen først" : "Sign in to the app first" }
	static var logFeeding: String { norwegian ? "Logg mating" : "Log feeding" }
	static var logWalk: String { norwegian ? "Logg tur" : "Log a walk" }
	static var widgetName: String { norwegian ? "I dag" : "Today" }
	static var widgetDescription: String {
		norwegian ? "Matinger og turer i dag, med knapper for å logge." : "Today's feedings and walks, with buttons to log them."
	}
}
