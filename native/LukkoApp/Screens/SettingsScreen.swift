import SwiftUI
import LukkoKit

/// 設定（Web 版の screen='settings'）。最初の画面と中の画面。どの画面にいるかは state.setPage が持つ
struct SettingsScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    static let parents = ["work": "free", "jobs": "wage", "leave": "wage", "overlay": "iphone", "backup": "data", "files": "data"]
    /// いまの setPage から、戻る道のり（親 → 子）を作る
    static func pathOf(_ p: String?) -> [String] {
        guard let p, !p.isEmpty else { return [] }
        if let par = parents[p] { return [par, p] }
        return [p]
    }
    private var path: Binding<[String]> {
        Binding(get: { Self.pathOf(model.state["setPage"]?.string) }, set: { newPath in
            let cur = Self.pathOf(model.state["setPage"]?.string)
            if newPath == cur { return }
            if newPath.count < cur.count { model.act { $0.setBack() } } else { model.act { $0.setPage(newPath.last) } }
        })
    }

    var body: some View {
        let v = model.engine.settingsView()
        NavigationStack(path: path) {
            SettingsMain(v: v)
                .navigationDestination(for: String.self) { p in SettingsPage(page: p) }
        }
        .sheet(isPresented: Binding(get: { JS.truthy(model.state["profileSheet"]) }, set: { on in if !on { model.act { $0.set(["profileSheet": .null]) } } })) {
            ProfileSheet().environment(\.ink, ink)
        }
    }
}

/// 最初の画面
struct SettingsMain: View {
    let v: SettingsView
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @Environment(\.openURL) private var openURL

    var body: some View {
        Form {
            Section {
                Button { openURL(URL(string: "https://apps.apple.com/app/id6794792375?action=write-review")!) } label: {
                    Label("App Store でレビューする", systemImage: "star")
                }
            }
            Section {
                Button { model.act { $0.openProfileSheet() } } label: {
                    HStack { Text("使い方").foregroundStyle(.primary); Spacer(); Text(v.profileLabel).foregroundStyle(.secondary) }
                }
                .tint(.primary)
                NavigationLink(value: "types") {
                    HStack {
                        Text("予定の種類")
                        Spacer()
                        HStack(spacing: -3) { ForEach(Array(v.typeDots.enumerated()), id: \.offset) { _, c in Circle().fill(ink.css(c)).frame(width: 12, height: 12).overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 1.5)) } }
                        Text("\(v.typeCount)つ").foregroundStyle(.secondary)
                    }
                }
            }
            Section {
                NavigationLink(value: "display") { Label("カレンダーと表示", systemImage: "calendar") }
                NavigationLink(value: "free") { Label("空き状況", systemImage: "circle.grid.2x2") }
                NavigationLink(value: "notify") { HStack { Label("通知", systemImage: "bell"); Spacer(); Text(v.notifyOn ? "オン" : "オフ").foregroundStyle(.secondary) } }
                NavigationLink(value: "wage") { Label(v.wageHead, systemImage: "yensign.circle") }
                NavigationLink(value: "iphone") { Label("iPhone のカレンダー", systemImage: "iphone") }
                NavigationLink(value: "data") { Label("保存と安全", systemImage: "lock.shield") }
            }
            Section { NavigationLink(value: "help") { Label("ヘルプ", systemImage: "questionmark.circle") } }
            Section {
                Text("LUKKO \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")（\(AppModel.version)）")
                    .font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
            }
        }
        .navigationTitle("設定")
    }
}

