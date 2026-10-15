import SwiftUI
import LukkoKit

@main
struct LukkoApp: App {
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
        if let i = args.firstIndex(of: "-lukkoSeedLocalStorage"), i + 1 < args.count,
           let raw = Data(base64Encoded: args[i + 1]), let json = String(data: raw, encoding: .utf8) {
            _ = await LocalStorageReader.write(["kimatteru.v2": json])
        }
        if let i = args.firstIndex(of: "-lukkoSeedFile"), i + 1 < args.count, let raw = Data(base64Encoded: args[i + 1]) {
            try? SafeFile.write(raw, to: data.fileURL)
        }
        await model.start()
    }
}

/// いちばん外側。読み込みが済むまでは何も出さない（中身が空のカレンダーを一瞬見せない）
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.colorScheme) private var scheme
    @Environment(\.scenePhase) private var scenePhase
    static let debug = ProcessInfo.processInfo.arguments.contains("-lukkoDebug")

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if model.ready {
                MainTabs()
            } else {
                Color(.systemBackground).ignoresSafeArea()
            }
            if Self.debug { DebugBadge() }
            LockedCover()
            // ロックを入れている人は、アプリの切り替え画面に中身を見せない
            if JS.truthy(model.state["settings"]?["lock"]) && scenePhase != .active {
                Rectangle().fill(.ultraThinMaterial).ignoresSafeArea()
            }
        }
        .environment(\.ink, Ink(dark: model.dark))
        .preferredColorScheme(forcedScheme)
        .onAppear { model.sysDark = scheme == .dark }
        .onChange(of: scheme) { _, s in model.sysDark = s == .dark }
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
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(data.loaded ? "予定 \(data.events.count) 件" : "読み込み中").accessibilityIdentifier("debug.eventCount")
            Text("使った中身：\(data.chosenSource)").accessibilityIdentifier("debug.source")
        }
        .font(.caption2)
        .padding(6)
        .background(.yellow.opacity(0.85), in: RoundedRectangle(cornerRadius: 6))
        .padding(.leading, 8).padding(.bottom, 100)
    }
}

/// 下のタブ（iPhone 標準の TabView）。カレンダー・空き状況・まとめ・設定
struct MainTabs: View {
    @Environment(AppModel.self) private var model

    private var tab: Binding<String> {
        Binding(get: {
            switch model.state["screen"]?.string {
            case "free": return "free"
            case "report": return "report"
            case "settings": return "settings"
            default: return "month"
            }
        }, set: { new in
            model.act { e in
                switch new {
                case "month": e.set(["screen": "month", "dayNum": .null, "detailId": .null])
                case "free": e.set(["screen": "free"])
                case "report": e.set(["screen": "report"])
                default: e.set(["screen": "settings", "editTypeKey": .null, "setPage": .null])
                }
            }
        })
    }

    var body: some View {
        TabView(selection: tab) {
            MonthScreen()
                .tabItem { Label("カレンダー", systemImage: "calendar") }
                .tag("month")
            FreeScreen()
                .tabItem { Label("空き状況", systemImage: "circle.grid.2x2") }
                .tag("free")
            ReportScreen()
                .tabItem { Label("まとめ", systemImage: "chart.bar") }
                .tag("report")
            SettingsScreen()
                .tabItem { Label("設定", systemImage: "gearshape") }
                .tag("settings")
        }
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
    }
}

/// まだ作っていない画面（作り終えたら消す）
struct PlaceholderScreen: View {
    let title: String
    var body: some View {
        NavigationStack {
            ContentUnavailableView(title, systemImage: "hammer", description: Text("SwiftUI 版で作っているところです"))
                .navigationTitle(title)
        }
    }
}
