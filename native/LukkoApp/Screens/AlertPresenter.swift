import SwiftUI
import LukkoKit

/// 確認（削除・控えから戻す・候補の片づけ など）を、iPhone 標準のアラート／アクションシートで出す。
/// 中身（Engine.alertSpec）が nil でないあいだ出し、押されたボタンを Engine.runAlert に渡す。
///
/// シートが出ているあいだは、その下の画面からはアラートを出せない（iPhone は一度に 1 枚しか重ねない）。
/// なので、新しい予定のシートの中の確認（書きかけを捨てるか・くり返しの編集）は、シートの中に置いた presenter（scope: .form）が出す。
/// どのアラートにも「キャンセル」の役のボタンがあり、外側を押して閉じたときは iPhone がそのボタンを押したことにする
struct AlertPresenter: ViewModifier {
    enum Scope { case main, form }
    var scope: Scope = .main
    @Environment(AppModel.self) private var model

    /// 新しい予定のシートの中で出すもの
    static let formKeys: Set<String> = ["discard", "repedit"]

    func body(content: Content) -> some View {
        // 中身が変わったら描き直す（Engine は見張られていないので、state を読んでおく）
        let ready = model.ready && !model.state.isEmpty
        let all = ready ? model.engine.alertSpec() : nil
        let spec = all.flatMap { sp in Self.formKeys.contains(sp.key) == (scope == .form) ? sp : nil }
        return content
            .alert(spec?.title ?? "", isPresented: shown(spec, sheet: false), presenting: spec) { sp in
                buttons(sp)
            } message: { sp in
                if let m = sp.message { Text(m) }
            }
            .confirmationDialog(spec?.title ?? "", isPresented: shown(spec, sheet: true), titleVisibility: .visible, presenting: spec) { sp in
                buttons(sp)
            } message: { sp in
                if let m = sp.message { Text(m) }
            }
    }

    private func shown(_ spec: AlertSpec?, sheet: Bool) -> Binding<Bool> {
        Binding(get: { spec != nil && spec!.sheet == sheet }, set: { _ in })
    }

    @ViewBuilder
    private func buttons(_ sp: AlertSpec) -> some View {
        ForEach(Array(sp.buttons.enumerated()), id: \.offset) { _, b in
            Button(b.label, role: b.style == "destructive" ? .destructive : b.style == "cancel" ? .cancel : nil) {
                model.act { $0.runAlert(b.run) }
            }
            .keyboardShortcut(b.preferred ? .defaultAction : nil)
        }
    }
}