/// 中の画面
struct SettingsPage: View {
    let page: String
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let v = model.engine.settingsView()
        Form { content(v) }
            .navigationTitle(v.pageTitle.isEmpty ? pageTitle : v.pageTitle)
            .navigationBarTitleDisplayMode(.inline)
    }
    private var pageTitle: String { page }

    private func toggle(_ label: String, _ key: String, _ on: Bool) -> some View {
        Toggle(label, isOn: Binding(get: { on }, set: { _ in model.act { $0.toggleSetting(key) } }))
    }
    private func segPicker(_ label: String, _ opts: [SettingsView.Opt], _ set: @escaping (JSONValue) -> Void) -> some View {
        Picker(label, selection: Binding(get: { opts.firstIndex { $0.sel } ?? -1 }, set: { i in if opts.indices.contains(i) { set(opts[i].key) } })) {
            ForEach(Array(opts.enumerated()), id: \.offset) { i, o in Text(o.label).tag(i) }
        }
    }
    /// 30 分きざみの時刻（24:00 まで）
    private func timePicker(_ label: String, _ value: Double, _ set: @escaping (Double) -> Void) -> some View {
        Picker(label, selection: Binding(get: { Int(value) }, set: { set(Double($0)) })) {
            ForEach(0..<49, id: \.self) { i in Text(i == 48 ? "24:00" : String(format: "%d:%02d", i * 30 / 60, i * 30 % 60)).tag(i * 30) }
        }
    }

    @ViewBuilder func content(_ v: SettingsView) -> some View {
        switch page {
        case "display":
            Section {
                Picker("週のはじまり", selection: Binding(get: { JS.int(model.state["settings"]?["weekStart"]) }, set: { k in model.act { $0.setSetting("weekStart", .number(Double(k))) } })) {
                    Text("日曜日").tag(0); Text("月曜日").tag(1)
                }
                toggle("帯に時刻を出す", "barTime", v.barTime)
                toggle("点線に「仮」を付ける", "kariMark", v.kariMark)
                toggle("無くなった予定を隠す", "hideCanceled", v.hideCanceled)
            }
            Section("表示") {
                segPicker("表示モード", v.themeSeg) { k in model.act { $0.setTheme(k.string ?? "light") } }
                segPicker("予定の文字の大きさ", v.fontSeg) { k in model.act { $0.setFontScale(k) } }
            }
        case "free":
            Section {
                HStack { Text("平日"); Spacer()
                    timePicker("", v.freeWd.first ?? 540) { n in model.act { $0.setFreeRange("freeWd", 0, n) } }.labelsHidden()
                    Text("〜")
                    timePicker("", v.freeWd.count > 1 ? v.freeWd[1] : 1320) { n in model.act { $0.setFreeRange("freeWd", 1, n) } }.labelsHidden()
                }
                HStack { Text("休日"); Spacer()
                    timePicker("", v.freeHd.first ?? 540) { n in model.act { $0.setFreeRange("freeHd", 0, n) } }.labelsHidden()
                    Text("〜")
                    timePicker("", v.freeHd.count > 1 ? v.freeHd[1] : 1320) { n in model.act { $0.setFreeRange("freeHd", 1, n) } }.labelsHidden()
                }
                NavigationLink(value: "work") { HStack { Text("勤務時間"); Spacer(); Text(v.workLabel).foregroundStyle(.secondary) } }
            } footer: { Text("空き状況の○△×を決める時間です") }
        case "work":
            Section {
                Toggle("勤務時間を入れる", isOn: Binding(get: { v.workHoursOn }, set: { _ in model.act { $0.toggleWorkHours() } }))
                if v.workHoursOn {
                    HStack(spacing: 4) {
                        ForEach(0..<7, id: \.self) { i in
                            let on = v.workDays.indices.contains(i) && v.workDays[i]
                            Button(["日", "月", "火", "水", "木", "金", "土"][i]) { model.act { $0.toggleWorkDay(i) } }
                                .font(.footnote).frame(maxWidth: .infinity).padding(.vertical, 7)
                                .foregroundStyle(on ? ink("card") : ink("ink-mut"))
                                .background(on ? ink("ink") : ink("card"), in: RoundedRectangle(cornerRadius: 9))
                                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(on ? ink("ink") : ink("line")))
                                .buttonStyle(.plain)
                        }
                    }
                    HStack { Text("時間"); Spacer()
                        timePicker("", v.workFrom) { n in model.act { $0.setWorkTime(from: n) } }.labelsHidden()
                        Text("〜")
                        timePicker("", v.workTo) { n in model.act { $0.setWorkTime(to: n) } }.labelsHidden()
                    }
                }
            } footer: { Text("空き状況で、この時間を「ふさがり」にします") }
        case "notify":
            Section {
                Toggle("通知", isOn: Binding(get: { v.notifyOn }, set: { _ in model.act { $0.setSetting("notifyOff", .bool(v.notifyOn)) } }))
                if v.notifyOn {
                    segPicker("予定の通知", v.remindTimedSeg) { k in model.act { $0.setSeg("remindTimed", k) } }
                    segPicker("終日の予定の通知", v.remindAllDaySeg) { k in model.act { $0.setSeg("remindAllDay", k) } }
                    toggle("朝のまとめ", "morning", v.morning)
                    if v.morning { timePicker("時刻", v.morningAt) { n in model.act { $0.setSetting("morningAt", .number(n)) } } }
                    toggle("前の晩に明日の予定", "evening", v.evening)
                    toggle("日曜の夜にまだの予定", "weekly", v.weekly)
                    if !v.jobRows.isEmpty || v.retiredCount > 0 { toggle("働いたあとに記録を聞く", "remind", v.remind) }
                    toggle("通知で予定の名前を隠す", "hideTitles", v.hideTitles)
                }
            }
        case "wage":
            Section {
                NavigationLink(value: "jobs") { HStack { Text(v.jobWord); Spacer(); Text(v.jobsLabel).foregroundStyle(.secondary) } }
                segPicker("給料の表示", v.wageFeatureSeg) { k in model.act { $0.setSeg("wageFeature", k) } }
                NavigationLink(value: "leave") { HStack { Text("有給"); Spacer(); Text(v.leaveLabel).foregroundStyle(.secondary) } }
            }
        case "jobs":
            JobsPage(v: v)
        case "leave":
            Section {
                Toggle("有給を数える", isOn: Binding(get: { v.leaveShown }, set: { _ in model.act { $0.toggleLeave() } }))
                if v.leaveShown {
                    HStack { Text("1年にもらう日数"); Spacer()
                        TextField("10", text: Binding(get: { v.leaveGrant }, set: { s in model.act { $0.setLeaveGrant(s) } })).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 70)
                        Text("日")
                    }
                    Picker("もらう月", selection: Binding(get: { v.leaveStart }, set: { m in model.act { $0.setLeaveStart(m) } })) {
                        ForEach(0..<12, id: \.self) { Text("\($0 + 1)月").tag($0) }
                    }
                    if !v.leaveText.isEmpty { Text(v.leaveText).font(.footnote).foregroundStyle(.secondary) }
                }
            }
        case "types":
            TypesPage(v: v)
        case "iphone":
            Section {
                NavigationLink(value: "overlay") { HStack { Text("重ねて表示"); Spacer(); Text(v.overlayLabel).foregroundStyle(.secondary) } }
                Button("iPhone のカレンダーから取り込む") { Task { await model.engine.openImport() } }
                if !(model.engine.tidyTargets().isEmpty) { Button("取り込んだ予定を整理する") { model.act { $0.openTidy() } } }
                Toggle("決まった予定を iPhone のカレンダーにも入れる", isOn: Binding(get: { v.exportCal }, set: { _ in model.toggleExportCal() }))
            } footer: { Text("「LUKKO」という名前のカレンダーにだけ書きます") }
        case "overlay":
            Section {
                Toggle("重ねて表示", isOn: Binding(get: { v.overlayOn }, set: { _ in model.toggleOverlay() }))
                if v.overlayOn {
                    ForEach(Array((model.state["overlayCals"]?.array ?? []).enumerated()), id: \.offset) { _, c in
                        let id = c["id"] ?? .null
                        let on = (model.state["settings"]?["overlayIds"]?.array ?? []).contains(id)
                        Button { model.toggleOverlayCal(id) } label: {
                            HStack { Circle().fill(ink.css(JS.string(c["color"]))).frame(width: 10, height: 10); Text(JS.string(c["title"])).foregroundStyle(.primary); Spacer(); if on { Image(systemName: "checkmark") } }
                        }
                    }
                }
            } footer: { Text("会社や家族のカレンダーを、灰色の帯で重ねて見られます。LUKKO には保存しません") }
        case "data":
            Section {
                if model.lockAvailable { Toggle("開くときに\(model.lockLabel)", isOn: Binding(get: { v.lock }, set: { _ in model.toggleLock() })) }
                Toggle("iCloud で同期", isOn: Binding(get: { v.sync }, set: { _ in model.toggleSync() }))
                if !v.syncSub.isEmpty { Text(v.syncSub).font(.footnote).foregroundStyle(.secondary) }
            }
            Section {
                Text(v.lastBackupText).font(.footnote)
                Text(v.lastExportText).font(.footnote)
                Button("最近消した予定（\(v.trashCount)件）") { model.act { e in e.haptic("light"); e.set(["trashOpen": true]) } }
                if v.undoImportShown { Button(v.undoImportLabel, role: .destructive) { model.act { $0.undoImport() } } }
            }
            if !v.trashRows.isEmpty {
                Section("最近消した予定") {
                    ForEach(Array(v.trashRows.enumerated()), id: \.offset) { _, r in
                        HStack {
                            VStack(alignment: .leading) { Text(r.title); Text("\(r.when)・\(r.gone)").font(.caption).foregroundStyle(.secondary) }
                            Spacer()
                            Button("戻す") { model.act { e in e.haptic("light"); e.restoreTrash([r.key]) } }.buttonStyle(.bordered)
                        }
                    }
                }
            }
        case "help":
            Section {
                Button("使い方をもう一度見る") { model.act { $0.replayGuide() } }
                Link("お問い合わせ・サポート", destination: URL(string: "https://kaitoiwaki.github.io/kimatteru/legal/support.html")!)
            }
        default:
            Section { Text("SwiftUI 版で作っているところです").foregroundStyle(.secondary) }
        }
    }
}

