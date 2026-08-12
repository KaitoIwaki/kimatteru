# ウィジェット拡張のターゲットを Xcode プロジェクトに足す。
#
# Mac が手元に無いので、Xcode を開く代わりにこれを走らせる。
# Codemagic（macOS）の上で、cap sync のあと・ビルドの前に流す。
#
# 何度流しても同じ結果になるように書いてある（すでにあれば何もしない）。
# cap sync がプロジェクトを書き換えることがあるので、毎回流して構わない。
#
# 実行: ruby app/tools/add-widget-target.rb
require 'xcodeproj'

# __dir__ は app/tools。その1つ上が app/。
# ここを '../..' にすると根まで出てしまい、ios/App を見つけられない（実際にやった）。
ROOT       = File.expand_path('..', __dir__)             # app/
PROJECT    = File.join(ROOT, 'ios/App/App.xcodeproj')
WIDGET     = 'KimatteruWidget'
WIDGET_DIR = File.join(ROOT, 'ios/App', WIDGET)
APP_BUNDLE = 'com.kimatteru.app'
WIDGET_BUNDLE = "#{APP_BUNDLE}.widget"

abort("プロジェクトが無い: #{PROJECT}") unless File.exist?(PROJECT)
proj = Xcodeproj::Project.open(PROJECT)
app  = proj.targets.find { |t| t.name == 'App' } or abort('App ターゲットが見つからない')

# ---- 1. App 側：共有の置き場を使えるようにする、窓口の Swift を入れる ----
app.build_configurations.each do |c|
  c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end

# App/ の中の .swift で、まだターゲットに入っていないものを入れる。
# 1つずつ名前を書くと、足したときに入れ忘れる（ViewController.swift で実際にやりかけた）。
app_group = proj.main_group.find_subpath('App', true)
Dir[File.join(ROOT, 'ios/App/App/*.swift')].sort.each do |path|
  name = File.basename(path)
  next if app.source_build_phase.files_references.any? { |r| r.path.to_s.end_with?(name) }
  ref = app_group.find_file_by_path(name) || app_group.new_file(path)
  app.add_file_references([ref])
  puts "・#{name} を App に入れた"
end

# ---- 2. ウィジェットのターゲット ----
target = proj.targets.find { |t| t.name == WIDGET }
if target
  puts "・#{WIDGET} はすでにある"
else
  target = proj.new_target(:app_extension, WIDGET, :ios, '15.0')
  puts "・#{WIDGET} を作った"
end

# ソース。フォルダの中の .swift を全部入れる
group = proj.main_group.find_subpath(WIDGET, true)
group.set_source_tree('SOURCE_ROOT')
group.set_path(WIDGET)
Dir[File.join(WIDGET_DIR, '*.swift')].sort.each do |path|
  name = File.basename(path)
  next if target.source_build_phase.files_references.any? { |r| r.path.to_s.end_with?(name) }
  ref = group.find_file_by_path(name) || group.new_file(path)
  target.add_file_references([ref])
  puts "・#{name} を #{WIDGET} に入れた"
end

# ---- 3. ビルド設定 ----
# 版とビルド番号は App と同じにする。ずれていると App Store が受け取らない。
# VERSIONING_SYSTEM を入れておかないと、agvtool の採番が拡張に効かない。
target.build_configurations.each do |c|
  c.build_settings.merge!(
    'PRODUCT_BUNDLE_IDENTIFIER'    => WIDGET_BUNDLE,
    'PRODUCT_NAME'                 => WIDGET,
    'INFOPLIST_FILE'               => "#{WIDGET}/Info.plist",
    'CODE_SIGN_ENTITLEMENTS'       => "#{WIDGET}/#{WIDGET}.entitlements",
    'CODE_SIGN_STYLE'              => 'Automatic',
    'SWIFT_VERSION'                => '5.0',
    'IPHONEOS_DEPLOYMENT_TARGET'   => '15.0',
    'TARGETED_DEVICE_FAMILY'       => '1',
    'MARKETING_VERSION'            => '1.0',
    'CURRENT_PROJECT_VERSION'      => '1',
    'VERSIONING_SYSTEM'            => 'apple-generic',
    'SKIP_INSTALL'                 => 'YES',
    'GENERATE_INFOPLIST_FILE'      => 'YES',
    'INFOPLIST_KEY_CFBundleDisplayName' => '決まってる？',
    'ENABLE_USER_SCRIPT_SANDBOXING' => 'NO'
  )
end

# ---- 4. アプリに埋め込む ----
# 拡張は本体の中に入れて届ける。この手順を忘れると、ビルドは通るのに
# ウィジェットがどこにも出てこない、という形で出る。
embed = app.build_phases.find { |p| p.respond_to?(:name) && p.name == 'Embed App Extensions' }
unless embed
  embed = app.new_copy_files_build_phase('Embed App Extensions')
  embed.symbol_dst_subfolder_spec = :plug_ins
  puts '・埋め込みの手順を足した'
end
unless embed.files_references.include?(target.product_reference)
  f = embed.add_file_reference(target.product_reference)
  f.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  puts '・ウィジェットを埋め込む対象にした'
end
unless app.dependencies.any? { |d| d.target == target }
  app.add_dependency(target)
  puts '・App がウィジェットを先に作るようにした'
end

proj.save

# ---- 5. 確かめる ----
# 入っているつもりで入っていない、が一番たちが悪い。ビルドは通り、アプリも動き、
# ウィジェットにだけ何も届かない。そうなると実機を見ても原因が分からないので、
# ここで声を上げて止める。
app_src    = app.source_build_phase.files_references.map { |r| r.path.to_s }
widget_src = target.source_build_phase.files_references.map { |r| r.path.to_s }
embedded   = embed.files_references.map { |r| r.path.to_s }

puts "できた: #{PROJECT}"
puts "  ターゲット        : #{proj.targets.map(&:name).join(', ')}"
puts "  App のソース      : #{app_src.join(', ')}"
puts "  ウィジェットのソース: #{widget_src.join(', ')}"
puts "  埋め込むもの      : #{embedded.join(', ')}"

fail_msgs = []
unless app_src.any? { |f| f.end_with?('WidgetBridge.swift') }
  fail_msgs << '★ WidgetBridge.swift が App に入っていない（窓口が無いのでウィジェットに何も届かない）'
end
unless app_src.any? { |f| f.end_with?('ViewController.swift') }
  fail_msgs << '★ ViewController.swift が App に入っていない（窓口を登録する場所が無い）'
end
fail_msgs << '★ ウィジェットのソースが空' if widget_src.empty?
fail_msgs << '★ ウィジェットが埋め込まれていない' if embedded.empty?
unless fail_msgs.empty?
  puts fail_msgs
  abort('組み込みが不完全なので、ここで止める')
end
puts '確かめた：窓口・ウィジェット・埋め込み、すべて入っている'
