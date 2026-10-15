import SwiftUI
import LukkoKit

/// 設定（Web 版の screen='settings'。settingsview.jsx の写し）。最初の画面と中の画面 15 種。
/// どの画面にいるかは state.setPage が持つ。サポーターカード（screen='card'）と規約（screen='doc'）も、この中に重ねて開く
struct SettingsScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    static let parents = ["work": "free", "jobs": "wage", "leave": "wage", "overlay": "iphone", "backup": "data", "files": "data"]
    /// いまの setPage・screen から、戻る道のり（親 → 子）を作る
    static func pathOf(_ p: String?, screen: String?) -> [String] {
        var out: [String] = []
        if let p, !p.isEmpty {
            if let par = parents[p] { out = [par, p] } else { out = [p] }
        }
        if screen == "card" { out.append("card") }
        if screen == "doc" { out.append("doc") }
        return out
    }
    private var curPath: [String] { Self.pathOf(model.state["setPage"]?.string, screen: model.state["screen"]?.string) }
    private var path: Binding<[String]> {
        Binding(get: { curPath }, set: { newPath in
            let cur = curPath
            if newPath == cur { return }
            if newPath.count < cur.count {
                // 1 段ずつ戻る（何段も戻ったときは、その数だけ）
                var c = cur
                while c.count > newPath.count {
                    let top = c.removeLast()
                    switch top {
                    case "card": model.act { $0.cardBack() }
                    case "doc": model.act { $0.docBack() }
                    default: model.act { $0.setBack() }
                    }
                }
            } else if let last = newPath.last, last != "card", last != "doc" {
                model.act { $0.setPage(last) }
            }
        })
    }

    var body: some View {
        let v = model.engine.settingsView()
        let sv = model.engine.supportView()
        NavigationStack(path: path) {
            SettingsMain(v: v, sv: sv)
                .navigationDestination(for: String.self) { p in
                    switch p {
                    case "card": SupporterCardScreen()
                    case "doc": SettingsDocScreen()
                    case "support": SupportPage()
                    default: SettingsPage(page: p)
                    }
                }
        }
        .tint(ink("ink"))
        .sheet(isPresented: sheetBinding(JS.truthy(model.state["profileSheet"]), close: { $0.set(["profileSheet": .null]) })) {
            ProfileSheet().environment(\.ink, ink)
        }
        .sheet(isPresented: sheetBinding(v.trashShown, close: { $0.closeTrash() })) {
            SettingsTrashSheet().environment(\.ink, ink)
        }
        .sheet(isPresented: sheetBinding(v.backupListShown, close: { $0.closeBackupList() })) {
            SettingsBackupListSheet().environment(\.ink, ink)
        }
        .sheet(isPresented: sheetBinding(v.tplNewShown, close: { $0.closeTemplateNew() })) {
            SettingsTemplateSheet().environment(\.ink, ink)
        }
        .sheet(isPresented: sheetBinding(sv.tipThanksShown, close: { $0.set(["tipThanks": .null]) })) {
            SupportThanksSheet().environment(\.ink, ink)
        }
        .sheet(isPresented: sheetBinding(sv.probeShown, close: { $0.setProbe(nil) })) {
            SupportProbeSheet().environment(\.ink, ink)
        }
        // 値段は、設定を開いたときに 1 回だけ取りに行く（使い始めの人に、いきなり買えるものを見せない）
        .task(id: model.state["screen"] == "settings") {
            if model.state["screen"] == "settings" { await SupportStore.shared.loadTips(model) }
        }
    }

    private func sheetBinding(_ shown: Bool, close: @escaping (Engine) -> Void) -> Binding<Bool> {
        Binding(get: { shown }, set: { on in if !on && shown { model.act(close) } })
    }
}

// MARK: - 共通の部品
/// 設定の見た目（Web 版のカードの群：地は --bg、行は --card）
struct SettingsFormStyle: ViewModifier {
    @Environment(\.ink) private var ink
    func body(content: Content) -> some View {
        content
            .scrollContentBackground(.hidden)
            .background(ink("bg").ignoresSafeArea())
            .environment(\.defaultMinListRowHeight, 42)
    }
}
extension View {
    func settingsForm() -> some View { modifier(SettingsFormStyle()) }
}

/// 1 行：左に名前、右に値（…で切る。名前に半分の幅を残す）
struct SettingsValueRow: View {
    let label: String
    var sub: String = ""
    var value: String = ""
    var danger = false
    @Environment(\.ink) private var ink
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 14)).foregroundStyle(danger ? Palette.hex("#A8452B") : ink("ink"))
                if !sub.isEmpty { Text(sub).font(.system(size: 11)).foregroundStyle(ink("ink-mut")) }
            }
            .layoutPriority(1)
            Spacer(minLength: 0)
            if !value.isEmpty { Text(value).font(.system(size: 13.5)).foregroundStyle(ink("ink-mut")).lineLimit(1).truncationMode(.tail) }
        }
    }
}

/// 左に小さな絵の付いた行
struct SettingsIconRow: View {
    let icon: [String]
    let label: String
    var value = ""
    @Environment(\.ink) private var ink
    var body: some View {
        HStack(spacing: 12) {
            SettingsLineIcon(paths: icon, color: ink("ink-mut")).frame(width: 28, height: 28)
            Text(label).font(.system(size: 14)).foregroundStyle(ink("ink"))
            Spacer(minLength: 0)
            if !value.isEmpty { Text(value).font(.system(size: 13.5)).foregroundStyle(ink("ink-mut")).lineLimit(1) }
        }
    }
}

/// 説明（カードの下に小さく 1 つ）
struct SettingsNote: View {
    let text: String
    @Environment(\.ink) private var ink
    var body: some View { Text(text).font(.system(size: 11.5)).foregroundStyle(ink("ink-faint")).lineSpacing(3).textCase(nil) }
}

/// 押すと何かが開く行（行全体が押せる）。見た目は › 付きの行
struct SettingsButtonRow<Label: View>: View {
    let action: () -> Void
    @ViewBuilder let label: () -> Label
    @Environment(\.ink) private var ink
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                label()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(ink("ink-faint"))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// 30 分きざみの時刻（24:00 まで）。表示は先頭の 0 を落とす（9:00）
struct SettingsTimePicker: View {
    let value: Double
    let set: (Double) -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        Picker("", selection: Binding(get: { Int(value) }, set: { set(Double($0)) })) {
            ForEach(0..<49, id: \.self) { i in Text(i == 48 ? "24:00" : String(format: "%d:%02d", i * 30 / 60, i * 30 % 60)).tag(i * 30) }
        }
        .labelsHidden()
        .pickerStyle(.menu)
        .tint(ink("ink"))
        .fixedSize()
    }
}

