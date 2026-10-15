import SwiftUI
import StoreKit
import LukkoKit

/// 起動のいちばん初め。通知を押してアプリが開いたときの知らせは、ここで受け取る役を決めておかないと届かない
final class LukkoAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        Notifier.shared.attach()
        return true
    }
}

@main
struct LukkoApp: App {
    @UIApplicationDelegateAdaptor(LukkoAppDelegate.self) private var appDelegate
    @State private var model = AppModel(data: AppData())
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(model.data)
                .task { await Self.boot(model) }
                .onChange(of: scenePhase) { _, p in model.scenePhaseChanged(p) }
        }
    }

    /// 起動。試験のときは、起動の引数で「いまの版が書いた状態」を作ってから始める
    @MainActor
    static func boot(_ model: AppModel) async {
        let data = model.data
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-lukkoTestReset") { data.resetForTest() }
        if args.contains("-lukkoTestBlockWrites") { data.blockWritesForTest() }
        if args.contains("-lukkoClearLocalStorage") { _ = await LocalStorageReader.clear() }
        if let i = args.firstIndex(of: "-lukkoSeedLocalStorage"), i + 1 < args.count,
           let raw = Data(base64Encoded: args[i + 1]), let json = String(data: raw, encoding: .utf8) {
            // シミュレーターが重いと書き込みが間に合わないことがある。読み返して同じになるまで、やり直す
            for _ in 0..<4 {
                _ = await LocalStorageReader.write(["kimatteru.v2": json], timeout: 20)
                if await LocalStorageReader.read(keys: ["kimatteru.v2"], timeout: 20)?["kimatteru.v2"] == json { break }
            }
        }
        if let i = args.firstIndex(of: "-lukkoSeedFile"), i + 1 < args.count, let raw = Data(base64Encoded: args[i + 1]) {
            try? SafeFile.write(raw, to: data.fileURL)
        }
        await model.start()
        if let i = args.firstIndex(of: "-lukkoTestState"), i + 1 < args.count,
           let raw = Data(base64Encoded: args[i + 1]), case .object(let patch)? = try? JSONDecoder().decode(JSONValue.self, from: raw) {
            // 試験用：画面の状態（保存しないもの）を直に入れる（保存の知らせ・ロックの画面などの写真のため）
            model.act { e in e.set(patch.mapValues { Optional($0) }) }
        }
    }
}

/// いちばん外側。読み込みが済むまでは何も出さない（中身が空のカレンダーを一瞬見せない）
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.colorScheme) private var scheme
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.requestReview) private var requestReview
    static let debug = ProcessInfo.processInfo.arguments.contains("-lukkoDebug")

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if model.ready {
                MainTabs()
            } else {
                Color(.systemBackground).ignoresSafeArea()
            }
            if Self.debug { DebugBadge() }
            // 保存についての知らせ（いちばん上に、必ず出す）
            if model.ready { SystemSaveBanner() }
            LockedCover()
            // ロックを入れている人は、アプリの切り替え画面に中身を見せない（いまの版の lukko.shield と同じ）
            if JS.truthy(model.state["settings"]?["lock"]) && scenePhase != .active {
                Rectangle().fill(.regularMaterial).ignoresSafeArea()
            }
        }
        .environment(\.ink, Ink(dark: model.dark))
        .preferredColorScheme(forcedScheme)
        .onAppear {
            model.sysDark = scheme == .dark
            readSystemZoom()
        }
        .onChange(of: scheme) { _, s in model.sysDark = s == .dark }
        .onChange(of: typeSize) { _, _ in readSystemZoom() }
        // うれしい瞬間にだけ、控えめに（Engine.maybeAskReview が 1.2 秒待ってから合図する）
        .onChange(of: model.reviewAsks) { _, _ in requestReview() }
    }

    /// iPhone の文字の大きさ（本文の pt）を、予定の字の倍率にする
    private func readSystemZoom() {
        model.sysZoom = SystemCore.sysZoom(bodyPointSize: Double(UIFont.preferredFont(forTextStyle: .body).pointSize))
    }

    /// 設定で「明るい／暗い」を選んでいるときだけ、アプリ全体をそちらにする（iPhone に合わせるときは何もしない）
    private var forcedScheme: ColorScheme? {
        let cfg = model.state["settings"] ?? .null
        let th = JS.truthy(cfg["theme"]) ? JS.string(cfg["theme"]) : (JS.truthy(cfg["dark"]) ? "dark" : "light")
        if th == "auto" { return nil }
        return th == "dark" ? .dark : .light
    }
}

