import SwiftUI
import LukkoKit

/// 保存についての知らせ（いまの版の view.jsx「保存についての知らせ」の写し）。
///
/// 予定が消えることは、機能がひとつ動かないのとは重さが違う。保存できていないことを黙っていると、
/// いちばん悪い形で気づく——画面には出ているのに、閉じて開いたら消えている。だから必ず出す。
struct SystemSaveBanner: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let st = model.state
        let failed = JS.truthy(st["saveFailed"])
        let recovered = JS.truthy(st["recovered"])
        VStack(spacing: 8) {
            if failed {
                card(title: "予定を保存できていません",
                     body: "端末の空き容量を確かめてください。念のため、いま控えを書き出しておくことをおすすめします。",
                     bg: Color(red: 0x7A / 255, green: 0x2E / 255, blue: 0x1C / 255),
                     fg: Color(red: 0xFF / 255, green: 0xF3 / 255, blue: 0xEE / 255), bodyOpacity: 0.9, shadow: 0.3)
                    .onTapGesture { model.act { $0.set(["screen": "settings", "setPage": "backup", "pasteOpen": false]) } }
                    .accessibilityIdentifier("system.saveFailed")
            }
            if recovered {
                card(title: "保存されていた\(JS.string(st["recovered"]))件の予定を戻しました",
                     body: "端末の保存領域が整理されたようです。中身を確かめてください。",
                     bg: ink("ink"), fg: ink("card"), bodyOpacity: 0.85, shadow: 0.25)
                    .onTapGesture { model.act { $0.set(["recovered": .null]) } }
                    .accessibilityIdentifier("system.recovered")
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.top, 10)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: failed)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: recovered)
    }

    private func card(title: String, body: String, bg: Color, fg: Color, bodyOpacity: Double, shadow: Double) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.system(size: 14, weight: .bold))
            Text(body).font(.system(size: 12)).lineSpacing(4).opacity(bodyOpacity)
        }
        .foregroundStyle(fg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 13).padding(.horizontal, 16)
        .background(bg, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: .black.opacity(shadow), radius: 15, y: 10)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}