// MARK: - 最初の画面
struct SettingsMain: View {
    let v: SettingsView
    let sv: SupportView
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        Form {
            // 応援とレビュー（設定を開いてすぐ見える所に）
            Section {
                if sv.supporterShown {
                    Button { model.act { $0.openCard() } } label: {
                        HStack(spacing: 10) {
                            Text("✓").font(.system(size: 12, weight: .heavy)).foregroundStyle(.white)
                                .frame(width: 22, height: 22).background(SupportFont.teal, in: Circle())
                            VStack(alignment: .leading, spacing: 2) {
                                Text("サポーターカード").font(.system(size: 14)).foregroundStyle(ink("ink"))
                                Text("\(sv.supporterTotal)・\(sv.supporterCount)・\(sv.supporterSince)").font(.system(size: 12)).foregroundStyle(ink("ink-mut"))
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(ink("ink-faint"))
                        }
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("settings.supporter")
                }
                if sv.tipShown {
                    NavigationLink(value: "support") {
                        HStack(spacing: 12) {
                            SettingsSproutIcon().frame(width: 28, height: 28)
                            Text("LUKKO を応援する").font(.system(size: 14)).foregroundStyle(ink("ink"))
                        }
                    }
                    .accessibilityIdentifier("settings.support")
                }
                Link(destination: URL(string: SupportCore.reviewHref)!) {
                    HStack(spacing: 12) {
                        SettingsLineIcon(paths: SettingsIcon.star, color: Palette.hex("#C9A13B"), width: 1.7).frame(width: 28, height: 28)
                        Text("App Store でレビューする").font(.system(size: 14)).foregroundStyle(ink("ink"))
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(ink("ink-faint"))
                    }
                }
            }
            .listRowBackground(ink("card"))
            Section {
                SettingsButtonRow(action: { model.act { $0.openProfileSheet() } }) { SettingsValueRow(label: "使い方", value: v.profileLabel) }
                NavigationLink(value: "types") {
                    HStack(spacing: 8) {
                        Text("予定の種類").font(.system(size: 14)).foregroundStyle(ink("ink")).layoutPriority(1)
                        Spacer(minLength: 0)
                        // 丸は入るぶんだけ（狭いと右から切れる）。数はいつも見せる
                        HStack(spacing: 4) {
                            ForEach(Array(v.typeDots.enumerated()), id: \.offset) { _, c in
                                Circle().fill(ink.css(c)).frame(width: 13, height: 13).overlay(Circle().strokeBorder(.black.opacity(0.06), lineWidth: 1))
                            }
                        }
                        Text("\(v.typeCount)つ").font(.system(size: 14)).foregroundStyle(ink("ink-mut")).fixedSize()
                    }
                }
            }
            .listRowBackground(ink("card"))
            Section {
                NavigationLink(value: "display") { SettingsIconRow(icon: SettingsIcon.calendar, label: "カレンダーと表示") }
                NavigationLink(value: "free") { SettingsIconRow(icon: SettingsIcon.free, label: "空き状況") }
                NavigationLink(value: "notify") { SettingsIconRow(icon: SettingsIcon.bell, label: "通知", value: v.notifyOn ? "オン" : "オフ") }
                NavigationLink(value: "wage") { SettingsIconRow(icon: SettingsIcon.yen, label: v.wageHead) }
                if model.engine.phone != nil { NavigationLink(value: "iphone") { SettingsIconRow(icon: SettingsIcon.phone, label: "iPhone のカレンダー") } }
                NavigationLink(value: "data") { SettingsIconRow(icon: SettingsIcon.shield, label: "保存と安全") }
            }
            .listRowBackground(ink("card"))
            Section {
                NavigationLink(value: "help") { SettingsIconRow(icon: SettingsIcon.help, label: "ヘルプ") }
            }
            .listRowBackground(ink("card"))
            Section {
                // 5 回叩くと診断が出る。ふつうに使う人には何も起きない
                Text("LUKKO \(Self.marketing)（\(AppModel.version)）")
                    .font(.system(size: 12)).foregroundStyle(ink("ink-faint"))
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                    .onTapGesture { SupportStore.shared.tapVersion(model) }
                    .listRowBackground(Color.clear)
                    .accessibilityIdentifier("settings.version")
            }
        }
        .settingsForm()
        .navigationTitle("設定")
    }
    static var marketing: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "" }
}

