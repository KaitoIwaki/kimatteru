import SwiftUI
import LukkoKit

@main
struct LukkoApp: App {
    @State private var data = AppData()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(data)
                .task { await Self.boot(data) }
        }
    }

    /// 起動。試験のときは、起動の引数で「いまの版が書いた状態」を作ってから始める
    @MainActor
    static func boot(_ data: AppData) async {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-lukkoTestReset") { data.resetForTest() }
        if let i = args.firstIndex(of: "-lukkoSeedLocalStorage"), i + 1 < args.count,
           let raw = Data(base64Encoded: args[i + 1]), let json = String(data: raw, encoding: .utf8) {
            _ = await LocalStorageReader.write(["kimatteru.v2": json])
        }
        if let i = args.firstIndex(of: "-lukkoSeedFile"), i + 1 < args.count, let raw = Data(base64Encoded: args[i + 1]) {
            try? SafeFile.write(raw, to: data.fileURL)
        }
        await data.start()
    }
}

/// 土台を確かめるための仮の画面。これから本物の画面に置き換えていく
struct RootView: View {
    @Environment(AppData.self) private var data

    var body: some View {
        TabView {
            NavigationStack {
                List {
                    Section("引っ越しの確認") {
                        Text(data.loaded ? "予定 \(data.events.count) 件" : "読み込み中")
                            .accessibilityIdentifier("debug.eventCount")
                        Text("使った中身：\(data.chosenSource)")
                            .accessibilityIdentifier("debug.source")
                        ForEach(Array(data.migrationLog.enumerated()), id: \.offset) { _, line in
                            Text(line).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Section("土台の確認") {
                        Toggle("帯に時刻を出す", isOn: .constant(true))
                    }
                }
                .navigationTitle("10月")
            }
            .tabItem { Label("カレンダー", systemImage: "calendar") }
            Text("空き状況").tabItem { Label("空き状況", systemImage: "circle.grid.2x1") }
            Text("まとめ").tabItem { Label("まとめ", systemImage: "chart.bar") }
            Text("設定").tabItem { Label("設定", systemImage: "gearshape") }
        }
    }
}
