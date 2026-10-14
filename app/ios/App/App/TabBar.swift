//
//  TabBar.swift
//  LUKKO
//
//  下のタブ（カレンダー・空き状況・まとめ・設定）と、右に離した丸い「＋」を、
//  iPhone の本物の部品で描く。iOS 26 では本物の Liquid Glass（UIGlassEffect）、
//  それより前の iOS では iPhone 標準のすりガラス（UIBlurEffect）。
//
//  画面の中身は WebView（JS）が描いている。このタブはその上に重ねて置く。
//    JS → set({ visible, selected, dark })  出す・隠す、選んでいるタブ、暗い表示か
//    JS ← "tap" { tab: "month" | "free" | "report" | "settings" | "add" }
//
//  位置と大きさは Web のときと同じ（左右 21・高さ 62・下はホームバーから 13 上、最低 8）。
//  カレンダーの下の余白などは Web 側がこの寸法で取ってある。
//
//  登録は ViewController.swift。
//

import UIKit
import Capacitor

@objc(TabBarPlugin)
public class TabBarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TabBarPlugin"
    public let jsName = "LukkoTabBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    private var bar: NativeTabBar?

    @objc func set(_ call: CAPPluginCall) {
        let visible = call.getBool("visible") ?? false
        let selected = call.getString("selected") ?? ""
        let dark = call.getBool("dark")
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController?.view else { call.resolve(); return }
            if self.bar == nil {
                let b = NativeTabBar()
                b.onTap = { [weak self] key in self?.notifyListeners("tap", data: ["tab": key]) }
                b.attach(to: host)
                self.bar = b
            }
            guard let b = self.bar else { call.resolve(); return }
            if let d = dark { b.overrideUserInterfaceStyle = d ? .dark : .light }
            b.select(selected)
            b.setVisible(visible)
            call.resolve()
        }
    }
}

final class NativeTabBar: UIView {
    var onTap: ((String) -> Void)?

    private let keys = ["month", "free", "report", "settings"]
    private let titles = ["カレンダー", "空き状況", "まとめ", "設定"]
    private var buttons: [UIButton] = []
    private let pill: UIVisualEffectView
    private let fab: UIVisualEffectView
    private let indicator = UIView()
    private let stack = UIStackView()
    private var current = ""
    private var shown = false

    init() {
        pill = UIVisualEffectView(effect: NativeTabBar.material())
        fab = UIVisualEffectView(effect: NativeTabBar.material())
        super.init(frame: .zero)
        build()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// iOS 26 なら Liquid Glass、それより前は標準のすりガラス
    static func material() -> UIVisualEffect {
        // Xcode 26（Swift 6.2）より前で組むときは、Liquid Glass の部品が無いので書かない
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            return UIGlassEffect()
        }
        #endif
        return UIBlurEffect(style: .systemChromeMaterial)
    }