/// 勤務先
struct JobsPage: View {
    let v: SettingsView
    @Environment(AppModel.self) private var model
    var body: some View {
        Section {
            ForEach(Array(v.jobRows.enumerated()), id: \.offset) { _, j in
                DisclosureGroup(isExpanded: Binding(get: { j.open }, set: { _ in model.act { $0.editJobRow(j.id) } })) {
                    TextField("名前", text: Binding(get: { j.name.replacingOccurrences(of: "（辞めた）", with: "").replacingOccurrences(of: "（名前なし）", with: "") },
                                                    set: { s in model.act { $0.patchJob(j.id, ["name": .string(s)]) } }))
                    HStack { Text("時給 ¥"); TextField("0", text: Binding(get: { j.hourly }, set: { s in model.act { $0.setJobHourlyText(j.id, s) } })).keyboardType(.numberPad) }
                    if j.rateNote { Button("これまでの記録も、いまの時給で数え直す") { model.act { $0.recountJob(j.id) } } }
                    Picker("締め日", selection: Binding(get: { j.closeDay }, set: { d in model.act { $0.setJobDay(j.id, close: d) } })) {
                        Text("なし（月末まで）").tag(0); ForEach(1...28, id: \.self) { Text("\($0)日").tag($0) }; Text("月末").tag(31)
                    }
                    Picker("給料日", selection: Binding(get: { j.payDay }, set: { d in model.act { $0.setJobDay(j.id, pay: d) } })) {
                        Text("なし").tag(0); ForEach(1...28, id: \.self) { Text("\($0)日").tag($0) }; Text("月末").tag(31)
                    }
                    ForEach(Array(j.templates.enumerated()), id: \.offset) { k, t in
                        HStack { Text(t); Spacer(); Button { model.act { $0.removeTemplate(j.id, k) } } label: { Image(systemName: "minus.circle") }.buttonStyle(.borderless) }
                    }
                    Button("シフトの型を足す") { model.act { $0.openTemplateNew(j.id) } }
                    Button(j.retireLabel) { model.act { $0.retireJob(j.id, !j.retired) } }
                    Button("消す", role: .destructive) { model.act { $0.askRemoveJob(j.id) } }
                } label: {
                    HStack { Text(j.name).foregroundStyle(j.retired ? .secondary : .primary); Spacer(); Text("¥\(j.hourly)").foregroundStyle(.secondary).monospacedDigit() }
                }
            }
            Button(v.jobAddLabel) { model.act { $0.addJob() } }
            if v.retiredCount > 0 { Button(v.showRetired ? "辞めたところを隠す" : "辞めたところを出す（\(v.retiredCount)）") { model.act { $0.toggleShowRetired() } } }
        }
    }
}

