//
//  WidgetBridge.swift
//  決まってる？
//
//  アプリ（WebView）から、ウィジェットが読める置き場へ書き渡すための窓口。
//
//  ウィジェットは別のプログラムなので、アプリの中のデータは見えない。
//  App Group という共有の置き場を1つ作って、そこにアプリが JSON を書き、
//  ウィジェットがそれを読む。この窓口がやることは2つだけ。
//
//    1. 渡された JSON を App Group の置き場に入れる
//    2. ウィジェットに「中身が変わった」と伝える
//
//  App Group の名前（group.com.kimatteru.app）は、
//  ・このファイル（JS から渡される）
//  ・App ターゲットの Signing & Capabilities
//  ・ウィジェット拡張の Signing & Capabilities
//  の3か所でそろえる。1か所でも違うと、エラーにならずに黙って届かなくなる。
//

import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)
    ]

    @objc func save(_ call: CAPPluginCall) {
        guard let group = call.getString("group"),
              let key = call.getString("key"),
              let json = call.getString("json") else {
            call.reject("渡すものが足りません")
            return
        }
        // suiteName が App Group として登録されていないと nil になる。
        // ここで失敗したら、たいていは Capabilities の付け忘れか名前違い。
        guard let store = UserDefaults(suiteName: group) else {
            call.reject("共有の置き場を開けませんでした（App Group の名前を確かめてください）")
            return
        }
        store.set(json, forKey: key)

        // ウィジェットに描き直させる。これを呼ばないと、iOS の都合のいい時間まで古いまま。
        // 呼んでも即座に描き直るとは限らない（1日に描ける回数に上限がある）。
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve(["size": json.count])
    }
}
