import SwiftUI
import LukkoKit

/// 画面の下に出る一言（トースト）と、取り消しの帯。どちらも中身（shareToast・undo）を見て出す
struct BottomOverlays: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let st = model.state
        let undo = st["undo"].flatMap { JS.truthy($0) ? $0 : nil }
        let toastShown = JS.truthy(st["shareToast"]) && st["screen"] != "summary" && st["screen"] != "share"
        VStack(spacing: 8) {
            Spacer()
            if toastShown {
                Text(JS.string(st["shareMsg"])).font(.subheadline).foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .background(Color.black.opacity(0.85), in: RoundedRectangle(cornerRadius: 14))
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .allowsHitTesting(false)
            }
            if let undo {
                HStack {
                    Text(JS.string(undo["text"])).font(.subheadline).foregroundStyle(.white).lineLimit(1)
                    Spacer()
                    Button("元に戻す") { model.act { $0.undoLast() } }
                        .font(.subheadline.weight(.semibold)).foregroundStyle(Color(red: 0x5F / 255, green: 0xD4 / 255, blue: 0xA8 / 255))
                }
                .padding(.horizontal, 16).padding(.vertical, 12)
                .background(Color.black.opacity(0.88), in: RoundedRectangle(cornerRadius: 14))
                .padding(.horizontal, 16)
                .id(JS.string(undo["key"]))
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .padding(.bottom, 96)
        .animation(.snappy(duration: 0.24), value: toastShown)
        .animation(.snappy(duration: 0.24), value: JS.string(undo?["key"]))
    }
}