/// 予定の種類
struct TypesPage: View {
    let v: SettingsView
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        Section {
            ForEach(Array(v.typeRows.enumerated()), id: \.offset) { _, t in
                DisclosureGroup(isExpanded: Binding(get: { t.open }, set: { _ in model.act { $0.editTypeRow(t.key) } })) {
                    TextField("名前", text: Binding(get: { t.name }, set: { s in model.act { $0.renameType(t.key, .string(s)) } }))
                    FlowLayout(spacing: 10) {
                        ForEach(FormCore.pal, id: \.self) { hex in
                            Circle().fill(ink.css(hex)).frame(width: 26, height: 26)
                                .overlay { if hex == t.color { Circle().strokeBorder(.white, lineWidth: 2) } }
                                .onTapGesture { model.act { $0.recolorKey(t.key, hex) } }
                        }
                    }
                    HStack { Text("まだのとき").font(.footnote); TextField("", text: Binding(get: { t.uWord }, set: { s in model.act { $0.setTypeWords(t.key, "u", .string(s)) } })) }
                    HStack { Text("決まったとき").font(.footnote); TextField("", text: Binding(get: { t.cWord }, set: { s in model.act { $0.setTypeWords(t.key, "c", .string(s)) } })) }
                    HStack {
                        Button { model.act { $0.moveType(t.key, -1) } } label: { Image(systemName: "arrow.up") }.disabled(!t.canUp).buttonStyle(.bordered)
                        Button { model.act { $0.moveType(t.key, 1) } } label: { Image(systemName: "arrow.down") }.disabled(!t.canDown).buttonStyle(.bordered)
                        Button(t.hideLabel) { model.act { $0.toggleTypeHidden(t.key) } }.buttonStyle(.bordered)
                        if t.canDelete { Button("消す", role: .destructive) { model.act { $0.askDeleteType(t.key) } }.buttonStyle(.bordered) }
                    }
                    if t.deleting {
                        Text("この種類の予定（\(t.usedCount)件）を移す先").font(.footnote).foregroundStyle(.secondary)
                        FlowLayout(spacing: 8) {
                            ForEach(Array(t.moveTo.enumerated()), id: \.offset) { _, m in
                                Button(m.label) { model.act { $0.deleteType(t.key, m.key) } }.buttonStyle(.bordered)
                            }
                        }
                        Button("やめる") { model.act { $0.set(["typeDelete": .null]) } }
                    }
                } label: {
                    HStack {
                        Circle().fill(ink.css(t.color)).frame(width: 18, height: 18)
                        Text(t.name)
                        Spacer()
                        Text(t.hint).font(.footnote).foregroundStyle(.secondary)
                    }
                    .opacity(t.hidden && !t.open ? 0.55 : 1)
                }
            }
        }
    }
}

