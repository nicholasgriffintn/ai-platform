import SwiftUI

struct DiscoverDayRoutineEditor: View {
    @Binding var profile: DiscoverDayProfile

    var body: some View {
        Form {
            Section("Your usual week") {
                ForEach($profile.week) { $day in
                    DisclosureGroup {
                        Picker("Routine", selection: $day.mode) {
                            ForEach(DiscoverDayMode.allCases) { Text($0.label).tag($0) }
                        }
                        if day.mode != .off {
                            DiscoverClockField("Start work", value: $day.start)
                            DiscoverClockField("Finish work", value: $day.end)
                            if day.mode == .office {
                                DiscoverClockField("Leave for work", value: $day.outbound)
                                DiscoverClockField("Leave for home", value: $day.returning)
                            }
                        }
                    } label: {
                        LabeledContent(Calendar.current.weekdaySymbols[day.weekday], value: day.mode.label)
                    }
                }
            }
            Section("Timezone") {
                TextField("Timezone", text: $profile.timezone)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Button("Use this device") { profile.timezone = TimeZone.current.identifier }
            }
        }
        .navigationTitle("Your usual week")
    }
}

struct DiscoverDayCatchUpEditor: View {
    @Binding var moments: DiscoverDayProfile.Moments

    var body: some View {
        Form {
            Section {
                DiscoverClockField("Morning", value: $moments.morning)
                DiscoverClockField("Lunch", value: $moments.lunch)
                DiscoverClockField("Afternoon", value: $moments.afternoon)
                DiscoverClockField("Evening", value: $moments.evening)
            } footer: {
                Text("Useful stories and priorities around these times. Discover also checks for changes between catch-ups.")
            }
        }
        .navigationTitle("Catch-up times")
    }
}

struct DiscoverDayAudioEditor: View {
    @Binding var audio: DiscoverDayProfile.Audio

    var body: some View {
        Form {
            Section {
                Toggle("Morning podcast", isOn: $audio.morning.enabled)
                if audio.morning.enabled { DiscoverClockField("Record at", value: $audio.morning.time) }
            }
            Section {
                Toggle("Evening podcast", isOn: $audio.evening.enabled)
                if audio.evening.enabled { DiscoverClockField("Record at", value: $audio.evening.time) }
            } footer: {
                Text("Choose when The Perch is recorded. Your feed keeps updating between podcasts.")
            }
        }
        .navigationTitle("Podcasts")
    }
}

struct DiscoverDayNotificationsEditor: View {
    @Binding var notifications: DiscoverDayProfile.Notifications

    var body: some View {
        Form {
            Section {
                Toggle("Allow Discover notifications", isOn: $notifications.enabled)
            } footer: {
                Text("Discover keeps updating when notifications are off.")
            }
            if notifications.enabled {
                Section("Tell me about") {
                    Toggle("Commute disruption", isOn: $notifications.commute)
                    Toggle("Weather changes", isOn: $notifications.weather)
                    Toggle("Important topic updates", isOn: $notifications.news)
                    Toggle("Podcast releases", isOn: $notifications.briefings)
                }
                Section("When to notify") {
                    Stepper("Up to \(notifications.dailyLimit) a day", value: $notifications.dailyLimit, in: 0...2)
                    DiscoverClockField("Quiet from", value: $notifications.quietStart)
                    DiscoverClockField("Until", value: $notifications.quietEnd)
                    Toggle("Keep working hours quiet", isOn: $notifications.quietWhileWorking)
                }
                Section {
                    Button("Allow notifications on this iPhone") {
                        Task { await PushNotificationManager.shared.enableForAuthenticatedUser() }
                    }
                }
            }
        }
        .navigationTitle("Notifications")
    }
}

struct DiscoverDayOverrideEditor: View {
    let profile: DiscoverDayProfile
    let onSave: (DiscoverDayProfile.Override?, String?) -> Void
    @State private var date = Date()
    @State private var mode = DiscoverDayMode.off

    private var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: profile.timezone) ?? .current
        return value
    }

    var body: some View {
        Form {
            Section {
                DatePicker("Date", selection: $date, in: Date()..., displayedComponents: .date)
                    .environment(\.timeZone, calendar.timeZone)
                Picker("Routine", selection: $mode) {
                    ForEach(DiscoverDayMode.allCases) { Text($0.label).tag($0) }
                }
                Button("Save this day") {
                    onSave(.init(date: CalendarDate.string(from: date, calendar: calendar), mode: mode), nil)
                }
            } footer: {
                Text("Your usual week stays the same.")
            }
            if !profile.overrides.isEmpty {
                Section("Planned changes") {
                    ForEach(profile.overrides, id: \.date) { item in
                        HStack {
                            Text("\(item.date) · \(item.mode.label)")
                            Spacer()
                            Button("Remove") { onSave(nil, item.date) }
                        }
                    }
                }
            }
        }
        .navigationTitle("Change a single day")
    }
}

struct DiscoverClockField: View {
    let title: String
    @Binding var value: String

    init(_ title: String, value: Binding<String>) {
        self.title = title
        _value = value
    }

    var body: some View {
        DatePicker(title, selection: Binding(
            get: { ClockTime.date(from: value) },
            set: { value = ClockTime.string(from: $0) }
        ), displayedComponents: .hourAndMinute)
    }
}

struct DiscoverDayLinesEditor: View {
    @Binding var lineStatus: DiscoverDayProfile.LineStatus

    var body: some View {
        Form {
            Section {
                Toggle("Show line status", isOn: $lineStatus.enabled)
                Toggle("Include lines near me", isOn: $lineStatus.nearby)
                    .disabled(!lineStatus.enabled)
            } footer: {
                Text("Nearby lines need Where I am turned on for the Today widget in Settings.")
            }
            Section("Lines I use") {
                ForEach(DiscoverTransitLine.all) { line in
                    let chosen = lineStatus.lines.contains(line.id)
                    Button {
                        lineStatus.lines = chosen
                            ? lineStatus.lines.filter { $0 != line.id }
                            : lineStatus.lines + [line.id]
                    } label: {
                        HStack {
                            Text(line.name).foregroundStyle(.primary)
                            Spacer()
                            if chosen { Image(systemName: "checkmark").foregroundStyle(.tint) }
                        }
                    }
                    .disabled(!lineStatus.enabled || (!chosen && lineStatus.lines.count >= 12))
                }
            }
        }
        .navigationTitle("Line status")
    }
}
