import SwiftUI
import LukkoKit

@main
struct LukkoApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

/// 土台を確かめるための仮の画面。これから本物の画面に置き換えていく
struct RootView: View {
    var body: some View {
        TabView {
            NavigationStack {
                List {
                    Section("土台の確認") {
                        Text("LukkoKit：保存ファイル \(StoreFile.fileName)")
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