// MARK: - 中の画面
struct SettingsPage: View {
    let page: String
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let v = model.engine.settingsView()
        Group {
            switch page {
            case "jobs": SettingsJobsPage(v: v)
            case "types": SettingsTypesPage(v: v)
            case "backup": SettingsBackupPage(v: v)
            default: Form { content(v) }.settingsForm()
            }
        }
        .navigationTitle(v.pageTitle)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func toggle(_ label: String, sub: String = "", _ on: Bool, _ set: @escaping () -> Void) -> some View {
        Toggle(isOn: Binding(get: { on }, set: { _ in set() })) {
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 14)).foregroundStyle(ink("ink"))
                if !sub.isEmpty { Text(sub).font(.system(size: 11)).foregroundStyle(ink("ink-mut")) }
            }
        }
        .tint(SupportFont.sage)
    }
    private func settingToggle(_ label: String, _ key: String, _ on: Bool) -> some View {
        toggle(label, on) { model.act { $0.toggleSetting(key) } }
    }
    /// 選ぶ行（右に今の値と ⌃⌄。押すと iPhone 標準の選び方）
    private func pick(_ label: String, _ opts: [SettingsView.Opt], _ set: @escaping (JSONValue) -> Void) -> some View {
        Picker(selection: Binding(get: { opts.firstIndex { $0.sel } ?? 0 }, set: { i in if opts.indices.contains(i) { set(opts[i].key) } })) {
            ForEach(Array(opts.enumerated()), id: \.offset) { i, o in Text(o.label).tag(i) }
        } label: { Text(label).font(.system(size: 14)).foregroundStyle(ink("ink")) }
        .pickerStyle(.menu)
        .tint(ink("ink-mut"))
    }
    private func range(_ label: String, _ a: Double, _ b: Double, _ setA: @escaping (Double) -> Void, _ setB: @escaping (Double) -> Void) -> some View {
        HStack(spacing: 6) {
            Text(label).font(.system(size: 14)).foregroundStyle(ink("ink"))
            Spacer(minLength: 0)
            SettingsTimePicker(value: a, set: setA)
            Text("〜").foregroundStyle(ink("ink-mut"))
            SettingsTimePicker(value: b, set: setB)
        }
    }

    @ViewBuilder func content(_ v: SettingsView) -> some View {
        switch page {
        case "display":
            Section {
                // 週のはじまりだけは手ごたえなし（Web 版と同じ）
                Picker(selection: Binding(get: { v.weekSeg.firstIndex { $0.sel } ?? 0 }, set: { i in if v.weekSeg.indices.contains(i) { model.act { $0.setSetting("weekStart", v.weekSeg[i].key) } } })) {
                    ForEach(Array(v.weekSeg.enumerated()), id: \.offset) { i, o in Text(o.label).tag(i) }
                } label: { Text("週のはじまり").font(.system(size: 14)).foregroundStyle(ink("ink")) }
                .pickerStyle(.menu)
                .tint(ink("ink-mut"))
                settingToggle("帯に時刻を出す", "barTime", v.barTime)
                settingToggle("点線に「仮」を付ける", "kariMark", v.kariMark)
                settingToggle("無くなった予定を隠す", "hideCanceled", v.hideCanceled)
            }
            .listRowBackground(ink("card"))
            Section {
                pick("表示モード", v.themeSeg) { k in model.act { $0.setTheme(k.string ?? "light") } }
                pick("予定の文字の大きさ", v.fontSeg) { k in model.act { $0.setFontScale(k) } }
            } header: { Text("表示") }
            .listRowBackground(ink("card"))
        case "free":
            Section {
                range("平日", v.freeWd.first ?? 540, v.freeWd.count > 1 ? v.freeWd[1] : 1320, { n in model.act { $0.setFreeRange("freeWd", 0, n) } }, { n in model.act { $0.setFreeRange("freeWd", 1, n) } })
                range("休日", v.freeHd.first ?? 540, v.freeHd.count > 1 ? v.freeHd[1] : 1320, { n in model.act { $0.setFreeRange("freeHd", 0, n) } }, { n in model.act { $0.setFreeRange("freeHd", 1, n) } })
                NavigationLink(value: "work") { SettingsValueRow(label: "勤務時間", value: v.workLabel) }
                if v.overlayCalsShown { settingToggle("重ねた予定もふさがり扱い", "overlayFree", v.overlayFree) }
            } header: { SettingsNote(text: "空き状況の○△×を決める時間です") }
            .listRowBackground(ink("card"))
        case "work":
            Section {
                toggle("勤務時間を入れる", v.workHoursOn) { model.act { $0.toggleWorkHours() } }
                if v.workHoursOn {
                    HStack(spacing: 4) {
                        ForEach(0..<7, id: \.self) { i in
                            let on = v.workDays.indices.contains(i) && v.workDays[i]
                            Button { model.act { $0.toggleWorkDay(i) } } label: {
                                Text(["日", "月", "火", "水", "木", "金", "土"][i]).font(.system(size: 14))
                                    .frame(maxWidth: .infinity).padding(.vertical, 8)
                                    .foregroundStyle(on ? ink("card") : ink("ink-mut"))
                                    .background(on ? ink("ink") : ink("card"), in: RoundedRectangle(cornerRadius: 9))
                                    .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(on ? ink("ink") : ink("line")))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                    range("時間", v.workFrom, v.workTo, { n in model.act { $0.setWorkTime(from: n) } }, { n in model.act { $0.setWorkTime(to: n) } })
                }
            } footer: { SettingsNote(text: "空き状況で、この時間を「ふさがり」にします") }
            .listRowBackground(ink("card"))
        case "notify":
            Section {
                toggle("通知", v.notifyOn) { model.act { $0.setSetting("notifyOff", .bool(v.notifyOn)) } }
                if v.notifyOn {
                    pick("予定の通知", v.remindTimedSeg) { k in model.act { $0.setSeg("remindTimed", k) } }
                    pick("終日の予定の通知", v.remindAllDaySeg) { k in model.act { $0.setSeg("remindAllDay", k) } }
                }
            }
            .listRowBackground(ink("card"))
            if v.notifyOn {
                Section {
                    settingToggle("朝のまとめ", "morning", v.morning)
                    if v.morning {
                        HStack {
                            Text("時刻").font(.system(size: 14)).foregroundStyle(ink("ink"))
                            Spacer()
                            SettingsTimePicker(value: v.morningAt) { n in model.act { $0.setSetting("morningAt", .number(n)) } }
                        }
                    }
                }
                .listRowBackground(ink("card"))
                Section {
                    settingToggle("前の晩に明日の予定", "evening", v.evening)
                    settingToggle("日曜の夜にまだの予定", "weekly", v.weekly)
                    if v.remindRowShown { settingToggle("働いたあとに記録を聞く", "remind", v.remind) }
                }
                .listRowBackground(ink("card"))
            }
        case "wage":
            Section {
                NavigationLink(value: "jobs") { SettingsValueRow(label: v.jobWord, value: v.jobsLabel) }
                pick("給料の表示", v.wageFeatureSeg) { k in model.act { $0.setSeg("wageFeature", k) } }
                NavigationLink(value: "leave") { SettingsValueRow(label: "有給", value: v.leaveLabel) }
            }
            .listRowBackground(ink("card"))
        case "leave":
            Section {
                toggle("有給の残りを数える", v.leaveShown) { model.act { $0.toggleLeave() } }
                if v.leaveShown {
                    HStack {
                        Text("1年にもらう日数").font(.system(size: 14)).foregroundStyle(ink("ink"))
                        Spacer()
                        SettingsLeaveField(text: v.leaveGrant)
                    }
                    Picker(selection: Binding(get: { v.leaveStart }, set: { m in model.act { $0.setLeaveStart(m) } })) {
                        ForEach(0..<12, id: \.self) { Text("\($0 + 1)月").tag($0) }
                    } label: { Text("付く月").font(.system(size: 14)).foregroundStyle(ink("ink")) }
                    .pickerStyle(.menu)
                    .tint(ink("ink-mut"))
                }
            } footer: {
                VStack(alignment: .leading, spacing: 14) {
                    if v.leaveShown && !v.leaveText.isEmpty { Text(v.leaveText).font(.system(size: 14)).foregroundStyle(ink("ink")).lineSpacing(5) }
                    SettingsNote(text: "名前に「有給」「半休」がある休みを数えます")
                }
            }
            .listRowBackground(ink("card"))
        case "iphone":
            Section {
                SettingsButtonRow(action: { Task { await model.engine.openImport() } }) { SettingsValueRow(label: "予定を取り込む") }
                NavigationLink(value: "overlay") { SettingsValueRow(label: "重ねて表示", value: v.overlayLabel) }
                toggle("決まった予定を書き出す", v.exportCal) { model.toggleExportCal() }
            }
            .listRowBackground(ink("card"))
        case "overlay":
            Section {
                toggle("重ねて表示", v.overlayOn) { model.toggleOverlay() }
                ForEach(Array((model.state["overlayCals"]?.array ?? []).enumerated()), id: \.offset) { _, c in
                    let id = c["id"] ?? .null
                    let on = (model.state["settings"]?["overlayIds"]?.array ?? []).contains(id)
                    Button { model.toggleOverlayCal(id) } label: {
                        HStack(spacing: 12) {
                            Circle().fill(JS.truthy(c["color"]) ? ink.css(JS.string(c["color"])) : Palette.hex("#999")).frame(width: 10, height: 10)
                            Text(JS.string(c["title"])).font(.system(size: 14)).foregroundStyle(ink("ink"))
                            Spacer()
                            SettingsCheck(on: on).frame(width: 22, height: 22)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            } footer: { SettingsNote(text: "選んだカレンダーを灰色で表示します（保存はしません）") }
            .listRowBackground(ink("card"))
        case "data":
            Section {
                if v.syncShown {
                    toggle("iCloud で同期", sub: v.syncSub, v.sync) { model.toggleSync() }
                }
                SettingsButtonRow(action: { model.act { $0.openTrash() } }) { SettingsValueRow(label: "最近消した予定", value: "\(v.trashCount)件") }
                    .accessibilityIdentifier("settings.trash")
                NavigationLink(value: "backup") { SettingsValueRow(label: "控えと機種変更", value: v.backupLabel) }
                NavigationLink(value: "files") { SettingsValueRow(label: "ファイルで出し入れ") }
            } header: { Text("予定の保存") } footer: {
                SettingsNote(text: v.syncShown ? "予定は、この iPhone とあなたの iCloud にだけ保存します" : "予定は、この iPhone の中にだけ保存します")
            }
            .listRowBackground(ink("card"))
            Section {
                if model.lockAvailable { toggle("\(model.lockLabel) でロック", v.lock) { model.toggleLock() } }
                toggle("予定の名前を隠す", sub: "通知・ウィジェット", v.hideTitles) { model.act { $0.toggleSetting("hideTitles") } }
            } header: { Text("安全") }
            .listRowBackground(ink("card"))
        case "files":
            SettingsFilesSection(v: v)
        case "help":
            Section {
                Link(destination: URL(string: SupportCore.supportHref)!) { SettingsLinkLabel(label: "よくある質問") }
                SettingsButtonRow(action: { model.act { $0.replayGuide() } }) { SettingsValueRow(label: "使い方をもう一度見る") }
                Link(destination: URL(string: SettingsHelp.formHref(kind: "機能のリクエスト"))!) { SettingsLinkLabel(label: "機能をリクエストする") }
                Link(destination: URL(string: SettingsHelp.formHref(kind: ""))!) { SettingsLinkLabel(label: "お問い合わせ") }
                SettingsButtonRow(action: { model.act { $0.openDoc("terms") } }) { SettingsValueRow(label: "利用規約") }
                    .accessibilityIdentifier("help.terms")
                SettingsButtonRow(action: { model.act { $0.openDoc("privacy") } }) { SettingsValueRow(label: "プライバシーポリシー") }
                    .accessibilityIdentifier("help.privacy")
            }
            .listRowBackground(ink("card"))
        default:
            EmptyView()
        }
    }
}

/// 外へ出るリンクの行
struct SettingsLinkLabel: View {
    let label: String
    @Environment(\.ink) private var ink
    var body: some View {
        HStack(spacing: 8) {
            SettingsValueRow(label: label)
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(ink("ink-faint"))
        }
        .contentShape(Rectangle())
    }
}

/// お問い合わせ・機能のリクエストのフォーム（事前入力：種類・端末・版）
enum SettingsHelp {
    @MainActor
    static func formHref(kind: String) -> String {
        let d = UIDevice.current
        return SupportCore.formHref(version: "\(SettingsMain.marketing)（\(AppModel.version)）", kind: kind,
                                    device: SupportCore.deviceLabel(model: d.model, systemVersion: d.systemVersion))
    }
}

/// 有給の「1年にもらう日数」（数字と小数点だけ、60 まで）
struct SettingsLeaveField: View {
    let text: String
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @State private var draft = ""
    @FocusState private var focus: Bool
    var body: some View {
        TextField("", text: $draft)
            .focused($focus)
            .keyboardType(.decimalPad)
            .multilineTextAlignment(.trailing)
            .font(.system(size: 14)).foregroundStyle(ink("ink"))
            .padding(.horizontal, 10).padding(.vertical, 7)
            .frame(width: 70)
            .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 9))
            .onAppear { draft = text }
            .onChange(of: text) { _, t in if !focus { draft = t } }
            .onChange(of: draft) { _, s in if s != text { model.act { $0.setLeaveGrant(s) } } }
            .onChange(of: focus) { _, f in if !f { draft = text } }
    }
}

// MARK: - ファイルで出し入れ
struct SettingsFilesSection: View {
    let v: SettingsView
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @State private var picking = false
    var body: some View {
        Section {
            SettingsButtonRow(action: { model.engine.haptic("light"); picking = true }) { SettingsValueRow(label: "ファイルから取り込む", value: ".ics") }
            SettingsButtonRow(action: { model.exportIcs() }) { SettingsValueRow(label: "ファイルに書き出す", value: ".ics") }
            if v.tidyCount > 0 {
                SettingsButtonRow(action: { model.act { $0.openTidy() } }) { SettingsValueRow(label: "取り込んだ予定を整理する", value: "\(v.tidyCount)件") }
            }
            if v.undoImportShown {
                SettingsButtonRow(action: { model.act { $0.undoImport() } }) { SettingsValueRow(label: v.undoImportLabel) }
            }
        } footer: { SettingsNote(text: "TimeTree・Google カレンダーのファイルを取り込めます") }
        .listRowBackground(ink("card"))
        .fileImporter(isPresented: $picking, allowedContentTypes: SettingsFileShare.icsTypes, allowsMultipleSelection: false) { r in
            model.readIcsFile(r)
        }
    }
}

// MARK: - 控えと機種変更
struct SettingsBackupPage: View {
    let v: SettingsView
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @State private var picking = false
    @FocusState private var pasteFocus: Bool

    var body: some View {
        Form {
            Section {
                SettingsButtonRow(action: { model.openBackups() }) { SettingsValueRow(label: "端末の中の控え", value: v.backupLabel) }
                    .accessibilityIdentifier("backup.list")
                SettingsButtonRow(action: { model.exportBackup() }) { SettingsValueRow(label: "控えをファイルに保存", value: v.lastExportLabel) }
                SettingsButtonRow(action: { model.engine.haptic("light"); picking = true }) { SettingsValueRow(label: "ファイルから戻す") }
            } footer: {
                VStack(alignment: .leading, spacing: 8) {
                    SettingsNote(text: "毎日1回、自動でとります（7日分）")
                    if !v.backupError.isEmpty {
                        Text(v.backupError).font(.system(size: 12)).foregroundStyle(Palette.hex("#A8452B")).lineSpacing(3)
                            .accessibilityIdentifier("backup.error")
                    }
                }
            }
            .listRowBackground(ink("card"))
            Section {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("1").font(.system(size: 14, weight: .bold)).foregroundStyle(ink("ink"))
                    Text("「クイックスタート」か「iCloud バックアップから復元」で、予定も移ります").font(.system(size: 14)).foregroundStyle(ink("ink-soft")).lineSpacing(5)
                }
                .listRowSeparator(.hidden)
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("2").font(.system(size: 14, weight: .bold)).foregroundStyle(ink("ink"))
                    Text("移らなかったら：前の iPhone で「控えをファイルに保存」→ 新しい iPhone で「ファイルから戻す」").font(.system(size: 14)).foregroundStyle(ink("ink-soft")).lineSpacing(5)
                }
            } header: { Text("機種変更のとき") } footer: {
                Button { model.act { $0.togglePaste() } } label: {
                    Text("ファイルをえらべないときは、貼り付けで戻す").font(.system(size: 13)).underline().foregroundStyle(ink("ink-mut"))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
                .accessibilityIdentifier("backup.paste")
            }
            .listRowBackground(ink("card"))
            if v.pasteOpen {
                Section {
                    ZStack(alignment: .topLeading) {
                        if v.backupText.isEmpty {
                            Text("控えの中身を貼り付け").font(.system(size: 13)).foregroundStyle(ink("ink-faint")).padding(.horizontal, 13).padding(.vertical, 11)
                        }
                        TextEditor(text: Binding(get: { v.backupText }, set: { s in model.act { $0.setBackupText(s) } }))
                            .focused($pasteFocus)
                            .font(.system(size: 13))
                            .scrollContentBackground(.hidden)
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .frame(height: 96)
                            .accessibilityIdentifier("backup.pasteText")
                    }
                    .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
                    Button { pasteFocus = false; model.act { $0.askRestore() } } label: {
                        Text("この控えから戻す").font(.system(size: 14, weight: .bold)).foregroundStyle(ink("ink"))
                            .frame(maxWidth: .infinity).padding(12)
                            .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 13))
                            .overlay(RoundedRectangle(cornerRadius: 13).strokeBorder(ink("line")))
                    }
                    .buttonStyle(.plain)
                    .disabled(v.restoreDisabled)
                    .opacity(v.restoreDisabled ? 0.4 : 1)
                }
                .listRowBackground(ink("card"))
                .listRowSeparator(.hidden)
            }
        }
        .settingsForm()
        .fileImporter(isPresented: $picking, allowedContentTypes: SettingsFileShare.backupTypes, allowsMultipleSelection: false) { r in
            model.readBackupFile(r)
        }
        // 貼り付けているあいだは、下のタブを隠す（Web 版と同じ）
        .toolbar(v.pasteOpen ? .hidden : .automatic, for: .tabBar)
    }
}

