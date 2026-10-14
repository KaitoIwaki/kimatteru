// swift-tools-version: 5.9
// LUKKO の中身（予定の形・保存・引っ越し・計算）。画面（SwiftUI）とは分けて、ここだけで試せるようにする。
import PackageDescription

let package = Package(
    name: "LukkoKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "LukkoKit", targets: ["LukkoKit"]),
    ],
    targets: [
        .target(name: "LukkoKit"),
        .testTarget(name: "LukkoKitTests", dependencies: ["LukkoKit"], resources: [.copy("Fixtures")]),
    ]
)