/// 使い方のシート
struct ProfileSheet: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        let v = model.engine.settingsView()
        NavigationStack {
            List {
                Section {
                    ForEach(Array(v.profileOpts.enumerated()), id: \.offset) { _, o in
                        Button { model.act { $0.pickProfile(o.key.string ?? "student") } } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(o.label).foregroundStyle(.primary)
                                    Text(Profile.all[o.key.string ?? ""].map { _ in noteOf(o.key.string ?? "") } ?? "").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                if o.sel { Text("いま").font(.caption).foregroundStyle(.secondary) }
                            }
                        }
                    }
                }
                if v.profileRetireShown {
                    Section { Toggle("バイト先をまとめて「辞めた」にする（記録は残ります）", isOn: Binding(get: { v.profileRetireOn }, set: { _ in model.act { $0.toggleProfileRetire() } })) }
                }
                Section {
                    Text("・予定の種類・呼び名・空きを見る時間が変わります\n・予定はそのまま残ります").font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("ふだんの予定に近いのは？")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { model.act { $0.set(["profileSheet": .null]) } } } }
        }
        .presentationDetents([.medium, .large])
    }
    private func noteOf(_ k: String) -> String {
        ["student": "授業・サークル・バイト", "work": "会議・打ち合わせ・出張", "shift": "看護・介護・販売・飲食など", "free": "案件・打ち合わせ・納期", "family": "保育園・学校行事・通院"][k] ?? ""
    }
}