// MARK: - 勤務先
struct SettingsJobsPage: View {
    let v: SettingsView
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        Form {
            Section {
                ForEach(Array(v.jobRows.enumerated()), id: \.offset) { _, j in
                    Button { model.act { $0.editJobRow(j.id) } } label: {
                        HStack(spacing: 12) {
                            Text(j.name).font(.system(size: 14)).foregroundStyle(j.retired ? ink("ink-faint") : ink("ink"))
                            Spacer(minLength: 0)
                            Text("¥\(j.hourly)").font(.system(size: 13.5)).monospacedDigit().foregroundStyle(ink("ink-mut"))
                            Image(systemName: j.open ? "chevron.down" : "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(ink("ink-faint"))
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if j.open { SettingsJobEditor(v: v, j: j) }
                }
                Button { model.act { $0.addJob() } } label: { SettingsAddLabel(label: v.jobAddLabel) }.buttonStyle(.plain)
            } footer: {
                VStack(alignment: .leading, spacing: 14) {
                    if v.retiredCount > 0 {
                        Button { model.act { $0.toggleShowRetired() } } label: {
                            Text(v.showRetired ? "辞めたところを隠す" : "辞めたところ（\(v.retiredCount)）も出す").font(.system(size: 13)).foregroundStyle(ink("ink-mut"))
                        }
                        .buttonStyle(.plain)
                    }
                    SettingsNote(text: "時給を変えても、記録済みの金額は変わりません")
                }
            }
            .listRowBackground(ink("card"))
        }
        .settingsForm()
    }
}

/// 「＋ 〜を追加」の行
struct SettingsAddLabel: View {
    let label: String
    @Environment(\.ink) private var ink
    var body: some View {
        HStack(spacing: 12) {
            Text("＋").font(.system(size: 15)).foregroundStyle(ink("ink")).frame(width: 26, height: 26).background(ink("bg2"), in: Circle())
            Text(label).font(.system(size: 14)).foregroundStyle(ink("ink"))
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
    }
}

/// 開いた勤務先の中身
struct SettingsJobEditor: View {
    let v: SettingsView
    let j: SettingsView.JobRow
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    private var nameText: String {
        let n = j.name.replacingOccurrences(of: "（辞めた）", with: "")
        return n == "（名前なし）" ? "" : n
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField(v.jobEg, text: Binding(get: { nameText }, set: { s in model.act { $0.patchJob(j.id, ["name": .string(s)]) } }))
                .font(.system(size: 14)).padding(.horizontal, 13).padding(.vertical, 11)
                .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
            HStack(spacing: 10) {
                Text("時給").font(.system(size: 14)).foregroundStyle(ink("ink"))
                Spacer(minLength: 0)
                stepButton("−", "時給を下げる") { model.act { $0.stepJobHourly(j.id, -10) } }
                HStack(spacing: 3) {
                    Text("¥").font(.system(size: 14)).foregroundStyle(ink("ink-soft"))
                    TextField("", text: Binding(get: { j.hourly }, set: { s in model.act { $0.setJobHourlyText(j.id, s) } }))
                        .keyboardType(.numberPad).multilineTextAlignment(.trailing).monospacedDigit()
                        .font(.system(size: 15)).frame(width: 60)
                }
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
                stepButton("＋", "時給を上げる") { model.act { $0.stepJobHourly(j.id, 10) } }
            }
            if j.rateNote {
                Button { model.act { $0.recountJob(j.id) } } label: {
                    Text("これまでの記録も新しい時給で数え直す").font(.system(size: 12)).underline().foregroundStyle(ink("ink-mut"))
                }
                .buttonStyle(.plain)
            }
            dayPicker("締め日", j.closeDay, none: "なし（月末まで）") { d in model.act { $0.setJobDay(j.id, close: d) } }
            dayPicker("給料日", j.payDay, none: "なし") { d in model.act { $0.setJobDay(j.id, pay: d) } }
            Divider()
            Text("シフトの型").font(.system(size: 13)).foregroundStyle(ink("ink-mut"))
            ForEach(Array(j.templates.enumerated()), id: \.offset) { k, t in
                HStack(spacing: 8) {
                    Text(t).font(.system(size: 14)).monospacedDigit().foregroundStyle(ink("ink"))
                    Spacer(minLength: 0)
                    Button { model.act { $0.removeTemplate(j.id, k) } } label: { Text("外す").font(.system(size: 13)).foregroundStyle(Palette.hex("#A8452B")) }
                        .buttonStyle(.plain)
                }
            }
            Button { model.act { $0.openTemplateNew(j.id) } } label: {
                Text("＋ 型を足す").font(.system(size: 13)).foregroundStyle(ink("ink-mut"))
                    .padding(.horizontal, 13).padding(.vertical, 7)
                    .overlay(Capsule().strokeBorder(ink("line"), style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
            }
            .buttonStyle(.plain)
            HStack {
                Text(j.usedCount > 0 ? "\(j.usedCount)件の予定で使っています" : "まだ使っていません").font(.system(size: 12)).foregroundStyle(ink("ink-faint"))
                Spacer(minLength: 0)
                Button { model.act { $0.retireJob(j.id, !j.retired) } } label: { Text(j.retireLabel).font(.system(size: 14)).foregroundStyle(ink("ink-soft")) }.buttonStyle(.plain)
                Button { model.act { $0.askRemoveJob(j.id) } } label: { Text("削除").font(.system(size: 14)).foregroundStyle(Palette.hex("#A8452B")) }.buttonStyle(.plain)
                    .padding(.leading, 14)
            }
            .padding(.top, 2)
        }
        .padding(.vertical, 4)
    }
    private func stepButton(_ s: String, _ a11y: String, _ f: @escaping () -> Void) -> some View {
        Button(action: f) {
            Text(s).font(.system(size: 18)).foregroundStyle(ink("ink"))
                .frame(width: 36, height: 36).background(ink("bg2"), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(a11y)
    }
    private func dayPicker(_ label: String, _ cur: Int, none: String, _ set: @escaping (Int) -> Void) -> some View {
        HStack {
            Text(label).font(.system(size: 14)).foregroundStyle(ink("ink"))
            Spacer()
            Picker("", selection: Binding(get: { cur }, set: set)) {
                Text(none).tag(0)
                ForEach(1...28, id: \.self) { Text("\($0)日").tag($0) }
                Text("月末").tag(31)
            }
            .labelsHidden().pickerStyle(.menu).tint(ink("ink")).fixedSize()
        }
    }
}

// MARK: - 予定の種類
struct SettingsTypesPage: View {
    let v: SettingsView
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        Form {
            Section {
                ForEach(Array(v.typeRows.enumerated()), id: \.offset) { _, t in
                    Button { model.act { $0.editTypeRow(t.key) } } label: {
                        HStack(spacing: 12) {
                            Circle().fill(ink.css(t.color)).frame(width: 18, height: 18).overlay(Circle().strokeBorder(.black.opacity(0.06)))
                            Text(t.name).font(.system(size: 14)).foregroundStyle(ink("ink"))
                            Spacer(minLength: 0)
                            Text(t.hint).font(.system(size: 13)).foregroundStyle(ink("ink-faint"))
                            Image(systemName: t.open ? "chevron.down" : "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(ink("ink-faint"))
                        }
                        .opacity(t.hidden && !t.open ? 0.55 : 1)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if t.open { SettingsTypeEditor(t: t) }
                }
                Button { model.act { $0.addTypeRow() } } label: { SettingsAddLabel(label: "種類を追加") }.buttonStyle(.plain)
                if v.newTypeShown { SettingsNewType(v: v).listRowBackground(ink("bg2")) }
            }
            .listRowBackground(ink("card"))
        }
        .settingsForm()
    }
}

/// 色 12 色（今の色は二重の輪）
struct SettingsSwatches: View {
    let current: String
    let pick: (String) -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 34, maximum: 34), spacing: 4)], alignment: .leading, spacing: 4) {
            ForEach(FormCore.pal, id: \.self) { hex in
                Button { pick(hex) } label: {
                    Circle().fill(ink.css(hex)).frame(width: 26, height: 26)
                        .overlay {
                            if hex == current {
                                Circle().strokeBorder(.white, lineWidth: 2).padding(-2)
                                Circle().strokeBorder(ink.css(hex), lineWidth: 2).padding(-4)
                            } else {
                                Circle().strokeBorder(.black.opacity(0.08), lineWidth: 1)
                            }
                        }
                        .frame(width: 34, height: 34)
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(hex)
            }
        }
        .padding(.horizontal, -4)
    }
}

struct SettingsTypeEditor: View {
    let t: SettingsView.TypeRow
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            TextField("種類の名前", text: Binding(get: { t.name }, set: { s in model.act { $0.renameType(t.key, .string(s)) } }))
                .font(.system(size: 14)).padding(.horizontal, 13).padding(.vertical, 11)
                .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
            SettingsSwatches(current: t.color) { hex in model.act { $0.recolorKey(t.key, hex) } }
            // 呼び名。仕事なら「仮押さえ／確定」のように、種類ごとに変えられる
            HStack(spacing: 8) {
                word("まだのとき（点線）", "例：仮押さえ", t.uWord) { s in model.act { $0.setTypeWords(t.key, "u", .string(s)) } }
                word("決まったとき（塗り）", "例：確定", t.cWord) { s in model.act { $0.setTypeWords(t.key, "c", .string(s)) } }
            }
            HStack(spacing: 8) {
                Text(t.usedCount > 0 ? "\(t.usedCount)件の予定で使っています" : "まだ使っていません").font(.system(size: 12)).foregroundStyle(ink("ink-faint"))
                Spacer(minLength: 0)
                if t.canUp { boxButton("↑", "上へ") { model.act { $0.moveType(t.key, -1) } } }
                if t.canDown { boxButton("↓", "下へ") { model.act { $0.moveType(t.key, 1) } } }
                boxButton(t.hideLabel, t.hideLabel) { model.act { $0.toggleTypeHidden(t.key) } }
                if t.canDelete {
                    Button { model.act { $0.askDeleteType(t.key) } } label: { Text("消す").font(.system(size: 14)).foregroundStyle(Palette.hex("#A8452B")).padding(.horizontal, 6) }
                        .buttonStyle(.plain)
                }
            }
            if t.deleting {
                VStack(alignment: .leading, spacing: 10) {
                    Text("予定をどの種類へ移しますか？").font(.system(size: 13)).foregroundStyle(ink("ink-soft"))
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 80), spacing: 6, alignment: .leading)], alignment: .leading, spacing: 6) {
                        ForEach(Array(t.moveTo.enumerated()), id: \.offset) { _, m in
                            Button { model.act { $0.deleteType(t.key, m.key) } } label: {
                                Text(m.label).font(.system(size: 12.5)).foregroundStyle(ink("ink")).lineLimit(1)
                                    .padding(.horizontal, 12).padding(.vertical, 7)
                                    .background(ink("card"), in: Capsule()).overlay(Capsule().strokeBorder(ink("line")))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Button { model.act { $0.set(["typeDelete": .null]) } } label: { Text("やめる").font(.system(size: 13)).foregroundStyle(ink("ink-mut")) }.buttonStyle(.plain)
                }
                .padding(12)
                .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(.vertical, 4)
    }
    private func word(_ label: String, _ ph: String, _ val: String, _ set: @escaping (String) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.system(size: 12)).foregroundStyle(ink("ink-mut"))
            TextField(ph, text: Binding(get: { val }, set: set))
                .font(.system(size: 14)).padding(.horizontal, 11).padding(.vertical, 9)
                .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 10))
        }
        .frame(maxWidth: .infinity)
    }
    private func boxButton(_ s: String, _ a11y: String, _ f: @escaping () -> Void) -> some View {
        Button(action: f) {
            Text(s).font(.system(size: 14)).foregroundStyle(ink("ink-soft"))
                .padding(.horizontal, 10).padding(.vertical, 6)
                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(ink("line")))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(a11y)
    }
}

