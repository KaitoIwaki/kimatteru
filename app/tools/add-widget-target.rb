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

app_group = proj.main_group.find_subpath('App', true)
bridge = File.join(ROOT, 'ios/App/App/WidgetBridge.swift')
if File.exist?(bridge)
  already = app.source_build_phase.files_references.any? { |r| r.path.to_s.end_with?('WidgetBridge.swift') }
  unless already
    ref = app_group.find_file_by_path('WidgetBridge.swift') || app_group.new_file(bridge)
    app.add_file_references([ref])
    puts '・WidgetBridge.swift を App に入れた'
  end
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
puts "できた: #{PROJECT}"
puts "  ターゲット: #{proj.targets.map(&:name).join(', ')}"
