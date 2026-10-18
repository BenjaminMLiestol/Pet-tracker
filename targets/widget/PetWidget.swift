import AppIntents
import SwiftUI
import WidgetKit

struct PetEntry: TimelineEntry {
	let date: Date
	let snapshot: Snapshot?
}

struct PetProvider: TimelineProvider {
	func placeholder(in context: Context) -> PetEntry {
		PetEntry(date: Date(), snapshot: PetProvider.sample)
	}

	func getSnapshot(in context: Context, completion: @escaping (PetEntry) -> Void) {
		completion(PetEntry(date: Date(), snapshot: context.isPreview ? PetProvider.sample : Store.loadSnapshot()))
	}

	func getTimeline(in context: Context, completion: @escaping (Timeline<PetEntry>) -> Void) {
		let now = Date()
		let snapshot = Store.loadSnapshot()
		// Redraw when the day rolls over (counts restart) and at least every half hour, in case a
		// co-owner logged something and the app refreshed the shared data.
		var next = now.addingTimeInterval(30 * 60)
		if let s = snapshot { next = min(next, s.nextMidnight(after: now)) }
		completion(Timeline(entries: [PetEntry(date: now, snapshot: snapshot)], policy: .after(next)))
	}

	static let sample = Snapshot(
		petId: 0, name: "Toya", tz: "Europe/Oslo", feedGoal: 1, walkGoal: 2,
		feedings: [], walks: [Date().timeIntervalSince1970 * 1000], api: "", token: "", updatedAt: 0
	)
}

/// One row/column of the widget: what it counts, how far the day is, and a button to log one more.
struct CounterView: View {
	let symbol: String
	let label: String
	let count: Int
	let goal: Int
	let intent: any AppIntent
	let compact: Bool

	var body: some View {
		HStack(spacing: 8) {
			Image(systemName: symbol)
				.font(.system(size: compact ? 15 : 18, weight: .semibold))
				.foregroundStyle(Color("Honey"))
				.frame(width: compact ? 18 : 22)
			VStack(alignment: .leading, spacing: 0) {
				HStack(spacing: 3) {
					Text("\(count)")
						.font(.system(size: compact ? 20 : 26, weight: .bold, design: .rounded))
						.foregroundStyle(count == 0 ? Color("Muted") : Color.primary)
					Text("/\(goal)")
						.font(.system(size: compact ? 12 : 14, weight: .semibold, design: .rounded))
						.foregroundStyle(Color("Muted"))
					if count >= goal {
						Image(systemName: "checkmark.circle.fill")
							.font(.system(size: compact ? 12 : 14))
							.foregroundStyle(.green)
					}
				}
				Text(label)
					.font(.system(size: 11))
					.foregroundStyle(Color("Muted"))
			}
			Spacer(minLength: 0)
			Button(intent: intent) {
				Image(systemName: "plus")
					.font(.system(size: 13, weight: .bold))
					.foregroundStyle(.white)
					.frame(width: 28, height: 28)
					.background(Circle().fill(Color("AccentColor")))
			}
			.buttonStyle(.plain)
		}
	}
}

struct PetWidgetView: View {
	let entry: PetEntry
	@Environment(\.widgetFamily) private var family

	var body: some View {
		if let s = entry.snapshot {
			content(s)
		} else {
			VStack(spacing: 6) {
				Image(systemName: "pawprint.fill").foregroundStyle(Color("Honey"))
				Text(Words.signIn)
					.font(.system(size: 12, weight: .medium))
					.multilineTextAlignment(.center)
					.foregroundStyle(Color("Muted"))
			}
		}
	}

	@ViewBuilder
	private func content(_ s: Snapshot) -> some View {
		let fed = s.fedToday(now: entry.date)
		let walked = s.walkedToday(now: entry.date)
		let feeding = CounterView(
			symbol: "fork.knife", label: Words.fed, count: fed, goal: s.feedGoal,
			intent: LogFeedingIntent(), compact: family == .systemSmall
		)
		let walk = CounterView(
			symbol: "figure.walk", label: Words.walked, count: walked, goal: s.walkGoal,
			intent: LogWalkIntent(), compact: family == .systemSmall
		)
		VStack(alignment: .leading, spacing: 10) {
			HStack(spacing: 5) {
				Image(systemName: "pawprint.fill").font(.system(size: 12)).foregroundStyle(Color("Honey"))
				Text(s.name).font(.system(size: 15, weight: .bold)).lineLimit(1)
				Spacer(minLength: 0)
			}
			if family == .systemMedium {
				HStack(spacing: 18) {
					feeding
					walk
				}
			} else {
				feeding
				walk
			}
		}
	}
}

@main
struct PetWidgetBundle: WidgetBundle {
	var body: some Widget {
		PetWidget()
	}
}

struct PetWidget: Widget {
	let kind = "PetWidget"

	var body: some WidgetConfiguration {
		StaticConfiguration(kind: kind, provider: PetProvider()) { entry in
			PetWidgetView(entry: entry)
				.containerBackground(Color("WidgetBackground"), for: .widget)
		}
		.configurationDisplayName(Words.widgetName)
		.description(Words.widgetDescription)
		.supportedFamilies([.systemSmall, .systemMedium])
	}
}