/// 引っ越しの確かめ（試験のときだけ）
struct DebugBadge: View {
    @Environment(AppData.self) private var data
    @Environment(AppModel.self) private var model
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(data.loaded ? "予定 \(data.events.count) 件" : "読み込み中").accessibilityIdentifier("debug.eventCount")
            Text("使った中身：\(data.chosenSource)").accessibilityIdentifier("debug.source")
            Text(widgetText).accessibilityIdentifier("debug.widget")
        }
        .font(.caption2)
        .padding(6)
        .background(.yellow.opacity(0.85), in: RoundedRectangle(cornerRadius: 6))
        .padding(.leading, 8).padding(.bottom, 100)
    }
    /// 設定の診断と同じ言い方（渡せた（N日ぶん・N文字）／渡せなかった：理由／まだ渡していない）
    private var widgetText: String {
        guard let r = model.widgetLast else { return "ウィジェット：（まだ渡していない）" }
        return r.ok ? "ウィジェット：渡せた（\(r.days)日ぶん・\(r.size)文字）" : "ウィジェット：渡せなかった：\(r.why)"
    }
}

/// 下のタブ（iPhone 標準の TabView）。カレンダー・空き状況・まとめ・設定と、右に「＋」
struct MainTabs: View {
    @Environment(AppModel.self) private var model

    /// 押されたタブ。同じタブをもう一度押したときも呼ばれる（カレンダーなら今日へ・設定なら最初の画面へ）
    private var tab: Binding<String> {
        Binding(get: { model.tab }, set: { new in model.tapTab(new) })
    }

    /// 下のタブ。iOS 18 からは Tab で組み、「＋」を役割 .search にする（iOS 26 では Apple Music の検索のように、右に独立した丸いボタンになる）
    @ViewBuilder private var tabs: some View {
        if #available(iOS 18.0, *) {
            TabView(selection: tab) {
                Tab("カレンダー", systemImage: "calendar", value: "month") { MonthScreen() }
                Tab(value: "free") { FreeScreen() } label: {
                    Label { Text("空き状況") } icon: { Image(uiImage: SystemTabIcon.free).renderingMode(.original) }
                }
                Tab("まとめ", systemImage: "chart.bar", value: "report") { ReportScreen() }
                Tab("設定", systemImage: "gearshape", value: "settings") { SettingsScreen() }
                // 「＋」：今月を見ていれば今日、別の月ならその月の 1 日で新しい予定（このタブには移らない）
                Tab("追加", systemImage: "plus", value: "add", role: .search) { Color.clear }
            }
        } else {
            TabView(selection: tab) {
                MonthScreen()
                    .tabItem { Label("カレンダー", systemImage: "calendar") }
                    .tag("month")
                FreeScreen()
                    .tabItem {
                        Label { Text("空き状況") } icon: { Image(uiImage: SystemTabIcon.free).renderingMode(.original) }
                    }
                    .tag("free")
                ReportScreen()
                    .tabItem { Label("まとめ", systemImage: "chart.bar") }
                    .tag("report")
                SettingsScreen()
                    .tabItem { Label("設定", systemImage: "gearshape") }
                    .tag("settings")
                Color.clear
                    .tabItem { Label("追加", systemImage: "plus.circle.fill") }
                    .tag("add")
            }
        }
    }

    var body: some View {
        tabs
        .sheet(isPresented: Binding(get: { model.state["screen"] == "new" }, set: { on in
            // 下へ払って閉じた（書きかけが無いときだけ払える）
            if !on && model.state["screen"] == "new" { model.act { $0.cancelForm() } }
        })) {
            FormScreen().environment(\.ink, Ink(dark: model.dark))
        }
        .sheet(isPresented: Binding(get: { JS.truthy(model.state["dialog"]) && !JS.truthy(model.state["dialog"]?["phase"]) }, set: { on in
            if !on && JS.truthy(model.state["dialog"]) { model.act { $0.dlgDismiss() } }
        })) {
            DialogSheet().environment(\.ink, Ink(dark: model.dark))
        }
        .sheet(isPresented: Binding(get: { model.state["screen"] == "import" }, set: { on in
            if !on && model.state["screen"] == "import" { model.act { $0.set(["screen": "settings"]) } }
        })) {
            NavigationStack {
                ImportScreen()
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { model.act { $0.set(["screen": "settings"]) } } } }
            }
            .environment(\.ink, Ink(dark: model.dark))
        }
        .fullScreenCover(isPresented: Binding(get: { !JS.truthy(model.state["settings"]?["onboarded"]) }, set: { _ in })) {
            OnboardingView().environment(\.ink, Ink(dark: model.dark))
        }
        .overlay { BottomOverlays() }
        .modifier(AlertPresenter())
        // 応援（消耗型）の、あとで届く購入を受け取る（承認待ちのあとで通ったもの など）
        .task { SupportStore.shared.listen(model) }
    }
}
