import SwiftUI
import LukkoKit

/// 確認（削除・控えから戻す・候補の片づけ など）を、iPhone 標準のアラート／アクションシートで出す。
/// 中身（Engine.alertSpec）が nil でないあいだ出し、押されたボタンを Engine.runAlert に渡す
struct AlertPresenter: ViewModifier {
    @Environment(AppModel.self) private var model

    func body(content: Content) -> some View {
        let spec = model.ready ? model.engine.alertSpec() : nil
        content
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
