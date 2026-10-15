import SwiftUI
import LukkoKit

/// 画面の下に出る一言（トースト）と、取り消しの帯。どちらも中身（shareToast・undo）を見て出す。
/// 下のタブの上に置く。墨の地に紙の色の字（暗い表示では逆になる）
struct BottomOverlays: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let st = model.state
        let undo = st["undo"].flatMap { JS.truthy($0) ? $0 : nil }
        // まとめ／空きシェアの画面では出さない
        let toastShown = JS.truthy(st["shareToast"]) && st["screen"] != "summary" && st["screen"] != "share"
        VStack(spacing: 8) {
            Spacer()
            if toastShown {
                // 押せない（下のものを押せなくしない）
                Text(JS.string(st["shareMsg"])).font(.system(size: 13, weight: .semibold)).foregroundStyle(ink("card"))
                    .multilineTextAlignment(.center).lineSpacing(3)
                    .padding(.horizontal, 18).padding(.vertical, 11)
                    .background(ink("ink"), in: RoundedRectangle(cornerRadius: 14))
                    .padding(.horizontal, 24)
                    .transition(.offset(y: 8).combined(with: .opacity))
                    .allowsHitTesting(false)
                    .accessibilityIdentifier("toast")
            }
            if let undo {
                HStack(spacing: 12) {
                    Text(JS.string(undo["text"])).font(.system(size: 13)).foregroundStyle(ink("card")).lineLimit(1).truncationMode(.tail)
                    Spacer(minLength: 0)
                    Button { model.act { $0.undoLast() } } label: {
                        Text("元に戻す").font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color(red: 0x8F / 255, green: 0xD3 / 255, blue: 0xB6 / 255))
                            .padding(.vertical, 4).padding(.horizontal, 2)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("undo.button")
                }
                .padding(.leading, 16).padding(.trailing, 14).padding(.vertical, 12)
                .background(ink("ink"), in: RoundedRectangle(cornerRadius: 14))
                .shadow(color: .black.opacity(0.25), radius: 15, y: 10)
                .padding(.horizontal, 14)
                .id(JS.string(undo["key"]))
                .transition(.offset(y: 8).combined(with: .opacity))
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("undo.bar")
            }
        }
        // 下のタブのすぐ上
        .padding(.bottom, 57)
        .animation(.easeOut(duration: 0.24), value: toastShown)
        .animation(.easeOut(duration: 0.24), value: JS.string(undo?["key"]))
    }
}