/// 新しい種類の欄
struct SettingsNewType: View {
    let v: SettingsView
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            TextField(v.newTypeEg.isEmpty ? "種類の名前" : v.newTypeEg, text: Binding(get: { v.newTypeName }, set: { s in model.act { $0.setNewType(name: s) } }))
                .font(.system(size: 14)).padding(.horizontal, 13).padding(.vertical, 11)
                .background(ink("card"), in: RoundedRectangle(cornerRadius: 12))
            SettingsSwatches(current: v.newTypeColor) { hex in model.act { $0.setNewType(color: hex) } }
            HStack(spacing: 8) {
                Button { model.act { $0.cancelNewType() } } label: {
                    Text("やめる").font(.system(size: 14, weight: .semibold)).foregroundStyle(ink("ink-soft"))
                        .frame(maxWidth: .infinity).padding(11).background(ink("card"), in: RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
                Button { model.act { $0.addType() } } label: {
                    Text("この種類を追加").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(11).background(ink.css(v.newTypeColor), in: RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 10)
    }
}

// MARK: - シート
/// 使い方のシート
struct ProfileSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        let v = model.engine.settingsView()
        SettingsSheetFrame(title: "ふだんの予定に近いのは？", close: { model.act { $0.set(["profileSheet": .null]) } }) {
            VStack(spacing: 8) {
                ForEach(Array(v.profileOpts.enumerated()), id: \.offset) { _, o in
                    Button { model.act { $0.pickProfile(o.key.string ?? "student") } } label: {
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(o.label).font(.system(size: 14)).foregroundStyle(ink("ink"))
                                Text(Self.notes[o.key.string ?? ""] ?? "").font(.system(size: 12)).foregroundStyle(ink("ink-mut"))
                            }
                            Spacer(minLength: 0)
                            if o.sel { Text("いま").font(.system(size: 13)).foregroundStyle(ink("ink-mut")) }
                        }
                        .padding(.horizontal, 16).padding(.vertical, 14)
                        .background(ink("card"), in: RoundedRectangle(cornerRadius: 15))
                        .overlay(RoundedRectangle(cornerRadius: 15).strokeBorder(o.sel ? ink("ink") : ink("line")))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            if v.profileRetireShown {
                Button { model.act { $0.toggleProfileRetire() } } label: {
                    HStack(spacing: 10) {
                        SettingsCheck(on: v.profileRetireOn)
                        Text("バイト先をまとめて「辞めた」にする（記録は残ります）").font(.system(size: 13)).foregroundStyle(ink("ink-soft")).multilineTextAlignment(.leading)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 12)
                    .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
                .padding(.top, 14)
            }
            SettingsBullets(items: ["予定の種類・呼び名・空きを見る時間が変わります", "予定はそのまま残ります"]).padding(.top, 12)
        }
    }
    static let notes = ["student": "授業・サークル・バイト", "work": "会議・打ち合わせ・出張", "shift": "看護・介護・販売・飲食など", "free": "案件・打ち合わせ・納期", "family": "保育園・学校行事・通院"]
}

/// 四角いチェック
struct SettingsCheck: View {
    let on: Bool
    @Environment(\.ink) private var ink
    var body: some View {
        ZStack {
            if on {
                RoundedRectangle(cornerRadius: 6).fill(ink("ink"))
                Text("✓").font(.system(size: 12, weight: .heavy)).foregroundStyle(ink("card"))
            } else {
                RoundedRectangle(cornerRadius: 6).strokeBorder(ink("line"), lineWidth: 1.5)
            }
        }
        .frame(width: 20, height: 20)
    }
}

/// 説明の箇条書き（2 つ以上のとき）
struct SettingsBullets: View {
    let items: [String]
    @Environment(\.ink) private var ink
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(items, id: \.self) { t in
                HStack(alignment: .firstTextBaseline, spacing: 6) { Text("・"); Text(t) }
            }
        }
        .font(.system(size: 11.5)).foregroundStyle(ink("ink-faint")).lineSpacing(4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
    }
}

/// 下から出るシートの枠：上に題と「閉じる」（つまみは iPhone 標準）
struct SettingsSheetFrame<Content: View>: View {
    let title: String
    let close: () -> Void
    @ViewBuilder let content: () -> Content
    @Environment(\.ink) private var ink
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(title).font(.system(size: 14, weight: .semibold)).foregroundStyle(ink("ink"))
                Spacer()
                Button("閉じる", action: close).font(.system(size: 14)).foregroundStyle(ink("ink-mut"))
            }
            .padding(.horizontal, 20).padding(.top, 22).padding(.bottom, 14)
            ScrollView {
                VStack(alignment: .leading, spacing: 0) { content() }
                    .padding(.horizontal, 16).padding(.bottom, 34)
            }
        }
        .background(ink("bg").ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

/// 最近消した予定
struct SettingsTrashSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        let v = model.engine.settingsView()
        SettingsSheetFrame(title: "最近消した予定", close: { model.act { $0.closeTrash() } }) {
            if v.trashRows.isEmpty {
                Text("消した予定はありません").font(.system(size: 14)).foregroundStyle(ink("ink-faint")).frame(maxWidth: .infinity).padding(.vertical, 30)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(v.trashRows.enumerated()), id: \.offset) { i, r in
                        if i > 0 { Rectangle().fill(ink("line")).frame(height: 1) }
                        HStack(spacing: 10) {
                            Text(r.when).font(.system(size: 13)).monospacedDigit().foregroundStyle(ink("ink-mut")).frame(width: 40, alignment: .leading).lineLimit(1).minimumScaleFactor(0.7)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(r.title).font(.system(size: 14)).foregroundStyle(ink("ink")).lineLimit(1)
                                Text(r.gone).font(.system(size: 11)).foregroundStyle(ink("ink-faint"))
                            }
                            Spacer(minLength: 0)
                            Button { model.act { $0.restoreTrashRow(r.key) } } label: {
                                Text("戻す").font(.system(size: 12)).foregroundStyle(ink("card")).padding(.horizontal, 12).padding(.vertical, 6).background(ink("ink"), in: Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 14).padding(.vertical, 12)
                    }
                }
                .background(ink("card"), in: RoundedRectangle(cornerRadius: 15))
            }
        }
    }
}

