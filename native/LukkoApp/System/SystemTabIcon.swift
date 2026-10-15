import UIKit

/// 下のタブの「空き状況」の印。いまの版（TabBar.swift）と同じく、アプリの印（○△×）をそのまま絵にする
enum SystemTabIcon {
    static let free: UIImage = {
        let font = UIFont.systemFont(ofSize: 15, weight: .regular)
        let s = NSMutableAttributedString()
        s.append(NSAttributedString(string: "○", attributes: [.font: font, .foregroundColor: UIColor(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255, alpha: 1), .kern: -2]))
        s.append(NSAttributedString(string: "△", attributes: [.font: font, .foregroundColor: UIColor(red: 0xB9 / 255, green: 0x77 / 255, blue: 0x0F / 255, alpha: 1), .kern: -2]))
        s.append(NSAttributedString(string: "×", attributes: [.font: font, .foregroundColor: UIColor(red: 0xC1 / 255, green: 0xC5 / 255, blue: 0xCC / 255, alpha: 1)]))
        let size = s.size()
        let img = UIGraphicsImageRenderer(size: CGSize(width: ceil(size.width), height: 22)).image { _ in
            s.draw(at: CGPoint(x: 0, y: (22 - size.height) / 2))
        }
        return img.withRenderingMode(.alwaysOriginal)
    }()
}
