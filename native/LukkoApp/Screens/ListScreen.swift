import SwiftUI
import LukkoKit

/// これから・まだ・探す（Web 版の screen='list'）
struct ListScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @FocusState private var searchFocused: Bool

    var body: some View {
        let v = model.engine.listView(dark: model.dark)
        List {
            Section {
                Picker("一覧", selection: Binding(get: { v.tab }, set: { k in model.act { $0.setListTab(k) } })) {
                    ForEach(v.seg, id: \.key) { Text($0.label).tag($0.key) }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                if v.tab == "upcoming" {
                    Toggle("点線（まだ）だけ", isOn: Binding(get: { v.dashOnly }, set: { _ in model.act { $0.toggleDashOnly() } }))
                }
                if v.tab == "search" {
                    TextField("題名・場所・メモで探す", text: Binding(get: { v.searchQ }, set: { s in model.act { $0.setSearchQ(s) } }))
                        .focused($searchFocused)
                        .submitLabel(.search)
                        .onAppear { searchFocused = true }
                }
            }
            if v.tab == "undecided" && !v.shelf.isEmpty {
                Section("日にちが、まだ決まっていない") {
                    ForEach(v.shelf, id: \.key) { s in
                        HStack {
                            Circle().fill(ink.css(s.dot)).frame(width: 8, height: 8)
                            VStack(alignment: .leading) { Text(s.title); Text(s.when).font(.caption).foregroundStyle(.secondary) }
                            Spacer()
                            Button("日を決める") { model.act { $0.openSomedayPick(s.key) } }.buttonStyle(.bordered).font(.footnote)
                        }
                        .swipeActions { Button("消す", role: .destructive) { model.act { $0.dropSomeday(s.key) } } }
                    }
                }
            }
            ForEach(Array(v.groups.enumerated()), id: \.offset) { _, g in
                Section(g.head) {
                    ForEach(g.rows, id: \.key) { r in ListRowView(row: r) }
                }
            }
            if !v.empty.isEmpty {
                Text(v.empty).foregroundStyle(.secondary).frame(maxWidth: .infinity).listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .navigationDestination(isPresented: Binding(get: { model.state["screen"] == "detail" && model.state["returnTo"] == "list" },
                                                    set: { on in if !on && model.state["screen"] == "detail" { model.act { $0.detailBack() } } })) { DetailScreen() }
        .navigationTitle("予定の一覧")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: Binding(get: { JS.truthy(model.state["somedayPick"]) }, set: { on in if !on { model.act { $0.set(["somedayPick": .null]) } } })) {
            SomedayPickSheet().environment(\.ink, ink)
        }
    }
}

struct ListRowView: View {
    let row: ListView.Row
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        HStack(spacing: 12) {
            VStack(spacing: 1) {
                Text(row.date).font(.subheadline.weight(.semibold)).monospacedDigit()
                Text(row.dow).font(.caption2).foregroundStyle(.secondary)
            }
            .frame(width: 44)
            VStack(alignment: .leading, spacing: 4) {
                Text(row.time).font(.caption).monospacedDigit().foregroundStyle(.secondary)
                Text(row.title).font(.system(size: 14)).lineLimit(1).padding(.horizontal, 8).padding(.vertical, 2)
                    .foregroundStyle(ink.css(row.pill["color"]?.string))
                    .background(ink.css(row.pill["background"]?.string), in: RoundedRectangle(cornerRadius: 6))
                    .overlay { if row.dashed { RoundedRectangle(cornerRadius: 6).strokeBorder(ink.css(String(row.pill["border"]?.string?.split(separator: " ").last ?? "")), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])) } }
                if !row.place.isEmpty { Text(row.place).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
            }
            Spacer(minLength: 0)
            if row.dashed {
                VStack(spacing: 6) {
                    Button("決まった") { open(confirm: true) }.buttonStyle(.borderedProminent).controlSize(.small)
                    Button(row.goneLabel) { model.act { $0.listGone(row.key) } }.buttonStyle(.bordered).controlSize(.small)
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { open(confirm: false) }
    }

    private func open(confirm: Bool) {
        guard let ev = (model.state["events"]?.array ?? []).compactMap({ $0.object }).first(where: { $0["id"] == row.key }) else { return }
        model.act { e in if confirm { e.openDialog(ev, "confirm", "list") } else { e.openFor(ev, "list") } }
    }
}

/// 日にち未定の予定に日を決める
struct SomedayPickSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        if let v = model.engine.somedayPickView() {
            NavigationStack {
                VStack(spacing: 12) {
                    HStack {
                        Button { model.act { $0.shiftSomedayPick(-1) } } label: { Image(systemName: "chevron.left") }
                        Spacer(); Text(v.label).font(.headline); Spacer()
                        Button { model.act { $0.shiftSomedayPick(1) } } label: { Image(systemName: "chevron.right") }
                    }
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 2) {
                        ForEach(Array(v.weekdays.enumerated()), id: \.offset) { _, w in Text(w).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary) }
                        ForEach(Array(v.cells.enumerated()), id: \.offset) { _, c in
                            if let d = c.day {
                                Text("\(d)").font(.system(size: 14)).monospacedDigit().foregroundStyle(ink.css(c.color))
                                    .frame(maxWidth: .infinity).frame(height: 34)
                                    .background(c.busy ? ink("bg2") : .clear, in: RoundedRectangle(cornerRadius: 11))
                                    .contentShape(Rectangle())
                                    .onTapGesture { model.act { $0.pickSomedayDay(d) } }
                            } else { Color.clear.frame(height: 34) }
                        }
                    }
                    Text("灰色の日は、ほかの予定が入っています。点線で置きます").font(.footnote).foregroundStyle(.secondary)
                    Spacer()
                }
                .padding()
                .navigationTitle(v.title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("やめる") { model.act { $0.set(["somedayPick": .null]) } } } }
            }
            .presentationDetents([.medium])
        }
    }
}