    private func build() {
        translatesAutoresizingMaskIntoConstraints = false
        alpha = 0
        isHidden = true

        // 4つのタブの板
        pill.translatesAutoresizingMaskIntoConstraints = false
        pill.layer.cornerRadius = 31
        pill.layer.cornerCurve = .continuous
        pill.clipsToBounds = true
        addSubview(pill)

        indicator.backgroundColor = UIColor.label.withAlphaComponent(0.08)
        indicator.layer.cornerRadius = 26
        indicator.layer.cornerCurve = .continuous
        indicator.alpha = 0
        pill.contentView.addSubview(indicator)

        stack.axis = .horizontal
        stack.distribution = .fillEqually
        stack.translatesAutoresizingMaskIntoConstraints = false
        pill.contentView.addSubview(stack)

        for (i, key) in keys.enumerated() {
            var cfg = UIButton.Configuration.plain()
            cfg.image = NativeTabBar.icon(for: key)
            cfg.imagePlacement = .top
            cfg.imagePadding = 3
            cfg.title = titles[i]
            cfg.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { a in
                var a = a
                a.font = UIFont.systemFont(ofSize: 10, weight: .semibold)
                return a
            }
            cfg.contentInsets = NSDirectionalEdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0)
            let b = UIButton(configuration: cfg)
            b.tag = i
            b.addTarget(self, action: #selector(tapTab(_:)), for: .touchUpInside)
            b.accessibilityLabel = titles[i]
            buttons.append(b)
            stack.addArrangedSubview(b)
        }

        // 右の丸い「＋」
        fab.translatesAutoresizingMaskIntoConstraints = false
        fab.layer.cornerRadius = 31
        fab.layer.cornerCurve = .continuous
        fab.clipsToBounds = true
        addSubview(fab)
        var plus = UIButton.Configuration.plain()
        plus.image = UIImage(systemName: "plus", withConfiguration: UIImage.SymbolConfiguration(pointSize: 22, weight: .medium))
        plus.baseForegroundColor = .label
        let add = UIButton(configuration: plus)
        add.translatesAutoresizingMaskIntoConstraints = false
        add.accessibilityLabel = "予定を追加"
        add.addTarget(self, action: #selector(tapAdd), for: .touchUpInside)
        fab.contentView.addSubview(add)

        NSLayoutConstraint.activate([
            fab.trailingAnchor.constraint(equalTo: trailingAnchor),
            fab.topAnchor.constraint(equalTo: topAnchor),
            fab.bottomAnchor.constraint(equalTo: bottomAnchor),
            fab.widthAnchor.constraint(equalTo: heightAnchor),
            pill.leadingAnchor.constraint(equalTo: leadingAnchor),
            pill.topAnchor.constraint(equalTo: topAnchor),
            pill.bottomAnchor.constraint(equalTo: bottomAnchor),
            pill.trailingAnchor.constraint(equalTo: fab.leadingAnchor, constant: -10),
            stack.leadingAnchor.constraint(equalTo: pill.contentView.leadingAnchor, constant: 5),
            stack.trailingAnchor.constraint(equalTo: pill.contentView.trailingAnchor, constant: -5),
            stack.topAnchor.constraint(equalTo: pill.contentView.topAnchor),
            stack.bottomAnchor.constraint(equalTo: pill.contentView.bottomAnchor),
            add.leadingAnchor.constraint(equalTo: fab.contentView.leadingAnchor),
            add.trailingAnchor.constraint(equalTo: fab.contentView.trailingAnchor),
            add.topAnchor.constraint(equalTo: fab.contentView.topAnchor),
            add.bottomAnchor.constraint(equalTo: fab.contentView.bottomAnchor),
        ])
        recolor()
    }

    /// 画面に置く。Web のときと同じ位置（左右 21・高さ 62・下はホームバーの線から 13 上、最低でも 8）
    func attach(to host: UIView) {
        host.addSubview(self)
        let bottom = bottomAnchor.constraint(equalTo: host.safeAreaLayoutGuide.bottomAnchor, constant: 13)
        bottom.priority = .defaultHigh
        NSLayoutConstraint.activate([
            leadingAnchor.constraint(equalTo: host.leadingAnchor, constant: 21),
            trailingAnchor.constraint(equalTo: host.trailingAnchor, constant: -21),
            heightAnchor.constraint(equalToConstant: 62),
            bottom,
            bottomAnchor.constraint(lessThanOrEqualTo: host.bottomAnchor, constant: -8),
        ])
    }

    /// 空き状況は、アプリの印（○△×）をそのまま絵にする。ほかは iPhone の記号（SF Symbols）
    static func icon(for key: String) -> UIImage? {
        let sym = UIImage.SymbolConfiguration(pointSize: 19, weight: .regular)
        switch key {
        case "month": return UIImage(systemName: "calendar", withConfiguration: sym)
        case "report": return UIImage(systemName: "chart.bar", withConfiguration: sym)
        case "settings": return UIImage(systemName: "gearshape", withConfiguration: sym)
        default:
            let font = UIFont.systemFont(ofSize: 15, weight: .regular)
            let s = NSMutableAttributedString()
            s.append(NSAttributedString(string: "○", attributes: [.font: font, .foregroundColor: UIColor(red: 0x1D/255, green: 0x9E/255, blue: 0x75/255, alpha: 1), .kern: -2]))
            s.append(NSAttributedString(string: "△", attributes: [.font: font, .foregroundColor: UIColor(red: 0xB9/255, green: 0x77/255, blue: 0x0F/255, alpha: 1), .kern: -2]))
            s.append(NSAttributedString(string: "×", attributes: [.font: font, .foregroundColor: UIColor(red: 0xC1/255, green: 0xC5/255, blue: 0xCC/255, alpha: 1)]))
            let size = s.size()
            let img = UIGraphicsImageRenderer(size: CGSize(width: ceil(size.width), height: 22)).image { _ in
                s.draw(at: CGPoint(x: 0, y: (22 - size.height) / 2))
            }
            return img.withRenderingMode(.alwaysOriginal)
        }
    }

    @objc private func tapTab(_ b: UIButton) {
        guard b.tag < keys.count else { return }
        onTap?(keys[b.tag])
    }
    @objc private func tapAdd() { onTap?("add") }

    func select(_ key: String) {
        guard key != current else { return }
        current = key
        recolor()
        setNeedsLayout()
        UIView.animate(withDuration: 0.35, delay: 0, usingSpringWithDamping: 0.82, initialSpringVelocity: 0.4, options: [.allowUserInteraction, .beginFromCurrentState]) {
            self.layoutIfNeeded()
            self.placeIndicator()
        }
    }

    private func recolor() {
        for (i, b) in buttons.enumerated() {
            b.configuration?.baseForegroundColor = keys[i] == current ? .label : .secondaryLabel
        }
    }

    private func placeIndicator() {
        guard let i = keys.firstIndex(of: current), i < buttons.count else { indicator.alpha = 0; return }
        let f = buttons[i].convert(buttons[i].bounds, to: pill.contentView)
        indicator.frame = CGRect(x: f.minX, y: (pill.bounds.height - 52) / 2, width: f.width, height: 52)
        indicator.alpha = 1
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        placeIndicator()
    }

    func setVisible(_ on: Bool) {
        guard on != shown else { return }
        shown = on
        superview?.bringSubviewToFront(self)
        if on { isHidden = false; transform = CGAffineTransform(translationX: 0, y: 12) }
        UIView.animate(withDuration: 0.28, delay: 0, options: [.curveEaseOut, .beginFromCurrentState]) {
            self.alpha = on ? 1 : 0
            self.transform = on ? .identity : CGAffineTransform(translationX: 0, y: 12)
        } completion: { _ in
            if !self.shown { self.isHidden = true }
        }
    }
}
