import SwiftUI
import LukkoKit

/// これから・まだ・探す（Web 版の screen='list'）
struct ListScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @FocusState private var searchFocused: Bool
    /// 「選択」のあいだ：選んだ予定（id）・時間をそろえる小窓・消す前の確かめ
    @State private var selecting = false
    @State private var picked: Set<String> = []
    @State private var timeSheet = false
    @State private var askDelete = false

    var body: some View {
        let v = model.engine.listView(dark: model.dark)
        let keys = v.groups.flatMap { $0.rows }.map { JS.string($0.key) }
        let chosen = keys.filter { picked.contains($0) }
        List {
            Section {
                Picker("一覧", selection: Binding(get: { v.tab }, set: { k in model.act { $0.setListTab(k) } })) {
                    ForEach(v.seg, id: \.key) { Text($0.label).tag($0.key) }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                .accessibilityIdentifier("list.seg")
                if v.tab == "upcoming" {
                    // 「点線（まだ）だけ」の札。選ぶと黒地
                    HStack {
                        Spacer()
                        Button { model.act { $0.toggleDashOnly() } } label: {
                            Text("点線（まだ）だけ").font(.system(size: 12))
                                .foregroundStyle(v.dashOnly ? ink("card") : ink("ink-soft"))
                                .padding(.horizontal, 11).padding(.vertical, 5)
                                .background(v.dashOnly ? ink("ink") : .clear, in: Capsule())
                                .overlay { if !v.dashOnly { Capsule().strokeBorder(ink("ink-faint"), style: StrokeStyle(lineWidth: 1.3, dash: [3, 2])) } }
                        }
                        .buttonStyle(.borderless)
                        .accessibilityAddTraits(v.dashOnly ? .isSelected : [])
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                }
                if v.tab == "search" {
                    TextField("題名・場所・メモで探す", text: Binding(get: { v.searchQ }, set: { s in model.act { $0.setSearchQ(s) } }))
                        .focused($searchFocused)
                        .submitLabel(.search)
                        .onAppear { searchFocused = true }
                        .accessibilityIdentifier("list.search")
                }
            }
            if v.tab == "undecided" && !v.shelf.isEmpty {
                Section("日にちが、まだ決まっていない") {
                    ForEach(v.shelf, id: \.key) { s in
                        HStack(spacing: 10) {
                            Circle().strokeBorder(ink.css(s.dot), style: StrokeStyle(lineWidth: 1.5, dash: [2, 1.5])).frame(width: 8, height: 8)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(s.title).font(.system(size: 14)).foregroundStyle(ink("ink")).lineLimit(1)
                                Text(s.when).font(.system(size: 11)).foregroundStyle(ink("ink-mut"))
                            }
                            Spacer(minLength: 0)
                            Button { model.act { $0.openSomedayPick(s.key) } } label: {
                                Text("日を決める").font(.system(size: 12)).foregroundStyle(ink("card"))
                                    .padding(.horizontal, 11).padding(.vertical, 6).background(ink("ink"), in: Capsule())
                            }
                            .buttonStyle(.borderless)
                            Button { model.act { e in e.haptic("light"); e.dropSomeday(s.key) } } label: {
                                Text("消す").font(.system(size: 12)).foregroundStyle(ink("ink-faint")).padding(.horizontal, 8).padding(.vertical, 6)
                            }
                            .buttonStyle(.borderless)
                        }
                        .swipeActions { Button("消す", role: .destructive) { model.act { e in e.haptic("light"); e.dropSomeday(s.key) } } }
                    }
                }
            }
            ForEach(Array(v.groups.enumerated()), id: \.offset) { _, g in
                Section(g.head) {
                    ForEach(g.rows, id: \.key) { r in
                        let k = JS.string(r.key)
                        ListRowView(row: r, selecting: selecting, picked: picked.contains(k)) {
                            if picked.contains(k) { picked.remove(k) } else { picked.insert(k) }
                        }
                    }
                }
            }
            if !v.empty.isEmpty {
                Text(v.empty).font(.system(size: 14)).foregroundStyle(ink("ink-faint")).frame(maxWidth: .infinity).padding(.vertical, 48)
                    .listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .scrollDismissesKeyboard(.interactively)
        .navigationDestination(isPresented: Binding(get: { model.state["screen"] == "detail" && model.state["returnTo"] == "list" },
                                                    set: { on in if !on && model.state["screen"] == "detail" { model.act { $0.detailBack() } } })) { DetailScreen() }
        .navigationTitle("予定の一覧")
        .navigationBarTitleDisplayMode(.inline)
        // 予定をまとめて選ぶ（時間をそろえる・消す）
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(selecting ? "完了" : "選択") {
                    selecting.toggle()
                    picked = []
                }
                .disabled(!selecting && keys.isEmpty)
                .accessibilityIdentifier("list.select")
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if selecting {
                ListSelectBar(count: chosen.count, allPicked: !keys.isEmpty && chosen.count == keys.count,
                              toggleAll: { picked = chosen.count == keys.count ? [] : Set(keys) },
                              time: { timeSheet = true }, delete: { askDelete = true })
            }
        }
        // タブや探す言葉が変わって見えなくなった予定は、選んだものから外す
        .onChange(of: keys) { _, ks in picked.formIntersection(ks) }
        .confirmationDialog("\(chosen.count)件を消しますか？", isPresented: $askDelete, titleVisibility: .visible) {
            Button("\(chosen.count)件を消す", role: .destructive) {
                let ids = chosen.map { JSONValue.string($0) }
                model.act { $0.bulkDelete(ids) }
                selecting = false; picked = []
            }
            .accessibilityIdentifier("list.bulkDelete.confirm")
        } message: { Text("「最近消した予定」から30日以内なら戻せます") }
        .sheet(isPresented: $timeSheet) {
            let first = (model.state["events"]?.array ?? []).compactMap { $0.object }.first { chosen.first == JS.string($0["id"]) }
            let timed = first.map { !JS.truthy($0["allDay"]) } ?? false
            ListTimeSheet(count: chosen.count, done: { s, e in
                let ids = chosen.map { JSONValue.string($0) }
                model.act { $0.bulkSetTime(ids, start: s, end: e) }
                selecting = false; picked = []
            }, start: timed ? JS.string(first?["start"]) : "10:00", end: timed ? JS.string(JS.or(first?["actualEnd"], first?["end"])) : "11:00")
            .environment(\.ink, ink)
        }
        .sheet(isPresented: Binding(get: { JS.truthy(model.state["somedayPick"]) }, set: { on in if !on { model.act { $0.set(["somedayPick": .null]) } } })) {
            SomedayPickSheet().environment(\.ink, ink)
        }
    }
}

struct ListRowView: View {
    let row: ListView.Row
    /// 「選択」のあいだは、押すと選ぶ・はずす（予定は開かない）
    var selecting = false
    var picked = false
    var toggle: () -> Void = {}
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if selecting {
                Image(systemName: picked ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 21))
                    .foregroundStyle(picked ? FormTone.teal : ink("ink-faint"))
                    .padding(.top, 6)
            }
            VStack(alignment: .leading, spacing: 0) {
                Text(row.date).font(.system(size: 14)).monospacedDigit().foregroundStyle(ink("ink"))
                Text(row.dow).font(.system(size: 10)).foregroundStyle(ink("ink-faint"))
            }
            .frame(width: 42, alignment: .leading)
            VStack(alignment: .leading, spacing: 3) {
                Text(row.time).font(.system(size: 12)).monospacedDigit().foregroundStyle(ink("ink-mut"))
                Text(row.title).font(.system(size: 13)).lineLimit(1).padding(.horizontal, 8).padding(.vertical, 2)
                    .foregroundStyle(ink.css(row.pill["color"]?.string))
                    .background(ink.css(row.pill["background"]?.string), in: RoundedRectangle(cornerRadius: 6))
                    .overlay { if row.dashed { RoundedRectangle(cornerRadius: 6).strokeBorder(ink.css(String(row.pill["border"]?.string?.split(separator: " ").last ?? "")), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])) } }
                if !row.place.isEmpty { Text(row.place).font(.system(size: 11.5)).foregroundStyle(ink("ink-mut")).lineLimit(1) }
                // まだの行だけ：決まった／流れた（押しても行は開かない）
                if row.dashed && !selecting {
                    HStack(spacing: 6) {
                        Button { open(confirm: true) } label: {
                            Text("決まった").font(.system(size: 12)).foregroundStyle(ink("card"))
                                .padding(.horizontal, 11).padding(.vertical, 5).background(ink("ink"), in: Capsule())
                        }
                        .buttonStyle(.borderless)
                        Button { model.act { $0.listGone(row.key) } } label: {
                            Text(row.goneLabel).font(.system(size: 12)).foregroundStyle(Color(red: 0xA8 / 255, green: 0x45 / 255, blue: 0x2B / 255))
                                .padding(.horizontal, 11).padding(.vertical, 5).overlay(Capsule().strokeBorder(ink("line")))
                        }
                        .buttonStyle(.borderless)
                    }
                    .padding(.top, 4)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
        .onTapGesture { if selecting { toggle() } else { open(confirm: false) } }
        .accessibilityAddTraits(selecting && picked ? .isSelected : [])
        .accessibilityIdentifier("list.row.\(JS.string(row.key))")
    }

    private func open(confirm: Bool) {
        guard let ev = (model.state["events"]?.array ?? []).compactMap({ $0.object }).first(where: { $0["id"] == row.key }) else { return }
        model.act { e in if confirm { e.haptic("light"); e.openDialog(ev, "confirm", "list") } else { e.openFor(ev, "list") } }
    }
}