/// 端末の中の控え
struct SettingsBackupListSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        let v = model.engine.settingsView()
        SettingsSheetFrame(title: "端末の中の控え", close: { model.act { $0.closeBackupList() } }) {
            if v.backupRows.isEmpty {
                Text("まだ控えはありません").font(.system(size: 14)).foregroundStyle(ink("ink-faint")).frame(maxWidth: .infinity).padding(.vertical, 30)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(v.backupRows.enumerated()), id: \.offset) { i, b in
                        if i > 0 { Rectangle().fill(ink("line")).frame(height: 1).padding(.leading, 16) }
                        SettingsButtonRow(action: { pick(b.key) }) { SettingsValueRow(label: b.label) }
                            .padding(.horizontal, 16).frame(minHeight: 42)
                    }
                }
                .background(ink("card"), in: RoundedRectangle(cornerRadius: 15))
            }
            SettingsBullets(items: ["毎日1回、自動でとります", "7日分と、月初めの3か月分を残します"]).padding(.top, 12)
        }
    }
    /// シートを閉じてから確かめる（閉じる途中に確認を重ねない）
    private func pick(_ name: String) {
        model.act { $0.closeBackupList() }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 450_000_000)
            model.pickLocalBackup(name)
        }
    }
}

/// シフトの型を足す
struct SettingsTemplateSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        let v = model.engine.settingsView()
        let ready = !v.tplSym.isEmpty
        SettingsSheetFrame(title: "シフトの型を足す", close: { model.act { $0.closeTemplateNew() } }) {
            VStack(spacing: 0) {
                row(label: "記号（1〜2文字）", sub: "例：日・夜・早・遅・休") {
                    TextField("", text: Binding(get: { v.tplSym }, set: { s in model.act { $0.setTemplateSym(s) } }))
                        .multilineTextAlignment(.center).font(.system(size: 14)).frame(width: 44)
                        .padding(.vertical, 7).background(ink("bg2"), in: RoundedRectangle(cornerRadius: 9))
                }
                line
                row(label: "名前") {
                    TextField("日勤", text: Binding(get: { v.tplName }, set: { s in model.act { $0.setTemplateName(s) } }))
                        .font(.system(size: 14)).frame(width: 90)
                        .padding(.horizontal, 10).padding(.vertical, 7).background(ink("bg2"), in: RoundedRectangle(cornerRadius: 9))
                }
                line
                row(label: "休み（終日）") {
                    Toggle("", isOn: Binding(get: { v.tplAllDay }, set: { on in model.act { $0.patchTemplateNew(["allDay": .bool(on)]) } })).labelsHidden().tint(SupportFont.sage)
                }
                if !v.tplAllDay {
                    line
                    row(label: "時間", sub: "終わりが早ければ翌日まで（夜勤）") {
                        HStack(spacing: 5) {
                            SettingsTimePicker(value: v.tplFrom) { n in model.act { $0.patchTemplateNew(["from": .number(n)]) } }
                            Text("〜").foregroundStyle(ink("ink-mut"))
                            SettingsTimePicker(value: v.tplTo) { n in model.act { $0.patchTemplateNew(["to": .number(n)]) } }
                        }
                    }
                    line
                    row(label: "いつもの休憩") {
                        Picker("", selection: Binding(get: { Int(v.tplBrk) }, set: { m in model.act { $0.patchTemplateNew(["brk": .number(Double(m))]) } })) {
                            ForEach([0, 15, 30, 45, 60, 90, 120], id: \.self) { m in Text(m == 0 ? "なし" : "\(m)分").tag(m) }
                        }
                        .labelsHidden().pickerStyle(.menu).tint(ink("ink")).fixedSize()
                    }
                }
            }
            .background(ink("card"), in: RoundedRectangle(cornerRadius: 15))
            Button { model.act { $0.saveTemplateNew() } } label: {
                Text("この型を足す").font(.system(size: 14, weight: .bold))
                    .foregroundStyle(ready ? ink("card") : ink("ink-faint"))
                    .frame(maxWidth: .infinity).padding(14)
                    .background(ready ? ink("ink") : ink("bg2"), in: RoundedRectangle(cornerRadius: 15))
            }
            .buttonStyle(.plain)
            .padding(.top, 14)
        }
    }
    private var line: some View { Rectangle().fill(ink("line")).frame(height: 1).padding(.leading, 16) }
    private func row<R: View>(label: String, sub: String = "", @ViewBuilder right: () -> R) -> some View {
        HStack(spacing: 12) {
            SettingsValueRow(label: label, sub: sub)
            right()
        }
        .padding(.horizontal, 16).padding(.vertical, 8).frame(minHeight: 42)
    }
}

// MARK: - 規約・プライバシーポリシー
struct SettingsDocScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        let doc = DocsText.all[JS.string(model.state["docKey"])]
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let doc {
                    Text(doc.lead).font(.system(size: 14)).foregroundStyle(ink("ink-soft")).lineSpacing(9).padding(.bottom, 26)
                    ForEach(Array(doc.sections.enumerated()), id: \.offset) { _, sec in
                        VStack(alignment: .leading, spacing: 0) {
                            Text(sec.h).font(.system(size: 14, weight: .bold)).foregroundStyle(ink("ink")).padding(.bottom, 8)
                            ForEach(Array(sec.p.enumerated()), id: \.offset) { _, t in
                                Text(t).font(.system(size: 13.5)).foregroundStyle(ink("ink-soft")).lineSpacing(9).padding(.bottom, 10)
                            }
                        }
                        .padding(.bottom, 16)
                    }
                    Rectangle().fill(ink("line")).frame(height: 1).padding(.top, 6).padding(.bottom, 14)
                    Text("最終更新：\(DocsText.effective)").font(.system(size: 11.5)).foregroundStyle(ink("ink-faint"))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 60)
        }
        .background(ink("bg").ignoresSafeArea())
        .navigationTitle(doc?.title ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
    }
}
