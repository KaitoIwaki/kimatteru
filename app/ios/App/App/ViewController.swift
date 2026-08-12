//
//  ViewController.swift
//  決まってる？
//
//  アプリの中に直接書いたプラグインを登録するための入り口。
//
//  Capacitor が自動で見つけてくれるのは、npm のパッケージとして配られている
//  プラグインだけ（CapApp-SPM の Package.swift に並んでいるもの）。
//  このアプリの中に書いた WidgetBridge は、その一覧に載らないので、
//  ここで自分から登録しないと JS 側から見えない。
//
//  実際、これが無いあいだは、Swift はちゃんと組み込まれていたのに
//  isPluginAvailable('WidgetBridge') が false のままだった。
//
//  Main.storyboard の画面クラスも、CAPBridgeViewController から
//  このクラスに差し替えてある（片方だけ変えると呼ばれない）。
//

import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}