/// 日にち未定の予定に日を決める（ほかの予定がある日は灰色の地。押すと点線で置く）
struct SomedayPickSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        if let v = model.engine.somedayPickView() {
            VStack(spacing: 10) {
                Text(v.title).font(.system(size: 15)).foregroundStyle(ink("ink")).multilineTextAlignment(.center).padding(.horizontal, 8)
                HStack {
                    Button { model.act { $0.shiftSomedayPick(-1) } } label: { Image(systemName: "chevron.left").frame(width: 34, height: 34) }
                        .accessibilityLabel("前の月")
                    Spacer()
                    Text(v.label).font(.system(size: 14, weight: .bold)).foregroundStyle(ink("ink"))
                    Spacer()
                    Button { model.act { $0.shiftSomedayPick(1) } } label: { Image(systemName: "chevron.right").frame(width: 34, height: 34) }
                        .accessibilityLabel("次の月")
                }
                .foregroundStyle(ink("ink-mut"))
                // 曜日と日付（並べ替えのいらない小さな表なので、Lazy でない Grid。行ごとに別の番号）
                let rows: [[SomedayPickView.Cell?]] = stride(from: 0, to: v.cells.count, by: 7).map { i in
                    (0..<7).map { j in i + j < v.cells.count ? v.cells[i + j] : nil }
                }
                Grid(horizontalSpacing: 2, verticalSpacing: 2) {
                    GridRow {
                        ForEach(0..<7, id: \.self) { j in
                            let w = j < v.weekdays.count ? v.weekdays[j] : ""
                            Text(w).font(.system(size: 10, weight: .semibold)).frame(maxWidth: .infinity)
                                .foregroundStyle(w == "日" ? ink("sun") : w == "土" ? ink("sat") : ink("ink-mut"))
                        }
                    }
                    ForEach(0..<rows.count, id: \.self) { r in
                        GridRow {
                            ForEach(0..<7, id: \.self) { j in
                                if let c = rows[r][j], let d = c.day {
                                    Button { model.act { $0.pickSomedayDay(d) } } label: {
                                        Text("\(d)").font(.system(size: 14)).monospacedDigit().foregroundStyle(ink.css(c.color))
                                            .frame(maxWidth: .infinity).frame(height: 34)
                                            .background(c.busy ? ink("bg2") : .clear, in: RoundedRectangle(cornerRadius: 11))
                                            .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                } else {
                                    Color.clear.frame(maxWidth: .infinity).frame(height: 34)
                                }
                            }
                        }
                    }
                }
                Text("灰色の日は、ほかの予定が入っています。点線で置きます").font(.system(size: 11)).foregroundStyle(ink("ink-faint")).multilineTextAlignment(.center)
                Button("やめる") { model.act { $0.set(["somedayPick": .null]) } }
                    .font(.system(size: 14)).foregroundStyle(ink("ink-mut")).padding(10)
            }
            .padding(.horizontal, 16).padding(.top, 18).padding(.bottom, 8)
            .presentationDetents([.height(470)])
            .presentationDragIndicator(.visible)
            .presentationBackground(ink("card"))
        }
    }
}
